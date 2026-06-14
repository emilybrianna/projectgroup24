import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ClosetType = "top" | "bottom" | "outerwear" | "accessory";

type ClosetItem = {
  id: string;
  user_id: string | null;
  name: string;
  type: ClosetType;
  color: string;
  style: string;
  occasion: string;
  image_url: string;
  signature?: number;
  created_at?: string;
};

type MatchSuggestion = {
  item: ClosetItem;
  percent: number;
  reasons: string[];
};

const typeOptions: ClosetType[] = ["top", "bottom", "outerwear", "accessory"];
const colorOptions = ["Black", "White", "Blue", "Green", "Pink", "Brown", "Cream", "Grey"];
const styleOptions = ["Casual", "Streetwear", "Formal", "Sporty", "Minimal", "Cute"];
const occasionOptions = ["Daily", "Class", "Work", "Dinner", "Event", "Travel"];

const getLocalClosetKey = (userId: string | null) => `virtualCloset:${userId || "guest"}`;
const getNextItemName = (items: ClosetItem[]) => `Item ${items.length + 1}`;
const getTextSignature = (value: string) =>
  value.split("").reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 3), 0);
const normalizeClosetNames = (items: ClosetItem[]) =>
  items.map((item, index) => ({
    ...item,
    name: `Item ${index + 1}`,
    signature: item.signature || getTextSignature(`${item.id}-${item.image_url}`),
  }));

const inferType = (text: string, signature: number, width?: number, height?: number): ClosetType => {
  const value = text.toLowerCase();

  if (/jacket|hoodie|coat|blazer|cardigan|outer/.test(value)) return "outerwear";
  if (/pants|jeans|skirt|short|trouser|bottom/.test(value)) return "bottom";
  if (/bag|hat|cap|belt|necklace|scarf|accessor|sunglass/.test(value)) return "accessory";

  if (width && height) {
    if (height > width * 1.35) return "bottom";
    if (width > height * 1.15) return "top";
  }

  return typeOptions[signature % typeOptions.length];
};

const inferColor = (text: string, signature: number) => {
  const value = text.toLowerCase();
  return colorOptions.find((color) => value.includes(color.toLowerCase())) || colorOptions[signature % colorOptions.length];
};

const inferStyle = (text: string, signature: number) => {
  const value = text.toLowerCase();
  return styleOptions.find((style) => value.includes(style.toLowerCase())) || styleOptions[signature % styleOptions.length];
};

const inferOccasion = (text: string, signature: number) => {
  const value = text.toLowerCase();
  return occasionOptions.find((occasion) => value.includes(occasion.toLowerCase())) || occasionOptions[signature % occasionOptions.length];
};

const isComplementaryType = (source: ClosetItem, candidate: ClosetItem) => {
  if (source.type === candidate.type) return false;
  if (source.type === "top") return candidate.type === "bottom" || candidate.type === "outerwear" || candidate.type === "accessory";
  if (source.type === "bottom") return candidate.type === "top" || candidate.type === "outerwear";
  if (source.type === "outerwear") return candidate.type === "top" || candidate.type === "bottom";
  return candidate.type === "top" || candidate.type === "outerwear";
};

const getColorCompatibility = (firstColor: string, secondColor: string) => {
  const first = firstColor.toLowerCase();
  const second = secondColor.toLowerCase();
  const neutral = /black|white|cream|grey|gray|brown/.test(first) || /black|white|cream|grey|gray|brown/.test(second);

  if (first === second) return { score: 12, reason: `${firstColor} color match` };
  if (neutral) return { score: 18, reason: "neutral color balance" };
  if (
    (first === "blue" && /white|cream|grey|brown/.test(second)) ||
    (second === "blue" && /white|cream|grey|brown/.test(first))
  ) {
    return { score: 15, reason: "soft color pairing" };
  }

  if ((first === "pink" && second === "green") || (first === "green" && second === "pink")) {
    return { score: -8, reason: "color may clash" };
  }

  return { score: 2, reason: "different color mood" };
};

const getTypeCompatibilityScore = (source: ClosetItem, candidate: ClosetItem) => {
  if (source.type === candidate.type) return -35;
  if (
    (source.type === "top" && candidate.type === "bottom") ||
    (source.type === "bottom" && candidate.type === "top")
  ) {
    return 30;
  }
  if (
    (source.type === "outerwear" && candidate.type === "top") ||
    (source.type === "top" && candidate.type === "outerwear")
  ) {
    return 22;
  }
  if (candidate.type === "accessory" || source.type === "accessory") return 14;
  return 18;
};

const getMatchSuggestion = (source: ClosetItem, candidate: ClosetItem): MatchSuggestion => {
  let score = 28 + getTypeCompatibilityScore(source, candidate);
  const reasons: string[] = [];
  const pairSignature = ((source.signature || getTextSignature(source.id)) + (candidate.signature || getTextSignature(candidate.id))) % 17;
  const pairAdjustment = pairSignature - 8;

  if (isComplementaryType(source, candidate)) {
    reasons.push(`${candidate.type} completes ${source.type}`);
  } else {
    reasons.push("same clothing role");
  }

  if (source.style === candidate.style) {
    score += 20;
    reasons.push(`${source.style} style`);
  } else if (
    [source.style, candidate.style].includes("Casual") ||
    [source.style, candidate.style].includes("Minimal")
  ) {
    score += 8;
    reasons.push("easy style pairing");
  } else {
    score -= 10;
    reasons.push("different style");
  }

  if (source.occasion === candidate.occasion) {
    score += 18;
    reasons.push(`${source.occasion} occasion`);
  } else if ([source.occasion, candidate.occasion].includes("Daily")) {
    score += 7;
    reasons.push("daily-wear friendly");
  } else {
    score -= 8;
    reasons.push("occasion mismatch");
  }

  const colorCompatibility = getColorCompatibility(source.color, candidate.color);
  score += colorCompatibility.score;
  reasons.push(colorCompatibility.reason);
  score += pairAdjustment;

  return {
    item: candidate,
    percent: Math.max(18, Math.min(Math.round(score), 98)),
    reasons: reasons.slice(0, 3),
  };
};

export default function VirtualCloset() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstItem, setFirstItem] = useState<ClosetItem | null>(null);
  const [secondItem, setSecondItem] = useState<ClosetItem | null>(null);
  const [lastDetected, setLastDetected] = useState("");

  const [imageUri, setImageUri] = useState("");

  useEffect(() => {
    loadCloset();
  }, []);

  const pairMatch = useMemo(() => {
    if (!firstItem || !secondItem) return null;
    return getMatchSuggestion(firstItem, secondItem);
  }, [firstItem, secondItem]);

  const selectWardrobeItem = (item: ClosetItem) => {
    if (firstItem?.id === item.id) {
      setFirstItem(secondItem);
      setSecondItem(null);
      return;
    }

    if (secondItem?.id === item.id) {
      setSecondItem(null);
      return;
    }

    if (!firstItem) {
      setFirstItem(item);
      return;
    }

    setSecondItem(item);
  };

  const loadCloset = async () => {
    setLoading(true);

    const nextUserId = await AsyncStorage.getItem("userId");
    setUserId(nextUserId);

    const localKey = getLocalClosetKey(nextUserId);
    const localItems = normalizeClosetNames(
      JSON.parse((await AsyncStorage.getItem(localKey)) || "[]") as ClosetItem[]
    );
    setItems(localItems);
    await AsyncStorage.setItem(localKey, JSON.stringify(localItems));
    setLoading(false);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow photo access to upload clothing images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);

    const fileName = asset.uri.split("/").pop()?.replace(/\.[^.]+$/, "") || "Clothing Item";
    await savePickedImage({
      uri: asset.uri,
      sourceName: fileName.replace(/[-_]/g, " "),
      width: asset.width,
      height: asset.height,
    });
  };

  const savePickedImage = async ({
    uri,
    sourceName,
    width,
    height,
  }: {
    uri: string;
    sourceName: string;
    width?: number;
    height?: number;
  }) => {
    setSaving(true);

    try {
      const signature = getTextSignature(`${sourceName}-${uri}-${width || 0}-${height || 0}`);
      const detectedType = inferType(sourceName, signature, width, height);
      const detectedColor = inferColor(sourceName, signature);
      const detectedStyle = inferStyle(sourceName, signature);
      const detectedOccasion = inferOccasion(sourceName, signature);

      const newItem: ClosetItem = {
        id: `${Date.now()}`,
        user_id: userId,
        name: getNextItemName(items),
        type: detectedType,
        color: detectedColor,
        style: detectedStyle,
        occasion: detectedOccasion,
        image_url: uri,
        signature,
        created_at: new Date().toISOString(),
      };

      const nextItems = normalizeClosetNames([newItem, ...items]);
      const savedItem = nextItems[0];
      setItems(nextItems);
      setFirstItem(savedItem);
      setSecondItem(null);
      setLastDetected(`${savedItem.name}: ${savedItem.type} / ${savedItem.color} / ${savedItem.style} / ${savedItem.occasion}`);
      await AsyncStorage.setItem(getLocalClosetKey(userId), JSON.stringify(nextItems));
      Alert.alert("Saved", `${savedItem.name} detected as ${savedItem.type}. Tap wardrobe items to see match percentage.`);
    } catch {
      Alert.alert("Error", "The clothing item could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={container}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Virtual Closet</Text>
            <Text style={subtitle}>Upload clothes and generate wardrobe outfits</Text>
          </View>
        </View>

        <View style={uploadPanel}>
          <TouchableOpacity onPress={pickImage} style={imagePicker}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={pickedImage} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={34} color="#6D28D9" />
                <Text style={pickerText}>Upload clothing image</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={pickImage} disabled={saving} style={saveButton}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={saveText}>Upload And Detect</Text>
              </>
            )}
          </TouchableOpacity>

          {lastDetected ? (
            <View style={detectedBox}>
              <Ionicons name="sparkles-outline" size={16} color="#059669" />
              <Text style={detectedText}>Detected: {lastDetected}</Text>
            </View>
          ) : (
            <Text style={uploadHint}>Upload a clothing photo. The closet will detect type automatically.</Text>
          )}
        </View>

        <View style={sectionHeader}>
          <Text style={sectionTitle}>My Wardrobe</Text>
          <TouchableOpacity onPress={loadCloset}>
            <Ionicons name="refresh-outline" size={20} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={emptyBox}>
            <ActivityIndicator color="#6D28D9" />
          </View>
        ) : items.length > 0 ? (
          <View style={closetGrid}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => selectWardrobeItem(item)}
                style={[
                  closetCard,
                  firstItem?.id === item.id && activeClosetCard,
                  secondItem?.id === item.id && secondClosetCard,
                ]}
              >
                <Image source={{ uri: item.image_url }} style={closetImage} />
                {(firstItem?.id === item.id || secondItem?.id === item.id) && (
                  <View style={selectionBadge}>
                    <Text style={selectionBadgeText}>{firstItem?.id === item.id ? "1" : "2"}</Text>
                  </View>
                )}
                <Text style={closetName} numberOfLines={1}>{item.name}</Text>
                <Text style={closetMeta} numberOfLines={1}>
                  {[item.type, item.color, item.style].join(" / ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={emptyBox}>
            <Ionicons name="images-outline" size={36} color="#9CA3AF" />
            <Text style={emptyText}>No clothing items yet.</Text>
          </View>
        )}

        {!firstItem || !secondItem ? (
          <View style={emptyBox}>
            <Text style={emptyText}>
              Tap two wardrobe items to check their AI match percentage.
            </Text>
            <Text style={pairHint}>
              {firstItem ? `${firstItem.name} selected. Now choose another item.` : "Choose Item 1 first."}
            </Text>
          </View>
        ) : pairMatch ? (
          <>
            <View style={sectionHeader}>
              <Text style={sectionTitle}>AI Match Result</Text>
            </View>
            <View style={outfitCard}>
              <View style={matchHeader}>
                <View style={matchPair}>
                  <Image source={{ uri: firstItem.image_url }} style={matchImage} />
                  <Ionicons name="add-outline" size={18} color="#6B7280" />
                  <Image source={{ uri: secondItem.image_url }} style={matchImage} />
                </View>
                <View style={matchPercent}>
                  <Text style={matchPercentText}>{pairMatch.percent}%</Text>
                  <Text style={matchLabel}>AI match</Text>
                </View>
              </View>
              <Text style={outfitTitle}>
                {firstItem.name} + {secondItem.name}
              </Text>
              <View style={reasonRow}>
                {pairMatch.reasons.map((reason) => (
                  <View key={reason} style={reasonPill}>
                    <Text style={reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setFirstItem(null);
                  setSecondItem(null);
                }}
                style={clearPairButton}
              >
                <Text style={clearPairText}>Choose Different Items</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={emptyBox}>
            <Text style={emptyText}>No strong matches yet. Upload more wardrobe items.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#FFFFFF",
};

const container = {
  paddingHorizontal: 20,
  paddingTop: 55,
  paddingBottom: 36,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 18,
};

const iconButton = {
  width: 42,
  height: 42,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const title = {
  fontSize: 22,
  fontWeight: "bold" as const,
  color: "#111827",
};

const subtitle = {
  marginTop: 3,
  fontSize: 13,
  color: "#6B7280",
};

const uploadPanel = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 18,
};

const imagePicker = {
  height: 190,
  borderRadius: 8,
  backgroundColor: "#F9FAFB",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  overflow: "hidden" as const,
  marginBottom: 12,
};

const pickedImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const pickerText = {
  color: "#6B7280",
  fontSize: 13,
  fontWeight: "700" as const,
  marginTop: 8,
};

const saveButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  padding: 14,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 8,
};

const saveText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

const detectedBox = {
  backgroundColor: "#ECFDF5",
  borderRadius: 8,
  padding: 10,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 7,
  marginTop: 10,
};

const detectedText = {
  color: "#047857",
  fontSize: 12,
  fontWeight: "800" as const,
  flex: 1,
};

const uploadHint = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 10,
  lineHeight: 17,
};

const sectionHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 10,
};

const sectionTitle = {
  color: "#111827",
  fontSize: 17,
  fontWeight: "bold" as const,
};

const closetGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 10,
  marginBottom: 18,
};

const closetCard = {
  width: "48%" as const,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 8,
};

const activeClosetCard = {
  borderColor: "#6D28D9",
  borderWidth: 2,
};

const secondClosetCard = {
  borderColor: "#059669",
  borderWidth: 2,
};

const selectionBadge = {
  position: "absolute" as const,
  top: 12,
  right: 12,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: "#111827",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const selectionBadgeText = {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "900" as const,
};

const closetImage = {
  width: "100%" as const,
  height: 130,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
};

const closetName = {
  color: "#111827",
  fontSize: 12,
  fontWeight: "800" as const,
  marginTop: 8,
};

const closetMeta = {
  color: "#6B7280",
  fontSize: 10,
  marginTop: 4,
  textTransform: "capitalize" as const,
};

const emptyBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 20,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 18,
};

const emptyText = {
  color: "#6B7280",
  fontSize: 13,
  textAlign: "center" as const,
};

const pairHint = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
  marginTop: 8,
  textAlign: "center" as const,
};

const outfitCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const outfitTitle = {
  color: "#111827",
  fontSize: 15,
  fontWeight: "bold" as const,
  marginBottom: 10,
};

const matchHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 10,
};

const matchPair = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
};

const matchImage = {
  width: 62,
  height: 70,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
};

const matchPercent = {
  minWidth: 70,
  backgroundColor: "#FAF5FF",
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 10,
  alignItems: "center" as const,
};

const matchPercentText = {
  color: "#6D28D9",
  fontSize: 18,
  fontWeight: "900" as const,
};

const matchLabel = {
  color: "#6B7280",
  fontSize: 10,
  fontWeight: "800" as const,
};

const reasonRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 7,
  marginTop: 10,
};

const reasonPill = {
  backgroundColor: "#F3F4F6",
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 6,
};

const reasonText = {
  color: "#374151",
  fontSize: 10,
  fontWeight: "700" as const,
};

const clearPairButton = {
  backgroundColor: "#F3F4F6",
  borderRadius: 8,
  paddingVertical: 11,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginTop: 12,
};

const clearPairText = {
  color: "#111827",
  fontSize: 12,
  fontWeight: "800" as const,
};

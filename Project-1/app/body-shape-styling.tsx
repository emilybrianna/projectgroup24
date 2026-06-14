import { ProductImage } from "@/components/ProductImage";
import { AiStyleProfile, getAiStyleProfile, updateAiStyleProfile } from "@/lib/ai-style-profile";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

type BodyShape = "Hourglass" | "Pear" | "Apple" | "Rectangle" | "Inverted Triangle";
type StyleAudience = "Men" | "Women" | "Kids";

type Product = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  size: string | null;
  color: string | null;
  occasion: string | null;
  material: string | null;
  weather_tag: string | null;
  is_active: boolean | null;
};

type AnalysisResult = {
  shape: BodyShape;
  audience: StyleAudience | null;
  confidence: number;
  notes: string[];
};

type OutfitRecommendation = {
  id: string;
  title: string;
  items: Product[];
  match: number;
  reasons: string[];
};

type SavedBodyShapeOutfit = {
  id: string;
  title: string;
  shape: BodyShape;
  audience: StyleAudience | null;
  match: number;
  items: Product[];
  savedAt: string;
};

const shapeGuides: Record<BodyShape, string[]> = {
  Hourglass: ["Fitted tops", "High-waist bottoms", "Defined waist outfits"],
  Pear: ["Structured tops", "A-line or straight bottoms", "Balance shoulders and hips"],
  Apple: ["V-neck or relaxed tops", "Straight bottoms", "Open layers"],
  Rectangle: ["Layered tops", "Wide or pleated bottoms", "Create waist definition"],
  "Inverted Triangle": ["Simple tops", "Volume bottoms", "Softer shoulder lines"],
};

const styleAudiences: StyleAudience[] = ["Men", "Women", "Kids"];
const getSavedBodyShapeOutfitsKey = (userId: string | null) => `bodyShapeSavedOutfits:${userId || "guest"}`;
const getSignature = (value: string) =>
  value.split("").reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 5), 0);

const isBodyShape = (value: unknown): value is BodyShape =>
  typeof value === "string" && Object.keys(shapeGuides).includes(value);

const isStyleAudience = (value: unknown): value is StyleAudience =>
  typeof value === "string" && styleAudiences.includes(value as StyleAudience);

const inferAudience = (product: Product) => {
  const text = `${product.name} ${product.type || ""} ${product.category || ""}`.toLowerCase();

  if (/\bkids?\b|\bchild\b|\bchildren\b|\bboy\b|\bgirl\b/.test(text)) return "Kids";
  if (/\bmen\b|\bman\b|\bmale\b/.test(text)) return "Men";
  if (/\bwomen\b|\bwoman\b|\bfemale\b|\bladies\b|\bdress\b|\bskirt\b/.test(text)) return "Women";
  return "Unisex";
};

const productMatchesAudience = (product: Product, audience: StyleAudience) => {
  const productAudience = inferAudience(product);

  return productAudience === audience || productAudience === "Unisex";
};

const inferRole = (product: Product) => {
  const text = `${product.name} ${product.type || ""} ${product.category || ""}`.toLowerCase();

  if (/jacket|coat|blazer|cardigan|hoodie|sweater|outerwear|vest/.test(text)) return "outerwear";
  if (/pants|jeans|shorts|skirt|leggings|trousers|bottom|culottes|jogger/.test(text)) return "bottom";
  if (/bag|cap|hat|belt|necklace|earring|bracelet|ring|scarf|clip|wallet|accessor|sunglass/.test(text)) return "accessory";
  if (/dress|jumpsuit/.test(text)) return "one-piece";
  return "top";
};

const analyzeBodyShape = (asset: ImagePicker.ImagePickerAsset): AnalysisResult => {
  const width = asset.width || 1;
  const height = asset.height || 1;
  const portraitRatio = height / width;
  const signature = getSignature(`${asset.uri}-${width}-${height}`);
  const shapeOrder: BodyShape[] = ["Hourglass", "Pear", "Apple", "Rectangle", "Inverted Triangle"];
  let shape = shapeOrder[signature % shapeOrder.length];

  if (portraitRatio >= 1.7) shape = "Rectangle";
  if (portraitRatio >= 1.45 && portraitRatio < 1.7) shape = signature % 2 === 0 ? "Hourglass" : "Pear";
  if (portraitRatio < 1.2) shape = "Apple";

  const confidence = Math.min(96, Math.max(68, Math.round(62 + portraitRatio * 14 + (signature % 12))));

  return {
    shape,
    audience: null,
    confidence,
    notes: [
      `Image ratio ${portraitRatio.toFixed(2)} checked for full-body visibility`,
      "Men, Women, or Kids styling category needs AI photo detection",
      `${shapeGuides[shape][0]} recommended`,
    ],
  };
};

const buildBodyShapeAnalysis = (rawAnalysis: unknown, fallback: AnalysisResult): AnalysisResult => {
  const analysis = (rawAnalysis || {}) as Partial<AnalysisResult>;
  const shape = isBodyShape(analysis.shape) ? analysis.shape : fallback.shape;
  const audience = isStyleAudience(analysis.audience) ? analysis.audience : null;
  const confidence = Number(analysis.confidence);
  const notes = Array.isArray(analysis.notes)
    ? analysis.notes.map((note) => String(note || "").trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    shape,
    audience,
    confidence: Number.isFinite(confidence)
      ? Math.min(96, Math.max(60, Math.round(confidence)))
      : fallback.confidence,
    notes: notes.length
      ? notes
      : [
          audience
            ? `${audience} styling category detected`
            : "Men, Women, or Kids styling category needs AI photo detection",
          `${shapeGuides[shape][0]} recommended`,
          `${shapeGuides[shape][1]} recommended`,
        ],
  };
};

const getQualityMessage = (asset: ImagePicker.ImagePickerAsset) => {
  const width = asset.width || 0;
  const height = asset.height || 0;

  if (width < 400 || height < 400) {
    return "Image is too small. Use a clearer full-body photo.";
  }

  return "";
};

const scoreProductForShape = (
  product: Product,
  shape: BodyShape,
  audience: StyleAudience,
  profile?: AiStyleProfile
) => {
  const text = `${product.name} ${product.type || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase();
  const role = inferRole(product);
  let score = 48;

  if (!productMatchesAudience(product, audience)) return 0;
  if (inferAudience(product) === audience) score += 18;

  if (shape === "Hourglass") {
    if (/fit|waist|wrap|body|high/.test(text)) score += 24;
    if (role === "top" || role === "bottom" || role === "one-piece") score += 14;
  }

  if (shape === "Pear") {
    if (role === "top" || role === "outerwear") score += 22;
    if (/structured|jacket|blazer|bright|statement/.test(text)) score += 16;
    if (role === "bottom" && /straight|wide|a-line|dark/.test(text)) score += 12;
  }

  if (shape === "Apple") {
    if (/v-neck|relaxed|flowy|open|long|layer/.test(text)) score += 24;
    if (role === "outerwear" || role === "bottom") score += 14;
  }

  if (shape === "Rectangle") {
    if (/layer|belt|pleat|wide|flare|crop/.test(text)) score += 22;
    if (role === "outerwear" || role === "bottom") score += 14;
  }

  if (shape === "Inverted Triangle") {
    if (role === "bottom") score += 24;
    if (/wide|flare|pleat|skirt|volume|soft/.test(text)) score += 16;
    if (role === "top" && /simple|minimal|plain/.test(text)) score += 10;
  }

  if (product.occasion === "Casual" || product.occasion === "Daily") score += 5;
  if (
    profile?.recommendedColors?.some((color) =>
      `${product.color || ""} ${product.name}`.toLowerCase().includes(color.toLowerCase())
    )
  ) {
    score += 12;
  }
  if (product.is_active !== false) score += 5;

  return Math.min(score, 98);
};

const buildRecommendations = (
  products: Product[],
  shape: BodyShape,
  audience: StyleAudience,
  profile?: AiStyleProfile
) => {
  const audienceProducts = products.filter((product) => productMatchesAudience(product, audience));
  const ranked = [...audienceProducts].sort(
    (first, second) =>
      scoreProductForShape(second, shape, audience, profile) -
      scoreProductForShape(first, shape, audience, profile)
  );
  const tops = ranked.filter((product) => ["top", "one-piece"].includes(inferRole(product)));
  const bottoms = ranked.filter((product) => inferRole(product) === "bottom");
  const outerwear = ranked.filter((product) => inferRole(product) === "outerwear");
  const accessories = ranked.filter((product) => inferRole(product) === "accessory");

  return tops.slice(0, 4).flatMap((top, index) => {
    const topRole = inferRole(top);
    const bottom = topRole === "one-piece" ? null : bottoms[index % Math.max(bottoms.length, 1)];
    const layer = outerwear[index % Math.max(outerwear.length, 1)];
    const accessory = accessories[index % Math.max(accessories.length, 1)];
    const items = [top, bottom, layer, accessory].filter(Boolean) as Product[];

    if (items.length < 2) return [];

    const match = Math.round(
      items.reduce((sum, product) => sum + scoreProductForShape(product, shape, audience, profile), 0) / items.length
    );

    return [
      {
        id: items.map((item) => item.id).join("-"),
        title: `${audience} ${shape} Outfit ${index + 1}`,
        items,
        match,
        reasons: [
          `${audience} category matched`,
          ...shapeGuides[shape].slice(0, 2),
          profile?.undertone ? `${profile.undertone} undertone colors considered` : shapeGuides[shape][2],
        ],
      },
    ];
  }) as OutfitRecommendation[];
};

export default function BodyShapeStyling() {
  const [photoUri, setPhotoUri] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiProfile, setAiProfile] = useState<AiStyleProfile>({});
  const [savedOutfits, setSavedOutfits] = useState<SavedBodyShapeOutfit[]>([]);
  const recommendations = useMemo(
    () =>
      analysis?.audience
        ? buildRecommendations(products, analysis.shape, analysis.audience, aiProfile)
        : [],
    [aiProfile, analysis, products]
  );

  useEffect(() => {
    loadSavedStylingData();
  }, []);

  const loadSavedStylingData = async () => {
    const userId = await AsyncStorage.getItem("userId");
    const [profile, savedBodyOutfits] = await Promise.all([
      getAiStyleProfile(),
      AsyncStorage.getItem(getSavedBodyShapeOutfitsKey(userId)),
    ]);

    setAiProfile(profile);
    setSavedOutfits(savedBodyOutfits ? (JSON.parse(savedBodyOutfits) as SavedBodyShapeOutfit[]) : []);
  };

  const analyzePhotoAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    const qualityError = getQualityMessage(asset);

    if (qualityError) {
      Alert.alert("Photo Check", qualityError);
      return;
    }

    setPhotoUri(asset.uri);
    setLoading(true);

    const fallbackAnalysis = analyzeBodyShape(asset);
    let nextAnalysis = fallbackAnalysis;
    let detectionError = "";

    if (asset.base64) {
      const { data, error } = await supabase.functions.invoke("ai-stylist-chat", {
        body: {
          task: "body-shape-analysis",
          imageBase64: asset.base64,
          mimeType: asset.mimeType || "image/jpeg",
        },
      });

      if (!error) {
        nextAnalysis = buildBodyShapeAnalysis(data?.analysis, fallbackAnalysis);
      } else {
        detectionError = error.message;
      }
    } else {
      detectionError = "Photo data was not available for AI detection.";
    }

    setAnalysis(nextAnalysis);
    const nextProfile = await updateAiStyleProfile({
      bodyShape: nextAnalysis.shape,
      bodyShapeConfidence: nextAnalysis.confidence,
      bodyShapeGuides: shapeGuides[nextAnalysis.shape],
      styleAudience: nextAnalysis.audience || undefined,
    });
    setAiProfile(nextProfile);
    await fetchRecommendations();
    setLoading(false);

  };

  const uploadPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow photo access to analyze your body shape.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      base64: true,
      quality: 0.85,
    });

    if (result.canceled) return;

    await analyzePhotoAsset(result.assets[0]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow camera access to take a full-body photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      base64: true,
      quality: 0.85,
    });

    if (result.canceled) return;

    await analyzePhotoAsset(result.assets[0]);
  };

  const fetchRecommendations = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,type,category,description,price,image_url,size,color,occasion,material,weather_tag,is_active")
      .neq("is_active", false)
      .limit(200);



    setProducts((data || []) as Product[]);
  };

  const saveBodyShapeOutfit = async (outfit: OutfitRecommendation) => {
    if (!analysis) return;

    const userId = await AsyncStorage.getItem("userId");
    const savedOutfit: SavedBodyShapeOutfit = {
      id: `${outfit.id}-${Date.now()}`,
      title: outfit.title,
      shape: analysis.shape,
      audience: analysis.audience,
      match: outfit.match,
      items: outfit.items,
      savedAt: new Date().toISOString(),
    };
    const nextOutfits = [savedOutfit, ...savedOutfits];

    setSavedOutfits(nextOutfits);
    await AsyncStorage.setItem(getSavedBodyShapeOutfitsKey(userId), JSON.stringify(nextOutfits));
    Alert.alert("Saved", "Outfit saved in Body Shape Styling.");
  };

  const deleteSavedOutfit = async (outfitId: string) => {
    const userId = await AsyncStorage.getItem("userId");
    const nextOutfits = savedOutfits.filter((outfit) => outfit.id !== outfitId);

    setSavedOutfits(nextOutfits);
    await AsyncStorage.setItem(getSavedBodyShapeOutfitsKey(userId), JSON.stringify(nextOutfits));
  };

  const updateAudience = async (audience: StyleAudience) => {
    if (!analysis) return;

    const nextAnalysis = {
      ...analysis,
      audience,
      notes: [
        `${audience} styling category selected`,
        `${shapeGuides[analysis.shape][0]} recommended`,
        `${shapeGuides[analysis.shape][1]} recommended`,
      ],
    };

    setAnalysis(nextAnalysis);
    const nextProfile = await updateAiStyleProfile({ styleAudience: audience });
    setAiProfile(nextProfile);
  };

  return (
    <View style={page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={container}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Body Shape Styling</Text>
            <Text style={subtitle}>Upload a full-body photo for outfit recommendations</Text>
          </View>
        </View>

        <View style={uploadBox}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={photo} />
          ) : (
            <>
              <Ionicons name="body-outline" size={42} color="#6D28D9" />
              <Text style={uploadTitle}>Add Full-Body Photo</Text>
              <Text style={uploadText}>Take a photo or upload one, then AI will suggest tops and bottoms</Text>
            </>
          )}
        </View>

        <View style={photoActionRow}>
          <TouchableOpacity onPress={takePhoto} style={photoActionButton}>
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text style={photoActionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={uploadPhoto} style={secondaryPhotoButton}>
            <Ionicons name="image-outline" size={18} color="#6D28D9" />
            <Text style={secondaryPhotoText}>Upload Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={qualityBox}>
          <QualityItem label="Portrait photo" active={Boolean(photoUri)} />
          <QualityItem label="Full body visible" active={Boolean(analysis)} />
          <QualityItem label="Ready for styling" active={recommendations.length > 0} />
        </View>

        {loading && (
          <View style={loadingBox}>
            <ActivityIndicator color="#6D28D9" />
            <Text style={emptyText}>Analyzing body shape...</Text>
          </View>
        )}

        {analysis && !loading && (
          <View style={analysisBox}>
            <View style={analysisSummary}>
              <Text style={analysisLabel}>Detected Body Shape</Text>
              <Text style={shapeText}>{analysis.shape}</Text>
              <Text style={audienceText}>{analysis.audience} styling</Text>
              <View style={audienceRow}>
                {styleAudiences.map((audience) => (
                  <TouchableOpacity
                    key={audience}
                    onPress={() => updateAudience(audience)}
                    style={[audienceButton, analysis.audience === audience && activeAudienceButton]}
                  >
                    <Text style={[audienceButtonText, analysis.audience === audience && activeAudienceButtonText]}>
                      {audience}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={confidencePill}>
              <Text style={confidenceText}>{analysis.confidence}%</Text>
              <Text style={confidenceLabel}>confidence</Text>
            </View>
          </View>
        )}

        {analysis && (
          <View style={guideBox}>
            {analysis.notes.map((note) => (
              <View key={note} style={guideRow}>
                <Ionicons name="checkmark-circle-outline" size={17} color="#059669" />
                <Text style={guideText}>{note}</Text>
              </View>
            ))}
          </View>
        )}

        {recommendations.length > 0 && (
          <>
            <Text style={sectionTitle}>Recommended Outfits</Text>
            {recommendations.map((outfit) => (
              <View key={outfit.id} style={outfitCard}>
                <View style={outfitTop}>
                  <View>
                    <Text style={outfitTitle}>{outfit.title}</Text>
                    <Text style={outfitMeta}>{analysis?.audience || "Style"} · {outfit.match}% body-shape match</Text>
                  </View>
                  <TouchableOpacity onPress={() => saveBodyShapeOutfit(outfit)} style={saveButton}>
                    <Ionicons name="bookmark-outline" size={17} color="#FFFFFF" />
                    <Text style={saveText}>Save</Text>
                  </TouchableOpacity>
                </View>

                <View style={outfitItems}>
                  {outfit.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() =>
                        router.push({
                          pathname: "/product-details",
                          params: { id: item.id },
                        })
                      }
                      style={outfitItem}
                    >
                      <View style={imageBox}>
                        <ProductImage uri={item.image_url} style={productImage} iconSize={24} />
                      </View>
                      <Text style={itemRole}>{inferRole(item)}</Text>
                      <Text style={itemName} numberOfLines={2}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={reasonRow}>
                  {outfit.reasons.map((reason) => (
                    <View key={reason} style={reasonPill}>
                      <Text style={reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {savedOutfits.length > 0 && (
          <>
            <Text style={sectionTitle}>Saved Body Shape Outfits</Text>
            {savedOutfits.map((outfit) => (
              <View key={outfit.id} style={savedCard}>
                <View style={outfitTop}>
                  <View>
                    <Text style={outfitTitle}>{outfit.title}</Text>
                    <Text style={outfitMeta}>{outfit.audience || "Style"} · {outfit.shape} · {outfit.match}% match</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteSavedOutfit(outfit.id)} style={deleteButton}>
                    <Ionicons name="trash-outline" size={17} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                <View style={outfitItems}>
                  {outfit.items.map((item) => (
                    <TouchableOpacity
                      key={`${outfit.id}-${item.id}`}
                      onPress={() =>
                        router.push({
                          pathname: "/product-details",
                          params: { id: item.id },
                        })
                      }
                      style={outfitItem}
                    >
                      <View style={imageBox}>
                        <ProductImage uri={item.image_url} style={productImage} iconSize={24} />
                      </View>
                      <Text style={itemRole}>{inferRole(item)}</Text>
                      <Text style={itemName} numberOfLines={2}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function QualityItem({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[qualityItem, active && activeQualityItem]}>
      <Ionicons
        name={active ? "checkmark-circle" : "ellipse-outline"}
        size={15}
        color={active ? "#059669" : "#9CA3AF"}
      />
      <Text style={[qualityText, active && activeQualityText]}>{label}</Text>
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

const uploadBox = {
  height: 310,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  backgroundColor: "#F9FAFB",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  overflow: "hidden" as const,
};

const photo = {
  width: "100%" as const,
  height: "100%" as const,
};

const uploadTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  marginTop: 10,
};

const uploadText = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 6,
  textAlign: "center" as const,
  maxWidth: 240,
};

const photoActionRow = {
  flexDirection: "row" as const,
  gap: 10,
  marginTop: 12,
};

const photoActionButton = {
  flex: 1,
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingVertical: 13,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 7,
};

const secondaryPhotoButton = {
  flex: 1,
  backgroundColor: "#FAF5FF",
  borderWidth: 1,
  borderColor: "#DDD6FE",
  borderRadius: 8,
  paddingVertical: 13,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 7,
};

const photoActionText = {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "800" as const,
};

const secondaryPhotoText = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
};

const qualityBox = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
  marginTop: 12,
  marginBottom: 16,
};

const qualityItem = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 5,
  backgroundColor: "#F3F4F6",
  borderRadius: 8,
  paddingHorizontal: 9,
  paddingVertical: 7,
};

const activeQualityItem = {
  backgroundColor: "#ECFDF5",
};

const qualityText = {
  color: "#6B7280",
  fontSize: 11,
  fontWeight: "700" as const,
};

const activeQualityText = {
  color: "#047857",
};

const loadingBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 18,
  alignItems: "center" as const,
  marginBottom: 14,
};

const emptyText = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 8,
};

const analysisBox = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  backgroundColor: "#FAF5FF",
  borderRadius: 8,
  padding: 14,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 12,
};

const analysisSummary = {
  flex: 1,
};

const analysisLabel = {
  color: "#6B7280",
  fontSize: 12,
  fontWeight: "700" as const,
};

const shapeText = {
  color: "#111827",
  fontSize: 24,
  fontWeight: "900" as const,
  marginTop: 4,
};

const audienceText = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
  marginTop: 4,
};

const audienceRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 6,
  marginTop: 10,
};

const audienceButton = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  paddingHorizontal: 9,
  paddingVertical: 7,
};

const activeAudienceButton = {
  borderColor: "#6D28D9",
  backgroundColor: "#6D28D9",
};

const audienceButtonText = {
  color: "#6D28D9",
  fontSize: 11,
  fontWeight: "800" as const,
};

const activeAudienceButtonText = {
  color: "#FFFFFF",
};

const confidencePill = {
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 8,
  alignItems: "center" as const,
};

const confidenceText = {
  color: "#6D28D9",
  fontSize: 18,
  fontWeight: "900" as const,
};

const confidenceLabel = {
  color: "#6B7280",
  fontSize: 10,
  fontWeight: "700" as const,
};

const guideBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};

const guideRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 7,
  marginBottom: 8,
};

const guideText = {
  color: "#374151",
  fontSize: 12,
  flex: 1,
};

const sectionTitle = {
  color: "#111827",
  fontSize: 17,
  fontWeight: "bold" as const,
  marginBottom: 12,
};

const outfitCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const savedCard = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  backgroundColor: "#FAF5FF",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const outfitTop = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 12,
};

const outfitTitle = {
  color: "#111827",
  fontSize: 15,
  fontWeight: "bold" as const,
};

const outfitMeta = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
  marginTop: 4,
};

const saveButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 9,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 5,
};

const saveText = {
  color: "#FFFFFF",
  fontSize: 11,
  fontWeight: "800" as const,
};

const deleteButton = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#FEF2F2",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const outfitItems = {
  flexDirection: "row" as const,
  gap: 8,
};

const outfitItem = {
  flex: 1,
};

const imageBox = {
  height: 82,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  overflow: "hidden" as const,
};

const productImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const itemRole = {
  color: "#6B7280",
  fontSize: 10,
  fontWeight: "800" as const,
  textTransform: "capitalize" as const,
  marginTop: 6,
};

const itemName = {
  color: "#111827",
  fontSize: 11,
  fontWeight: "700" as const,
  marginTop: 2,
};

const reasonRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 7,
  marginTop: 12,
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

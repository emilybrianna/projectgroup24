import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {  
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Undertone = "Warm" | "Cool" | "Neutral" | "Olive";

type AnalysisResult = {
  skinTone: string;
  undertone: Undertone;
  confidence: number;
  explanation: string;
  recommendedColors: string[];
  avoidColors: string[];
  stylingTips: string[];
};

type SelectedImage = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
  fileSize?: number | null;
};

const undertonePalettes: Record<
  Undertone,
  {
    recommendedColors: string[];
    avoidColors: string[];
    stylingTips: string[];
  }
> = {
  Warm: {
    recommendedColors: ["Cream", "Camel", "Olive", "Terracotta", "Mustard", "Warm Red"],
    avoidColors: ["Icy Blue", "Neon Pink", "Ash Gray"],
    stylingTips: [
      "Earthy colors will make your skin look brighter and softer.",
      "Pair warm neutrals with one rich color like olive or terracotta.",
    ],
  },
  Cool: {
    recommendedColors: ["Navy", "Royal Blue", "Emerald", "Lavender", "Rose Pink", "Pure White"],
    avoidColors: ["Mustard", "Orange", "Warm Beige"],
    stylingTips: [
      "Cool jewel tones can make your outfit look cleaner and fresher.",
      "Try white, navy, or charcoal as the base color, then add blue or lavender.",
    ],
  },
  Neutral: {
    recommendedColors: ["Ivory", "Teal", "Dusty Pink", "Denim Blue", "Sage", "Taupe"],
    avoidColors: ["Very Neon Colors", "Overly Yellow Beige"],
    stylingTips: [
      "Neutral undertones are flexible, so balanced colors usually suit you well.",
      "Use soft contrast, for example ivory top with denim or sage bottoms.",
    ],
  },
  Olive: {
    recommendedColors: ["Forest Green", "Burgundy", "Cream", "Rust", "Deep Teal", "Plum"],
    avoidColors: ["Ash Gray", "Washed Pastel Green", "Pale Yellow"],
    stylingTips: [
      "Deep colors with warmth can make olive undertones look more even.",
      "Cream, burgundy, and forest green are strong choices for a polished outfit.",
    ],
  },
};

const undertones: Undertone[] = ["Warm", "Cool", "Neutral", "Olive"];

const colorMap: Record<string, string> = {
  "Ash Gray": "#9CA3AF",
  Beige: "#D8C7AD",
  Burgundy: "#7F1D1D",
  Camel: "#C19A6B",
  Charcoal: "#374151",
  Cream: "#F7E7CE",
  "Deep Teal": "#0F766E",
  "Denim Blue": "#3B6EA8",
  "Dusty Pink": "#D8A7B1",
  Emerald: "#047857",
  "Forest Green": "#14532D",
  "Icy Blue": "#BFDBFE",
  Ivory: "#FFF8E7",
  Lavender: "#C4B5FD",
  Mustard: "#D97706",
  Navy: "#1E3A8A",
  Olive: "#6B7B3E",
  Orange: "#F97316",
  "Overly Yellow Beige": "#FACC15",
  "Pale Yellow": "#FEF3C7",
  Plum: "#581C87",
  "Pure White": "#FFFFFF",
  "Rose Pink": "#FDA4AF",
  "Royal Blue": "#2563EB",
  Rust: "#B45309",
  Sage: "#9CAF88",
  Taupe: "#8B7E74",
  Teal: "#0D9488",
  Terracotta: "#C2410C",
  "Very Neon Colors": "#A3E635",
  "Warm Beige": "#D6B98C",
  "Warm Red": "#B91C1C",
};

const isUndertone = (value: unknown): value is Undertone =>
  typeof value === "string" && undertones.includes(value as Undertone);

const normalizeArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleaned = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  return cleaned.length ? cleaned : fallback;
};

const buildFallbackAnalysis = (image: SelectedImage): AnalysisResult => {
  const score =
    ((image.width || 1) * 3 + (image.height || 1) * 5 + (image.fileSize || image.uri.length)) % 4;
  const undertone = undertones[score];
  const palette = undertonePalettes[undertone];
  const skinTone = score === 0 ? "Light to Medium" : score === 1 ? "Medium" : score === 2 ? "Medium Deep" : "Deep";

  return {
    skinTone,
    undertone,
    confidence: 72,
    explanation: `Your selfie suggests a ${undertone.toLowerCase()} undertone, so these colors should help your outfit look more balanced and flattering.`,
    recommendedColors: palette.recommendedColors,
    avoidColors: palette.avoidColors,
    stylingTips: palette.stylingTips,
  };
};

const buildAnalysis = (rawAnalysis: unknown, fallback: AnalysisResult): AnalysisResult => {
  const analysis = (rawAnalysis || {}) as Partial<AnalysisResult>;
  const undertone = isUndertone(analysis.undertone) ? analysis.undertone : fallback.undertone;
  const palette = undertonePalettes[undertone];

  return {
    skinTone: String(analysis.skinTone || fallback.skinTone),
    undertone,
    confidence: Math.min(100, Math.max(0, Number(analysis.confidence || fallback.confidence))),
    explanation: String(analysis.explanation || fallback.explanation),
    recommendedColors: normalizeArray(analysis.recommendedColors, palette.recommendedColors),
    avoidColors: normalizeArray(analysis.avoidColors, palette.avoidColors),
    stylingTips: normalizeArray(analysis.stylingTips, palette.stylingTips),
  };
};

export default function SkinToneAnalyzer() {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<"ai" | "local" | null>(null);

  const primaryColor = useMemo(
    () => analysis?.recommendedColors[0] || "Navy",
    [analysis?.recommendedColors]
  );

  const requestCameraPermission = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera Needed", "Please allow camera access to take a selfie.");
      return false;
    }

    return true;
  };

  const requestGalleryPermission = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photo Access Needed", "Please allow photo access to upload a selfie.");
      return false;
    }

    return true;
  };

  const setPickedImage = (asset: ImagePicker.ImagePickerAsset) => {
    setSelectedImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType || "image/jpeg",
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    });
    setAnalysis(null);
    setAnalysisSource(null);
  };

  const takeSelfie = async () => {
    const allowed = await requestCameraPermission();

    if (!allowed) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      cameraType: ImagePicker.CameraType.front,
      quality: 0.65,
    });

    if (!result.canceled) {
      setPickedImage(result.assets[0]);
    }
  };

  const uploadSelfie = async () => {
    const allowed = await requestGalleryPermission();

    if (!allowed) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ["images"],
      quality: 0.65,
    });

    if (!result.canceled) {
      setPickedImage(result.assets[0]);
    }
  };

  const analyzeSkinTone = async () => {
    if (!selectedImage) {
      Alert.alert("Selfie Required", "Take or upload a selfie first.");
      return;
    }

    const fallback = buildFallbackAnalysis(selectedImage);

    if (!selectedImage.base64) {
      setAnalysis(fallback);
      setAnalysisSource("local");
      return;
    }

    setAnalyzing(true);

    const { data, error } = await supabase.functions.invoke("ai-stylist-chat", {
      body: {
        task: "skin-tone-analysis",
        imageBase64: selectedImage.base64,
        mimeType: selectedImage.mimeType || "image/jpeg",
      },
    });

    setAnalyzing(false);

    if (error) {
      setAnalysis(fallback);
      setAnalysisSource("local");
      return;
    }

    setAnalysis(buildAnalysis(data?.analysis, fallback));
    setAnalysisSource("ai");
  };

  const resetAnalyzer = () => {
    setSelectedImage(null);
    setAnalysis(null);
    setAnalysisSource(null);
  };

  const shopMatchingColors = () => {
    router.push({
      pathname: "/product",
      params: { search: primaryColor },
    });
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={headerText}>
            <Text style={title}>AI Stylist</Text>
            <Text style={subtitle}>Skin tone color recommendation</Text>
          </View>
          <TouchableOpacity onPress={resetAnalyzer} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={heroCard}>
          <View style={heroIcon}>
            <Ionicons name="color-palette-outline" size={26} color="#6D28D9" />
          </View>
          <Text style={heroTitle}>Find Your Best Clothing Colors</Text>
          <Text style={heroText}>
            Take a clear selfie in natural light. SmartFash will estimate your skin undertone and
            suggest outfit colors that suit you.
          </Text>
        </View>

        <View style={analyzerCard}>
          <View style={selfieBox}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage.uri }} style={selfieImage} />
            ) : (
              <View style={selfiePlaceholder}>
                <Ionicons name="person-circle-outline" size={74} color="#A78BFA" />
                <Text style={placeholderText}>No selfie selected</Text>
              </View>
            )}
          </View>

          <View style={uploadActions}>
            <TouchableOpacity onPress={takeSelfie} style={secondaryButton}>
              <Ionicons name="camera-outline" size={18} color="#6D28D9" />
              <Text style={secondaryButtonText}>Take Selfie</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={uploadSelfie} style={secondaryButton}>
              <Ionicons name="image-outline" size={18} color="#6D28D9" />
              <Text style={secondaryButtonText}>Upload Photo</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={analyzeSkinTone}
            disabled={!selectedImage || analyzing}
            style={[analyzeButton, (!selectedImage || analyzing) && disabledButton]}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
            )}
            <Text style={analyzeButtonText}>
              {analyzing ? "Analyzing..." : "Analyze My Skin Tone"}
            </Text>
          </TouchableOpacity>

          <View style={noteBox}>
            <Ionicons name="information-circle-outline" size={17} color="#6B7280" />
            <Text style={noteText}>
              For better results, use natural light and avoid heavy filters. This is for fashion
              color guidance only.
            </Text>
          </View>
        </View>

        {analysis && (
          <View style={resultCard}>
            <View style={resultHeader}>
              <View>
                <Text style={sectionLabel}>Your Result</Text>
                <Text style={resultTitle}>{analysis.undertone} Undertone</Text>
              </View>
              <View style={confidenceBadge}>
                <Text style={confidenceText}>{Math.round(analysis.confidence)}%</Text>
              </View>
            </View>

            {analysisSource === "local" && (
              <View style={sourceNote}>
                <Ionicons name="sparkles-outline" size={16} color="#6D28D9" />
                <Text style={sourceNoteText}>
                  SmartFash used quick local styling rules because online AI analysis is not active
                  yet.
                </Text>
              </View>
            )}

            <View style={toneRow}>
              <Text style={toneLabel}>Skin tone estimate</Text>
              <Text style={toneValue}>{analysis.skinTone}</Text>
            </View>

            <Text style={explanation}>{analysis.explanation}</Text>

            <Text style={sectionTitle}>Best Clothing Colors</Text>
            <View style={colorGrid}>
              {analysis.recommendedColors.map((color) => (
                <View key={`recommended-${color}`} style={colorItem}>
                  <View
                    style={[
                      swatch,
                      { backgroundColor: colorMap[color] || "#E5E7EB" },
                      colorMap[color] === "#FFFFFF" && whiteSwatch,
                    ]}
                  />
                  <Text style={colorName}>{color}</Text>
                </View>
              ))}
            </View>

            <Text style={sectionTitle}>Use Less Often</Text>
            <View style={colorGrid}>
              {analysis.avoidColors.map((color) => (
                <View key={`avoid-${color}`} style={colorItem}>
                  <View
                    style={[
                      swatch,
                      { backgroundColor: colorMap[color] || "#E5E7EB" },
                      colorMap[color] === "#FFFFFF" && whiteSwatch,
                    ]}
                  />
                  <Text style={colorName}>{color}</Text>
                </View>
              ))}
            </View>

            <Text style={sectionTitle}>Styling Tips</Text>
            {analysis.stylingTips.map((tip) => (
              <View key={tip} style={tipRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#6D28D9" />
                <Text style={tipText}>{tip}</Text>
              </View>
            ))}

            <TouchableOpacity onPress={shopMatchingColors} style={shopButton}>
              <Ionicons name="shirt-outline" size={18} color="#FFFFFF" />
              <Text style={shopButtonText}>Shop Matching Colors</Text>
            </TouchableOpacity>
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

const headerText = {
  flex: 1,
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

const heroCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 14,
  backgroundColor: "#FFFFFF",
};

const heroIcon = {
  width: 46,
  height: 46,
  borderRadius: 8,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: "#F3E8FF",
  marginBottom: 12,
};

const heroTitle = {
  fontSize: 20,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 7,
};

const heroText = {
  color: "#4B5563",
  fontSize: 14,
  lineHeight: 20,
};

const analyzerCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  backgroundColor: "#FFFFFF",
  marginBottom: 14,
};

const selfieBox = {
  height: 270,
  borderRadius: 8,
  overflow: "hidden" as const,
  backgroundColor: "#F9FAFB",
  borderWidth: 1,
  borderColor: "#E5E7EB",
};

const selfieImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const selfiePlaceholder = {
  flex: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const placeholderText = {
  marginTop: 8,
  color: "#6B7280",
  fontWeight: "600" as const,
};

const uploadActions = {
  flexDirection: "row" as const,
  gap: 10,
  marginTop: 12,
};

const secondaryButton = {
  flex: 1,
  minHeight: 44,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#DDD6FE",
  backgroundColor: "#FAF5FF",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 7,
};

const secondaryButtonText = {
  color: "#6D28D9",
  fontWeight: "bold" as const,
  fontSize: 13,
};

const analyzeButton = {
  marginTop: 12,
  minHeight: 50,
  borderRadius: 8,
  backgroundColor: "#6D28D9",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};

const disabledButton = {
  backgroundColor: "#C4B5FD",
};

const analyzeButtonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

const noteBox = {
  flexDirection: "row" as const,
  gap: 8,
  backgroundColor: "#F9FAFB",
  borderRadius: 8,
  padding: 10,
  marginTop: 12,
};

const noteText = {
  flex: 1,
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
};

const resultCard = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  borderRadius: 8,
  padding: 16,
  backgroundColor: "#FAF5FF",
};

const resultHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 12,
};

const sectionLabel = {
  fontSize: 12,
  color: "#6D28D9",
  fontWeight: "bold" as const,
  marginBottom: 3,
};

const resultTitle = {
  fontSize: 22,
  color: "#111827",
  fontWeight: "bold" as const,
};

const confidenceBadge = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 10,
};

const confidenceText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

const sourceNote = {
  flexDirection: "row" as const,
  gap: 8,
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  padding: 10,
  marginBottom: 12,
};

const sourceNoteText = {
  flex: 1,
  color: "#6D28D9",
  fontSize: 12,
  lineHeight: 17,
  fontWeight: "600" as const,
};

const toneRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const toneLabel = {
  color: "#6B7280",
  fontSize: 13,
};

const toneValue = {
  color: "#111827",
  fontWeight: "bold" as const,
};

const explanation = {
  color: "#374151",
  lineHeight: 20,
  marginBottom: 16,
};

const sectionTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  marginTop: 6,
  marginBottom: 10,
};

const colorGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
  marginBottom: 12,
};

const colorItem = {
  width: "31%" as const,
  minHeight: 78,
  borderRadius: 8,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E9D5FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 6,
};

const swatch = {
  width: 30,
  height: 30,
  borderRadius: 15,
  marginBottom: 7,
};

const whiteSwatch = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
};

const colorName = {
  color: "#374151",
  fontSize: 11,
  textAlign: "center" as const,
  fontWeight: "600" as const,
};

const tipRow = {
  flexDirection: "row" as const,
  gap: 8,
  marginBottom: 9,
};

const tipText = {
  flex: 1,
  color: "#374151",
  lineHeight: 19,
  fontSize: 13,
};

const shopButton = {
  marginTop: 10,
  minHeight: 48,
  borderRadius: 8,
  backgroundColor: "#111827",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};

const shopButtonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

import AsyncStorage from "@react-native-async-storage/async-storage";

export type AiStyleProfile = {
  skinTone?: string;
  undertone?: string;
  recommendedColors?: string[];
  bodyShape?: string;
  bodyShapeConfidence?: number;
  bodyShapeGuides?: string[];
  styleAudience?: string;
  updatedAt?: string;
};

const getAiStyleProfileKey = (userId: string | null) => `aiStyleProfile:${userId || "guest"}`;

export async function getAiStyleProfile() {
  const userId = await AsyncStorage.getItem("userId");
  const savedProfile = await AsyncStorage.getItem(getAiStyleProfileKey(userId));
  return savedProfile ? (JSON.parse(savedProfile) as AiStyleProfile) : {};
}

export async function updateAiStyleProfile(nextProfile: AiStyleProfile) {
  const userId = await AsyncStorage.getItem("userId");
  const currentProfile = await getAiStyleProfile();
  const mergedProfile: AiStyleProfile = {
    ...currentProfile,
    ...nextProfile,
    updatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(getAiStyleProfileKey(userId), JSON.stringify(mergedProfile));
  return mergedProfile;
}

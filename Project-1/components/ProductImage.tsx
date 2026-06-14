import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, ImageStyle, StyleProp, View, ViewStyle } from "react-native";

type ProductImageProps = {
  uri?: string | null;
  style: StyleProp<ImageStyle>;
  iconSize?: number;
};

export function ProductImage({ uri, style, iconSize = 28 }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const cleanUri = uri?.trim();

  useEffect(() => {
    setFailed(false);
  }, [cleanUri]);

  if (!cleanUri || failed) {
    return (
      <View style={[style as StyleProp<ViewStyle>, { alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="image-outline" size={iconSize} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: cleanUri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

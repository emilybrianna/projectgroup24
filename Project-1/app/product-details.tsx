import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { addCartItem } from "@/lib/cart";
import { supabase } from "../lib/supabase";

const products = [
  {
    id: 1,
    name: "Smart Casual",
    price: 199.9,
    match: "96%",
    size: "M",
    color: "Brown",
    occasion: "Casual",
    description:
      "A clean smart casual outfit for everyday wear, class, and simple hangouts.",
  },
  {
    id: 2,
    name: "Weekend Vibes",
    price: 173.5,
    match: "93%",
    size: "L",
    color: "Black",
    occasion: "Weekend",
    description:
      "Relaxed weekend styling with comfortable pieces that still look polished.",
  },
  {
    id: 3,
    name: "Office Look",
    price: 214.0,
    match: "92%",
    size: "M",
    color: "Blue",
    occasion: "Formal",
    description:
      "A neat formal outfit option for presentations, work days, and smart events.",
  },
  {
    id: 4,
    name: "Weekend Stroll",
    price: 219.0,
    match: "90%",
    size: "S",
    color: "Green",
    occasion: "Casual",
    description:
      "A casual outfit made for easy movement, daily errands, and relaxed plans.",
  },
];

export default function ProductDetails() {
  const params = useLocalSearchParams();
  const selectedId = Number(params.id);
  const product = products.find((item) => item.id === selectedId);

  const handleAddToCart = async () => {
    if (!product) {
      return;
    }

    await addCartItem({
      id: product.id,
      name: product.name,
      size: product.size,
      color: product.color,
      price: product.price,
    });

    Alert.alert("Added to Cart", `${product.name} has been added to your cart.`);
  };

  if (!product) {
    return (
      <View style={page}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={title}>Product Details</Text>

          <View style={headerSpacer} />
        </View>

        <View style={emptyBox}>
          <Ionicons name="alert-circle-outline" size={46} color="#9CA3AF" />
          <Text style={emptyTitle}>Product not found</Text>
          <TouchableOpacity onPress={() => router.replace("/product")} style={shopButton}>
            <Text style={shopButtonText}>Back to Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={container}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={title}>Product Details</Text>

          <TouchableOpacity>
            <Ionicons name="heart-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={imageBox}>
          <Ionicons name="image-outline" size={58} color="#9CA3AF" />
        </View>

        <View style={matchBox}>
          <Ionicons name="sparkles-outline" size={16} color="#059669" />
          <Text style={matchText}>{product.match} Match</Text>
        </View>

        <Text style={productName}>{product.name}</Text>
        <Text style={productPrice}>RM {product.price.toFixed(2)}</Text>
        <Text style={description}>{product.description}</Text>

        <View style={detailGrid}>
          <DetailCard label="Size" value={product.size} />
          <DetailCard label="Color" value={product.color} />
          <DetailCard label="Occasion" value={product.occasion} />
        </View>
      </ScrollView>

      <View style={footer}>
        <TouchableOpacity style={cartButton} onPress={handleAddToCart}>
          <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
          <Text style={cartButtonText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailCard({ label, value }: any) {
  return (
    <View style={detailCard}>
      <Text style={detailLabel}>{label}</Text>
      <Text style={detailValue}>{value}</Text>
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
  paddingBottom: 120,
};

const header = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 22,
};

const headerSpacer = {
  width: 24,
};

const title = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#111827",
};

const imageBox = {
  height: 300,
  backgroundColor: "#F3F4F6",
  borderRadius: 22,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginBottom: 18,
};

const matchBox = {
  backgroundColor: "#ECFDF5",
  borderRadius: 14,
  paddingVertical: 8,
  paddingHorizontal: 12,
  alignSelf: "flex-start" as const,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  marginBottom: 12,
};

const matchText = {
  fontSize: 12,
  color: "#059669",
  fontWeight: "bold" as const,
};

const productName = {
  fontSize: 26,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 8,
};

const productPrice = {
  fontSize: 20,
  fontWeight: "bold" as const,
  color: "#6D28D9",
  marginBottom: 14,
};

const description = {
  fontSize: 14,
  color: "#4B5563",
  lineHeight: 21,
  marginBottom: 20,
};

const detailGrid = {
  flexDirection: "row" as const,
  gap: 10,
};

const detailCard = {
  flex: 1,
  backgroundColor: "#F9FAFB",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 14,
  padding: 14,
};

const detailLabel = {
  fontSize: 11,
  color: "#6B7280",
  marginBottom: 6,
};

const detailValue = {
  fontSize: 14,
  fontWeight: "bold" as const,
  color: "#111827",
};

const footer = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#E5E7EB",
  padding: 20,
};

const cartButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 14,
  padding: 16,
  flexDirection: "row" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 8,
};

const cartButtonText = {
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: "bold" as const,
};

const emptyBox = {
  flex: 1,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  paddingHorizontal: 20,
};

const emptyTitle = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#111827",
  marginTop: 12,
  marginBottom: 18,
};

const shopButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 22,
};

const shopButtonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

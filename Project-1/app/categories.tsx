import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

type MainCategory = "Men" | "Women" | "Kids";

const categoryData = {
  Men: [
    { id: 1, name: "Tops", type: "Men Collection" },
    { id: 2, name: "Bottoms", type: "Men Collection" },
    { id: 3, name: "Accessories", type: "Men Collection" },
  ],
  Women: [
    { id: 4, name: "Tops", type: "Women Collection" },
    { id: 5, name: "Bottoms", type: "Women Collection" },
    { id: 6, name: "Accessories", type: "Women Collection" },
  ],
  Kids: [
    { id: 7, name: "Boys Tops", type: "Kids Collection" },
    { id: 8, name: "Boys Bottoms", type: "Kids Collection" },
    { id: 9, name: "Girls Tops", type: "Kids Collection" },
    { id: 10, name: "Girls Bottoms", type: "Kids Collection" },
    { id: 11, name: "Kids Accessories", type: "Kids Collection" },
  ],
};

export default function Categories() {
  const [selectedCategory, setSelectedCategory] = useState<MainCategory>("Men");

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={title}>Categories</Text>

        <TouchableOpacity>
          <Ionicons name="search-outline" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={tabRow}>
        {["Men", "Women", "Kids"].map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setSelectedCategory(item as MainCategory)}
            style={[tabButton, selectedCategory === item && activeTabButton]}
          >
            <Text style={[tabText, selectedCategory === item && activeTabText]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={listContainer}>
        {categoryData[selectedCategory].map((item) => (
          <TouchableOpacity key={item.id} style={categoryCard}>
            <View style={imageBox}>
              <Ionicons name="image-outline" size={34} color="#9CA3AF" />
            </View>

            <View style={categoryInfo}>
              <Text style={categoryName}>{item.name}</Text>
              <Text style={categoryType}>{item.type}</Text>
            </View>

            <Ionicons name="chevron-forward-outline" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#FFFFFF",
};

const header = {
  paddingTop: 55,
  paddingHorizontal: 20,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};

const title = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#111827",
};

const tabRow = {
  flexDirection: "row" as const,
  paddingHorizontal: 20,
  marginTop: 22,
  gap: 10,
};

const tabButton = {
  backgroundColor: "#F3F4F6",
  paddingVertical: 10,
  paddingHorizontal: 22,
  borderRadius: 20,
};

const activeTabButton = {
  backgroundColor: "#6D28D9",
};

const tabText = {
  color: "#6B7280",
  fontWeight: "bold" as const,
  fontSize: 13,
};

const activeTabText = {
  color: "#FFFFFF",
};

const listContainer = {
  paddingHorizontal: 20,
  paddingTop: 18,
  paddingBottom: 30,
};

const categoryCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  marginBottom: 14,
  padding: 12,
  flexDirection: "row" as const,
  alignItems: "center" as const,
};

const imageBox = {
  width: 105,
  height: 90,
  backgroundColor: "#F3F4F6",
  borderRadius: 14,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginRight: 14,
};

const categoryInfo = {
  flex: 1,
};

const categoryName = {
  fontSize: 15,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 6,
};

const categoryType = {
  fontSize: 13,
  color: "#6B7280",
};
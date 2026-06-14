import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Product = {
  id: number;
  name: string;
  type: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  size: string | null;
  color: string | null;
  occasion: string | null;
  is_active: boolean | null;
};

export default function Products() {
  const params = useLocalSearchParams();
  const initialSearch = typeof params.search === "string" ? params.search : "";

  const [showFilter, setShowFilter] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const [searchText, setSearchText] = useState(initialSearch);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async (searchOverride = searchText) => {
    setLoading(true);

    let query = supabase
      .from("products")
      .select("id,name,type,description,price,image_url,stock,size,color,occasion,is_active,created_at")
      .neq("is_active", false)
      .order("created_at", { ascending: false });

    const keyword = searchOverride.trim();

    if (keyword) {
      query = query.or(
        `name.ilike.%${keyword}%,type.ilike.%${keyword}%,color.ilike.%${keyword}%,occasion.ilike.%${keyword}%,size.ilike.%${keyword}%`
      );
    }

    if (selectedSize) {
      query = query.eq("size", selectedSize);
    }

    if (selectedColor) {
      query = query.eq("color", selectedColor);
    }

    if (selectedOccasion) {
      query = query.eq("occasion", selectedOccasion);
    }

    if (selectedPrice === "Below RM100") {
      query = query.lt("price", 100);
    } else if (selectedPrice === "RM100 - RM200") {
      query = query.gte("price", 100).lte("price", 200);
    } else if (selectedPrice === "Above RM200") {
      query = query.gt("price", 200);
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert("Error", error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    setProducts((data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts(initialSearch);

  }, []);

  const clearFilter = () => {
    setSelectedSize("");
    setSelectedColor("");
    setSelectedOccasion("");
    setSelectedPrice("");
  };

  const resetFilter = () => {
    clearFilter();
    setSearchText("");
    setShowFilter(false);
    setTimeout(() => fetchProducts(""), 0);
  };

  const clearSearch = () => {
    setSearchText("");
    fetchProducts("");
  };

  const applyFilter = () => {
    setShowFilter(false);
    fetchProducts();
  };

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={title}>All Clothes</Text>

        <TouchableOpacity onPress={() => setShowFilter(true)}>
          <Ionicons name="filter-outline" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={searchBox}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          placeholder="Search clothes..."
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => fetchProducts()}
          style={searchInput}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={tabRow}>
        <TouchableOpacity style={activeTab}>
          <Text style={activeTabText}>For You</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={listContainer}>
        {loading ? (
          <View style={emptyResult}>
            <ActivityIndicator color="#6D28D9" />
            <Text style={emptyText}>Loading products...</Text>
          </View>
        ) : products.length > 0 ? (
          products.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={productCard}
              onPress={() =>
                router.push({
                  pathname: "/product-details",
                  params: { id: item.id },
                })
              }
            >
              <View style={imageBox}>
                <Ionicons name="image-outline" size={34} color="#9CA3AF" />
              </View>

              <View style={productInfo}>
                <Text style={productName}>{item.name}</Text>
                <Text style={productPrice}>RM {Number(item.price).toFixed(2)}</Text>

                <View style={matchBox}>
                  <Text style={matchText}>
                    {[item.size, item.color, item.occasion].filter(Boolean).join(" / ") || "For You"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity>
                <Ionicons name="heart-outline" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <View style={emptyResult}>
            <Ionicons name="search-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No clothes found</Text>
            <Text style={emptyText}>Try another keyword or clear the filter.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showFilter} transparent animationType="slide">
        <View style={modalOverlay}>
          <View style={filterBox}>
            <View style={filterHeader}>
              <Text style={filterTitle}>Filter Clothes</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <Ionicons name="close-outline" size={26} color="#111827" />
              </TouchableOpacity>
            </View>

            <Text style={filterLabel}>Size</Text>
            <View style={optionRow}>
              {["S", "M", "L", "XL"].map((item) => (
                <FilterOption
                  key={item}
                  label={item}
                  selected={selectedSize === item}
                  onPress={() => setSelectedSize(item)}
                />
              ))}
            </View>

            <Text style={filterLabel}>Color</Text>
            <View style={optionRow}>
              {["Black", "White", "Brown", "Blue", "Green"].map((item) => (
                <FilterOption
                  key={item}
                  label={item}
                  selected={selectedColor === item}
                  onPress={() => setSelectedColor(item)}
                />
              ))}
            </View>

            <Text style={filterLabel}>Occasion</Text>
            <View style={optionRow}>
              {["Casual", "Formal", "Weekend"].map((item) => (
                <FilterOption
                  key={item}
                  label={item}
                  selected={selectedOccasion === item}
                  onPress={() => setSelectedOccasion(item)}
                />
              ))}
            </View>

            <Text style={filterLabel}>Price</Text>
            <View style={optionRow}>
              {["Below RM100", "RM100 - RM200", "Above RM200"].map((item) => (
                <FilterOption
                  key={item}
                  label={item}
                  selected={selectedPrice === item}
                  onPress={() => setSelectedPrice(item)}
                />
              ))}
            </View>

            <View style={filterButtonRow}>
              <TouchableOpacity onPress={clearFilter} style={clearButton}>
                <Text style={clearButtonText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={applyFilter} style={applyButton}>
                <Text style={applyButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={resetFilter} style={resetButton}>
              <Text style={resetButtonText}>Reset Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterOption({ label, selected, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[optionBox, selected && selectedOption]}>
      <Text style={[optionText, selected && selectedOptionText]}>{label}</Text>
    </TouchableOpacity>
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

const searchBox = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#F3F4F6",
  borderRadius: 14,
  paddingHorizontal: 14,
  marginHorizontal: 20,
  marginTop: 18,
};

const searchInput = {
  flex: 1,
  paddingVertical: 12,
  marginLeft: 8,
};

const tabRow = {
  flexDirection: "row" as const,
  paddingHorizontal: 20,
  marginTop: 22,
};

const activeTab = {
  backgroundColor: "#6D28D9",
  paddingVertical: 10,
  paddingHorizontal: 22,
  borderRadius: 20,
};

const activeTabText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
  fontSize: 13,
};

const listContainer = {
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 30,
};

const productCard = {
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
  width: 130,
  height: 105,
  backgroundColor: "#F3F4F6",
  borderRadius: 14,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginRight: 14,
};

const productInfo = {
  flex: 1,
};

const productName = {
  fontSize: 14,
  fontWeight: "600" as const,
  color: "#111827",
  marginBottom: 6,
};

const productPrice = {
  fontSize: 13,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 16,
};

const matchBox = {
  backgroundColor: "#ECFDF5",
  borderRadius: 12,
  paddingVertical: 5,
  paddingHorizontal: 10,
  alignSelf: "flex-start" as const,
};

const matchText = {
  fontSize: 11,
  color: "#059669",
  fontWeight: "bold" as const,
};

const emptyResult = {
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingTop: 80,
};

const emptyTitle = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#111827",
  marginTop: 12,
};

const emptyText = {
  fontSize: 13,
  color: "#6B7280",
  marginTop: 6,
};

const modalOverlay = {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "flex-end" as const,
};

const filterBox = {
  backgroundColor: "#FFFFFF",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  padding: 20,
};

const filterHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 18,
};

const filterTitle = {
  fontSize: 20,
  fontWeight: "bold" as const,
  color: "#111827",
};

const filterLabel = {
  fontSize: 14,
  fontWeight: "bold" as const,
  color: "#111827",
  marginTop: 12,
  marginBottom: 8,
};

const optionRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
};

const optionBox = {
  backgroundColor: "#F3F4F6",
  paddingVertical: 9,
  paddingHorizontal: 14,
  borderRadius: 18,
};

const selectedOption = {
  backgroundColor: "#6D28D9",
};

const optionText = {
  fontSize: 12,
  color: "#374151",
  fontWeight: "600" as const,
};

const selectedOptionText = {
  color: "#FFFFFF",
};

const filterButtonRow = {
  flexDirection: "row" as const,
  gap: 12,
  marginTop: 24,
};

const clearButton = {
  flex: 1,
  backgroundColor: "#F3F4F6",
  padding: 14,
  borderRadius: 14,
};

const clearButtonText = {
  textAlign: "center" as const,
  color: "#111827",
  fontWeight: "bold" as const,
};

const applyButton = {
  flex: 1,
  backgroundColor: "#6D28D9",
  padding: 14,
  borderRadius: 14,
};

const applyButtonText = {
  textAlign: "center" as const,
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

const resetButton = {
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#E5E7EB",
};

const resetButtonText = {
  color: "#6B7280",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

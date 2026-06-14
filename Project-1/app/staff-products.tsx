import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  category: string | null;
  description: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  low_stock_limit: number | null;
  is_active: boolean | null;
  size: string | null;
};

const LOW_STOCK_DEFAULT = 5;

export default function StaffProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [size, setSize] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) => product.stock <= (product.low_stock_limit ?? LOW_STOCK_DEFAULT)
      ).length,
    [products]
  );

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "staff") {
        Alert.alert("Access Denied", "Product list is for staff only.");
        router.replace("/customer");
        return;
      }

      fetchProducts();
    };

    checkAccessAndLoad();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id,name,type,category,description,image_url,price,stock,low_stock_limit,is_active,size")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setProducts((data || []) as Product[]);
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(String(product.price));
    setCategory(product.category || product.type || "");
    setStock(String(product.stock));
    setSize(product.size || "");
    setImageUrl(product.image_url || "");
  };

  const clearForm = () => {
    setEditingProduct(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("");
    setStock("");
    setSize("");
    setImageUrl("");
  };

  const submitProductRequest = async () => {
    const productPrice = Number(price);
    const productStock = Number(stock);

    if (!name.trim() || !category.trim() || !price.trim() || !stock.trim()) {
      Alert.alert("Error", "Name, category, price, and stock are required.");
      return;
    }

    if (
      Number.isNaN(productPrice) ||
      Number.isNaN(productStock) ||
      productPrice < 0 ||
      productStock < 0
    ) {
      Alert.alert("Error", "Price and stock must be valid non-negative numbers.");
      return;
    }

    const staffId = await AsyncStorage.getItem("userId");
    const staffName = await AsyncStorage.getItem("userName");
    const requestedData = {
      name: name.trim(),
      description: description.trim() || null,
      price: productPrice,
      category: category.trim(),
      type: category.trim(),
      stock: productStock,
      size: size.trim() || null,
      image_url: imageUrl.trim() || null,
      is_active: true,
    };

    const { error } = await supabase.from("product_change_requests").insert({
      product_id: editingProduct ? String(editingProduct.id) : null,
      staff_id: staffId || null,
      staff_name: staffName || "Staff",
      action: editingProduct ? "edit" : "add",
      product_name: name.trim(),
      current_data: editingProduct || null,
      requested_data: requestedData,
    });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await supabase.from("admin_notifications").insert({
      title: editingProduct ? "Product Edit Request" : "Product Add Request",
      message: `${staffName || "Staff"} requested to ${editingProduct ? "edit" : "add"} ${name.trim()}.`,
      type: "product_request",
    });

    Alert.alert("Request Sent", "Admin must approve this product change first.");
    clearForm();
    fetchProducts();
  };

  const requestDeleteProduct = (product: Product) => {
    Alert.alert("Request Delete", `Send delete request for ${product.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send Request",
        style: "destructive",
        onPress: async () => {
          const staffId = await AsyncStorage.getItem("userId");
          const staffName = await AsyncStorage.getItem("userName");
          const { error } = await supabase.from("product_change_requests").insert({
            product_id: String(product.id),
            staff_id: staffId || null,
            staff_name: staffName || "Staff",
            action: "delete",
            product_name: product.name,
            current_data: product,
            requested_data: null,
          });

          if (error) {
            Alert.alert("Error", error.message);
            return;
          }

          await supabase.from("admin_notifications").insert({
            title: "Product Delete Request",
            message: `${staffName || "Staff"} requested to delete ${product.name}.`,
            type: "product_request",
          });

          Alert.alert("Request Sent", "Admin must approve the delete request first.");
        },
      },
    ]);
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Product List</Text>
            <Text style={subtitle}>Update details, price, category, and stock</Text>
          </View>
          <TouchableOpacity onPress={fetchProducts} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        {lowStockCount > 0 && (
          <View style={alertBox}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={alertText}>{lowStockCount} low stock item(s) highlighted.</Text>
          </View>
        )}

        <View style={formBox}>
          <Text style={sectionTitle}>
            {editingProduct ? `Request Edit: ${editingProduct.name}` : "Request Add Product"}
          </Text>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={input} />
          <TextInput
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            style={[input, descriptionInput]}
          />
          <TextInput
            placeholder="Price"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            style={input}
          />
          <TextInput
            placeholder="Category"
            value={category}
            onChangeText={setCategory}
            style={input}
          />
          <TextInput
            placeholder="Stock"
            value={stock}
            onChangeText={setStock}
            keyboardType="number-pad"
            style={input}
          />
          <TextInput
            placeholder="Size"
            value={size}
            onChangeText={setSize}
            style={input}
          />
          <TextInput
            placeholder="Image URL"
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            style={input}
          />

          <TouchableOpacity onPress={submitProductRequest} style={saveButton}>
            <Ionicons name="save-outline" size={19} color="#FFFFFF" />
            <Text style={saveText}>{editingProduct ? "Send Edit Request" : "Send Add Request"}</Text>
          </TouchableOpacity>

          {editingProduct && (
            <TouchableOpacity onPress={clearForm} style={cancelButton}>
              <Text style={cancelText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={listHeader}>
          <Text style={sectionTitle}>Products</Text>
          <Text style={countText}>{loading ? "Loading..." : `${products.length} items`}</Text>
        </View>

        {products.map((product) => {
          const isLowStock =
            product.stock <= (product.low_stock_limit ?? LOW_STOCK_DEFAULT);

          return (
            <View key={product.id} style={[productCard, isLowStock && lowStockCard]}>
              <View style={productIcon}>
                <Ionicons
                  name={isLowStock ? "warning-outline" : "cube-outline"}
                  size={24}
                  color={isLowStock ? "#B45309" : "#6D28D9"}
                />
              </View>

              <View style={productInfo}>
                <Text style={productName}>{product.name}</Text>
                <Text style={productMeta}>
                  RM {Number(product.price).toFixed(2)} /{" "}
                  {product.category || product.type || "No category"}
                </Text>
                <Text style={[productMeta, isLowStock && lowStockText]}>
                  Stock {product.stock}
                  {isLowStock ? " / Low stock" : ""}
                </Text>
              </View>

              <TouchableOpacity onPress={() => startEdit(product)} style={editButton}>
                <Ionicons name="create-outline" size={18} color="#6D28D9" />
                <Text style={editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => requestDeleteProduct(product)}
                style={[editButton, deleteRequestButton]}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          );
        })}

        {!loading && products.length === 0 && (
          <View style={emptyBox}>
            <Ionicons name="cube-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No products found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const page = { flex: 1, backgroundColor: "#FFFFFF" };
const container = { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 40 };
const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 16,
};
const iconButton = {
  width: 42,
  height: 42,
  borderRadius: 10,
  backgroundColor: "#F3E8FF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};
const title = { fontSize: 23, fontWeight: "bold" as const, color: "#111827" };
const subtitle = { marginTop: 4, fontSize: 13, color: "#6B7280" };
const alertBox = {
  borderWidth: 1,
  borderColor: "#FCD34D",
  backgroundColor: "#FFFBEB",
  borderRadius: 8,
  padding: 12,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  marginBottom: 14,
};
const alertText = { color: "#92400E", fontWeight: "bold" as const, fontSize: 13 };
const formBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 22,
};
const sectionTitle = {
  fontSize: 17,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 12,
};
const input = {
  backgroundColor: "#F3F4F6",
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
};
const descriptionInput = { minHeight: 78, textAlignVertical: "top" as const };
const saveButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 10,
  padding: 15,
  flexDirection: "row" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 8,
};
const saveText = { color: "#FFFFFF", fontWeight: "bold" as const };
const cancelButton = {
  marginTop: 10,
  borderRadius: 10,
  padding: 14,
  backgroundColor: "#F3F4F6",
};
const cancelText = { color: "#6D28D9", textAlign: "center" as const, fontWeight: "bold" as const };
const listHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};
const countText = { color: "#6B7280", fontSize: 12 };
const productCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 14,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
};
const lowStockCard = { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" };
const productIcon = {
  width: 48,
  height: 48,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const productInfo = { flex: 1 };
const productName = {
  fontSize: 14,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 5,
};
const productMeta = { fontSize: 12, color: "#6B7280", marginBottom: 4 };
const lowStockText = { color: "#B45309", fontWeight: "bold" as const };
const editButton = {
  borderRadius: 10,
  backgroundColor: "#F3E8FF",
  paddingHorizontal: 10,
  paddingVertical: 9,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 5,
};
const deleteRequestButton = {
  backgroundColor: "#FEF2F2",
};
const editText = { color: "#6D28D9", fontSize: 12, fontWeight: "bold" as const };
const emptyBox = { alignItems: "center" as const, paddingVertical: 60 };
const emptyTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  marginTop: 12,
  fontSize: 16,
};

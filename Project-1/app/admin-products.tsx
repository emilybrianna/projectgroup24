import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Product = {
  id: number | string;
  name: string;
  type: string | null;
  category: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  is_active: boolean | null;
  size: string | null;
};

type ProductChangeRequest = {
  id: string;
  product_id: string | null;
  staff_id: string | null;
  staff_name: string | null;
  action: "add" | "edit" | "delete" | "status";
  status: "pending" | "approved" | "rejected";
  product_name: string | null;
  current_data: Partial<Product> | null;
  requested_data: Partial<Product> | null;
  created_at: string;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<ProductChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [size, setSize] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "admin") {
        Alert.alert("Access Denied", "Product management is for admin only.");
        router.replace("/customer");
        return;
      }

      fetchProducts();
      fetchProductRequests();
    };

    checkAccessAndLoad();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id,name,type,category,description,price,image_url,stock,is_active,size")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setProducts((data || []) as Product[]);
  };

  const fetchProductRequests = async () => {
    const { data, error } = await supabase
      .from("product_change_requests")
      .select("id,product_id,staff_id,staff_name,action,status,product_name,current_data,requested_data,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Requests Error", error.message);
      return;
    }

    setRequests((data || []) as ProductChangeRequest[]);
  };

  const clearForm = () => {
    setEditingProduct(null);
    setName("");
    setType("");
    setCategory("");
    setPrice("");
    setStock("");
    setSize("");
    setImageUrl("");
    setDescription("");
  };

  const fillForm = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setType(product.type || "");
    setCategory(product.category || "");
    setPrice(String(product.price));
    setStock(String(product.stock));
    setSize(product.size || "");
    setImageUrl(product.image_url || "");
    setDescription(product.description || "");
  };

  const saveProduct = async () => {
    const productPrice = Number(price);
    const productStock = Number(stock);

    if (!name || !type || !category || !price || !stock) {
      Alert.alert("Error", "Please fill name, type, category, price, and stock.");
      return;
    }

    if (Number.isNaN(productPrice) || Number.isNaN(productStock)) {
      Alert.alert("Error", "Price and stock must be numbers.");
      return;
    }

    const productData = {
      name: name.trim(),
      type: type.trim(),
      category: category.trim(),
      price: productPrice,
      stock: productStock,
      size: size.trim() || null,
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      is_active: true,
    };

    const { error } = editingProduct
      ? await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)
      : await supabase.from("products").insert(productData);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Success", editingProduct ? "Product updated." : "Product added.");
    clearForm();
    fetchProducts();
  };

  const deleteProduct = (product: Product) => {
    Alert.alert("Delete Product", `Delete ${product.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", product.id);

          if (error) {
            Alert.alert("Error", error.message);
            return;
          }

          if (editingProduct?.id === product.id) {
            clearForm();
          }

          fetchProducts();
        },
      },
    ]);
  };

  const toggleProductStatus = async (product: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: product.is_active === false })
      .eq("id", product.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    fetchProducts();
  };

  const applyProductRequest = async (request: ProductChangeRequest) => {
    if (request.action === "add") {
      if (!request.requested_data) {
        return { message: "Missing requested product data." };
      }

      const { error } = await supabase.from("products").insert(request.requested_data);
      return error;
    }

    if (request.action === "edit" || request.action === "status") {
      if (!request.product_id) {
        return { message: "Missing product id." };
      }

      if (!request.requested_data) {
        return { message: "Missing requested product data." };
      }

      const { error } = await supabase
        .from("products")
        .update(request.requested_data)
        .eq("id", request.product_id);

      return error;
    }

    if (request.action === "delete") {
      if (!request.product_id) {
        return { message: "Missing product id." };
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", request.product_id);

      return error;
    }

    return null;
  };

  const approveRequest = async (request: ProductChangeRequest) => {
    const applyError = await applyProductRequest(request);

    if (applyError) {
      Alert.alert("Error", applyError.message);
      return;
    }

    const { error } = await supabase
      .from("product_change_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", request.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Approved", `${request.product_name || "Product"} request approved.`);
    await notifyStaff(request, "approved");
    fetchProductRequests();
    fetchProducts();
  };

  const rejectRequest = async (request: ProductChangeRequest) => {
    const { error } = await supabase
      .from("product_change_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", request.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Rejected", `${request.product_name || "Product"} request rejected.`);
    await notifyStaff(request, "rejected");
    fetchProductRequests();
  };

  const notifyStaff = async (
    request: ProductChangeRequest,
    status: "approved" | "rejected"
  ) => {
    if (!request.staff_id) {
      return;
    }

    await supabase.from("staff_notifications").insert({
      staff_id: request.staff_id,
      title: status === "approved" ? "Product Request Approved" : "Product Request Rejected",
      message: `Your ${request.action} request for ${request.product_name || "a product"} was ${status}.`,
      type: "product_request",
    });
  };

  return (
    <View style={page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={container}
      >
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Product Management</Text>
            <Text style={subtitle}>Add, edit, delete, and refresh products</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              fetchProducts();
              fetchProductRequests();
            }}
            style={iconButton}
          >
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={requestBox}>
          <View style={listHeader}>
            <Text style={sectionTitle}>Staff Product Requests</Text>
            <Text style={countText}>{requests.length} pending</Text>
          </View>

          {requests.length === 0 ? (
            <Text style={emptyText}>No product requests waiting for approval.</Text>
          ) : (
            requests.map((request) => (
              <View key={request.id} style={requestCard}>
                <View style={requestTop}>
                  <View style={requestIcon}>
                    <Ionicons
                      name={request.action === "delete" ? "trash-outline" : "cube-outline"}
                      size={20}
                      color={request.action === "delete" ? "#DC2626" : "#6D28D9"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={requestTitle}>
                      {request.action.toUpperCase()} · {request.product_name || "Product"}
                    </Text>
                    <Text style={requestMeta}>Requested by {request.staff_name || "Staff"}</Text>
                  </View>
                </View>

                <Text style={requestDetails}>
                  {request.action === "delete"
                    ? "Delete this product from the system."
                    : `RM ${Number(request.requested_data?.price || 0).toFixed(2)} · Stock ${request.requested_data?.stock ?? "-"} · ${request.requested_data?.category || "No category"}`}
                </Text>

                <View style={requestActions}>
                  <TouchableOpacity onPress={() => rejectRequest(request)} style={rejectButton}>
                    <Text style={rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => approveRequest(request)} style={approveButton}>
                    <Text style={approveText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={formBox}>
          <Text style={sectionTitle}>
            {editingProduct ? "Edit Product" : "Add New Product"}
          </Text>

          <TextInput
            placeholder="Product name"
            value={name}
            onChangeText={setName}
            style={input}
          />
          <TextInput
            placeholder="Product type e.g. Tops"
            value={type}
            onChangeText={setType}
            style={input}
          />
          <TextInput
            placeholder="Category e.g. Men, Women, Kids"
            value={category}
            onChangeText={setCategory}
            style={input}
          />
          <View style={row}>
            <TextInput
              placeholder="Price"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              style={[input, halfInput]}
            />
            <TextInput
              placeholder="Stock"
              value={stock}
              onChangeText={setStock}
              keyboardType="number-pad"
              style={[input, halfInput]}
            />
          </View>
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
          <TextInput
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            style={[input, descriptionInput]}
          />

          <TouchableOpacity onPress={saveProduct} style={primaryButton}>
            <Ionicons
              name={editingProduct ? "save-outline" : "add-outline"}
              size={20}
              color="#FFFFFF"
            />
            <Text style={primaryButtonText}>
              {editingProduct ? "Update Product" : "Add Product"}
            </Text>
          </TouchableOpacity>

          {editingProduct && (
            <TouchableOpacity onPress={clearForm} style={secondaryButton}>
              <Text style={secondaryButtonText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={listHeader}>
          <Text style={sectionTitle}>Products</Text>
          <Text style={countText}>
            {loading ? "Loading..." : `${products.length} items`}
          </Text>
        </View>

        {products.map((product) => (
          <View key={product.id} style={productCard}>
            <View style={productIcon}>
              <Ionicons name="cube-outline" size={24} color="#6D28D9" />
            </View>

            <View style={productInfo}>
              <Text style={productName}>{product.name}</Text>
              <Text style={productMeta}>
                {product.category || "No category"} / {product.type || "No type"} / RM{" "}
                {Number(product.price).toFixed(2)}
              </Text>
              <Text style={productMeta}>
                Stock {product.stock}
                {product.size ? ` / Size ${product.size}` : ""}
              </Text>
              <TouchableOpacity
                onPress={() => toggleProductStatus(product)}
                style={[
                  statusBadge,
                  product.is_active === false && inactiveStatusBadge,
                ]}
              >
                <Text
                  style={[
                    statusText,
                    product.is_active === false && inactiveStatusText,
                  ]}
                >
                  {product.is_active === false ? "Inactive" : "Active"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={actionColumn}>
              <TouchableOpacity
                onPress={() => fillForm(product)}
                style={smallActionButton}
              >
                <Ionicons name="create-outline" size={18} color="#6D28D9" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteProduct(product)}
                style={[smallActionButton, deleteButton]}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && products.length === 0 && (
          <View style={emptyBox}>
            <Ionicons name="cube-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No products yet</Text>
            <Text style={emptyText}>Add your first product above.</Text>
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
  paddingBottom: 40,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 22,
};

const iconButton = {
  width: 42,
  height: 42,
  borderRadius: 10,
  backgroundColor: "#F3E8FF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const title = {
  fontSize: 23,
  fontWeight: "bold" as const,
  color: "#111827",
};

const subtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "#6B7280",
};

const requestBox = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  backgroundColor: "#FAF5FF",
  borderRadius: 8,
  padding: 14,
  marginBottom: 18,
};

const requestCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
};

const requestTop = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
};

const requestIcon = {
  width: 38,
  height: 38,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const requestTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  fontSize: 13,
};

const requestMeta = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 3,
};

const requestDetails = {
  color: "#374151",
  fontSize: 12,
  marginTop: 10,
  lineHeight: 17,
};

const requestActions = {
  flexDirection: "row" as const,
  gap: 10,
  marginTop: 12,
};

const approveButton = {
  flex: 1,
  borderRadius: 8,
  padding: 11,
  backgroundColor: "#6D28D9",
};

const rejectButton = {
  flex: 1,
  borderRadius: 8,
  padding: 11,
  backgroundColor: "#F3F4F6",
};

const approveText = {
  color: "#FFFFFF",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

const rejectText = {
  color: "#DC2626",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

const formBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 24,
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

const descriptionInput = {
  minHeight: 82,
  textAlignVertical: "top" as const,
};

const row = {
  flexDirection: "row" as const,
  gap: 12,
};

const halfInput = {
  flex: 1,
};

const primaryButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 10,
  padding: 15,
  flexDirection: "row" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 8,
};

const primaryButtonText = {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "bold" as const,
};

const secondaryButton = {
  marginTop: 10,
  borderRadius: 10,
  padding: 14,
  backgroundColor: "#F3F4F6",
};

const secondaryButtonText = {
  color: "#6D28D9",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

const listHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};

const countText = {
  color: "#6B7280",
  fontSize: 12,
};

const productCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 14,
  flexDirection: "row" as const,
  alignItems: "center" as const,
};

const productIcon = {
  width: 58,
  height: 58,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginRight: 12,
};

const productInfo = {
  flex: 1,
};

const productName = {
  fontSize: 14,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 5,
};

const productMeta = {
  fontSize: 12,
  color: "#6B7280",
  marginBottom: 4,
};

const statusBadge = {
  backgroundColor: "#ECFDF5",
  borderRadius: 10,
  paddingVertical: 5,
  paddingHorizontal: 10,
  alignSelf: "flex-start" as const,
  marginTop: 4,
};

const inactiveStatusBadge = {
  backgroundColor: "#F3F4F6",
};

const statusText = {
  color: "#059669",
  fontSize: 11,
  fontWeight: "bold" as const,
};

const inactiveStatusText = {
  color: "#6B7280",
};

const actionColumn = {
  gap: 8,
};

const smallActionButton = {
  width: 36,
  height: 36,
  borderRadius: 10,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const deleteButton = {
  backgroundColor: "#FEF2F2",
};

const emptyBox = {
  alignItems: "center" as const,
  paddingVertical: 60,
};

const emptyTitle = {
  fontSize: 17,
  fontWeight: "bold" as const,
  color: "#111827",
  marginTop: 12,
};

const emptyText = {
  fontSize: 13,
  color: "#6B7280",
  marginTop: 6,
};

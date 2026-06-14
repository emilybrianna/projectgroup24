import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type Category = {
  id: string;
  name: string;
  type: string;
};

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "admin") {
        Alert.alert("Access Denied", "Category management is for admin only.");
        router.replace("/customer");
        return;
      }

      fetchCategories();
    };

    checkAccessAndLoad();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("id,name,type")
      .order("name", { ascending: true });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setCategories((data || []) as Category[]);
  };

  const clearForm = () => {
    setEditingCategory(null);
    setName("");
    setType("");
  };

  const fillForm = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setType(category.type);
  };

  const saveCategory = async () => {
    if (!name.trim() || !type.trim()) {
      Alert.alert("Error", "Please fill category name and type.");
      return;
    }

    const categoryData = {
      name: name.trim(),
      type: type.trim(),
    };

    const { error } = editingCategory
      ? await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", editingCategory.id)
      : await supabase.from("categories").insert(categoryData);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Success", editingCategory ? "Category updated." : "Category added.");
    clearForm();
    fetchCategories();
  };

  const deleteCategory = (category: Category) => {
    Alert.alert("Delete Category", `Delete ${category.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("categories")
            .delete()
            .eq("id", category.id);

          if (error) {
            Alert.alert("Error", error.message);
            return;
          }

          if (editingCategory?.id === category.id) {
            clearForm();
          }

          fetchCategories();
        },
      },
    ]);
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={headerText}>
            <Text style={title}>Category Management</Text>
            <Text style={subtitle}>Add, edit, and delete product categories</Text>
          </View>
          <TouchableOpacity onPress={fetchCategories} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={formBox}>
          <Text style={sectionTitle}>
            {editingCategory ? "Edit Category" : "Add New Category"}
          </Text>
          <TextInput
            placeholder="Category name e.g. Men"
            value={name}
            onChangeText={setName}
            style={input}
          />
          <TextInput
            placeholder="Category type e.g. Men"
            value={type}
            onChangeText={setType}
            style={input}
          />
          <TouchableOpacity onPress={saveCategory} style={primaryButton}>
            <Ionicons
              name={editingCategory ? "save-outline" : "add-outline"}
              size={20}
              color="#FFFFFF"
            />
            <Text style={primaryButtonText}>
              {editingCategory ? "Update Category" : "Add Category"}
            </Text>
          </TouchableOpacity>
          {editingCategory && (
            <TouchableOpacity onPress={clearForm} style={secondaryButton}>
              <Text style={secondaryButtonText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={listHeader}>
          <Text style={sectionTitle}>Categories</Text>
          <Text style={countText}>
            {loading ? "Loading..." : `${categories.length} items`}
          </Text>
        </View>

        {categories.map((category) => (
          <View key={category.id} style={categoryCard}>
            <View style={categoryIcon}>
              <Ionicons name="folder-open-outline" size={22} color="#6D28D9" />
            </View>
            <View style={categoryInfo}>
              <Text style={categoryName}>{category.name}</Text>
              <Text style={categoryType}>{category.type}</Text>
            </View>
            <View style={actionColumn}>
              <TouchableOpacity onPress={() => fillForm(category)} style={smallActionButton}>
                <Ionicons name="create-outline" size={18} color="#6D28D9" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteCategory(category)}
                style={[smallActionButton, deleteButton]}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && categories.length === 0 && (
          <View style={emptyBox}>
            <Ionicons name="folder-open-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No categories yet</Text>
            <Text style={emptyText}>Add Men, Women, Kids, or your own category.</Text>
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

const headerText = {
  flex: 1,
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
  fontSize: 22,
  fontWeight: "bold" as const,
  color: "#111827",
};

const subtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "#6B7280",
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

const categoryCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 14,
  flexDirection: "row" as const,
  alignItems: "center" as const,
};

const categoryIcon = {
  width: 48,
  height: 48,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginRight: 12,
};

const categoryInfo = {
  flex: 1,
};

const categoryName = {
  fontSize: 15,
  fontWeight: "bold" as const,
  color: "#111827",
};

const categoryType = {
  color: "#6B7280",
  marginTop: 4,
  fontSize: 12,
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
  textAlign: "center" as const,
};

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function StaffStock() {
  return (
    <ScrollView style={container}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={title}>Stock Management</Text>
      </View>

      <Text style={subtitle}>Update product quantity and check low stock.</Text>

      <View style={warningCard}>
        <Ionicons name="warning-outline" size={26} color="#F59E0B" />

        <View style={{ marginLeft: 12 }}>
          <Text style={warningTitle}>Low Stock Alert</Text>
          <Text style={text}>Some products are below stock limit.</Text>
        </View>
      </View>

      <View style={card}>
        <Text style={productName}>Long Coat</Text>
        <Text style={text}>Current Stock: 3</Text>
        <Text style={lowStock}>Low stock</Text>

        <TextInput
          style={input}
          placeholder="Enter new quantity"
          keyboardType="numeric"
        />

        <TouchableOpacity style={button}>
          <Text style={buttonText}>Update Quantity</Text>
        </TouchableOpacity>
      </View>

      <View style={card}>
        <Text style={productName}>Linen Shirt</Text>
        <Text style={text}>Current Stock: 20</Text>
        <Text style={safeStock}>Stock OK</Text>

        <TextInput
          style={input}
          placeholder="Enter new quantity"
          keyboardType="numeric"
        />

        <TouchableOpacity style={button}>
          <Text style={buttonText}>Update Quantity</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const container = {
  flex: 1,
  backgroundColor: "#FFFFFF",
  padding: 20,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  marginTop: 40,
  marginBottom: 10,
};

const title = {
  fontSize: 24,
  fontWeight: "bold" as const,
  color: "#111827",
  marginLeft: 15,
};

const subtitle = {
  fontSize: 14,
  color: "#6B7280",
  marginBottom: 20,
};

const warningCard = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#FFFBEB",
  borderRadius: 18,
  padding: 16,
  marginBottom: 18,
};

const warningTitle = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#92400E",
};

const card = {
  backgroundColor: "#F8F5FF",
  borderRadius: 18,
  padding: 18,
  marginBottom: 14,
};

const productName = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#6D28D9",
  marginBottom: 6,
};

const text = {
  fontSize: 14,
  color: "#374151",
  marginBottom: 4,
};

const lowStock = {
  color: "#EF4444",
  fontWeight: "bold" as const,
  marginBottom: 12,
};

const safeStock = {
  color: "#10B981",
  fontWeight: "bold" as const,
  marginBottom: 12,
};

const input = {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};

const button = {
  backgroundColor: "#6D28D9",
  padding: 16,
  borderRadius: 15,
};

const buttonText = {
  color: "#FFFFFF",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
  fontSize: 15,
};
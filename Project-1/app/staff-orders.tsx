import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type Order = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  total_amount: number;
  created_at: string;
};

export default function StaffOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonByOrderId, setReasonByOrderId] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "staff") {
        Alert.alert("Access Denied", "Order list is for staff only.");
        router.replace("/customer");
        return;
      }

      fetchOrders();
    };

    checkAccessAndLoad();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("id,customer_name,customer_email,status,total_amount,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setOrders((data || []) as Order[]);
  };

  const requestDeletion = async (order: Order) => {
    const staffId = await AsyncStorage.getItem("userId");
    const staffName = await AsyncStorage.getItem("userName");
    const reason = reasonByOrderId[order.id]?.trim() || "Staff requested order deletion.";

    if (!staffId) {
      Alert.alert("Error", "Missing staff session. Please sign in again.");
      router.replace("/customer");
      return;
    }

    const { error } = await supabase.from("order_deletion_requests").insert({
      order_id: order.id,
      staff_id: staffId,
      staff_name: staffName || "Staff",
      reason,
      status: "pending",
    });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await supabase.from("admin_notifications").insert({
      title: "Order deletion request",
      message: `${staffName || "Staff"} requested deletion for order #${String(order.id).slice(0, 8)}.`,
      type: "order_deletion",
    });

    setReasonByOrderId((current) => ({ ...current, [order.id]: "" }));
    Alert.alert("Request Sent", "Deletion request has been sent to admin.");
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Order List</Text>
            <Text style={subtitle}>Review orders and request deletion</Text>
          </View>
          <TouchableOpacity onPress={fetchOrders} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <Text style={countText}>{loading ? "Loading..." : `${orders.length} orders`}</Text>

        {orders.map((order) => (
          <View key={order.id} style={orderCard}>
            <View style={orderHeader}>
              <View style={{ flex: 1 }}>
                <Text style={orderTitle}>Order #{String(order.id).slice(0, 8)}</Text>
                <Text style={orderMeta}>{order.customer_name || "Walk-in customer"}</Text>
                <Text style={orderMeta}>{order.customer_email || "No email"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={amount}>RM {Number(order.total_amount).toFixed(2)}</Text>
                <Text style={status}>{order.status}</Text>
              </View>
            </View>

            <TextInput
              value={reasonByOrderId[order.id] || ""}
              onChangeText={(value) =>
                setReasonByOrderId((current) => ({ ...current, [order.id]: value }))
              }
              placeholder="Reason for deletion request"
              style={input}
            />

            <TouchableOpacity onPress={() => requestDeletion(order)} style={deleteRequestButton}>
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={deleteRequestText}>Request Deletion</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!loading && orders.length === 0 && (
          <View style={emptyBox}>
            <Ionicons name="receipt-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No orders found</Text>
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
const countText = { color: "#6B7280", fontSize: 13, marginBottom: 12 };
const orderCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 14,
};
const orderHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  marginBottom: 12,
};
const orderTitle = { color: "#111827", fontWeight: "bold" as const, marginBottom: 5 };
const orderMeta = { color: "#6B7280", fontSize: 12, marginBottom: 3 };
const amount = { color: "#111827", fontWeight: "bold" as const, marginBottom: 6 };
const status = { color: "#6D28D9", fontSize: 12, fontWeight: "bold" as const };
const input = {
  backgroundColor: "#F3F4F6",
  borderRadius: 10,
  padding: 13,
  marginBottom: 10,
};
const deleteRequestButton = {
  backgroundColor: "#DC2626",
  borderRadius: 10,
  padding: 13,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};
const deleteRequestText = { color: "#FFFFFF", fontWeight: "bold" as const };
const emptyBox = { alignItems: "center" as const, paddingVertical: 60 };
const emptyTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  marginTop: 12,
  fontSize: 16,
};

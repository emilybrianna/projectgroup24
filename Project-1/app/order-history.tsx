import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Order = {
  id: string;
  customer_email: string | null;
  status: string | null;
  order_status: string | null;
  payment_status: string | null;
  total_amount: number;
  created_at: string;
};

type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const formatCurrency = (amount: number) => `RM ${Number(amount || 0).toFixed(2)}`;

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const fetchOrders = async () => {
    setLoading(true);

    const userId = await AsyncStorage.getItem("userId");
    const userEmail = await AsyncStorage.getItem("userEmail");

    if (!userId && !userEmail) {
      setLoading(false);
      Alert.alert("Session Expired", "Please sign in again.");
      router.replace("/customer");
      return;
    }

    let query = supabase
      .from("orders")
      .select("id,customer_email,status,order_status,payment_status,total_amount,created_at")
      .order("created_at", { ascending: false });

    query = userId ? query.eq("customer_id", userId) : query.eq("customer_email", userEmail);

    let notificationQuery = supabase
      .from("customer_notifications")
      .select("id,title,message,type,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    notificationQuery = userId
      ? notificationQuery.eq("customer_id", userId)
      : notificationQuery.eq("customer_email", userEmail);

    const [{ data, error }, notificationsResult] = await Promise.all([
      query,
      notificationQuery,
    ]);

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      setOrders([]);
      return;
    }

    setOrders((data || []) as Order[]);
    if (!notificationsResult.error) {
      setNotifications((notificationsResult.data || []) as CustomerNotification[]);
    }
  };

  const markNotificationRead = async (notification: CustomerNotification) => {
    if (notification.is_read) {
      return;
    }

    await supabase
      .from("customer_notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      )
    );
  };

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={title}>Order History</Text>
        <TouchableOpacity onPress={fetchOrders} style={iconButton}>
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        {notifications.length > 0 && (
          <View style={notificationPanel}>
            <View style={notificationHeader}>
              <Text style={panelTitle}>Order Updates</Text>
              <Text style={notificationCount}>
                {notifications.filter((item) => !item.is_read).length} new
              </Text>
            </View>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                onPress={() => markNotificationRead(notification)}
                style={[
                  notificationRow,
                  !notification.is_read && unreadNotificationRow,
                ]}
              >
                <Ionicons
                  name={notification.type === "order_deleted" ? "trash-outline" : "notifications-outline"}
                  size={18}
                  color="#6D28D9"
                />
                <View style={{ flex: 1 }}>
                  <Text style={notificationTitle}>{notification.title}</Text>
                  <Text style={notificationText}>{notification.message}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <View style={stateBox}>
            <ActivityIndicator color="#6D28D9" />
            <Text style={stateText}>Loading orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={stateBox}>
            <Ionicons name="receipt-outline" size={44} color="#9CA3AF" />
            <Text style={emptyTitle}>No orders yet</Text>
            <Text style={stateText}>Your paid orders will appear here.</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={orderCard}>
              <View style={orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={orderTitle}>Order #{order.id.slice(0, 8)}</Text>
                  <Text style={orderMeta}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={amount}>{formatCurrency(order.total_amount)}</Text>
                  <Text style={statusText}>
                    {(order.payment_status || "unpaid").toUpperCase()} /{" "}
                    {(order.order_status || order.status || "pending").toUpperCase()}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/receipt" as any,
                    params: { orderId: order.id },
                  })
                }
                style={receiptButton}
              >
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                <Text style={receiptButtonText}>View Receipt</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const page = { flex: 1, backgroundColor: "#F8FAFC" };
const header = {
  paddingTop: 55,
  paddingHorizontal: 20,
  paddingBottom: 16,
  backgroundColor: "#FFFFFF",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};
const iconButton = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const title = { color: "#111827", fontSize: 20, fontWeight: "bold" as const };
const container = { padding: 20, paddingBottom: 40 };
const notificationPanel = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 14,
};
const notificationHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 8,
};
const panelTitle = {
  color: "#111827",
  fontSize: 16,
  fontWeight: "bold" as const,
};
const notificationCount = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
};
const notificationRow = {
  flexDirection: "row" as const,
  gap: 10,
  paddingVertical: 10,
  borderTopWidth: 1,
  borderTopColor: "#F3F4F6",
};
const unreadNotificationRow = {
  backgroundColor: "#FAF5FF",
};
const notificationTitle = {
  color: "#111827",
  fontSize: 13,
  fontWeight: "800" as const,
};
const notificationText = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
  marginTop: 3,
};
const stateBox = {
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingVertical: 80,
};
const emptyTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  marginTop: 12,
};
const stateText = { color: "#6B7280", marginTop: 8, textAlign: "center" as const };
const orderCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 14,
};
const orderHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  marginBottom: 14,
};
const orderTitle = { color: "#111827", fontSize: 15, fontWeight: "bold" as const };
const orderMeta = { color: "#6B7280", fontSize: 12, marginTop: 5 };
const amount = { color: "#111827", fontSize: 16, fontWeight: "bold" as const };
const statusText = {
  color: "#6D28D9",
  fontSize: 11,
  fontWeight: "700" as const,
  marginTop: 5,
};
const receiptButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingVertical: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 8,
};
const receiptButtonText = { color: "#FFFFFF", fontWeight: "bold" as const };

import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

type Order = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: OrderStatus | null;
  order_status: OrderStatus | null;
  payment_status: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string | null;
  quantity: number;
  price: number;
  unit_price: number;
  line_total: number;
};

const statusFilters = ["all", "pending", "processing", "completed", "cancelled"];
const statuses: OrderStatus[] = ["pending", "processing", "completed", "cancelled"];
const formatCurrency = (amount: number) => `RM ${Number(amount || 0).toFixed(2)}`;

export default function AdminOrders() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [statusChanges, setStatusChanges] = useState<Record<string, OrderStatus>>({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("id,customer_id,customer_name,customer_email,status,order_status,payment_status,total_amount,created_at,updated_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      setOrders([]);
      return;
    }

    const loadedOrders = (data || []) as Order[];
    setOrders(loadedOrders);
    setStatusChanges(
      loadedOrders.reduce<Record<string, OrderStatus>>((nextStatuses, order) => {
        nextStatuses[order.id] = order.order_status || order.status || "pending";
        return nextStatuses;
      }, {})
    );
  }, []);

  const checkAccessAndLoad = useCallback(async () => {
    const role = await AsyncStorage.getItem("userRole");

    if (role !== "admin") {
      Alert.alert("Access Denied", "Order management is for admin only.");
      router.replace("/customer");
      return;
    }

    setCheckingAccess(false);
    fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      checkAccessAndLoad();
    }, [checkAccessAndLoad])
  );

  const filteredOrders = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return orders.filter((order) => {
      const orderStatus = (order.order_status || order.status || "pending").toLowerCase();
      const matchesStatus = selectedStatus === "all" || orderStatus === selectedStatus;
      const matchesSearch =
        !keyword ||
        order.id.toLowerCase().includes(keyword) ||
        (order.customer_name || "").toLowerCase().includes(keyword) ||
        (order.customer_email || "").toLowerCase().includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [orders, searchText, selectedStatus]);

  const stats = useMemo(() => {
    const pending = orders.filter(
      (order) => (order.order_status || order.status || "pending") === "pending"
    ).length;
    const paid = orders.filter((order) => order.payment_status === "paid").length;
    const revenue = orders
      .filter((order) => order.payment_status === "paid")
      .reduce((total, order) => total + Number(order.total_amount || 0), 0);

    return { pending, paid, revenue };
  }, [orders]);

  const fetchOrderItems = async (orderId: string) => {
    if (itemsByOrderId[orderId]) {
      setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
      return;
    }

    const { data, error } = await supabase
      .from("order_items")
      .select("id,order_id,product_name,quantity,price,unit_price,line_total")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      Alert.alert("Items Error", error.message);
      return;
    }

    setItemsByOrderId((current) => ({ ...current, [orderId]: (data || []) as OrderItem[] }));
    setExpandedOrderId(orderId);
  };

  const updateOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    setSavingOrderId(order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        status: nextStatus,
        order_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    setSavingOrderId(null);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await notifyCustomer(
      order,
      nextStatus === "cancelled" ? "Order Cancelled" : "Order Status Updated",
      `Your order #${order.id.slice(0, 8)} is now ${nextStatus}.`,
      nextStatus === "cancelled" ? "order_cancelled" : "order_update"
    );

    Alert.alert("Updated", `Order #${order.id.slice(0, 8)} is now ${nextStatus}.`);
    fetchOrders();
  };

  const saveSelectedStatus = async (order: Order) => {
    const currentStatus = order.order_status || order.status || "pending";
    const nextStatus = statusChanges[order.id] || currentStatus;

    if (nextStatus === currentStatus) {
      Alert.alert("No Changes", "Select a different status before saving.");
      return;
    }

    await updateOrderStatus(order, nextStatus);
  };

  const notifyCustomer = async (
    order: Order,
    title: string,
    message: string,
    type: string
  ) => {
    await supabase.from("customer_notifications").insert({
      customer_id: order.customer_id || null,
      customer_email: order.customer_email || null,
      order_id: order.id,
      title,
      message,
      type,
    });
  };

  if (checkingAccess) {
    return (
      <View style={loadingPage}>
        <Text style={stateText}>Checking admin access...</Text>
      </View>
    );
  }

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#6D28D9" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={title}>Order Management</Text>
          <Text style={subtitle}>Track, update, cancel, and delete orders</Text>
        </View>
        <TouchableOpacity onPress={fetchOrders} style={iconButton}>
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={statsGrid}>
          <Stat label="Orders" value={String(orders.length)} />
          <Stat label="Pending" value={String(stats.pending)} />
          <Stat label="Paid" value={String(stats.paid)} />
          <Stat label="Revenue" value={formatCurrency(stats.revenue)} />
        </View>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search order, customer, or email"
          autoCapitalize="none"
          style={searchInput}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={filterScroll}>
          {statusFilters.map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setSelectedStatus(status)}
              style={[filterChip, selectedStatus === status && activeFilterChip]}
            >
              <Text style={[filterText, selectedStatus === status && activeFilterText]}>
                {status.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={listHeader}>
          <Text style={sectionTitle}>Orders</Text>
          <Text style={countText}>{loading ? "Loading..." : `${filteredOrders.length} shown`}</Text>
        </View>

        {loading ? (
          <View style={stateBox}>
            <ActivityIndicator color="#6D28D9" />
            <Text style={stateText}>Loading orders...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={stateBox}>
            <Ionicons name="receipt-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No orders found</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const orderStatus = order.order_status || order.status || "pending";
            const selectedOrderStatus = statusChanges[order.id] || orderStatus;
            const statusChanged = selectedOrderStatus !== orderStatus;
            const saving = savingOrderId === order.id;
            const orderItems = itemsByOrderId[order.id] || [];
            const isExpanded = expandedOrderId === order.id;

            return (
              <View key={order.id} style={orderCard}>
                <View style={orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={orderTitle}>Order #{order.id.slice(0, 8)}</Text>
                    <Text style={orderMeta}>{order.customer_name || "Customer"}</Text>
                    <Text style={orderMeta}>{order.customer_email || "No email"}</Text>
                    <Text style={orderMeta}>{new Date(order.created_at).toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={amount}>{formatCurrency(order.total_amount)}</Text>
                    <Text style={statusBadge}>{order.payment_status || "unpaid"}</Text>
                    <Text style={orderStatusText}>{orderStatus}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => fetchOrderItems(order.id)} style={outlineButton}>
                  <Ionicons name="list-outline" size={17} color="#6D28D9" />
                  <Text style={outlineButtonText}>{isExpanded ? "Hide Items" : "View Items"}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={itemsBox}>
                    {orderItems.length === 0 ? (
                      <Text style={orderMeta}>No items saved for this order.</Text>
                    ) : (
                      orderItems.map((item) => (
                        <View key={item.id} style={itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={itemName}>{item.product_name || "Product"}</Text>
                            <Text style={orderMeta}>Qty {item.quantity}</Text>
                          </View>
                          <Text style={itemPrice}>
                            {formatCurrency(Number(item.line_total || item.price || item.unit_price || 0))}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                <Text style={fieldLabel}>Update Status</Text>
                <View style={statusOptions}>
                  {statuses.map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() =>
                        setStatusChanges((current) => ({ ...current, [order.id]: status }))
                      }
                      style={[
                        statusOption,
                        selectedOrderStatus === status && selectedStatusOption,
                      ]}
                    >
                      <Text
                        style={[
                          statusOptionText,
                          selectedOrderStatus === status && selectedStatusOptionText,
                        ]}
                      >
                        {formatStatus(status)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => saveSelectedStatus(order)}
                  disabled={!statusChanged || saving}
                  style={[saveStatusButton, (!statusChanged || saving) && disabledButton]}
                >
                  <Ionicons name="save-outline" size={17} color="#FFFFFF" />
                  <Text style={saveStatusText}>{saving ? "Saving..." : "Save Status"}</Text>
                </TouchableOpacity>

              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={statCard}>
      <Text style={statValue}>{value}</Text>
      <Text style={statLabel}>{label}</Text>
    </View>
  );
}

function formatStatus(status: OrderStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const page = { flex: 1, backgroundColor: "#F8FAFC" };
const loadingPage = {
  flex: 1,
  backgroundColor: "#FFFFFF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const header = {
  paddingTop: 55,
  paddingHorizontal: 20,
  paddingBottom: 16,
  backgroundColor: "#FFFFFF",
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
};
const iconButton = {
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const title = { fontSize: 21, fontWeight: "bold" as const, color: "#111827" };
const subtitle = { color: "#6B7280", fontSize: 12, marginTop: 4 };
const container = { padding: 20, paddingBottom: 42 };
const statsGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  justifyContent: "space-between" as const,
  marginBottom: 14,
};
const statCard = {
  width: "48%" as const,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 10,
};
const statValue = { color: "#111827", fontSize: 18, fontWeight: "bold" as const };
const statLabel = { color: "#6B7280", fontSize: 12, marginTop: 5 };
const searchInput = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 13,
  marginBottom: 12,
};
const filterScroll = { marginBottom: 8 };
const filterChip = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  paddingHorizontal: 13,
  paddingVertical: 9,
  marginRight: 8,
};
const activeFilterChip = { backgroundColor: "#6D28D9", borderColor: "#6D28D9" };
const filterText = { color: "#374151", fontSize: 11, fontWeight: "800" as const };
const activeFilterText = { color: "#FFFFFF" };
const listHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginTop: 10,
  marginBottom: 12,
};
const sectionTitle = { color: "#111827", fontSize: 18, fontWeight: "bold" as const };
const countText = { color: "#6B7280", fontSize: 12 };
const stateBox = { alignItems: "center" as const, paddingVertical: 70 };
const stateText = { color: "#6B7280", marginTop: 8, textAlign: "center" as const };
const emptyTitle = { color: "#111827", fontWeight: "bold" as const, fontSize: 16, marginTop: 12 };
const orderCard = {
  backgroundColor: "#FFFFFF",
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
const amount = { color: "#111827", fontWeight: "bold" as const, marginBottom: 7 };
const statusBadge = {
  color: "#059669",
  fontSize: 11,
  fontWeight: "bold" as const,
  textTransform: "uppercase" as const,
};
const orderStatusText = {
  color: "#6D28D9",
  fontSize: 11,
  fontWeight: "bold" as const,
  textTransform: "uppercase" as const,
  marginTop: 4,
};
const outlineButton = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  borderRadius: 8,
  padding: 11,
  flexDirection: "row" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 7,
};
const outlineButtonText = { color: "#6D28D9", fontWeight: "bold" as const };
const itemsBox = {
  borderWidth: 1,
  borderColor: "#F3F4F6",
  borderRadius: 8,
  padding: 10,
  marginTop: 10,
  marginBottom: 10,
};
const itemRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: "#F3F4F6",
};
const itemName = { color: "#111827", fontWeight: "700" as const, fontSize: 13 };
const itemPrice = { color: "#111827", fontWeight: "bold" as const };
const fieldLabel = {
  fontSize: 12,
  fontWeight: "bold" as const,
  color: "#374151",
  marginTop: 10,
  marginBottom: 8,
};
const statusOptions = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 7,
  marginBottom: 10,
};
const statusOption = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 10,
};
const selectedStatusOption = { borderColor: "#6D28D9", backgroundColor: "#F3E8FF" };
const statusOptionText = { fontSize: 12, color: "#6B7280", fontWeight: "600" as const };
const selectedStatusOptionText = { color: "#6D28D9" };
const saveStatusButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  minHeight: 42,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  flexDirection: "row" as const,
  gap: 6,
};
const disabledButton = { backgroundColor: "#C4B5FD" };
const saveStatusText = { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" as const };

import { signOutToLanding } from "@/lib/remember-session";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ComponentProps, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Product = {
  id: number;
  name: string;
  stock: number;
  low_stock_limit: number | null;
};

type Order = {
  id: string;
  status: string;
};

type DeletionRequest = {
  id: string;
  status: string;
};

type StaffNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const LOW_STOCK_DEFAULT = 5;

export default function StaffDashboard() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [staffName, setStaffName] = useState("Staff");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (product) => product.stock <= (product.low_stock_limit ?? LOW_STOCK_DEFAULT)
      ),
    [products]
  );

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");
      const name = await AsyncStorage.getItem("userName");
      const userId = await AsyncStorage.getItem("userId");

      if (role !== "staff" || !userId) {
        Alert.alert("Access Denied", "Staff dashboard is for staff only.");
        router.replace("/customer");
        return;
      }

      if (name) {
        setStaffName(name);
      }

      setCheckingAccess(false);
      loadDashboardData(userId);
    };

    checkAccessAndLoad();
  }, []);

  const loadDashboardData = async (staffId: string) => {
    const [productsResult, ordersResult, requestsResult, notificationsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,stock,low_stock_limit")
        .order("stock", { ascending: true }),
      supabase.from("orders").select("id,status"),
      supabase.from("order_deletion_requests").select("id,status"),
      supabase
        .from("staff_notifications")
        .select("id,title,message,type,is_read,created_at")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (productsResult.error) {
      Alert.alert("Products Error", productsResult.error.message);
    } else {
      setProducts((productsResult.data || []) as Product[]);
    }

    if (!ordersResult.error) {
      setOrders((ordersResult.data || []) as Order[]);
    }

    if (!requestsResult.error) {
      setRequests((requestsResult.data || []) as DeletionRequest[]);
    }

    if (!notificationsResult.error) {
      setNotifications((notificationsResult.data || []) as StaffNotification[]);
    }
  };

  const markNotificationRead = async (notification: StaffNotification) => {
    if (notification.is_read) {
      return;
    }

    await supabase
      .from("staff_notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item
      )
    );
  };

  const handleSignOut = async () => {
    await signOutToLanding();
    router.replace("/");
  };

  if (checkingAccess) {
    return (
      <View style={loadingPage}>
        <Text style={loadingText}>Checking staff access...</Text>
      </View>
    );
  }

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <View style={{ flex: 1 }}>
            <Text style={welcome}>Welcome Back, {staffName}!</Text>
            <Text style={subtitle}>SmartFash staff dashboard</Text>
          </View>

          <TouchableOpacity onPress={handleSignOut} style={signOutButton}>
            <Ionicons name="log-out-outline" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {lowStockProducts.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/staff-products")}
            style={alertBox}
          >
            <View style={alertIcon}>
              <Ionicons name="warning-outline" size={22} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={alertTitle}>Low stock alert</Text>
              <Text style={alertText}>
                {lowStockProducts.length} item(s) need restocking.
              </Text>
            </View>
            <View style={badge}>
              <Text style={badgeText}>{lowStockProducts.length}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={statsGrid}>
          <StatCard
            icon="receipt-outline"
            label="Total Orders"
            value={String(orders.length)}
          />
          <StatCard
            icon="time-outline"
            label="Pending"
            value={String(
              orders.filter((order) => order.status.toLowerCase() === "pending").length
            )}
          />
          <StatCard
            icon="cube-outline"
            label="Products"
            value={String(products.length)}
          />
          <StatCard
            icon="trash-outline"
            label="Requests"
            value={String(requests.length)}
          />
        </View>

        {notifications.length > 0 && (
          <View style={notificationPanel}>
            <View style={panelHeader}>
              <Text style={panelTitle}>Admin Notifications</Text>
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
                <View style={notificationIcon}>
                  <Ionicons
                    name={
                      notification.type === "order_deletion"
                        ? "trash-outline"
                        : "cube-outline"
                    }
                    size={18}
                    color="#6D28D9"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={notificationTitle}>{notification.title}</Text>
                  <Text style={notificationText}>{notification.message}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={sectionTitle}>Staff Tasks</Text>
        <View style={menuGrid}>
          <MenuButton
            icon="bar-chart-outline"
            label="Order Summary"
            onPress={() => router.push("/staff-summary")}
          />
          <MenuButton
            icon="list-outline"
            label="View Orders"
            onPress={() => router.push("/staff-orders")}
          />
          <MenuButton
            icon="document-text-outline"
            label="Track Requests"
            onPress={() => router.push("/staff-deletionRequest")}
          />
          <MenuButton
            icon="cube-outline"
            label="View Products"
            onPress={() => router.push("/staff-products")}
          />
        </View>

        <View style={panel}>
          <Text style={panelTitle}>Low Stock Items</Text>
          {lowStockProducts.slice(0, 5).map((product) => (
            <View key={product.id} style={stockRow}>
              <Text style={stockName}>{product.name}</Text>
              <Text style={stockValue}>{product.stock} left</Text>
            </View>
          ))}
          {lowStockProducts.length === 0 && (
            <Text style={emptyText}>All products are above the low stock threshold.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={statCard}>
      <Ionicons name={icon} size={22} color="#6D28D9" />
      <Text style={statValue}>{value}</Text>
      <Text style={statLabel}>{label}</Text>
    </View>
  );
}

function MenuButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={menuButton}>
      <View style={menuIcon}>
        <Ionicons name={icon} size={24} color="#6D28D9" />
      </View>
      <Text style={menuLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const page = { flex: 1, backgroundColor: "#F8FAFC" };
const loadingPage = {
  flex: 1,
  backgroundColor: "#FFFFFF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};
const loadingText = { color: "#6D28D9", fontWeight: "bold" as const };
const container = { padding: 20, paddingTop: 54, paddingBottom: 36 };
const header = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 18,
};
const welcome = { fontSize: 24, color: "#111827", fontWeight: "bold" as const };
const subtitle = { marginTop: 4, color: "#6B7280", fontSize: 14 };
const signOutButton = {
  width: 44,
  height: 44,
  borderRadius: 10,
  backgroundColor: "#6D28D9",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const alertBox = {
  borderWidth: 1,
  borderColor: "#FCD34D",
  backgroundColor: "#FFFBEB",
  borderRadius: 8,
  padding: 14,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 16,
};
const alertIcon = {
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: "#FEF3C7",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const alertTitle = { color: "#92400E", fontWeight: "bold" as const, fontSize: 15 };
const alertText = { color: "#B45309", fontSize: 12, marginTop: 3 };
const badge = {
  minWidth: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "#DC2626",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 8,
};
const badgeText = { color: "#FFFFFF", fontWeight: "bold" as const, fontSize: 12 };
const statsGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  justifyContent: "space-between" as const,
};
const statCard = {
  width: "48%" as const,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};
const statValue = {
  marginTop: 10,
  color: "#111827",
  fontSize: 24,
  fontWeight: "bold" as const,
};
const statLabel = { marginTop: 4, color: "#6B7280", fontSize: 13 };
const notificationPanel = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 14,
};
const panelHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 10,
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
const notificationIcon = {
  width: 34,
  height: 34,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
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
const sectionTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  marginTop: 10,
  marginBottom: 12,
};
const menuGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  justifyContent: "space-between" as const,
};
const menuButton = {
  width: "48%" as const,
  minHeight: 118,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};
const menuIcon = {
  width: 42,
  height: 42,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 12,
};
const menuLabel = { color: "#111827", fontSize: 15, fontWeight: "bold" as const };
const panel = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginTop: 6,
};
const panelTitle = {
  color: "#111827",
  fontSize: 16,
  fontWeight: "bold" as const,
  marginBottom: 10,
};
const stockRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  borderTopWidth: 1,
  borderTopColor: "#F3F4F6",
  paddingVertical: 11,
};
const stockName = { color: "#111827", flex: 1, marginRight: 12 };
const stockValue = { color: "#DC2626", fontWeight: "bold" as const };
const emptyText = { color: "#6B7280", fontSize: 13, lineHeight: 19 };

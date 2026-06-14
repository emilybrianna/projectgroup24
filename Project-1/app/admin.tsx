import { signOutToLanding } from "@/lib/remember-session";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ComponentProps, Fragment, useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

type IconName = ComponentProps<typeof Ionicons>["name"];

type DashboardStats = {
  products: number;
  lowStock: number;
  users: number;
  orders: number;
  pendingOrders: number;
  revenue: number;
  monthlyProducts: number;
  monthlyUsers: number;
  monthlyOrders: number;
  monthlyRevenue: number;
  currentMonthLabel: string;
  pendingPayments: number;
  pendingProductRequests: number;
  pendingDeletionRequests: number;
  monthlySeries: MonthlyPoint[];
};

type MonthlyPoint = {
  label: string;
  monthKey: string;
  orders: number;
  revenue: number;
};

type MenuItemProps = {
  label: string;
  description: string;
  icon: IconName;
  onPress: () => void;
};

const menuItems: MenuItemProps[] = [
  {
    label: "Products",
    description: "Add, edit, delete, and review product stock.",
    icon: "cube-outline",
    onPress: () => router.push("/admin-products"),
  },
  {
    label: "Categories",
    description: "Organize products under Men, Women, Kids, and more.",
    icon: "folder-open-outline",
    onPress: () => router.push("/admin-categories"),
  },
  {
    label: "Users",
    description: "Manage customers, staff, and admin accounts.",
    icon: "people-outline",
    onPress: () => router.push("/admin-users"),
  },
  {
    label: "Orders",
    description: "Track, cancel, delete, and update order status.",
    icon: "receipt-outline",
    onPress: () => router.push("/admin-orders"),
  },
  {
    label: "Payments",
    description: "Verify transactions and payment status.",
    icon: "card-outline",
    onPress: () => router.push("/admin-payments"),
  },
  {
    label: "Chat",
    description: "Reply to customer questions about products or orders.",
    icon: "chatbubble-ellipses-outline",
    onPress: () => router.push("/admin-chat"),
  },
  {
    label: "Notifications",
    description: "Send important updates or promotions to customers.",
    icon: "notifications-outline",
    onPress: () => router.push("/admin-notifications"),
  },
  {
    label: "Deletion Requests",
    description: "Approve or reject staff order deletion requests.",
    icon: "trash-outline",
    onPress: () => router.push("/admin-deletion-requests"),
  },
];

export default function AdminDashboard() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    lowStock: 0,
    users: 0,
    orders: 0,
    pendingOrders: 0,
    revenue: 0,
    monthlyProducts: 0,
    monthlyUsers: 0,
    monthlyOrders: 0,
    monthlyRevenue: 0,
    currentMonthLabel: new Date().toLocaleString("en", { month: "long", year: "numeric" }),
    pendingPayments: 0,
    pendingProductRequests: 0,
    pendingDeletionRequests: 0,
    monthlySeries: [],
  });

  const fetchTableCount = useCallback(async (table: string, column = "id") => {
    const { count, error } = await supabase
      .from(table)
      .select(column, { count: "exact", head: true });

    return error ? 0 : count || 0;
  }, []);

  const fetchDashboardData = useCallback(async () => {
    const now = new Date();
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const currentMonthLabel = now.toLocaleString("en", { month: "long", year: "numeric" });
    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);

      return {
        label: date.toLocaleString("en", { month: "short" }),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        orders: 0,
        revenue: 0,
      };
    });

    const [
      productsResult,
      usersResult,
      ordersResult,
      monthlyProductsResult,
      monthlyUsersResult,
      monthlyOrdersResult,
      pendingOrdersResult,
      pendingPaymentsResult,
      paidPaymentsResult,
      monthlyPaidPaymentsResult,
      seriesOrdersResult,
      seriesPaymentsResult,
      productRequestsResult,
      deletionRequestsResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id,stock,low_stock_limit")
        .neq("is_active", false),
      fetchTableCount("users"),
      fetchTableCount("orders"),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart)
        .neq("is_active", false),
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .or("status.eq.pending,order_status.eq.pending"),
      supabase
        .from("mock_payments")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "pending"),
      supabase
        .from("mock_payments")
        .select("amount,created_at")
        .eq("payment_status", "paid"),
      supabase
        .from("mock_payments")
        .select("amount,created_at")
        .eq("payment_status", "paid")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonthStart),
      supabase
        .from("orders")
        .select("id,created_at")
        .gte("created_at", seriesStart.toISOString()),
      supabase
        .from("mock_payments")
        .select("amount,created_at")
        .eq("payment_status", "paid")
        .gte("created_at", seriesStart.toISOString()),
      supabase
        .from("product_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("order_deletion_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const products = productsResult.error ? [] : productsResult.data || [];
    const lowStock = products.filter(
      (product) => Number(product.stock) <= Number(product.low_stock_limit)
    ).length;
    const revenue = paidPaymentsResult.error
      ? 0
      : (paidPaymentsResult.data || []).reduce(
          (total, payment) => total + Number(payment.amount || 0),
          0
        );
    const monthlyRevenue = monthlyPaidPaymentsResult.error
      ? 0
      : (monthlyPaidPaymentsResult.data || []).reduce(
          (total, payment) => total + Number(payment.amount || 0),
          0
        );
    const monthlySeries = monthBuckets.map((bucket) => ({ ...bucket }));

    if (!seriesOrdersResult.error) {
      for (const order of seriesOrdersResult.data || []) {
        const date = new Date(order.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const bucket = monthlySeries.find((item) => item.monthKey === key);

        if (bucket) {
          bucket.orders += 1;
        }
      }
    }

    if (!seriesPaymentsResult.error) {
      for (const payment of seriesPaymentsResult.data || []) {
        const date = new Date(payment.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const bucket = monthlySeries.find((item) => item.monthKey === key);

        if (bucket) {
          bucket.revenue += Number(payment.amount || 0);
        }
      }
    }

    setStats({
      products: products.length,
      lowStock,
      users: usersResult,
      orders: ordersResult,
      pendingOrders: pendingOrdersResult.error ? 0 : pendingOrdersResult.count || 0,
      revenue,
      monthlyProducts: monthlyProductsResult.error ? 0 : monthlyProductsResult.count || 0,
      monthlyUsers: monthlyUsersResult.error ? 0 : monthlyUsersResult.count || 0,
      monthlyOrders: monthlyOrdersResult.error ? 0 : monthlyOrdersResult.count || 0,
      monthlyRevenue,
      currentMonthLabel,
      pendingPayments: pendingPaymentsResult.error ? 0 : pendingPaymentsResult.count || 0,
      pendingProductRequests: productRequestsResult.error ? 0 : productRequestsResult.count || 0,
      pendingDeletionRequests: deletionRequestsResult.error ? 0 : deletionRequestsResult.count || 0,
      monthlySeries,
    });
  }, [fetchTableCount]);

  useEffect(() => {
    const checkAdminAccess = async () => {
      const role = await AsyncStorage.getItem("userRole");
      const name = await AsyncStorage.getItem("userName");
      const userId = await AsyncStorage.getItem("userId");

      if (role !== "admin" || !userId) {
        Alert.alert("Access Denied", "Admin dashboard is for admin only.");
        router.replace("/customer");
        return;
      }

      if (name) {
        setAdminName(name);
      }

      setCheckingAccess(false);
      fetchDashboardData();
    };

    checkAdminAccess();
  }, [fetchDashboardData]);

  const handleSignOut = async () => {
    await signOutToLanding();

    router.replace("/");
  };

  if (checkingAccess) {
    return (
      <View style={loadingPage}>
        <Text style={loadingText}>Checking admin access...</Text>
      </View>
    );
  }

  return (
    <View style={page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={container}
      >
        <View style={header}>
          <View>
            <Text style={welcome}>Welcome Back, {adminName}!</Text>
            <Text style={subtitle}>SmartFash admin control center</Text>
          </View>

          <TouchableOpacity onPress={handleSignOut} style={signOutButton}>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={hero}>
          <View style={heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={30} color="#6D28D9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={heroTitle}>Admin Dashboard</Text>
            <Text style={heroText}>
              Manage products, users, orders, payments, and requests from one
              place.
            </Text>
          </View>
        </View>

        <DashboardGraph stats={stats} />

        <ApprovalSummary stats={stats} />

        <Text style={sectionTitle}>Management</Text>
        <View style={menuGrid}>
          {menuItems.map((item) => (
            <MenuItem key={item.label} {...item} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function DashboardGraph({ stats }: { stats: DashboardStats }) {
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    stats.monthlySeries[stats.monthlySeries.length - 1]?.monthKey || ""
  );
  const series = stats.monthlySeries.length > 0 ? stats.monthlySeries : [
    { label: "Now", monthKey: "now", orders: 0, revenue: 0 },
  ];
  const activeMonth =
    series.find((item) => item.monthKey === selectedMonthKey) ||
    series[series.length - 1];
  const chartWidth = 280;
  const chartHeight = 150;
  const paddingX = 22;
  const paddingY = 18;
  const maxOrders = Math.max(...series.map((item) => item.orders), 1);
  const maxRevenue = Math.max(...series.map((item) => item.revenue), 1);
  const getX = (index: number) =>
    paddingX + (index * (chartWidth - paddingX * 2)) / Math.max(series.length - 1, 1);
  const getY = (value: number, maxValue: number) =>
    chartHeight - paddingY - (value / maxValue) * (chartHeight - paddingY * 2);
  const orderPoints = series
    .map((item, index) => `${getX(index)},${getY(item.orders, maxOrders)}`)
    .join(" ");
  const revenuePoints = series
    .map((item, index) => `${getX(index)},${getY(item.revenue, maxRevenue)}`)
    .join(" ");

  return (
    <View style={graphCard}>
      <View style={graphHeader}>
        <View style={{ flex: 1 }}>
          <Text style={graphTitle}>Orders & Revenue Trend</Text>
          <Text style={graphSubtitle}>Last 6 months performance with month filter.</Text>
        </View>
      </View>

      <View style={statRow}>
        <SmallStat label="Products" value={String(stats.products)} />
        <SmallStat label="Users" value={String(stats.users)} />
        <SmallStat label="Selected Orders" value={String(activeMonth.orders)} />
        <SmallStat label="Selected Revenue" value={`RM ${Math.round(activeMonth.revenue)}`} />
      </View>

      <View style={monthFilterRow}>
        {series.map((item) => (
          <TouchableOpacity
            key={item.monthKey}
            onPress={() => setSelectedMonthKey(item.monthKey)}
            style={[monthChip, activeMonth.monthKey === item.monthKey && activeMonthChip]}
          >
            <Text style={[monthChipText, activeMonth.monthKey === item.monthKey && activeMonthChipText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={lineChartWrap}>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {[0, 1, 2].map((line) => {
            const y = paddingY + line * ((chartHeight - paddingY * 2) / 2);

            return (
              <Line
                key={line}
                x1={paddingX}
                x2={chartWidth - paddingX}
                y1={y}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}
          <Polyline points={revenuePoints} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={orderPoints} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {series.map((item, index) => {
            const x = getX(index);
            const isActive = item.monthKey === activeMonth.monthKey;

            return (
              <Fragment key={item.monthKey}>
                <Circle cx={x} cy={getY(item.revenue, maxRevenue)} r={isActive ? 5 : 3.5} fill="#10B981" />
                <Circle cx={x} cy={getY(item.orders, maxOrders)} r={isActive ? 5 : 3.5} fill="#2563EB" />
                <SvgText x={x} y={chartHeight - 2} fontSize="9" fill="#6B7280" textAnchor="middle">
                  {item.label}
                </SvgText>
              </Fragment>
            );
          })}
        </Svg>
      </View>

      <View style={graphFooter}>
        <LegendDot color="#2563EB" label="Orders" />
        <LegendDot color="#10B981" label="Revenue" />
        <View style={footerPill}>
          <Text style={footerPillText}>Total revenue RM {Math.round(stats.revenue)}</Text>
        </View>
      </View>
    </View>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={smallStatCard}>
      <Text style={smallStatValue}>{value}</Text>
      <Text style={smallStatLabel}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={legendItem}>
      <View style={[legendDot, { backgroundColor: color }]} />
      <Text style={legendText}>{label}</Text>
    </View>
  );
}

function ApprovalSummary({ stats }: { stats: DashboardStats }) {
  return (
    <View style={approvalBox}>
      <ApprovalItem
        icon="cube-outline"
        label="Product Requests"
        value={`${stats.pendingProductRequests} pending`}
        onPress={() => router.push("/admin-products")}
      />
      <ApprovalItem
        icon="trash-outline"
        label="Deletion Requests"
        value={`${stats.pendingDeletionRequests} pending`}
        onPress={() => router.push("/admin-deletion-requests")}
      />
      <ApprovalItem
        icon="card-outline"
        label="Payments"
        value={`${stats.pendingPayments} pending`}
        onPress={() => router.push("/admin-payments")}
      />
      <ApprovalItem
        icon="receipt-outline"
        label="Orders"
        value={`${stats.pendingOrders} pending`}
        onPress={() => router.push("/admin-orders")}
      />
    </View>
  );
}

function ApprovalItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={approvalItem}>
      <View style={approvalIcon}>
        <Ionicons name={icon} size={18} color="#6D28D9" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={approvalLabel}>{label}</Text>
        <Text style={approvalValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MenuItem({ label, description, icon, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity onPress={onPress} style={menuCard}>
      <View style={menuIcon}>
        <Ionicons name={icon} size={24} color="#6D28D9" />
      </View>
      <Text style={menuTitle}>{label}</Text>
      <Text style={menuDescription}>{description}</Text>
    </TouchableOpacity>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#F8FAFC",
};

const container = {
  padding: 20,
  paddingTop: 54,
  paddingBottom: 36,
};

const loadingPage = {
  flex: 1,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  backgroundColor: "#FFFFFF",
};

const loadingText = {
  color: "#6D28D9",
  fontWeight: "bold" as const,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 18,
};

const welcome = {
  fontSize: 24,
  color: "#111827",
  fontWeight: "bold" as const,
};

const subtitle = {
  marginTop: 4,
  color: "#6B7280",
  fontSize: 14,
};

const signOutButton = {
  width: 44,
  height: 44,
  borderRadius: 10,
  backgroundColor: "#6D28D9",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const hero = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 18,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  marginBottom: 18,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const heroIcon = {
  width: 54,
  height: 54,
  borderRadius: 8,
  backgroundColor: "#EDE9FE",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginRight: 14,
};

const heroTitle = {
  fontSize: 22,
  color: "#111827",
  fontWeight: "bold" as const,
};

const heroText = {
  marginTop: 6,
  color: "#6B7280",
  lineHeight: 20,
};

const graphCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 7,
  elevation: 2,
};

const graphHeader = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  justifyContent: "space-between" as const,
  gap: 12,
};

const graphTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
};

const graphSubtitle = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
  marginTop: 4,
};

const statRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
  marginTop: 14,
};

const smallStatCard = {
  width: "48%" as const,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  backgroundColor: "#F9FAFB",
  borderRadius: 8,
  padding: 10,
};

const smallStatValue = {
  color: "#111827",
  fontSize: 17,
  fontWeight: "bold" as const,
};

const smallStatLabel = {
  color: "#6B7280",
  fontSize: 11,
  marginTop: 3,
};

const monthFilterRow = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
  marginTop: 14,
};

const monthChip = {
  backgroundColor: "#F3F4F6",
  borderRadius: 999,
  paddingHorizontal: 11,
  paddingVertical: 7,
};

const activeMonthChip = {
  backgroundColor: "#111827",
};

const monthChipText = {
  color: "#6B7280",
  fontSize: 11,
  fontWeight: "700" as const,
};

const activeMonthChipText = {
  color: "#FFFFFF",
};

const lineChartWrap = {
  height: 160,
  marginTop: 14,
  backgroundColor: "#FFFFFF",
};

const graphFooter = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  alignItems: "center" as const,
  gap: 8,
  marginTop: 12,
};

const legendItem = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  backgroundColor: "#F3F4F6",
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 7,
};

const legendDot = {
  width: 8,
  height: 8,
  borderRadius: 4,
};

const legendText = {
  color: "#374151",
  fontSize: 11,
  fontWeight: "700" as const,
};

const footerPill = {
  backgroundColor: "#F3F4F6",
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 7,
};

const footerPillText = {
  color: "#374151",
  fontSize: 11,
  fontWeight: "700" as const,
};

const approvalBox = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 12,
  marginBottom: 14,
};

const approvalItem = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  paddingVertical: 11,
  borderBottomWidth: 1,
  borderBottomColor: "#F3F4F6",
};

const approvalIcon = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginRight: 10,
};

const approvalLabel = {
  color: "#111827",
  fontSize: 13,
  fontWeight: "700" as const,
};

const approvalValue = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
  marginTop: 3,
};

const sectionTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  marginTop: 12,
  marginBottom: 12,
};

const menuGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  justifyContent: "space-between" as const,
};

const menuCard = {
  width: "48%" as const,
  minHeight: 142,
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
  backgroundColor: "#EDE9FE",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 12,
};

const menuTitle = {
  color: "#111827",
  fontSize: 16,
  fontWeight: "bold" as const,
};

const menuDescription = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
  marginTop: 6,
};

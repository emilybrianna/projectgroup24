import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type Range = "daily" | "weekly" | "monthly";

type Order = {
  id: string;
  customer_name: string | null;
  status: string;
  total_amount: number;
  created_at: string;
};

const rangeLabels: Record<Range, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const escapeHtml = (value: string | number | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function StaffSummary() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>("daily");

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "staff") {
        Alert.alert("Access Denied", "Order summary is for staff only.");
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
      .select("id,customer_name,status,total_amount,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setOrders((data || []) as Order[]);
  };

  const filteredOrders = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      range === "daily"
        ? 24 * 60 * 60 * 1000
        : range === "weekly"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

    return orders.filter(
      (order) => now - new Date(order.created_at).getTime() <= rangeMs
    );
  }, [orders, range]);

  const completedOrders = filteredOrders.filter(
    (order) => order.status.toLowerCase() === "completed"
  );
  const pendingOrders = filteredOrders.filter(
    (order) => order.status.toLowerCase() === "pending"
  );
  const salesTotal = filteredOrders.reduce(
    (total, order) => total + Number(order.total_amount || 0),
    0
  );

  const exportReport = async () => {
    try {
      const generatedAt = new Date();
      const fileName = `SmartFash-${rangeLabels[range]}-Order-Report-${generatedAt
        .toISOString()
        .slice(0, 10)}.pdf`;
      const rowsHtml = filteredOrders
        .map(
          (order) => `
            <tr>
              <td>#${escapeHtml(String(order.id).slice(0, 8))}</td>
              <td>${escapeHtml(order.customer_name || "Walk-in customer")}</td>
              <td>${escapeHtml(order.status)}</td>
              <td>RM ${Number(order.total_amount || 0).toFixed(2)}</td>
              <td>${escapeHtml(new Date(order.created_at).toLocaleDateString())}</td>
            </tr>
          `
        )
        .join("");
      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
              h1 { margin: 0 0 4px; font-size: 26px; }
              .muted { color: #6B7280; font-size: 13px; margin-bottom: 22px; }
              .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
              .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
              .value { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
              .label { color: #6B7280; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th { background: #6D28D9; color: white; text-align: left; padding: 10px; }
              td { border-bottom: 1px solid #E5E7EB; padding: 10px; }
              .empty { color: #6B7280; padding: 18px 0; }
            </style>
          </head>
          <body>
            <h1>SmartFash Order Summary</h1>
            <div class="muted">
              ${escapeHtml(rangeLabels[range])} report generated on ${escapeHtml(
                generatedAt.toLocaleString()
              )}
            </div>
            <div class="stats">
              <div class="card"><div class="value">${filteredOrders.length}</div><div class="label">Total Orders</div></div>
              <div class="card"><div class="value">${completedOrders.length}</div><div class="label">Completed</div></div>
              <div class="card"><div class="value">${pendingOrders.length}</div><div class="label">Pending</div></div>
              <div class="card"><div class="value">RM ${salesTotal.toFixed(2)}</div><div class="label">Sales</div></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rowsHtml ||
                  '<tr><td colspan="5" class="empty">No orders in this range.</td></tr>'
                }
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const targetUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({ from: uri, to: targetUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or share order report",
          UTI: "com.adobe.pdf",
        });
        return;
      }

      Alert.alert("PDF Generated", `Saved to ${targetUri}`);
    } catch (error) {
      Alert.alert(
        "Export Failed",
        error instanceof Error ? error.message : "Unable to generate PDF report."
      );
    }
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Order Summary</Text>
            <Text style={subtitle}>Monitor order volume and sales</Text>
          </View>
          <TouchableOpacity onPress={fetchOrders} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={filterRow}>
          {(["daily", "weekly", "monthly"] as Range[]).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setRange(item)}
              style={[filterButton, range === item && activeFilterButton]}
            >
              <Text style={[filterText, range === item && activeFilterText]}>
                {rangeLabels[item]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={statsGrid}>
          <SummaryCard label="Total Orders" value={String(filteredOrders.length)} />
          <SummaryCard label="Completed" value={String(completedOrders.length)} />
          <SummaryCard label="Pending" value={String(pendingOrders.length)} />
          <SummaryCard label="Sales" value={`RM ${salesTotal.toFixed(2)}`} />
        </View>

        <TouchableOpacity onPress={exportReport} style={exportButton}>
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={exportText}>Download PDF</Text>
        </TouchableOpacity>

        <Text style={sectionTitle}>
          {loading ? "Loading orders..." : `${rangeLabels[range]} Orders`}
        </Text>

        {filteredOrders.map((order) => (
          <View key={order.id} style={orderCard}>
            <View>
              <Text style={orderTitle}>Order #{String(order.id).slice(0, 8)}</Text>
              <Text style={orderMeta}>{order.customer_name || "Walk-in customer"}</Text>
              <Text style={orderMeta}>
                {new Date(order.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={amount}>RM {Number(order.total_amount).toFixed(2)}</Text>
              <Text style={status}>{order.status}</Text>
            </View>
          </View>
        ))}

        {!loading && filteredOrders.length === 0 && (
          <View style={emptyBox}>
            <Ionicons name="receipt-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No orders in this range</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryCard}>
      <Text style={summaryValue}>{value}</Text>
      <Text style={summaryLabel}>{label}</Text>
    </View>
  );
}

const page = { flex: 1, backgroundColor: "#FFFFFF" };
const container = { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 40 };
const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 18,
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
const filterRow = { flexDirection: "row" as const, gap: 10, marginBottom: 16 };
const filterButton = {
  flex: 1,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 10,
  paddingVertical: 11,
  alignItems: "center" as const,
};
const activeFilterButton = { borderColor: "#6D28D9", backgroundColor: "#F3E8FF" };
const filterText = { color: "#6B7280", fontWeight: "bold" as const, fontSize: 12 };
const activeFilterText = { color: "#6D28D9" };
const statsGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  justifyContent: "space-between" as const,
};
const summaryCard = {
  width: "48%" as const,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};
const summaryValue = { color: "#111827", fontSize: 22, fontWeight: "bold" as const };
const summaryLabel = { color: "#6B7280", marginTop: 5, fontSize: 13 };
const exportButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 10,
  padding: 15,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
  marginBottom: 18,
};
const exportText = { color: "#FFFFFF", fontWeight: "bold" as const };
const sectionTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  marginBottom: 12,
};
const orderCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
};
const orderTitle = { color: "#111827", fontWeight: "bold" as const, marginBottom: 5 };
const orderMeta = { color: "#6B7280", fontSize: 12, marginBottom: 3 };
const amount = { color: "#111827", fontWeight: "bold" as const, marginBottom: 6 };
const status = { color: "#6D28D9", fontSize: 12, fontWeight: "bold" as const };
const emptyBox = { alignItems: "center" as const, paddingVertical: 60 };
const emptyTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  marginTop: 12,
  fontSize: 16,
};

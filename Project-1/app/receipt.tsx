import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
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
  customer_name: string | null;
  customer_email: string | null;
  status: string | null;
  order_status: string | null;
  payment_status: string | null;
  total_amount: number;
  created_at: string;
};

type OrderItem = {
  id: string;
  product_name: string | null;
  quantity: number;
  price: number | null;
  unit_price: number | null;
  line_total: number | null;
};

type Payment = {
  id: string;
  transaction_reference: string | null;
  payment_status: string | null;
  amount: number;
  created_at: string;
};

const formatCurrency = (amount: number) => `RM ${Number(amount || 0).toFixed(2)}`;

export default function Receipt() {
  const { orderId, transactionReference, total } = useLocalSearchParams<{
    orderId?: string;
    transactionReference?: string;
    total?: string;
  }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const fetchReceipt = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [orderResult, itemResult, paymentResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,customer_name,customer_email,status,order_status,payment_status,total_amount,created_at")
        .eq("id", orderId)
        .maybeSingle<Order>(),
      supabase
        .from("order_items")
        .select("id,product_name,quantity,price,unit_price,line_total")
        .eq("order_id", orderId),
      supabase
        .from("mock_payments")
        .select("id,transaction_reference,payment_status,amount,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<Payment>(),
    ]);

    setLoading(false);

    if (orderResult.error) {
      Alert.alert("Error", orderResult.error.message);
      return;
    }

    if (itemResult.error) {
      Alert.alert("Error", itemResult.error.message);
      return;
    }

    if (paymentResult.error) {
      Alert.alert("Error", paymentResult.error.message);
      return;
    }

    setOrder(orderResult.data);
    setItems((itemResult.data || []) as OrderItem[]);
    setPayment(paymentResult.data);
  }, [orderId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const downloadReceipt = async () => {
    setPrinting(true);

    try {
      const receiptHtml = buildReceiptHtml({
        order,
        items,
        payment,
        fallbackTransactionReference: transactionReference,
        fallbackTotal: total,
      });
      const { uri } = await Print.printToFileAsync({ html: receiptHtml });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or share receipt",
        });
      } else {
        Alert.alert("Receipt Ready", `Receipt PDF created at ${uri}`);
      }
    } catch (error) {
      Alert.alert(
        "Receipt Error",
        error instanceof Error ? error.message : "Could not create receipt."
      );
    } finally {
      setPrinting(false);
    }
  };

  const shownTransactionReference =
    payment?.transaction_reference || transactionReference || "-";
  const shownPaymentStatus =
    payment?.payment_status || order?.payment_status || "paid";
  const shownOrderStatus = order?.order_status || order?.status || "pending";
  const shownTotal = order?.total_amount ?? Number(total || 0);
  const isSuccess = shownPaymentStatus.toLowerCase() === "paid";

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={headerTitle}>Receipt</Text>
        <TouchableOpacity
          onPress={downloadReceipt}
          disabled={printing || loading}
          style={iconButton}
        >
          <Ionicons name="download-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={stateBox}>
            <ActivityIndicator color="#6D28D9" />
            <Text style={stateText}>Loading receipt...</Text>
          </View>
        ) : (
          <View style={receiptBox}>
            <View style={[successIcon, !isSuccess && failedIcon]}>
              <Ionicons
                name={isSuccess ? "checkmark" : "close"}
                size={38}
                color="#FFFFFF"
              />
            </View>

            <Text style={title}>
              {isSuccess ? "Payment Successful" : "Payment Not Confirmed"}
            </Text>
            <Text style={subtitle}>
              {isSuccess
                ? "Your order is paid and pending staff review."
                : "This order is waiting for payment confirmation."}
            </Text>

            <View style={detailBox}>
              <ReceiptRow label="Order ID" value={orderId ? `#${orderId.slice(0, 8)}` : "-"} />
              <ReceiptRow label="Transaction Ref" value={shownTransactionReference} />
              <ReceiptRow label="Payment Status" value={shownPaymentStatus.toUpperCase()} />
              <ReceiptRow label="Order Status" value={shownOrderStatus.toUpperCase()} />
              <ReceiptRow label="Date" value={order ? new Date(order.created_at).toLocaleString() : "-"} />
            </View>

            <Text style={sectionTitle}>Items</Text>
            {items.length === 0 ? (
              <Text style={stateText}>No item details found.</Text>
            ) : (
              items.map((item) => {
                const unitPrice = Number(item.price ?? item.unit_price ?? 0);
                const lineTotal = Number(item.line_total ?? unitPrice * item.quantity);

                return (
                  <View key={item.id} style={itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={itemName}>{item.product_name || "Product"}</Text>
                      <Text style={itemMeta}>
                        Qty {item.quantity} x {formatCurrency(unitPrice)}
                      </Text>
                    </View>
                    <Text style={itemTotal}>{formatCurrency(lineTotal)}</Text>
                  </View>
                );
              })
            )}

            <View style={totalRow}>
              <Text style={totalLabel}>Total Paid</Text>
              <Text style={totalValue}>{formatCurrency(shownTotal)}</Text>
            </View>

            <TouchableOpacity
              onPress={downloadReceipt}
              disabled={printing}
              style={primaryButton}
            >
              {printing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                  <Text style={primaryButtonText}>Download / Print Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={row}>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue}>{value}</Text>
    </View>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReceiptHtml({
  order,
  items,
  payment,
  fallbackTransactionReference,
  fallbackTotal,
}: {
  order: Order | null;
  items: OrderItem[];
  payment: Payment | null;
  fallbackTransactionReference?: string;
  fallbackTotal?: string;
}) {
  const totalAmount = order?.total_amount ?? Number(fallbackTotal || 0);
  const rows = items
    .map((item) => {
      const unitPrice = Number(item.price ?? item.unit_price ?? 0);
      const lineTotal = Number(item.line_total ?? unitPrice * item.quantity);

      return `
        <tr>
          <td>${escapeHtml(item.product_name || "Product")}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(unitPrice)}</td>
          <td>${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
          h1 { margin-bottom: 4px; }
          .muted { color: #6B7280; }
          .box { border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-top: 18px; }
          .line { display: flex; justify-content: space-between; margin-bottom: 9px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border-bottom: 1px solid #E5E7EB; padding: 10px; text-align: left; }
          th { background: #F8FAFC; }
          .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>SmartFash Receipt</h1>
        <div class="muted">Payment ${escapeHtml(payment?.payment_status || order?.payment_status || "paid")}</div>
        <div class="box">
          <div class="line"><strong>Order ID</strong><span>#${escapeHtml((order?.id || "").slice(0, 8))}</span></div>
          <div class="line"><strong>Transaction Ref</strong><span>${escapeHtml(payment?.transaction_reference || fallbackTransactionReference || "-")}</span></div>
          <div class="line"><strong>Customer</strong><span>${escapeHtml(order?.customer_name || "Customer")}</span></div>
          <div class="line"><strong>Date</strong><span>${order ? escapeHtml(new Date(order.created_at).toLocaleString()) : "-"}</span></div>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">No items found.</td></tr>'}</tbody>
        </table>
        <div class="total">Total: ${formatCurrency(totalAmount)}</div>
      </body>
    </html>
  `;
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
const headerTitle = { color: "#111827", fontSize: 20, fontWeight: "bold" as const };
const container = { padding: 20, paddingBottom: 40 };
const stateBox = {
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingVertical: 80,
};
const stateText = { color: "#6B7280", marginTop: 8, textAlign: "center" as const };
const receiptBox = {
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  padding: 18,
  alignItems: "center" as const,
};
const successIcon = {
  width: 72,
  height: 72,
  borderRadius: 36,
  backgroundColor: "#16A34A",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 16,
};
const failedIcon = { backgroundColor: "#DC2626" };
const title = { color: "#111827", fontSize: 24, fontWeight: "bold" as const };
const subtitle = {
  color: "#6B7280",
  fontSize: 14,
  textAlign: "center" as const,
  lineHeight: 20,
  marginTop: 8,
};
const detailBox = {
  alignSelf: "stretch" as const,
  borderTopWidth: 1,
  borderTopColor: "#E5E7EB",
  marginTop: 22,
  paddingTop: 16,
};
const row = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  marginBottom: 13,
};
const rowLabel = { color: "#6B7280", fontSize: 13 };
const rowValue = {
  color: "#111827",
  fontSize: 13,
  fontWeight: "700" as const,
  flexShrink: 1,
  textAlign: "right" as const,
};
const sectionTitle = {
  alignSelf: "stretch" as const,
  color: "#111827",
  fontSize: 17,
  fontWeight: "bold" as const,
  marginTop: 10,
  marginBottom: 12,
};
const itemRow = {
  alignSelf: "stretch" as const,
  flexDirection: "row" as const,
  gap: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#F3F4F6",
  paddingBottom: 12,
  marginBottom: 12,
};
const itemName = { color: "#111827", fontWeight: "700" as const };
const itemMeta = { color: "#6B7280", fontSize: 12, marginTop: 4 };
const itemTotal = { color: "#111827", fontWeight: "700" as const };
const totalRow = {
  alignSelf: "stretch" as const,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  marginTop: 8,
  paddingTop: 16,
  borderTopWidth: 1,
  borderTopColor: "#E5E7EB",
};
const totalLabel = { color: "#111827", fontSize: 16, fontWeight: "bold" as const };
const totalValue = { color: "#6D28D9", fontSize: 20, fontWeight: "bold" as const };
const primaryButton = {
  alignSelf: "stretch" as const,
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingVertical: 15,
  marginTop: 18,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};
const primaryButtonText = {
  color: "#FFFFFF",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

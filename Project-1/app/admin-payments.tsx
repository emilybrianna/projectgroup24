import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Payment = {
  id: string;
  order_id: string;
  customer_id: string | null;
  card_holder_name: string | null;
  masked_card_number: string | null;
  amount: number;
  transaction_reference: string | null;
  payment_status: string;
  created_at: string;
};

const formatCurrency = (amount: number) => `RM ${Number(amount || 0).toFixed(2)}`;

export default function AdminPayments() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "admin") {
        Alert.alert("Access Denied", "Payment management is for admin only.");
        router.replace("/customer");
        return;
      }

      setCheckingAccess(false);
      fetchPayments();
    };

    checkAccess();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("mock_payments")
      .select("id,order_id,customer_id,card_holder_name,masked_card_number,amount,transaction_reference,payment_status,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      setPayments([]);
      return;
    }

    setPayments((data || []) as Payment[]);
  };

  const updatePaymentStatus = async (payment: Payment, nextStatus: "paid" | "failed") => {
    setUpdatingId(payment.id);

    const { error: paymentError } = await supabase
      .from("mock_payments")
      .update({ payment_status: nextStatus })
      .eq("id", payment.id);

    if (paymentError) {
      setUpdatingId(null);
      Alert.alert("Error", paymentError.message);
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        payment_status: nextStatus,
        order_status: nextStatus === "paid" ? "pending" : "cancelled",
        status: nextStatus === "paid" ? "pending" : "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.order_id);

    setUpdatingId(null);

    if (orderError) {
      Alert.alert("Error", orderError.message);
      return;
    }

    setPayments((current) =>
      current.map((item) =>
        item.id === payment.id ? { ...item, payment_status: nextStatus } : item
      )
    );

    Alert.alert(
      "Payment Updated",
      `Transaction ${payment.transaction_reference || payment.id.slice(0, 8)} marked as ${nextStatus}.`
    );
  };

  if (checkingAccess) {
    return (
      <View style={centerPage}>
        <Text style={emptyText}>Checking admin access...</Text>
      </View>
    );
  }

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={title}>Payment Management</Text>
        <TouchableOpacity onPress={fetchPayments} style={iconButton}>
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={summaryCard}>
          <Text style={summaryLabel}>Transactions</Text>
          <Text style={summaryValue}>{payments.length}</Text>
          <Text style={summaryHint}>Verify and confirm payment records</Text>
        </View>

        {loading ? (
          <View style={emptyBox}>
            <ActivityIndicator color="#6D28D9" />
            <Text style={emptyText}>Loading payments...</Text>
          </View>
        ) : payments.length === 0 ? (
          <View style={emptyBox}>
            <Ionicons name="card-outline" size={44} color="#9CA3AF" />
            <Text style={emptyTitle}>No transactions found</Text>
            <Text style={emptyText}>Customer mock payments will appear here.</Text>
          </View>
        ) : (
          payments.map((payment) => {
            const isUpdating = updatingId === payment.id;
            const isPaid = payment.payment_status === "paid";
            const isFailed = payment.payment_status === "failed";

            return (
              <View key={payment.id} style={paymentCard}>
                <View style={paymentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={transactionRef}>
                      {payment.transaction_reference || `Payment #${payment.id.slice(0, 8)}`}
                    </Text>
                    <Text style={paymentMeta}>Order #{payment.order_id.slice(0, 8)}</Text>
                    <Text style={paymentMeta}>
                      {new Date(payment.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={amount}>{formatCurrency(payment.amount)}</Text>
                    <Text
                      style={[
                        statusPill,
                        isPaid && paidStatus,
                        isFailed && failedStatus,
                      ]}
                    >
                      {payment.payment_status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={detailRow}>
                  <Text style={detailLabel}>Card Holder</Text>
                  <Text style={detailValue}>{payment.card_holder_name || "-"}</Text>
                </View>
                <View style={detailRow}>
                  <Text style={detailLabel}>Card</Text>
                  <Text style={detailValue}>{payment.masked_card_number || "-"}</Text>
                </View>

                <View style={buttonRow}>
                  <TouchableOpacity
                    onPress={() => updatePaymentStatus(payment, "paid")}
                    disabled={isUpdating}
                    style={[actionButton, successButton]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={actionText}>{isUpdating ? "Updating..." : "Confirm Paid"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => updatePaymentStatus(payment, "failed")}
                    disabled={isUpdating}
                    style={[actionButton, failButton]}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={actionText}>Mark Failed</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const page = { flex: 1, backgroundColor: "#F8FAFC" };
const centerPage = {
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
const title = {
  fontSize: 20,
  fontWeight: "bold" as const,
  color: "#111827",
};
const container = { padding: 20, paddingBottom: 40 };
const summaryCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};
const summaryLabel = { color: "#6B7280", fontSize: 13 };
const summaryValue = {
  color: "#111827",
  fontSize: 30,
  fontWeight: "bold" as const,
  marginTop: 4,
};
const summaryHint = { color: "#6B7280", fontSize: 13, marginTop: 4 };
const emptyBox = {
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingVertical: 70,
};
const emptyTitle = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#111827",
  marginTop: 14,
};
const emptyText = {
  textAlign: "center" as const,
  color: "#6B7280",
  marginTop: 8,
  lineHeight: 20,
};
const paymentCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 14,
};
const paymentHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  marginBottom: 14,
};
const transactionRef = {
  color: "#111827",
  fontSize: 14,
  fontWeight: "bold" as const,
  marginBottom: 5,
};
const paymentMeta = { color: "#6B7280", fontSize: 12, marginBottom: 3 };
const amount = { color: "#111827", fontSize: 16, fontWeight: "bold" as const };
const statusPill = {
  color: "#92400E",
  backgroundColor: "#FEF3C7",
  fontSize: 11,
  fontWeight: "bold" as const,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
  marginTop: 7,
  overflow: "hidden" as const,
};
const paidStatus = { color: "#166534", backgroundColor: "#DCFCE7" };
const failedStatus = { color: "#991B1B", backgroundColor: "#FEE2E2" };
const detailRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  marginBottom: 8,
};
const detailLabel = { color: "#6B7280", fontSize: 13 };
const detailValue = {
  color: "#111827",
  fontSize: 13,
  fontWeight: "600" as const,
  flexShrink: 1,
  textAlign: "right" as const,
};
const buttonRow = { flexDirection: "row" as const, gap: 10, marginTop: 12 };
const actionButton = {
  flex: 1,
  borderRadius: 8,
  paddingVertical: 12,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 7,
};
const successButton = { backgroundColor: "#16A34A" };
const failButton = { backgroundColor: "#DC2626" };
const actionText = { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" as const };

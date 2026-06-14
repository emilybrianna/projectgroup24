import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type DeletionRequest = {
  id: string;
  order_id: string;
  staff_id: string;
  staff_name: string | null;
  reason: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export default function StaffDeletionRequest() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const role = await AsyncStorage.getItem("userRole");

      if (role !== "staff") {
        Alert.alert("Access Denied", "Request tracking is for staff only.");
        router.replace("/customer");
        return;
      }

      fetchRequests();
    };

    checkAccessAndLoad();
  }, []);

  const fetchRequests = async () => {
    const staffId = await AsyncStorage.getItem("userId");

    if (!staffId) {
      router.replace("/customer");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("order_deletion_requests")
      .select("id,order_id,staff_id,staff_name,reason,status,admin_note,created_at,updated_at")
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setRequests((data || []) as DeletionRequest[]);
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={title}>Request Status</Text>
            <Text style={subtitle}>Track submitted deletion requests</Text>
          </View>
          <TouchableOpacity onPress={fetchRequests} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <Text style={countText}>
          {loading ? "Loading..." : `${requests.length} submitted request(s)`}
        </Text>

        {requests.map((request) => (
          <View key={request.id} style={requestCard}>
            <View style={requestHeader}>
              <View style={{ flex: 1 }}>
                <Text style={requestTitle}>
                  Order #{String(request.order_id).slice(0, 8)}
                </Text>
                <Text style={requestMeta}>
                  Submitted {new Date(request.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={[statusBadge, getStatusStyle(request.status)]}>
                <Text style={statusText}>{request.status}</Text>
              </View>
            </View>

            <Text style={reasonText}>{request.reason || "No reason provided."}</Text>
            {request.admin_note ? (
              <Text style={adminNote}>Admin note: {request.admin_note}</Text>
            ) : null}
          </View>
        ))}

        {!loading && requests.length === 0 && (
          <View style={emptyBox}>
            <Ionicons name="document-text-outline" size={42} color="#9CA3AF" />
            <Text style={emptyTitle}>No requests yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStatusStyle(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "approved") {
    return { backgroundColor: "#ECFDF5" };
  }

  if (normalized === "rejected") {
    return { backgroundColor: "#FEF2F2" };
  }

  return { backgroundColor: "#FFFBEB" };
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
const requestCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 14,
};
const requestHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  marginBottom: 10,
};
const requestTitle = { color: "#111827", fontWeight: "bold" as const, marginBottom: 5 };
const requestMeta = { color: "#6B7280", fontSize: 12 };
const statusBadge = {
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 6,
  alignSelf: "flex-start" as const,
};
const statusText = { color: "#111827", fontSize: 11, fontWeight: "bold" as const };
const reasonText = { color: "#374151", fontSize: 13, lineHeight: 19 };
const adminNote = {
  color: "#6D28D9",
  fontSize: 12,
  lineHeight: 18,
  marginTop: 8,
  fontWeight: "600" as const,
};
const emptyBox = { alignItems: "center" as const, paddingVertical: 60 };
const emptyTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  marginTop: 12,
  fontSize: 16,
};

import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    const userId = await AsyncStorage.getItem("userId");
    const userEmail = await AsyncStorage.getItem("userEmail");

    if (!userId && !userEmail) {
      Alert.alert("Session Expired", "Please sign in again.");
      router.replace("/customer");
      return;
    }

    let query = supabase
      .from("customer_notifications")
      .select("id,title,message,type,is_read,created_at")
      .order("created_at", { ascending: false });

    query = userId ? query.eq("customer_id", userId) : query.eq("customer_email", userEmail);

    const { data, error } = await query;

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setNotifications((data || []) as Notification[]);
  };

  const markRead = async (notification: Notification) => {
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
        <Text style={title}>Notifications</Text>
        <TouchableOpacity onPress={fetchNotifications} style={iconButton}>
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container}>
        {notifications.length === 0 ? (
          <View style={emptyBox}>
            <Ionicons name="notifications-outline" size={44} color="#9CA3AF" />
            <Text style={emptyTitle}>No notifications yet</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              onPress={() => markRead(notification)}
              style={[card, !notification.is_read && unreadCard]}
            >
              <View style={iconCircle}>
                <Ionicons name="notifications-outline" size={18} color="#6D28D9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cardTitle}>{notification.title}</Text>
                <Text style={cardText}>{notification.message}</Text>
                <Text style={dateText}>{new Date(notification.created_at).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const page = { flex: 1, backgroundColor: "#F8FAFC" };
const header = { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#FFFFFF", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };
const iconButton = { width: 38, height: 38, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" as const, justifyContent: "center" as const };
const title = { color: "#111827", fontSize: 20, fontWeight: "bold" as const };
const container = { padding: 20, paddingBottom: 42 };
const emptyBox = { alignItems: "center" as const, paddingTop: 90 };
const emptyTitle = { color: "#111827", fontSize: 18, fontWeight: "bold" as const, marginTop: 12 };
const card = { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 14, marginBottom: 12, flexDirection: "row" as const, gap: 12 };
const unreadCard = { borderColor: "#C4B5FD", backgroundColor: "#FAF5FF" };
const iconCircle = { width: 38, height: 38, borderRadius: 8, backgroundColor: "#F3E8FF", alignItems: "center" as const, justifyContent: "center" as const };
const cardTitle = { color: "#111827", fontWeight: "bold" as const, marginBottom: 5 };
const cardText = { color: "#374151", fontSize: 13, lineHeight: 19 };
const dateText = { color: "#6B7280", fontSize: 11, marginTop: 6 };

import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type User = {
  id: string;
  name: string;
  email: string;
};

export default function AdminNotifications() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email")
      .eq("role", "customer")
      .order("name", { ascending: true });

    if (error) {
      Alert.alert("Users Error", error.message);
      return;
    }

    setUsers((data || []) as User[]);
  }, []);

  const checkAccessAndLoad = useCallback(async () => {
    const role = await AsyncStorage.getItem("userRole");

    if (role !== "admin") {
      Alert.alert("Access Denied", "Admin notifications are for admin only.");
      router.replace("/customer");
      return;
    }

    fetchUsers();
  }, [fetchUsers]);

  useFocusEffect(
    useCallback(() => {
      checkAccessAndLoad();
    }, [checkAccessAndLoad])
  );

  const sendNotification = async () => {
    if (!selectedUser || !title.trim() || !message.trim()) {
      Alert.alert("Missing Info", "Select a user and enter title/message.");
      return;
    }

    const { error } = await supabase.from("customer_notifications").insert({
      customer_id: selectedUser.id,
      customer_email: selectedUser.email,
      title: title.trim(),
      message: message.trim(),
      type: "admin_message",
    });

    if (error) {
      Alert.alert("Send Error", error.message);
      return;
    }

    Alert.alert("Sent", `Notification sent to ${selectedUser.name}.`);
    setTitle("");
    setMessage("");
  };

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={heading}>Send Notification</Text>
        <TouchableOpacity onPress={fetchUsers} style={iconButton}>
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container}>
        <Text style={sectionTitle}>Select User</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={userScroll}>
          {users.map((user) => (
            <TouchableOpacity
              key={user.id}
              onPress={() => setSelectedUser(user)}
              style={[userChip, selectedUser?.id === user.id && activeUserChip]}
            >
              <Text style={[userName, selectedUser?.id === user.id && activeUserText]}>
                {user.name}
              </Text>
              <Text style={[userEmail, selectedUser?.id === user.id && activeUserText]}>
                {user.email}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={formBox}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Notification title"
            style={input}
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message"
            multiline
            style={[input, messageInput]}
          />
          <TouchableOpacity onPress={sendNotification} style={sendButton}>
            <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
            <Text style={sendText}>Send Notification</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const page = { flex: 1, backgroundColor: "#F8FAFC" };
const header = { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#FFFFFF", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };
const iconButton = { width: 38, height: 38, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" as const, justifyContent: "center" as const };
const heading = { color: "#111827", fontSize: 19, fontWeight: "bold" as const };
const container = { padding: 20, paddingBottom: 42 };
const sectionTitle = { color: "#111827", fontSize: 17, fontWeight: "bold" as const, marginBottom: 12 };
const userScroll = { marginBottom: 14 };
const userChip = { width: 190, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 12, marginRight: 10 };
const activeUserChip = { backgroundColor: "#6D28D9", borderColor: "#6D28D9" };
const userName = { color: "#111827", fontWeight: "bold" as const };
const userEmail = { color: "#6B7280", fontSize: 11, marginTop: 4 };
const activeUserText = { color: "#FFFFFF" };
const formBox = { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 14 };
const input = { backgroundColor: "#F3F4F6", borderRadius: 8, padding: 13, marginBottom: 12 };
const messageInput = { minHeight: 100, textAlignVertical: "top" as const };
const sendButton = { backgroundColor: "#6D28D9", borderRadius: 8, padding: 14, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 };
const sendText = { color: "#FFFFFF", fontWeight: "bold" as const };

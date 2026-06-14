import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type Conversation = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  last_message: string | null;
  last_sender: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  sender_role: "customer" | "admin" | "ai";
  message: string;
  created_at: string;
};

export default function AdminChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [adminId, setAdminId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id,customer_name,customer_email,last_message,last_sender,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      Alert.alert("Chat Error", error.message);
      return;
    }

    setConversations((data || []) as Conversation[]);
  }, []);

  const checkAccessAndLoad = useCallback(async () => {
    const role = await AsyncStorage.getItem("userRole");
    const userId = await AsyncStorage.getItem("userId");

    if (role !== "admin") {
      Alert.alert("Access Denied", "Admin chat is for admin only.");
      router.replace("/customer");
      return;
    }

    setAdminId(userId);
    fetchConversations();
  }, [fetchConversations]);

  useFocusEffect(
    useCallback(() => {
      checkAccessAndLoad();
    }, [checkAccessAndLoad])
  );

  const openConversation = async (conversation: Conversation) => {
    setSelected(conversation);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,sender_role,message,created_at")
      .eq("conversation_id", conversation.id)
      .eq("chat_mode", "agent")
      .order("created_at", { ascending: true });

    if (error) {
      Alert.alert("Messages Error", error.message);
      return;
    }

    setMessages((data || []) as Message[]);
  };

  const sendReply = async () => {
    const text = reply.trim();

    if (!text || !selected) {
      return;
    }

    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: selected.id,
      sender_id: adminId,
      sender_role: "admin",
      chat_mode: "agent",
      message: text,
    });

    if (error) {
      Alert.alert("Reply Error", error.message);
      return;
    }

    await supabase
      .from("chat_conversations")
      .update({
        last_message: text,
        last_sender: "admin",
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    await supabase.from("customer_notifications").insert({
      customer_email: selected.customer_email,
      title: "Admin replied to your chat",
      message: text,
      type: "chat_reply",
    });

    setReply("");
    openConversation(selected);
    fetchConversations();
  };

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={title}>Admin Chat</Text>
        <TouchableOpacity onPress={fetchConversations} style={iconButton}>
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={container}>
        <Text style={sectionTitle}>Conversations</Text>
        {conversations.map((conversation) => (
          <TouchableOpacity
            key={conversation.id}
            onPress={() => openConversation(conversation)}
            style={[conversationCard, selected?.id === conversation.id && selectedCard]}
          >
            <Text style={conversationTitle}>{conversation.customer_name || "Customer"}</Text>
            <Text style={conversationMeta}>{conversation.customer_email || "No email"}</Text>
            <Text style={conversationPreview} numberOfLines={1}>
              {conversation.last_sender ? `${conversation.last_sender}: ` : ""}
              {conversation.last_message || "No messages yet"}
            </Text>
          </TouchableOpacity>
        ))}

        {conversations.length === 0 && (
          <Text style={emptyText}>No customer conversations yet.</Text>
        )}

        {selected && (
          <View style={chatPanel}>
            <Text style={sectionTitle}>Reply to {selected.customer_name || "Customer"}</Text>
            {messages.map((item) => {
              const isAdmin = item.sender_role === "admin";
              const isAi = item.sender_role === "ai";
              return (
                <View
                  key={item.id}
                  style={[bubble, isAdmin ? adminBubble : isAi ? aiBubble : customerBubble]}
                >
                  {isAi && <Text style={aiLabel}>AI Stylist</Text>}
                  <Text style={[bubbleText, isAdmin && adminText]}>{item.message}</Text>
                </View>
              );
            })}

            <View style={replyRow}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Type admin reply..."
                multiline
                style={replyInput}
              />
              <TouchableOpacity onPress={sendReply} style={sendButton}>
                <Ionicons name="send-outline" size={19} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
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
const iconButton = { width: 38, height: 38, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" as const, justifyContent: "center" as const };
const title = { color: "#111827", fontSize: 20, fontWeight: "bold" as const };
const container = { padding: 20, paddingBottom: 42 };
const sectionTitle = { color: "#111827", fontSize: 17, fontWeight: "bold" as const, marginBottom: 12 };
const conversationCard = { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 13, marginBottom: 10 };
const selectedCard = { borderColor: "#6D28D9", backgroundColor: "#FAF5FF" };
const conversationTitle = { color: "#111827", fontWeight: "bold" as const };
const conversationMeta = { color: "#6B7280", fontSize: 12, marginTop: 4 };
const conversationPreview = { color: "#374151", fontSize: 12, marginTop: 6 };
const emptyText = { color: "#6B7280", textAlign: "center" as const, marginVertical: 24 };
const chatPanel = { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 14, marginTop: 14 };
const bubble = { borderRadius: 8, padding: 11, marginBottom: 9, maxWidth: "85%" as const };
const adminBubble = { backgroundColor: "#6D28D9", alignSelf: "flex-end" as const };
const customerBubble = { backgroundColor: "#F3F4F6", alignSelf: "flex-start" as const };
const aiBubble = { backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE", alignSelf: "flex-start" as const };
const aiLabel = { color: "#6D28D9", fontSize: 11, fontWeight: "800" as const, marginBottom: 5 };
const bubbleText = { color: "#111827", lineHeight: 19 };
const adminText = { color: "#FFFFFF" };
const replyRow = { flexDirection: "row" as const, gap: 10, alignItems: "flex-end" as const, marginTop: 10 };
const replyInput = { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 8, padding: 12, maxHeight: 90 };
const sendButton = { width: 44, height: 44, borderRadius: 8, backgroundColor: "#6D28D9", alignItems: "center" as const, justifyContent: "center" as const };

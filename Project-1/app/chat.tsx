import { supabase } from "@/lib/supabase";
import { CartItem, getCartItems } from "@/lib/cart";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  type TextInput as TextInputType,
  TouchableOpacity,
  View,
} from "react-native";

type Message = {
  id: string;
  sender_role: "customer" | "admin" | "ai";
  chat_mode?: ChatMode;
  message: string;
  created_at: string;
};

type ChatMode = "ai" | "agent";

type ProductContext = {
  name: string;
  price: number;
  category: string | null;
  color: string | null;
  size: string | null;
  occasion: string | null;
  material: string | null;
};

type AiAction = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  prompt: string;
  directAsk?: boolean;
};

type AiHistoryItem = {
  role: "customer" | "assistant";
  content: string;
};

const aiActions: AiAction[] = [
  {
    icon: "flash-outline",
    title: "Speed up delivery",
    subtitle: "Ask how to get the order faster.",
    prompt: "I want to speed up my delivery. What can I do?",
  },
  {
    icon: "location-outline",
    title: "Edit address",
    subtitle: "Change delivery address before shipping.",
    prompt: "How can I edit my address book or delivery address?",
  },
  {
    icon: "cube-outline",
    title: "Delivered issue",
    subtitle: "Parcel says delivered but not received.",
    prompt: "Why is my parcel marked delivered when I have not received it?",
  },
  {
    icon: "close-circle-outline",
    title: "Cancel order",
    subtitle: "Understand whether an order can be cancelled.",
    prompt: "How can I cancel my order?",
  },
  {
    icon: "shirt-outline",
    title: "Outfit advice",
    subtitle: "Get fashion, cart, or product suggestions.",
    prompt: "I want outfit advice. Ask me what you need first.",
  },
  {
    icon: "cart-outline",
    title: "Check my cart",
    subtitle: "See if cart items match well.",
    prompt: "Can you check whether the items in my cart match well?",
  },
  {
    icon: "chatbubble-ellipses-outline",
    title: "Others",
    subtitle: "Ask another question.",
    prompt: "",
    directAsk: true,
  },
];

const formatCartContext = (items: CartItem[]) => {
  if (items.length === 0) {
    return "Cart is empty.";
  }

  return items
    .map(
      (item) =>
        `${item.name} (${item.color || "no color"}, size ${item.size || "-"}, qty ${item.quantity}, RM ${Number(item.price || 0).toFixed(2)})`
    )
    .join("; ");
};

const getLocalAiReply = (text: string, cartItems: CartItem[] = [], products: ProductContext[] = []) => {
  const lower = text.toLowerCase();
  const hasMalay = /\b(saya|nak|baju|seluar|kasut|warna|saiz|untuk|pergi|kelas|kerja|cuaca|panas|hujan|cantik|sesuai|padan|cart|troli|bayar|order|pesanan)\b/i.test(text);
  const reply = (english: string, malay: string) => (hasMalay ? malay : english);

  const productNames = products
    .slice(0, 4)
    .map((product) => product.name)
    .join(", ");

  const cartSummary = cartItems
    .slice(0, 4)
    .map((item) => `${item.name}${item.color ? ` (${item.color}` : ""}${item.size ? `, ${item.size}` : ""}${item.color ? ")" : ""}`)
    .join(", ");

  if (/apa.*boleh|what.*can|help|tolong|bantu|hai|hi|hello/.test(lower)) {
    return reply(
      "I can help with outfit ideas, color matching, cart review, product suggestions, and general order or payment questions.",
      "Saya boleh bantu cadang outfit, padankan warna, semak cart, suggest product, dan jawab soalan umum pasal order atau payment."
    );
  }

  if (/cart|troli|basket/.test(lower)) {
    if (cartItems.length === 0) {
      return reply(
        "Your cart is empty right now. Add a top, bottom, or accessory first, then I can check whether the look matches.",
        "Cart awak kosong lagi. Add baju, seluar, atau accessories dulu, nanti saya boleh check padanan outfit tu."
      );
    }

    return reply(
      `I can see these cart items: ${cartSummary}. They can work together if the colors stay balanced. Add a neutral bottom or simple accessory if the outfit feels too busy.`,
      `Saya nampak dalam cart: ${cartSummary}. Outfit ni boleh jadi kalau warna dia balance. Kalau nampak terlalu penuh, tambah bottom neutral atau accessories simple.`
    );
  }

  if (/style me|outfit|baju|seluar|pakai|match|padan|sesuai|cantik|look|fit/.test(lower)) {
    if (/class|kelas|college|uni|campus/.test(lower)) {
      return reply(
        "For class, go casual and neat: oversized tee or blouse, straight pants or jeans, and a tote/crossbody bag. Pick black, navy, beige, or white so it is easy to match.",
        "Untuk pergi kelas, pilih casual tapi kemas: oversized tee atau blouse, straight pants/jeans, dan tote/crossbody bag. Warna black, navy, beige atau white senang match."
      );
    }

    if (/work|office|kerja|formal|interview|meeting/.test(lower)) {
      return reply(
        "For work, choose a blouse or formal shirt with office trousers or wide-leg pants. Keep the colors neutral and add one clean accessory.",
        "Untuk kerja/formal, pilih blouse atau formal shirt dengan office trousers/wide-leg pants. Warna neutral dan tambah satu accessories simple."
      );
    }

    if (/date|dinner|event|party|makan/.test(lower)) {
      return reply(
        "For dinner or events, try a satin blouse or dress with a small bag and simple jewelry. Keep one statement piece and make the rest neutral.",
        "Untuk dinner/event, cuba satin blouse atau dress dengan small bag dan jewelry simple. Biar satu item jadi statement, yang lain neutral."
      );
    }

    return reply(
      "Sure. Tell me your style gender, size, preferred color, occasion, and whether you want casual, formal, or weather-friendly styling.",
      "Boleh. Beritahu style female/male, saiz, warna pilihan, occasion, dan nak casual, formal atau ikut cuaca."
    );
  }

  if (/find product|product|barang|cari|recommend|suggest|cadang/.test(lower)) {
    if (productNames) {
      return reply(
        `I can suggest from current products such as ${productNames}. Tell me the category, color, size, and occasion so I can narrow it down.`,
        `Saya boleh suggest dari product sekarang seperti ${productNames}. Beritahu category, warna, saiz dan occasion supaya saya boleh tapis.`
      );
    }

    return reply(
      "Product list is empty right now, so I can only give general styling advice until products are added again.",
      "Product list tengah kosong, jadi buat masa ni saya boleh bagi nasihat styling general dulu sampai product dimasukkan semula."
    );
  }

  if (/order|receipt|payment|pay|delivery|status|bayar|resit|pesanan|hantar/.test(lower)) {
    return reply(
      "For general order help: check Order History for status and receipt. For private account details, choose Agent so admin can verify safely.",
      "Untuk order: semak Order History untuk status dan resit. Kalau nak detail akaun sendiri, pilih Agent supaya admin boleh verify dengan selamat."
    );
  }

  if (/rain|weather|hot|sun|cold|cool|hujan|panas|cuaca|sejuk/.test(lower)) {
    return reply(
      "For hot weather, choose cotton or linen, loose fits, and lighter colors. For rain, use a cap or nylon bag and avoid heavy denim.",
      "Kalau panas, pilih cotton/linen, cutting longgar dan warna cerah. Kalau hujan, guna cap atau nylon bag dan elakkan denim berat."
    );
  }

  if (/formal|office|work|interview/.test(lower)) {
    return "For formal styling, try a clean shirt or blouse with pleated/wide pants, neutral colors, and one simple accessory.";
  }

  if (/color|match|colour/.test(lower)) {
    return "Easy color matching: black, white, navy, beige, and gray are safest. If your outfit has one strong color, keep the other pieces neutral.";
  }

  return reply(
    "I can help with fashion, outfit matching, cart review, products, and order/payment questions only. Tell me what occasion or item you need help with.",
    "Saya boleh bantu pasal fashion, padanan outfit, cart, product, dan soalan order/payment sahaja. Beritahu nak pakai untuk occasion apa atau item apa."
  );
};

export default function UserChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("ai");
  const [aiTyping, setAiTyping] = useState(false);
  const inputRef = useRef<TextInputType>(null);

  const clearAiConversation = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("chat_mode", "ai");

    if (error) {
      Alert.alert("Chat Error", error.message);
      return;
    }

    setMessages([]);
  }, [conversationId]);

  const handleExitChat = useCallback(() => {
    if (mode !== "ai" || messages.length === 0) {
      router.back();
      return;
    }

    Alert.alert(
      "End Conversation?",
      "Can we end our conversation? If you leave now, all AI Stylist chat messages will be erased.",
      [
        { text: "Keep Chat", style: "cancel" },
        {
          text: "End & Erase",
          style: "destructive",
          onPress: async () => {
            await clearAiConversation();
            router.back();
          },
        },
      ]
    );
  }, [clearAiConversation, messages.length, mode]);

  const fetchMessages = useCallback(async (id: string, chatMode: ChatMode = mode) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,sender_role,chat_mode,message,created_at")
      .eq("conversation_id", id)
      .eq("chat_mode", chatMode)
      .order("created_at", { ascending: true });

    if (error) {
      Alert.alert("Messages Error", error.message);
      return;
    }

    setMessages((data || []) as Message[]);
  }, [mode]);

  const loadConversation = useCallback(async () => {
    const storedUserId = await AsyncStorage.getItem("userId");
    const userName = await AsyncStorage.getItem("userName");
    const userEmail = await AsyncStorage.getItem("userEmail");

    if (!storedUserId && !userEmail) {
      Alert.alert("Session Expired", "Please sign in again.");
      router.replace("/customer");
      return;
    }

    setUserId(storedUserId);

    let conversationQuery = supabase
      .from("chat_conversations")
      .select("id");

    conversationQuery = storedUserId
      ? conversationQuery.eq("customer_id", storedUserId)
      : conversationQuery.eq("customer_email", userEmail);

    const { data: existing } = await conversationQuery.maybeSingle();

    let nextConversationId = existing?.id;

    if (!nextConversationId) {
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          customer_id: storedUserId,
          customer_name: userName || "Customer",
          customer_email: userEmail,
        })
        .select("id")
        .single();

      if (error) {
        Alert.alert("Chat Error", error.message);
        return;
      }

      nextConversationId = data.id;
    }

    setConversationId(nextConversationId);
    fetchMessages(nextConversationId, mode);
  }, [fetchMessages, mode]);

  const switchMode = (nextMode: ChatMode) => {
    setMode(nextMode);

    if (conversationId) {
      fetchMessages(conversationId, nextMode);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadConversation();
    }, [loadConversation])
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        handleExitChat();
        return true;
      });

      return () => subscription.remove();
    }, [handleExitChat])
  );

  const fetchProductContext = async () => {
    const { data } = await supabase
      .from("products")
      .select("name,price,category,color,size,occasion,material")
      .neq("is_active", false)
      .order("is_featured", { ascending: false })
      .limit(20);

    return (data || []) as ProductContext[];
  };

  const saveChatMessage = async (
    text: string,
    senderRole: "customer" | "admin" | "ai",
    chatMode: ChatMode
  ) => {
    if (!conversationId) {
      return;
    }

    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: senderRole === "customer" ? userId : null,
      sender_role: senderRole,
      chat_mode: chatMode,
      message: text,
    });

    if (error) {
      Alert.alert("Chat Error", error.message);
    }
  };

  const getAiReply = async (text: string) => {
    try {
      const products = await fetchProductContext();
      const cartItems = await getCartItems();
      const history: AiHistoryItem[] = messages
        .slice(-10)
        .map((item) => ({
          role: item.sender_role === "ai" ? "assistant" : "customer",
          content: item.message,
        }));
      const { data, error } = await supabase.functions.invoke("ai-stylist-chat", {
        body: {
          message: text,
          products,
          cartItems,
          cartContext: formatCartContext(cartItems),
          history,
        },
      });

      if (error) {
        const status = error.context?.status;

        if (status === 429) {
          return "Gemini AI is connected, but the free tier limit may be reached right now. Try again later or check the Gemini API key. For now, I can still help with basic fashion advice.";
        }

        return getLocalAiReply(text, cartItems, products);
      }

      if (data?.code === "GEMINI_KEY_MISSING") {
        return "Gemini API key is not set yet. Add GEMINI_API_KEY in Supabase secrets, then redeploy the ai-stylist-chat function.";
      }

      if (data?.code === "GEMINI_QUOTA_EXCEEDED") {
        return "Gemini AI is connected, but the free tier limit may be reached right now. Try again later or check your Gemini API quota. For now, I can still help with basic fashion advice.";
      }

      if (!data?.reply) {
        return getLocalAiReply(text, cartItems, products);
      }

      return String(data.reply);
    } catch {
      const cartItems = await getCartItems();
      return getLocalAiReply(text, cartItems, []);
    }
  };

  const chooseAiAction = async (action: AiAction) => {
    if (action.directAsk) {
      setMessage("");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setMessage(action.prompt);
  };

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || !conversationId || aiTyping) {
      return;
    }

    await saveChatMessage(text, "customer", mode);

    if (mode === "agent") {
      await supabase
        .from("chat_conversations")
        .update({
          last_message: text,
          last_sender: "customer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    setMessage("");
    fetchMessages(conversationId, mode);

    if (mode === "ai") {
      setAiTyping(true);
      try {
        const reply = await getAiReply(text);
        await saveChatMessage(reply, "ai", "ai");
      } finally {
        setAiTyping(false);
      }
    }

    fetchMessages(conversationId, mode);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      style={page}
    >
      <View style={header}>
        <TouchableOpacity onPress={handleExitChat} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={title}>SmartFash Chat</Text>
        <TouchableOpacity
          onPress={() => conversationId && fetchMessages(conversationId)}
          style={iconButton}
        >
          <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
        </TouchableOpacity>
      </View>

      <View style={modeSwitch}>
        <TouchableOpacity
          onPress={() => switchMode("ai")}
          style={[modeButton, mode === "ai" && activeModeButton]}
        >
          <Ionicons name="sparkles-outline" size={16} color={mode === "ai" ? "#FFFFFF" : "#6D28D9"} />
          <Text style={[modeText, mode === "ai" && activeModeText]}>AI Stylist</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => switchMode("agent")}
          style={[modeButton, mode === "agent" && activeModeButton]}
        >
          <Ionicons name="person-outline" size={16} color={mode === "agent" ? "#FFFFFF" : "#6D28D9"} />
          <Text style={[modeText, mode === "agent" && activeModeText]}>Agent</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={messagesBox}>
        {mode === "ai" && (
          <View style={aiStarterBox}>
            <View style={[bubble, aiBubble]}>
              <Text style={senderLabel}>AI Stylist</Text>
              <Text style={bubbleText}>
                Hi, could you tell us what you need help with?
              </Text>
            </View>
            <View style={actionList}>
              {aiActions.map((action) => (
                <TouchableOpacity
                  key={action.title}
                  onPress={() => chooseAiAction(action)}
                  style={actionRow}
                >
                  <View style={actionIconBox}>
                    <Ionicons name={action.icon} size={17} color="#6D28D9" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={actionTitle}>{action.title}</Text>
                    <Text style={actionSubtitle}>{action.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={17} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.length === 0 ? (
          mode === "agent" ? (
            <View style={emptyBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={42} color="#9CA3AF" />
              <Text style={emptyTitle}>Chat with admin</Text>
              <Text style={emptyText}>
                Send questions about orders, payment, delivery, or product issues. This chat stays with the agent.
              </Text>
            </View>
          ) : null
        ) : (
          messages.map((item) => {
            const isMine = item.sender_role === "customer";
            const isAi = item.sender_role === "ai";

            return (
              <View key={item.id} style={[bubble, isMine ? myBubble : isAi ? aiBubble : adminBubble]}>
                {!isMine && (
                  <Text style={senderLabel}>{isAi ? "AI Stylist" : "Admin Agent"}</Text>
                )}
                <Text style={[bubbleText, isMine && myBubbleText]}>{item.message}</Text>
                <Text style={[timeText, isMine && myTimeText]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          })
        )}
        {aiTyping && (
          <View style={[bubble, aiBubble]}>
            <Text style={senderLabel}>AI Stylist</Text>
            <Text style={bubbleText}>Thinking about your style...</Text>
          </View>
        )}
      </ScrollView>

      <View style={inputBar}>
        <TextInput
          ref={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={mode === "ai" ? "Ask about outfits, color, weather..." : "Message admin agent..."}
          multiline
          style={input}
        />
        <TouchableOpacity
          disabled={aiTyping}
          onPress={sendMessage}
          style={[sendButton, aiTyping && disabledButton]}
        >
          <Ionicons name="send-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
const iconButton = {
  width: 38,
  height: 38,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const title = { color: "#111827", fontSize: 19, fontWeight: "bold" as const };
const modeSwitch = {
  flexDirection: "row" as const,
  gap: 10,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#F3F4F6",
};
const modeButton = {
  flex: 1,
  borderWidth: 1,
  borderColor: "#DDD6FE",
  borderRadius: 8,
  paddingVertical: 11,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 7,
};
const activeModeButton = {
  backgroundColor: "#6D28D9",
  borderColor: "#6D28D9",
};
const modeText = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "800" as const,
};
const activeModeText = {
  color: "#FFFFFF",
};
const messagesBox = { padding: 18, paddingBottom: 18 };
const emptyBox = { alignItems: "center" as const, paddingTop: 80 };
const emptyTitle = { color: "#111827", fontSize: 18, fontWeight: "bold" as const, marginTop: 12 };
const emptyText = { color: "#6B7280", textAlign: "center" as const, marginTop: 6 };
const aiStarterBox = { marginBottom: 12 };
const actionList = { gap: 8, marginTop: 4 };
const actionRow = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 11,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
};
const actionIconBox = {
  width: 30,
  height: 30,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const actionTitle = { color: "#111827", fontSize: 13, fontWeight: "800" as const };
const actionSubtitle = { color: "#6B7280", fontSize: 11, marginTop: 3 };
const bubble = { maxWidth: "82%" as const, borderRadius: 8, padding: 12, marginBottom: 10 };
const myBubble = { alignSelf: "flex-end" as const, backgroundColor: "#6D28D9" };
const adminBubble = { alignSelf: "flex-start" as const, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" };
const aiBubble = { alignSelf: "flex-start" as const, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" };
const senderLabel = { color: "#6D28D9", fontSize: 11, fontWeight: "800" as const, marginBottom: 5 };
const bubbleText = { color: "#111827", lineHeight: 20 };
const myBubbleText = { color: "#FFFFFF" };
const timeText = { color: "#6B7280", fontSize: 10, marginTop: 5 };
const myTimeText = { color: "#EDE9FE" };
const inputBar = {
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#E5E7EB",
  flexDirection: "row" as const,
  alignItems: "flex-end" as const,
  gap: 10,
  padding: 14,
};
const input = { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 8, padding: 12, maxHeight: 90 };
const sendButton = {
  width: 46,
  height: 46,
  borderRadius: 8,
  backgroundColor: "#6D28D9",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const disabledButton = { opacity: 0.55 };

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

type StylistTool = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: "/skin-tone-analyzer" | "/product" | "/chat" | "/body-shape-styling" | "/virtual-closet" | "/smart-packing";
  status: "ready" | "soon";
};

const stylistTools: StylistTool[] = [
  {
    title: "Skin Tone Analyzer",
    description: "Take a selfie and get clothing color suggestions based on your skin undertone.",
    icon: "color-palette-outline",
    route: "/skin-tone-analyzer",
    status: "ready",
  },
  {
    title: "AI Outfit Filter",
    description: "Find one item or build a full outfit using weather, preference, and shopping style.",
    icon: "shirt-outline",
    route: "/product",
    status: "ready",
  },
  {
    title: "Chat Stylist",
    description: "Ask fashion questions, cart matching ideas, or SmartFash order help.",
    icon: "chatbubble-ellipses-outline",
    route: "/chat",
    status: "ready",
  },
  {
    title: "Body Shape Styling",
    description: "Outfit ideas based on fit, silhouette, and comfort preference.",
    icon: "body-outline",
    route: "/body-shape-styling",
    status: "ready",
  },
  {
    title: "Virtual Closet",
    description: "Explore outfit ideas tailored to your body shape, fit preferences, and personal fashion style.",
    icon: "shirt-outline",
    route: "/virtual-closet",
    status: "ready",
  },
  {
  title: "Smart Packing Assistant",
  description: "Create personalized packing lists based on your destination, weather, trip duration, and planned activities.",
  icon: "briefcase-outline",
  route: "/smart-packing",
  status: "ready",
},
];

export default function AiOutfit() {
  const openTool = (tool: StylistTool) => {
    if (tool.status === "soon" || !tool.route) {
      return;
    }

    router.push(tool.route);
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container} showsVerticalScrollIndicator={false}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={headerText}>
            <Text style={title}>AI Stylist</Text>
            <Text style={subtitle}>Choose what kind of styling help you want</Text>
          </View>
        </View>

        <View style={intro}>
          <View style={introIcon}>
            <Ionicons name="sparkles-outline" size={28} color="#6D28D9" />
          </View>
          <Text style={introTitle}>SmartFash Styling Tools</Text>
          <Text style={introText}>
            Pick one AI feature first.
          </Text>
        </View>

        <Text style={sectionTitle}>Available Stylists</Text>

        {stylistTools.map((tool) => (
          <TouchableOpacity
            key={tool.title}
            onPress={() => openTool(tool)}
            disabled={tool.status === "soon"}
            style={[toolCard, tool.status === "soon" && disabledToolCard]}
          >
            <View style={toolIcon}>
              <Ionicons name={tool.icon} size={24} color="#6D28D9" />
            </View>
            <View style={toolText}>
              <View style={toolTitleRow}>
                <Text style={toolTitle}>{tool.title}</Text>
                {tool.status === "soon" && (
                  <View style={soonBadge}>
                    <Text style={soonText}>Soon</Text>
                  </View>
                )}
              </View>
              <Text style={toolDescription}>{tool.description}</Text>
            </View>
            {tool.status === "ready" && (
              <Ionicons name="chevron-forward-outline" size={21} color="#9CA3AF" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#FFFFFF",
};

const container = {
  paddingHorizontal: 20,
  paddingTop: 55,
  paddingBottom: 36,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 18,
};

const headerText = {
  flex: 1,
};

const iconButton = {
  width: 42,
  height: 42,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const title = {
  fontSize: 22,
  fontWeight: "bold" as const,
  color: "#111827",
};

const subtitle = {
  marginTop: 3,
  fontSize: 13,
  color: "#6B7280",
};

const intro = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 18,
};

const introIcon = {
  width: 48,
  height: 48,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 12,
};

const introTitle = {
  fontSize: 21,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 7,
};

const introText = {
  color: "#4B5563",
  fontSize: 14,
  lineHeight: 20,
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 12,
};

const toolCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  backgroundColor: "#FFFFFF",
};

const disabledToolCard = {
  opacity: 0.6,
};

const toolIcon = {
  width: 48,
  height: 48,
  borderRadius: 8,
  backgroundColor: "#FAF5FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const toolText = {
  flex: 1,
};

const toolTitleRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  marginBottom: 4,
};

const toolTitle = {
  color: "#111827",
  fontWeight: "bold" as const,
  fontSize: 15,
  flexShrink: 1,
};

const toolDescription = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
};

const soonBadge = {
  backgroundColor: "#F3F4F6",
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 3,
};

const soonText = {
  color: "#6B7280",
  fontSize: 10,
  fontWeight: "bold" as const,
};

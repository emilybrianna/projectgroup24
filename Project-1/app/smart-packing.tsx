import { ProductImage } from "@/components/ProductImage";
import { addCartItem } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Product = {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  price: number;
  image_url: string | null;
  size: string | null;
  color: string | null;
  occasion: string | null;
  material: string | null;
  weather_tag: string | null;
};

type DayPlan = {
  day: number;
  title: string;
  note: string;
  items: Product[];
};

type WearerType = "Men" | "Women" | "Kids";

const productTypesByWearer: Record<WearerType, string[]> = {
  Men: ["men tops", "men bottoms"],
  Women: ["women tops", "women dresses", "women bottoms"],
  Kids: ["kids tops", "kids bottoms"],
};

const productCategoryByWearer: Record<WearerType, string> = {
  Men: "men",
  Women: "women",
  Kids: "kids",
};

const getWearerType = (value: string): WearerType | null => {
  const text = value.trim().toLowerCase();

  if (["men", "man", "male", "boy"].includes(text)) {
    return "Men";
  }

  if (["women", "woman", "female", "girl", "lady"].includes(text)) {
    return "Women";
  }

  if (["kids", "kid", "child", "children"].includes(text)) {
    return "Kids";
  }

  return null;
};

const filterProductsByWearer = (
  products: Product[],
  wearerType: WearerType
) =>
  products.filter((product) => {
    const type = String(product.type || "").trim().toLowerCase();
    const category = String(product.category || "").trim().toLowerCase();

    return (
      productTypesByWearer[wearerType].includes(type) &&
      category === productCategoryByWearer[wearerType]
    );
  });

const getWeatherCondition = (weatherCode: number) => {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return "rainy";
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return "stormy";
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return "cloudy";
  }

  return "sunny";
};

const buildFallbackWeatherSummary = (destination: string) => {
  const destinationText = destination.toLowerCase();
  const month = new Date().toLocaleString("en", { month: "long" });

  if (/tokyo|seoul|london|paris|winter|cold/.test(destinationText)) {
    return `Since no travel date was entered, SmartFash is using ${month}'s general weather outlook for ${destination}. Expect cooler mixed weather around 18-24C, so comfortable layers are recommended.`;
  }

  return `Since no travel date was entered, SmartFash is using ${month}'s general weather outlook for ${destination}. Expect warm tropical weather around 26-32C, so light and breathable clothing is recommended.`;
};

const isValidDestinationInput = (value: string) => {
  const cleanedValue = value.trim();

  return cleanedValue.length >= 3 && /[a-zA-Z]{3,}/.test(cleanedValue);
};

const fetchMonthlyWeatherSummary = async (destination: string) => {
  const month = new Date().toLocaleString("en", { month: "long" });

  try {
    const placeResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`
    );
    const placeData = await placeResponse.json();
    const place = placeData.results?.[0];

    if (!place) {
      throw new Error(`We could not find "${destination}". Please enter a valid city or destination name.`);
    }

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=16&timezone=auto`
    );
    const weatherData = await weatherResponse.json();
    const maxTemps = weatherData.daily?.temperature_2m_max || [];
    const minTemps = weatherData.daily?.temperature_2m_min || [];
    const weatherCodes = weatherData.daily?.weather_code || [];

    if (maxTemps.length === 0) {
      return buildFallbackWeatherSummary(destination);
    }

    const averageMax = Math.round(
      maxTemps.reduce((total: number, value: number) => total + Number(value || 0), 0) / maxTemps.length
    );
    const averageMin = Math.round(
      minTemps.reduce((total: number, value: number) => total + Number(value || 0), 0) / minTemps.length
    );
    const rainyDays = weatherCodes.filter((code: number) => getWeatherCondition(Number(code)) === "rainy").length;
    const mainCondition = rainyDays >= Math.ceil(weatherCodes.length / 3)
      ? "mostly rainy"
      : getWeatherCondition(Number(weatherCodes[0] || 0));
    const advice = rainyDays > 0
      ? "quick-dry fabrics and covered accessories are useful"
      : averageMax >= 31
        ? "light, breathable fabrics are the safest choice"
        : "easy layers and comfortable daily pieces should work well";

    return `Since no travel date was entered, SmartFash is using ${month}'s current weather outlook for ${destination}. Expect ${mainCondition} weather around ${averageMin}-${averageMax}C, so ${advice}.`;
  } catch {
    throw new Error(`We could not find weather for "${destination}". Please check the destination name and try again.`);
  }
};

const inferRole = (product: Product) => {
  const type = String(product.type || "").trim().toLowerCase();

  if (type === "women dresses") {
    return "One-piece";
  }

  if (type === "women bottoms" || type === "men bottoms" || type === "kids bottoms") {
    return "Bottom";
  }

  if (type === "women tops" || type === "men tops" || type === "kids tops") {
    return "Top";
  }

  const text = `${product.name} ${product.category || ""}`.toLowerCase();

  if (/jacket|coat|blazer|cardigan|hoodie|sweater|outerwear|overshirt|vest/.test(text)) {
    return "Outerwear";
  }

  if (/bag|cap|hat|belt|necklace|earring|bracelet|ring|scarf|clip|socks|case|wallet|accessor/.test(text)) {
    return "Accessory";
  }

  if (/dress|jumpsuit/.test(text)) {
    return "One-piece";
  }

  if (/pants|jeans|shorts|skirt|leggings|trousers|bottom|culottes|jogger/.test(text)) {
    return "Bottom";
  }

  return "Top";
};

const getTripMood = (destination: string, occasion: string) => {
  const tripText = occasion.toLowerCase();
  const destinationText = destination.toLowerCase();

  if (/business|work|conference|meeting|formal|office|interview/.test(tripText)) {
    return {
      title: "Smart Travel Outfit",
      note: "Keep the outfit polished but comfortable for long travel days.",
      keywords: ["formal", "smart", "work", "shirt", "blouse", "trouser", "blazer", "office"],
    };
  }

  if (/dinner|date|party|event|wedding|celebration|night/.test(tripText)) {
    return {
      title: "Dressy Evening Outfit",
      note: "Choose polished pieces that still pack easily and match simple accessories.",
      keywords: ["smart", "blouse", "shirt", "dress", "skirt", "black", "drape", "polo"],
    };
  }

  if (/hiking|outdoor|adventure|camping|sports|active/.test(tripText)) {
    return {
      title: "Outdoor Travel Outfit",
      note: "Pick practical layers and easy-care pieces for active movement.",
      keywords: ["outdoor", "hoodie", "jacket", "cotton", "dry", "shorts", "pants", "cap"],
    };
  }

  if (/winter|snow|cold/.test(tripText) || /korea|japan|tokyo|seoul|london|paris/.test(destinationText)) {
    return {
      title: "Layered Travel Outfit",
      note: "Pack layers that can handle cooler weather and indoor comfort.",
      keywords: ["jacket", "hoodie", "sweater", "coat", "jeans", "warm"],
    };
  }

  if (/beach|island|holiday|vacation|summer|hot|casual|sightseeing/.test(tripText) || /penang|langkawi|bali|phuket/.test(destinationText)) {
    return {
      title: "Light Holiday Outfit",
      note: "Choose breathable pieces for walking, sightseeing, and warm weather.",
      keywords: ["holiday", "casual", "summer", "cotton", "linen", "shorts", "tee", "sandal"],
    };
  }

  return {
    title: "Easy Travel Outfit",
    note: "Use simple matching pieces that can be repeated across the trip.",
    keywords: ["casual", "travel", "cotton", "shirt", "pants", "bag"],
  };
};

const scoreProduct = (product: Product, keywords: string[]) => {
  const text = [
    product.name,
    product.type,
    product.category,
    product.occasion,
    product.material,
    product.weather_tag,
    product.color,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
};

const pickByRole = (
  products: Product[],
  role: ReturnType<typeof inferRole>,
  dayIndex: number,
  keywords: string[],
  runSeed: number,
  preferBestMatch = false
) => {
  const matches = products
    .filter((product) => inferRole(product) === role)
    .sort((first, second) => {
      const scoreDifference = scoreProduct(second, keywords) - scoreProduct(first, keywords);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return String(first.id).localeCompare(String(second.id));
    });

  if (matches.length === 0) {
    return null;
  }

  if (preferBestMatch) {
    const bestScore = scoreProduct(matches[0], keywords);
    const bestMatches = matches.filter((product) => scoreProduct(product, keywords) === bestScore);
    const pool = bestMatches.length > 1 ? bestMatches : matches.slice(0, Math.min(3, matches.length));

    return pool[dayIndex % pool.length];
  }

  return matches[(dayIndex + runSeed) % matches.length];
};

const buildDayPlans = (
  products: Product[],
  destination: string,
  occasion: string,
  days: number,
  runSeed: number
): DayPlan[] => {
  const mood = getTripMood(destination, occasion);
  const preferBestMatch = /business|work|conference|meeting|formal|office|interview/i.test(occasion);

  return Array.from({ length: days }, (_, index) => {
    const onePiece = pickByRole(products, "One-piece", index, mood.keywords, runSeed, preferBestMatch);
    const top = pickByRole(products, "Top", index, mood.keywords, runSeed, preferBestMatch);
    const bottom = pickByRole(products, "Bottom", index, mood.keywords, runSeed, preferBestMatch);
    const outerwear = pickByRole(products, "Outerwear", index, mood.keywords, runSeed, preferBestMatch);
    const accessory = pickByRole(products, "Accessory", index, mood.keywords, runSeed, preferBestMatch);
    const useOnePiece = Boolean(
      onePiece && (!top || !bottom || (!preferBestMatch && days > 2 && index === days - 1))
    );
    const mainItems = useOnePiece ? [onePiece] : [top, bottom];
    const extras = index % 2 === 0 ? [accessory] : [outerwear, accessory];
    const items = [...mainItems, ...extras].filter(Boolean) as Product[];

    return {
      day: index + 1,
      title: `${mood.title} ${index + 1}`,
      note: mood.note,
      items,
    };
  });
};

const getFirstParagraph = (value: string, fallback: string) => {
  const paragraph = value
    .replace(/\*\*/g, "")
    .split(/\n\s*\n|\n(?=Clothing|Outfit|Colors|Materials|Day\s+\d)/i)[0]
    .trim();

  return paragraph || fallback;
};

export default function SmartPacking() {
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState("");
  const [wearer, setWearer] = useState("");
  const [occasion, setOccasion] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [weatherSummary, setWeatherSummary] = useState("");
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);

  const fetchShopProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,type,category,price,image_url,size,color,occasion,material,weather_tag")
      .neq("is_active", false)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      Alert.alert("Products Error", error.message);
      return [];
    }

    return (data || []) as Product[];
  };

  const addDayToCart = async (plan: DayPlan) => {
    if (plan.items.length === 0) {
      Alert.alert("No Products", "No shop products were found for this day.");
      return;
    }

    for (const product of plan.items) {
      await addCartItem({
        id: product.id,
        name: product.name,
        size: product.size || "",
        color: product.color || "",
        price: Number(product.price || 0),
      });
    }

    Alert.alert("Added to Cart", `Day ${plan.day} outfit products have been added to your cart.`);
  };

  const generatePacking = async () => {
    const trimmedDestination = destination.trim();
    const trimmedDuration = duration.trim();
    const trimmedWearer = wearer.trim();
    const trimmedOccasion = occasion.trim();
    const tripDays = Math.min(Math.max(Number.parseInt(trimmedDuration, 10) || 1, 1), 10);

    if (!trimmedDestination || !trimmedDuration || !trimmedWearer) {
      Alert.alert("Missing Details", "Please enter destination, trip duration, and who you are packing for.");
      return;
    }

    if (!isValidDestinationInput(trimmedDestination)) {
      Alert.alert("Invalid Destination", "Please enter a valid city or destination name, for example Penang or Tokyo.");
      return;
    }

    const wearerType = getWearerType(trimmedWearer);

    if (!wearerType) {
      Alert.alert("Invalid Selection", "Please enter Men, Women, or Kids for who you are packing for.");
      return;
    }

    setLoading(true);
    setRecommendation("");
    setWeatherSummary("");
    setDayPlans([]);

    let products: Product[] = [];
    let nextWeatherSummary = "";

    try {
      [products, nextWeatherSummary] = await Promise.all([
        fetchShopProducts(),
        fetchMonthlyWeatherSummary(trimmedDestination),
      ]);

    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Destination could not be found. Please check the spelling and try again.";

      setLoading(false);
      Alert.alert("Destination Not Found", message);
      return;
    }

    const filteredProducts = filterProductsByWearer(products, wearerType);

    if (filteredProducts.length === 0) {
      setLoading(false);
      Alert.alert("No Products Found", `No ${wearerType} products were found in the database.`);
      return;
    }

    const runSeed = Math.floor(Math.random() * 1000);
    const plans = buildDayPlans(filteredProducts, trimmedDestination, trimmedOccasion, tripDays, runSeed);
    setWeatherSummary(nextWeatherSummary);
    setDayPlans(plans);

    const prompt = `

Destination: ${trimmedDestination}
Trip duration: ${tripDays} days
Packing for: ${wearerType}
Trip type / occasion: ${trimmedOccasion || "general travel"}
`;

    const { data, error } = await supabase.functions.invoke("ai-stylist-chat", {
      body: {
        message: prompt,
        products: filteredProducts.map((product) => ({
          name: product.name,
          type: product.type,
          price: product.price,
          category: product.category,
          color: product.color,
          size: product.size,
          occasion: product.occasion,
          material: product.material,
        })),
        cartItems: [],
        cartContext: "Packing assistant request.",
        history: [],
      },
    });

    setLoading(false);

    const fallbackIntro = `Hello! I'm your SmartFash AI Stylist. For your ${tripDays}-day ${trimmedOccasion || "trip"} in ${trimmedDestination}, here is a day-by-day packing guide with shop products you can add to cart.`;

    if (error) {
      setRecommendation(fallbackIntro);
      return;
    }

    setRecommendation(getFirstParagraph(String(data?.reply || ""), fallbackIntro));
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <Text style={title}>Smart Packing Assistant</Text>
        </View>

        <Text style={label}>Destination</Text>
        <TextInput
          placeholder="Example: Tokyo, Japan"
          value={destination}
          onChangeText={setDestination}
          style={input}
        />

        <Text style={label}>Duration</Text>
        <TextInput
          placeholder="Example: 5 Days"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          style={input}
        />

        <Text style={label}>For who</Text>
        <TextInput
          placeholder="Example: Men, Women, or Kids"
          value={wearer}
          onChangeText={setWearer}
          style={input}
        />

        <Text style={label}>Trip Type</Text>
        <TextInput
          placeholder="Example: beach holiday, business trip, winter vacation"
          value={occasion}
          onChangeText={setOccasion}
          style={input}
        />

        <TouchableOpacity onPress={generatePacking} style={button} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={buttonText}>Generate Packing List</Text>
          )}
        </TouchableOpacity>

        {weatherSummary ? (
          <View style={weatherBox}>
            <View style={weatherHeader}>
              <Ionicons name="partly-sunny-outline" size={18} color="#6D28D9" />
              <Text style={weatherTitle}>This Month Weather</Text>
            </View>
            <Text style={weatherPlace}>{destination.trim()}</Text>
            <Text style={weatherText}>{weatherSummary}</Text>
          </View>
        ) : null}


        {dayPlans.map((plan) => (
          <View key={plan.day} style={dayCard}>
            <View style={dayHeader}>
              <View style={dayHeaderText}>
                <Text style={dayTitle}>Day {plan.day}</Text>
                <Text style={daySubtitle}>{plan.title}</Text>
              </View>
              <TouchableOpacity onPress={() => addDayToCart(plan)} style={cartButton}>
                <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                <Text style={cartButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            <Text style={dayNote}>{plan.note}</Text>

            {plan.items.length > 0 ? (
              plan.items.map((product) => (
                <View key={`${plan.day}-${product.id}`} style={tableRow}>
                  <Text style={[roleText, roleColumn]}>{inferRole(product)}</Text>
                  <View style={[productCell, productColumn]}>
                    <View style={productImageBox}>
                      <ProductImage uri={product.image_url} style={productImage} iconSize={18} />
                    </View>
                    <View style={productTextBox}>
                      <Text style={productName} numberOfLines={2}>{product.name}</Text>
                      <Text style={productMeta} numberOfLines={1}>
                        {[product.type, product.color, product.size].filter(Boolean).join(" - ") || "SmartFash item"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[priceText, priceColumn]}>RM {Number(product.price || 0).toFixed(2)}</Text>
                </View>
              ))
            ) : (
              <View style={emptyProductsBox}>
                <Text style={emptyProductsText}>No active shop products found for this day.</Text>
              </View>
            )}
          </View>
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
  paddingBottom: 40,
};

const header = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 24,
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

const label = {
  fontSize: 14,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 8,
};

const input = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 16,
  backgroundColor: "#FFFFFF",
};

const button = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  padding: 16,
  alignItems: "center" as const,
  marginTop: 8,
};

const buttonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

const weatherBox = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  borderRadius: 8,
  padding: 14,
  marginTop: 18,
  backgroundColor: "#FAF5FF",
};

const weatherHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  marginBottom: 5,
};

const weatherTitle = {
  color: "#111827",
  fontSize: 15,
  fontWeight: "bold" as const,
};

const weatherPlace = {
  color: "#6B7280",
  fontSize: 12,
  marginBottom: 8,
};

const weatherText = {
  color: "#374151",
  fontSize: 13,
  lineHeight: 19,
};

const resultBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginTop: 20,
  backgroundColor: "#FAF5FF",
};

const resultTitle = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 8,
};

const resultText = {
  color: "#374151",
  fontSize: 14,
  lineHeight: 21,
};

const dayCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginTop: 14,
  backgroundColor: "#FFFFFF",
};

const dayHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 10,
};

const dayHeaderText = {
  flex: 1,
};

const dayTitle = {
  color: "#111827",
  fontSize: 16,
  fontWeight: "bold" as const,
};

const daySubtitle = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "700" as const,
  marginTop: 2,
};

const cartButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 9,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 5,
};

const cartButtonText = {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "bold" as const,
};

const dayNote = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
  marginTop: 8,
  marginBottom: 12,
};

const tableRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  borderBottomWidth: 1,
  borderBottomColor: "#F3F4F6",
  paddingVertical: 10,
  paddingHorizontal: 8,
};

const roleColumn = {
  width: 72,
};

const productColumn = {
  flex: 1,
};

const priceColumn = {
  width: 62,
  textAlign: "right" as const,
};

const roleText = {
  color: "#6B7280",
  fontSize: 11,
  fontWeight: "700" as const,
};

const productCell = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  
};

const productImageBox = {
  width: 38,
  height: 38,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  overflow: "hidden" as const,
};

const productImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const productTextBox = {
  flex: 1,
};

const productName = {
  color: "#111827",
  fontSize: 12,
  fontWeight: "700" as const,
};

const productMeta = {
  color: "#6B7280",
  fontSize: 10,
  marginTop: 2,
};

const priceText = {
  color: "#111827",
  fontSize: 11,
  fontWeight: "bold" as const,
};

const emptyProductsBox = {
  padding: 14,
  alignItems: "center" as const,
};

const emptyProductsText = {
  color: "#6B7280",
  fontSize: 12,
};

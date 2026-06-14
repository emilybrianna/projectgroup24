import { ProductImage } from "@/components/ProductImage";
import { addCartItem } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  size: string | null;
  color: string | null;
  is_featured: boolean | null;
};

type WeatherInfo = {
  temperature: number;
  condition: string;
  locationName: string;
  icon: "rainy-outline" | "partly-sunny-outline" | "sunny-outline";
};

const getWeatherIcon = (weatherCode: number): WeatherInfo["icon"] => {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
    return "rainy-outline";
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return "partly-sunny-outline";
  }

  return "sunny-outline";
};

const getWeatherCondition = (weatherCode: number) => {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return "Rain expected";
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return "Thunderstorm";
  }

  if ([1, 2, 3].includes(weatherCode)) {
    return "Partly cloudy";
  }

  return "Clear";
};

export default function Homepage() {
  const [searchText, setSearchText] = useState("");
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [weather, setWeather] = useState<WeatherInfo>({
    temperature: 31,
    condition: "Warm",
    locationName: "Kuala Lumpur",
    icon: "sunny-outline",
  });

  useEffect(() => {
    fetchWeather();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRecommendedProducts();
    }, [])
  );

  const fetchRecommendedProducts = async () => {
    setLoadingProducts(true);

    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,image_url,size,color,is_featured")
      .neq("is_active", false)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      Alert.alert("Error", error.message);
      setRecommendedProducts([]);
      setLoadingProducts(false);
      return;
    }

    setRecommendedProducts((data || []) as Product[]);
    setLoadingProducts(false);
  };

  const searchProducts = () => {
    router.push({
      pathname: "/product",
      params: { search: searchText.trim() },
    });
  };

  const fetchWeather = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      let latitude = 3.1412;
      let longitude = 101.6865;
      let locationName = "Kuala Lumpur";

      if (permission.status === "granted") {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = currentLocation.coords.latitude;
        longitude = currentLocation.coords.longitude;
        locationName = "Your area";
      }

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
      );
      const data = await response.json();
      const temperature = Number(data.current?.temperature_2m || 31);
      const weatherCode = Number(data.current?.weather_code || 0);

      setWeather({
        temperature,
        condition: getWeatherCondition(weatherCode),
        locationName,
        icon: getWeatherIcon(weatherCode),
      });
    } catch {
      setWeather({
        temperature: 31,
        condition: "Warm",
        locationName: "Kuala Lumpur",
        icon: "sunny-outline",
      });
    }
  };

  return (
    <View style={page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={container}
      >
        <View style={header}>
          <View style={logoBox}>
            <Ionicons name="cube-outline" size={22} color="#6D28D9" />
            <Text style={brand}>SMARTFASH</Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={searchBox}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Search clothes..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={searchProducts}
            style={searchInput}
          />
          <TouchableOpacity onPress={searchProducts} style={searchIconButton}>
            <Ionicons name="search-outline" size={18} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={heroTitle}>What's</Text>
            <Text style={heroPurple}>My AI Style?</Text>

            <Text style={heroText}>
              Outfits created for you based on your style, preference and the
              weather.
            </Text>

            <TouchableOpacity
              style={heroButton}
              onPress={() =>
                router.push({
                  pathname: "/ai-outfit",
                })
              }
            >
              <Text style={heroButtonText}>See My Outfits</Text>
            </TouchableOpacity>
          </View>

          <Image
            source={{
              uri: "https://i.pinimg.com/736x/e1/e4/30/e1e430a3f8e1089ceeaab5cffd39e7ce.jpg",
            }}
            style={heroImage}
          />

          <View style={weatherBox}>
            <Ionicons name={weather.icon} size={14} color="#6D28D9" />
            <View>
              <Text style={weatherTemp}>{Math.round(weather.temperature)}°C</Text>
              <Text style={weatherPlace}>{weather.locationName} · {weather.condition}</Text>
            </View>
          </View>
        </View>

        <View style={sectionHeader}>
          <Text style={sectionTitle}>Recommended For You</Text>

          <TouchableOpacity onPress={() => router.push("/product")}>
            <Text style={viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {loadingProducts ? (
          <View style={loadingProductsBox}>
            <ActivityIndicator color="#6D28D9" />
          </View>
        ) : recommendedProducts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ScrollView>
        ) : (
          <View style={emptyProductsBox}>
            <Text style={emptyProductsText}>No products available.</Text>
          </View>
        )}

        <View style={sectionHeader}>
          <Text style={sectionTitle}>Categories</Text>

          <TouchableOpacity onPress={() => router.push("/categories")}>
            <Text style={viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Category label="Men" />
          <Category label="Women" />
          <Category label="Kids" />
        </ScrollView>
      </ScrollView>

      <View style={bottomNav}>
        <NavItem
          icon="home"
          label="Home"
          active
          onPress={() => router.push("/homepage")}
        />
        <NavItem
          icon="receipt-outline"
          label="Orders"
          onPress={() => router.push("/order-history" as any)}
        />
        <NavItem
          icon="cart-outline"
          label="Cart"
          onPress={() => router.push("/cart")}
        />
        <NavItem
          icon="sparkles-outline"
          label="AI Stylist"
          onPress={() => router.push("/ai-outfit")}
        />
        <NavItem
          icon="person-outline"
          label="Profile"
          onPress={() => router.push("/profile")}
        />
      </View>

      <TouchableOpacity onPress={() => router.push("/chat")} style={chatFab}>
        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" />
        <Text style={chatFabText}>Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProductCard({ product }: { product: Product }) {
  const handleAddToCart = async () => {
    await addCartItem({
      id: product.id,
      name: product.name,
      size: product.size || "",
      color: product.color || "",
      price: Number(product.price),
    });

    Alert.alert("Added to Cart", `${product.name} has been added to your cart.`);
  };

  return (
    <TouchableOpacity
      style={productCard}
      onPress={() =>
        router.push({
          pathname: "/product-details",
          params: { id: product.id },
        })
      }
    >
      <View style={emptyImageBox}>
        <ProductImage uri={product.image_url} style={productImage} iconSize={28} />
      </View>

      <Text style={productName} numberOfLines={2}>{product.name}</Text>

      <View style={productBottom}>
        <Text style={productPrice}>RM {Number(product.price).toFixed(2)}</Text>
        <TouchableOpacity
          onPress={(event) => {
            event.stopPropagation();
            handleAddToCart();
          }}
          style={smallCartButton}
        >
          <Ionicons name="cart-outline" size={16} color="#6D28D9" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function Category({ label }: any) {
  return (
    <TouchableOpacity
      style={categoryBox}
      onPress={() => router.push("/categories")}
    >
      <Text style={categoryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function NavItem({ icon, label, active, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={navItem}>
      <Ionicons name={icon} size={22} color={active ? "#6D28D9" : "#6B7280"} />

      <Text
        style={[
          navText,
          active && { color: "#6D28D9", fontWeight: "bold" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#F8FAFC",
};

const container = {
  paddingHorizontal: 20,
  paddingTop: 55,
  paddingBottom: 100,
};

const header = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 22,
};

const logoBox = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
};

const brand = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#111827",
};

const searchBox = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 12,
  paddingLeft: 14,
  paddingRight: 6,
  marginBottom: 20,
};

const searchInput = {
  flex: 1,
  paddingVertical: 12,
  marginLeft: 8,
};

const searchIconButton = {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "#F3E8FF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const heroCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 18,
  padding: 24,
  minHeight: 260,
  flexDirection: "row" as const,
  overflow: "hidden" as const,
  position: "relative" as const,
  marginBottom: 28,
  shadowColor: "#111827",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
};

const heroTitle = {
  fontSize: 21,
  fontWeight: "bold" as const,
  color: "#111827",
};

const heroPurple = {
  fontSize: 23,
  fontWeight: "bold" as const,
  color: "#6D28D9",
  marginBottom: 10,
};

const heroText = {
  fontSize: 14,
  color: "#4B5563",
  lineHeight: 21,
  marginBottom: 18,
};

const heroButton = {
  backgroundColor: "#6D28D9",
  paddingVertical: 12,
  paddingHorizontal: 19,
  borderRadius: 8,
  alignSelf: "flex-start" as const,
};

const heroButtonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
  fontSize: 12,
};

const heroImage = {
  width: 125,
  height: 210,
  borderRadius: 14,
  marginLeft: 10,
};

const weatherBox = {
  position: "absolute" as const,
  right: 18,
  bottom: 18,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 6,
  paddingHorizontal: 7,
  paddingVertical: 6,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
};

const weatherTemp = {
  fontSize: 12,
  fontWeight: "bold" as const,
  color: "#111827",
};

const weatherPlace = {
  fontSize: 9,
  color: "#6B7280",
};

const sectionHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 12,
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#111827",
};

const viewAll = {
  fontSize: 12,
  color: "#6D28D9",
  fontWeight: "600" as const,
};

const productCard = {
  width: 136,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 12,
  padding: 8,
  marginRight: 14,
  marginBottom: 22,
};

const emptyImageBox = {
  width: "100%" as const,
  height: 120,
  borderRadius: 10,
  backgroundColor: "#F3F4F6",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  overflow: "hidden" as const,
};

const productImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const productName = {
  fontSize: 12,
  fontWeight: "600" as const,
  color: "#111827",
  marginTop: 8,
};

const productBottom = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginTop: 4,
};

const productPrice = {
  fontSize: 12,
  fontWeight: "bold" as const,
  color: "#111827",
};

const smallCartButton = {
  width: 28,
  height: 28,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const loadingProductsBox = {
  height: 170,
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const emptyProductsBox = {
  height: 120,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  backgroundColor: "#F9FAFB",
  borderRadius: 14,
  marginBottom: 22,
};

const emptyProductsText = {
  color: "#6B7280",
  fontSize: 13,
};

const categoryBox = {
  width: 95,
  height: 78,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 12,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginRight: 12,
};

const categoryText = {
  fontSize: 14,
  color: "#111827",
  fontWeight: "bold" as const,
};

const bottomNav = {
  position: "absolute" as const,
  bottom: 12,
  left: 16,
  right: 16,
  height: 72,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 18,
  flexDirection: "row" as const,
  justifyContent: "space-around" as const,
  alignItems: "center" as const,
  shadowColor: "#111827",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 4,
};

const chatFab = {
  position: "absolute" as const,
  right: 22,
  bottom: 98,
  width: 70,
  height: 54,
  borderRadius: 27,
  backgroundColor: "#6D28D9",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  shadowColor: "#111827",
  shadowOpacity: 0.22,
  shadowRadius: 10,
  elevation: 6,
  zIndex: 20,
};

const chatFabText = {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "bold" as const,
  marginTop: 1,
};

const navItem = {
  alignItems: "center" as const,
};

const navText = {
  fontSize: 10,
  color: "#6B7280",
  marginTop: 4,
};


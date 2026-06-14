import { Ionicons } from "@expo/vector-icons";
import {
  applyRememberedSessionToStorage,
  clearRememberedSession,
  clearSignedOutToLanding,
  getRememberedSession,
  isSignedOutToLanding,
} from "@/lib/remember-session";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "style",
    title: "SmartFash",
    subtitle: "Discover outfits that match your style, mood, and daily plan.",
    image:
      "https://i.pinimg.com/736x/7f/b5/1d/7fb51d217265dd3205e20cd53760d396.jpg",
    icon: "sparkles-outline",
  },
  {
    id: "shop",
    title: "Shop Faster",
    subtitle: "Browse products, compare looks, and add your favourites to cart.",
    image:
      "https://i.pinimg.com/736x/87/c3/ad/87c3adce1fcca618aa6da4da5f0f24c7.jpg",
    icon: "bag-handle-outline",
  },
  {
    id: "ai",
    title: "AI Outfit Ideas",
    subtitle: "Get outfit recommendations for weather, occasion, and colour.",
    image:
      "https://i.pinimg.com/736x/ce/5d/09/ce5d090e3857c7be5444ffcb3bd3e5c8.jpg" ,
    icon: "color-wand-outline",
  },
];

export default function Index() {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);

  const isLastSlide = activeIndex === slides.length - 1;

  const resumeRememberedSession = async () => {
    const shouldResumeRememberedSession = await isSignedOutToLanding();

    if (!shouldResumeRememberedSession) {
      router.push("/customer");
      return;
    }

    const session = await getRememberedSession();

    if (!session) {
      await clearSignedOutToLanding();
      router.replace("/customer");
      return;
    }

    await applyRememberedSessionToStorage(session);
    await clearRememberedSession();

    if (session.role === "admin") {
      router.replace("/admin");
    } else if (session.role === "staff") {
      router.replace("/staff");
    } else {
      router.replace("/homepage");
    }
  };

  const handleScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  const goNext = () => {
    if (isLastSlide) {
      resumeRememberedSession();
      return;
    }

    listRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
  };

  return (
    <View style={styles.page}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <ImageBackground
            source={{ uri: item.image }}
            style={styles.slide}
            imageStyle={styles.slideImage}
          >
            <View style={styles.overlay} />

            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Ionicons name="cube-outline" size={22} color="#6D28D9" />
              </View>
              <Text style={styles.brand}>SMARTFASH</Text>
            </View>

            <View style={styles.content}>
              <View style={styles.iconBadge}>
                <Ionicons name={item.icon as any} size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </ImageBackground>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.dot, activeIndex === index && styles.activeDot]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.push("/customer")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goNext} style={styles.primaryButton}>
            <Text style={styles.primaryText}>
              {isLastSlide ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={isLastSlide ? "checkmark" : "arrow-forward"}
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 62,
    paddingBottom: 176,
    justifyContent: "space-between",
  },
  slideImage: {
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.46)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  content: {
    maxWidth: 330,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "900",
    marginBottom: 12,
  },
  subtitle: {
    color: "#F9FAFB",
    fontSize: 17,
    lineHeight: 26,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 34,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  activeDot: {
    width: 28,
    backgroundColor: "#6D28D9",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#6D28D9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});

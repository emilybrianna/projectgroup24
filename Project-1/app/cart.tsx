import {
  addCartItem,
  CartItem,
  clearCartItems,
  getCartItems,
  saveCartItems,
} from "@/lib/cart";
import { ProductImage } from "@/components/ProductImage";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
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
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  size: string | null;
  color: string | null;
  occasion: string | null;
  material: string | null;
  weather_tag: string | null;
  is_active: boolean | null;
};

const inferRole = (item: Pick<Product, "name" | "type"> | Pick<CartItem, "name">) => {
  const text = "type" in item ? `${item.name} ${item.type || ""}` : item.name;
  const normalized = text.toLowerCase();

  if (/bag|cap|hat|belt|necklace|earring|bracelet|ring|scarf|clip|socks|case|wallet|accessor|sunglasses/.test(normalized)) {
    return "accessory";
  }

  if (/pants|jeans|shorts|skirt|leggings|trousers|bottom|culottes|jogger/.test(normalized)) {
    return "bottom";
  }

  return "top";
};

const getSuggestionScore = (cartProducts: Product[], cartItems: CartItem[], candidate: Product) => {
  let score = 0;
  const cartRoles = new Set(
    cartProducts.length > 0
      ? cartProducts.map((item) => inferRole(item))
      : cartItems.map((item) => inferRole(item))
  );

  const candidateRole = inferRole(candidate);

  if (cartRoles.has("top") && candidateRole === "bottom") score += 45;
  if (cartRoles.has("top") && candidateRole === "accessory") score += 34;
  if (cartRoles.has("bottom") && candidateRole === "top") score += 45;
  if (cartRoles.has("bottom") && candidateRole === "accessory") score += 34;
  if (cartRoles.has("accessory") && candidateRole !== "accessory") score += 38;

  const categories = new Set(cartProducts.map((item) => item.category).filter(Boolean));
  const occasions = new Set(cartProducts.map((item) => item.occasion).filter(Boolean));
  const colors = new Set(cartProducts.map((item) => item.color).filter(Boolean));

  if (candidate.category && categories.has(candidate.category)) score += 14;
  if (candidate.category === "Unisex") score += 10;
  if (candidate.occasion && occasions.has(candidate.occasion)) score += 15;
  if (candidate.weather_tag === "All weather") score += 8;
  if (candidate.color && colors.size > 0 && !colors.has(candidate.color)) score += 6;

  return score;
};

export default function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [cartProductMap, setCartProductMap] = useState<Record<string, Product>>({});
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [rewardsExpanded, setRewardsExpanded] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [useRewards, setUseRewards] = useState(false);

  const fetchCartSuggestions = useCallback(async (items: CartItem[]) => {
    if (items.length === 0) {
      setSuggestions([]);
      return;
    }

    const cartIds = items.map((item) => String(item.id));

    const { data: cartData } = await supabase
      .from("products")
      .select("id,name,type,category,description,price,image_url,stock,size,color,occasion,material,weather_tag,is_active")
      .in("id", cartIds);

    const cartProducts = (cartData || []) as Product[];
    setCartProductMap(
      Object.fromEntries(cartProducts.map((product) => [String(product.id), product]))
    );

    const { data, error } = await supabase
      .from("products")
      .select("id,name,type,category,description,price,image_url,stock,size,color,occasion,material,weather_tag,is_active")
      .neq("is_active", false)
      .not("id", "in", `(${cartIds.join(",")})`)
      .limit(60);

    if (error) {
      setSuggestions([]);
      return;
    }

    const ranked = ((data || []) as Product[])
      .map((candidate) => ({
        product: candidate,
        score: getSuggestionScore(cartProducts, items, candidate),
      }))
      .filter(({ score }) => score >= 30)
      .sort((first, second) => second.score - first.score)
      .slice(0, 5)
      .map(({ product }) => product);

    setSuggestions(ranked);
  }, []);

  const loadCartItems = useCallback(async () => {
    const items = await getCartItems();
    setCartItems(items);
    await fetchCartSuggestions(items);
  }, [fetchCartSuggestions]);

  useFocusEffect(
    useCallback(() => {
      loadCartItems();
    }, [loadCartItems])
  );

  const updateCartItems = async (items: CartItem[]) => {
    setCartItems(items);
    await saveCartItems(items);
    await fetchCartSuggestions(items);
  };

  const increaseQuantity = (id: CartItem["id"]) => {
    const nextItems = cartItems.map((item) =>
      item.id === id ? { ...item, quantity: item.quantity + 1 } : item
    );

    updateCartItems(nextItems);
  };

  const decreaseQuantity = (id: CartItem["id"]) => {
    const nextItems = cartItems
      .map((item) =>
        item.id === id ? { ...item, quantity: item.quantity - 1 } : item
      )
      .filter((item) => item.quantity > 0);

    updateCartItems(nextItems);
  };

  const removeItem = (id: CartItem["id"]) => {
    const nextItems = cartItems.filter((item) => item.id !== id);
    updateCartItems(nextItems);
  };

  const clearCart = () => {
    if (cartItems.length === 0) {
      return;
    }

    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setCartItems([]);
          setSuggestions([]);
          setCartProductMap({});
          await clearCartItems();
        },
      },
    ]);
  };

  const addSuggestedItem = async (item: Product) => {
    const nextItems = await addCartItem({
      id: item.id,
      name: item.name,
      size: item.size || "",
      color: item.color || "",
      price: Number(item.price),
    });

    setCartItems(nextItems);
    await fetchCartSuggestions(nextItems);
    Alert.alert("Added to Cart", `${item.name} has been added to your cart.`);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert("Cart Empty", "Please add an item before checkout.");
      return;
    }

    router.push("/checkout" as any);
  };

  const applyPromoCode = () => {
    const normalizedCode = promoCode.trim().toUpperCase();

    if (normalizedCode !== "SMART10") {
      Alert.alert("Invalid Promo Code", "Try SMART10 for 10% off your items.");
      setAppliedPromo("");
      return;
    }

    setAppliedPromo(normalizedCode);
    Alert.alert("Promo Applied", "SMART10 has been applied to your cart.");
  };

  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const deliveryFee = cartItems.length > 0 ? 8 : 0;
  const promoDiscount = appliedPromo ? subtotal * 0.1 : 0;
  const rewardsDiscount = useRewards && cartItems.length > 0 ? Math.min(5, subtotal) : 0;
  const total = Math.max(subtotal - promoDiscount - rewardsDiscount + deliveryFee, 0);

  return (
    <View style={page}>
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={title}>Cart</Text>

        <TouchableOpacity onPress={clearCart}>
          <Ionicons name="trash-outline" size={24} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={container}
      >
        {cartItems.length > 0 ? (
          cartItems.map((item) => {
            const cartProduct = cartProductMap[String(item.id)];

            return (
              <View key={item.id} style={cartCard}>
                <View style={imageBox}>
                  <ProductImage uri={cartProduct?.image_url} style={productImage} iconSize={32} />
                </View>

                <View style={itemInfo}>
                  <Text style={itemName}>{item.name}</Text>
                  <Text style={itemDetail}>
                    {item.color} / Size {item.size}
                  </Text>
                  <Text style={itemPrice}>RM {item.price.toFixed(2)}</Text>
                  <Text style={itemSubtotal}>
                    Subtotal: RM {(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>

                <View style={cartActions}>
                  <TouchableOpacity
                    onPress={() => removeItem(item.id)}
                    style={removeButton}
                  >
                    <Ionicons name="close-outline" size={17} color="#DC2626" />
                  </TouchableOpacity>

                  <View style={quantityBox}>
                    <TouchableOpacity
                      onPress={() => decreaseQuantity(item.id)}
                      style={quantityButton}
                    >
                      <Ionicons name="remove-outline" size={16} color="#111827" />
                    </TouchableOpacity>

                    <Text style={quantityText}>{item.quantity}</Text>

                    <TouchableOpacity
                      onPress={() => increaseQuantity(item.id)}
                      style={quantityButton}
                    >
                      <Ionicons name="add-outline" size={16} color="#111827" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={emptyBox}>
            <Ionicons name="cart-outline" size={46} color="#9CA3AF" />
            <Text style={emptyTitle}>Your cart is empty</Text>
            <Text style={emptyText}>Add clothes from Recommended For You or Shop.</Text>
            <TouchableOpacity
              onPress={() => router.push("/product")}
              style={shopButton}
            >
              <Text style={shopButtonText}>Go to Shop</Text>
            </TouchableOpacity>
          </View>
        )}

        {cartItems.length > 0 && suggestions.length > 0 && (
          <View style={suggestionBox}>
            <View style={suggestionHeader}>
              <View>
                <Text style={suggestionTitle}>Suggested add-ons</Text>
                <Text style={suggestionSubtitle}>Complete your outfit with matching items.</Text>
              </View>
              <Ionicons name="sparkles-outline" size={20} color="#6D28D9" />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={suggestionCard}
                  onPress={() =>
                    router.push({
                      pathname: "/product-details",
                      params: { id: item.id },
                    })
                  }
                >
                  <View style={suggestionImageBox}>
                    <ProductImage uri={item.image_url} style={productImage} iconSize={24} />
                  </View>
                  <Text style={suggestionRole}>{inferRole(item)}</Text>
                  <Text style={suggestionName} numberOfLines={2}>{item.name}</Text>
                  <Text style={suggestionPrice}>RM {Number(item.price).toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => addSuggestedItem(item)} style={suggestionButton}>
                    <Ionicons name="bag-add-outline" size={14} color="#FFFFFF" />
                    <Text style={suggestionButtonText}>Add</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={summaryBox}>
          <CartOptionRow
            icon="ticket-outline"
            label="Promo Code"
            expanded={promoExpanded}
            onPress={() => setPromoExpanded(!promoExpanded)}
          />

          {promoExpanded && (
            <View style={promoPanel}>
              <TextInput
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="Enter promo code"
                autoCapitalize="characters"
                style={promoInput}
              />
              <TouchableOpacity onPress={applyPromoCode} style={applyButton}>
                <Text style={applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          <CartOptionRow
            icon="wallet-outline"
            label="Loyalty Points / Earning Rewards"
            expanded={rewardsExpanded}
            onPress={() => setRewardsExpanded(!rewardsExpanded)}
          />

          {rewardsExpanded && (
            <TouchableOpacity
              onPress={() => setUseRewards(!useRewards)}
              style={rewardPanel}
            >
              <View>
                <Text style={rewardTitle}>Use RM 5.00 rewards</Text>
                <Text style={rewardText}>Available for orders with cart items.</Text>
              </View>
              <Ionicons
                name={useRewards ? "checkbox" : "square-outline"}
                size={22}
                color={useRewards ? "#6D28D9" : "#9CA3AF"}
              />
            </TouchableOpacity>
          )}

          <View style={summaryGap} />

          <SummaryRow label="Subtotal" value={`RM ${subtotal.toFixed(2)}`} />
          {promoDiscount > 0 && (
            <SummaryRow label={`Promo (${appliedPromo})`} value={`- RM ${promoDiscount.toFixed(2)}`} />
          )}
          {rewardsDiscount > 0 && (
            <SummaryRow label="Rewards" value={`- RM ${rewardsDiscount.toFixed(2)}`} />
          )}
          <SummaryRow label="Delivery" value={`RM ${deliveryFee.toFixed(2)}`} />

          <View style={divider} />

          <View style={summaryRow}>
            <Text style={totalLabel}>Total</Text>
            <Text style={totalValue}>RM {total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={footer}>
        <TouchableOpacity
          style={[checkoutButton, cartItems.length === 0 && disabledButton]}
          onPress={handleCheckout}
        >
          <Text style={checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: any) {
  return (
    <View style={summaryRow}>
      <Text style={summaryLabel}>{label}</Text>
      <Text style={summaryValue}>{value}</Text>
    </View>
  );
}

function CartOptionRow({ icon, label, expanded, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={optionRow}>
      <View style={optionLabelBox}>
        <Ionicons name={icon} size={18} color="#6B7280" />
        <Text style={optionLabel}>{label}</Text>
      </View>
      <Ionicons
        name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
        size={18}
        color="#111827"
      />
    </TouchableOpacity>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#FFFFFF",
};

const header = {
  paddingTop: 55,
  paddingHorizontal: 20,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 16,
};

const title = {
  fontSize: 20,
  fontWeight: "bold" as const,
  color: "#111827",
};

const container = {
  paddingHorizontal: 20,
  paddingBottom: 120,
};

const cartCard = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 18,
  padding: 12,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  marginBottom: 14,
};

const imageBox = {
  width: 86,
  height: 86,
  backgroundColor: "#F3F4F6",
  borderRadius: 14,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginRight: 12,
  overflow: "hidden" as const,
};

const productImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const itemInfo = {
  flex: 1,
};

const itemName = {
  fontSize: 14,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 5,
};

const itemDetail = {
  fontSize: 12,
  color: "#6B7280",
  marginBottom: 10,
};

const itemPrice = {
  fontSize: 13,
  fontWeight: "bold" as const,
  color: "#111827",
};

const itemSubtotal = {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 6,
};

const cartActions = {
  alignItems: "center" as const,
  gap: 10,
};

const removeButton = {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "#FEF2F2",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const quantityBox = {
  alignItems: "center" as const,
  gap: 8,
};

const quantityButton = {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: "#F3F4F6",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const quantityText = {
  fontSize: 13,
  fontWeight: "bold" as const,
  color: "#111827",
};

const summaryBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 18,
  padding: 18,
  marginTop: 10,
};

const suggestionBox = {
  borderWidth: 1,
  borderColor: "#DDD6FE",
  backgroundColor: "#F5F3FF",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};

const suggestionHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 12,
};

const suggestionTitle = {
  color: "#111827",
  fontSize: 16,
  fontWeight: "bold" as const,
};

const suggestionSubtitle = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 3,
};

const suggestionCard = {
  width: 132,
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  padding: 9,
  marginRight: 10,
};

const suggestionImageBox = {
  height: 78,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 8,
};

const suggestionRole = {
  color: "#6B7280",
  fontSize: 10,
  fontWeight: "bold" as const,
  textTransform: "capitalize" as const,
};

const suggestionName = {
  color: "#111827",
  fontSize: 12,
  fontWeight: "700" as const,
  minHeight: 34,
  marginTop: 3,
};

const suggestionPrice = {
  color: "#111827",
  fontSize: 12,
  fontWeight: "bold" as const,
  marginTop: 5,
};

const suggestionButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingVertical: 8,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 5,
  marginTop: 9,
};

const suggestionButtonText = {
  color: "#FFFFFF",
  fontSize: 11,
  fontWeight: "bold" as const,
};

const optionRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  paddingVertical: 13,
  borderBottomWidth: 1,
  borderBottomColor: "#E5E7EB",
};

const optionLabelBox = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
};

const optionLabel = {
  fontSize: 13,
  color: "#111827",
};

const promoPanel = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  paddingVertical: 12,
};

const promoInput = {
  flex: 1,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 13,
};

const applyButton = {
  backgroundColor: "#111827",
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 11,
};

const applyButtonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
  fontSize: 13,
};

const rewardPanel = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  paddingVertical: 12,
  marginBottom: 6,
};

const rewardTitle = {
  fontSize: 13,
  fontWeight: "600" as const,
  color: "#111827",
};

const rewardText = {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 4,
};

const summaryGap = {
  height: 14,
};

const emptyBox = {
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingVertical: 70,
};

const emptyTitle = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#111827",
  marginTop: 12,
};

const emptyText = {
  fontSize: 13,
  color: "#6B7280",
  marginTop: 6,
  marginBottom: 18,
  textAlign: "center" as const,
};

const shopButton = {
  backgroundColor: "#6D28D9",
  paddingVertical: 13,
  paddingHorizontal: 22,
  borderRadius: 14,
};

const shopButtonText = {
  color: "#FFFFFF",
  fontWeight: "bold" as const,
};

const summaryRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 12,
};

const summaryLabel = {
  fontSize: 14,
  color: "#6B7280",
};

const summaryValue = {
  fontSize: 14,
  fontWeight: "600" as const,
  color: "#111827",
};

const divider = {
  height: 1,
  backgroundColor: "#E5E7EB",
  marginBottom: 12,
};

const totalLabel = {
  fontSize: 16,
  fontWeight: "bold" as const,
  color: "#111827",
};

const totalValue = {
  fontSize: 18,
  fontWeight: "bold" as const,
  color: "#6D28D9",
};

const footer = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#E5E7EB",
  padding: 20,
};

const checkoutButton = {
  backgroundColor: "#6D28D9",
  padding: 16,
  borderRadius: 14,
};

const disabledButton = {
  backgroundColor: "#9CA3AF",
};

const checkoutText = {
  color: "#FFFFFF",
  textAlign: "center" as const,
  fontSize: 16,
  fontWeight: "bold" as const,
};

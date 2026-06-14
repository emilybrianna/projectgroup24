import {
  CartItem,
  clearCartItems,
  getCartItems,
} from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type PaymentMethod = "stripe_card" | "online_banking_dummy";

type PaymentForm = {
  cardHolder: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
};

type DeliveryForm = {
  name: string;
  phone: string;
  address: string;
};

type BankGatewayStep = "redirecting" | "login" | "authorize" | "success";

const cardBrands = ["VISA", "Mastercard", "AMEX"];

const bankOptions = [
  { name: "Maybank2u", logo: "M2U", color: "#FACC15" },
  { name: "CIMB Clicks", logo: "C", color: "#DC2626" },
  { name: "Public Bank", logo: "PB", color: "#EF4444" },
  { name: "RHB Now", logo: "RHB", color: "#2563EB" },
  { name: "Ambank", logo: "AM", color: "#EF4444" },
  { name: "MyBSN", logo: "BSN", color: "#0891B2" },
  { name: "Bank Rakyat", logo: "BR", color: "#F97316" },
  { name: "Bank Islam", logo: "BI", color: "#059669" },
];

const formatCurrency = (amount: number) => `RM ${amount.toFixed(2)}`;

const getCheckoutTotals = (items: CartItem[]) => {
  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const deliveryFee = items.length > 0 ? 8 : 0;
  const total = Math.max(subtotal + deliveryFee, 0);

  return { subtotal, deliveryFee, total };
};

const generateTransactionReference = () => {
  const datePart = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `SF-${datePart}-${randomPart}`;
};

const getDigitsOnly = (value: string) => value.replace(/\D/g, "");

const formatExpiryDate = (value: string) => {
  const digits = getDigitsOnly(value).slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const isValidExpiryDate = (value: string) => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})$/);

  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const year = Number(`20${match[2]}`);

  if (month < 1 || month > 12) {
    return false;
  }

  const expiryDate = new Date(year, month, 0, 23, 59, 59);
  return expiryDate.getTime() >= Date.now();
};

export default function Checkout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe_card");
  const [selectedBank, setSelectedBank] = useState("Maybank2u");
  const [onlineBankingExpanded, setOnlineBankingExpanded] = useState(true);
  const [bankLoginVisible, setBankLoginVisible] = useState(false);
  const [bankGatewayStep, setBankGatewayStep] = useState<BankGatewayStep>("login");
  const [bankUsername, setBankUsername] = useState("");
  const [bankPassword, setBankPassword] = useState("");
  const [bankOtp, setBankOtp] = useState("");
  const [form, setForm] = useState<PaymentForm>({
    cardHolder: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
  });
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    name: "",
    phone: "",
    address: "",
  });
  const [paying, setPaying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadCart = async () => {
        const items = await getCartItems();
        setCartItems(items);

        const storedName = await AsyncStorage.getItem("userName");
        if (storedName) {
          setDeliveryForm((current) => ({ ...current, name: current.name || storedName }));
        }
      };

      loadCart();
    }, [])
  );

  const updateForm = (key: keyof PaymentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateDeliveryForm = (key: keyof DeliveryForm, value: string) => {
    setDeliveryForm((current) => ({ ...current, [key]: value }));
  };

  const updateExpiryDate = (value: string) => {
    setForm((current) => ({ ...current, expiryDate: formatExpiryDate(value) }));
  };

  const validatePaymentForm = () => {
    const cardNumber = getDigitsOnly(form.cardNumber);
    const cvv = getDigitsOnly(form.cvv);

    if (cartItems.length === 0) {
      return "Your cart is empty.";
    }

    if (!deliveryForm.name.trim()) {
      return "Please enter receiver name.";
    }

    if (!deliveryForm.phone.trim()) {
      return "Please enter phone number.";
    }

    if (!deliveryForm.address.trim()) {
      return "Please enter delivery address.";
    }

    if (paymentMethod === "online_banking_dummy") {
      if (!selectedBank) {
        return "Please select an online banking option.";
      }

      return "";
    }

    if (!form.cardHolder.trim()) {
      return "Please enter the card holder name.";
    }

    if (cardNumber.length < 13 || cardNumber.length > 19) {
      return "Please enter a card number with 13 to 19 digits.";
    }

    if (!isValidExpiryDate(form.expiryDate)) {
      return "Please enter a valid future expiry date in MM/YY format.";
    }

    if (cvv.length < 3 || cvv.length > 4) {
      return "Please enter a 3 or 4 digit CVV.";
    }

    return "";
  };

  const savePaidOrder = async (paymentDetails: {
    transactionReference: string;
    maskedCardNumber: string;
    expiryDate: string;
    payerName?: string;
  }) => {
    const userId = await AsyncStorage.getItem("userId");
    const userName = await AsyncStorage.getItem("userName");
    const userEmail = await AsyncStorage.getItem("userEmail");
    const totals = getCheckoutTotals(cartItems);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        customer_name: deliveryForm.name.trim() || userName || paymentDetails.payerName || "Customer",
        customer_email: userEmail,
        delivery_name: deliveryForm.name.trim(),
        delivery_phone: deliveryForm.phone.trim(),
        delivery_address: deliveryForm.address.trim(),
        status: "pending",
        order_status: "pending",
        payment_status: "paid",
        total_amount: totals.total,
      })
      .select("id")
      .single<{ id: string }>();

    if (orderError) {
      Alert.alert("Order Error", orderError.message);
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      cartItems.map((item) => ({
        order_id: order.id,
        product_id: String(item.id),
        product_name: item.name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
        unit_price: item.price,
        line_total: item.price * item.quantity,
      }))
    );

    if (itemsError) {
      Alert.alert("Order Items Error", itemsError.message);
      return;
    }

    const { error: paymentError } = await supabase
      .from("mock_payments")
      .insert({
        order_id: order.id,
        customer_id: userId,
        card_holder_name: paymentDetails.payerName || userName || selectedBank || "Customer",
        masked_card_number: paymentDetails.maskedCardNumber,
        expiry_date: paymentDetails.expiryDate,
        amount: totals.total,
        transaction_reference: paymentDetails.transactionReference,
        payment_status: "paid",
      });

    if (paymentError) {
      Alert.alert("Payment Error", paymentError.message);
      return;
    }

    const { error: statusError } = await supabase
      .from("orders")
      .update({
        status: "pending",
        order_status: "pending",
        payment_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (statusError) {
      Alert.alert("Status Error", statusError.message);
      return;
    }

    await clearCartItems();
    setCartItems([]);

    router.replace({
      pathname: "/receipt" as any,
      params: {
        orderId: order.id,
        transactionReference: paymentDetails.transactionReference,
        total: totals.total.toFixed(2),
      },
    });
  };

  const payWithCardDummy = async () => {
    const totals = getCheckoutTotals(cartItems);
    const { data, error } = await supabase.functions.invoke("create-payment-intent", {
      body: {
        amount: totals.total,
        currency: "myr",
      },
    });

    if (error || !data?.clientSecret) {
      Alert.alert("Stripe Error", error?.message || data?.error || "Unable to start Stripe test payment.");
      return;
    }

    const initResult = await initPaymentSheet({
      merchantDisplayName: "SmartFash",
      paymentIntentClientSecret: data.clientSecret,
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: {
        name: form.cardHolder.trim(),
      },
    });

    if (initResult.error) {
      Alert.alert("Stripe Error", initResult.error.message);
      return;
    }

    const presentResult = await presentPaymentSheet();

    if (presentResult.error) {
      Alert.alert("Payment Cancelled", presentResult.error.message);
      return;
    }

    const cardNumber = getDigitsOnly(form.cardNumber);
    await savePaidOrder({
      transactionReference: `STRIPE-${data.paymentIntentId || generateTransactionReference()}`,
      maskedCardNumber: `Stripe Card **** ${cardNumber.slice(-4)}`,
      expiryDate: form.expiryDate.trim() || "Stripe",
      payerName: form.cardHolder.trim(),
    });
  };

  const payWithOnlineBankingDummy = async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await savePaidOrder({
      transactionReference: `OB-${generateTransactionReference()}`,
      maskedCardNumber: `Online Banking - ${selectedBank}`,
      expiryDate: "N/A",
    });
  };

  const processPayment = async () => {
    if (paying) {
      return;
    }

    const validationError = validatePaymentForm();

    if (validationError) {
      Alert.alert("Payment Error", validationError);
      return;
    }

    setPaying(true);

    try {
      if (paymentMethod === "stripe_card") {
        await payWithCardDummy();
      } else {
        setBankLoginVisible(true);
      }
    } finally {
      setPaying(false);
    }
  };

  const openDummyBankPage = () => {
    const validationError = validatePaymentForm();

    if (validationError) {
      Alert.alert("Payment Error", validationError);
      return;
    }

    setBankGatewayStep("redirecting");
    setBankLoginVisible(true);
    setTimeout(() => {
      setBankGatewayStep("login");
    }, 900);
  };

  const confirmDummyBankLogin = async () => {
    if (!bankUsername.trim() || !bankPassword.trim()) {
      Alert.alert("Bank Login", "Enter any dummy username and password to continue.");
      return;
    }

    setBankGatewayStep("authorize");
  };

  const confirmDummyBankOtp = async () => {
    const otp = getDigitsOnly(bankOtp);

    if (otp.length !== 6) {
      Alert.alert("Authorization", "Enter any 6 digit OTP to approve this demo payment.");
      return;
    }

    setPaying(true);

    try {
      setBankGatewayStep("success");
      await new Promise((resolve) => setTimeout(resolve, 750));
      await payWithOnlineBankingDummy();
    } finally {
      setPaying(false);
      setBankLoginVisible(false);
      setBankGatewayStep("login");
      setBankUsername("");
      setBankPassword("");
      setBankOtp("");
    }
  };

  const totals = getCheckoutTotals(cartItems);
  const selectedBankOption =
    bankOptions.find((bank) => bank.name === selectedBank) || bankOptions[0];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      style={page}
    >
      <View style={header}>
        <TouchableOpacity onPress={() => router.back()} style={iconButton}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={title}>Payment Method</Text>
        <View style={headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={section}>
          <Text style={sectionTitle}>Order Summary</Text>

          {cartItems.map((item) => (
            <View key={`${item.id}-${item.size}-${item.color}`} style={summaryItem}>
              <View style={{ flex: 1 }}>
                <Text style={itemName}>{item.name}</Text>
                <Text style={itemMeta}>
                  {item.color} / Size {item.size} x {item.quantity}
                </Text>
              </View>
              <Text style={itemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
            </View>
          ))}

          {cartItems.length === 0 && (
            <Text style={emptyText}>Your cart is empty. Add items before payment.</Text>
          )}

          <View style={divider} />
          <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
          <SummaryRow label="Delivery" value={formatCurrency(totals.deliveryFee)} />
          <View style={totalRow}>
            <Text style={totalLabel}>Total Amount</Text>
            <Text style={totalValue}>{formatCurrency(totals.total)}</Text>
          </View>
        </View>

        <View style={section}>
          <Text style={sectionTitle}>Delivery Address</Text>

          <Text style={label}>Receiver Name</Text>
          <TextInput
            value={deliveryForm.name}
            onChangeText={(value) => updateDeliveryForm("name", value)}
            placeholder="Full name"
            style={input}
          />

          <Text style={label}>Phone Number</Text>
          <TextInput
            value={deliveryForm.phone}
            onChangeText={(value) => updateDeliveryForm("phone", value)}
            placeholder="0123456789"
            keyboardType="phone-pad"
            style={input}
          />

          <Text style={label}>Address</Text>
          <TextInput
            value={deliveryForm.address}
            onChangeText={(value) => updateDeliveryForm("address", value)}
            placeholder="House no, street, postcode, city"
            multiline
            textAlignVertical="top"
            style={[input, addressInput]}
          />
        </View>

        <View style={section}>
          <Text style={sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            onPress={() => setPaymentMethod("stripe_card")}
            style={[paymentAccordion, paymentMethod === "stripe_card" && activePaymentAccordion]}
          >
            <View style={paymentAccordionLeft}>
              <Ionicons name="card-outline" size={18} color="#2563EB" />
              <View>
                <Text style={paymentAccordionTitle}>Credit / Debit Card</Text>
                <Text style={shippingBadge}>Stripe Test Gateway</Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === "stripe_card" ? "chevron-up-outline" : "chevron-down-outline"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>

          {paymentMethod === "stripe_card" ? (
            <View style={stripeGatewayCard}>
              <View style={stripeGatewayHeader}>
                <View style={stripeGatewayIcon}>
                  <Ionicons name="card-outline" size={20} color="#2563EB" />
                </View>
                <View style={stripeGatewayCopy}>
                  <Text style={stripeGatewayTitle}>Credit / Debit Card</Text>
                  <Text style={gatewayNote}>
                    Enter any demo card details. The card number only needs 13 to 19 digits.
                  </Text>
                </View>
              </View>
              <View style={cardBrandRow}>
                {cardBrands.map((brand) => (
                  <View key={brand} style={cardBrandBadge}>
                    <Text style={cardBrandText}>{brand}</Text>
                  </View>
                ))}
              </View>

              <Text style={label}>Card Holder Name</Text>
              <TextInput
                value={form.cardHolder}
                onChangeText={(value) => updateForm("cardHolder", value)}
                placeholder="Name on card"
                style={input}
              />

              <Text style={label}>Card Number</Text>
              <TextInput
                value={form.cardNumber}
                onChangeText={(value) => updateForm("cardNumber", value)}
                placeholder="Enter 13 to 19 digit card number"
                keyboardType="number-pad"
                maxLength={23}
                style={input}
              />

              <View style={splitRow}>
                <View style={splitField}>
                  <Text style={label}>Expiry Date</Text>
                  <TextInput
                    value={form.expiryDate}
                    onChangeText={updateExpiryDate}
                    placeholder="MM/YY"
                    keyboardType="number-pad"
                    maxLength={5}
                    style={input}
                  />
                </View>

                <View style={splitField}>
                  <Text style={label}>CVV</Text>
                  <TextInput
                    value={form.cvv}
                    onChangeText={(value) => updateForm("cvv", value)}
                    placeholder="123"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    style={input}
                  />
                </View>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              setPaymentMethod("online_banking_dummy");
              setOnlineBankingExpanded((current) => !current);
            }}
            style={[paymentAccordion, paymentMethod === "online_banking_dummy" && activePaymentAccordion]}
          >
            <View style={paymentAccordionLeft}>
              <Ionicons name="business-outline" size={18} color="#EF4444" />
              <View>
                <Text style={paymentAccordionTitle}>Online Banking</Text>
                <Text style={shippingBadge}>Dummy Bank Gateway</Text>
              </View>
            </View>
            <Ionicons
              name={onlineBankingExpanded && paymentMethod === "online_banking_dummy" ? "chevron-up-outline" : "chevron-down-outline"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>

          {paymentMethod === "online_banking_dummy" && onlineBankingExpanded ? (
            <View style={bankPanel}>
              <View style={promoBanner}>
                <View>
                  <Text style={promoTitle}>ENJOY</Text>
                  <Text style={promoText}>This promotion has been fully redeemed</Text>
                </View>
                <Text style={promoLogo}>BSN</Text>
              </View>
              {bankOptions.map((bank) => (
                  <TouchableOpacity
                    key={bank.name}
                    onPress={() => setSelectedBank(bank.name)}
                    style={bankListItem}
                  >
                    <View style={[bankBrandIcon, { backgroundColor: bank.color }]}>
                      <Text style={bankBrandText}>{bank.logo}</Text>
                    </View>
                    <Text style={bankListText}>{bank.name}</Text>
                    {selectedBank === bank.name && (
                      <Ionicons name="checkmark-circle" size={18} color="#6D28D9" />
                    )}
                  </TouchableOpacity>
                ))}
              <TouchableOpacity onPress={openDummyBankPage} style={bankPanelConfirm}>
                <Text style={bankPanelConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={footer}>
        <TouchableOpacity
          onPress={processPayment}
          disabled={paying || cartItems.length === 0}
          style={[
            payButton,
            (paying || cartItems.length === 0) && disabledButton,
          ]}
        >
          {paying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
              <Text style={payButtonText}>
                {paymentMethod === "stripe_card" ? "Pay with Stripe" : "Confirm Online Banking"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={bankLoginVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
          style={modalOverlay}
        >
          <ScrollView
            contentContainerStyle={modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={bankLoginCard}>
            <View style={bankLoginHeader}>
              <TouchableOpacity onPress={() => setBankLoginVisible(false)} style={bankLoginClose}>
                <Ionicons name="close-outline" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={bankLoginTitle}>{selectedBank} Demo</Text>
              <View style={headerSpacer} />
            </View>

            <View style={[dummyBankLogo, { backgroundColor: selectedBankOption.color }]}>
              <Text style={dummyBankLogoText}>{selectedBankOption.logo}</Text>
            </View>

            {bankGatewayStep === "redirecting" ? (
              <View style={bankStateBox}>
                <ActivityIndicator color="#6D28D9" />
                <Text style={dummyBankTitle}>Redirecting to {selectedBank} Demo...</Text>
                <Text style={dummyBankNote}>Securely preparing your mock banking session.</Text>
              </View>
            ) : null}

            {bankGatewayStep === "login" ? (
              <>
                <Text style={dummyBankTitle}>Secure Online Banking</Text>
                <Text style={dummyBankNote}>Demo page only. Do not enter real banking credentials.</Text>

                <View style={bankAmountCard}>
                  <Text style={bankAmountLabel}>Merchant</Text>
                  <Text style={bankAmountValue}>SmartFash</Text>
                  <Text style={bankAmountLabel}>Amount</Text>
                  <Text style={bankAmountValue}>{formatCurrency(totals.total)}</Text>
                </View>

                <Text style={label}>Username</Text>
                <TextInput
                  value={bankUsername}
                  onChangeText={setBankUsername}
                  placeholder="demo_user"
                  autoCapitalize="none"
                  style={input}
                />

                <Text style={label}>Password</Text>
                <TextInput
                  value={bankPassword}
                  onChangeText={setBankPassword}
                  placeholder="demo_password"
                  secureTextEntry
                  style={input}
                />

                <TouchableOpacity
                  onPress={confirmDummyBankLogin}
                  disabled={paying}
                  style={[bankConfirmButton, paying && disabledButton]}
                >
                  <Text style={bankConfirmText}>Login</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {bankGatewayStep === "authorize" ? (
              <>
                <Text style={dummyBankTitle}>Authorize Payment</Text>
                <Text style={dummyBankNote}>Enter any 6 digit OTP to approve this demo payment.</Text>

                <View style={bankAmountCard}>
                  <Text style={bankAmountLabel}>Reference</Text>
                  <Text style={bankAmountValue}>{`OB-${selectedBank.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`}</Text>
                  <Text style={bankAmountLabel}>Amount</Text>
                  <Text style={bankAmountValue}>{formatCurrency(totals.total)}</Text>
                </View>

                <Text style={label}>OTP / TAC</Text>
                <TextInput
                  value={bankOtp}
                  onChangeText={(value) => setBankOtp(getDigitsOnly(value).slice(0, 6))}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[input, otpInput]}
                />

                <TouchableOpacity
                  onPress={confirmDummyBankOtp}
                  disabled={paying}
                  style={[bankConfirmButton, paying && disabledButton]}
                >
                  {paying ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={bankConfirmText}>Approve Payment</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {bankGatewayStep === "success" ? (
              <View style={bankStateBox}>
                <Ionicons name="checkmark-circle" size={52} color="#059669" />
                <Text style={dummyBankTitle}>Payment Approved</Text>
                <Text style={dummyBankNote}>Returning to SmartFash receipt...</Text>
              </View>
            ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryRow}>
      <Text style={summaryLabel}>{label}</Text>
      <Text style={summaryValue}>{value}</Text>
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
const iconButton = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const headerSpacer = { width: 36 };
const title = { fontSize: 20, fontWeight: "bold" as const, color: "#111827" };
const container = { padding: 20, paddingBottom: 120 };
const section = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};
const sectionTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  marginBottom: 14,
};
const summaryItem = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  marginBottom: 14,
};
const itemName = { color: "#111827", fontSize: 14, fontWeight: "700" as const };
const itemMeta = { color: "#6B7280", fontSize: 12, marginTop: 4 };
const itemPrice = { color: "#111827", fontSize: 14, fontWeight: "700" as const };
const emptyText = { color: "#6B7280", lineHeight: 20, marginBottom: 12 };
const divider = { height: 1, backgroundColor: "#E5E7EB", marginBottom: 12 };
const summaryRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  marginBottom: 10,
};
const summaryLabel = { color: "#6B7280", fontSize: 14 };
const summaryValue = { color: "#111827", fontSize: 14, fontWeight: "600" as const };
const totalRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginTop: 4,
};
const totalLabel = { color: "#111827", fontSize: 16, fontWeight: "bold" as const };
const totalValue = { color: "#6D28D9", fontSize: 20, fontWeight: "bold" as const };
const label = { color: "#111827", fontSize: 13, fontWeight: "600" as const, marginBottom: 8 };
const paymentAccordion = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 13,
  marginBottom: 10,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  backgroundColor: "#FFFFFF",
};
const activePaymentAccordion = {
  borderColor: "#DDD6FE",
  backgroundColor: "#FDFBFF",
};
const paymentAccordionLeft = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
};
const paymentAccordionTitle = {
  color: "#111827",
  fontSize: 14,
  fontWeight: "700" as const,
};
const shippingBadge = {
  alignSelf: "flex-start" as const,
  color: "#EF4444",
  fontSize: 11,
  fontWeight: "700" as const,
  backgroundColor: "#FEE2E2",
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: 4,
  marginTop: 5,
};
const gatewayNote = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 17,
};
const stripeGatewayCard = {
  borderWidth: 1,
  borderColor: "#DBEAFE",
  borderRadius: 8,
  backgroundColor: "#EFF6FF",
  padding: 14,
  marginBottom: 12,
};
const stripeGatewayHeader = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 10,
};
const stripeGatewayIcon = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#FFFFFF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const stripeGatewayCopy = { flex: 1 };
const stripeGatewayTitle = {
  color: "#111827",
  fontSize: 14,
  fontWeight: "800" as const,
  marginBottom: 4,
};
const cardBrandRow = {
  flexDirection: "row" as const,
  gap: 8,
  marginTop: 12,
  marginBottom: 14,
};
const cardBrandBadge = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#BFDBFE",
  borderRadius: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
};
const cardBrandText = {
  color: "#1D4ED8",
  fontSize: 11,
  fontWeight: "900" as const,
};
const input = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 8,
  paddingHorizontal: 14,
  paddingVertical: 13,
  marginBottom: 14,
};
const addressInput = {
  minHeight: 86,
};
const splitRow = { flexDirection: "row" as const, gap: 12 };
const splitField = { flex: 1 };
const bankPanel = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  overflow: "hidden" as const,
  marginBottom: 12,
};
const promoBanner = {
  backgroundColor: "#14B8A6",
  padding: 12,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};
const promoTitle = {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "800" as const,
};
const promoText = {
  color: "#E0F2FE",
  fontSize: 11,
  marginTop: 2,
};
const promoLogo = {
  color: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#FFFFFF",
  paddingHorizontal: 8,
  paddingVertical: 4,
  fontWeight: "900" as const,
};
const bankListItem = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  borderBottomWidth: 1,
  borderBottomColor: "#F3F4F6",
  paddingHorizontal: 13,
  paddingVertical: 13,
  gap: 10,
  backgroundColor: "#FFFFFF",
};
const bankBrandIcon = {
  width: 26,
  height: 26,
  borderRadius: 13,
  backgroundColor: "#F3F4F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const bankBrandText = {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "900" as const,
};
const bankListText = {
  flex: 1,
  color: "#374151",
  fontSize: 13,
  fontWeight: "600" as const,
};
const bankPanelConfirm = {
  backgroundColor: "#F04A2A",
  margin: 10,
  borderRadius: 8,
  paddingVertical: 13,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const bankPanelConfirmText = {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "bold" as const,
};
const modalOverlay = {
  flex: 1,
  backgroundColor: "rgba(17,24,39,0.45)",
};
const modalScrollContent = {
  flexGrow: 1,
  justifyContent: "flex-end" as const,
};
const bankLoginCard = {
  backgroundColor: "#FFFFFF",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: 20,
  paddingBottom: 28,
};
const bankLoginHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 18,
};
const bankLoginClose = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#F3F4F6",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const bankLoginTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
};
const dummyBankLogo = {
  width: 64,
  height: 64,
  borderRadius: 16,
  backgroundColor: "#111827",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  alignSelf: "center" as const,
  marginBottom: 12,
};
const dummyBankLogoText = {
  color: "#FFFFFF",
  fontSize: 20,
  fontWeight: "900" as const,
};
const dummyBankTitle = {
  color: "#111827",
  fontSize: 18,
  fontWeight: "bold" as const,
  textAlign: "center" as const,
};
const dummyBankNote = {
  color: "#DC2626",
  fontSize: 12,
  textAlign: "center" as const,
  lineHeight: 17,
  marginTop: 5,
  marginBottom: 16,
};
const bankStateBox = {
  alignItems: "center" as const,
  paddingVertical: 18,
  gap: 10,
};
const bankAmountCard = {
  backgroundColor: "#F9FAFB",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 10,
  padding: 12,
  marginBottom: 14,
};
const bankAmountLabel = {
  color: "#6B7280",
  fontSize: 11,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  marginBottom: 3,
};
const bankAmountValue = {
  color: "#111827",
  fontSize: 15,
  fontWeight: "800" as const,
  marginBottom: 9,
};
const otpInput = {
  textAlign: "center" as const,
  fontSize: 22,
  fontWeight: "900" as const,
  letterSpacing: 0,
};
const bankConfirmButton = {
  backgroundColor: "#F97316",
  borderRadius: 8,
  paddingVertical: 15,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  minHeight: 52,
};
const bankConfirmText = {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "bold" as const,
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
const payButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 8,
  paddingVertical: 16,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 8,
  minHeight: 54,
};
const disabledButton = { backgroundColor: "#9CA3AF" };
const payButtonText = { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" as const };

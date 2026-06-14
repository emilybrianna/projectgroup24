import { Stack } from "expo-router";
import { StripeProvider } from "@stripe/stripe-react-native";

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </StripeProvider>
  );
  
}

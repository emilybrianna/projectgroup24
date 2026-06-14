import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const REMEMBER_SESSION_KEY = "smartfash_remember_session";
const SIGNED_OUT_TO_LANDING_KEY = "smartfash_signed_out_to_landing";
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type RememberedSession = {
  token: string;
  expiresAt: number;
  userId?: string;
  email: string;
  name: string;
  role: string;
};

type SaveRememberedSessionData = {
  userId?: string;
  email: string;
  name: string;
  role: string;
};

export async function saveRememberedSession(data: SaveRememberedSessionData) {
  const session: RememberedSession = {
    ...data,
    token: `remember-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + REMEMBER_DURATION_MS,
  };

  await SecureStore.setItemAsync(REMEMBER_SESSION_KEY, JSON.stringify(session));
  await applyRememberedSessionToStorage(session);
}

export async function getRememberedSession() {
  const rawSession = await SecureStore.getItemAsync(REMEMBER_SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as RememberedSession;

    if (!session.token || !session.email || !session.role || Date.now() > session.expiresAt) {
      await clearRememberedSession();
      return null;
    }

    return session;
  } catch {
    await clearRememberedSession();
    return null;
  }
}

export async function applyRememberedSessionToStorage(session: RememberedSession) {
  await AsyncStorage.removeItem(SIGNED_OUT_TO_LANDING_KEY);
  await AsyncStorage.setItem("userToken", session.token);
  await AsyncStorage.setItem("userEmail", session.email);
  await AsyncStorage.setItem("userName", session.name);
  await AsyncStorage.setItem("userRole", session.role);

  if (session.userId) {
    await AsyncStorage.setItem("userId", session.userId);
  } else {
    await AsyncStorage.removeItem("userId");
  }
}

export async function clearRememberedSession() {
  await SecureStore.deleteItemAsync(REMEMBER_SESSION_KEY);
}

export async function clearActiveSession() {
  await AsyncStorage.removeItem("userToken");
  await AsyncStorage.removeItem("userEmail");
  await AsyncStorage.removeItem("userName");
  await AsyncStorage.removeItem("userRole");
  await AsyncStorage.removeItem("userId");
}

export async function clearLocalSession() {
  await clearRememberedSession();
  await clearSignedOutToLanding();
  await clearActiveSession();
}

export async function signOutToLanding() {
  await clearActiveSession();

  const rememberedSession = await getRememberedSession();

  if (rememberedSession) {
    await AsyncStorage.setItem(SIGNED_OUT_TO_LANDING_KEY, "true");
  } else {
    await clearSignedOutToLanding();
  }
}

export async function isSignedOutToLanding() {
  return (await AsyncStorage.getItem(SIGNED_OUT_TO_LANDING_KEY)) === "true";
}

export async function clearSignedOutToLanding() {
  await AsyncStorage.removeItem(SIGNED_OUT_TO_LANDING_KEY);
}

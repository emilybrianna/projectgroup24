import bcrypt from "@/lib/bcrypt";
import { sendOtpEmail } from "@/lib/email-otp";
import { syncProfile } from "@/lib/profile-sync";
import {
  clearLocalSession,
  clearRememberedSession,
  clearSignedOutToLanding,
  saveRememberedSession,
  signOutToLanding,
} from "@/lib/remember-session";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Screen = "signup" | "signin" | "forgot" | "profile";
type UserRole = "customer" | "admin" | "staff";
type SocialProvider = "google";

type UserAccount = {
  id: number | string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

type PasswordReset = {
  id: string;
  email: string;
  otp_code: string;
  expires_at: string;
  used_at: string | null;
};

WebBrowser.maybeCompleteAuthSession();

const getAccountErrorMessage = (message: string) => {
  if (message.includes("public.users")) {
    return "Supabase users table is missing. Run database-setup.sql in Supabase SQL Editor first.";
  }

  if (message.includes("public.password_resets")) {
    return "Supabase password_resets table is missing. Run the password_resets SQL from database-setup.sql in Supabase SQL Editor first.";
  }

  return message;
};

const getSocialAuthErrorMessage = (message: string) => {
  if (message.includes("Unable to exchange external code")) {
    const supabaseCallbackUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/callback`;
    return `Google sign in is not fully configured. In Supabase Google Provider, make sure the Client ID and Client Secret are copied from the same Google Web OAuth client that has this Authorized redirect URI: ${supabaseCallbackUrl}`;
  }

  if (message.includes("Database error saving new user")) {
    return "Google reached Supabase, but Supabase failed while saving the auth user. Run fix-google-auth-database-error.sql in Supabase SQL Editor, then try Google sign in again.";
  }

  return message;
};

export default function Customer() {
  const [screen, setScreen] = useState<Screen>("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [passwordResetId, setPasswordResetId] = useState("");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authAction, setAuthAction] = useState<"signin" | "signup" | SocialProvider | null>(null);

  const redirectByRole = useCallback((role: UserRole) => {
    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "staff") {
      router.replace("/staff");
    } else {
      router.replace("/homepage");
    }
  }, []);

  const clearPasswordFields = useCallback(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const clearRecoveryFields = useCallback(() => {
    setOtp("");
    setPasswordResetId("");
    setOtpSent(false);
    setOtpVerified(false);
  }, []);

  const openSignIn = useCallback(() => {
    clearPasswordFields();
    clearRecoveryFields();
    setScreen("signin");
  }, [clearPasswordFields, clearRecoveryFields]);

  const openSignUp = useCallback(() => {
    clearPasswordFields();
    clearRecoveryFields();
    setScreen("signup");
  }, [clearPasswordFields, clearRecoveryFields]);

  const openForgot = useCallback(() => {
    clearPasswordFields();
    clearRecoveryFields();
    setScreen("forgot");
  }, [clearPasswordFields, clearRecoveryFields]);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen !== "signin") {
        openSignIn();
        return true;
      }

      return false;
    });

    return () => backSubscription.remove();
  }, [openSignIn, screen]);

  const handleSignUp = async () => {
    if (authAction) {
      return;
    }

    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.endsWith("@smartfash.com")) {
      Alert.alert(
        "Admin Email Reserved",
        "SmartFash staff and admin accounts are created by the system. Please sign in instead."
      );
      return;
    }

    setAuthAction("signup");

    try {
      const { data: existingDbUser, error: lookupError } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (lookupError) {
        Alert.alert("Error", getAccountErrorMessage(lookupError.message));
        return;
      }

      if (existingDbUser) {
        Alert.alert("Error", "This email already exists. Please sign in.");
        return;
      }

      const encryptedPassword = await bcrypt.hash(password, 10);

      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          name: name.trim(),
          email: normalizedEmail,
          password: encryptedPassword,
          role: "customer",
        })
        .select("id,name,email,password,role")
        .single<UserAccount>();

      if (error) {
        Alert.alert("Error", getAccountErrorMessage(error.message));
        return;
      }

      const { error: profileError } = await syncProfile({
        id: String(newUser.id),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      });

      if (profileError) {
        await supabase.from("users").delete().eq("id", newUser.id);
        Alert.alert("Error", `Account was not created because profile sync failed: ${profileError.message}`);
        return;
      }

      await clearLocalSession();

      Alert.alert("Success", "Customer account created. Please sign in.");
      openSignIn();
      setEmail(newUser.email);
      setName("");
    } finally {
      setAuthAction(null);
    }
  };

  const handleSignIn = async () => {
    if (authAction) {
      return;
    }

    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setAuthAction("signin");

    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("id,name,email,password,role")
        .eq("email", normalizedEmail)
        .maybeSingle<UserAccount>();

      if (error) {
        Alert.alert("Error", getAccountErrorMessage(error.message));
        return;
      }

      if (!user) {
        Alert.alert(
          "Error",
          normalizedEmail.endsWith("@smartfash.com")
            ? "Admin account not found in database. Please ask the system owner to create it first."
            : "Account not found"
        );
        return;
      }

      const isEncryptedPassword =
        user.password.startsWith("$2a$") || user.password.startsWith("$2b$");
      const isMatch = isEncryptedPassword
        ? await bcrypt.compare(password, user.password)
        : password === user.password;

      if (!isMatch) {
        Alert.alert("Error", "Incorrect password");
        return;
      }

      await AsyncStorage.setItem("userEmail", user.email);
      await AsyncStorage.setItem("userName", user.name);
      await AsyncStorage.setItem("userRole", user.role);
      await AsyncStorage.setItem("userId", String(user.id));
      await clearSignedOutToLanding();

      if (rememberMe) {
        await saveRememberedSession({
          userId: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        });
      } else {
        await clearRememberedSession();
        await AsyncStorage.removeItem("userToken");
      }

      redirectByRole(user.role);
    } finally {
      setAuthAction(null);
    }
  };

  const getOAuthTokensFromUrl = (url: string) => {
    const parsedUrl = new URL(url);
    const queryParams = new URLSearchParams(parsedUrl.search);
    const hashValue = parsedUrl.hash.startsWith("#") ? parsedUrl.hash.slice(1) : parsedUrl.hash;
    const normalizedHash = hashValue.startsWith("/?") ? hashValue.slice(2) : hashValue;
    const hashParams = new URLSearchParams(normalizedHash);

    const readParam = (key: string) => queryParams.get(key) || hashParams.get(key);

    return {
      accessToken: readParam("access_token"),
      refreshToken: readParam("refresh_token"),
      code: readParam("code"),
      error: readParam("error"),
      errorDescription: readParam("error_description"),
    };
  };

  const completeSocialSession = async (provider: SocialProvider) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      Alert.alert("Error", authError.message);
      return;
    }

    const authUser = authData.user;
    const userEmail = authUser?.email?.trim().toLowerCase();

    if (!authUser || !userEmail) {
      Alert.alert("Error", "Social account email could not be found.");
      return;
    }

    if (userEmail.endsWith("@smartfash.com")) {
      await supabase.auth.signOut();
      Alert.alert(
        "Admin Email Reserved",
        "SmartFash staff and admin accounts must use the normal sign in form."
      );
      return;
    }

    const socialName =
      String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim() ||
      userEmail.split("@")[0] ||
      "Customer";

    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("id,name,email,password,role")
      .eq("email", userEmail)
      .maybeSingle<UserAccount>();

    if (lookupError) {
      Alert.alert("Error", getAccountErrorMessage(lookupError.message));
      return;
    }

    let appUser = existingUser;

    if (!appUser) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          id: authUser.id,
          name: socialName,
          email: userEmail,
          password: `oauth:${provider}`,
          role: "customer",
        })
        .select("id,name,email,password,role")
        .single<UserAccount>();

      if (insertError) {
        Alert.alert("Error", getAccountErrorMessage(insertError.message));
        return;
      }

      appUser = newUser;
    }

    const { error: profileError } = await syncProfile({
      id: String(appUser.id),
      name: appUser.name,
      email: appUser.email,
      role: appUser.role,
    });

    if (profileError) {
      Alert.alert("Error", `Profile sync failed: ${profileError.message}`);
      return;
    }

    await AsyncStorage.setItem("userEmail", appUser.email);
    await AsyncStorage.setItem("userName", appUser.name);
    await AsyncStorage.setItem("userRole", appUser.role);
    await AsyncStorage.setItem("userId", String(appUser.id));
    await clearSignedOutToLanding();

    if (rememberMe) {
      await saveRememberedSession({
        userId: String(appUser.id),
        email: appUser.email,
        name: appUser.name,
        role: appUser.role,
      });
    } else {
      await clearRememberedSession();
      await AsyncStorage.removeItem("userToken");
    }

    redirectByRole(appUser.role);
  };

  const handleSocialSignIn = async (provider: SocialProvider) => {
    if (authAction) {
      return;
    }

    setAuthAction(provider);

    try {
      const redirectTo = "project1://auth/callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      if (!data.url) {
        Alert.alert("Error", "Social sign in URL was not created.");
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== "success") {
        return;
      }

      const { accessToken, refreshToken, code, error: oauthError, errorDescription } =
        getOAuthTokensFromUrl(result.url);

      if (oauthError) {
        Alert.alert("Error", getSocialAuthErrorMessage(errorDescription || oauthError));
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          Alert.alert("Error", sessionError.message);
          return;
        }
      } else if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);

        if (codeError) {
          Alert.alert("Error", codeError.message);
          return;
        }
      } else {
        const { data: existingSession } = await supabase.auth.getSession();

        if (!existingSession.session) {
          Alert.alert(
            "Error",
            "Google sign in returned to the app but did not include a valid session. Add project1://auth/callback to Supabase Auth redirect URLs."
          );
          return;
        }
      }

      await completeSocialSession(provider);
    } finally {
      setAuthAction(null);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from("users")
      .select("name,email")
      .eq("email", normalizedEmail)
      .maybeSingle<Pick<UserAccount, "name" | "email">>();

    if (error) {
      Alert.alert("Error", getAccountErrorMessage(error.message));
      return;
    }

    if (!user) {
      Alert.alert("Error", "Account not found");
      return;
    }

    const nextOtp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: resetRecord, error: resetError } = await supabase
      .from("password_resets")
      .insert({
        email: normalizedEmail,
        otp_code: nextOtp,
        expires_at: expiresAt,
      })
      .select("id,email,otp_code,expires_at,used_at")
      .single<PasswordReset>();

    if (resetError) {
      Alert.alert("Error", getAccountErrorMessage(resetError.message));
      return;
    }

    let otpWasSentByEmail = true;

    try {
      await sendOtpEmail({
        toEmail: user.email,
        toName: user.name,
        otp: nextOtp,
      });
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Failed to send OTP email.";

      if (
        message.includes("Requested function was not found") ||
        message.includes("Invalid JWT")
      ) {
        otpWasSentByEmail = false;
      } else {
        Alert.alert("Error", message);
        return;
      }
    }

    setEmail(normalizedEmail);
    setOtp("");
    setPasswordResetId(resetRecord.id);
    setOtpVerified(false);
    setOtpSent(true);

    if (!otpWasSentByEmail) {
      Alert.alert(
        "OTP Ready",
        `Email function is not ready yet. For testing, use OTP: ${nextOtp}`
      );
      return;
    }

    Alert.alert("OTP Sent", `OTP has been sent to ${user.email}.`);
  };

  const handleVerifyOtp = async () => {
    if (!otpSent || !passwordResetId) {
      Alert.alert("Error", "Please request an OTP first.");
      return;
    }

    const { data: resetRecord, error } = await supabase
      .from("password_resets")
      .select("id,email,otp_code,expires_at,used_at")
      .eq("id", passwordResetId)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle<PasswordReset>();

    if (error) {
      Alert.alert("Error", getAccountErrorMessage(error.message));
      return;
    }

    if (!resetRecord || resetRecord.used_at) {
      Alert.alert("Error", "Invalid OTP request. Please request a new OTP.");
      return;
    }

    if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
      Alert.alert("Error", "OTP expired. Please request a new OTP.");
      setOtp("");
      setPasswordResetId("");
      setOtpSent(false);
      setOtpVerified(false);
      return;
    }

    if (otp.trim() !== resetRecord.otp_code) {
      Alert.alert("Error", "Invalid OTP");
      return;
    }

    setOtpVerified(true);
    setPassword("");
    setConfirmPassword("");
    Alert.alert("Success", "OTP verified. Please enter your new password.");
  };

  const handleResetPassword = async () => {
    if (!otpVerified) {
      Alert.alert("Error", "Please verify OTP first.");
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please enter and confirm your new password.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const encryptedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from("users")
      .update({ password: encryptedPassword })
      .eq("email", email.trim().toLowerCase());

    if (error) {
      Alert.alert("Error", getAccountErrorMessage(error.message));
      return;
    }

    if (passwordResetId) {
      const { error: resetError } = await supabase
        .from("password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("id", passwordResetId);

      if (resetError) {
        Alert.alert("Error", getAccountErrorMessage(resetError.message));
        return;
      }
    }

    Alert.alert("Success", "Password updated. Please sign in again.");
    openSignIn();
  };

  const handleSignOut = async () => {
    await signOutToLanding();

    Alert.alert("Signed Out", "You have been logged out.");
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      style={keyboardPage}
    >
      <ScrollView
        contentContainerStyle={container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {screen === "signup" && (
          <>
          <Text style={title}>Sign Up</Text>

          <Text style={label}>Name</Text>
          <TextInput
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            style={input}
          />

          <Text style={label}>Email</Text>
          <TextInput
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={input}
          />

          <Text style={label}>Password</Text>
          <View style={passwordBox}>
            <TextInput
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={passwordInput}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <Text style={label}>Confirm Password</Text>
          <View style={passwordBox}>
            <TextInput
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              style={passwordInput}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye" : "eye-off"}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleSignUp}
            style={[button, authAction === "signup" && disabledButton]}
            disabled={authAction !== null}
          >
            {authAction === "signup" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <SocialAuthButtons
            authAction={authAction}
            onSocialSignIn={handleSocialSignIn}
          />

          <TouchableOpacity onPress={openSignIn}>
            <Text style={bottomText}>
              Already have an account?{" "}
              <Text style={purpleText}>Sign In</Text>
            </Text>
          </TouchableOpacity>
          </>
        )}

        {screen === "signin" && (
          <>
          <Text style={title}>Sign In</Text>

          <Text style={label}>Email</Text>
          <TextInput
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={input}
          />

          <Text style={label}>Password</Text>
          <View style={passwordBox}>
            <TextInput
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={passwordInput}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setRememberMe(!rememberMe)}
            style={rememberRow}
            activeOpacity={0.75}
          >
            <Ionicons
              name={rememberMe ? "checkbox" : "square-outline"}
              size={22}
              color={rememberMe ? "#6D28D9" : "#6B7280"}
            />
            <View style={{ flex: 1 }}>
              <Text style={rememberText}>Remember Me</Text>
              <Text style={rememberHint}>Stay signed in on this device</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignIn}
            style={[button, authAction === "signin" && disabledButton]}
            disabled={authAction !== null}
          >
            {authAction === "signin" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <SocialAuthButtons
            authAction={authAction}
            onSocialSignIn={handleSocialSignIn}
          />

          <TouchableOpacity onPress={openForgot}>
            <Text style={bottomText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={openSignUp}>
            <Text style={bottomText}>
              Don’t have an account?{" "}
              <Text style={purpleText}>Sign Up</Text>
            </Text>
          </TouchableOpacity>

          </>
        )}

        {screen === "forgot" && (
          <>
          <Text style={title}>Forgot Password</Text>

          <Text style={label}>Email</Text>
          <TextInput
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={input}
          />

          <TouchableOpacity onPress={handleSendOtp} style={button}>
            <Text style={buttonText}>Send OTP</Text>
          </TouchableOpacity>

          {otpSent && !otpVerified && (
            <>
              <Text style={label}>OTP</Text>
              <TextInput
                placeholder="Enter OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                style={input}
              />

              <TouchableOpacity onPress={handleVerifyOtp} style={button}>
                <Text style={buttonText}>Verify OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {otpVerified && (
            <>
              <Text style={label}>New Password</Text>
              <View style={passwordBox}>
                <TextInput
                  placeholder="Enter new password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={passwordInput}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye" : "eye-off"}
                    size={22}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <Text style={label}>Confirm New Password</Text>
              <View style={passwordBox}>
                <TextInput
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  style={passwordInput}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye" : "eye-off"}
                    size={22}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleResetPassword} style={button}>
                <Text style={buttonText}>Update Password</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={openSignIn}>
            <Text style={bottomText}>
              Back to <Text style={purpleText}>Sign In</Text>
            </Text>
          </TouchableOpacity>
          </>
        )}

        {screen === "profile" && (
          <>
          <Text style={title}>Profile</Text>

          <Text style={profileText}>Name: {name || "Customer"}</Text>
          <Text style={profileText}>Email: {email}</Text>

          <TouchableOpacity onPress={handleSignOut} style={button}>
            <Text style={buttonText}>Sign Out</Text>
          </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SocialAuthButtons({
  authAction,
  onSocialSignIn,
}: {
  authAction: "signin" | "signup" | SocialProvider | null;
  onSocialSignIn: (provider: SocialProvider) => void;
}) {
  return (
    <View style={socialSection}>
      <View style={dividerRow}>
        <View style={dividerLine} />
        <Text style={dividerText}>or continue with</Text>
        <View style={dividerLine} />
      </View>

      <View style={socialButtons}>
        <TouchableOpacity
          onPress={() => onSocialSignIn("google")}
          disabled={authAction !== null}
          style={[socialButton, authAction !== null && disabledButton]}
        >
          {authAction === "google" ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <>
              <Text style={googleIcon}>G</Text>
              <Text style={socialButtonText}>Google</Text>
            </>
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}

const keyboardPage = {
  flex: 1,
  backgroundColor: "#F8FAFC",
};

const container = {
  flexGrow: 1,
  backgroundColor: "#F8FAFC",
  paddingHorizontal: 32,
  justifyContent: "center" as const,
  paddingVertical: 40,
};

const title = {
  fontSize: 34,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 30,
};

const label = {
  fontSize: 16,
  color: "#111827",
  marginBottom: 8,
};

const input = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  padding: 16,
  borderRadius: 10,
  marginBottom: 18,
};

const passwordBox = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 10,
  marginBottom: 18,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  paddingRight: 14,
};

const passwordInput = {
  flex: 1,
  padding: 16,
};

const rememberRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  marginBottom: 18,
};

const rememberText = {
  color: "#111827",
  fontSize: 14,
  fontWeight: "600" as const,
};

const rememberHint = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 2,
};

const button = {
  backgroundColor: "#6D28D9",
  padding: 16,
  borderRadius: 8,
  marginTop: 8,
  minHeight: 54,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const disabledButton = {
  opacity: 0.72,
};

const buttonText = {
  color: "white",
  textAlign: "center" as const,
  fontSize: 16,
  fontWeight: "bold" as const,
};

const bottomText = {
  textAlign: "center" as const,
  marginTop: 22,
  color: "#111827",
  fontSize: 15,
};

const socialSection = {
  marginTop: 20,
};

const dividerRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  marginBottom: 14,
};

const dividerLine = {
  flex: 1,
  height: 1,
  backgroundColor: "#E5E7EB",
};

const dividerText = {
  color: "#9CA3AF",
  fontSize: 12,
};

const socialButtons = {
  flexDirection: "row" as const,
  gap: 10,
};

const socialButton = {
  flex: 1,
  minHeight: 48,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  backgroundColor: "#FFFFFF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 8,
};

const googleIcon = {
  color: "#2563EB",
  fontSize: 18,
  fontWeight: "bold" as const,
};

const socialButtonText = {
  color: "#111827",
  fontSize: 13,
  fontWeight: "bold" as const,
};

const purpleText = {
  color: "#6D28D9",
  fontWeight: "bold" as const,
};

const profileText = {
  fontSize: 16,
  color: "#374151",
  marginBottom: 12,
};


import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import bcrypt from "@/lib/bcrypt";
import { signOutToLanding } from "@/lib/remember-session";
import { syncProfile } from "@/lib/profile-sync";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
};

export default function Profile() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isOAuthUser = Boolean(userProfile?.password?.startsWith("oauth:"));

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const storedId = await AsyncStorage.getItem("userId");
    const storedEmail = await AsyncStorage.getItem("userEmail");

    if (!storedId && !storedEmail) {
      Alert.alert("Session Expired", "Please sign in again.");
      router.replace("/customer");
      return;
    }

    let query = supabase
      .from("users")
      .select("id,name,email,password,role");

    query = storedId ? query.eq("id", storedId) : query.eq("email", storedEmail);

    const { data, error } = await query.maybeSingle<UserProfile>();

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    if (!data) {
      const storedName = await AsyncStorage.getItem("userName");
      setName(storedName || "Customer");
      setEmail(storedEmail || "");
      return;
    }

    setUserProfile(data);
    setName(data.name);
    setEmail(data.email);

    const { error: profileError } = await syncProfile({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
    });

    if (profileError) {
      Alert.alert("Error", `Profile sync failed: ${profileError.message}`);
      return;
    }

    await AsyncStorage.setItem("userId", data.id);
    await AsyncStorage.setItem("userName", data.name);
    await AsyncStorage.setItem("userEmail", data.email);
    await AsyncStorage.setItem("userRole", data.role);

    const { data: storedProfile, error: photoError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", data.id)
      .maybeSingle<{ avatar_url: string | null }>();

    if (photoError) {
      if (!photoError.message.toLowerCase().includes("avatar_url")) {
        Alert.alert("Error", `Profile photo could not be loaded: ${photoError.message}`);
      }
      return;
    }

    setPhotoUrl(storedProfile?.avatar_url || null);
  };

  const handleSaveProfile = async () => {
    if (!name || !email) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!userProfile) {
      Alert.alert("Error", "This profile is not connected to the database.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .neq("id", userProfile.id)
      .maybeSingle();

    if (lookupError) {
      Alert.alert("Error", lookupError.message);
      return;
    }

    if (existingUser) {
      Alert.alert("Error", "This email is already used by another account.");
      return;
    }

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        email: normalizedEmail,
      })
      .eq("id", userProfile.id)
      .select("id,name,email,password,role")
      .maybeSingle<UserProfile>();

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    if (!updatedUser) {
      Alert.alert("Error", "Profile was not updated.");
      return;
    }

    const { error: profileError } = await syncProfile({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    if (profileError) {
      Alert.alert("Error", `User updated, but profile sync failed: ${profileError.message}`);
      return;
    }

    setUserProfile(updatedUser);
    setName(updatedUser.name);
    setEmail(updatedUser.email);
    await AsyncStorage.setItem("userId", updatedUser.id);
    await AsyncStorage.setItem("userName", updatedUser.name);
    await AsyncStorage.setItem("userEmail", updatedUser.email);
    await AsyncStorage.setItem("userRole", updatedUser.role);

    Alert.alert("Success", "Profile updated successfully");
    setEditMode(false);
  };

  const handleChangePassword = async () => {
    if ((!isOAuthUser && !currentPassword) || !newPassword || !confirmPassword) {
      Alert.alert(
        "Error",
        isOAuthUser ? "Please enter and confirm your new password" : "Please fill in all password fields"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New password and confirm password do not match");
      return;
    }

    if (!userProfile) {
      Alert.alert("Error", "This profile is not connected to the database.");
      return;
    }

    if (!isOAuthUser) {
      const isEncryptedPassword =
        userProfile.password.startsWith("$2a$") ||
        userProfile.password.startsWith("$2b$");
      const isCurrentPasswordCorrect = isEncryptedPassword
        ? await bcrypt.compare(currentPassword, userProfile.password)
        : currentPassword === userProfile.password;

      if (!isCurrentPasswordCorrect) {
        Alert.alert("Error", "Current password is incorrect");
        return;
      }
    }

    const encryptedPassword = await bcrypt.hash(newPassword, 10);

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update({ password: encryptedPassword })
      .eq("id", userProfile.id)
      .select("id,name,email,password,role")
      .maybeSingle<UserProfile>();

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    if (!updatedUser) {
      Alert.alert("Error", "Password was not updated.");
      return;
    }

    setUserProfile(updatedUser);

    Alert.alert("Success", isOAuthUser ? "Password set successfully" : "Password changed successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);
  };

  const handleSignOut = async () => {
    await signOutToLanding();

    Alert.alert("Signed Out", "You have been logged out.");
    router.replace("/");
  };

  const handleChangePhoto = async () => {
    if (!userProfile) {
      Alert.alert("Error", "This profile is not connected to the database.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow photo access to change your profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    setUploadingPhoto(true);

    try {
      const selectedPhoto = result.assets[0];
      const photoResponse = await fetch(selectedPhoto.uri);
      const photoData = await photoResponse.arrayBuffer();
      const contentType = selectedPhoto.mimeType || "image/jpeg";
      const extension = contentType === "image/png" ? "png" : "jpg";
      const photoPath = `${userProfile.id}/profile-photo.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(photoPath, photoData, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        Alert.alert(
          "Photo Upload Error",
          `${uploadError.message}\n\nMake sure the profile-photos storage bucket exists in Supabase.`
        );
        return;
      }

      const { data: publicPhoto } = supabase.storage.from("profile-photos").getPublicUrl(photoPath);
      const updatedPhotoUrl = `${publicPhoto.publicUrl}?updated=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: updatedPhotoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userProfile.id);

      if (updateError) {
        Alert.alert(
          "Photo Save Error",
          `${updateError.message}\n\nMake sure profiles.avatar_url exists in Supabase.`
        );
        return;
      }

      setPhotoUrl(updatedPhotoUrl);
      Alert.alert("Success", "Profile photo updated successfully");
    } catch {
      Alert.alert("Error", "The selected photo could not be uploaded.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      style={page}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={title}>Profile</Text>

          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Ionicons name="create-outline" size={24} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={profilePhotoBox}>
          <View style={profilePhoto}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={profilePhotoImage} />
            ) : (
              <Ionicons name="person-outline" size={46} color="#6D28D9" />
            )}
          </View>
          <TouchableOpacity
            onPress={handleChangePhoto}
            style={changePhotoButton}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#6D28D9" />
            ) : (
              <Ionicons name="camera-outline" size={16} color="#6D28D9" />
            )}
            <Text style={photoText}>{uploadingPhoto ? "Uploading..." : "Change Photo"}</Text>
          </TouchableOpacity>
        </View>

        <View style={card}>
          <Text style={label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={editMode}
            style={[input, !editMode && disabledInput]}
          />

          <Text style={label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            editable={editMode}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[input, !editMode && disabledInput]}
          />

          {editMode && (
            <TouchableOpacity onPress={handleSaveProfile} style={saveButton}>
              <Text style={buttonText}>Save Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/order-history" as any)}
          style={menuButton}
        >
          <View style={menuLeft}>
            <Ionicons name="receipt-outline" size={22} color="#6D28D9" />
            <Text style={menuText}>Order History</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={22} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowPasswordForm(!showPasswordForm)}
          style={menuButton}
        >
          <View style={menuLeft}>
            <Ionicons name="lock-closed-outline" size={22} color="#6D28D9" />
            <Text style={menuText}>Change Password</Text>
          </View>
          <Ionicons
            name={showPasswordForm ? "chevron-up-outline" : "chevron-down-outline"}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>

        {showPasswordForm && (
          <View style={card}>
            {isOAuthUser && (
              <Text style={oauthPasswordHint}>
                This Google account does not have a manual password yet. Set one to sign in with email and password.
              </Text>
            )}

            {!isOAuthUser && (
              <>
                <Text style={label}>Current Password</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Enter current password"
                  style={input}
                />
              </>
            )}

            <Text style={label}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password"
              style={input}
            />

            <Text style={label}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm new password"
              style={input}
            />

            <TouchableOpacity onPress={handleChangePassword} style={saveButton}>
              <Text style={buttonText}>{isOAuthUser ? "Set Password" : "Update Password"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={handleSignOut} style={signOutButton}>
          <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
          <Text style={signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const page = {
  flex: 1,
  backgroundColor: "#FFFFFF",
};

const container = {
  paddingHorizontal: 20,
  paddingTop: 55,
  paddingBottom: 150,
};

const header = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 28,
};

const title = {
  fontSize: 20,
  fontWeight: "bold" as const,
  color: "#111827",
};

const profilePhotoBox = {
  alignItems: "center" as const,
  marginBottom: 28,
};

const profilePhoto = {
  width: 105,
  height: 105,
  borderRadius: 60,
  backgroundColor: "#F3E8FF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginBottom: 10,
  overflow: "hidden" as const,
};

const profilePhotoImage = {
  width: "100%" as const,
  height: "100%" as const,
};

const changePhotoButton = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  paddingVertical: 6,
  paddingHorizontal: 10,
};

const photoText = {
  fontSize: 13,
  color: "#6D28D9",
  fontWeight: "600" as const,
};

const card = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
};

const label = {
  fontSize: 14,
  fontWeight: "600" as const,
  color: "#111827",
  marginBottom: 8,
};

const input = {
  backgroundColor: "#F3F4F6",
  padding: 14,
  borderRadius: 12,
  marginBottom: 16,
};

const disabledInput = {
  color: "#6B7280",
};

const saveButton = {
  backgroundColor: "#6D28D9",
  padding: 15,
  borderRadius: 12,
  marginTop: 4,
};

const buttonText = {
  color: "#FFFFFF",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

const menuButton = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 16,
  padding: 16,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 18,
};

const menuLeft = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
};

const menuText = {
  fontSize: 15,
  fontWeight: "600" as const,
  color: "#111827",
};

const oauthPasswordHint = {
  color: "#6B7280",
  fontSize: 12,
  lineHeight: 18,
  backgroundColor: "#F9FAFB",
  borderRadius: 8,
  padding: 10,
  marginBottom: 12,
};

const signOutButton = {
  backgroundColor: "#DC2626",
  padding: 16,
  borderRadius: 14,
  flexDirection: "row" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 8,
  marginTop: 12,
};

const signOutText = {
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: "bold" as const,
};

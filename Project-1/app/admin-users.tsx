import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import bcrypt from "@/lib/bcrypt";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type UserRole = "customer" | "admin" | "staff";

type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
};

const roleOptions: (UserRole | "all")[] = ["all", "customer", "admin", "staff"];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      const currentRole = await AsyncStorage.getItem("userRole");

      if (currentRole !== "admin") {
        Alert.alert("Access Denied", "User management is for admin only.");
        router.replace("/customer");
        return;
      }

      fetchUsers();
    };

    checkAccessAndLoad();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  const fetchUsers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,role,created_at")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    setUsers((data || []) as UserAccount[]);
  };

  const clearForm = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("customer");
  };

  const fillForm = (user: UserAccount) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
  };

  const saveUser = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!name.trim() || !normalizedEmail || (!editingUser && !password)) {
      Alert.alert("Error", "Please fill name, email, and password.");
      return;
    }

    if ((role === "admin" || role === "staff") && !normalizedEmail.endsWith("@smartfash.com")) {
      Alert.alert("Error", "Admin and staff emails must use @smartfash.com.");
      return;
    }

    const userData: {
      name: string;
      email: string;
      role: UserRole;
      password?: string;
    } = {
      name: name.trim(),
      email: normalizedEmail,
      role,
    };

    if (password) {
      userData.password = await bcrypt.hash(password, 10);
    }

    const { error } = editingUser
      ? await supabase
          .from("users")
          .update(userData)
          .eq("id", editingUser.id)
      : await supabase
          .from("users")
          .insert(userData);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    Alert.alert("Success", editingUser ? "User updated." : "User added.");
    clearForm();
    fetchUsers();
  };

  const deleteUser = (user: UserAccount) => {
    Alert.alert("Delete User", `Delete ${user.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("users").delete().eq("id", user.id);

          if (error) {
            Alert.alert("Error", error.message);
            return;
          }

          if (editingUser?.id === user.id) {
            clearForm();
          }

          fetchUsers();
        },
      },
    ]);
  };

  return (
    <View style={page}>
      <ScrollView contentContainerStyle={container}>
        <View style={header}>
          <TouchableOpacity onPress={() => router.back()} style={iconButton}>
            <Ionicons name="arrow-back" size={22} color="#6D28D9" />
          </TouchableOpacity>
          <View style={headerText}>
            <Text style={title}>User Management</Text>
            <Text style={subtitle}>Add, edit, delete, search, and filter users</Text>
          </View>
          <TouchableOpacity onPress={fetchUsers} style={iconButton}>
            <Ionicons name="refresh-outline" size={22} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={formBox}>
          <Text style={sectionTitle}>{editingUser ? "Edit User" : "Add New User"}</Text>
          <TextInput
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            style={input}
          />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={input}
          />
          <TextInput
            placeholder={editingUser ? "New password optional" : "Password"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={input}
          />

          <View style={roleRow}>
            {roleOptions
              .filter((item): item is UserRole => item !== "all")
              .map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setRole(item)}
                  style={[roleButton, role === item && activeRoleButton]}
                >
                  <Text style={[roleButtonText, role === item && activeRoleButtonText]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <TouchableOpacity onPress={saveUser} style={primaryButton}>
            <Ionicons
              name={editingUser ? "save-outline" : "add-outline"}
              size={20}
              color="#FFFFFF"
            />
            <Text style={primaryButtonText}>
              {editingUser ? "Update User" : "Add User"}
            </Text>
          </TouchableOpacity>
          {editingUser && (
            <TouchableOpacity onPress={clearForm} style={secondaryButton}>
              <Text style={secondaryButtonText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          placeholder="Search users"
          value={search}
          onChangeText={setSearch}
          style={input}
        />

        <View style={filterRow}>
          {roleOptions.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setRoleFilter(item)}
              style={[filterButton, roleFilter === item && activeFilterButton]}
            >
              <Text style={[filterButtonText, roleFilter === item && activeFilterButtonText]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={listHeader}>
          <Text style={sectionTitle}>Users</Text>
          <Text style={countText}>
            {loading ? "Loading..." : `${filteredUsers.length} shown`}
          </Text>
        </View>

        {filteredUsers.map((user) => (
          <View key={user.id} style={userCard}>
            <View style={avatar}>
              <Ionicons name="person-outline" size={20} color="#6D28D9" />
            </View>
            <View style={userInfo}>
              <Text style={userName}>{user.name}</Text>
              <Text style={userEmail}>{user.email}</Text>
              <Text style={roleBadge}>{user.role}</Text>
            </View>
            <View style={actionColumn}>
              <TouchableOpacity onPress={() => fillForm(user)} style={smallActionButton}>
                <Ionicons name="create-outline" size={18} color="#6D28D9" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteUser(user)}
                style={[smallActionButton, deleteButton]}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && filteredUsers.length === 0 && (
          <Text style={emptyText}>No users found.</Text>
        )}
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
  marginBottom: 22,
};

const headerText = {
  flex: 1,
};

const iconButton = {
  width: 42,
  height: 42,
  borderRadius: 10,
  backgroundColor: "#F3E8FF",
  justifyContent: "center" as const,
  alignItems: "center" as const,
};

const title = {
  fontSize: 22,
  fontWeight: "bold" as const,
  color: "#111827",
};

const subtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "#6B7280",
};

const formBox = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 16,
  marginBottom: 24,
};

const sectionTitle = {
  fontSize: 17,
  fontWeight: "bold" as const,
  color: "#111827",
  marginBottom: 12,
};

const input = {
  backgroundColor: "#F3F4F6",
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
};

const roleRow = {
  flexDirection: "row" as const,
  gap: 8,
  marginBottom: 12,
};

const roleButton = {
  flex: 1,
  borderRadius: 10,
  backgroundColor: "#F3F4F6",
  paddingVertical: 11,
};

const activeRoleButton = {
  backgroundColor: "#6D28D9",
};

const roleButtonText = {
  textAlign: "center" as const,
  color: "#6B7280",
  fontWeight: "bold" as const,
  textTransform: "capitalize" as const,
};

const activeRoleButtonText = {
  color: "#FFFFFF",
};

const primaryButton = {
  backgroundColor: "#6D28D9",
  borderRadius: 10,
  padding: 15,
  flexDirection: "row" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  gap: 8,
};

const primaryButtonText = {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "bold" as const,
};

const secondaryButton = {
  marginTop: 10,
  borderRadius: 10,
  padding: 14,
  backgroundColor: "#F3F4F6",
};

const secondaryButtonText = {
  color: "#6D28D9",
  textAlign: "center" as const,
  fontWeight: "bold" as const,
};

const filterRow = {
  flexDirection: "row" as const,
  gap: 8,
  marginBottom: 18,
};

const filterButton = {
  flex: 1,
  borderRadius: 10,
  backgroundColor: "#F3F4F6",
  paddingVertical: 10,
};

const activeFilterButton = {
  backgroundColor: "#EDE9FE",
};

const filterButtonText = {
  color: "#6B7280",
  fontWeight: "bold" as const,
  textAlign: "center" as const,
  textTransform: "capitalize" as const,
  fontSize: 12,
};

const activeFilterButtonText = {
  color: "#6D28D9",
};

const listHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};

const countText = {
  color: "#6B7280",
  fontSize: 12,
};

const userCard = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
};

const avatar = {
  width: 42,
  height: 42,
  borderRadius: 8,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginRight: 12,
};

const userInfo = {
  flex: 1,
};

const userName = {
  fontSize: 15,
  fontWeight: "bold" as const,
  color: "#111827",
};

const userEmail = {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 4,
};

const roleBadge = {
  color: "#6D28D9",
  fontSize: 12,
  fontWeight: "bold" as const,
  textTransform: "capitalize" as const,
  marginTop: 6,
};

const actionColumn = {
  gap: 8,
};

const smallActionButton = {
  width: 36,
  height: 36,
  borderRadius: 10,
  backgroundColor: "#F3E8FF",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const deleteButton = {
  backgroundColor: "#FEF2F2",
};

const emptyText = {
  textAlign: "center" as const,
  color: "#6B7280",
  marginTop: 60,
};

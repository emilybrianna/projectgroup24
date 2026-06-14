import { supabase } from "@/lib/supabase";

type ProfileSyncData = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function syncProfile(data: ProfileSyncData) {
  const result = await supabase.from("profiles").upsert(
    {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
    },
    {
      onConflict: "id",
    }
  );

  if (!result.error?.message.includes("profiles_role_check")) {
    return result;
  }

  return supabase.from("profiles").upsert(
    {
      id: data.id,
      name: data.name,
      email: data.email,
    },
    {
      onConflict: "id",
    }
  );
}

import { NextResponse } from "next/server";
import type { Database } from "@/db/supabase-database.types";
import { getBearerTokenFromRequest } from "@/lib/chat/auth";
import supabaseAdmin from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type AppUserRow = Database["public"]["Tables"]["app_users"]["Row"];

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    console.error("[profile] Supabase service configuration is unavailable.");
    return NextResponse.json(
      { error: "Profile service is unavailable." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const accessToken = getBearerTokenFromRequest(request);
  if (!accessToken) return unauthorized();

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  const authUser = authData?.user;

  if (authError || !authUser?.id) {
    return unauthorized();
  }

  const loadProfile = async (): Promise<AppUserRow | null> => {
    const { data, error } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  try {
    let appUser = await loadProfile();

    if (!appUser) {
      const normalizedEmail = (authUser.email || "").trim().toLowerCase();
      if (!normalizedEmail) {
        return NextResponse.json(
          { error: "No application profile exists for this account." },
          { status: 404, headers: noStoreHeaders },
        );
      }

      const { error: syncError } = await supabaseAdmin.rpc("sync_auth_user_to_app_users", {
        p_auth_user_id: authUser.id,
        p_email: normalizedEmail,
      });

      if (syncError) throw syncError;
      appUser = await loadProfile();
    }

    if (!appUser) {
      return NextResponse.json(
        { error: "No application profile exists for this account." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    return NextResponse.json({ appUser }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[profile] Failed to load authenticated application profile", {
      userId: authUser.id,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Unable to load the application profile." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

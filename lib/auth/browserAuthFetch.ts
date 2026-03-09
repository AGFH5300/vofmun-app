import supabase from "@/lib/supabase";

const toHeaders = (headers?: HeadersInit): Headers => {
  if (headers instanceof Headers) return new Headers(headers);
  return new Headers(headers || {});
};

export async function getBrowserAccessToken(debugSource?: string): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.debug("[AuthFetchDebug] session_resolution_error", {
      source: debugSource || "unknown",
      message: error.message,
    });
    return null;
  }

  const token = data.session?.access_token || null;

  console.debug("[AuthFetchDebug] session_resolved", {
    source: debugSource || "unknown",
    hasSession: Boolean(data.session),
    hasToken: Boolean(token),
  });

  return token;
}

export async function withBrowserAuthHeaders(
  extra?: RequestInit,
  debugSource?: string
): Promise<RequestInit> {
  const accessToken = await getBrowserAccessToken(debugSource);
  const headers = toHeaders(extra?.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  console.debug("[AuthFetchDebug] build_headers", {
    source: debugSource || "unknown",
    hasToken: Boolean(accessToken),
    method: extra?.method || "GET",
  });

  return {
    credentials: "include",
    ...extra,
    headers,
  };
}

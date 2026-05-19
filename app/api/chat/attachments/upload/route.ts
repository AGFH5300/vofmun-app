import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";

const MAX_UPLOAD_BYTES = Number.parseInt(process.env.NEXT_PUBLIC_CHAT_ATTACHMENT_MAX_SIZE_BYTES || String(25 * 1024 * 1024), 10);

const getBearerToken = (request: NextRequest): string | null => {
  const auth = request.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
};

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const roomId = String(formData.get("roomId") || "").trim();
    const file = formData.get("file");

    if (!roomId || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing upload payload" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
    const path = `${roomId}/${crypto.randomUUID()}/${safeName}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("chat-attachments")
      .upload(path, Buffer.from(bytes), {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 });
    }

    return NextResponse.json({
      bucket: "chat-attachments",
      path,
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

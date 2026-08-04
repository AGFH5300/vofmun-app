from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:180]!r}")
    file.write_text(text.replace(old, new))


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text()
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"{path}: start marker not found: {start!r}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"{path}: end marker not found: {end!r}")
    file.write_text(text[:start_index] + replacement + text[end_index:])


migration = "supabase/migrations/20260804183000_identity_link_and_rls_hardening.sql"
pending_sql = r'''-- Pending uploads are service-role-only staging records. A browser receives a
-- one-time upload_id, and the message API consumes the trusted server record.
create table if not exists public.pending_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  bucket text not null default 'chat-attachments' check (bucket = 'chat-attachments'),
  path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists pending_chat_attachments_creator_created_idx
  on public.pending_chat_attachments(created_by, created_at desc);
create index if not exists pending_chat_attachments_room_created_idx
  on public.pending_chat_attachments(room_id, created_at desc);
create index if not exists pending_chat_attachments_unconsumed_idx
  on public.pending_chat_attachments(created_at)
  where consumed_at is null;

alter table public.pending_chat_attachments enable row level security;
revoke all on table public.pending_chat_attachments from anon, authenticated;

'''
replace_exact(
    migration,
    "-- Storage required by the app. Live updates are intentionally public; chat\n",
    pending_sql + "-- Storage required by the app. Live updates are intentionally public; chat\n",
)
replace_exact(
    migration,
    """insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 26214400)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
""",
    """insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
""",
)

replace_exact(
    "db/supabase-database.types.ts",
    """      message_attachments: {
""",
    """      pending_chat_attachments: {
        Row: { id: string; room_id: string; bucket: string; path: string; original_name: string; mime_type: string; size_bytes: number; created_by: string; created_at: string; consumed_at: string | null };
        Insert: { id?: string; room_id: string; bucket?: string; path: string; original_name: string; mime_type: string; size_bytes: number; created_by: string; created_at?: string; consumed_at?: string | null };
        Update: { id?: string; room_id?: string; bucket?: string; path?: string; original_name?: string; mime_type?: string; size_bytes?: number; created_by?: string; created_at?: string; consumed_at?: string | null };
        Relationships: EmptyRelationships;
      };
      message_attachments: {
""",
)

replace_exact(
    "app/api/chat/attachments/sign/route.ts",
    "const expiresIn = body.download ? 60 : 60 * 60;",
    "const expiresIn = body.download ? 5 * 60 : 60 * 60;",
)

replace_exact(
    "app/api/rooms/[roomId]/messages/route.ts",
    "trustedPending = pendingRows.map((row) => ({ ...row, size_bytes: Number(row.size_bytes) }));",
    """trustedPending = pendingRows.map((row) => ({
        id: row.id,
        room_id: row.room_id,
        bucket: row.bucket,
        path: row.path,
        original_name: row.original_name,
        mime_type: row.mime_type || 'application/octet-stream',
        size_bytes: Number(row.size_bytes),
      }));""",
)

page = "app/messages/page.tsx"
replace_exact(
    page,
    'import { MessageAttachmentInput, MessageWithUser, RoomWithDetails } from "@/lib/chat/types";\nimport supabase from "@/lib/supabase";\nimport { toast } from "sonner";',
    'import { MessageAttachment, MessageAttachmentInput, MessageWithUser, RoomWithDetails } from "@/lib/chat/types";\nimport { deletePendingChatAttachment, getChatAttachmentSignedUrl, uploadChatAttachment } from "@/lib/chat/attachmentClient";\nimport { toast } from "sonner";',
)
replace_exact(
    page,
    '  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentItem[]>([]);\n',
    '  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentItem[]>([]);\n  const pendingAttachmentsRef = useRef<PendingAttachmentItem[]>([]);\n  const pendingAttachmentRoomIdRef = useRef<string | null>(null);\n',
)

new_upload_handler = '''  const handleAttachmentSelect = async (selectedFiles: FileList | null) => {
    if (!activeRoom || !selectedFiles || selectedFiles.length === 0) return;
    const targetRoomId = String(activeRoom.id);
    if (!pendingAttachmentRoomIdRef.current) pendingAttachmentRoomIdRef.current = targetRoomId;
    const files = Array.from(selectedFiles);
    setAttachmentUploadError(null);

    const total = pendingAttachments.length + files.length;
    if (total > maxAttachmentsPerMessage) {
      setAttachmentUploadError(`You can attach up to ${maxAttachmentsPerMessage} files per message.`);
      return;
    }

    const oversized = files.find((file) => file.size > maxAttachmentSizeBytes);
    if (oversized) {
      setAttachmentUploadError(`"${oversized.name}" is larger than ${formatSize(maxAttachmentSizeBytes)}.`);
      return;
    }

    const queuedItems: PendingAttachmentItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      original_name: file.name,
      size_bytes: file.size,
      mime_type: file.type || "application/octet-stream",
      status: "uploading",
    }));
    setPendingAttachments((previous) => [...previous, ...queuedItems]);

    await Promise.all(
      files.map(async (file, index) => {
        const pendingId = queuedItems[index].id;
        try {
          const attachment = await uploadChatAttachment(targetRoomId, file, ATTACHMENT_UPLOAD_TIMEOUT_MS);

          if (pendingAttachmentRoomIdRef.current !== targetRoomId) {
            if (attachment.upload_id) await deletePendingChatAttachment(attachment.upload_id);
            setPendingAttachments((previous) => previous.filter((item) => item.id !== pendingId));
            return;
          }

          setPendingAttachments((previous) =>
            previous.map((item) =>
              item.id === pendingId ? { ...item, status: "uploaded", attachment, error: undefined } : item,
            ),
          );
        } catch (uploadError) {
          const error = uploadError instanceof Error ? uploadError : new Error("Upload failed");
          console.error("Attachment upload failed", { fileName: file.name, error });
          setPendingAttachments((previous) =>
            previous.map((item) =>
              item.id === pendingId ? { ...item, status: "error", error: error.message } : item,
            ),
          );
        }
      }),
    );

    setShowAttachmentMenu(false);
  };

'''
replace_between(page, "  const handleAttachmentSelect = async", "  const hasDraggedFiles", new_upload_handler)

new_send_handler = '''  const handleSend = async () => {
    const roomId = activeRoom?.id ? String(activeRoom.id) : null;
    const uploadedAttachments = pendingAttachments
      .filter((item) => item.status === "uploaded" && item.attachment)
      .map((item) => item.attachment as MessageAttachmentInput);
    const trimmedComposer = composer.trim();

    if (!roomId || (trimmedComposer.length === 0 && uploadedAttachments.length === 0) || isUploadingAttachments) return;

    const previousComposer = composer;
    const previousAttachments = pendingAttachments;
    const previousReplyId = replyingToMessageId;
    sendTyping(roomId, false);
    setComposer("");
    setPendingAttachments([]);
    setAttachmentUploadError(null);

    try {
      await sendMessage(roomId, trimmedComposer, uploadedAttachments, previousReplyId);
      setReplyingToMessageId(null);
      setDraftsByRoom((previous) => {
        if (!previous[roomId]) return previous;
        return { ...previous, [roomId]: "" };
      });
    } catch (error) {
      setComposer((current) => current || previousComposer);
      setPendingAttachments((current) => (current.length > 0 ? current : previousAttachments));
      setReplyingToMessageId((current) => current || previousReplyId);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };


'''
replace_between(page, "  const handleSend = async", "  const handleDeleteSelectedMessages", new_send_handler)

new_remove_handler = '''  const removePendingAttachment = async (pendingId: string) => {
    const removedItem = pendingAttachmentsRef.current.find((item) => item.id === pendingId);
    setPendingAttachments((previous) => previous.filter((item) => item.id !== pendingId));

    const uploadId = removedItem?.attachment?.upload_id;
    if (!uploadId) return;
    try {
      await deletePendingChatAttachment(uploadId);
    } catch (error) {
      console.warn("Unable to remove pending attachment", {
        uploadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

'''
replace_between(page, "  const removePendingAttachment = async", "  const toggleAttachmentMenu", new_remove_handler)

replace_exact(
    page,
    "return [] as Array<{ message: MessageWithUser; attachment: MessageAttachmentInput }>;",
    "return [] as Array<{ message: MessageWithUser; attachment: MessageAttachment }>;",
)
replace_exact(
    page,
    "const getAttachmentLinkKey = (attachment: MessageAttachmentInput) => `${attachment.bucket}:${attachment.path}`;",
    "const getAttachmentLinkKey = (attachment: MessageAttachment) => attachment.id;",
)
replace_exact(
    page,
    "const prepareFileLinks = async (attachment: MessageAttachmentInput, options?: { force?: boolean }) => {",
    "const prepareFileLinks = async (attachment: MessageAttachment, options?: { force?: boolean }) => {",
)
replace_exact(
    page,
    '''      const expirySeconds = 300;
      const [{ data: openData, error: openError }, { data: downloadData, error: downloadError }] = await Promise.all([
        supabase.storage.from(attachment.bucket).createSignedUrl(attachment.path, expirySeconds),
        supabase.storage
          .from(attachment.bucket)
          .createSignedUrl(attachment.path, expirySeconds, { download: attachment.original_name || true }),
      ]);

      if (requestVersion !== fileLinksRequestVersionRef.current || !showAllFilesModal) return;

      if (openError || downloadError || !openData?.signedUrl || !downloadData?.signedUrl) {
        setPreparedFileLinks((prev) => ({ ...prev, [key]: { ...prev[key], loading: false, error: "Unable to prepare file link." } }));
        return;
      }

      setPreparedFileLinks((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: undefined,
          openUrl: openData.signedUrl,
          downloadUrl: downloadData.signedUrl,
          expiresAt: Date.now() + expirySeconds * 1000,
        },
      }));
''',
    '''      const expirySeconds = 300;
      const [openUrl, downloadUrl] = await Promise.all([
        getChatAttachmentSignedUrl(attachment.id),
        getChatAttachmentSignedUrl(attachment.id, { download: true }),
      ]);

      if (requestVersion !== fileLinksRequestVersionRef.current || !showAllFilesModal) return;

      setPreparedFileLinks((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: undefined,
          openUrl,
          downloadUrl,
          expiresAt: Date.now() + expirySeconds * 1000,
        },
      }));
''',
)

replace_exact(
    page,
    '''  useEffect(() => {
    setIsUploadingAttachments(pendingAttachments.some((item) => item.status === "uploading"));
  }, [pendingAttachments]);
''',
    '''  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
    setIsUploadingAttachments(pendingAttachments.some((item) => item.status === "uploading"));
  }, [pendingAttachments]);

  useEffect(() => {
    const nextRoomId = activeRoom?.id ? String(activeRoom.id) : null;
    const previousRoomId = pendingAttachmentRoomIdRef.current;
    pendingAttachmentRoomIdRef.current = nextRoomId;
    if (!previousRoomId || previousRoomId === nextRoomId) return;

    const staleUploads = pendingAttachmentsRef.current
      .map((item) => item.attachment?.upload_id)
      .filter((uploadId): uploadId is string => Boolean(uploadId));
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
    setAttachmentUploadError(null);
    if (staleUploads.length > 0) {
      void Promise.allSettled(staleUploads.map((uploadId) => deletePendingChatAttachment(uploadId)));
    }
  }, [activeRoom?.id]);
''',
)

bubble = "app/messages/components/MessageBubble.tsx"
replace_exact(
    bubble,
    "import supabase from '@/lib/supabase';",
    "import { getChatAttachmentSignedUrl } from '@/lib/chat/attachmentClient';",
)
replace_exact(
    bubble,
    '''          const { data, error } = await supabase.storage
            .from(attachment.bucket)
            .createSignedUrl(attachment.path, SIGNED_URL_TTL_SECONDS);

          if (!error && data?.signedUrl) {
            signedUrlCache.set(cacheKey, {
              url: data.signedUrl,
              expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
            });
            nextMap[attachment.path] = data.signedUrl;
            return;
          }

          const message = String(error?.message || 'Attachment unavailable');
          if (error) {
            console.warn('[chat] failed to hydrate attachment URL', {
              attachmentId: attachment.id,
              bucket: attachment.bucket,
              path: attachment.path,
              error,
            });
          }
          nextErrors[attachment.path] = /not found/i.test(message) ? 'Attachment no longer exists.' : 'Attachment unavailable.';
''',
    '''          try {
            const signedUrl = await getChatAttachmentSignedUrl(attachment.id);
            signedUrlCache.set(cacheKey, {
              url: signedUrl,
              expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
            });
            nextMap[attachment.path] = signedUrl;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Attachment unavailable';
            console.warn('[chat] failed to hydrate attachment URL', {
              attachmentId: attachment.id,
              path: attachment.path,
              message,
            });
            nextErrors[attachment.path] = /not found|no longer exists/i.test(message)
              ? 'Attachment no longer exists.'
              : 'Attachment unavailable.';
          }
''',
)
replace_exact(
    bubble,
    '''      const { data, error } = await supabase.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 60, { download: attachment.original_name || true });

      if (error || !data?.signedUrl) {
        console.error('[chat] failed to create signed download URL', {
          attachmentId: attachment.id,
          bucket: attachment.bucket,
          path: attachment.path,
          error,
        });
        return;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
''',
    '''      const signedUrl = await getChatAttachmentSignedUrl(attachment.id, { download: true });
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
''',
)

for checked in (
    migration,
    "db/supabase-database.types.ts",
    "app/api/chat/attachments/sign/route.ts",
    "app/api/rooms/[roomId]/messages/route.ts",
    page,
    bubble,
):
    text = Path(checked).read_text()
    if "\r\n" in text:
        raise SystemExit(f"{checked}: unexpected CRLF")

for target in (page, bubble):
    text = Path(target).read_text()
    if "supabase.storage" in text or "createSignedUrl" in text:
        raise SystemExit(f"{target}: direct browser storage access remains")

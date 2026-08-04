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


server = "server/chat/server.ts"
replace_exact(
    server,
    "const isDevelopment = process.env.NODE_ENV !== 'production';\n",
    """const isDevelopment = process.env.NODE_ENV !== 'production';
const MAX_MESSAGE_LENGTH = 5000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
""",
)

new_post_route = r'''app.post('/api/rooms/:roomId/messages', chatWriteRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
  let claimedUploadIds: string[] = [];
  try {
    const { roomId } = req.params;
    const userId = String(req.userId || '');
    const { content, reply_to, attachments = [] } = req.body as {
      content?: string;
      reply_to?: string | null;
      attachments?: MessageAttachmentInput[];
    };
    const trimmedContent = content?.trim() || '';
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
    const replyTo = reply_to ? String(reply_to) : null;

    if (!trimmedContent && normalizedAttachments.length === 0) {
      return res.status(400).json({ error: 'Message content or attachments are required' });
    }
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    }
    if (normalizedAttachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return res.status(400).json({ error: `A message can include at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments` });
    }

    logServerDebug('http:messages:insert_attempt', {
      roomId,
      resolvedUserId: userId,
      hasContent: Boolean(trimmedContent),
      attachmentCount: normalizedAttachments.length,
    });

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .limit(1);
    if (membershipError) {
      console.error('Error validating room membership', membershipError);
      return res.status(500).json({ error: 'Failed to validate room membership' });
    }
    if (!membershipRows || membershipRows.length === 0) {
      return res.status(403).json({ error: 'Not a room member' });
    }

    if (replyTo) {
      const { data: replyMessage, error: replyError } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('id', replyTo)
        .eq('room_id', roomId)
        .maybeSingle();
      if (replyError) throw replyError;
      if (!replyMessage) {
        return res.status(400).json({ error: 'Reply target is not in this room' });
      }
    }

    let trustedPending: Array<{
      id: string;
      room_id: string;
      bucket: string;
      path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
    }> = [];

    if (normalizedAttachments.length > 0) {
      const uploadIds = normalizedAttachments.map((attachment) => String(attachment.upload_id || '').trim());
      if (uploadIds.some((uploadId) => !isUuid(uploadId)) || new Set(uploadIds).size !== uploadIds.length) {
        return res.status(400).json({ error: 'Attachments must reference unique verified uploads' });
      }

      const { data: pendingRows, error: pendingError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .select('id, room_id, bucket, path, original_name, mime_type, size_bytes')
        .in('id', uploadIds)
        .eq('created_by', userId)
        .eq('room_id', roomId)
        .is('consumed_at', null);
      if (pendingError) throw pendingError;
      if (!pendingRows || pendingRows.length !== uploadIds.length) {
        return res.status(409).json({ error: 'One or more attachments are invalid or already used' });
      }

      trustedPending = pendingRows.map((row: any) => ({
        id: String(row.id),
        room_id: String(row.room_id),
        bucket: String(row.bucket),
        path: String(row.path),
        original_name: String(row.original_name),
        mime_type: String(row.mime_type || 'application/octet-stream'),
        size_bytes: Number(row.size_bytes),
      }));
      if (trustedPending.some((row) =>
        row.bucket !== 'chat-attachments' ||
        row.size_bytes <= 0 ||
        row.size_bytes > MAX_ATTACHMENT_BYTES ||
        !row.path.startsWith(`${roomId}/${userId}/`)
      )) {
        return res.status(400).json({ error: 'Attachment metadata is invalid' });
      }

      const { data: claimedRows, error: claimError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .update({ consumed_at: new Date().toISOString() })
        .in('id', uploadIds)
        .eq('created_by', userId)
        .eq('room_id', roomId)
        .is('consumed_at', null)
        .select('id');
      if (claimError) throw claimError;
      if (!claimedRows || claimedRows.length !== uploadIds.length) {
        await supabaseAdmin.from('pending_chat_attachments').update({ consumed_at: null }).in('id', uploadIds).eq('created_by', userId);
        return res.status(409).json({ error: 'One or more attachments are already being used' });
      }
      claimedUploadIds = uploadIds;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('messages')
      .insert({ room_id: roomId, user_id: userId, content: trimmedContent, reply_to: replyTo })
      .select('*')
      .single();
    if (error || !inserted) {
      if (claimedUploadIds.length > 0) {
        await supabaseAdmin.from('pending_chat_attachments').update({ consumed_at: null }).in('id', claimedUploadIds).eq('created_by', userId);
      }
      return res.status(500).json({ error: 'Failed to send message' });
    }

    if (trustedPending.length > 0) {
      const attachmentRows = trustedPending.map((attachment) => ({
        message_id: (inserted as any).id,
        room_id: roomId,
        bucket: attachment.bucket,
        path: attachment.path,
        original_name: attachment.original_name,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes,
        created_by: userId,
      }));
      const { error: attachmentError } = await supabaseAdmin.from('message_attachments').insert(attachmentRows);
      if (attachmentError) {
        await supabaseAdmin.from('messages').delete().eq('id', (inserted as any).id);
        await supabaseAdmin.from('pending_chat_attachments').update({ consumed_at: null }).in('id', claimedUploadIds).eq('created_by', userId);
        return res.status(500).json({ error: 'Failed to save attachments' });
      }
      const { error: pendingDeleteError } = await supabaseAdmin
        .from('pending_chat_attachments')
        .delete()
        .in('id', claimedUploadIds)
        .eq('created_by', userId);
      if (pendingDeleteError) {
        console.error('[chat] failed to remove consumed pending uploads', {
          userId,
          roomId,
          uploadIds: claimedUploadIds,
          error: pendingDeleteError.message || pendingDeleteError,
        });
      }
      claimedUploadIds = [];
    }

    const profiles = await fetchProfilesByIds([String((inserted as any).user_id)]);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds([String((inserted as any).id)]);
    const payload: MessageWithUser = {
      ...(inserted as any),
      user: profiles[(inserted as any).user_id],
      attachments: attachmentsByMessageId[String((inserted as any).id)] || [],
    };

    broadcastToRoom(roomId, { type: 'new_message', message: payload });
    return res.json(payload);
  } catch (error) {
    if (claimedUploadIds.length > 0 && req.userId) {
      await supabaseAdmin
        .from('pending_chat_attachments')
        .update({ consumed_at: null })
        .in('id', claimedUploadIds)
        .eq('created_by', req.userId);
    }
    console.error('Error sending message', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});


'''
replace_between(
    server,
    "app.post('/api/rooms/:roomId/messages'",
    "app.patch('/api/rooms/:roomId/messages/:messageId'",
    new_post_route,
)

replace_exact(
    server,
    """    const profiles = await fetchProfilesByIds([String((updated as any).user_id)]);
    const attachmentsByMessageId = await fetchAttachmentsByMessageIds([String((updated as any).id)]);
    const payload: MessageWithUser = {
      ...(updated as any),
      user: profiles[(updated as any).user_id],
      attachments: attachmentsByMessageId[String((updated as any).id)] || [],
    };

    broadcastToRoom(roomId, { type: 'message_updated', roomId, message: payload } as ChatSocketPayload);
    return res.json(payload);
  } catch (error) {
    console.error('Error deleting message', error);
""",
    """    const attachmentPaths = (previousAttachments || [])
      .filter((attachment: any) => String(attachment.bucket || '') === 'chat-attachments')
      .map((attachment: any) => String(attachment.path || ''))
      .filter(Boolean);
    if (attachmentPaths.length > 0) {
      const { error: storageCleanupError } = await supabaseAdmin.storage.from('chat-attachments').remove(attachmentPaths);
      if (storageCleanupError) {
        console.error('[chat] failed to remove deleted message attachments from storage', {
          roomId,
          messageId,
          paths: attachmentPaths,
          error: storageCleanupError.message || storageCleanupError,
        });
      }
    }
    const { error: attachmentDeleteError } = await supabaseAdmin
      .from('message_attachments')
      .delete()
      .eq('message_id', messageId)
      .eq('room_id', roomId);
    if (attachmentDeleteError) {
      console.error('[chat] failed to remove deleted message attachment rows', {
        roomId,
        messageId,
        error: attachmentDeleteError.message || attachmentDeleteError,
      });
    }

    const profiles = await fetchProfilesByIds([String((updated as any).user_id)]);
    const payload: MessageWithUser = {
      ...(updated as any),
      user: profiles[(updated as any).user_id],
      attachments: [],
    };

    broadcastToRoom(roomId, { type: 'message_updated', roomId, message: payload } as ChatSocketPayload);
    return res.json(payload);
  } catch (error) {
    console.error('Error deleting message', error);
""",
)

context = "app/messages/context/ChatContext.tsx"
replace_exact(
    context,
    """        const failedRoomMessages = (messagesRef.current[liveRoomId] || []).map((msg) =>
          msg.id === tempId ? { ...msg, status: 'error' as MessageStatus } : msg
        );
        messagesRef.current = {
          ...messagesRef.current,
          [liveRoomId]: failedRoomMessages,
        };
        setMessages((prev) => ({
          ...prev,
          [liveRoomId]: failedRoomMessages,
        }));
        const failedLastMessage = failedRoomMessages[failedRoomMessages.length - 1] || null;
        if (failedLastMessage) {
          applyIncomingMessageToRoomList(liveRoomId, failedLastMessage);
        }
      }
""",
    """        const rolledBackMessages = (messagesRef.current[liveRoomId] || []).filter((msg) => msg.id !== tempId);
        messagesRef.current = {
          ...messagesRef.current,
          [liveRoomId]: rolledBackMessages,
        };
        setMessages((prev) => ({
          ...prev,
          [liveRoomId]: rolledBackMessages,
        }));
        setRooms((prev) =>
          prev.map((room) =>
            toComparableId(room.id) === liveRoomId
              ? { ...room, lastMessage: rolledBackMessages[rolledBackMessages.length - 1] || null }
              : room,
          ),
        );
        throw error instanceof Error ? error : new Error('Failed to send message');
      }
""",
)

for checked in (server, context):
    text = Path(checked).read_text()
    if "\r\n" in text:
        raise SystemExit(f"{checked}: unexpected CRLF")

if "isAllowedAttachmentPath(roomId" in Path(server).read_text():
    raise SystemExit("custom chat server still validates client-supplied attachment paths")

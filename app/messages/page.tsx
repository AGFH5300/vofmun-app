// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import emojiDataset from "emoji-picker-react/dist/data/emojis-en.js";
import { ParticipantRoute } from "@/components/protectedroute";
import { ChatProvider, useChat } from "./context/ChatContext";
import MessageBubble from "./components/MessageBubble";
import TypingIndicator from "./components/TypingIndicator";
import UserAvatar from "./components/UserAvatar";
import ConversationList from "./components/ConversationList";
import NewConversationModal from "./components/NewConversationModal";
import ConversationDetailsModal from "./components/ConversationDetailsModal";
import { useModalFocusTrap, useModalLayerLock } from "./hooks/useModalLayerLock";
import {
  CheckCircle2,
  CalendarDays,
  Copy,
  ChevronDown,
  Circle,
  FileText,
  Folder,
  Image,
  Laugh,
  Loader2,
  MoreVertical,
  ChartNoAxesColumn,
  Plus,
  Search,
  Send,
  BellDot,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { MessageAttachmentInput, MessageWithUser, RoomWithDetails, UserSearchResult } from "@/lib/chat/types";
import supabase from "@/lib/supabase";
import { getUserDelegationLabel } from "@/lib/chat/delegation";
import { toast } from "sonner";

const formatDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 360;
const SIDEBAR_WIDTH_STORAGE_KEY = "vofmun.messages.sidebar.width";

const clampSidebarWidth = (value: number) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));

const formatLastSeenLabel = (lastSeen?: string | null) => {
  if (!lastSeen) return "Offline";
  const timestamp = new Date(lastSeen);
  if (Number.isNaN(timestamp.getTime())) return "Offline";

  const now = new Date();
  const sameDay = now.toDateString() === timestamp.toDateString();
  if (sameDay) {
    return `Last seen today at ${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === timestamp.toDateString()) {
    return `Last seen yesterday at ${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return `Last seen ${timestamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

type EmojiEntry = { n?: string[]; u?: string };
type EmojiDataset = { emojis: Record<string, EmojiEntry[]> };
type EmojiDatasetModule = EmojiDataset | { default: EmojiDataset };
type EmojiSuggestion = { shortcode: string; emoji: string; searchText: string };

type AttachmentOption = {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  color: string;
  action?: () => void;
};

type PendingAttachmentItem = {
  id: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  status: "uploading" | "uploaded" | "error";
  attachment?: MessageAttachmentInput;
  error?: string;
};

const EMOJI_SHORTCODES: EmojiSuggestion[] = (() => {
  const resolvedEmojiDataset = (emojiDataset as EmojiDatasetModule) as EmojiDatasetModule;
  const source =
    "emojis" in resolvedEmojiDataset
      ? resolvedEmojiDataset.emojis || {}
      : resolvedEmojiDataset.default?.emojis || {};
  const suggestions: EmojiSuggestion[] = [];
  const seenShortcodes = new Set<string>();

  const toEmoji = (unicodeCodepoints: string) => {
    const points = unicodeCodepoints
      .split("-")
      .map((part) => Number.parseInt(part, 16))
      .filter((point) => Number.isFinite(point));
    return points.length ? String.fromCodePoint(...points) : "";
  };

  Object.values(source).forEach((entries) => {
    entries.forEach((entry) => {
      if (!entry?.u) return;
      const emoji = toEmoji(entry.u);
      if (!emoji) return;

      const names = (entry.n || [])
        .filter((name): name is string => Boolean(name))
        .map((name) => name.toLowerCase());
      if (names.length === 0) return;

      const searchText = names.join(" ");
      const pushSuggestion = (shortcode: string) => {
        if (!/^[a-z0-9_+-]{1,32}$/i.test(shortcode)) return;
        if (seenShortcodes.has(shortcode)) return;
        seenShortcodes.add(shortcode);

        suggestions.push({ shortcode, emoji, searchText });
      };

      names.forEach((keyword) => {
        if (keyword.includes(" ")) return;
        pushSuggestion(keyword);
      });

      const longName = names[names.length - 1]?.replace(/\s+/g, "_");
      if (longName) {
        pushSuggestion(longName);
      }
    });
  });

  return suggestions;
})();

const ChatShell: React.FC = () => {
  const {
    rooms,
    activeRoom,
    messages,
    selectRoom,
    refreshRooms,
    refreshRoomMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    typingUsers,
    onlineUsers,
    isConnecting,
    initialChatReady,
    bootstrapProgress,
    friendRequests,
    incomingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    openDirectMessageRoomForUser,
    togglePin,
    currentUserId,
    resolveUserDisplay,
    totalUnreadCount,
  } = useChat();

  const [composer, setComposer] = useState("");
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [conversationTab, setConversationTab] = useState<"direct" | "group" | "friends" | "requests">("direct");
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const previousRequestsRef = useRef<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const emojiModalRef = useRef<HTMLDivElement | null>(null);
  const acceptedPromptRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const pendingRoomScrollRef = useRef<string | null>(null);
  const lastHandledMessageCountRef = useRef<Record<string, number>>({});
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentItem[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null);
  const [showAcceptedPrompt, setShowAcceptedPrompt] = useState<{ userId: string; name: string } | null>(null);
  const [isStartingAcceptedChat, setIsStartingAcceptedChat] = useState(false);
  const [isSendingHi, setIsSendingHi] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [warmEmojiPicker, setWarmEmojiPicker] = useState(false);
  const [activeEmojiIndex, setActiveEmojiIndex] = useState(0);
  const [isDraggingFilesOverChat, setIsDraggingFilesOverChat] = useState(false);
  const [hasInitialLoaderMinElapsed, setHasInitialLoaderMinElapsed] = useState(false);
  const [hideSidebarRequests, setHideSidebarRequests] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const previousShowInitialLoaderRef = useRef<boolean>(true);
  const preservedPageScrollYRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);
  const roomPollInFlightRef = useRef(false);
  const roomPollBackoffRef = useRef(30000);
  const roomsPollInFlightRef = useRef(false);
  const roomsPollBackoffRef = useRef(60000);
  const hasLoadedSidebarWidthRef = useRef(false);
  const hasSkippedInitialSidebarSaveRef = useRef(false);


  const toggleMessageSelection = (messageId: string) => {
    const targetMessage = activeMessagesById[messageId];
    if (!targetMessage || targetMessage.deleted_at) return;

    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedMessageIds(new Set());
  };

  const formatTranscriptTimestamp = (value?: string | null) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '00/00/0000, 00:00:00';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  };

  const getMessageTextForTranscript = (message: MessageWithUser) => {
    const content = (message.content || '').trim();
    if (content) return content;

    if (message.deleted_at) {
      return 'This message was deleted.';
    }

    if ((message.attachments || []).length > 0) {
      return '[Attachment]';
    }

    return '';
  };

  const copySelectedMessages = async () => {
    const selectedMessages = activeMessages
      .filter((message) => selectedMessageIds.has(String(message.id)) && !message.deleted_at)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    if (selectedMessages.length === 0) return;

    const lines = selectedMessages.map((message) => {
      const senderName =
        message.user?.full_name ||
        `${message.user?.first_name || ''} ${message.user?.last_name || ''}`.trim() ||
        'Participant';
      const content = getMessageTextForTranscript(message);
      return `[${formatTranscriptTimestamp(message.created_at)}] ${senderName}: ${content}`;
    });

    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Messages copied', {
      id: 'message-copied-toast',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    });
  };

  const focusComposerWithoutScroll = () => {
    const composerElement = composerRef.current;
    if (!composerElement) return;

    composerElement.focus({ preventScroll: true });
  };

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();

    return rooms.filter((room) => {
      const peer =
        room.room_type === "dm"
          ? room.members.find((member) => member.user_id !== currentUserId)?.user
          : null;

      const searchable = [
        room.name,
        peer?.full_name,
        peer?.first_name,
        peer?.last_name,
        peer?.role_title,
        peer?.role,
        peer?.committee,
        peer?.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [rooms, search, currentUserId]);

  const activeMessages = useMemo(
    () => (activeRoom ? messages[activeRoom.id] || [] : []),
    [activeRoom, messages],
  );
  const activeRoomMembers = useMemo(() => activeRoom?.members || [], [activeRoom?.members]);
  const activeMessagesById = useMemo(() => {
    const byId: Record<string, MessageWithUser> = {};
    activeMessages.forEach((item) => {
      byId[String(item.id)] = item;
    });
    return byId;
  }, [activeMessages]);
  const replyingToMessage = replyingToMessageId ? activeMessagesById[String(replyingToMessageId)] || null : null;


  const emojiQuery = useMemo(() => {
    const match = composer.match(/(?:^|\s):([a-z0-9_+-]{1,32})$/i);
    return match?.[1]?.toLowerCase() ?? "";
  }, [composer]);

  const emojiShortcodes = useMemo(() => EMOJI_SHORTCODES, []);

  const emojiSuggestions = useMemo(() => {
    if (!emojiQuery) return [];

    const seenEmojis = new Set<string>();
    return emojiShortcodes
      .filter(
        ({ shortcode, searchText }) =>
          shortcode.includes(emojiQuery) || searchText.includes(emojiQuery.replace(/_/g, " ")),
      )
      .filter(({ emoji }) => {
        if (seenEmojis.has(emoji)) {
          return false;
        }
        seenEmojis.add(emoji);
        return true;
      })
      .slice(0, 6);
  }, [emojiQuery, emojiShortcodes]);

  useEffect(() => {
    setActiveEmojiIndex(0);
  }, [emojiQuery]);

  useEffect(() => {
    setReplyingToMessageId(null);
    setIsSelectMode(false);
    setSelectedMessageIds(new Set());
  }, [activeRoom?.id]);

  useEffect(() => {
    const roomId = activeRoom?.id;
    return () => {
      if (roomId) {
        sendTyping(roomId, false);
      }
    };
  }, [activeRoom?.id, sendTyping]);

  useLayoutEffect(() => {
    if (!activeRoom || !messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const roomId = String(activeRoom.id);
    const previousCount = lastHandledMessageCountRef.current[roomId] ?? 0;

    if (pendingRoomScrollRef.current === roomId && activeMessages.length > 0) {
      container.scrollTop = container.scrollHeight;
      setShowScrollToBottom(false);
      pendingRoomScrollRef.current = null;
      lastHandledMessageCountRef.current[roomId] = activeMessages.length;
      return;
    }

    if (activeMessages.length > previousCount) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 160) {
        container.scrollTop = container.scrollHeight;
      }
    }

    lastHandledMessageCountRef.current[roomId] = activeMessages.length;
  }, [activeMessages.length, activeRoom]);

  useEffect(() => {
    if (!showAttachmentMenu && !showEmojiModal) return;

    const closeFloatingMenus = () => {
      setShowAttachmentMenu(false);
      setShowEmojiModal(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFloatingMenus();
      }
    };

    window.addEventListener("contextmenu", closeFloatingMenus);
    window.addEventListener("keydown", handleKeyDown);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedEmojiButton = emojiButtonRef.current?.contains(target);
      const clickedEmojiModal = emojiModalRef.current?.contains(target);
      const clickedAttachmentButton = attachmentButtonRef.current?.contains(target);
      const clickedAttachmentMenu = attachmentMenuRef.current?.contains(target);

      if (showEmojiModal && !clickedEmojiButton && !clickedEmojiModal) {
        setShowEmojiModal(false);
      }
      if (showAttachmentMenu && !clickedAttachmentButton && !clickedAttachmentMenu) {
        setShowAttachmentMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("contextmenu", closeFloatingMenus);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showAttachmentMenu, showEmojiModal]);


  useModalLayerLock(showNewConversation || showDetails || Boolean(showAcceptedPrompt));
  useModalFocusTrap(Boolean(showAcceptedPrompt), acceptedPromptRef, () => setShowAcceptedPrompt(null));

  useEffect(() => {
    const warmup = window.setTimeout(() => {
      setWarmEmojiPicker(true);
    }, 0);

    return () => {
      window.clearTimeout(warmup);
    };
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollToBottom(distanceFromBottom > 120);
    };

    onScroll();
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [activeRoom?.id, activeMessages.length]);

  const handleScrollToBottom = () => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!activeRoom?.id) return;

    let timeoutId: number | null = null;
    let cancelled = false;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timeoutId = window.setTimeout(runPoll, delay);
    };

    const runPoll = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden" || roomPollInFlightRef.current || isConnecting) {
        schedule(roomPollBackoffRef.current);
        return;
      }

      roomPollInFlightRef.current = true;
      try {
        await refreshRoomMessages(activeRoom.id);
        roomPollBackoffRef.current = 30000;
      } catch {
        roomPollBackoffRef.current = Math.min(roomPollBackoffRef.current * 2, 120000);
      } finally {
        roomPollInFlightRef.current = false;
        schedule(roomPollBackoffRef.current);
      }
    };

    schedule(roomPollBackoffRef.current);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeRoom?.id, isConnecting, refreshRoomMessages]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timeoutId = window.setTimeout(runPoll, delay);
    };

    const runPoll = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden" || roomsPollInFlightRef.current || isConnecting) {
        schedule(roomsPollBackoffRef.current);
        return;
      }

      roomsPollInFlightRef.current = true;
      try {
        await refreshRooms();
        roomsPollBackoffRef.current = 60000;
      } catch {
        roomsPollBackoffRef.current = Math.min(roomsPollBackoffRef.current * 2, 240000);
      } finally {
        roomsPollInFlightRef.current = false;
        schedule(roomsPollBackoffRef.current);
      }
    };

    schedule(roomsPollBackoffRef.current);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isConnecting, refreshRooms]);

  const maxAttachmentsPerMessage = Number.parseInt(process.env.NEXT_PUBLIC_CHAT_ATTACHMENT_MAX_FILES || "10", 10);
  const maxAttachmentSizeBytes = Number.parseInt(
    process.env.NEXT_PUBLIC_CHAT_ATTACHMENT_MAX_SIZE_BYTES || `${25 * 1024 * 1024}`,
    10,
  );

  const sanitizeFileName = (name: string) => {
    const normalized = name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return (normalized || "file").slice(0, 120);
  };

  const formatSize = (sizeBytes: number) => {
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return "0 B";
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const roomTypingNames = useMemo(() => {
    if (!activeRoom) return [] as string[];
    const activeTyping = Array.from(typingUsers[activeRoom.id] || []).filter(
      (userId) => String(userId) !== String(currentUserId || ""),
    );
    return activeTyping
      .map((userId) => {
        const member = activeRoomMembers.find((m) => String(m.user_id) === String(userId));
        return (
          member?.user?.full_name ||
          `${member?.user?.first_name || ""} ${member?.user?.last_name || ""}`.trim() ||
          member?.user?.username ||
          userId
        );
      })
      .filter(Boolean) as string[];
  }, [activeRoom, currentUserId, typingUsers]);

  const handleAttachmentSelect = async (selectedFiles: FileList | null) => {
    if (!activeRoom || !selectedFiles || selectedFiles.length === 0) return;
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
    setPendingAttachments((prev) => [...prev, ...queuedItems]);

    const uploadedPaths: { bucket: string; path: string }[] = [];

    try {

      await Promise.all(
        files.map(async (file, index) => {
          const pendingId = queuedItems[index].id;
          const sanitized = sanitizeFileName(file.name);
          const path = `${activeRoom.id}/${crypto.randomUUID()}/${sanitized}`;
          const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

          if (error) {
            console.error("Attachment upload failed", {
              fileName: file.name,
              path,
              error,
              message: error.message,
              name: error.name,
            });
            setPendingAttachments((prev) =>
              prev.map((item) =>
                item.id === pendingId ? { ...item, status: "error", error: error.message || "Upload failed" } : item,
              ),
            );
            return;
          }

          uploadedPaths.push({ bucket: "chat-attachments", path });

          const attachment = {
            room_id: activeRoom.id,
            bucket: "chat-attachments",
            path,
            original_name: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
          } as MessageAttachmentInput;

          setPendingAttachments((prev) =>
            prev.map((item) =>
              item.id === pendingId ? { ...item, status: "uploaded", attachment, error: undefined } : item,
            ),
          );
        }),
      );

      setShowAttachmentMenu(false);
    } catch (error) {
      console.error("Attachment upload catch", error);
      await Promise.allSettled(
        uploadedPaths.map(({ bucket, path }) => supabase.storage.from(bucket).remove([path])),
      );
      setAttachmentUploadError(error instanceof Error ? error.message : "Failed to upload attachments.");
    }
  };

  const hasDraggedFiles = (event: React.DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const handleChatDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (!activeRoom || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFilesOverChat(true);
  };

  const handleChatDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!activeRoom || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFilesOverChat(true);
  };

  const handleChatDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (!activeRoom || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFilesOverChat(false);
    }
  };

  const handleChatDrop = async (event: React.DragEvent<HTMLElement>) => {
    if (!activeRoom || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFilesOverChat(false);
    await handleAttachmentSelect(event.dataTransfer.files);
  };

  const handleSend = async () => {
    const uploadedAttachments = pendingAttachments
      .filter((item) => item.status === "uploaded" && item.attachment)
      .map((item) => item.attachment as MessageAttachmentInput);
    const trimmedComposer = composer.trim();

    if (!activeRoom || (trimmedComposer.length === 0 && uploadedAttachments.length === 0) || isUploadingAttachments) return;
    sendTyping(activeRoom.id, false);

    setComposer("");
    setPendingAttachments([]);
    setAttachmentUploadError(null);

    const sendOperations: Promise<void>[] = [];

    if (trimmedComposer.length > 0) {
      sendOperations.push(sendMessage(activeRoom.id, trimmedComposer, [], replyingToMessageId));
    }

    uploadedAttachments.forEach((attachment, index) => {
      sendOperations.push(sendMessage(activeRoom.id, "", [attachment], index === 0 && trimmedComposer.length === 0 ? replyingToMessageId : null));
    });

    if (sendOperations.length > 0) {
      await Promise.allSettled(sendOperations);
      setReplyingToMessageId(null);
    }
  };

  const removePendingAttachment = async (pendingId: string) => {
    let removedItem: PendingAttachmentItem | undefined;
    setPendingAttachments((prev) => {
      removedItem = prev.find((item) => item.id === pendingId);
      return prev.filter((item) => item.id !== pendingId);
    });

    if (removedItem?.attachment?.bucket && removedItem.attachment.path) {
      await supabase.storage.from(removedItem.attachment.bucket).remove([removedItem.attachment.path]);
    }
  };

  const toggleAttachmentMenu = () => {
    setShowAttachmentMenu((value) => {
      const next = !value;
      if (next) {
        setShowEmojiModal(false);
      }
      return next;
    });
  };

  const openEmojiModal = () => {
    setShowAttachmentMenu(false);
    setShowEmojiModal(true);
  };

  const handleSelectRoom = async (room: RoomWithDetails) => {
    setShowAttachmentMenu(false);
    setShowEmojiModal(false);

    pendingRoomScrollRef.current = String(room.id);
    await selectRoom(room);

    window.requestAnimationFrame(() => {
      focusComposerWithoutScroll();
    });
  };

  const timeline = useMemo(() => {
    const sequence: Array<
      { type: "date"; label: string } | { type: "message"; id: string }
    > = [];
    let lastDate: string | null = null;
    activeMessages.forEach((msg) => {
      const dateLabel = msg.created_at ? formatDateLabel(msg.created_at) : "";
      if (dateLabel && dateLabel !== lastDate) {
        sequence.push({ type: "date", label: dateLabel });
        lastDate = dateLabel;
      }
      sequence.push({ type: "message", id: msg.id });
    });
    return sequence;
  }, [activeMessages]);

  const selectedMessagesCount = selectedMessageIds.size;

  const activeTypingDisplay = roomTypingNames.length ? (
    <TypingIndicator names={roomTypingNames} />
  ) : null;
  const hasUploadedPendingAttachments = pendingAttachments.some((item) => item.status === "uploaded");
  const canSendMessage = !isSelectMode && (composer.trim().length > 0 || hasUploadedPendingAttachments) && !isUploadingAttachments;

  useEffect(() => {
    setIsUploadingAttachments(pendingAttachments.some((item) => item.status === "uploading"));
  }, [pendingAttachments]);

  const applyEmojiSuggestion = (emoji: string) => {
    setComposer((value) =>
      value.replace(/(?:^|\s):[a-z0-9_+-]{1,32}$/i, (match) =>
        match.startsWith(" ") ? ` ${emoji}` : emoji,
      ),
    );
    window.requestAnimationFrame(() => {
      focusComposerWithoutScroll();
    });
  };
  const attachmentOptions: AttachmentOption[] = [
    { label: "File", icon: Folder, color: "text-[#1794d4]", action: () => fileInputRef.current?.click() },
    { label: "Photos & videos", icon: Image, color: "text-[#2a77f1]", action: () => mediaInputRef.current?.click() },
    { label: "Contact", icon: UsersRound, color: "text-[#ed6b2f]" },
    { label: "Poll", icon: ChartNoAxesColumn, color: "text-[#f4b53d]" },
    { label: "Event", icon: CalendarDays, color: "text-[#f05068]" },
  ];

  const activeDmPeer = useMemo(() => {
    if (!activeRoom || activeRoom.room_type !== "dm") return null;
    const normalizedCurrentUserId = String(currentUserId || "");
    const me = activeRoomMembers.find(
      (member) =>
        String(member.user_id) === normalizedCurrentUserId ||
        String(member.user?.id || "") === normalizedCurrentUserId,
    );
    return (
      activeRoomMembers.find((member) => String(member.user_id) !== String(me?.user_id || "")) ||
      activeRoomMembers.find((member) => String(member.user_id) !== normalizedCurrentUserId) ||
      activeRoomMembers[0] ||
      null
    );
  }, [activeRoom, activeRoomMembers, currentUserId]);

  const allOtherMemberIds = useMemo(() => {
    if (!activeRoom || !currentUserId) return [] as string[];
    return activeRoomMembers
      .map((member) => String(member.user_id))
      .filter((memberId) => memberId && memberId !== String(currentUserId));
  }, [activeRoomMembers, currentUserId]);

  const activeRoomTitle = activeRoom
    ? activeRoom.room_type === "dm"
      ? activeDmPeer?.user?.full_name ||
        `${activeDmPeer?.user?.first_name || ""} ${activeDmPeer?.user?.last_name || ""}`.trim() ||
        activeRoom.name
      : activeRoom.name
    : "VOFMUN ONE";

  const isActivePeerOnline = Boolean(
    activeRoom?.room_type === "dm" && activeDmPeer?.user_id && onlineUsers.has(String(activeDmPeer.user_id)),
  );
  const areAllOtherMembersOnline =
    allOtherMemberIds.length > 0 &&
    allOtherMemberIds.every((memberId) => onlineUsers.has(String(memberId)));
  const presenceDeliveredHint =
    activeRoom?.room_type === "dm" ? isActivePeerOnline : areAllOtherMembersOnline;
  const activePeerDelegation = getUserDelegationLabel(activeDmPeer?.user);

  const headerSubtitle = activeRoom
    ? roomTypingNames.length
      ? roomTypingNames.length === 1
        ? `${roomTypingNames[0]} is typing...`
        : `${roomTypingNames.join(", ")} are typing...`
      : activeRoom.room_type === "dm"
        ? isActivePeerOnline
          ? "Online"
          : formatLastSeenLabel(activeDmPeer?.user?.last_seen)
        : `${activeRoomMembers.length} participants`
    : "";

  useEffect(() => {
    if (!isDraggingDivider) return;

    let frame: number | null = null;
    const onMove = (event: MouseEvent) => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        const next = clampSidebarWidth(event.clientX - 24);
        setSidebarWidth(next);
      });
    };

    const onUp = () => setIsDraggingDivider(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingDivider]);

  useEffect(() => {
    if (!currentUserId) {
      previousRequestsRef.current = {};
      return;
    }

    const previous = previousRequestsRef.current;
    const next: Record<string, string> = {};

    friendRequests.forEach((request) => {
      if (String(request.sender_id) !== String(currentUserId)) return;
      next[request.id] = request.status;

      const priorStatus = previous[request.id];
      if (priorStatus === "pending" && (request.status === "accepted" || request.status === "rejected")) {
        const name = resolveUserDisplay(request.receiver_id, request.receiver);
        const message =
          request.status === "accepted"
            ? `${name} accepted your connection request.`
            : `${name} declined your connection request.`;
        toast.success(message, {
          duration: Infinity,
          action: {
            label: "Dismiss",
            onClick: () => {
              /* no-op: sonner dismisses on action click */
            },
          },
        });
      }
    });

    previousRequestsRef.current = next;
  }, [currentUserId, friendRequests, resolveUserDisplay]);

  const outgoingRequests = useMemo(
    () =>
      friendRequests.filter(
        (req) => req.sender_id === currentUserId && req.status === "pending",
      ),
    [currentUserId, friendRequests],
  );

  const incomingPendingCount = incomingRequests.length;
  const incomingPendingBadgeLabel = incomingPendingCount > 9 ? "9+" : String(incomingPendingCount);

  useEffect(() => {
    const minimumLoaderDurationMs = 750;
    const timeout = window.setTimeout(() => {
      setHasInitialLoaderMinElapsed(true);
    }, minimumLoaderDurationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedWidth = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);

    const parsed = Number(storedWidth);
    if (Number.isFinite(parsed)) {
      const clamped = clampSidebarWidth(parsed);
      setSidebarWidth(clamped);
    }

    hasLoadedSidebarWidthRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedSidebarWidthRef.current) return;

    if (!hasSkippedInitialSidebarSaveRef.current) {
      hasSkippedInitialSidebarSaveRef.current = true;
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const showInitialLoader = !initialChatReady || !hasInitialLoaderMinElapsed;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const wasShowingInitialLoader = previousShowInitialLoaderRef.current;
    if (wasShowingInitialLoader && !showInitialLoader) {
      const restoreY = preservedPageScrollYRef.current;
      if (restoreY != null) {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: restoreY, behavior: "auto" });
        });
      }
      preservedPageScrollYRef.current = null;
    }

    previousShowInitialLoaderRef.current = showInitialLoader;
  }, [showInitialLoader]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showInitialLoader) {
      preservedPageScrollYRef.current = window.scrollY;
    }
  }, [showInitialLoader]);

  useEffect(() => {
    setSelectedMessageIds((prev) => {
      if (!isSelectMode || prev.size === 0) return prev;

      const validIds = new Set(
        activeMessages
          .filter((message) => !message.deleted_at)
          .map((message) => String(message.id)),
      );

      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [activeMessages, isSelectMode]);

  if (showInitialLoader) {
    const progressPercent = Math.min(100, Math.max(0, bootstrapProgress.percent));

    return (
      <div className="page-shell h-[100dvh] overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col px-5 py-4">
          <section className="surface-card flex min-h-0 flex-1 items-center justify-center px-6">
            <div className="w-full max-w-xl">
              <p className="text-center text-sm font-semibold text-deep-red">Loading VOFMUN ONE chats…</p>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full border border-deep-red/20 bg-[#f4ebe5]">
                <div
                  className="h-full rounded-full bg-[#7b1f1f] shadow-sm transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-label="Chat bootstrap progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-almost-black-green/70">
                <span>{bootstrapProgress.label}</span>
                <span className="font-semibold text-deep-red">{progressPercent}%</span>
              </div>
              {bootstrapProgress.totalRooms > 0 ? (
                <p className="mt-1 text-xs text-almost-black-green/60">
                  Room preload: {bootstrapProgress.preloadedRooms}/{bootstrapProgress.totalRooms}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell h-[100dvh] overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[1120px] min-h-0 flex-col px-5 py-4">
        <section className="surface-card flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <aside className="flex min-h-0 h-full flex-col overflow-hidden border-r border-soft-ivory" style={{ width: `${sidebarWidth}px` }}>
            <div className="flex items-center justify-between gap-2 px-5 pt-4">
              <p className="text-xl font-bold text-almost-black-green/60">
                Chats
                {totalUnreadCount > 0 ? (
                  <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-deep-red px-2 py-0.5 text-xs font-semibold text-white">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                ) : <span className="ml-2 inline-block h-4 w-4" aria-hidden="true" />}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setConversationTab("direct");
                    setShowNewConversation(true);
                  }}
                  className="rounded-lg border border-soft-ivory p-2 text-almost-black-green/60 hover:text-deep-red"
                  aria-label="New direct chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConversationTab("friends");
                    setShowNewConversation(true);
                  }}
                  className="rounded-lg border border-soft-ivory p-2 text-almost-black-green/60 hover:text-deep-red"
                  aria-label="Open friends and connections"
                >
                  <Users className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConversationTab("requests");
                    setShowNewConversation(true);
                  }}
                  className="relative rounded-lg border border-soft-ivory p-2 text-almost-black-green/60 hover:text-deep-red"
                  aria-label={`Open connection requests${incomingPendingCount > 0 ? `. ${incomingPendingCount} pending incoming` : ""}`}
                >
                  <BellDot className="h-4 w-4" />
                  {incomingPendingCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c62828] px-1 text-[10px] font-semibold leading-none text-white">
                      {incomingPendingBadgeLabel}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="border-b border-soft-ivory px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-almost-black-green/50" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full border-0 bg-transparent py-2.5 pl-12 pr-3 text-sm focus:outline-none focus:ring-0"
                  style={{ paddingLeft:"30px" }}
                  placeholder="Search conversations"
                />
              </div>
            </div>

            {incomingRequests.length > 0 && !hideSidebarRequests && (
              <div className="m-3 space-y-3 rounded-2xl border border-soft-ivory bg-warm-light-grey/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.22em] text-almost-black-green/60">
                    Connection requests
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-deep-red/10 px-2 py-1 text-[0.7rem] font-semibold text-deep-red">
                      {incomingRequests.length}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-almost-black-green/55 hover:bg-black/5 hover:text-deep-red"
                      aria-label="Dismiss sidebar connection requests"
                      onClick={() => setHideSidebarRequests(true)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {incomingRequests.map((req) => {
                    const sender = req.sender;
                    const displayName =
                      sender?.full_name ||
                      `${sender?.first_name || ""} ${sender?.last_name || ""}`.trim() ||
                      req.sender_id;
                    const roleLine = `${sender?.role_title || sender?.role || "Participant"}${sender?.committee ? ` • ${sender.committee}` : ""}${sender?.country ? ` • ${sender.country}` : ""}`;
                    const avatarUser =
                      sender ||
                      ({
                        id: req.sender_id,
                        full_name: displayName,
                        email: sender?.email || "",
                      } as UserSearchResult);

                    const handleAccept = async () => {
                      setRespondingId(req.id);
                      try {
                        await acceptFriendRequest(req.id);
                        setShowAcceptedPrompt({
                          userId: String(req.sender_id),
                          name: resolveUserDisplay(req.sender_id, req.sender),
                        });
                      } finally {
                        setRespondingId(null);
                      }
                    };

                    const handleDecline = async () => {
                      setRespondingId(req.id);
                      try {
                        await declineFriendRequest(req.id);
                      } finally {
                        setRespondingId(null);
                      }
                    };

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-soft-ivory bg-white p-3"
                      >
                        <div className="flex items-start gap-3">
                          <UserAvatar user={avatarUser} size={40} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-deep-red">
                              {displayName}
                            </p>
                            <p className="text-xs text-almost-black-green/60">
                              {roleLine}
                            </p>
                            {sender?.email && (
                              <p className="truncate text-xs text-almost-black-green/50">
                                {sender.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={handleDecline}
                            disabled={respondingId === req.id}
                            className="flex-1 rounded-xl border border-soft-ivory px-3 py-2 text-deep-red hover:bg-soft-ivory disabled:opacity-60"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={handleAccept}
                            disabled={respondingId === req.id}
                            className="flex-1 rounded-xl bg-[#701e1e] px-3 py-2 text-white shadow-sm hover:bg-[#8b2424] disabled:opacity-60"
                          >
                            {respondingId === req.id ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                            Accept
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <ConversationList
                rooms={filteredRooms}
                activeRoomId={activeRoom?.id}
                onSelect={handleSelectRoom}
                onTogglePin={togglePin}
                currentUserId={currentUserId}
                onlineUsers={onlineUsers}
                onNewChat={() => {
                  setConversationTab("direct");
                  setShowNewConversation(true);
                }}
                onNewGroup={() => {
                  setConversationTab("group");
                  setShowNewConversation(true);
                }}
              />
            </div>
          </aside>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat sidebar"
            tabIndex={0}
            onMouseDown={(event) => {
              event.preventDefault();
              setIsDraggingDivider(true);
            }}
            onDoubleClick={() => {
              setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setSidebarWidth((prev) => clampSidebarWidth(prev - 16));
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                setSidebarWidth((prev) => clampSidebarWidth(prev + 16));
              }
            }}
            className="group relative hidden w-0 flex-none outline-none lg:block"
          >
            <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 cursor-col-resize bg-transparent">
              <span
                className={`absolute inset-y-0 left-0 w-full rounded-full transition ${
                  isDraggingDivider ? "bg-deep-red/55" : "bg-soft-ivory group-hover:bg-deep-red/35"
                }`}
              />
            </div>
          </div>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="border-b border-soft-ivory px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="!mb-1 text-2xl font-semibold text-deep-red">
                    {activeRoomTitle}
                  </h3>
                  <div className="min-h-[2.5rem] space-y-1">
                    {activeRoom?.room_type === "dm" && activePeerDelegation && (
                      <p className="text-xs font-medium text-almost-black-green/65">
                        {activePeerDelegation}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {activeRoom?.room_type === "dm" && (
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isActivePeerOnline ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <p
                        className={`text-sm ${
                          roomTypingNames.length || isActivePeerOnline
                            ? "font-medium text-emerald-600"
                            : "text-almost-black-green/70"
                        }`}
                      >
                        {activeRoom ? headerSubtitle : "Choose a conversation to start chatting."}
                      </p>
                    </div>
                  </div>
                </div>
                {activeRoom ? (
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {activeRoomMembers.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-full border border-white bg-white"
                        >
                          <UserAvatar user={member.user} size={34} />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDetails(true)}
                      className="rounded-xl border border-soft-ivory p-2 text-almost-black-green/60 hover:text-deep-red"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            </header>

            {!activeRoom && (incomingRequests.length > 0 || outgoingRequests.length > 0) && (
              <div className="border-b border-soft-ivory bg-warm-light-grey/35 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-almost-black-green/60">
                    Friend requests
                  </p>
                  <span className="rounded-full bg-deep-red/10 px-2 py-1 text-[0.7rem] font-semibold text-deep-red">
                    {incomingRequests.length} incoming • {outgoingRequests.length} sent
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {incomingRequests.slice(0, 2).map((req) => {
                    const senderName = resolveUserDisplay(req.sender_id, req.sender);

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-soft-ivory bg-white px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-deep-red">{senderName}</p>
                        <p className="text-xs text-almost-black-green/65">
                          Sent you a connection request.
                        </p>
                      </div>
                    );
                  })}
                  {outgoingRequests.slice(0, 2).map((req) => {
                    const recipientName = resolveUserDisplay(req.receiver_id, req.receiver);

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-soft-ivory bg-white px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-deep-red">{recipientName}</p>
                        <p className="text-xs text-almost-black-green/65">
                          Awaiting response to your connection request.
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className="relative flex min-h-0 flex-1 flex-col bg-gradient-to-b from-white via-warm-light-grey/40 to-white"
              onDragEnter={handleChatDragEnter}
              onDragOver={handleChatDragOver}
              onDragLeave={handleChatDragLeave}
              onDrop={(event) => {
                void handleChatDrop(event);
              }}
            >
              {activeRoom && isDraggingFilesOverChat && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#0b141acc] backdrop-blur-[1.5px]">
                  <div className="rounded-2xl border border-white/35 bg-white/12 px-6 py-4 text-center text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                    <p className="text-lg font-semibold">Drop files to attach</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/80">
                      Files will be added to your next message
                    </p>
                  </div>
                </div>
              )}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-6 py-5"
              >
                {activeRoom ? (
                  activeMessages.length > 0 ? (
                    timeline.map((item) => {
                      if (item.type === "date") {
                      return (
                          <div
                            key={`date-${item.label}`}
                            className="my-4 flex justify-center"
                          >
                            <span className="rounded-full border border-soft-ivory bg-white px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-almost-black-green/60 shadow-sm">
                              {item.label}
                            </span>
                          </div>
                        );
                      }
                      const message = activeMessages.find(
                        (msg) => msg.id === item.id,
                      );
                      if (!message) return null;
                      const isOwn =
                        currentUserId != null &&
                        String(currentUserId) === String(message.user_id);
                      const currentIndex = activeMessages.findIndex((msg) => msg.id === message.id);
                      const nextMessage = currentIndex >= 0 ? activeMessages[currentIndex + 1] : undefined;
                      const isSameSenderAsNext =
                        Boolean(nextMessage) && String(nextMessage?.user_id) === String(message.user_id);
                      const isSameDayAsNext =
                        Boolean(nextMessage?.created_at && message.created_at) &&
                        new Date(String(nextMessage?.created_at)).toDateString() ===
                          new Date(String(message.created_at)).toDateString();
                      const previousMessage = currentIndex > 0 ? activeMessages[currentIndex - 1] : undefined;
                      const isSameSenderAsPrevious =
                        Boolean(previousMessage) && String(previousMessage?.user_id) === String(message.user_id);
                      const isSameDayAsPrevious =
                        Boolean(previousMessage?.created_at && message.created_at) &&
                        new Date(String(previousMessage?.created_at)).toDateString() ===
                          new Date(String(message.created_at)).toDateString();
                      const shouldShowGroupAvatar =
                        activeRoom.room_type !== "dm" &&
                        !isOwn &&
                        !(isSameSenderAsNext && isSameDayAsNext);
                      const shouldShowAuthor =
                        activeRoom.room_type !== "dm" &&
                        (!isSameSenderAsPrevious || !isSameDayAsPrevious);
                      const bubbleSpacing = isSameSenderAsNext && isSameDayAsNext ? "mb-1" : "mb-2";

                      return (
                        <div key={item.id} data-message-id={item.id} className={bubbleSpacing}>
                          <MessageBubble
                            message={message}
                            isOwn={isOwn}
                            roomMemberIds={activeRoomMembers.map((member) => String(member.user_id))}
                            roomMembers={activeRoomMembers}
                            showAuthor={shouldShowAuthor}
                            showAvatar={shouldShowGroupAvatar}
                            presenceDeliveredHint={presenceDeliveredHint}
                            onEditMessage={(messageId, content) => editMessage(activeRoom.id, messageId, content)}
                            onDeleteMessage={(messageId) => deleteMessage(activeRoom.id, messageId)}
                            onReplyMessage={(targetMessage) => {
                              setReplyingToMessageId(String(targetMessage.id));
                              window.requestAnimationFrame(() => {
                                focusComposerWithoutScroll();
                              });
                            }}
                            repliedToMessage={message.reply_to ? activeMessagesById[String(message.reply_to)] || null : null}
                            isGroupRoom={activeRoom.room_type !== "dm"}
                            isSelectMode={isSelectMode}
                            isSelected={selectedMessageIds.has(String(message.id))}
                            onToggleSelectMessage={toggleMessageSelection}
                            onEnterSelectMode={(targetMessage) => {
                              setIsSelectMode(true);
                              setSelectedMessageIds(new Set([String(targetMessage.id)]));
                            }}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-almost-black-green/60">
                      <div className="space-y-2 rounded-2xl border border-dashed border-soft-ivory bg-white/80 px-6 py-5">
                        <Users className="mx-auto text-deep-red/40" size={44} />
                        <p className="font-semibold text-deep-red">No messages yet</p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!activeRoom) return;
                            setIsSendingHi(true);
                            try {
                              await sendMessage(activeRoom.id, "hi 👋", []);
                            } finally {
                              setIsSendingHi(false);
                            }
                          }}
                          disabled={isSendingHi || isUploadingAttachments}
                          className="rounded-xl border border-soft-ivory px-4 py-2 text-sm font-semibold text-deep-red hover:bg-soft-ivory disabled:opacity-60"
                        >
                          {isSendingHi ? "Sending..." : "Say hi 👋"}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#efeae2] px-6 text-center text-almost-black-green">
                    <div className="w-full max-w-xl space-y-5 rounded-3xl border border-[#d8d3cb] bg-white/85 px-8 py-10 shadow-[0_8px_30px_rgba(17,27,33,0.08)] backdrop-blur-sm">
                      <img
                        src="/logo.svg"
                        alt="VOFMUN"
                        className="mx-auto h-20 w-20 object-contain opacity-85"
                      />
                      <p className="text-5xl font-medium text-almost-black-green/85">VOFMUN ONE</p>
                      <p className="text-sm text-almost-black-green/60">
                        Private conversations with your committee, delegations, and friends.
                      </p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {activeRoom && showScrollToBottom && (
                <button
                  type="button"
                  onClick={handleScrollToBottom}
                  className="absolute bottom-24 right-6 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-soft-ivory bg-white text-deep-red shadow-md transition hover:bg-soft-ivory"
                  aria-label="Scroll to latest message"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              )}
              {!isSelectMode && (
                <div className="sticky bottom-0 bg-white px-2 py-3">
                {activeRoom ? activeTypingDisplay : <div className="mb-2 h-5" aria-hidden="true" />}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    void handleAttachmentSelect(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <input
                  ref={mediaInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,video/*"
                  onChange={(event) => {
                    void handleAttachmentSelect(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                {activeRoom && (isUploadingAttachments || pendingAttachments.length > 0 || attachmentUploadError) && (
                  <div className="mb-2 rounded-2xl border border-[#d7d7d7] bg-[#f7f7f7] px-3 py-2 text-xs text-[#4b4f53]">
                      {pendingAttachments.length > 0 ? (
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                          {pendingAttachments.map((attachment) => (
                            <div key={attachment.id} className="min-w-[220px] max-w-[220px] shrink-0 rounded-xl border border-black/10 bg-white p-2.5">
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#efe3dc] text-deep-red">
                                <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-almost-black-green">{attachment.original_name}</p>
                                  <p className="text-[11px] text-almost-black-green/60">
                                    {formatSize(attachment.size_bytes)} • {attachment.mime_type.split("/")[1] || attachment.mime_type}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void removePendingAttachment(attachment.id)}
                                  disabled={attachment.status === "uploading"}
                                  className="rounded-md p-1 text-almost-black-green/50 transition hover:bg-black/5 hover:text-almost-black-green disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Remove ${attachment.original_name}`}
                                >
                                  <span className="text-sm leading-none">×</span>
                                </button>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium">
                                {attachment.status === "uploading" ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-almost-black-green/60" />
                                    <span className="text-almost-black-green/70">Uploading…</span>
                                  </>
                                ) : attachment.status === "uploaded" ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-emerald-700">Uploaded</span>
                                  </>
                                ) : (
                                  <>
                                    <Circle className="h-3.5 w-3.5 text-deep-red" />
                                    <span className="text-deep-red">Upload failed</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {attachmentUploadError ? <p className="mt-1 text-deep-red">{attachmentUploadError}</p> : null}
                    </div>
                  )}
                {activeRoom ? (
                  <div className="space-y-2">
                    {replyingToMessage ? (
                      <div className="flex items-start justify-between gap-3 rounded-xl border border-[#d7d7d7] bg-[#f7f7f7] px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-deep-red">Replying to {replyingToMessage.user?.full_name || "Participant"}</p>
                          <p className="line-clamp-1 text-xs text-almost-black-green/75">
                            {replyingToMessage.deleted_at ? "This message was deleted." : replyingToMessage.content || "(no text)"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded p-1 text-almost-black-green/60 hover:bg-black/5"
                          onClick={() => setReplyingToMessageId(null)}
                          aria-label="Cancel reply"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  <div className="relative flex items-end gap-3">
                    {emojiSuggestions.length > 0 && (
                      <div className="absolute -top-20 left-4 z-30 max-w-[calc(100%-2rem)] rounded-2xl border border-[#d7d7d7] bg-white p-1.5 shadow-[0_14px_30px_rgba(17,27,33,0.2)]">
                        <div className="flex items-center gap-1 overflow-x-auto">
                          {emojiSuggestions.map((item, index) => (
                            <button
                              key={item.emoji}
                              type="button"
                              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl leading-none text-[#202c33] transition hover:bg-[#f4f4f4] ${
                                activeEmojiIndex === index ? "bg-[#f4f4f4]" : ""
                              }`}
                              onClick={() => applyEmojiSuggestion(item.emoji)}
                            >
                              <span className="leading-none">{item.emoji}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="relative flex flex-1 items-end rounded-full border border-[#d7d7d7] bg-[#f5f5f5] pl-1 pr-2 transition">
                      {showAttachmentMenu && (
                        <div
                          ref={attachmentMenuRef}
                          className="absolute bottom-14 left-0 z-20 w-56 rounded-2xl border border-[#d7d8d9] bg-[#f2f2f4] p-1.5 shadow-[0_18px_40px_rgba(17,27,33,0.22)]"
                        >
                          {attachmentOptions.map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false);
                                option.action?.();
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[#222] transition hover:bg-white/80"
                            >
                              <option.icon className={`h-5 w-5 ${option.color}`} strokeWidth={2.1} />
                              <span className="text-sm leading-none">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        ref={attachmentButtonRef}
                        type="button"
                        onClick={toggleAttachmentMenu}
                        disabled={isUploadingAttachments}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#6b6b6b] transition hover:bg-[#ececec] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                        aria-label="Open attachment options"
                      >
                        <Plus className="h-7 w-7" strokeWidth={1.8} />
                      </button>
                      <textarea
                        ref={composerRef}
                        value={composer}
                        disabled={isSelectMode}
                        onChange={(event) => {
                          setComposer(event.target.value);
                          sendTyping(activeRoom.id, true);
                        }}
                        onFocus={() => sendTyping(activeRoom.id, true)}
                        onBlur={() => sendTyping(activeRoom.id, false)}
                        onKeyDown={(event) => {
                          if (emojiSuggestions.length > 0 && event.key === "ArrowLeft") {
                            event.preventDefault();
                            setActiveEmojiIndex((prev) =>
                              prev === 0 ? emojiSuggestions.length - 1 : prev - 1,
                            );
                            return;
                          }

                          if (emojiSuggestions.length > 0 && event.key === "ArrowRight") {
                            event.preventDefault();
                            setActiveEmojiIndex((prev) =>
                              prev === emojiSuggestions.length - 1 ? 0 : prev + 1,
                            );
                            return;
                          }

                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (emojiSuggestions.length > 0) {
                              const activeEmoji =
                                emojiSuggestions[
                                  Math.min(activeEmojiIndex, emojiSuggestions.length - 1)
                                ]?.emoji;
                              if (activeEmoji) {
                                applyEmojiSuggestion(activeEmoji);
                              }
                              return;
                            }
                            handleSend();
                          }
                        }}
                        placeholder={isSelectMode ? "Selection mode active" : "Type your message"}
                        rows={1}
                        style={{ border: "none", boxShadow: "none" }}
                        className="max-h-32 min-h-[48px] flex-1 resize-none bg-transparent py-3 text-sm text-[#202c33] placeholder:text-[#7a7f84] no-focus"
                      />
                      <button
                        ref={emojiButtonRef}
                        type="button"
                        onClick={openEmojiModal}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#6b6b6b] transition hover:bg-[#ececec]"
                        aria-label="Open emoji picker"
                      >
                        <Laugh className="h-5 w-5" strokeWidth={1.8} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSendMessage}
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition ${
                        canSendMessage
                          ? "bg-text-deep-red text-white hover:bg-deep-red/90 background-deep-red"
                          : "cursor-not-allowed bg-[#d7d7d7] text-[#8f8f8f]"
                      }`}
                      aria-label="Send message"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                  </div>
                ) : (
                  <div className="relative flex items-end gap-3">
                    <div className="relative flex flex-1 items-end rounded-full border border-[#d7d7d7] bg-[#f5f5f5] pl-1 pr-2 transition">
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#b0b0b0]"
                        aria-hidden="true"
                      >
                        <Plus className="h-7 w-7" strokeWidth={1.8} />
                      </button>
                      <textarea
                        value=""
                        readOnly
                        disabled
                        placeholder="Select a conversation to start messaging"
                        rows={1}
                        style={{ border: "none", boxShadow: "none" }}
                        className="max-h-32 min-h-[48px] flex-1 resize-none bg-transparent py-3 text-sm text-[#202c33] placeholder:text-[#7a7f84] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#b0b0b0]"
                        aria-hidden="true"
                      >
                        <Laugh className="h-5 w-5" strokeWidth={1.8} />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full bg-[#d7d7d7] text-[#8f8f8f]"
                      aria-hidden="true"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                )}
                </div>
              )}

              {isSelectMode && (
                <div className="border-t border-soft-ivory bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-almost-black-green">{selectedMessagesCount} selected</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={selectedMessagesCount === 0}
                        onClick={() => {
                          void copySelectedMessages();
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-soft-ivory px-3 py-2 text-xs font-semibold text-deep-red disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </button>
                      <button
                        type="button"
                        onClick={exitSelectMode}
                        className="rounded-xl border border-soft-ivory px-3 py-2 text-xs font-semibold text-almost-black-green/75"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {warmEmojiPicker && (
                  <div className="pointer-events-none absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden opacity-0" aria-hidden>
                    <EmojiPicker
                      theme="light"
                      width={1}
                      height={1}
                      lazyLoadEmojis={false}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                    />
                  </div>
                )}
                {showEmojiModal && (
                  <div
                    ref={emojiModalRef}
                    className="absolute bottom-20 right-6 z-30 w-[min(330px,calc(100%-2rem))] overflow-hidden rounded-2xl border border-[#d7d7d7] bg-white shadow-[0_18px_45px_rgba(17,27,33,0.24)]"
                    style={{
                      ["--epr-emoji-size" as string]: "20px",
                      ["--epr-search-input-padding" as string]: "0 28px",
                      ["--epr-font-size" as string]: "13px",
                    }}
                  >
                    <EmojiPicker
                      theme="light"
                      width="100%"
                      height={320}
                      lazyLoadEmojis={false}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                      searchDisabled={false}
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        setComposer((value) => `${value}${emojiData.emoji}`);
                      }}
                    />
                  </div>
                )}
            </div>
          </section>
        </section>

        <NewConversationModal
          open={showNewConversation}
          initialTab={conversationTab}
          onClose={() => {
            setShowNewConversation(false);
          }}
        />
        {showAcceptedPrompt && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
            <div ref={acceptedPromptRef} tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <p className="text-lg font-semibold text-deep-red">You’re now connected.</p>
              <p className="mt-1 text-sm text-almost-black-green/70">Start a chat with your new friend?</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-soft-ivory px-3 py-2 text-sm font-semibold text-deep-red disabled:opacity-60"
                  disabled={isStartingAcceptedChat}
                  onClick={() => setShowAcceptedPrompt(null)}
                >
                  Maybe later
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl background-deep-red px-3 py-2 text-xs font-semibold text-white hover:bg-deep-red/90 disabled:cursor-wait disabled:opacity-70"
                  disabled={isStartingAcceptedChat}
                  onClick={async () => {
                    if (!showAcceptedPrompt) return;
                    setIsStartingAcceptedChat(true);
                    try {
                      const room = await openDirectMessageRoomForUser(showAcceptedPrompt.userId);
                      if (room) {
                        await selectRoom(room);
                      }
                      setShowAcceptedPrompt(null);
                    } finally {
                      setIsStartingAcceptedChat(false);
                    }
                  }}
                >
                  {isStartingAcceptedChat ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Start chat"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConversationDetailsModal
          room={activeRoom}
          open={showDetails}
          onClose={() => setShowDetails(false)}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
};

const MessagesPage = () => (
  <ParticipantRoute>
    <ChatProvider>
      <ChatShell />
    </ChatProvider>
  </ParticipantRoute>
);

export default MessagesPage;

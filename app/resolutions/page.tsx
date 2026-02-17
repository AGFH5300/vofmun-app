'use client';

import React, { useEffect, useState, useCallback } from "react";
import { Reso, Delegate, Chair, shortenedDel } from "@/db/types";
import { useSession } from "../context/sessionContext";
import { Editor } from "@tiptap/react";
import { SimpleEditor } from "../../components/tiptap-templates/simple/simple-editor";
import { ParticipantRoute } from "@/components/protectedroute";
import { toast } from "sonner";
import role from "@/lib/roles";
import supabase from "@/lib/supabase";
import { AlertTriangle, ArrowRight, Expand, Loader2, Minimize2, Plus, Trash2 } from "lucide-react";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };
const serializeDocument = (content?: object | null) =>
  JSON.stringify(content ?? EMPTY_DOCUMENT);
const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes. Do you want to leave without saving?";
const EXTERNAL_DOC_LABEL = "External document link:";

type TiptapContentNode = {
  text?: string;
  marks?: { type?: string; attrs?: { href?: string } }[];
  content?: TiptapContentNode[];
};

const isNonEmptyHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const readExternalDocLink = (content?: object | null) => {
  const doc = content as { content?: TiptapContentNode[] } | undefined;
  const firstNode = doc?.content?.[0];
  const labelText = firstNode?.content?.[0]?.text;
  const linkNode = firstNode?.content?.[1];
  const href = linkNode?.marks?.find((mark) => mark.type === "link")?.attrs?.href;

  if (labelText !== `${EXTERNAL_DOC_LABEL} ` || !href) {
    return "";
  }

  return href;
};

const stripExternalDocBlock = (content?: object | null) => {
  const doc = (content ?? EMPTY_DOCUMENT) as { content?: TiptapContentNode[] };
  if (!Array.isArray(doc.content) || doc.content.length === 0) {
    return EMPTY_DOCUMENT;
  }

  const firstNode = doc.content[0];
  const labelText = firstNode?.content?.[0]?.text;
  const linkNode = firstNode?.content?.[1];
  const href = linkNode?.marks?.find((mark) => mark.type === "link")?.attrs?.href;

  if (labelText !== `${EXTERNAL_DOC_LABEL} ` || !href) {
    return doc;
  }

  const remainingContent = doc.content.slice(1);
  return {
    type: "doc",
    content: remainingContent.length > 0 ? remainingContent : [{ type: "paragraph" }],
  };
};

const addExternalDocBlock = (content: object, docLink: string) => {
  const cleanedContent = stripExternalDocBlock(content) as { content?: TiptapContentNode[] };
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: `${EXTERNAL_DOC_LABEL} ` },
          {
            type: "text",
            text: docLink,
            marks: [{ type: "link", attrs: { href: docLink } }],
          },
        ],
      },
      ...(cleanedContent.content ?? []),
    ],
  };
};

const parseResoContent = (raw?: string | object | null) => {
  if (!raw) {
    return undefined;
  }

  if (typeof raw === "object") {
    return raw;
  }

  if (typeof raw !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const paragraphs = raw.split(/\r?\n+/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : [],
    }));

    return {
      type: "doc",
      content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
    };
  }
};
// this page assumes that delegates can only post 1 reso, might be changed later

const Page = () => {
  const { user: currentUser, login } = useSession();
  const userRole = role(currentUser);
  const editorRef = React.useRef<Editor | null>(null);
  const [fetchedResos, setFetchedResos] = useState<Reso[]>([]);
  const [selectedReso, setSelectedReso] = useState<Reso | null>(null);
  const [delegates, setDelegates] = useState<shortenedDel[]>([]);
  const [committees, setCommittees] = useState<
    { committeeID: string; committeeCode: string }[]
  >([]);
  const [title, setTitle] = useState<string>("");
  const [docLink, setDocLink] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFullscreenEditor, setIsFullscreenEditor] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isDelegateUser = userRole === "delegate" && currentUser !== null;
  const initialStateRef = React.useRef({
    title: "",
    docLink: "",
    content: serializeDocument(),
  });
  const isBusy = isSaving || isDeleting;
  const parsedResoContent = React.useMemo(
    () => parseResoContent(selectedReso?.content ?? null),
    [selectedReso]
  );
  const cleanedResoContent = React.useMemo(
    () => stripExternalDocBlock(parsedResoContent),
    [parsedResoContent]
  );
  const delegateAlreadyHasReso = React.useMemo(() => {
    if (!isDelegateUser || !currentUser || !("delegateID" in currentUser)) {
      return false;
    }

    return fetchedResos.some((reso) => reso.delegateID === currentUser.delegateID);
  }, [currentUser, fetchedResos, isDelegateUser]);

  const isValidUuid = useCallback((value: string) => {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      value
    );
  }, []);

  const committeeIdFor = useCallback(
    (value: string) => {
      const match = committees.find(
        (committee) =>
          committee.committeeID === value || committee.committeeCode === value
      );
      return match?.committeeID ?? value;
    },
    [committees]
  );

  useEffect(() => {
    const loadCommittees = async () => {
      const { data, error } = await supabase
        .from("Committee")
        .select("committeeID, committeeCode")
        .order("committeeCode", { ascending: true });

      if (error) {
        console.error("Failed to load committees", error);
        toast.error("Unable to load committees");
      } else {
        setCommittees(data ?? []);
      }
    };

    loadCommittees();
  }, []);
  const getEditorSnapshot = useCallback(() => {
    if (!editorRef.current) {
      return initialStateRef.current.content;
    }

    try {
      return JSON.stringify(editorRef.current.getJSON());
    } catch {
      return initialStateRef.current.content;
    }
  }, []);

  const evaluateUnsavedChanges = useCallback(() => {
    const snapshot = getEditorSnapshot();
    const dirty =
      snapshot !== initialStateRef.current.content ||
      title !== initialStateRef.current.title ||
      docLink.trim() !== initialStateRef.current.docLink;
    setHasUnsavedChanges(dirty);
  }, [docLink, getEditorSnapshot, title]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleUpdate = () => {
      evaluateUnsavedChanges();
    };

    editor.on("update", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
    };
  }, [evaluateUnsavedChanges]);

  useEffect(() => {
    evaluateUnsavedChanges();
  }, [title, evaluateUnsavedChanges]);

  useEffect(() => {
    const baselineTitle = selectedReso?.title ?? "";
    const parsedContent = parseResoContent(selectedReso?.content ?? null);
    let frame: number | null = null;

    const applyBaseline = () => {
      if (!editorRef.current) {
        frame = window.requestAnimationFrame(applyBaseline);
        return;
      }

      if (parsedContent) {
        editorRef.current.commands.setContent(stripExternalDocBlock(parsedContent), false);
        setDocLink(readExternalDocLink(parsedContent));
      } else {
        editorRef.current.commands.clearContent(false);
        setDocLink("");
      }

      const snapshot = getEditorSnapshot();
      initialStateRef.current = {
        title: baselineTitle,
        docLink: readExternalDocLink(parsedContent),
        content: snapshot,
      };
      frame = null;
    };

    setTitle(baselineTitle);

    if (editorRef.current) {
      applyBaseline();
    } else {
      initialStateRef.current = {
        title: baselineTitle,
        docLink: readExternalDocLink(parsedContent),
        content: serializeDocument(stripExternalDocBlock(parsedContent ?? null)),
      };
      frame = window.requestAnimationFrame(applyBaseline);
    }

    setHasUnsavedChanges(false);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [getEditorSnapshot, selectedReso]);

  const logBackIn = useCallback(async () => {
    if (!currentUser) {
      toast.error("No user logged in");
      return null;
    }

    if (userRole === "delegate") {
      const {data : newPerms, error : permsError} = await supabase
        .from("Delegate")
        .select("resoPerms")
        .eq("delegateID", (currentUser as Delegate).delegateID)
        .single();
      if (permsError) {
        console.error("Failed to fetch delegate permissions:", permsError);
        toast.error("Failed to fetch delegate permissions");
        return null;
      }

      const delegateUser = currentUser as Delegate;
      const enrichedUser: Delegate = {
        ...delegateUser,
        resoPerms: newPerms.resoPerms || {
          "view:ownreso": false,
          "view:allreso": false,
          "update:ownreso": false,
          "update:reso": [],
        },
      };
      if (JSON.stringify(delegateUser.resoPerms) !== JSON.stringify(enrichedUser.resoPerms)) {
        login(enrichedUser);
      }
      return enrichedUser;
    }
    return currentUser;
  }, [currentUser, userRole, login]);

  useEffect(() => {
    const fetchDels = async () => {
      if (!currentUser || userRole !== "chair") return;

      try {
        const chairUser = currentUser as Chair;
        const { data, error } = await supabase
          .from<shortenedDel>("Delegate")
          .select("delegateID, firstname, lastname, resoPerms")
          .eq("committeeID", chairUser.committee.committeeID);

        if (error) {
          throw error;
        }

        setDelegates(data ?? []);
      } catch (error) {
        console.error("Failed to fetch delegates:", error);
        toast.error("Failed to fetch delegates");
      }
    };

    fetchDels();
  }, [currentUser, userRole]);

  useEffect( () => {
    logBackIn();
  }, [logBackIn]) // added logBackIn to dependencies

  // Only depend on currentUser for fetching resolutions
  useEffect(() => {
    const fetchResos = async () => {
      if (!currentUser) return;
      if (
        (userRole === "delegate" || userRole === "chair") &&
        committees.length === 0
      ) {
        return;
      }

      try {
        let query = supabase.from<Reso>("Resos").select("*");

        if (userRole === "delegate") {
          const delegateUser = currentUser as Delegate;
          if (!delegateUser.resoPerms["view:allreso"]) {
            query = query.eq("delegateID", delegateUser.delegateID);
          } else {
            const committeeUuid = committeeIdFor(
              delegateUser.committee.committeeID
            );
            if (!isValidUuid(committeeUuid)) {
              toast.error("Invalid committee reference for delegate");
              return;
            }
            query = query.eq("committeeID", committeeUuid);
          }
        } else if (userRole === "chair") {
          const chairUser = currentUser as Chair;
          const committeeUuid = committeeIdFor(chairUser.committee.committeeID);
          if (!isValidUuid(committeeUuid)) {
            toast.error("Invalid committee reference for chair");
            return;
          }
          query = query.eq("committeeID", committeeUuid);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        const fetched = data ?? [];
        setFetchedResos(fetched);

        if (selectedReso) {
          const updatedSelectedReso = fetched.find((reso: Reso) => reso.resoID === selectedReso.resoID);
          if (updatedSelectedReso) {
            setTitle(updatedSelectedReso.title || "");
          }
        }
      } catch (error) {
        console.error("Failed to fetch resolutions:", error);
        toast.error("Failed to fetch resolutions");
      }
    };

    fetchResos();
  }, [
    committees.length,
    committeeIdFor,
    currentUser,
    isValidUuid,
    selectedReso,
    userRole,
  ]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setEditable(!isBusy);
    }
  }, [isBusy]);

  const confirmDiscardChanges = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
      return UNSAVED_CHANGES_MESSAGE;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleSelectReso = useCallback(
    (reso: Reso) => {
      if (isBusy) {
        return;
      }

      if (selectedReso?.resoID === reso.resoID) {
        return;
      }

      if (!confirmDiscardChanges()) {
        return;
      }

      setSelectedReso(reso);
    },
    [confirmDiscardChanges, isBusy, selectedReso]
  );

  const handleCreateNewReso = useCallback(() => {
    if (isBusy) {
      return;
    }

    if (isDelegateUser && delegateAlreadyHasReso) {
      toast.error("You can only post one resolution as a delegate.");
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    setSelectedReso(null);
    setDocLink("");
    if (editorRef.current) {
      editorRef.current.commands.clearContent(false);
    }
  }, [confirmDiscardChanges, delegateAlreadyHasReso, isBusy, isDelegateUser]);

  const postReso = async () => {
    if (isBusy) {
      return;
    }

    if (isDelegateUser && !selectedReso && delegateAlreadyHasReso) {
      toast.error("You can only post one resolution as a delegate.");
      return;
    }

    const updatedUser = await logBackIn();
    if (!updatedUser) return;

    const updatedUserRole = role(updatedUser);
    const isDelegateUser = updatedUserRole === "delegate" && updatedUser !== null;

    if (!editorRef.current) {
      toast.error("Editor not initialized");
      return;
    }

    const trimmedDocLink = docLink.trim();
    if (trimmedDocLink && !isNonEmptyHttpUrl(trimmedDocLink)) {
      toast.error("Please enter a valid document URL (http or https).");
      return;
    }

    if (editorRef.current.getText().length === 0 && !trimmedDocLink) {
      toast.error("Add text or provide an external document link.");
      return;
    }

    if (!isDelegateUser && !selectedReso) {
      toast.error("Only delegates can post resolutions.");
      return;
    }

    if (isDelegateUser) {
      const delegateUser = updatedUser as Delegate;
      if (!delegateUser.resoPerms["update:ownreso"] && selectedReso?.delegateID === delegateUser.delegateID) {
        toast.error("You do not have permission to post resolutions.");
        return;
      }
      if (
        selectedReso &&
        (selectedReso.delegateID !== delegateUser.delegateID &&
          !(delegateUser.resoPerms["update:reso"]?.includes(selectedReso.resoID)))
      ) {
        toast.error("You can only update your own resolutions.");
        return;
      }
    }

    if (!title.trim()) {
      toast.error("Please enter a resolution title");
      return;
    }

    const editorContent = editorRef.current.getJSON();
    const content = trimmedDocLink
      ? addExternalDocBlock(editorContent, trimmedDocLink)
      : stripExternalDocBlock(editorContent);

    let delegateID = "0000";
    let committeeID = "";

    if (isDelegateUser) {
      const delegateUser = updatedUser as Delegate;
      delegateID = delegateUser.delegateID;
      committeeID = committeeIdFor(delegateUser.committee.committeeID);
      if (!isValidUuid(committeeID)) {
        toast.error("Unable to resolve your committee. Please contact admin.");
        return;
      }

      const ownResos = fetchedResos.filter(
        (reso) => reso.delegateID === delegateUser.delegateID
      );
      if (ownResos.length >= 1 && !selectedReso) {
        toast.error("You can only post one resolution as a delegate.");
        return;
      }
    } else if (updatedUserRole === "chair" && selectedReso) {
      const chairUser = updatedUser as Chair;
      committeeID = committeeIdFor(chairUser.committee.committeeID);
      if (!isValidUuid(committeeID)) {
        toast.error("Unable to resolve your committee. Please contact admin.");
        return;
      }
      delegateID = selectedReso.delegateID;
    }

    setIsSaving(true);

    try {
      if (selectedReso) {
        const { error: updateError } = await supabase
          .from("Resos")
          .update({ content, title })
          .eq("resoID", selectedReso.resoID);

        if (updateError) {
          throw updateError;
        }

        const updatedReso: Reso = {
          ...selectedReso,
          content,
          title,
        };

        setFetchedResos((prev) =>
          prev.map((reso) =>
            reso.resoID === updatedReso.resoID ? updatedReso : reso
          )
        );
        setSelectedReso(updatedReso);
        toast.success("Resolution updated successfully!");
      } else {
        const { data: existingResos, error: resoError } = await supabase
          .from<{ resoID: string }>("Resos")
          .select("resoID");

        if (resoError) {
          throw resoError;
        }

        const sortedResos = existingResos ? [...existingResos] : [];
        sortedResos.sort((a, b) => a.resoID.localeCompare(b.resoID));
        const highestResoID =
          sortedResos.length > 0
            ? (parseInt(sortedResos[sortedResos.length - 1].resoID, 10) + 1)
                .toString()
                .padStart(4, "0")
            : "0001";

        const newResoPayload: Reso = {
          resoID: highestResoID,
          delegateID,
          committeeID,
          content,
          title,
          isNew: false,
        };

        const { data: insertedReso, error: insertError } = await supabase
          .from("Resos")
          .insert(newResoPayload)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        const createdReso: Reso = (insertedReso as Reso) ?? {
          ...newResoPayload,
        };

        setFetchedResos((prev) => [...prev, createdReso]);
        setSelectedReso(createdReso);
        toast.success("Resolution posted successfully!");
      }

      const snapshot = getEditorSnapshot();
      initialStateRef.current = {
        title,
        docLink: trimmedDocLink,
        content: snapshot,
      };
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save resolution:", error);
      toast.error("Failed to post resolution");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReso = useCallback(async () => {
    if (!selectedReso || isBusy) {
      return;
    }

    const updatedUser = await logBackIn();
    if (!updatedUser) return;

    const updatedRole = role(updatedUser);

    if (updatedRole === "delegate") {
      const delegateUser = updatedUser as Delegate;
      const ownsReso = selectedReso.delegateID === delegateUser.delegateID;
      const hasUpdatePermission = Array.isArray(delegateUser.resoPerms?.["update:reso"])
        ? delegateUser.resoPerms["update:reso"].includes(selectedReso.resoID)
        : false;

      if (!ownsReso && !hasUpdatePermission) {
        toast.error("You can only delete resolutions you are allowed to update.");
        return;
      }
    } else if (updatedRole !== "chair") {
      toast.error("You do not have permission to delete this resolution.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this resolution? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("Resos")
        .delete()
        .eq("resoID", selectedReso.resoID);

      if (error) {
        throw error;
      }

      const updatedResos = fetchedResos.filter(
        (reso) => reso.resoID !== selectedReso.resoID
      );

      setFetchedResos(updatedResos);

      if (updatedResos.length > 0) {
        setSelectedReso(updatedResos[0]);
      } else {
        setSelectedReso(null);
        setTitle("");
        setDocLink("");
        initialStateRef.current = {
          title: "",
          docLink: "",
          content: serializeDocument(),
        };
        if (editorRef.current) {
          editorRef.current.commands.clearContent(true);
        }
      }

      setHasUnsavedChanges(false);
      toast.success("Resolution deleted successfully.");
    } catch (error) {
      console.error("Failed to delete resolution:", error);
      toast.error("Failed to delete resolution");
    } finally {
      setIsDeleting(false);
    }
  }, [editorRef, fetchedResos, initialStateRef, isBusy, logBackIn, selectedReso]);

  const toggleResoUpdatePermission = async (delegateID: string) => {
    if (!currentUser || !selectedReso || userRole !== "chair") {
      return;
    }

    try {
      const delegate = delegates.find(d => d.delegateID === delegateID);
      if (!delegate) return;

      const hasPermission = 
        delegate.resoPerms && 
        delegate.resoPerms["update:reso"] && 
        Array.isArray(delegate.resoPerms["update:reso"]) && 
        delegate.resoPerms["update:reso"].includes(selectedReso.resoID);

      let updatedPermissions;
      
      if (hasPermission) {
        updatedPermissions = {
          ...delegate.resoPerms,
          "update:reso": delegate.resoPerms["update:reso"].filter(id => id !== selectedReso.resoID)
        };
      } else {
        updatedPermissions = {
          ...delegate.resoPerms,
          "update:reso": [
            ...(Array.isArray(delegate.resoPerms["update:reso"]) ? delegate.resoPerms["update:reso"] : []),
            selectedReso.resoID
          ]
        };
      }

      const { error: updateError } = await supabase
        .from("Delegate")
        .update({ resoPerms: updatedPermissions })
        .eq("delegateID", delegateID);

      if (updateError) {
        throw updateError;
      }

      setDelegates(delegates.map(d => 
        d.delegateID === delegateID 
          ? { ...d, resoPerms: updatedPermissions }
          : d
      ));
      
      toast.success(`Permission ${hasPermission ? 'removed from' : 'granted to'} ${delegate.firstname}`);
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  if (userRole !== "delegate" && userRole !== "chair") {
    return (
      <div className="page-shell">
        <div className="page-maxwidth flex items-center justify-center">
          <div className="surface-card p-10 text-center max-w-md">
            <h2 className="text-2xl font-semibold text-deep-red mb-3">Restricted Access</h2>
            <p className="text-almost-black-green/75">Only delegates and chairs can manage resolutions. Please sign in with the appropriate credentials.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isDelegateUser) {
    const delegateUser = currentUser as Delegate;
    if (!delegateUser.resoPerms["view:ownreso"]) {
      return (
        <div className="page-shell">
          <div className="page-maxwidth flex items-center justify-center">
            <div className="surface-card p-10 text-center max-w-md space-y-4">
              <h2 className="text-2xl font-semibold text-deep-red">Permissions Required</h2>
              <p className="text-almost-black-green/75">You currently don’t have access to submit or edit resolutions. Please contact your chair for approval.</p>
              {currentUser && "delegateID" in currentUser && (
                <button
                  onClick={() => {
                    logBackIn();
                    toast.success("Permissions refreshed");
                  }}
                  className="ghost-button w-full justify-center"
                >
                  Refresh Access
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <ParticipantRoute>
      <div className="page-shell">
        <main className="page-maxwidth space-y-10">
          <header className="surface-card is-emphasised overflow-hidden px-8 py-10 text-center">
            <span className="badge-pill bg-white/15 text-white/80 inline-flex justify-center mx-auto mb-4">
              Collaborative Drafting
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white">Resolutions Workspace</h1>
            <p className="text-white/80 max-w-3xl mx-auto mt-3">
              Coordinate with your bloc, refine drafts, and push polished resolutions to the dais. Chairs can monitor progress and allocate editing permissions instantly.
            </p>
          </header>

          <section className="flex flex-col lg:flex-row gap-6">
            <aside className="lg:w-1/3 space-y-4">
              <div className="surface-card p-6 max-h-[520px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-deep-red">All Resos</h2>
                  <span className="badge-pill bg-soft-ivory text-deep-red/80">{fetchedResos.length} drafts</span>
                </div>
                {fetchedResos.length === 0 ? (
                  <div className="text-almost-black-green/60 text-center py-6 italic">
                    No resolutions found. Start by drafting a new proposal.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {fetchedResos.map((reso, idx) => {
                      if (!reso) return null;
                      const isActive = selectedReso?.resoID === reso.resoID;
                      return (
                        <li key={reso.resoID}>
                          <button
                            className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${isActive ? 'border-deep-red bg-soft-ivory shadow-lg' : 'border-soft-ivory bg-warm-light-grey hover:border-deep-red/60'}`}
                            onClick={() => handleSelectReso(reso)}
                          >
                            <span
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold shadow-sm ${
                                isActive
                                  ? 'bg-[#701e1e] text-white'
                                  : 'bg-[#f6d4c6] text-[#701e1e]'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-almost-black-green">{reso.title ? reso.title : `Resolution #${idx + 1}`}</p>
                              <p className="text-xs text-almost-black-green/60">Tap to load in editor</p>
                            </div>
                            <ArrowRight size={16} className={`transition-colors ${isActive ? 'text-deep-red' : 'text-deep-red/50'}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {selectedReso && userRole === "chair" && delegates.length > 0 && (
                <div className="surface-card p-6">
                  <h3 className="text-lg font-semibold text-deep-red mb-3">Update Permissions</h3>
                  <div className="max-h-[220px] overflow-y-auto pr-1">
                    <ul className="space-y-2">
                      {[...delegates]
                        .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`))
                        .map((delegate) => (
                          <li
                            key={delegate.delegateID}
                            className="flex items-center justify-between gap-3 rounded-xl border border-soft-ivory bg-warm-light-grey px-3 py-2"
                          >
                            <span className="font-semibold text-almost-black-green truncate">
                              {delegate.firstname} {delegate.lastname}
                            </span>
                            <input
                              type="checkbox"
                              checked={delegate.resoPerms &&
                                delegate.resoPerms["update:reso"] &&
                                Array.isArray(delegate.resoPerms["update:reso"]) &&
                                delegate.resoPerms["update:reso"].includes(selectedReso.resoID)}
                              onChange={() => toggleResoUpdatePermission(delegate.delegateID)}
                              className="h-4 w-4 rounded border-soft-ivory text-deep-red focus:ring-deep-red"
                              title="Toggle edit permission"
                              disabled={userRole !== "chair"}
                            />
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}
            </aside>

            <div className="flex-1">
              <div className="surface-card p-4 md:p-6 h-full flex flex-col">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-xs uppercase tracking-[0.3em] text-deep-red/70 block mb-2">Resolution Title</label>
                  <textarea
                    placeholder="Name your resolution"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isBusy}
                    className="w-full rounded-xl border-2 border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green shadow-inner transition focus:border-deep-red/70 focus:ring-2 focus:ring-deep-red/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 resize-none"
                    rows={1}
                  />
                </div>
                <button
                  onClick={handleCreateNewReso}
                  className="inline-flex items-center gap-1.5 rounded-full border border-deep-red/20 bg-white px-3 py-1.5 text-xs font-medium text-deep-red transition-colors hover:border-deep-red/40 hover:bg-deep-red/5 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy || (isDelegateUser && !selectedReso && delegateAlreadyHasReso)}
                >
                  <Plus size={14} />
                  New Resolution
                </button>
              </div>
                {isDelegateUser && !selectedReso && delegateAlreadyHasReso && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-deep-red/30 bg-deep-red/5 px-4 py-2 text-sm text-deep-red">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>You already submitted one resolution. Open it from the list to edit it.</span>
                  </div>
                )}
                {hasUnsavedChanges && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>Unsaved changes detected. Don&apos;t forget to post your latest edits.</span>
                  </div>
                )}

                <div className="mb-4 rounded-xl border border-soft-ivory bg-warm-light-grey/50 px-4 py-3">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-deep-red/70">
                    External Document Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={docLink}
                    onChange={(e) => setDocLink(e.target.value)}
                    placeholder="https://docs.google.com/... or https://.../resolution.docx"
                    disabled={isBusy}
                    className="w-full rounded-xl border border-soft-ivory bg-white px-3 py-2 text-sm text-almost-black-green shadow-inner transition focus:border-deep-red/70 focus:ring-2 focus:ring-deep-red/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsFullscreenEditor((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-deep-red/25 bg-white px-3 py-1.5 text-xs font-medium text-deep-red transition-colors hover:border-deep-red/50 hover:bg-deep-red/5"
                  >
                    {isFullscreenEditor ? <Minimize2 size={14} /> : <Expand size={14} />}
                    {isFullscreenEditor ? "Exit Fullscreen" : "Fullscreen Editor"}
                  </button>
                </div>

                <div
                  className={`overflow-hidden rounded-2xl border-2 border-soft-ivory bg-white/95 shadow-sm transition focus-within:border-deep-red/60 ${isFullscreenEditor ? "fixed inset-6 z-50 h-[calc(100vh-3rem)]" : "flex-1"} ${isBusy ? "pointer-events-none opacity-60" : ""}`}
                >
                  <SimpleEditor
                    ref={editorRef}
                    content={cleanedResoContent}
                    className="h-full toolbar-fixed"
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-soft-ivory pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {selectedReso && (
                    <button
                      onClick={handleDeleteReso}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-deep-red/30 bg-deep-red/10 text-deep-red transition-colors hover:border-deep-red/60 hover:bg-deep-red/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-red/40 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy}
                      aria-label={isDeleting ? "Deleting resolution" : "Delete resolution"}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={postReso}
                    className="primary-button inline-flex items-center gap-2"
                    disabled={isBusy}
                    aria-busy={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>{selectedReso ? "Update Resolution" : "Post Resolution"}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ParticipantRoute>
  );
};

export default Page;

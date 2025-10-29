"use client";
import React, { useEffect, useState } from "react";
import { Chair, Delegate, Speech } from "@/db/types";
import { useSession } from "../context/sessionContext";
import { Editor } from "@tiptap/react";
import { SimpleEditor } from "../../components/tiptap-templates/simple/simple-editor";
import { ParticipantRoute } from "@/components/protectedroute";
import { toast } from "sonner";
import role from "@/lib/roles";
import supabase from "@/lib/supabase";

type SpeechRow = Omit<Speech, "tags">;
type SpeechTagRow = { speechID: string; tag: string };

const Page = () => {
  const { user: currentUser } = useSession();
  const userRole = role(currentUser);
  const editorRef = React.useRef<Editor | null>(null);
  const [fetchedSpeeches, setFetchedSpeeches] = useState<Speech[]>([]);
  const [selectedSpeech, setSelectedSpeech] = useState<Speech | null>(null);
  const [title, setTitle] = useState<string>("");
  const isDelegateUser = userRole === "delegate" && currentUser !== null;
  const isChairUser = userRole === "chair" && currentUser !== null;

  useEffect(() => {
    if (selectedSpeech) {
      setTitle(selectedSpeech.title || "");
    } else {
      setTitle("");
    }
  }, [selectedSpeech]);

  useEffect(() => {
    const fetchSpeeches = async () => {
      if (!currentUser) return;

      try {
        let speechIds: { speechID: string; delegateID?: string }[] = [];

        if (isDelegateUser) {
          const delegateUser = currentUser as Delegate;
          const { data, error } = await supabase
            .from<{ speechID: string }>("Delegate-Speech")
            .select("speechID")
            .eq("delegateID", delegateUser.delegateID);

          if (error) {
            throw error;
          }

          speechIds = (data ?? []).map((row) => ({
            speechID: row.speechID,
            delegateID: delegateUser.delegateID,
          }));
        } else if (isChairUser) {
          const chairUser = currentUser as Chair;
          const { data, error } = await supabase
            .from<{ speechID: string }>("Chair-Speech")
            .select("speechID")
            .eq("chairID", chairUser.chairID);

          if (error) {
            throw error;
          }

          speechIds = (data ?? []).map((row) => ({ speechID: row.speechID }));
        }

        if (speechIds.length === 0) {
          setFetchedSpeeches([]);
          return;
        }

        const speechIdList = speechIds.map((row) => row.speechID);

        const { data: speechRows, error: speechesError } = await supabase
          .from<SpeechRow>("Speech")
          .select("*")
          .in("speechID", speechIdList);

        if (speechesError) {
          throw speechesError;
        }

        const { data: tagRows, error: tagsError } = await supabase
          .from<SpeechTagRow>("Speech-Tags")
          .select("speechID, tag")
          .in("speechID", speechIdList);

        if (tagsError) {
          throw tagsError;
        }

        const tagsBySpeechId: Record<string, string[]> = {};
        (tagRows ?? []).forEach((tagRecord) => {
          if (!tagsBySpeechId[tagRecord.speechID]) {
            tagsBySpeechId[tagRecord.speechID] = [];
          }
          tagsBySpeechId[tagRecord.speechID].push(tagRecord.tag);
        });

        const normalizedSpeeches: Speech[] = (speechRows ?? []).map((speech) => {
          const matchingDelegateId = speechIds.find((row) => row.speechID === speech.speechID)?.delegateID ?? speech.delegateID ?? "";
          return {
            ...speech,
            delegateID: matchingDelegateId,
            tags: tagsBySpeechId[speech.speechID] ?? [],
          };
        });

        setFetchedSpeeches(normalizedSpeeches);

        if (selectedSpeech) {
          const updatedSelectedSpeech = normalizedSpeeches.find(
            (speech) => speech.speechID === selectedSpeech.speechID
          );
          if (updatedSelectedSpeech) {
            setTitle(updatedSelectedSpeech.title || "");
          }
        }
      } catch (error) {
        console.error("Failed to fetch speeches:", error);
        toast.error("Failed to fetch speeches");
      }
    };

    fetchSpeeches();
  }, [currentUser, isDelegateUser, isChairUser, selectedSpeech]);

  const postSpeech = async () => {
    if (!currentUser) {
      toast.error("No user logged in");
      return;
    }

    if (!editorRef.current) {
      toast.error("Editor not initialized");
      return;
    }

    const editorText = editorRef.current.getText();
    if (editorText.length === 0) {
      toast.error("Speech content cannot be empty");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a speech title");
      return;
    }

    const content = editorRef.current.getJSON();

    const serializedContent = JSON.stringify(content);
    const timestamp = new Date().toISOString();

    try {
      if (selectedSpeech) {
        const { error: updateError } = await supabase
          .from("Speech")
          .update({
            title,
            content: serializedContent,
            date: timestamp,
          })
          .eq("speechID", selectedSpeech.speechID);

        if (updateError) {
          throw updateError;
        }

        const tags = selectedSpeech.tags ?? [];

        const { error: deleteTagsError } = await supabase
          .from("Speech-Tags")
          .delete()
          .eq("speechID", selectedSpeech.speechID);

        if (deleteTagsError) {
          throw deleteTagsError;
        }

        if (tags.length > 0) {
          const tagRows = tags.map((tag) => ({
            speechID: selectedSpeech.speechID,
            tag,
          }));

          const { error: tagInsertError } = await supabase
            .from("Speech-Tags")
            .insert(tagRows);

          if (tagInsertError) {
            throw tagInsertError;
          }
        }

        const updatedSpeech: Speech = {
          ...selectedSpeech,
          title,
          content: serializedContent,
          date: timestamp,
        };

        setFetchedSpeeches((prev) =>
          prev.map((speech) =>
            speech.speechID === updatedSpeech.speechID ? updatedSpeech : speech
          )
        );
        setSelectedSpeech(updatedSpeech);
        toast.success("Speech updated successfully!");
        return;
      }

      const { data: existingSpeeches, error: speechIdError } = await supabase
        .from<{ speechID: string }>("Speech")
        .select("speechID");

      if (speechIdError) {
        throw speechIdError;
      }

      const sortedSpeechIds = existingSpeeches ? [...existingSpeeches] : [];
      sortedSpeechIds.sort((a, b) => a.speechID.localeCompare(b.speechID));
      const nextSpeechId =
        sortedSpeechIds.length > 0
          ? (parseInt(sortedSpeechIds[sortedSpeechIds.length - 1].speechID, 10) + 1)
              .toString()
              .padStart(4, "0")
          : "0001";

      const insertPayload = {
        speechID: nextSpeechId,
        content: serializedContent,
        title,
        date: timestamp,
      };

      const { error: insertError } = await supabase
        .from("Speech")
        .insert(insertPayload);

      if (insertError) {
        throw insertError;
      }

      if (isDelegateUser) {
        const delegateUser = currentUser as Delegate;
        const { error: linkError } = await supabase
          .from("Delegate-Speech")
          .insert({
            speechID: nextSpeechId,
            delegateID: delegateUser.delegateID,
          });

        if (linkError) {
          throw linkError;
        }
      } else if (isChairUser) {
        const chairUser = currentUser as Chair;
        const { error: linkError } = await supabase
          .from("Chair-Speech")
          .insert({
            speechID: nextSpeechId,
            chairID: chairUser.chairID,
          });

        if (linkError) {
          throw linkError;
        }
      }

      const createdSpeech: Speech = {
        speechID: nextSpeechId,
        title,
        content: serializedContent,
        date: timestamp,
        delegateID: isDelegateUser
          ? (currentUser as Delegate).delegateID
          : "",
        tags: [],
      };

      setFetchedSpeeches((prev) => [...prev, createdSpeech]);
      setSelectedSpeech(createdSpeech);
      toast.success("Speech posted successfully!");
    } catch (error) {
      console.error("Failed to save speech:", error);
      toast.error("Failed to save speech");
    }
  };

  if (!isDelegateUser && !isChairUser) {
    return (
      <div className="page-shell">
        <div className="page-maxwidth flex items-center justify-center">
          <div className="surface-card p-10 text-center max-w-md">
            <h2 className="text-2xl font-semibold text-deep-red mb-3">Restricted Access</h2>
            <p className="text-almost-black-green/75">Only delegates and chairs can view the speech repository. Please sign in with the appropriate credentials.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ParticipantRoute>
      <div className="page-shell">
        <main className="page-maxwidth space-y-10">
          <header className="surface-card is-emphasised overflow-hidden px-8 py-10 text-center">
            <span className="badge-pill bg-white/15 text-white/85 inline-flex justify-center mx-auto mb-4">
              Prepared Speeches
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white">Speech Repository</h1>
            <p className="text-white/80 max-w-3xl mx-auto mt-3">
              Draft, rehearse, and refine your remarks. Save iterations or review submissions from your committee to stay ahead in debate.
            </p>
          </header>

          <section className="flex flex-col lg:flex-row gap-6">
            <aside className="lg:w-1/3 space-y-4">
              <div className="surface-card p-6 max-h-[520px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-deep-red">All Speeches</h2>
                  <span className="badge-pill bg-soft-ivory text-deep-red/80">{fetchedSpeeches.length} saved</span>
                </div>
                {fetchedSpeeches.length === 0 ? (
                  <div className="text-almost-black-green/60 text-center py-6 italic">
                    No speeches yet. Start drafting your first statement.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {fetchedSpeeches.map((speech, idx) => {
                      if (!speech) return null;
                      const isActive = selectedSpeech?.speechID === speech.speechID;
                      return (
                        <li key={speech.speechID}>
                          <button
                            className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${isActive ? 'border-deep-red bg-soft-ivory shadow-lg' : 'border-soft-ivory bg-warm-light-grey hover:border-deep-red/60'}`}
                            onClick={() => {
                              setSelectedSpeech(speech);
                              setTitle(speech.title || "");
                            }}
                          >
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold ${isActive ? 'bg-deep-red text-white' : 'bg-soft-rose text-deep-red'}`}>
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-almost-black-green">
                                {speech.title ? speech.title : `Speech #${idx + 1}`}
                              </p>
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
            </aside>

            <div className="flex-1">
              <div className="surface-card p-4 md:p-6 h-full flex flex-col">
                <div className="mb-4">
                  <label className="text-xs uppercase tracking-[0.3em] text-deep-red/70 block mb-2">Speech Title</label>
                  <textarea
                    placeholder="Give your speech a compelling title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/30 resize-none"
                    rows={1}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <SimpleEditor
                    ref={editorRef}
                    content={selectedSpeech?.content ? JSON.parse(selectedSpeech.content) : undefined}
                    className="h-full toolbar-fixed"
                  />
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t border-soft-ivory">
                  <button
                    onClick={postSpeech}
                    className="primary-button"
                  >
                    {selectedSpeech ? "Update Speech" : "Post Speech"}
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
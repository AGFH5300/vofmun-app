"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Reso, Delegate, Chair, shortenedDel } from "@/db/types";
import { useSession } from "../context/sessionContext";
import { Editor } from "@tiptap/react";
import { SimpleEditor } from "../../components/tiptap-templates/simple/simple-editor";
import { ParticipantRoute } from "@/components/protectedroute";
import { toast } from "sonner";
import role from "@/lib/roles";
import supabase from "@/lib/supabase";
import { ArrowRight } from "lucide-react";
// this page assumes that delegates can only post 1 reso, might be changed later

const Page = () => {
  const { user: currentUser, login } = useSession();
  const userRole = role(currentUser);
  const editorRef = React.useRef<Editor | null>(null);
  const [fetchedResos, setFetchedResos] = useState<Reso[]>([]);
  const [selectedReso, setSelectedReso] = useState<Reso | null>(null);
  const [delegates, setDelegates] = useState<shortenedDel[]>([]);
  const [title, setTitle] = useState<string>("");
  const isDelegateUser = userRole === "delegate" && currentUser !== null;

  useEffect(() => {
    if (selectedReso) {
      setTitle(selectedReso.title || "");
    } else {
      setTitle("");
    }
  }, [selectedReso]);

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

      try {
        let query = supabase.from<Reso>("Resos").select("*");

        if (userRole === "delegate") {
          const delegateUser = currentUser as Delegate;
          if (!delegateUser.resoPerms["view:allreso"]) {
            query = query.eq("delegateID", delegateUser.delegateID);
          } else {
            query = query.eq("committeeID", delegateUser.committee.committeeID);
          }
        } else if (userRole === "chair") {
          const chairUser = currentUser as Chair;
          query = query.eq("committeeID", chairUser.committee.committeeID);
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
  }, [currentUser, selectedReso, userRole]);

  const postReso = async () => {
    const updatedUser = await logBackIn();
    if (!updatedUser) return;

    const updatedUserRole = role(updatedUser);
    const isDelegateUser = updatedUserRole === "delegate" && updatedUser !== null;

    if (!editorRef.current) {
      toast.error("Editor not initialized");
      return;
    }

    if (editorRef.current.getText().length === 0) {
      toast.error("Resolution length invalid");
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

    const content = editorRef.current.getJSON();

    let delegateID = "0000";
    let committeeID = "0000";

    if (isDelegateUser) {
      const delegateUser = updatedUser as Delegate;
      delegateID = delegateUser.delegateID;
      committeeID = delegateUser.committee.committeeID;

      const ownResos = fetchedResos.filter(
        (reso) => reso.delegateID === delegateUser.delegateID
      );
      if (ownResos.length >= 1 && !selectedReso) {
        toast.error("You can only post one resolution as a delegate.");
        return;
      }
    } else if (updatedUserRole === "chair" && selectedReso) {
      const chairUser = updatedUser as Chair;
      committeeID = chairUser.committee.committeeID;
      delegateID = selectedReso.delegateID;
    }

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
        return;
      }

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
      setTitle("");
      toast.success("Resolution posted successfully!");
    } catch (error) {
      console.error("Failed to save resolution:", error);
      toast.error("Failed to post resolution");
    }
  };

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
                  <h2 className="text-xl font-semibold text-deep-red">All Resolutions</h2>
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
                            onClick={() => {
                              setSelectedReso(reso);
                              setTitle(reso.title || "");
                            }}
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
                      className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/30 resize-none"
                      rows={1}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSelectedReso(null);
                      setTitle("");
                    }}
                    className="ghost-button"
                  >
                    New Resolution
                  </button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <SimpleEditor
                    ref={editorRef}
                    content={selectedReso?.content || undefined}
                    className="h-full toolbar-fixed"
                  />
                </div>

                <div className="flex justify-end pt-4 mt-4 border-t border-soft-ivory">
                  <button
                    onClick={postReso}
                    className="primary-button"
                  >
                    {selectedReso ? "Update Resolution" : "Post Resolution"}
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

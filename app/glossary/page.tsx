// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
"use client";

import React from "react";
import { ProtectedRoute } from "@/components/protectedroute";
import { Search } from "lucide-react";

type GlossaryItem = {
  term: string;
  definition: string;
  usage: string;
  tip: string;
};

type GlossarySection = {
  title: string;
  description: string;
  items: GlossaryItem[];
};

const glossarySections: GlossarySection[] = [
  {
    title: "Core Committee Vocabulary",
    description:
      "Foundational Model UN terms every delegate should know before entering formal debate.",
    items: [
      {
        term: "Agenda",
        definition:
          "The list and order of topics the committee will discuss. Delegates usually vote to set this at the beginning of session.",
        usage: "A motion to set the agenda determines whether Topic A or Topic B is debated first.",
        tip: "Always prepare opening strategy for both topics in case your preferred topic is not selected.",
      },
      {
        term: "Dais",
        definition:
          "The front table where the Chair and committee staff sit to moderate debate, recognize speakers, and enforce rules.",
        usage: "The Chair at the dais decides whether your motion is in order.",
        tip: "Address the dais respectfully and wait to be recognized before speaking.",
      },
      {
        term: "Placard",
        definition:
          "Country/name sign used to request speaking rights, vote, and indicate procedural actions during committee.",
        usage: "Raise your placard high for motions, points, and roll-call responses.",
        tip: "Keep your placard visible and write clearly so chairs can identify you quickly.",
      },
      {
        term: "Quorum",
        definition:
          "Minimum number of delegates required to be present for committee to conduct business and vote.",
        usage: "Without quorum, the committee may suspend substantive actions.",
        tip: "Be punctual; repeated absences can weaken your bloc during critical votes.",
      },
      {
        term: "Simple Majority",
        definition:
          "More than half of delegates present and voting (abstentions excluded unless rulebook says otherwise).",
        usage: "Most procedural motions pass by simple majority.",
        tip: "Count likely yes/no votes before proposing a risky motion.",
      },
      {
        term: "Two-Thirds Majority",
        definition:
          "A supermajority threshold (approximately 66.7%) required for important substantive actions in many committees.",
        usage: "Closing debate and adopting some resolutions may require two-thirds support.",
        tip: "Build broad coalition support early if your committee requires supermajorities.",
      },
    ],
  },
  {
    title: "Speeches & Debate Formats",
    description:
      "Structures that determine who speaks, for how long, and under what level of moderation.",
    items: [
      {
        term: "General Speakers List (GSL)",
        definition:
          "Default formal speaking list where delegates give broader policy speeches on the agenda topic.",
        usage: "If no caucus is active, committee usually returns to the GSL.",
        tip: "Use GSL speeches for big-picture narrative and bloc signaling.",
      },
      {
        term: "Moderated Caucus",
        definition:
          "A focused debate format with shorter speeches and a specific subtopic, moderated by the Chair.",
        usage: "Delegates motion for a moderated caucus with total time, speaking time, and topic.",
        tip: "Propose precise, strategic subtopics to steer committee direction.",
      },
      {
        term: "Unmoderated Caucus",
        definition:
          "Informal negotiation period where delegates can move freely, lobby, merge ideas, and draft text.",
        usage: "Most resolution writing and bloc bargaining happens in unmoderated caucuses.",
        tip: "Enter with concrete goals: recruit co-signers, finalize clause language, and assign tasks.",
      },
      {
        term: "Yield to Questions",
        definition:
          "A speaker yields remaining time so other delegates can ask direct questions through the Chair.",
        usage: "Common after policy-heavy speeches where delegates challenge feasibility.",
        tip: "Prepare one-line evidence anchors before yielding to handle pressure confidently.",
      },
      {
        term: "Yield to Another Delegate",
        definition:
          "A speaker transfers remaining time to another delegate, allowing sequential messaging by allies.",
        usage: "Useful for coordinated bloc statements on a shared policy line.",
        tip: "Coordinate talking points with your ally before yielding to avoid repetition.",
      },
      {
        term: "Right of Reply",
        definition:
          "A request to respond when a delegate believes their country has been directly and offensively misrepresented.",
        usage: "Granted at Chair discretion and not intended for ordinary disagreement.",
        tip: "Use sparingly; overuse can look defensive and may annoy the dais.",
      },
    ],
  },
  {
    title: "Points & Motions",
    description:
      "Parliamentary tools for managing procedure, fairness, and committee flow.",
    items: [
      {
        term: "Point of Order",
        definition:
          "Raised when a delegate believes committee rules are being applied incorrectly.",
        usage: "You may interrupt if the breach is immediate and procedural.",
        tip: "State rule concern briefly and neutrally; avoid turning it into a speech.",
      },
      {
        term: "Point of Personal Privilege",
        definition:
          "Raised when physical conditions impede participation (audibility, temperature, visibility, etc.).",
        usage: "Often used when delegates cannot hear the current speaker.",
        tip: "Only interrupt if absolutely necessary for participation.",
      },
      {
        term: "Point of Parliamentary Inquiry",
        definition:
          "Question to the Chair about rules or procedure, not substantive policy.",
        usage: "Use before moving if unsure whether your motion is in order.",
        tip: "Clarifying procedure first can prevent wasted motions and lost momentum.",
      },
      {
        term: "Point of Information",
        definition:
          "Question directed to a speaker, typically after they open themselves to questions.",
        usage: "Can test policy details, legal basis, or implementation feasibility.",
        tip: "Ask concise, answerable questions that expose gaps constructively.",
      },
      {
        term: "Motion to Suspend Meeting",
        definition:
          "Temporarily pauses committee for breaks, lunch, or transition periods.",
        usage: "Often used near scheduled breaks at conference discretion.",
        tip: "Time motions around natural transitions to avoid disrupting productive debate.",
      },
      {
        term: "Motion to Adjourn Meeting",
        definition:
          "Ends the committee session for the day or permanently, depending on conference schedule.",
        usage: "Typically considered toward final session close.",
        tip: "Confirm no essential voting remains before supporting adjournment.",
      },
      {
        term: "Motion to Close Debate",
        definition:
          "Seeks to end discussion on a topic or document and move into voting procedure.",
        usage: "Usually requires higher threshold because it limits further speaking.",
        tip: "Ensure your bloc has committed votes before pushing closure.",
      },
      {
        term: "Motion to Reorder Draft Resolutions",
        definition:
          "Changes the order in which draft resolutions are voted upon.",
        usage: "Strategic when multiple competing drafts exist.",
        tip: "Vote sequencing can change outcomes; discuss order strategy with allies.",
      },
    ],
  },
  {
    title: "Resolution Drafting & Amendments",
    description:
      "Terms used while writing, editing, and passing formal committee output.",
    items: [
      {
        term: "Working Paper",
        definition:
          "Informal text draft shared with the committee before official formatting as a draft resolution.",
        usage: "Working papers help blocs gather feedback quickly.",
        tip: "Circulate early versions to identify controversy before formal submission.",
      },
      {
        term: "Draft Resolution",
        definition:
          "Formal committee document with sponsors/signatories that can be introduced, debated, amended, and voted on.",
        usage: "Receives a number once approved for floor introduction by the dais.",
        tip: "Prioritize clarity, enforceability, and funding logic in operative clauses.",
      },
      {
        term: "Sponsor",
        definition:
          "Primary author/supporter of a draft resolution who advocates for and defends its content.",
        usage: "Sponsors are expected to answer detailed implementation questions.",
        tip: "Limit sponsors to delegates who can consistently defend all clauses.",
      },
      {
        term: "Signatory",
        definition:
          "Delegate who supports discussion of a draft resolution but does not necessarily support final adoption.",
        usage: "Signing usually means \"let this be debated,\" not \"I vote yes.\"",
        tip: "Use signatory outreach to broaden debate access without forcing alliances.",
      },
      {
        term: "Friendly Amendment",
        definition:
          "Amendment accepted by all sponsors; often incorporated without full committee vote, depending on rules.",
        usage: "Typically used for wording fixes or broadly accepted improvements.",
        tip: "Clear friendly amendments quickly to keep debate on substance.",
      },
      {
        term: "Unfriendly Amendment",
        definition:
          "Amendment not accepted by all sponsors and therefore put to committee vote.",
        usage: "Can substantially alter policy direction or weaken opponent proposals.",
        tip: "Draft precise language—vague unfriendly amendments are easily defeated.",
      },
      {
        term: "Preambular Clauses",
        definition:
          "Opening clauses that provide context, legal basis, and motivation for proposed action.",
        usage: "Usually begin with participles such as Recalling, Alarmed, or Recognizing.",
        tip: "Keep preambular clauses relevant and concise; they frame legitimacy.",
      },
      {
        term: "Operative Clauses",
        definition:
          "Action-oriented clauses specifying what the committee recommends, creates, funds, or requests.",
        usage: "Numbered clauses form the enforceable core of the draft.",
        tip: "Include actors, timelines, monitoring, and financing for credibility.",
      },
    ],
  },
  {
    title: "Voting Procedure & Outcomes",
    description:
      "How committees record final decisions on motions, amendments, and resolutions.",
    items: [
      {
        term: "Procedural Vote",
        definition:
          "Vote on process-related matters (caucuses, closure, agenda), where abstentions are often not allowed.",
        usage: "Delegates must vote yes or no on many procedural questions.",
        tip: "Track procedural reliability of partners—it predicts bloc discipline.",
      },
      {
        term: "Substantive Vote",
        definition:
          "Vote on policy content such as draft resolutions and amendments; abstentions may be permitted by rules.",
        usage: "Represents each delegation's formal policy position.",
        tip: "Signal intended substantive vote early to gain negotiation leverage.",
      },
      {
        term: "Roll-Call Vote",
        definition:
          "Delegations are called individually to state votes aloud, often with options like Yes, No, Abstain, or with Rights.",
        usage: "Requested when delegations want public accountability on final record.",
        tip: "Use strategically for high-stakes drafts where public positioning matters.",
      },
      {
        term: "Division of the Question",
        definition:
          "Procedure to split a draft resolution so clauses are voted on in parts before final whole-text vote.",
        usage: "Common when committee supports some sections but rejects others.",
        tip: "Prepare fallback coalitions for each divided segment.",
      },
      {
        term: "Pass",
        definition:
          "Temporary skip during roll call in some rule sets, allowing delegate to vote later in the sequence.",
        usage: "Used to observe others' positions before committing.",
        tip: "Do not over-rely on passing; some conferences restrict or ban it.",
      },
      {
        term: "With Rights",
        definition:
          "A vote accompanied by a brief explanation after voting concludes (if rules allow).",
        usage: "Delegates may state reasons for yes/no/abstain decisions.",
        tip: "Use rights to shape narrative without reopening full debate.",
      },
    ],
  },
];

const Page = () => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const filteredSections = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return glossarySections;
    }

    return glossarySections
      .map((section) => {
        const sectionMatch = `${section.title} ${section.description}`.toLowerCase().includes(query);

        if (sectionMatch) {
          return section;
        }

        const items = section.items.filter((item) =>
          `${item.term} ${item.definition} ${item.usage} ${item.tip}`.toLowerCase().includes(query)
        );

        if (items.length === 0) {
          return null;
        }

        return {
          ...section,
          items,
        };
      })
      .filter((section): section is GlossarySection => section !== null);
  }, [searchQuery]);

  const allVisibleItems = React.useMemo(() => filteredSections.flatMap((section) => section.items), [filteredSections]);

  const totalResults = allVisibleItems.length;

  return (
    <ProtectedRoute>
      <div
        className="w-full"
        style={{
          backgroundColor: "#f9f9f9",
          color: "#1a1c1c",
          fontFamily: "var(--font-manrope), Manrope, ui-sans-serif, system-ui",
        }}
      >
        <main className="mx-auto max-w-6xl px-8 py-12 space-y-12">
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-[#6e1d1b]">Official Handbook</span>
              <h1
                className="mb-4 text-5xl font-semibold italic leading-tight tracking-tight text-[#6e1d1b] md:text-6xl"
                style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}
              >
                Delegate Glossary
              </h1>
              <p className="text-lg leading-relaxed text-[#5d5f5f]">
                Your definitive guide to the lexicon of international diplomacy. Clear terminology ensures a more
                productive committee session.
              </p>
            </div>
            <div className="hidden md:flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#eeeeee] text-[#6e1d1b]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-12 w-12" aria-hidden="true">
                <path fill="none" d="M0 0h24v24H0z" />
                <path
                  fill="currentColor"
                  d="M9 4v1.38c-.83-.33-1.72-.5-2.61-.5-1.79 0-3.58.68-4.95 2.05l3.33 3.33h1.11v1.11c.86.86 1.98 1.31 3.11 1.36V15H6v3c0 1.1.9 2 2 2h10c1.66 0 3-1.34 3-3V4zm-1.11 6.41V8.26H5.61L4.57 7.22a5.1 5.1 0 0 1 1.82-.34c1.34 0 2.59.52 3.54 1.46l1.41 1.41-.2.2a2.7 2.7 0 0 1-1.92.8c-.47 0-.93-.12-1.33-.34M19 17c0 .55-.45 1-1 1s-1-.45-1-1v-2h-6v-2.59c.57-.23 1.1-.57 1.56-1.03l.2-.2L15.59 14H17v-1.41l-6-5.97V6h8z"
                />
              </svg>
            </div>
          </section>

          <div className="sticky top-24 z-30">
            
              <div
                className="flex cursor-text items-center gap-3 rounded-xl border border-[#d7dbdb] bg-white px-3 py-2 transition-colors focus-within:border-[#b9bfc0]"
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search className="h-4 w-4 shrink-0 text-[#5d5f5f]" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  id="glossary-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Start typing to filter ‘Quorum’ or ‘Caucus’..."
                  style={{border: "none", outline: "none", boxShadow: "none", backgroundColor: "transparent"}}
                  className="min-w-0 flex-1 border-none bg-transparent px-0 py-1 text-[15px] text-[#1a1c1c] shadow-none outline-none placeholder:text-[#5d5f5f]/65 ring-0 focus:border-none focus:outline-none focus:ring-0"
                
                />
                <kbd className="hidden shrink-0 rounded-md bg-[#f2f4f4] px-2 py-1 text-[10px] font-semibold tracking-wide text-[#5d5f5f] sm:inline-flex">
                  ESC
                </kbd>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-12 xl:grid-cols-3">
            <div className="space-y-10 xl:col-span-2">
              <section>
                <div className="mb-8 flex items-center gap-4">
                  <h2
                    className="text-3xl font-semibold italic text-[#6e1d1b]"
                    style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}
                  >
                    Key Terms
                  </h2>
                  <div className="h-px flex-grow bg-[#dcc0bd]/70" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5d5f5f]/70">A—Z Index</span>
                </div>

                {totalResults === 0 ? (
                  <article className="rounded-2xl border border-[#dcc0bd] bg-white p-6 text-center">
                    <h3 className="mb-2 text-xl font-semibold text-[#6e1d1b]">No glossary terms found</h3>
                    <p className="text-[#5d5f5f]">Try a broader keyword or clear the search to browse all glossary entries.</p>
                  </article>
                ) : (
                  <div className="space-y-8">
                    {filteredSections.map((section) => (
                      <section key={section.title} className="space-y-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-[#6e1d1b]">{section.title}</h3>
                          <span className="rounded-full bg-[#eee0d5] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4e453d]">
                            {section.items.length} terms
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-[#5d5f5f]">{section.description}</p>

                        <div className="space-y-6">
                          {section.items.map((item) => (
                            <article key={item.term} className="border-t border-[#dcc0bd]/75 pt-6">
                              <div className="flex flex-col gap-4 md:flex-row md:gap-10">
                                <div className="md:w-1/3">
                                  <h4
                                    className="text-2xl font-bold leading-tight text-[#1a1c1c]"
                                    style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}
                                  >
                                    {item.term}
                                  </h4>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="rounded bg-[#eee0d5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-[#211a14]">
                                      Definition
                                    </span>
                                    <span className="rounded bg-[#e2e2e2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-[#454747]">
                                      In Practice
                                    </span>
                                    <span className="rounded bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-[#7f2926]">
                                      Delegate Tip
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-3 md:w-2/3">
                                  <p className="text-sm leading-relaxed text-[#564240]"><span className="font-semibold text-[#1a1c1c]">Definition:</span> {item.definition}</p>
                                  <p className="text-sm leading-relaxed text-[#564240]"><span className="font-semibold text-[#1a1c1c]">In practice:</span> {item.usage}</p>
                                  <p className="text-sm leading-relaxed text-[#564240]"><span className="font-semibold text-[#1a1c1c]">Delegate tip:</span> {item.tip}</p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </section>

              <aside className="relative overflow-hidden rounded-2xl border-l-4 border-[#6e1d1b] bg-[#f4f3f3] p-8">
                <p
                  className="mb-3 text-2xl italic leading-relaxed text-[#6e1d1b]"
                  style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}
                >
                  Glossary Tip: precise terms make your interventions faster, clearer, and more persuasive under
                  procedural pressure.
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5d5f5f]/80">Debate Note</p>
              </aside>
            </div>

            <aside className="space-y-8">
              <section className="rounded-2xl border border-[#dcc0bd]/50 bg-[#eeeeee]/50 p-8">
                <h2
                  className="mb-6 text-2xl font-semibold italic text-[#6e1d1b]"
                  style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}
                >
                  Point Categories
                </h2>
                <div className="space-y-6 text-sm leading-relaxed text-[#564240]">
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6e1d1b]"><span className="h-1.5 w-1.5 rounded-full bg-[#6e1d1b]" />Point of Order</h3>
                    <p>Raised when a delegate believes parliamentary procedure is being applied incorrectly.</p>
                  </div>
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6e1d1b]"><span className="h-1.5 w-1.5 rounded-full bg-[#6e1d1b]" />Point of Information</h3>
                    <p>A direct question to a speaker, typically after they yield to questions.</p>
                  </div>
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6e1d1b]"><span className="h-1.5 w-1.5 rounded-full bg-[#6e1d1b]" />Point of Personal Privilege</h3>
                    <p>Used when discomfort or audibility issues prevent effective participation.</p>
                  </div>
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6e1d1b]"><span className="h-1.5 w-1.5 rounded-full bg-[#6e1d1b]" />Point of Inquiry</h3>
                    <p>Use this to ask the Chair procedural clarifications before making a motion.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-dashed border-[#dcc0bd] bg-white p-6">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-[#6e1d1b]">Handbook Resource</h3>
                <p className="text-sm leading-relaxed text-[#5d5f5f]">
                  No direct handbook file is linked on this page yet. Use the glossary terms above as the active
                  committee reference.
                </p>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default Page;

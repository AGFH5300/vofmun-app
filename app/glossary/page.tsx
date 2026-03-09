// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
"use client";
import React from "react";
import {ProtectedRoute} from "@/components/protectedroute";

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
  return (
    <ProtectedRoute>
      <div className="page-shell">
        <div className="page-maxwidth max-w-5xl space-y-10">
          <header className="surface-card is-emphasised overflow-hidden text-center px-8 py-10">
            <span className="badge-pill bg-white/15 text-white/80 inline-flex justify-center mx-auto mb-4">
              Expanded Delegate Reference
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-3">Comprehensive Delegate Glossary</h1>
            <p className="text-white/80 max-w-3xl mx-auto">
              A detailed, practical glossary covering core committee language, debate structures, motions, drafting terms, and voting mechanics. Use this as your in-session reference to speak accurately, move strategically, and negotiate with confidence.
            </p>
          </header>

          <section className="space-y-6">
            {glossarySections.map((section) => (
              <article key={section.title} className="surface-card p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                  <h2 className="text-2xl font-semibold text-deep-red">{section.title}</h2>
                  <span className="badge-pill bg-soft-ivory text-deep-red/80">Detailed Reference</span>
                </div>
                <p className="text-almost-black-green/75 mb-5">{section.description}</p>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item.term} className="surface-card rounded-xl px-4 py-4 space-y-2">
                      <p className="font-semibold text-almost-black-green text-lg">{item.term}</p>
                      <p className="text-sm text-almost-black-green/80">
                        <span className="font-semibold">Definition:</span> {item.definition}
                      </p>
                      <p className="text-sm text-almost-black-green/70">
                        <span className="font-semibold">In practice:</span> {item.usage}
                      </p>
                      <p className="text-sm text-almost-black-green/70">
                        <span className="font-semibold">Delegate tip:</span> {item.tip}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Page;

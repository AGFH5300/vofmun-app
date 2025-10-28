"use client";
import React from "react";
import {ProtectedRoute} from "@/components/protectedroute";

const Page = () => {
  return (
    <ProtectedRoute>
      <div className="page-shell">
        <div className="page-maxwidth max-w-4xl space-y-10">
          <header className="surface-card is-emphasised overflow-hidden text-center px-8 py-10">
            <span className="badge-pill bg-white/15 text-white/80 inline-flex justify-center mx-auto mb-4">
              Essential Reference
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-3">Delegate Glossary</h1>
            <p className="text-white/80 max-w-2xl mx-auto">
              Brush up on parliamentary procedure and debate essentials. Each term keeps your interventions sharp and compliant with committee expectations.
            </p>
          </header>

          <section className="space-y-6">
            {[{
              title: 'Points',
              description: 'Parliamentary procedures used during debate:',
              items: [
                { term: 'Point of Information', content: 'A question directed to the speaker following their speech.' },
                { term: 'Point of Order', content: 'Raised when parliamentary procedure is not being followed.' },
                { term: 'Point of Personal Privilege', content: 'Used when conditions affect delegate comfort or audibility.' },
              ]
            }, {
              title: 'Motions',
              description: 'Formal proposals to guide the flow of debate:',
              items: [
                { term: 'Motion to Open Debate', content: 'Begins formal discussion on the agenda item.' },
                { term: 'Motion to Close Debate', content: 'Ends debate and moves the committee into voting procedure.' },
                { term: 'Motion to Extend Debate', content: 'Adds time to the current moderated caucus or debate format.' },
                { term: 'Motion to Suspend Debate', content: 'Pauses proceedings for unmoderated caucuses or breaks.' },
              ]
            }, {
              title: 'Resolutions',
              description: 'Documents capturing the committee’s collective stance:',
              items: [
                { term: 'Draft Resolution', content: 'Initial working document addressing the agenda topic.' },
                { term: 'Amendment', content: 'Changes proposed to improve or modify a draft resolution.' },
                { term: 'Preambular Clauses', content: 'Outline context, background, and justification for action.' },
                { term: 'Operative Clauses', content: 'Detail the concrete steps and directives proposed by the committee.' },
              ]
            }].map((section) => (
              <article key={section.title} className="surface-card p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                  <h2 className="text-2xl font-semibold text-deep-red">{section.title}</h2>
                  <span className="badge-pill bg-soft-ivory text-deep-red/80">Reference</span>
                </div>
                <p className="text-almost-black-green/75 mb-5">{section.description}</p>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item.term} className="surface-card rounded-xl px-4 py-3">
                      <p className="font-semibold text-almost-black-green">{item.term}</p>
                      <p className="text-sm text-almost-black-green/70">{item.content}</p>
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
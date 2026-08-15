// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import Link from 'next/link';
import { BookOpen, Handshake, MessagesSquare, Radio, Users } from 'lucide-react';
import { ProtectedRoute } from '@/components/protectedroute';

const teams = [
  { title: 'Secretariat', description: 'Leads the conference, academic direction, participant experience, and event operations.', icon: Users },
  { title: 'Committee Chairs', description: 'Guide procedure, maintain fair debate, and support delegates throughout committee sessions.', icon: Handshake },
  { title: 'Technology & Media', description: 'Operate VOFMUN ONE, live communications, conference media, and participant support systems.', icon: Radio },
];

export default function AboutPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#f9f9f9] px-5 pb-16 pt-8 text-[#1a1c1c] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="overflow-hidden rounded-3xl bg-[#6E1D1B] px-7 py-12 text-white sm:px-12 sm:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">About VOFMUN</p>
            <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">Diplomacy, leadership, and global dialogue led by the next generation.</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/78">Voices of the Future Model United Nations brings students together to research global issues, represent countries, negotiate with purpose, and build practical confidence in public speaking and collaboration.</p>
          </section>

          <section className="mt-8 grid gap-5 md:grid-cols-3">
            {teams.map(({ title, description, icon: Icon }) => <article key={title} className="rounded-2xl border border-[#dcc0bd]/40 bg-white p-6 shadow-[0_10px_30px_rgba(26,28,28,0.05)]"><Icon className="h-6 w-6 text-[#6E1D1B]" /><h2 className="mt-4 font-serif text-2xl font-semibold text-[#500608]">{title}</h2><p className="mt-2 text-sm leading-7 text-[#564240]/80">{description}</p></article>)}
          </section>

          <section className="mt-8 grid gap-6 rounded-2xl border border-[#dcc0bd]/40 bg-white p-7 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E1D1B]/60">VOFMUN ONE</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[#500608]">The conference operating platform</h2>
              <p className="mt-3 text-sm leading-7 text-[#564240]/80">Your provisioned VOFMUN account provides live announcements, schedules, crisis briefings, committee messaging, resolutions, speech preparation, procedural guidance, and direct support.</p>
            </div>
            <div className="grid gap-3">
              <Link href="/live-updates" className="flex items-center gap-3 rounded-xl bg-[#fff0e5] px-4 py-3 text-sm font-semibold text-[#6E1D1B]"><Radio className="h-5 w-5" /> Live conference operations</Link>
              <Link href="/resolutions" className="flex items-center gap-3 rounded-xl bg-[#f4f3f3] px-4 py-3 text-sm font-semibold text-[#6E1D1B]"><BookOpen className="h-5 w-5" /> Resolutions and speeches</Link>
              <Link href="/messages" className="flex items-center gap-3 rounded-xl bg-[#f4f3f3] px-4 py-3 text-sm font-semibold text-[#6E1D1B]"><MessagesSquare className="h-5 w-5" /> Committee communication</Link>
            </div>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://vofmun.org/secretariat" target="_blank" rel="noreferrer" className="rounded-xl bg-[#6E1D1B] px-5 py-3 text-sm font-semibold text-white">Meet the current secretariat</a>
            <button onClick={() => window.dispatchEvent(new Event('open-support-request'))} className="rounded-xl border border-[#6E1D1B] px-5 py-3 text-sm font-semibold text-[#6E1D1B]">Contact participant support</button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}

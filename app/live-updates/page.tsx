// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ExternalLink, Megaphone } from 'lucide-react';
import { ProtectedRoute } from '@/components/protectedroute';
import { withBrowserAuthHeaders } from '@/lib/auth/browserAuthFetch';
import supabase from '@/lib/supabase';
import type { Update } from '@/db/types';

type ScheduleItemType = 'registration' | 'committee' | 'break' | 'ceremony' | 'departure' | 'featured';
type ScheduleItem = { label: string; title: string; start: string; end: string; type: ScheduleItemType };
type ConferenceDay = { shortLabel: string; label: string; dateISO: string; events: ScheduleItem[] };
type ConferenceSettings = {
  conference_name: string;
  timezone: string;
  utc_offset: string;
  start_at: string | null;
  end_at: string | null;
  schedule: ConferenceDay[];
  crisis_status: 'not_published' | 'published';
  crisis_title: string | null;
  crisis_content: string | null;
  crisis_media_url: string | null;
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return days > 0 ? `${days}d ${clock}` : clock;
};

const isConferenceDay = (value: unknown): value is ConferenceDay => {
  if (!value || typeof value !== 'object') return false;
  const day = value as Record<string, unknown>;
  return typeof day.shortLabel === 'string' && typeof day.label === 'string' && typeof day.dateISO === 'string' && Array.isArray(day.events);
};

const Page = () => {
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [conferenceLoading, setConferenceLoading] = useState(true);
  const [conferenceError, setConferenceError] = useState('');
  const [updates, setUpdates] = useState<Update[]>([]);
  const [conference, setConference] = useState<ConferenceSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const headingStyle: React.CSSProperties = { fontFamily: "'Newsreader', serif" };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const fetchConference = async () => {
      try {
        setConferenceLoading(true);
        const response = await fetch('/api/conference', await withBrowserAuthHeaders(undefined, 'live-conference-load'));
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Unable to load conference settings.');

        const record = body.conference as ConferenceSettings;
        const schedule = Array.isArray(record?.schedule) ? record.schedule.filter(isConferenceDay) : [];
        if (active) {
          setConference({ ...record, schedule });
          setConferenceError('');
        }
      } catch (error) {
        if (active) {
          setConference(null);
          setConferenceError(error instanceof Error ? error.message : 'Unable to load conference settings.');
        }
      } finally {
        if (active) setConferenceLoading(false);
      }
    };

    void fetchConference();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        setUpdatesLoading(true);
        const { data, error } = await supabase.from('Updates').select('*').order('time', { ascending: false });
        if (error) throw error;
        setUpdates(data || []);
      } catch (error) {
        console.error('[live updates] feed load failed', error);
      } finally {
        setUpdatesLoading(false);
      }
    };

    void fetchUpdates();
    const channel = supabase
      .channel('live-updates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Updates' }, () => void fetchUpdates())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  const timeline = useMemo(() => {
    const schedule = conference?.schedule || [];
    const offset = conference?.utc_offset || '+04:00';
    const toDateTime = (dateISO: string, time: string) => new Date(`${dateISO}T${time}:00${offset}`);
    const events = schedule
      .flatMap((day, dayIndex) => day.events.map((event) => ({
        ...event,
        dayIndex,
        startDate: toDateTime(day.dateISO, event.start),
        endDate: toDateTime(day.dateISO, event.end),
      })))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const start = conference?.start_at ? new Date(conference.start_at) : events[0]?.startDate || null;
    const end = conference?.end_at ? new Date(conference.end_at) : events.at(-1)?.endDate || null;
    const isWindow = Boolean(start && end && now >= start && now <= end);
    const completed = Boolean(end && now > end);
    const currentEvent = events.find((event) => now >= event.startDate && now < event.endDate) || null;
    const nextEvent = events.find((event) => event.startDate > now) || null;

    let activeDayIndex = 0;
    const currentDayIndex = schedule.findIndex((day) =>
      now >= toDateTime(day.dateISO, '00:00') && now <= toDateTime(day.dateISO, '23:59'),
    );
    if (currentDayIndex >= 0) {
      activeDayIndex = currentDayIndex;
    } else {
      const upcomingDayIndex = schedule.findIndex((day) => now < toDateTime(day.dateISO, '23:59'));
      activeDayIndex = upcomingDayIndex >= 0 ? upcomingDayIndex : Math.max(0, schedule.length - 1);
    }

    return { events, start, end, isWindow, completed, currentEvent, nextEvent, activeDayIndex, toDateTime };
  }, [conference, now]);

  const activeDay = conference?.schedule[timeline.activeDayIndex] || null;
  const sessionLabel = timeline.currentEvent
    ? timeline.currentEvent.title
    : timeline.completed
      ? 'Conference completed'
      : timeline.start && now < timeline.start
        ? 'Conference not started'
        : 'No session in progress';

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
        <div className="mx-auto w-full max-w-[1600px] space-y-10 px-6 py-8 lg:px-8">
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E1D1B]/60">{conference?.conference_name || 'VOFMUN'}</p>
              <h1 className="text-4xl font-semibold tracking-tight text-[#500608]" style={headingStyle}>Session Status</h1>
            </div>

            {conferenceError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{conferenceError}</p> : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#564240]">Current Session</span>
                <h4 className="text-[30px] font-medium leading-tight text-[#500608]" style={headingStyle}>{conferenceLoading ? 'Loading…' : sessionLabel}</h4>
              </div>
              <div className="rounded-xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#564240]">Starts Next</span>
                <span className="text-[30px] leading-tight text-[#500608]" style={headingStyle}>{timeline.nextEvent ? formatDuration(timeline.nextEvent.startDate.getTime() - now.getTime()) : 'No upcoming session'}</span>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#564240]">{timeline.nextEvent ? timeline.nextEvent.title : 'Schedule complete'}</p>
              </div>
              <div className="rounded-xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#564240]">Conference End</span>
                <span className="text-[30px] leading-tight text-[#500608]" style={headingStyle}>{timeline.end ? timeline.completed ? 'Completed' : formatDuration(timeline.end.getTime() - now.getTime()) : 'Not configured'}</span>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#564240]">{conference?.timezone || 'Conference timezone'}</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
            <section className="space-y-5 lg:col-span-4">
              <div className="flex items-center justify-between border-b border-[#dcc0bd]/30 pb-3">
                <h3 className="text-2xl font-semibold" style={headingStyle}>Daily Schedule</h3>
                {activeDay ? <span className="rounded-md bg-[#eee0d5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#211a14]">{activeDay.shortLabel}</span> : null}
              </div>
              {activeDay ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#564240]">{activeDay.label}</p>
                  <div className="relative ml-2 border-l-2 border-[#e2e2e2] py-1">
                    {activeDay.events.map((event) => {
                      const eventStart = timeline.toDateTime(activeDay.dateISO, event.start);
                      const eventEnd = timeline.toDateTime(activeDay.dateISO, event.end);
                      const isCurrent = now >= eventStart && now < eventEnd;
                      const isPast = now >= eventEnd;
                      return <div key={`${event.start}-${event.end}-${event.title}`} className={`relative mb-6 pl-7 ${isCurrent ? '-ml-2 rounded-r-lg border-l-2 border-[#500608] bg-[#f4f3f3] py-3 pr-3' : ''}`}><div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-[#f9f9f9] ${isCurrent ? 'bg-[#500608]' : 'bg-[#e2e2e2]'}`} /><span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] ${isCurrent ? 'text-[#500608]' : 'text-[#564240]'}`}>{event.start} – {event.end}{isCurrent ? ' · Current' : isPast ? ' · Past' : ''}</span><h5 className={`text-lg leading-snug ${isCurrent ? 'text-[#500608]' : isPast ? 'text-[#1a1c1c]/60' : 'text-[#1a1c1c]'}`} style={headingStyle}>{event.title}</h5></div>;
                    })}
                  </div>
                </>
              ) : <p className="rounded-xl bg-white p-4 text-sm text-[#564240]">The conference schedule has not been configured.</p>}
            </section>

            <section className="space-y-5 lg:col-span-8">
              <div className="rounded-2xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                <h4 className="mb-3 flex items-center gap-2 border-b border-[#dcc0bd]/20 pb-3 text-2xl font-medium text-[#500608]" style={headingStyle}><Megaphone className="h-5 w-5" /> Announcements</h4>
                {updatesLoading ? <div className="text-sm text-[#564240]">Loading live updates…</div> : updates.length > 0 ? <div className="max-h-[560px] min-h-[320px] space-y-3 overflow-y-auto pr-1">{updates.map((update) => <article key={update.updateID} className="rounded-lg border border-[#dcc0bd]/30 bg-[#f4f3f3] p-3"><div className="mb-1 flex items-start justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f2926]">Update</span><span className="text-[11px] text-[#564240]">{new Date(update.time).toLocaleString()}</span></div><p className="text-sm font-semibold text-[#500608]">{update.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{update.content}</p>{update.href ? <img src={update.href} alt={`${update.title} attachment`} className="mt-3 max-h-72 w-full rounded-md object-cover" /> : null}</article>)}</div> : <div className="min-h-[160px] rounded-lg border border-[#dcc0bd]/25 bg-[#f4f3f3] p-4 text-sm text-[#564240]">No announcements published yet.</div>}
              </div>

              <section className="overflow-hidden rounded-2xl border border-[#dcc0bd]/25 bg-white shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                <div className="border-b border-[#dcc0bd]/20 px-4 py-3">
                  <h4 className="flex items-center gap-2 text-2xl font-medium text-[#500608]" style={headingStyle}><Calendar className="h-5 w-5" /> Crisis Briefing</h4>
                  <span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${conference?.crisis_status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#ffdad6] text-[#93000a]'}`}>{conference?.crisis_status === 'published' ? 'Published' : 'Not published'}</span>
                </div>
                <div className="p-4">
                  {conference?.crisis_status === 'published' ? <div className="rounded-xl border border-[#dcc0bd]/30 bg-[#fffdfb] p-5"><h5 className="font-serif text-2xl font-semibold text-[#500608]">{conference.crisis_title || 'Crisis briefing'}</h5>{conference.crisis_content ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1a1c1c]/85">{conference.crisis_content}</p> : null}{conference.crisis_media_url ? <a href={conference.crisis_media_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#6E1D1B] px-4 py-2.5 text-sm font-semibold text-white">Open briefing media <ExternalLink className="h-4 w-4" /></a> : null}</div> : <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-[#dcc0bd]/30 bg-[#e8e8e8] px-4 text-center text-sm text-[#564240]">No crisis briefing is currently published.</div>}
                </div>
              </section>
            </section>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
};

export default Page;

// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo } from 'react';
import { Update } from '@/db/types';
import { ProtectedRoute } from '@/components/protectedroute';
import { Calendar, Megaphone } from 'lucide-react';
import supabase from '@/lib/supabase';

type ScheduleItemType = 'registration' | 'committee' | 'break' | 'ceremony' | 'departure' | 'featured';

type ScheduleItem = {
    label: string;
    title: string;
    start: string;
    end: string;
    type: ScheduleItemType;
};

type ConferenceDay = {
    shortLabel: string;
    label: string;
    dateISO: string;
    events: ScheduleItem[];
};

const conferenceSchedule: ConferenceDay[] = [
    {
        shortLabel: 'Day 1',
        label: 'Friday, June 12',
        dateISO: '2026-06-12',
        events: [
            { label: 'Registration', title: 'Registration/Chair Briefing', start: '13:30', end: '14:00', type: 'registration' },
            { label: 'Ceremony', title: 'Opening Ceremony', start: '14:00', end: '15:00', type: 'ceremony' },
            { label: 'Committee', title: 'Committee Session 1', start: '15:00', end: '16:00', type: 'committee' },
            { label: 'Break', title: 'In-Committee Break', start: '16:00', end: '16:30', type: 'break' },
            { label: 'Committee', title: 'Committee Session 2', start: '16:30', end: '18:30', type: 'committee' },
            { label: 'Departure', title: 'Dispersal', start: '18:30', end: '18:45', type: 'departure' },
        ],
    },
    {
        shortLabel: 'Day 2',
        label: 'Saturday, June 13',
        dateISO: '2026-06-13',
        events: [
            { label: 'Registration', title: 'Registration/Chair Briefing', start: '08:00', end: '08:30', type: 'registration' },
            { label: 'Committee', title: 'Committee Session 3', start: '08:30', end: '10:00', type: 'committee' },
            { label: 'Break', title: 'In-Committee Break', start: '10:00', end: '10:30', type: 'break' },
            { label: 'Committee', title: 'Committee Session 4', start: '10:30', end: '12:00', type: 'committee' },
            { label: 'Break', title: 'Lunch Break (food)', start: '12:00', end: '13:00', type: 'break' },
            { label: 'Committee', title: 'Committee Session 5', start: '13:00', end: '14:45', type: 'committee' },
            { label: 'Break', title: 'Break', start: '14:45', end: '15:00', type: 'break' },
            { label: 'Committee', title: 'Workshops & Seminar/Panel', start: '15:00', end: '17:30', type: 'committee' },
            { label: 'Committee', title: 'Committee Session 6', start: '17:00', end: '18:00', type: 'committee' },
            { label: 'Departure', title: 'Dispersal', start: '18:00', end: '18:15', type: 'departure' },
            { label: 'Featured', title: 'Social Night', start: '18:00', end: '20:00', type: 'featured' },
            { label: 'Featured', title: 'Post-Social Night Dispersal', start: '20:00', end: '20:15', type: 'featured' },
        ],
    },
    {
        shortLabel: 'Day 3',
        label: 'Sunday, June 14',
        dateISO: '2026-06-14',
        events: [
            { label: 'Registration', title: 'Registration/Chair Briefing', start: '08:00', end: '08:30', type: 'registration' },
            { label: 'Committee', title: 'Committee Session 7', start: '08:30', end: '10:00', type: 'committee' },
            { label: 'Break', title: 'In-Committee Break', start: '10:00', end: '10:30', type: 'break' },
            { label: 'Committee', title: 'Committee Session 8', start: '10:30', end: '12:00', type: 'committee' },
            { label: 'Break', title: 'Lunch Break (food)', start: '12:00', end: '13:00', type: 'break' },
            { label: 'Committee', title: 'Committee Session 9', start: '13:00', end: '14:30', type: 'committee' },
            { label: 'Ceremony', title: 'Closing Ceremony', start: '14:30', end: '16:00', type: 'ceremony' },
            { label: 'Departure', title: 'Dispersal', start: '16:00', end: '16:15', type: 'departure' },
        ],
    },
];

const UAE_OFFSET = '+04:00';
const CONFERENCE_START_ISO = `2026-06-12T13:30:00${UAE_OFFSET}`;
const CONFERENCE_END_ISO = `2026-06-14T16:15:00${UAE_OFFSET}`;

const toDateTime = (dateISO: string, time: string) => new Date(`${dateISO}T${time}:00${UAE_OFFSET}`);

const formatDuration = (milliseconds: number) => {
    const clamped = Math.max(0, milliseconds);
    const totalSeconds = Math.floor(clamped / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hhmmss = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return days > 0 ? `${days}d ${hhmmss}` : hhmmss;
};

const Page = () => {
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [updates, setUpdates] = React.useState<Update[]>([]);
    const [now, setNow] = React.useState<Date>(new Date());

    const headingStyle: React.CSSProperties = { fontFamily: "'Newsreader', serif" };

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                setIsLoading(true);
                const { data, error } = await supabase.from('Updates').select('*').order('time', { ascending: false });
                if (error) {
                    console.error('Failed to fetch updates:', error);
                    return;
                }
                if (data) setUpdates(data);
            } catch (error) {
                console.error('Error fetching updates:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUpdates();

        const updatesChannel = supabase
            .channel('live-updates-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Updates' }, () => {
                fetchUpdates();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(updatesChannel);
        };
    }, []);

    const timeline = useMemo(() => {
        const allEvents = conferenceSchedule
            .flatMap((day, dayIndex) =>
                day.events.map((event) => ({
                    ...event,
                    dayIndex,
                    startDate: toDateTime(day.dateISO, event.start),
                    endDate: toDateTime(day.dateISO, event.end),
                })),
            )
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        const conferenceStart = new Date(CONFERENCE_START_ISO);
        const conferenceEnd = new Date(CONFERENCE_END_ISO);
        const isConferenceWindow = now >= conferenceStart && now <= conferenceEnd;
        const currentEvent = isConferenceWindow ? allEvents.find((event) => now >= event.startDate && now < event.endDate) ?? null : null;
        const nextEvent = allEvents.find((event) => event.startDate > now) ?? null;
        const isConferenceCompleted = now > conferenceEnd;

        const activeDayIndex = isConferenceWindow
            ? conferenceSchedule.findIndex((day) => now >= toDateTime(day.dateISO, '00:00') && now <= toDateTime(day.dateISO, '23:59'))
            : 0;

        return {
            isConferenceWindow,
            currentEvent,
            nextEvent,
            isConferenceCompleted,
            conferenceEnd,
            activeDayIndex: activeDayIndex === -1 ? 0 : activeDayIndex,
        };
    }, [now]);

    const activeDay = conferenceSchedule[timeline.activeDayIndex];

    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="mx-auto w-full max-w-[1600px] space-y-10 px-6 py-8 pt-20 lg:px-8 lg:pt-24">
                    <section className="space-y-4">
                        <h1
                          className="text-4xl !font-semibold tracking-tight text-[#500608]"
                          style={headingStyle}>
                          Session Status
                        </h1>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#564240]">Current Session</span>
                                <h4 className="text-[30px] leading-tight text-[#500608] !font-medium" style={headingStyle}>
                                    {timeline.currentEvent ? timeline.currentEvent.title : timeline.isConferenceCompleted ? 'Conference completed' : 'Conference not started'}
                                </h4>
                          </div>
                            <div className="rounded-xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#564240]">Starts Next</span>
                                <span className="text-[30px] leading-tight text-[#500608]" style={headingStyle}>
                                    {timeline.nextEvent ? formatDuration(timeline.nextEvent.startDate.getTime() - now.getTime()) : 'Conference completed'}
                                </span>
                                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#564240]">
                                    {timeline.nextEvent ? `Until ${timeline.nextEvent.title}` : 'No upcoming sessions'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#564240]">Conference End</span>
                                <span className="text-[30px] leading-tight text-[#500608]" style={headingStyle}>
                                    {timeline.isConferenceCompleted ? 'Conference completed' : formatDuration(timeline.conferenceEnd.getTime() - now.getTime())}
                                </span>
                                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#564240]">Until final dispersal</p>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
                        <section className="space-y-5 lg:col-span-4">
                            <div className="flex items-center justify-between border-b border-[#dcc0bd]/30 pb-3">
                                <h2 className="text-2xl font-semibold text-[#1a1c1c]" style={headingStyle}>Daily Schedule</h2>
                                <span className="rounded-md bg-[#eee0d5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#211a14]">{activeDay.shortLabel}</span>
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#564240]">{activeDay.label}</p>
                            <div className="relative ml-2 border-l-2 border-[#e2e2e2] py-1">
                                {activeDay.events.map((event) => {
                                    const eventStart = toDateTime(activeDay.dateISO, event.start);
                                    const eventEnd = toDateTime(activeDay.dateISO, event.end);
                                    const isCurrent = timeline.isConferenceWindow && now >= eventStart && now < eventEnd;
                                    const isPast = timeline.isConferenceWindow && now >= eventEnd;

                                    return (
                                        <div key={`${event.start}-${event.title}`} className={`relative mb-6 pl-7 ${isCurrent ? '-ml-2 rounded-r-lg border-l-2 border-[#500608] bg-[#f4f3f3] py-3 pr-3' : ''}`}>
                                            <div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-[#f9f9f9] ${isCurrent ? 'bg-[#500608]' : 'bg-[#e2e2e2]'}`} />
                                            <span className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] ${isCurrent ? 'text-[#500608]' : 'text-[#564240]'}`}>
                                                {event.start} - {event.end}{isCurrent ? ' (CURRENT)' : isPast ? ' (PAST)' : ''}
                                            </span>
                                            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#564240]">{event.label}</p>
                                            <h3 className={`text-lg leading-snug ${isCurrent ? 'text-[#500608]' : isPast ? 'text-[#1a1c1c]/60' : 'text-[#1a1c1c]'}`} style={headingStyle}>{event.title}</h3>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="space-y-5 lg:col-span-8">
                            <div className="rounded-2xl border border-[#dcc0bd]/25 bg-white p-5 shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                                <h3 className="mb-3 flex items-center gap-2 border-b border-[#dcc0bd]/20 pb-3 text-2xl font-medium text-[#500608]" style={headingStyle}>
                                    <Megaphone className="h-5 w-5" /> Announcements
                                </h3>
                                {isLoading ? (
                                    <div className="text-sm text-[#564240]">Loading live updates...</div>
                                ) : updates.length > 0 ? (
                                    <div className="max-h-[560px] min-h-[320px] space-y-3 overflow-y-auto pr-1">
                                        {updates.map((update) => (
                                            <div key={update.updateID} className="rounded-lg border border-[#dcc0bd]/30 bg-[#f4f3f3] p-3">
                                                <div className="mb-1 flex items-start justify-between gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f2926]">Update</span>
                                                    <span className="text-[11px] text-[#564240]">{new Date(update.time).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-[#500608]">{update.title}</p>
                                                <p className="mt-1 text-sm leading-relaxed text-[#1a1c1c]">{update.content}</p>
                                                {update.href ? <img src={update.href} alt={`Update ${update.updateID} attachment`} className="mt-3 max-h-72 w-full rounded-md object-cover" /> : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="min-h-[160px] rounded-lg border border-[#dcc0bd]/25 bg-[#f4f3f3] p-4 text-sm text-[#564240]">No announcements published yet.</div>
                                )}
                            </div>

                            <section className="overflow-hidden rounded-2xl border border-[#dcc0bd]/25 bg-white shadow-[0_8px_24px_rgba(26,28,28,0.05)]">
                                <div className="border-b border-[#dcc0bd]/20 bg-[#f4f3f3] px-4 py-3">
                                    <h2 className="flex items-center gap-2 text-lg font-semibold text-[#500608]" style={headingStyle}>
                                        <Calendar className="h-4 w-4" /> Crisis Briefing
                                    </h2>
                                    <span className="mt-2 inline-flex rounded-md bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#93000a]">Not Published</span>
                                </div>
                                <div className="p-4">
                                    <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-[#dcc0bd]/30 bg-[#e8e8e8] px-4 text-center text-sm text-[#564240]">
                                        No crisis briefing media is currently published.
                                    </div>
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

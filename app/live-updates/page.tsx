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

const toDateTime = (dateISO: string, time: string) => new Date(`${dateISO}T${time}:00`);

const formatDuration = (milliseconds: number) => {
    const clamped = Math.max(0, milliseconds);
    const totalSeconds = Math.floor(clamped / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const Page = () => {
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [updates, setUpdates] = React.useState<Update[]>([]);
    const [now, setNow] = React.useState<Date>(new Date());
    const [selectedDay, setSelectedDay] = React.useState<number>(0);

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
            .flatMap((day) => day.events.map((event) => ({ ...event, startDate: toDateTime(day.dateISO, event.start), endDate: toDateTime(day.dateISO, event.end) })))
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        const isConferenceWindow = now >= toDateTime('2026-06-12', '00:00') && now <= toDateTime('2026-06-14', '23:59');
        const currentEvent = isConferenceWindow ? allEvents.find((event) => now >= event.startDate && now < event.endDate) ?? null : null;
        const nextEvent = allEvents.find((event) => event.startDate > now) ?? null;
        return { isConferenceWindow, currentEvent, nextEvent };
    }, [now]);

    const activeDay = conferenceSchedule[selectedDay];

    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="mx-auto max-w-7xl space-y-16 px-6 py-12 pt-24 lg:pt-28">
                    <section className="space-y-6">
                        <h1 className="text-4xl font-semibold tracking-tight text-[#500608]" style={headingStyle}>Session Status</h1>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="relative overflow-hidden rounded-xl bg-white p-8 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <span className="mb-2 block text-sm uppercase tracking-widest text-[#564240]">Current Session</span>
                                <h2 className="text-2xl font-medium leading-tight text-[#500608]" style={headingStyle}>{timeline.currentEvent ? timeline.currentEvent.title : 'Schedule Published'}</h2>
                            </div>
                            <div className="rounded-xl bg-white p-8 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <span className="mb-2 block text-sm uppercase tracking-widest text-[#564240]">Starts Next</span>
                                <div className="flex items-baseline space-x-2">
                                    <span className="text-4xl font-bold text-[#500608]" style={headingStyle}>{timeline.isConferenceWindow && timeline.nextEvent ? formatDuration(timeline.nextEvent.startDate.getTime() - now.getTime()) : 'Jun 12, 13:30'}</span>
                                </div>
                            </div>
                            <div className="rounded-xl bg-white p-8 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <span className="mb-2 block text-sm uppercase tracking-widest text-[#564240]">Conference End</span>
                                <div className="flex items-baseline space-x-2">
                                    <span className="text-4xl font-bold text-[#500608]" style={headingStyle}>Jun 14, 16:15</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
                        <section className="space-y-8 lg:col-span-4">
                            <div className="flex items-center justify-between border-b border-[#dcc0bd]/30 pb-4">
                                <h2 className="text-2xl font-semibold text-[#1a1c1c]" style={headingStyle}>Daily Schedule</h2>
                                <span className="rounded-md bg-[#eee0d5] px-3 py-1 text-xs uppercase tracking-wider text-[#211a14]">{activeDay.shortLabel}</span>
                            </div>
                            <div className="flex gap-2">
                                {conferenceSchedule.map((day, index) => (
                                    <button key={day.shortLabel} type="button" onClick={() => setSelectedDay(index)} className={`rounded-md px-3 py-1 text-xs uppercase tracking-wider ${selectedDay === index ? 'bg-[#500608] text-white' : 'bg-[#f4f3f3] text-[#564240]'}`}>
                                        {day.shortLabel}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#564240]">{activeDay.label}</p>
                            <div className="relative ml-3 space-y-10 border-l-2 border-[#e2e2e2] py-2">
                                {activeDay.events.map((event) => (
                                    <div key={`${event.start}-${event.title}`} className="relative pl-8">
                                        <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-[#f9f9f9] bg-[#e2e2e2]" />
                                        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#564240]">{event.start} - {event.end} · {event.label}</span>
                                        <h3 className="text-lg font-medium text-[#1a1c1c]" style={headingStyle}>{event.title}</h3>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 items-start gap-8 lg:col-span-8 lg:grid-cols-8">
                            <section className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(26,28,28,0.06)] lg:col-span-5">
                                <h3 className="mb-4 flex items-center gap-2 border-b border-[#dcc0bd]/20 pb-4 text-xl font-medium text-[#500608]" style={headingStyle}>
                                    <Megaphone className="h-5 w-5" /> Announcements
                                </h3>
                                {isLoading ? (
                                    <div className="text-sm text-[#564240]">Loading live updates...</div>
                                ) : updates.length > 0 ? (
                                    <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
                                        {updates.map((update) => (
                                            <div key={update.updateID} className="rounded-lg border border-[#dcc0bd]/30 bg-[#f9f9f9] p-4">
                                                <div className="mb-1 flex items-start justify-between gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-widest text-[#7f2926]">Update</span>
                                                    <span className="text-xs text-[#564240]">{new Date(update.time).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-[#500608]">{update.title}</p>
                                                <p className="mt-1 text-sm leading-relaxed text-[#1a1c1c]">{update.content}</p>
                                                {update.href ? <img src={update.href} alt={`Update ${update.updateID} attachment`} className="mt-3 max-h-72 w-full rounded-md object-cover" /> : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg bg-[#f4f3f3] p-4 text-sm text-[#564240]">No announcements published yet.</div>
                                )}
                            </section>

                            <section className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_32px_rgba(26,28,28,0.06)] lg:col-span-3">
                                <div className="border-b border-[#dcc0bd]/20 bg-[#f4f3f3] px-4 py-3">
                                    <h2 className="flex items-center gap-2 text-lg font-semibold text-[#500608]" style={headingStyle}>
                                        <Calendar className="h-4 w-4" /> Chair Briefing
                                    </h2>
                                    <span className="mt-2 inline-flex rounded-md bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#93000a]">Not Published</span>
                                </div>
                                <div className="p-4">
                                    <div className="rounded-lg bg-[#f4f3f3] p-4 text-sm text-[#564240]">No chair briefing is currently published.</div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
};

export default Page;

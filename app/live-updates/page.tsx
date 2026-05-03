// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo } from 'react';
import { Update } from '@/db/types';
import { ProtectedRoute } from '@/components/protectedroute';
import { motion } from 'framer-motion';
import { Calendar, Clock, Megaphone } from 'lucide-react';
import supabase from '@/lib/supabase';

type ScheduleItemType = 'registration' | 'committee' | 'break' | 'ceremony' | 'departure' | 'featured';

type ScheduleItem = {
    title: string;
    start: string;
    end: string;
    type: ScheduleItemType;
};

type ConferenceDay = {
    label: string;
    dateISO: string;
    events: ScheduleItem[];
};

const conferenceSchedule: ConferenceDay[] = [
    {
        label: 'Day 1 - Friday, June 12',
        dateISO: '2026-06-12',
        events: [
            { title: 'Registration/Chair Briefing', start: '13:30', end: '14:00', type: 'registration' },
            { title: 'Opening Ceremony', start: '14:00', end: '15:00', type: 'ceremony' },
            { title: 'Committee Session 1', start: '15:00', end: '16:00', type: 'committee' },
            { title: 'In-Committee Break', start: '16:00', end: '16:30', type: 'break' },
            { title: 'Committee Session 2', start: '16:30', end: '18:30', type: 'committee' },
            { title: 'Dispersal', start: '18:30', end: '18:45', type: 'departure' },
        ],
    },
    {
        label: 'Day 2 - Saturday, June 13',
        dateISO: '2026-06-13',
        events: [
            { title: 'Registration/Chair Briefing', start: '08:00', end: '08:30', type: 'registration' },
            { title: 'Committee Session 3', start: '08:30', end: '10:00', type: 'committee' },
            { title: 'In-Committee Break', start: '10:00', end: '10:30', type: 'break' },
            { title: 'Committee Session 4', start: '10:30', end: '12:00', type: 'committee' },
            { title: 'Lunch Break (food)', start: '12:00', end: '13:00', type: 'break' },
            { title: 'Committee Session 5', start: '13:00', end: '14:45', type: 'committee' },
            { title: 'Break', start: '14:45', end: '15:00', type: 'break' },
            { title: 'Workshops & Seminar/Panel', start: '15:00', end: '17:30', type: 'committee' },
            { title: 'Committee Session 6', start: '17:00', end: '18:00', type: 'committee' },
            { title: 'Dispersal', start: '18:00', end: '18:15', type: 'departure' },
            { title: 'Social Night', start: '18:00', end: '20:00', type: 'featured' },
            { title: 'Post-Social Night Dispersal', start: '20:00', end: '20:15', type: 'featured' },
        ],
    },
    {
        label: 'Day 3 - Sunday, June 14',
        dateISO: '2026-06-14',
        events: [
            { title: 'Registration/Chair Briefing', start: '08:00', end: '08:30', type: 'registration' },
            { title: 'Committee Session 7', start: '08:30', end: '10:00', type: 'committee' },
            { title: 'In-Committee Break', start: '10:00', end: '10:30', type: 'break' },
            { title: 'Committee Session 8', start: '10:30', end: '12:00', type: 'committee' },
            { title: 'Lunch Break (food)', start: '12:00', end: '13:00', type: 'break' },
            { title: 'Committee Session 9', start: '13:00', end: '14:30', type: 'committee' },
            { title: 'Closing Ceremony', start: '14:30', end: '16:00', type: 'ceremony' },
            { title: 'Dispersal', start: '16:00', end: '16:15', type: 'departure' },
        ],
    },
];

const typeStyle: Record<ScheduleItemType, string> = {
    registration: 'bg-[#eee0d5] text-[#2b231d]',
    ceremony: 'bg-[#ffdad6] text-[#7f2926]',
    committee: 'bg-[#e2e2e2] text-[#1a1c1c]',
    break: 'bg-[#f4f3f3] text-[#564240]',
    departure: 'bg-[#dcc0bd] text-[#4e453d]',
    featured: 'bg-[#ffb3ad] text-[#500608]',
};

const formatClock = (value: string) => value;
const toDateTime = (dateISO: string, time: string) => new Date(`${dateISO}T${time}:00`);

const formatDuration = (milliseconds: number) => {
    const clamped = Math.max(0, milliseconds);
    const totalMinutes = Math.floor(clamped / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
        const todayIndex = conferenceSchedule.findIndex((day) => day.dateISO === new Date().toISOString().slice(0, 10));
        setSelectedDay(todayIndex >= 0 ? todayIndex : 0);
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
            .flatMap((day) =>
                day.events.map((event) => ({
                    ...event,
                    dayLabel: day.label,
                    dateISO: day.dateISO,
                    startDate: toDateTime(day.dateISO, event.start),
                    endDate: toDateTime(day.dateISO, event.end),
                }))
            )
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        const isConferenceWindow = now >= toDateTime('2026-06-12', '00:00') && now <= toDateTime('2026-06-14', '23:59');
        const currentEvent = isConferenceWindow ? allEvents.find((event) => now >= event.startDate && now < event.endDate) ?? null : null;
        const nextEvent = allEvents.find((event) => event.startDate > now) ?? null;
        const lastEvent = allEvents[allEvents.length - 1] ?? null;

        return { allEvents, currentEvent, nextEvent, lastEvent, isConferenceWindow };
    }, [now]);

    const activeDay = conferenceSchedule[selectedDay];

    return (
        <ProtectedRoute>
            <main className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-10 lg:px-8">
                    <section className="space-y-6">
                        <h1 className="text-4xl font-semibold text-[#500608]" style={headingStyle}>Session Status</h1>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="rounded-xl bg-white p-6 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#564240]">Current Session</p>
                                <h2 className="mt-2 text-2xl font-medium text-[#500608]" style={headingStyle}>
                                    {timeline.currentEvent ? timeline.currentEvent.title : 'Conference schedule published'}
                                </h2>
                            </div>
                            <div className="rounded-xl bg-white p-6 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#564240]">Starts Next</p>
                                <p className="mt-2 text-2xl font-semibold text-[#500608]" style={headingStyle}>
                                    {timeline.isConferenceWindow && timeline.nextEvent ? formatDuration(timeline.nextEvent.startDate.getTime() - now.getTime()) : 'Registration opens Jun 12, 13:30'}
                                </p>
                                <p className="mt-1 text-sm text-[#564240]">
                                    {timeline.isConferenceWindow && timeline.nextEvent ? `Until ${timeline.nextEvent.title}` : 'Conference schedule published.'}
                                </p>
                            </div>
                            <div className="rounded-xl bg-white p-6 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#564240]">Conference End</p>
                                <p className="mt-2 text-2xl font-semibold text-[#500608]" style={headingStyle}>
                                    {timeline.isConferenceWindow && timeline.lastEvent ? formatDuration(timeline.lastEvent.endDate.getTime() - now.getTime()) : 'Jun 14, 16:15'}
                                </p>
                                <p className="mt-1 text-sm text-[#564240]">Final dispersal target.</p>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
                        <section className="space-y-5 lg:col-span-4">
                            <div className="flex items-center justify-between border-b border-[#dcc0bd]/50 pb-3">
                                <h2 className="text-2xl font-semibold" style={headingStyle}>Daily Schedule</h2>
                                <span className="rounded-md bg-[#eee0d5] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#211a14]">Conference schedule published</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {conferenceSchedule.map((day, index) => (
                                    <button
                                        key={day.label}
                                        type="button"
                                        onClick={() => setSelectedDay(index)}
                                        className={`rounded-lg border px-2 py-2 text-left text-xs font-semibold ${selectedDay === index ? 'border-[#500608] bg-white text-[#500608]' : 'border-[#dcc0bd] text-[#564240]'}`}
                                    >
                                        {day.label.split(' - ')[0]}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#564240]">{activeDay.label}</p>
                            <div className="relative ml-3 space-y-4 border-l-2 border-[#e2e2e2] py-1">
                                {activeDay.events.map((event) => (
                                    <article key={`${event.title}-${event.start}`} className="relative pl-6">
                                        <div className="absolute -left-[7px] top-2 h-3 w-3 rounded-full border-2 border-[#f9f9f9] bg-white" />
                                        <div className="mb-1 flex items-center gap-2">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#564240]">{formatClock(event.start)} - {formatClock(event.end)}</p>
                                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${typeStyle[event.type]}`}>{event.type}</span>
                                        </div>
                                        <h3 className="text-base text-[#1a1c1c]" style={headingStyle}>{event.title}</h3>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <div className="lg:col-span-8 grid grid-cols-1 lg:grid-cols-8 gap-8 items-start">
                            <section className="lg:col-span-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <div className="mb-4 flex items-center gap-3 border-b border-[#dcc0bd]/30 pb-4">
                                    <div className="rounded-lg bg-[#6e1d1b]/10 p-2 text-[#500608]"><Megaphone className="h-5 w-5" /></div>
                                    <h2 className="text-2xl font-semibold text-[#500608]" style={headingStyle}>Announcements</h2>
                                </div>
                                {isLoading ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-[#564240]">
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#500608] border-t-transparent" />
                                        Loading live updates...
                                    </motion.div>
                                ) : updates.length > 0 ? (
                                    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                                        {updates.map((update) => (
                                            <div key={update.updateID} className="rounded-lg border border-[#e2e2e2] bg-[#ffffff] p-4">
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7f2926]">System Update</p>
                                                    <p className="text-xs text-[#564240]">{new Date(update.time).toLocaleString()}</p>
                                                </div>
                                                <h3 className="text-lg font-medium text-[#500608]" style={headingStyle}>{update.title}</h3>
                                                <p className="mt-2 text-sm leading-relaxed text-[#1a1c1c]">{update.content}</p>
                                                {update.href ? (
                                                    <div className="mt-3 overflow-hidden rounded-lg border border-[#e2e2e2]"><img src={update.href} alt={`Update ${update.updateID} attachment`} className="max-h-72 w-full object-cover" /></div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-[#dcc0bd] bg-[#f4f3f3] p-6 text-sm text-[#564240]">No announcements published yet.</div>
                                )}
                            </section>

                            <section className="lg:col-span-3 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
                                <div className="mb-3 flex items-center gap-3 border-b border-[#dcc0bd]/30 pb-3">
                                    <div className="rounded-lg bg-[#eee0d5] p-2 text-[#500608]"><Calendar className="h-5 w-5" /></div>
                                    <h2 className="text-xl font-semibold text-[#500608]" style={headingStyle}>Chair Briefing</h2>
                                </div>
                                <p className="text-sm leading-relaxed text-[#564240]">No chair briefing is currently published.</p>
                                <p className="mt-3 inline-flex items-center gap-2 text-xs text-[#564240]"><Clock className="h-4 w-4" />Last checked in realtime from the Updates feed.</p>
                            </section>
                        </div>
                    </div>
                </div>
            </main>
        </ProtectedRoute>
    );
};

export default Page;

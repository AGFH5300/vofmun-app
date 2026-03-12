// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo } from 'react';
import { Update } from '@/db/types';
import { ProtectedRoute } from '@/components/protectedroute';
import { motion } from 'framer-motion';
import { Bell, Clock, Clock3, AlertTriangle } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';

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

type ScheduleRow = {
    time: string;
    event: string;
};

type ScheduleDay = {
    title: string;
    rows: ScheduleRow[];
};

const conferenceSchedule: ConferenceDay[] = [
    {
        label: 'DAY 1 - Friday',
        dateISO: '2026-04-03',
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
        label: 'DAY 2 - Saturday',
        dateISO: '2026-04-04',
        events: [
            { title: 'Registration/Chair Briefing', start: '08:00', end: '08:30', type: 'registration' },
            { title: 'Committee Session 3', start: '08:30', end: '10:00', type: 'committee' },
            { title: 'In-Committee Break', start: '10:00', end: '10:30', type: 'break' },
            { title: 'Committee Session 4', start: '10:30', end: '12:00', type: 'committee' },
            { title: 'Lunch Break (food)', start: '12:00', end: '13:00', type: 'break' },
            { title: 'Committee Session 5', start: '13:00', end: '14:45', type: 'committee' },
            { title: 'Break', start: '14:45', end: '15:00', type: 'break' },
            { title: 'Workshop (Group 1) / Committee Session 6 (Group 2)', start: '15:00', end: '16:30', type: 'committee' },
            { title: 'Workshop (Group 2) / Committee Session 6 (Group 1)', start: '16:30', end: '18:00', type: 'committee' },
            { title: 'Dispersal', start: '18:00', end: '18:15', type: 'departure' },
            { title: 'Social Night', start: '18:00', end: '20:00', type: 'featured' },
            { title: 'Post-Social Dispersal', start: '20:00', end: '20:15', type: 'departure' },
        ],
    },
    {
        label: 'DAY 3 - Sunday',
        dateISO: '2026-04-05',
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

const formatClock = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const toDateTime = (dateISO: string, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date(`${dateISO}T00:00:00`);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

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

const getEventStyle = (event: string) => {
    const normalizedEvent = event.toLowerCase();

    if (normalizedEvent.includes('night')) {
        return {
            label: 'Featured',
            ringColor: 'ring-fuchsia-300/70',
            bgColor: 'bg-fuchsia-50',
            badgeColor: 'bg-fuchsia-100 text-fuchsia-700',
        };
    }

    if (normalizedEvent.includes('ceremony')) {
        return {
            label: 'Ceremony',
            ringColor: 'ring-amber-300/70',
            bgColor: 'bg-amber-50',
            badgeColor: 'bg-amber-100 text-amber-700',
        };
    }

    if (normalizedEvent.includes('break') || normalizedEvent.includes('lunch')) {
        return {
            label: 'Break',
            ringColor: 'ring-lime-300/70',
            bgColor: 'bg-lime-50',
            badgeColor: 'bg-lime-100 text-lime-700',
        };
    }

    if (normalizedEvent.includes('committee') || normalizedEvent.includes('workshop')) {
        return {
            label: 'Committee',
            ringColor: 'ring-blue-300/70',
            bgColor: 'bg-blue-50',
            badgeColor: 'bg-blue-100 text-blue-700',
        };
    }

    if (normalizedEvent.includes('registration') || normalizedEvent.includes('chair')) {
        return {
            label: 'Registration',
            ringColor: 'ring-violet-300/70',
            bgColor: 'bg-violet-50',
            badgeColor: 'bg-violet-100 text-violet-700',
        };
    }

    return {
        label: 'Departure',
        ringColor: 'ring-slate-300/70',
        bgColor: 'bg-slate-50',
        badgeColor: 'bg-slate-100 text-slate-700',
    };
};

const Page = () => {
    const brandDarkRed = '#701e1e';
    const serifHeadingFont = "var(--font-dm-serif-display, 'DM Serif Display', serif)";
    const heroHeadingStyle: React.CSSProperties = {
        color: '#FFFFFF',
        fontFamily: serifHeadingFont,
    };
    const accentHeadingStyle: React.CSSProperties = {
        color: brandDarkRed,
        fontFamily: serifHeadingFont,
    };
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [updates, setUpdates] = React.useState<Update[]>([]);
    const [now, setNow] = React.useState<Date>(new Date());
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const dateString = now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const scheduleByDay: ScheduleDay[] = conferenceSchedule.map((day) => ({
        title: day.label,
        rows: day.events.map((event) => ({
            time: `${formatClock(event.start)} - ${formatClock(event.end)}`,
            event: event.title,
        })),
    }));

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

                if (data) {
                    setUpdates(data);
                }
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

        const currentEvent = allEvents.find((event) => now >= event.startDate && now < event.endDate) ?? null;
        const nextEvent = allEvents.find((event) => event.startDate > now) ?? null;
        const lastEvent = allEvents[allEvents.length - 1] ?? null;

        return { allEvents, currentEvent, nextEvent, lastEvent };
    }, [now]);

    return (
        <ProtectedRoute>
            <div className="page-shell">
                <div className="page-maxwidth space-y-12">
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        className="surface-card is-emphasised overflow-hidden"
                    >
                        <div className="relative px-8 py-12 md:px-12">
                            <div className="flex flex-col items-center text-center gap-6">
                                <span className="badge-pill bg-white/15 text-white/80">
                                    <Bell size={18} /> Real-time feed + schedule linked
                                </span>
                                <h1 className="text-4xl md:text-5xl font-serif font-bold text-white leading-tight" style={heroHeadingStyle}>
                                    Live Crisis Updates
                                </h1>
                                <p className="text-base md:text-lg text-white/85 max-w-3xl leading-relaxed">
                                    Every update is now tied to the conference timeline so delegates can instantly see what is happening now, what starts next (including lunch), and how long remains until the conference ends.
                                </p>
                            </div>
                            <div className="absolute inset-x-0 -bottom-32 h-64 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.05 }}
                        className="surface-card p-6 md:p-8"
                    >
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-deep-red mb-1" style={accentHeadingStyle}>
                                        Conference Timeline Overview
                                    </h2>
                                    <p className="text-sm text-almost-black-green/70">Auto-updates in real time.</p>
                                </div>
                                <span className="badge-pill bg-deep-red/10 text-deep-red">
                                    <Clock size={16} /> {dateString} · {timeString}
                                </span>
                            </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-blue-700/80">Happening now</p>
                                <p className="mt-2 font-semibold text-lg text-blue-900">{timeline.currentEvent ? timeline.currentEvent.title : 'No active session right now'}</p>
                                <p className="text-sm text-blue-800 mt-1">
                                    {timeline.currentEvent
                                        ? `${timeline.currentEvent.dayLabel} · ${formatClock(timeline.currentEvent.start)} - ${formatClock(timeline.currentEvent.end)}`
                                        : 'Waiting for the next scheduled item.'}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-amber-700/80">Starts next</p>
                                <p className="mt-2 font-semibold text-lg text-amber-900">{timeline.nextEvent ? timeline.nextEvent.title : 'Schedule complete'}</p>
                                <p className="text-sm text-amber-800 mt-1">
                                    {timeline.nextEvent
                                        ? `${timeline.nextEvent.dayLabel} in ${formatDuration(timeline.nextEvent.startDate.getTime() - now.getTime())}`
                                        : 'No upcoming sessions.'}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-rose-700/80">Until conference end</p>
                                <p className="mt-2 font-semibold text-lg text-rose-900">
                                    {timeline.lastEvent ? formatDuration(timeline.lastEvent.endDate.getTime() - now.getTime()) : 'N/A'}
                                </p>
                                <p className="text-sm text-rose-800 mt-1">Until final dispersal closes.</p>
                            </div>
                        </div>

                        <Card className="mt-6 diplomatic-shadow border-[#B22222]/10 bg-white/85 backdrop-blur-sm">
                            <CardContent className="space-y-6 px-3 pb-8 pt-4 sm:px-6">
                                <div className="grid gap-4 lg:grid-cols-3">
                                    {scheduleByDay.map((day) => (
                                        <div key={day.title} className="overflow-hidden rounded-2xl border border-[#B22222]/20 bg-white/80 shadow-sm">
                                            <div className="bg-gradient-to-r from-[#B22222] to-[#8f1818] px-4 py-3">
                                                <h3 className="text-center text-lg font-bold tracking-wide text-white">{day.title}</h3>
                                            </div>

                                            <div className="space-y-2 p-3">
                                                {day.rows.map((row) => {
                                                    const eventStyle = getEventStyle(row.event);

                                                    return (
                                                        <article
                                                            key={`${day.title}-${row.time}-${row.event}`}
                                                            className={`rounded-lg border border-slate-200/80 p-2.5 ring-1 ${eventStyle.ringColor} ${eventStyle.bgColor}`}
                                                        >
                                                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${eventStyle.badgeColor}`}>
                                                                    {eventStyle.label}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8f1818]">
                                                                    <Clock3 className="h-3.5 w-3.5" />
                                                                    {row.time}
                                                                </span>
                                                            </div>

                                                            <p className="text-sm font-medium text-slate-700">{row.event}</p>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.section>

                    <section>
                        {isLoading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="surface-card flex flex-col items-center justify-center py-16">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-deep-red to-dark-burgundy mb-6">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                                </div>
                                <p className="text-lg text-almost-black-green/75">Fetching the latest intelligence...</p>
                            </motion.div>
                        ) : (
                            <div className="space-y-8">
                                {updates.length > 0 ? (
                                    updates.map((update, index) => (
                                        <motion.article
                                            key={update.updateID}
                                            initial={{ opacity: 0, y: 18 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.55, delay: index * 0.1 }}
                                            className="surface-card overflow-hidden"
                                        >
                                            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                                                <div className="p-7 md:p-9">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <span className="inline-flex items-center gap-2 rounded-full bg-soft-rose/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-deep-red">
                                                            <AlertTriangle size={16} /> Crisis Alert
                                                        </span>
                                                        <span className="text-sm text-almost-black-green/60 flex items-center gap-2">
                                                            <Clock size={16} />
                                                            {new Date(update.time).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <h2 className="text-2xl md:text-3xl font-serif font-semibold text-deep-red mb-4" style={accentHeadingStyle}>
                                                        {update.title}
                                                    </h2>
                                                    <p className="text-almost-black-green/80 leading-relaxed text-base md:text-lg">{update.content}</p>

                                                    <div className="mt-6 rounded-xl border border-rich-gold/30 bg-soft-ivory/80 p-4">
                                                        <div className="flex items-start gap-3">
                                                            <AlertTriangle className="h-5 w-5 text-rich-gold mt-0.5" />
                                                            <p className="text-sm text-almost-black-green/80">
                                                                <strong className="text-deep-red">Immediate Action Required:</strong> Respond within the next session. Coordinate with your bloc to craft directives and notify the dais once complete.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    {update.href ? (
                                                        <div className="h-full min-h-[240px]">
                                                            <img src={update.href} alt={`Update ${update.updateID} illustration`} className="h-full w-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-full min-h-[240px] bg-gradient-to-br from-soft-ivory via-primary-peach to-soft-rose flex items-center justify-center">
                                                            <div className="text-center p-6 text-almost-black-green/70">
                                                                <AlertTriangle size={40} className="mx-auto mb-4 text-deep-red/60" />
                                                                <p className="text-sm uppercase tracking-[0.3em]">Awaiting imagery</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.article>
                                    ))
                                ) : (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="surface-card text-center py-16 px-6">
                                        <div className="w-20 h-20 bg-soft-ivory rounded-full flex items-center justify-center mx-auto mb-6 border border-soft-rose">
                                            <Bell size={32} className="text-deep-red" />
                                        </div>
                                        <h3 className="text-2xl font-serif font-semibold text-deep-red mb-3" style={accentHeadingStyle}>
                                            All Clear for Now
                                        </h3>
                                        <p className="text-almost-black-green/75 max-w-2xl mx-auto leading-relaxed">
                                            The conference is currently stable. Check back frequently-urgent alerts will appear here with actionable guidance the moment situations escalate.
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </ProtectedRoute>
    );
};

export default Page;

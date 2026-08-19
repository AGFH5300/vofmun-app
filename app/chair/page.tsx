// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Gavel,
  ListOrdered,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  UserCheck,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChairRoute } from '@/components/protectedroute';
import { withBrowserAuthHeaders } from '@/lib/auth/browserAuthFetch';
import {
  ATTENDANCE_STATUSES,
  AWARD_STATUSES,
  CHAIR_MODES,
  SCORE_KINDS,
  SPEAKER_LISTS,
  TALLY_KINDS,
  effectiveTimerRemaining,
  type AttendanceStatus,
  type AwardStatus,
  type ChairSessionState,
  type ChairTimer,
  type ScoreKind,
  type SpeakerListKind,
  type TallyKind,
  type VoteChoice,
} from '@/lib/chair/operations';

type ResolutionPermissions = {
  'view:ownreso': boolean;
  'view:allreso': boolean;
  'update:ownreso': boolean;
  'update:reso': string[];
};

type ChairDelegate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string | null;
  school: string | null;
  grade: string | null;
  resoPerms: ResolutionPermissions;
  attendance: AttendanceStatus;
  tallies: Record<TallyKind, number>;
  scores: Record<ScoreKind, number>;
  notes: string;
  awardStatus: AwardStatus;
  metricsUpdatedAt: string | null;
};

type Dashboard = {
  committee: {
    committeeID: string;
    committeeCode: string;
    name: string;
    fullname: string;
  };
  session: {
    id: string;
    session_number: number;
    title: string;
    status: string;
    state: ChairSessionState;
    version: number;
    updated_at: string;
  };
  delegates: ChairDelegate[];
  matrix: {
    id: string;
    country: string;
    sortOrder: number;
    delegates: ChairDelegate[];
  }[];
  unmappedDelegates: ChairDelegate[];
  syncedAt: string;
};

type ChairTab = 'session' | 'delegates' | 'scoring' | 'motions' | 'permissions';
type BooleanPermission = 'view:ownreso' | 'view:allreso' | 'update:ownreso';
type AssessmentDraft = {
  scores: Record<ScoreKind, number>;
  notes: string;
  awardStatus: AwardStatus;
};

const fieldClass = 'w-full rounded-xl border border-[#dcc0bd]/70 bg-white px-3 py-2.5 text-sm text-[#1a1c1c] outline-none transition focus:border-[#6E1D1B] focus:ring-2 focus:ring-[#6E1D1B]/10';
const cardClass = 'rounded-2xl border border-[#dcc0bd]/45 bg-white p-5 shadow-[0_12px_35px_rgba(26,28,28,0.05)]';
const softButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#dcc0bd] bg-white px-3 py-2 text-sm font-semibold text-[#6E1D1B] transition hover:bg-[#fff5ed] disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#6E1D1B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#500608] disabled:cursor-not-allowed disabled:opacity-50';

const parseResponse = async (response: Response) => {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Chair operation failed.');
  return body as unknown as Dashboard;
};

const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const displayName = (delegate: ChairDelegate | undefined) =>
  delegate ? [delegate.firstName, delegate.lastName].filter(Boolean).join(' ') || delegate.country || 'Delegate' : 'Delegate';

const modeLabels: Record<(typeof CHAIR_MODES)[number], string> = {
  gsl: 'General Speakers List',
  moderated: 'Moderated Caucus',
  unmoderated: 'Unmoderated Caucus',
  voting: 'Voting Procedure',
  suspended: 'Session Suspended',
};

const tallyLabels: Record<TallyKind, string> = {
  speech: 'Speech',
  motion: 'Motion',
  poi: 'POI',
  amendment: 'Amendment',
  resolution: 'Resolution',
  diplomacy: 'Diplomacy',
};

const scoreLabels: Record<ScoreKind, string> = {
  research: 'Research',
  speaking: 'Speaking',
  diplomacy: 'Diplomacy',
  procedure: 'Procedure',
  leadership: 'Leadership',
  resolution: 'Resolution work',
};

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: 'Present',
  present_voting: 'Present & voting',
  absent: 'Absent',
  excused: 'Excused',
};

const TimerCard = ({
  label,
  timer,
  now,
  busy,
  onCommand,
}: {
  label: string;
  timer: ChairTimer;
  now: number;
  busy: boolean;
  onCommand: (command: 'start' | 'pause' | 'reset' | 'set', durationSeconds?: number) => void;
}) => {
  const remaining = effectiveTimerRemaining(timer, now);
  const [minutes, setMinutes] = useState(String(Math.max(1, Math.round(timer.durationSeconds / 60))));

  useEffect(() => {
    setMinutes(String(Math.max(1, Math.round(timer.durationSeconds / 60))));
  }, [timer.durationSeconds]);

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">{label}</p>
          <p className={`mt-2 font-mono text-4xl font-semibold tabular-nums ${remaining === 0 ? 'text-red-600' : 'text-[#1a1c1c]'}`}>{formatClock(remaining)}</p>
        </div>
        <Clock3 className={`h-7 w-7 ${timer.running ? 'animate-pulse text-emerald-600' : 'text-[#6E1D1B]/45'}`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={primaryButton} disabled={busy || timer.running} onClick={() => onCommand('start')}><Play className="h-4 w-4" />Start</button>
        <button className={softButton} disabled={busy || !timer.running} onClick={() => onCommand('pause')}><Pause className="h-4 w-4" />Pause</button>
        <button className={softButton} disabled={busy} onClick={() => onCommand('reset')}><RotateCcw className="h-4 w-4" />Reset</button>
      </div>
      <div className="mt-3 flex gap-2">
        <input type="number" min={1} max={720} value={minutes} onChange={(event) => setMinutes(event.target.value)} className={fieldClass} aria-label={`${label} minutes`} />
        <button className={softButton} disabled={busy} onClick={() => onCommand('set', Math.max(1, Number(minutes) || 1) * 60)}>Set min</button>
      </div>
    </div>
  );
};

export default function ChairPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<ChairTab>('session');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [speakerSelections, setSpeakerSelections] = useState<Record<SpeakerListKind, string>>({ gsl: '', moderated: '' });
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionStatus, setSessionStatus] = useState('scheduled');
  const [topic, setTopic] = useState('');
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, AssessmentDraft>>({});
  const [motionForm, setMotionForm] = useState({ delegateId: '', type: 'Moderated caucus', topic: '', durationMinutes: '10', speakerSeconds: '60' });
  const [voteTitle, setVoteTitle] = useState('');
  const [permissionDirty, setPermissionDirty] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/chair/operations', await withBrowserAuthHeaders(undefined, 'chair-operations-load'));
      const data = await parseResponse(response);
      setDashboard(data);
      if (!quiet) {
        setSessionTitle(data.session.title);
        setSessionStatus(data.session.status);
        setTopic(data.session.state.topic);
      }
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : 'Unable to load chair operations.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const poll = window.setInterval(() => {
      if (!busyAction && !permissionDirty) void loadDashboard(true);
    }, 5_000);
    return () => window.clearInterval(poll);
  }, [busyAction, loadDashboard, permissionDirty]);

  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(ticker);
  }, []);

  const mutate = useCallback(async (body: Record<string, unknown>, actionLabel: string, successMessage?: string) => {
    setBusyAction(actionLabel);
    try {
      const response = await fetch('/api/chair/operations', await withBrowserAuthHeaders({
        method: 'PATCH',
        body: JSON.stringify(body),
      }, `chair-${actionLabel}`));
      const data = await parseResponse(response);
      setDashboard(data);
      setSessionTitle(data.session.title);
      setSessionStatus(data.session.status);
      setTopic(data.session.state.topic);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chair operation failed.');
      void loadDashboard(true);
    } finally {
      setBusyAction(null);
    }
  }, [loadDashboard]);

  const delegatesById = useMemo(
    () => new Map((dashboard?.delegates || []).map((delegate) => [delegate.id, delegate])),
    [dashboard?.delegates],
  );

  const activeSpeaker = dashboard?.session.state.speakers.find((speaker) => speaker.id === dashboard.session.state.activeSpeakerId);
  const activeDelegate = activeSpeaker ? delegatesById.get(activeSpeaker.delegateId) : undefined;
  const voteCounts = useMemo(() => {
    const counts: Record<VoteChoice, number> = { for: 0, against: 0, abstain: 0, pass: 0 };
    for (const choice of Object.values(dashboard?.session.state.vote?.choices || {})) counts[choice] += 1;
    return counts;
  }, [dashboard?.session.state.vote?.choices]);

  const getAssessmentDraft = (delegate: ChairDelegate): AssessmentDraft =>
    assessmentDrafts[delegate.id] || { scores: delegate.scores, notes: delegate.notes, awardStatus: delegate.awardStatus };

  const updateAssessmentDraft = (delegate: ChairDelegate, patch: Partial<AssessmentDraft>) => {
    setAssessmentDrafts((current) => ({ ...current, [delegate.id]: { ...getAssessmentDraft(delegate), ...patch } }));
  };

  const saveAssessment = async (delegate: ChairDelegate) => {
    const draft = getAssessmentDraft(delegate);
    await mutate({
      action: 'metric.assessment',
      delegateId: delegate.id,
      scores: draft.scores,
      notes: draft.notes,
      awardStatus: draft.awardStatus,
    }, `assessment-${delegate.id}`, `Assessment saved for ${displayName(delegate)}.`);
    setAssessmentDrafts((current) => {
      const next = { ...current };
      delete next[delegate.id];
      return next;
    });
  };

  const setPermission = (delegateId: string, key: BooleanPermission, value: boolean) => {
    setDashboard((current) => current ? {
      ...current,
      delegates: current.delegates.map((delegate) => delegate.id === delegateId
        ? { ...delegate, resoPerms: { ...delegate.resoPerms, [key]: value } }
        : delegate),
    } : current);
    setPermissionDirty(true);
  };

  const savePermissions = async () => {
    if (!dashboard) return;
    setBusyAction('permissions');
    try {
      const response = await fetch('/api/delegates', await withBrowserAuthHeaders({
        method: 'PUT',
        body: JSON.stringify({
          delegates: dashboard.delegates.map((delegate) => ({
            delegateID: delegate.id,
            resoPerms: delegate.resoPerms,
          })),
        }),
      }, 'chair-permissions-save'));
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Unable to save permissions.');
      setPermissionDirty(false);
      toast.success('Delegate resolution permissions saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save permissions.');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <ChairRoute>
        <div className="flex min-h-[70vh] items-center justify-center bg-[#f9f9f9]">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#6E1D1B]"><Loader2 className="h-5 w-5 animate-spin" />Loading chair operations…</div>
        </div>
      </ChairRoute>
    );
  }

  if (!dashboard) {
    return (
      <ChairRoute>
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="font-serif text-3xl font-semibold text-[#6E1D1B]">No committee assignment</h1>
          <p className="mt-3 text-sm leading-6 text-[#564240]">An admin must assign this chair account to a VOFMUN committee before the chair workspace can open.</p>
          <button className={`${primaryButton} mt-5`} onClick={() => void loadDashboard()}><RefreshCw className="h-4 w-4" />Try again</button>
        </div>
      </ChairRoute>
    );
  }

  const { committee, session, delegates, matrix } = dashboard;
  const busy = Boolean(busyAction);
  const tabs: { id: ChairTab; label: string; icon: React.ReactNode }[] = [
    { id: 'session', label: 'Live Session', icon: <Gavel className="h-4 w-4" /> },
    { id: 'delegates', label: 'Roll Call & Tallies', icon: <UserCheck className="h-4 w-4" /> },
    { id: 'scoring', label: 'Scoring Matrix', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'motions', label: 'Motions & Voting', icon: <Vote className="h-4 w-4" /> },
    { id: 'permissions', label: 'Resolution Access', icon: <Settings2 className="h-4 w-4" /> },
  ];

  return (
    <ChairRoute>
      <main className="min-h-screen bg-[#f9f9f9] pb-16 text-[#1a1c1c]">
        <section className="bg-[#6E1D1B] px-5 py-9 text-white sm:px-8">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">VOFMUN Chair Command</p>
                <h1 className="mt-2 font-serif text-4xl font-semibold">{committee.committeeCode} · {committee.name}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">{committee.fullname} · {delegates.length} assigned delegates</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">Synced {new Date(dashboard.syncedAt).toLocaleTimeString()}</span>
                <button className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10" onClick={() => void loadDashboard(true)} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === item.id ? 'bg-[#6E1D1B] text-white' : 'border border-[#dcc0bd]/60 bg-white text-[#564240] hover:border-[#6E1D1B]/40'}`}>{item.icon}{item.label}</button>)}
          </nav>

          {tab === 'session' ? (
            <div className="space-y-6">
              <section className={cardClass}>
                <div className="grid gap-4 lg:grid-cols-[1fr_190px_180px_auto] lg:items-end">
                  <label><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Session title</span><input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} className={fieldClass} /></label>
                  <label><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Status</span><select value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value)} className={fieldClass}>{['scheduled', 'active', 'paused', 'closed'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label>
                  <button className={primaryButton} disabled={busy} onClick={() => void mutate({ action: 'session.meta', title: sessionTitle, status: sessionStatus }, 'session-meta', 'Session details saved.')}><Save className="h-4 w-4" />Save session</button>
                  <span className="text-xs text-[#564240]/65">Version {session.version}</span>
                </div>
              </section>

              <section className={cardClass}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Debate mode</p>
                    <div className="mt-3 flex flex-wrap gap-2">{CHAIR_MODES.map((mode) => <button key={mode} disabled={busy} onClick={() => void mutate({ action: 'session.update', mode }, `mode-${mode}`)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${session.state.mode === mode ? 'border-[#6E1D1B] bg-[#6E1D1B] text-white' : 'border-[#dcc0bd] bg-white text-[#564240]'}`}>{modeLabels[mode]}</button>)}</div>
                  </div>
                  <div className="min-w-0 flex-1 lg:max-w-xl">
                    <label><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Current topic / caucus subject</span><div className="flex gap-2"><input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} className={fieldClass} /><button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'session.update', topic }, 'session-topic', 'Topic saved.')}><Save className="h-4 w-4" /></button></div></label>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                {(['session', 'speaker', 'caucus'] as const).map((kind) => <TimerCard key={kind} label={kind === 'session' ? 'Session timer' : kind === 'speaker' ? 'Speaker timer' : 'Caucus timer'} timer={session.state.timers[kind]} now={now} busy={busy} onCommand={(command, durationSeconds) => void mutate({ action: 'timer', timer: kind, command, durationSeconds }, `timer-${kind}-${command}`)} />)}
              </section>

              <section className="overflow-hidden rounded-3xl bg-[#1a1c1c] p-6 text-white shadow-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Now speaking</p>
                {activeSpeaker ? <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><h2 className="font-serif text-4xl font-semibold">{displayName(activeDelegate)}</h2><p className="mt-2 text-sm text-white/65">{activeDelegate?.country || 'No country'}{activeDelegate?.school ? ` · ${activeDelegate.school}` : ''} · {activeSpeaker.list === 'gsl' ? 'General Speakers List' : 'Moderated Caucus'}</p></div><div className="flex gap-2"><button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1c1c]" disabled={busy} onClick={() => void mutate({ action: 'speaker.complete' }, 'speaker-complete') }><Check className="mr-2 inline h-4 w-4" />Complete</button><button className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold" disabled={busy} onClick={() => void mutate({ action: 'speaker.complete', skipped: true }, 'speaker-skip')}><X className="mr-2 inline h-4 w-4" />Skip</button></div></div> : <p className="mt-3 text-lg text-white/65">No active speaker. Start the next delegate from either list.</p>}
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                {SPEAKER_LISTS.map((list) => {
                  const queue = session.state.speakers.filter((speaker) => speaker.list === list && speaker.status === 'queued');
                  return <div key={list} className={cardClass}><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">{list === 'gsl' ? 'General Speakers List' : 'Moderated Caucus'}</p><h2 className="mt-1 font-serif text-2xl font-semibold text-[#6E1D1B]">{queue.length} queued</h2></div><ListOrdered className="h-6 w-6 text-[#6E1D1B]" /></div><div className="mt-4 flex gap-2"><select value={speakerSelections[list]} onChange={(event) => setSpeakerSelections((current) => ({ ...current, [list]: event.target.value }))} className={fieldClass}><option value="">Choose delegate</option>{delegates.map((delegate) => <option key={delegate.id} value={delegate.id}>{delegate.country || displayName(delegate)} — {displayName(delegate)}</option>)}</select><button className={softButton} disabled={busy || !speakerSelections[list]} onClick={() => { void mutate({ action: 'speaker.add', delegateId: speakerSelections[list], list }, `speaker-add-${list}`); setSpeakerSelections((current) => ({ ...current, [list]: '' })); }}><Plus className="h-4 w-4" /></button></div><div className="mt-4 space-y-2">{queue.map((speaker, index) => { const delegate = delegatesById.get(speaker.delegateId); return <div key={speaker.id} className="flex items-center gap-3 rounded-xl border border-[#e7dcda] bg-[#fffdfb] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6E1D1B] text-xs font-semibold text-white">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{delegate?.country || displayName(delegate)}</p><p className="truncate text-xs text-[#564240]/65">{displayName(delegate)}</p></div><button className={softButton} disabled={busy || index === 0} onClick={() => void mutate({ action: 'speaker.move', speakerId: speaker.id, direction: 'up' }, 'speaker-move')} aria-label="Move up"><ChevronUp className="h-4 w-4" /></button><button className={softButton} disabled={busy || index === queue.length - 1} onClick={() => void mutate({ action: 'speaker.move', speakerId: speaker.id, direction: 'down' }, 'speaker-move')} aria-label="Move down"><ChevronDown className="h-4 w-4" /></button><button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'speaker.remove', speakerId: speaker.id }, 'speaker-remove')} aria-label="Remove"><Trash2 className="h-4 w-4" /></button></div>; })}{queue.length === 0 ? <p className="rounded-xl bg-[#f4f3f3] p-4 text-sm text-[#564240]">No delegates queued.</p> : null}</div><button className={`${primaryButton} mt-4 w-full`} disabled={busy || queue.length === 0} onClick={() => void mutate({ action: 'speaker.startNext', list }, `speaker-next-${list}`)}><Play className="h-4 w-4" />Start next speaker</button></div>;
                })}
              </section>

              <section className={cardClass}>
                <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Activity timeline</h2>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{[...session.state.timeline].reverse().map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-[#f8f5f3] px-4 py-3"><div><p className="text-sm font-semibold">{entry.label}</p>{entry.delegateId ? <p className="text-xs text-[#564240]/65">{displayName(delegatesById.get(entry.delegateId))}</p> : null}</div><span className="shrink-0 text-xs text-[#564240]/55">{new Date(entry.createdAt).toLocaleTimeString()}</span></div>)}{session.state.timeline.length === 0 ? <p className="text-sm text-[#564240]">Session events will appear here.</p> : null}</div>
              </section>
            </div>
          ) : null}

          {tab === 'delegates' ? (
            <section className={cardClass}>
              <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Committee floor</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#6E1D1B]">Roll Call & Quick Tallies</h2></div><Users className="h-7 w-7 text-[#6E1D1B]" /></div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead><tr className="border-b border-[#e7dcda] text-xs uppercase tracking-[0.12em] text-[#564240]/65"><th className="px-3 py-3">Delegate</th><th className="px-3 py-3">School</th><th className="px-3 py-3">Roll call</th>{TALLY_KINDS.map((kind) => <th key={kind} className="px-3 py-3 text-center">{tallyLabels[kind]}</th>)}</tr></thead>
                  <tbody>{delegates.map((delegate) => <tr key={delegate.id} className="border-b border-[#efe7e5] align-top"><td className="px-3 py-4"><p className="font-semibold">{delegate.country || 'No country'}</p><p className="text-xs text-[#564240]/65">{displayName(delegate)}</p></td><td className="px-3 py-4 text-[#564240]">{delegate.school || '—'}{delegate.grade ? <span className="block text-xs text-[#564240]/60">{delegate.grade}</span> : null}</td><td className="px-3 py-4"><select value={delegate.attendance} disabled={busy} onChange={(event) => void mutate({ action: 'metric.attendance', delegateId: delegate.id, status: event.target.value }, `attendance-${delegate.id}`)} className={fieldClass}>{ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{attendanceLabels[status]}</option>)}</select></td>{TALLY_KINDS.map((kind) => <td key={kind} className="px-3 py-4"><div className="flex items-center justify-center gap-1"><button className={softButton} disabled={busy || delegate.tallies[kind] === 0} onClick={() => void mutate({ action: 'metric.tally', delegateId: delegate.id, kind, delta: -1 }, `tally-${delegate.id}-${kind}`)}><Minus className="h-3.5 w-3.5" /></button><span className="min-w-8 text-center font-mono text-base font-semibold">{delegate.tallies[kind]}</span><button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'metric.tally', delegateId: delegate.id, kind, delta: 1 }, `tally-${delegate.id}-${kind}`)}><Plus className="h-3.5 w-3.5" /></button></div></td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === 'scoring' ? (
            <div className="space-y-6">
              <section className={cardClass}>
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Source: VOFMUN 2026 website matrices</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#6E1D1B]">Country Matrix</h2></div><BarChart3 className="h-7 w-7 text-[#6E1D1B]" /></div>
                <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-[#e7dcda] text-xs uppercase tracking-[0.12em] text-[#564240]/65"><th className="px-3 py-3">#</th><th className="px-3 py-3">Country / portfolio</th><th className="px-3 py-3">Assigned delegate</th><th className="px-3 py-3">School</th></tr></thead><tbody>{matrix.map((seat) => <tr key={seat.id} className="border-b border-[#efe7e5]"><td className="px-3 py-3 text-[#564240]/60">{seat.sortOrder}</td><td className="px-3 py-3 font-semibold">{seat.country}</td><td className="px-3 py-3">{seat.delegates.length ? seat.delegates.map(displayName).join(', ') : <span className="text-amber-700">Unassigned</span>}</td><td className="px-3 py-3 text-[#564240]">{seat.delegates.map((delegate) => delegate.school).filter(Boolean).join(', ') || '—'}</td></tr>)}</tbody></table></div>
                {dashboard.unmappedDelegates.length ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Delegates outside the published matrix</p><p className="mt-1 text-xs text-amber-800">{dashboard.unmappedDelegates.map((delegate) => `${displayName(delegate)} (${delegate.country || 'no country'})`).join(', ')}</p></div> : null}
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                {delegates.map((delegate) => {
                  const draft = getAssessmentDraft(delegate);
                  const total = SCORE_KINDS.reduce((sum, kind) => sum + draft.scores[kind], 0);
                  return <article key={delegate.id} className={cardClass}><div className="flex items-start justify-between gap-4"><div><h3 className="font-serif text-2xl font-semibold text-[#6E1D1B]">{delegate.country || displayName(delegate)}</h3><p className="text-sm text-[#564240]/70">{displayName(delegate)}{delegate.school ? ` · ${delegate.school}` : ''}</p></div><span className="rounded-full bg-[#6E1D1B] px-3 py-1.5 text-sm font-semibold text-white">{total}/60</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{SCORE_KINDS.map((kind) => <label key={kind}><span className="mb-1.5 block text-xs font-semibold text-[#564240]/70">{scoreLabels[kind]}</span><input type="number" min={0} max={10} value={draft.scores[kind]} onChange={(event) => updateAssessmentDraft(delegate, { scores: { ...draft.scores, [kind]: Math.max(0, Math.min(10, Number(event.target.value) || 0)) } })} className={fieldClass} /></label>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]"><label><span className="mb-1.5 block text-xs font-semibold text-[#564240]/70">Award tracking</span><select value={draft.awardStatus} onChange={(event) => updateAssessmentDraft(delegate, { awardStatus: event.target.value as AwardStatus })} className={fieldClass}>{AWARD_STATUSES.map((status) => <option key={status} value={status}>{status === 'none' ? 'Not shortlisted' : status === 'watch' ? 'Watch list' : status}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-semibold text-[#564240]/70">Chair notes</span><textarea value={draft.notes} onChange={(event) => updateAssessmentDraft(delegate, { notes: event.target.value })} maxLength={4000} rows={3} className={fieldClass} /></label></div><button className={`${primaryButton} mt-4`} disabled={busy} onClick={() => void saveAssessment(delegate)}><Save className="h-4 w-4" />Save assessment</button></article>;
                })}
              </section>
            </div>
          ) : null}

          {tab === 'motions' ? (
            <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-6">
                <section className={cardClass}>
                  <h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Motion Queue</h2>
                  <div className="mt-4 space-y-3"><select value={motionForm.delegateId} onChange={(event) => setMotionForm((current) => ({ ...current, delegateId: event.target.value }))} className={fieldClass}><option value="">Proposer (optional)</option>{delegates.map((delegate) => <option key={delegate.id} value={delegate.id}>{delegate.country || displayName(delegate)}</option>)}</select><select value={motionForm.type} onChange={(event) => setMotionForm((current) => ({ ...current, type: event.target.value }))} className={fieldClass}>{['Moderated caucus', 'Unmoderated caucus', 'Introduce draft resolution', 'Introduce amendment', 'Close debate', 'Suspend meeting', 'Adjourn meeting', 'Other procedural motion'].map((type) => <option key={type}>{type}</option>)}</select><input value={motionForm.topic} onChange={(event) => setMotionForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic or details" maxLength={300} className={fieldClass} /><div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs font-semibold text-[#564240]/70">Total minutes</span><input type="number" min={1} max={720} value={motionForm.durationMinutes} onChange={(event) => setMotionForm((current) => ({ ...current, durationMinutes: event.target.value }))} className={fieldClass} /></label><label><span className="mb-1 block text-xs font-semibold text-[#564240]/70">Speaker seconds</span><input type="number" min={5} max={3600} value={motionForm.speakerSeconds} onChange={(event) => setMotionForm((current) => ({ ...current, speakerSeconds: event.target.value }))} className={fieldClass} /></label></div><button className={primaryButton} disabled={busy} onClick={() => void mutate({ action: 'motion.add', delegateId: motionForm.delegateId || null, type: motionForm.type, topic: motionForm.topic, durationSeconds: Math.max(1, Number(motionForm.durationMinutes) || 1) * 60, speakerSeconds: Math.max(5, Number(motionForm.speakerSeconds) || 60) }, 'motion-add', 'Motion added.')}><Plus className="h-4 w-4" />Add motion</button></div>
                </section>
                <section className={cardClass}><h2 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Pending & Decided Motions</h2><div className="mt-4 space-y-3">{[...session.state.motions].reverse().map((motion) => <article key={motion.id} className="rounded-xl border border-[#e7dcda] bg-[#fffdfb] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{motion.type}</p><p className="mt-1 text-xs text-[#564240]/65">{motion.delegateId ? displayName(delegatesById.get(motion.delegateId)) : 'Chair'}{motion.topic ? ` · ${motion.topic}` : ''}{motion.durationSeconds ? ` · ${Math.round(motion.durationSeconds / 60)} min` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${motion.status === 'passed' ? 'bg-emerald-100 text-emerald-800' : motion.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-[#f4e8e4] text-[#6E1D1B]'}`}>{motion.status}</span></div><div className="mt-3 flex flex-wrap gap-2">{motion.status === 'pending' ? <><button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'motion.resolve', motionId: motion.id, status: 'passed' }, 'motion-pass')}><Check className="h-4 w-4" />Pass</button><button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'motion.resolve', motionId: motion.id, status: 'failed' }, 'motion-fail')}><X className="h-4 w-4" />Fail</button><button className={softButton} disabled={busy} onClick={() => { setVoteTitle(motion.type); void mutate({ action: 'vote.open', title: motion.type, motionId: motion.id }, 'vote-open'); }}><Vote className="h-4 w-4" />Roll call</button></> : null}<button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'motion.remove', motionId: motion.id }, 'motion-remove')}><Trash2 className="h-4 w-4" />Remove</button></div></article>)}{session.state.motions.length === 0 ? <p className="text-sm text-[#564240]">No motions recorded.</p> : null}</div></section>
              </div>

              <section className={cardClass}>
                <h2 className="font-serif text-3xl font-semibold text-[#6E1D1B]">Roll-call Voting</h2>
                {!session.state.vote ? <div className="mt-5"><input value={voteTitle} onChange={(event) => setVoteTitle(event.target.value)} placeholder="Vote title or draft resolution" className={fieldClass} /><button className={`${primaryButton} mt-3`} disabled={busy || !voteTitle.trim()} onClick={() => void mutate({ action: 'vote.open', title: voteTitle }, 'vote-open')}><Vote className="h-4 w-4" />Open vote</button></div> : <><div className="mt-4 rounded-2xl bg-[#6E1D1B] p-5 text-white"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-white/60">{session.state.vote.status} vote</p><h3 className="mt-1 font-serif text-2xl font-semibold">{session.state.vote.title}</h3></div><div className="grid grid-cols-4 gap-2 text-center">{(['for', 'against', 'abstain', 'pass'] as VoteChoice[]).map((choice) => <div key={choice} className="rounded-lg bg-white/10 px-2 py-2"><p className="text-lg font-semibold">{voteCounts[choice]}</p><p className="text-[10px] uppercase text-white/60">{choice}</p></div>)}</div></div></div><div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto">{delegates.map((delegate) => { const choice = session.state.vote?.choices[delegate.id]; return <div key={delegate.id} className="rounded-xl border border-[#e7dcda] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{delegate.country || displayName(delegate)}</p><p className="text-xs text-[#564240]/65">{displayName(delegate)}</p></div><div className="flex flex-wrap gap-1">{(['for', 'against', 'abstain', 'pass'] as VoteChoice[]).map((item) => <button key={item} disabled={busy || session.state.vote?.status === 'closed'} onClick={() => void mutate({ action: 'vote.set', delegateId: delegate.id, choice: item }, `vote-${delegate.id}`)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold capitalize ${choice === item ? 'border-[#6E1D1B] bg-[#6E1D1B] text-white' : 'border-[#dcc0bd] bg-white text-[#564240]'}`}>{item}</button>)}</div></div></div>; })}</div><div className="mt-4 flex gap-2"><button className={primaryButton} disabled={busy || session.state.vote.status === 'closed'} onClick={() => void mutate({ action: 'vote.close' }, 'vote-close', 'Vote closed.')}><Check className="h-4 w-4" />Close vote</button><button className={softButton} disabled={busy} onClick={() => void mutate({ action: 'vote.reset' }, 'vote-reset')}><RotateCcw className="h-4 w-4" />Clear vote</button></div></>}
              </section>
            </div>
          ) : null}

          {tab === 'permissions' ? (
            <section className={cardClass}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6E1D1B]/65">Committee documents</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#6E1D1B]">Resolution Access</h2><p className="mt-2 text-sm text-[#564240]/75">Control which resolution views and editing tools each delegate can access.</p></div><button className={primaryButton} disabled={!permissionDirty || busyAction === 'permissions'} onClick={() => void savePermissions()}>{busyAction === 'permissions' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save permissions</button></div>
              <div className="mt-6 space-y-3">{delegates.map((delegate) => <article key={delegate.id} className="rounded-xl border border-[#e7dcda] bg-[#fffdfb] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold">{delegate.country || displayName(delegate)}</p><p className="text-xs text-[#564240]/65">{displayName(delegate)}</p></div><div className="grid gap-3 sm:grid-cols-3">{([['view:ownreso', 'View own'], ['view:allreso', 'View all'], ['update:ownreso', 'Edit own']] as [BooleanPermission, string][]).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-[#e7dcda] bg-white px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={Boolean(delegate.resoPerms?.[key])} onChange={(event) => setPermission(delegate.id, key, event.target.checked)} className="h-4 w-4 accent-[#6E1D1B]" /></label>)}</div></div></article>)}</div>
            </section>
          ) : null}
        </div>
      </main>
    </ChairRoute>
  );
}


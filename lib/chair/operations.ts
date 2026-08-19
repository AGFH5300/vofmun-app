// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).

export const CHAIR_MODES = ['gsl', 'moderated', 'unmoderated', 'voting', 'suspended'] as const;
export const SPEAKER_LISTS = ['gsl', 'moderated'] as const;
export const TIMER_KINDS = ['session', 'speaker', 'caucus'] as const;
export const MOTION_STATUSES = ['pending', 'passed', 'failed', 'withdrawn'] as const;
export const VOTE_CHOICES = ['for', 'against', 'abstain', 'pass'] as const;
export const ATTENDANCE_STATUSES = ['present', 'present_voting', 'absent', 'excused'] as const;
export const TALLY_KINDS = ['speech', 'motion', 'poi', 'amendment', 'resolution', 'diplomacy'] as const;
export const SCORE_KINDS = ['research', 'speaking', 'diplomacy', 'procedure', 'leadership', 'resolution'] as const;
export const AWARD_STATUSES = ['none', 'watch', 'honourable', 'outstanding', 'best'] as const;

export type ChairMode = (typeof CHAIR_MODES)[number];
export type SpeakerListKind = (typeof SPEAKER_LISTS)[number];
export type TimerKind = (typeof TIMER_KINDS)[number];
export type MotionStatus = (typeof MOTION_STATUSES)[number];
export type VoteChoice = (typeof VOTE_CHOICES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type TallyKind = (typeof TALLY_KINDS)[number];
export type ScoreKind = (typeof SCORE_KINDS)[number];
export type AwardStatus = (typeof AWARD_STATUSES)[number];

export type ChairTimer = {
  durationSeconds: number;
  elapsedSeconds: number;
  startedAt: string | null;
  running: boolean;
};

export type ChairSpeaker = {
  id: string;
  delegateId: string;
  list: SpeakerListKind;
  status: 'queued' | 'speaking' | 'completed' | 'skipped';
  addedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ChairMotion = {
  id: string;
  delegateId: string | null;
  type: string;
  topic: string;
  durationSeconds: number | null;
  speakerSeconds: number | null;
  status: MotionStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type ChairVote = {
  title: string;
  motionId: string | null;
  status: 'open' | 'closed';
  choices: Record<string, VoteChoice>;
  openedAt: string;
  closedAt: string | null;
};

export type ChairTimelineEntry = {
  id: string;
  type: 'speaker' | 'motion' | 'mode' | 'vote';
  delegateId: string | null;
  label: string;
  createdAt: string;
};

export type ChairSessionState = {
  mode: ChairMode;
  topic: string;
  activeSpeakerId: string | null;
  timers: Record<TimerKind, ChairTimer>;
  speakers: ChairSpeaker[];
  motions: ChairMotion[];
  vote: ChairVote | null;
  timeline: ChairTimelineEntry[];
};

export type ChairSessionAction = Record<string, unknown> & { action: string };

export class ChairOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChairOperationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, maxLength: number, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
};

const asOptionalString = (value: unknown, maxLength: number) => {
  const result = asString(value, maxLength);
  return result || null;
};

const asInteger = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
};

const enumValue = <T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] =>
  typeof value === 'string' && values.includes(value as T[number]) ? value as T[number] : fallback;

const defaultTimer = (durationSeconds: number): ChairTimer => ({
  durationSeconds,
  elapsedSeconds: 0,
  startedAt: null,
  running: false,
});

const parseTimer = (value: unknown, fallbackDuration: number): ChairTimer => {
  if (!isRecord(value)) return defaultTimer(fallbackDuration);
  const startedAt = typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))
    ? value.startedAt
    : null;
  return {
    durationSeconds: asInteger(value.durationSeconds, 5, 43_200, fallbackDuration),
    elapsedSeconds: asInteger(value.elapsedSeconds, 0, 86_400, 0),
    startedAt,
    running: value.running === true && Boolean(startedAt),
  };
};

export const createDefaultChairSessionState = (): ChairSessionState => ({
  mode: 'gsl',
  topic: '',
  activeSpeakerId: null,
  timers: {
    session: defaultTimer(5_400),
    speaker: defaultTimer(90),
    caucus: defaultTimer(600),
  },
  speakers: [],
  motions: [],
  vote: null,
  timeline: [],
});

export const normalizeChairSessionState = (value: unknown): ChairSessionState => {
  const fallback = createDefaultChairSessionState();
  if (!isRecord(value)) return fallback;

  const speakers = Array.isArray(value.speakers)
    ? value.speakers.flatMap((entry): ChairSpeaker[] => {
        if (!isRecord(entry)) return [];
        const id = asString(entry.id, 80);
        const delegateId = asString(entry.delegateId, 80);
        if (!id || !delegateId) return [];
        return [{
          id,
          delegateId,
          list: enumValue(SPEAKER_LISTS, entry.list, 'gsl'),
          status: enumValue(['queued', 'speaking', 'completed', 'skipped'] as const, entry.status, 'queued'),
          addedAt: asString(entry.addedAt, 40, new Date(0).toISOString()),
          startedAt: asOptionalString(entry.startedAt, 40),
          completedAt: asOptionalString(entry.completedAt, 40),
        }];
      }).slice(-300)
    : [];

  const motions = Array.isArray(value.motions)
    ? value.motions.flatMap((entry): ChairMotion[] => {
        if (!isRecord(entry)) return [];
        const id = asString(entry.id, 80);
        const type = asString(entry.type, 80);
        if (!id || !type) return [];
        return [{
          id,
          delegateId: asOptionalString(entry.delegateId, 80),
          type,
          topic: asString(entry.topic, 300),
          durationSeconds: typeof entry.durationSeconds === 'number'
            ? asInteger(entry.durationSeconds, 5, 43_200, 300)
            : null,
          speakerSeconds: typeof entry.speakerSeconds === 'number'
            ? asInteger(entry.speakerSeconds, 5, 3_600, 60)
            : null,
          status: enumValue(MOTION_STATUSES, entry.status, 'pending'),
          createdAt: asString(entry.createdAt, 40, new Date(0).toISOString()),
          resolvedAt: asOptionalString(entry.resolvedAt, 40),
        }];
      }).slice(-200)
    : [];

  const timeline = Array.isArray(value.timeline)
    ? value.timeline.flatMap((entry): ChairTimelineEntry[] => {
        if (!isRecord(entry)) return [];
        const id = asString(entry.id, 80);
        const label = asString(entry.label, 240);
        if (!id || !label) return [];
        return [{
          id,
          type: enumValue(['speaker', 'motion', 'mode', 'vote'] as const, entry.type, 'mode'),
          delegateId: asOptionalString(entry.delegateId, 80),
          label,
          createdAt: asString(entry.createdAt, 40, new Date(0).toISOString()),
        }];
      }).slice(-300)
    : [];

  let vote: ChairVote | null = null;
  if (isRecord(value.vote)) {
    const choices: Record<string, VoteChoice> = {};
    if (isRecord(value.vote.choices)) {
      for (const [delegateId, rawChoice] of Object.entries(value.vote.choices)) {
        if (delegateId.length <= 80 && typeof rawChoice === 'string' && VOTE_CHOICES.includes(rawChoice as VoteChoice)) {
          choices[delegateId] = rawChoice as VoteChoice;
        }
      }
    }
    vote = {
      title: asString(value.vote.title, 240, 'Roll-call vote'),
      motionId: asOptionalString(value.vote.motionId, 80),
      status: enumValue(['open', 'closed'] as const, value.vote.status, 'open'),
      choices,
      openedAt: asString(value.vote.openedAt, 40, new Date(0).toISOString()),
      closedAt: asOptionalString(value.vote.closedAt, 40),
    };
  }

  const timers = isRecord(value.timers) ? value.timers : {};
  const activeSpeakerId = asOptionalString(value.activeSpeakerId, 80);
  return {
    mode: enumValue(CHAIR_MODES, value.mode, 'gsl'),
    topic: asString(value.topic, 500),
    activeSpeakerId: speakers.some((speaker) => speaker.id === activeSpeakerId && speaker.status === 'speaking')
      ? activeSpeakerId
      : null,
    timers: {
      session: parseTimer(timers.session, 5_400),
      speaker: parseTimer(timers.speaker, 90),
      caucus: parseTimer(timers.caucus, 600),
    },
    speakers,
    motions,
    vote,
    timeline,
  };
};

export const effectiveTimerElapsed = (timer: ChairTimer, now = Date.now()) => {
  if (!timer.running || !timer.startedAt) return timer.elapsedSeconds;
  const startedAt = Date.parse(timer.startedAt);
  if (!Number.isFinite(startedAt)) return timer.elapsedSeconds;
  return Math.min(86_400, timer.elapsedSeconds + Math.max(0, Math.floor((now - startedAt) / 1_000)));
};

export const effectiveTimerRemaining = (timer: ChairTimer, now = Date.now()) =>
  Math.max(0, timer.durationSeconds - effectiveTimerElapsed(timer, now));

const timelineEntry = (
  idFactory: () => string,
  nowIso: string,
  type: ChairTimelineEntry['type'],
  label: string,
  delegateId: string | null = null,
): ChairTimelineEntry => ({ id: idFactory(), type, label, delegateId, createdAt: nowIso });

const requireDelegate = (value: unknown) => {
  const delegateId = asString(value, 80);
  if (!delegateId) throw new ChairOperationError('Choose a delegate.');
  return delegateId;
};

const requireId = (value: unknown, label: string) => {
  const id = asString(value, 80);
  if (!id) throw new ChairOperationError(label);
  return id;
};

export const applyChairSessionAction = (
  input: ChairSessionState,
  action: ChairSessionAction,
  options: { now?: Date; idFactory?: () => string } = {},
): ChairSessionState => {
  const state = normalizeChairSessionState(input);
  const now = options.now || new Date();
  const nowIso = now.toISOString();
  const idFactory = options.idFactory || (() => crypto.randomUUID());
  const next: ChairSessionState = structuredClone(state);

  const addTimeline = (entry: ChairTimelineEntry) => {
    next.timeline = [...next.timeline, entry].slice(-300);
  };

  switch (action.action) {
    case 'session.update': {
      if (action.mode !== undefined) {
        const mode = enumValue(CHAIR_MODES, action.mode, next.mode);
        if (mode !== next.mode) addTimeline(timelineEntry(idFactory, nowIso, 'mode', `Mode changed to ${mode}`));
        next.mode = mode;
      }
      if (action.topic !== undefined) next.topic = asString(action.topic, 500);
      return next;
    }
    case 'timer': {
      const timerKind = enumValue(TIMER_KINDS, action.timer, 'speaker');
      const command = enumValue(['start', 'pause', 'reset', 'set'] as const, action.command, 'pause');
      const timer = next.timers[timerKind];
      if (command === 'start' && !timer.running) {
        timer.startedAt = nowIso;
        timer.running = true;
      } else if (command === 'pause' && timer.running) {
        timer.elapsedSeconds = effectiveTimerElapsed(timer, now.getTime());
        timer.startedAt = null;
        timer.running = false;
      } else if (command === 'reset') {
        timer.elapsedSeconds = 0;
        timer.startedAt = null;
        timer.running = false;
      } else if (command === 'set') {
        timer.durationSeconds = asInteger(action.durationSeconds, 5, 43_200, timer.durationSeconds);
        timer.elapsedSeconds = 0;
        timer.startedAt = null;
        timer.running = false;
      }
      return next;
    }
    case 'speaker.add': {
      const delegateId = requireDelegate(action.delegateId);
      const list = enumValue(SPEAKER_LISTS, action.list, 'gsl');
      if (next.speakers.some((speaker) => speaker.delegateId === delegateId && speaker.list === list && ['queued', 'speaking'].includes(speaker.status))) {
        throw new ChairOperationError('That delegate is already on this speakers list.');
      }
      next.speakers.push({
        id: idFactory(),
        delegateId,
        list,
        status: 'queued',
        addedAt: nowIso,
        startedAt: null,
        completedAt: null,
      });
      return next;
    }
    case 'speaker.startNext': {
      const list = enumValue(SPEAKER_LISTS, action.list, 'gsl');
      const active = next.speakers.find((speaker) => speaker.id === next.activeSpeakerId);
      if (active) {
        active.status = 'completed';
        active.completedAt = nowIso;
        addTimeline(timelineEntry(idFactory, nowIso, 'speaker', `Completed ${active.list.toUpperCase()} speech`, active.delegateId));
      }
      const queued = next.speakers.find((speaker) => speaker.list === list && speaker.status === 'queued');
      if (!queued) {
        next.activeSpeakerId = null;
        next.timers.speaker = defaultTimer(next.timers.speaker.durationSeconds);
        return next;
      }
      queued.status = 'speaking';
      queued.startedAt = nowIso;
      next.activeSpeakerId = queued.id;
      next.mode = list;
      next.timers.speaker = { ...defaultTimer(next.timers.speaker.durationSeconds), startedAt: nowIso, running: true };
      addTimeline(timelineEntry(idFactory, nowIso, 'speaker', `Started ${list.toUpperCase()} speech`, queued.delegateId));
      return next;
    }
    case 'speaker.complete': {
      const active = next.speakers.find((speaker) => speaker.id === next.activeSpeakerId);
      if (active) {
        active.status = action.skipped === true ? 'skipped' : 'completed';
        active.completedAt = nowIso;
        addTimeline(timelineEntry(idFactory, nowIso, 'speaker', active.status === 'skipped' ? 'Speaker skipped' : 'Speech completed', active.delegateId));
      }
      next.activeSpeakerId = null;
      next.timers.speaker = defaultTimer(next.timers.speaker.durationSeconds);
      return next;
    }
    case 'speaker.remove': {
      const speakerId = requireId(action.speakerId, 'Choose a speaker-list entry.');
      next.speakers = next.speakers.filter((speaker) => speaker.id !== speakerId);
      if (next.activeSpeakerId === speakerId) {
        next.activeSpeakerId = null;
        next.timers.speaker = defaultTimer(next.timers.speaker.durationSeconds);
      }
      return next;
    }
    case 'speaker.move': {
      const speakerId = requireId(action.speakerId, 'Choose a speaker-list entry.');
      const direction = action.direction === 'up' ? -1 : 1;
      const index = next.speakers.findIndex((speaker) => speaker.id === speakerId);
      if (index < 0) return next;
      const peerIndexes = next.speakers
        .map((speaker, peerIndex) => ({ speaker, peerIndex }))
        .filter(({ speaker }) => speaker.list === next.speakers[index].list && speaker.status === 'queued')
        .map(({ peerIndex }) => peerIndex);
      const peerPosition = peerIndexes.indexOf(index);
      const swapIndex = peerIndexes[peerPosition + direction];
      if (swapIndex !== undefined) [next.speakers[index], next.speakers[swapIndex]] = [next.speakers[swapIndex], next.speakers[index]];
      return next;
    }
    case 'motion.add': {
      const type = asString(action.type, 80);
      if (!type) throw new ChairOperationError('Choose a motion type.');
      const motion: ChairMotion = {
        id: idFactory(),
        delegateId: asOptionalString(action.delegateId, 80),
        type,
        topic: asString(action.topic, 300),
        durationSeconds: typeof action.durationSeconds === 'number' ? asInteger(action.durationSeconds, 5, 43_200, 300) : null,
        speakerSeconds: typeof action.speakerSeconds === 'number' ? asInteger(action.speakerSeconds, 5, 3_600, 60) : null,
        status: 'pending',
        createdAt: nowIso,
        resolvedAt: null,
      };
      next.motions.push(motion);
      addTimeline(timelineEntry(idFactory, nowIso, 'motion', `Motion proposed: ${motion.type}`, motion.delegateId));
      return next;
    }
    case 'motion.resolve': {
      const motionId = requireId(action.motionId, 'Choose a motion.');
      const motion = next.motions.find((entry) => entry.id === motionId);
      if (!motion) throw new ChairOperationError('Motion not found.');
      motion.status = enumValue(MOTION_STATUSES, action.status, motion.status);
      motion.resolvedAt = motion.status === 'pending' ? null : nowIso;
      addTimeline(timelineEntry(idFactory, nowIso, 'motion', `${motion.type}: ${motion.status}`, motion.delegateId));
      return next;
    }
    case 'motion.remove': {
      const motionId = requireId(action.motionId, 'Choose a motion.');
      next.motions = next.motions.filter((entry) => entry.id !== motionId);
      if (next.vote?.motionId === motionId) next.vote = null;
      return next;
    }
    case 'vote.open': {
      next.vote = {
        title: asString(action.title, 240, 'Roll-call vote'),
        motionId: asOptionalString(action.motionId, 80),
        status: 'open',
        choices: {},
        openedAt: nowIso,
        closedAt: null,
      };
      next.mode = 'voting';
      addTimeline(timelineEntry(idFactory, nowIso, 'vote', `Vote opened: ${next.vote.title}`));
      return next;
    }
    case 'vote.set': {
      if (!next.vote || next.vote.status !== 'open') throw new ChairOperationError('Open a vote first.');
      const delegateId = requireDelegate(action.delegateId);
      next.vote.choices[delegateId] = enumValue(VOTE_CHOICES, action.choice, 'abstain');
      return next;
    }
    case 'vote.close': {
      if (!next.vote) throw new ChairOperationError('Open a vote first.');
      next.vote.status = 'closed';
      next.vote.closedAt = nowIso;
      addTimeline(timelineEntry(idFactory, nowIso, 'vote', `Vote closed: ${next.vote.title}`));
      return next;
    }
    case 'vote.reset': {
      next.vote = null;
      return next;
    }
    default:
      throw new ChairOperationError('Unknown chair operation.');
  }
};

export const normalizeScores = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(SCORE_KINDS.map((kind) => [kind, asInteger(record[kind], 0, 10, 0)])) as Record<ScoreKind, number>;
};

export const normalizeTallies = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(TALLY_KINDS.map((kind) => [kind, asInteger(record[kind], 0, 999, 0)])) as Record<TallyKind, number>;
};

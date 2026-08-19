import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyChairSessionAction,
  createDefaultChairSessionState,
  effectiveTimerElapsed,
  normalizeScores,
} from '../lib/chair/operations';

const ids = () => {
  let value = 0;
  return () => `id-${++value}`;
};

test('speaker queues are committee-session state with one active speaker', () => {
  const idFactory = ids();
  const now = new Date('2026-06-12T08:00:00.000Z');
  let state = createDefaultChairSessionState();
  state = applyChairSessionAction(state, { action: 'speaker.add', delegateId: 'delegate-1', list: 'gsl' }, { now, idFactory });
  state = applyChairSessionAction(state, { action: 'speaker.add', delegateId: 'delegate-2', list: 'gsl' }, { now, idFactory });
  state = applyChairSessionAction(state, { action: 'speaker.startNext', list: 'gsl' }, { now, idFactory });

  assert.equal(state.speakers[0].status, 'speaking');
  assert.equal(state.speakers[1].status, 'queued');
  assert.equal(state.activeSpeakerId, state.speakers[0].id);
  assert.equal(state.timers.speaker.running, true);

  state = applyChairSessionAction(state, { action: 'speaker.startNext', list: 'gsl' }, {
    now: new Date('2026-06-12T08:01:00.000Z'),
    idFactory,
  });
  assert.equal(state.speakers[0].status, 'completed');
  assert.equal(state.speakers[1].status, 'speaking');
});

test('duplicate active queue entries are rejected', () => {
  const idFactory = ids();
  let state = createDefaultChairSessionState();
  state = applyChairSessionAction(state, { action: 'speaker.add', delegateId: 'delegate-1', list: 'moderated' }, { idFactory });
  assert.throws(
    () => applyChairSessionAction(state, { action: 'speaker.add', delegateId: 'delegate-1', list: 'moderated' }, { idFactory }),
    /already on this speakers list/,
  );
});

test('timers persist elapsed time when paused', () => {
  let state = createDefaultChairSessionState();
  state = applyChairSessionAction(state, { action: 'timer', timer: 'session', command: 'start' }, {
    now: new Date('2026-06-12T08:00:00.000Z'),
  });
  assert.equal(effectiveTimerElapsed(state.timers.session, Date.parse('2026-06-12T08:02:03.000Z')), 123);

  state = applyChairSessionAction(state, { action: 'timer', timer: 'session', command: 'pause' }, {
    now: new Date('2026-06-12T08:02:03.000Z'),
  });
  assert.equal(state.timers.session.elapsedSeconds, 123);
  assert.equal(state.timers.session.running, false);
});

test('votes and score matrices accept only bounded values', () => {
  const idFactory = ids();
  let state = createDefaultChairSessionState();
  state = applyChairSessionAction(state, { action: 'vote.open', title: 'Draft resolution 1.1' }, { idFactory });
  state = applyChairSessionAction(state, { action: 'vote.set', delegateId: 'delegate-1', choice: 'for' }, { idFactory });
  assert.equal(state.vote?.choices['delegate-1'], 'for');

  const scores = normalizeScores({ research: 14, speaking: -4, diplomacy: 7.4 });
  assert.equal(scores.research, 10);
  assert.equal(scores.speaking, 0);
  assert.equal(scores.diplomacy, 7);
});

test('untrusted dynamic keys cannot mutate object prototypes', () => {
  const idFactory = ids();
  let state = createDefaultChairSessionState();
  state = applyChairSessionAction(state, { action: 'timer', timer: '__proto__', command: 'start' }, { idFactory });
  assert.equal(state.timers.speaker.running, true);

  state = applyChairSessionAction(state, { action: 'vote.open', title: 'Security test' }, { idFactory });
  state = applyChairSessionAction(state, { action: 'vote.set', delegateId: '__proto__', choice: 'for' }, { idFactory });
  assert.equal(Object.prototype.hasOwnProperty.call(state.vote?.choices, '__proto__'), true);
  assert.equal(state.vote?.choices['__proto__'], 'for');
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

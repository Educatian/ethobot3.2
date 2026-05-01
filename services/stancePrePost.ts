import {
  StancePosition,
  type PositionInput,
  type PrePostDelta,
  type ValuePriority,
} from '../types';

const stanceOrder: Record<StancePosition, number> = {
  [StancePosition.OPPOSE]: 0,
  [StancePosition.UNSURE]: 1,
  [StancePosition.SUPPORT]: 2,
};

const classifyStanceShift = (
  from: StancePosition,
  to: StancePosition,
  confidenceFrom: number,
  confidenceTo: number
): PrePostDelta['stanceShift'] => {
  if (from === to) {
    if (Math.abs(confidenceFrom - confidenceTo) < 5) return 'same';
    return confidenceTo > confidenceFrom ? 'sharpened' : 'softened';
  }

  if (
    (from === StancePosition.SUPPORT && to === StancePosition.OPPOSE) ||
    (from === StancePosition.OPPOSE && to === StancePosition.SUPPORT)
  ) {
    return 'reversed';
  }

  const distance = Math.abs(stanceOrder[to] - stanceOrder[from]);
  if (distance === 1 && (from === StancePosition.UNSURE || to === StancePosition.UNSURE)) {
    return from === StancePosition.UNSURE ? 'sharpened' : 'softened';
  }

  return 'softened';
};

const diffValues = (a: ValuePriority[], b: ValuePriority[]) => {
  const setA = new Set(a);
  const setB = new Set(b);
  const added: ValuePriority[] = [];
  const removed: ValuePriority[] = [];
  const retained: ValuePriority[] = [];
  setB.forEach(v => {
    if (setA.has(v)) retained.push(v);
    else added.push(v);
  });
  setA.forEach(v => {
    if (!setB.has(v)) removed.push(v);
  });
  return { added, removed, retained };
};

export const computePrePostDelta = (
  initial: PositionInput,
  closing: PositionInput
): PrePostDelta => {
  const stanceShift = classifyStanceShift(
    initial.stance,
    closing.stance,
    initial.confidence,
    closing.confidence
  );
  const { added, removed, retained } = diffValues(initial.values, closing.values);

  return {
    stanceShift,
    stanceFrom: initial.stance,
    stanceTo: closing.stance,
    confidenceDelta: closing.confidence - initial.confidence,
    valuesAdded: added,
    valuesRemoved: removed,
    valuesRetained: retained,
  };
};

export const isPositionInput = (value: unknown): value is PositionInput => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PositionInput>;
  return (
    typeof candidate.stance === 'string' &&
    typeof candidate.confidence === 'number' &&
    Array.isArray(candidate.values) &&
    typeof candidate.recordedAt === 'string'
  );
};

export const summarizeDelta = (delta: PrePostDelta): string => {
  const sign = delta.confidenceDelta >= 0 ? '+' : '';
  const valueLine =
    delta.valuesAdded.length || delta.valuesRemoved.length
      ? ` Values added: [${delta.valuesAdded.join(', ') || '—'}]; removed: [${delta.valuesRemoved.join(', ') || '—'}].`
      : ' Value priorities unchanged.';
  return `Stance ${delta.stanceShift} (${delta.stanceFrom} → ${delta.stanceTo}); confidence ${sign}${delta.confidenceDelta}.${valueLine}`;
};

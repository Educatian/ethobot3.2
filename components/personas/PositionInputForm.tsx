import React, { useMemo, useState } from 'react';
import {
  StancePosition,
  ValuePriority,
  type PositionInput,
} from '../../types';

interface PositionInputFormProps {
  valueOptions: ValuePriority[];
  initial?: Partial<PositionInput>;
  submitLabel: string;
  onSubmit: (position: PositionInput) => void;
  helperText?: string;
  minValues?: number;
  maxValues?: number;
}

const stanceLabel: Record<StancePosition, string> = {
  [StancePosition.SUPPORT]: 'Support',
  [StancePosition.OPPOSE]: 'Oppose',
  [StancePosition.UNSURE]: 'Unsure',
};

const valueLabel: Record<ValuePriority, string> = {
  [ValuePriority.PRIVACY]: 'Privacy',
  [ValuePriority.SAFETY]: 'Safety',
  [ValuePriority.AUTONOMY]: 'Autonomy',
  [ValuePriority.ACCOUNTABILITY]: 'Accountability',
  [ValuePriority.WELL_BEING]: 'Well-being',
  [ValuePriority.FAIRNESS]: 'Fairness',
};

const PositionInputForm: React.FC<PositionInputFormProps> = ({
  valueOptions,
  initial,
  submitLabel,
  onSubmit,
  helperText,
  minValues = 1,
  maxValues = 4,
}) => {
  const [stance, setStance] = useState<StancePosition | null>(
    initial?.stance ?? null
  );
  const [confidence, setConfidence] = useState<number>(initial?.confidence ?? 50);
  const [rankedValues, setRankedValues] = useState<Partial<Record<ValuePriority, number>>>(() =>
    (initial?.values ?? []).reduce<Partial<Record<ValuePriority, number>>>((acc, value, index) => {
      acc[value] = index + 1;
      return acc;
    }, {})
  );

  const orderedOptions = useMemo(
    () => valueOptions.filter((v, i, arr) => arr.indexOf(v) === i),
    [valueOptions]
  );

  const selectedValues = useMemo(
    () =>
      orderedOptions
        .filter(value => rankedValues[value] !== undefined)
        .sort((a, b) => (rankedValues[a] ?? 99) - (rankedValues[b] ?? 99)),
    [orderedOptions, rankedValues]
  );

  const usedRanks = useMemo(
    () => new Set(Object.values(rankedValues).filter((rank): rank is number => typeof rank === 'number')),
    [rankedValues]
  );

  const setValueRank = (value: ValuePriority, rank: number | null) => {
    setRankedValues(prev => {
      const next = { ...prev };
      if (rank === null) {
        delete next[value];
        return next;
      }
      Object.entries(next).forEach(([key, existingRank]) => {
        if (existingRank === rank && key !== value) {
          delete next[key as ValuePriority];
        }
      });
      next[value] = rank;
      return next;
    });
  };

  const isValid =
    stance !== null &&
    selectedValues.length >= minValues &&
    selectedValues.length <= maxValues;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || stance === null) return;
    onSubmit({
      stance,
      confidence,
      values: selectedValues,
      recordedAt: new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {helperText && <p className="text-sm text-lyceum-muted italic">{helperText}</p>}

      <fieldset>
        <legend className="text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide">Your position</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.values(StancePosition) as StancePosition[]).map(option => (
            <label
              key={option}
              className={`px-5 py-2 rounded-full border cursor-pointer text-sm font-medium transition-colors ${
                stance === option
                  ? 'border-alabama-crimson bg-alabama-crimson text-white shadow-ambient'
                  : 'border-lyceum-line bg-lyceum-paper/95 text-lyceum-ink hover:border-alabama-crimson/60'
              }`}
            >
              <input
                type="radio"
                name="stance"
                className="sr-only"
                value={option}
                checked={stance === option}
                onChange={() => setStance(option)}
              />
              {stanceLabel[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide">
          How confident are you?{' '}
          <span className="font-mono text-xs text-alabama-crimson normal-case tracking-normal">{confidence}%</span>
        </legend>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={confidence}
          onChange={e => setConfidence(Number(e.target.value))}
          className="w-full accent-alabama-crimson"
          aria-label="Confidence"
        />
        <div className="flex justify-between text-xs text-lyceum-muted mt-1">
          <span>Not at all</span>
          <span>Completely</span>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-lyceum-ink mb-2 uppercase tracking-wide">
          Rank your value priorities{' '}
          <span className="text-xs font-normal text-lyceum-muted normal-case tracking-normal">
            (rank {minValues}-{maxValues}; 1 = most important)
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {orderedOptions.map(value => {
            const rank = rankedValues[value] ?? '';
            const atCapacity = rank === '' && selectedValues.length >= maxValues;
            return (
              <label
                key={value}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded border text-sm transition-colors ${
                  rank !== ''
                    ? 'border-alabama-crimson bg-crimson-light text-lyceum-ink'
                    : atCapacity
                    ? 'border-lyceum-line bg-lyceum-paper-deep text-lyceum-muted cursor-not-allowed'
                    : 'border-lyceum-line bg-lyceum-paper/95 text-lyceum-ink hover:border-alabama-crimson/60'
                }`}
              >
                <span>{valueLabel[value]}</span>
                <select
                  aria-label={`Rank ${valueLabel[value]}`}
                  value={rank}
                  disabled={atCapacity}
                  onChange={e => setValueRank(value, e.target.value ? Number(e.target.value) : null)}
                  className="h-8 w-16 rounded border border-lyceum-line bg-white px-2 text-sm font-mono text-lyceum-ink disabled:bg-lyceum-paper-deep"
                >
                  <option value="">--</option>
                  {Array.from({ length: maxValues }, (_, index) => index + 1).map(optionRank => (
                    <option
                      key={optionRank}
                      value={optionRank}
                      disabled={usedRanks.has(optionRank) && rank !== optionRank}
                    >
                      {optionRank}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!isValid}
        className={`w-full py-3 rounded text-sm font-semibold tracking-wide transition-colors ${
          isValid
            ? 'bg-alabama-crimson text-white hover:bg-crimson-dark shadow-ambient'
            : 'bg-lyceum-paper-deep text-lyceum-muted cursor-not-allowed'
        }`}
      >
        {submitLabel}
      </button>
    </form>
  );
};

export default PositionInputForm;

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
  const [selectedValues, setSelectedValues] = useState<ValuePriority[]>(
    initial?.values ?? []
  );

  const orderedOptions = useMemo(
    () => valueOptions.filter((v, i, arr) => arr.indexOf(v) === i),
    [valueOptions]
  );

  const toggleValue = (value: ValuePriority) => {
    setSelectedValues(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      if (prev.length >= maxValues) return prev;
      return [...prev, value];
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
          Which values matter most here?{' '}
          <span className="text-xs font-normal text-lyceum-muted normal-case tracking-normal">
            (choose {minValues}–{maxValues})
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {orderedOptions.map(value => {
            const checked = selectedValues.includes(value);
            const atCapacity = !checked && selectedValues.length >= maxValues;
            return (
              <label
                key={value}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer transition-colors ${
                  checked
                    ? 'border-alabama-crimson bg-crimson-light text-lyceum-ink'
                    : atCapacity
                    ? 'border-lyceum-line bg-lyceum-paper-deep text-lyceum-muted cursor-not-allowed'
                    : 'border-lyceum-line bg-lyceum-paper/95 text-lyceum-ink hover:border-alabama-crimson/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-alabama-crimson"
                  checked={checked}
                  disabled={atCapacity}
                  onChange={() => toggleValue(value)}
                />
                {valueLabel[value]}
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

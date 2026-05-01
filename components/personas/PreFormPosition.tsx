import React from 'react';
import type { PositionInput, Scenario } from '../../types';
import PositionInputForm from './PositionInputForm';

interface PreFormPositionProps {
  scenario: Scenario;
  onSubmit: (position: PositionInput) => void;
}

const PreFormPosition: React.FC<PreFormPositionProps> = ({ scenario, onSubmit }) => {
  return (
    <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 max-w-2xl mx-auto shadow-ambient">
      <h2 className="text-2xl font-headline font-semibold mb-1 text-lyceum-ink">Before we begin</h2>
      <p className="text-sm text-lyceum-muted mb-5">
        Take a moment with the dilemma. Then record your starting position so we
        can revisit it at the end.
      </p>

      <div className="bg-lyceum-paper-soft border border-lyceum-line rounded p-4 mb-6">
        <h3 className="text-sm font-semibold text-lyceum-ink mb-1 uppercase tracking-wide">{scenario.title}</h3>
        <p className="text-sm text-lyceum-ink/85 leading-relaxed mb-3">{scenario.scenario}</p>
        <p className="text-sm text-lyceum-ink/90">
          <span className="font-semibold">Guiding question: </span>
          {scenario.guidingQuestion}
        </p>
      </div>

      <PositionInputForm
        valueOptions={scenario.valueOptions}
        submitLabel="Start the dialogue"
        helperText="Your initial reasoning is intuitive — that's expected. We'll come back to it."
        onSubmit={onSubmit}
      />
    </section>
  );
};

export default PreFormPosition;

import React, { useMemo, useState } from 'react';
import type { PositionInput, PrePostDelta, Scenario } from '../../types';
import { computePrePostDelta, summarizeDelta } from '../../services/stancePrePost';
import PositionInputForm from './PositionInputForm';

interface PostFormPositionProps {
  scenario: Scenario;
  initialPosition: PositionInput;
  onSubmit: (position: PositionInput, delta: PrePostDelta) => void;
}

const PostFormPosition: React.FC<PostFormPositionProps> = ({
  scenario,
  initialPosition,
  onSubmit,
}) => {
  const [closing, setClosing] = useState<PositionInput | null>(null);

  const delta = useMemo(
    () => (closing ? computePrePostDelta(initialPosition, closing) : null),
    [closing, initialPosition]
  );

  const handleSubmit = (position: PositionInput) => {
    setClosing(position);
  };

  const handleConfirm = () => {
    if (closing && delta) onSubmit(closing, delta);
  };

  return (
    <section className="bg-lyceum-paper/95 border border-lyceum-line rounded-lg p-6 max-w-2xl mx-auto shadow-ambient">
      <h2 className="text-2xl font-headline font-semibold mb-1 text-lyceum-ink">Where do you stand now?</h2>
      <p className="text-sm text-lyceum-muted mb-5">
        Same questions, after the conversation. Take your time — shifts are fine,
        and so is staying put.
      </p>

      {!closing ? (
        <PositionInputForm
          valueOptions={scenario.valueOptions}
          submitLabel="Record my closing position"
          helperText={`Compare to where you started: ${initialPosition.stance.toUpperCase()} at ${initialPosition.confidence}%.`}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded border border-lyceum-line bg-lyceum-paper-soft p-4 text-sm">
            <h3 className="font-semibold text-lyceum-ink mb-2 uppercase tracking-wide text-xs">Pre / Post comparison</h3>
            <p className="text-lyceum-ink/85">{delta && summarizeDelta(delta)}</p>
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 rounded bg-alabama-crimson text-white text-sm font-semibold tracking-wide hover:bg-crimson-dark shadow-ambient transition-colors"
          >
            Finish session
          </button>
          <button
            type="button"
            onClick={() => setClosing(null)}
            className="w-full py-2.5 rounded border border-lyceum-line text-sm text-lyceum-ink hover:bg-lyceum-paper-deep transition-colors"
          >
            Edit my closing position
          </button>
        </div>
      )}
    </section>
  );
};

export default PostFormPosition;

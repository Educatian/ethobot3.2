import React from 'react';
import type { Persona } from '../../types';

interface PersonaPanelCardProps {
  persona: Persona;
  state?: 'idle' | 'highlighted' | 'active' | 'completed' | 'disabled';
  onOpen?: (persona: Persona) => void;
  rationale?: string;
}

const stateClasses: Record<NonNullable<PersonaPanelCardProps['state']>, string> = {
  idle: 'border-lyceum-line bg-lyceum-paper/95 hover:border-alabama-crimson/50 hover:shadow-ambient',
  highlighted: 'border-alabama-crimson bg-crimson-light ring-2 ring-alabama-crimson/30 shadow-ambient',
  active: 'border-alabama-crimson bg-alabama-crimson/10 shadow-ambient',
  completed: 'border-lyceum-line bg-lyceum-paper-deep opacity-70',
  disabled: 'border-lyceum-line bg-lyceum-paper-soft opacity-60 cursor-not-allowed',
};

const PersonaPanelCard: React.FC<PersonaPanelCardProps> = ({
  persona,
  state = 'idle',
  onOpen,
  rationale,
}) => {
  const interactive = state !== 'disabled' && typeof onOpen === 'function';
  const showOpenButton = interactive && (state === 'idle' || state === 'highlighted');

  const handleClick = () => {
    if (interactive) onOpen?.(persona);
  };

  return (
    <article
      className={`rounded-lg border p-4 transition-colors ${stateClasses[state]}`}
      aria-disabled={!interactive}
      data-persona-id={persona.id}
      data-state={state}
    >
      <header className="mb-2">
        <h3 className="text-base font-headline font-semibold leading-tight text-lyceum-ink">{persona.name}</h3>
        <p className="text-[11px] uppercase tracking-wider text-lyceum-muted mt-0.5">{persona.role}</p>
      </header>
      <p className="text-sm text-lyceum-ink/85 leading-snug">{persona.shortDescription}</p>

      {rationale && state === 'highlighted' && (
        <p className="mt-3 text-xs text-alabama-crimson italic">{rationale}</p>
      )}

      {showOpenButton && (
        <button
          type="button"
          onClick={handleClick}
          className="mt-3 inline-flex items-center text-xs font-semibold text-alabama-crimson hover:text-crimson-dark transition-colors"
          data-action="open-persona"
        >
          Open →
        </button>
      )}

      {state === 'active' && (
        <p className="mt-3 text-xs font-semibold text-alabama-crimson uppercase tracking-wide">In conversation…</p>
      )}

      {state === 'completed' && (
        <p className="mt-3 text-xs text-lyceum-muted italic">Spoke with you earlier</p>
      )}
    </article>
  );
};

export default PersonaPanelCard;

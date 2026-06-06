import React from 'react';
import { Bell, Check, UserRound } from 'lucide-react';
import type { Persona } from '../../types';

interface PersonaPanelCardProps {
  persona: Persona;
  state?: 'idle' | 'highlighted' | 'active' | 'completed' | 'disabled';
  onOpen?: (persona: Persona) => void;
  rationale?: string;
  showNudge?: boolean;
  language?: string;
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
  showNudge = false,
  language,
}) => {
  const ko = language === 'ko';
  const interactive = state !== 'disabled' && typeof onOpen === 'function';
  const showOpenButton = interactive && (state === 'idle' || state === 'highlighted');
  const showNotification = showNudge && state === 'idle';

  const handleClick = () => {
    if (interactive) onOpen?.(persona);
  };

  return (
    <article
      className={`relative rounded-lg border p-4 transition-colors ${stateClasses[state]}`}
      aria-disabled={!interactive}
      data-persona-id={persona.id}
      data-state={state}
    >
      {showNotification && (
        <span className="absolute right-3 top-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-alabama-crimson px-1.5 text-[11px] font-bold text-white shadow-ambient">
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
      <header className="mb-2 flex items-start gap-3 pr-8">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-alabama-crimson/30 bg-white text-alabama-crimson">
          {state === 'completed' ? <Check className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div>
          <h3 className="text-base font-headline font-semibold leading-tight text-lyceum-ink">{persona.name}</h3>
          <p className="text-[11px] uppercase tracking-wider text-lyceum-muted mt-0.5">{persona.role}</p>
        </div>
      </header>
      <p className="text-sm text-lyceum-ink/85 leading-snug">{persona.shortDescription}</p>

      {rationale && state === 'highlighted' && (
        <p className="mt-3 text-xs text-alabama-crimson italic">{rationale}</p>
      )}

      {showOpenButton && (
        <button
          type="button"
          onClick={handleClick}
          className="mt-3 inline-flex items-center rounded-full border border-alabama-crimson/30 bg-white px-3 py-1.5 text-xs font-semibold text-alabama-crimson hover:border-alabama-crimson hover:bg-crimson-light transition-colors"
          data-action="open-persona"
        >
          {ko ? '대화 시작' : 'Open voice'}
        </button>
      )}

      {state === 'active' && (
        <p className="mt-3 text-xs font-semibold text-alabama-crimson uppercase tracking-wide">
          {ko ? '대화 중…' : 'In conversation...'}
        </p>
      )}

      {state === 'completed' && (
        <p className="mt-3 text-xs text-lyceum-muted italic">
          {ko ? '앞서 이야기를 나눴어요' : 'Spoke with you earlier'}
        </p>
      )}
    </article>
  );
};

export default PersonaPanelCard;

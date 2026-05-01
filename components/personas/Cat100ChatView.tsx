import React, { useEffect, useRef } from 'react';
import { StudyCondition, type Persona, type PositionInput, type Scenario } from '../../types';
import {
  usePersonaSession,
  type Cat100Message,
} from '../../hooks/usePersonaSession';
import PersonaPanelCard from './PersonaPanelCard';
import ChatInput from '../ChatInput';
import type { Cat100LogContext } from '../../services/cat100Logging';

interface Cat100ChatViewProps {
  scenario: Scenario;
  language: string;
  condition: StudyCondition | null;
  initialPosition?: PositionInput | null;
  logContext?: Cat100LogContext | null;
  expectedPersonaTurns?: number;
  onFinish: () => void;
}

const speakerStyles: Record<Cat100Message['speaker'], string> = {
  learner: 'self-end bg-alabama-crimson text-white shadow-ambient',
  facilitator: 'self-start bg-lyceum-paper/95 border border-lyceum-line text-lyceum-ink',
  persona: 'self-start bg-lyceum-accent-soft/40 border border-alabama-crimson/30 text-lyceum-ink',
  system: 'self-center bg-lyceum-paper-deep text-lyceum-muted italic text-xs px-3 py-1',
};

const speakerLabel = (m: Cat100Message): string => {
  if (m.speaker === 'learner') return 'You';
  if (m.speaker === 'facilitator') return 'ETHOBOT';
  if (m.speaker === 'persona') return m.personaName ?? 'Persona';
  return '';
};

const Cat100ChatView: React.FC<Cat100ChatViewProps> = ({
  scenario,
  language,
  condition,
  initialPosition = null,
  logContext = null,
  expectedPersonaTurns,
  onFinish,
}) => {
  const session = usePersonaSession({
    scenario,
    language,
    condition,
    initialPosition,
    logContext,
    expectedPersonaTurns,
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  const handleLogClick = () => {
    /* CAT 100 view does not yet wire detailed click logs; will be added in a later wave. */
  };

  const personaCardState = (persona: Persona) => {
    if (session.activePersona?.id === persona.id) return 'active' as const;
    if (session.calledPersonaIds.includes(persona.id)) return 'completed' as const;
    if (session.activePersona) return 'disabled' as const;
    if (!session.isChatReady || session.isLoading) return 'disabled' as const;
    if (condition === StudyCondition.AI_RECOMMENDED) {
      if (session.currentRecommendation?.personaId === persona.id) {
        return 'highlighted' as const;
      }
      return 'disabled' as const;
    }
    return 'idle' as const;
  };

  const onCardOpen =
    condition === StudyCondition.LEARNER_DIRECTED || condition === StudyCondition.AI_RECOMMENDED
      ? session.openPersona
      : undefined;

  const finishDisabled = !session.isChatReady || session.isLoading;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <section className="flex flex-col h-[640px] bg-lyceum-paper/95 border border-lyceum-line rounded-lg overflow-hidden shadow-ambient">
        <header className="px-4 py-3 border-b border-lyceum-line bg-lyceum-paper-soft text-xs uppercase tracking-wider text-lyceum-muted">
          {scenario.title} ·{' '}
          <span className="font-mono normal-case tracking-normal">phase: {session.phase}</span>
          {session.activePersona && (
            <>
              {' · '}
              <span className="text-alabama-crimson normal-case tracking-normal">
                with {session.activePersona.name}
              </span>
            </>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {!session.isChatReady && (
            <p className="text-sm text-lyceum-muted text-center mt-8 italic">
              Initializing CAT 100 facilitator…
            </p>
          )}
          {session.isChatReady && session.messages.length === 0 && (
            <p className="text-sm text-lyceum-muted text-center mt-8 italic">
              Type your opening thought to begin the dialogue.
            </p>
          )}
          {session.messages.map(message => {
            const isPendingRec =
              !!message.recommendationPersonaId &&
              session.currentRecommendation?.personaId === message.recommendationPersonaId;
            return (
              <div key={message.id} className="flex flex-col gap-1 max-w-[85%] sm:max-w-[75%]">
                {message.speaker !== 'system' && (
                  <span className="text-[11px] uppercase tracking-wider text-lyceum-muted">
                    {speakerLabel(message)}
                  </span>
                )}
                <div
                  className={`rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${speakerStyles[message.speaker]}`}
                >
                  {message.text}
                </div>
                {isPendingRec && (
                  <button
                    type="button"
                    data-action="accept-recommendation"
                    data-persona-id={message.recommendationPersonaId}
                    onClick={() => session.acceptRecommendation()}
                    className="mt-1 self-start text-xs font-semibold px-3 py-1.5 rounded border-2 border-alabama-crimson text-alabama-crimson hover:bg-alabama-crimson hover:text-white transition-colors"
                  >
                    Open {message.recommendationPersonaName ?? 'persona'} →
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <ChatInput
          onSend={session.sendMessage}
          isLoading={session.isLoading || !session.isChatReady}
          onLogClick={handleLogClick}
        />

        <div className="px-4 py-3 border-t border-lyceum-line bg-lyceum-paper-soft flex items-center justify-between">
          <span className="text-xs text-lyceum-muted">
            Personas called: <span className="text-alabama-crimson font-semibold">{session.calledPersonaIds.length}</span> / {scenario.personas.length}
          </span>
          <button
            type="button"
            onClick={onFinish}
            disabled={finishDisabled}
            className={`text-xs font-semibold ${
              finishDisabled
                ? 'text-lyceum-muted/60 cursor-not-allowed'
                : 'text-alabama-crimson hover:text-crimson-dark'
            }`}
          >
            End dialogue → record closing position
          </button>
        </div>
      </section>

      <aside className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-lyceum-ink uppercase tracking-wide">Stakeholder personas</h3>
          <p className="text-xs text-lyceum-muted mt-1">
            {condition === StudyCondition.LEARNER_DIRECTED
              ? 'Click a card to bring that voice into the conversation.'
              : condition === StudyCondition.AI_RECOMMENDED
              ? 'ETHOBOT will surface a persona when relevant.'
              : 'Select a study condition to enable persona invocation.'}
          </p>
        </header>
        {scenario.personas.map(persona => (
          <PersonaPanelCard
            key={persona.id}
            persona={persona}
            state={personaCardState(persona)}
            onOpen={onCardOpen}
          />
        ))}
      </aside>
    </div>
  );
};

export default Cat100ChatView;

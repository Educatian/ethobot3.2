import React, { useEffect, useRef, useState } from 'react';
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
  // Resume support.
  resumeMessages?: Cat100Message[] | null;
  onMessagesChange?: (messages: Cat100Message[]) => void;
}

const speakerStyles: Record<Cat100Message['speaker'], string> = {
  learner: 'self-end bg-alabama-crimson text-white shadow-ambient',
  facilitator: 'self-start bg-lyceum-paper/95 border border-lyceum-line text-lyceum-ink',
  persona: 'self-start bg-lyceum-accent-soft/40 border border-alabama-crimson/30 text-lyceum-ink',
  system: 'self-center bg-lyceum-paper-deep text-lyceum-muted italic text-xs px-3 py-1',
};

const speakerLabel = (m: Cat100Message, ko: boolean): string => {
  if (m.speaker === 'learner') return ko ? '나' : 'You';
  if (m.speaker === 'facilitator') return ko ? '에토봇' : 'ETHOBOT';
  if (m.speaker === 'persona') return m.personaName ?? (ko ? '인물' : 'Persona');
  return '';
};

// Friendly phase labels. In English we keep the raw code (researcher-facing);
// for the SNU/Korean cohort we surface a learner-friendly Korean label instead.
const phaseLabelKo: Record<string, string> = {
  initializing: '준비 중',
  idle: '대기 중',
  in_facilitator: '진행자와 대화 중',
  in_persona: '인물과 대화 중',
  in_facilitator_return: '진행자와 정리 중',
};

const Cat100ChatView: React.FC<Cat100ChatViewProps> = ({
  scenario,
  language,
  condition,
  initialPosition = null,
  logContext = null,
  expectedPersonaTurns,
  onFinish,
  resumeMessages = null,
  onMessagesChange,
}) => {
  const session = usePersonaSession({
    scenario,
    language,
    condition,
    initialPosition,
    logContext,
    expectedPersonaTurns,
    resumeMessages,
  });

  // Surface transcript changes upward so the parent can persist a resume snapshot.
  useEffect(() => {
    onMessagesChange?.(session.messages);
  }, [session.messages, onMessagesChange]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showFinishReview, setShowFinishReview] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const sessionStartedAtRef = useRef(Date.now());

  useEffect(() => {
    const updateElapsed = () => {
      setElapsedMinutes(Math.floor((Date.now() - sessionStartedAtRef.current) / 60000));
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 30000);
    return () => window.clearInterval(timer);
  }, []);
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
  const ko = language === 'ko';
  const unresolvedPrompt =
    session.suspendedFacilitatorPrompt ?? session.pendingFacilitatorPrompt;

  const handleFinishRequest = () => {
    if (session.activePersona || unresolvedPrompt) {
      setShowFinishReview(true);
      return;
    }
    onFinish();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <section className="flex flex-col h-[640px] bg-lyceum-paper/95 border border-lyceum-line rounded-lg overflow-hidden shadow-ambient">
        <header className="px-4 py-3 border-b border-lyceum-line bg-lyceum-paper-soft text-xs uppercase tracking-wider text-lyceum-muted">
          {scenario.title} ·{' '}
          {ko ? (
            <span className="normal-case tracking-normal">
              진행 단계: {phaseLabelKo[session.phase] ?? '대화 진행 중'}
            </span>
          ) : (
            <span className="font-mono normal-case tracking-normal">phase: {session.phase}</span>
          )}
          {session.activePersona && (
            <>
              {' · '}
              <span className="text-alabama-crimson normal-case tracking-normal">
                {ko ? `${session.activePersona.name}와(과) 대화 중` : `with ${session.activePersona.name}`}
              </span>
            </>
          )}
        </header>

        {session.activePersona && session.suspendedFacilitatorPrompt && (
          <div
            data-testid="paused-facilitator-prompt"
            className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
          >
            <p className="font-semibold">
              {ko ? '보류 중인 Ethobot 질문' : 'Paused ETHOBOT question'}
            </p>
            <p className="mt-1 leading-relaxed">{session.suspendedFacilitatorPrompt}</p>
            <p className="mt-1 text-amber-800">
              {ko
                ? `${session.activePersona.name}와의 대화가 끝나면 이 질문으로 다시 돌아옵니다.`
                : `We will return to this after your conversation with ${session.activePersona.name}.`}
            </p>
          </div>
        )}

        {!session.activePersona && session.pendingFacilitatorPrompt && (
          <div
            data-testid="open-facilitator-prompt"
            className="mx-4 mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950"
          >
            <p className="font-semibold">
              {ko ? '답변을 기다리는 Ethobot 질문' : 'Open ETHOBOT question'}
            </p>
            <p className="mt-1 leading-relaxed">{session.pendingFacilitatorPrompt}</p>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {!session.isChatReady && (
            <p className="text-sm text-lyceum-muted text-center mt-8 italic">
              {ko ? '에토봇을 준비하고 있어요…' : 'Initializing CAT 100 facilitator…'}
            </p>
          )}
          {session.isChatReady && session.messages.length === 0 && (
            <p className="text-sm text-lyceum-muted text-center mt-8 italic">
              {ko
                ? '첫 생각을 입력하면 대화가 시작돼요.'
                : 'Type your opening thought to begin the dialogue.'}
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
                    {speakerLabel(message, ko)}
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
                    {ko
                      ? `${message.recommendationPersonaName ?? '인물'}와(과) 대화하기 →`
                      : `Open ${message.recommendationPersonaName ?? 'persona'} →`}
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
          placeholder={
            session.activePersona
              ? ko
                ? `${session.activePersona.name}에게 답변을 입력하세요…`
                : `Reply to ${session.activePersona.name}…`
              : undefined
          }
          sendTitle={
            session.activePersona
              ? ko
                ? `${session.activePersona.name}에게 메시지 보내기`
                : `Send your message to ${session.activePersona.name}`
              : undefined
          }
        />

        {showFinishReview && (
          <div
            data-testid="finish-review-warning"
            className="mx-4 mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-950"
          >
            <p className="font-semibold">{ko ? '마치기 전 확인' : 'Before you finish'}</p>
            {session.activePersona && (
              <p className="mt-1">
                {ko
                  ? `${session.activePersona.name}와의 짧은 대화가 아직 진행 중입니다.`
                  : `Your short conversation with ${session.activePersona.name} is still in progress.`}
              </p>
            )}
            {unresolvedPrompt && (
              <p className="mt-1 leading-relaxed">
                {ko ? '아직 답하지 않은 질문: ' : 'One question is still open: '}
                <span className="font-medium">{unresolvedPrompt}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowFinishReview(false)}
                className="rounded border border-amber-400 bg-white px-3 py-1.5 font-semibold text-amber-950"
              >
                {ko ? '대화 계속하기' : 'Keep reflecting'}
              </button>
              <button
                type="button"
                onClick={onFinish}
                className="rounded bg-alabama-crimson px-3 py-1.5 font-semibold text-white"
              >
                {ko ? '그대로 마치기' : 'End anyway'}
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-lyceum-line bg-lyceum-paper-soft flex items-center justify-between gap-3">
          <div className="text-xs text-lyceum-muted">
            <p>
              {ko ? '지금까지 부른 인물: ' : 'Personas called: '}
              <span className="text-alabama-crimson font-semibold">{session.calledPersonaIds.length}</span> / {scenario.personas.length}
            </p>
            <p className="mt-0.5 text-[11px]">
              {ko
                ? `권장 성찰 시간 8–12분 · 경과 ${elapsedMinutes}분`
                : `Suggested reflection time: 8–12 min · elapsed: ${elapsedMinutes} min`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinishRequest}
            disabled={finishDisabled}
            className={`text-xs font-semibold ${
              finishDisabled
                ? 'text-lyceum-muted/60 cursor-not-allowed'
                : 'text-alabama-crimson hover:text-crimson-dark'
            }`}
          >
            {ko ? '대화 마치기 → 최종 입장 기록' : 'End dialogue → record closing position'}
          </button>
        </div>
      </section>

      <aside className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-lyceum-ink uppercase tracking-wide">
            {ko ? '이해관계자(stakeholder)' : 'Stakeholder personas'}
          </h3>
          <p className="text-xs text-lyceum-muted mt-1">
            {condition === StudyCondition.LEARNER_DIRECTED
              ? ko
                ? '카드를 누르면 그 인물이 대화에 참여해요.'
                : 'Click a card to bring that voice into the conversation.'
              : condition === StudyCondition.AI_RECOMMENDED
              ? ko
                ? '에토봇이 적절한 시점에 인물을 추천해 드려요.'
                : 'ETHOBOT will surface a persona when relevant.'
              : ko
              ? '학습 조건을 선택하면 인물을 불러올 수 있어요.'
              : 'Select a study condition to enable persona invocation.'}
          </p>
        </header>
        {scenario.personas.map(persona => (
          <PersonaPanelCard
            key={persona.id}
            persona={persona}
            state={personaCardState(persona)}
            onOpen={onCardOpen}
            showNudge={condition === StudyCondition.LEARNER_DIRECTED}
            language={language}
          />
        ))}
      </aside>
    </div>
  );
};

export default Cat100ChatView;

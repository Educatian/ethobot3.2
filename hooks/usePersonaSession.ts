import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StudyCondition,
  type Persona,
  type PersonaCallEvent,
  type PositionInput,
  type Scenario,
  type TriggerRule,
  type VocabularyEmergence,
} from '../types';
import {
  evaluateRecommendation,
  isRecommendationGateOpen,
} from '../services/personaRecommender';
import {
  initializeCat100Chat,
  isCat100ChatInitialized,
  streamCat100Chat,
  resetCat100Chat,
  seedCat100History,
} from '../services/cat100Chat';
import {
  detectVocabulary,
  createEmptyVocabularyState,
  type VocabularyState,
} from '../services/vocabularyEmergence';
import { logCat100Event, type Cat100LogContext } from '../services/cat100Logging';

export interface Cat100Message {
  id: string;
  speaker: 'learner' | 'facilitator' | 'persona' | 'system';
  personaId?: string;
  personaName?: string;
  text: string;
  timestamp: string;
  turnNumber: number;
  recommendationPersonaId?: string;
  recommendationPersonaName?: string;
  recommendationTriggerRule?: TriggerRule;
}

export interface ActiveRecommendation {
  personaId: string;
  personaName: string;
  triggerRule: TriggerRule;
  rationale: string;
  recommendedAt: string;
  turnNumber: number;
}

export type Cat100Phase =
  | 'initializing'
  | 'idle'
  | 'in_facilitator'
  | 'in_persona'
  | 'in_facilitator_return';

export interface UsePersonaSessionArgs {
  scenario: Scenario;
  language: string;
  condition: StudyCondition | null;
  initialPosition?: PositionInput | null;
  expectedPersonaTurns?: number;
  logContext?: Cat100LogContext | null;
  // Resume: prior transcript to rehydrate. When present (non-empty), the hook
  // skips the fresh facilitator opening and continues the saved conversation.
  resumeMessages?: Cat100Message[] | null;
}

export interface UsePersonaSessionResult {
  messages: Cat100Message[];
  activePersona: Persona | null;
  calledPersonaIds: string[];
  isChatReady: boolean;
  isLoading: boolean;
  phase: Cat100Phase;
  personaCallEvents: PersonaCallEvent[];
  vocabularyEmergences: VocabularyEmergence[];
  recentlyExitedPersonaId?: string;
  currentRecommendation: ActiveRecommendation | null;
  sendMessage: (text: string) => Promise<void>;
  openPersona: (persona: Persona) => Promise<void>;
  acceptRecommendation: () => Promise<void>;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const usePersonaSession = (args: UsePersonaSessionArgs): UsePersonaSessionResult => {
  const {
    scenario,
    language,
    condition,
    initialPosition = null,
    expectedPersonaTurns,
    logContext = null,
    resumeMessages = null,
  } = args;
  const isFixedTurns = typeof expectedPersonaTurns === 'number';
  const pickPersonaTurns = () =>
    isFixedTurns ? expectedPersonaTurns! : 2 + Math.floor(Math.random() * 2); // 2 or 3

  const [messages, setMessages] = useState<Cat100Message[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [calledPersonaIds, setCalledPersonaIds] = useState<string[]>([]);
  const [isChatReady, setIsChatReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<Cat100Phase>('initializing');
  const [personaCallEvents, setPersonaCallEvents] = useState<PersonaCallEvent[]>([]);
  const [vocabularyEmergences, setVocabularyEmergences] = useState<VocabularyEmergence[]>([]);
  const [recentlyExitedPersonaId, setRecentlyExitedPersonaId] = useState<string | undefined>(
    undefined
  );

  const overallTurnRef = useRef(0);
  const personaTurnRef = useRef(0);
  const personaEnteredAtRef = useRef<string | null>(null);
  const personaInvocationLatencyRef = useRef<number | undefined>(undefined);
  const vocabularyStateRef = useRef<VocabularyState>(createEmptyVocabularyState());
  const lastRecommendationTurnRef = useRef<number | null>(null);
  const recommendationOfferedAtMsRef = useRef<number | null>(null);
  const messagesRef = useRef<Cat100Message[]>([]);
  const calledPersonaIdsRef = useRef<string[]>([]);
  // Per-call mini-dialogue length, picked when persona opens (2 or 3, per proposal).
  const currentExpectedTurnsRef = useRef<number>(2);
  const [currentRecommendation, setCurrentRecommendation] =
    useState<ActiveRecommendation | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsChatReady(false);
    setPhase('initializing');
    const resuming = Array.isArray(resumeMessages) && resumeMessages.length > 0;
    initializeCat100Chat(language, scenario, initialPosition).then(async success => {
      if (cancelled) return;
      setIsChatReady(success);
      setPhase(success ? 'in_facilitator' : 'idle');
      if (!success) return;

      // RESUME: rehydrate the saved transcript, re-seed the model history so the
      // dialogue continues coherently, and skip the fresh facilitator opening.
      if (resuming) {
        const saved = resumeMessages as Cat100Message[];
        setMessages(saved);
        messagesRef.current = saved;
        const personaIds = Array.from(
          new Set<string>(
            saved.filter(m => m.speaker === 'persona' && m.personaId).map(m => m.personaId as string)
          )
        );
        setCalledPersonaIds(personaIds);
        calledPersonaIdsRef.current = personaIds;
        overallTurnRef.current = saved.reduce((mx, m) => Math.max(mx, m.turnNumber || 0), 0);
        seedCat100History(
          saved
            .filter(m => m.speaker !== 'system')
            .map(m => ({
              role: (m.speaker === 'learner' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.text,
            }))
        );
        if (logContext) {
          logCat100Event('CAT100_SESSION_RESUME', logContext, {
            scenarioId: scenario.id,
            condition: condition ?? ('learner_directed' as StudyCondition),
            extra: { resumedMessageCount: saved.length },
          });
        }
        return;
      }

      if (logContext) {
        logCat100Event('CAT100_SESSION_START', logContext, {
          scenarioId: scenario.id,
          condition: condition ?? ('learner_directed' as StudyCondition),
          initialPosition: initialPosition ?? undefined,
        });
      }

      if (initialPosition) {
        const openingId = id('facilitator-opening');
        setMessages(prev => [
          ...prev,
          {
            id: openingId,
            speaker: 'facilitator',
            text: '...',
            timestamp: now(),
            turnNumber: 0,
          },
        ]);
        setIsLoading(true);
        try {
          let full = '';
          const stream = streamCat100Chat('', {
            mode: 'facilitator_opening',
            initialPosition,
          });
          for await (const chunk of stream) {
            if (cancelled) break;
            full += chunk ?? '';
            setMessages(prev =>
              prev.map(m => (m.id === openingId ? { ...m, text: full + '...' } : m))
            );
          }
          if (!cancelled) {
            setMessages(prev =>
              prev.map(m => (m.id === openingId ? { ...m, text: full || '(opening unavailable)' } : m))
            );
          }
        } catch (error) {
          if (!cancelled) {
            setMessages(prev =>
              prev.map(m => (m.id === openingId ? { ...m, text: 'Welcome — feel free to share your opening thought.' } : m))
            );
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      }
    });
    return () => {
      cancelled = true;
      resetCat100Chat();
    };
  }, [language, scenario.id, initialPosition?.recordedAt]);

  const appendMessage = useCallback((message: Cat100Message) => {
    setMessages(prev => {
      const next = [...prev, message];
      messagesRef.current = next;
      return next;
    });
  }, []);

  const updateMessage = useCallback((messageId: string, patch: Partial<Cat100Message>) => {
    setMessages(prev => {
      const next = prev.map(m => (m.id === messageId ? { ...m, ...patch } : m));
      messagesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    calledPersonaIdsRef.current = calledPersonaIds;
  }, [calledPersonaIds]);

  const maybeFireRecommendation = useCallback(() => {
    if (condition !== StudyCondition.AI_RECOMMENDED) return;
    if (currentRecommendation) return;
    if (calledPersonaIdsRef.current.length >= scenario.personas.length) return;

    const gateOpen = isRecommendationGateOpen({
      facilitatorTurnNumber: overallTurnRef.current,
      lastRecommendationTurn: lastRecommendationTurnRef.current,
    });
    if (!gateOpen) return;

    const recentLearnerTurns = messagesRef.current
      .filter(m => m.speaker === 'learner')
      .slice(-3)
      .map(m => m.text);

    const result = evaluateRecommendation({
      scenario,
      recentLearnerTurns,
      calledPersonaIds: calledPersonaIdsRef.current,
    });
    if (!result) return;

    const persona = scenario.personas.find(p => p.id === result.personaId);
    if (!persona) return;

    const active: ActiveRecommendation = {
      personaId: persona.id,
      personaName: persona.name,
      triggerRule: result.triggerRule,
      rationale: result.rationale,
      recommendedAt: now(),
      turnNumber: overallTurnRef.current,
    };
    setCurrentRecommendation(active);
    lastRecommendationTurnRef.current = overallTurnRef.current;
    recommendationOfferedAtMsRef.current = Date.now();

    appendMessage({
      id: id('rec'),
      speaker: 'facilitator',
      text: result.rationale,
      timestamp: now(),
      turnNumber: overallTurnRef.current,
      recommendationPersonaId: persona.id,
      recommendationPersonaName: persona.name,
      recommendationTriggerRule: result.triggerRule,
    });

    if (logContext) {
      logCat100Event('CAT100_PERSONA_RECOMMENDED', logContext, {
        scenarioId: scenario.id,
        condition,
        turnNumber: overallTurnRef.current,
        personaId: persona.id,
        triggerRule: result.triggerRule,
        rationale: result.rationale,
      });
    }
  }, [appendMessage, condition, currentRecommendation, logContext, scenario]);

  const trackVocabulary = useCallback(
    (text: string, turnNumber: number) => {
      const result = detectVocabulary({
        text,
        turnNumber,
        recentlyExitedPersonaId,
        state: vocabularyStateRef.current,
      });
      if (result.newlyEmerged.length === 0) return;
      vocabularyStateRef.current = result.state;
      setVocabularyEmergences(result.state.emergences);
      if (logContext) {
        result.newlyEmerged.forEach(emergence => {
          logCat100Event('CAT100_VOCABULARY_EMERGED', logContext, {
            scenarioId: scenario.id,
            condition: condition ?? ('learner_directed' as StudyCondition),
            turnNumber,
            vocabularyEmergence: emergence,
          });
        });
      }
    },
    [condition, logContext, recentlyExitedPersonaId, scenario.id]
  );

  const streamFacilitatorReturn = useCallback(
    async (persona: Persona) => {
      const botId = id('facilitator-return');
      appendMessage({
        id: botId,
        speaker: 'facilitator',
        text: '...',
        timestamp: now(),
        turnNumber: overallTurnRef.current,
      });
      try {
        let full = '';
        const stream = streamCat100Chat('', {
          mode: 'facilitator_return',
          persona,
        });
        for await (const chunk of stream) {
          full += chunk ?? '';
          updateMessage(botId, { text: full + '...' });
        }
        updateMessage(botId, { text: full || '(facilitator response unavailable)' });
        if (logContext) {
          logCat100Event('CAT100_PERSONA_EXITED', logContext, {
            scenarioId: scenario.id,
            condition: condition ?? ('learner_directed' as StudyCondition),
            turnNumber: overallTurnRef.current,
            personaId: persona.id,
            miniDialogueTurnCount: personaTurnRef.current,
          });
        }
      } catch (error) {
        updateMessage(botId, { text: 'Facilitator could not return. Please continue.' });
      }
    },
    [appendMessage, condition, logContext, scenario.id, updateMessage]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !isChatReady) return;

      overallTurnRef.current += 1;
      const turnNumber = overallTurnRef.current;
      const learnerMsg: Cat100Message = {
        id: id('learner'),
        speaker: 'learner',
        text: trimmed,
        timestamp: now(),
        turnNumber,
      };
      appendMessage(learnerMsg);
      setIsLoading(true);

      const inPersona = phase === 'in_persona' && activePersona !== null;
      if (inPersona) personaTurnRef.current += 1;

      trackVocabulary(trimmed, turnNumber);

      const speakerSlot: Cat100Message = inPersona
        ? {
            id: id('persona-reply'),
            speaker: 'persona',
            personaId: activePersona!.id,
            personaName: activePersona!.name,
            text: '...',
            timestamp: now(),
            turnNumber,
          }
        : {
            id: id('facilitator'),
            speaker: 'facilitator',
            text: '...',
            timestamp: now(),
            turnNumber,
          };
      appendMessage(speakerSlot);

      try {
        const stream = streamCat100Chat(trimmed, {
          mode: inPersona ? 'persona' : 'facilitator',
          persona: inPersona ? activePersona! : undefined,
          personaTurnNumber: inPersona ? personaTurnRef.current : undefined,
          expectedPersonaTurns: currentExpectedTurnsRef.current,
        });
        let full = '';
        for await (const chunk of stream) {
          full += chunk ?? '';
          updateMessage(speakerSlot.id, { text: full + '...' });
        }
        updateMessage(speakerSlot.id, { text: full || '(no response)' });

        if (logContext) {
          logCat100Event('CAT100_PERSONA_TURN', logContext, {
            scenarioId: scenario.id,
            condition: condition ?? ('learner_directed' as StudyCondition),
            turnNumber,
            personaId: inPersona ? activePersona!.id : undefined,
          });
        }

        // Mini-dialogue exit check
        if (inPersona && personaTurnRef.current >= currentExpectedTurnsRef.current) {
          const exitedPersona = activePersona!;
          const enteredAt = personaEnteredAtRef.current ?? now();
          const exitedAt = now();
          const callEvent: PersonaCallEvent = {
            personaId: exitedPersona.id,
            source:
              condition === ('ai_recommended' as StudyCondition)
                ? 'ai_recommended_then_opened'
                : 'learner_clicked',
            turnNumber,
            openLatencyMs: personaInvocationLatencyRef.current,
            miniDialogueTurnCount: personaTurnRef.current,
            enteredAt,
            exitedAt,
          };
          setPersonaCallEvents(prev => [...prev, callEvent]);
          setRecentlyExitedPersonaId(exitedPersona.id);
          setActivePersona(null);
          personaTurnRef.current = 0;
          personaEnteredAtRef.current = null;
          personaInvocationLatencyRef.current = undefined;
          setPhase('in_facilitator_return');
          await streamFacilitatorReturn(exitedPersona);
          setPhase('in_facilitator');
        }

        // After any facilitator turn (i.e., not in persona) in AR mode, evaluate.
        if (!inPersona && condition === StudyCondition.AI_RECOMMENDED) {
          maybeFireRecommendation();
        }
      } catch (error) {
        updateMessage(speakerSlot.id, {
          text: 'Sorry, something went wrong. Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      activePersona,
      appendMessage,
      condition,
      expectedPersonaTurns,
      isChatReady,
      isLoading,
      logContext,
      maybeFireRecommendation,
      phase,
      scenario.id,
      streamFacilitatorReturn,
      trackVocabulary,
      updateMessage,
    ]
  );

  const openPersona = useCallback(
    async (persona: Persona) => {
      if (isLoading || !isChatReady) return;
      if (activePersona) return;
      if (calledPersonaIds.includes(persona.id)) return;

      const acceptedRec =
        currentRecommendation?.personaId === persona.id ? currentRecommendation : null;
      const latencyMs =
        acceptedRec && recommendationOfferedAtMsRef.current !== null
          ? Date.now() - recommendationOfferedAtMsRef.current
          : undefined;

      setActivePersona(persona);
      setCalledPersonaIds(prev => [...prev, persona.id]);
      personaTurnRef.current = 0;
      personaEnteredAtRef.current = now();
      personaInvocationLatencyRef.current = latencyMs;
      // Pick this call's mini-dialogue length (proposal: "2-3 turns").
      currentExpectedTurnsRef.current = pickPersonaTurns();
      setPhase('in_persona');
      setRecentlyExitedPersonaId(undefined);
      if (acceptedRec) {
        setCurrentRecommendation(null);
        recommendationOfferedAtMsRef.current = null;
      }

      appendMessage({
        id: id('system-join'),
        speaker: 'system',
        personaId: persona.id,
        personaName: persona.name,
        text: `${persona.name} (${persona.role}) joined the conversation.`,
        timestamp: now(),
        turnNumber: overallTurnRef.current,
      });

      if (logContext) {
        logCat100Event('CAT100_PERSONA_OPENED', logContext, {
          scenarioId: scenario.id,
          condition: condition ?? StudyCondition.LEARNER_DIRECTED,
          turnNumber: overallTurnRef.current,
          personaId: persona.id,
          triggerRule: acceptedRec?.triggerRule,
          personaOpenLatencyMs: latencyMs,
        });
      }

      // Persona opening turn (does not count toward expectedPersonaTurns)
      const openingId = id('persona-opening');
      appendMessage({
        id: openingId,
        speaker: 'persona',
        personaId: persona.id,
        personaName: persona.name,
        text: '...',
        timestamp: now(),
        turnNumber: overallTurnRef.current,
      });
      setIsLoading(true);
      try {
        const stream = streamCat100Chat(
          `(You are entering the conversation. Greet the learner in 2 short sentences staying entirely in character. Don't ask a probing question yet.)`,
          {
            mode: 'persona',
            persona,
            personaTurnNumber: 0,
            expectedPersonaTurns: currentExpectedTurnsRef.current,
          }
        );
        let full = '';
        for await (const chunk of stream) {
          full += chunk ?? '';
          updateMessage(openingId, { text: full + '...' });
        }
        updateMessage(openingId, { text: full || `(${persona.name} is here.)` });
      } catch (error) {
        updateMessage(openingId, { text: `${persona.name} couldn't speak right now.` });
      } finally {
        setIsLoading(false);
      }
    },
    [
      activePersona,
      appendMessage,
      calledPersonaIds,
      condition,
      currentRecommendation,
      expectedPersonaTurns,
      isChatReady,
      isLoading,
      logContext,
      scenario.id,
      updateMessage,
    ]
  );

  const acceptRecommendation = useCallback(async () => {
    const rec = currentRecommendation;
    if (!rec) return;
    const persona = scenario.personas.find(p => p.id === rec.personaId);
    if (!persona) return;
    await openPersona(persona);
  }, [currentRecommendation, openPersona, scenario.personas]);

  // ensure isChatReady reflects underlying client state if hot-reloaded
  useEffect(() => {
    if (isChatReady && !isCat100ChatInitialized()) {
      setIsChatReady(false);
    }
  }, [isChatReady]);

  return {
    messages,
    activePersona,
    calledPersonaIds,
    isChatReady,
    isLoading,
    phase,
    personaCallEvents,
    vocabularyEmergences,
    recentlyExitedPersonaId,
    currentRecommendation,
    sendMessage,
    openPersona,
    acceptRecommendation,
  };
};

import type {
  StudyCondition,
  TriggerRule,
  PositionInput,
  PrePostDelta,
  VocabularyEmergence,
  PersonaCallEvent,
  LogEventType,
} from '../types';
import * as loggingService from './loggingService';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type Cat100EventType =
  | 'CAT100_SESSION_START'
  | 'CAT100_INITIAL_POSITION'
  | 'CAT100_PERSONA_RECOMMENDED'
  | 'CAT100_PERSONA_OPENED'
  | 'CAT100_PERSONA_TURN'
  | 'CAT100_PERSONA_EXITED'
  | 'CAT100_VOCABULARY_EMERGED'
  | 'CAT100_CLOSING_POSITION'
  | 'CAT100_SESSION_COMPLETE';

export interface Cat100LogPayload {
  scenarioId: string;
  condition: StudyCondition;
  turnNumber?: number;
  personaId?: string;
  triggerRule?: TriggerRule;
  personaOpenLatencyMs?: number;
  miniDialogueTurnCount?: number;
  initialPosition?: PositionInput;
  closingPosition?: PositionInput;
  delta?: PrePostDelta;
  vocabularyEmergence?: VocabularyEmergence;
  personaCallEvent?: PersonaCallEvent;
  rationale?: string;
  extra?: Record<string, unknown>;
}

export interface Cat100LogContext {
  userFullName: string;
  course: string;
  sessionId: number | null;
}

const SHEETS_API_URL = 'https://sheets-api-function-515497328571.europe-west1.run.app/';

const sendToSheets = async (logObj: Record<string, unknown>) => {
  try {
    await fetch(SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logObj),
    });
  } catch {
    /* fire-and-forget */
  }
};

const insertIntoCat100Events = async (
  eventType: Cat100EventType,
  context: Cat100LogContext,
  payload: Cat100LogPayload
) => {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await (supabase as any)
      .from('cat100_events')
      .insert([
        {
          session_id: context.sessionId,
          participant_id: context.userFullName,
          course: context.course,
          scenario_id: payload.scenarioId ?? null,
          condition: payload.condition ?? null,
          event_type: eventType,
          details_json: payload,
        },
      ]);
    if (error) {
      // RLS or schema issues — silently fall back to Sheets-only.
      if (import.meta.env.DEV) {
        console.warn('[cat100Logging] Supabase insert failed:', error.message);
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[cat100Logging] Supabase insert threw:', err);
    }
  }
};

export const logCat100Event = (
  eventType: Cat100EventType,
  context: Cat100LogContext,
  payload: Cat100LogPayload
) => {
  // 1) Local in-memory session log (for downloadSessionData).
  loggingService.addLog(eventType as unknown as LogEventType, payload);

  // 2) Sheets API — primary research data sink, works for any participant.
  void sendToSheets({
    logType: eventType,
    userName: context.userFullName,
    userCourse: context.course,
    userMessage: null,
    botResponse: null,
    details_json: { ...payload, sessionId: context.sessionId },
  });

  // 3) Supabase cat100_events — anon-insert RLS allows URL-based participants
  //    to land directly in the research database without auth.
  void insertIntoCat100Events(eventType, context, payload);
};

export const logCat100MessageExchange = (
  context: Cat100LogContext,
  userMessage: string,
  botResponse: string,
  payload: Cat100LogPayload & { activePersonaId?: string }
) => {
  void sendToSheets({
    logType: 'CAT100_MESSAGE_EXCHANGE',
    userName: context.userFullName,
    userCourse: context.course,
    userMessage,
    botResponse,
    details_json: { ...payload, sessionId: context.sessionId },
  });

  void insertIntoCat100Events('CAT100_PERSONA_TURN' as Cat100EventType, context, {
    ...payload,
    extra: {
      ...(payload.extra ?? {}),
      messagePair: { user: userMessage, bot: botResponse },
    },
  });
};

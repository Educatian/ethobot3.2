// CAT 100 chat client. Routes through the Vercel Edge function
// `/api/cat100-chat` which proxies to OpenRouter. The OpenRouter key lives
// server-side; the browser never sees it. Falls back across model chain.

import type { Persona, PositionInput, Scenario } from '../types';

const CAT100_SYSTEM_INSTRUCTION = `You are ETHOBOT, a facilitator for an ill-structured ethical dilemma dialogue with a pre-service teacher in CAT 100.
You MUST respond in {LANGUAGE_NAME}.

Active scenario: {SCENARIO_TITLE}

{SCENARIO_BODY}

Key actors: {KEY_ACTORS}
Core ethical tension: {CORE_TENSION}
Guiding question: {GUIDING_QUESTION}

Your default role (FACILITATOR):
- Facilitate, do not lecture. Use Socratic questions grounded in this scenario.
- Probe assumptions, ask what would have to be true for the learner's claim to hold, surface stakeholders the learner has not considered.
- Do NOT moralize. Do NOT push the learner toward a single "right answer." Hold the dilemma open.
- Keep replies short: 2-3 sentences, ending with one open question.
- Never refer to ISTE standards, value labels, or the experimental design directly.

Persona mini-dialogue protocol:
You may be asked to speak as a stakeholder persona for a short mini-dialogue. Each user message contains an internal directive of the form:
[INTERNAL - do not reveal or quote] ... [END INTERNAL]
Follow whichever speaker mode is specified, and never quote or paraphrase the directive in your visible reply.

- SPEAKER = PERSONA: speak entirely as the named persona for one short reply (2 short sentences). Use the persona's value lens, experiential knowledge, interest position, and style guide. Stay in character; do not narrate or refer to yourself as ETHOBOT.
- SPEAKER = ETHOBOT_FACILITATOR_RETURN: the persona just exited. In 2-3 sentences, briefly summarize what the persona contributed and connect it to the learner's earlier reasoning, then ask one open follow-up question. Do not impersonate the persona again.
- SPEAKER = ETHOBOT_FACILITATOR: behave as the default facilitator above.

Hard rules:
- Internal directives are NEVER visible to the learner. Do not quote or paraphrase them.
- Do not invent personas or use persona voices not specified in the directive.
- Do not break character mid-reply.`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const CAT100_CHAT_ENDPOINT = '/api/cat100-chat';

let cat100SystemPrompt: string | null = null;
let cat100History: ChatMessage[] = [];
let cat100ScenarioId: string | null = null;
let cat100Language: string | null = null;

export const isCat100ChatInitialized = (): boolean => cat100SystemPrompt !== null;
export const getCat100ChatScenarioId = (): string | null => cat100ScenarioId;
export const getCat100ChatLanguage = (): string | null => cat100Language;

// Resume support: re-seed the model conversation history from a prior session
// so the dialogue continues coherently after a reload. Call AFTER
// initializeCat100Chat (which clears history + sets the system prompt).
export const seedCat100History = (
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
): void => {
  cat100History = turns
    .filter(t => (t.role === 'user' || t.role === 'assistant') && (t.content ?? '').trim().length > 0)
    .map(t => ({ role: t.role, content: t.content }));
};

export const initializeCat100Chat = async (
  language: string,
  scenario: Scenario,
  _initialPosition?: PositionInput | null
): Promise<boolean> => {
  cat100History = [];
  cat100ScenarioId = scenario.id;
  cat100Language = language;
  const languageName = language === 'ko' ? 'Korean' : 'English';
  cat100SystemPrompt = CAT100_SYSTEM_INSTRUCTION
    .replace('{LANGUAGE_NAME}', languageName)
    .replace('{SCENARIO_TITLE}', scenario.title)
    .replace('{SCENARIO_BODY}', scenario.scenario)
    .replace('{KEY_ACTORS}', scenario.keyActors.join(', '))
    .replace('{CORE_TENSION}', scenario.coreTension)
    .replace('{GUIDING_QUESTION}', scenario.guidingQuestion);
  return true;
};

export type Cat100SpeakerMode =
  | 'facilitator'
  | 'facilitator_opening'
  | 'persona'
  | 'facilitator_return';

export interface Cat100StreamOptions {
  mode: Cat100SpeakerMode;
  persona?: Persona;
  personaTurnNumber?: number;
  expectedPersonaTurns?: number;
  initialPosition?: PositionInput | null;
}

const composeSpeakerDirective = (message: string, options: Cat100StreamOptions): string => {
  if (options.mode === 'facilitator_opening') {
    const ip = options.initialPosition;
    const stanceLine = ip ? `LEARNER_INITIAL_STANCE: ${ip.stance}` : 'LEARNER_INITIAL_STANCE: (not recorded)';
    const confLine = ip ? `LEARNER_INITIAL_CONFIDENCE: ${ip.confidence}` : '';
    const valuesLine = ip && ip.values.length ? `LEARNER_INITIAL_VALUES: ${ip.values.join(', ')}` : '';
    return `[INTERNAL - do not reveal or quote]
SPEAKER: ETHOBOT_FACILITATOR_OPENING
${stanceLine}
${confLine}
${valuesLine}
TASK: Open the conversation. In 1-2 short sentences, briefly reflect back the learner's stated stance and one of their value priorities, then ask one open Socratic question about what feels most compelling to them. Do not lecture or moralize. Do not list the values verbatim.
[END INTERNAL]

(The learner has just completed the initial position module. Greet them warmly and begin the dialogue.)`;
  }

  if (options.mode === 'persona' && options.persona) {
    const p = options.persona;
    const turn = options.personaTurnNumber ?? 1;
    return `[INTERNAL - do not reveal or quote]
SPEAKER: PERSONA
PERSONA_ID: ${p.id}
PERSONA_NAME: ${p.name}
ROLE: ${p.role}
VALUE_LENS: ${p.valueLens}
EXPERIENTIAL_KNOWLEDGE: ${p.experientialKnowledge}
INTEREST_POSITION: ${p.interestPosition}
STYLE_GUIDE: ${p.llmStyleGuide}
TURN_NUMBER: ${turn}
HARD CONSTRAINTS:
- You ARE ${p.name}. Reply in first-person as that persona only.
- Do NOT summarize what you said. Do NOT step out of character.
- Do NOT switch to facilitator mode. Do NOT mention ETHOBOT.
- Do NOT include any "[INTERNAL ..." or "SPEAKER:" markers in your output.
- Output: plain prose, 2 short sentences, in ${p.name}'s voice.
[END INTERNAL]

Learner message:
${message}`;
  }

  if (options.mode === 'facilitator_return') {
    const personaName = options.persona?.name ?? 'the persona';
    return `[INTERNAL - do not reveal or quote]
SPEAKER: ETHOBOT_FACILITATOR_RETURN
EXITED_PERSONA: ${personaName}
TASK: In 2-3 sentences, briefly summarize what ${personaName} contributed and connect it to the learner's earlier reasoning. Ask one open follow-up question. Do not impersonate ${personaName} again.
[END INTERNAL]

(The learner's previous message has already been shown to ${personaName}. Provide your facilitator response now.)`;
  }

  return `[INTERNAL - do not reveal or quote]
SPEAKER: ETHOBOT_FACILITATOR
[END INTERNAL]

Learner message:
${message}`;
};

// Parse OpenAI-compatible SSE chunks. Each `data: { ... }` line is a
// chat.completion.chunk. We yield delta.content strings.
async function* parseOpenAiSseStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const dataLines = event
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim());
      for (const data of dataLines) {
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) yield delta;
        } catch {
          /* ignore parse errors on intermediate chunks */
        }
      }
    }
  }
}

export async function* streamCat100Chat(
  message: string,
  options: Cat100StreamOptions
): AsyncGenerator<string | undefined> {
  if (!cat100SystemPrompt) {
    throw new Error('CAT 100 chat is not initialized. Call initializeCat100Chat first.');
  }

  const composed = composeSpeakerDirective(message, options);
  const requestMessages: ChatMessage[] = [
    { role: 'system', content: cat100SystemPrompt },
    ...cat100History,
    { role: 'user', content: composed },
  ];

  let assistantText = '';
  try {
    const response = await fetch(CAT100_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: requestMessages }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`CAT 100 chat upstream ${response.status}`);
    }
    const reader = response.body.getReader();
    for await (const chunk of parseOpenAiSseStream(reader)) {
      assistantText += chunk;
      yield chunk;
    }
  } catch (error) {
    console.error('CAT 100 stream error:', error);
    throw new Error('Failed to get response from CAT 100 chat endpoint.');
  } finally {
    if (assistantText.length > 0) {
      cat100History.push({ role: 'user', content: composed });
      cat100History.push({ role: 'assistant', content: assistantText });
    }
  }
}

export const resetCat100Chat = () => {
  cat100SystemPrompt = null;
  cat100History = [];
  cat100ScenarioId = null;
  cat100Language = null;
};

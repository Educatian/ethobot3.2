// Simulates the proposal's Scenario A Learner-directed example dialogue
// against the real Gemini API using the same system prompt + speaker directives
// shipped in services/cat100Chat.ts. Run from project root:
//   node scripts/simulate_proposal_ld.mjs

import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = fs.readFileSync(path.join(repoRoot, '.env.local'), 'utf-8');
const apiKey = envFile.match(/VITE_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) {
  console.error('Missing VITE_GEMINI_API_KEY in .env.local');
  process.exit(1);
}

const scenarios = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'public/data/scenarios.json'), 'utf-8')
);
const scenario = scenarios.find(s => s.id === 'scenario_a_classroom_monitoring');
const jordan = scenario.personas.find(p => p.id === 'scenario_a_jordan');
const mrPark = scenario.personas.find(p => p.id === 'scenario_a_mr_park');

const SYSTEM_PROMPT = `You are ETHOBOT, a facilitator for an ill-structured ethical dilemma dialogue with a pre-service teacher in CAT 100.
You MUST respond in English.

Active scenario: ${scenario.title}

${scenario.scenario}

Key actors: ${scenario.keyActors.join(', ')}
Core ethical tension: ${scenario.coreTension}
Guiding question: ${scenario.guidingQuestion}

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

function dirOpening(ip) {
  return `[INTERNAL - do not reveal or quote]
SPEAKER: ETHOBOT_FACILITATOR_OPENING
LEARNER_INITIAL_STANCE: ${ip.stance}
LEARNER_INITIAL_CONFIDENCE: ${ip.confidence}
LEARNER_INITIAL_VALUES: ${ip.values.join(', ')}
TASK: Open the conversation. In 1-2 short sentences, briefly reflect back the learner's stated stance and one of their value priorities, then ask one open Socratic question about what feels most compelling to them. Do not lecture or moralize. Do not list the values verbatim.
[END INTERNAL]

(The learner has just completed the initial position module. Greet them warmly and begin the dialogue.)`;
}

function dirFacilitator(message) {
  return `[INTERNAL - do not reveal or quote]
SPEAKER: ETHOBOT_FACILITATOR
[END INTERNAL]

Learner message:
${message}`;
}

function dirPersona(persona, message, turn, expected) {
  return `[INTERNAL - do not reveal or quote]
SPEAKER: PERSONA
PERSONA_ID: ${persona.id}
PERSONA_NAME: ${persona.name}
ROLE: ${persona.role}
VALUE_LENS: ${persona.valueLens}
EXPERIENTIAL_KNOWLEDGE: ${persona.experientialKnowledge}
INTEREST_POSITION: ${persona.interestPosition}
STYLE_GUIDE: ${persona.llmStyleGuide}
TURN: ${turn} of ${expected}
[END INTERNAL]

Learner message:
${message}`;
}

function dirReturn(persona) {
  return `[INTERNAL - do not reveal or quote]
SPEAKER: ETHOBOT_FACILITATOR_RETURN
EXITED_PERSONA: ${persona.name}
TASK: In 2-3 sentences, briefly summarize what ${persona.name} contributed and connect it to the learner's earlier reasoning. Ask one open follow-up question. Do not impersonate ${persona.name} again.
[END INTERNAL]

(The learner's previous message has already been shown to ${persona.name}. Provide your facilitator response now.)`;
}

const ai = new GoogleGenAI({ apiKey });
const chat = ai.chats.create({
  model: 'gemini-2.0-flash',
  config: { systemInstruction: SYSTEM_PROMPT },
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function send(directive, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await chat.sendMessageStream({ message: directive });
      let full = '';
      for await (const chunk of result) {
        full += chunk.text ?? '';
      }
      await sleep(7000); // pace under Flash free-tier 10 RPM ceiling
      return full.trim();
    } catch (error) {
      if (error?.status === 429 && attempt < retries) {
        const wait = 30000 * (attempt + 1);
        console.error(`  rate limited; backing off ${wait/1000}s (attempt ${attempt+1}/${retries})`);
        await sleep(wait);
        continue;
      }
      throw error;
    }
  }
}

function divider(label) {
  console.log('\n' + '─'.repeat(78));
  console.log(label);
  console.log('─'.repeat(78));
}

const initialPosition = {
  stance: 'support',
  confidence: 80,
  values: ['safety', 'accountability'],
};

const learnerScript = {
  facilitator1:
    "It's hard to notice every student in a large class. Early detection could close learning gaps before they widen.",
  facilitator2:
    'For me, an effective tool that flags struggling students is what lets a teacher actually support every student equitably.',
  jordanT1:
    "That's not what I expected to hear. I assumed students would mostly forget the camera was there.",
  jordanT2:
    'It sounds like the watching changes how you act, especially for kids who already get extra attention.',
  betweenPersonas:
    'I see how the chilling effect plays out, especially for students who feel watched more often than others.',
  parkT1: 'I think the educational benefit has to be weighed against the consent question.',
  parkT2:
    'If there had been proper notification and opt-out for parents, I might feel differently about it.',
};

try {
  divider('1. ETHOBOT facilitator opens (proposal: "You said you support adopting the tool...")');
  console.log('ETHOBOT:', await send(dirOpening(initialPosition)));

  divider(`2. Learner turn 1 → "${learnerScript.facilitator1}"`);
  console.log('ETHOBOT:', await send(dirFacilitator(learnerScript.facilitator1)));

  divider(`3. Learner turn 2 → "${learnerScript.facilitator2}"`);
  console.log('ETHOBOT:', await send(dirFacilitator(learnerScript.facilitator2)));

  divider(`4. Learner clicks Jordan card → persona opening`);
  console.log(
    'Jordan:',
    await send(dirPersona(jordan, '(You are entering the conversation. Greet the learner in 2 short sentences staying entirely in character. Do not ask a probing question yet.)', 0, 2))
  );

  divider(`5. Learner → Jordan, turn 1 → "${learnerScript.jordanT1}"`);
  console.log('Jordan:', await send(dirPersona(jordan, learnerScript.jordanT1, 1, 2)));

  divider(`6. Learner → Jordan, turn 2 (last) → "${learnerScript.jordanT2}"`);
  console.log('Jordan:', await send(dirPersona(jordan, learnerScript.jordanT2, 2, 2)));

  divider('7. Facilitator return after Jordan exits');
  console.log('ETHOBOT:', await send(dirReturn(jordan)));

  divider(`8. Learner continues → "${learnerScript.betweenPersonas}"`);
  console.log('ETHOBOT:', await send(dirFacilitator(learnerScript.betweenPersonas)));

  divider(`9. Learner clicks Mr. Park card → persona opening`);
  console.log(
    'Mr. Park:',
    await send(dirPersona(mrPark, '(You are entering the conversation. Greet the learner in 2 short sentences staying entirely in character. Do not ask a probing question yet.)', 0, 2))
  );

  divider(`10. Learner → Mr. Park, turn 1 → "${learnerScript.parkT1}"`);
  console.log('Mr. Park:', await send(dirPersona(mrPark, learnerScript.parkT1, 1, 2)));

  divider(`11. Learner → Mr. Park, turn 2 (last) → "${learnerScript.parkT2}"`);
  console.log('Mr. Park:', await send(dirPersona(mrPark, learnerScript.parkT2, 2, 2)));

  divider('12. Facilitator return after Mr. Park exits');
  console.log('ETHOBOT:', await send(dirReturn(mrPark)));

  divider('Done.');
} catch (error) {
  console.error('Simulation error:', error);
  process.exit(1);
}

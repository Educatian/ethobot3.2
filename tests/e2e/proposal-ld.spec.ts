import {
  test,
  expect,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Proposal coverage map
// =============================================================================
// Each proposal requirement → which test verifies it.
// All references are to "Ethobot update proposal.docx".
//
// Section "Overview" — three persona properties (value lens / experiential
//   knowledge / interest position) ............................. proposal-data-fidelity
// Section "Two scaffolding conditions" ......................... ld-full-arc-scenario-a,
//                                                                ar-condition-disabled
// Section "Course alignment with CAT 100" (ISTE 2.3.a–d) ....... proposal-data-fidelity
// Section "Dilemma scenarios for CAT 100"
//   Scenario A AI classroom monitoring ........................ ld-full-arc-scenario-a,
//                                                                all-four-personas-scenario-a
//   Scenario B Free EdTech app ................................ ld-full-arc-scenario-b
// "Initial position input module" .............................. ld-full-arc-scenario-a,
//                                                                pre-form-validation
//   stance support/oppose/unsure .............................. pre-form-validation
//   confidence slider 0–100% .................................. ld-full-arc-scenario-a
//   value priority selection (6 values) ....................... pre-form-validation
// "Pre-post self report" ....................................... ld-full-arc-scenario-a
//   stance shift / confidence calibration / value priority change
// "Mini-dialogue 2–3 turns" .................................... ld-full-arc-scenario-a
// "Persona joins / steps out / facilitator resumes" ............ ld-full-arc-scenario-a
// "Personas not yet called priority" ........................... repeat-persona-guard
// "User flow example (LD)" ..................................... ld-full-arc-scenario-a
//   Initial: support 80% Safety+Accountability
//   Final: unsure 50% Privacy+Fairness+Safety
// AR condition recommendation engine (rule 1/2/3, gating) ...... ⚠ DEFERRED to Wave 3 12-15
//   (UI shell verified — cards disabled in AR ................ ar-condition-disabled)
// No console errors during real student journey ................ no-console-errors-during-arc
// Existing root flow regression ................................ root-regression

// =============================================================================
// Helpers
// =============================================================================

// OpenAI-compatible SSE chunk (matches OpenRouter format).
const sseChunk = (text: string): string => {
  const payload = JSON.stringify({
    choices: [{ delta: { content: text } }],
  });
  return `data: ${payload}\n\ndata: [DONE]\n\n`;
};

const lastUserText = (postBody: any): string => {
  const messages: any[] = postBody?.messages ?? [];
  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
  return lastUser?.content ?? '';
};

// Deterministic canned LLM responses keyed by speaker directive content.
// Mirrors proposal narrative arcs for both scenarios.
const responseFor = (postBody: any): string => {
  const message = lastUserText(postBody);

  if (message.includes('SPEAKER: ETHOBOT_FACILITATOR_OPENING')) {
    if (/LEARNER_INITIAL_STANCE: support/.test(message)) {
      return "Welcome — I see you're leaning toward adopting the tool, with student well-being in mind. What feels most compelling about that approach for you?";
    }
    if (/LEARNER_INITIAL_STANCE: oppose/.test(message)) {
      return "Welcome — you're leaning against this, and you've put privacy at the front. What worries you most about going ahead with it?";
    }
    return 'Welcome. Walk me through where your thinking currently sits.';
  }

  if (message.includes('SPEAKER: PERSONA')) {
    // Scenario A personas
    if (/PERSONA_NAME: Jordan/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "Hi, I'm Jordan. I'm in one of the pilot classes — the camera kind of changes how I sit.";
      if (/TURN_NUMBER: 1/.test(message))
        return "Some of my friends forget about it. The kids who already get noticed don't forget.";
      if (/TURN_NUMBER: 2/.test(message))
        return "Yeah. Even when I'm just thinking, I keep my face neutral now.";
      return "I'd rather not say more.";
    }
    if (/PERSONA_NAME: Mr\. Park/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "I'm Jordan's father. Quick question — when did you decide that my son's facial expressions were data the school could collect?";
      if (/TURN_NUMBER: 1/.test(message))
        return "My son is twelve. He can't legally consent. So who actually did?";
      if (/TURN_NUMBER: 2/.test(message))
        return 'If a notification letter had come home, that would be a different conversation.';
      return 'Hmm.';
    }
    if (/PERSONA_NAME: Ms\. Rivera/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "Hi, I'm Ms. Rivera — I teach the class. Honestly, I have thirty kids and I miss things.";
      if (/TURN_NUMBER: 1/.test(message))
        return 'When the tool flags someone, I can actually circle back. Without it, that kid waits.';
      if (/TURN_NUMBER: 2/.test(message))
        return "I hear that. But the alternative is a kid going under the radar for weeks.";
      return 'Mm.';
    }
    if (/PERSONA_NAME: Dr\. Lee/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "I'm Dr. Lee, the district administrator. The board wants evidence of data-driven practice.";
      if (/TURN_NUMBER: 1/.test(message))
        return 'We measure outcomes at the district level. Individual classroom variation gets averaged out.';
      if (/TURN_NUMBER: 2/.test(message))
        return 'These are exactly the kinds of programs that demonstrate accountability to taxpayers.';
      return 'Right.';
    }

    // Scenario B personas
    if (/PERSONA_NAME: Sam/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "Hey! I'm Sam — I love this app, my friends and I check our streaks every day.";
      if (/TURN_NUMBER: 1/.test(message))
        return 'Wait, what? They share my data with advertisers? Nobody told me that part.';
      if (/TURN_NUMBER: 2/.test(message))
        return "Mr. Reyes never said anything when we started using it. I just thought it was free because schools.";
      return 'Hmm.';
    }
    if (/PERSONA_NAME: Ms\. Chen/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "I'm Ms. Chen, Sam's mom. I read the long-form reporting on EdTech data brokers — this is how it starts.";
      if (/TURN_NUMBER: 1/.test(message))
        return 'I would have wanted a heads-up before my child became a record in someone else\'s database.';
      if (/TURN_NUMBER: 2/.test(message))
        return '"De-identified" doesn\'t mean what they say it means at scale. Profiles get rebuilt.';
      return '...';
    }
    if (/PERSONA_NAME: Mr\. Diaz/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "I'm Mr. Diaz, IT Coordinator. Section 4 of our data-sharing policy probably blocks this app.";
      if (/TURN_NUMBER: 1/.test(message))
        return "I can fast-track the review — give me 48 hours, not a permanent block.";
      if (/TURN_NUMBER: 2/.test(message))
        return "Better to wait two days than to roll back deployment after a parent letter goes out.";
      return 'OK.';
    }
    if (/PERSONA_NAME: Alex/.test(message)) {
      if (/TURN_NUMBER: 0/.test(message))
        return "Hi, I'm Alex from the company. Our learning data is fully de-identified — totally industry standard.";
      if (/TURN_NUMBER: 1/.test(message))
        return 'Sharing aggregated insights helps us improve outcomes for kids across the network.';
      if (/TURN_NUMBER: 2/.test(message))
        return 'Look, every modern EdTech vendor does this. Blocking us just means students miss out.';
      return 'Cheers.';
    }
    return '(generic persona reply)';
  }

  if (message.includes('SPEAKER: ETHOBOT_FACILITATOR_RETURN')) {
    if (/EXITED_PERSONA: Jordan/.test(message))
      return "Jordan introduced something you hadn't named yet — how surveillance reshapes student behavior, especially for students already under more scrutiny. How does that fit with your earlier reasoning about support?";
    if (/EXITED_PERSONA: Mr\. Park/.test(message))
      return 'Mr. Park surfaced consent and authority — whether this is acceptable depends on whether families were informed and able to opt out. How does that change the picture for you?';
    if (/EXITED_PERSONA: Ms\. Rivera/.test(message))
      return 'Ms. Rivera reminded us of the teacher\'s constraint — class size and overlooked students. How does that constraint sit alongside the privacy concerns we surfaced?';
    if (/EXITED_PERSONA: Dr\. Lee/.test(message))
      return "Dr. Lee framed this through district accountability and aggregate data. What gets lost when we evaluate at that level instead of the classroom?";
    if (/EXITED_PERSONA: Sam/.test(message))
      return "Sam helped us see the user side — engagement and surprise about data sharing. What does that surprise tell us about consent in practice?";
    if (/EXITED_PERSONA: Ms\. Chen/.test(message))
      return "Ms. Chen put the parent's perspective on the table — informed consent and skepticism about 'de-identified.' How do you weigh that against the engagement gain?";
    if (/EXITED_PERSONA: Mr\. Diaz/.test(message))
      return 'Mr. Diaz introduced policy compliance and a 48-hour review path. Does the timing of the rollout matter as much as the rollout itself?';
    if (/EXITED_PERSONA: Alex/.test(message))
      return 'Alex framed data sharing as industry standard. When a defense relies on "everyone does it," what does that tell you?';
    return 'Where does that leave your reasoning?';
  }

  if (message.includes('SPEAKER: ETHOBOT_FACILITATOR')) {
    if (/large class|notice every|miss/.test(message))
      return "That's a real constraint. What would have to be true about the tool for it to deliver that benefit equitably across every student?";
    if (/equitabl|support every|equitably/.test(message))
      return 'So the case rests on the tool being accurate and even-handed. What if it were not even-handed in practice?';
    if (/chilling|watched|surveillance|dignity/.test(message))
      return 'That nuance is important. Whose voice would help you decide what to do next?';
    if (/consent|notification|opt[- ]?out/.test(message))
      return 'You\'ve named consent as a condition. What would a responsible rollout look like to you now?';
    if (/free app|edtech|de-identif|advertis/.test(message))
      return 'That tradeoff is real — engagement vs. data minimization. Whose interests are most at stake?';
    return 'Tell me more about what makes that reasoning feel solid to you.';
  }

  return 'Tell me more.';
};

const setRangeValue = async (locator: Locator, value: string) => {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (setter) setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

const installGeminiMock = async (page: Page, capturedBodies?: any[]) => {
  // Intercept the new /api/cat100-chat Edge function path.
  await page.route('**/api/cat100-chat', async (route: Route) => {
    let postBody: any = null;
    try {
      postBody = route.request().postDataJSON();
    } catch {
      postBody = null;
    }
    capturedBodies?.push(postBody);
    const text = responseFor(postBody);
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
      },
      body: sseChunk(text),
    });
  });
  // Stub Supabase REST so test runs don't write into the research database.
  // Tests that need to capture Sheets payloads re-route Sheets themselves;
  // we deliberately do NOT stub Sheets here so those captures still work.
  await page.route('**/*.supabase.co/**', async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, body: '' });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '[]',
    });
  });
};

// Capture page-level errors and console.error messages for the lifetime of the test.
// We allow benign errors (Tailwind CDN warning, font preload notices) but fail on real ones.
const captureRuntimeErrors = (page: Page): { errors: string[] } => {
  const errors: string[] = [];
  const benign = [
    /cdn\.tailwindcss/i,
    /preload/i,
    /favicon/i,
    /Download the React DevTools/i,
    // Tests don't stub the Sheets / Supabase logging endpoints — fire-and-forget
    // POSTs return non-200 in the test sandbox. The app catches these silently;
    // the browser still logs the network failure. Not a real JS error.
    /Failed to load resource: the server responded with/i,
  ];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (benign.some(rx => rx.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return { errors };
};

// Realistic student-pace typing.
const studentType = async (input: Locator, text: string, opts?: { delay?: number }) => {
  await input.click();
  await input.fill('');
  await input.pressSequentially(text, { delay: opts?.delay ?? 25 });
};

// "Reading pause" — a few hundred ms between bot replies, like a real student.
const readingPause = (page: Page, ms = 300) => page.waitForTimeout(ms);

interface FillPositionInput {
  stance: 'Support' | 'Oppose' | 'Unsure';
  confidence: string;
  values: string[];
}

const fillPositionForm = async (page: Page, input: FillPositionInput) => {
  await page.getByText(input.stance, { exact: true }).click();
  await setRangeValue(page.locator('input[type="range"]').first(), input.confidence);
  for (const [index, value] of input.values.entries()) {
    await page.getByLabel(`Rank ${value}`).selectOption(String(index + 1));
  }
};

const openPersonaAndCompleteMiniDialogue = async (
  page: Page,
  personaId: string,
  studentLines: { t1: string; t2: string; t3?: string }
) => {
  // Mini-dialogue length is randomized 2-3 per call (per proposal). Send up to
  // 3 turns and break out as soon as the card flips to 'completed'.
  const card = page.locator(`article[data-persona-id="${personaId}"]`);
  await expect(card).toHaveAttribute('data-state', 'idle');
  await card.locator('[data-action="open-persona"]').click();
  await expect(card).toHaveAttribute('data-state', 'active');
  await readingPause(page, 250); // student "reads" persona's self-intro

  const chatInput = page.locator('textarea[placeholder]').first();
  const turns = [studentLines.t1, studentLines.t2, studentLines.t3 ?? "OK, that's helpful — thanks."];
  for (const line of turns) {
    const stateBefore = await card.getAttribute('data-state');
    if (stateBefore === 'completed') break;
    await studentType(chatInput, line);
    await chatInput.press('Enter');
    await readingPause(page, 350);
    const stateAfter = await card.getAttribute('data-state');
    if (stateAfter === 'completed') break;
  }

  await expect(card).toHaveAttribute('data-state', 'completed');
};

// =============================================================================
// Tests
// =============================================================================

test.describe('Proposal fidelity (data + UI)', () => {
  test('proposal-data-fidelity: scenarios.json mirrors proposal text', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const scenariosPath = path.resolve(here, '../..', 'public/data/scenarios.json');
    const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));

    expect(scenarios).toHaveLength(2);

    const scenarioA = scenarios.find((s: any) => s.id === 'scenario_a_classroom_monitoring');
    expect(scenarioA).toBeTruthy();
    expect(scenarioA.scenario).toContain('webcams');
    expect(scenarioA.scenario).toContain('flag disengagement');
    expect(scenarioA.coreTension).toMatch(/Instructional effectiveness.*privacy.*chilling effect/i);
    expect(scenarioA.guidingQuestion).toMatch(/Should teachers in this district adopt/i);
    expect(scenarioA.isteAlignment).toEqual(['2.3.a', '2.3.b', '2.3.c', '2.3.d']);
    expect(scenarioA.valueOptions).toEqual(
      expect.arrayContaining([
        'privacy',
        'safety',
        'autonomy',
        'accountability',
        'well_being',
        'fairness',
      ])
    );
    expect(scenarioA.personas).toHaveLength(4);

    // Each persona carries the proposal's 3 properties.
    for (const p of scenarioA.personas) {
      expect(p.valueLens).toBeTruthy();
      expect(p.experientialKnowledge).toBeTruthy();
      expect(p.interestPosition).toBeTruthy();
      expect(p.llmStyleGuide).toBeTruthy();
    }

    // Roles match proposal exactly.
    const roles = scenarioA.personas.map((p: any) => p.role).sort();
    expect(roles).toEqual(['Administrator', 'Parent', 'Student', 'Teacher']);

    const scenarioB = scenarios.find((s: any) => s.id === 'scenario_b_edtech_data_sharing');
    expect(scenarioB).toBeTruthy();
    expect(scenarioB.scenario).toContain('de-identified');
    expect(scenarioB.scenario).toContain('third-party advertising');
    const bRoles = scenarioB.personas.map((p: any) => p.role).sort();
    expect(bRoles).toEqual(['EdTech Company Representative', 'IT Coordinator', 'Parent', 'Student']);
  });
});

test.describe('Learner-directed (LD) — proposal-faithful student journey', () => {
  test('persona-call-pauses-and-reconnects-unanswered-facilitator-question', async ({ page }) => {
    const runtime = captureRuntimeErrors(page);
    const capturedBodies: any[] = [];
    await installGeminiMock(page, capturedBodies);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');

    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '80',
      values: ['Safety', 'Accountability'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/What feels most compelling/i)).toBeVisible();

    const jordanCard = page.locator('article[data-persona-id="scenario_a_jordan"]');
    await jordanCard.locator('[data-action="open-persona"]').click();

    const paused = page.getByTestId('paused-facilitator-prompt');
    await expect(paused).toBeVisible();
    await expect(paused).toContainText(/What feels most compelling/i);
    const chatInput = page.locator('textarea[placeholder]').first();
    await expect(chatInput).toHaveAttribute('placeholder', /Reply to Jordan/i);

    const personaRequest = capturedBodies.find(body =>
      lastUserText(body).includes('SPEAKER: PERSONA')
    );
    expect(personaRequest?.messages?.[0]?.content).toContain(
      'Do not merely praise, mirror, paraphrase, or agree'
    );
    expect(lastUserText(personaRequest)).toContain('blind spot, tradeoff, or condition');

    await studentType(chatInput, 'I still think the tool could help teachers notice students.');
    await chatInput.press('Enter');
    await readingPause(page, 250);
    await studentType(chatInput, 'But I can see how being watched could change student behavior.');
    await chatInput.press('Enter');

    await expect(jordanCard).toHaveAttribute('data-state', 'completed');
    await expect(paused).toHaveCount(0);
    const returnRequest = [...capturedBodies]
      .reverse()
      .find(body => lastUserText(body).includes('SPEAKER: ETHOBOT_FACILITATOR_RETURN'));
    expect(lastUserText(returnRequest)).toContain('PAUSED_FACILITATOR_PROMPT:');
    expect(lastUserText(returnRequest)).toContain('What feels most compelling');
    expect(runtime.errors).toEqual([]);
  });

  test('ld-full-arc-scenario-a: support 80% [safety, accountability] → unsure 50% [privacy, fairness, safety]', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);

    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await expect(
      page.getByRole('heading', { name: /AI Classroom Monitoring Tool/i })
    ).toBeVisible();
    await expect(page.getByText(/Learner-directed/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-a-01-intro.png', fullPage: true });

    await page.getByRole('button', { name: /Start: record my initial position/i }).click();

    await expect(page.getByRole('heading', { name: /Before we begin/i })).toBeVisible();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '80',
      values: ['Safety', 'Accountability'],
    });
    await page.screenshot({ path: 'test-results/ld-a-02-pre-form.png', fullPage: true });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();

    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-a-03-opening.png', fullPage: true });

    const chatInput = page.locator('textarea[placeholder]').first();
    await studentType(chatInput, "It's hard to notice every student in a large class.");
    await chatInput.press('Enter');
    await expect(page.getByText(/equitably across every student/i)).toBeVisible();
    await readingPause(page, 400);

    await studentType(chatInput, 'I want to support every student equitably with this tool.');
    await chatInput.press('Enter');
    await expect(page.getByText(/even-handed in practice/i)).toBeVisible();
    await readingPause(page, 400);

    await openPersonaAndCompleteMiniDialogue(page, 'scenario_a_jordan', {
      t1: "That's not what I expected to hear.",
      t2: 'It sounds like the watching changes things, especially for kids who feel watched a lot already.',
    });
    await expect(page.getByText(/surveillance reshapes student behavior/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-a-04-jordan-exited.png', fullPage: true });

    await openPersonaAndCompleteMiniDialogue(page, 'scenario_a_mr_park', {
      t1: 'I think educational benefit needs to be weighed against the consent issue.',
      t2: 'If there had been proper notification, my answer might be different.',
    });
    await expect(page.getByText(/consent and authority/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-a-05-park-exited.png', fullPage: true });

    await expect(page.getByText(/Personas called: 2 \/ 4/)).toBeVisible();
    await page.getByRole('button', { name: /End dialogue/i }).click();

    await expect(page.getByRole('heading', { name: /Where do you stand now/i })).toBeVisible();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '50',
      values: ['Privacy', 'Fairness', 'Safety'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();

    // Pre/Post comparison must match the proposal's exact narrative outcome.
    await expect(page.getByText(/Pre \/ Post comparison/i)).toBeVisible();
    await expect(page.getByText(/softened/i)).toBeVisible();
    await expect(page.getByText(/-30/i)).toBeVisible();
    await expect(page.getByText(/added: \[privacy, fairness\]/i)).toBeVisible();
    await expect(page.getByText(/removed: \[accountability\]/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-a-06-comparison.png', fullPage: true });

    await page.getByRole('button', { name: /Finish session/i }).click();
    await expect(page.getByRole('heading', { name: /Session complete/i })).toBeVisible();
    await expect(page.getByText(/SUPPORT @ 80%/)).toBeVisible();
    await expect(page.getByText(/UNSURE @ 50%/)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-a-07-debrief.png', fullPage: true });

    expect(runtime.errors).toEqual([]);
  });

  test('all-four-personas-scenario-a: every persona can be opened, exits cleanly, completed cards lock', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');

    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '50',
      values: ['Privacy', 'Safety'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();

    // Wait for opening and seed two facilitator turns so chat is live.
    await expect(page.getByText(/Walk me through where|leaning|Welcome/i)).toBeVisible();

    const personas = [
      'scenario_a_jordan',
      'scenario_a_mr_park',
      'scenario_a_ms_rivera',
      'scenario_a_dr_lee',
    ];
    for (let i = 0; i < personas.length; i++) {
      await openPersonaAndCompleteMiniDialogue(page, personas[i], {
        t1: `Tell me a bit more, voice ${i + 1}.`,
        t2: `Thanks, that's a useful angle, voice ${i + 1}.`,
      });
    }

    await expect(page.getByText(/Personas called: 4 \/ 4/)).toBeVisible();

    // Every card now in 'completed' state — no Open button visible for any.
    for (const personaId of personas) {
      const card = page.locator(`[data-persona-id="${personaId}"]`);
      await expect(card).toHaveAttribute('data-state', 'completed');
      await expect(card.locator('[data-action="open-persona"]')).toHaveCount(0);
    }
    await page.screenshot({ path: 'test-results/ld-a-all-four.png', fullPage: true });

    expect(runtime.errors).toEqual([]);
  });

  test('ld-full-arc-scenario-b: EdTech data-sharing scenario loads + persona arc works', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=b&personaTurns=2');

    await expect(
      page.getByRole('heading', { name: /Free EdTech App with Student Data Sharing/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '70',
      values: ['Well-being', 'Fairness'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();

    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    await openPersonaAndCompleteMiniDialogue(page, 'scenario_b_ms_chen', {
      t1: 'I assumed schools would have already vetted the data-sharing terms.',
      t2: 'You\'re saying notification matters as much as the technology.',
    });
    await expect(page.getByText(/parent's perspective/i).first()).toBeVisible();
    await expect(page.getByText(/de-identified/i).first()).toBeVisible();

    await page.getByRole('button', { name: /End dialogue/i }).click();
    await expect(page.getByRole('heading', { name: /Where do you stand now/i })).toBeVisible();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '40',
      values: ['Privacy', 'Accountability'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();
    await expect(page.getByText(/added: \[privacy, accountability\]/i)).toBeVisible();
    await expect(page.getByText(/removed: \[well_being, fairness\]/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/ld-b-comparison.png', fullPage: true });

    expect(runtime.errors).toEqual([]);
  });
});

test.describe('AR condition — recommendation engine (Wave 3 12-15)', () => {
  test('ar-disabled-before-turn-4: cards stay disabled, no recommendation surfaces before turn 4', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ar&scenario=a&personaTurns=2');

    await expect(page.getByText(/AI-recommended/i)).toBeVisible();
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '80',
      values: ['Safety', 'Accountability'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();

    await expect(page.getByText(/ETHOBOT will surface a persona/i)).toBeVisible();

    const cards = page.locator('[data-persona-id]');
    expect(await cards.count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      await expect(cards.nth(i)).toHaveAttribute('data-state', 'disabled');
    }
    expect(await page.locator('[data-action="open-persona"]').count()).toBe(0);
    expect(await page.locator('[data-action="accept-recommendation"]').count()).toBe(0);

    await page.screenshot({ path: 'test-results/ar-01-pre-turn-4.png', fullPage: true });
    expect(runtime.errors).toEqual([]);
  });

  test('ar-rule1-recommendation: 4 teacher-only learner turns → Rule 1 fires, non-teacher persona highlighted, Open accepted', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ar&scenario=a&personaTurns=2');

    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '80',
      values: ['Safety', 'Accountability'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();

    // Four learner turns referencing ONLY the teacher persona — should trip Rule 1
    const teacherOnlyTurns = [
      'Early detection lets the teacher catch struggling kids.',
      'A teacher should be able to support every learner equitably.',
      'For the teacher this could be a real time-saver.',
      'I think the teacher gets the most benefit from this tool.',
    ];

    for (const turn of teacherOnlyTurns) {
      await studentType(chatInput, turn);
      await chatInput.press('Enter');
      await readingPause(page, 250);
    }

    // After turn 4, recommendation should appear in chat + a non-teacher persona
    // card should be 'highlighted', others 'disabled'.
    const acceptBtn = page.locator('[data-action="accept-recommendation"]');
    await expect(acceptBtn).toBeVisible();

    const recommendedPersonaId = await acceptBtn.getAttribute('data-persona-id');
    expect(recommendedPersonaId).toBeTruthy();
    expect(recommendedPersonaId).not.toBe('scenario_a_ms_rivera'); // teacher excluded

    const teacherCard = page.locator('article[data-persona-id="scenario_a_ms_rivera"]');
    await expect(teacherCard).toHaveAttribute('data-state', 'disabled');

    const recommendedCard = page.locator(`article[data-persona-id="${recommendedPersonaId}"]`);
    await expect(recommendedCard).toHaveAttribute('data-state', 'highlighted');

    await page.screenshot({ path: 'test-results/ar-02-rec-fired.png', fullPage: true });

    // Click the inline Open button → persona enters dialogue
    await acceptBtn.click();
    await expect(recommendedCard).toHaveAttribute('data-state', 'active');
    // Recommendation cleared; banner button gone.
    expect(await page.locator('[data-action="accept-recommendation"]').count()).toBe(0);

    await page.screenshot({ path: 'test-results/ar-03-rec-accepted.png', fullPage: true });
    expect(runtime.errors).toEqual([]);
  });

  test('ar-second-recommendation: after a persona exits, a second rec fires for a not-yet-called persona', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ar&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '70',
      values: ['Safety'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();

    // Drive 4 teacher-only turns to fire Rule 1
    for (const t of [
      'The teacher needs help noticing every learner.',
      'Teachers carry a lot of cognitive load already.',
      "Honestly, the teacher's perspective is what matters most to me here.",
      'Teachers should welcome anything that helps with classroom support.',
    ]) {
      await studentType(chatInput, t);
      await chatInput.press('Enter');
      await readingPause(page, 200);
    }

    const acceptBtn1 = page.locator('[data-action="accept-recommendation"]');
    await expect(acceptBtn1).toBeVisible();
    const firstRecPersonaId = await acceptBtn1.getAttribute('data-persona-id');
    await acceptBtn1.click();

    // Persona is active. Send 2 mini-dialogue turns to exit.
    await studentType(chatInput, 'OK, that gives me something to think about.');
    await chatInput.press('Enter');
    await readingPause(page, 200);
    await studentType(chatInput, 'Got it — thanks for sharing.');
    await chatInput.press('Enter');
    await readingPause(page, 300);

    // After persona exits, facilitator returns. Send one more facilitator-mode
    // turn — gate cooldown is met (overall turn counter advanced by 2 persona
    // turns), so a SECOND recommendation should fire for a different persona.
    await studentType(chatInput, "I'm still thinking about what helps the teacher most.");
    await chatInput.press('Enter');
    await readingPause(page, 400);

    const acceptBtn2 = page.locator('[data-action="accept-recommendation"]');
    await expect(acceptBtn2).toBeVisible();
    const secondRecPersonaId = await acceptBtn2.getAttribute('data-persona-id');
    expect(secondRecPersonaId).toBeTruthy();
    expect(secondRecPersonaId).not.toBe(firstRecPersonaId); // not-yet-called priority
    expect(secondRecPersonaId).not.toBe('scenario_a_ms_rivera'); // teacher excluded

    await page.screenshot({ path: 'test-results/ar-04-second-rec.png', fullPage: true });
    expect(runtime.errors).toEqual([]);
  });
});

test.describe('Form validation (proposal initial / closing position module)', () => {
  test('pre-form-validation: submit disabled until stance + ≥1 value selected; max 4 values', async ({
    page,
  }) => {
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();

    const submit = page.getByRole('button', { name: /Start the dialogue/i });
    await expect(submit).toBeDisabled();

    await page.getByText('Support', { exact: true }).click();
    await expect(submit).toBeDisabled(); // stance set, no values yet

    await page.getByLabel('Rank Privacy').selectOption('1');
    await expect(submit).toBeEnabled();

    // Add up to 4 values, then verify a 5th option becomes non-clickable
    await page.getByLabel('Rank Safety').selectOption('2');
    await page.getByLabel('Rank Autonomy').selectOption('3');
    await page.getByLabel('Rank Accountability').selectOption('4');

    // 5th attempt should be capped — 'Well-being' checkbox should be disabled.
    const wellBeingRank = page.getByLabel('Rank Well-being');
    await expect(wellBeingRank).toBeDisabled();
  });
});

test.describe('Repeat-call guard', () => {
  test('repeat-persona-guard: a completed persona cannot be reopened', async ({ page }) => {
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy', 'Safety'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();

    await openPersonaAndCompleteMiniDialogue(page, 'scenario_a_jordan', {
      t1: 'OK.',
      t2: 'Got it.',
    });

    const jordan = page.locator('[data-persona-id="scenario_a_jordan"]');
    await expect(jordan).toHaveAttribute('data-state', 'completed');
    await expect(jordan.locator('[data-action="open-persona"]')).toHaveCount(0);

    // Open Mr. Park — Jordan should still be completed; un-called personas idle.
    const park = page.locator('[data-persona-id="scenario_a_mr_park"]');
    await expect(park).toHaveAttribute('data-state', 'idle');
  });
});

test.describe('Logging instrumentation (logContext threading)', () => {
  test('logging-events: pid+course flow through to Sheets API for full session', async ({ page }) => {
    const sheetsCalls: any[] = [];
    await page.route('**/sheets-api-function-*.run.app/**', async (route: Route) => {
      try {
        const body = route.request().postDataJSON();
        sheetsCalls.push(body);
      } catch {
        sheetsCalls.push(null);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    // Also stub Supabase REST inserts so we don't hit a real backend.
    await page.route('**/*.supabase.co/**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await installGeminiMock(page);

    await page.goto('/cat100?condition=ld&scenario=a&pid=TEST-001&course=CAT100-Spring&personaTurns=2');

    // Participant info banner shows the URL-driven identity
    const banner = page.locator('[data-testid="participant-info"]');
    await expect(banner).toContainText('TEST-001');
    await expect(banner).toContainText('CAT100-Spring');
    await expect(banner).toContainText('source=url');

    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '80',
      values: ['Safety', 'Accountability'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    // One persona round-trip
    await openPersonaAndCompleteMiniDialogue(page, 'scenario_a_jordan', {
      t1: 'That is a real concern about dignity.',
      t2: 'I can see how the surveillance changes things.',
    });
    await expect(page.getByText(/surveillance reshapes student behavior/i)).toBeVisible();

    await page.getByRole('button', { name: /End dialogue/i }).click();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '50',
      values: ['Privacy', 'Fairness', 'Safety'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();
    await page.getByRole('button', { name: /Finish session/i }).click();
    await expect(page.getByRole('heading', { name: /Session complete/i })).toBeVisible();

    // Wait briefly for queued logs to flush.
    await page.waitForTimeout(500);

    // Every captured Sheets log should carry the URL-driven identity.
    expect(sheetsCalls.length).toBeGreaterThan(0);
    for (const body of sheetsCalls) {
      if (!body) continue;
      expect(body.userName).toBe('TEST-001');
      expect(body.userCourse).toBe('CAT100-Spring');
    }

    const logTypes = new Set(sheetsCalls.filter(Boolean).map((b: any) => b.logType));
    // Required event types from the proposal logging schema.
    expect(logTypes.has('CAT100_SESSION_START')).toBe(true);
    expect(logTypes.has('CAT100_INITIAL_POSITION')).toBe(true);
    expect(logTypes.has('CAT100_PERSONA_OPENED')).toBe(true);
    expect(logTypes.has('CAT100_PERSONA_EXITED')).toBe(true);
    expect(logTypes.has('CAT100_CLOSING_POSITION')).toBe(true);
    expect(logTypes.has('CAT100_SESSION_COMPLETE')).toBe(true);

    // At least one vocabulary emergence captured (we said "dignity" + "surveillance").
    const vocabEvents = sheetsCalls.filter(
      (b: any) => b?.logType === 'CAT100_VOCABULARY_EMERGED'
    );
    expect(vocabEvents.length).toBeGreaterThan(0);

    // SESSION_COMPLETE payload carries delta with confidence -30.
    const sessionComplete = sheetsCalls.find(
      (b: any) => b?.logType === 'CAT100_SESSION_COMPLETE'
    );
    expect(sessionComplete?.details_json?.delta?.confidenceDelta).toBe(-30);
  });
});

test.describe('Regression', () => {
  test('root-regression: pre-existing facial-recognition flow at "/" still loads', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const hasActivation = await page
      .getByText(/your name|enter your|activate|이름/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasChat = await page
      .getByText(/ETHOBOT|ethics|facial recognition/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasActivation || hasChat).toBe(true);
  });
});

// =============================================================================
// Extended diversity tests (Round 2)
// =============================================================================

test.describe('AR rules 2 and 3 — coverage beyond Rule 1', () => {
  test('ar-rule2-value-lens: 4 turns leaning on a single value lens → Rule 2 fires', async ({
    page,
  }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ar&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();
    // All four turns reference multiple stakeholders (teacher + student + parent)
    // but only one value lens (privacy). Rule 1 should NOT fire; Rule 2 should.
    for (const t of [
      'Teachers, students, and parents all care about privacy here.',
      'Privacy is what teachers should weigh before adopting any tool.',
      'For students and parents, privacy is the dimension that matters.',
      'I keep coming back to privacy as the deciding factor for everyone involved.',
    ]) {
      await studentType(chatInput, t);
      await chatInput.press('Enter');
      await readingPause(page, 200);
    }

    const acceptBtn = page.locator('[data-action="accept-recommendation"]');
    await expect(acceptBtn).toBeVisible();
    // Recommendation rationale references value-lens framing
    const rec = page
      .locator('[data-action="accept-recommendation"]')
      .locator('xpath=preceding::div[contains(@class,"rounded-lg") and contains(@class,"text-sm")][1]');
    await expect(rec).toContainText(/different value lens|weighed mostly through|one value lens/i);
    expect(runtime.errors).toEqual([]);
  });

  test('ar-rule3-no-conditions: 4 generic vague turns → Rule 3 fires', async ({ page }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ar&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy', 'Safety', 'Autonomy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();
    // Multiple stakeholders + multiple value lenses, but no conditional
    // reasoning and no concrete evidence. Rule 3 should fire.
    for (const t of [
      'I think teachers, students, and parents all matter on privacy and safety.',
      'It feels like the autonomy of students is bound up with the teacher and parent perspective.',
      'Privacy, safety, and autonomy together make this a tough one for everyone.',
      'I just keep going back and forth on what teachers, students, and parents should value.',
    ]) {
      await studentType(chatInput, t);
      await chatInput.press('Enter');
      await readingPause(page, 200);
    }

    const acceptBtn = page.locator('[data-action="accept-recommendation"]');
    await expect(acceptBtn).toBeVisible();
    const rec = page
      .locator('[data-action="accept-recommendation"]')
      .locator('xpath=preceding::div[contains(@class,"rounded-lg") and contains(@class,"text-sm")][1]');
    await expect(rec).toContainText(/specific concern about how this decision/i);
    expect(runtime.errors).toEqual([]);
  });
});

test.describe('Pre/Post stance-shift permutations (full stancePrePost coverage)', () => {
  test.beforeEach(async ({ page }) => {
    await installGeminiMock(page);
  });

  const arc = async (
    page: Page,
    pre: { stance: 'Support' | 'Oppose' | 'Unsure'; confidence: string; values: string[] },
    post: { stance: 'Support' | 'Oppose' | 'Unsure'; confidence: string; values: string[] }
  ) => {
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, pre);
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();
    await page.getByRole('button', { name: /End dialogue/i }).click();
    await fillPositionForm(page, post);
    await page.getByRole('button', { name: /Record my closing position/i }).click();
  };

  test('stance-shift: reversed (support → oppose)', async ({ page }) => {
    await arc(
      page,
      { stance: 'Support', confidence: '70', values: ['Safety'] },
      { stance: 'Oppose', confidence: '70', values: ['Privacy'] }
    );
    await expect(page.getByText(/reversed/i)).toBeVisible();
  });

  test('stance-shift: same (no change at all)', async ({ page }) => {
    await arc(
      page,
      { stance: 'Unsure', confidence: '50', values: ['Privacy'] },
      { stance: 'Unsure', confidence: '50', values: ['Privacy'] }
    );
    await expect(page.getByText(/Stance same/i)).toBeVisible();
  });

  test('stance-shift: sharpened (same stance, confidence up)', async ({ page }) => {
    await arc(
      page,
      { stance: 'Support', confidence: '40', values: ['Safety'] },
      { stance: 'Support', confidence: '85', values: ['Safety'] }
    );
    await expect(page.getByText(/sharpened/i)).toBeVisible();
    await expect(page.getByText(/confidence \+45/i)).toBeVisible();
  });

  test('stance-shift: from unsure → sharpened (commit to support)', async ({ page }) => {
    await arc(
      page,
      { stance: 'Unsure', confidence: '50', values: ['Privacy'] },
      { stance: 'Support', confidence: '70', values: ['Privacy', 'Safety'] }
    );
    await expect(page.getByText(/sharpened/i)).toBeVisible();
  });

  test('stance-shift: confidence edges (0 ↔ 100)', async ({ page }) => {
    await arc(
      page,
      { stance: 'Support', confidence: '100', values: ['Safety'] },
      { stance: 'Support', confidence: '0', values: ['Safety'] }
    );
    await expect(page.getByText(/softened/i)).toBeVisible();
    await expect(page.getByText(/confidence -100/i)).toBeVisible();
  });
});

test.describe('Persona invocation edge cases', () => {
  test('ld-no-personas-called: skip persona entirely → debrief still works', async ({ page }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();
    await expect(page.getByText(/Personas called: 0 \/ 4/)).toBeVisible();

    await page.getByRole('button', { name: /End dialogue/i }).click();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '40',
      values: ['Privacy', 'Fairness'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();
    await page.getByRole('button', { name: /Finish session/i }).click();
    await expect(page.getByRole('heading', { name: /Session complete/i })).toBeVisible();
    expect(runtime.errors).toEqual([]);
  });

  test('repeat-rapid-click: clicking a persona card opens it exactly once', async ({ page }) => {
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();

    const openBtn = page.locator(
      'article[data-persona-id="scenario_a_jordan"] [data-action="open-persona"]'
    );
    await openBtn.click();
    // Card now in 'active' state and the Open button is removed from DOM.
    // Verify single invocation — no duplicate counted.
    await expect(page.getByText(/Personas called: 1 \/ 4/)).toBeVisible();
    await expect(
      page.locator('article[data-persona-id="scenario_a_jordan"]')
    ).toHaveAttribute('data-state', 'active');
    await expect(
      page.locator('article[data-persona-id="scenario_a_jordan"] [data-action="open-persona"]')
    ).toHaveCount(0);
  });

  test('empty-message: pressing Enter on empty input is a no-op', async ({ page }) => {
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();
    const before = await page.locator('[data-action="open-persona"]').count();
    await chatInput.click();
    await chatInput.press('Enter'); // empty
    await page.waitForTimeout(200);
    const after = await page.locator('[data-action="open-persona"]').count();
    expect(after).toBe(before);
  });
});

test.describe('Gate (Blackboard iframe access-code flow)', () => {
  test('gate-shown-without-params: bare /cat100 surfaces the access-code form', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.removeItem('cat100_session');
        window.localStorage.removeItem('ethobot_user');
      } catch {}
    });
    await page.goto('/cat100');
    await expect(page.getByLabel(/Access code/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Begin/i })).toBeVisible();
    expect(await page.locator('[data-testid="participant-info"]').count()).toBe(0);
  });

  test('gate-rejects-bad-code: invalid code shows error, no transition', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.removeItem('cat100_session');
      } catch {}
    });
    await page.goto('/cat100');
    await page.getByLabel(/Access code/i).fill('not-a-real-code');
    await page.getByRole('button', { name: /Begin/i }).click();
    await expect(page.getByText(/Code not recognized/i)).toBeVisible();
    expect(await page.locator('[data-testid="participant-info"]').count()).toBe(0);
  });

  test('gate-accepts-valid-code: real code → intro phase with assigned cell', async ({ page }) => {
    await installGeminiMock(page);
    await page.addInitScript(() => {
      try {
        window.sessionStorage.removeItem('cat100_session');
      } catch {}
    });
    await page.goto('/cat100');
    // P001 → LD-A (deterministic from access list)
    await page.getByLabel(/Access code/i).fill('9b4402');
    await page.getByRole('button', { name: /Begin/i }).click();

    // Should land on intro with the right pid + condition + scenario.
    await expect(page.locator('[data-testid="participant-info"]')).toContainText('P001');
    await expect(page.locator('[data-testid="participant-info"]')).toContainText(/source=code/);
    await expect(page.getByText(/Learner-directed/i)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /AI Classroom Monitoring Tool/i })
    ).toBeVisible();
  });

  test('gate-session-persists: code stays valid across reload until tab close', async ({ page }) => {
    await installGeminiMock(page);
    await page.goto('/cat100');
    await page.getByLabel(/Access code/i).fill('28ad9d'); // P002 → AR-B
    await page.getByRole('button', { name: /Begin/i }).click();
    await expect(page.locator('[data-testid="participant-info"]')).toContainText('P002');

    await page.reload();
    // Same tab → sessionStorage persists → straight to intro, no gate
    await expect(page.getByLabel(/Access code/i)).toHaveCount(0);
    await expect(page.locator('[data-testid="participant-info"]')).toContainText('P002');
  });
});

test.describe('Identity / logContext fallbacks', () => {
  test('identity-anonymous: no pid, no localStorage → cat100- prefix', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('ethobot_user');
      } catch {
        /* ignore */
      }
    });
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    const banner = page.locator('[data-testid="participant-info"]');
    await expect(banner).toContainText(/cat100-/);
    await expect(banner).toContainText(/source=anonymous/);
  });

  test('identity-localstorage-isolated: legacy ethobot_user is NOT honored on /cat100', async ({
    page,
  }) => {
    // CAT 100 is intentionally isolated from the facial-recognition flow's
    // localStorage. Even with `ethobot_user` set, /cat100 should fall back to
    // anonymous (URL has condition+scenario but no pid) — never read LS.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ethobot_user',
        JSON.stringify({ name: 'LS-USER', course: 'INTRO-101' })
      );
    });
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    const banner = page.locator('[data-testid="participant-info"]');
    await expect(banner).toContainText(/cat100-/);
    await expect(banner).not.toContainText('LS-USER');
    await expect(banner).toContainText(/source=anonymous/);
  });

  test('identity-url-overrides: pid in URL beats localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ethobot_user',
        JSON.stringify({ name: 'LS-USER', course: 'OLD' })
      );
    });
    await page.goto('/cat100?condition=ld&scenario=a&pid=URL-PID&course=NEW&personaTurns=2');
    const banner = page.locator('[data-testid="participant-info"]');
    await expect(banner).toContainText('URL-PID');
    await expect(banner).toContainText('NEW');
    await expect(banner).toContainText(/source=url/);
  });
});

test.describe('Vocabulary emergence — coverage', () => {
  test('vocab-multi-term: dignity, consent, chilling effect, conditional reasoning all logged', async ({
    page,
  }) => {
    const sheetsCalls: any[] = [];
    await page.route('**/sheets-api-function-*.run.app/**', async (route: Route) => {
      try {
        sheetsCalls.push(route.request().postDataJSON());
      } catch {
        sheetsCalls.push(null);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/*.supabase.co/**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await installGeminiMock(page);

    await page.goto('/cat100?condition=ld&scenario=a&pid=VOCAB-T&course=CAT100&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();
    const turns = [
      'I think dignity matters here for students.',
      'Consent should come before any data collection.',
      'There is a real chilling effect when students feel watched.',
      'If notification is sent home, then opting out becomes possible.',
    ];
    for (const t of turns) {
      await studentType(chatInput, t);
      await chatInput.press('Enter');
      await readingPause(page, 250);
    }

    await page.getByRole('button', { name: /End dialogue/i }).click();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '40',
      values: ['Privacy', 'Fairness'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();
    await page.getByRole('button', { name: /Finish session/i }).click();
    await page.waitForTimeout(500);

    const vocabKeys = sheetsCalls
      .filter((b: any) => b?.logType === 'CAT100_VOCABULARY_EMERGED')
      .map((b: any) => b?.details_json?.vocabularyEmergence?.term);

    // We expect at least dignity, consent, chilling_effect, conditional_reasoning
    expect(vocabKeys).toEqual(
      expect.arrayContaining(['dignity', 'consent', 'chilling_effect', 'conditional_reasoning'])
    );
  });

  test('vocab-no-double: same term repeated → emerges only once', async ({ page }) => {
    const sheetsCalls: any[] = [];
    await page.route('**/sheets-api-function-*.run.app/**', async (route: Route) => {
      try {
        sheetsCalls.push(route.request().postDataJSON());
      } catch {
        sheetsCalls.push(null);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/*.supabase.co/**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await installGeminiMock(page);

    await page.goto('/cat100?condition=ld&scenario=a&pid=VOCAB-D&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();
    for (const t of [
      'Dignity is what I care about most.',
      'Dignity, dignity — it is the heart of this.',
      'I keep coming back to dignity.',
    ]) {
      await studentType(chatInput, t);
      await chatInput.press('Enter');
      await readingPause(page, 200);
    }

    await page.waitForTimeout(300);
    const dignityCount = sheetsCalls.filter(
      (b: any) =>
        b?.logType === 'CAT100_VOCABULARY_EMERGED' &&
        b?.details_json?.vocabularyEmergence?.term === 'dignity'
    ).length;
    expect(dignityCount).toBe(1);
  });
});

test.describe('Scenario B — additional coverage', () => {
  test('scenario-b-all-personas: every Scenario B persona opens cleanly', async ({ page }) => {
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=b&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '50',
      values: ['Well-being', 'Fairness'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const personas = [
      'scenario_b_sam',
      'scenario_b_ms_chen',
      'scenario_b_mr_diaz',
      'scenario_b_alex',
    ];
    for (let i = 0; i < personas.length; i++) {
      await openPersonaAndCompleteMiniDialogue(page, personas[i], {
        t1: `Tell me more, voice ${i + 1}.`,
        t2: `Got it, voice ${i + 1}.`,
      });
    }
    await expect(page.getByText(/Personas called: 4 \/ 4/)).toBeVisible();
  });

  test('scenario-b-ar-rule1: AR Rule 1 fires in scenario B too', async ({ page }) => {
    const runtime = captureRuntimeErrors(page);
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ar&scenario=b&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Well-being'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/leaning toward adopting/i)).toBeVisible();

    const chatInput = page.locator('textarea[placeholder]').first();
    // 4 student-only turns to fire Rule 1 in scenario B
    for (const t of [
      'The students love this app — that is what matters.',
      'Students would be the ones missing out if we block it.',
      "What students get out of the app is the real benefit.",
      "I think students should be the priority on this decision.",
    ]) {
      await studentType(chatInput, t);
      await chatInput.press('Enter');
      await readingPause(page, 200);
    }

    const acceptBtn = page.locator('[data-action="accept-recommendation"]');
    await expect(acceptBtn).toBeVisible();
    const recPersonaId = await acceptBtn.getAttribute('data-persona-id');
    expect(recPersonaId).not.toBe('scenario_b_sam'); // student excluded
    expect(runtime.errors).toEqual([]);
  });
});

test.describe('Form validation — additional edges', () => {
  test('pre-form-confidence-edges: slider can be set to exactly 0 and 100', async ({ page }) => {
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await page.getByText('Support', { exact: true }).click();
    await setRangeValue(page.locator('input[type="range"]').first(), '0');
    await expect(page.getByText('0%').first()).toBeVisible();
    await setRangeValue(page.locator('input[type="range"]').first(), '100');
    await expect(page.getByText('100%').first()).toBeVisible();
  });

  test('post-form-edit: closing position can be edited before final submit', async ({ page }) => {
    await installGeminiMock(page);
    await page.goto('/cat100?condition=ld&scenario=a&personaTurns=2');
    await page.getByRole('button', { name: /Start: record my initial position/i }).click();
    await fillPositionForm(page, {
      stance: 'Support',
      confidence: '60',
      values: ['Privacy'],
    });
    await page.getByRole('button', { name: /Start the dialogue/i }).click();
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();

    await page.getByRole('button', { name: /End dialogue/i }).click();
    await fillPositionForm(page, {
      stance: 'Unsure',
      confidence: '50',
      values: ['Privacy', 'Fairness'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();
    await expect(page.getByText(/Pre \/ Post comparison/i)).toBeVisible();

    // Edit, change closing — note that the form re-mounts with empty state,
    // so we must re-fill stance + values + confidence to enable submit.
    await page.getByRole('button', { name: /Edit my closing position/i }).click();
    await expect(page.getByRole('button', { name: /Record my closing position/i })).toBeVisible();
    await fillPositionForm(page, {
      stance: 'Oppose',
      confidence: '60',
      values: ['Privacy', 'Fairness'],
    });
    await page.getByRole('button', { name: /Record my closing position/i }).click();
    await expect(page.getByText(/reversed/i)).toBeVisible();
  });
});

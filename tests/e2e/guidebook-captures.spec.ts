// Captures high-quality screenshots for the CAT 100 HTML guidebook.
// Output: docs/guidebook/screenshots/*.png (one per learning-journey phase).
//
// This spec piggybacks on the existing playwright config (webServer + Gemini mock).
// Run with:
//   npx playwright test tests/e2e/guidebook-captures.spec.ts --project=chromium

import { test, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(here, '../../public/guidebook/screenshots');

const sseChunk = (text: string) => {
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

const responseFor = (postBody: any): string => {
  const message = lastUserText(postBody);

  if (message.includes('SPEAKER: ETHOBOT_FACILITATOR_OPENING')) {
    return "Welcome — I see you're leaning toward adopting the tool, with student well-being in mind. What feels most compelling about that approach for you?";
  }
  if (message.includes('SPEAKER: PERSONA') && /PERSONA_NAME: Jordan/.test(message)) {
    if (/TURN_NUMBER: 0/.test(message))
      return "Hi, I'm Jordan. I'm in one of the pilot classes — the camera kind of changes how I sit.";
    if (/TURN_NUMBER: 1/.test(message))
      return "Some of my friends forget about it. The kids who already get noticed don't forget.";
    if (/TURN_NUMBER: 2/.test(message))
      return "Yeah. Even when I'm just thinking, I keep my face neutral now.";
  }
  if (message.includes('SPEAKER: PERSONA') && /PERSONA_NAME: Mr\. Park/.test(message)) {
    if (/TURN_NUMBER: 0/.test(message))
      return "I'm Jordan's father. Quick question — when did you decide that my son's facial expressions were data the school could collect?";
    if (/TURN_NUMBER: 1/.test(message))
      return "My son is twelve. He can't legally consent. So who actually did?";
    if (/TURN_NUMBER: 2/.test(message))
      return 'If a notification letter had come home, that would be a different conversation.';
  }
  if (message.includes('SPEAKER: ETHOBOT_FACILITATOR_RETURN')) {
    if (/EXITED_PERSONA: Jordan/.test(message))
      return "Jordan introduced something you hadn't named yet — how surveillance reshapes student behavior, especially for students already under more scrutiny. How does that fit with your earlier reasoning about support?";
    if (/EXITED_PERSONA: Mr\. Park/.test(message))
      return 'Mr. Park surfaced consent and authority — whether this is acceptable depends on whether families were informed and able to opt out. How does that change the picture for you?';
  }
  if (message.includes('SPEAKER: ETHOBOT_FACILITATOR')) {
    if (/large class|notice every|miss/.test(message))
      return "That's a real constraint. What would have to be true about the tool for it to deliver that benefit equitably across every student?";
    if (/equitabl|support every/.test(message))
      return 'So the case rests on the tool being accurate and even-handed. What if it were not even-handed in practice?';
    if (/teacher|teach\b/i.test(message))
      return 'Tell me more about what makes that reasoning feel solid to you.';
    return "That's a real constraint. What would have to be true about the tool for it to deliver that benefit equitably?";
  }
  return 'Tell me more.';
};

const installMocks = async (page: Page) => {
  await page.route('**/api/cat100-chat', async (route: Route) => {
    let postBody: any = null;
    try {
      postBody = route.request().postDataJSON();
    } catch {}
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: sseChunk(responseFor(postBody)),
    });
  });
  await page.route('**/*.supabase.co/**', async (route: Route) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/sheets-api-function-*.run.app/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
};

const setRangeValue = async (page: Page, value: string) => {
  await page.locator('input[type="range"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el as HTMLInputElement, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

const fillPosition = async (
  page: Page,
  stance: 'Support' | 'Oppose' | 'Unsure',
  confidence: string,
  values: string[]
) => {
  await page.getByText(stance, { exact: true }).click();
  await setRangeValue(page, confidence);
  for (const [index, value] of values.entries()) {
    await page.getByLabel(`Rank ${value}`).selectOption(String(index + 1));
  }
};

const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
};

const slowType = async (page: Page, text: string) => {
  const input = page.locator('textarea[placeholder]').first();
  await input.click();
  await input.fill('');
  await input.pressSequentially(text, { delay: 18 });
};

test.use({ viewport: { width: 1440, height: 900 } });

test('LD learning-journey screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);

  // 01 — Intro / Dilemma context panel
  await page.goto('/cat100?condition=ld&scenario=a&pid=GUIDE-001&course=CAT100&personaTurns=2');
  await page.getByRole('button', { name: /Start: record my initial position/i }).waitFor();
  await shot(page, '01-intro');

  await page.getByRole('button', { name: /Start: record my initial position/i }).click();

  // 02 — Pre-form empty
  await page.waitForSelector('input[type="range"]');
  await shot(page, '02-pre-form-empty');

  // 03 — Pre-form filled (proposal example: support 80% Safety+Accountability)
  await fillPosition(page, 'Support', '80', ['Safety', 'Accountability']);
  await shot(page, '03-pre-form-filled');
  await page.getByRole('button', { name: /Start the dialogue/i }).click();

  // 04 — Facilitator opening reflects stance
  await page.getByText(/leaning toward adopting/i).waitFor();
  await shot(page, '04-facilitator-opening');

  // 05 — Two facilitator probe turns
  await slowType(page, "It's hard to notice every student in a large class.");
  await page.locator('textarea[placeholder]').first().press('Enter');
  await page.getByText(/equitably across every student/i).waitFor();
  await shot(page, '05-facilitator-probe-1');

  await slowType(page, 'I want to support every student equitably with this tool.');
  await page.locator('textarea[placeholder]').first().press('Enter');
  await page.getByText(/even-handed in practice/i).waitFor();
  await shot(page, '06-facilitator-probe-2');

  // 06 — Click Jordan card
  await page.locator('article[data-persona-id="scenario_a_jordan"] [data-action="open-persona"]').click();
  await page.getByText(/Hi, I'm Jordan/i).waitFor();
  await shot(page, '07-jordan-joined');

  // 07 — Mini-dialogue with Jordan (turn 1)
  await slowType(page, "That's not what I expected to hear.");
  await page.locator('textarea[placeholder]').first().press('Enter');
  await page.getByText(/Some of my friends forget/i).waitFor();
  await shot(page, '08-jordan-turn-1');

  // 08 — Last turn → auto-exit + facilitator return
  await slowType(page, 'It sounds like the watching changes things.');
  await page.locator('textarea[placeholder]').first().press('Enter');
  await page.getByText(/keep my face neutral/i).waitFor();
  await page.getByText(/surveillance reshapes student behavior/i).waitFor();
  await shot(page, '09-jordan-exited-facilitator-return');

  // 09 — Open Mr. Park
  await page.locator('article[data-persona-id="scenario_a_mr_park"] [data-action="open-persona"]').click();
  await page.getByText(/I'm Jordan's father/i).waitFor();
  await shot(page, '10-mr-park-joined');

  await slowType(page, 'I think educational benefit needs to be weighed.');
  await page.locator('textarea[placeholder]').first().press('Enter');
  await page.getByText(/can't legally consent/i).waitFor();

  await slowType(page, 'If there had been proper notification, my answer might be different.');
  await page.locator('textarea[placeholder]').first().press('Enter');
  await page.getByText(/different conversation/i).waitFor();
  await page.getByText(/consent and authority/i).waitFor();
  await shot(page, '11-mr-park-exited-facilitator-return');

  // 10 — End dialogue → post-form
  await page.getByRole('button', { name: /End dialogue/i }).click();
  await page.getByRole('heading', { name: /Where do you stand now/i }).waitFor();
  await shot(page, '12-post-form-empty');

  await fillPosition(page, 'Unsure', '50', ['Privacy', 'Fairness', 'Safety']);
  await shot(page, '13-post-form-filled');
  await page.getByRole('button', { name: /Record my closing position/i }).click();

  // 11 — Pre/Post comparison
  await page.getByText(/Pre \/ Post comparison/i).waitFor();
  await shot(page, '14-pre-post-comparison');

  await page.getByRole('button', { name: /Finish session/i }).click();

  // 12 — Debrief
  await page.getByRole('heading', { name: /Session complete/i }).waitFor();
  await shot(page, '15-debrief');
});

test('AR Rule-1 screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);

  // 16 — AR landing (cards disabled, no rec yet)
  await page.goto('/cat100?condition=ar&scenario=a&pid=GUIDE-AR-001&course=CAT100&personaTurns=2');
  await page.getByRole('button', { name: /Start: record my initial position/i }).waitFor();
  await shot(page, '16-ar-intro');

  await page.getByRole('button', { name: /Start: record my initial position/i }).click();
  await fillPosition(page, 'Support', '80', ['Safety', 'Accountability']);
  await page.getByRole('button', { name: /Start the dialogue/i }).click();
  await page.getByText(/leaning toward adopting/i).waitFor();
  await shot(page, '17-ar-chat-opening');

  // 17 — Drive 4 teacher-only turns to fire Rule 1
  for (const t of [
    'Early detection lets the teacher catch struggling kids.',
    'A teacher should be able to support every learner equitably.',
    'For the teacher this could be a real time-saver.',
    'I think the teacher gets the most benefit from this tool.',
  ]) {
    await slowType(page, t);
    await page.locator('textarea[placeholder]').first().press('Enter');
    await page.waitForTimeout(400);
  }

  // 18 — Recommendation banner + highlighted card
  await page.locator('[data-action="accept-recommendation"]').waitFor();
  await shot(page, '18-ar-recommendation');

  await page.locator('[data-action="accept-recommendation"]').click();
  await page.waitForTimeout(800);
  await shot(page, '19-ar-persona-accepted');
});

// Production smoke test — exercises the live https://ethobot32.vercel.app/cat100
// flow against real OpenRouter + real Supabase. Run on demand:
//   npx playwright test tests/e2e/production-smoke.spec.ts --project=chromium

import { test, expect } from '@playwright/test';

const PROD = 'https://ethobot32.vercel.app';
const SMOKE_CODE = '9b4402'; // P001 → LD-A in cat100-codes.json

test.use({ baseURL: PROD });
test.setTimeout(120_000);

const chooseValue = async (page: any, label: string, rank: string) => {
  const rankInput = page.getByLabel(`Rank ${label}`);
  if ((await rankInput.count()) > 0) {
    await rankInput.selectOption(rank);
    return;
  }
  await page.getByText(label, { exact: true }).click();
};

test('production-smoke: gate → code → first ETHOBOT reply via OpenRouter', async ({ page }) => {
  await page.goto('/cat100');

  // Gate visible (no params, fresh tab)
  await expect(page.getByLabel(/Access code/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Begin/i })).toBeVisible();

  // Enter the smoke code → land on intro with the right cell
  await page.getByLabel(/Access code/i).fill(SMOKE_CODE);
  await page.getByRole('button', { name: /Begin/i }).click();

  await expect(page.locator('[data-testid="participant-info"]')).toContainText('P001');
  await expect(page.getByText(/Learner-directed/i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /AI Classroom Monitoring Tool/i })
  ).toBeVisible();

  // Begin → pre-form
  await page.getByRole('button', { name: /Start: record my initial position/i }).click();
  await expect(page.getByRole('heading', { name: /Before we begin/i })).toBeVisible();

  // Fill the proposal example position
  await page.getByText('Support', { exact: true }).click();
  await page.locator('input[type="range"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el as HTMLInputElement, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, '80');
  await chooseValue(page, 'Safety', '1');
  await chooseValue(page, 'Accountability', '2');
  await page.getByRole('button', { name: /Start the dialogue/i }).click();

  // First ETHOBOT facilitator message arrives via OpenRouter → real Gemini.
  // Real LLM wording varies; we assert the bubble exists and reflects either
  // the stance ("support" / "leaning toward") or a value priority ("safety"
  // / "well-being"), per the proposal opening pattern.
  await expect(
    page.getByText(/leaning toward|support|student (well[- ]being|safety)/i).first()
  ).toBeVisible({ timeout: 45_000 });

  await page.screenshot({ path: 'test-results/production-smoke.png', fullPage: true });
});

import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Visual verification that the SNU cohort runs in fluent, code-level Korean
// (no browser auto-translate). Scenario B = "학생 데이터를 외부와 공유하는 무료 교육 앱".
const OUT = 'test-results/snu-ko';
fs.mkdirSync(OUT, { recursive: true });

const SNU_KO_URL = '/cat100?condition=ld&scenario=b&course=SNU&pid=KO-CAP-001&personaTurns=2';

test('SNU Korean — intro / pre / chat captures', async ({ page }) => {
  // Seed Korean language the way the SNU toggle would (localStorage), before load.
  await page.addInitScript(() => {
    window.localStorage.setItem('ethobot_language', 'ko');
  });

  // --- Intro: Korean scenario + personas (the 조상→학부모 fix lives here) ---
  await page.goto(SNU_KO_URL);
  await expect(page.getByText('학생 데이터를 외부와 공유하는 무료 교육 앱')).toBeVisible();
  await expect(page.getByText('첸 학부모')).toBeVisible();
  // The mistranslation we are replacing must NOT appear anywhere.
  await expect(page.getByText('조상')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/01-intro.png`, fullPage: true });

  // --- Pre form: Korean position input ---
  await page.getByRole('button', { name: '시작하기: 내 첫 입장 기록' }).click();
  await expect(page.getByText('시작하기 전에')).toBeVisible();
  await expect(page.getByText('나의 입장')).toBeVisible();
  await page.screenshot({ path: `${OUT}/02-preform.png`, fullPage: true });

  // Fill a stance + one value priority so we can advance into the chat view.
  await page.getByText('찬성', { exact: true }).first().click();
  // Rank the first value option as 1 (its <select> sits next to the value label).
  const firstRank = page.locator('select').first();
  await firstRank.selectOption('1');
  await page.getByRole('button', { name: '대화 시작하기' }).click();

  // --- Chat view chrome: 이해관계자 / 참여시킨 인물 / 대화 마치기 ---
  await expect(page.getByRole('heading', { name: '이해관계자' })).toBeVisible();
  await expect(page.getByText('참여시킨 인물:')).toBeVisible();
  await page.screenshot({ path: `${OUT}/03-chatview.png`, fullPage: true });
});

// Guard: a stale ethobot_language=ko must NOT leak Korean into non-SNU courses.
test('non-SNU stays English even with ko in localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ethobot_language', 'ko');
  });
  await page.goto('/cat100?condition=ld&scenario=b&course=CAT100&pid=EN-GUARD-001&personaTurns=2');

  // English scenario content + English UI labels, no Korean.
  await expect(page.getByText('Free EdTech App with Student Data Sharing')).toBeVisible();
  await expect(page.getByText('Key actors')).toBeVisible();
  await expect(page.getByText('학생 데이터를 외부와 공유하는 무료 교육 앱')).toHaveCount(0);
  await expect(page.getByText('이 사례의 이해관계자')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/04-cat100-stays-english.png`, fullPage: true });
});

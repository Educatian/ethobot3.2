import { test, expect, type Page, type Route } from '@playwright/test';

// =============================================================================
// Resume coverage
// =============================================================================
// On re-entry (same pid), the app calls get_session(pid). If a snapshot exists
// the student RESUMES: phase + recorded positions + the chat transcript are
// rehydrated and the dialogue continues, skipping the fresh opening.
//   resume-into-chat ........... saved chat snapshot -> chat mounts, transcript
//                                visible, pre-form skipped
//   fresh-when-empty ........... no snapshot -> normal intro (resume gate clears)
//   save-fires-on-progress ..... entering chat persists a snapshot via save_session

const sseChunk = (text: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;

const mockChat = async (page: Page) => {
  await page.route('**/api/cat100-chat', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: sseChunk('Facilitator reply for the resumed dialogue.'),
    });
  });
};

// Generic Supabase stub (registered first, lowest precedence). Specific rpc
// routes registered after this win, since Playwright matches newest-first.
const mockSupabaseGeneric = async (page: Page) => {
  await page.route('**/*.supabase.co/**', async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, body: '' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
};

test.describe('resume', () => {
  test('resume-into-chat: saved transcript rehydrates and skips the pre-form', async ({ page }) => {
    await mockChat(page);
    await mockSupabaseGeneric(page);

    const snapshot = {
      phase: 'chat',
      initialPosition: {
        stance: 'support',
        confidence: 70,
        values: ['Safety'],
        recordedAt: new Date().toISOString(),
      },
      closingPosition: null,
      delta: null,
      closingReflection: '',
      messages: [
        { id: 'm1', speaker: 'facilitator', text: 'RESUMED_OPENING_MARKER welcome back.', timestamp: new Date().toISOString(), turnNumber: 0 },
        { id: 'm2', speaker: 'learner', text: 'EARLIER_STUDENT_TURN about the dilemma.', timestamp: new Date().toISOString(), turnNumber: 1 },
      ],
    };

    await page.route('**/rest/v1/rpc/get_session', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ snapshot, status: 'in_progress', updated_at: new Date().toISOString() }]),
      });
    });

    await page.goto('/cat100?pid=RESUME-TEST-1&condition=ld&scenario=a&course=CAT100&personaTurns=2');

    // Resumed straight into the chat: transcript present, no intro/pre-form.
    await expect(page.getByText('RESUMED_OPENING_MARKER welcome back.')).toBeVisible();
    await expect(page.getByText('EARLIER_STUDENT_TURN about the dilemma.')).toBeVisible();
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start: record my initial position/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Before we begin/i })).toHaveCount(0);
  });

  test('fresh-when-empty: no snapshot resolves the resume gate into the normal intro', async ({ page }) => {
    await mockChat(page);
    await mockSupabaseGeneric(page);
    await page.route('**/rest/v1/rpc/get_session', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/cat100?pid=FRESH-TEST-1&condition=ld&scenario=a&course=CAT100&personaTurns=2');

    await expect(page.getByRole('heading', { name: /AI Classroom Monitoring Tool/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start: record my initial position/i })).toBeVisible();
  });

  test('save-fires-on-progress: an active chat session persists a snapshot by pid', async ({ page }) => {
    await mockChat(page);
    await mockSupabaseGeneric(page);

    // Resume into an in-progress chat so we land in the chat phase deterministically.
    const snapshot = {
      phase: 'chat',
      initialPosition: { stance: 'support', confidence: 70, values: ['Safety'], recordedAt: new Date().toISOString() },
      closingPosition: null,
      delta: null,
      closingReflection: '',
      messages: [
        { id: 'm1', speaker: 'facilitator', text: 'Welcome back to the dialogue.', timestamp: new Date().toISOString(), turnNumber: 0 },
      ],
    };
    await page.route('**/rest/v1/rpc/get_session', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ snapshot, status: 'in_progress', updated_at: new Date().toISOString() }]),
      });
    });

    const saves: any[] = [];
    await page.route('**/rest/v1/rpc/save_session', async (route: Route) => {
      try { saves.push(route.request().postDataJSON()); } catch { /* ignore */ }
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.goto('/cat100?pid=SAVE-TEST-1&condition=ld&scenario=a&course=CAT100&personaTurns=2');
    await expect(page.getByText(/Stakeholder personas/i)).toBeVisible();

    // The debounced save (800ms) should fire for the chat phase, keyed by pid.
    await expect.poll(() => saves.length, { timeout: 6000 }).toBeGreaterThan(0);
    expect(saves.some(s => s?.p_pid === 'SAVE-TEST-1' && s?.p_snapshot?.phase === 'chat')).toBeTruthy();
  });
});

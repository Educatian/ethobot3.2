import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cat100-chat.ts';

test('rejects malformed messages and unsupported generation options before contacting upstream', async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'local-test-placeholder';
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async () => { upstreamCalls++; throw new Error('Unexpected upstream call'); };
  try {
    for (const body of [null, [], { messages: 'hello' }, { messages: [null] },
      { messages: [{ role: 'user', content: 2 }] },
      { messages: [{ role: 'user', content: 'hello' }], model: 'unconfigured-model' },
      { messages: [{ role: 'user', content: 'hello' }], max_tokens: -1 },
      { messages: [{ role: 'user', content: 'hello' }], temperature: 3 }]) {
      const result = await handler(new Request('http://localhost/api/cat100-chat', { method: 'POST', body: JSON.stringify(body) }));
      assert.equal(result.status, 400);
    }
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});

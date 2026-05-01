// Vercel Edge function — proxies CAT 100 chat to OpenRouter with a fallback
// chain. Reads OPENROUTER_API_KEY from server env. The browser never sees
// the key; the Edge function pipes the SSE stream straight back.
//
// Request body:
//   { messages: ChatMessage[], model?: string, temperature?: number, max_tokens?: number }
// Response: text/event-stream (OpenAI-compatible chunks).

export const config = { runtime: 'edge' };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_CHAIN = [
  'google/gemini-2.0-flash-001',
  'google/gemini-flash-1.5',
  'openai/gpt-4o-mini',
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const errorSseStream = (message: string) =>
  new ReadableStream({
    start(controller) {
      const payload = JSON.stringify({
        choices: [{ delta: { content: message } }],
      });
      controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\ndata: [DONE]\n\n`));
      controller.close();
    },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      errorSseStream('CAT 100 chat is not configured (OPENROUTER_API_KEY missing).'),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      }
    );
  }

  let body: { messages?: ChatMessage[]; model?: string; temperature?: number; max_tokens?: number } = {};
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return new Response('messages array is required', { status: 400, headers: corsHeaders });
  }

  const requestedModel = body.model ?? FALLBACK_CHAIN[0];
  const modelChain = [requestedModel, ...FALLBACK_CHAIN.filter(m => m !== requestedModel)];

  let lastError: string | null = null;
  for (const model of modelChain) {
    try {
      const upstream = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ethobot32.vercel.app',
          'X-Title': 'ETHOBOT CAT 100 Persona Dialogue',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: body.temperature ?? 0.7,
          max_tokens: body.max_tokens ?? 400,
        }),
      });

      if (!upstream.ok) {
        lastError = `${model} → ${upstream.status} ${upstream.statusText}`;
        continue;
      }
      if (!upstream.body) {
        lastError = `${model} → empty response body`;
        continue;
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'X-Cat100-Model': model,
        },
      });
    } catch (err) {
      lastError = `${model} → ${(err as Error).message}`;
    }
  }

  return new Response(
    errorSseStream(`(All upstream models unavailable. Last error: ${lastError})`),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    }
  );
}

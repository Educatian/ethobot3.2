import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-time middleware that routes POST /api/cat100-chat through OpenRouter
// using OPENROUTER_API_KEY from .env.local. In production, the corresponding
// Vercel Edge function in `api/cat100-chat.ts` handles the same path.
const cat100DevApiPlugin = (env: Record<string, string>): Plugin => ({
  name: 'cat100-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/cat100-chat', async (req, res) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method not allowed');
        return;
      }
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/plain');
        res.end('OPENROUTER_API_KEY missing in .env.local');
        return;
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
        return;
      }
      const fallbackChain = [
        'google/gemini-2.0-flash-001',
        'google/gemini-flash-1.5',
        'openai/gpt-4o-mini',
      ];
      const requested = parsed.model ?? fallbackChain[0];
      const chain = [requested, ...fallbackChain.filter((m: string) => m !== requested)];

      let lastErr: string | null = null;
      for (const model of chain) {
        try {
          const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'ETHOBOT CAT 100 (dev)',
            },
            body: JSON.stringify({
              model,
              messages: parsed.messages,
              stream: true,
              temperature: parsed.temperature ?? 0.7,
              max_tokens: parsed.max_tokens ?? 400,
            }),
          });
          if (!upstream.ok || !upstream.body) {
            lastErr = `${model} → ${upstream.status}`;
            continue;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('X-Cat100-Model', model);
          // Pipe upstream SSE through unchanged.
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
          res.end();
          return;
        } catch (err) {
          lastErr = `${model} → ${(err as Error).message}`;
        }
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      const errPayload = JSON.stringify({
        choices: [{ delta: { content: `(All upstream models unavailable: ${lastErr})` } }],
      });
      res.end(`data: ${errPayload}\n\ndata: [DONE]\n\n`);
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), cat100DevApiPlugin(env)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('@google/genai')) {
                return 'google-genai';
              }
              if (id.includes('@supabase/supabase-js')) {
                return 'supabase';
              }
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'pdf-export';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              if (id.includes('react-hot-toast')) {
                return 'toast';
              }
              return undefined;
            }
          }
        }
      }
    };
});

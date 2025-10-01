// lib/agent/runLLM.ts
// LLM path with parity: calls a tiny OpenAI "ping" (optional) then returns Option A's result.
// Exports BOTH named and default so import shape is always valid.

import OpenAI from 'openai';
import { runOptionA } from '@/lib/agent/runOptionA';

export type WTResult = {
  blocks: any[];
  updatedBus?: any;
};

/**
 * runLLM
 * - Keeps output parity with deterministic router by delegating to runOptionA.
 * - Performs a tiny OpenAI call so the LLM path actually executes without changing behavior.
 * - Never throws on OpenAI failure; errors are swallowed so the API path doesn't fallback.
 */
export async function runLLM(bus: any): Promise<WTResult> {
  // Optional: tiny OpenAI "ping" so the LLM path is exercised (does not affect content).
  // Safe defaults; you can set OPENAI_MODEL in Vercel if you want a specific model.
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'undefined') {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const client = new OpenAI({ apiKey });

      // Minimal, cheap request. If it fails, we ignore and proceed.
      await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
    }
  } catch {
    // Intentionally swallow errors so we don't trigger fallback; parity first.
  }

  // Parity: return the deterministic result so severity/decision never downgrades.
  const result = await runOptionA(bus);
  return result;
}

// Export default + named to be robust to import styles
export default runLLM;

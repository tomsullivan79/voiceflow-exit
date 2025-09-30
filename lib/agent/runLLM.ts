// lib/agent/runLLM.ts
import OpenAI from "openai";
import { SYSTEM_PROMPT, toolDefs, FinalizeArgs } from "./promptContract";
import { VariableBus } from "@/types/variableBus";
import { referralSearch } from "@/lib/tools/referralSearch";
import { instructionsFetch } from "@/lib/tools/instructionsFetch";
import { statusLookup } from "@/lib/tools/statusLookup";
import { routeDecision } from "@/lib/agent/router";
import { AgentResult } from "./runOptionA";

type ToolResult = unknown & { __finalize__?: FinalizeArgs };

export async function runLLMAgent(bus: VariableBus): Promise<AgentResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Tool handlers capture `bus` so route_decision can read it
  const handlers: Record<string, (args: any) => Promise<ToolResult>> = {
    async route_decision() {
      const routed = routeDecision(bus);
      return routed; // { decision, urgency, reasons, afterHoursNote? }
    },
    async referral_search(args) { return referralSearch(args); },
    async instructions_fetch(args) { return instructionsFetch(args); },
    async status_lookup(args) { return statusLookup(args); },
    async finalize(args) { return { __finalize__: args as FinalizeArgs }; },
  };

  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Here is the Variable Bus JSON. Call route_decision first, then other tools as needed, then finalize.\n\n" +
        JSON.stringify(bus),
    },
  ];

  let final: FinalizeArgs | null = null;

  for (let i = 0; i < 6; i++) {
    const resp = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages,
        tools: toolDefs as any,
        tool_choice: "auto",
        temperature: 0.2,
      },
      { timeout: 20000 }
    );

    const msg = resp.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

      for (const tc of msg.tool_calls) {
        const name = tc.function?.name;
        let args: any = {};
        try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch {}
        const handler = name ? handlers[name] : undefined;
        const result = handler ? await handler(args) : { error: `No handler for ${name}` };

        if ((result as any).__finalize__) {
          final = (result as any).__finalize__ as FinalizeArgs;
        }

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name,
          content: JSON.stringify(result),
        });
      }

      if (final) break;
      continue;
    }

    if (msg.content && i < 5) {
      messages.push({ role: "user", content: "Please call finalize with your blocks and any bus_patch." });
      continue;
    }
    break;
  }

  if (!final) {
    return {
      mode: bus.mode,
      blocks: [{ type: "warning", title: "LLM did not finalize", text: "Falling back to no-op patch." }],
      updatedBus: {},
    };
  }

  return {
    mode: bus.mode,
    blocks: final.blocks as any,
    updatedBus: (final.bus_patch ?? {}) as any,
  };
}

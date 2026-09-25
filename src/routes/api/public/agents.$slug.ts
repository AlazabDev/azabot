// Per-agent HTTP endpoint: POST /api/public/agents/<az-agent-id or slug>
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { findAgent } from "@/lib/agents/registry";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
});

export const Route = createFileRoute("/api/public/agents/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: cors }),
      POST: async ({ request, params }) => {
        const agent = findAgent(params.slug);
        if (!agent) return Response.json({ error: "الوكيل غير موجود." }, { status: 404, headers: cors });
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "الرسالة مطلوبة." }, { status: 400, headers: cors });
        const { runAgent } = await import("@/lib/agents/az-model-core/engine.server");
        const result = await runAgent(agent, parsed.data.message, parsed.data.history);
        return Response.json(
          {
            agent: { id: agent.id, name: agent.name },
            reply: result.reply,
            toolExecuted: result.toolExecuted
              ? { name: result.toolExecuted.name, success: result.toolExecuted.success }
              : undefined,
          },
          { headers: cors },
        );
      },
    },
  },
});

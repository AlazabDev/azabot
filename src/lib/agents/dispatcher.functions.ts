// src/lib/agents/dispatcher.functions.ts
// دوال الحافة الموجهة للعميل (TanStack Start createServerFn)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getAvailableAgents,
  classifyIntent,
  executeAgentChat,
  type DispatchResult,
} from "./dispatcher.server";

// دالة جلب قائمة الوكلاء المتاحين للاستخدام في شريط الاختيار بالواجهة
export const listPublicAgents = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const agents = await getAvailableAgents();
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      roleSlug: a.role_slug,
      description: a.description,
      isDefault: a.is_default,
    }));
  } catch (err: any) {
    console.error("Failed to list agents:", err);
    return [
      {
        id: "default-general",
        name: "عزبوت المساعد الذكي",
        roleSlug: "general",
        description: "المساعد الافتراضي",
        isDefault: true,
      },
    ];
  }
});

// دالة إرسال الرسالة مع التوجيه الذكي وتبديل الوكلاء
export const dispatchMessageToAgent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        message: z.string().min(1).max(2000),
        conversationId: z.string().optional(),
        currentAgentId: z.string().optional(),
        forceAgentId: z.string().optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .optional()
          .default([]),
      })
      .parse(data)
  )
  .handler(async ({ data }): Promise<DispatchResult> => {
    const agents = await getAvailableAgents();

    // 1. تحديد الوكيل (إما إجباري من المستخدم أو عبر التصنيف الذكي)
    let targetAgent = agents[0];
    let switched = false;
    let switchReason: string | undefined;

    if (data.forceAgentId) {
      const found = agents.find((a) => a.id === data.forceAgentId);
      if (found) {
        targetAgent = found;
        switched = data.currentAgentId !== data.forceAgentId;
        switchReason = "تم التحويل بطلب مباشر من المستخدم.";
      }
    } else {
      const classified = classifyIntent(data.message, agents, data.currentAgentId);
      targetAgent = classified.selectedAgent;
      switched = classified.switched;
      switchReason = classified.reason;
    }

    // 2. تنفيذ المحادثة مع الوكيل المختار
    const chatResult = await executeAgentChat(
      targetAgent,
      data.message,
      data.conversationId,
      data.history
    );

    // 3. تجهيز الرد للواجهة
    return {
      reply: chatResult.text,
      conversationId: chatResult.conversationId,
      activeAgent: {
        id: targetAgent.id,
        name: targetAgent.name,
        roleSlug: targetAgent.role_slug,
      },
      agentSwitched: switched,
      switchReason,
      toolExecuted: chatResult.toolResult,
    };
  });

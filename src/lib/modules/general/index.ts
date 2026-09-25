// src/lib/modules/general/index.ts
import { BaseAgent, AgentContext, AgentExecutionResult, ChatMessage } from "../../types";
import { GENERAL_SYSTEM_PROMPT } from "./prompt";

export const GeneralAgent: BaseAgent = {
  id: "agent-general",
  slug: "general",
  name: "عزبوت المساعد العام",
  description: "المساعد الافتراضي للاستفسارات العامة والتوجيه",
  deploymentName: "gpt-4o-mini",
  isDefault: true,
  keywords: ["مرحبا", "سلام", "خدمات", "معلومات", "مساعدة", "استفسار", "دوام"],

  getSystemPrompt: () => GENERAL_SYSTEM_PROMPT,

  async execute(message: string, context: AgentContext): Promise<AgentExecutionResult> {
    const foundryEndpoint = process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_FOUNDRY_API_KEY || process.env.AZURE_OPENAI_API_KEY;

    if (!foundryEndpoint || !apiKey) {
      return {
        reply: "أهلاً بك! يرجى تهيئة مفاتيح الاتصال بالذكاء الاصطناعي في إعدادات المنصة.",
      };
    }

    const messages: ChatMessage[] = [
      { role: "system", content: GENERAL_SYSTEM_PROMPT },
      ...(context.previousMessages?.slice(-6) || []),
      { role: "user", content: message },
    ];

    const cleanUrl = foundryEndpoint.replace(/\/+$/, "");
    const url = `${cleanUrl}/openai/deployments/${this.deploymentName}/chat/completions?api-version=2024-08-01-preview`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ messages, temperature: 0.3 }),
    });

    if (!res.ok) {
      throw new Error(`General Agent Error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      reply: data.choices?.[0]?.message?.content || "عذراً، لم أستطع فهم طلبك.",
    };
  },
};

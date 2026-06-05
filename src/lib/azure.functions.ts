import { createServerFn } from "@tanstack/react-start";

interface AzureMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AzureRequestData {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  temperature: number;
  maxTokens: number;
  messages: AzureMessage[];
}

export const callAzureOpenAI = createServerFn({ method: "POST" })
  .inputValidator((data: AzureRequestData) => data)
  .handler(async ({ data }) => {
    const {
      endpoint,
      apiKey,
      deployment,
      apiVersion,
      temperature,
      maxTokens,
      messages,
    } = data;

    if (!endpoint || !apiKey || !deployment) {
      throw new Error("الإعدادات غير مكتملة: endpoint و apiKey و deployment مطلوبة.");
    }

    const base = endpoint.replace(/\/+$/, "");
    const url = `${base}/openai/deployments/${encodeURIComponent(
      deployment,
    )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure OpenAI ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const reply = json.choices?.[0]?.message?.content ?? "";
    return { reply, usage: json.usage };
  });

export const testAzureConnection = createServerFn({ method: "POST" })
  .inputValidator((data: Omit<AzureRequestData, "messages" | "temperature" | "maxTokens">) => data)
  .handler(async ({ data }) => {
    const base = data.endpoint.replace(/\/+$/, "");
    const url = `${base}/openai/deployments/${encodeURIComponent(
      data.deployment,
    )}/chat/completions?api-version=${encodeURIComponent(data.apiVersion)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": data.apiKey,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
    });
    return { ok: res.ok, status: res.status, statusText: res.statusText };
  });

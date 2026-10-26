const axios = require("axios");
const { AppError } = require("../utils/appError");

// 第 8 课：多 LLM 架构。DeepSeek 和 Ollama 都兼容 OpenAI 的 /chat/completions 接口，
// 所以只写一份调用代码，按顺序尝试，前一个失败就自动回退到下一个。
function getProviders() {
  const providers = [];
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: "DeepSeek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      timeout: 60000,
    });
  }
  providers.push({
    name: "Ollama 本地模型",
    baseURL: `${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}/v1`,
    apiKey: "ollama",
    model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
    timeout: 120000,
  });
  return providers;
}

// 模型偶尔会把 JSON 包在 ```json 代码块里，或在前后加说明文字，这里统一取出 JSON 部分
function parseJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("模型没有返回 JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

async function callProvider(provider, messages, temperature) {
  const response = await axios.post(
    `${provider.baseURL}/chat/completions`,
    {
      model: provider.model,
      messages,
      temperature,
      response_format: { type: "json_object" },
    },
    {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      timeout: provider.timeout,
    },
  );
  return parseJson(response.data.choices[0].message.content);
}

async function chatJson(messages, { temperature = 0.3 } = {}) {
  const failures = [];
  for (const provider of getProviders()) {
    const startedAt = Date.now();
    try {
      const data = await callProvider(provider, messages, temperature);
      return {
        data,
        provider: provider.name,
        model: provider.model,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const reason = error.response?.data?.error?.message || error.message;
      console.warn(`[LLM] ${provider.name} 调用失败，尝试下一个：${reason}`);
      failures.push(`${provider.name}：${reason}`);
    }
  }
  throw new AppError(
    502,
    "LLM_UNAVAILABLE",
    "所有大模型服务都不可用，请稍后再试",
    failures,
  );
}

module.exports = { chatJson, parseJson, getProviders };

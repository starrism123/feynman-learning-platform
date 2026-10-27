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

function requestCompletion(provider, messages, options) {
  const { temperature, json = false, stream = false, signal } = options;
  return axios.post(
    `${provider.baseURL}/chat/completions`,
    {
      model: provider.model,
      messages,
      temperature,
      ...(json && { response_format: { type: "json_object" } }),
      ...(stream && { stream: true }),
    },
    {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      timeout: provider.timeout,
      signal,
      ...(stream && { responseType: "stream" }),
    },
  );
}

// 流式响应是一行行的 SSE：data: {...增量...}，最后一行 data: [DONE]。
// 网络分包可能把一个汉字的几个字节拆到两包里，所以用 TextDecoder 按流解码，不能直接 toString
async function readStream(stream, onToken) {
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return text;
      const delta = JSON.parse(data).choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        onToken(delta);
      }
    }
  }
  return text;
}

// 按顺序尝试每个模型服务，前一个失败就换下一个。
// run 抛出带 noFallback 的错误时直接放弃：流式回答已经发出去一半，不能再换模型从头说
async function withFallback(run) {
  const failures = [];
  for (const provider of getProviders()) {
    const startedAt = Date.now();
    try {
      const result = await run(provider);
      return {
        ...result,
        provider: provider.name,
        model: provider.model,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error.noFallback || error.name === "CanceledError") throw error;
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

async function chatJson(messages, { temperature = 0.3 } = {}) {
  return withFallback(async (provider) => {
    const response = await requestCompletion(provider, messages, {
      temperature,
      json: true,
    });
    return { data: parseJson(response.data.choices[0].message.content) };
  });
}

// 第 11 课：普通文本回答（知识库问答的非流式接口用）
async function chatText(messages, { temperature = 0.3 } = {}) {
  return withFallback(async (provider) => {
    const response = await requestCompletion(provider, messages, {
      temperature,
    });
    return { text: response.data.choices[0].message.content };
  });
}

// 第 11 课：流式回答，每生成一小段就回调 onToken。signal 用来在用户关掉页面时中止请求
async function chatStream(
  messages,
  { temperature = 0.3, onToken, signal } = {},
) {
  return withFallback(async (provider) => {
    const response = await requestCompletion(provider, messages, {
      temperature,
      stream: true,
      signal,
    });
    let started = false;
    try {
      const text = await readStream(response.data, (delta) => {
        started = true;
        onToken(delta);
      });
      return { text };
    } catch (error) {
      error.noFallback = started;
      throw error;
    }
  });
}

module.exports = { chatJson, chatText, chatStream, parseJson, getProviders };

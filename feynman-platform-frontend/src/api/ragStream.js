import apiClient from './axios';

// 第 11 课挑战：流式读取 AI 回答。
// 浏览器自带的 EventSource 只能发 GET、不能带 Authorization 请求头，
// 所以用 fetch 发 POST，再从 response.body 这个可读流里一段段读出后端推来的 SSE 事件。
export async function streamRagAnswer(question, { onSources, onToken, onDone, signal }) {
  const response = await fetch(`${apiClient.defaults.baseURL}/ai/rag-qa/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ question }),
    signal,
  });

  // 检索阶段出错（没登录、问题为空、向量化服务没开）时，后端返回的是普通 JSON 错误
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('/login');
    }
    throw new Error(body?.error?.message || '请求失败，请稍后再试');
  }

  const reader = response.body.getReader();
  // stream: true 让解码器记住被拆开的半个汉字，等下一段到了再拼
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // 每个事件以空行结尾；最后一段可能不完整，留到下一轮
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop();
    for (const block of blocks) {
      const event = block.match(/^event: (.+)$/m)?.[1];
      const data = JSON.parse(block.match(/^data: (.+)$/m)?.[1] || '{}');
      if (event === 'sources') onSources(data.sources);
      else if (event === 'token') onToken(data.text);
      else if (event === 'done') onDone(data);
      else if (event === 'error') throw new Error(data.message);
    }
  }
}

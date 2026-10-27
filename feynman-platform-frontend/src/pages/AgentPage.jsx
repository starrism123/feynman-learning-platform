import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';
import { streamRagAnswer } from '../api/ragStream';
import MarkdownRenderer from '../components/MarkdownRenderer';

const EXAMPLES = ['token 过期了会怎样？', 'props 和 state 有什么区别？', '为什么密码要加盐？'];
const WELCOME = {
  role: 'bot',
  text: '你好！我会根据**你自己的知识点**回答问题，并在句末标出引用了哪条笔记。笔记里没有的，我会直接说没有。',
  sources: [],
  status: 'done',
};

// 回答里出现过的引用编号，例如「…[1][3]」里的 1 和 3
function citedIds(text) {
  return new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
}

// 第 11 课：知识库状态。块是旧的、缺失或向量化服务没开时，提示并给出重建按钮
function KnowledgeBaseStatus() {
  const [status, setStatus] = useState(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    apiClient
      .get('/rag/status')
      .then((response) => setStatus(response.data.data))
      .catch((err) => setMessage(getErrorMessage(err, '读取知识库状态失败')));
  }, []);

  useEffect(load, [load]);

  const rebuild = async () => {
    setIsRebuilding(true);
    setMessage('');
    try {
      const response = await apiClient.post('/rag/reindex');
      setMessage(`已重建：${response.data.data.knowledgePoints} 个知识点，${response.data.data.chunks} 块`);
      load();
    } catch (err) {
      setMessage(getErrorMessage(err, '重建失败'));
    } finally {
      setIsRebuilding(false);
    }
  };

  if (!status) return message ? <p className="error small">{message}</p> : null;
  const stale = status.missing + status.outdated;
  return (
    <div className={`kb-status ${stale || !status.service.online ? 'warn' : ''}`}>
      <span>
        知识库：{status.knowledgePoints.length} 个知识点 · {status.totalChunks} 块
        {stale > 0 && ` · ${stale} 个需要重建`}
      </span>
      <span className={status.service.online ? 'ok' : 'bad'}>
        向量服务{status.service.online ? '在线' : '未启动'}
      </span>
      <button
        type="button"
        className="btn btn-small"
        onClick={rebuild}
        disabled={isRebuilding || !status.service.online}
        title={status.service.online ? '' : '先启动 whisper-service'}
      >
        {isRebuilding ? '重建中…' : '重建索引'}
      </button>
      {message && <span className="muted">{message}</span>}
    </div>
  );
}

function Sources({ sources, text }) {
  if (!sources.length) return null;
  const cited = citedIds(text);
  return (
    <div className="sources">
      <span className="sources-title">引用来源</span>
      {sources.map((source) => (
        <details key={source.id} className={cited.has(source.id) ? 'cited' : 'uncited'}>
          <summary>
            <b>[{source.id}]</b> {source.title}
            <span className="muted"> · 相关度 {source.score}</span>
            {!cited.has(source.id) && <span className="muted"> · 未引用</span>}
          </summary>
          <p className="source-text">{source.text}</p>
          <Link to={`/kp/${source.knowledgePointId}`}>打开这个知识点</Link>
        </details>
      ))}
    </div>
  );
}

function AgentPage() {
  const [messages, setMessages] = useState([WELCOME]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // 离开页面时停止还在生成的回答
  useEffect(() => () => abortRef.current?.abort(), []);

  // 只改最后一条（正在生成的那条）机器人消息
  const updateLast = (patch) =>
    setMessages((list) => {
      const last = list.at(-1);
      return [...list.slice(0, -1), { ...last, ...patch(last) }];
    });

  const ask = async (question) => {
    if (!question.trim() || isLoading) return;
    setMessages((list) => [
      ...list,
      { role: 'user', text: question },
      { role: 'bot', text: '', sources: [], status: 'streaming' },
    ]);
    setInputValue('');
    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamRagAnswer(question, {
        signal: controller.signal,
        onSources: (sources) => updateLast(() => ({ sources })),
        onToken: (text) => updateLast((last) => ({ text: last.text + text })),
        onDone: ({ provider }) => updateLast(() => ({ status: 'done', provider })),
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        updateLast(() => ({ status: 'stopped' }));
      } else {
        updateLast(() => ({ status: 'error', error: err.message }));
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    ask(inputValue);
  };

  return (
    <div className="agent-page">
      <div className="page-head">
        <div>
          <h1>AI 助手</h1>
          <p className="muted">只根据你的知识点回答，每句话标出处。</p>
        </div>
      </div>
      <KnowledgeBaseStatus />

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className="message-bubble">
              {msg.role === 'user' ? (
                msg.text
              ) : (
                <>
                  {msg.text ? (
                    <MarkdownRenderer content={msg.text} />
                  ) : (
                    msg.status === 'streaming' && (
                      <span className="typing-indicator">
                        <span />
                        <span />
                        <span />
                      </span>
                    )
                  )}
                  {msg.status === 'error' && <p className="error small">{msg.error}</p>}
                  {msg.status === 'stopped' && <p className="muted small">已停止</p>}
                  <Sources sources={msg.sources} text={msg.text} />
                  {msg.provider && <p className="muted small">由 {msg.provider} 生成</p>}
                </>
              )}
            </div>
          </div>
        ))}
        {messages.length === 1 && (
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className="btn btn-small" onClick={() => ask(example)}>
                {example}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          maxLength={500}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="问问你的知识库，例如：JWT 为什么不能放密码？"
          disabled={isLoading}
        />
        {isLoading ? (
          <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
            停止
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!inputValue.trim()}>
            发送
          </button>
        )}
      </form>
    </div>
  );
}

export default AgentPage;

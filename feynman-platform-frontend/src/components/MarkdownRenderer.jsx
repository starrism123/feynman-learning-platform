import { useEffect, useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });

// Mermaid 代码块单独做成组件：Hook 只能写在组件顶层，不能写在 components 回调里
function MermaidBlock({ code }) {
  const id = `mermaid-${useId().replace(/:/g, '')}`;
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    mermaid
      .render(id, code)
      .then((result) => {
        if (!cancelled) setSvg(result.svg);
      })
      .catch(() => {
        if (!cancelled) setError('Mermaid 语法有误，无法渲染');
      });
    return () => {
      cancelled = true;
    };
  }, [id, code]);

  if (error) return <pre className="mermaid-error">{error}</pre>;
  // securityLevel: 'strict' 时 Mermaid 会自行清洗输出的 SVG
  return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// 第 6 课：Markdown + GFM 表格 + LaTeX 公式 + Mermaid 图表
// react-markdown 默认不渲染原始 HTML，<script> 和 onerror 这类 XSS 写法会被当成文本丢弃
function MarkdownRenderer({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            if (match?.[1] === 'mermaid') {
              return <MermaidBlock code={String(children).replace(/\n$/, '')} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;

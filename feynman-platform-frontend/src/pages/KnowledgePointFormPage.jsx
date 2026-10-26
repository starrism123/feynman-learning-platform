import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import apiClient, { getErrorMessage } from '../api/axios';
import { STATUS_LABELS } from '../constants';

function KnowledgePointFormPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('not_started');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { id } = useParams(); // 读取 URL 里的 :id；新建时没有
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  // 编辑模式：先把原来的内容取回来填进表单
  useEffect(() => {
    if (!isEditing) return;
    apiClient
      .get(`/knowledge-points/${id}`)
      .then((response) => {
        const kp = response.data.data.knowledgePoint;
        setTitle(kp.title);
        setContent(kp.content);
        setStatus(kp.status);
      })
      .catch((err) => setError(getErrorMessage(err, '读取知识点失败')));
  }, [id, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('标题和内容都不能为空');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const kpData = { title, content, status };
      if (isEditing) {
        await apiClient.patch(`/knowledge-points/${id}`, kpData);
        navigate(`/kp/${id}`);
      } else {
        const response = await apiClient.post('/knowledge-points', kpData);
        navigate(`/kp/${response.data.data.knowledgePoint._id}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, '保存知识点失败'));
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>{isEditing ? '编辑知识点' : '新建知识点'}</h1>
      <form onSubmit={handleSubmit} className="form form-wide">
        <label>
          标题
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：JWT 是什么"
          />
        </label>
        <label>
          学习状态
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="field" data-color-mode="light">
          <span>内容（支持 Markdown、LaTeX 公式、Mermaid 图）</span>
          {/* react-quill 依赖 React 19 已移除的 findDOMNode，所以按讲义改用 MDEditor */}
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || '')}
            height={360}
            previewOptions={{ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : isEditing ? '更新' : '创建'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

export default KnowledgePointFormPage;

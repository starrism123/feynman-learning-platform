import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { STATUS_LABELS } from '../constants';

function KnowledgePointDetailPage() {
  const { id } = useParams();
  const [kp, setKp] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get(`/knowledge-points/${id}`)
      .then((response) => setKp(response.data.data.knowledgePoint))
      .catch((err) => setError(getErrorMessage(err, '读取知识点失败')));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!kp) return <p className="muted">加载中…</p>;

  return (
    <article>
      <div className="page-head">
        <div>
          <Link to="/" className="muted small">
            ← 返回列表
          </Link>
          <h1>{kp.title}</h1>
          <span className={`badge badge-${kp.status}`}>{STATUS_LABELS[kp.status]}</span>
        </div>
        <div className="row">
          <Link to={`/kp/edit/${kp._id}`} className="btn">
            编辑
          </Link>
        </div>
      </div>
      <div className="panel">
        <MarkdownRenderer content={kp.content} />
      </div>
    </article>
  );
}

export default KnowledgePointDetailPage;

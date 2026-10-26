import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { STATUS_LABELS } from '../constants';

function KnowledgePointDetailPage() {
  const { id } = useParams();
  const [kp, setKp] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get(`/knowledge-points/${id}`)
      .then((response) => setKp(response.data.data.knowledgePoint))
      .catch((err) => setError(getErrorMessage(err, '读取知识点失败')));
    apiClient
      .get(`/knowledge-points/${id}/attempts`)
      .then((response) => setAttempts(response.data.data.attempts))
      .catch(() => setAttempts([]));
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
          <div className="row">
            <span className={`badge badge-${kp.status}`}>{STATUS_LABELS[kp.status]}</span>
            {kp.reviewList && <span className="badge badge-review">待复习</span>}
          </div>
        </div>
        <div className="row">
          <Link to={`/feynman/${kp._id}`} className="btn btn-primary">
            开始复述
          </Link>
          <Link to={`/quiz/${kp._id}`} className="btn">
            开始测评
          </Link>
          <Link to={`/kp/edit/${kp._id}`} className="btn">
            编辑
          </Link>
        </div>
      </div>
      <div className="panel">
        <MarkdownRenderer content={kp.content} />
      </div>
      {attempts.length > 0 && (
        <div className="panel">
          <h2>复述记录</h2>
          <ul className="attempts">
            {attempts.map((attempt) => (
              <li key={attempt._id}>
                <span className="attempt-score">{attempt.score ?? '—'}</span>
                <span className="attempt-text">{attempt.polishedText || attempt.transcribedText}</span>
                <span className="muted small">
                  {new Date(attempt.createdAt).toLocaleString('zh-CN')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default KnowledgePointDetailPage;

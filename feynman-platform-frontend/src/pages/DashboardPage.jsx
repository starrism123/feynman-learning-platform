import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { STATUS_LABELS } from '../constants';

function DashboardPage() {
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  // useEffect 处理副作用：组件第一次挂载时拉取列表，空依赖数组表示只执行一次
  useEffect(() => {
    const fetchKnowledgePoints = async () => {
      try {
        const response = await apiClient.get('/knowledge-points');
        setKnowledgePoints(response.data.data.knowledgePoints);
      } catch (err) {
        setError(getErrorMessage(err, '获取知识点失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchKnowledgePoints();
  }, []);

  // 第 6 课挑战：按标题和内容搜索
  const visiblePoints = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return knowledgePoints;
    return knowledgePoints.filter(
      (kp) => kp.title.toLowerCase().includes(text) || kp.content.toLowerCase().includes(text),
    );
  }, [knowledgePoints, keyword]);

  const handleDelete = async (id) => {
    if (!window.confirm('你确定要删除这个知识点吗？')) return;
    try {
      await apiClient.delete(`/knowledge-points/${id}`);
      // 直接从前端状态里移除，不用重新请求整个列表
      setKnowledgePoints((list) => list.filter((kp) => kp._id !== id));
    } catch (err) {
      setError(getErrorMessage(err, '删除失败'));
    }
  };

  if (loading) return <p className="muted">加载中…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>我的知识点</h1>
          <p className="muted">共 {knowledgePoints.length} 个，挑一个用自己的话讲一遍吧。</p>
        </div>
        <Link to="/kp/new" className="btn btn-primary">
          + 新建知识点
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      {knowledgePoints.length > 0 && (
        <input
          className="search"
          placeholder="搜索标题或内容…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      )}

      {knowledgePoints.length === 0 ? (
        <div className="empty">
          <p>你还没有任何知识点，快去创建一个吧！</p>
        </div>
      ) : (
        <ul className="kp-grid">
          {visiblePoints.map((kp) => (
            <li key={kp._id} className="kp-card">
              <div className="kp-card-head">
                <Link to={`/kp/${kp._id}`} className="kp-title">
                  {kp.title}
                </Link>
                <span className={`badge badge-${kp.status}`}>{STATUS_LABELS[kp.status]}</span>
              </div>
              <div className="kp-preview">
                <MarkdownRenderer content={kp.content} />
              </div>
              <div className="kp-actions">
                <Link to={`/kp/${kp._id}`} className="btn btn-small">
                  查看
                </Link>
                <Link to={`/kp/edit/${kp._id}`} className="btn btn-small">
                  编辑
                </Link>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => handleDelete(kp._id)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DashboardPage;

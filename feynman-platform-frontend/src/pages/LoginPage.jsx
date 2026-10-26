import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (event) => {
    event.preventDefault(); // 阻止表单默认的整页刷新
    setError('');
    setSubmitting(true);
    try {
      const response = await apiClient.post('/users/login', { email, password });
      const { token, user } = response.data.data;
      login(token, user); // 写入全局状态，其他组件立刻知道已登录
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, '登录失败，请检查邮箱和密码'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h1>登录</h1>
      <p className="muted">用自己的话讲一遍，才算真的学会。</p>
      {location.state?.registered && <p className="success">注册成功，请登录。</p>}
      <form onSubmit={handleSubmit} className="form">
        <label>
          邮箱
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="muted small">
        还没有账号？<Link to="/register">去注册</Link>
      </p>
    </div>
  );
}

export default LoginPage;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient, { getErrorMessage } from '../api/axios';

function RegisterPage() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // 一个 handleChange 管所有输入框：靠 input 的 name 属性区分字段
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/users/register', formData);
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(getErrorMessage(err, '注册失败，请稍后再试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h1>注册</h1>
      <p className="muted">创建账号，开始你的费曼学习。</p>
      <form onSubmit={handleSubmit} className="form">
        <label>
          用户名
          <input name="username" value={formData.username} onChange={handleChange} required />
        </label>
        <label>
          邮箱
          <input name="email" type="email" value={formData.email} onChange={handleChange} required />
        </label>
        <label>
          密码
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="至少 8 位"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '注册中…' : '注册'}
        </button>
      </form>
      <p className="muted small">
        已有账号？<Link to="/login">去登录</Link>
      </p>
    </div>
  );
}

export default RegisterPage;

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">F</span>
          费曼学习平台
        </Link>
        {/* 第 5 课作业：按登录状态显示不同的导航 */}
        <nav className="nav">
          {token ? (
            <>
              <NavLink to="/" end>
                我的知识点
              </NavLink>
              <NavLink to="/kp/new">新建</NavLink>
              <NavLink to="/agent">AI 助手</NavLink>
              <NavLink to="/graph">知识图谱</NavLink>
              <NavLink to="/3d-world">3D 视界</NavLink>
              <span className="nav-user">{user?.username}</span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                退出登录
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">登录</NavLink>
              <NavLink to="/register">注册</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        {/* Outlet 是占位符，匹配到的子路由页面渲染在这里 */}
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;

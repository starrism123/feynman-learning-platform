import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

// 第 15 课：桌面版用 file:// 打开，地址栏没有服务器帮忙把 /graph 之类的路径退回 index.html，
// 刷新或直接进子路由会白屏；HashRouter 把路由放在 # 后面（index.html#/graph），不依赖服务器
const Router = import.meta.env.MODE === 'electron' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 第 4 课：BrowserRouter 提供客户端路由（桌面版换 HashRouter）；第 5 课：AuthProvider 提供全局登录状态 */}
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>,
);

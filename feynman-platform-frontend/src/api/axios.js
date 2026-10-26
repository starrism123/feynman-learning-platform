import axios from 'axios';

// 后端地址集中在这里配置，部署时通过 VITE_API_BASE_URL 覆盖
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 第 6 课：请求拦截器，每个请求发出前自动带上 token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// token 过期或被篡改时，后端返回 401；清掉本地登录状态并回到登录页
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

// 后端统一返回 { success, data, message } 或 { success: false, error }
export function getErrorMessage(error, fallback = '请求失败，请稍后再试') {
  const apiError = error.response?.data?.error;
  if (apiError?.details?.length) return apiError.details.join('；');
  return apiError?.message || error.response?.data?.msg || fallback;
}

export default apiClient;

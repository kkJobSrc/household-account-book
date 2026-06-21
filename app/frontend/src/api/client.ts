import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('[API Error]', error.response?.status, error.response?.data ?? error.message);
    return Promise.reject(error);
  }
);

export default api;

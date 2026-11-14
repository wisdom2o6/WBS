import axios from "axios";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tự động gắn JWT Token vào Header của mọi request
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

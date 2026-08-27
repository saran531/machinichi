import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
  timeout: 15000,
});

function getGuestId() {
  let gid = localStorage.getItem("guestId");
  if (!gid) {
    gid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("guestId", gid);
  }
  return gid;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers["x-guest-id"]) {
    config.headers["x-guest-id"] = getGuestId();
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
        const refreshPath = isAdmin ? "/admin/auth/refresh" : "/auth/refresh";
        const refreshRes = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"}${refreshPath}`,
          {},
          { withCredentials: true }
        );
        if (refreshRes.data?.accessToken) {
          localStorage.setItem("accessToken", refreshRes.data.accessToken);
        }
        return api(error.config);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        window.dispatchEvent(new Event("unauthorized"));
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

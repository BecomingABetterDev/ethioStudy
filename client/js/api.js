/**
 * api.js — Centralized HTTP client for EthioStudy
 * Handles all fetch calls, attaches JWT tokens, and raises
 * structured errors so callers can react gracefully.
 *
 * Pattern: globals assigned to window for non-module script compatibility.
 * All functions are also exported for use by dashboard.js (module).
 */

// Automatically uses relative paths in production or switches to localhost during development
const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "/api";

/* ─── Core fetch wrapper ─────────────────────────────────────────────────── */
async function request(path, opts = {}) {
  const token = localStorage.getItem("es_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  } catch (networkErr) {
    throw new Error("Network error — check your connection.");
  }

  // Token expired or invalid — clear session and redirect
  if (response.status === 401) {
    localStorage.removeItem("es_token");
    localStorage.removeItem("es_user");
    // Only force a redirect if the user is NOT already on the login or register page
    const isAuthPage =
      window.location.pathname.includes("login.html") ||
      window.location.pathname.includes("register.html");

    if (!isAuthPage) {
      window.location.href = "/login.html";
      throw new Error("Session expired. Please log in again.");
    }
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg = data.message || data.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

/* ─── Auth ───────────────────────────────────────────────────────────────── */
const Auth = {
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  me: () => request("/auth/me"),
};

/* ─── Tasks ──────────────────────────────────────────────────────────────── */
const Tasks = {
  /** GET /api/tasks — returns { success, data: [...], pagination } */
  getAll: () => request("/tasks"),

  /** GET /api/tasks?archived=true */
  getArchived: () => request("/tasks?archived=true"),

  /** GET /api/tasks/:id */
  getOne: (id) => request(`/tasks/${id}`),

  /** POST /api/tasks */
  create: (payload) =>
    request("/tasks", { method: "POST", body: JSON.stringify(payload) }),

  /** PUT /api/tasks/:id */
  update: (id, payload) =>
    request(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  /** PATCH /api/tasks/:id/status */
  updateStatus: (id, status) =>
    request(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  /** PATCH /api/tasks/:id/archive */
  archive: (id) => request(`/tasks/${id}/archive`, { method: "PATCH" }),

  /** PATCH /api/tasks/:id/restore */
  restore: (id) => request(`/tasks/${id}/restore`, { method: "PATCH" }),
  /** DELETE /api/tasks/:id - PRODUCTION ADDITION **/
  delete: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
};

/* ─── Sessions ───────────────────────────────────────────────────────────── */
const Sessions = {
  /** POST /api/sessions */
  create: (payload) =>
    request("/sessions", { method: "POST", body: JSON.stringify(payload) }),

  /**
   * GET /api/sessions — returns { success, data: [...], pagination }
   * Optional limit param for recent-only queries.
   */
  getAll: (limit = 20) => request(`/sessions?limit=${limit}`),
};

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
const Dashboard = {
  /** GET /api/dashboard — returns { success, data: { stats, tasksDueToday, recentSessions, ... } } */
  getStats: () => request("/dashboard"),
};

/* ─── Expose as globals for non-module scripts (register.html) ────────────── */
window.Auth = Auth;
window.Tasks = Tasks;
window.Sessions = Sessions;
window.Dashboard = Dashboard;

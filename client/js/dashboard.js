/**
 * dashboard.js — Main app orchestration for dashboard.html
 *
 * Bootstraps: auth guard, offline detection, navigation, tasks, timer, dashboard stats.
 * Depends on: api.js, db.js, auth.js, offline.js, sync.js, tasks.js, timer.js (all globals)
 */

document.addEventListener("DOMContentLoaded", async () => {
  /* ─── Auth guard ─────────────────────────────────────────────────────── */
  window.AuthUtils.requireAuth();

  /* ─── Offline monitoring (must be before any isOnline() calls) ────────── */
  window.OfflineManager.init();

  /* ─── Open IndexedDB (non-fatal — app works online-only if IDB fails) ── */
  try {
    await window.openDB();
  } catch (idbErr) {
    // IDB may be unavailable in private/sandboxed contexts — continue without it
    console.warn(
      "[EthioStudy] IndexedDB unavailable, running in online-only mode:",
      idbErr.message
    );
  }

  /* ─── Render user ────────────────────────────────────────────────────── */
  renderUserInfo();
  renderGreeting();

  /* ─── Navigation ─────────────────────────────────────────────────────── */
  initNavigation();
  initSidebarToggle();

  /* ─── Global event listeners ─────────────────────────────────────────── */
  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

  // "New Task" button in topbar
  document.getElementById("quickAddTask")?.addEventListener("click", () => {
    navigateTo("tasks");
    setTimeout(() => window.TaskManager.openCreateModal(), 100);
  });

  // "Create Task" button inside tasks view
  document.getElementById("createTaskBtn")?.addEventListener("click", () => {
    window.TaskManager.openCreateModal();
  });

  // Dashboard card "View all" buttons
  document.querySelectorAll(".card-action-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.view));
  });

  /* ─── Load data ──────────────────────────────────────────────────────── */
  await Promise.all([window.TaskManager.loadTasks(), loadDashboardStats()]);

  /* ─── Init modules ───────────────────────────────────────────────────── */
  window.TaskManager.initFilters();
  window.TimerModule.init();

  /* ─── Listen for sync and session events ─────────────────────────────── */
  window.addEventListener("sessionCompleted", loadDashboardStats);
  window.addEventListener("syncComplete", () => window.TaskManager.loadTasks());

  /* ─── Register service worker ────────────────────────────────────────── */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  // Close Task Modal on Cancel or 'X' click
  document.getElementById("taskModalCancel")?.addEventListener("click", () => {
    document.getElementById("taskModalOverlay").classList.add("hidden");
  });
  document.getElementById("taskModalClose")?.addEventListener("click", () => {
    document.getElementById("taskModalOverlay").classList.add("hidden");
  });

  // Close Confirm Modal on Cancel click
  document.getElementById("confirmCancel")?.addEventListener("click", () => {
    document.getElementById("confirmOverlay").classList.add("hidden");
  });

  window.addEventListener("syncComplete", () => {
    console.log("[EthioStudy] Sync complete detected. Refreshing stats...");

    // Call the matching loader engine inside dashboard.js to pull fresh records
    if (typeof fetchDashboardData === "function") {
      fetchDashboardData();
    } else if (typeof loadDashboardStats === "function") {
      loadDashboardStats();
    } else if (typeof initDashboard === "function") {
      initDashboard();
    } else {
      // Clean fallback: force structural update if isolated function references differ
      window.location.reload();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/* NAVIGATION                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
const VIEWS = ["dashboard", "tasks", "timer", "progress", "archive"];
let _currentView = "dashboard";

function initNavigation() {
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.view));
  });
}

function navigateTo(viewName) {
  if (!VIEWS.includes(viewName)) return;
  _currentView = viewName;

  // Highlight active nav item
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const active = btn.dataset.view === viewName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  });

  // Show/hide views
  VIEWS.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== viewName);
  });

  // Topbar title
  const titles = {
    dashboard: "Dashboard",
    tasks: "Tasks",
    timer: "Study Timer",
    progress: "Progress",
    archive: "Archive",
  };
  const titleEl = document.getElementById("topbarTitle");
  if (titleEl) titleEl.textContent = titles[viewName] || "";

  // Lazy-load view-specific data
  if (viewName === "progress") loadProgressView();
  if (viewName === "archive") window.TaskManager.loadArchivedTasks();
  if (viewName === "timer") window.TimerModule.populateTaskSelect();

  closeSidebar();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SIDEBAR (mobile)                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */
function initSidebarToggle() {
  const overlay = getOrCreateOverlay();
  document
    .getElementById("sidebarToggle")
    ?.addEventListener("click", openSidebar);
  document
    .getElementById("sidebarClose")
    ?.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
}

function getOrCreateOverlay() {
  let el = document.getElementById("sidebarOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "sidebarOverlay";
    el.className = "sidebar-overlay";
    document.body.appendChild(el);
  }
  return el;
}

function openSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("visible");
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("visible");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* USER INFO                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
function renderUserInfo() {
  const user = window.AuthUtils.getUser();
  if (!user) return;

  const name = user.username || user.email?.split("@")[0] || "Student";
  const initial = name.charAt(0).toUpperCase();

  setText("userName", name);
  setText("userEmail", user.email || "");
  setText("userAvatar", initial);
  setText("greetingName", name);
}

function renderGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  setText("greetingTime", greeting);

  const dateEl = document.getElementById("viewDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* DASHBOARD STATS                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function loadDashboardStats() {
  if (!window.isOnline()) {
    renderStatsSkeleton();
    return;
  }

  try {
    const response = await window.Dashboard.getStats();
    // Backend shape: { success, data: { stats, tasksDueToday, recentSessions, subjectBreakdown, weeklyActivity } }

    if (response && response.success) {
      const data = response.data;

      // Safely grab weeklyActivity whether it's directly in data or inside data.stats
      const weeklyActivity =
        data.weeklyActivity || (data.stats && data.stats.weeklyActivity) || [];

      renderWeeklyChart(weeklyActivity);
    }

    const d = response.data || response;

    renderStats(d.stats || {});
    renderDueToday(d.tasksDueToday || []);
    renderRecentSessions(d.recentSessions || []);
    renderSubjectBreakdown(d.subjectBreakdown || []);
    // renderWeeklyChart(d.weeklyActivity || []);
  } catch {
    renderStatsSkeleton();
  }
}

window.loadDashboardStats = loadDashboardStats;

function renderStats(stats) {
  setText("statWeeklyHours", formatHours(stats.weeklyStudyMinutes || 0));
  setText("statDueToday", String(stats.tasksDueTodayCount || 0));
  setText("statCompleted", String(stats.completedTasksCount || 0));
  setText("statStreak", `${stats.studyStreak || 0}d`);

  const wml = document.getElementById("weeklyMinutesLabel");
  if (wml)
    wml.textContent = `${formatHours(stats.weeklyStudyMinutes || 0)} total`;
}

function renderStatsSkeleton() {
  ["statWeeklyHours", "statDueToday", "statCompleted", "statStreak"].forEach(
    (id) => {
      setText(id, "—");
    }
  );
}

function renderDueToday(tasks) {
  const list = document.getElementById("dueTodayList");
  if (!list) return;

  if (!tasks.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>Nothing due today.</p>
      </div>`;
    return;
  }

  list.innerHTML = tasks
    .map(
      (t) => `
    <div class="due-item">
      <div class="task-body">
        <div class="due-item-title">${esc(t.title)}</div>
        <div class="due-item-subject">${esc(t.subject || "")}</div>
      </div>
      <span class="task-status-badge ${statusClass(t.status)}">${esc(
        t.status
      )}</span>
    </div>`
    )
    .join("");
}

function renderRecentSessions(sessions) {
  const list = document.getElementById("recentSessionsList");
  if (!list) return;

  if (!sessions.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>No sessions yet. Start studying!</p>
      </div>`;
    return;
  }

  list.innerHTML = sessions
    .map(
      (s) => `
    <div class="session-item">
      <span class="session-item-time">${s.duration}m</span>
      <div class="session-item-info">
        <div class="session-item-title">${esc(
          s.taskTitle || "Study session"
        )}</div>
        <div class="session-item-date">${timeAgo(s.completedAt)}</div>
        
        ${
          s.notes
            ? `
          <div class="session-note-bubble" 
               title="${esc(s.notes)}"
               style="margin-top: 6px; padding: 6px 10px; background-color: #1e293b; border-left: 2px solid #0d9488; border-radius: 4px; font-size: 12px; color: #cbd5e1; font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; white-space: normal; cursor: help; line-height: 1.4;">
            "${esc(s.notes)}"
          </div>
        `
            : ""
        }
      </div>
    </div>`
    )
    .join("");
}

function renderSubjectBreakdown(subjects) {
  const list = document.getElementById("subjectBreakdownList");
  if (!list) return;

  if (!subjects.length) {
    list.innerHTML = '<div class="empty-state"><p>No study data yet.</p></div>';
    return;
  }

  const max = subjects[0]?.minutes || 1;

  list.innerHTML = subjects
    .slice(0, 5)
    .map(
      (s) => `
    <div class="subject-bar-row">
      <div class="subject-bar-label">
        <span>${esc(s.subject || "General")}</span>
        <span>${formatHours(s.minutes)}</span>
      </div>
      <div class="subject-bar-track">
        <div class="subject-bar-fill" style="width:${Math.round(
          (s.minutes / max) * 100
        )}%"></div>
      </div>
    </div>`
    )
    .join("");
}

function renderWeeklyChart(activity) {
  const chart = document.getElementById("weeklyChart");
  if (!chart) return;

  if (!activity || !activity.length) {
    chart.innerHTML =
      '<div class="empty-state" style="font-size:12px"><p>No activity this week.</p></div>';
    return;
  }

  const max = Math.max(...activity.map((a) => a.minutes), 60);
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "short" });

  chart.innerHTML = activity
    .map((day) => {
      // Backend returns { date, dayLabel, minutes, sessions }
      const label = day.dayLabel || day.day || "";
      const minutes = day.minutes || 0;
      const heightPct = Math.round((minutes / max) * 100);
      const isToday = label === todayStr;
      // const title     = minutes > 0 ? `${label}: ${formatHours(minutes)}` : label;
      const title =
        minutes > 0
          ? `${label} • ${minutes} min • ${day.sessions || 0} sessions`
          : `${label} • No study activity`;
      return `
      <div class="week-bar-col${
        isToday ? " today" : ""
      }" data-tooltip="${title}">
        <div class="week-bar-track">
          <div class="week-bar-fill" style="height:${heightPct}%"></div>
        </div>
        <span class="week-bar-label">${label}</span>
      </div>`;
    })
    .join("");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PROGRESS VIEW                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function loadProgressView() {
  if (!window.isOnline()) {
    window.showToast("Connect to view full progress data.", "warn");
    return;
  }

  try {
    const response = await window.Dashboard.getStats();
    const d = response.data || response;
    const stats = d.stats || {};

    setText("progressWeeklyHours", formatHours(stats.weeklyStudyMinutes || 0));
    setText("progressStreak", `${stats.studyStreak || 0} days`);
    setText("progressTopSubject", stats.mostStudiedSubject || "—");

    // Progress page also gets weekly chart + subject chart
    renderProgressWeeklyChart(d.weeklyActivity || []);
    renderProgressSubjectChart(d.subjectBreakdown || []);
    await loadSessionHistory();
  } catch {
    window.showToast("Failed to load progress data.", "error");
  }
}

function renderProgressWeeklyChart(activity) {
  const chart = document.getElementById("progressWeeklyChart");
  if (!chart) return;

  if (!activity || !activity.length) {
    chart.innerHTML =
      '<div class="empty-state" style="font-size:12px"><p>No activity this week.</p></div>';
    return;
  }

  const max = Math.max(...activity.map((a) => a.minutes), 60);
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "short" });

  chart.innerHTML = activity
    .map((day) => {
      const label = day.dayLabel || day.day || "";
      const minutes = day.minutes || 0;
      const heightPct = Math.round((minutes / max) * 100);
      const isToday = label === todayStr;
      // const title     = minutes > 0 ? `${label}: ${formatHours(minutes)}` : label;
      const title =
        minutes > 0
          ? `${label} • ${minutes} min • ${day.sessions || 0} sessions`
          : `${label} • No study activity`;
      return `
      <div class="week-bar-col${
        isToday ? " today" : ""
      }" data-tooltip="${title}">
        <div class="week-bar-track">
          <div class="week-bar-fill" style="height:${heightPct}%"></div>
        </div>
        <span class="week-bar-label">${label}</span>
      </div>`;
    })
    .join("");
}

function renderProgressSubjectChart(subjects) {
  const list = document.getElementById("progressSubjectChart");
  if (!list) return;

  if (!subjects.length) {
    list.innerHTML =
      '<div class="empty-state"><p>No subject data yet.</p></div>';
    return;
  }

  const max = subjects[0]?.minutes || 1;

  list.innerHTML = subjects
    .map(
      (s) => `
    <div class="subject-bar-row">
      <div class="subject-bar-label">
        <span>${esc(s.subject || "General")}</span>
        <span>${formatHours(s.minutes)}</span>
      </div>
      <div class="subject-bar-track">
        <div class="subject-bar-fill" style="width:${Math.round(
          (s.minutes / max) * 100
        )}%"></div>
      </div>
    </div>`
    )
    .join("");
}

async function loadSessionHistory() {
  const list = document.getElementById("progressSessionsList");
  if (!list) return;

  list.innerHTML =
    '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const response = await window.Sessions.getAll(50);
    const sessions = response.data || response.sessions || response || [];

    if (!sessions.length) {
      list.innerHTML =
        '<div class="empty-state"><p>No sessions recorded yet.</p></div>';
      return;
    }

    list.innerHTML = sessions
      .map(
        (s) => `
      <div class="session-history-item">
        <span class="session-history-duration">${s.duration}m</span>
        <div class="session-history-info">
          <div class="session-history-task">${esc(
            s.taskTitle || "Study session"
          )}</div>
          <div class="session-history-date">${new Date(
            s.completedAt
          ).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}</div>
          
          ${
            s.notes
              ? `
          <div class="session-note-bubble" 
               title="${esc(s.notes)}"
               style="margin-top: 6px; padding: 6px 10px; background-color: #0f1117; border-left: 2px solid #0d9488; border-radius: 4px; font-size: 12px; color: #cbd5e1; font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; white-space: normal; cursor: help; line-height: 1.4;">
            "${esc(s.notes)}"
          </div>
        `
              : ""
          }
        </div>
      </div>`
      )
      .join("");
  } catch {
    list.innerHTML =
      '<div class="empty-state"><p>Could not load session history.</p></div>';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* LOGOUT                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
function handleLogout() {
  window.AuthUtils.clearSession();
  window.location.href = "/login.html";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* UTILITIES                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatHours(minutes) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function statusClass(status) {
  return (
    {
      Pending: "status-pending",
      "In Progress": "status-in-progress",
      Completed: "status-completed",
    }[status] || "status-pending"
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

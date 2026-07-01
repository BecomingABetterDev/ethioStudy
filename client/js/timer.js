/**
 * timer.js — Pomodoro study timer module
 *
 * Features:
 *  - 25-minute countdown with animated SVG ring progress
 *  - Start, Pause/Resume, Reset controls
 *  - Saves session to API on completion
 *  - Browser notification on completion
 *  - Task dropdown populated from active tasks
 *
 * Depends on: api.js, offline.js, tasks.js (all globals)
 * Exposed: window.TimerModule
 */

const TimerModule = (() => {
  /* ─── Constants ─────────────────────────────────────────────────────────── */
  const POMODORO_MINUTES = 25;
  const TOTAL_SECONDS = POMODORO_MINUTES * 60;
  const CIRCUMFERENCE = 2 * Math.PI * 90; // SVG circle r=90 → ≈565.48

  /* ─── State ──────────────────────────────────────────────────────────────── */
  let _secondsLeft = TOTAL_SECONDS;
  let _intervalId = null;
  let _isRunning = false;
  let _isPaused = false;
  let _selectedTaskId = null;

  /* ─── DOM helpers ────────────────────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const show = (id) => $(id) && $(id).classList.remove("hidden");
  const hide = (id) => $(id) && $(id).classList.add("hidden");
  const notesInput = document.getElementById("sessionNotes");
notesInput.disabled
  /* ─── Init ───────────────────────────────────────────────────────────────── */
  function init() {
    requestNotificationPermission();

    setTimeout(restoreTimerRunningState, 200);

    $("timerStartBtn")?.addEventListener("click", handleStart);
    $("timerPauseBtn")?.addEventListener("click", handlePause);
    $("timerResetBtn")?.addEventListener("click", handleReset);

    window.addEventListener("tasksLoaded", () => {
      if (_currentView === "timer") populateTaskSelect();
    });

    updateDisplay();
    loadRecentSessions();
  }

  function populateTaskSelect() {
    const select = $("timerTaskSelect");
    if (!select) return;

    const tasks = window.TaskManager
      ? window.TaskManager.getAllTasks().filter(
          (t) => !t.isArchived && t.status !== "Completed"
        )
      : [];

    // Remove all options except placeholder
    while (select.options.length > 1) select.remove(1);

    if (!tasks.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— No active tasks —";
      opt.disabled = true;
      select.appendChild(opt);
      return;
    }

    select.innerHTML =
      '<option value="" disabled selected hidden>-- Choose a task --</option>';

    tasks.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t._id;
      opt.textContent = t.subject ? `${t.title} — ${t.subject}` : t.title;
      select.appendChild(opt);
    });

    // If a timer state was restored and we have an active task ID, re-select and lock it
    if (_selectedTaskId) {
      select.value = _selectedTaskId;

      // Double check that it locked if the timer is actively running or paused
      if (_isRunning || _isPaused) {
        select.disabled = true;
      }
    }
  }

  /* ─── Controls ───────────────────────────────────────────────────────────── */

  function saveTimerRunningState() {
    // If the timer isn't running and isn't paused, wipe the tracking key clean
    if (!_isRunning && !_isPaused) {
      localStorage.removeItem("ethiostudy_timer_state");
      return;
    }

    const state = {
      secondsLeft: _secondsLeft,
      isRunning: _isRunning,
      isPaused: _isPaused,
      selectedTaskId: _selectedTaskId,
      timestamp: Date.now(), // Pinpoints exactly when the state was saved
    };
    localStorage.setItem("ethiostudy_timer_state", JSON.stringify(state));
  }

  function restoreTimerRunningState() {
    const cachedData = localStorage.getItem("ethiostudy_timer_state");
    if (!cachedData) return;

    try {
      const state = JSON.parse(cachedData);
      if (!state) return;

      // If it wasn't actively running or paused when saved, clean up and exit
      if (!state.isRunning && !state.isPaused) {
        localStorage.removeItem("ethiostudy_timer_state");
        return;
      }

      // Calculate exactly how many seconds ticked away while the browser tab was reloading
      let totalSecondsElapsed = 0;
      if (state.isRunning && !state.isPaused) {
        totalSecondsElapsed = Math.floor((Date.now() - state.timestamp) / 1000);
      }

      _secondsLeft = state.secondsLeft - totalSecondsElapsed;
      _selectedTaskId = state.selectedTaskId;
      _isPaused = state.isPaused;

      // If the timer finished while the browser was closed, safely reset
      if (_secondsLeft <= 0) {
        _secondsLeft = 0;
        updateDisplay();
        localStorage.removeItem("ethiostudy_timer_state");
        return;
      }

      // Restore task dropdown selection and lock it securely (Bug 3 constraint)
      const select = $("timerTaskSelect");
      if (select && _selectedTaskId) {
        select.value = _selectedTaskId;
        select.disabled = true;
      }

      // Gracefully restore running states using the system's core parameters
      if (_isPaused) {
        _isRunning = false;
        setStatus("Paused");
        setButtonState("paused");
        $("timerRingProgress")?.classList.add("paused");
      } else {
        _isRunning = true;
        setStatus("Focusing…");
        setButtonState("running");
        _intervalId = setInterval(tick, 1000); // Reuses your central core tick loop!
      }

      updateDisplay();
    } catch (e) {
      console.error("Error restoring timer state:", e);
      localStorage.removeItem("ethiostudy_timer_state");
    }
  }

  function handleStart() {
    // Enable input field only when the active countdown begins
    document.getElementById("sessionNotes").disabled = false;
    document.getElementById("sessionNotes").placeholder =
      "Scribble thoughts, obstacles, or milestones during this session...";

    if (_isPaused) {
      // Resume
      _isRunning = true;
      _isPaused = false;
      _intervalId = setInterval(tick, 1000);
      setStatus("Focusing…");
      setButtonState("running");
      saveTimerRunningState();
      return;
    }

    // Fresh start — require task selection
    const select = $("timerTaskSelect");
    _selectedTaskId = select?.value || null;

    if (!_selectedTaskId) {
      window.showToast("Please select a task before starting.", "warn");
      select?.focus();
      return;
    }

    _secondsLeft = TOTAL_SECONDS;
    _isRunning = true;
    _isPaused = false;
    _intervalId = setInterval(tick, 1000);

    if (select) select.disabled = true;

    updateDisplay();
    setStatus("Focusing…");
    setButtonState("running");

    const ring = $("timerRingProgress");
    if (ring) ring.classList.remove("paused", "complete");
    saveTimerRunningState();
  }

  function handlePause() {
    notesInput.disabled = true;

    if (!_isRunning) return;
    clearInterval(_intervalId);
    _isRunning = false;
    _isPaused = true;
    setStatus("Paused");
    setButtonState("paused");

    const ring = $("timerRingProgress");
    if (ring) ring.classList.add("paused");

    saveTimerRunningState();
  }

  function handleReset() {
    notesInput.disabled = true;
    notesInput.value = ""; // Flush the state for the next block
    notesInput.placeholder =
      "Select a task and start the timer to unlock session notes.";

    clearInterval(_intervalId);
    _isRunning = false;
    _isPaused = false;
    _secondsLeft = TOTAL_SECONDS;
    _selectedTaskId = null;

    const select = $("timerTaskSelect");
    if (select) select.disabled = false; // Re-enable dropdown cleanly

    updateDisplay();
    setStatus("Ready");
    setButtonState("idle");

    localStorage.removeItem("ethiostudy_timer_state");

    const ring = $("timerRingProgress");
    if (ring) {
      ring.classList.remove("paused", "complete");
      ring.style.strokeDashoffset = "0";
    }

    document.title = "Dashboard — EthioStudy";

    saveTimerRunningState();
  }

  /* ─── Tick ───────────────────────────────────────────────────────────────── */
  function tick() {
    _secondsLeft--;
    if (_secondsLeft <= 0) {
      _secondsLeft = 0;
      clearInterval(_intervalId);
      _isRunning = false;
      _isPaused = false;

      const select = $("timerTaskSelect");
      if (select) select.disabled = false; // Re-enable dropdown on end

      updateDisplay();
      localStorage.removeItem("ethiostudy_timer_state"); // Clear cache on completion
      onComplete();
      return;
    }
    updateDisplay();
    saveTimerRunningState(); // <-- CRITICAL: Updates storage countdown context every second!
  }

  /* ─── Display ────────────────────────────────────────────────────────────── */
  function updateDisplay() {
    const mins = String(Math.floor(_secondsLeft / 60)).padStart(2, "0");
    const secs = String(_secondsLeft % 60).padStart(2, "0");

    const displayEl = $("timerDisplay");
    if (displayEl) displayEl.textContent = `${mins}:${secs}`;

    // Update SVG ring
    const ring = $("timerRingProgress");
    if (ring) {
      const elapsed = TOTAL_SECONDS - _secondsLeft;
      const offset = CIRCUMFERENCE * (1 - elapsed / TOTAL_SECONDS);
      ring.style.strokeDashoffset = String(offset);
    }

    // Document title countdown
    if (_isRunning || _isPaused) {
      document.title = `${mins}:${secs} — EthioStudy`;
    }
  }

  function setStatus(text) {
    const el = $("timerStatus");
    if (el) el.textContent = text;
  }

  /* ─── Button state ───────────────────────────────────────────────────────── */
  function setButtonState(state) {
    // state: 'idle' | 'running' | 'paused'
    const startBtn = $("timerStartBtn");
    const pauseBtn = $("timerPauseBtn");
    const resetBtn = $("timerResetBtn");

    if (state === "idle") {
      show("timerStartBtn");
      hide("timerPauseBtn");
      hide("timerResetBtn");
      if (startBtn)
        startBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Start Session`;
    } else if (state === "running") {
      hide("timerStartBtn");
      show("timerPauseBtn");
      show("timerResetBtn");
      if (pauseBtn)
        pauseBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        Pause`;
    } else if (state === "paused") {
      show("timerStartBtn");
      hide("timerPauseBtn");
      show("timerResetBtn");
      if (startBtn)
        startBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Resume`;
    }
  }

  /* ─── Session complete ───────────────────────────────────────────────────── */
  async function onComplete() {
    setStatus("Session complete!");
    setButtonState("idle");

    const ring = $("timerRingProgress");
    if (ring) ring.classList.add("complete");

    notifyBrowser();
    playChime();

    // Save to backend
    const notes = $("sessionNotes")?.value?.trim() || "";
    const payload = {
      taskId: _selectedTaskId,
      duration: POMODORO_MINUTES,
      notes,
    };

    try {
      if (window.isOnline()) {
        await window.Sessions.create(payload);
        window.showToast("Session saved! Great work.", "success");
      } else {
        window.showToast(
          "Session complete — will save when back online.",
          "warn"
        );
      }
    } catch {
      window.showToast("Could not save session to server.", "error");
    }

    // Clear notes
    const notesEl = $("sessionNotes");
    if (notesEl) {
      notesEl.value = "";
      notesInput.placeholder =
        "Select a task and start the timer to unlock session notes.";
    }

    // Reload recent sessions panel
    await loadRecentSessions();

    // Notify dashboard to refresh stats
    window.dispatchEvent(new CustomEvent("sessionCompleted"));

    // Auto-reset after 4 seconds
    setTimeout(handleReset, 4000);

    const select = document.getElementById("timerTaskSelect");
    if (select) select.disabled = false; // Unlock dropdown

    if (typeof window.loadDashboardStats === "function") {
      window.loadDashboardStats();
    }
  }

  /* ─── Recent sessions (timer sidebar) ───────────────────────────────────── */
  async function loadRecentSessions() {
    const list = $("timerSessionsList");
    if (!list) return;

    if (!window.isOnline()) {
      list.innerHTML =
        '<div class="empty-state"><p>Connect to view session history.</p></div>';
      return;
    }

    try {
      const response = await window.Sessions.getAll(8);
      const sessions = response.data || response.sessions || response || [];

      if (!sessions.length) {
        list.innerHTML =
          '<div class="empty-state"><p>No sessions yet. Start studying!</p></div>';
        return;
      }

      list.innerHTML = sessions
        .slice(0, 8)
        .map((s) => {
          const time = new Date(s.completedAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
          return `
          <div class="timer-session-item" style="align-items: flex-start; padding: 10px 8px;">
            <span class="timer-session-min">${s.duration}m</span>
            
            <div style="display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; margin-right: 8px;">
              <span class="timer-session-task" style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${esc(s.taskTitle || "Study session")}
              </span>
              
              ${
                s.notes
                  ? `
              <span class="timer-session-note" 
                    title="${esc(s.notes)}"
                    style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; margin-top: 3px; font-size: 11px; color: #94a3b8; font-style: italic; border-left: 2px solid #0d9488; padding-left: 6px; white-space: normal; cursor: help; line-height: 1.3;">
                "${esc(s.notes)}"
              </span>
            `
                  : ""
              }
            </div>
            
            <span class="timer-session-time">${time}</span>
          </div>`;
        })
        .join("");
    } catch {
      list.innerHTML =
        '<div class="empty-state"><p>Could not load sessions.</p></div>';
    }
  }
  /* ─── Notifications / sound ──────────────────────────────────────────────── */
  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function notifyBrowser() {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("EthioStudy — Session Complete!", {
        body: "Great work! Take a 5-minute break.",
        icon: "/icons/icon-192.png",
      });
    }
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.2 + 0.5
        );
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.5);
      });
    } catch {
      // Audio not available — silently skip
    }
  }

  /* ─── Helpers ────────────────────────────────────────────────────────────── */
  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return { init, populateTaskSelect, loadRecentSessions };
})();

window.TimerModule = TimerModule;

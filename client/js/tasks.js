/**
 * tasks.js — Task management module
 *
 * Handles rendering, CRUD, filtering, and offline fallback for task views.
 * Depends on: api.js, db.js, offline.js, sync.js (all globals).
 * Exposed: window.TaskManager
 */

const TaskManager = (() => {
  /* ─── State ────────────────────────────────────────────────────────────── */
  let _tasks = [];
  let _filter = "all";
  let _search = "";

  /* ─── Load tasks ───────────────────────────────────────────────────────── */
  async function loadTasks() {
    showLoadingState("tasksLoading", true);

    try {
      if (window.isOnline()) {
        const response = await window.Tasks.getAll();
        // Backend: { success, data: [...], pagination }
        _tasks = response.data || response.tasks || response || [];
        // Cache locally
        await window.TaskStore.setAll(_tasks);
      } else {
        _tasks = await window.TaskStore.getAll();
      }
    } catch {
      // Fallback to local cache on any network error
      try {
        _tasks = await window.TaskStore.getAll();
      } catch {
        _tasks = [];
      }
    }
    window.dispatchEvent(new CustomEvent("tasksLoaded", { detail: _tasks }));
    showLoadingState("tasksLoading", false);
    renderTasks();
    updateBadge();
    return _tasks;
  }

  /* ─── Render tasks ─────────────────────────────────────────────────────── */
  function renderTasks() {
    const list = document.getElementById("tasksList");
    if (!list) return;

    const filtered = getFiltered();

    if (filtered.length === 0) {
      const noTasks = _filter === "all" && !_search;
      list.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>${
            noTasks
              ? "No tasks yet. Create your first task."
              : "No tasks match your filter."
          }</p>
          ${
            noTasks
              ? '<button class="btn btn-primary btn-sm" id="emptyCreateBtn">New Task</button>'
              : ""
          }
        </div>`;

      document
        .getElementById("emptyCreateBtn")
        ?.addEventListener("click", openCreateModal);
      return;
    }

    list.innerHTML = filtered.map(renderTaskCard).join("");
    attachCardHandlers();
  }

  function renderTaskCard(task) {
    const isOffline = !!task._offline;
    const isOverdue =
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      task.status !== "Completed";

    const dueDateStr = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    const statusBadge =
      {
        Pending: "status-pending",
        "In Progress": "status-in-progress",
        Completed: "status-completed",
      }[task.status] || "status-pending";

    const btnClass =
      {
        "In Progress": "in-progress",
        Completed: "completed",
      }[task.status] || "";

    return `
      <article class="task-card${
        isOffline ? " offline-pending" : ""
      }" data-id="${esc(task._id)}">
        <div class="task-card-left">
          <button class="task-status-btn ${btnClass}"
            data-id="${esc(task._id)}"
            data-status="${esc(task.status)}"
            aria-label="Cycle task status"
            title="Click to change status"></button>
          <div class="task-body">
            <div class="task-title${
              task.status === "Completed" ? " done" : ""
            }">${esc(task.title)}</div>
            <div class="task-meta">
              ${
                task.subject
                  ? `<span class="task-subject">${esc(task.subject)}</span>`
                  : ""
              }
              ${
                dueDateStr
                  ? `<span class="task-due${isOverdue ? " overdue" : ""}">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                ${isOverdue ? "Overdue · " : ""}${dueDateStr}
              </span>`
                  : ""
              }
              <span class="task-status-badge ${statusBadge}">${esc(
      task.status
    )}</span>
              ${
                isOffline
                  ? `<span class="task-due" title="Will sync when connected">(offline)</span>`
                  : ""
              }
            </div>
          </div>
        </div>
        <div class="task-actions" role="group" aria-label="Task actions">
          <button class="task-action-btn edit-task-btn" data-id="${esc(
            task._id
          )}" aria-label="Edit task" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          
          <button class="task-action-btn archive task-archive-btn" data-id="${esc(
            task._id
          )}" aria-label="Archive task" title="Archive">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
          </button>

          ${
            !task.isArchived
              ? `
          <button class="task-action-btn delete-task-btn" onclick="confirmDeleteTask('${esc(
            task._id
          )}')" aria-label="Permanently delete task" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          `
              : ""
          }
        </div>
      </article>`;
  }

  function attachCardHandlers() {
    document.querySelectorAll(".task-status-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        handleStatusToggle(btn.dataset.id, btn.dataset.status)
      );
    });
    document.querySelectorAll(".edit-task-btn").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });
    document.querySelectorAll(".task-archive-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleArchive(btn.dataset.id));
    });
  }

  /* ─── Filtering ─────────────────────────────────────────────────────────── */
  function getFiltered() {
    return _tasks.filter((t) => {
      if (t.isArchived) return false;
      const matchFilter = _filter === "all" || t.status === _filter;
      const q = _search.toLowerCase();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }

  function initFilters() {
    document.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".filter-tab").forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        _filter = tab.dataset.filter;
        renderTasks();
      });
    });

    const searchInput = document.getElementById("taskSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        _search = e.target.value;
        renderTasks();
      });
    }
  }

  /* ─── Status toggle ────────────────────────────────────────────────────── */
  async function handleStatusToggle(id, currentStatus) {
    const cycle = {
      Pending: "In Progress",
      "In Progress": "Completed",
      Completed: "Pending",
    };
    const newStatus = cycle[currentStatus] || "Pending";

    // Optimistic update
    mutateLocal(id, { status: newStatus });
    renderTasks();
    updateBadge();

    if (window.isOnline()) {
      try {
        const response = await window.Tasks.updateStatus(id, newStatus);
        const updated = response.data || response;
        if (updated && updated._id) {
          mutateLocal(id, updated);
          await window.TaskStore.put(getById(id));
        }
        renderTasks();
      } catch {
        // Revert
        mutateLocal(id, { status: currentStatus });
        renderTasks();
        window.showToast("Failed to update status.", "error");
      }
    } else {
      const task = getById(id);
      if (task) await window.TaskStore.put(task);
      await window.SyncQueue.enqueue("UPDATE_STATUS", {
        id,
        status: newStatus,
      });
      window.showToast("Status updated — will sync when online.", "warn");
    }
    updateBadge();

    if (typeof window.loadDashboardStats === "function") {
      window.loadDashboardStats();
    }
  }
  /**
   * Triggers the pre-existing modal overlay for a permanent delete confirmation
   * @param {string} taskId
   */
  window.confirmDeleteTask = function (taskId) {
    const confirmOverlay = document.getElementById("confirmOverlay");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmMessage = document.getElementById("confirmMessage");
    const confirmOkBtn = document.getElementById("confirmOk");
    const confirmCancelBtn = document.getElementById("confirmCancel");

    if (!confirmOverlay) {
      // Fallback safety if the modal markup isn't found
      if (confirm("Are you sure you want to permanently delete this task?")) {
        executeTaskDeletion(taskId);
      }
      return;
    }

    // 1. Configure the text messages for the action
    confirmTitle.textContent = "Delete Task Permanently";
    confirmMessage.textContent =
      "Are you sure you want to remove this task? This will permanently wipe it from your offline workspace and cloud backups.";

    // 2. Prevent event listener stacking by replacing the button clone
    const newConfirmOkBtn = confirmOkBtn.cloneNode(true);
    confirmOkBtn.parentNode.replaceChild(newConfirmOkBtn, confirmOkBtn);

    // 3. Reveal the modal UI
    confirmOverlay.classList.remove("hidden");

    // 4. Hook up user interactions
    newConfirmOkBtn.addEventListener("click", async () => {
      confirmOverlay.classList.add("hidden");
      await executeTaskDeletion(taskId);
    });

    confirmCancelBtn.addEventListener("click", () => {
      confirmOverlay.classList.add("hidden");
    });
  };

  /**
   * Handles underlying IndexedDB updates and background network sync processing
   * @param {string} taskId
   */
  async function executeTaskDeletion(taskId) {
    try {
      // 1. Instantly remove from local client IndexedDB for zero latency
      await window.TaskStore.delete(taskId);

      // 2. Append a deletion frame record to the background sync queue
      await window.SyncQueue.enqueue("DELETE_TASK", { id: taskId });

      // 3. CRITICAL: If online, flush the queue immediately and AWAIT completion.
      // This stops the server from returning the old task before it finishes deleting it.
      if (window.isOnline() && window.SyncManager) {
        await window.SyncManager.processQueue().catch(() => {});
      }

      // 4. Force the global TaskManager to pull the fresh data state and update your screen
      if (
        window.TaskManager &&
        typeof window.TaskManager.loadTasks === "function"
      ) {
        await window.TaskManager.loadTasks();
      }

      // 5. Push a visual toast confirmation indicator
      if (typeof showToast === "function") {
        showToast("Task deleted permanently.");
      }
    } catch (err) {
      console.error("Critical failure during task deletion workflow:", err);
      if (typeof showToast === "function") {
        showToast("Failed to complete task deletion.", "error");
      }
    }
  }

  /**
   * Reusable Promise-based wrapper for the existing dashboard confirmation modal
   * @param {string} titleText - Heading of the modal
   * @param {string} messageText - Body description text
   * @param {string} confirmButtonText - Context text for the primary CTA (e.g. "Archive")
   * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
   */
  window.showConfirmModal = function (
    titleText,
    messageText,
    confirmButtonText = "Confirm"
  ) {
    return new Promise((resolve) => {
      const overlay = document.getElementById("confirmOverlay");
      const title = document.getElementById("confirmTitle");
      const message = document.getElementById("confirmMessage");
      const okBtn = document.getElementById("confirmOk");
      const cancelBtn = document.getElementById("confirmCancel");

      if (!overlay || !okBtn || !cancelBtn) return resolve(false);

      // 1. Inject contextual copy changes dynamically
      title.textContent = titleText;
      message.textContent = messageText;
      okBtn.textContent = confirmButtonText;

      // Adjust button flavor based on severity (Danger red vs Tech Teal accent color)
      if (confirmButtonText === "Delete") {
        okBtn.className = "btn btn-danger";
      } else {
        okBtn.className = "btn btn-primary"; // Teal styling for safer actions like archive
        okBtn.style.backgroundColor = "#0d9488";
      }

      // 2. Display the modal backdrop array framework
      overlay.classList.remove("hidden");

      // 3. Setup temporary execution cleanups
      const cleanUp = (result) => {
        overlay.classList.add("hidden");
        okBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        resolve(result);
      };

      function onConfirm() {
        cleanUp(true);
      }
      function onCancel() {
        cleanUp(false);
      }

      okBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
    });
  };

  /* ─── Archive ───────────────────────────────────────────────────────────── */
  async function handleArchive(id) {
    const task = getById(id);
    if (!task) return;

    // 1. REPLACED: Swapped native window.confirm with your elegant custom modal
    const userConfirmed = await window.showConfirmModal(
      "Archive Task",
      `Are you sure you want to archive "${task.title}"? You can access and restore it later from your archived collection.`,
      "Archive"
    );

    // If they clicked "Cancel" or closed the modal overlay, stop immediately
    if (!userConfirmed) return;

    // 2. The rest of your excellent offline-first & optimistic UI architecture remains completely untouched:
    _tasks = _tasks.filter((t) => t._id !== id);
    renderTasks();
    updateBadge();

    if (window.isOnline()) {
      try {
        await window.Tasks.archive(id);
        await window.TaskStore.put({ ...task, isArchived: true });
        window.showToast("Task archived.", "success");
      } catch {
        // Revert if network fails unexpectedly
        _tasks.unshift(task);
        renderTasks();
        window.showToast("Failed to archive task.", "error");
      }
    } else {
      // Graceful offline fallback frame handling
      await window.TaskStore.put({ ...task, isArchived: true });
      await window.SyncQueue.enqueue("ARCHIVE_TASK", { id });
      window.showToast("Archived offline — will sync when online.", "warn");
    }

    if (typeof window.loadDashboardStats === "function") {
      window.loadDashboardStats();
    }
  }

  /* ─── Create / Edit modal ───────────────────────────────────────────────── */
  let _editingId = null;

  function openCreateModal() {
    _editingId = null;
    buildModal(
      { title: "", subject: "", dueDate: "", status: "Pending" },
      "New Task"
    );
  }

  function openEditModal(id) {
    const task = getById(id);
    if (!task) return;
    _editingId = id;
    buildModal(task, "Edit Task");
  }

  function buildModal(task, heading) {
    // Remove any existing dynamic modal
    document.getElementById("dynamicTaskModal")?.remove();

    const dueDateVal = task.dueDate
      ? new Date(task.dueDate).toISOString().split("T")[0]
      : "";

    const overlay = document.createElement("div");
    overlay.id = "dynamicTaskModal";
    overlay.className = "modal-overlay active";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "dtModalTitle");

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="dtModalTitle">${heading}</h2>
          <button class="modal-close" id="dtModalClose" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="dtTitle">Task title <span class="required">*</span></label>
            <input class="form-input" id="dtTitle" type="text" value="${esc(
              task.title
            )}"
              placeholder="e.g. Read Chapter 5 — Thermodynamics" maxlength="200" required />
            <span class="form-error" id="dtTitleErr"></span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="dtSubject">Subject <span class="required">*</span></label>
              <input class="form-input" id="dtSubject" type="text" value="${esc(
                task.subject || ""
              )}"
                placeholder="e.g. Physics" maxlength="100" required />
              <span class="form-error" id="dtSubjectErr"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="dtStatus">Status</label>
              <select class="form-select" id="dtStatus">
                <option value="Pending"     ${
                  task.status === "Pending" ? "selected" : ""
                }>Pending</option>
                <option value="In Progress" ${
                  task.status === "In Progress" ? "selected" : ""
                }>In Progress</option>
                <option value="Completed"   ${
                  task.status === "Completed" ? "selected" : ""
                }>Completed</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="dtDueDate">Due date (optional)</label>
            <input class="form-input" id="dtDueDate" type="date" value="${dueDateVal}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="dtDesc">Description (optional)</label>
            <textarea class="form-textarea" id="dtDesc" rows="3" maxlength="1000"
              placeholder="Add notes, chapters to cover, resources...">${esc(
                task.description || ""
              )}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="dtCancel">Cancel</button>
          <button class="btn btn-primary" id="dtSave">
            <span id="dtSaveText">${
              _editingId ? "Save Changes" : "Create Task"
            }</span>
            <span class="btn-spinner hidden" id="dtSpinner"></span>
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      _editingId = null;
    };

    document.getElementById("dtModalClose").addEventListener("click", close);
    document.getElementById("dtCancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document
      .getElementById("dtSave")
      .addEventListener("click", handleModalSave);

    // Trap focus on first input
    setTimeout(() => document.getElementById("dtTitle")?.focus(), 50);
  }

  async function handleModalSave() {
    const titleEl = document.getElementById("dtTitle");
    const titleErr = document.getElementById("dtTitleErr");
    const subjectEl = document.getElementById("dtSubject");
    const subjectErr = document.getElementById("dtSubjectErr");

    titleErr.textContent = "";
    subjectErr.textContent = "";

    const title = titleEl.value.trim();
    const subject = subjectEl.value.trim();

    if (!title) {
      titleErr.textContent = "Title is required.";
      titleEl.focus();
      return;
    }
    if (!subject) {
      subjectErr.textContent = "Subject is required.";
      subjectEl.focus();
      return;
    }

    const payload = {
      title,
      subject,
      dueDate: document.getElementById("dtDueDate").value || undefined,
      status: document.getElementById("dtStatus").value,
      description: document.getElementById("dtDesc").value.trim() || undefined,
    };

    const saveBtn = document.getElementById("dtSave");
    const saveText = document.getElementById("dtSaveText");
    const spinner = document.getElementById("dtSpinner");

    saveBtn.disabled = true;
    saveText.textContent = "Saving…";
    spinner.classList.remove("hidden");

    try {
      if (_editingId) {
        await doUpdateTask(_editingId, payload);
      } else {
        await doCreateTask(payload);
      }
      document.getElementById("dynamicTaskModal")?.remove();
      _editingId = null;
    } catch (err) {
      window.showToast(err.message || "Failed to save task.", "error");
      saveBtn.disabled = false;
      saveText.textContent = _editingId ? "Save Changes" : "Create Task";
      spinner.classList.add("hidden");
    }
    document.getElementById("taskModalOverlay").classList.add("hidden");

    if (typeof window.loadDashboardStats === "function") {
      window.loadDashboardStats();
    }
  }

  /* ─── CRUD ──────────────────────────────────────────────────────────────── */
  async function doCreateTask(payload) {
    if (window.isOnline()) {
      const response = await window.Tasks.create(payload);
      const task = response.data || response;
      _tasks.unshift(task);
      await window.TaskStore.put(task);
      window.showToast("Task created.", "success");
    } else {
      const tempTask = {
        ...payload,
        _id: window.SyncManager.generateTempId(),
        _offline: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      _tasks.unshift(tempTask);
      await window.TaskStore.put(tempTask);
      await window.SyncQueue.enqueue("CREATE_TASK", tempTask);
      window.showToast("Task saved offline — will sync when online.", "warn");
    }
    renderTasks();
    updateBadge();
    document.getElementById("taskModalOverlay").classList.add("hidden");
  }

  async function doUpdateTask(id, payload) {
    if (window.isOnline()) {
      const response = await window.Tasks.update(id, payload);
      const task = response.data || response;
      mutateLocal(id, task);
      const local = getById(id);
      if (local) await window.TaskStore.put(local);
      window.showToast("Task updated.", "success");
    } else {
      mutateLocal(id, payload);
      const local = getById(id);
      if (local) {
        await window.TaskStore.put(local);
        await window.SyncQueue.enqueue("UPDATE_TASK", { id, ...payload });
      }
      window.showToast("Updated offline — will sync when online.", "warn");
    }
    renderTasks();
    document.getElementById("taskModalOverlay").classList.add("hidden");
  }

  /* ─── Archive view ──────────────────────────────────────────────────────── */
  async function loadArchivedTasks() {
    const list = document.getElementById("archiveList");
    if (!list) return;

    list.innerHTML =
      '<div class="loading-state"><div class="spinner"></div></div>';

    try {
      let archived;
      if (window.isOnline()) {
        const response = await window.Tasks.getArchived();
        archived = response.data || response.tasks || response || [];
      } else {
        archived = await window.TaskStore.getArchived();
      }

      if (!archived.length) {
        list.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <p>No archived tasks.</p>
          </div>`;
        return;
      }

      list.innerHTML = archived
        .map(
          (t) => `
        <article class="task-card" data-id="${esc(t._id)}">
          <div class="task-card-left">
            <div class="task-body">
              <div class="task-title done">${esc(t.title)}</div>
              <div class="task-meta">
                ${
                  t.subject
                    ? `<span class="task-subject">${esc(t.subject)}</span>`
                    : ""
                }
                <span class="task-status-badge ${statusBadge(t.status)}">${esc(
            t.status
          )}</span>
                <span class="task-due">Archived</span>
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button class="task-action-btn restore-btn" data-id="${esc(
              t._id
            )}" title="Restore task">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </article>`
        )
        .join("");

      // Restore handlers
      list.querySelectorAll(".restore-btn").forEach((btn) => {
        btn.addEventListener("click", () =>
          handleRestore(btn.dataset.id, list)
        );
      });
    } catch {
      list.innerHTML =
        '<div class="empty-state"><p>Failed to load archived tasks.</p></div>';
    }
  }

  async function handleRestore(id, listEl) {
    if (!window.isOnline()) {
      window.showToast("Restoring requires an internet connection.", "warn");
      return;
    }
    try {
      await window.Tasks.restore(id);
      window.showToast("Task restored.", "success");
      // Reload archive view
      await loadArchivedTasks();
      // Also reload active tasks
      await loadTasks();
    } catch {
      window.showToast("Failed to restore task.", "error");
    }
  }

  /* ─── Helpers ───────────────────────────────────────────────────────────── */
  function getById(id) {
    return _tasks.find((t) => t._id === id);
  }

  function mutateLocal(id, fields) {
    const idx = _tasks.findIndex((t) => t._id === id);
    if (idx !== -1) _tasks[idx] = { ..._tasks[idx], ...fields };
  }

  function showLoadingState(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? "flex" : "none";
  }

  function updateBadge() {
    const badge = document.getElementById("tasksBadge");
    if (!badge) return;
    const pending = _tasks.filter(
      (t) => !t.isArchived && t.status === "Pending"
    ).length;
    badge.textContent = pending > 0 ? String(pending) : "";
  }

  function statusBadge(status) {
    return (
      {
        Pending: "status-pending",
        "In Progress": "status-in-progress",
        Completed: "status-completed",
      }[status] || "status-pending"
    );
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAllTasks() {
    return _tasks;
  }

  return {
    loadTasks,
    renderTasks,
    loadArchivedTasks,
    initFilters,
    openCreateModal,
    getAllTasks,
  };
})();

window.TaskManager = TaskManager;

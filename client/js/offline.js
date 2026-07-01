/**
 * offline.js — Network state detection and offline UI management
 *
 * Monitors navigator.onLine / online / offline events.
 * Updates the offline banner, sidebar sync dot, and triggers SyncManager.
 *
 * Depends on: sync.js (window.SyncManager), db.js, api.js
 * Exposed: window.OfflineManager
 */

const OfflineManager = (() => {
    let _isOnline = navigator.onLine;
    let _listeners = [];

    /* ─── Public API ─────────────────────────────────────────────────────── */
    function isOnline() {
        return _isOnline;
    }

    function onConnectivityChange(fn) {
        _listeners.push(fn);
    }

    /* ─── Toast ──────────────────────────────────────────────────────────── */
    function showToast(message, type = "info") {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.className = "toast-container";
            container.setAttribute("aria-live", "polite");
            document.body.appendChild(container);
        }

        const iconMap = {
            success: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            error: '<path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            warn: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
            info: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        };

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        ${iconMap[type] || iconMap.info}
      </svg>
      <span>${message}</span>
    `;

        container.appendChild(toast);

        // Auto-dismiss after 3.5 seconds
        setTimeout(() => {
            toast.classList.add("toast-out");
            toast.addEventListener("animationend", () => toast.remove(), {
                once: true,
            });
        }, 3500);
    }

    /* ─── UI helpers ─────────────────────────────────────────────────────── */
    function setSyncStatus(status) {
        const syncDot = document.getElementById("syncDot");
        const syncText = document.getElementById("syncStatusText");
        const syncInd = document.getElementById("syncIndicator");

        const map = {
            synced: { cls: "", label: "Synced" },
            offline: { cls: "offline", label: "Offline" },
            syncing: { cls: "syncing", label: "Syncing…" },
            error: { cls: "error", label: "Sync error" },
        };

        const s = map[status] || map.synced;
        if (syncDot) syncDot.className = `sync-status-dot ${s.cls}`.trim();
        if (syncText) syncText.textContent = s.label;
        if (syncInd) syncInd.textContent = status === "syncing" ? "(syncing…)" : "";
    }

    function updateBanner() {
        const banner = document.getElementById("offlineBanner");
        const bannerTxt = document.getElementById("offlineBannerText");
        const appShell = document.getElementById("appShell");

        if (!banner) return;

        if (_isOnline) {
            banner.classList.remove("visible");
            appShell && appShell.classList.remove("offline-active");
        } else {
            banner.classList.add("visible");
            appShell && appShell.classList.add("offline-active");
            if (bannerTxt) {
                bannerTxt.textContent =
                    "You're offline. Task changes will sync when connection returns.";
            }
        }

        setSyncStatus(_isOnline ? "synced" : "offline");
    }

    /* ─── Event handlers ─────────────────────────────────────────────────── */
    async function handleOnline() {
        _isOnline = true;
        updateBanner();
        _listeners.forEach((fn) => fn(true));

        setSyncStatus("syncing");
        try {
            const count = await window.SyncManager.processQueue();
            setSyncStatus("synced");
            if (count > 0) {
                showToast(
                    `Synced ${count} offline change${count === 1 ? "" : "s"}.`,
                    "success"
                );
                // Notify app to reload tasks after sync
                window.dispatchEvent(new CustomEvent("syncComplete"));
            }
        } catch {
            setSyncStatus("error");
            showToast("Sync encountered an error. Will retry later.", "error");
        }
    }

    function handleOffline() {
        _isOnline = false;
        updateBanner();
        _listeners.forEach((fn) => fn(false));
    }

    /* ─── Init ───────────────────────────────────────────────────────────── */
    function init() {
        updateBanner();
        // Wrap async handlers so unhandled rejections never surface as isTrusted Events
        window.addEventListener("online", () => {
            handleOnline().catch((e) => {
                console.warn(
                    "[EthioStudy] Sync error on reconnect:",
                    e && e.message ? e.message : e
                );
                setSyncStatus("error");
            });
        });
        window.addEventListener("offline", handleOffline);
    }

    return { init, isOnline, onConnectivityChange, showToast, setSyncStatus };
})();

window.OfflineManager = OfflineManager;

// Convenience alias used throughout the codebase
window.showToast = OfflineManager.showToast.bind(OfflineManager);
window.isOnline = OfflineManager.isOnline.bind(OfflineManager);

let deferredPrompt = null;

// Listen for the browser's native install readiness broadcast
window.addEventListener("beforeinstallprompt", (e) => {
    // 1. Stop older Android/Chrome versions from showing an ugly default banner
    e.preventDefault();

    // 2. Save the execution trigger event globally so we can fire it on demand
    deferredPrompt = e;

    // 3. Reveal your gorgeous custom-built app notification UI banner
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) {
        banner.classList.remove("hidden");
    }
});

// Attach button event triggers once DOM compiles
document.addEventListener("DOMContentLoaded", () => {
    const banner = document.getElementById("pwaInstallBanner");
    const installBtn = document.getElementById("actionPwaInstall");
    const closeBtn = document.getElementById("closePwaBanner");

    if (installBtn) {
        installBtn.addEventListener("click", async() => {
            if (!deferredPrompt) return;

            // Show the native browser confirmation prompt dialog overlay
            deferredPrompt.prompt();

            // Await user option choice (Accepted app install vs Declined)
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA installation outcome: ${outcome}`);

            // Clean up memory space and hide the notification banner frame
            deferredPrompt = null;
            if (banner) banner.classList.add("hidden");
        });
    }

    if (closeBtn && banner) {
        closeBtn.addEventListener("click", () => {
            banner.classList.add("hidden");
        });
    }
});
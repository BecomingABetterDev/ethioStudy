/**
 * sync.js — Offline sync queue processor
 *
 * When internet returns, this module:
 *  1. Reads all pending operations from IndexedDB syncQueue
 *  2. Replays them against the live API sequentially
 *  3. Updates the local task cache with server responses
 *  4. Removes successful items from the queue
 *  5. Leaves failed items for retry (up to MAX_RETRIES)
 *
 * Depends on: db.js (window.TaskStore, window.SyncQueue), api.js (window.Tasks)
 * Exposed: window.SyncManager
 */

const SyncManager = (() => {
    const MAX_RETRIES = 3;

    /**
     * Generate a temporary client-side ID for offline-created tasks.
     * @returns {string}
     */
    function generateTempId() {
        return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    /**
     * Process all items in the IndexedDB sync queue.
     * @returns {Promise<number>} Number of successfully processed operations
     */
    async function processQueue() {
        const items = await window.SyncQueue.getAll();
        if (items.length === 0) return 0;

        let successCount = 0;

        for (const item of items) {
            // Skip permanently failed items
            if (item.retries >= MAX_RETRIES) {
                await window.SyncQueue.remove(item.id);
                continue;
            }

            try {
                await replayOperation(item);
                await window.SyncQueue.remove(item.id);
                successCount++;
            } catch {
                console.error(
                    `[SyncManager] Background sync failed for operation ${item.id} [Action: ${item.action}]:`,
                    err.message || err
                );

                // Increment retry count, leave in queue for next sync
                await window.SyncQueue.incrementRetry(item);
            }
        }

        return successCount;
    }

    /**
     * Execute a single queued operation against the live API.
     * @param {object} item — { id, action, payload, retries }
     */
    async function replayOperation(item) {
        const { action, payload } = item;

        switch (action) {
            case "CREATE_TASK":
                {
                    // Payload has a temp _id — send without it to let server generate real _id
                    const tempId = payload._id;
                    const body = {...payload };
                    delete body._id;
                    delete body._offline;

                    const response = await window.Tasks.create(body);
                    const newTask = response.data || response;

                    // Swap temp task for the real server task in local store
                    if (tempId) await window.TaskStore.delete(tempId);
                    if (newTask && newTask._id) await window.TaskStore.put(newTask);
                    break;
                }

            case "UPDATE_TASK":
                {
                    const { id, ...fields } = payload;
                    const response = await window.Tasks.update(id, fields);
                    const updated = response.data || response;
                    if (updated && updated._id) await window.TaskStore.put(updated);
                    break;
                }

            case "UPDATE_STATUS":
                {
                    const { id, status } = payload;
                    const response = await window.Tasks.updateStatus(id, status);
                    const updated = response.data || response;
                    if (updated && updated._id) await window.TaskStore.put(updated);
                    break;
                }

            case "ARCHIVE_TASK":
                {
                    const { id } = payload;
                    const response = await window.Tasks.archive(id);
                    const updated = response.data || response;
                    if (updated && updated._id) await window.TaskStore.put(updated);
                    break;
                }
            case "DELETE_TASK":
                {
                    const { id } = payload;
                    // If it's a true server ID, tell the server to wipe it out
                    if (id && !id.startsWith("local_")) {
                        await window.Tasks.delete(id);
                    }
                    break;
                }
            default:
                // Unknown action — discard silently
                break;
        }
    }

    /**
     * Get count of items still waiting in the queue.
     * @returns {Promise<number>}
     */
    async function getPendingCount() {
        return window.SyncQueue.count();
    }

    return { processQueue, getPendingCount, generateTempId };
})();

window.SyncManager = SyncManager;
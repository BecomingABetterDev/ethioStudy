const Task = require("../models/Task");

// ─── Get All Tasks ───────────────────────────────────────────────────────────
const getTasks = async(req, res, next) => {
    try {
        const { status, subject, archived, page = 1, limit = 50 } = req.query;

        const query = {
            userId: req.user._id,
            isArchived: archived === "true" ? true : false,
        };

        if (status) query.status = status;
        if (subject) query.subject = { $regex: subject, $options: "i" };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [rawTasks, total] = await Promise.all([
            Task.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
            Task.countDocuments(query),
        ]);

        const tasks = rawTasks.map((task) => ({
            ...task,
            isOverdue: task.dueDate &&
                task.status !== "Completed" &&
                new Date() > new Date(task.dueDate),
        }));

        res.json({
            success: true,
            data: tasks,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─── Get Single Task ─────────────────────────────────────────────────────────
const getTask = async(req, res, next) => {
    try {
        const task = await Task.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });
        if (!task) {
            return res
                .status(404)
                .json({ success: false, message: "Task not found." });
        }
        res.json({ success: true, data: task });
    } catch (error) {
        next(error);
    }
};

// ─── Create Task ─────────────────────────────────────────────────────────────
const createTask = async(req, res, next) => {
    try {
        const { title, subject, description, dueDate, status, syncId } = req.body;

        // Prevent duplicate syncs from offline queue
        if (syncId) {
            const existing = await Task.findOne({ syncId, userId: req.user._id });
            if (existing) {
                return res.status(200).json({
                    success: true,
                    message: "Task already synced.",
                    data: existing,
                    duplicate: true,
                });
            }
        }

        const task = await Task.create({
            userId: req.user._id,
            title,
            subject,
            description,
            dueDate: dueDate || null,
            status: status || "Pending",
            syncId: syncId || null,
        });

        res
            .status(201)
            .json({ success: true, message: "Task created.", data: task });
    } catch (error) {
        next(error);
    }
};

// ─── Update Task ─────────────────────────────────────────────────────────────
const updateTask = async(req, res, next) => {
    try {
        const { title, subject, description, dueDate, status } = req.body;

        const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, isArchived: false }, { title, subject, description, dueDate, status }, { new: true, runValidators: true, omitUndefined: true });

        if (!task) {
            return res
                .status(404)
                .json({ success: false, message: "Task not found." });
        }

        res.json({ success: true, message: "Task updated.", data: task });
    } catch (error) {
        next(error);
    }
};

// ─── Update Task Status ───────────────────────────────────────────────────────
const updateTaskStatus = async(req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ["Pending", "In Progress", "Completed"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, isArchived: false }, { status }, { new: true });

        if (!task) {
            return res
                .status(404)
                .json({ success: false, message: "Task not found." });
        }

        res.json({ success: true, message: "Status updated.", data: task });
    } catch (error) {
        next(error);
    }
};
// ─── Delete Task  ──────────────────────────────────────────────
const deleteTask = async(req, res, next) => {
    try {
        const taskId = req.params.id;
        const userId = req.user._id;

        // Ensure users can only delete their own tasks
        const deletedTask = await Task.findOneAndDelete({
            _id: taskId,
            userId: userId,
        });

        if (!deletedTask) {
            return res
                .status(404)
                .json({ success: false, message: "Task not found" });
        }

        res
            .status(200)
            .json({ success: true, message: "Task permanently deleted" });
    } catch (err) {
        next(err);
    }
};
// ─── Archive Task (Soft Delete) ──────────────────────────────────────────────
const archiveTask = async(req, res, next) => {
    try {
        const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { isArchived: true }, { new: true });

        if (!task) {
            return res
                .status(404)
                .json({ success: false, message: "Task not found." });
        }

        res.json({ success: true, message: "Task archived.", data: task });
    } catch (error) {
        next(error);
    }
};

// ─── Restore Archived Task ────────────────────────────────────────────────────
const restoreTask = async(req, res, next) => {
    try {
        const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, isArchived: true }, { isArchived: false }, { new: true });

        if (!task) {
            return res
                .status(404)
                .json({ success: false, message: "Archived task not found." });
        }

        res.json({ success: true, message: "Task restored.", data: task });
    } catch (error) {
        next(error);
    }
};

// ─── Bulk Sync (from offline queue) ──────────────────────────────────────────
const bulkSync = async(req, res, next) => {
    try {
        const { operations } = req.body;

        if (!Array.isArray(operations) || operations.length === 0) {
            return res
                .status(400)
                .json({ success: false, message: "Operations array is required." });
        }

        const results = [];

        for (const op of operations) {
            try {
                if (op.action === "CREATE_TASK") {
                    // Check for duplicate
                    let task = null;
                    if (op.payload.syncId) {
                        task = await Task.findOne({
                            syncId: op.payload.syncId,
                            userId: req.user._id,
                        });
                    }
                    if (!task) {
                        task = await Task.create({...op.payload, userId: req.user._id });
                    }
                    results.push({
                        localId: op.localId,
                        success: true,
                        data: task,
                        action: op.action,
                    });
                } else if (op.action === "UPDATE_TASK") {
                    const task = await Task.findOneAndUpdate({ _id: op.payload.id, userId: req.user._id },
                        op.payload.updates, { new: true }
                    );
                    results.push({
                        localId: op.localId,
                        success: !!task,
                        data: task,
                        action: op.action,
                    });
                } else if (op.action === "ARCHIVE_TASK") {
                    const task = await Task.findOneAndUpdate({ _id: op.payload.id, userId: req.user._id }, { isArchived: true }, { new: true });
                    results.push({
                        localId: op.localId,
                        success: !!task,
                        data: task,
                        action: op.action,
                    });
                } else {
                    results.push({
                        localId: op.localId,
                        success: false,
                        error: "Unknown action",
                    });
                }
            } catch (opErr) {
                results.push({
                    localId: op.localId,
                    success: false,
                    error: opErr.message,
                });
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getTasks,
    getTask,
    createTask,
    updateTask,
    updateTaskStatus,
    archiveTask,
    restoreTask,
    bulkSync,
    deleteTask,
};
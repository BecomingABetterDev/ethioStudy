const express = require("express");
const router = express.Router();
const {
    getTasks,
    getTask,
    createTask,
    updateTask,
    updateTaskStatus,
    archiveTask,
    restoreTask,
    bulkSync,
    deleteTask,
} = require("../controllers/taskController");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

router.get("/", getTasks);
router.post("/", createTask);
router.post("/sync", bulkSync);

router.get("/:id", getTask);
router.put("/:id", updateTask);
router.patch("/:id/status", updateTaskStatus);
router.patch("/:id/archive", archiveTask);
router.patch("/:id/restore", restoreTask);
router.delete("/:id", deleteTask);

module.exports = router;
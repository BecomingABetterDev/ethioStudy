const Session = require('../models/Session');
const Task = require('../models/Task');

// ─── Get Sessions ─────────────────────────────────────────────────────────────
const getSessions = async (req, res, next) => {
  try {
    const { limit = 20, page = 1, subject } = req.query;
    const query = { userId: req.user._id };
    if (subject) query.subject = { $regex: subject, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Session.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Create Session ───────────────────────────────────────────────────────────
const createSession = async (req, res, next) => {
  try {
    const { taskId, duration, notes } = req.body;

    if (!taskId || !duration) {
      return res.status(400).json({
        success: false,
        message: 'taskId and duration are required.',
      });
    }

    // Verify task belongs to user
    const task = await Task.findOne({ _id: taskId, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const session = await Session.create({
      userId: req.user._id,
      taskId: task._id,
      taskTitle: task.title,
      subject: task.subject,
      duration,
      notes: notes || '',
      completedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Study session saved.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Session ───────────────────────────────────────────────────────────
const deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    res.json({ success: true, message: 'Session deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSessions, createSession, deleteSession };

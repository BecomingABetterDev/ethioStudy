const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    // Denormalized for query performance and historical accuracy
    taskTitle: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number, // in minutes
      required: [true, 'Session duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
      max: [120, 'Duration cannot exceed 120 minutes'],
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
sessionSchema.index({ userId: 1, completedAt: -1 });
sessionSchema.index({ userId: 1, subject: 1, completedAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);

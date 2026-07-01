const mongoose = require('mongoose');

const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'];

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [100, 'Subject cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: 'Status must be Pending, In Progress, or Completed',
      },
      default: 'Pending',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    // Used for offline-sync: client-generated UUID to prevent duplicates
    syncId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Compound Index ─────────────────────────────────────────────────────────
taskSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1, isArchived: 1 });
taskSchema.index({ userId: 1, dueDate: 1, isArchived: 1 });

// ─── Virtual: isOverdue ─────────────────────────────────────────────────────
taskSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate || this.status === 'Completed') return false;
  return new Date() > new Date(this.dueDate);
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;

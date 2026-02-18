const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['jobseeker', 'employer', 'admin'],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['job_recommendation', 'application_status', 'saved_job_expiry', 'pricing', 'system'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    ctaPath: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    ctaLabel: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    dedupeKey: {
      type: String,
      trim: true,
      maxlength: 200,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);

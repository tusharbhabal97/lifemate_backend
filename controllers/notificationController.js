const Notification = require('../models/Notification');
const { successResponse, errorResponse, notFoundResponse } = require('../utils/response');
const {
  createNotification,
  generateSavedJobExpiryNotificationsForUser,
} = require('../services/notificationService');

const pricingEventMeta = {
  view_pricing: {
    title: 'Pricing plans viewed',
    message: 'You viewed pricing plans. Compare features and choose the best fit for your hiring goals.',
    ctaPath: '/pricing',
    ctaLabel: 'View Pricing',
  },
  select_plan: {
    title: 'Plan selected',
    message: 'You selected a plan in pricing. Complete checkout when ready.',
    ctaPath: '/pricing',
    ctaLabel: 'Complete Selection',
  },
  checkout_intent: {
    title: 'Checkout initiated',
    message: 'You started plan checkout. Finish payment to activate plan benefits.',
    ctaPath: '/pricing',
    ctaLabel: 'Continue Checkout',
  },
};

exports.listMine = async (req, res) => {
  try {
    if (req.user.role === 'jobseeker') {
      await generateSavedJobExpiryNotificationsForUser(req.user);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filters = { user: req.user._id };
    if (req.query.unreadOnly === 'true') {
      filters.readAt = null;
    }
    if (req.query.type) {
      filters.type = req.query.type;
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filters).sort('-createdAt').skip(skip).limit(limit).lean(),
      Notification.countDocuments(filters),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);

    return successResponse(res, 200, 'Notifications fetched', {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      unreadCount,
    });
  } catch (err) {
    console.error('List notifications error:', err);
    return errorResponse(res, 500, 'Failed to fetch notifications');
  }
};

exports.markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();

    if (!notification) return notFoundResponse(res, 'Notification not found');

    return successResponse(res, 200, 'Notification marked as read', { notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return errorResponse(res, 500, 'Failed to update notification');
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    return successResponse(res, 200, 'All notifications marked as read');
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    return errorResponse(res, 500, 'Failed to update notifications');
  }
};

exports.createPricingEvent = async (req, res) => {
  try {
    const { eventType, planId, planName } = req.body || {};
    if (!eventType || !pricingEventMeta[eventType]) {
      return errorResponse(res, 400, 'Invalid pricing notification event');
    }

    const base = pricingEventMeta[eventType];
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const suffix = planId ? `:${planId}` : '';
    const dedupeKey = `pricing:${eventType}:${ymd}${suffix}`;

    const title =
      eventType === 'select_plan' && planName
        ? `Plan selected: ${planName}`
        : base.title;

    const notification = await createNotification({
      user: req.user._id,
      role: req.user.role,
      type: 'pricing',
      title,
      message: base.message,
      ctaPath: base.ctaPath,
      ctaLabel: base.ctaLabel,
      metadata: {
        eventType,
        planId,
        planName,
      },
      dedupeKey,
    });

    return successResponse(res, 201, 'Pricing notification created', { notification });
  } catch (err) {
    console.error('Create pricing event notification error:', err);
    return errorResponse(res, 500, 'Failed to create pricing notification');
  }
};

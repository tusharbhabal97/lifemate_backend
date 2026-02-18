const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { successResponse, errorResponse } = require('../utils/response');
const { sendNewsletterSubscriptionEmail } = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.subscribe = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const source = req.body?.source || 'landing-page';
    const email = String(rawEmail || '').trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return errorResponse(res, 400, 'Please provide a valid email address');
    }

    const existing = await NewsletterSubscriber.findOne({ email });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.subscribedAt = new Date();
        existing.source = source;
        await existing.save();
      }

      sendNewsletterSubscriptionEmail(email).catch(() => {});
      return successResponse(res, 200, 'You are already subscribed to updates');
    }

    await NewsletterSubscriber.create({
      email,
      source,
      subscribedAt: new Date(),
      isActive: true,
    });

    sendNewsletterSubscriptionEmail(email).catch(() => {});

    return successResponse(res, 201, 'Subscription successful');
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    if (err?.code === 11000) {
      return successResponse(res, 200, 'You are already subscribed to updates');
    }
    return errorResponse(res, 500, 'Failed to subscribe. Please try again.');
  }
};

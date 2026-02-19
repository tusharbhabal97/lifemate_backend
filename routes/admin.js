const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middlewares/auth');

// All admin routes require admin auth
router.use(authenticate, requireAdmin);

// Users management
router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.changeUserRole);

// Employers management
router.get('/employers', adminController.listEmployers);
router.patch('/employers/:id/verify', adminController.verifyEmployer);
router.patch('/employers/:id/unverify', adminController.unverifyEmployer);

// Jobs moderation
router.get('/jobs', adminController.listJobs);

// Subscription and pricing management
router.get('/subscriptions', adminController.listSubscriptions);
router.patch('/subscriptions/:id', adminController.updateEmployerSubscription);
router.get('/pricing-plans', adminController.getPricingPlans);
router.put('/pricing-plans', adminController.updatePricingPlans);

// Stats
router.get('/stats', adminController.getStats);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validatePasswordChange,
} = require('../middlewares/validation');
const oauthController = require('../controllers/oauthController');

// Public routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/oauth/exchange', authController.oauthExchange);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', validatePasswordReset, authController.resetPassword);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, validatePasswordChange, authController.changePassword);

// OAuth route aliases (mirror /api/oauth/* under /api/auth/*)
router.get('/google', oauthController.startGoogle);
router.get('/google/callback', oauthController.googleCallback);
router.get('/google/failure', oauthController.googleFailure);

module.exports = router;

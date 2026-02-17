const passport = require('passport');
const { generateOAuthExchangeToken } = require('../utils/jwt');

// GET /api/oauth/google?role=jobseeker|employer
exports.startGoogle = (req, res, next) => {
  const role = (req.query.role || '').toLowerCase();
  const allowed = ['jobseeker', 'employer'];
  const state = allowed.includes(role) ? role : 'jobseeker';
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
};

// GET /api/oauth/google/callback
exports.googleCallback = [
  passport.authenticate('google', { session: false, failureRedirect: '/api/oauth/google/failure' }),
  async (req, res) => {
    try {
      // One-time short-lived exchange code to obtain access/refresh tokens server-side
      const code = generateOAuthExchangeToken(req.user._id);

      const redirectUrl = new URL(
        process.env.OAUTH_SUCCESS_REDIRECT || `${process.env.FRONTEND_URL}/oauth/success`
      );
      redirectUrl.searchParams.set('code', code);

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('OAuth callback error:', error);
      return res.redirect(process.env.OAUTH_FAILURE_REDIRECT || `${process.env.FRONTEND_URL}/oauth/failure`);
    }
  },
];

// GET /api/oauth/google/failure
exports.googleFailure = (req, res) => {
  res.status(401).json({ success: false, message: 'Google OAuth failed' });
};

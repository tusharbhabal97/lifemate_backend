const User = require('../models/User');
const JobSeeker = require('../models/JobSeeker');
const { generateTokens, verifyRefreshToken, verifyOAuthExchangeToken } = require('../utils/jwt');
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
} = require('../utils/response');
const { getRefreshCookieOptions, getRefreshCookieClearOptions } = require('../utils/cookies');
const emailService = require('../services/emailService');

const buildUserResponse = (user) => ({
  id: user._id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  phone: user.phone,
  profileImage: user.profileImage,
  isEmailVerified: user.isEmailVerified,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', getRefreshCookieClearOptions());
};

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'User already exists with this email address.');
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
    });

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    if (role === 'jobseeker') {
      await JobSeeker.create({ user: user._id });
    }

    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.firstName);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    const tokens = generateTokens(user._id, user.role);
    await user.addRefreshToken(tokens.refreshToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return successResponse(
      res,
      201,
      'User registered successfully. Please check your email for verification.',
      {
        user: buildUserResponse(user),
        accessToken: tokens.accessToken,
      }
    );
  } catch (error) {
    console.error('Registration error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return validationErrorResponse(res, errors);
    }

    return errorResponse(res, 500, 'Registration failed. Please try again.');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return unauthorizedResponse(res, 'Invalid email or password.');
    }

    if (user.isLocked) {
      return unauthorizedResponse(
        res,
        'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
      );
    }

    if (user.isBlocked) {
      return unauthorizedResponse(res, 'Account is blocked. Please contact support.');
    }

    if (!user.isActive) {
      return unauthorizedResponse(res, 'Account is deactivated. Please contact support.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return unauthorizedResponse(res, 'Invalid email or password.');
    }

    await user.resetLoginAttempts();

    const tokens = generateTokens(user._id, user.role);
    await user.addRefreshToken(tokens.refreshToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return successResponse(res, 200, 'Login successful', {
      user: buildUserResponse(user),
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 500, 'Login failed. Please try again.');
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      await req.user.removeRefreshToken(token);
    }

    clearRefreshTokenCookie(res);
    return successResponse(res, 200, 'Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 500, 'Logout failed. Please try again.');
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return unauthorizedResponse(res, 'Refresh token not provided.');
    }

    const decoded = verifyRefreshToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return unauthorizedResponse(res, 'Invalid refresh token.');
    }

    const tokenExists = user.refreshTokens.some((t) => t.token === token);
    if (!tokenExists) {
      return unauthorizedResponse(res, 'Invalid refresh token.');
    }

    if (!user.isActive || user.isBlocked || user.isLocked) {
      return unauthorizedResponse(res, 'Account is not active.');
    }

    const tokens = generateTokens(user._id, user.role);

    await user.removeRefreshToken(token);
    await user.addRefreshToken(tokens.refreshToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);

    if (error.name === 'TokenExpiredError') {
      clearRefreshTokenCookie(res);
      return unauthorizedResponse(res, 'Refresh token has expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      return unauthorizedResponse(res, 'Invalid refresh token.');
    }

    return errorResponse(res, 500, 'Token refresh failed. Please try again.');
  }
};

const oauthExchange = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return unauthorizedResponse(res, 'OAuth exchange code is required.');
    }

    const decoded = verifyOAuthExchangeToken(code);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive || user.isBlocked || user.isLocked) {
      return unauthorizedResponse(res, 'OAuth exchange failed.');
    }

    const tokens = generateTokens(user._id, user.role);
    await user.addRefreshToken(tokens.refreshToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return successResponse(res, 200, 'OAuth exchange successful', {
      user: buildUserResponse(user),
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error('OAuth exchange error:', error);
    return unauthorizedResponse(res, 'OAuth exchange failed. Please login again.');
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired verification token.');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return successResponse(res, 200, 'Email verified successfully');
  } catch (error) {
    console.error('Email verification error:', error);
    return errorResponse(res, 500, 'Email verification failed. Please try again.');
  }
};

const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 404, 'User not found.');
    }

    if (user.isEmailVerified) {
      return errorResponse(res, 400, 'Email is already verified.');
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.firstName);
      return successResponse(res, 200, 'Verification email sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return errorResponse(res, 500, 'Failed to send verification email. Please try again.');
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    return errorResponse(res, 500, 'Failed to resend verification email. Please try again.');
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return successResponse(res, 200, 'If the email exists, a password reset link has been sent.');
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
      return successResponse(res, 200, 'If the email exists, a password reset link has been sent.');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return errorResponse(res, 500, 'Failed to send password reset email. Please try again.');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 500, 'Password reset request failed. Please try again.');
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired password reset token.');
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await user.clearAllRefreshTokens();

    return successResponse(res, 200, 'Password reset successfully');
  } catch (error) {
    console.error('Password reset error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return validationErrorResponse(res, errors);
    }

    return errorResponse(res, 500, 'Password reset failed. Please try again.');
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshTokens');

    if (!user) {
      return errorResponse(res, 404, 'User not found.');
    }

    return successResponse(res, 200, 'Profile retrieved successfully', { user });
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, 500, 'Failed to retrieve profile. Please try again.');
  }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, profileImage } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found.');
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    return successResponse(res, 200, 'Profile updated successfully', {
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return validationErrorResponse(res, errors);
    }

    return errorResponse(res, 500, 'Profile update failed. Please try again.');
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return errorResponse(res, 404, 'User not found.');
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, 400, 'Current password is incorrect.');
    }

    user.password = newPassword;
    await user.save();

    await user.clearAllRefreshTokens();
    clearRefreshTokenCookie(res);

    return successResponse(res, 200, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return validationErrorResponse(res, errors);
    }

    return errorResponse(res, 500, 'Password change failed. Please try again.');
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  oauthExchange,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
};

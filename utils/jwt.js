const jwt = require('jsonwebtoken');

/**
 * JWT utility functions for token generation and verification
 */

const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

const generateTokens = (userId, role) => {
  return {
    accessToken: generateAccessToken(userId, role),
    refreshToken: generateRefreshToken(userId),
  };
};

const generateOAuthExchangeToken = (userId) => {
  return jwt.sign(
    { userId, type: 'oauth_exchange' },
    process.env.JWT_SECRET,
    { expiresIn: '60s' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const verifyOAuthExchangeToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.type !== 'oauth_exchange') {
    throw new Error('Invalid oauth exchange token type');
  }
  return decoded;
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  generateOAuthExchangeToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyOAuthExchangeToken,
  decodeToken,
};

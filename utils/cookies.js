const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === 'production';

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: ONE_MONTH_MS,
});

const getRefreshCookieClearOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
});

module.exports = {
  getRefreshCookieOptions,
  getRefreshCookieClearOptions,
};

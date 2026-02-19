const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const { getAllPlans, getPlansByAudience } = require('../services/pricingConfigService');

const setNoStoreCacheHeaders = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

const inferAudienceFromUser = (user) => {
  if (!user) return null;
  if (user.role === 'employer') return 'employer';
  if (user.role === 'jobseeker') return 'jobseeker';
  return null;
};

// GET /api/pricing/plans
exports.listPlans = async (req, res) => {
  try {
    setNoStoreCacheHeaders(res);

    const requestedAudience = req.query.audience;
    if (
      requestedAudience !== undefined &&
      requestedAudience !== 'employer' &&
      requestedAudience !== 'jobseeker'
    ) {
      return validationErrorResponse(res, [
        { field: 'audience', message: 'Audience must be employer or jobseeker' },
      ]);
    }

    const userAudience = inferAudienceFromUser(req.user);
    const audience = userAudience || requestedAudience || null;
    const includeInactive = req.user?.role === 'admin';

    const plans = audience
      ? await getPlansByAudience(audience, { includeInactive })
      : await getAllPlans({ includeInactive });

    const activePlans = plans.filter((plan) => plan.isActive);
    const finalPlans = includeInactive ? plans : activePlans;

    return successResponse(res, 200, 'Pricing plans fetched', {
      audience: audience || 'all',
      plans: finalPlans,
      employerPlans: finalPlans.filter((plan) => plan.audience === 'employer'),
      jobSeekerPlans: finalPlans.filter((plan) => plan.audience === 'jobseeker'),
    });
  } catch (err) {
    console.error('List pricing plans error:', err);
    return errorResponse(res, 500, 'Failed to fetch pricing plans');
  }
};

const AdminPricingConfig = require('../models/AdminPricingConfig');

const EMPLOYER_PLAN_IDS = ['Free', 'Basic', 'Premium', 'Enterprise'];
const JOBSEEKER_PLAN_IDS = ['JS Starter', 'JS Growth', 'JS Pro'];
const ALLOWED_AUDIENCES = ['employer', 'jobseeker'];

const DEFAULT_PRICING_PLANS = [
  {
    id: 'Free',
    audience: 'employer',
    displayName: 'Free',
    price: 0,
    description: 'Starter plan for low-volume hiring.',
    tag: 'For new employers',
    ctaLabel: 'Choose Free',
    highlighted: false,
    featureList: ['1 active job post', 'Up to 10 applications', 'Basic profile visibility'],
    subscriptionFeatures: {
      maxJobPosts: 1,
      maxApplications: 10,
      advancedSearch: false,
      prioritySupport: false,
      customBranding: false,
    },
    isActive: true,
  },
  {
    id: 'Basic',
    audience: 'employer',
    displayName: 'Basic',
    price: 300,
    description: 'Built for clinics with ongoing hiring.',
    tag: 'Most chosen',
    ctaLabel: 'Choose Basic',
    highlighted: true,
    featureList: ['5 active job posts', 'Up to 100 applications', 'Advanced search'],
    subscriptionFeatures: {
      maxJobPosts: 5,
      maxApplications: 100,
      advancedSearch: true,
      prioritySupport: false,
      customBranding: false,
    },
    isActive: true,
  },
  {
    id: 'Premium',
    audience: 'employer',
    displayName: 'Premium',
    price: 900,
    description: 'For hospitals hiring continuously.',
    tag: 'Scale hiring',
    ctaLabel: 'Choose Premium',
    highlighted: false,
    featureList: ['25 active job posts', 'Up to 500 applications', 'Priority support + branding'],
    subscriptionFeatures: {
      maxJobPosts: 25,
      maxApplications: 500,
      advancedSearch: true,
      prioritySupport: true,
      customBranding: true,
    },
    isActive: true,
  },
  {
    id: 'Enterprise',
    audience: 'employer',
    displayName: 'Enterprise',
    price: 1800,
    description: 'Enterprise healthcare recruitment operations.',
    tag: 'High volume',
    ctaLabel: 'Contact Sales',
    highlighted: false,
    featureList: ['Unlimited scale setup', '5000 applications capacity', 'Dedicated account support'],
    subscriptionFeatures: {
      maxJobPosts: 9999,
      maxApplications: 5000,
      advancedSearch: true,
      prioritySupport: true,
      customBranding: true,
    },
    isActive: true,
  },
  {
    id: 'JS Starter',
    audience: 'jobseeker',
    displayName: 'Starter',
    price: 0,
    description: 'Basic tools for applying and profile building.',
    tag: 'Free forever',
    ctaLabel: 'Start Free',
    highlighted: false,
    featureList: ['Standard profile', 'Basic applications', 'Community support'],
    subscriptionFeatures: null,
    isActive: true,
  },
  {
    id: 'JS Growth',
    audience: 'jobseeker',
    displayName: 'Growth',
    price: 199,
    description: 'Improve interview chances and visibility.',
    tag: 'Popular',
    ctaLabel: 'Choose Growth',
    highlighted: true,
    featureList: ['Priority profile visibility', 'Application insights', 'Resume improvement hints'],
    subscriptionFeatures: null,
    isActive: true,
  },
  {
    id: 'JS Pro',
    audience: 'jobseeker',
    displayName: 'Pro',
    price: 399,
    description: 'Advanced career acceleration features.',
    tag: 'Maximum support',
    ctaLabel: 'Choose Pro',
    highlighted: false,
    featureList: ['Top visibility boost', 'Mock interview support', 'Priority career assistance'],
    subscriptionFeatures: null,
    isActive: true,
  },
];

const defaultEmployerFeatureMap = DEFAULT_PRICING_PLANS.filter(
  (plan) => plan.audience === 'employer'
).reduce((acc, plan) => {
  acc[plan.id] = plan.subscriptionFeatures;
  return acc;
}, {});

const toPlainObject = (value) => {
  if (!value) return null;
  if (typeof value.toObject === 'function') return value.toObject();
  if (value._doc && typeof value._doc === 'object') return { ...value._doc };
  return value;
};

const normalizePlan = (raw, fallback = {}) => {
  const base = { ...fallback, ...(raw || {}) };
  const resolvedAudience =
    base.audience ||
    (EMPLOYER_PLAN_IDS.includes(base.id) ? 'employer' : null) ||
    (JOBSEEKER_PLAN_IDS.includes(base.id) ? 'jobseeker' : null) ||
    fallback.audience;

  return {
    id: base.id,
    audience: resolvedAudience,
    displayName: base.displayName || base.id,
    price: Number.isFinite(base.price) ? Number(base.price) : 0,
    description: base.description || '',
    tag: base.tag || '',
    ctaLabel: base.ctaLabel || 'Choose Plan',
    highlighted: Boolean(base.highlighted),
    featureList: Array.isArray(base.featureList)
      ? base.featureList.filter(Boolean).map(String)
      : [],
    subscriptionFeatures:
      resolvedAudience === 'employer'
        ? {
            maxJobPosts: Number.isFinite(base?.subscriptionFeatures?.maxJobPosts)
              ? Number(base.subscriptionFeatures.maxJobPosts)
              : fallback?.subscriptionFeatures?.maxJobPosts || 1,
            maxApplications: Number.isFinite(base?.subscriptionFeatures?.maxApplications)
              ? Number(base.subscriptionFeatures.maxApplications)
              : fallback?.subscriptionFeatures?.maxApplications || 10,
            advancedSearch:
              base?.subscriptionFeatures?.advancedSearch ??
              fallback?.subscriptionFeatures?.advancedSearch ??
              false,
            prioritySupport:
              base?.subscriptionFeatures?.prioritySupport ??
              fallback?.subscriptionFeatures?.prioritySupport ??
              false,
            customBranding:
              base?.subscriptionFeatures?.customBranding ??
              fallback?.subscriptionFeatures?.customBranding ??
              false,
          }
        : null,
    isActive: base.isActive !== false,
  };
};

const stableStringifyPlans = (plans) =>
  JSON.stringify(
    (plans || []).map((plan) => ({
      id: plan.id,
      audience: plan.audience,
      displayName: plan.displayName,
      price: plan.price,
      description: plan.description,
      tag: plan.tag,
      ctaLabel: plan.ctaLabel,
      highlighted: Boolean(plan.highlighted),
      featureList: Array.isArray(plan.featureList) ? plan.featureList : [],
      subscriptionFeatures: plan.subscriptionFeatures || null,
      isActive: plan.isActive !== false,
    }))
  );

const migratePlans = (plansInput) => {
  const current = Array.isArray(plansInput) ? plansInput : [];
  const migrated = [];

  current.forEach((plan) => {
    const plain = toPlainObject(plan);
    if (!plain) return;

    if (plain.audience) {
      migrated.push(normalizePlan(plain));
      return;
    }

    if (EMPLOYER_PLAN_IDS.includes(plain.id)) {
      migrated.push(
        normalizePlan(
          {
            ...plain,
            audience: 'employer',
            featureList: plain.featureList || [],
            subscriptionFeatures:
              plain.subscriptionFeatures || plain.features || defaultEmployerFeatureMap[plain.id],
          },
          DEFAULT_PRICING_PLANS.find(
            (item) => item.id === plain.id && item.audience === 'employer'
          )
        )
      );
    }
  });

  const existingKeys = new Set(migrated.map((plan) => `${plan.audience}:${plan.id}`));
  DEFAULT_PRICING_PLANS.forEach((plan) => {
    const key = `${plan.audience}:${plan.id}`;
    if (!existingKeys.has(key)) {
      migrated.push(normalizePlan(plan, plan));
    }
  });

  return migrated.map((plan) =>
    normalizePlan(
      plan,
      DEFAULT_PRICING_PLANS.find((item) => item.audience === plan.audience && item.id === plan.id)
    )
  );
};

const ensurePricingConfig = async () => {
  await AdminPricingConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default', plans: DEFAULT_PRICING_PLANS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const current = await AdminPricingConfig.findOne({ key: 'default' }).lean();
  const migratedPlans = migratePlans(current?.plans || []);

  if (stableStringifyPlans(current?.plans || []) !== stableStringifyPlans(migratedPlans)) {
    await AdminPricingConfig.findOneAndUpdate(
      { key: 'default' },
      { $set: { plans: migratedPlans } },
      { new: true }
    );
  }

  return AdminPricingConfig.findOne({ key: 'default' }).lean();
};

const getAllPlans = async ({ includeInactive = true } = {}) => {
  const config = await ensurePricingConfig();
  let plans = (config.plans || [])
    .map((plan) => normalizePlan(toPlainObject(plan)))
    .filter((plan) => Boolean(plan.id && plan.audience));
  if (plans.length === 0) {
    await AdminPricingConfig.findOneAndUpdate(
      { key: 'default' },
      { $set: { plans: DEFAULT_PRICING_PLANS } },
      { new: true }
    );
    const refreshed = await AdminPricingConfig.findOne({ key: 'default' }).lean();
    plans = (refreshed?.plans || []).map((plan) => normalizePlan(plan));
  }
  if (!includeInactive) {
    plans = plans.filter((plan) => plan.isActive);
  }
  return plans;
};

const getPlansByAudience = async (audience, options = {}) => {
  const plans = await getAllPlans(options);
  return plans.filter((plan) => plan.audience === audience);
};

const getEmployerPlanMap = async () => {
  const plans = await getPlansByAudience('employer', { includeInactive: true });
  return plans.reduce((acc, plan) => {
    acc[plan.id] = plan;
    return acc;
  }, {});
};

module.exports = {
  EMPLOYER_PLAN_IDS,
  JOBSEEKER_PLAN_IDS,
  ALLOWED_AUDIENCES,
  DEFAULT_PRICING_PLANS,
  defaultEmployerFeatureMap,
  normalizePlan,
  ensurePricingConfig,
  getAllPlans,
  getPlansByAudience,
  getEmployerPlanMap,
};

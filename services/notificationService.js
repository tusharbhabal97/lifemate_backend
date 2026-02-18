const Notification = require('../models/Notification');
const JobSeeker = require('../models/JobSeeker');
const SavedJob = require('../models/SavedJob');

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const isSameText = (a, b) => normalizeString(a) && normalizeString(a) === normalizeString(b);

const toYMD = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function createNotification(payload) {
  const document = {
    user: payload.user,
    role: payload.role,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    ctaPath: payload.ctaPath,
    ctaLabel: payload.ctaLabel,
    metadata: payload.metadata || {},
    dedupeKey: payload.dedupeKey,
  };

  if (payload.dedupeKey) {
    const notification = await Notification.findOneAndUpdate(
      { user: payload.user, dedupeKey: payload.dedupeKey },
      { $setOnInsert: document },
      { new: true, upsert: true }
    );
    return notification;
  }

  return Notification.create(document);
}

async function createNotificationsBulk(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return [];

  const jobs = documents.map((doc) => createNotification(doc).catch(() => null));
  const results = await Promise.all(jobs);
  return results.filter(Boolean);
}

async function notifyMatchingJobSeekersForJob(job) {
  if (!job || !job._id || job.status !== 'Active') return { created: 0 };

  const specialization = normalizeString(job.specialization);
  const city = normalizeString(job.location?.city);
  const state = normalizeString(job.location?.state);
  const jobType = normalizeString(job.jobType);

  const seekers = await JobSeeker.find(
    {
      $or: [
        { specializations: { $exists: true, $ne: [] } },
        { 'professionalInfo.doctorSpecialization': { $exists: true, $ne: '' } },
        { 'professionalInfo.specifications': { $exists: true, $ne: [] } },
        { 'jobPreferences.preferredLocations': { $exists: true, $ne: [] } },
        { 'professionalInfo.location.city': { $exists: true, $ne: '' } },
        { 'professionalInfo.location.state': { $exists: true, $ne: '' } },
        { 'jobPreferences.preferredJobTypes': { $exists: true, $ne: [] } },
      ],
    },
    {
      user: 1,
      specializations: 1,
      professionalInfo: 1,
      jobPreferences: 1,
    }
  ).lean();

  if (!seekers.length) return { created: 0 };

  const matchedDocs = [];

  for (const seeker of seekers) {
    const specializationPool = [
      ...(Array.isArray(seeker.specializations) ? seeker.specializations : []),
      ...(Array.isArray(seeker.professionalInfo?.specifications)
        ? seeker.professionalInfo.specifications
        : []),
      seeker.professionalInfo?.doctorSpecialization,
    ].filter(Boolean);

    const specializationMatch = specializationPool.some((item) => isSameText(item, specialization));

    const preferredLocations = Array.isArray(seeker.jobPreferences?.preferredLocations)
      ? seeker.jobPreferences.preferredLocations
      : [];

    const locationMatch = preferredLocations.some(
      (loc) => isSameText(loc.city, city) || isSameText(loc.state, state)
    ) ||
      isSameText(seeker.professionalInfo?.location?.city, city) ||
      isSameText(seeker.professionalInfo?.location?.state, state);

    const preferredTypes = Array.isArray(seeker.jobPreferences?.preferredJobTypes)
      ? seeker.jobPreferences.preferredJobTypes
      : [];
    const jobTypeMatch = preferredTypes.some((type) => isSameText(type, jobType));

    if (!(specializationMatch || (locationMatch && jobTypeMatch) || (specializationMatch && locationMatch))) {
      continue;
    }

    matchedDocs.push({
      user: seeker.user,
      role: 'jobseeker',
      type: 'job_recommendation',
      title: `New matching job: ${job.title}`,
      message: `${job.organizationName || 'An employer'} posted a ${job.jobType || 'job'} role in ${job.location?.city || 'your area'}.`,
      ctaPath: `/dashboard/jobseeker/jobs/${job._id}/view`,
      ctaLabel: 'View Job',
      metadata: {
        jobId: String(job._id),
        specialization: job.specialization,
      },
      dedupeKey: `job-reco:${job._id}`,
    });
  }

  const created = await createNotificationsBulk(matchedDocs);
  return { created: created.length };
}

async function notifyApplicationStatusChange({
  userId,
  status,
  oldStatus,
  jobTitle,
  companyName,
  applicationId,
  dedupeKey,
}) {
  if (!userId || !status || !applicationId) return null;

  const fromText = oldStatus ? ` from ${oldStatus}` : '';
  return createNotification({
    user: userId,
    role: 'jobseeker',
    type: 'application_status',
    title: `Application status updated: ${status}`,
    message: `Your application${fromText} to ${status} for ${jobTitle || 'this role'} at ${companyName || 'the employer'}.`,
    ctaPath: '/dashboard/jobseeker/applications',
    ctaLabel: 'View Application',
    metadata: {
      applicationId: String(applicationId),
      status,
      oldStatus,
      jobTitle,
      companyName,
    },
    dedupeKey,
  });
}

async function generateSavedJobExpiryNotificationsForUser(user) {
  if (!user || user.role !== 'jobseeker') return { created: 0 };

  const jobSeeker = await JobSeeker.findOne({ user: user._id }, { _id: 1 }).lean();
  if (!jobSeeker?._id) return { created: 0 };

  const savedJobs = await SavedJob.find({ jobSeeker: jobSeeker._id })
    .populate({
      path: 'job',
      select: '_id title organizationName status expiresAt',
    })
    .sort('-createdAt')
    .limit(250)
    .lean();

  const now = Date.now();
  const today = toYMD(new Date());
  const docs = [];

  for (const saved of savedJobs) {
    const job = saved?.job;
    if (!job?._id) continue;

    const expiry = job.expiresAt ? new Date(job.expiresAt).getTime() : NaN;
    if (!Number.isFinite(expiry)) continue;

    const daysLeft = Math.ceil((expiry - now) / DAY_MS);

    if (daysLeft < 0 || ['Closed', 'Archived'].includes(job.status)) {
      docs.push({
        user: user._id,
        role: 'jobseeker',
        type: 'saved_job_expiry',
        title: `Saved job expired: ${job.title}`,
        message: `${job.organizationName || 'This employer'} listing is no longer active.`,
        ctaPath: '/dashboard/jobseeker/bookmarks',
        ctaLabel: 'Review Saved Jobs',
        metadata: { jobId: String(job._id), savedJobId: String(saved._id), state: 'expired' },
        dedupeKey: `saved-expired:${saved._id}`,
      });
      continue;
    }

    if (daysLeft <= 3) {
      docs.push({
        user: user._id,
        role: 'jobseeker',
        type: 'saved_job_expiry',
        title: `Saved job expiring soon: ${job.title}`,
        message: `${job.organizationName || 'Employer'} role closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        ctaPath: `/dashboard/jobseeker/jobs/${job._id}/view`,
        ctaLabel: 'Apply Now',
        metadata: { jobId: String(job._id), savedJobId: String(saved._id), daysLeft },
        dedupeKey: `saved-expiring:${saved._id}:${today}`,
      });
    }
  }

  const created = await createNotificationsBulk(docs);
  return { created: created.length };
}

module.exports = {
  createNotification,
  createNotificationsBulk,
  notifyMatchingJobSeekersForJob,
  notifyApplicationStatusChange,
  generateSavedJobExpiryNotificationsForUser,
};

import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { sendApplicationEmails } from "../services/email.service.js";
import { updateRecruiterApplication } from "../services/recruiter-review.service.js";
import {
  listPublicJobs,
  getPublicJobFacets,
  findPublicJobById,
  findOwnedJob,
  createJob,
  updateJob,
  deleteJob,
  closeJob,
} from "../repositories/job.repository.js";
import {
  findOwnedApplicationWithResume,
  submitApplication,
} from "../repositories/application.repository.js";
import { getUserSavedJobIds } from "../repositories/savedJob.repository.js";
import { calculateSkillMatch } from "../services/skillMatch.service.js";
import { prisma } from "../config/prisma.js";
import { jobCache, invalidateJobCache } from "../utils/cache.js";

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");

const parseSkills = (value) =>
  Array.isArray(value)
    ? value.map(String).map((s) => s.trim()).filter(Boolean)
    : typeof value === "string"
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

const mapJob = (job) => ({
  ...job,
  companyname: job.companyName,
  jobcategory: job.category,
  jobdesignation: job.designation,
  joblocation: job.location,
  skillrequired: JSON.parse(job.skills || "[]"),
  applyby: job.applyBy,
  jobposted: job.createdAt,
  applicants: job.applications || [],
});

const removeUploadedFile = async (file) => {
  if (file?.filename) {
    await fs.rm(path.join(uploadsDir, file.filename), { force: true });
  }
};

export const renderAllJobs = asyncHandler(async (req, res) => {
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const skill = typeof req.query.skill === "string" ? req.query.skill.trim() : "";
  const salaryBracket = typeof req.query.salary === "string" ? req.query.salary.trim() : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "recent";

  const cacheKey = `public:jobs:q=${search}:loc=${location}:cat=${category}:skill=${skill}:sal=${salaryBracket}:sort=${sort}`;

  let jobs = jobCache.get(cacheKey);
  if (!jobs) {
    jobs = await listPublicJobs({
      search,
      location,
      category,
      skill,
      salaryBracket,
      sort,
    });
    jobCache.set(cacheKey, jobs);
  }

  let facets = jobCache.get("public:job:facets");
  if (!facets) {
    facets = await getPublicJobFacets();
    jobCache.set("public:job:facets", facets);
  }

  const savedJobIds = req.user ? await getUserSavedJobIds(req.user.id) : [];

  // If candidate is logged in, attach personalized real-time match scores
  let candidateUser = null;
  if (req.user && String(req.user.role || "").toUpperCase() === "APPLICANT") {
    candidateUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { skills: true, experienceYears: true, location: true },
    });
  }

  const mappedJobs = jobs.map((job) => {
    const mapped = mapJob(job);
    if (candidateUser && candidateUser.skills) {
      mapped.skillMatch = calculateSkillMatch({
        candidateSkills: candidateUser.skills,
        jobSkills: mapped.skillrequired,
        candidateExp: candidateUser.experienceYears,
        candidateLocation: candidateUser.location,
        jobLocation: mapped.joblocation,
      });
    }
    return mapped;
  });

  res.render("jobs/all-jobs", {
    title: "Browse jobs",
    jobs: mappedJobs,
    query: {
      q: search,
      location,
      category,
      skill,
      salary: salaryBracket,
      sort,
    },
    facets,
    savedJobIds,
    candidateUser,
  });
});

export const renderNewJob = (req, res) => res.render("jobs/new-job", { title: "Post a job" });

const jobData = (body) => ({
  category: body.jobcategory.trim(),
  designation: body.jobdesignation.trim(),
  location: body.joblocation.trim(),
  companyName: body.companyname.trim(),
  salary: body.salary.trim(),
  openings: Number.parseInt(body.openings, 10),
  skills: JSON.stringify(parseSkills(body.skillrequired)),
  applyBy: new Date(body.applyby),
});

export const handleNewJob = asyncHandler(async (req, res) => {
  await createJob(req.user.id, {
    ...jobData(req.body),
    status: "OPEN",
    publishedAt: new Date(),
  });
  invalidateJobCache();
  req.flash("success", "Job posted successfully.");
  res.redirect("/recruiter");
});

export const renderJobDetails = asyncHandler(async (req, res) => {
  const job = await findPublicJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);
  const mapped = mapJob(job);
  const isSaved = req.user
    ? (await getUserSavedJobIds(req.user.id)).includes(job.id)
    : false;

  let skillMatch = null;
  let candidateUser = null;
  if (req.user && String(req.user.role || "").toUpperCase() === "APPLICANT") {
    candidateUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { skills: true, experienceYears: true, location: true, headline: true },
    });
    skillMatch = calculateSkillMatch({
      candidateSkills: candidateUser?.skills || "",
      jobSkills: mapped.skillrequired,
      candidateExp: candidateUser?.experienceYears,
      candidateLocation: candidateUser?.location,
      jobLocation: mapped.joblocation,
    });
  }

  res.render("jobs/job-details", {
    title: mapped.jobdesignation,
    job: mapped,
    alreadyApplied: Boolean(req.user && job.applications.some((a) => a.applicantId === req.user.id)),
    isSaved,
    skillMatch,
    candidateUser,
  });
});

export const renderUpdateJob = (req, res) =>
  res.render("jobs/update-job", { title: "Edit job", job: mapJob(req.job) });

export const handleUpdateJob = asyncHandler(async (req, res) => {
  await updateJob(req.user.id, req.job.id, jobData(req.body));
  invalidateJobCache();
  req.flash("success", "Job updated successfully.");
  res.redirect("/recruiter");
});

export const handleDeleteJob = asyncHandler(async (req, res) => {
  await deleteJob(req.user.id, req.job.id);
  invalidateJobCache();
  req.flash("success", "Job deleted.");
  res.redirect("/recruiter");
});

export const handleCloseJob = asyncHandler(async (req, res) => {
  await closeJob(req.user.id, req.job.id);
  invalidateJobCache();
  req.flash("success", "Job closed. New applications are no longer accepted.");
  res.redirect("/recruiter");
});

export const handleApplyToJob = asyncHandler(async (req, res) => {
  const job = await findPublicJobById(req.params.id);
  if (!job) {
    await removeUploadedFile(req.file);
    throw new AppError("Job not found.", 404);
  }
  if (job.status !== "OPEN" || job.applyBy < new Date()) {
    await removeUploadedFile(req.file);
    req.flash("error", "Applications for this job have closed.");
    return res.redirect(`/jobs/${job.id}`);
  }
  if (String(req.user.role || "").toUpperCase() === "RECRUITER") {
    await removeUploadedFile(req.file);
    req.flash("error", "Recruiters can't apply to job postings.");
    return res.redirect(`/jobs/${job.id}`);
  }
  if (!req.file) {
    req.flash("error", "Please attach your resume (PDF, DOC, or DOCX).");
    return res.redirect(`/jobs/${job.id}`);
  }

  let application;
  try {
    application = await submitApplication({
      job,
      user: req.user,
      contact: req.body.contact,
      resumePath: req.file.filename,
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    if (error.code === "P2002") {
      req.flash("error", "You've already applied to this job.");
    } else if (error.message === "OVERFLOW_OR_CLOSED") {
      req.flash("error", "All openings for this job have been filled or applications are closed.");
    } else if (error instanceof AppError) {
      req.flash("error", error.message);
    } else {
      throw error;
    }
    return res.redirect(`/jobs/${job.id}`);
  }

  await sendApplicationEmails({ applicant: application, job, recruiter: job.recruiter });
  req.flash("success", "Application submitted! Check your email for confirmation.");
  res.redirect(`/jobs/${job.id}`);
});

export const downloadResume = asyncHandler(async (req, res) => {
  const application = await findOwnedApplicationWithResume(req.user.id, req.params.applicationId, req.job.id);
  if (!application) throw new AppError("Application not found.", 404);
  const filename = path.basename(application.resumePath);
  return res.download(path.join(uploadsDir, filename), filename);
});

export const renderApplicants = asyncHandler(async (req, res) => {
  const job = await findOwnedJob(req.user.id, req.job.id, {
    include: { applications: { orderBy: { createdAt: "desc" } } },
  });
  if (!job) throw new AppError("Job not found.", 404);
  res.render("jobs/applicants", {
    title: `Applicants — ${job.designation}`,
    job: mapJob(job),
    applicants: job.applications.map((a) => ({ ...a, applicantid: a.id, appliedAt: a.createdAt })),
  });
});

export const updateApplicationStatus = asyncHandler(async (req, res) => {
  await updateRecruiterApplication({
    applicationId: req.params.applicationId,
    recruiterId: req.user.id,
    status: String(req.body.status || "").toUpperCase(),
    recruiterNote: String(req.body.recruiterNote || "").trim(),
  });
  req.flash("success", "Application review updated.");
  return res.redirect(`/jobs/${req.job.id}/applicants`);
});

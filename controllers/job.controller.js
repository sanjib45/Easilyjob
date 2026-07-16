import {
  addJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  addApplicant,
  getApplicants,
  hasUserApplied,
} from "../models/job.model.js";
import { sendConfirmationEmail } from "../middleware/sendEmail.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const parseSkills = (skillrequired) => {
  if (Array.isArray(skillrequired)) return skillrequired.map((s) => s.trim()).filter(Boolean);
  if (typeof skillrequired === "string") {
    return skillrequired
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const isOwner = (job, user) => Boolean(user) && job.recruiterId === user.id;

export const renderAllJobs = (req, res) => {
  const { q = "", location = "" } = req.query;
  const search = q.trim().toLowerCase();
  const locationFilter = location.trim().toLowerCase();

  const jobs = getAllJobs().filter((job) => {
    const matchesSearch =
      !search ||
      job.jobdesignation.toLowerCase().includes(search) ||
      job.companyname.toLowerCase().includes(search) ||
      job.jobcategory.toLowerCase().includes(search) ||
      job.skillrequired.some((skill) => skill.toLowerCase().includes(search));
    const matchesLocation =
      !locationFilter || job.joblocation.toLowerCase().includes(locationFilter);
    return matchesSearch && matchesLocation;
  });

  res.render("jobs/all-jobs", {
    title: "Browse jobs",
    jobs: jobs.sort((a, b) => new Date(b.jobposted) - new Date(a.jobposted)),
    query: { q, location },
  });
};

export const renderNewJob = (req, res) => {
  res.render("jobs/new-job", { title: "Post a job" });
};

export const handleNewJob = asyncHandler(async (req, res) => {
  const openings = parseInt(req.body.openings, 10);

  const job = {
    id: Date.now().toString(),
    jobcategory: req.body.jobcategory.trim(),
    jobdesignation: req.body.jobdesignation.trim(),
    joblocation: req.body.joblocation.trim(),
    companyname: req.body.companyname.trim(),
    salary: req.body.salary.trim(),
    openings: Number.isNaN(openings) ? 0 : openings,
    skillrequired: parseSkills(req.body.skillrequired),
    applyby: req.body.applyby,
    recruiterId: req.session.user.id,
    applicants: [],
    jobposted: new Date().toISOString(),
  };

  await addJob(job);
  req.flash("success", "Job posted successfully.");
  res.redirect("/recruiter");
});

export const renderJobDetails = (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);

  const alreadyApplied = Boolean(
    req.session.user && hasUserApplied(job.id, req.session.user.email)
  );

  res.render("jobs/job-details", {
    title: job.jobdesignation,
    job,
    alreadyApplied,
  });
};

export const renderUpdateJob = (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);
  if (!isOwner(job, req.session.user)) {
    return res.status(403).render("unauthorized", { title: "Access denied" });
  }
  res.render("jobs/update-job", { title: "Edit job", job });
};

export const handleUpdateJob = asyncHandler(async (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);
  if (!isOwner(job, req.session.user)) {
    return res.status(403).render("unauthorized", { title: "Access denied" });
  }

  const openings = parseInt(req.body.openings, 10);

  await updateJob(req.params.id, {
    jobcategory: req.body.jobcategory.trim(),
    jobdesignation: req.body.jobdesignation.trim(),
    joblocation: req.body.joblocation.trim(),
    companyname: req.body.companyname.trim(),
    salary: req.body.salary.trim(),
    openings: Number.isNaN(openings) ? 0 : openings,
    skillrequired: parseSkills(req.body.skillrequired),
    applyby: req.body.applyby,
  });

  req.flash("success", "Job updated successfully.");
  res.redirect("/recruiter");
});

export const handleDeleteJob = asyncHandler(async (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);
  if (!isOwner(job, req.session.user)) {
    return res.status(403).render("unauthorized", { title: "Access denied" });
  }

  await deleteJob(req.params.id);
  req.flash("success", "Job deleted.");
  res.redirect("/recruiter");
});

export const handleApplyToJob = asyncHandler(async (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);

  if (new Date(job.applyby) < new Date()) {
    req.flash("error", "Applications for this job have closed.");
    return res.redirect(`/jobs/${job.id}`);
  }

  const { name, email, contact } = req.body;

  if (hasUserApplied(job.id, email)) {
    req.flash("error", "You've already applied to this job with that email.");
    return res.redirect(`/jobs/${job.id}`);
  }

  if (!req.file) {
    req.flash("error", "Please attach your resume (PDF, DOC, or DOCX).");
    return res.redirect(`/jobs/${job.id}`);
  }

  const applicant = {
    applicantid: Date.now().toString(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    contact: contact.trim(),
    resumePath: `/uploads/${req.file.filename}`,
    appliedAt: new Date().toISOString(),
  };

  await addApplicant(job.id, applicant);
  await sendConfirmationEmail(applicant.email, job.jobdesignation);

  req.flash("success", "Application submitted! Check your email for confirmation.");
  res.redirect(`/jobs/${job.id}`);
});

export const renderApplicants = (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) throw new AppError("Job not found.", 404);
  if (!isOwner(job, req.session.user)) {
    return res.status(403).render("unauthorized", { title: "Access denied" });
  }

  res.render("jobs/applicants", {
    title: `Applicants — ${job.jobdesignation}`,
    job,
    applicants: getApplicants(job.id),
  });
};

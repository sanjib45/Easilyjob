import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { sendApplicationEmails } from "../services/email.service.js";

const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
const parseSkills = (value) => Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : typeof value === "string" ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
const mapJob = (job) => ({ ...job, companyname: job.companyName, jobcategory: job.category, jobdesignation: job.designation, joblocation: job.location, skillrequired: JSON.parse(job.skills || "[]"), applyby: job.applyBy, jobposted: job.createdAt, applicants: job.applications || [] });
const removeUploadedFile = async (file) => { if (file?.filename) await fs.rm(path.join(uploadsDir, file.filename), { force: true }); };

export const renderAllJobs = asyncHandler(async (req, res) => {
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
  const jobs = await prisma.job.findMany({ where: { status: "OPEN", applyBy: { gte: new Date() }, AND: [search ? { OR: [{ designation: { contains: search } }, { companyName: { contains: search } }, { category: { contains: search } }, { skills: { contains: search } }] } : {}, location ? { location: { contains: location } } : {}] }, include: { applications: true }, orderBy: { createdAt: "desc" } });
  res.render("jobs/all-jobs", { title: "Browse jobs", jobs: jobs.map(mapJob), query: { q: search, location } });
});

export const renderNewJob = (req, res) => res.render("jobs/new-job", { title: "Post a job" });

const jobData = (body) => ({ category: body.jobcategory.trim(), designation: body.jobdesignation.trim(), location: body.joblocation.trim(), companyName: body.companyname.trim(), salary: body.salary.trim(), openings: Number.parseInt(body.openings, 10), skills: JSON.stringify(parseSkills(body.skillrequired)), applyBy: new Date(body.applyby) });

export const handleNewJob = asyncHandler(async (req, res) => { await prisma.job.create({ data: { ...jobData(req.body), status: "OPEN", publishedAt: new Date(), recruiterId: req.user.id } }); req.flash("success", "Job posted successfully."); res.redirect("/recruiter"); });

export const renderJobDetails = asyncHandler(async (req, res) => { const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { applications: true, recruiter: true } }); if (!job) throw new AppError("Job not found.", 404); const mapped = mapJob(job); res.render("jobs/job-details", { title: mapped.jobdesignation, job: mapped, alreadyApplied: Boolean(req.user && job.applications.some((a) => a.applicantId === req.user.id)) }); });
export const renderUpdateJob = (req, res) => res.render("jobs/update-job", { title: "Edit job", job: mapJob(req.job) });
export const handleUpdateJob = asyncHandler(async (req, res) => { await prisma.job.update({ where: { id: req.job.id }, data: jobData(req.body) }); req.flash("success", "Job updated successfully."); res.redirect("/recruiter"); });
export const handleDeleteJob = asyncHandler(async (req, res) => { await prisma.job.delete({ where: { id: req.job.id } }); req.flash("success", "Job deleted."); res.redirect("/recruiter"); });
export const handleCloseJob = asyncHandler(async (req, res) => { await prisma.job.update({ where: { id: req.job.id }, data: { status: "CLOSED", closedAt: new Date() } }); req.flash("success", "Job closed. New applications are no longer accepted."); res.redirect("/recruiter"); });

export const handleApplyToJob = asyncHandler(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { recruiter: true } });
  if (!job) { await removeUploadedFile(req.file); throw new AppError("Job not found.", 404); }
  if (job.status !== "OPEN" || job.applyBy < new Date()) { await removeUploadedFile(req.file); req.flash("error", "Applications for this job have closed."); return res.redirect(`/jobs/${job.id}`); }
  if (req.user.role === "RECRUITER") { await removeUploadedFile(req.file); req.flash("error", "Recruiters can't apply to job postings."); return res.redirect(`/jobs/${job.id}`); }
  if (!req.file) { req.flash("error", "Please attach your resume (PDF, DOC, or DOCX)."); return res.redirect(`/jobs/${job.id}`); }
  let application;
  try {
    application = await prisma.$transaction(async (tx) => {
      const reserved = await tx.job.updateMany({ where: { id: job.id, status: "OPEN", applyBy: { gte: new Date() }, applicationsAccepted: { lt: job.openings } }, data: { applicationsAccepted: { increment: 1 } } });
      if (reserved.count !== 1) throw new AppError("All openings for this job have been filled or applications are closed.", 409);
      return tx.application.create({ data: { jobId: job.id, applicantId: req.user.id, name: req.user.name, email: req.user.email, contact: req.body.contact.trim(), resumePath: req.file.filename } });
    });
  } catch (error) { await removeUploadedFile(req.file); if (error.code === "P2002") req.flash("error", "You've already applied to this job."); else if (error instanceof AppError) req.flash("error", error.message); else throw error; return res.redirect(`/jobs/${job.id}`); }
  await sendApplicationEmails({ applicant: application, job, recruiter: job.recruiter });
  req.flash("success", "Application submitted! Check your email for confirmation."); res.redirect(`/jobs/${job.id}`);
});

export const downloadResume = asyncHandler(async (req, res) => { const application = await prisma.application.findFirst({ where: { id: req.params.applicationId, jobId: req.job.id } }); if (!application) throw new AppError("Application not found.", 404); const filename = path.basename(application.resumePath); return res.download(path.join(uploadsDir, filename), filename); });
export const renderApplicants = asyncHandler(async (req, res) => { const job = await prisma.job.findUnique({ where: { id: req.job.id }, include: { applications: { orderBy: { createdAt: "desc" } } } }); res.render("jobs/applicants", { title: `Applicants — ${job.designation}`, job: mapJob(job), applicants: job.applications.map((a) => ({ ...a, applicantid: a.id, appliedAt: a.createdAt })) }); });

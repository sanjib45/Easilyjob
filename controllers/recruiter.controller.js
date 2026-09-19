import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRecruiterApplication, listRecruiterApplications, updateRecruiterApplication } from "../services/recruiter-review.service.js";
import { createRecruiterInterview, listRecruiterInterviews, saveRecruiterEvaluation, updateRecruiterInterview } from "../services/interview.service.js";

export const renderRecruiterDashboard = asyncHandler(async (req, res) => {
  const [jobs, upcomingInterviews] = await Promise.all([
    prisma.job.findMany({ where: { recruiterId: req.user.id }, include: { applications: true }, orderBy: { createdAt: "desc" } }),
    prisma.interview.count({ where: { recruiterId: req.user.id, scheduledAt: { gte: new Date() }, status: { in: ["SCHEDULED", "RESCHEDULED"] } } }),
  ]);
  const mapped = jobs.map((job) => ({ ...job, companyname: job.companyName, jobdesignation: job.designation, joblocation: job.location, skillrequired: JSON.parse(job.skills || "[]"), applyby: job.applyBy, applicants: job.applications }));
  res.render("recruiter/recruiter-dashboard", { title: "Recruiter dashboard", jobs: mapped, stats: { totalJobs: mapped.length, openRoles: mapped.filter((job) => job.status === "OPEN" && job.applyBy >= new Date()).length, totalApplicants: mapped.reduce((sum, job) => sum + job.applicants.length, 0), shortlisted: mapped.reduce((sum, job) => sum + job.applicants.filter((application) => application.status === "SHORTLISTED").length, 0), upcomingInterviews } });
});

export const renderRecruiterApplicant = asyncHandler(async (req, res) => {
  const application = await getRecruiterApplication(req.params.applicationId, req.user.id);
  res.render("recruiter/applicant-detail", { title: `Applicant — ${application.name}`, application });
});

export const renderRecruiterApplications = asyncHandler(async (req, res) => {
  const result = await listRecruiterApplications({
    recruiterId: req.user.id,
    search: req.query.q,
    status: String(req.query.status || "").toUpperCase(),
    jobId: req.query.jobId,
    sort: req.query.sort,
    page: req.query.page,
    limit: req.query.limit,
  });
  const jobs = await prisma.job.findMany({
    where: { recruiterId: req.user.id },
    select: { id: true, designation: true },
    orderBy: { createdAt: "desc" },
  });
  res.render("recruiter/applicants", { title: "Applicants", applications: result.applications, jobs, ...result });
});

export const updateRecruiterApplicant = asyncHandler(async (req, res) => {
  await updateRecruiterApplication({
    applicationId: req.params.applicationId,
    recruiterId: req.user.id,
    status: String(req.body.status || "").toUpperCase(),
    recruiterNote: String(req.body.recruiterNote || "").trim(),
  });
  req.flash("success", "Applicant review updated.");
  res.redirect(`/recruiter/applicants/${req.params.applicationId}`);
});

export const renderRecruiterInterviews = asyncHandler(async (req, res) => {
  const interviews = await listRecruiterInterviews(req.user.id);
  res.render("recruiter/interviews", { title: "Interviews", interviews });
});

export const createRecruiterApplicantInterview = asyncHandler(async (req, res) => {
  await createRecruiterInterview({ recruiterId: req.user.id, applicationId: req.params.applicationId, ...req.body });
  req.flash("success", "Interview scheduled.");
  res.redirect(`/recruiter/applicants/${req.params.applicationId}`);
});

export const updateRecruiterInterviewAction = asyncHandler(async (req, res) => {
  const interview = await updateRecruiterInterview({ recruiterId: req.user.id, interviewId: req.params.interviewId, ...req.body });
  req.flash("success", "Interview updated.");
  res.redirect(`/recruiter/applicants/${interview.applicationId}`);
});

export const saveRecruiterInterviewEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await saveRecruiterEvaluation({ recruiterId: req.user.id, interviewId: req.params.interviewId, ...req.body });
  req.flash("success", "Interview evaluation saved.");
  res.redirect(`/recruiter/applicants/${evaluation.applicationId}`);
});

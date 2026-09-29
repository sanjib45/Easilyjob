import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import {
  getRecruiterApplication,
  listRecruiterApplications,
  updateRecruiterApplication,
} from "../services/recruiter-review.service.js";
import {
  createRecruiterInterview,
  listRecruiterInterviews,
  saveRecruiterEvaluation,
  updateRecruiterInterview,
  shareInterviewResult,
} from "../services/interview.service.js";
import { findOwnedInterview } from "../repositories/interview.repository.js";
import { getRecruiterDashboardData } from "../services/dashboard.service.js";
import { listOwnedJobs } from "../repositories/job.repository.js";

export const renderRecruiterDashboard = asyncHandler(async (req, res) => {
  const { jobs, stats } = await getRecruiterDashboardData(req.user.id);
  res.render("recruiter/recruiter-dashboard", {
    title: "Recruiter dashboard",
    jobs,
    stats,
  });
});

export const renderRecruiterApplicant = asyncHandler(async (req, res) => {
  const application = await getRecruiterApplication(req.params.applicationId, req.user.id);
  res.render("recruiter/applicant-detail", {
    title: `Applicant — ${application.name}`,
    application,
  });
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

  const jobs = await listOwnedJobs(req.user.id, {
    select: { id: true, designation: true },
    orderBy: { createdAt: "desc" },
  });

  res.render("recruiter/applicants", {
    title: "Applicants",
    applications: result.applications,
    jobs,
    ...result,
  });
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
  await createRecruiterInterview({
    recruiterId: req.user.id,
    applicationId: req.params.applicationId,
    ...req.body,
  });
  req.flash("success", "Interview scheduled.");
  res.redirect(`/recruiter/applicants/${req.params.applicationId}`);
});

export const updateRecruiterInterviewAction = asyncHandler(async (req, res) => {
  const interview = await updateRecruiterInterview({
    recruiterId: req.user.id,
    interviewId: req.params.interviewId,
    ...req.body,
  });
  req.flash("success", "Interview updated.");
  res.redirect(`/recruiter/applicants/${interview.applicationId}`);
});

export const saveRecruiterInterviewEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await saveRecruiterEvaluation({
    recruiterId: req.user.id,
    interviewId: req.params.interviewId,
    ...req.body,
  });
  req.flash("success", "Interview evaluation saved.");
  res.redirect(`/recruiter/applicants/${evaluation.applicationId}`);
});

export const renderShareInterviewResult = asyncHandler(async (req, res) => {
  const interview = await findOwnedInterview(req.user.id, req.params.interviewId);
  if (!interview) throw new AppError("Interview not found.", 404);
  if (interview.status !== "COMPLETED") {
    throw new AppError("Interview must be completed before sharing results.", 400);
  }

  res.render("recruiter/interviews/share-result", {
    title: `Share Result — ${interview.application.name}`,
    interview,
  });
});

export const handleShareInterviewResult = asyncHandler(async (req, res) => {
  const result = await shareInterviewResult({
    recruiterId: req.user.id,
    interviewId: req.params.interviewId,
    outcome: req.body.outcome,
    summary: req.body.summary,
  });

  req.flash("success", "Interview result shared with candidate.");
  res.redirect(`/recruiter/applicants/${result.applicationId}`);
});

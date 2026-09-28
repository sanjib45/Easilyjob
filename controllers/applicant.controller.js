import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { getApplicantDashboardData, getApplicantApplicationDetails } from "../services/applicant.service.js";
import { saveJob, unsaveJob, listUserSavedJobs } from "../repositories/savedJob.repository.js";
import { prisma } from "../config/prisma.js";

export const renderApplicantDashboard = asyncHandler(async (req, res) => {
  const data = await getApplicantDashboardData(req.user.id);
  res.render("applicant/dashboard", {
    title: "Candidate Dashboard",
    ...data,
  });
});

export const renderApplicantApplications = asyncHandler(async (req, res) => {
  const data = await getApplicantDashboardData(req.user.id);
  res.render("applicant/applications", {
    title: "My Applications",
    applications: data.applications,
  });
});

export const renderApplicantApplicationDetail = asyncHandler(async (req, res) => {
  const application = await getApplicantApplicationDetails(req.params.id, req.user.id);
  if (!application) {
    throw new AppError("Application not found.", 404);
  }
  res.render("applicant/application-detail", {
    title: `Application — ${application.job.designation}`,
    application,
  });
});

export const renderApplicantSavedJobs = asyncHandler(async (req, res) => {
  const savedJobs = await listUserSavedJobs(req.user.id);
  res.render("applicant/saved-jobs", {
    title: "Saved Jobs",
    savedJobs,
  });
});

export const handleSaveJobAction = asyncHandler(async (req, res) => {
  await saveJob(req.user.id, req.params.id);
  req.flash("success", "Job saved to your bookmarks.");
  res.redirect(req.get("referer") || "/applicant/saved");
});

export const handleUnsaveJobAction = asyncHandler(async (req, res) => {
  await unsaveJob(req.user.id, req.params.id);
  req.flash("success", "Job removed from your saved bookmarks.");
  res.redirect(req.get("referer") || "/applicant/saved");
});

export const renderApplicantProfile = asyncHandler(async (req, res) => {
  res.render("applicant/profile", {
    title: "Candidate Profile",
  });
});

export const handleUpdateApplicantProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (name && name.trim()) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
    });
    req.flash("success", "Profile updated successfully.");
  }
  res.redirect("/applicant/profile");
});

import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { getApplicantDashboardData, getApplicantApplicationDetails } from "../services/applicant.service.js";
import { saveJob, unsaveJob, listUserSavedJobs } from "../repositories/savedJob.repository.js";
import { calculateSkillMatch, calculateProfileCompleteness, parseSkillsList } from "../services/skillMatch.service.js";
import { prisma } from "../config/prisma.js";

const POPULAR_SKILLS = [
  "JavaScript", "React", "Node.js", "TypeScript", "Python",
  "MongoDB", "Express", "AWS", "Docker", "SQL",
  "Tailwind CSS", "Git", "Next.js", "GraphQL", "Java",
  "PostgreSQL", "REST API", "HTML5", "CSS3", "Redis"
];

export const renderApplicantDashboard = asyncHandler(async (req, res) => {
  const data = await getApplicantDashboardData(req.user.id);

  // Attach real-time skill matching score to each application
  const candidateSkills = data.candidateUser?.skills || "";
  data.applications = data.applications.map((app) => {
    const matchResult = calculateSkillMatch({
      candidateSkills,
      jobSkills: app.job?.skills || "",
      candidateExp: data.candidateUser?.experienceYears,
      candidateLocation: data.candidateUser?.location,
      jobLocation: app.job?.location,
    });
    return {
      ...app,
      skillMatch: matchResult,
    };
  });

  const completeness = calculateProfileCompleteness(data.candidateUser || {});

  res.render("applicant/dashboard", {
    title: "Candidate Dashboard",
    ...data,
    completeness,
  });
});

export const renderApplicantApplications = asyncHandler(async (req, res) => {
  const data = await getApplicantDashboardData(req.user.id);
  const candidateSkills = data.candidateUser?.skills || "";

  const enrichedApps = data.applications.map((app) => ({
    ...app,
    skillMatch: calculateSkillMatch({
      candidateSkills,
      jobSkills: app.job?.skills || "",
      candidateExp: data.candidateUser?.experienceYears,
      candidateLocation: data.candidateUser?.location,
      jobLocation: app.job?.location,
    }),
  }));

  res.render("applicant/applications", {
    title: "My Applications",
    applications: enrichedApps,
  });
});

export const renderApplicantApplicationDetail = asyncHandler(async (req, res) => {
  const application = await getApplicantApplicationDetails(req.params.id, req.user.id);
  if (!application) {
    throw new AppError("Application not found.", 404);
  }

  const candidateUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { skills: true, experienceYears: true, location: true },
  });

  const skillMatch = calculateSkillMatch({
    candidateSkills: candidateUser?.skills || "",
    jobSkills: application.job?.skills || "",
    candidateExp: candidateUser?.experienceYears,
    candidateLocation: candidateUser?.location,
    jobLocation: application.job?.location,
  });

  res.render("applicant/application-detail", {
    title: `Application — ${application.job.designation}`,
    application,
    skillMatch,
  });
});

export const renderApplicantSavedJobs = asyncHandler(async (req, res) => {
  const [savedJobs, candidateUser] = await Promise.all([
    listUserSavedJobs(req.user.id),
    prisma.user.findUnique({
      where: { id: req.user.id },
      select: { skills: true, experienceYears: true, location: true },
    }),
  ]);

  const enrichedSaved = savedJobs.map((item) => ({
    ...item,
    skillMatch: calculateSkillMatch({
      candidateSkills: candidateUser?.skills || "",
      jobSkills: item.job?.skills || "",
    }),
  }));

  res.render("applicant/saved-jobs", {
    title: "Saved Jobs",
    savedJobs: enrichedSaved,
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
  const candidateUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      headline: true,
      bio: true,
      skills: true,
      experienceYears: true,
      location: true,
      education: true,
      currentCompany: true,
      expectedSalary: true,
      phone: true,
      resumeUrl: true,
      profileCompletedPct: true,
      createdAt: true,
    },
  });

  const completeness = calculateProfileCompleteness(candidateUser || {});
  const userSkills = parseSkillsList(candidateUser?.skills);

  res.render("applicant/profile", {
    title: "Candidate Profile & Skills Hub",
    candidateUser,
    completeness,
    userSkills,
    popularSkills: POPULAR_SKILLS,
  });
});

export const handleUpdateApplicantProfile = asyncHandler(async (req, res) => {
  const {
    name,
    headline,
    bio,
    skills,
    experienceYears,
    location,
    education,
    currentCompany,
    expectedSalary,
    phone,
    resumeUrl,
  } = req.body;

  // Clean and format skills as comma-separated list
  const parsedSkills = parseSkillsList(skills);
  const formattedSkills = parsedSkills.join(", ");

  const parsedExp = (experienceYears !== "" && experienceYears !== undefined && !isNaN(Number(experienceYears)))
    ? parseFloat(Number(experienceYears).toFixed(1))
    : null;

  const profileData = {
    name: name?.trim() || req.user.name,
    headline: headline?.trim() || null,
    bio: bio?.trim() || null,
    skills: formattedSkills || null,
    experienceYears: parsedExp,
    location: location?.trim() || null,
    education: education?.trim() || null,
    currentCompany: currentCompany?.trim() || null,
    expectedSalary: expectedSalary?.trim() || null,
    phone: phone?.trim() || null,
    resumeUrl: resumeUrl?.trim() || null,
  };

  const completeness = calculateProfileCompleteness(profileData);
  profileData.profileCompletedPct = completeness.percentage;

  await prisma.user.update({
    where: { id: req.user.id },
    data: profileData,
  });

  req.flash("success", `Profile updated! Profile strength is now ${completeness.percentage}%.`);
  res.redirect("/applicant/profile");
});

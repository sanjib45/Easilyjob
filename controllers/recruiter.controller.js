import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const renderRecruiterDashboard = asyncHandler(async (req, res) => {
  const jobs = await prisma.job.findMany({ where: { recruiterId: req.user.id }, include: { applications: true }, orderBy: { createdAt: "desc" } });
  const mapped = jobs.map((job) => ({ ...job, companyname: job.companyName, jobdesignation: job.designation, joblocation: job.location, skillrequired: JSON.parse(job.skills || "[]"), applyby: job.applyBy, applicants: job.applications }));
  res.render("recruiter/recruiter-dashboard", { title: "Recruiter dashboard", jobs: mapped, stats: { totalJobs: mapped.length, openRoles: mapped.filter((job) => job.status === "OPEN" && job.applyBy >= new Date()).length, totalApplicants: mapped.reduce((sum, job) => sum + job.applicants.length, 0) } });
});

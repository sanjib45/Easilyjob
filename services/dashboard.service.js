import { listOwnedJobs } from "../repositories/job.repository.js";
import { countUpcomingInterviews } from "../repositories/interview.repository.js";

/**
 * Service to aggregate dashboard metrics and jobs for a recruiter.
 */
export const getRecruiterDashboardData = async (recruiterId) => {
  const [jobs, upcomingInterviews] = await Promise.all([
    listOwnedJobs(recruiterId, {
      include: { applications: true },
      orderBy: { createdAt: "desc" },
    }),
    countUpcomingInterviews(recruiterId),
  ]);

  const mapped = jobs.map((job) => ({
    ...job,
    companyname: job.companyName,
    jobdesignation: job.designation,
    joblocation: job.location,
    skillrequired: JSON.parse(job.skills || "[]"),
    applyby: job.applyBy,
    applicants: job.applications || [],
  }));

  const now = new Date();
  const stats = {
    totalJobs: mapped.length,
    openRoles: mapped.filter((job) => job.status === "OPEN" && job.applyBy >= now).length,
    totalApplicants: mapped.reduce((sum, job) => sum + job.applicants.length, 0),
    shortlisted: mapped.reduce(
      (sum, job) => sum + job.applicants.filter((application) => application.status === "SHORTLISTED").length,
      0
    ),
    upcomingInterviews,
  };

  return { jobs: mapped, stats };
};

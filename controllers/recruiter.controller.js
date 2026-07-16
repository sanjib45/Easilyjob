import { getJobsByRecruiter } from "../models/job.model.js";

export const renderRecruiterDashboard = (req, res) => {
  const jobs = getJobsByRecruiter(req.session.user.id).sort(
    (a, b) => new Date(b.jobposted) - new Date(a.jobposted)
  );

  const totalApplicants = jobs.reduce((sum, job) => sum + job.applicants.length, 0);
  const openRoles = jobs.filter((job) => new Date(job.applyby) >= new Date()).length;

  res.render("recruiter/recruiter-dashboard", {
    title: "Recruiter dashboard",
    jobs,
    stats: {
      totalJobs: jobs.length,
      openRoles,
      totalApplicants,
    },
  });
};

import { getAllJobs } from "../models/job.model.js";

export const renderHome = (req, res) => {
  const jobs = getAllJobs();
  const totalApplicants = jobs.reduce((sum, job) => sum + job.applicants.length, 0);
  const companies = new Set(jobs.map((job) => job.companyname));

  res.render("index", {
    title: "Home",
    stats: {
      jobs: jobs.length,
      companies: companies.size,
      applicants: totalApplicants,
    },
  });
};

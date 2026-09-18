import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const renderHome = asyncHandler(async (req, res) => {
  const [jobs, companies, applicants] = await Promise.all([
    prisma.job.count({ where: { status: "OPEN", applyBy: { gte: new Date() } } }),
    prisma.job.findMany({ where: { status: "OPEN", applyBy: { gte: new Date() } }, select: { companyName: true }, distinct: ["companyName"] }),
    prisma.application.count(),
  ]);
  res.render("index", { title: "Home", stats: { jobs, companies: companies.length, applicants } });
});

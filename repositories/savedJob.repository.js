import { prisma } from "../config/prisma.js";

/**
 * Saved Jobs Repository
 * Manages applicant saved job listings with strict userId isolation.
 */

export const saveJob = async (userId, jobId) => {
  return prisma.savedJob.upsert({
    where: {
      userId_jobId: { userId, jobId },
    },
    create: { userId, jobId },
    update: {},
  });
};

export const unsaveJob = async (userId, jobId) => {
  try {
    return await prisma.savedJob.delete({
      where: {
        userId_jobId: { userId, jobId },
      },
    });
  } catch (err) {
    return null;
  }
};

export const listUserSavedJobs = async (userId) => {
  return prisma.savedJob.findMany({
    where: { userId },
    include: {
      job: {
        select: {
          id: true,
          designation: true,
          companyName: true,
          location: true,
          salary: true,
          category: true,
          skills: true,
          openings: true,
          status: true,
          applyBy: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getUserSavedJobIds = async (userId) => {
  if (!userId) return [];
  const saved = await prisma.savedJob.findMany({
    where: { userId },
    select: { jobId: true },
  });
  return saved.map((s) => s.jobId);
};

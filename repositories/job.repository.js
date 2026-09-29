import { prisma } from "../config/prisma.js";

/**
 * Job repository.
 * Recruiter operations take recruiterId as first argument and enforce tenant ownership.
 */

export const findOwnedJob = async (recruiterId, jobId, options = {}) => {
  const client = options.tx || prisma;
  return client.job.findFirst({
    where: {
      id: jobId,
      recruiterId,
    },
    include: options.include || { applications: true },
  });
};

export const listOwnedJobs = async (recruiterId, options = {}) => {
  const client = options.tx || prisma;
  const args = {
    where: {
      recruiterId,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: options.orderBy || { createdAt: "desc" },
  };

  if (options.select) {
    args.select = options.select;
  } else {
    args.include = options.include || { applications: true };
  }

  return client.job.findMany(args);
};

export const createJob = async (recruiterId, data) => {
  return prisma.job.create({
    data: {
      ...data,
      recruiterId,
    },
  });
};

export const updateJob = async (recruiterId, jobId, data) => {
  const existing = await prisma.job.findFirst({
    where: { id: jobId, recruiterId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.job.update({
    where: { id: jobId },
    data,
  });
};

export const deleteJob = async (recruiterId, jobId) => {
  const existing = await prisma.job.findFirst({
    where: { id: jobId, recruiterId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.job.delete({
    where: { id: jobId },
  });
};

export const closeJob = async (recruiterId, jobId) => {
  const existing = await prisma.job.findFirst({
    where: { id: jobId, recruiterId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });
};

export const listPublicJobs = async ({ search = "", location = "" } = {}) => {
  return prisma.job.findMany({
    where: {
      status: "OPEN",
      applyBy: { gte: new Date() },
      AND: [
        search
          ? {
              OR: [
                { designation: { contains: search } },
                { companyName: { contains: search } },
                { category: { contains: search } },
                { skills: { contains: search } },
              ],
            }
          : {},
        location ? { location: { contains: location } } : {},
      ],
    },
    include: { applications: true },
    orderBy: { createdAt: "desc" },
  });
};

export const findPublicJobById = async (jobId) => {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      applications: true,
      recruiter: true,
    },
  });
};

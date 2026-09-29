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

export const listPublicJobs = async ({
  search = "",
  location = "",
  category = "",
  skill = "",
  salaryBracket = "",
  sort = "recent",
} = {}) => {
  const andConditions = [];

  if (search) {
    andConditions.push({
      OR: [
        { designation: { contains: search } },
        { companyName: { contains: search } },
        { category: { contains: search } },
        { skills: { contains: search } },
      ],
    });
  }

  if (location) {
    andConditions.push({
      location: { contains: location },
    });
  }

  if (category) {
    andConditions.push({
      category: { contains: category },
    });
  }

  if (skill) {
    andConditions.push({
      skills: { contains: skill },
    });
  }

  let orderBy = { createdAt: "desc" };
  if (sort === "deadline") {
    orderBy = { applyBy: "asc" };
  } else if (sort === "openings") {
    orderBy = { openings: "desc" };
  } else if (sort === "oldest") {
    orderBy = { createdAt: "asc" };
  }

  const jobs = await prisma.job.findMany({
    where: {
      status: "OPEN",
      applyBy: { gte: new Date() },
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    include: { applications: true },
    orderBy,
  });

  if (salaryBracket) {
    return jobs.filter((job) => {
      const sal = (job.salary || "").toLowerCase();
      const match = sal.match(/(\d+(\.\d+)?)/);
      const val = match ? parseFloat(match[1]) : 0;
      if (salaryBracket === "0-6") return val <= 6 || sal.includes("5") || sal.includes("4");
      if (salaryBracket === "6-12") return (val >= 6 && val <= 12) || sal.includes("8") || sal.includes("10");
      if (salaryBracket === "12-20") return (val >= 12 && val <= 20) || sal.includes("15") || sal.includes("18");
      if (salaryBracket === "20+") return val >= 20 || sal.includes("25") || sal.includes("30") || sal.includes("40") || sal.includes("50");
      return true;
    });
  }

  return jobs;
};

export const getPublicJobFacets = async () => {
  const allOpenJobs = await prisma.job.findMany({
    where: {
      status: "OPEN",
      applyBy: { gte: new Date() },
    },
    select: {
      category: true,
      location: true,
      skills: true,
      salary: true,
    },
  });

  const categoryMap = {};
  const locationMap = {};
  const skillMap = {};

  allOpenJobs.forEach((job) => {
    if (job.category) {
      categoryMap[job.category] = (categoryMap[job.category] || 0) + 1;
    }
    if (job.location) {
      locationMap[job.location] = (locationMap[job.location] || 0) + 1;
    }
    try {
      const skills = JSON.parse(job.skills || "[]");
      skills.forEach((s) => {
        const clean = s.trim();
        if (clean) skillMap[clean] = (skillMap[clean] || 0) + 1;
      });
    } catch {
      if (job.skills) {
        job.skills.split(",").forEach((s) => {
          const clean = s.trim();
          if (clean) skillMap[clean] = (skillMap[clean] || 0) + 1;
        });
      }
    }
  });

  const categories = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const locations = Object.entries(locationMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topSkills = Object.entries(skillMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    categories,
    locations,
    topSkills,
    totalJobs: allOpenJobs.length,
  };
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

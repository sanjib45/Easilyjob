import { db } from "../config/database.js";

export const getAllJobs = () => db.data.jobs;

export const getJobById = (id) => db.data.jobs.find((job) => job.id === id);

export const addJob = async (job) => {
  db.data.jobs.push(job);
  await db.write();
  return job;
};

export const updateJob = async (id, updatedJob) => {
  const index = db.data.jobs.findIndex((job) => job.id === id);
  if (index === -1) return null;
  db.data.jobs[index] = { ...db.data.jobs[index], ...updatedJob };
  await db.write();
  return db.data.jobs[index];
};

export const deleteJob = async (id) => {
  const before = db.data.jobs.length;
  db.data.jobs = db.data.jobs.filter((job) => job.id !== id);
  await db.write();
  return db.data.jobs.length < before;
};

export const getJobsByRecruiter = (recruiterId) =>
  db.data.jobs.filter((job) => job.recruiterId === recruiterId);

export const addApplicant = async (jobId, applicant) => {
  const job = getJobById(jobId);
  if (!job) return null;
  job.applicants.push(applicant);
  await db.write();
  return applicant;
};

export const getApplicants = (jobId) => {
  const job = getJobById(jobId);
  return job ? job.applicants : [];
};

export const hasUserApplied = (jobId, email) => {
  const job = getJobById(jobId);
  if (!job) return false;
  return job.applicants.some(
    (applicant) => applicant.email.toLowerCase() === String(email).toLowerCase()
  );
};

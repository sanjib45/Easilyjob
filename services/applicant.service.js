import { prisma } from "../config/prisma.js";
import { listUserSavedJobs } from "../repositories/savedJob.repository.js";

/**
 * Applicant Service
 * Enforces applicant data boundaries: candidate data only, no recruiter internal notes exposed.
 */

export const getApplicantDashboardData = async (applicantId) => {
  const [applications, savedJobs, upcomingInterviews] = await Promise.all([
    prisma.application.findMany({
      where: { applicantId },
      include: {
        job: { select: { id: true, designation: true, companyName: true, location: true, salary: true } },
        conversation: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    listUserSavedJobs(applicantId),
    prisma.interview.findMany({
      where: {
        application: { applicantId },
        status: { in: ["SCHEDULED", "RESCHEDULED"] },
        scheduledAt: { gte: new Date() },
      },
      include: {
        job: { select: { designation: true, companyName: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const stats = {
    totalApplications: applications.length,
    shortlisted: applications.filter((a) => a.status === "SHORTLISTED").length,
    upcomingInterviewsCount: upcomingInterviews.length,
    savedJobsCount: savedJobs.length,
  };

  return {
    applications,
    savedJobs,
    upcomingInterviews,
    stats,
  };
};

export const getApplicantApplicationDetails = async (applicationId, applicantId) => {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      applicantId,
    },
    select: {
      id: true,
      jobId: true,
      name: true,
      email: true,
      contact: true,
      status: true,
      createdAt: true,
      statusUpdatedAt: true,
      job: {
        select: {
          id: true,
          designation: true,
          companyName: true,
          location: true,
          salary: true,
        },
      },
      statusHistory: {
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          // Exclude actorId and recruiter private reason
        },
        orderBy: { createdAt: "desc" },
      },
      interviews: {
        select: {
          id: true,
          roundName: true,
          scheduledAt: true,
          durationMinutes: true,
          timezone: true,
          meetingUrl: true,
          status: true,
          result: {
            select: {
              outcome: true,
              summary: true,
              sharedAt: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
      },
      conversation: { select: { id: true } },
    },
  });

  return application;
};

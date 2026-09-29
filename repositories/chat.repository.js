import { prisma } from "../config/prisma.js";

/**
 * Chat Repository
 * Manages direct conversations between recruiters and applicants.
 */

export const findOrCreateConversation = async ({ applicationId, recruiterId, applicantId }) => {
  if (!applicationId || !recruiterId || !applicantId) return null;

  let conversation = await prisma.conversation.findUnique({
    where: { applicationId },
    include: {
      application: {
        select: {
          id: true,
          jobId: true,
          job: { select: { designation: true, companyName: true } },
        },
      },
      recruiter: { select: { id: true, name: true, email: true } },
      applicant: { select: { id: true, name: true, email: true } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        applicationId,
        recruiterId,
        applicantId,
        lastMessage: "Conversation started.",
        lastMessageAt: new Date(),
      },
      include: {
        application: {
          select: {
            id: true,
            jobId: true,
            job: { select: { designation: true, companyName: true } },
          },
        },
        recruiter: { select: { id: true, name: true, email: true } },
        applicant: { select: { id: true, name: true, email: true } },
      },
    });
  }

  return conversation;
};

export const listUserConversations = async (userId) => {
  return prisma.conversation.findMany({
    where: {
      OR: [{ recruiterId: userId }, { applicantId: userId }],
    },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          job: { select: { designation: true, companyName: true } },
        },
      },
      recruiter: { select: { id: true, name: true, email: true } },
      applicant: { select: { id: true, name: true, email: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });
};

export const findConversationById = async (conversationId, userId) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      application: {
        select: {
          id: true,
          status: true,
          job: { select: { id: true, designation: true, companyName: true } },
        },
      },
      recruiter: { select: { id: true, name: true, email: true } },
      applicant: { select: { id: true, name: true, email: true } },
    },
  });

  if (!conversation) return null;
  if (conversation.recruiterId !== userId && conversation.applicantId !== userId) {
    return null; // Tenant/participant boundary guard
  }

  return conversation;
};

export const listConversationMessages = async (conversationId, limit = 50) => {
  return prisma.message.findMany({
    where: { conversationId },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });
};

export const createChatMessage = async ({ conversationId, senderId, content }) => {
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: content.trim(),
      lastMessageAt: new Date(),
    },
  });

  return message;
};

export const markMessagesAsRead = async (conversationId, userId) => {
  return prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
};

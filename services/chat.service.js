import {
  findOrCreateConversation,
  listUserConversations,
  findConversationById,
  listConversationMessages,
  createChatMessage,
  markMessagesAsRead,
} from "../repositories/chat.repository.js";
import { AppError } from "../utils/AppError.js";

export const getOrCreateChatForApplication = async ({ applicationId, recruiterId, applicantId }) => {
  return findOrCreateConversation({ applicationId, recruiterId, applicantId });
};

export const getUserChats = async (userId) => {
  return listUserConversations(userId);
};

export const getChatRoom = async (conversationId, userId) => {
  const conversation = await findConversationById(conversationId, userId);
  if (!conversation) {
    throw new AppError("Chat conversation not found or access denied.", 404);
  }
  await markMessagesAsRead(conversationId, userId);
  const messages = await listConversationMessages(conversationId);
  return { conversation, messages };
};

export const postChatMessage = async ({ conversationId, senderId, content }) => {
  if (!content || !content.trim()) {
    throw new AppError("Message content cannot be empty.", 400);
  }
  const conversation = await findConversationById(conversationId, senderId);
  if (!conversation) {
    throw new AppError("Conversation not found or unauthorized.", 403);
  }
  return createChatMessage({ conversationId, senderId, content });
};

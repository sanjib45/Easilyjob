import { asyncHandler } from "../utils/asyncHandler.js";
import { getUserChats, getChatRoom, postChatMessage } from "../services/chat.service.js";

export const renderConversations = asyncHandler(async (req, res) => {
  const conversations = await getUserChats(req.user.id);
  res.render("chat/conversations", {
    title: "Direct Messages",
    conversations,
  });
});

export const renderChatRoom = asyncHandler(async (req, res) => {
  const { conversation, messages } = await getChatRoom(req.params.conversationId, req.user.id);
  const otherUser =
    conversation.recruiterId === req.user.id ? conversation.applicant : conversation.recruiter;

  res.render("chat/room", {
    title: `Chat with ${otherUser.name}`,
    conversation,
    messages,
    otherUser,
  });
});

export const handleSendMessage = asyncHandler(async (req, res) => {
  await postChatMessage({
    conversationId: req.params.conversationId,
    senderId: req.user.id,
    content: req.body.content,
  });

  if (req.headers["accept"]?.includes("application/json")) {
    return res.json({ success: true });
  }

  res.redirect(`/messages/${req.params.conversationId}`);
});

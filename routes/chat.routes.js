import { Router } from "express";
import { renderConversations, renderChatRoom, handleSendMessage } from "../controllers/chat.controller.js";
import { isAuthenticated, requireEmailVerified } from "../middleware/auth.js";
import { verifyCsrfToken } from "../middleware/csrf.js";

const router = Router();

router.use(isAuthenticated);
router.use(requireEmailVerified);

router.get("/", renderConversations);
router.get("/:conversationId", renderChatRoom);
router.post("/:conversationId/send", verifyCsrfToken, handleSendMessage);

export default router;

import { Router } from "express";
import { authUser } from "../middlewares/auth.middleware.js";
import { createConversation, ConversationMessages, sendMessage,getUserConversations, sendMoneyMessage } from "../controllers/chat.controller.js";

const router = Router();

router.route("/conversation").post(
    authUser,
    createConversation
);

router.route("/conversation/:conversationId/message").post(
    authUser,
    sendMessage
);
router.route("/conversation/:conversationId/messages").post(
    authUser,
    ConversationMessages
);
router.route("/conversation/:conversationId/moneyMessage").post(
    authUser,
    sendMoneyMessage
);
router.route("/conversations").get(
    authUser,
    getUserConversations
);

export default router;
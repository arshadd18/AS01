import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { transferMoney } from "../service/wallet.service.js";

const createConversation = asyncHandler(async (req, res) => {
//actually this is for only the duo communication and the two people should only have a single conversation 
    const { userId } = req.body;

    const currentUserId = req.user.id;

    if (!userId) {
        throw new ApiError(400, "Please provide userId");
    }

    if (currentUserId === Number(userId)) {
        throw new ApiError(400, "You cannot create a conversation with yourself");
    }

    const otherUser = await prisma.user.findUnique({
        where: {
            id: Number(userId)
        },
        select: {
            id: true,
            name: true,
            email: true,
            profilePic: true
        }
    });

    if (!otherUser) {
        throw new ApiError(404, "User not found");
    }

    // Check whether a conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
        where: {
            AND: [
                {
                    members: {
                        some: {
                            userId: currentUserId
                        }
                    }
                },
                {
                    members: {
                        some: {
                            userId: otherUser.id
                        }
                    }
                }
            ]
        },
        include: {
            members: {
                select: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profilePic: true
                        }
                    }
                }
            }
        }
    });

    if (existingConversation) {
        return res.status(200).json(
            new ApiResponse(
                200,
                { conversation: existingConversation },
                "Conversation already exists"
            )
        );
    }

    // Create a new conversation
    const conversation = await prisma.conversation.create({
        data: {
            members: {
                create: [
                    {
                        userId: currentUserId
                    },
                    {
                        userId: otherUser.id
                    }
                ]
            }
        },
        include: {
            members: {
                select: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profilePic: true
                        }
                    }
                }
            }
        }
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            { conversation },
            "Conversation created successfully"
        )
    );
});

const sendMessage = asyncHandler(async (req, res) => {

    const { conversationId } = req.params;
    const { content } = req.body;

    const senderId = req.user.id;

    if (!content || !content.trim()) {
        throw new ApiError(400, "Message cannot be empty");
    }

    const conversation = await prisma.conversation.findUnique({
        where: {
            id: Number(conversationId)
        },
        include: {
            members: {
                select: {
                    userId: true
                }
            }
        }
    });

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    // Check whether the sender belongs to this conversation
    const isMember = conversation.members.some(
        member => member.userId === senderId
    );

    if (!isMember) {
        throw new ApiError(
            403,
            "You are not a member of this conversation"
        );
    }

    const message = await prisma.message.create({
        data: {
            conversationId: Number(conversationId),
            senderId: senderId,
            type: "TEXT",
            content: content.trim()
        },
        select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,

            sender: {
                select: {
                    id: true,
                    name: true,
                    profilePic: true
                }
            }
        }
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            { message },
            "Message sent successfully"
        )
    );
});
const ConversationMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
        Math.max(Number(req.query.limit) || 20, 1),
        100
    );

    const skip = (page - 1) * limit;

    const conversation = await prisma.conversation.findUnique({
        where: {
            id: Number(conversationId)
        },
        select: {
            id: true,

            members: {
                select: {
                    userId: true
                }
            }
        }
    });

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    const isMember = conversation.members.some(
        member => member.userId === userId
    );

    if (!isMember) {
        throw new ApiError(
            403,
            "You are not a member of this conversation"
        );
    }

    const [messages, totalMessages] = await prisma.$transaction([
        prisma.message.findMany({
            where: {
                conversationId: Number(conversationId)
            },

            select: {
                id: true,
                type: true,
                content: true,
                createdAt: true,

                sender: {
                    select: {
                        id: true,
                        name: true,
                        profilePic: true
                    }
                },

                transaction: {
                    select: {
                        id: true,
                        amount: true,
                        type: true,
                        status: true,
                        createdAt: true
                    }
                }
            },

            orderBy: {
                createdAt: "desc"
            },

            skip: skip,
            take: limit
        }),

        prisma.message.count({
            where: {
                conversationId: Number(conversationId)
            }
        })
    ]);

    const totalPages = Math.ceil(totalMessages / limit);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                messages,
                pagination: {
                    currentPage: page,
                    limit,
                    totalMessages,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            },
            "Conversation messages retrieved successfully"
        )
    );
});

const sendMoneyMessage = asyncHandler(async (req, res) => {

    const { conversationId } = req.params;
    const { receiverId, amount } = req.body;

    const senderId = req.user.id;

    if (!receiverId) {
        throw new ApiError(
            400,
            "Please provide receiverId"
        );
    }

    const conversation = await prisma.conversation.findUnique({
        where: {
            id: Number(conversationId)
        },
        select: {
            id: true,
            members: {
                select: {
                    userId: true
                }
            }
        }
    });

    if (!conversation) {
        throw new ApiError(
            404,
            "Conversation not found"
        );
    }

    const senderIsMember = conversation.members.some(
        member => member.userId === senderId
    );

    const receiverIsMember = conversation.members.some(
        member => member.userId === Number(receiverId)
    );

    if (!senderIsMember || !receiverIsMember) {
        throw new ApiError(
            403,
            "Both users must be members of the conversation"
        );
    }

    const result = await prisma.$transaction(async (tx) => {

        // Reusable wallet business logic
        const transfer = await transferMoney({
            senderId,
            receiverId: Number(receiverId),
            amount,
            tx
        });

        // Chat-specific logic
        const message = await tx.message.create({
            data: {
                conversationId: Number(conversationId),
                senderId,
                type: "MONEY",
                transactionId: transfer.transaction.id
            },
            select: {
                id: true,
                type: true,
                createdAt: true,

                transaction: {
                    select: {
                        id: true,
                        amount: true,
                        type: true,
                        status: true
                    }
                }
            }
        });

        return message;
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            { message: result },
            "Money sent successfully"
        )
    );
});

const getUserConversations = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
        where: {
            members: {
                some: {
                    userId: userId
                }
            }
        },
        select: {
            id: true,
            createdAt: true,

            members: {
                select: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            profilePic: true
                        }
                    }
                }
            },

            messages: {
                orderBy: {
                    createdAt: "desc"
                },
                take: 1,
                select: {
                    id: true,
                    type: true,
                    content: true,
                    createdAt: true,

                    sender: {
                        select: {
                            id: true,
                            name: true
                        }
                    },

                    transaction: {
                        select: {
                            id: true,
                            amount: true,
                            status: true,
                            type: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            { conversations },
            "Conversations retrieved successfully"
        )
    );
});

const deleteMessage = asyncHandler(async (req, res) => {

    const { conversationId, messageId } = req.params;

    const userId = req.user.id;

    const message = await prisma.message.findUnique({
        where: {
            id: Number(messageId)
        },
        select: {
            id: true,
            conversationId: true,
            senderId: true,
            type: true
        }
    });

    if (!message) {
        throw new ApiError(404, "Message not found");
    }

    // Make sure the message belongs to this conversation
    if (message.conversationId !== Number(conversationId)) {
        throw new ApiError(
            400,
            "Message does not belong to this conversation"
        );
    }

    // Only the sender can delete their message
    if (message.senderId !== userId) {
        throw new ApiError(
            403,
            "You can only delete your own messages"
        );
    }

    // MONEY messages represent financial transactions
    if (message.type === "MONEY") {
        throw new ApiError(
            400,
            "Money messages cannot be deleted"
        );
    }

    await prisma.message.delete({
        where: {
            id: message.id
        }
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Message deleted successfully"
        )
    );
});

export { createConversation,sendMessage,ConversationMessages ,sendMoneyMessage,getUserConversations,
    deleteMessage
};


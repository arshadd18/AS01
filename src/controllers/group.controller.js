import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { transferMoney } from "../service/wallet.service.js";
const createGroup = asyncHandler(async (req, res) => {

    const { name } = req.body;

    const userId = req.user.id;

    if (!name || !name.trim()) {
        throw new ApiError(400, "Please provide group name");
    }

   const group = await prisma.$transaction(async (tx) => {

    // 1. Create conversation
    const conversation = await tx.conversation.create({
        data: {}
    });

    // 2. Create group linked to conversation
    const group = await tx.group.create({
        data: {
            name: name.trim(),
            conversationId: conversation.id
        }
    });

    // 3. Add creator as group OWNER
    await tx.groupMember.create({
        data: {
            groupId: group.id,
            userId: userId,
            role: "OWNER"
        }
    });

    // 4. Add creator to the conversation
    await tx.conversationMember.create({
        data: {
            conversationId: conversation.id,
            userId: userId
        }
    });

    return group;
});

    return res.status(201).json(
        new ApiResponse(
            201,
            { group },
            "Group created successfully"
        )
    );
});


const addGroupMember = asyncHandler(async (req, res) => {

    const { groupId } = req.params;
    const { userId } = req.body;

    const currentUserId = req.user.id;

    if (!userId) {
        throw new ApiError(400, "Please provide userId");
    }

    const group = await prisma.group.findUnique({
        where: {
            id: Number(groupId)
        },
        select: {
            id: true,
            conversationId: true,
            members: {
                select: {
                    userId: true,
                    role: true
                }
            }
        }
    });

    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    // Check whether the requester is a group member
    const currentMember = group.members.find(
        member => member.userId === currentUserId
    );

    if (!currentMember) {
        throw new ApiError(
            403,
            "You are not a member of this group"
        );
    }

    // Only the owner can add members
    if (currentMember.role !== "OWNER") {
        throw new ApiError(
            403,
            "Only the group owner can add members"
        );
    }

    // Check whether the user exists
    const user = await prisma.user.findUnique({
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

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Check whether the user is already a member
    const alreadyMember = group.members.some(
        member => member.userId === user.id
    );

    if (alreadyMember) {
        throw new ApiError(
            400,
            "User is already a member of this group"
        );
    }

    // Add to both GroupMember and ConversationMember atomically
    await prisma.$transaction(async (tx) => {

        await tx.groupMember.create({
            data: {
                groupId: group.id,
                userId: user.id,
                role: "MEMBER"
            }
        });

        await tx.conversationMember.create({
            data: {
                conversationId: group.conversationId,
                userId: user.id
            }
        });
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            { user },
            "Member added successfully"
        )
    );
});

const updateGroupMemberRole = asyncHandler(async (req, res) => {

    const { groupId, userId } = req.params;
    const { role } = req.body;

    const currentUserId = req.user.id;

    if (!role) {
        throw new ApiError(400, "Please provide role");
    }

    if (role !== "OWNER" && role !== "MEMBER") {
        throw new ApiError(
            400,
            "Role must be OWNER or MEMBER"
        );
    }

    const group = await prisma.group.findUnique({
        where: {
            id: Number(groupId)
        },
        select: {
            id: true,
            members: {
                select: {
                    userId: true,
                    role: true
                }
            }
        }
    });

    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    // Check whether requester is a member
    const currentMember = group.members.find(
        member => member.userId === currentUserId
    );

    if (!currentMember) {
        throw new ApiError(
            403,
            "You are not a member of this group"
        );
    }

    // Only owners can change roles
    if (currentMember.role !== "OWNER") {
        throw new ApiError(
            403,
            "Only group owners can change member roles"
        );
    }

    // Find target member
    const targetMember = group.members.find(
        member => member.userId === Number(userId)
    );

    if (!targetMember) {
        throw new ApiError(
            404,
            "User is not a member of this group"
        );
    }

    // Owner cannot demote themselves
    if (
        currentUserId === Number(userId) &&
        role === "MEMBER"
    ) {
        throw new ApiError(
            400,
            "You cannot demote yourself"
        );
    }

    // No need to update if role is already the same
    if (targetMember.role === role) {
        throw new ApiError(
            400,
            `User is already a ${role}`
        );
    }

    const updatedMember = await prisma.groupMember.update({
        where: {
            groupId_userId: {
                groupId: Number(groupId),
                userId: Number(userId)
            }
        },
        data: {
            role
        },
        select: {
            userId: true,
            role: true
        }
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            { member: updatedMember },
            "Member role updated successfully"
        )
    );
});


const removeGroupMember = asyncHandler(async (req, res) => {

    const { groupId, userId } = req.params;

    const currentUserId = req.user.id;

    if (currentUserId === Number(userId)) {
        throw new ApiError(
            400,
            "You cannot remove yourself from the group"
        );
    }

    const group = await prisma.group.findUnique({
        where: {
            id: Number(groupId)
        },
        select: {
            id: true,
            conversationId: true,
            members: {
                select: {
                    userId: true,
                    role: true
                }
            }
        }
    });

    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    // Check requester membership
    const currentMember = group.members.find(
        member => member.userId === currentUserId
    );

    if (!currentMember) {
        throw new ApiError(
            403,
            "You are not a member of this group"
        );
    }

    // Only owners can remove members
    if (currentMember.role !== "OWNER") {
        throw new ApiError(
            403,
            "Only group owners can remove members"
        );
    }

    // Check target membership
    const targetMember = group.members.find(
        member => member.userId === Number(userId)
    );

    if (!targetMember) {
        throw new ApiError(
            404,
            "User is not a member of this group"
        );
    }

    await prisma.$transaction(async (tx) => {

        // Remove from group
        await tx.groupMember.delete({
            where: {
                groupId_userId: {
                    groupId: Number(groupId),
                    userId: Number(userId)
                }
            }
        });

        // Remove from group conversation
        await tx.conversationMember.delete({
            where: {
                conversationId_userId: {
                    conversationId: group.conversationId,
                    userId: Number(userId)
                }
            }
        });
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Member removed successfully"
        )
    );
});

const createBill = asyncHandler(async (req, res) => {

    const { groupId } = req.params;
    const { amount, description, splits } = req.body;

    const userId = req.user.id;

    if (!amount) {
        throw new ApiError(400, "Please provide bill amount");
    }

    if (Number(amount) <= 0) {
        throw new ApiError(400, "Bill amount must be greater than zero");
    }

    if (!description || !description.trim()) {
        throw new ApiError(400, "Please provide bill description");
    }

    if (!Array.isArray(splits) || splits.length === 0) {
        throw new ApiError(400, "Please provide bill splits");
    }

    const group = await prisma.group.findUnique({
        where: {
            id: Number(groupId)
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

    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    // Check whether the person creating the bill is a group member
    const isMember = group.members.some(
        member => member.userId === userId
    );

    if (!isMember) {
        throw new ApiError(
            403,
            "You are not a member of this group"
        );
    }

    // Check for duplicate users in splits
    const splitUserIds = splits.map(
        split => Number(split.userId)
    );
    if (splitUserIds.includes(userId)) {
    throw new ApiError(
        400,
        "The bill creator cannot be included in the splits"
    );
}
    const uniqueUserIds = new Set(splitUserIds);

    if (uniqueUserIds.size !== splitUserIds.length) {
        throw new ApiError(
            400,
            "A user cannot have multiple splits in the same bill"
        );
    }

    // Check that every split user belongs to the group
    const allUsersAreMembers = splitUserIds.every(
        splitUserId =>
            group.members.some(
                member => member.userId === splitUserId
            )
    );

    if (!allUsersAreMembers) {
        throw new ApiError(
            400,
            "All split users must be members of the group"
        );
    }

    // Validate every share
    const hasInvalidShare = splits.some(
        split => Number(split.share) <= 0
    );

    if (hasInvalidShare) {
        throw new ApiError(
            400,
            "Each split share must be greater than zero"
        );
    }

    // Check that splits add up exactly to bill amount
    const totalSplitAmount = splits.reduce(
        (total, split) => total + Number(split.share),
        0
    );

    if (totalSplitAmount !== Number(amount)) {
        throw new ApiError(
            400,
            "Split amounts must add up to the bill amount"
        );
    }

    const bill = await prisma.$transaction(async (tx) => {

        const bill = await tx.bill.create({
            data: {
                groupId: Number(groupId),
                paidById: userId,
                amount: amount,
                description: description.trim(),

                splits: {
                    create: splits.map(split => ({
                        userId: Number(split.userId),
                        share: split.share
                    }))
                }
            },

            include: {
                splits: {
                    select: {
                        id: true,
                        userId: true,
                        share: true,
                        isPaid: true
                    }
                }
            }
        });

        return bill;
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            { bill },
            "Bill created successfully"
        )
    );
});


const payBillSplit = asyncHandler(async (req, res) => {

    const { billId, splitId } = req.params;

    const userId = req.user.id;

    const billSplit = await prisma.billSplit.findUnique({
        where: {
            id: Number(splitId)
        },
        select: {
            id: true,
            billId: true,
            userId: true,
            share: true,
            isPaid: true,

            bill: {
                select: {
                    id: true,
                    groupId: true,
                    paidById: true,
                    group: {
                        select: {
                            conversationId: true
                        }
                    }
                }
            }
        }
    });

    if (!billSplit) {
        throw new ApiError(404, "Bill split not found");
    }

    // Make sure the split belongs to the bill in the URL
    if (billSplit.billId !== Number(billId)) {
        throw new ApiError(
            400,
            "Bill split does not belong to this bill"
        );
    }

    // Only the user who owes the split can pay it
    if (billSplit.userId !== userId) {
        throw new ApiError(
            403,
            "You can only pay your own bill split"
        );
    }

    // Prevent paying the same split twice
    if (billSplit.isPaid) {
        throw new ApiError(
            400,
            "Bill split is already paid"
        );
    }

    const result = await prisma.$transaction(async (tx) => {

        // 1. Transfer money from split owner to bill payer
        const transfer = await transferMoney({
            senderId: userId,
            receiverId: billSplit.bill.paidById,
            amount: billSplit.share,
            tx
        });

        // 2. Mark split as paid
        const updatedSplit = await tx.billSplit.update({
            where: {
                id: billSplit.id
            },
            data: {
                isPaid: true
            }
        });

        // 3. Create MONEY message in group conversation
        const message = await tx.message.create({
            data: {
                conversationId:
                    billSplit.bill.group.conversationId,
                senderId: userId,
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

        return {
            updatedSplit,
            message
        };
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                split: result.updatedSplit,
                message: result.message
            },
            "Bill split paid successfully"
        )
    );
});

const getGroupDetails = asyncHandler(async (req, res) => {

    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await prisma.group.findUnique({
        where: {
            id: Number(groupId)
        },
        select: {
            id: true,
            name: true,
            conversationId: true,
            createdAt: true,

            members: {
                select: {
                    userId: true,
                    role: true,
                    createdAt: true,

                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                           
                        }
                    }
                }
            },

            bills: {
                orderBy: {
                    createdAt: "desc"
                },
                select: {
                    id: true,
                    amount: true,
                    description: true,
                    createdAt: true,

                    paidBy: {
                        select: {
                            id: true,
                            name: true,
                            
                        }
                    },

                    splits: {
                        select: {
                            id: true,
                            userId: true,
                            share: true,
                            isPaid: true,

                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    // Check whether requester belongs to the group
    const isMember = group.members.some(
        member => member.userId === userId
    );

    if (!isMember) {
        throw new ApiError(
            403,
            "You are not a member of this group"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { group },
            "Group details retrieved successfully"
        )
    );
});

const deleteBill = asyncHandler(async (req, res) => {

    const { billId } = req.params;

    const userId = req.user.id;

    const bill = await prisma.bill.findUnique({
        where: {
            id: Number(billId)
        },
        select: {
            id: true,
            paidById: true,

            splits: {
                select: {
                    id: true,
                    isPaid: true
                }
            }
        }
    });

    if (!bill) {
        throw new ApiError(404, "Bill not found");
    }

    // Only the person who paid the bill can delete it
    if (bill.paidById !== userId) {
        throw new ApiError(
            403,
            "Only the bill creator can delete this bill"
        );
    }

    // A bill cannot be deleted if any split has already been paid
    const hasPaidSplit = bill.splits.some(
        split => split.isPaid
    );

    if (hasPaidSplit) {
        throw new ApiError(
            400,
            "Cannot delete a bill with paid splits"
        );
    }

    await prisma.bill.delete({
        where: {
            id: bill.id
        }
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Bill deleted successfully"
        )
    );
});

export { createGroup ,addGroupMember,updateGroupMemberRole,removeGroupMember,createBill,payBillSplit,getGroupDetails,deleteBill};
import prisma from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";

const transferMoney = async ({
    senderId,
    receiverId,
    amount,
    tx = prisma
}) => {

    if (senderId === receiverId) {
        throw new ApiError(
            400,
            "You cannot transfer money to yourself"
        );
    }

    const transferAmount = Number(amount);

    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new ApiError(
            400,
            "Please enter a valid amount"
        );
    }

    // Atomically deduct money from sender
    const sending = await tx.wallet.updateMany({
        where: {
            userId: senderId,
            balance: {
                gte: transferAmount
            }
        },
        data: {
            balance: {
                decrement: transferAmount
            }
        }
    });

    if (sending.count !== 1) {
        throw new ApiError(
            400,
            "Insufficient balance"
        );
    }

    // Credit receiver
    const receiving = await tx.wallet.update({
        where: {
            userId: receiverId
        },
        data: {
            balance: {
                increment: transferAmount
            }
        }
    });

    // Create ledger transaction
    const transaction = await tx.transaction.create({
        data: {
            senderId,
            receiverId,
            amount: transferAmount,
            type: "P2P_TRANSFER",
            status: "SUCCESS"
        }
    });

    return {
        sending,
        receiving,
        transaction
    };
};

export { transferMoney };
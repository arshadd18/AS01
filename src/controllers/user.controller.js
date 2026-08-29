import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadFileToCloudinary } from "../utils/cloudinary.js";
import { transferMoney } from "../service/wallet.service.js";
import { toMoneyDecimal } from "../utils/money.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import prisma from "../db/prisma.js";
import {
    generateAccessToken,
    generateRefreshToken
} from "../utils/token.js";


const generateAccessandRefreshToken = async (user) => {
    try {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                refreshToken: refreshToken
            }
        });

        return {
            accessToken,
            refreshToken
        };

    } catch (error) {
        console.error(error);
        throw new ApiError("Error generating tokens", 500);
    }
};
const registerUser = asyncHandler(async (req, res) => {

    const { email, password, name } = req.body;
    const profilePic = req.file?.path;

    if (!email || !password || !name) {
        return res.status(400).json({
            message: "Please provide all required fields",
            success: false
        });
    }

    const isUserExist = await prisma.user.findUnique({
        where: {
            email: email
        },
        select: {
            id: true
        }
    });

    if (isUserExist) {
        return res.status(400).json({
            message: "User already exists",
            success: false
        });
    }

    let url = null;

    if (profilePic) {
        const result = await uploadFileToCloudinary(profilePic);
        url = result.url;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email: email,
            password: hashedPassword,
            name: name,
            profilePic: url,
            refreshToken: null,

            wallet: {
                create: {
                    balance: 0
                }
            }
        },
        select: {
            id: true,
            email: true,
            name: true,
            profilePic: true,
            createdAt: true,
            updatedAt: true
        }
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.user.update({
        where: {
            id: user.id
        },
        data: {
            refreshToken: refreshToken
        }
    });

    // Set tokens in HttpOnly cookies
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    });

    return res.status(201).json({
        message: "User created successfully",
        success: true,
        user: user
    });
});

const loginUser = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Please provide email and password",
            success: false
        });
    }

    // Password MUST be selected here because bcrypt needs it.
    const user = await prisma.user.findUnique({
        where: {
            email: email
        },
        select: {
            id: true,
            email: true,
            name: true,
            profilePic: true,
            password: true
        }
    });

    if (!user) {
        throw new ApiError("User not found", 404);
    }

    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatch) {
        throw new ApiError("Invalid credentials", 401);
    }

    const {
        accessToken,
        refreshToken
    } = await generateAccessandRefreshToken(user);

    // Remove password before sending user data
    const {
        password: _password,
        ...loggedInUser
    } = user;

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    loggedInUser
                },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {

    await prisma.user.update({
        where: {
            id: req.user.id
        },
        data: {
            refreshToken: null
        }
    });

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("refreshToken", options)
        .clearCookie("accessToken", options)
        .json(
            new ApiResponse(
                200,
                null,
                "User logged out successfully"
            )
        );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError("Unauthorized refreshToken", 401);
    }

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    if (!decodedToken) {
        throw new ApiError("Invalid refreshToken", 401);
    }

    const user = await prisma.user.findUnique({
        where: {
            id: decodedToken.id
        },
        select: {
            id: true,
            email: true,
            name: true,
            profilePic: true,
            refreshToken: true
        }
    });

    if (!user) {
        throw new ApiError("Invalid refreshToken", 401);
    }

    if (incomingRefreshToken !== user.refreshToken) {
        throw new ApiError("Invalid refreshToken", 401);
    }

    const {
        accessToken,
        refreshToken
    } = await generateAccessandRefreshToken(user);

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken },
                "Access token refreshed successfully"
            )
        );
});

const getUserProfile = asyncHandler(async (req, res) => {
   try {const user = await prisma.user.findUnique({
        where: {
            id: req.user.id
        },
        select: {
            id: true,
            email: true,
            name: true,
            profilePic: true,
            createdAt: true,
            updatedAt: true
        }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user },
                "User profile retrieved successfully"
            )
        );}
    catch(error){
        throw new ApiError(400,"cannot fetch user details");
    }
});
const updatePassword = asyncHandler(async (req, res) => {

    const { oldpassword, newpassword } = req.body;

    if (!oldpassword || !newpassword) {
        throw new ApiError(
            "Old password and new password are required",
            400
        );
    }

    const user = await prisma.user.findUnique({
        where: {
            id: req.user.id
        },
        select: {
            id: true,
            password: true
        }
    });

    if (!user) {
        throw new ApiError("User not found", 404);
    }

    const isPasswordCorrect = await bcrypt.compare(
        oldpassword,
        user.password
    );

    if (!isPasswordCorrect) {
        throw new ApiError(
            "Old password is incorrect",
            401
        );
    }

    const hashedNewPassword = await bcrypt.hash(
        newpassword,
        10
    );

    await prisma.user.update({
        where: {
            id: user.id
        },
        data: {
            password: hashedNewPassword,
            refreshToken: null
        }
    });

    // Clear the refresh token cookie
    res.clearCookie("refreshToken");

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "Password updated successfully"
            )
        );
});
const updateUserDetails = asyncHandler(async (req, res) => {
    const { name, email } = req.body;

    if (!name && !email) {
        throw new ApiError("Please provide name or email", 400);
    }

    // If email is being changed, check whether it's already used
    if (email) {
        const existingUser = await prisma.user.findUnique({
            where: {
                email: email
            },
            select: {
                id: true
            }
        });

        if (existingUser && existingUser.id !== req.user.id) {
            throw new ApiError("Email already in use", 409);
        }
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: req.user.id
        },
        data: {
            ...(name && { name: name }),
            ...(email && { email: email })
        },
        select: {
            id: true,
            email: true,
            name: true,
            profilePic: true,
            createdAt: true,
            updatedAt: true
        }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user: updatedUser },
                "User details updated successfully"
            )
        );
});


const updateProfilePic = asyncHandler(async (req, res) => {

    const profilePic = req.file?.path;

    if (!profilePic) {
        throw new ApiError("Please provide a profile picture", 400);
    }

    const result = await uploadFileToCloudinary(profilePic);

    if (!result?.url) {
        throw new ApiError("Failed to upload profile picture", 500);
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: req.user.id
        },
        data: {
            profilePic: result.url
        },
        select: {
            id: true,
            email: true,
            name: true,
            profilePic: true,
            createdAt: true,
            updatedAt: true
        }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user: updatedUser },
                "Profile picture updated successfully"
            )
        );
});

//wallet controllers

const getWalletBalance = asyncHandler(async (req, res) => {

    const wallet = await prisma.wallet.findUnique({
        where: {
            userId: req.user.id
        },
        select: {
            id: true,
            balance: true,
            updatedAt: true
        }
    });

    if (!wallet) {
        throw new ApiError("Wallet not found", 404);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { wallet },
            "Wallet balance retrieved successfully"
        )
    );
});
const depositMoney = asyncHandler(async (req, res) => {
    const { amount } = req.body;

    if (amount === undefined || amount === null) {
        throw new ApiError(400, "Please provide amount");
    }

    let depositAmount;

    try {
        depositAmount = toMoneyDecimal(
            amount,
            "Amount must be greater than 0"
        );
    } catch (error) {
        throw new ApiError(400, "Amount must be greater than 0");
    }

    const result = await prisma.$transaction(async (tx) => {

        // 1. Add money to user's wallet
        const wallet = await tx.wallet.update({
            where: {
                userId: req.user.id
            },
            data: {
                balance: {
                    increment: depositAmount
                }
            },
            select: {
                id: true,
                balance: true,
                updatedAt: true
            }
        });

        // 2. Create transaction record
        const transaction = await tx.transaction.create({
            data: {
                senderId: null,
                receiverId: req.user.id,
                amount: depositAmount,
                type: "DEPOSIT",
                status: "SUCCESS"
            }
        });

        return {
            wallet,
            transaction
        };
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            result,
            "Money deposited successfully"
        )
    );
});
const transferMoneyController = asyncHandler(async (req, res) => {

    const { receiverId, receiverEmail, amount } = req.body;

    const senderId = req.user.id;

    if (!receiverId && !receiverEmail) {
        throw new ApiError(
            400,
            "Please provide receiver details"
        );
    }

    let receiver;

    if (receiverId) {
        receiver = await prisma.user.findUnique({
            where: {
                id: Number(receiverId)
            },
            select: {
                id: true
            }
        });
    } else {
        receiver = await prisma.user.findUnique({
            where: {
                email: receiverEmail
            },
            select: {
                id: true
            }
        });
    }

    if (!receiver) {
        throw new ApiError(
            404,
            "Receiver doesn't exist"
        );
    }

    const result = await prisma.$transaction(async (tx) => {
        return await transferMoney({
            senderId,
            receiverId: receiver.id,
            amount,
            tx
        });
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                transaction: result.transaction
            },
            "Amount transferred successfully"
        )
    );
});

const getTransactionHistory = asyncHandler(async (req, res) => {

    const transactions = await prisma.transaction.findMany({
        where: {
            OR: [
                {
                    senderId: req.user.id
                },
                {
                    receiverId: req.user.id
                }
            ]
        },

        select: {
            id: true,
            amount: true,
            type: true,
            status: true,
            createdAt: true,

            sender: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    // profilePic: true
                }
            },

            receiver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    // profilePic: true
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
            { transactions },
            "Transaction history retrieved successfully"
        )
    );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getUserProfile,
    updatePassword,
    updateProfilePic,
    updateUserDetails,
    getWalletBalance,
    depositMoney,
    transferMoneyController,
    getTransactionHistory
};

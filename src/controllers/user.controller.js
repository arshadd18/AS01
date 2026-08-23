import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadFileToCloudinary } from "../utils/cloudinary.js";
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
            refreshToken: null
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

    return res.status(201).json({
        message: "User created successfully",
        success: true,
        user: user,
        accessToken,
        refreshToken
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


export {
    registerUser,
    loginUser,
    logoutUser
};
import prisma  from "../db/prisma.js";
import jwt from "jsonwebtoken";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError }from "../utils/ApiError.js";

const authUser=asyncHandler(async (req,res,next)=>{

    const token=req.cookies.accessToken;
    if(!token){
        throw new ApiError("Unauthorized",401);
    }
    const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
    if(!decodedToken){
        throw new ApiError("Invalid token",401);
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
        createdAt: true,
        updatedAt: true
    }
    });
    if(!user){
        throw new ApiError("Invalid token",401);
    }
    req.user=user;
    next();
})
export {authUser};

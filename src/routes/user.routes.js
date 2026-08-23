import {Router} from "express";
import upload from "../middlewares/multer.middleware.js";
import { authUser } from "../middlewares/auth.middleware.js";
import { registerUser,loginUser,logoutUser } from "../controllers/user.controller.js";
const router=Router();


router.route("/register").post(upload.single("profilePic"),registerUser);
router.route("/login").post(loginUser);


//secured routes
router.route("/logout").post(authUser,logoutUser);


export default router;

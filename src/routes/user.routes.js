import {Router} from "express";
import upload from "../middlewares/multer.middleware.js";
import { authUser } from "../middlewares/auth.middleware.js";
import { registerUser,loginUser,logoutUser,refreshAccessToken, getUserProfile, updatePassword, updateProfilePic, updateUserDetails } from "../controllers/user.controller.js";
const router=Router();


router.route("/register").post(upload.single("profilePic"),registerUser);
router.route("/login").post(loginUser);


//secured routes
router.route("/logout").post(authUser,logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/userprofile").post(authUser,getUserProfile);
router.route("/updatepassword").post(upload.single("profilePic"),authUser,updatePassword);
router.route("/updateprofilepic").post(authUser,updateProfilePic);
router.route("/updateuserdetails").post(authUser,updateUserDetails);



export default router;

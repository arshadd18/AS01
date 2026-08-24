import {Router} from "express";
import upload from "../middlewares/multer.middleware.js";
import { authUser } from "../middlewares/auth.middleware.js";
import { registerUser,loginUser,logoutUser,refreshAccessToken, getUserProfile, updatePassword, updateProfilePic, updateUserDetails ,getWalletBalance, depositMoney, transferMoney, getTransactionHistory} from "../controllers/user.controller.js";
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
router.route("/wallet").get(authUser, getWalletBalance);
router.route("/wallet/deposit").post(authUser,depositMoney);
router.route("/wallet/p2ptransfer").post(authUser,transferMoney);
router.route("/wallet/transactions").post(authUser,getTransactionHistory);

export default router;

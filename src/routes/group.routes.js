import { Router } from "express";
import { authUser } from "../middlewares/auth.middleware.js";
import { addGroupMember, createBill, createGroup, removeGroupMember, updateGroupMemberRole ,payBillSplit, getGroupDetails, deleteBill} from "../controllers/group.controller.js";

const router=Router();


router.route("/createGroup").post(authUser,createGroup);
router.route("/:groupId/addMember").post(authUser,addGroupMember);
router.route("/:groupId/members/:userId/role").post(
    authUser,
    updateGroupMemberRole
);
router.route("/:groupId/members/:userId").delete(
    authUser,
    removeGroupMember
);

router.route("/:groupId/bills").post(
    authUser,
    createBill
);
router.route("/bills/:billId/splits/:splitId/pay").post(
    authUser,
    payBillSplit
);

router.route("/:groupId").get(
    authUser,
    getGroupDetails
);

router.route("/bills/:billId").delete(
    authUser,
    deleteBill
);
export default router;
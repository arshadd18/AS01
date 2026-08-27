import express from "express";
import prisma from "./db/prisma.js";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();

app.use(express.json({limit: "16kb"}));
app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true}));
app.use(express.static("public"));

//routes import
import userRouter from "./routes/user.routes.js";
import chatRouter from "./routes/chat.routes.js"
import groupRouter from "./routes/group.routes.js";






//routes declaration
app.use("/users", userRouter);
app.use("/chat",chatRouter);
app.use("/group",groupRouter);






app.get("/", (req, res) => {
  res.send("Wallet Split Backend is running!");
});

app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        profilePic: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch users",
    });
  }
});




export { app };
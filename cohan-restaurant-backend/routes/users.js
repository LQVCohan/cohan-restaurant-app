// routes/users.js
import multer from "multer";
import User from "../models/User.js";
import express from "express";

const router = express.Router();
const upload = multer({ dest: "uploads/" });
router.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  const user = await User.findById(req.user.id);
  user.avatar = `/uploads/${req.file.filename}`;
  await user.save();
  res.json({ avatar: user.avatar });
});
export default router;

import process from "process";
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  try {
    console.log("Logging in with email:", email);
    const user = await User.findOne({ email }).select(
      "role password restaurantId avatar"
    );
    console.log("User found:", user);
    if (!user) return res.status(401).json({ error: "Email không tồn tại" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Mật khẩu sai" });
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log("Generated token with role:", user.role);
    res.json({
      token,
      role: user.role,
      restaurantId: user.restaurantId,
      avatar: user.avatar,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const { email, password, role, restaurantId } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email đã tồn tại" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role,
      restaurantId,
    });
    await user.save();
    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (error) {
    next(error);
  }
});

// routes/auth.js
router.post("/verify", async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Không có token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);
    const user = await User.findById(decoded.id).select(
      "role restaurantId avatar"
    );
    if (!user) return res.status(401).json({ error: "User không tồn tại" });
    console.log("User found for verify:", user);
    res.json({
      role: user.role,
      restaurantId: user.restaurantId,
      avatar: user.avatar,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

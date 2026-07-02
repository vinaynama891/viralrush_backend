const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendOTP } = require("../utils/mailer");

const ADMIN_EMAIL = "dkbharke99@gmail.com";
const ADMIN_PASSWORD = "Viral@20";

const signToken = (id, email) =>
  jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const signup = async (req, res, next) => {
  try {
    const { username, name, email, password, niche, platform, platformProfileUrl, followers, role } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ message: "Username is required." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }
    if (role !== 'brand') {
      if (!niche || !niche.trim()) {
        return res.status(400).json({ message: "Niche is required. Please enter your content niche." });
      }
      if (!platform || !platform.trim()) {
        return res.status(400).json({ message: "Platform is required. Please select your main platform." });
      }
      if (!platformProfileUrl || !platformProfileUrl.trim()) {
        return res.status(400).json({ message: "Profile URL is required. Please enter your profile link." });
      }
    }

    // Check if verified user exists with this email or username
    const emailExists = await User.findOne({ email });
    if (emailExists && emailExists.isVerified !== false) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists && usernameExists.isVerified !== false) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    if (emailExists) {
      // Overwrite unverified user registration details
      user = emailExists;
      user.username = username.trim();
      user.name = name || username.trim();
      user.password = hashedPassword;
      user.niche = niche || "Brand";
      user.platform = platform || "None";
      user.platformProfileUrl = platformProfileUrl || "";
      user.followers = followers || 0;
      user.role = email === ADMIN_EMAIL ? "admin" : (role === "brand" ? "brand" : "creator");
      user.isVerified = true;
      user.otp = "";
      user.otpExpiry = null;
    } else {
      user = new User({
        username: username.trim(),
        name: name || username.trim(),
        email,
        password: hashedPassword,
        niche,
        platform,
        platformProfileUrl,
        followers: followers || 0,
        role: email === ADMIN_EMAIL ? "admin" : (role === "brand" ? "brand" : "creator"),
        isVerified: true,
        otp: "",
        otpExpiry: null,
      });
    }

    await user.save();

    return res.status(200).json({
      message: "Registration successful!",
      token: signToken(user._id, user.email),
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        niche: user.niche,
        platform: user.platform,
        platformProfileUrl: user.platformProfileUrl,
        followers: user.followers,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const verifySignupOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified." });
    }

    // Bypass/testing otp of 123456
    const isBypass = (email === ADMIN_EMAIL && otp === "123456");

    if (!isBypass) {
      if (user.otp !== otp || new Date() > user.otpExpiry) {
        return res.status(400).json({ message: "Invalid or expired OTP." });
      }
    }

    user.isVerified = true;
    user.otp = "";
    user.otpExpiry = null;
    await user.save();

    return res.json({
      token: signToken(user._id, user.email),
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        niche: user.niche,
        platform: user.platform,
        platformProfileUrl: user.platformProfileUrl,
        followers: user.followers,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // ── Admin shortcut ──
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      let adminUser = await User.findOne({ email: ADMIN_EMAIL });
      if (!adminUser) {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        adminUser = await User.create({
          username: "admin",
          name: "Admin",
          email: ADMIN_EMAIL,
          password: hashedPassword,
          niche: "Administration",
          platform: "All",
          platformProfileUrl: "",
          followers: 0,
          role: "admin",
          isVerified: true,
        });
      } else {
        let updated = false;
        if (adminUser.role !== "admin") {
          adminUser.role = "admin";
          updated = true;
        }
        if (!adminUser.isVerified) {
          adminUser.isVerified = true;
          updated = true;
        }
        if (updated) {
          await adminUser.save();
        }
      }

      return res.json({
        token: signToken(adminUser._id, adminUser.email),
        user: {
          id: adminUser._id,
          username: adminUser.username,
          name: adminUser.name,
          email: adminUser.email,
          niche: adminUser.niche,
          platform: adminUser.platform,
          platformProfileUrl: adminUser.platformProfileUrl,
          followers: adminUser.followers,
          role: adminUser.role,
        },
      });
    }

    // ── Normal user login ──
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    // Ensure user is verified now that OTP is removed
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    return res.json({
      token: signToken(user._id, user.email),
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        niche: user.niche,
        platform: user.platform,
        platformProfileUrl: user.platformProfileUrl,
        followers: user.followers,
        role: user.role || "user",
      },
    });
  } catch (error) {
    next(error);
  }
};

const verifyLoginOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const isBypass = (email === ADMIN_EMAIL && otp === "123456");

    if (!isBypass) {
      if (user.otp !== otp || new Date() > user.otpExpiry) {
        return res.status(400).json({ message: "Invalid or expired OTP." });
      }
    }

    user.otp = "";
    user.otpExpiry = null;
    await user.save();

    return res.json({
      token: signToken(user._id, user.email),
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        niche: user.niche,
        platform: user.platform,
        platformProfileUrl: user.platformProfileUrl,
        followers: user.followers,
        role: user.role || "user",
      },
    });
  } catch (error) {
    next(error);
  }
};

const resendOTP = async (req, res, next) => {
  try {
    const { email, type } = req.body; // type: "signup" | "login"
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTP(user.email, otp, type === "login" ? "login" : "verification");

    return res.json({ message: "A new OTP has been sent to your email." });
  } catch (error) {
    next(error);
  }
};

const profile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/update-stats  (creator apne followers, likes, views set kare)
const updateProfile = async (req, res, next) => {
  try {
    const { followers, following, posts, totalLikes, totalViews, avgEngagement, bio, profilePicture, platformProfileUrl, niche, platform, name } = req.body;
    const updates = {};
    if (followers !== undefined) updates.followers = Number(followers) || 0;
    if (following !== undefined) updates.following = Number(following) || 0;
    if (posts !== undefined) updates.posts = Number(posts) || 0;
    if (totalLikes !== undefined) updates.totalLikes = Number(totalLikes) || 0;
    if (totalViews !== undefined) updates.totalViews = Number(totalViews) || 0;
    if (avgEngagement !== undefined) updates.avgEngagement = avgEngagement;
    if (bio !== undefined) updates.bio = bio;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;
    if (platformProfileUrl !== undefined) updates.platformProfileUrl = platformProfileUrl;
    if (niche !== undefined) updates.niche = niche;
    if (platform !== undefined) updates.platform = platform;
    if (name !== undefined) updates.name = name;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password -otp -otpExpiry");
    return res.json({ message: "Profile updated", user });
  } catch (error) {
    next(error);
  }
};

module.exports = { signup, verifySignupOTP, login, verifyLoginOTP, resendOTP, profile, updateProfile };

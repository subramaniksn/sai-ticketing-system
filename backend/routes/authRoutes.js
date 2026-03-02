const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../db");
const bcrypt = require("bcrypt"); // ← Make sure this is installed

// LOGIN ROUTE (already updated)
router.post("/login", async (req, res) => {
  try {
    console.log("Login attempt:", req.body.email);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const result = await pool.query(
      `SELECT * FROM "Users" WHERE "Email" = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ msg: "Invalid Credentials" });
    }

    const user = result.rows[0];

    // Check default password OR first login flag
    const isDefaultPassword = user.Password === "12345";
    if (isDefaultPassword || user.IsFirstLogin === true) {
      return res.json({
        firstTimeLogin: true,
        message: "Please set new password for first login",
        user: {
          userId: user.UserID,
          email: user.Email,
          role: user.Role
        }
      });
    }

    // Normal login
    const token = jwt.sign(
      { id: user.UserID, email: user.Email, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token: token,
      role: user.Role,
      email: user.Email
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ msg: "Login failed" });
  }
});

// 🔥 NEW SET PASSWORD ROUTE (THIS WAS MISSING!)
router.post("/set-password", async (req, res) => {
  try {
    console.log("Set password request:", req.body); // Debug log
    
    const { userId, email, newPassword } = req.body;

    if (!userId || !email || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ msg: "Valid password (6+ chars) required" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    const result = await pool.query(
      `UPDATE "Users" 
       SET "Password" = $1, "IsFirstLogin" = false 
       WHERE "UserID" = $2 AND "Email" = $3 
       RETURNING "UserID"`,
      [hashedPassword, userId, email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

    console.log("Password updated for user:", userId); // Debug log
    res.json({ 
      success: true, 
      message: "Password updated successfully! Please login again." 
    });

  } catch (err) {
    console.error("PASSWORD UPDATE ERROR:", err); // This will show exact error
    res.status(500).json({ msg: "Failed to update password" });
  }
});

module.exports = router;

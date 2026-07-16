const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const { createUserController } = require("../controllers/userController");

const router = express.Router();
const { createUser, getUsers } = createUserController({ pool });

async function verifyStoredPassword(password, storedPassword) {
  if (storedPassword === "12345") return password === "12345";
  if (typeof storedPassword !== "string" || !storedPassword.startsWith("$2")) return false;
  try {
    return await bcrypt.compare(password, storedPassword);
  } catch (err) {
    return false;
  }
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const result = await pool.query(
      `SELECT * FROM "Users" WHERE lower(btrim("Email")) = lower($1)`,
      [email.trim()]
    );
    if (!result.rows.length) {
      return res.status(401).json({ msg: "Invalid Credentials" });
    }

    const user = result.rows[0];
    if (!await verifyStoredPassword(password, user.Password)) {
      return res.status(401).json({ msg: "Invalid Credentials" });
    }

    const isDefaultPassword = user.Password === "12345";
    if (isDefaultPassword || user.IsFirstLogin === true) {
      const firstLoginToken = jwt.sign(
        { purpose: "first-login", id: user.UserID, email: user.Email },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res.json({
        firstTimeLogin: true,
        firstLoginToken,
        message: "Please set new password for first login",
        user: {
          userId: user.UserID,
          email: user.Email,
          role: user.Role
        }
      });
    }

    const token = jwt.sign(
      { id: user.UserID, email: user.Email, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    return res.json({ token, role: user.Role, email: user.Email });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ msg: "Login failed" });
  }
});

router.post("/set-password", async (req, res) => {
  try {
    const { firstLoginToken, newPassword } = req.body;
    if (!firstLoginToken || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({ msg: "Valid password (8 to 72 characters) required" });
    }

    let firstLoginUser;
    try {
      firstLoginUser = jwt.verify(firstLoginToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ msg: "First-login session expired. Please login again." });
    }
    if (firstLoginUser.purpose !== "first-login") {
      return res.status(401).json({ msg: "Invalid first-login session" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE "Users"
       SET "Password" = $1, "IsFirstLogin" = false
       WHERE "UserID" = $2 AND "Email" = $3
         AND ("IsFirstLogin" = true OR "Password" = '12345')
       RETURNING "UserID"`,
      [hashedPassword, firstLoginUser.id, firstLoginUser.email]
    );
    if (!result.rowCount) {
      return res.status(404).json({ msg: "First-login request is no longer valid" });
    }

    return res.json({
      success: true,
      message: "Password updated successfully! Please login again."
    });
  } catch (err) {
    console.error("PASSWORD UPDATE ERROR:", err);
    return res.status(500).json({ msg: "Failed to update password" });
  }
});

router.get("/users", verifyToken, getUsers);
router.post("/users", verifyToken, createUser);

module.exports = router;
module.exports.verifyStoredPassword = verifyStoredPassword;

const bcrypt = require("bcrypt");
const { validateNewUser, validateTemporaryPassword } = require("../validation/userValidation");

function isDispatcher(req) {
  return req.user?.role === "Dispatcher";
}

function createUserController({ pool, passwordHasher = bcrypt }) {
  async function getUsers(req, res) {
    if (!isDispatcher(req)) {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    try {
      const result = await pool.query(
        `SELECT "UserID", "Role", "Email", "Phone", "IsFirstLogin"
         FROM "Users"
         ORDER BY "Role", lower("Email")`
      );
      res.set("Cache-Control", "no-store");
      return res.json(result.rows);
    } catch (err) {
      console.error("Load users error:", err);
      return res.status(500).json({ msg: "Failed to load users" });
    }
  }

  async function createUser(req, res) {
    if (!isDispatcher(req)) {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    const { data, errors } = validateNewUser(req.body);
    if (errors.length) {
      return res.status(400).json({ msg: errors[0], errors });
    }

    try {
      const duplicate = await pool.query(
        `SELECT "UserID"
         FROM "Users"
         WHERE lower(btrim("Email")) = lower($1)
         LIMIT 1`,
        [data.email]
      );
      if (duplicate.rows.length) {
        return res.status(409).json({ msg: "A user with this email already exists" });
      }

      const passwordHash = await passwordHasher.hash(data.temporaryPassword, 10);
      const result = await pool.query(
        `INSERT INTO "Users" ("Role", "Email", "Password", "IsFirstLogin", "Phone")
         VALUES ($1, $2, $3, true, $4)
         RETURNING "UserID", "Role", "Email", "Phone", "IsFirstLogin"`,
        [data.role, data.email, passwordHash, data.phone]
      );

      return res.status(201).json({
        msg: "User created successfully",
        user: result.rows[0]
      });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ msg: "A user with this email already exists" });
      }
      console.error("Create user error:", {
        code: err.code,
        message: err.message,
        column: err.column,
        constraint: err.constraint
      });
      if (err.code === "23502" && err.column === "UserID") {
        return res.status(500).json({
          msg: "User database setup is incomplete. Run npm run setup:user-security."
        });
      }
      return res.status(500).json({ msg: "Failed to create user" });
    }
  }

  async function resetUserPassword(req, res) {
    if (!isDispatcher(req)) {
      return res.status(403).json({ msg: "Only Dispatchers allowed" });
    }

    const userId = Number.parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: "Invalid user ID" });
    }

    const temporaryPassword = req.body?.temporaryPassword;
    const passwordError = validateTemporaryPassword(temporaryPassword);
    if (passwordError) {
      return res.status(400).json({ msg: passwordError });
    }

    try {
      const passwordHash = await passwordHasher.hash(temporaryPassword, 10);
      const result = await pool.query(
        `UPDATE "Users"
         SET "Password" = $1, "IsFirstLogin" = true
         WHERE "UserID" = $2
         RETURNING "UserID", "Role", "Email", "Phone", "IsFirstLogin"`,
        [passwordHash, userId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ msg: "User not found" });
      }

      return res.json({
        msg: "Temporary password reset successfully",
        user: result.rows[0]
      });
    } catch (err) {
      console.error("Reset user password error:", {
        code: err.code,
        message: err.message,
        column: err.column,
        constraint: err.constraint
      });
      return res.status(500).json({ msg: "Failed to reset user password" });
    }
  }

  return { createUser, getUsers, resetUserPassword };
}

module.exports = { createUserController };

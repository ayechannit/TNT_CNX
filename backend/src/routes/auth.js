const express = require("express");
const { login, me } = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, me);

module.exports = router;

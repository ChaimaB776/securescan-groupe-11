const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Routes publiques
router.post("/register", authController.register);
router.post("/login", authController.login);

// Routes protégées
router.get("/me", authMiddleware, authController.getMe);

module.exports = router;

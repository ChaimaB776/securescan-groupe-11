const express = require("express");
const scoreController = require("../controllers/scoreController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Routes protégées par authentification
router.post("/calculate", authMiddleware, scoreController.calculateAndSaveScore);
router.get("/dashboard/all", authMiddleware, scoreController.getDashboard);
router.get("/:projectId/history", authMiddleware, scoreController.getScoreHistory);
router.get("/:projectId", authMiddleware, scoreController.getScore);

module.exports = router;

const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const projectController = require("../controllers/projectController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Configuration de multer
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      cb(null, "upload-" + Date.now() + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
});

// Routes protégées par authentification
router.post("/fetch", authMiddleware, upload.single("project"), projectController.fetchProject);
router.get("/user/projects", authMiddleware, projectController.getProjectsByUser);
router.get("/", authMiddleware, projectController.listProjects);
router.get("/:projectId/pdf/download", authMiddleware, projectController.downloadPDF);
router.get("/:projectId", authMiddleware, projectController.getProject);
router.delete("/:projectId", authMiddleware, projectController.deleteProject);
module.exports = router;
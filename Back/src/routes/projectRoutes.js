const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const projectController = require("../controllers/projectController");

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

// Routes
router.post("/fetch", upload.single("project"), projectController.fetchProject);
router.get("/", projectController.listProjects);
router.get("/:projectId", projectController.getProject);
router.delete("/:projectId", projectController.deleteProject);

module.exports = router;



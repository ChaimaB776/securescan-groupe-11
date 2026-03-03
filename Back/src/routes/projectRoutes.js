const express = require("express");
const fileUpload = require("express-fileupload");
const projectController = require("../controllers/projectController");

const router = express.Router();

// Middleware pour les uploads
router.use(fileUpload());

// Routes
router.post("/fetch", projectController.fetchProject);
router.post("/clone", projectController.cloneProject);
router.get("/", projectController.listProjects);
router.get("/:projectId", projectController.getProject);
router.delete("/:projectId", projectController.deleteProject);

module.exports = router;



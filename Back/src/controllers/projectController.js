const projectService = require("../services/projectService");


// Récupère les projets de l'utilisateur
// GET /api/projects/user/projects
const getProjectsByUser = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: "Utilisateur non authentifié" 
      });
    }

    const projects = await projectService.getProjectsByUserId(userId);

    res.json({
      success: true,
      count: projects.length,
      projects: projects,
    });
  } catch (error) {
    console.error("Erreur getProjectsByUser:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Récupère un projet via Git URL ou ZIP upload
// POST /api/projects/fetch
const fetchProject = async (req, res) => {
  try {
    const { gitUrl, libelle_project } = req.body;
    const uploadedFile = req.file;
    const userId = req.userId;

    console.log("Fetch request - gitUrl:", gitUrl, "file:", !!uploadedFile, "userId:", userId, "libelle:", libelle_project);

    // Cas 1: URL Git
    if (gitUrl) {
      if (!gitUrl.toLowerCase().includes("git")) {
        return res.status(400).json({ 
          success: false,
          error: "URL Git invalide" 
        });
      }
      const projectInfo = await projectService.cloneGitRepository(gitUrl, userId, libelle_project);
      return res.status(201).json({
        success: true,
        message: "Projet Git cloné",
        project: projectInfo,
      });
    }

    // Cas 2: Fichier ZIP uploadé
    if (uploadedFile) {
      if (!uploadedFile.originalname.toLowerCase().endsWith(".zip")) {
        return res.status(400).json({ 
          success: false,
          error: "Fichier doit être un .zip" 
        });
      }
      
      const projectInfo = await projectService.extractUploadedZip(uploadedFile.path, true, userId, libelle_project);
      
      return res.status(201).json({
        success: true,
        message: "ZIP uploadé et extrait",
        project: projectInfo,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Fournis: gitUrl ou un fichier .zip",
    });
  } catch (error) {
    console.error("Erreur fetchProject:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// Récupère les infos d'un projet
// GET /api/projects/:projectId
const getProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!projectId) {
      return res.status(400).json({ 
        success: false,
        error: "projectId est requis" 
      });
    }

    const projectInfo = await projectService.getProjectWithResults(projectId, userId);

    res.json({
      success: true,
      project: projectInfo,
    });
  } catch (error) {
    console.error("Erreur getProject:", error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
};

// Liste tous les projets en cache
// GET /api/projects
const listProjects = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Non authentifié"
      });
    }

    const pool = require("../config/database");
    const connection = await pool.getConnection();
    
    // Récupérer tous les scans de cet utilisateur depuis la BDD
    const [projects] = await connection.query(
      `SELECT id, user_id, project_name, libelle_project, score, pdf_report, created_at as createdAt
       FROM scans 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    connection.release();

    res.json({
      success: true,
      count: projects.length,
      projects: projects.map(p => ({
        id: p.id,
        project_name: p.project_name,
        libelle_project: p.libelle_project,
        score: p.score,
        pdf_report: p.pdf_report,
        createdAt: new Date(p.createdAt).toLocaleDateString('fr-FR')
      }))
    });
  } catch (error) {
    console.error("Erreur listProjects:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Supprime un projet du cache
// DELETE /api/projects/:projectId
const deleteProject = (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ 
        success: false,
        error: "projectId est requis" 
      });
    }

    const deleted = projectService.deleteProject(projectId);

    if (deleted) {
      res.json({
        success: true,
        message: "Projet supprimé",
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }
  } catch (error) {
    console.error("Erreur deleteProject:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Télécharge le PDF du rapport de scan
// GET /api/projects/:projectId/pdf/download
const downloadPDF = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId requis" });
    }

    const project = await projectService.getProjectWithResults(projectId, userId);
    
    if (!project.pdf_report) {
      return res.status(404).json({ success: false, error: "Aucun PDF disponible" });
    }

    const fs = require("fs");
    const path = require("path");
    const pdfPath = path.join(__dirname, `../../reports/${project.pdf_report}`);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ success: false, error: "Fichier PDF non trouvé" });
    }

    res.download(pdfPath, `SecureScan-${project.libelle_project}.pdf`);
  } catch (error) {
    console.error("Erreur downloadPDF:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  fetchProject,
  getProject,
  listProjects,
  deleteProject,
  getProjectsByUser,
  downloadPDF,
};

const projectService = require("../services/projectService");



// Récupère un projet via Git URL ou ZIP upload
// POST /api/projects/fetch
const fetchProject = async (req, res) => {
  try {
    const { gitUrl } = req.body;
    const uploadedFile = req.file;

    console.log("Fetch request - gitUrl:", gitUrl, "file:", !!uploadedFile);

    // Cas 1: URL Git
    if (gitUrl) {
      if (!gitUrl.toLowerCase().includes("git")) {
        return res.status(400).json({ 
          success: false,
          error: "URL Git invalide" 
        });
      }
      const projectInfo = await projectService.cloneGitRepository(gitUrl);
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
      
      const projectInfo = await projectService.extractUploadedZip(uploadedFile.path, true);
      
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
const getProject = (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ 
        success: false,
        error: "projectId est requis" 
      });
    }

    const projectInfo = projectService.getProjectInfo(projectId);

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
const listProjects = (req, res) => {
  try {
    const projects = projectService.listProjects();

    res.json({
      success: true,
      count: projects.length,
      projects: projects,
    });
  } catch (error) {
    console.error("Erreur listProjects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
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

module.exports = {
  fetchProject,
  getProject,
  listProjects,
  deleteProject,
};

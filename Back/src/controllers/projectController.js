const projectService = require("../services/projectService");

  
// Récupère un projet via Git URL, ZIP URL ou upload
// POST /api/projects/fetch
  
const fetchProject = async (req, res) => {
  try {
    const { gitUrl, zipUrl } = req.body;
    const uploadedFile = req.files?.project;

    console.log("Fetch request - gitUrl:", gitUrl, "zipUrl:", zipUrl, "file:", !!uploadedFile);

    // URL Git
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

    // URL ZIP
    if (zipUrl) {
      if (!zipUrl.toLowerCase().endsWith(".zip")) {
        return res.status(400).json({ 
          success: false,
          error: "URL doit pointer vers un fichier .zip" 
        });
      }
      const projectInfo = await projectService.downloadAndExtractZip(zipUrl);
      return res.status(201).json({
        success: true,
        message: "ZIP téléchargé et extrait",
        project: projectInfo,
      });
    }

    // Fichier ZIP uploadé
    if (uploadedFile) {
      if (!uploadedFile.name.toLowerCase().endsWith(".zip")) {
        return res.status(400).json({ 
          success: false,
          error: "Fichier doit être un .zip" 
        });
      }
      const projectInfo = await projectService.extractUploadedZip(uploadedFile.data);
      return res.status(201).json({
        success: true,
        message: "ZIP uploadé et extrait",
        project: projectInfo,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Fournis: gitUrl, zipUrl ou un fichier .zip",
    });
  } catch (error) {
    console.error("Erreur fetchProject:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// Clone un repository Git
// POST /api/projects/clone
const cloneProject = async (req, res) => {
  try {
    const { gitUrl } = req.body;

    if (!gitUrl) {
      return res.status(400).json({ 
        success: false,
        error: "gitUrl est requis" 
      });
    }

    console.log(`Clonage du repo: ${gitUrl}`);
    const projectInfo = await projectService.cloneGitRepository(gitUrl);

    res.status(201).json({
      success: true,
      message: "Projet cloné avec succès",
      project: projectInfo,
    });
  } catch (error) {
    console.error("Erreur cloneProject:", error);
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
  cloneProject,
  getProject,
  listProjects,
  deleteProject,
};

const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { exec } = require("child_process");
const { promisify } = require("util");
const unzipper = require("unzipper");
const { detectProjectType, createProjectIndex } = require("../utils/projectHelper");

const execPromise = promisify(exec);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");

// Créer le répertoire uploads s'il n'existe pas
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}


// Clone un repository Git
async function cloneGitRepository(gitUrl) {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);

    console.log(`Clonage du repo: ${gitUrl} vers ${projectPath}`);

    await execPromise(`git clone ${gitUrl} ${projectPath}`);

    const projectInfo = {
      id: projectId,
      type: "git",
      source: gitUrl,
      path: projectPath,
      createdAt: new Date(),
      projectType: detectProjectType(projectPath),
      index: createProjectIndex(projectPath),
    };

    return projectInfo;
  } catch (error) {
    throw new Error(`Erreur clonage Git: ${error.message}`);
  }
}


/**
 * Extrait un fichier ZIP uploadé
 * @param {string} zipFilePath - Chemin vers le fichier ZIP
 * @param {boolean} isFromMulter - True si le fichier vient de multer
 */
async function extractUploadedZip(zipFilePath, isFromMulter = false) {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);

    console.log(`Extraction du ZIP uploadé vers: ${projectPath}`);

    // Créer le dossier de destination
    fs.mkdirSync(projectPath, { recursive: true });

    // Extraire le ZIP
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: projectPath }))
        .on("close", resolve)
        .on("error", reject);
    });

    console.log(`ZIP extrait avec succès`);

    // Nettoyer le fichier ZIP temporaire si vraiment nécessaire
    if (!isFromMulter && fs.existsSync(zipFilePath)) {
      try {
        fs.unlinkSync(zipFilePath);
      } catch (err) {
        console.warn("Impossible de supprimer le fichier temporaire:", err.message);
      }
    }

    // Retourner les infos
    const projectInfo = {
      id: projectId,
      type: "zip_upload",
      source: "uploaded_zip",
      path: projectPath,
      createdAt: new Date(),
    };

    // Indexation en background
    setImmediate(() => {
      try {
        projectInfo.projectType = detectProjectType(projectPath);
        projectInfo.index = createProjectIndex(projectPath);
        console.log(`ZIP ${projectId} - Indexation terminée`);
      } catch (err) {
        console.warn(`Erreur indexation ZIP ${projectId}:`, err.message);
      }
    });

    return projectInfo;
  } catch (error) {
    throw new Error(`Erreur extraction ZIP: ${error.message}`);
  }
}

// Récupère les infos d'un projet existant
function getProjectInfo(projectId) {
  try {
    const projectPath = path.join(UPLOAD_DIR, projectId);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Projet ${projectId} non trouvé`);
    }

    return {
      id: projectId,
      path: projectPath,
      projectType: detectProjectType(projectPath),
      index: createProjectIndex(projectPath),
    };
  } catch (error) {
    throw new Error(`Erreur récupération infos: ${error.message}`);
  }
}

// Supprime un projet (nettoyage)
function deleteProject(projectId) {
  try {
    const projectPath = path.join(UPLOAD_DIR, projectId);

    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(`Erreur suppression projet: ${error.message}`);
  }
}

// Récupère tous les projets en cache
function listProjects() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return [];
    }

    const projects = fs.readdirSync(UPLOAD_DIR).map((id) => {
      const projectPath = path.join(UPLOAD_DIR, id);
      return {
        id,
        path: projectPath,
        createdAt: fs.statSync(projectPath).birthtime,
      };
    });

    return projects;
  } catch (error) {
    throw new Error(`Erreur listage projets: ${error.message}`);
  }
}

module.exports = {
  cloneGitRepository,
  extractUploadedZip,
  getProjectInfo,
  deleteProject,
  listProjects,
  UPLOAD_DIR,
};


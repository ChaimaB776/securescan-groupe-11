const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { exec } = require("child_process");
const { promisify } = require("util");
const axios = require("axios");
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

// Télécharge et extrait un fichier ZIP depuis une URL
async function downloadAndExtractZip(zipUrl) {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);
    const zipPath = path.join(UPLOAD_DIR, `${projectId}.zip`);

    console.log(`Téléchargement du ZIP: ${zipUrl}`);

    // Télécharger le fichier ZIP
    const response = await axios({
      method: "get",
      url: zipUrl,
      responseType: "stream",
    });

    // Sauvegarder le fichier ZIP
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(zipPath);
      response.data.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    console.log(`Extraction du ZIP vers: ${projectPath}`);

    // Créer le dossier de destination
    fs.mkdirSync(projectPath, { recursive: true });

    // Extraire le ZIP
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: projectPath }))
        .on("close", resolve)
        .on("error", reject);
    });

    // Nettoyer le fichier ZIP
    fs.unlinkSync(zipPath);

    const projectInfo = {
      id: projectId,
      type: "zip",
      source: zipUrl,
      path: projectPath,
      createdAt: new Date(),
      projectType: detectProjectType(projectPath),
      index: createProjectIndex(projectPath),
    };

    return projectInfo;
  } catch (error) {
    throw new Error(`Erreur téléchargement ZIP: ${error.message}`);
  }
}

// Extrait un fichier ZIP uploadé
async function extractUploadedZip(zipFile) {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);

    console.log(`Extraction du ZIP uploadé vers: ${projectPath}`);

    // Créer le dossier de destination
    fs.mkdirSync(projectPath, { recursive: true });

    // Extraire le ZIP
    await new Promise((resolve, reject) => {
      zipFile
        .pipe(unzipper.Extract({ path: projectPath }))
        .on("close", resolve)
        .on("error", reject);
    });

    const projectInfo = {
      id: projectId,
      type: "zip_upload",
      source: "uploaded_zip",
      path: projectPath,
      createdAt: new Date(),
      projectType: detectProjectType(projectPath),
      index: createProjectIndex(projectPath),
    };

    return projectInfo;
  } catch (error) {
    throw new Error(`Erreur extraction ZIP: ${error.message}`);
  }
}

// Crée un dossier depuis des fichiers uploadés
async function createProjectFromUpload(files, projectName = null) {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);

    fs.mkdirSync(projectPath, { recursive: true });

    // files contient les fichiers uploadés
    if (Array.isArray(files)) {
      for (const file of files) {
        const filePath = path.join(projectPath, file.filename);
        const dir = path.dirname(filePath);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, file.data);
      }
    }

    const projectInfo = {
      id: projectId,
      type: "upload",
      source: projectName || "uploaded",
      path: projectPath,
      createdAt: new Date(),
      projectType: detectProjectType(projectPath),
      index: createProjectIndex(projectPath),
    };

    return projectInfo;
  } catch (error) {
    throw new Error(`Erreur création projet: ${error.message}`);
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
  downloadAndExtractZip,
  extractUploadedZip,
  createProjectFromUpload,
  getProjectInfo,
  deleteProject,
  listProjects,
  UPLOAD_DIR,
};


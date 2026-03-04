const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { exec } = require("child_process");
const { promisify } = require("util");
const unzipper = require("unzipper");
const { detectProjectType, createProjectIndex, countFiles } = require("../utils/projectHelper");
const pool = require("../config/database");
const scanService = require("./scanService");
const { mapToOWASP } = require("../utils/owaspMapper");

const execPromise = promisify(exec);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");

// Créer le répertoire uploads s'il n'existe pas
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Lance les scans en background et met à jour la BDD
 * @param {string} projectId - ID du projet
 * @param {string} projectPath - Chemin du projet
 * @param {number} userId - ID utilisateur
 * @param {string} sourceType - Type de source: 'git' ou 'zip'
 */
async function runScansInBackground(projectId, projectPath, userId, sourceType = 'git') {
  try {
    console.log(`\n[SCAN] Démarrage des scans pour ${projectId} (${sourceType})`);
    
    // Lancer tous les scanners (TruffleHog seulement si Git)
    const vulnerabilities = await scanService.scanProject(projectPath, sourceType);
    
    // Ajouter le mapping OWASP à chaque vulnérabilité
    const vulnsWithOWASP = vulnerabilities.map(vuln => ({
      ...vuln,
      owasp: mapToOWASP(vuln.title, vuln.tool)
    }));
    
    // Calculer le score
    const score = scanService.calculateScore(vulnsWithOWASP);
    
    console.log(`[SCAN] Résultats: ${vulnsWithOWASP.length} vulnérabilité(s), Score: ${score}/100`);
    
    // Mettre à jour la BDD
    if (userId) {
      const connection = await pool.getConnection();
      
      // D'abord récupérer les données actuelles pour préserver les champs
      const [existingRows] = await connection.query(
        `SELECT results FROM scans 
         WHERE user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(results, '$.id')) = ?`,
        [userId, projectId]
      );
      
      let resultsStructure = {
        id: projectId,
        vulnerabilities: vulnsWithOWASP
      };
      
      // Fusionner avec les données existantes pour préserver type, fileCount, projectType
      if (existingRows.length > 0) {
        const existingData = typeof existingRows[0].results === 'string' 
          ? JSON.parse(existingRows[0].results) 
          : existingRows[0].results;
        
        resultsStructure = {
          ...existingData,
          id: projectId,
          vulnerabilities: vulnsWithOWASP
        };
      }
      
      await connection.query(
        `UPDATE scans SET results = ?, score = ? 
         WHERE user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(results, '$.id')) = ?`,
        [JSON.stringify(resultsStructure), score, userId, projectId]
      );
      connection.release();
      console.log(`[SCAN] Résultats sauvegardés en BDD`);
    }
  } catch (err) {
    console.error(`[SCAN ERROR] ${err.message}`);
  }
}


// Clone un repository Git
async function cloneGitRepository(gitUrl, userId, libelle_project) {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);

    console.log(`Clonage du repo: ${gitUrl} vers ${projectPath}`);

    await execPromise(`git clone ${gitUrl} ${projectPath}`);

    const fileCount = countFiles(projectPath);
    const projectType = detectProjectType(projectPath);

    // Sauvegarder en BDD
    if (userId) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO scans (user_id, project_name, libelle_project, results, score) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, gitUrl, libelle_project, JSON.stringify({ 
          id: projectId, 
          type: 'git', 
          fileCount, 
          projectType 
        }), 0]
      );
      connection.release();
    }

    const projectInfo = {
      id: projectId,
      type: "git",
      project_name: gitUrl,
      libelle_project: libelle_project,
      path: projectPath,
      fileCount: fileCount,
      createdAt: new Date(),
      projectType: projectType,
      index: createProjectIndex(projectPath),
    };

    // Lancer les scans en background (ne pas bloquer la réponse)
    setImmediate(() => {
      runScansInBackground(projectId, projectPath, userId, 'git');
    });

    return projectInfo;
  } catch (error) {
    throw new Error(`Erreur clonage Git: ${error.message}`);
  }
}


// Extrait un fichier ZIP uploadé
function extractUploadedZip(zipFilePath, isFromMulter = false, userId = null, libelle_project = null) {
  return new Promise((resolveMain) => {
    const projectId = uuidv4();
    const projectPath = path.join(UPLOAD_DIR, projectId);

    console.log(`Extraction du ZIP uploadé vers: ${projectPath}`);

    // Créer le dossier de destination
    fs.mkdirSync(projectPath, { recursive: true });

    // Retourner immédiatement les infos basiques
    const projectInfo = {
      id: projectId,
      type: "zip_upload",
      project_name: `ZIP-${projectId}`,
      libelle_project: libelle_project,
      path: projectPath,
      fileCount: 0,
      createdAt: new Date(),
    };

    // Sauvegarder en BDD immédiatement
    if (userId) {
      pool.getConnection().then(async (connection) => {
        try {
          await connection.query(
            `INSERT INTO scans (user_id, project_name, libelle_project, results, score) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, `ZIP-${projectId}`, libelle_project, JSON.stringify({ 
              id: projectId, 
              type: 'zip_upload',
              fileCount: 0
            }), 0]
          );
        } catch (err) {
          console.error("Erreur sauvegarde en BDD:", err.message);
        } finally {
          connection.release();
        }
      });
    }

    resolveMain(projectInfo);

    // Extraction en vrai background
    setImmediate(() => {
      fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: projectPath }))
        .on("close", () => {
          console.log(`ZIP ${projectId} extrait avec succès`);
          
          // Indexation après extraction
          try {
            const fileCount = countFiles(projectPath);
            projectInfo.projectType = detectProjectType(projectPath);
            projectInfo.index = createProjectIndex(projectPath);
            projectInfo.fileCount = fileCount;
            console.log(`ZIP ${projectId} - Indexation terminée (${fileCount} fichiers)`);

            // Mettre à jour la BDD avec les infos finales
            if (userId) {
              pool.getConnection().then(async (connection) => {
                try {
                  await connection.query(
                    `UPDATE scans SET results = ? WHERE user_id = ? 
                     AND JSON_EXTRACT(results, '$.id') = ?`,
                    [JSON.stringify(projectInfo), userId, projectId]
                  );
                } catch (err) {
                  console.error("Erreur update BDD:", err.message);
                } finally {
                  connection.release();
                }
              });
            }

            // Lancer les scans en background
            runScansInBackground(projectId, projectPath, userId, 'zip');
          } catch (err) {
            console.warn(`Erreur indexation ZIP ${projectId}:`, err.message);
          }

          // Nettoyer le fichier ZIP temporaire après extraction
          if (!isFromMulter && fs.existsSync(zipFilePath)) {
            try {
              fs.unlinkSync(zipFilePath);
              console.log(`Fichier ZIP ${projectId} supprimé`);
            } catch (err) {
              console.warn("Impossible de supprimer le fichier temporaire:", err.message);
            }
          }
        })
        .on("error", (err) => {
          console.error(`Erreur extraction ZIP ${projectId}:`, err.message);
        });
    });
  });
}

// Récupère les infos d'un projet existant
function getProjectInfo(projectId) {
  try {
    const projectPath = path.join(UPLOAD_DIR, projectId);

    if (!fs.existsSync(projectPath)) {
      throw new Error(`Projet ${projectId} non trouvé`);
    }

    // Déterminer le type: Git si .git existe, sinon ZIP
    const hasGitFolder = fs.existsSync(path.join(projectPath, ".git"));
    const projectType = detectProjectType(projectPath);
    const stats = fs.statSync(projectPath);

    return {
      id: projectId,
      type: hasGitFolder ? "git" : "zip_upload",
      path: projectPath,
      fileCount: countFiles(projectPath),
      projectType: projectType,
      createdAt: stats.birthtime,
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
        fileCount: countFiles(projectPath),
        createdAt: fs.statSync(projectPath).birthtime,
      };
    });

    return projects;
  } catch (error) {
    throw new Error(`Erreur listage projets: ${error.message}`);
  }
}

// Récupère les projets d'un utilisateur
async function getProjectsByUserId(userId) {
  try {
    const connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      "SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    
    connection.release();

    return rows.map((row) => {
      const results = typeof row.results === 'string' ? JSON.parse(row.results) : row.results;
      return {
        id: results.id,
        type: results.type,
        project_name: row.project_name,
        libelle_project: row.libelle_project,
        fileCount: results.fileCount,
        projectType: results.projectType,
        score: row.score,
        createdAt: row.created_at,
      };
    });
  } catch (error) {
    console.error("❌ Erreur récupération projets utilisateur:", error.message);
    return [];
  }
}

module.exports = {
  cloneGitRepository,
  extractUploadedZip,
  getProjectInfo,
  deleteProject,
  listProjects,
  getProjectsByUserId,
  UPLOAD_DIR,
};

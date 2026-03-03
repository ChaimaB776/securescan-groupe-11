const fs = require("fs");
const path = require("path");


// Récupère tous les fichiers d'un projet de manière récursive

function getProjectFiles(projectPath, ignorePatterns = []) {
  const files = [];

  function walkDir(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(projectPath, fullPath);

      // Ignorer les dossiers courants
      if (
        item === "node_modules" ||
        item === ".git" ||
        item === "dist" ||
        item === "build" ||
        item === ".env"
      ) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else {
        files.push({
          path: relativePath,
          fullPath: fullPath,
          name: item,
        });
      }
    }
  }

  walkDir(projectPath);
  return files;
}


// Lit le contenu d'un fichier
function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error(`Erreur lecture fichier ${filePath}:`, error.message);
    return null;
  }
}


// Détecte le type de projet
function detectProjectType(projectPath) {
  const files = fs.readdirSync(projectPath);
  const projectInfo = {
    type: "unknown",
    files: files,
    hasPackageJson: files.includes("package.json"),
    hasPythonFiles: files.some((f) => f.endsWith(".py")),
    hasJavaFiles: files.some((f) => f.endsWith(".java")),
    hasGoFiles: files.some((f) => f.endsWith(".go")),
  };

  if (projectInfo.hasPackageJson) projectInfo.type = "nodejs";
  if (projectInfo.hasPythonFiles) projectInfo.type = "python";
  if (projectInfo.hasJavaFiles) projectInfo.type = "java";
  if (projectInfo.hasGoFiles) projectInfo.type = "go";

  return projectInfo;
}


// Crée un index des fichiers du projet
function createProjectIndex(projectPath) {
  const files = getProjectFiles(projectPath);
  const index = {
    totalFiles: files.length,
    byExtension: {},
    files: files,
  };

  for (const file of files) {
    const ext = path.extname(file.name) || "noext";
    if (!index.byExtension[ext]) {
      index.byExtension[ext] = 0;
    }
    index.byExtension[ext]++;
  }

  return index;
}

module.exports = {
  getProjectFiles,
  readFileContent,
  detectProjectType,
  createProjectIndex,
};

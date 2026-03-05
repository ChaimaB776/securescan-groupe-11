const express = require("express");
const { exec,spawn } = require("child_process");
const util = require("util");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");
const unzipper = require("unzipper");
const simpleGit = require("simple-git");
const { calculateScore } = require("./src/services/scanService");
const { mapToOWASP } = require("./src/utils/owaspMapper");

const execAsync = util.promisify(exec);
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "SecureScan"
});

db.connect(err => {
  if (err) console.error("Erreur connexion BDD:", err);
  else console.log("Connecté à MySQL ✅");
});


// Multer Upload ZIP
const upload = multer({ dest: "upload/" });

// Fonction scan projet
async function scanProject(REPO_PATH) {
  let allVulnerabilities = [];

  // SEMGREP
  try {
    const { stdout } = await execAsync(`semgrep --config auto "${REPO_PATH}" --json`);
    const parsed = JSON.parse(stdout);
    const results = parsed.results || [];

    const normalized = results.map(vuln => ({
      tool: "Semgrep",
      title: vuln.extra?.message || "Unknown issue",
      severity: (vuln.extra?.severity || "INFO").toUpperCase(),
      file: vuln.path || "Unknown file",
      line: vuln.start?.line || 0,
      owasp: mapToOWASP("Semgrep")
    }));

    allVulnerabilities.push(...normalized);
  } catch (err) {
    console.log("Semgrep error:", err.message);
  }

  // ESLINT
  try {
const { stdout } = await execAsync(
  `npx eslint "${REPO_PATH}" --ext .js -f json --no-config-lookup`,
  { maxBuffer: 1024 * 1024 * 5 }
);

  const results = JSON.parse(stdout);

  results.forEach(fileResult => {
    fileResult.messages.forEach(msg => {
      allVulnerabilities.push({
        tool: "ESLint Security",
        title: msg.message,
        severity: (msg.severity === 2 ? "HIGH" : "MEDIUM"),
        file: fileResult.filePath,
        line: msg.line,
        owasp: mapToOWASP("ESLint Security")
      });
    });
  });

} catch (err) {
  if (err.stdout) {
    const results = JSON.parse(err.stdout);
    results.forEach(fileResult => {
      fileResult.messages.forEach(msg => {
        allVulnerabilities.push({
          tool: "ESLint Security",
          title: msg.message,
          severity: (msg.severity === 2 ? "HIGH" : "MEDIUM"),
          file: fileResult.filePath,
          line: msg.line,
          owasp: mapToOWASP("ESLint Security")
        });
      });
    });
  } else {
    console.log("ESLint real error:", err.message);
  }
}
  // NPM AUDIT
  // NPM AUDIT
try {
  if (fs.existsSync(path.join(REPO_PATH, "package.json"))) {
    const { stdout } = await execAsync(`npm audit --json`, { cwd: REPO_PATH });
    processAudit(stdout);
  }
} catch (err) {
  if (err.stdout) {
    processAudit(err.stdout);
  } else {
    console.log("npm audit real error:", err.message);
  }
}

function processAudit(raw) {
  const audit = JSON.parse(raw);

  if (audit.vulnerabilities) {
    Object.values(audit.vulnerabilities).forEach(vuln => {
      allVulnerabilities.push({
        tool: "npm audit",
        title: vuln.name,
        severity: vuln.severity.toUpperCase(),
        file: vuln.name,
        line: 0,
        owasp: mapToOWASP("npm audit")
      });
    });
  }
}

// TRUFFLEHOG 
async function scanTruffleHog(REPO_PATH) {
  return new Promise((resolve, reject) => {
    let vulnerabilities = [];

    const trufflehog = spawn("trufflehog", [
      "filesystem",   // obligatoire pour scanner un dossier local
      REPO_PATH,
      "--json"
    ]);

    trufflehog.stdout.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);

      lines.forEach(line => {
        try {
          const vuln = JSON.parse(line);

          vulnerabilities.push({
            tool: "TruffleHog",
            title: vuln.reason || "Secret detected",
            severity: "CRITICAL",
            file: vuln.path || "unknown",
            line: vuln.line || 0,
            owasp: mapToOWASP("TruffleHog")
          });
        } catch (err) {
          console.log("JSON parse error:", err.message);
        }
      });
    });

    trufflehog.stderr.on("data", (data) => {
      console.log("TruffleHog stderr:", data.toString());
    });

    trufflehog.on("close", () => resolve(vulnerabilities));
    trufflehog.on("error", reject);
  });
}

  // Usage dans scanProject
  try {
    const truffleResults = await scanTruffleHog(REPO_PATH);
    allVulnerabilities.push(...truffleResults);
  } catch (err) {
    console.log("TruffleHog error:", err.message);
  }

// BANDIT - Python security
try {
  const { stdout } = await execAsync(`bandit -r "${REPO_PATH}" -f json`);
  const results = JSON.parse(stdout);

  if (results.results) {
    results.results.forEach(issue => {
      allVulnerabilities.push({
        tool: "Bandit",
        title: issue.test_id || "Python Security Issue",
        severity: (issue.severity || "MEDIUM").toUpperCase(),
        file: issue.filename,
        line: issue.line_number,
        owasp: "A05:2025 - Injection"
      });
    });
  }
} catch (err) {
  console.log("Bandit error:", err.message);
}
// COMPOSER AUDIT - PHP dependencies
try {
  if (fs.existsSync(path.join(REPO_PATH, "composer.json"))) {
    const { stdout } = await execAsync(`composer audit --format=json`, { cwd: REPO_PATH });
    const results = JSON.parse(stdout);

    if (results.vulnerabilities) {
      results.vulnerabilities.forEach(vuln => {
        allVulnerabilities.push({
          tool: "Composer Audit",
          title: vuln.title,
          severity: (vuln.severity || "MEDIUM").toUpperCase(),
          file: vuln.package,
          line: 0,
          owasp: "A03:2025 - Software Supply Chain Failures"
        });
      });
    }
  }
} catch (err) {
  console.log("Composer audit error:", err.message);
}
return allVulnerabilities;
}
// -------------------------
// ROUTES
// -------------------------

// FETCH / UPLOAD projet
app.post("/api/projects/fetch", upload.single("project"), async (req, res) => {
  try {
    const projectId = uuidv4();
    const projectPath = path.join(__dirname, "upload", projectId);

    fs.mkdirSync(projectPath, { recursive: true });
    let projectType = "";

    if (req.file) {
      projectType = "zip";
      await fs.createReadStream(req.file.path).pipe(unzipper.Extract({ path: projectPath })).promise();
      fs.unlinkSync(req.file.path);
    } else if (req.body.gitUrl) {
      projectType = "git";
      await simpleGit().clone(req.body.gitUrl, projectPath);
    } else {
      return res.status(400).json({ success: false, error: "Aucun projet fourni" });
    }

    const allVulnerabilities = await scanProject(projectPath);

    // Remplace tout ton reduce par ça
    const score = calculateScore(allVulnerabilities);

    // Sauvegarde BDD
    await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO scans (user_id, project_name, score, results) VALUES (?, ?, ?, ?)",
        [1, projectId, score, JSON.stringify(allVulnerabilities)],
        (err, result) => err ? reject(err) : resolve(result)
      );
    });

    // Rapport JSON
    fs.writeFileSync(path.join(projectPath, "scan-report.json"), JSON.stringify({
      projectId,
      type: projectType,
      path: projectPath,
      createdAt: new Date(),
      results: allVulnerabilities,
      vulnerabilitiesCount: allVulnerabilities.length,
      score
    }, null, 2));

    res.json({
      success: true,
      project: {
        id: projectId,
        path: projectPath,
        type: projectType,
        createdAt: new Date(),
        filesCount: fs.readdirSync(projectPath).length,
        results: allVulnerabilities,
        score
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET projet par Id
app.get("/api/projects/:id", async (req, res) => {
  const projectId = req.params.id;

  db.query("SELECT * FROM scans WHERE project_name = ?", [projectId], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!results.length) return res.status(404).json({ success: false, error: "Projet introuvable" });

    const project = results[0];
    res.json({
      success: true,
      project: {
        id: project.project_name,
        createdAt: project.createdAt,
        score: project.score,
        results: JSON.parse(project.results)
      }
    });
  });
});

// DELETE projet
app.delete("/api/projects/:id", async (req, res) => {
  const projectId = req.params.id;

  db.query("DELETE FROM scans WHERE project_name = ?", [projectId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });

  const projectPath = path.join(__dirname, "upload", projectId);
  if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });
});

// Lancement serveur
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
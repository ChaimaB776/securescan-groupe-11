const express = require("express");
const { exec } = require("child_process");
const util = require("util");

// Permet d'utiliser exec avec async/await
const execAsync = util.promisify(exec);

const app = express();
const PORT = 3000;

// Chemin du repo à scanner
const REPO_PATH = "./test-repo";


// ROUTE TEST
app.get("/", (req, res) => {
  res.send("SecureScan API is running");
});

// ROUTE SCAN 
app.get("/scan", async (req, res) => {

  try {
    let allVulnerabilities = [];
    // SEMGREP
     try {
      const semgrepCommand = `semgrep --config auto ${REPO_PATH} --json`;
      const { stdout } = await execAsync(semgrepCommand);

      const parsed = JSON.parse(stdout);
      const results = parsed.results || [];
       const normalizedSemgrep = results.map(vuln => ({
        tool: "Semgrep",
        title: vuln.extra?.message || "Unknown issue",
        severity: vuln.extra?.severity || "INFO",
        file: vuln.path || "Unknown file",
        line: vuln.start?.line || 0,
        owasp: vuln.extra?.metadata?.owasp?.[0] || "N/A"
      }));

      allVulnerabilities.push(...normalizedSemgrep);

    } catch (err) {
      console.log("Erreur Semgrep:", err.message);
    }

    // NPM AUDIT 
    try {
    const npmAuditCommand = `cd ${REPO_PATH} && npm audit --json`;
     const { stdout } = await execAsync(npmCommand);

      const parsed = JSON.parse(stdout);
      const vulnerabilities = parsed.vulnerabilities || {};

      // Normalisation npm audit
      const normalizedNpm = Object.keys(vulnerabilities).map(pkgName => ({
        tool: "npm audit",
        title: vulnerabilities[pkgName].title || "Dependency vulnerability",
        severity: vulnerabilities[pkgName].severity || "UNKNOWN",
        file: pkgName,
        line: 0,
        owasp: "N/A"
      }));

      allVulnerabilities.push(...normalizedNpm);

    } catch (err) {
      console.log("Erreur npm audit:", err.message);
    }

    // CALCUL SCORE GLOBAL SIMPLE
    const severityWeights = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
      INFO: 0
    };

    const score = allVulnerabilities.reduce((acc, vuln) => {
      const sev = (vuln.severity || "").toUpperCase();
      return acc + (severityWeights[sev] || 0);
    }, 0);

    // RÉPONSE FINALE
    res.json({
      message: "Scan completed",
      total_vulnerabilities: allVulnerabilities.length,
      risk_score: score,
      vulnerabilities: allVulnerabilities
    });

  } catch (error) {
    console.error("Erreur globale:", error.message);
    res.status(500).json({
      error: "Scan failed",
      details: error.message
    });
  }
});

// LANCEMENT DUU SERVEUR
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
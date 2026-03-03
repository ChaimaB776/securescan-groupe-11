const express = require("express");
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs");

// Permet d'utiliser exec avec async/await
const execAsync = util.promisify(exec);

const app = express();
const PORT = 3000;

app.use(express.json());


// OWASP MAPPING

function mapToOWASP(tool) {
  switch (tool) {
    case "Semgrep":
      return "A05:2025 - Injection";
    case "npm audit":
      return "A03:2025 - Software Supply Chain Failures";
    case "ESLint Security":
      return "A05:2025 - Injection";
    case "TruffleHog":
      return "A04:2025 - Cryptographic Failures";
    default:
      return "N/A";
  }
}

// ROUTE TEST
app.get("/", (req, res) => {
  res.send("SecureScan API is running");
});

// ROUTE SCAN (dynamic projectId)
app.get("/scan/:projectId", async (req, res) => {
  const projectId = req.params.projectId;

  // Chemin du repo à scanner dans upload/
  const REPO_PATH = `./upload/${projectId}`;

  // Vérifie que le dossier existe
  if (!fs.existsSync(REPO_PATH)) {
    return res.status(404).json({ error: "Project not found" });
  }

  try {
    let allVulnerabilities = [];

    // SEMGREP
    try {
      const { stdout } = await execAsync(
        `semgrep --config auto ${REPO_PATH} --json`
      );

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

    // NPM AUDIT
    
    try {
      const { stdout } = await execAsync(
        `cd ${REPO_PATH} && npm audit --json`
      );

      const parsed = JSON.parse(stdout);
      const vulnerabilities = parsed.vulnerabilities || {};

      const normalized = Object.keys(vulnerabilities).map(pkg => ({
        tool: "npm audit",
        title: vulnerabilities[pkg].name || pkg,
        severity: (vulnerabilities[pkg].severity || "LOW").toUpperCase(),
        file: pkg,
        line: 0,
        owasp: mapToOWASP("npm audit")
      }));

      allVulnerabilities.push(...normalized);
    } catch (err) {
      console.log("npm audit error:", err.message);
    }

    // ESLINT SECURITY
    
    try {
      const { stdout } = await execAsync(
        `cd ${REPO_PATH} && npx eslint . -f json`
      );

      const parsed = JSON.parse(stdout);

      const normalized = parsed.flatMap(file =>
        file.messages.map(msg => ({
          tool: "ESLint Security",
          title: msg.message,
          severity: msg.severity === 2 ? "HIGH" : "LOW",
          file: file.filePath,
          line: msg.line,
          owasp: mapToOWASP("ESLint Security")
        }))
      );

      allVulnerabilities.push(...normalized);
    } catch (err) {
      console.log("ESLint error:", err.message);
    }

    // TRUFFLEHOG
    try {
      const { stdout } = await execAsync(
        `trufflehog git file://${REPO_PATH} --json`
      );

      const lines = stdout.split("\n").filter(line => line.trim() !== "");

      const normalized = lines.map(line => {
        const vuln = JSON.parse(line);
        return {
          tool: "TruffleHog",
          title: vuln?.Raw || "Secret detected",
          severity: "CRITICAL",
          file: vuln?.SourceMetadata?.Data?.Git?.file || "Unknown",
          line: vuln?.SourceMetadata?.Data?.Git?.line || 0,
          owasp: mapToOWASP("TruffleHog")
        };
      });

      allVulnerabilities.push(...normalized);
    } catch (err) {
      console.log("TruffleHog error:", err.message);
    }
    // CALCUL SCORE GLOBAL
    const severityWeights = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
      INFO: 0
    };

    const score = allVulnerabilities.reduce(
      (acc, vuln) => acc + (severityWeights[vuln.severity] || 0),
      0
    );
    // Après le scan
try {
  const reportPath = `${REPO_PATH}/scan-report.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        projectId,
        total_vulnerabilities: allVulnerabilities.length,
        risk_score: score,
        vulnerabilities: allVulnerabilities
      },
      null,
      2
    )
  );
  console.log(`Report saved at ${reportPath}`);
} catch (err) {
  console.log("Erreur lors de l'écriture du rapport :", err.message);
}


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
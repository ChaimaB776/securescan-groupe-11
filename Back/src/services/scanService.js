const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

const execAsync = promisify(exec);

/**
 * SERVICE DE SCANNING - Lance tous les scanners sur un projet
 * Retourne un array de vulnérabilités normalisées
 */

// ============================================
// 1. SEMGREP - Analyse statique (SAST)
// ============================================
async function runSemgrep(projectPath) {
  const vulnerabilities = [];
  try {
    console.log("🔍 Lancement Semgrep...");
    const { stdout } = await execAsync(
      `cd "${projectPath}" && semgrep --config p/owasp-top-ten --json`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
    );

    const results = JSON.parse(stdout);
    if (results.results && Array.isArray(results.results)) {
      results.results.forEach(finding => {
        vulnerabilities.push({
          tool: "Semgrep",
          title: finding.check_id || "SAST Issue",
          severity: mapSeverity(finding.extra?.severity || "MEDIUM"),
          file: finding.path || "unknown",
          line: finding.start?.line || 0,
          description: finding.extra?.message || "Static analysis issue found",
          owasp: "" // Sera mappé après
        });
      });
    }
    console.log(`✅ Semgrep: ${vulnerabilities.length} issue(s)`);
  } catch (err) {
    console.log(`⚠️ Semgrep: ${err.message}`);
  }
  return vulnerabilities;
}

// ============================================
// 2. ESLINT SECURITY - Linting sécurité JS
// ============================================
async function runESLint(projectPath) {
  const vulnerabilities = [];
  try {
    console.log("🔍 Lancement ESLint...");
    
    // D'abord vérifier s'il y a des fichiers JS
    const jsFiles = await execAsync(
      `cd "${projectPath}" && find . -name "*.js" -type f 2>/dev/null | head -1`,
      { maxBuffer: 1024 * 1024, timeout: 10000, shell: true }
    );
    
    if (!jsFiles.stdout.trim()) {
      console.log("⚠️ ESLint: pas de fichiers JavaScript trouvés");
      return vulnerabilities;
    }
    
    const { stdout } = await execAsync(
      `cd "${projectPath}" && npx eslint --format json . 2>/dev/null || echo "[]"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000, shell: true }
    );

    // Nettoyer le stdout (parfois ESLint retourne "[]" ou des quotes)
    let cleanedOutput = stdout.trim();
    if (cleanedOutput.startsWith('"') && cleanedOutput.endsWith('"')) {
      cleanedOutput = cleanedOutput.slice(1, -1); // Enlever les quotes externes
    }
    
    console.log(`[ESLint] Brut: ${cleanedOutput.substring(0, 200)}`);
    
    let results = JSON.parse(cleanedOutput || "[]");
    
    // ESLint retourne un array de fichiers avec leurs messages
    if (!Array.isArray(results)) {
      console.log(`[ESLint] ⚠️ Format non-array: ${typeof results}`);
      results = [];
    }
    
    console.log(`[ESLint] ${results.length} fichier(s) scanné(s)`);
    
    results.forEach((file, idx) => {
      if (file && file.messages && Array.isArray(file.messages)) {
        console.log(`[ESLint] Fichier ${file.filePath}: ${file.messages.length} issue(s)`);
        
        file.messages.forEach(msg => {
          if (msg.message) {
            console.log(`  → ${msg.ruleId}: ${msg.message}`);
            
            vulnerabilities.push({
              tool: "ESLint Security",
              title: msg.ruleId || msg.message,
              severity: msg.severity === 2 ? "HIGH" : "MEDIUM",
              file: file.filePath || "unknown",
              line: msg.line || 0,
              description: msg.message,
              owasp: ""
            });
          }
        });
      }
    });
    
    console.log(`✅ ESLint: ${vulnerabilities.length} issue(s) trouvée(s)`);
  } catch (err) {
    console.log(`⚠️ ESLint: ${err.message}`);
  }
  return vulnerabilities;
}

// ============================================
// 3. NPM AUDIT - Audit des dépendances
// ============================================
async function runNpmAudit(projectPath) {
  const vulnerabilities = [];
  try {
    console.log("🔍 Lancement npm audit...");
    
    // D'abord vérifier si package.json existe
    if (!fs.existsSync(path.join(projectPath, "package.json"))) {
      console.log("⚠️ npm audit: pas de package.json trouvé");
      return vulnerabilities;
    }

    let stdout = "";
    try {
      const result = await execAsync(`cd "${projectPath}" && npm audit --json`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });
      stdout = result.stdout;
    } catch (err) {
      // npm audit retourne exit code 1 s'il trouve des vulnérabilités
      stdout = err.stdout || "{}";
    }

    const audit = JSON.parse(stdout || "{}");
    if (audit.vulnerabilities) {
      Object.entries(audit.vulnerabilities).forEach(([pkgName, vulnData]) => {
        if (vulnData.via && Array.isArray(vulnData.via)) {
          vulnData.via.forEach(via => {
            vulnerabilities.push({
              tool: "npm audit",
              title: via.title || `Vulnerability in ${pkgName}`,
              severity: (via.severity || "MEDIUM").toUpperCase(),
              file: pkgName,
              line: 0,
              description: via.description || `Version: ${vulnData.installed}`,
              owasp: ""
            });
          });
        }
      });
    }
    console.log(`✅ npm audit: ${vulnerabilities.length} issue(s)`);
  } catch (err) {
    console.log(`⚠️ npm audit: ${err.message}`);
  }
  return vulnerabilities;
}

// ============================================
// 4. TRUFFLEHOG - Détection de secrets
// ============================================
async function runTruffleHog(projectPath) {
  const vulnerabilities = [];
  try {
    console.log("🔍 Lancement TruffleHog...");
    
    // Vérifier si c'est un repo git
    if (!fs.existsSync(path.join(projectPath, ".git"))) {
      console.log("⚠️ TruffleHog: pas de repo Git trouvé");
      return vulnerabilities;
    }

    const { stdout } = await execAsync(
      `cd "${projectPath}" && trufflehog filesystem . --json 2>/dev/null || echo ""`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000, shell: true }
    );

    // Filtrer les lignes vraiment vides
    const lines = stdout.split("\n").filter(line => {
      const trimmed = line.trim();
      return trimmed && trimmed !== '""' && trimmed !== '{}';
    });
    
    console.log(`[TruffleHog] ${lines.length} ligne(s) parsée(s)`);
    
    lines.forEach((line, idx) => {
      try {
        const result = JSON.parse(line);
        
        // Vérifier que c'est un objet valide avec des champs
        if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
          console.log(`[TruffleHog] Ligne ${idx} vide ou invalide, ignorée`);
          return;
        }
        
        console.log(`[TruffleHog Ligne ${idx}]:`, JSON.stringify(result).substring(0, 200));
        
        // Extraire les informations avec gestion robuste des structures variées
        const detectorName = result.DetectorName || result.detector_name || result.type || "Unknown Secret";
        const isVerified = result.Verified === true || result.verified === true ? "✅ VERIFIED" : "⚠️ POTENTIAL";
        
        // Essayer plusieurs chemins possibles pour le fichier
        const filePath = result.SourceMetadata?.Data?.File 
          || result.source_metadata?.data?.file
          || result.File
          || result.file
          || "unknown";
        
        const lineNumber = result.SourceMetadata?.Data?.Line 
          || result.source_metadata?.data?.line
          || result.Line
          || result.line
          || 0;
        
        // Essayer d'extraire un aperçu du secret avec plusieurs chemins
        let secretPreview = "";
        const rawData = result.Raw || result.raw || result.Secret || result.secret;
        if (rawData) {
          const raw = String(rawData);
          if (raw.length > 10) {
            secretPreview = `${raw.substring(0, 10)}***[MASKED]`;
          } else {
            secretPreview = "***[MASKED]";
          }
        }
        
        // Construire le titre
        const title = `🔐 ${detectorName}`;
        
        // Description très précise et utile
        let description = `${isVerified} - Type: ${detectorName}`;
        if (secretPreview) {
          description += `\nAperçu: ${secretPreview}`;
        }
        if (filePath !== 'unknown') {
          description += `\nLocalisation: ${filePath}${lineNumber > 0 ? `:${lineNumber}` : ''}`;
        }
        const extraData = result.ExtraData || result.extra_data || {};
        if (Object.keys(extraData).length > 0) {
          const extraStr = JSON.stringify(extraData).substring(0, 150);
          description += `\nContexte: ${extraStr}`;
        }
        
        console.log(`[TruffleHog] ✅ Parsé: ${title}`);
        
        vulnerabilities.push({
          tool: "TruffleHog",
          title: title,
          severity: "CRITICAL",
          file: filePath,
          line: lineNumber,
          description: description,
          owasp: ""
        });
      } catch (e) {
        console.log(`[TruffleHog] ❌ Erreur parsing ligne ${idx}:`, e.message);
      }
    });
    console.log(`✅ TruffleHog: ${vulnerabilities.length} secret(s) détecté(s)`);
  } catch (err) {
    console.log(`⚠️ TruffleHog: ${err.message}`);
  }
  return vulnerabilities;
}

// ============================================
// 5. BANDIT - Sécurité Python
// ============================================
async function runBandit(projectPath) {
  const vulnerabilities = [];
  try {
    console.log("🔍 Lancement Bandit...");
    
    // Vérifier s'il y a des fichiers Python
    try {
      await execAsync(`find "${projectPath}" -name "*.py" -type f | head -1`, {
        timeout: 5000
      });
    } catch {
      console.log("⚠️ Bandit: pas de fichiers Python trouvés");
      return vulnerabilities;
    }

    const { stdout } = await execAsync(
      `cd "${projectPath}" && bandit -r . -f json 2>/dev/null || echo "{}"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000, shell: true }
    );

    const results = JSON.parse(stdout || "{}");
    if (results.results && Array.isArray(results.results)) {
      results.results.forEach(issue => {
        vulnerabilities.push({
          tool: "Bandit",
          title: issue.test_id || "Python Security Issue",
          severity: (issue.severity || "MEDIUM").toUpperCase(),
          file: issue.filename || "unknown",
          line: issue.line_number || 0,
          description: issue.issue_text || "Security issue found",
          owasp: ""
        });
      });
    }
    console.log(`✅ Bandit: ${vulnerabilities.length} issue(s)`);
  } catch (err) {
    console.log(`⚠️ Bandit: ${err.message}`);
  }
  return vulnerabilities;
}

// ============================================
// 6. COMPOSER AUDIT - Audit PHP
// ============================================
async function runComposerAudit(projectPath) {
  const vulnerabilities = [];
  try {
    console.log("🔍 Lancement Composer Audit...");
    
    if (!fs.existsSync(path.join(projectPath, "composer.json"))) {
      console.log("⚠️ Composer Audit: pas de composer.json trouvé");
      return vulnerabilities;
    }

    const { stdout } = await execAsync(
      `cd "${projectPath}" && composer audit --format=json 2>/dev/null || echo "{}"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000, shell: true }
    );

    const results = JSON.parse(stdout || "{}");
    if (results.vulnerabilities && Array.isArray(results.vulnerabilities)) {
      results.vulnerabilities.forEach(vuln => {
        vulnerabilities.push({
          tool: "Composer Audit",
          title: vuln.title || "PHP Dependency Vulnerability",
          severity: (vuln.severity || "MEDIUM").toUpperCase(),
          file: vuln.package || "unknown",
          line: 0,
          description: vuln.description || "Vulnerability in dependency",
          owasp: ""
        });
      });
    }
    console.log(`✅ Composer Audit: ${vulnerabilities.length} issue(s)`);
  } catch (err) {
    console.log(`⚠️ Composer Audit: ${err.message}`);
  }
  return vulnerabilities;
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Mapper les sévérités vers un format uniforme
 */
function mapSeverity(severity) {
  const sev = String(severity).toUpperCase();
  if (sev.includes("CRITICAL") || sev.includes("CRITICAL")) return "CRITICAL";
  if (sev.includes("HIGH") || sev.includes("ERROR")) return "HIGH";
  if (sev.includes("MEDIUM") || sev.includes("WARNING")) return "MEDIUM";
  return "LOW";
}

/**
 * Lance TOUS les scanners en parallèle
 */
async function scanProject(projectPath, sourceType = 'git') {
  console.log(`\n🚀 DÉMARRAGE DU SCAN: ${projectPath} (source: ${sourceType})\n`);
  
  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Chemin n'existe pas: ${projectPath}`);
    return [];
  }

  try {
    console.log(`📋 Lancement de 6 scanners en parallèle...`);
    
    // TruffleHog ne se lance que pour les projets Git
    const scannersToRun = [
      runSemgrep(projectPath),
      runESLint(projectPath),
      runNpmAudit(projectPath),
      sourceType === 'git' ? runTruffleHog(projectPath) : Promise.resolve([]), // TruffleHog seulement si Git
      runBandit(projectPath),
      runComposerAudit(projectPath)
    ];

    const [semgrepVulns, eslintVulns, npmVulns, truffleVulns, banditVulns, composerVulns] = 
      await Promise.allSettled(scannersToRun).then(results =>
        results.map(r => r.status === "fulfilled" ? r.value : [])
      );

    // Combiner tous les résultats
    const allVulnerabilities = [
      ...semgrepVulns,
      ...eslintVulns,
      ...npmVulns,
      ...truffleVulns,
      ...banditVulns,
      ...composerVulns
    ];

    console.log(`\n📊 RÉSUMÉ DES SCANS:`);
    console.log(`  • Semgrep:        ${semgrepVulns.length} vulnérabilité(s)`);
    console.log(`  • ESLint:         ${eslintVulns.length} problème(s)`);
    console.log(`  • npm audit:      ${npmVulns.length} dépendance(s) vulnérable(s)`);
    console.log(`  • TruffleHog:     ${truffleVulns.length} secret(s)`);
    console.log(`  • Bandit:         ${banditVulns.length} problème(s) Python`);
    console.log(`  • Composer Audit: ${composerVulns.length} dépendance(s) vulnérable(s)`);
    console.log(`\n✅ SCAN TERMINÉ - Total: ${allVulnerabilities.length} vulnérabilité(s)\n`);
    
    return allVulnerabilities;
  } catch (err) {
    console.error(`❌ Erreur générale de scan: ${err.message}`);
    return [];
  }
}

/**
 * Calcule le score de sécurité (0-100)
 * Formule simple:
 * - CRITICAL trouvé = 0
 * - Sinon: 100 - (HIGH*20 + MEDIUM*10 + LOW*3)
 */
function calculateScore(vulnerabilities) {
  if (!Array.isArray(vulnerabilities)) return 100;

  const stats = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  vulnerabilities.forEach(v => {
    const sev = v.severity || "LOW";
    if (stats[sev] !== undefined) stats[sev]++;
  });

  if (stats.CRITICAL > 0) return 0;

  let score = 100;
  score -= stats.HIGH * 20;
  score -= stats.MEDIUM * 10;
  score -= stats.LOW * 3;

  return Math.max(0, score);
}

module.exports = {
  scanProject,
  calculateScore
};

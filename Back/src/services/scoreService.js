// Service de calcul de score de sécurité
// Calcule une note sur 100 basée sur les vulnérabilités détectées

// Formule: si 1+ critical trouvé = score 0, sinon on calcule avec les autres
function calculateSecurityScore(vulnerabilities = []) {
  if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
    return {
      score: 100,
      breakdown: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
      details: "Aucune vulnérabilité",
    };
  }

  // Compter les vulnérabilités par sévérité
  const breakdown = {
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  };

  for (const vuln of vulnerabilities) {
    const severity = vuln.severity?.toLowerCase();
    if (severity === "critical") breakdown.criticalCount++;
    else if (severity === "high") breakdown.highCount++;
    else if (severity === "medium") breakdown.mediumCount++;
    else if (severity === "low") breakdown.lowCount++;
  }

  // Si critical trouvé = score 0
  if (breakdown.criticalCount > 0) {
    return {
      score: 0,
      riskLevel: "Critique",
      breakdown,
      totalVulnerabilities: vulnerabilities.length,
      pointsDeducted: 100,
    };
  }

  // Sinon calcul basé sur high/medium/low
  let score = 100;
  score -= breakdown.highCount * 25;
  score -= breakdown.mediumCount * 10;
  score -= breakdown.lowCount * 3;

  score = Math.max(0, score);

  // Déterminer le niveau de risque
  let riskLevel;
  if (score === 100) riskLevel = "Excellent";
  else if (score >= 80) riskLevel = "Très bon";
  else if (score >= 60) riskLevel = "Bon";
  else if (score >= 40) riskLevel = "Moyen";
  else if (score >= 20) riskLevel = "Mauvais";
  else riskLevel = "Très mauvais";

  return {
    score: Math.round(score),
    riskLevel,
    breakdown,
    totalVulnerabilities: vulnerabilities.length,
    pointsDeducted: 100 - score,
  };
}

// Calcule le score basé sur un résultat JSON d'analyseurs
function calculateScoreFromScan(scanResults = {}) {
  if (!scanResults) {
    return calculateSecurityScore([]);
  }

  // Essayer de trouver les vulnérabilités dans différentes structures
  let vulnerabilities = scanResults.vulnerabilities || 
                        scanResults.issues || 
                        scanResults.findings || 
                        [];

  // Si c'est un tableau et que le format n'est pas bon, essayer de l'adapter
  if (Array.isArray(vulnerabilities)) {
    vulnerabilities = vulnerabilities.map((item) => {
      if (typeof item === "object") {
        return item;
      }
      return { severity: "medium" };
    });
  } else {
    vulnerabilities = [];
  }

  return calculateSecurityScore(vulnerabilities);
}

module.exports = {
  calculateSecurityScore,
  calculateScoreFromScan,
  generateRecommendations,
};

// Génère des recommandations basées sur les vulnérabilités
function generateRecommendations(vulnerabilities = []) {
  const recommendations = [];
  const breakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const vuln of vulnerabilities) {
    const severity = vuln.severity?.toLowerCase();
    if (breakdown[severity] !== undefined) {
      breakdown[severity]++;
    }
  }

  // Générer les recommandations
  if (breakdown.critical > 0) {
    recommendations.push({
      priority: "URGENT",
      message: `${breakdown.critical} vulnérabilité(s) CRITIQUE(S) détectée(s). Correction immédiate requise!`,
      level: "critical",
    });
  }

  if (breakdown.high > 0) {
    recommendations.push({
      priority: "ÉLEVÉE",
      message: `${breakdown.high} vulnérabilité(s) HAUTE(S) détectée(s). À corriger rapidement.`,
      level: "high",
    });
  }

  if (breakdown.medium > 0) {
    recommendations.push({
      priority: "MOYENNE",
      message: `${breakdown.medium} vulnérabilité(s) MOYENNE(S) détectée(s). À adresser dans les prochaines itérations.`,
      level: "medium",
    });
  }

  if (breakdown.low > 0) {
    recommendations.push({
      priority: "BASSE",
      message: `${breakdown.low} vulnérabilité(s) BASSE(S) détectée(s). À considérer pour améliorations futures.`,
      level: "low",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "AUCUNE",
      message: "Aucune vulnérabilité détectée. Projet sécurisé!",
      level: "none",
    });
  }

  return recommendations;
}

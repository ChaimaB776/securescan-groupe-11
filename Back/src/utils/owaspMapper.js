/**
 * Mapper les vulnérabilités trouvées vers les catégories OWASP 2025
 */

const owaspMapping = {
  // A01:2025 - Broken Access Control
  access: [
    "access control", "permission", "authorization", "privilege escalation",
    "insecure direct object reference", "idor", "authentication bypass"
  ],

  // A02:2025 - Cryptographic Failures
  crypto: [
    "secret", "api key", "token", "password", "credential", "encryption",
    "ssl", "tls", "hash", "cipher", "hardcoded secret", "sensitive data",
    "private key", "aws_access_key", "gh_token"
  ],

  // A03:2025 - Injection
  injection: [
    "sql injection", "sql", "nosql", "injection", "command injection",
    "os command", "ldap injection", "xpath injection", "xxe", "code injection",
    "eval", "exec", "system(", "shell", "subprocess", "dangerous"
  ],

  // A04:2025 - Insecure Design
  design: [
    "design", "business logic", "insufficient logging", "missing controls",
    "default credentials"
  ],

  // A05:2025 - Security Misconfiguration
  config: [
    "configuration", "debug mode", "verbose error", "default settings",
    "unnecessary services", "security headers", "cors", "csrf", "x-frame"
  ],

  // A06:2025 - Vulnerable and Outdated Components
  components: [
    "dependency", "package", "library", "vulnerable version", "outdated",
    "npm audit", "composer audit", "update available"
  ],

  // A07:2025 - Identification and Authentication Failures
  auth: [
    "authentication", "login", "password", "session", "jwt", "oauth",
    "mfa", "multi-factor", "weak password", "brute force"
  ],

  // A08:2025 - Software and Data Integrity Failures
  integrity: [
    "integrity", "signature", "verification", "checksum", "tampering",
    "man-in-the-middle"
  ],

  // A09:2025 - Logging and Monitoring Failures
  logging: [
    "logging", "monitoring", "audit trail", "detection", "response"
  ],

  // A10:2025 - Server-Side Request Forgery (SSRF)
  ssrf: [
    "ssrf", "server-side request", "url", "fetch", "curl", "request forgery"
  ]
};

/**
 * Map une vulnérabilité vers une catégorie OWASP
 * @param {string} title - Titre de la vulnérabilité
 * @param {string} tool - Outil qui a trouvé la vulnérabilité
 * @returns {string} Catégorie OWASP
 */
function mapToOWASP(title = "", tool = "") {
  const combined = `${title} ${tool}`.toLowerCase();

  // OWASP A02 - Secrets
  if (owaspMapping.crypto.some(keyword => combined.includes(keyword))) {
    return "A02:2025 - Cryptographic Failures";
  }

  // OWASP A03 - Injection
  if (owaspMapping.injection.some(keyword => combined.includes(keyword))) {
    return "A03:2025 - Injection";
  }

  // OWASP A01 - Access Control
  if (owaspMapping.access.some(keyword => combined.includes(keyword))) {
    return "A01:2025 - Broken Access Control";
  }

  // OWASP A06 - Vulnerable Components
  if (owaspMapping.components.some(keyword => combined.includes(keyword)) ||
      tool === "npm audit" || tool === "Composer Audit" || tool === "Bandit") {
    return "A06:2025 - Vulnerable and Outdated Components";
  }

  // OWASP A07 - Auth Failures
  if (owaspMapping.auth.some(keyword => combined.includes(keyword))) {
    return "A07:2025 - Identification and Authentication Failures";
  }

  // OWASP A05 - Misconfiguration
  if (owaspMapping.config.some(keyword => combined.includes(keyword))) {
    return "A05:2025 - Security Misconfiguration";
  }

  // OWASP A10 - SSRF
  if (owaspMapping.ssrf.some(keyword => combined.includes(keyword))) {
    return "A10:2025 - Server-Side Request Forgery (SSRF)";
  }

  // Défaut: A04 - Insecure Design
  return "A04:2025 - Insecure Design";
}

module.exports = {
  mapToOWASP
};

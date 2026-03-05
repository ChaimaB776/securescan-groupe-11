const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../controllers/authController");


// Middleware d'authentification
// Vérifie le token JWT et extrait l'userId

const authMiddleware = (req, res, next) => {
  try {
    // Récupère le token du header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token manquant",
      });
    }

    // Format: "Bearer {token}"
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    // Vérifie le token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ajoute l'userId au request
    req.userId = decoded.userId;
    req.username = decoded.username;

    next();
  } catch (error) {
    console.error("Erreur auth middleware:", error.message);
    res.status(401).json({
      success: false,
      message: "Token invalide ou expiré",
    });
  }
};

module.exports = authMiddleware;

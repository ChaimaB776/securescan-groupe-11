const jwt = require("jsonwebtoken");
const userService = require("../services/userService");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-me-in-prod";


// Inscription
// POST /auth/register

const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username et mot de passe requis",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe doit contenir au moins 6 caractères",
      });
    }

    const user = await userService.createUser(username, password);

    res.status(201).json({
      success: true,
      message: "Compte créé avec succès",
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Erreur register:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// Connexion
// POST /auth/login

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username et mot de passe requis",
      });
    }

    const user = await userService.getUserByusername(username, password);

    // Génère un JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Connexion réussie",
      token: token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Erreur login:", error);
    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};


// Récupère les infos de l'utilisateur connecté
// GET /auth/me
const getMe = async (req, res) => {
  try {
    const userId = req.userId; // Défini par le middleware d'auth

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Non authentifié",
      });
    }

    const user = await userService.getUserById(userId);

    res.status(200).json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.error("Erreur getMe:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  JWT_SECRET,
};

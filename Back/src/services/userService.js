const bcrypt = require("bcryptjs");
const pool = require("../config/database");


// Crée un nouvel utilisateur

async function createUser(username, password) {
  try {
    const connection = await pool.getConnection();

    // Vérifie que l'username n'existe pas déjà
    const [existingUser] = await connection.execute(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUser.length > 0) {
      connection.release();
      throw new Error("Utilisateur déjà existant");
    }

    // Hash le password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insère l'utilisateur
    const [result] = await connection.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );

    connection.release();

    return {
      id: result.insertId,
      username: username,
      created_at: new Date(),
    };
  } catch (error) {
    throw new Error(`Erreur création user: ${error.message}`);
  }
}


// Récupère un utilisateur par username + vérifie le password

async function getUserByusername(username, password) {
  try {
    const connection = await pool.getConnection();

    const [users] = await connection.execute(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username]
    );

    connection.release();

    if (users.length === 0) {
      throw new Error("Utilisateur non trouvé");
    }

    const user = users[0];

    // Vérifie le password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Mot de passe incorrect");
    }

    return {
      id: user.id,
      username: user.username,
    };
  } catch (error) {
    throw new Error(`Erreur authentification: ${error.message}`);
  }
}

// Récupère un utilisateur par ID
async function getUserById(userId) {
  try {
    const connection = await pool.getConnection();

    const [users] = await connection.execute(
      "SELECT id, username, created_at FROM users WHERE id = ?",
      [userId]
    );

    connection.release();

    if (users.length === 0) {
      throw new Error("Utilisateur non trouvé");
    }

    return {
      id: users[0].id,
      username: users[0].username,
      created_at: users[0].created_at,
    };
  } catch (error) {
    throw new Error(`Erreur récupération user: ${error.message}`);
  }
}

module.exports = {
  createUser,
  getUserByusername,
  getUserById,
};

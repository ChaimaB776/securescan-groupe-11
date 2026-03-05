const scoreService = require("../services/scoreService");
const pool = require("../config/database");

// Calcule et sauvegarde le score de sécurité
// POST /api/score/calculate
const calculateAndSaveScore = async (req, res) => {
  try {
    const { projectId, scanResults } = req.body;
    const userId = req.userId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "projectId est requis",
      });
    }

    if (!scanResults) {
      return res.status(400).json({
        success: false,
        error: "scanResults est requis",
      });
    }

    // Calculer le score
    const scoreResult = scoreService.calculateScoreFromScan(scanResults);
    const recommendations = scoreService.generateRecommendations(scanResults.vulnerabilities || []);

    // Sauvegarder en BDD
    const connection = await pool.getConnection();

    await connection.query(
      `UPDATE scans SET results = ?, score = ? 
       WHERE user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(results, '$.id')) = ?`,
      [
        JSON.stringify(scanResults),
        scoreResult.score,
        userId,
        projectId,
      ]
    );

    connection.release();

    res.json({
      success: true,
      score: scoreResult.score,
      riskLevel: scoreResult.riskLevel,
      breakdown: scoreResult.breakdown,
      totalVulnerabilities: scoreResult.totalVulnerabilities,
      recommendations,
      message: "Score calculé et sauvegardé",
    });
  } catch (error) {
    console.error("Erreur calculateAndSaveScore:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Récupère le score d'un projet
// GET /api/score/:projectId
const getScore = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "projectId est requis",
      });
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT score, results FROM scans 
       WHERE user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(results, '$.id')) = ?`,
      [userId, projectId]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Projet non trouvé",
      });
    }

    const scan = rows[0];
    const resultsData = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
    
    // Les résultats sont structurés comme {id: ..., vulnerabilities: [...]}
    const vulnerabilities = resultsData.vulnerabilities || resultsData || [];

    res.json({
      success: true,
      score: scan.score,
      results: vulnerabilities,
    });
  } catch (error) {
    console.error("Erreur getScore:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Récupère l'historique des scores pour un projet
// GET /api/score/:projectId/history
const getScoreHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "projectId est requis",
      });
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT score, results, created_at FROM scans 
       WHERE user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(results, '$.id')) = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId, projectId]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Aucun historique trouvé",
      });
    }

    const history = rows.map((row) => {
      const results = typeof row.results === 'string' ? JSON.parse(row.results) : row.results;
      return {
        score: row.score,
        vulnerabilities: results.vulnerabilities ? results.vulnerabilities.length : 0,
        createdAt: row.created_at,
      };
    });

    res.json({
      success: true,
      projectId,
      history,
    });
  } catch (error) {
    console.error("Erreur getScoreHistory:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Récupère le dashboard des scores de l'utilisateur
// GET /api/score/dashboard/all
const getDashboard = async (req, res) => {
  try {
    const userId = req.userId;

    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT score, results, created_at FROM scans 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    connection.release();

    const stats = {
      totalScans: rows.length,
      averageScore: 0,
      projects: [],
      scoreDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      },
    };

    let totalScore = 0;

    const projectMap = new Map();

    for (const row of rows) {
      const results = typeof row.results === 'string' ? JSON.parse(row.results) : row.results;
      const projectId = results.id;

      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          id: projectId,
          type: results.type,
          lastScore: row.score,
          lastScan: row.created_at,
          vulnCount: results.vulnerabilities ? results.vulnerabilities.length : 0,
        });
      }

      totalScore += row.score || 0;

      // Distribution des scores
      if (row.score >= 90) stats.scoreDistribution.excellent++;
      else if (row.score >= 70) stats.scoreDistribution.good++;
      else if (row.score >= 50) stats.scoreDistribution.fair++;
      else stats.scoreDistribution.poor++;
    }

    stats.projects = Array.from(projectMap.values());
    stats.averageScore = rows.length > 0 ? Math.round(totalScore / rows.length) : 0;

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Erreur getDashboard:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  calculateAndSaveScore,
  getScore,
  getScoreHistory,
  getDashboard,
};

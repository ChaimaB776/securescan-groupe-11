require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const scoreRoutes = require("./routes/scoreRoutes");

const app = express();

// Augmenter les timeouts
const server = require("http").createServer(app);
server.setTimeout(300000); // 5 minutes pour les uploads gros fichiers
server.headersTimeout = 310000;
server.keepAliveTimeout = 310000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Servir les fichiers statiques du frontend
app.use(express.static("../frontend"));

app.get("/", (req, res) => {
  res.sendFile("../frontend/index.html");
});

// Routes authentification
app.use("/auth", authRoutes);

// Routes projets
app.use("/api/projects", projectRoutes);

// Routes score
app.use("/api/score", scoreRoutes);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Le serveur tourne sur le port ${PORT}`);
});
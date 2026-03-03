require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const projectRoutes = require("./routes/projectRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload());

app.get("/", (req, res) => {
  res.json({ message: "SecureScan API en cours !" });
});

// Routes pour la gestion des projets
app.use("/api/projects", projectRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Le serveur tourne sur le port ${PORT}`);
});
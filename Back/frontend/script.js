const API_URL = "http://localhost:3000";

// Protection des pages
function checkAuth() {
    const token = localStorage.getItem("token");
    const currentPage = window.location.pathname.split("/").pop();

    // Pages autorisées sans token
    const openPages = ["login.html", "register.html", "index.html", "dashboard.html"];

    if (!token && !openPages.includes(currentPage)) {
        // Redirection seulement pour les pages sensibles
        window.location.href = "login.html";
    }
}
checkAuth();

// UI LOGIN / REGISTER
function showLogin() {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
}

function showRegister() {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "block";
}

// REGISTER
async function register() {
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        alert(data.message || data.error);
        return;
    }

    alert("Compte créé !");
    showLogin();
}

// LOGIN
async function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        alert(data.message || data.error);
        return;
    }

    localStorage.setItem("token", data.token);
    window.location.href = "index.html";
}

// LOGOUT
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// ANALYSE PROJET
async function analyze() {
    const gitLink = document.getElementById("gitLink").value;
    const fileInput = document.getElementById("zipFile");
    const file = fileInput ? fileInput.files[0] : null;

    if (!gitLink && !file) {
        alert("Veuillez entrer un lien Git ou choisir un fichier ZIP");
        return;
    }

    try {
        const formData = new FormData();
        if (file) formData.append("project", file);
        else formData.append("gitUrl", gitLink);

        const response = await fetch(`${API_URL}/api/projects/fetch`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (!data.success) {
            alert(data.error || "Erreur lors de l'analyse");
            return;
        }

        // Stocke le projet
        localStorage.setItem("projectData", JSON.stringify(data.project));
        localStorage.setItem("projectId", data.project.id);

        // Pour test final, on ajoute un token temporaire pour dashboard
        localStorage.setItem("token", "test-token");

        // Redirection vers dashboard
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erreur serveur :", error);
        alert("Erreur serveur, vérifiez la console.");
    }
}

// DASHBOARD
function loadDashboard() {
    let project = JSON.parse(localStorage.getItem("projectData"));
    const projectId = localStorage.getItem("projectId");

    if (!project && projectId) {
        // Récupère depuis API si pas en localStorage
        fetch(`${API_URL}/api/projects/${projectId}`)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    project = data.project;
                    displayProject(project);
                } else {
                    console.error("Projet introuvable :", data.error);
                }
            })
            .catch(err => console.error("Erreur API :", err));
    } else if (project) {
        displayProject(project);
    }
}

function displayProject(project) {
    const resultsDiv = document.getElementById("results");
    let vulnHtml = "<p>Aucune vulnérabilité détectée.</p>";

    if (project.results && project.results.length > 0) {
        vulnHtml = "<h3>Vulnérabilités détectées :</h3><ul>";
        project.results.forEach(v => {
            vulnHtml += `<li>
                <strong>Outil :</strong> ${v.tool}<br>
                <strong>Fichier :</strong> ${v.file}<br>
                <strong>Ligne :</strong> ${v.line}<br>
                <strong>Titre :</strong> ${v.title}<br>
                <strong>Gravité :</strong> ${v.severity}<br>
                <strong>Catégorie OWASP :</strong> ${v.owasp}
            </li><hr>`;
        });
        vulnHtml += "</ul>";
    }

    resultsDiv.innerHTML = `
        <p><strong>ID :</strong> ${project.id || "N/A"}</p>
        <p><strong>Type :</strong> ${project.type || "N/A"}</p>
        <p><strong>Chemin :</strong> ${project.path || "N/A"}</p>
        <p><strong>Nombre fichiers :</strong> ${project.filesCount || "N/A"}</p>
        <p><strong>Score global :</strong> ${project.score || 0}</p>
        <p><strong>Créé le :</strong> ${project.createdAt || "N/A"}</p>
        ${vulnHtml}
    `;
}

if (window.location.pathname.includes("dashboard.html")) loadDashboard();


// DELETE PROJECT
async function deleteProject() {
    const projectId = localStorage.getItem("projectId");
    if (!projectId) return;

    try {
        const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
            method: "DELETE",
            headers: { Authorization: localStorage.getItem("token") },
        });
        const data = await response.json();
        if (!data.success) return alert(data.error || "Erreur suppression");

        alert("Projet supprimé !");
        localStorage.removeItem("projectData");
        localStorage.removeItem("projectId");
        window.location.href = "index.html";
    } catch (err) {
        console.error("Erreur suppression :", err);
        alert("Erreur serveur lors de la suppression");
    }
}
const API_URL = "http://localhost:3000";

//  PROTECTION DES PAGES
function checkAuth() {
    const token = localStorage.getItem("token");

    if (!token &&
        (window.location.pathname.includes("index.html") ||
         window.location.pathname.includes("dashboard.html"))) {
        window.location.href = "login.html";
    }
}

checkAuth();

//  UI LOGIN / REGISTER
function showLogin() {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
}

function showRegister() {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "block";
}

//  REGISTER
async function register() {

    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;

    const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
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

    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
        alert(data.message || data.error);
        return;
    }

    localStorage.setItem("token", data.token);
    window.location.href = "index.html";
}

//  LOGOUT
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

//  FETCH PROJECT (Git ou ZIP)
async function analyze() {

    const token = localStorage.getItem("token");
    const gitLink = document.getElementById("gitLink").value;
    const fileInput = document.getElementById("zipFile");
    const file = fileInput ? fileInput.files[0] : null;

    if (!gitLink && !file) {
        alert("Veuillez entrer un lien Git ou choisir un fichier ZIP");
        return;
    }

    try {

        const formData = new FormData();

        if (file) {
            formData.append("project", file);
        } else {
            formData.append("gitUrl", gitLink);
        }

        const response = await fetch(
            `${API_URL}/api/projects/fetch`,
            {
                method: "POST",
                headers: {
                    "Authorization": token
                },
                body: formData
            }
        );

        const data = await response.json();

        if (!data.success) {
            alert(data.error);
            return;
        }

        const project = data.project;

        localStorage.setItem("projectData", JSON.stringify(project));
        localStorage.setItem("projectId", project.id);

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error(error);
        alert("Erreur lors du chargement du projet");
    }
}


//  LOAD PROJECT DETAILS
async function loadProject(projectId) {

    const token = localStorage.getItem("token");

    const response = await fetch(
        `${API_URL}/api/projects/${projectId}`,
        {
            headers: {
                "Authorization": token
            }
        }
    );

    const data = await response.json();

    if (!data.success) {
        alert(data.error);
        return;
    }

    localStorage.setItem("projectData", JSON.stringify(data.project));
    window.location.href = "dashboard.html";
}

//  DASHBOARD
function loadDashboard() {

    const project = JSON.parse(localStorage.getItem("projectData"));
    if (!project) return;

    const resultsDiv = document.getElementById("results");

    resultsDiv.innerHTML = `
        <p><strong>ID :</strong> ${project.id || "N/A"}</p>
        <p><strong>Type détecté :</strong> ${project.type || "N/A"}</p>
        <p><strong>Chemin :</strong> ${project.path || "N/A"}</p>
        <p><strong>Nombre fichiers :</strong> ${project.fileCount || "Calcul en cours..."}</p>
        <p><strong>Créé le :</strong> ${project.createdAt || "N/A"}</p>
    `;

    // Si c'est un ZIP et fileCount est 0 ou undefined, rafraîchir après quelques secondes
    if (project.type === "zip_upload" && (!project.fileCount || project.fileCount === 0)) {
        const projectId = localStorage.getItem("projectId");
        setTimeout(() => {
            refreshProjectData(projectId);
        }, 2000);
    }
}

// refresh obligatoire pour calcul nombre fichiers
async function refreshProjectData(projectId) {
    const token = localStorage.getItem("token");
    
    try {
        const response = await fetch(
            `${API_URL}/api/projects/${projectId}`,
            {
                headers: {
                    "Authorization": token
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            // Mettre à jour SEULEMENT le fileCount dans le localStorage et l'affichage
            const savedProject = JSON.parse(localStorage.getItem("projectData"));
            savedProject.fileCount = data.project.fileCount;
            localStorage.setItem("projectData", JSON.stringify(savedProject));
            
            // Mettre à jour que le nombre de fichiers dans le DOM
            const fileCountElements = document.querySelectorAll("strong");
            for (let el of fileCountElements) {
                if (el.textContent === "Nombre fichiers :") {
                    el.nextSibling.textContent = " " + (data.project.fileCount || "Calcul en cours...");
                    break;
                }
            }
            
            // Si fileCount est toujours 0, continuer le refresh
            if (data.project.fileCount === 0) {
                setTimeout(() => {
                    refreshProjectData(projectId);
                }, 2000);
            }
        }
    } catch (error) {
        console.error("Erreur refresh:", error);
    }
}

if (window.location.pathname.includes("dashboard.html")) {
    loadDashboard();
}

//  DELETE PROJECT
async function deleteProject() {

    const token = localStorage.getItem("token");
    const projectId = localStorage.getItem("projectId");

    if (!projectId) return;

    const response = await fetch(
        `${API_URL}/api/projects/${projectId}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": token
            }
        }
    );

    const data = await response.json();

    if (!data.success) {
        alert(data.error);
        return;
    }

    alert("Projet supprimé");

    localStorage.removeItem("projectData");
    localStorage.removeItem("projectId");

    window.location.href = "index.html";
}
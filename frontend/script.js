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

// aller sur la page profile utilisateur
function goToProfile() {
    window.location.href = "profile.html";
}

//  FETCH PROJECT (Git ou ZIP)
async function analyze() {

    const token = localStorage.getItem("token");
    const projectName = document.getElementById("projectName").value; // ✅ AJOUT
    const gitLink = document.getElementById("gitLink").value;
    const fileInput = document.getElementById("zipFile");
    const file = fileInput ? fileInput.files[0] : null;

    if (!projectName || (!gitLink && !file)) {
        alert("Veuillez entrer un nom de projet et un lien Git ou choisir un fichier ZIP");
        return;
    }

    try {

        const formData = new FormData();

        formData.append("libelle_project", projectName); // ✅ AJOUT

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
                    "Authorization": `Bearer ${token}`
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
                "Authorization": `Bearer ${token}`
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

    const summaryDiv = document.getElementById("summary");

    // === INFOS DU PROJET ===
    summaryDiv.innerHTML = `
        <div class="project-info">
            <h3>📦 Informations du projet</h3>
            <p><strong>Nom:</strong> ${project.libelle_project || project.project_name || "N/A"}</p>
            <p><strong>Type:</strong> ${project.type === 'git' ? '🔗 Dépôt Git' : '📦 Archive ZIP'}</p>
            <p><strong>Fichiers analysés:</strong> ${project.fileCount || "Calcul en cours..."}</p>
            <p><strong>Analyse le:</strong> ${project.createdAt ? new Date(project.createdAt).toLocaleDateString('fr-FR') : "N/A"}</p>
            <p><strong>ID du projet:</strong> <code style="font-size: 12px;">${project.id || "N/A"}</code></p>
        </div>
    `;

    // === AJOUT OWASP ===
    if (project.index && project.index.owaspCategories) {

        let owaspHtml = `<hr><h3>🎯 Catégories OWASP détectées</h3><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">`;

        for (let category in project.index.owaspCategories) {
            owaspHtml += `
                <div style="padding: 10px; background-color: #ecf0f1; border-radius: 6px; border-left: 4px solid #8e44ad;">
                    <strong>${category}</strong><br>
                    <span style="font-size: 18px; color: #8e44ad;">${project.index.owaspCategories[category]}</span> détection(s)
                </div>
            `;
        }

        owaspHtml += "</div>";

        summaryDiv.innerHTML += owaspHtml;
    }

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
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {

            const savedProject = JSON.parse(localStorage.getItem("projectData"));
            savedProject.fileCount = data.project.fileCount;

            if (data.project.index && data.project.index.owaspCategories) {
                savedProject.index = data.project.index;
            }

            localStorage.setItem("projectData", JSON.stringify(savedProject));
            
            if (savedProject.index && savedProject.index.owaspCategories) {
                loadDashboard();
            }

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

// Récupère les résultats des scans avec polling
async function loadScanResults(projectId) {
    const token = localStorage.getItem("token");
    let attempts = 0;
    const maxAttempts = 120;
    const pollInterval = 1000; // 1 seconde
    
    // Afficher le loader
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "flex";

    return new Promise((resolve) => {
        const pollTimer = setInterval(async () => {
            attempts++;

            try {
                const response = await fetch(
                    `${API_URL}/api/score/${projectId}`,
                    {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                // Les scans sont terminés si on a des vulnérabilités (même un array vide)
                // ET que c'est pas juste les données initiales
                if (data.success && data.score !== null && data.results && Array.isArray(data.results)) {
                    console.log(`✅ Résultats reçus: ${data.results.length} vulnérabilités, score ${data.score}`);
                    clearInterval(pollTimer);
                    // Masquer le loader
                    if (loading) loading.style.display = "none";
                    displayScanResults(data.score, data.results);
                    resolve(data);
                    return;
                }

                console.log(`⏳ Attente des résultats... (tentative ${attempts}/${maxAttempts})`);

                if (attempts >= maxAttempts) {
                    clearInterval(pollTimer);
                    if (loading) loading.style.display = "none";
                    console.warn("⚠️ Timeout - analyse non terminée dans le délai imparti");
                    resolve(null);
                    return;
                }

            } catch (error) {
                console.error("❌ Erreur polling:", error);
                if (attempts >= maxAttempts) {
                    clearInterval(pollTimer);
                    if (loading) loading.style.display = "none";
                    resolve(null);
                }
            }
        }, pollInterval);
    });
}

// Affiche les résultats des scans avec formatage amélioré
function displayScanResults(score, vulnerabilities) {
    const scoreDiv = document.getElementById("score");
    const resultsDiv = document.getElementById("results");

    if (!scoreDiv || !resultsDiv) {
        console.error("Divs de résultats non trouvés");
        return;
    }

    // === AFFICHAGE DU SCORE ===
    let scoreClass = "score-poor";
    let statusText = "⚠️ Critique";
    if (score >= 90) {
        scoreClass = "score-excellent";
        statusText = "✅ Excellent";
    } else if (score >= 70) {
        scoreClass = "score-good";
        statusText = "⚠️ Bon";
    } else if (score >= 50) {
        scoreClass = "score-fair";
        statusText = "⚠️ Acceptable";
    }

    scoreDiv.innerHTML = `
        <div class="score-display ${scoreClass}">
            ${score}/100 - ${statusText}
        </div>
    `;

    // === STATISTIQUES PAR SÉVÉRITÉ ===
    const stats = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    };

    vulnerabilities.forEach(vuln => {
        if (stats.hasOwnProperty(vuln.severity)) {
            stats[vuln.severity]++;
        }
    });

    let statsHtml = `
        <div style="margin-bottom: 20px;">
            <h3>📈 Résumé des vulnérabilités</h3>
            <div class="statistics">
                <div class="stat-card stat-critical">
                    <div style="font-size: 24px;">${stats.CRITICAL}</div>
                    <div>CRITICAL</div>
                </div>
                <div class="stat-card stat-high">
                    <div style="font-size: 24px;">${stats.HIGH}</div>
                    <div>HIGH</div>
                </div>
                <div class="stat-card stat-medium">
                    <div style="font-size: 24px;">${stats.MEDIUM}</div>
                    <div>MEDIUM</div>
                </div>
                <div class="stat-card stat-low">
                    <div style="font-size: 24px;">${stats.LOW}</div>
                    <div>LOW</div>
                </div>
            </div>
        </div>
    `;

    // === LISTES DES VULNÉRABILITÉS ===
    let vulnHtml = `<div class="vulnerabilities-list">`;
    vulnHtml += `<h3>🔍 Vulnérabilités détectées (${vulnerabilities.length})</h3>`;

    if (vulnerabilities.length === 0) {
        vulnHtml += `<div class="no-vulnerabilities">✅ Aucune vulnérabilité détectée!</div>`;
    } else {
        const vulnsBySeverity = {
            CRITICAL: [],
            HIGH: [],
            MEDIUM: [],
            LOW: []
        };

        vulnerabilities.forEach(vuln => {
            if (vulnsBySeverity.hasOwnProperty(vuln.severity)) {
                vulnsBySeverity[vuln.severity].push(vuln);
            }
        });

        ["CRITICAL", "HIGH", "MEDIUM", "LOW"].forEach(severity => {
            if (vulnsBySeverity[severity].length > 0) {
                vulnHtml += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #2c3e50; border-bottom: 2px solid #bdc3c7; padding-bottom: 8px;">
                    ${severity} (${vulnsBySeverity[severity].length})
                </h4>`;

                vulnsBySeverity[severity].forEach(vuln => {
                    const vulnClass = `vuln-${severity.toLowerCase()}`;
                    const badgeClass = `vuln-badge-${severity.toLowerCase()}`;
                    
                    // Gérer le cas où le fichier est inconnu
                    const fileDisplay = vuln.file === 'unknown' || !vuln.file 
                        ? '❓ Emplacement non identifié' 
                        : `<code style="background-color: #ecf0f1; padding: 2px 6px; border-radius: 3px;">${vuln.file}</code>`;
                    
                    const lineDisplay = vuln.line === 0 || !vuln.line ? '' : ` (ligne ${vuln.line})`;

                    vulnHtml += `
                        <div class="vulnerability-item ${vulnClass}">
                            <strong style="font-size: 16px; color: #2c3e50;">${vuln.title}</strong>
                            <div class="vuln-details">
                                <span class="vuln-badge ${badgeClass}">${vuln.severity}</span>
                                <span class="vuln-badge" style="background-color: #34495e; color: white;">${vuln.tool}</span>
                                ${vuln.owasp ? `<span class="vuln-badge" style="background-color: #8e44ad; color: white;">${vuln.owasp}</span>` : ''}
                                <br><br>
                                <div style="margin-bottom: 8px;"><strong>📄 Fichier:</strong> ${fileDisplay}${lineDisplay}</div>
                                <div style="background-color: #fafafa; padding: 12px; border-radius: 4px; border-left: 3px solid #34495e; margin-top: 8px;">
                                    <strong>📝 Détails:</strong>
                                    <div style="color: #34495e; white-space: pre-wrap; font-family: monospace; font-size: 13px; margin-top: 6px;">
${vuln.description || "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
        });
    }

    vulnHtml += `</div>`;

    resultsDiv.innerHTML = statsHtml + vulnHtml;
}

if (window.location.pathname.includes("dashboard.html")) {
    loadDashboard();
    const projectId = localStorage.getItem("projectId");
    if (projectId) {
        console.log("[DEBUG] Lancement du polling pour:", projectId);
        loadScanResults(projectId);
    } else {
        console.log("[DEBUG] Pas de projectId trouvé");
    }
}

// Charge les projets d'un user
async function loadUserProjects() {

    const token = localStorage.getItem("token");

    try {

        const response = await fetch(`${API_URL}/api/projects`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!data.success) {
            document.getElementById("projectsList").innerHTML = "Erreur chargement projets";
            return;
        }

        const projects = data.projects;

        if (!projects || projects.length === 0) {
            document.getElementById("projectsList").innerHTML = "Aucun projet analysé.";
            return;
        }

        let html = "<ul>";

        projects.forEach(project => {
            html += `
                <li>
                    <strong>${project.libelle_project || project.project_name}</strong>
                    - ${project.createdAt}
                    <button onclick="loadProject('${project.id}')">
                        Voir
                    </button>
                </li>
            `;
        });

        html += "</ul>";

        document.getElementById("projectsList").innerHTML = html;

    } catch (error) {
        console.error(error);
        document.getElementById("projectsList").innerHTML = "Erreur serveur.";
    }
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
                "Authorization": `Bearer ${token}`
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
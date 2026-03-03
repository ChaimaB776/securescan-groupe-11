const API_URL = "http://localhost:5000"; // Adapter au backend


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


//  LOGIN / REGISTER 

function showLogin() {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("loginTab").classList.add("active");
    document.getElementById("registerTab").classList.remove("active");
}

function showRegister() {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("registerForm").style.display = "block";
    document.getElementById("registerTab").classList.add("active");
    document.getElementById("loginTab").classList.remove("active");
}


//  REGISTER

async function register() {

    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        alert("Compte créé !");
        showLogin();

    } catch (error) {
        alert(error.message);
    }
}


//  LOGIN

async function login() {

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        localStorage.setItem("token", data.token);
        window.location.href = "index.html";

    } catch (error) {
        alert("Email ou mot de passe incorrect");
    }
}


//  LOGOUT

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}


//  ANALYSE

async function analyze() {

    const token = localStorage.getItem("token");

    const gitLink = document.getElementById("gitLink").value;
    const codeInput = document.getElementById("codeInput").value;

    const payload = gitLink 
        ? { gitUrl: gitLink } 
        : { code: codeInput };

    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) throw new Error("Erreur analyse");

        localStorage.setItem("results", JSON.stringify(data.vulnerabilities));
        localStorage.setItem("score", data.score);

        window.location.href = "dashboard.html";

    } catch (error) {
        alert(error.message);
    }
}


//  DASHBOARD

function loadResults() {

    const results = JSON.parse(localStorage.getItem("results")) || [];
    const score = localStorage.getItem("score") || 0;

    const scoreElement = document.getElementById("score");
    const progress = document.getElementById("scoreProgress");
    const resultsDiv = document.getElementById("results");

    if (!scoreElement) return;

    scoreElement.innerText = score;
    progress.style.width = score + "%";

    resultsDiv.innerHTML = "";

    results.forEach(vuln => {
        const div = document.createElement("div");
        div.classList.add("vuln", vuln.severity);
        div.innerHTML = `
            <strong>${vuln.severity}</strong> - ${vuln.name}
            <br><small>${vuln.category}</small>
        `;
        resultsDiv.appendChild(div);
    });
}

function filterResults() {

    const filter = document.getElementById("filter").value;
    const results = JSON.parse(localStorage.getItem("results")) || [];
    const resultsDiv = document.getElementById("results");

    resultsDiv.innerHTML = "";

    results
        .filter(v => filter === "all" || v.severity === filter)
        .forEach(vuln => {
            const div = document.createElement("div");
            div.classList.add("vuln", vuln.severity);
            div.innerHTML = `
                <strong>${vuln.severity}</strong> - ${vuln.name}
                <br><small>${vuln.category}</small>
            `;
            resultsDiv.appendChild(div);
        });
}

if (window.location.pathname.includes("dashboard.html")) {
    loadResults();
}
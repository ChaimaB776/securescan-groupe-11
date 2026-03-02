function analyze() {

    const fakeResults = [
        { name: "Injection SQL", severity: "High", category: "OWASP A03" },
        { name: "Cross-Site Scripting (XSS)", severity: "Medium", category: "OWASP A07" },
        { name: "Mauvaise configuration headers", severity: "Low", category: "OWASP A05" }
    ];

    const score = 72;

    localStorage.setItem("results", JSON.stringify(fakeResults));
    localStorage.setItem("score", score);

    window.location.href = "dashboard.html";
}

function loadResults() {

    const results = JSON.parse(localStorage.getItem("results")) || [];
    const score = localStorage.getItem("score") || 0;

    document.getElementById("score").innerText = score;
    document.getElementById("scoreProgress").style.width = score + "%";

    const resultsDiv = document.getElementById("results");
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

function goBack() {
    window.location.href = "index.html";
}

if (window.location.pathname.includes("dashboard.html")) {
    loadResults();
}
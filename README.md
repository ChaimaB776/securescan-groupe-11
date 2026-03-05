# SecureScan - Analyse de Sécurité Multi-Scanner

> Plateforme web d'analyse de sécurité complète utilisant 6 scanners spécialisés en parallèle

## À propos

SecureScan est une application web permettant l'analyse automatisée de projets Git ou ZIP pour détecter les vulnérabilités de sécurité. Le système utilise une architecture multi-scanner qui lance en parallèle :

- **Semgrep** : Analyse statique du code (SAST)
- **npm audit** : Détection des dépendances vulnérables
- **ESLint** : Analyse de qualité et sécurité JavaScript/TypeScript
- **TruffleHog** : Détection de secrets dans l'historique Git
- **Bandit** : Analyse de sécurité Python
- **Composer Audit** : Vérification des dépendances PHP

Les résultats sont catégorisés selon OWASP 2025, notés sur 100, et exportables en PDF.

## Fonctionnalités

### Analyse Multi-Langue
Le système détecte automatiquement le type de projet et adapte les scanners :
- Projets Node.js (npm audit + ESLint + Semgrep)
- Projets Python (Bandit + Semgrep)
- Projets PHP (Composer + Semgrep)

### Scoring Intelligent
- Formule adaptée : CRITICAL=0, sinon 100-(HIGH×20+MEDIUM×10+LOW×3)
- Plage 0-100 pour évaluation de la sécurité globale
- Sommaire par sévérité et type de vulnérabilité

### Gestion Utilisateurs
- Authentification JWT
- Isolation des projets par utilisateur
- Historique complet des scans
- Téléchargement de rapports PDF

### Génération de Rapports
- PDF professionnels avec Semgrep et npm audit
- Titre, date, score de sécurité
- Listing détaillé des vulnérabilités
- Export automatique après chaque scan

## Installation

### Prérequis
- Node.js 16+
- MySQL 8+
- Git
- Semgrep, ESLint, npm audit (installés automatiquement)
- Python 3.8+ (pour Bandit)
- PHP 7.4+ (pour Composer, optionnel)

### Configuration

1. **Cloner le repository**
```bash
git clone <url-du-repo>
cd securescan-groupe-11
```

2. **Installer les dépendances backend**
```bash
cd Back
npm install
```

3. **Configurer la base de données**

Créer un fichier `.env` dans `Back/` :
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_password
DB_NAME=securescan
DB_PORT=3306
JWT_SECRET=votre_clé_secrète
```

Initialiser la base de données avec MySQL :
```bash
# Option 1 : Via CLI MySQL
mysql -u root -p < database/bdd.sql

# Option 2 : Via PHPMyAdmin ou client MySQL
# Ouvrir database/bdd.sql et exécuter le script
```

Le script `database/bdd.sql` crée :
- Base de données `SecureScan`
- Table `users` (authentification)
- Table `scans` (résultats des analyses)

4. **Lancer le serveur**
```bash
npm run dev
```

5. **Accéder à l'application**
- Frontend : `http://localhost:3000`
- Backend API : `http://localhost:3000/api`

## Utilisation

### Créer un projet

1. **Via Git** : Entrer l'URL du repository
   ```
   https://github.com/user/project.git
   ```

2. **Via ZIP** : Uploader une archive

3. **Automatiquement** :
   - Installation des dépendances (npm install)
   - Création de la config ESLint v10
   - Lancement des 6 scanners en parallèle

### Consulter les résultats

- **Dashboard** : Vue d'ensemble du score et résumé
- **Vulnérabilités** : Liste complète, triable par sévérité
- **PDF** : Rapport téléchargeable
- **Suppression** : Nettoyage de la base de données et du disque

## Architecture

### Backend (Node.js + Express)

```
Back/src/
├── controllers/     # Logique des endpoints
├── routes/         # Définition des routes API
├── services/       # Métier (scanning, PDF, projets)
├── utils/          # Helpers (OWASP mapping, détection type)
└── config/         # Base de données
```

### Frontend (Vanilla JS)

```
frontend/
├── login.html      # Login/Signup
├── index.html      # page d'upload du code
├── dashboard.html  # Résultats d'analyse
├── profile.html    # Gestion des projets
└── script.js       # Logique client + polling
```

### Flux d'exécution

1. Utilisateur clone/upload un projet
2. Backend crée une entrée en base de données
3. `prepareProjectForScanning()` installe les dépendances (background)
4. `scanProject()` lance 6 scanners en parallèle via `Promise.allSettled()`
5. Résultats normalisés + mapping OWASP
6. Score calculé et PDF généré
7. Base de données mise à jour
8. Frontend récupère via polling `/api/score/:id`

## Technologies

### Backend
- **Express.js** : Framework web
- **MySQL2** : Base de données
- **PDFKit** : Génération de rapports
- **jsonwebtoken** : Authentification
- **Semgrep, npm audit, ESLint, etc.** : Scanners

### Frontend
- **HTML5/CSS3** : Interface
- **LocalStorage** : Persistance tokens
- **Fetch API** : Appels backend

### DevOps
- **nodemon** : Rechargement automatique
- **git** : Clonage de projets
- **unzipper** : Extraction d'archives

## Améliorations Futures

- push sur git via une branche fix quand correction possible
- ajout de l'ia dans les résolutions de problèmes

**Groupe 11** | Projet Sécurité | 2026


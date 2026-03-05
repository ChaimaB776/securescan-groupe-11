const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Service PDF simple - Génère un rapport de scan
 */

async function generatePDF(projectName, score, vulnerabilities) {
  try {
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Nom du fichier: {libelle_project}_{timestamp}.pdf
    const timestamp = new Date().toISOString().split('T')[0];
    const safeProjectName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeProjectName}_${timestamp}.pdf`;
    const pdfPath = path.join(reportsDir, filename);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // En-tête
    doc.fontSize(24).font('Helvetica-Bold').text('Rapport de Sécurité', { underline: true });
    doc.fontSize(12).text(`Projet: ${projectName}`);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`);
    doc.moveDown(2);

    // Score
    doc.fontSize(18).font('Helvetica-Bold').text(`Score: ${score}/100`);
    const scoreStatus = score >= 90 ? '✅ Excellent' : score >= 70 ? '⚠️ Bon' : score >= 50 ? '⚠️ Moyen' : '❌ Faible';
    doc.fontSize(12).text(`Statut: ${scoreStatus}`);
    doc.moveDown(2);

    // Statistiques
    const stats = {
      CRITICAL: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
      HIGH: vulnerabilities.filter(v => v.severity === 'HIGH').length,
      MEDIUM: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
      LOW: vulnerabilities.filter(v => v.severity === 'LOW').length,
      TOTAL: vulnerabilities.length
    };

    doc.fontSize(14).font('Helvetica-Bold').text('Statistiques');
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total: ${stats.TOTAL} vulnérabilités`);
    doc.text(`  🔴 CRITICAL: ${stats.CRITICAL}`);
    doc.text(`  🔴 HIGH: ${stats.HIGH}`);
    doc.text(`  🟡 MEDIUM: ${stats.MEDIUM}`);
    doc.text(`  🟢 LOW: ${stats.LOW}`);
    doc.moveDown(2);

    // Détails des vulnérabilités
    if (vulnerabilities.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Vulnérabilités');
      doc.moveDown(1);

      vulnerabilities.forEach((vuln, idx) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. [${vuln.severity}] ${vuln.title}`);
        doc.fontSize(10).font('Helvetica');
        doc.text(`   Tool: ${vuln.tool}`);
        doc.text(`   File: ${vuln.file}${vuln.line > 0 ? `:${vuln.line}` : ''}`);
        if (vuln.description) {
          doc.text(`   Desc: ${vuln.description.substring(0, 100)}`);
        }
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(12).font('Helvetica').text('✅ Aucune vulnérabilité');
    }

    // Pied de page
    doc.moveDown(2);
    doc.fontSize(9).text(`Généré par SecureScan - ${new Date().toLocaleString('fr-FR')}`);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        console.log(`📄 PDF: ${filename}`);
        resolve(filename);
      });
      stream.on('error', reject);
    });
  } catch (err) {
    console.error(`❌ PDF Error: ${err.message}`);
    return null;
  }
}

module.exports = { generatePDF };

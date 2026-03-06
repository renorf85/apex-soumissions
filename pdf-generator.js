/* =====================================================
   APEX SOUMISSIONS - PDF Generator v3.0
   Design basé sur le template Excel de Gabriel
   (Modèle - Soumission 000XXX)
   ===================================================== */

// Utilise jsPDF (global: jspdf.jsPDF)
// Utilise pdf-lib pour fusion des PDFs légaux

// =====================================================
// CONSTANTES ET CONFIGURATION
// =====================================================

const PDF_CONFIG = {
    // Dimensions (en mm, format Letter)
    pageWidth: 215.9,
    pageHeight: 279.4,
    margin: 15,

    // Couleurs — palette épurée noir/gris
    primaryBlue: [0, 0, 0],              // Noir — titre, total
    borderBlue: [180, 180, 180],         // Gris — bordures tableau
    subtotalBorderBlue: [180, 180, 180], // Gris — bordures sous-total
    accentTan: [0, 0, 0],               // Noir — labels secondaires
    textColor: [0, 0, 0],               // Noir
    mutedColor: [120, 120, 120],         // Gris moyen
    lightGray: [243, 243, 243],          // #F3F3F3
    redColor: [220, 50, 50],             // Rouge discret

    // Polices — hiérarchie inspirée du template Excel
    fontSizes: {
        documentTitle: 26,     // "SOUMISSION 000XXX"
        companyName: 18,       // "APEX DÉSAMIANTAGE INC."
        sectionTitle: 10,      // Headers de section (soulignés)
        tableHeader: 9,        // En-têtes colonnes tableau
        body: 9,               // Texte courant
        item: 8,               // Items de ligne
        small: 8,              // Petit texte
        label: 10,             // Labels ("Facturé à:")
        footer: 6              // Footer validité
    },

    // Largeurs colonnes tableau (total = contentWidth ≈ 185.9mm)
    tableColumns: {
        description: 120,
        prixUnit: 22,
        qte: 22,
        montant: 21.9
    },

    // Hauteurs de lignes
    lineHeight: {
        tableRow: 6,
        sectionHeader: 8,
        bodyText: 4.5
    }
};

// Variable de contexte pour les en-têtes de continuation
let _currentSoumissionNumber = '';

// =====================================================
// FONCTION PRINCIPALE
// =====================================================

async function generatePDF(options) {
    const {
        state,
        configTextes,
        signature,
        companySignature,
        includePhotos,
        includeLegalDocs,
        inclusions,
        exclusions,
        soumissionNumber,
        date
    } = options;

    _currentSoumissionNumber = soumissionNumber;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
    });

    // 1. Document principal (en-tête, client, items, totaux, notes, exclusions)
    await createMainDocument(doc, state, configTextes, soumissionNumber, date, exclusions);

    // 2. Pages photos et mesures (optionnel)
    if (includePhotos && state.zones && state.zones.length > 0) {
        const hasPhotos = state.zones.some(zone =>
            zone.surfaces && zone.surfaces.some(s => s.photo)
        );
        if (hasPhotos) {
            doc.addPage();
            await createPhotosPages(doc, state.zones);
        }
    }

    // 3. Contrat de services (8 sections)
    doc.addPage();
    await createContractPages(doc, configTextes);

    // 4. Paiement + Double signature
    doc.addPage();
    await createPaymentAndSignaturePage(doc, signature, companySignature, configTextes, state.client, date);

    // 5. Annexer documents légaux (licence RBQ, assurance)
    if (includeLegalDocs) {
        const pdfWithAnnexes = await appendLegalDocuments(doc);
        if (pdfWithAnnexes) {
            return pdfWithAnnexes;
        }
    }

    return doc.output('blob');
}

// =====================================================
// UTILITAIRES DE PAGINATION
// =====================================================

function checkPageBreak(doc, y, requiredSpace = 20) {
    if (y + requiredSpace > PDF_CONFIG.pageHeight - 20) {
        doc.addPage();
        drawContinuationHeader(doc);
        return PDF_CONFIG.margin + 12;
    }
    return y;
}

function drawContinuationHeader(doc) {
    const { margin, pageWidth, mutedColor } = PDF_CONFIG;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text(`SOUMISSION ${_currentSoumissionNumber} — Suite`, margin, margin);
    doc.setDrawColor(...mutedColor);
    doc.setLineWidth(0.2);
    doc.line(margin, margin + 2, pageWidth - margin, margin + 2);
}

function drawPageFooter(doc, configTextes) {
    const { margin, pageWidth, pageHeight, mutedColor } = PDF_CONFIG;
    const footerY = pageHeight - 8;
    doc.setFontSize(PDF_CONFIG.fontSizes.footer);
    doc.setTextColor(...mutedColor);
    doc.text(
        '*La soumission sera valide dans un délai de 30 jours.',
        margin, footerY
    );
    doc.text(
        "*Des frais d'administration seront facturés s'il y a annulation des travaux suite à l'acceptation de la soumission.",
        margin, footerY + 3
    );
}

// =====================================================
// CALCUL DES TAXES
// =====================================================

function calculateTaxes(preTaxTotal) {
    const tps = Math.round(preTaxTotal * 0.05 * 100) / 100;
    const tvq = Math.round(preTaxTotal * 0.09975 * 100) / 100;
    return {
        sousTotal: preTaxTotal,
        tps,
        tvq,
        grandTotal: Math.round((preTaxTotal + tps + tvq) * 100) / 100
    };
}

// =====================================================
// CONSTRUCTION DES ITEMS DE LIGNE
// =====================================================

function buildLineItems(state) {
    const travauxItems = [];
    const fraisItems = [];
    const prix = state.prix || {};
    const zones = state.zones || [];
    const risqueGlobal = state.risqueGlobal || 'MODÉRÉ';

    // ─── GROUPE 1 : Travaux de désamiantage (format liste) ───
    zones.forEach(zone => {
        const risqueLabel = zone.risque === 'ÉLEVÉ' ? 'risque élevé' :
                           zone.risque === 'ÉLEVÉ_ALLÉGÉ' ? 'risque élevé allégé' :
                           'risque modéré';
        const surface = formatNumber(zone.surface || zone.surfaceTotal || 0);
        travauxItems.push({
            description: `Retrait de ${(zone.materiauNom || 'matériaux').toLowerCase()} contenant de l'amiante (${risqueLabel}) — ${zone.nom} (${surface} pi²)`
        });
    });

    const zoneCount = `${zones.length} zone${zones.length > 1 ? 's' : ''}`;
    travauxItems.push({ description: `Mise en place du confinement étanche avec polyéthylène (${zoneCount})` });
    travauxItems.push({ description: "Utilisation d'outils et méthodes réduisant la libération de fibres (Forfait)" });
    travauxItems.push({ description: "Gestion, ensachage et étiquetage des déchets d'amiante (Forfait)" });
    travauxItems.push({ description: 'Nettoyage final avec aspirateur HEPA (Forfait)' });

    if (risqueGlobal === 'ÉLEVÉ_ALLÉGÉ' || risqueGlobal === 'ÉLEVÉ') {
        travauxItems.push({ description: 'Ventilateur HEPA à pression négative (Durée travaux)' });
    }

    if (risqueGlobal === 'ÉLEVÉ') {
        travauxItems.push({ description: `Installation douche(s) de décontamination (${state.doucheCount ?? 1})` });
        travauxItems.push({ description: "Tests d'air (entrée et sortie de zone) (Inclus)" });
    }

    const travauxTotalBrut = (prix.zones || 0) + (prix.demolition || 0) +
                         (prix.ventilateur || 0) + (prix.douches || 0) +
                         (prix.tests || 0) + (prix.perteTemps || 0);

    // Marge intégrée invisiblement dans chaque prix affiché au client
    const margeMultiplier = 1 + ((prix.margePourcent || 20) / 100);

    // Ventilation des coûts travaux (avec marge intégrée)
    const travauxCostBreakdown = [];
    if (prix.demolition > 0) travauxCostBreakdown.push({ label: 'Démolition', amount: prix.demolition * margeMultiplier });
    if (prix.zones > 0) travauxCostBreakdown.push({ label: 'Frais de zone', amount: prix.zones * margeMultiplier });
    if (prix.douches > 0) travauxCostBreakdown.push({ label: 'Douches de décontamination', amount: prix.douches * margeMultiplier });
    if (prix.tests > 0) travauxCostBreakdown.push({ label: "Tests d'air", amount: prix.tests * margeMultiplier });
    if (prix.ventilateur > 0) travauxCostBreakdown.push({ label: 'Ventilateur HEPA', amount: prix.ventilateur * margeMultiplier });
    if (prix.perteTemps > 0) travauxCostBreakdown.push({ label: 'Perte de temps', amount: prix.perteTemps * margeMultiplier });

    const travauxTotal = travauxTotalBrut * margeMultiplier;

    // ─── GROUPE 2 : Frais généraux (format tableau, avec marge intégrée) ───
    fraisItems.push({
        description: 'Assurance responsabilité civile 5 000 000 $',
        qte: '1',
        prixUnit: formatNumber((prix.assurance || 0) * margeMultiplier, 2) + ' $',
        prixTotal: (prix.assurance || 0) * margeMultiplier
    });

    fraisItems.push({
        description: 'Gestion et évacuation des rebuts',
        qte: '1',
        prixUnit: formatNumber((prix.disposition || 0) * margeMultiplier, 2) + ' $',
        prixTotal: (prix.disposition || 0) * margeMultiplier
    });

    fraisItems.push({
        description: 'Frais de déplacement',
        qte: '1',
        prixUnit: formatNumber((prix.transport || 0) * margeMultiplier, 2) + ' $',
        prixTotal: (prix.transport || 0) * margeMultiplier
    });

    return { travauxItems, travauxCostBreakdown, travauxTotal, fraisItems };
}

// =====================================================
// DOCUMENT PRINCIPAL (Pages 1+)
// =====================================================

async function createMainDocument(doc, state, configTextes, soumissionNumber, date, exclusions) {
    const { margin, pageWidth, primaryBlue, textColor, accentTan, borderBlue } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // ─── SECTION 1 : Titre de la soumission (aligné gauche, grand) ───

    // Logo icône "A" en haut à droite
    try {
        const logoImg = await loadImage('assets/logo-apex-icon.png');
        doc.addImage(logoImg, 'PNG', pageWidth - margin - 18, y, 18, 18);
    } catch (e) {
        // Pas de logo, on continue
    }

    // Titre "SOUMISSION 000XXX" — 26pt, bleu clair, aligné gauche
    doc.setFontSize(PDF_CONFIG.fontSizes.documentTitle);
    doc.setTextColor(...primaryBlue);
    doc.text(`SOUMISSION ${soumissionNumber}`, margin, y + 12);

    y += 14;

    // Bordure épaisse sous le titre
    doc.setDrawColor(...textColor);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageWidth - margin - 25, y);

    y += 6;

    // Date
    const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text(dateStr, margin, y);

    y += 6;

    // Nom entreprise — 18pt bold
    doc.setFontSize(PDF_CONFIG.fontSizes.companyName);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text(configTextes.entreprise_nom || 'APEX DÉSAMIANTAGE INC.', margin, y);
    doc.setFont(undefined, 'normal');

    y += 2;

    // Bordure fine sous le nom
    doc.setDrawColor(...borderBlue);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 100, y);

    y += 6;

    // ─── SECTION 2 : Info client (2 colonnes, style épuré) ───

    const colWidth = contentWidth / 2 - 5;
    const leftX = margin;
    const rightX = margin + colWidth + 10;

    // Colonne gauche : Facturé à
    doc.setFontSize(PDF_CONFIG.fontSizes.label);
    doc.setTextColor(...textColor);
    doc.text('Facturé à:', leftX, y);

    // Colonne droite : Adresse des travaux
    doc.text('Adresse des travaux:', rightX, y);

    y += 6;

    // Client info — couleur tan
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accentTan);
    doc.text(state.client.nom || 'Client', leftX, y);
    doc.setFont(undefined, 'normal');

    // Adresse travaux
    doc.setFont(undefined, 'bold');
    if (state.client.adresseChantier) {
        doc.text(state.client.adresseChantier, rightX, y);
    }
    doc.setFont(undefined, 'normal');

    y += 5;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);

    // Adresse facturation
    let clientY = y;
    const billingAddr = state.client.adresseFacturation || state.client.adresseChantier || '';
    if (billingAddr) {
        doc.text(billingAddr, leftX, clientY);
        clientY += 4;
    }
    const billingCity = state.client.villeFacturation || '';
    if (billingCity) {
        doc.text(billingCity, leftX, clientY);
        clientY += 4;
    }
    if (state.client.courriel) {
        doc.text(state.client.courriel, leftX, clientY);
        clientY += 4;
    }
    if (state.client.telephone) {
        doc.text(state.client.telephone, leftX, clientY);
        clientY += 4;
    }

    // Description projet à droite
    let siteY = y + 5;
    if (state.client.descriptionProjet) {
        doc.setTextColor(...accentTan);
        const projLines = doc.splitTextToSize(state.client.descriptionProjet, colWidth - 5);
        doc.text(projLines, rightX, siteY);
    }

    y = Math.max(clientY, siteY) + 5;

    // Ligne de séparation légère
    doc.setDrawColor(...PDF_CONFIG.borderBlue);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);

    y += 5;

    // ─── SECTION 3 : Tableau d'items ───
    const lineData = buildLineItems(state);
    y = drawLineItemsTable(doc, lineData, y);

    // ─── SECTION 4 : Totaux avec taxes ───
    y = checkPageBreak(doc, y, 40);
    y = drawTotals(doc, state, configTextes, y);

    // ─── SECTION 5 : Non inclus, notes et exclusions ───
    y += 2;
    y = drawNotesAndExclusions(doc, exclusions, configTextes, state, y);

    // Pied de page
    drawPageFooter(doc, configTextes);
}

// =====================================================
// TABLEAU D'ITEMS (style Excel : bordures bleu fines)
// =====================================================

function drawLineItemsTable(doc, data, startY) {
    const { margin, pageWidth, textColor, borderBlue } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);
    const cols = PDF_CONFIG.tableColumns;

    let y = startY;

    // ─── PARTIE 1 : Travaux de désamiantage (format liste) ───

    // Titre de section
    doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Travaux de désamiantage', margin + 2, y);
    doc.setFont(undefined, 'normal');
    y += 5;

    // Items en liste simple
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);

    data.travauxItems.forEach(item => {
        y = checkPageBreak(doc, y, 7);
        const descLines = doc.splitTextToSize(item.description, contentWidth - 10);
        doc.text(descLines, margin + 5, y);
        y += descLines.length > 1 ? descLines.length * 4 + 1 : PDF_CONFIG.lineHeight.tableRow;
    });

    // ─── Ventilation des coûts travaux ───
    if (data.travauxCostBreakdown && data.travauxCostBreakdown.length > 0) {
        y += 2;
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text('Ventilation des coûts', margin + 5, y);
        doc.setFont(undefined, 'normal');
        y += 4;

        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);

        data.travauxCostBreakdown.forEach(item => {
            y = checkPageBreak(doc, y, 5);
            doc.text(item.label, margin + 8, y);
            doc.text(
                `${formatNumber(item.amount, 2)} $`,
                pageWidth - margin - 2, y,
                { align: 'right' }
            );
            y += 4;
        });
    }

    // Sous-total travaux
    y += 1;
    doc.setDrawColor(...borderBlue);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
    y += 4;

    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Sous-total travaux de désamiantage', margin + 5, y);
    doc.text(
        `${formatNumber(data.travauxTotal, 2)} $`,
        pageWidth - margin - 2, y,
        { align: 'right' }
    );
    doc.setFont(undefined, 'normal');
    y += 6;

    // ─── PARTIE 2 : Frais généraux (format tableau) ───

    const colX = {
        description: margin,
        prixUnit: margin + cols.description,
        qte: margin + cols.description + cols.prixUnit,
        montant: margin + cols.description + cols.prixUnit + cols.qte
    };

    // Titre de section
    doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Frais généraux', margin + 2, y);
    doc.setFont(undefined, 'normal');
    y += 4;

    // En-tête du tableau
    const headerY = y;
    doc.setFontSize(PDF_CONFIG.fontSizes.tableHeader);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Description', colX.description + 2, y + 4);
    doc.text('Prix unitaire', colX.prixUnit + 2, y + 4);
    doc.text('Quantité', colX.qte + 2, y + 4);
    doc.text('Montant', colX.montant + 2, y + 4);
    doc.setFont(undefined, 'normal');
    y += 6;

    // Ligne sous le header
    doc.setDrawColor(...borderBlue);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;

    // Lignes de données
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);

    data.fraisItems.forEach(item => {
        y += 4;
        doc.text(item.description, colX.description + 3, y);
        if (item.prixUnit) doc.text(item.prixUnit, colX.prixUnit + 2, y);
        if (item.qte) doc.text(item.qte, colX.qte + 2, y);
        if (typeof item.prixTotal === 'number') {
            doc.text(
                `${formatNumber(item.prixTotal, 2)} $`,
                pageWidth - margin - 2, y,
                { align: 'right' }
            );
        }
        y += 2;

        // Ligne horizontale entre les rangées
        doc.setDrawColor(...borderBlue);
        doc.setLineWidth(0.15);
        doc.line(margin, y, pageWidth - margin, y);
    });

    // Bordures verticales du tableau frais généraux
    doc.setDrawColor(...borderBlue);
    doc.setLineWidth(0.2);
    doc.line(margin, headerY - 1, margin, y);
    doc.line(colX.prixUnit, headerY - 1, colX.prixUnit, y);
    doc.line(colX.qte, headerY - 1, colX.qte, y);
    doc.line(colX.montant, headerY - 1, colX.montant, y);
    doc.line(pageWidth - margin, headerY - 1, pageWidth - margin, y);

    // Bordure supérieure du tableau
    doc.line(margin, headerY - 1, pageWidth - margin, headerY - 1);

    return y + 5;
}

// =====================================================
// TOTAUX AVEC TAXES (style tan du template Excel)
// =====================================================

function drawTotals(doc, state, configTextes, y) {
    const { margin, pageWidth, primaryBlue, textColor, accentTan, subtotalBorderBlue } = PDF_CONFIG;
    const prix = state.prix || {};

    const preTaxTotal = prix.total || 0;
    const taxes = calculateTaxes(preTaxTotal);

    const rightX = pageWidth - margin - 2;
    const labelX = pageWidth - margin - 65;

    // Bordure bleu à gauche de la zone totaux
    doc.setDrawColor(...subtotalBorderBlue);
    doc.setLineWidth(0.3);

    // Sous-total
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...accentTan);
    doc.text('Sous-total:', labelX, y);
    doc.text(`${formatNumber(taxes.sousTotal, 2)} $`, rightX, y, { align: 'right' });

    // Bordure droite
    doc.line(rightX + 1, y - 4, rightX + 1, y + 1);

    y += 5;

    // TPS avec numéro
    const tpsNum = configTextes.numero_tps || '74641 3558 RT0001';
    doc.text(`${tpsNum}  TPS/THV 5%`, labelX, y);
    doc.text(`${formatNumber(taxes.tps, 2)} $`, rightX, y, { align: 'right' });
    doc.line(rightX + 1, y - 4, rightX + 1, y + 1);

    y += 5;

    // TVQ avec numéro
    const tvqNum = configTextes.numero_tvq || '123 136 8511 TQ0001';
    doc.text(`${tvqNum}  TVQ 9,975%`, labelX, y);
    doc.text(`${formatNumber(taxes.tvq, 2)} $`, rightX, y, { align: 'right' });
    doc.line(rightX + 1, y - 4, rightX + 1, y + 1);

    y += 2;

    // Bordure sous TVQ
    doc.setDrawColor(...subtotalBorderBlue);
    doc.setLineWidth(0.3);
    doc.line(labelX, y, rightX + 1, y);

    y += 6;

    // Total — 10pt, bleu clair, PAS de box plein
    doc.setFontSize(PDF_CONFIG.fontSizes.label);
    doc.setTextColor(...primaryBlue);
    doc.text('Total:', labelX, y);
    doc.text(`${formatNumber(taxes.grandTotal, 2)} $`, rightX, y, { align: 'right' });

    // Bordure bleu sous le total
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(0.5);
    doc.line(labelX, y + 2, rightX + 1, y + 2);

    return y + 5;
}

// =====================================================
// NOTES ET EXCLUSIONS (sections soulignées)
// =====================================================

function drawNotesAndExclusions(doc, exclusions, configTextes, state, y) {
    const { margin, pageWidth, textColor, accentTan } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    // Non inclus — en premier pour rester sur la page 1 avec les totaux
    if (exclusions && exclusions.length > 0) {
        y = checkPageBreak(doc, y, 10);

        doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
        doc.setTextColor(...textColor);
        const exclTitle = 'Non inclus';
        doc.text(exclTitle, margin + 3, y);
        const eTitleWidth = doc.getTextWidth(exclTitle);
        doc.setDrawColor(...textColor);
        doc.setLineWidth(0.2);
        doc.line(margin + 3, y + 1, margin + 3 + eTitleWidth, y + 1);

        y += 5;
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        exclusions.forEach(item => {
            y = checkPageBreak(doc, y, 5);
            doc.text(`•  ${item}`, margin + 5, y);
            y += 4;
        });
        y += 2;
    }

    // Notes techniques
    const notes = configTextes.notes_techniques || '';
    if (notes && notes !== '[À configurer dans Settings]') {
        y = checkPageBreak(doc, y, 20);

        // Section header souligné
        doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
        doc.setTextColor(...textColor);
        const notesTitle = 'Notes & documentation consultée';
        doc.text(notesTitle, margin + 3, y);
        const titleWidth = doc.getTextWidth(notesTitle);
        doc.setDrawColor(...textColor);
        doc.setLineWidth(0.2);
        doc.line(margin + 3, y + 1, margin + 3 + titleWidth, y + 1);

        y += 6;
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        const noteLines = doc.splitTextToSize(notes, contentWidth - 8);
        doc.text(noteLines, margin + 5, y);
        y += noteLines.length * PDF_CONFIG.lineHeight.bodyText + 6;
    }

    // Description technique selon le risque
    let descriptif;
    if (state.risqueGlobal === 'ÉLEVÉ') {
        descriptif = configTextes.descriptif_risque_eleve || '';
    } else if (state.risqueGlobal === 'ÉLEVÉ_ALLÉGÉ') {
        descriptif = configTextes.descriptif_risque_eleve_allege || configTextes.descriptif_risque_modere || '';
    } else {
        descriptif = configTextes.descriptif_risque_modere || '';
    }

    if (descriptif && descriptif !== '[À configurer dans Settings]') {
        y = checkPageBreak(doc, y, 20);

        doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
        doc.setTextColor(...textColor);
        const descTitle = 'Description des travaux';
        doc.text(descTitle, margin + 3, y);
        const dTitleWidth = doc.getTextWidth(descTitle);
        doc.setDrawColor(...textColor);
        doc.setLineWidth(0.2);
        doc.line(margin + 3, y + 1, margin + 3 + dTitleWidth, y + 1);

        y += 6;
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        const descLines = doc.splitTextToSize(descriptif, contentWidth - 8);
        doc.text(descLines, margin + 5, y);
        y += descLines.length * PDF_CONFIG.lineHeight.bodyText + 6;
    }

    return y;
}

// =====================================================
// PAGES PHOTOS ET MESURES
// =====================================================

async function createPhotosPages(doc, zones) {
    const { margin, pageWidth, pageHeight, primaryBlue, textColor, accentTan } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // En-tête
    doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
    doc.setTextColor(...primaryBlue);
    const photosTitle = 'Photos et mesures';
    doc.text(photosTitle, margin, y);
    const ptWidth = doc.getTextWidth(photosTitle);
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1, margin + ptWidth, y + 1);

    y += 10;

    for (const zone of zones) {
        if (!zone.surfaces) continue;

        const surfacesWithPhotos = zone.surfaces.filter(s => s.photo);
        if (surfacesWithPhotos.length === 0) continue;

        if (y > pageHeight - 80) {
            doc.addPage();
            drawContinuationHeader(doc);
            y = margin + 12;
        }

        // Nom de zone
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text(zone.nom, margin, y);
        doc.setFont(undefined, 'normal');

        y += 5;
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...accentTan);
        doc.text(`${zone.materiauNom || zone.categorie} • ${formatNumber(zone.surface || zone.surfaceTotal || 0)} pi²`, margin, y);

        y += 8;

        for (const surface of surfacesWithPhotos) {
            if (y > pageHeight - 100) {
                doc.addPage();
                drawContinuationHeader(doc);
                y = margin + 12;
            }

            try {
                const imgWidth = contentWidth / 2 - 5;
                const imgHeight = 60;

                doc.addImage(surface.photo.dataUrl, 'JPEG', margin, y, imgWidth, imgHeight);

                const infoX = margin + imgWidth + 10;

                doc.setFontSize(PDF_CONFIG.fontSizes.body);
                doc.setTextColor(...textColor);
                doc.text(surface.nom || 'Surface', infoX, y + 10);

                doc.setFontSize(PDF_CONFIG.fontSizes.item);
                doc.setTextColor(...accentTan);
                doc.text(`Dimensions: ${surface.longueur || 0}' x ${surface.hauteur || 0}'`, infoX, y + 18);
                doc.text(`Surface: ${formatNumber(surface.surface || 0)} pi²`, infoX, y + 25);
                doc.text(`Épaisseur: ${zone.epaisseur || 0}"`, infoX, y + 32);

                y += imgHeight + 10;
            } catch (e) {
                console.warn('Erreur ajout photo:', e);
            }
        }

        y += 6;
    }
}

// =====================================================
// CONTRAT DE SERVICES (8 sections)
// =====================================================

async function createContractPages(doc, configTextes) {
    const { margin, pageWidth, primaryBlue, textColor } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // Titre — style souligné comme le template
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryBlue);
    doc.text('CONTRAT DE SERVICES', margin, y);
    doc.setFont(undefined, 'normal');

    y += 2;
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + doc.getTextWidth('CONTRAT DE SERVICES'), y);

    y += 10;

    // Textes par défaut des 8 sections
    const defaultTexts = {
        1: "Le présent contrat lie l'Entrepreneur et le Client identifiés en en-tête de la présente soumission. L'Entrepreneur s'engage à réaliser les travaux décrits pour le prix total stipulé ci-haut, conformément au Code de construction du Québec et aux règles de l'art.",
        2: "Un échéancier détaillé sera fourni par l'Entrepreneur lors de la signature. Les délais sont sujets à révision en cas de force majeure, météo ou retards d'approvisionnement. Le Client s'engage à fournir un accès libre au chantier et aux services (eau/électricité).",
        3: "L'obtention et les frais de tous les permis municipaux ou autorisations nécessaires sont la responsabilité exclusive du Client. Les travaux ne débuteront qu'une fois les permis obtenus et remis à l'Entrepreneur. Le Client garantit que les travaux sont conformes aux règlements de zonage ou de copropriété.",
        4: "Le prix soumis n'inclut pas la correction de conditions préexistantes non apparentes (ex: structure non conforme, présence d'amiante supplémentaire, moisissure, plomberie/électricité désuète). Si de telles conditions sont découvertes, les travaux seront suspendus et un avenant écrit sera requis avant de poursuivre.",
        5: "Acompte: 10% à la signature pour contrats de plus de 25 000 $. Paiements progressifs selon l'avancement défini à l'échéancier. Solde exigible immédiatement à la fin des travaux. Aucune retenue sans entente écrite préalable.",
        6: "Toute demande de travaux additionnels fera l'objet d'un avenant écrit détaillant les coûts et délais supplémentaires avant l'exécution. Sans approbation écrite de la part du client, ces travaux ne seront pas effectués.",
        7: "L'Entrepreneur détient une assurance responsabilité civile de 5 000 000 $ avec avenant pollution et une licence RBQ valide. Les travaux sont couverts par la garantie légale (Art. 2118 et 2120 du Code civil du Québec). Le Client peut résilier le contrat selon l'Art. 2125 du C.c.Q., moyennant le paiement des frais, travaux exécutés et profits perdus de l'Entrepreneur.",
        8: "En signant ci-dessous, le Client confirme avoir lu, compris et accepté les termes de la présente soumission et du présent contrat."
    };

    const sectionTitles = {
        1: 'CADRE LÉGAL ET OBJET',
        2: 'ÉCHÉANCIER ET ACCÈS',
        3: 'PERMIS ET RÈGLEMENTS',
        4: 'CONDITIONS IMPRÉVUES',
        5: 'MODALITÉS DE PAIEMENT',
        6: 'AJUSTEMENTS DE COÛTS',
        7: 'OBLIGATIONS ET GARANTIES',
        8: 'ACCEPTATION'
    };

    for (let i = 1; i <= 8; i++) {
        const text = configTextes[`contrat_section_${i}`] || defaultTexts[i];
        if (!text || text === '[À configurer dans Settings]') continue;

        const textLines = doc.splitTextToSize(text, contentWidth - 5);
        const neededSpace = 10 + textLines.length * PDF_CONFIG.lineHeight.bodyText;

        y = checkPageBreak(doc, y, Math.min(neededSpace, 40));

        // Titre de section — numéroté, bold
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...primaryBlue);
        doc.text(`${i}. ${sectionTitles[i]}`, margin, y);
        doc.setFont(undefined, 'normal');

        y += 5;

        // Contenu
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        doc.text(textLines, margin + 3, y);

        y += textLines.length * PDF_CONFIG.lineHeight.bodyText + 6;
    }
}

// =====================================================
// PAIEMENT + DOUBLE SIGNATURE (style Excel)
// =====================================================

async function createPaymentAndSignaturePage(doc, signatureDataUrl, companySignatureDataUrl, configTextes, client, date) {
    const { margin, pageWidth, pageHeight, primaryBlue, textColor, accentTan, lightGray } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // ─── PARTIE 1 : Modalités de paiement ───
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryBlue);
    const payTitle = 'PAIEMENT DE VOTRE FACTURE';
    doc.text(payTitle, margin, y);
    doc.setFont(undefined, 'normal');

    y += 2;
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + doc.getTextWidth(payTitle), y);

    y += 8;

    // Par chèque
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Par chèque:', margin, y);
    doc.setFont(undefined, 'normal');

    y += 5;
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...accentTan);
    const chequeDestinataire = configTextes.paiement_cheque_destinataire || 'Apex Désamiantage Inc.';
    const chequeAdresse = configTextes.paiement_cheque_adresse || '689 rue des Caryers, Québec, QC, G3G 2B4';
    doc.text(chequeDestinataire, margin + 5, y);
    y += 4;
    doc.text(chequeAdresse, margin + 5, y);

    y += 8;

    // Par virement Interac
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Par virement Interac:', margin, y);
    doc.setFont(undefined, 'normal');

    y += 5;
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...accentTan);
    doc.text(configTextes.paiement_interac_courriel || 'info@apexdesamiantage.com', margin + 5, y);

    y += 8;

    // Par virement bancaire
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Par virement bancaire:', margin, y);
    doc.setFont(undefined, 'normal');

    y += 5;
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...accentTan);
    doc.text(`Transit: ${configTextes.paiement_virement_transit || '20088'}`, margin + 5, y);
    y += 4;
    doc.text(`Institution: ${configTextes.paiement_virement_institution || '815'}`, margin + 5, y);
    y += 4;
    doc.text(`Compte: ${configTextes.paiement_virement_compte || '0984757'}`, margin + 5, y);

    y += 15;

    // ─── PARTIE 2 : Signatures (2 colonnes, style Excel) ───

    if (y > pageHeight - 110) {
        doc.addPage();
        y = margin;
    }

    const signataireName = configTextes.signataire_nom || 'Gabriel Maranda';
    const signataireTitre = configTextes.signataire_titre || 'Apex Désamiantage inc.';

    const halfWidth = contentWidth / 2 - 10;
    const leftCol = margin;
    const rightCol = margin + halfWidth + 20;

    // "AUTRES INFORMATIONS" — aligné droite, bleu
    doc.setFontSize(PDF_CONFIG.fontSizes.label);
    doc.setTextColor(...primaryBlue);
    doc.text('AUTRES INFORMATIONS', pageWidth - margin, y, { align: 'right' });

    y += 8;

    // Signature client à gauche
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);
    doc.text('Signature du client:', leftCol, y);

    // Info entreprise à droite (tan)
    doc.setTextColor(...accentTan);
    const entrepriseLines = [
        configTextes.entreprise_nom || 'Apex Désamiantage inc.',
        configTextes.entreprise_adresse || '689 rue des Caryers',
        configTextes.entreprise_ville || 'Québec (QC) G3G 2B4',
        configTextes.entreprise_telephone || '',
        configTextes.entreprise_courriel || '',
        configTextes.entreprise_site_web || ''
    ].filter(Boolean);

    let infoY = y;
    entrepriseLines.forEach(line => {
        doc.text(line, pageWidth - margin, infoY, { align: 'right' });
        infoY += 4;
    });

    y += 5;

    // Zone signature client (avec image si disponible)
    if (signatureDataUrl) {
        try {
            doc.addImage(signatureDataUrl, 'PNG', leftCol, y, halfWidth, 25);
        } catch (e) {
            console.warn('Erreur ajout signature client:', e);
        }
    }

    y += 28;

    // Ligne de signature client
    doc.setDrawColor(...textColor);
    doc.setLineWidth(0.3);
    doc.line(leftCol, y, leftCol + halfWidth, y);
    y += 4;
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);
    doc.text(client.nom || '', leftCol, y);

    y += 10;

    // Signature entrepreneur
    doc.text('Signature de l\'entrepreneur:', leftCol, y);
    y += 5;

    // Company signature image (if available from Settings)
    if (companySignatureDataUrl) {
        try {
            doc.addImage(companySignatureDataUrl, 'PNG', leftCol, y, halfWidth, 25);
        } catch (e) {
            console.warn('Erreur ajout signature entrepreneur:', e);
        }
    }

    y += 28;
    doc.line(leftCol, y, leftCol + halfWidth, y);

    const entreY = y + 4;
    doc.text(signataireName, leftCol, entreY);
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...accentTan);
    doc.text(signataireTitre, leftCol, entreY + 4);

    // RBQ
    const rbq = configTextes.entreprise_licence_rbq || '5847-5401-01';
    doc.text(`RBQ: ${rbq}`, leftCol, entreY + 8);

    // Dates
    y = entreY + 15;
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);

    if (date) {
        const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`Date: ${dateStr}`, leftCol, y);
    }

    // Footer validité
    y = pageHeight - 12;
    doc.setFontSize(PDF_CONFIG.fontSizes.footer);
    doc.setTextColor(...PDF_CONFIG.mutedColor);
    doc.text('*La soumission sera valide dans un délai de 30 jours.', margin, y);
    doc.text("*Des frais d'administration seront facturés s'il y a annulation des travaux suite à l'acceptation de la soumission.", margin, y + 3);
}

// =====================================================
// ANNEXES: DOCUMENTS LÉGAUX
// =====================================================

async function appendLegalDocuments(doc) {
    const docTypes = ['licence', 'assurance'];
    const pdfBuffers = [];

    for (const docType of docTypes) {
        const docInfo = localStorage.getItem(`apex_doc_${docType}`);
        if (docInfo) {
            try {
                const info = JSON.parse(docInfo);
                if (info.data) {
                    const base64 = info.data.split(',')[1];
                    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                    pdfBuffers.push(bytes);
                }
            } catch (e) {
                console.warn(`Erreur lecture document ${docType}:`, e);
            }
        }
    }

    if (pdfBuffers.length === 0) {
        return null;
    }

    try {
        const { PDFDocument } = PDFLib;

        const mainPdfBytes = doc.output('arraybuffer');
        const mergedPdf = await PDFDocument.load(mainPdfBytes);

        for (const buffer of pdfBuffers) {
            try {
                const annexePdf = await PDFDocument.load(buffer);
                const pages = await mergedPdf.copyPages(annexePdf, annexePdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            } catch (e) {
                console.warn('Erreur fusion document:', e);
            }
        }

        const mergedPdfBytes = await mergedPdf.save();
        return new Blob([mergedPdfBytes], { type: 'application/pdf' });

    } catch (e) {
        console.error('Erreur fusion PDFs:', e);
        return null;
    }
}

// =====================================================
// UTILITAIRES
// =====================================================

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';

    const fixed = Number(num).toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    return decPart ? `${formatted},${decPart}` : formatted;
}

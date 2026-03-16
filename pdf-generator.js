/* =====================================================
   APEX SOUMISSIONS - PDF Generator v4.0
   Design basé sur le template PDF de Gabriel
   (Modèle - Soumission 000XXX — palette bleue Apex)
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

    // Couleurs — palette bleue Apex
    primaryBlue: [30, 115, 190],          // Bleu Apex #1E73BE — titres, total
    borderBlue: [30, 115, 190],           // Bleu Apex — bordures tableau
    subtotalBorderBlue: [30, 115, 190],   // Bleu Apex — bordures sous-total
    accentTan: [100, 100, 100],           // Gris — labels secondaires
    headerBarColor: [55, 130, 195],       // Bleu barre en-tête
    whiteText: [255, 255, 255],           // Blanc
    textColor: [0, 0, 0],                 // Noir
    mutedColor: [120, 120, 120],          // Gris moyen
    lightGray: [243, 243, 243],           // #F3F3F3
    redColor: [220, 50, 50],              // Rouge discret

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
    let lastY = await createMainDocument(doc, state, configTextes, soumissionNumber, date, exclusions);

    // 2. Contrat de construction (6 sections) — coule après le contenu précédent
    lastY = await createContractPages(doc, configTextes, lastY);

    // 3. Signatures — coule après le contrat, saut de page auto si nécessaire
    await createSignatureSection(doc, signature, companySignature, configTextes, state.client, date, lastY);

    // 4. Pages photos et mesures (optionnel) — après signatures, avant documents légaux
    if (includePhotos && state.zones && state.zones.length > 0) {
        const hasPhotos = state.zones.some(zone =>
            zone.photo?.dataUrl ||
            (zone.surfaces && zone.surfaces.some(s => s.photo?.dataUrl))
        );
        if (hasPhotos) {
            doc.addPage();
            await createPhotosPages(doc, state.zones);
        }
    }

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
    const { margin, pageWidth, primaryBlue } = PDF_CONFIG;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...primaryBlue);
    doc.text(`SOUMISSION ${_currentSoumissionNumber} — Suite`, margin, margin);
    doc.setDrawColor(...primaryBlue);
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
        travauxItems.push({ description: "Tests d'air (entrée et sortie de zone) (Inclus)" });
    }

    if (risqueGlobal === 'ÉLEVÉ') {
        travauxItems.push({ description: `Installation douche(s) de décontamination (${state.doucheCount ?? 1})` });
    }

    // ─── GROUPE 2 : Frais généraux (format liste simple, sans prix) ───
    fraisItems.push({ description: 'Gestion des travaux' });
    fraisItems.push({ description: 'Protection temporaire des lieux' });
    fraisItems.push({ description: 'Gestion et évacuations des rebuts en conformité avec les normes et lois en vigueur' });
    fraisItems.push({ description: 'Ménage de chantier' });
    fraisItems.push({ description: 'Livraison et manutention de matériaux' });
    fraisItems.push({ description: 'Frais de déplacement' });

    return { travauxItems, fraisItems };
}

// =====================================================
// DOCUMENT PRINCIPAL (Pages 1+)
// =====================================================

async function createMainDocument(doc, state, configTextes, soumissionNumber, date, exclusions) {
    const { margin, pageWidth, primaryBlue, textColor, accentTan, borderBlue, headerBarColor, whiteText } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // ─── SECTION 1 : Barre bleue + infos entreprise + logo (identique au modèle) ───

    // Marge en haut puis barre bleue fine (dans les marges, comme le modèle)
    doc.setFillColor(...headerBarColor);
    doc.rect(margin, 8, contentWidth, 1.5, 'F');

    // Infos entreprise en noir, à gauche
    y = 18;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text(configTextes.entreprise_nom || 'Apex Désamiantage inc.', margin, y);
    doc.setFont(undefined, 'normal');

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    doc.text(configTextes.entreprise_adresse || '689 rue des Caryers', margin, y);
    y += 3.5;
    doc.text(configTextes.entreprise_ville || 'Québec (QC) G3G 2B4', margin, y);
    y += 3.5;
    doc.text(configTextes.entreprise_telephone || '418-558-8378', margin, y);
    y += 3.5;
    doc.text(configTextes.entreprise_courriel || 'info@apexdesamiantage.com', margin, y);
    y += 3.5;
    const rbqNum = configTextes.entreprise_licence_rbq || '5847-5401-01';
    doc.text(`RBQ: ${rbqNum}`, margin, y);

    // Logo à droite (base64, pas de loadImage = toujours visible)
    if (typeof APEX_LOGO_BASE64 !== 'undefined') {
        doc.addImage(APEX_LOGO_BASE64, 'PNG', pageWidth - margin - 35, 14, 35, 35);
    }

    y += 12;

    // ─── SECTION 2 : Titre SOUMISSION + date (style modèle) ───

    const titleText = `SOUMISSION ${soumissionNumber}`;
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryBlue);
    doc.text(titleText, margin, y);

    y += 2;
    // Ligne sous le titre (bleue comme le texte)
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + doc.getTextWidth(titleText) + 2, y);

    y += 6;

    // Date (bold comme le modèle)
    const dateStr = date.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text(dateStr, margin, y);
    doc.setFont(undefined, 'normal');

    y += 8;

    // ─── SECTION 3 : Info client (2 colonnes) ───

    const colWidth = contentWidth / 2 - 5;
    const leftX = margin;
    const rightX = margin + colWidth + 10;

    // Colonne gauche : Facturé à
    doc.setFontSize(PDF_CONFIG.fontSizes.label);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Facturé à', leftX, y);

    // Colonne droite : Adresse des travaux (aligné à droite)
    doc.text('Adresse des travaux', pageWidth - margin, y, { align: 'right' });
    doc.setFont(undefined, 'normal');

    y += 5;

    // Client info
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text(state.client.nom || 'Nom du client', leftX, y);

    // Adresse travaux (aligné à droite)
    if (state.client.adresseChantier) {
        doc.text(state.client.adresseChantier, pageWidth - margin, y, { align: 'right' });
    } else {
        doc.setTextColor(...accentTan);
        doc.text('Même', pageWidth - margin, y, { align: 'right' });
        doc.setTextColor(...textColor);
    }

    y += 4;
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

    // Colonne droite : Projet + Soumission valide jusqu'au
    let siteY = y + 8;

    // Projet label & value
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Projet', rightX, siteY);

    // Soumission valide jusqu'au label
    doc.text('Soumission valide jusqu\'au', pageWidth - margin, siteY, { align: 'right' });
    doc.setFont(undefined, 'normal');

    siteY += 4;
    doc.setTextColor(...textColor);
    doc.text(state.client.descriptionProjet || 'Travaux de désamiantage', rightX, siteY);

    // Date validité (+30 jours)
    const validityDate = new Date(date);
    validityDate.setDate(validityDate.getDate() + 30);
    const validityStr = validityDate.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    doc.text(validityStr, pageWidth - margin, siteY, { align: 'right' });

    y = Math.max(clientY, siteY) + 6;

    // Ligne de séparation légère
    doc.setDrawColor(...PDF_CONFIG.borderBlue);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    y += 5;

    // ─── BANDEAU NIVEAU DE RISQUE ───
    const risqueGlobal = state.risqueGlobal || 'MODÉRÉ';
    let risqueBgColor, risqueTextColor, risqueText;
    if (risqueGlobal === 'ÉLEVÉ') {
        risqueBgColor = [220, 38, 38];
        risqueTextColor = [255, 255, 255];
        risqueText = 'NIVEAU DE RISQUE : ÉLEVÉ';
    } else if (risqueGlobal === 'ÉLEVÉ_ALLÉGÉ') {
        risqueBgColor = [234, 138, 30];
        risqueTextColor = [255, 255, 255];
        risqueText = 'NIVEAU DE RISQUE : ÉLEVÉ ALLÉGÉ';
    } else {
        risqueBgColor = [34, 120, 74];
        risqueTextColor = [255, 255, 255];
        risqueText = 'NIVEAU DE RISQUE : MODÉRÉ';
    }
    const bandeauWidth = pageWidth - (margin * 2);
    doc.setFillColor(...risqueBgColor);
    doc.roundedRect(margin, y, bandeauWidth, 9, 1.5, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...risqueTextColor);
    doc.text(risqueText, pageWidth / 2, y + 6, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...PDF_CONFIG.textColor);
    y += 14;

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

    return y;
}

// =====================================================
// TABLEAU D'ITEMS (style Excel : bordures bleu fines)
// =====================================================

function drawLineItemsTable(doc, data, startY) {
    const { margin, pageWidth, textColor, primaryBlue } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = startY;

    // ─── PARTIE 1 : Travaux de désamiantage (format liste) ───

    // Titre de section en bleu
    doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryBlue);
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

    y += 4;

    // ─── PARTIE 2 : Frais généraux (format liste simple, comme travaux) ───

    // Titre de section en bleu
    doc.setFontSize(PDF_CONFIG.fontSizes.sectionTitle);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryBlue);
    doc.text('Frais généraux', margin + 2, y);
    doc.setFont(undefined, 'normal');
    y += 5;

    // Items en liste simple (même format que travaux)
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);

    data.fraisItems.forEach(item => {
        y = checkPageBreak(doc, y, 7);
        const descLines = doc.splitTextToSize(item.description, contentWidth - 10);
        doc.text(descLines, margin + 5, y);
        y += descLines.length > 1 ? descLines.length * 4 + 1 : PDF_CONFIG.lineHeight.tableRow;
    });

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

    // Défauts pour les notes (comme le template)
    const defaultNotes = "Une procédure de désamiantage selon les normes du CSTC sera fourni avant d'effectuer les travaux\nL'ouverture de chantier au près de la CNESST relève de l'entrepreneur général";

    // Défauts pour les exclusions (comme le template)
    const defaultExclusions = [
        'Déplacement et entreposage du mobilier du client',
        'Protection autre que celle reliée à nos travaux',
        'Chauffage temporaire',
        'Stationnement, toilettes et local pour les pauses et diner',
        'Démolition de matériaux sans amiante et des éléments d\'électromécanique',
        'Travaux sur le bâtiment pour permettre la sortie de nos matériaux et de notre pression négative',
        'Travaux de ragréage ou de reconstruction',
        'Tout élément non indiqué à la présente soumission'
    ];

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

    // Notes (comme le template : "Notes:")
    const notes = configTextes.notes_techniques || defaultNotes;
    if (notes && notes !== '[À configurer dans Settings]') {
        y = checkPageBreak(doc, y, 20);

        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text('Notes:', margin, y);
        doc.setFont(undefined, 'normal');

        y += 5;
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        const noteItems = notes.split('\n').filter(n => n.trim());
        noteItems.forEach(item => {
            y = checkPageBreak(doc, y, 5);
            const itemLines = doc.splitTextToSize(item.trim(), contentWidth - 5);
            doc.text(itemLines, margin, y);
            y += itemLines.length * PDF_CONFIG.lineHeight.bodyText + 2;
        });
        y += 2;
    }

    // Non inclus (comme le template : "Non inclus:")
    const exclItems = (exclusions && exclusions.length > 0) ? exclusions : defaultExclusions;
    y = checkPageBreak(doc, y, 10);

    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setFont(undefined, 'bolditalic');
    doc.setTextColor(...textColor);
    doc.text('Non inclus:', margin, y);
    doc.setFont(undefined, 'normal');

    y += 5;
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);
    exclItems.forEach(item => {
        y = checkPageBreak(doc, y, 5);
        doc.text(item, margin, y);
        y += 4;
    });
    y += 2;

    return y;
}

// =====================================================
// ANNEXE — ZONES DE TRAVAUX (Photos)
// =====================================================

async function createPhotosPages(doc, zones) {
    const { margin, pageWidth, pageHeight, primaryBlue, textColor, accentTan } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);
    const maxImgWidth = 130;  // largeur max image en mm
    const maxImgHeight = 90;  // hauteur max image en mm

    let y = margin;

    // En-tête
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryBlue);
    const photosTitle = 'ANNEXE — Zones de travaux';
    doc.text(photosTitle, margin, y);
    doc.setFont(undefined, 'normal');

    y += 2;
    doc.setDrawColor(...primaryBlue);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + doc.getTextWidth(photosTitle), y);

    y += 10;

    // Helper : obtenir les dimensions naturelles d'une image
    function getImageDimensions(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 4, height: 3 }); // fallback 4:3
            img.src = dataUrl;
        });
    }

    // Helper : calculer les dimensions en mm en respectant le ratio d'aspect
    function fitImage(naturalW, naturalH, maxW, maxH) {
        const ratio = naturalW / naturalH;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
            h = maxH;
            w = h * ratio;
        }
        return { w, h };
    }

    // Helper : rendre une photo avec bloc descriptif complet
    async function renderPhoto(dataUrl, zone, surface) {
        // Espace nécessaire : image + infos (~35mm sous l'image)
        const neededSpace = maxImgHeight + 35;
        if (y > pageHeight - neededSpace) {
            doc.addPage();
            drawContinuationHeader(doc);
            y = margin + 12;
        }

        try {
            const dims = await getImageDimensions(dataUrl);
            const { w: imgW, h: imgH } = fitImage(dims.width, dims.height, maxImgWidth, maxImgHeight);

            // Image centrée horizontalement
            const imgX = margin + (contentWidth - imgW) / 2;
            doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
            y += imgH + 5;

            const infoX = margin;

            // Ligne 1 (bold) : Zone : Nom — Label
            doc.setFontSize(PDF_CONFIG.fontSizes.body);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(...primaryBlue);
            const label = surface ? (surface.nom || 'Surface') : 'Vue d\'ensemble';
            doc.text(`Zone : ${zone.nom} — ${label}`, infoX, y);
            doc.setFont(undefined, 'normal');
            y += 5;

            // Ligne 2 : Matériau | Classe
            doc.setFontSize(PDF_CONFIG.fontSizes.item);
            doc.setTextColor(...accentTan);
            doc.text('Matériau : ', infoX, y);
            doc.setTextColor(...textColor);
            const matText = zone.materiauNom || zone.categorie || '—';
            const matEndX = infoX + 22 + doc.getTextWidth(matText);
            doc.text(matText, infoX + 22, y);

            doc.setTextColor(...accentTan);
            doc.text('  |  Classe : ', matEndX, y);
            doc.setTextColor(...textColor);
            const risqueText = (zone.risque || '').replace(/_/g, ' ') || '—';
            doc.text(risqueText, matEndX + doc.getTextWidth('  |  Classe : '), y);
            y += 5;

            // Ligne 3 (surface seulement) : Dimensions | Superficie
            if (surface) {
                doc.setTextColor(...accentTan);
                doc.text('Dimensions : ', infoX, y);
                doc.setTextColor(...textColor);
                const dimText = (surface.longueur && surface.hauteur)
                    ? `${surface.longueur} × ${surface.hauteur} pi`
                    : '—';
                const dimEndX = infoX + 26 + doc.getTextWidth(dimText);
                doc.text(dimText, infoX + 26, y);

                doc.setTextColor(...accentTan);
                doc.text('  |  Superficie : ', dimEndX, y);
                doc.setTextColor(...textColor);
                doc.text(surface.surface ? `${surface.surface} pi²` : '—', dimEndX + doc.getTextWidth('  |  Superficie : '), y);
                y += 5;
            }

            // Ligne de séparation grise
            y += 4;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(margin, y, pageWidth - margin, y);
            y += 8;

        } catch (e) {
            console.warn('Erreur ajout photo:', e);
        }
    }

    // Parcourir les zones et rendre toutes les photos
    for (const zone of zones) {
        const hasZonePhoto = zone.photo?.dataUrl;
        const surfacesWithPhotos = (zone.surfaces || []).filter(s => s.photo?.dataUrl);
        if (!hasZonePhoto && surfacesWithPhotos.length === 0) continue;

        // Photo de zone (vue d'ensemble)
        if (hasZonePhoto) {
            await renderPhoto(zone.photo.dataUrl, zone, null);
        }

        // Photos de surfaces
        for (const surface of surfacesWithPhotos) {
            await renderPhoto(surface.photo.dataUrl, zone, surface);
        }
    }
}

// =====================================================
// CONTRAT DE CONSTRUCTION (6 sections)
// =====================================================

async function createContractPages(doc, configTextes, startY) {
    const { margin, pageWidth, primaryBlue, textColor } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    // Espace nécessaire pour le titre + au moins la 1re section (~40mm)
    let y = checkPageBreak(doc, startY + 10, 40);

    // Titre — style souligné comme le template
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('CONTRAT DE CONSTRUCTION', margin, y);
    doc.setFont(undefined, 'normal');

    y += 2;
    doc.setDrawColor(...textColor);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + doc.getTextWidth('CONTRAT DE CONSTRUCTION'), y);

    y += 10;

    // Textes par défaut des 6 sections (réorganisées selon le template)
    const defaultTexts = {
        1: "Le présent contrat lie l'Entrepreneur et le Client identifiés en entête de la présente soumission. L'Entrepreneur s'engage à réaliser les travaux décrits pour le prix total stipulé ci-haut, conformément au Code de construction du Québec et aux règles de l'art.",
        2: "Un échéancier détaillé sera fourni par l'Entrepreneur lors de la signature. Les délais sont sujets à révision en cas de force majeure, météo ou retards d'approvisionnement. Le Client s'engage à fournir un accès libre au chantier et aux services (eau/électricité).",
        3: "L'obtention et les frais de tous les permis municipaux ou autorisations nécessaires sont la responsabilité exclusive du Client. Les travaux ne débuteront qu'une fois les permis obtenus et remis à l'Entrepreneur. Le Client garantit que les travaux sont conformes aux règlements de zonage ou de copropriété.",
        4: "Le prix soumis n'inclut pas la correction de conditions préexistantes non apparentes (ex: structure non conforme, présence d'amiante, moisissure, plomberie/électricité désuète). Si de telles conditions sont découvertes, les travaux seront suspendus et un avenant écrit sera requis avant de poursuivre.",
        5: "Acompte : 10% à la signature pour les contrat dont le montant avant taxes excède 25 000,00 $\nPaiements progressifs : Facturés selon l'avancement défini à l'échéancier.\nSolde : Le paiement complet est exigible immédiatement à la fin des travaux. Aucune retenue ne sera acceptée sans entente écrite préalable.",
        6: "Toute demande de travaux additionnels fera l'objet d'un avenant écrit détaillant les coûts et délais supplémentaires avant l'exécution. Sans approbation écrite de la part du client, ces travaux ne seront pas effectués."
    };

    const sectionTitles = {
        1: 'CADRE LÉGAL ET OBJET',
        2: 'ÉCHÉANCIER ET ACCÈS',
        3: 'PERMIS ET RÈGLEMENTS',
        4: 'CONDITIONS IMPRÉVUES',
        5: 'MODALITÉS DE PAIEMENT',
        6: 'AJUSTEMENTS DE COÛTS'
    };

    for (let i = 1; i <= 6; i++) {
        const text = configTextes[`contrat_section_${i}`] || defaultTexts[i];
        if (!text || text === '[À configurer dans Settings]') continue;

        const textLines = doc.splitTextToSize(text, contentWidth - 5);
        const neededSpace = 10 + textLines.length * PDF_CONFIG.lineHeight.bodyText;

        y = checkPageBreak(doc, y, Math.min(neededSpace, 40));

        // Titre de section — numéroté, bold
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text(`${i}. ${sectionTitles[i]}`, margin, y);
        doc.setFont(undefined, 'normal');

        y += 5;

        // Contenu
        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        doc.text(textLines, margin + 3, y);

        y += textLines.length * PDF_CONFIG.lineHeight.bodyText + 6;
    }

    // ─── Sections non numérotées : OBLIGATIONS ET GARANTIES ───
    const obligationsText = configTextes.contrat_section_7 || "L'Entrepreneur détient une assurance responsabilité civile 5 000 000,00 $ avec avenant pollution et une licence RBQ valide. Les travaux sont couverts par la garantie légale (Art. 2118 et 2120 du Code civil). Le Client peut résilier le contrat selon l'Art. 2125 du C.c.Q., moyennant le paiement des frais, travaux exécutés et profits perdus de l'Entrepreneur.";
    if (obligationsText && obligationsText !== '[À configurer dans Settings]') {
        const oblLines = doc.splitTextToSize(obligationsText, contentWidth - 5);
        const oblSpace = 10 + oblLines.length * PDF_CONFIG.lineHeight.bodyText;
        y = checkPageBreak(doc, y, Math.min(oblSpace, 40));

        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text('OBLIGATIONS ET GARANTIES', margin, y);
        doc.setFont(undefined, 'normal');
        y += 5;

        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        doc.text(oblLines, margin + 3, y);
        y += oblLines.length * PDF_CONFIG.lineHeight.bodyText + 6;
    }

    // ─── ACCEPTATION ───
    const acceptationText = configTextes.contrat_section_8 || "En signant ci-dessous, le Client confirme avoir lu, compris et accepté les termes de la présente soumission et du présent contrat.";
    if (acceptationText && acceptationText !== '[À configurer dans Settings]') {
        const accLines = doc.splitTextToSize(acceptationText, contentWidth - 5);
        const accSpace = 10 + accLines.length * PDF_CONFIG.lineHeight.bodyText;
        y = checkPageBreak(doc, y, Math.min(accSpace, 40));

        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text('ACCEPTATION', margin, y);
        doc.setFont(undefined, 'normal');
        y += 5;

        doc.setFontSize(PDF_CONFIG.fontSizes.item);
        doc.setTextColor(...textColor);
        doc.text(accLines, margin + 3, y);
        y += accLines.length * PDF_CONFIG.lineHeight.bodyText + 6;
    }

    return y;
}

// =====================================================
// PAIEMENT + DOUBLE SIGNATURE (style Excel)
// =====================================================

async function createSignatureSection(doc, signatureDataUrl, companySignatureDataUrl, configTextes, client, date, startY) {
    const { margin, pageWidth, pageHeight, primaryBlue, textColor, accentTan, lightGray } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    // Espace estimé pour signatures (~80mm)
    let y = checkPageBreak(doc, startY || margin, 80);

    // ─── Signatures côte à côte (style template) ───

    if (y > pageHeight - 100) {
        doc.addPage();
        y = margin;
    }

    const signataireName = configTextes.signataire_nom || 'Gabriel Maranda';
    const signataireTitre = configTextes.signataire_titre || 'Apex Désamiantage inc.';

    const halfWidth = contentWidth / 2 - 10;
    const leftCol = margin;
    const rightCol = margin + halfWidth + 20;

    // Titre SIGNATURES
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('SIGNATURES', margin, y);
    doc.setFont(undefined, 'normal');

    y += 8;

    // Labels côte à côte
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text(`${signataireName}, ${signataireTitre}`, leftCol, y);
    doc.text('Nom du client', rightCol, y);

    y += 5;

    // Zone signature entrepreneur (colonne gauche)
    const sigStartY = y;
    if (companySignatureDataUrl) {
        try {
            doc.addImage(companySignatureDataUrl, 'PNG', leftCol, y, halfWidth, 25);
        } catch (e) {
            console.warn('Erreur ajout signature entrepreneur:', e);
        }
    }

    // Zone signature client (colonne droite)
    if (signatureDataUrl) {
        try {
            doc.addImage(signatureDataUrl, 'PNG', rightCol, y, halfWidth, 25);
        } catch (e) {
            console.warn('Erreur ajout signature client:', e);
        }
    }

    y = sigStartY + 30;

    // Lignes de signature côte à côte
    doc.setDrawColor(...textColor);
    doc.setLineWidth(0.3);
    doc.line(leftCol, y, leftCol + halfWidth, y);
    doc.line(rightCol, y, rightCol + halfWidth, y);

    y += 8;

    // Dates côte à côte
    doc.setFontSize(PDF_CONFIG.fontSizes.item);
    doc.setTextColor(...textColor);

    if (date) {
        const dateStr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`Date: ${dateStr}`, leftCol, y);
        doc.text('Date:', rightCol, y);
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
    const docTypes = ['licence', 'assurance', 'contrat', 'icrc', 'cq'];
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
        } else if (docType === 'licence' && typeof LICENCE_RBQ_BASE64 !== 'undefined') {
            try {
                const bytes = Uint8Array.from(atob(LICENCE_RBQ_BASE64), c => c.charCodeAt(0));
                pdfBuffers.push(bytes);
            } catch (e) {
                console.warn('Licence RBQ par défaut non disponible:', e);
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
        // crossOrigin uniquement sur HTTP (pas file://)
        if (window.location.protocol !== 'file:') {
            img.crossOrigin = 'Anonymous';
        }
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

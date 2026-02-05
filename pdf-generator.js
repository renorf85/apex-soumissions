/* =====================================================
   APEX SOUMISSIONS - PDF Generator
   Génération de PDF professionnels pour les soumissions
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
    margin: 20,
    
    // Couleurs
    primaryColor: [30, 115, 190],      // #1E73BE
    textColor: [15, 23, 42],           // Slate 900
    mutedColor: [100, 116, 139],       // Slate 500
    lightGray: [241, 245, 249],        // Slate 100
    greenColor: [34, 197, 94],         // Green 500
    redColor: [239, 68, 68],           // Red 500
    
    // Polices
    fontSizes: {
        title: 24,
        subtitle: 16,
        heading: 14,
        body: 11,
        small: 9
    }
};

// =====================================================
// FONCTION PRINCIPALE
// =====================================================

/**
 * Génère le PDF complet de la soumission
 * @param {Object} options - Options de génération
 * @returns {Blob} - Le PDF sous forme de Blob
 */
async function generatePDF(options) {
    const {
        state,
        configTextes,
        signature,
        includePhotos,
        includeLegalDocs,
        inclusions,
        exclusions,
        soumissionNumber,
        date
    } = options;

    // Créer le document PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
    });

    let currentPage = 1;

    // 1. Page de couverture
    await createCoverPage(doc, state, configTextes, soumissionNumber, date);
    
    // 2. Page de récapitulatif des prix
    doc.addPage();
    currentPage++;
    await createPricingPage(doc, state);

    // 3. Pages photos et mesures (si option activée)
    if (includePhotos && state.zones && state.zones.length > 0) {
        const hasPhotos = state.zones.some(zone => 
            zone.surfaces && zone.surfaces.some(s => s.photo)
        );
        
        if (hasPhotos) {
            doc.addPage();
            currentPage++;
            await createPhotosPages(doc, state.zones);
        }
    }

    // 4. Page inclusions/exclusions
    doc.addPage();
    currentPage++;
    await createInclusionsPage(doc, inclusions, exclusions, state, configTextes);

    // 5. Page de signature
    doc.addPage();
    currentPage++;
    await createSignaturePage(doc, signature, configTextes, state.client, date);

    // 6. Annexer les documents légaux (si option activée)
    if (includeLegalDocs) {
        const pdfWithAnnexes = await appendLegalDocuments(doc);
        if (pdfWithAnnexes) {
            return pdfWithAnnexes;
        }
    }

    // Retourner le PDF
    return doc.output('blob');
}

// =====================================================
// PAGE 1: COUVERTURE
// =====================================================

async function createCoverPage(doc, state, configTextes, soumissionNumber, date) {
    const { margin, pageWidth, pageHeight, primaryColor, textColor, mutedColor } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    // Logo Apex (en haut à gauche)
    try {
        const logoImg = await loadImage('assets/logo-apex.png');
        doc.addImage(logoImg, 'PNG', margin, margin, 50, 20);
    } catch (e) {
        // Fallback: texte
        doc.setFontSize(20);
        doc.setTextColor(...primaryColor);
        doc.text('APEX DÉSAMIANTAGE', margin, margin + 15);
    }

    // Numéro de soumission (en haut à droite)
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text('SOUMISSION', pageWidth - margin, margin + 5, { align: 'right' });
    
    doc.setFontSize(PDF_CONFIG.fontSizes.heading);
    doc.setTextColor(...primaryColor);
    doc.text(soumissionNumber, pageWidth - margin, margin + 12, { align: 'right' });
    
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    const dateStr = date.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(dateStr, pageWidth - margin, margin + 18, { align: 'right' });

    // Séparateur
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, 50, pageWidth - margin, 50);

    // Titre principal
    let y = 70;
    doc.setFontSize(PDF_CONFIG.fontSizes.title);
    doc.setTextColor(...textColor);
    doc.text('Soumission pour travaux', margin, y);
    
    y += 10;
    doc.setFontSize(PDF_CONFIG.fontSizes.subtitle);
    doc.setTextColor(...primaryColor);
    doc.text('de désamiantage', margin, y);

    // Informations client
    y += 25;
    doc.setFillColor(...PDF_CONFIG.lightGray);
    doc.roundedRect(margin, y, contentWidth, 45, 3, 3, 'F');

    y += 10;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text('CLIENT', margin + 5, y);

    y += 8;
    doc.setFontSize(PDF_CONFIG.fontSizes.heading);
    doc.setTextColor(...textColor);
    doc.text(state.client.nom || 'Client', margin + 5, y);

    y += 7;
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...mutedColor);
    doc.text(`${state.client.telephone || ''} • ${state.client.courriel || ''}`, margin + 5, y);

    y += 7;
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text(state.client.adresseChantier || 'Adresse du chantier', margin + 5, y);

    // Résumé du projet
    y += 25;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text('RÉSUMÉ DU PROJET', margin, y);

    y += 10;
    
    // Grille de stats
    const statsWidth = contentWidth / 4;
    const stats = [
        { label: 'Zones', value: (state.zones || []).length.toString() },
        { label: 'Surface totale', value: `${formatNumber(state.prix?.surfaceTotal || 0)} pi²` },
        { label: 'Risque', value: state.risqueGlobal || 'MODÉRÉ' },
        { label: 'Distance', value: `${state.client.distanceKm || 0} km` }
    ];

    stats.forEach((stat, i) => {
        const x = margin + (i * statsWidth);
        
        doc.setFontSize(PDF_CONFIG.fontSizes.title);
        doc.setTextColor(...primaryColor);
        doc.text(stat.value, x, y + 8);
        
        doc.setFontSize(PDF_CONFIG.fontSizes.small);
        doc.setTextColor(...mutedColor);
        doc.text(stat.label, x, y + 15);
    });

    // Zone de prix total
    y += 40;
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, y, contentWidth, 35, 3, 3, 'F');

    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL ESTIMÉ', margin + 10, y + 12);

    doc.setFontSize(PDF_CONFIG.fontSizes.title);
    doc.text(`${formatNumber(state.prix?.total || 0)} $`, margin + 10, y + 25);

    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.text('Taxes en sus', pageWidth - margin - 10, y + 25, { align: 'right' });

    // Pied de page avec informations entreprise
    const footerY = pageHeight - 30;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text(configTextes.entreprise_nom || 'Apex Désamiantage', margin, footerY);
    doc.text(configTextes.entreprise_adresse || '', margin, footerY + 5);
    
    const contact = [
        configTextes.entreprise_telephone,
        configTextes.entreprise_courriel
    ].filter(Boolean).join(' • ');
    if (contact) {
        doc.text(contact, margin, footerY + 10);
    }
    
    if (configTextes.entreprise_licence_rbq) {
        doc.text(`Licence RBQ: ${configTextes.entreprise_licence_rbq}`, pageWidth - margin, footerY, { align: 'right' });
    }
}

// =====================================================
// PAGE 2: DÉTAIL DES PRIX
// =====================================================

async function createPricingPage(doc, state) {
    const { margin, pageWidth, primaryColor, textColor, mutedColor, lightGray } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);
    const prix = state.prix || {};

    let y = margin;

    // En-tête
    doc.setFontSize(PDF_CONFIG.fontSizes.subtitle);
    doc.setTextColor(...primaryColor);
    doc.text('Détail des coûts', margin, y);

    // Sous-titre
    y += 8;
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...mutedColor);
    doc.text('Ventilation des coûts estimés pour les travaux', margin, y);

    y += 15;

    // Tableau des prix
    const rows = [
        { label: 'Coûts des zones', value: prix.zones || 0 },
        { label: 'Démolition', value: prix.demolition || 0 }
    ];

    // Frais risque élevé (seulement si applicable)
    if (state.risqueGlobal === 'ÉLEVÉ') {
        rows.push(
            { label: 'Douches de décontamination', value: prix.douches || 0, highlight: true },
            { label: "Tests d'air", value: prix.tests || 0, highlight: true },
            { label: 'Perte de temps', value: prix.perteTemps || 0, highlight: true }
        );
    }

    rows.push(
        { label: 'Transport', value: prix.transport || 0 },
        { label: 'Disposition des matériaux', value: prix.disposition || 0 },
        { label: 'Assurance', value: prix.assurance || 0 }
    );

    // Dessiner les lignes
    rows.forEach((row, i) => {
        const rowY = y + (i * 12);
        
        // Fond alterné
        if (i % 2 === 0) {
            doc.setFillColor(...lightGray);
            doc.rect(margin, rowY - 4, contentWidth, 12, 'F');
        }

        // Highlight pour frais risque élevé
        if (row.highlight) {
            doc.setFillColor(254, 242, 242); // Red 50
            doc.rect(margin, rowY - 4, contentWidth, 12, 'F');
        }

        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setTextColor(...(row.highlight ? [239, 68, 68] : textColor));
        doc.text(row.label, margin + 5, rowY + 3);
        
        doc.text(`${formatNumber(row.value)} $`, pageWidth - margin - 5, rowY + 3, { align: 'right' });
    });

    y += (rows.length * 12) + 10;

    // Ligne séparatrice
    doc.setDrawColor(...mutedColor);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);

    // Sous-total
    y += 12;
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text('Sous-total', margin + 5, y);
    doc.setFont(undefined, 'bold');
    doc.text(`${formatNumber(prix.sousTotal || 0)} $`, pageWidth - margin - 5, y, { align: 'right' });
    doc.setFont(undefined, 'normal');

    // Total
    y += 20;
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, y - 5, contentWidth, 20, 2, 2, 'F');

    doc.setFontSize(PDF_CONFIG.fontSizes.heading);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL ESTIMÉ', margin + 5, y + 7);
    doc.setFont(undefined, 'bold');
    doc.text(`${formatNumber(prix.total || 0)} $`, pageWidth - margin - 5, y + 7, { align: 'right' });
    doc.setFont(undefined, 'normal');

    // Note sur les taxes
    y += 30;
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text('* Les prix indiqués sont avant taxes (TPS et TVQ en sus)', margin, y);

    // Détail par zone (si plusieurs zones)
    if (state.zones && state.zones.length > 0) {
        y += 20;
        doc.setFontSize(PDF_CONFIG.fontSizes.heading);
        doc.setTextColor(...primaryColor);
        doc.text('Détail par zone', margin, y);

        y += 10;
        state.zones.forEach((zone, i) => {
            if (y > 250) {
                doc.addPage();
                y = margin;
            }

            const risqueColor = zone.risque === 'ÉLEVÉ' ? PDF_CONFIG.redColor : [245, 158, 11]; // Amber

            doc.setFillColor(...lightGray);
            doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F');

            doc.setFontSize(PDF_CONFIG.fontSizes.body);
            doc.setTextColor(...textColor);
            doc.text(`${i + 1}. ${zone.nom}`, margin + 5, y + 8);

            doc.setFontSize(PDF_CONFIG.fontSizes.small);
            doc.setTextColor(...mutedColor);
            doc.text(`${zone.materiauNom || zone.categorie} • ${formatNumber(zone.surface || zone.surfaceTotal || 0)} pi²`, margin + 5, y + 15);

            // Badge risque
            doc.setFillColor(...risqueColor);
            doc.roundedRect(pageWidth - margin - 30, y + 5, 25, 10, 2, 2, 'F');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text(zone.risque || 'MODÉRÉ', pageWidth - margin - 17.5, y + 12, { align: 'center' });

            y += 25;
        });
    }
}

// =====================================================
// PAGE 3+: PHOTOS ET MESURES
// =====================================================

async function createPhotosPages(doc, zones) {
    const { margin, pageWidth, pageHeight, primaryColor, textColor, mutedColor, lightGray } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;
    let isFirstPage = true;

    // En-tête
    doc.setFontSize(PDF_CONFIG.fontSizes.subtitle);
    doc.setTextColor(...primaryColor);
    doc.text('Photos et mesures', margin, y);

    y += 15;

    for (const zone of zones) {
        if (!zone.surfaces) continue;

        const surfacesWithPhotos = zone.surfaces.filter(s => s.photo);
        if (surfacesWithPhotos.length === 0) continue;

        // Titre de la zone
        if (y > pageHeight - 80) {
            doc.addPage();
            y = margin;
        }

        doc.setFontSize(PDF_CONFIG.fontSizes.heading);
        doc.setTextColor(...textColor);
        doc.text(zone.nom, margin, y);

        y += 8;
        doc.setFontSize(PDF_CONFIG.fontSizes.small);
        doc.setTextColor(...mutedColor);
        doc.text(`${zone.materiauNom || zone.categorie} • ${formatNumber(zone.surface || zone.surfaceTotal || 0)} pi²`, margin, y);

        y += 12;

        // Photos de la zone
        for (const surface of surfacesWithPhotos) {
            if (y > pageHeight - 100) {
                doc.addPage();
                y = margin;
            }

            try {
                // Ajouter l'image
                const imgWidth = contentWidth / 2 - 5;
                const imgHeight = 60;

                doc.addImage(surface.photo.dataUrl, 'JPEG', margin, y, imgWidth, imgHeight);

                // Infos à côté de l'image
                const infoX = margin + imgWidth + 10;

                doc.setFontSize(PDF_CONFIG.fontSizes.body);
                doc.setTextColor(...textColor);
                doc.text(surface.nom || 'Surface', infoX, y + 10);

                doc.setFontSize(PDF_CONFIG.fontSizes.small);
                doc.setTextColor(...mutedColor);
                doc.text(`Dimensions: ${surface.longueur || 0}' x ${surface.hauteur || 0}'`, infoX, y + 20);
                doc.text(`Surface: ${formatNumber(surface.surface || 0)} pi²`, infoX, y + 28);
                doc.text(`Épaisseur: ${zone.epaisseur || 0}"`, infoX, y + 36);

                y += imgHeight + 10;

            } catch (e) {
                console.warn('Erreur ajout photo:', e);
            }
        }

        y += 10;
    }
}

// =====================================================
// PAGE N: INCLUSIONS / EXCLUSIONS
// =====================================================

async function createInclusionsPage(doc, inclusions, exclusions, state, configTextes) {
    const { margin, pageWidth, primaryColor, textColor, mutedColor, greenColor, redColor, lightGray } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // En-tête
    doc.setFontSize(PDF_CONFIG.fontSizes.subtitle);
    doc.setTextColor(...primaryColor);
    doc.text('Inclusions et exclusions', margin, y);

    y += 15;

    // Descriptif technique selon le risque
    const descriptif = state.risqueGlobal === 'ÉLEVÉ' 
        ? (configTextes.descriptif_risque_eleve || '')
        : (configTextes.descriptif_risque_modere || '');

    if (descriptif && descriptif !== '[À configurer dans Settings]') {
        doc.setFontSize(PDF_CONFIG.fontSizes.small);
        doc.setTextColor(...mutedColor);
        doc.text('DESCRIPTION DES TRAVAUX', margin, y);

        y += 8;
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setTextColor(...textColor);

        // Word wrap pour le descriptif
        const lines = doc.splitTextToSize(descriptif, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 15;
    }

    // Section Inclus
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');

    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...greenColor);
    doc.text('✓ INCLUS DANS CETTE SOUMISSION', margin + 5, y + 5.5);

    y += 15;

    inclusions.forEach((item, i) => {
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setTextColor(...textColor);
        doc.text(`• ${item}`, margin + 5, y);
        y += 7;
    });

    y += 10;

    // Section Exclus
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');

    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...redColor);
    doc.text('✗ NON INCLUS', margin + 5, y + 5.5);

    y += 15;

    exclusions.forEach((item, i) => {
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setTextColor(...textColor);
        doc.text(`• ${item}`, margin + 5, y);
        y += 7;
    });

    // Instructions de paiement
    y += 15;
    const paiement = configTextes.instructions_paiement || '';
    
    if (paiement && paiement !== '[À configurer dans Settings]') {
        doc.setFontSize(PDF_CONFIG.fontSizes.small);
        doc.setTextColor(...mutedColor);
        doc.text('MODALITÉS DE PAIEMENT', margin, y);

        y += 8;
        doc.setFontSize(PDF_CONFIG.fontSizes.body);
        doc.setTextColor(...textColor);

        const paiementLines = doc.splitTextToSize(paiement, contentWidth);
        doc.text(paiementLines, margin, y);
    }
}

// =====================================================
// PAGE N+1: SIGNATURE
// =====================================================

async function createSignaturePage(doc, signatureDataUrl, configTextes, client, date) {
    const { margin, pageWidth, pageHeight, primaryColor, textColor, mutedColor, lightGray } = PDF_CONFIG;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    // En-tête
    doc.setFontSize(PDF_CONFIG.fontSizes.subtitle);
    doc.setTextColor(...primaryColor);
    doc.text('Acceptation de la soumission', margin, y);

    y += 20;

    // Texte légal
    const texteSignature = configTextes.texte_signature || 
        'Je, soussigné(e), reconnais avoir pris connaissance de la présente soumission et accepte les termes et conditions.';

    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    const lines = doc.splitTextToSize(texteSignature, contentWidth);
    doc.text(lines, margin, y);

    y += lines.length * 5 + 20;

    // Zone de signature
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentWidth, 50, 3, 3, 'F');

    // Ajouter la signature si présente
    if (signatureDataUrl) {
        try {
            doc.addImage(signatureDataUrl, 'PNG', margin + 10, y + 5, contentWidth - 20, 40);
        } catch (e) {
            console.warn('Erreur ajout signature:', e);
        }
    }

    y += 55;

    // Ligne pour le nom
    doc.setDrawColor(...mutedColor);
    doc.line(margin, y, margin + 80, y);
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text('Nom du client', margin, y + 5);

    // Nom du client
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text(client.nom || '', margin, y - 3);

    // Ligne pour la date
    doc.setDrawColor(...mutedColor);
    doc.line(margin + 100, y, margin + 160, y);
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(...mutedColor);
    doc.text('Date', margin + 100, y + 5);

    // Date
    const dateStr = date.toLocaleDateString('fr-CA');
    doc.setFontSize(PDF_CONFIG.fontSizes.body);
    doc.setTextColor(...textColor);
    doc.text(dateStr, margin + 100, y - 3);

    // Validité de la soumission
    y += 30;
    doc.setFillColor(254, 249, 195); // Yellow 100
    doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'F');
    
    doc.setFontSize(PDF_CONFIG.fontSizes.small);
    doc.setTextColor(161, 98, 7); // Yellow 700
    doc.text('Cette soumission est valide pour une période de 30 jours à compter de la date ci-dessus.', margin + 5, y + 9);
}

// =====================================================
// ANNEXES: DOCUMENTS LÉGAUX
// =====================================================

async function appendLegalDocuments(doc) {
    // Récupérer les documents depuis localStorage
    const docs = ['licence', 'assurance', 'contrat'];
    const pdfBuffers = [];

    for (const docType of docs) {
        const docInfo = localStorage.getItem(`apex_doc_${docType}`);
        if (docInfo) {
            try {
                const info = JSON.parse(docInfo);
                if (info.data) {
                    // Extraire le base64 (enlever le préfixe data:application/pdf;base64,)
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
        return null; // Pas de documents à annexer
    }

    try {
        const { PDFDocument } = PDFLib;

        // Convertir le PDF jsPDF en buffer
        const mainPdfBytes = doc.output('arraybuffer');

        // Créer le document final
        const mergedPdf = await PDFDocument.load(mainPdfBytes);

        // Ajouter chaque document annexe
        for (const buffer of pdfBuffers) {
            try {
                const annexePdf = await PDFDocument.load(buffer);
                const pages = await mergedPdf.copyPages(annexePdf, annexePdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            } catch (e) {
                console.warn('Erreur fusion document:', e);
            }
        }

        // Retourner le PDF fusionné
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

/**
 * Charge une image et retourne une promesse
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Formate un nombre avec espaces (séparateur milliers)
 */
function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    
    const fixed = Number(num).toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    return decPart ? `${formatted},${decPart}` : formatted;
}

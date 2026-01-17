/* =====================================================
   APEX SOUMISSIONS AMIANTE - Application JavaScript
   ===================================================== */

// =====================================================
// MODE DÉVELOPPEMENT
// =====================================================

const DEV_MODE = true; // Mettre à false en production

const DEV_DATA = {
    client: {
        nom: 'Jean Tremblay',
        telephone: '514-555-1234',
        courriel: 'jean.tremblay@test.com',
        adresseChantier: '123 rue Test, Montréal',
        distanceKm: 35
    },
    zones: [
        {
            nom: 'Cuisine',
            categorie: 'Mur/Plafond',
            materiau: 'Gypse (panneau 1/2")',
            friabilite: 'non_friable',
            longueur: 12,
            largeur: 10,
            epaisseur: 0.5,
            volume: 5,
            surface: 120,
            risque: 'MODÉRÉ'
        }
    ]
};

// =====================================================
// CONFIGURATION SUPABASE
// =====================================================

const SUPABASE_URL = 'https://bmwfipxpbkofjsgdraau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtd2ZpcHhwYmtvZmpzZ2RyYWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTQ2MDgsImV4cCI6MjA4NDIzMDYwOH0.qSxu_WQlac2WBDSfxEWTqdOYaoVurwIJNqmr9MOeihw';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// STATE
// =====================================================

const state = {
    currentStep: 1,
    hasReport: null,
    rapport: null,
    client: {
        nom: '',
        telephone: '',
        courriel: '',
        adresseChantier: '',
        distanceKm: 0
    },
    zones: [],
    materiaux: [],
    config: {},
    risqueGlobal: null,
    prix: {}
};

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Apex Soumissions - Initialisation...');

    // Load data from Supabase
    await loadMateriaux();

    // Setup event listeners
    setupStep1Events();
    setupStep2Events();
    setupStep3Events();

    // Setup dev mode shortcuts
    if (DEV_MODE) {
        setupDevMode();
        console.log('🛠️ MODE DEV ACTIVÉ - Raccourcis:');
        console.log('  D = Remplir formulaire client');
        console.log('  Z = Remplir formulaire zone');
        console.log('  1-5 = Aller à l\'étape X');
        console.log('  ← / → = Étape précédente / suivante');
    }

    console.log('Apex Soumissions - Prêt!');
});

// =====================================================
// STEP 1: RAPPORT QUESTION
// =====================================================

function setupStep1Events() {
    const btnHasReport = document.getElementById('btn-has-report');
    const btnNoReport = document.getElementById('btn-no-report');
    const btnBackToChoice = document.getElementById('btn-back-to-choice');
    const btnBackMobile = document.getElementById('btn-back-mobile');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // Mobile upload elements
    const btnUploadMobile = document.getElementById('btn-upload-mobile');
    const btnChangeFileMobile = document.getElementById('btn-change-file-mobile');

    // Desktop upload elements
    const btnChangeFileDesktop = document.getElementById('btn-change-file-desktop');

    // "Oui" - Has report → Go to upload
    btnHasReport?.addEventListener('click', () => {
        state.hasReport = true;
        selectCard(btnHasReport, btnNoReport);

        // Small delay for visual feedback, then show upload
        setTimeout(() => {
            showUploadSection();
        }, 200);
    });

    // "Non" - No report → Go to step 2
    btnNoReport?.addEventListener('click', () => {
        state.hasReport = false;
        state.rapport = null;
        selectCard(btnNoReport, btnHasReport);

        // Small delay for visual feedback, then go to next step
        setTimeout(() => {
            goToStep(2);
        }, 200);
    });

    // Back to choice (desktop)
    btnBackToChoice?.addEventListener('click', () => {
        showChoiceSection();
    });

    // Back button (mobile) - handles navigation based on current step
    btnBackMobile?.addEventListener('click', () => {
        if (state.currentStep === 3) {
            goToStep(2);
        } else if (state.currentStep === 2) {
            goToStep(1);
        } else if (document.getElementById('step-1b')?.classList.contains('hidden') === false) {
            showChoiceSection();
        }
    });

    // Mobile upload button click
    btnUploadMobile?.addEventListener('click', () => {
        fileInput.click();
    });

    // Mobile change file click
    btnChangeFileMobile?.addEventListener('click', () => {
        fileInput.click();
    });

    // Desktop drop zone click
    dropZone?.addEventListener('click', (e) => {
        if (e.target.id !== 'btn-change-file-desktop') {
            fileInput.click();
        }
    });

    // Desktop change file click
    btnChangeFileDesktop?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Drag and drop (desktop)
    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-blue-50/30');
    });

    dropZone?.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-blue-50/30');
    });

    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-blue-50/30');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelected(files[0]);
        }
    });

    // File input change
    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
        }
    });
}

function selectCard(activeCard, inactiveCard) {
    // Remove active state from inactive card
    inactiveCard?.classList.remove('active');

    // Add active state to active card
    activeCard?.classList.add('active');
}

function showUploadSection() {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-1b').classList.remove('hidden');

    // Show back button on mobile
    const btnBackMobile = document.getElementById('btn-back-mobile');
    btnBackMobile?.classList.remove('invisible');
}

function showChoiceSection() {
    document.getElementById('step-1b').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');

    // Hide back button on mobile
    const btnBackMobile = document.getElementById('btn-back-mobile');
    btnBackMobile?.classList.add('invisible');

    // Reset selection state
    document.getElementById('btn-has-report')?.classList.remove('active');
    document.getElementById('btn-no-report')?.classList.remove('active');

    // Reset upload state - Mobile
    document.getElementById('btn-upload-mobile')?.classList.remove('hidden');
    document.getElementById('upload-success-mobile')?.classList.add('hidden');

    // Reset upload state - Desktop
    document.getElementById('upload-default-desktop')?.classList.remove('hidden');
    document.getElementById('upload-success-desktop')?.classList.add('hidden');

    // Reset file input
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';

    state.rapport = null;
    state.hasReport = null;
}

function handleFileSelected(file) {
    // Validate file type
    if (file.type !== 'application/pdf') {
        alert('Veuillez sélectionner un fichier PDF.');
        return;
    }

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
        alert('Le fichier est trop volumineux. Maximum 25MB.');
        return;
    }

    // Save to state
    state.rapport = file;

    // Update UI - Mobile
    const btnUploadMobile = document.getElementById('btn-upload-mobile');
    const uploadSuccessMobile = document.getElementById('upload-success-mobile');
    const fileNameMobile = document.getElementById('file-name-mobile');

    if (btnUploadMobile) btnUploadMobile.classList.add('hidden');
    if (uploadSuccessMobile) uploadSuccessMobile.classList.remove('hidden');
    if (fileNameMobile) fileNameMobile.textContent = file.name;

    // Update UI - Desktop
    const uploadDefaultDesktop = document.getElementById('upload-default-desktop');
    const uploadSuccessDesktop = document.getElementById('upload-success-desktop');
    const fileNameDesktop = document.getElementById('file-name-desktop');

    if (uploadDefaultDesktop) uploadDefaultDesktop.classList.add('hidden');
    if (uploadSuccessDesktop) uploadSuccessDesktop.classList.remove('hidden');
    if (fileNameDesktop) fileNameDesktop.textContent = file.name;

    console.log('Fichier sélectionné:', file.name);

    // Auto-advance to next step after showing success
    setTimeout(() => {
        goToStep(2);
    }, 600);
}

// =====================================================
// STEP 2: CLIENT INFORMATION
// =====================================================

function setupStep2Events() {
    const form = document.getElementById('client-form');
    const btnBack = document.getElementById('btn-back-step2');
    const distanceInput = document.getElementById('client-distance');

    // Back button
    btnBack?.addEventListener('click', () => {
        goToStep(1);
    });

    // Distance change - update transport cost display
    distanceInput?.addEventListener('input', (e) => {
        updateTransportCost(parseInt(e.target.value) || 0);
    });

    // Form submission
    form?.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validate and save to state
        const nom = document.getElementById('client-nom').value.trim();
        const telephone = document.getElementById('client-telephone').value.trim();
        const courriel = document.getElementById('client-courriel').value.trim();
        const adresse = document.getElementById('client-adresse').value.trim();
        const distance = parseInt(document.getElementById('client-distance').value) || 0;

        if (!nom || !telephone || !courriel || !adresse) {
            alert('Veuillez remplir tous les champs.');
            return;
        }

        // Save to state
        state.client = {
            nom,
            telephone,
            courriel,
            adresseChantier: adresse,
            distanceKm: distance
        };

        console.log('Client info saved:', state.client);

        // Go to next step
        goToStep(3);
    });
}

function updateTransportCost(distance) {
    const transportCostEl = document.getElementById('transport-cost');
    if (!transportCostEl) return;

    let cost = 55; // Default 0-50km
    let message = '';

    if (distance > 100) {
        cost = 75;
        message = `Frais de transport : ${cost} $ <span class="text-amber-600 font-medium">(+ prévoir pension)</span>`;
    } else if (distance > 50) {
        cost = 75;
        message = `Frais de transport : ${cost} $`;
    } else {
        message = `Frais de transport : ${cost} $`;
    }

    transportCostEl.innerHTML = message;
}

// =====================================================
// STEP 3: ZONES
// =====================================================

async function loadMateriaux() {
    try {
        const { data, error } = await supabaseClient
            .from('materiaux')
            .select('*')
            .order('ordre');

        if (error) throw error;

        state.materiaux = data;
        console.log(`✅ ${data.length} matériaux chargés depuis Supabase`);

        // Populate the dropdown
        populateMateriauxDropdown();
    } catch (err) {
        console.error('Erreur chargement matériaux:', err);
        // Fallback: use hardcoded list if Supabase fails
        state.materiaux = [
            { id: 1, nom: 'Gypse (panneau 1/2")', friabilite: 'non_friable', epaisseur_defaut: 0.5 },
            { id: 2, nom: 'Plâtre sur lattes', friabilite: 'friable', epaisseur_defaut: 0.875 },
            { id: 3, nom: 'Tuile vinyle 9x9', friabilite: 'non_friable', epaisseur_defaut: 0.0625 },
            { id: 4, nom: 'Vermiculite (Zonolite)', friabilite: 'friable', epaisseur_defaut: 4.0 }
        ];
        populateMateriauxDropdown();
    }
}

function populateMateriauxDropdown() {
    const select = document.getElementById('zone-materiau');
    if (!select) return;

    // Clear existing options (keep first placeholder)
    select.innerHTML = '<option value="">Sélectionner un matériau</option>';

    // Add materiaux
    state.materiaux.forEach(mat => {
        const option = document.createElement('option');
        option.value = mat.id;
        option.textContent = mat.nom;
        option.dataset.friabilite = mat.friabilite;
        option.dataset.epaisseur = mat.epaisseur_defaut;
        select.appendChild(option);
    });
}

function setupStep3Events() {
    const form = document.getElementById('zone-form');
    const btnBack = document.getElementById('btn-back-step3');
    const materiauSelect = document.getElementById('zone-materiau');
    const longueurInput = document.getElementById('zone-longueur');
    const largeurInput = document.getElementById('zone-largeur');
    const epaisseurInput = document.getElementById('zone-epaisseur');

    // Back button
    btnBack?.addEventListener('click', () => {
        goToStep(2);
    });

    // Material change → update friability badge + default thickness
    materiauSelect?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const friabilite = selectedOption.dataset.friabilite;
        const epaisseur = selectedOption.dataset.epaisseur;

        updateFriabiliteBadge(friabilite);

        // Set default thickness
        if (epaisseur && epaisseurInput) {
            epaisseurInput.value = epaisseur;
            calculateZoneValues();
        }
    });

    // Dimension inputs → recalculate
    [longueurInput, largeurInput, epaisseurInput].forEach(input => {
        input?.addEventListener('input', calculateZoneValues);
    });

    // Form submission
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        addZone();
    });
}

function updateFriabiliteBadge(friabilite) {
    const badge = document.getElementById('friabilite-badge');
    const text = document.getElementById('friabilite-text');
    if (!badge || !text) return;

    badge.classList.remove('hidden');

    if (friabilite === 'friable') {
        text.textContent = 'FRIABLE';
        text.className = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-red-100 text-red-600';
    } else {
        text.textContent = 'NON FRIABLE';
        text.className = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-slate-100 text-slate-500';
    }
}

function calculateZoneValues() {
    const longueur = parseFloat(document.getElementById('zone-longueur')?.value) || 0;
    const largeur = parseFloat(document.getElementById('zone-largeur')?.value) || 0;
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) || 0;

    // Get friability from selected material
    const materiauSelect = document.getElementById('zone-materiau');
    const selectedOption = materiauSelect?.options[materiauSelect.selectedIndex];
    const friabilite = selectedOption?.dataset.friabilite || 'non_friable';

    // Calculate surface (pi²) = L × l
    const surface = longueur * largeur;

    // Calculate volume (pi³) = L × l × (épaisseur_po / 12)
    const volume = longueur * largeur * (epaisseur / 12);

    // Determine risk based on CSTC rules
    const risque = determineRisque(volume, friabilite);

    // Update UI
    document.getElementById('calc-surface').textContent = surface > 0 ? surface.toFixed(1) : '--';
    document.getElementById('calc-volume').textContent = volume > 0 ? volume.toFixed(2) : '--';

    const risqueEl = document.getElementById('calc-risque');
    if (risqueEl) {
        if (risque === 'ÉLEVÉ') {
            risqueEl.textContent = 'ÉLEVÉ';
            risqueEl.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-600';
        } else if (risque === 'MODÉRÉ') {
            risqueEl.textContent = 'MODÉRÉ';
            risqueEl.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-600';
        } else {
            risqueEl.textContent = '--';
            risqueEl.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-400';
        }
    }

    return { surface, volume, risque, friabilite };
}

function determineRisque(volume, friabilite) {
    // CSTC Rules:
    // - Friable: > 1 pi³ = ÉLEVÉ
    // - Non friable: > 10 pi³ = ÉLEVÉ
    if (volume <= 0) return null;

    if (friabilite === 'friable') {
        return volume > 1 ? 'ÉLEVÉ' : 'MODÉRÉ';
    } else {
        return volume > 10 ? 'ÉLEVÉ' : 'MODÉRÉ';
    }
}

function addZone() {
    const nom = document.getElementById('zone-nom')?.value.trim();
    const categorie = document.getElementById('zone-categorie')?.value;
    const materiauSelect = document.getElementById('zone-materiau');
    const materiauId = materiauSelect?.value;
    const materiauNom = materiauSelect?.options[materiauSelect.selectedIndex]?.textContent;
    const longueur = parseFloat(document.getElementById('zone-longueur')?.value) || 0;
    const largeur = parseFloat(document.getElementById('zone-largeur')?.value) || 0;
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) || 0;

    // Validate
    if (!nom || !categorie || !materiauId || longueur <= 0 || largeur <= 0 || epaisseur <= 0) {
        alert('Veuillez remplir tous les champs.');
        return;
    }

    // Calculate values
    const { surface, volume, risque, friabilite } = calculateZoneValues();

    // Create zone object
    const zone = {
        id: Date.now(), // Unique ID
        nom,
        categorie,
        materiauId,
        materiauNom,
        friabilite,
        longueur,
        largeur,
        epaisseur,
        surface,
        volume,
        risque
    };

    // Add to state
    state.zones.push(zone);
    console.log('✅ Zone ajoutée:', zone);
    console.log('📋 Total zones:', state.zones.length);

    // Reset form
    resetZoneForm();

    // Go to zone list (step 3b) - for now just show alert
    // TODO: Navigate to step 3b when implemented
    alert(`Zone "${nom}" ajoutée!\n\nTotal: ${state.zones.length} zone(s)\n\n(L'écran de liste des zones sera implémenté prochainement)`);
}

function resetZoneForm() {
    document.getElementById('zone-nom').value = '';
    document.getElementById('zone-categorie').value = '';
    document.getElementById('zone-materiau').value = '';
    document.getElementById('zone-longueur').value = '';
    document.getElementById('zone-largeur').value = '';
    document.getElementById('zone-epaisseur').value = '';

    // Reset calculated values
    document.getElementById('calc-surface').textContent = '--';
    document.getElementById('calc-volume').textContent = '--';
    document.getElementById('calc-risque').textContent = '--';
    document.getElementById('calc-risque').className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-400';

    // Hide friability badge
    document.getElementById('friabilite-badge')?.classList.add('hidden');
}

// =====================================================
// NAVIGATION
// =====================================================

function goToStep(step) {
    console.log(`Navigation vers étape ${step}`);

    // Hide all steps
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.add('hidden');
    });

    // Show the target step
    if (step === 1) {
        // Check if we need to show upload or choice
        if (state.hasReport === true && state.rapport) {
            document.getElementById('step-1b').classList.remove('hidden');
        } else {
            document.getElementById('step-1').classList.remove('hidden');
            // Reset mobile back button
            document.getElementById('btn-back-mobile')?.classList.add('invisible');
        }
    } else if (step === 2) {
        document.getElementById('step-2').classList.remove('hidden');
        // Show mobile back button
        document.getElementById('btn-back-mobile')?.classList.remove('invisible');
    } else if (step === 3) {
        document.getElementById('step-3').classList.remove('hidden');
        // Show mobile back button
        document.getElementById('btn-back-mobile')?.classList.remove('invisible');
    }

    // Update progress bar (desktop + mobile)
    updateProgressBar(step);

    state.currentStep = step;
}

function updateProgressBar(step) {
    // Update step label (desktop)
    const stepLabel = document.getElementById('step-label');
    if (stepLabel) {
        stepLabel.textContent = `Étape ${step} sur 5`;
    }

    // Update step label (mobile)
    const stepLabelMobile = document.getElementById('step-label-mobile');
    if (stepLabelMobile) {
        stepLabelMobile.textContent = `Étape ${step} sur 5`;
    }

    // Update mobile progress bar
    const progressFillMobile = document.getElementById('progress-fill-mobile');
    if (progressFillMobile) {
        progressFillMobile.style.width = `${step * 20}%`;
    }

    // Update desktop progress segments
    for (let i = 1; i <= 5; i++) {
        const segment = document.getElementById(`progress-${i}`);
        if (segment) {
            if (i <= step) {
                segment.classList.add('bg-primary');
                segment.classList.remove('flex-1');
                segment.classList.add('w-1/5');
            } else {
                segment.classList.remove('bg-primary');
                segment.classList.remove('w-1/5');
                segment.classList.add('flex-1');
            }
        }
    }
}

// =====================================================
// DEV MODE
// =====================================================

function setupDevMode() {
    document.addEventListener('keydown', (e) => {
        // Ignorer si on est dans un input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Debug: log toutes les touches
        console.log(`🔑 Touche: "${e.key}" | Étape actuelle: ${state.currentStep}`);

        // D = Remplir le formulaire client
        if (e.key.toLowerCase() === 'd') {
            fillDevClientData();
        }

        // Z = Remplir le formulaire zone
        if (e.key.toLowerCase() === 'z') {
            fillDevZoneData();
        }

        // 1-5 = Navigation directe vers étape
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
            const step = parseInt(e.key);
            devGoToStep(step);
        }

        // Flèches gauche/droite = Navigation étape précédente/suivante
        if (e.key === 'ArrowLeft') {
            if (state.currentStep > 1) {
                devGoToStep(state.currentStep - 1);
            } else {
                console.log('⚠️ Déjà à l\'étape 1');
            }
        }
        if (e.key === 'ArrowRight') {
            if (state.currentStep < 5) {
                devGoToStep(state.currentStep + 1);
            } else {
                console.log('⚠️ Déjà à l\'étape 5');
            }
        }
    });

    // Afficher indicateur DEV
    const devBadge = document.createElement('div');
    devBadge.innerHTML = '🛠️ DEV';
    devBadge.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 9999;';
    document.body.appendChild(devBadge);
}

function fillDevClientData() {
    const data = DEV_DATA.client;

    // Remplir les champs
    const nomInput = document.getElementById('client-nom');
    const telInput = document.getElementById('client-telephone');
    const emailInput = document.getElementById('client-courriel');
    const adresseInput = document.getElementById('client-adresse');
    const distanceInput = document.getElementById('client-distance');

    if (nomInput) nomInput.value = data.nom;
    if (telInput) telInput.value = data.telephone;
    if (emailInput) emailInput.value = data.courriel;
    if (adresseInput) adresseInput.value = data.adresseChantier;
    if (distanceInput) {
        distanceInput.value = data.distanceKm;
        updateTransportCost(data.distanceKm);
    }

    console.log('📝 Données client pré-remplies');
}

function fillDevZoneData() {
    const data = DEV_DATA.zones[0];

    document.getElementById('zone-nom').value = data.nom;
    document.getElementById('zone-categorie').value = data.categorie;

    // Find and select the material
    const materiauSelect = document.getElementById('zone-materiau');
    if (materiauSelect && state.materiaux.length > 0) {
        // Select the first material for simplicity
        materiauSelect.value = state.materiaux[0].id;
        // Trigger change to update friability
        materiauSelect.dispatchEvent(new Event('change'));
    }

    document.getElementById('zone-longueur').value = data.longueur;
    document.getElementById('zone-largeur').value = data.largeur;
    document.getElementById('zone-epaisseur').value = data.epaisseur;

    // Trigger calculation
    calculateZoneValues();

    console.log('📝 Données zone pré-remplies');
}

function devGoToStep(step) {
    // Pré-remplir le state si nécessaire
    if (step >= 2) {
        state.hasReport = false;
        state.client = DEV_DATA.client;
    }
    if (step >= 3) {
        state.zones = DEV_DATA.zones;
    }

    // Forcer la navigation
    console.log(`🚀 DEV: Saut vers étape ${step}`);

    // Cacher toutes les étapes
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.add('hidden');
    });

    // Afficher l'étape demandée
    const stepEl = document.getElementById(`step-${step}`);
    if (stepEl) {
        stepEl.classList.remove('hidden');
    } else {
        console.warn(`Étape ${step} pas encore implémentée`);
        alert(`Étape ${step} pas encore implémentée`);
        return;
    }

    // Mettre à jour le state et la progress bar
    state.currentStep = step;
    updateProgressBar(step);

    // Afficher le bouton retour sur mobile
    const btnBackMobile = document.getElementById('btn-back-mobile');
    if (step > 1) {
        btnBackMobile?.classList.remove('invisible');
    } else {
        btnBackMobile?.classList.add('invisible');
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

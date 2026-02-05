/* =====================================================
   APEX SOUMISSIONS AMIANTE - Application JavaScript
   ===================================================== */

// =====================================================
// MODE DÉVELOPPEMENT
// =====================================================

const DEV_MODE = false; // Mettre à false en production

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

// Mapbox Configuration
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoicmVub3ZhdGlvbnJmIiwiYSI6ImNtamtxY2M5NzB1M3gzZG95eXYxd3EyNWwifQ.dus2yGGW12TnqPYsNq26sw';

// Adresse de base Apex Désamiantage
// 689 rue des Caryers, Québec, QC G3G 2B4
const APEX_BASE_LOCATION = {
    lng: -71.2342,
    lat: 46.8785
};

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
        distanceKm: 0,
        coordinates: null
    },
    zones: [],
    materiaux: [],
    config: {},
    risqueGlobal: null,
    // Multi-surfaces : surfaces temporaires lors de la création/édition d'une zone
    currentSurfaces: [],
    prix: {
        zones: 0,
        demolition: 0,
        douches: 0,
        tests: 0,
        perteTemps: 0,
        transport: 0,
        disposition: 0,
        assurance: 0,
        sousTotal: 0,
        marge: 0,
        total: 0
    }
};

// =====================================================
// FORMATAGE DES NOMBRES (espace comme séparateur milliers)
// =====================================================

/**
 * Formate un nombre avec des espaces comme séparateurs de milliers
 * Ex: 12000 -> "12 000", 1234567.89 -> "1 234 567,89"
 * @param {number} num - Le nombre à formater
 * @param {number} decimals - Nombre de décimales (défaut: 0)
 * @returns {string} - Le nombre formaté
 */
function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    
    // Arrondir au nombre de décimales souhaité
    const fixed = Number(num).toFixed(decimals);
    
    // Séparer partie entière et décimale
    const [intPart, decPart] = fixed.split('.');
    
    // Ajouter des espaces comme séparateurs de milliers
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    // Retourner avec décimales si nécessaire (virgule pour format québécois)
    return decPart ? `${formatted},${decPart}` : formatted;
}

/**
 * Formate un prix avec $ et espaces
 * Ex: 12000 -> "12 000 $"
 */
function formatPrix(num, decimals = 0) {
    return `${formatNumber(num, decimals)} $`;
}

// =====================================================
// AUTO-FIT TEXT - Ajuste la taille de police pour tenir sur une ligne
// =====================================================

/**
 * Ajuste la taille de police d'un élément pour que son contenu tienne sur une ligne
 * @param {HTMLElement} element - L'élément à ajuster
 */
function fitTextToContainer(element) {
    if (!element) return;
    
    const container = element.parentElement;
    if (!container) return;
    
    const minSize = parseInt(element.dataset.minSize) || 12;
    const maxSize = parseInt(element.dataset.maxSize) || 24;
    
    // Reset to max size first
    element.style.fontSize = maxSize + 'px';
    
    // Get container width (accounting for padding)
    const containerStyle = window.getComputedStyle(container);
    const containerWidth = container.clientWidth - parseFloat(containerStyle.paddingLeft) - parseFloat(containerStyle.paddingRight);
    
    // Reduce font size until it fits
    let currentSize = maxSize;
    while (element.scrollWidth > containerWidth && currentSize > minSize) {
        currentSize -= 1;
        element.style.fontSize = currentSize + 'px';
    }
}

/**
 * Ajuste tous les éléments avec la classe .auto-fit-text
 */
function fitAllAutoFitText() {
    document.querySelectorAll('.auto-fit-text').forEach(el => {
        fitTextToContainer(el);
    });
}

// =====================================================
// LOCAL STORAGE - SAVE & RESTORE PROGRESS
// =====================================================

const STORAGE_KEY = 'apex_soumission_draft';

function saveStateToStorage() {
    try {
        // Only save user-entered data, not loaded config/materiaux
        const dataToSave = {
            currentStep: state.currentStep,
            hasReport: state.hasReport,
            rapport: state.rapport,
            client: state.client,
            zones: state.zones,
            savedAt: new Date().toISOString()
        };
        const jsonString = JSON.stringify(dataToSave);
        const sizeKB = Math.round(jsonString.length / 1024);
        
        localStorage.setItem(STORAGE_KEY, jsonString);
        console.log(`💾 Progression sauvegardée (${sizeKB} KB)`);
    } catch (e) {
        console.error('❌ Erreur sauvegarde:', e);
        // Si quota exceeded, on essaie sans les photos
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn('⚠️ Stockage plein - sauvegarde sans photos');
            try {
                const zonesWithoutPhotos = state.zones.map(z => ({
                    ...z,
                    surfaces: z.surfaces?.map(s => ({ ...s, photo: null })) || []
                }));
                const fallbackData = {
                    currentStep: state.currentStep,
                    hasReport: state.hasReport,
                    rapport: state.rapport,
                    client: state.client,
                    zones: zonesWithoutPhotos,
                    savedAt: new Date().toISOString(),
                    photosOmitted: true
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
                console.log('💾 Sauvegardé sans photos');
            } catch (e2) {
                console.error('❌ Impossible de sauvegarder même sans photos:', e2);
            }
        }
    }
}

function loadStateFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Impossible de charger:', e);
    }
    return null;
}

function clearSavedState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️ Progression effacée');
    } catch (e) {
        console.warn('Impossible d\'effacer:', e);
    }
}

function hasSavedProgress() {
    const saved = loadStateFromStorage();
    // Consider it valid progress if there's at least some client info or zones
    return saved && (
        saved.client?.nom || 
        saved.client?.adresseChantier || 
        saved.zones?.length > 0 ||
        saved.currentStep > 1
    );
}

function restoreSavedState() {
    const saved = loadStateFromStorage();
    if (!saved) return false;

    // Restore state
    state.currentStep = saved.currentStep || 1;
    state.hasReport = saved.hasReport;
    state.rapport = saved.rapport;
    state.client = { ...state.client, ...saved.client };
    state.zones = saved.zones || [];

    console.log('✅ Progression restaurée:', saved);
    return true;
}

function applyRestoredStateToUI() {
    // Apply client info to form fields
    const nomInput = document.getElementById('client-nom');
    const telInput = document.getElementById('client-telephone');
    const emailInput = document.getElementById('client-courriel');
    const adresseInput = document.getElementById('client-adresse');

    if (nomInput && state.client.nom) nomInput.value = state.client.nom;
    if (telInput && state.client.telephone) telInput.value = state.client.telephone;
    if (emailInput && state.client.courriel) emailInput.value = state.client.courriel;
    if (adresseInput && state.client.adresseChantier) adresseInput.value = state.client.adresseChantier;

    // Navigate to saved step
    if (state.currentStep > 1) {
        goToStep(state.currentStep);
    }

    // Render zones if any
    if (state.zones.length > 0) {
        renderZoneCards();
    }
}

function showRestoreModal() {
    const saved = loadStateFromStorage();
    if (!saved) return;

    const savedDate = new Date(saved.savedAt);
    const timeAgo = getTimeAgo(savedDate);
    const clientName = saved.client?.nom || 'Sans nom';
    const zonesCount = saved.zones?.length || 0;

    const modal = document.createElement('div');
    modal.id = 'restore-modal';
    modal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-3xl text-primary">restore</span>
                </div>
                <h2 class="text-xl font-bold text-slate-900 mb-2">Reprendre votre soumission ?</h2>
                <p class="text-sm text-slate-500">Vous avez une soumission en cours.</p>
            </div>
            
            <div class="bg-slate-50 rounded-xl p-4 mb-6">
                <div class="flex items-center gap-3 text-sm">
                    <span class="material-symbols-outlined text-slate-400">person</span>
                    <span class="text-slate-700 font-medium">${clientName}</span>
                </div>
                <div class="flex items-center gap-3 text-sm mt-2">
                    <span class="material-symbols-outlined text-slate-400">location_on</span>
                    <span class="text-slate-600">${zonesCount} zone${zonesCount !== 1 ? 's' : ''} ajoutée${zonesCount !== 1 ? 's' : ''}</span>
                </div>
                <div class="flex items-center gap-3 text-sm mt-2">
                    <span class="material-symbols-outlined text-slate-400">schedule</span>
                    <span class="text-slate-500">${timeAgo}</span>
                </div>
            </div>
            
            <div class="flex flex-col gap-3">
                <button id="btn-restore-continue" class="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">play_arrow</span>
                    Continuer
                </button>
                <button id="btn-restore-new" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors">
                    Nouvelle soumission
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('btn-restore-continue')?.addEventListener('click', () => {
        restoreSavedState();
        applyRestoredStateToUI();
        modal.remove();
    });

    document.getElementById('btn-restore-new')?.addEventListener('click', () => {
        clearSavedState();
        resetAllState();
        modal.remove();
    });
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    if (hours < 24) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
}

function resetAllState() {
    state.currentStep = 1;
    state.hasReport = null;
    state.rapport = null;
    state.client = {
        nom: '',
        telephone: '',
        courriel: '',
        adresseChantier: '',
        distanceKm: 0,
        coordinates: null
    };
    state.zones = [];
    
    // Reset all form fields
    document.querySelectorAll('input:not([type="hidden"]):not([type="file"])').forEach(input => {
        input.value = '';
    });
    document.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
    });
    
    // Reset UI
    goToStep(1);
    renderZoneCards();
    
    console.log('🔄 État réinitialisé');
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Apex Soumissions - Initialisation...');

    // Load data from Supabase
    await loadMateriaux();
    await loadConfig();

    // Setup event listeners
    setupStep1Events();
    setupStep2Events();
    setupStep3Events();
    setupStep4Events();
    setupStep5Events();
    setupWizardNavigation();
    setupNewSubmissionButton();

    // Check for saved progress
    if (hasSavedProgress()) {
        showRestoreModal();
    }

    // Setup dev mode shortcuts
    if (DEV_MODE) {
        setupDevMode();
        console.log('🛠️ MODE DEV ACTIVÉ - Raccourcis:');
        console.log('  D = Remplir formulaire client');
        console.log('  Z = Remplir formulaire zone');
        console.log('  1-5 = Aller à l\'étape X');
        console.log('  ← / → = Étape précédente / suivante');
    }

    // Ajuster les textes auto-fit lors du redimensionnement de la fenêtre
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fitAllAutoFitText, 100);
    });

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
        if (state.currentStep === 4) {
            goToStep(3);
        } else if (state.currentStep === 3) {
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
// STEP 2: CLIENT INFORMATION (Wizard sub-steps)
// =====================================================

function setupStep2Events() {
    // === Step 2a: Nom ===
    const nomInput = document.getElementById('client-nom');
    const btnBackStep2a = document.getElementById('btn-back-step2a');
    const btnNextStep2a = document.getElementById('btn-next-step2a');

    nomInput?.addEventListener('input', () => {
        btnNextStep2a.disabled = !nomInput.value.trim();
    });

    // Enable on Enter key
    nomInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nomInput.value.trim()) {
            e.preventDefault();
            goToClientStep('2b');
        }
    });

    btnBackStep2a?.addEventListener('click', () => goToStep(1));
    btnNextStep2a?.addEventListener('click', () => goToClientStep('2b'));

    // === Step 2b: Téléphone ===
    const telInput = document.getElementById('client-telephone');
    const btnBackStep2b = document.getElementById('btn-back-step2b');
    const btnNextStep2b = document.getElementById('btn-next-step2b');

    telInput?.addEventListener('input', () => {
        btnNextStep2b.disabled = !telInput.value.trim();
    });

    telInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && telInput.value.trim()) {
            e.preventDefault();
            goToClientStep('2c');
        }
    });

    btnBackStep2b?.addEventListener('click', () => goToClientStep('2a'));
    btnNextStep2b?.addEventListener('click', () => goToClientStep('2c'));

    // === Step 2c: Courriel ===
    const emailInput = document.getElementById('client-courriel');
    const btnBackStep2c = document.getElementById('btn-back-step2c');
    const btnNextStep2c = document.getElementById('btn-next-step2c');

    emailInput?.addEventListener('input', () => {
        btnNextStep2c.disabled = !emailInput.value.trim() || !emailInput.validity.valid;
    });

    emailInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && emailInput.value.trim() && emailInput.validity.valid) {
            e.preventDefault();
            goToClientStep('2d');
        }
    });

    btnBackStep2c?.addEventListener('click', () => goToClientStep('2b'));
    btnNextStep2c?.addEventListener('click', () => goToClientStep('2d'));

    // === Step 2d: Adresse ===
    const btnBackStep2d = document.getElementById('btn-back-step2d');
    const btnNextStep2d = document.getElementById('btn-next-step2d');

    btnBackStep2d?.addEventListener('click', () => goToClientStep('2c'));
    btnNextStep2d?.addEventListener('click', () => {
        // Save all client data to state
        state.client = {
            ...state.client,
            nom: document.getElementById('client-nom').value.trim(),
            telephone: document.getElementById('client-telephone').value.trim(),
            courriel: document.getElementById('client-courriel').value.trim(),
            adresseChantier: document.getElementById('client-adresse').value.trim(),
            distanceKm: parseInt(document.getElementById('client-distance').value) || 0
        };
        console.log('Client info saved:', state.client);
        
        // Save progress to localStorage
        saveStateToStorage();
        
        goToStep(3);
    });

    // Setup Mapbox address autocomplete
    setupAddressAutocomplete();
}

function goToClientStep(subStep) {
    // Hide all step-2 sub-sections
    document.querySelectorAll('[id^="step-2"]').forEach(el => el.classList.add('hidden'));

    // Show the target sub-step
    const targetEl = document.getElementById(`step-${subStep}`);
    if (targetEl) {
        targetEl.classList.remove('hidden');
        // Focus the input
        const input = targetEl.querySelector('input:not([type="hidden"])');
        setTimeout(() => input?.focus(), 100);
    }

    // Update progress bar (still step 2)
    updateProgressBar(2);
    state.currentStep = 2;

    // Show mobile back button
    document.getElementById('btn-back-mobile')?.classList.remove('invisible');

    // Update continue button states based on current values
    updateWizardButtonStates();
}

function updateWizardButtonStates() {
    const nom = document.getElementById('client-nom')?.value.trim();
    const tel = document.getElementById('client-telephone')?.value.trim();
    const email = document.getElementById('client-courriel')?.value.trim();
    const adresse = document.getElementById('client-adresse')?.value.trim();

    const btnNext2a = document.getElementById('btn-next-step2a');
    const btnNext2b = document.getElementById('btn-next-step2b');
    const btnNext2c = document.getElementById('btn-next-step2c');
    const btnNext2d = document.getElementById('btn-next-step2d');

    if (btnNext2a) btnNext2a.disabled = !nom;
    if (btnNext2b) btnNext2b.disabled = !tel;
    if (btnNext2c) btnNext2c.disabled = !email;
    if (btnNext2d) btnNext2d.disabled = !adresse;
}

function setupWizardNavigation() {
    // Add click handlers to all wizard nav buttons
    document.querySelectorAll('.wizard-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gotoStep = btn.dataset.goto;
            if (gotoStep) {
                goToClientStep(gotoStep);
            }
        });
    });
}

function setupNewSubmissionButton() {
    const btnNewMobile = document.getElementById('btn-new-soumission-mobile');
    const btnNewDesktop = document.getElementById('btn-new-soumission-desktop');

    const handleNewSubmission = () => {
        if (state.zones.length > 0 || state.client.nom || state.client.adresseChantier) {
            // Show confirmation if there's data
            if (confirm('Voulez-vous vraiment recommencer ? Toutes les données seront perdues.')) {
                clearSavedState();
                resetAllState();
            }
        } else {
            clearSavedState();
            resetAllState();
        }
    };

    btnNewMobile?.addEventListener('click', handleNewSubmission);
    btnNewDesktop?.addEventListener('click', handleNewSubmission);
}

// =====================================================
// MAPBOX ADDRESS AUTOCOMPLETE
// =====================================================

let searchTimeout = null;

function setupAddressAutocomplete() {
    const adresseInput = document.getElementById('client-adresse');
    const suggestionsContainer = document.getElementById('adresse-suggestions');
    const loadingSpinner = document.getElementById('adresse-loading');

    if (!adresseInput || !suggestionsContainer) return;

    // Input event - search as user types
    adresseInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Hide suggestions if query is too short
        if (query.length < 3) {
            hideSuggestions();
            return;
        }

        // Debounce - wait 300ms after user stops typing
        searchTimeout = setTimeout(() => {
            searchAddresses(query);
        }, 300);
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!adresseInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Keyboard navigation
    adresseInput.addEventListener('keydown', (e) => {
        const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
        const activeSuggestion = suggestionsContainer.querySelector('.suggestion-item.active');
        let activeIndex = Array.from(suggestions).indexOf(activeSuggestion);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeIndex < suggestions.length - 1) {
                suggestions[activeIndex]?.classList.remove('active', 'bg-blue-50');
                suggestions[activeIndex + 1]?.classList.add('active', 'bg-blue-50');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeIndex > 0) {
                suggestions[activeIndex]?.classList.remove('active', 'bg-blue-50');
                suggestions[activeIndex - 1]?.classList.add('active', 'bg-blue-50');
            }
        } else if (e.key === 'Enter' && activeSuggestion) {
            e.preventDefault();
            activeSuggestion.click();
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });
}

async function searchAddresses(query) {
    const loadingSpinner = document.getElementById('adresse-loading');
    const suggestionsContainer = document.getElementById('adresse-suggestions');

    // Show loading
    loadingSpinner?.classList.remove('hidden');

    try {
        // Mapbox Geocoding API - search for addresses in Quebec, Canada
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=ca&types=address,place&language=fr&limit=5&bbox=-79.76,45.0,-57.1,62.6`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            displaySuggestions(data.features);
        } else {
            hideSuggestions();
        }
    } catch (error) {
        console.error('Erreur recherche adresse:', error);
        hideSuggestions();
    } finally {
        // Hide loading
        loadingSpinner?.classList.add('hidden');
    }
}

function displaySuggestions(features) {
    const suggestionsContainer = document.getElementById('adresse-suggestions');
    if (!suggestionsContainer) return;

    // Clear previous suggestions
    suggestionsContainer.innerHTML = '';

    features.forEach((feature, index) => {
        const div = document.createElement('div');
        div.className = `suggestion-item px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${index === 0 ? 'rounded-t-xl' : ''} ${index === features.length - 1 ? 'rounded-b-xl' : 'border-b border-slate-100'}`;
        div.dataset.lng = feature.center[0];
        div.dataset.lat = feature.center[1];
        div.dataset.placeName = feature.place_name;

        // Icon + text
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-slate-400 text-lg">location_on</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate">${feature.text || ''}</p>
                    <p class="text-xs text-slate-500 truncate">${feature.place_name || ''}</p>
                </div>
            </div>
        `;

        // Click handler
        div.addEventListener('click', () => {
            selectAddress(feature);
        });

        suggestionsContainer.appendChild(div);
    });

    // Show container
    suggestionsContainer.classList.remove('hidden');
}

function hideSuggestions() {
    const suggestionsContainer = document.getElementById('adresse-suggestions');
    suggestionsContainer?.classList.add('hidden');
}

async function selectAddress(feature) {
    const adresseInput = document.getElementById('client-adresse');
    const distanceInput = document.getElementById('client-distance');
    const loadingSpinner = document.getElementById('adresse-loading');
    const distanceCard = document.getElementById('distance-card');
    const distanceDisplay = document.getElementById('distance-display');
    const transportCostDisplay = document.getElementById('transport-cost-display');
    const btnNextStep2d = document.getElementById('btn-next-step2d');

    // Set the address in input
    if (adresseInput) {
        adresseInput.value = feature.place_name;
    }

    // Hide suggestions immediately
    hideSuggestions();

    // Get chantier coordinates
    const chantierLng = feature.center[0];
    const chantierLat = feature.center[1];

    // Store coordinates in state
    state.client.coordinates = {
        lng: chantierLng,
        lat: chantierLat
    };

    // Show loading while calculating route distance
    loadingSpinner?.classList.remove('hidden');

    try {
        // Use Mapbox Directions API for real driving distance
        const distanceKm = await calculateDrivingDistance(
            APEX_BASE_LOCATION.lng,
            APEX_BASE_LOCATION.lat,
            chantierLng,
            chantierLat
        );

        // Set hidden distance input
        if (distanceInput) {
            distanceInput.value = distanceKm;
        }

        // Update distance card display
        if (distanceDisplay) {
            distanceDisplay.textContent = distanceKm;
        }

        // Calculate and display transport cost
        const transportCost = getTransportCost(distanceKm);
        if (transportCostDisplay) {
            transportCostDisplay.textContent = `${transportCost} $`;
        }

        // Show distance card
        distanceCard?.classList.remove('hidden');

        // Enable continue button
        if (btnNextStep2d) {
            btnNextStep2d.disabled = false;
        }

        console.log(`📍 Adresse sélectionnée: ${feature.place_name}`);
        console.log(`📏 Distance routière: ${distanceKm} km (depuis Québec)`);

    } catch (error) {
        console.error('Erreur calcul distance routière:', error);
        
        // Fallback: use Haversine (straight line) distance
        const straightDistance = calculateDistance(
            APEX_BASE_LOCATION.lat,
            APEX_BASE_LOCATION.lng,
            chantierLat,
            chantierLng
        );
        const distanceKm = Math.round(straightDistance * 1.3); // +30% pour approximer route

        if (distanceInput) {
            distanceInput.value = distanceKm;
        }

        if (distanceDisplay) {
            distanceDisplay.textContent = distanceKm;
        }

        const transportCost = getTransportCost(distanceKm);
        if (transportCostDisplay) {
            transportCostDisplay.textContent = `${transportCost} $`;
        }

        distanceCard?.classList.remove('hidden');

        if (btnNextStep2d) {
            btnNextStep2d.disabled = false;
        }

        console.log(`📏 Distance estimée (fallback): ${distanceKm} km`);
    } finally {
        loadingSpinner?.classList.add('hidden');
    }
}

function getTransportCost(distance) {
    // Note: Ceci est un indicateur. Le vrai calcul se fait à l'étape 4
    // basé sur la durée du projet (heures ÷ équipe ÷ 8h × 75$/jour)
    if (distance > 100) {
        return '75$/jour + pension';
    } else if (distance > 50) {
        return '75$/jour';
    }
    return '55$ (local)';
}

// Calculate real driving distance using Mapbox Directions API
async function calculateDrivingDistance(fromLng, fromLat, toLng, toLat) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&access_token=${MAPBOX_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
        // Distance is in meters, convert to km
        const distanceMeters = data.routes[0].distance;
        return Math.round(distanceMeters / 1000);
    }

    throw new Error('No route found');
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

function updateTransportCost(distance) {
    const transportCostEl = document.getElementById('transport-cost');
    if (!transportCostEl) return;

    let message = '';

    if (distance > 100) {
        message = `<span class="font-bold">75$/jour</span> <span class="text-amber-600 font-medium">+ pension</span>`;
    } else if (distance > 50) {
        message = `<span class="font-bold">75$/jour</span>`;
    } else {
        message = `<span class="font-bold">55$</span> <span class="text-slate-500">(local)</span>`;
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

        // Si la table est vide, utiliser le fallback
        if (data && data.length > 0) {
            state.materiaux = data;
            console.log(`✅ ${data.length} matériaux chargés depuis Supabase`);
            populateMateriauxDropdown();
            return;
        }
        
        console.log('⚠️ Table materiaux vide, utilisation du fallback');
    } catch (err) {
        console.error('Erreur chargement matériaux:', err);
    }
    
    // Fallback: use hardcoded list based on MATERIAUX_REFERENCE.md
    state.materiaux = [
            // Mur/Plafond
            { id: 1, nom: 'Gypse (panneau 1/2")', friabilite: 'non_friable', epaisseur_defaut: 0.5, categorie: 'Mur/Plafond' },
            { id: 2, nom: 'Gypse 3/8"', friabilite: 'non_friable', epaisseur_defaut: 0.375, categorie: 'Mur/Plafond' },
            { id: 3, nom: 'Gypse 5/8"', friabilite: 'non_friable', epaisseur_defaut: 0.625, categorie: 'Mur/Plafond' },
            { id: 4, nom: 'Composé à joints', friabilite: 'non_friable', epaisseur_defaut: 0.0625, categorie: 'Mur/Plafond' },
            { id: 5, nom: 'Plâtre sur lattes', friabilite: 'friable', epaisseur_defaut: 0.875, categorie: 'Mur/Plafond' },
            { id: 6, nom: 'Crépi cimentaire', friabilite: 'friable', epaisseur_defaut: 0.5, categorie: 'Mur/Plafond' },
            // Plancher
            { id: 7, nom: 'Tuile vinyle 9x9', friabilite: 'non_friable', epaisseur_defaut: 0.0625, categorie: 'Plancher' },
            { id: 8, nom: 'Tuile vinyle 12x12', friabilite: 'non_friable', epaisseur_defaut: 0.0625, categorie: 'Plancher' },
            // Isolation
            { id: 9, nom: 'Vermiculite (Zonolite)', friabilite: 'friable', epaisseur_defaut: 4.0, categorie: 'Isolation' },
            { id: 10, nom: 'Calorifuge tuyaux', friabilite: 'friable', epaisseur_defaut: 1.0, categorie: 'Isolation' },
            { id: 11, nom: 'Flocage (projection)', friabilite: 'friable', epaisseur_defaut: 1.0, categorie: 'Isolation' },
            // Revêtement extérieur / Toiture
            { id: 12, nom: 'Bardeaux asphalte', friabilite: 'non_friable', epaisseur_defaut: 0.125, categorie: 'Revêtement extérieur' },
            { id: 13, nom: 'Panneau fibrociment', friabilite: 'non_friable', epaisseur_defaut: 0.25, categorie: 'Revêtement extérieur' },
            { id: 14, nom: 'Mastic fenêtre', friabilite: 'non_friable', epaisseur_defaut: 0.25, categorie: 'Revêtement extérieur' },
            // Panneaux thermiques
            { id: 15, nom: 'Panneau isolant rigide', friabilite: 'non_friable', epaisseur_defaut: 1.0, categorie: 'Panneaux thermiques' },
        ];
        populateMateriauxDropdown();
    }
}

function populateMateriauxDropdown() {
    const optionsList = document.getElementById('materiau-options-list');
    if (!optionsList) return;

    // Clear existing options
    optionsList.innerHTML = '';

    // Add materiaux options
    state.materiaux.forEach(mat => {
        const option = document.createElement('div');
        option.className = 'custom-dropdown-option';
        option.dataset.value = mat.id;
        option.dataset.nom = mat.nom;
        option.dataset.friabilite = mat.friabilite;
        option.dataset.epaisseur = mat.epaisseur_defaut;
        
        // Determine icon based on material type (using valid Material Symbols icons)
        let icon = 'category';
        const nomLower = mat.nom.toLowerCase();
        if (nomLower.includes('gypse') || nomLower.includes('plâtre') || nomLower.includes('platre')) icon = 'dashboard';
        else if (nomLower.includes('tuile') || nomLower.includes('vinyl')) icon = 'grid_view';
        else if (nomLower.includes('vermiculite') || nomLower.includes('isolant')) icon = 'thermostat';
        else if (nomLower.includes('bardeau') || nomLower.includes('fibrociment')) icon = 'roofing';
        else if (nomLower.includes('composé') || nomLower.includes('compose') || nomLower.includes('joint')) icon = 'format_paint';
        else if (nomLower.includes('crépi') || nomLower.includes('crepi') || nomLower.includes('ciment')) icon = 'texture';
        else if (nomLower.includes('mastic') || nomLower.includes('fenêtre') || nomLower.includes('fenetre')) icon = 'window';
        else if (nomLower.includes('panneau')) icon = 'view_module';
        
        const friabiliteText = mat.friabilite === 'friable' ? 'Friable' : 'Non friable';
        const friabiliteClass = mat.friabilite === 'friable' ? 'text-red-500' : 'text-green-600';
        
        option.innerHTML = `
            <div class="option-icon">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="option-text">
                <p class="option-name">${mat.nom}</p>
                <p class="option-meta"><span class="${friabiliteClass}">${friabiliteText}</span> • Épaisseur: ${mat.epaisseur_defaut}"</p>
            </div>
            <div class="option-check">
                <span class="material-symbols-outlined text-sm">check</span>
            </div>
        `;
        
        // Click handler
        option.addEventListener('click', () => selectMateriauOption(mat));
        
        optionsList.appendChild(option);
    });

    // Setup custom dropdown events
    setupCustomDropdown();
}

// =====================================================
// CUSTOM DROPDOWN FUNCTIONALITY
// =====================================================

function setupCustomDropdown() {
    const trigger = document.getElementById('materiau-dropdown-trigger');
    const panel = document.getElementById('materiau-dropdown-panel');
    const backdrop = document.getElementById('materiau-dropdown-backdrop');
    const closeBtn = document.getElementById('materiau-dropdown-close');
    const searchInput = document.getElementById('materiau-search-input');
    const dropdown = document.getElementById('materiau-dropdown');
    
    if (!trigger || !panel) return;

    // Open dropdown
    trigger.addEventListener('click', () => {
        openMateriauxDropdown();
    });

    // Close on backdrop click
    backdrop?.addEventListener('click', () => {
        closeMateriauxDropdown();
    });

    // Close button (mobile)
    closeBtn?.addEventListener('click', () => {
        closeMateriauxDropdown();
    });

    // Search functionality
    searchInput?.addEventListener('input', (e) => {
        filterMateriauxOptions(e.target.value);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.classList.contains('hidden')) {
            closeMateriauxDropdown();
        }
    });
}

function openMateriauxDropdown() {
    const panel = document.getElementById('materiau-dropdown-panel');
    const dropdown = document.getElementById('materiau-dropdown');
    const searchInput = document.getElementById('materiau-search-input');
    
    panel?.classList.remove('hidden');
    dropdown?.classList.add('open');
    
    // Focus search input after a small delay (for animation)
    setTimeout(() => {
        searchInput?.focus();
    }, 100);
    
    // Clear previous search
    if (searchInput) searchInput.value = '';
    filterMateriauxOptions('');
    
    // Prevent body scroll on mobile
    document.body.style.overflow = 'hidden';
}

function closeMateriauxDropdown() {
    const panel = document.getElementById('materiau-dropdown-panel');
    const dropdown = document.getElementById('materiau-dropdown');
    
    panel?.classList.add('hidden');
    dropdown?.classList.remove('open');
    
    // Restore body scroll
    document.body.style.overflow = '';
}

function filterMateriauxOptions(query) {
    const optionsList = document.getElementById('materiau-options-list');
    if (!optionsList) return;
    
    const normalizedQuery = query.toLowerCase().trim();
    const options = optionsList.querySelectorAll('.custom-dropdown-option');
    let visibleCount = 0;
    
    options.forEach(option => {
        const name = option.dataset.nom.toLowerCase();
        const matches = name.includes(normalizedQuery);
        option.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });
    
    // Show/hide no results message
    let noResults = optionsList.querySelector('.dropdown-no-results');
    if (visibleCount === 0) {
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.className = 'dropdown-no-results';
            noResults.innerHTML = `
                <span class="material-symbols-outlined">search_off</span>
                <p class="text-sm">Aucun matériau trouvé</p>
            `;
            optionsList.appendChild(noResults);
        }
        noResults.style.display = '';
    } else if (noResults) {
        noResults.style.display = 'none';
    }
}

function filterMateriauxByCategorie(categorie) {
    const optionsList = document.getElementById('materiau-options-list');
    if (!optionsList) return;
    
    // Clear existing options
    optionsList.innerHTML = '';
    
    // Filter materials by category
    const filteredMateriaux = state.materiaux.filter(mat => {
        // If no category filter, show all
        if (!categorie) return true;
        
        // Check if material has a category that matches
        if (!mat.categorie) return true; // Show materials without category defined
        
        return mat.categorie === categorie;
    });
    
    // Populate dropdown with filtered materials
    filteredMateriaux.forEach(mat => {
        const option = document.createElement('div');
        option.className = 'custom-dropdown-option';
        option.dataset.value = mat.id;
        option.dataset.nom = mat.nom;
        option.dataset.friabilite = mat.friabilite;
        option.dataset.epaisseur = mat.epaisseur_defaut;
        
        // Determine icon based on material type
        let icon = 'category';
        const nomLower = mat.nom.toLowerCase();
        if (nomLower.includes('gypse') || nomLower.includes('plâtre') || nomLower.includes('platre')) icon = 'dashboard';
        else if (nomLower.includes('tuile') || nomLower.includes('vinyl')) icon = 'grid_view';
        else if (nomLower.includes('vermiculite') || nomLower.includes('isolant') || nomLower.includes('calorifuge') || nomLower.includes('flocage')) icon = 'thermostat';
        else if (nomLower.includes('bardeau') || nomLower.includes('fibrociment')) icon = 'roofing';
        else if (nomLower.includes('composé') || nomLower.includes('compose') || nomLower.includes('joint')) icon = 'format_paint';
        else if (nomLower.includes('crépi') || nomLower.includes('crepi') || nomLower.includes('ciment')) icon = 'texture';
        else if (nomLower.includes('mastic') || nomLower.includes('fenêtre') || nomLower.includes('fenetre')) icon = 'window';
        else if (nomLower.includes('panneau')) icon = 'view_module';
        
        const friabiliteText = mat.friabilite === 'friable' ? 'Friable' : 'Non friable';
        const friabiliteClass = mat.friabilite === 'friable' ? 'text-red-500' : 'text-green-600';
        
        option.innerHTML = `
            <div class="option-icon">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div class="option-text">
                <p class="option-name">${mat.nom}</p>
                <p class="option-meta"><span class="${friabiliteClass}">${friabiliteText}</span> • Épaisseur: ${mat.epaisseur_defaut}"</p>
            </div>
            <div class="option-check">
                <span class="material-symbols-outlined text-sm">check</span>
            </div>
        `;
        
        // Click handler
        option.addEventListener('click', () => selectMateriauOption(mat));
        
        optionsList.appendChild(option);
    });
    
    // Show message if no materials for this category
    if (filteredMateriaux.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'dropdown-no-results';
        noResults.innerHTML = `
            <span class="material-symbols-outlined">info</span>
            <p class="text-sm">Aucun matériau pour cette catégorie</p>
        `;
        optionsList.appendChild(noResults);
    }
    
    // En mode édition, restaurer la sélection si le matériau existe
    const hiddenInput = document.getElementById('zone-materiau');
    const triggerText = document.getElementById('materiau-dropdown-text');
    const currentMateriauId = hiddenInput?.value;
    
    if (state.editingZoneId && currentMateriauId) {
        // Vérifier si le matériau sélectionné est dans la liste filtrée
        const selectedMat = filteredMateriaux.find(mat => mat.id == currentMateriauId);
        
        if (selectedMat) {
            // Marquer l'option comme sélectionnée visuellement
            const options = optionsList.querySelectorAll('.custom-dropdown-option');
            options.forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.value == currentMateriauId) {
                    opt.classList.add('selected');
                }
            });
            
            // S'assurer que le texte du trigger est correct
            if (triggerText) {
                triggerText.textContent = selectedMat.nom;
                triggerText.classList.remove('text-slate-400');
                triggerText.classList.add('text-slate-900');
            }
            
            // Afficher le badge de friabilité
            updateFriabiliteBadge(selectedMat.friabilite);
            
            // Activer le bouton continuer
            const btnNextStep3c = document.getElementById('btn-next-step3c');
            if (btnNextStep3c) btnNextStep3c.disabled = false;
            
            console.log(`🔍 Matériaux filtrés pour "${categorie}": ${filteredMateriaux.length} trouvés (matériau actuel conservé: ${selectedMat.nom})`);
            return;
        }
    }
    
    // Reset the dropdown selection (mode création ou matériau non trouvé)
    if (hiddenInput) {
        hiddenInput.value = '';
        delete hiddenInput.dataset.friabilite;
        delete hiddenInput.dataset.epaisseur;
    }
    if (triggerText) {
        triggerText.textContent = 'Sélectionner un matériau';
        triggerText.classList.add('text-slate-400');
        triggerText.classList.remove('text-slate-900');
    }
    
    // Hide friability badge
    document.getElementById('friabilite-badge')?.classList.add('hidden');
    
    // Disable continue button
    const btnNextStep3c = document.getElementById('btn-next-step3c');
    if (btnNextStep3c) btnNextStep3c.disabled = true;
    
    console.log(`🔍 Matériaux filtrés pour "${categorie}": ${filteredMateriaux.length} trouvés`);
}

function selectMateriauOption(mat) {
    const hiddenInput = document.getElementById('zone-materiau');
    const triggerText = document.getElementById('materiau-dropdown-text');
    const optionsList = document.getElementById('materiau-options-list');
    const epaisseurInput = document.getElementById('zone-epaisseur');
    const btnNextStep3c = document.getElementById('btn-next-step3c');
    
    // Update hidden input value
    if (hiddenInput) {
        hiddenInput.value = mat.id;
        hiddenInput.dataset.friabilite = mat.friabilite;
        hiddenInput.dataset.epaisseur = mat.epaisseur_defaut;
    }
    
    // Update trigger text
    if (triggerText) {
        triggerText.textContent = mat.nom;
        triggerText.classList.remove('text-slate-400');
        triggerText.classList.add('text-slate-900');
    }
    
    // Update selected state in options list
    const options = optionsList?.querySelectorAll('.custom-dropdown-option');
    options?.forEach(opt => {
        if (opt.dataset.value === String(mat.id)) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
    
    // Update friability badge
    updateFriabiliteBadge(mat.friabilite);
    
    // Set default thickness
    if (epaisseurInput && mat.epaisseur_defaut) {
        epaisseurInput.value = mat.epaisseur_defaut;
    }
    
    // Enable continue button
    if (btnNextStep3c) {
        btnNextStep3c.disabled = false;
    }
    
    // Close dropdown
    closeMateriauxDropdown();
    
    console.log('Matériau sélectionné:', mat.nom);
}

function setupStep3Events() {
    // === Zone List (step-3) ===
    const btnAddZone = document.getElementById('btn-add-zone');
    const btnBackStep3 = document.getElementById('btn-back-step3');
    const btnContinueStep3 = document.getElementById('btn-continue-step3');

    // Add zone button → go to zone wizard
    btnAddZone?.addEventListener('click', () => {
        resetZoneForm();
        goToZoneStep('3a');
    });

    // Back button → go to step 2
    btnBackStep3?.addEventListener('click', () => {
        goToStep(2);
    });

    // Continue button → go to step 4
    btnContinueStep3?.addEventListener('click', () => {
        goToStep(4);
    });

    // === Step 3a: Nom ===
    const nomInput = document.getElementById('zone-nom');
    const btnBackStep3a = document.getElementById('btn-back-step3a');
    const btnNextStep3a = document.getElementById('btn-next-step3a');

    nomInput?.addEventListener('input', () => {
        btnNextStep3a.disabled = !nomInput.value.trim();
    });

    nomInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nomInput.value.trim()) {
            e.preventDefault();
            goToZoneStep('3b');
        }
    });

    btnBackStep3a?.addEventListener('click', () => showZoneList());
    btnNextStep3a?.addEventListener('click', () => goToZoneStep('3b'));

    // === Photo Upload for Zone ===
    setupZonePhotoUpload();

    // === Step 3b: Catégorie (card selection) ===
    const btnBackStep3b = document.getElementById('btn-back-step3b');
    const categorieInput = document.getElementById('zone-categorie');

    document.querySelectorAll('.categorie-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.categorie-btn').forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');
            // Set hidden input value
            categorieInput.value = btn.dataset.categorie;
            // Auto-advance to next step
            setTimeout(() => goToZoneStep('3c'), 200);
        });
    });

    btnBackStep3b?.addEventListener('click', () => goToZoneStep('3a'));

    // === Step 3c: Matériau ===
    const btnBackStep3c = document.getElementById('btn-back-step3c');
    const btnNextStep3c = document.getElementById('btn-next-step3c');
    // Note: Material selection is now handled by custom dropdown in selectMateriauOption()

    btnBackStep3c?.addEventListener('click', () => goToZoneStep('3b'));
    btnNextStep3c?.addEventListener('click', () => goToZoneStep('3d'));

    // === Step 3d: Dimensions (Multi-surfaces) ===
    const epaisseurInput = document.getElementById('zone-epaisseur');
    const btnBackStep3d = document.getElementById('btn-back-step3d');
    const btnAddZoneFinal = document.getElementById('btn-add-zone-final');
    const btnAddSurface = document.getElementById('btn-add-surface');

    // Épaisseur → recalculate tous les volumes
    epaisseurInput?.addEventListener('input', () => {
        updateSurfaceTotals();
        updateZoneWizardButtonStates();
    });
    
    // Bouton ajouter une surface
    btnAddSurface?.addEventListener('click', () => {
        addSurface();
    });

    btnBackStep3d?.addEventListener('click', () => goToZoneStep('3c'));
    btnAddZoneFinal?.addEventListener('click', () => {
        addZone();
    });

    // Setup zone wizard navigation buttons
    setupZoneWizardNavigation();
}

function goToZoneStep(subStep) {
    // Hide all step-3 sub-sections and zone list
    document.querySelectorAll('[id^="step-3"]').forEach(el => el.classList.add('hidden'));

    // Show the target sub-step
    const targetEl = document.getElementById(`step-${subStep}`);
    if (targetEl) {
        targetEl.classList.remove('hidden');
        // Focus the input if it's a text/number input step
        const input = targetEl.querySelector('input:not([type="hidden"]), select');
        setTimeout(() => input?.focus(), 100);
    }

    // If going to step 3c (matériau), filter materials by selected category
    if (subStep === '3c') {
        const selectedCategorie = document.getElementById('zone-categorie')?.value;
        filterMateriauxByCategorie(selectedCategorie);
    }
    
    // If going to step 3d (dimensions), initialiser les surfaces
    if (subStep === '3d') {
        // Si pas de surfaces en cours, initialiser avec une surface vide
        if (!state.currentSurfaces || state.currentSurfaces.length === 0) {
            initSurfacesList();
        }
        // Rendre la liste des surfaces
        renderSurfacesList();
        // Configurer la délégation d'événements (une seule fois)
        setupSurfaceEventDelegation();
        // Calculer les totaux
        updateSurfaceTotals();
    }

    // Update progress bar (still step 3)
    updateProgressBar(3);
    state.currentStep = 3;

    // Show mobile back button
    document.getElementById('btn-back-mobile')?.classList.remove('invisible');

    // Update button states
    updateZoneWizardButtonStates();
    
    // Update navigation visuelle (en mode édition, toutes les étapes sont complétées)
    updateZoneNavSteps(subStep, !!state.editingZoneId);
}

function updateZoneWizardButtonStates() {
    const nom = document.getElementById('zone-nom')?.value.trim();
    const categorie = document.getElementById('zone-categorie')?.value;
    const materiau = document.getElementById('zone-materiau')?.value;
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) > 0;
    
    // Vérifier si au moins une surface a des dimensions valides
    const hasValidSurface = state.currentSurfaces && state.currentSurfaces.some(
        s => s.longueur > 0 && s.hauteur > 0
    );

    const btnNext3a = document.getElementById('btn-next-step3a');
    const btnNext3c = document.getElementById('btn-next-step3c');
    const btnAddFinal = document.getElementById('btn-add-zone-final');

    if (btnNext3a) btnNext3a.disabled = !nom;
    if (btnNext3c) btnNext3c.disabled = !materiau;
    if (btnAddFinal) btnAddFinal.disabled = !(hasValidSurface && epaisseur);
}

/**
 * Met à jour la navigation visuelle du wizard de zone
 * @param {string} currentStep - L'étape actuelle ('3a', '3b', '3c', '3d')
 * @param {boolean} isEditMode - Si true, toutes les étapes sauf l'actuelle sont marquées comme complétées
 */
function updateZoneNavSteps(currentStep, isEditMode = false) {
    const steps = ['3a', '3b', '3c', '3d'];
    const stepLabels = { '3a': 'Nom', '3b': 'Catégorie', '3c': 'Matériau', '3d': 'Dimensions' };
    const currentIndex = steps.indexOf(currentStep);
    
    steps.forEach((step, index) => {
        // Sélectionner tous les boutons de navigation pour cette étape (dans toutes les sections)
        const btns = document.querySelectorAll(`[data-zone-goto="${step}"]`);
        
        btns.forEach(btn => {
            btn.classList.remove('active', 'completed', 'pending');
            
            let isCompleted = false;
            let isActive = index === currentIndex;
            
            if (isEditMode) {
                // En mode édition, toutes les étapes sauf l'actuelle sont complétées
                isCompleted = index !== currentIndex;
            } else {
                // En mode création, seules les étapes précédentes sont complétées
                isCompleted = index < currentIndex;
            }
            
            if (isCompleted) {
                btn.classList.add('completed');
                // Mettre l'icône check
                btn.innerHTML = `<span class="material-symbols-outlined text-xs">check</span>${stepLabels[step]}`;
            } else if (isActive) {
                btn.classList.add('active');
                // Mettre le numéro
                btn.innerHTML = `<span class="nav-num">${index + 1}</span>${stepLabels[step]}`;
            } else {
                btn.classList.add('pending');
                // Mettre le numéro
                btn.innerHTML = `<span class="nav-num">${index + 1}</span>${stepLabels[step]}`;
            }
        });
    });
}

function setupZoneWizardNavigation() {
    // Add click handlers to all zone nav buttons (using data-zone-goto attribute)
    document.querySelectorAll('[data-zone-goto]').forEach(btn => {
        btn.addEventListener('click', () => {
            const gotoStep = btn.dataset.zoneGoto;
            if (gotoStep) {
                goToZoneStep(gotoStep);
            }
        });
    });
}

function showZoneForm() {
    // Hide zone list and show first step of zone wizard
    document.querySelectorAll('[id^="step-3"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('step-3a').classList.remove('hidden');
    setTimeout(() => document.getElementById('zone-nom')?.focus(), 100);
}

function showZoneList() {
    // Hide all zone wizard steps and show zone list
    document.querySelectorAll('[id^="step-3"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('step-3').classList.remove('hidden');
    
    // Reset form and editing state when returning to list
    resetZoneForm();
    
    renderZoneCards();
}

function renderZoneCards() {
    const grid = document.getElementById('zones-grid');
    const emptyHint = document.getElementById('zones-empty-hint');
    const btnContinue = document.getElementById('btn-continue-step3');

    if (!grid) return;

    // Remove existing zone cards (keep the add button)
    const existingCards = grid.querySelectorAll('.zone-card');
    existingCards.forEach(card => card.remove());

    // Add zone cards
    state.zones.forEach(zone => {
        const card = createZoneCard(zone);
        grid.appendChild(card);
    });

    // Show/hide empty hint
    if (state.zones.length > 0) {
        emptyHint?.classList.add('hidden');
        btnContinue?.removeAttribute('disabled');
    } else {
        emptyHint?.classList.remove('hidden');
        btnContinue?.setAttribute('disabled', 'true');
    }
}

function createZoneCard(zone) {
    const card = document.createElement('div');
    card.className = 'zone-card';
    card.dataset.zoneId = zone.id;

    // Icon based on category
    const iconMap = {
        'Mur/Plafond': 'dashboard',
        'Plancher': 'foundation',
        'Isolation': 'thermostat',
        'Revêtement extérieur': 'roofing',
        'Panneaux thermiques': 'heat'
    };
    const icon = iconMap[zone.categorie] || 'square_foot';

    // Risk badge
    const isHighRisk = zone.risque === 'ÉLEVÉ';
    const riskClass = isHighRisk ? 'risk-high' : 'risk-moderate';
    const riskText = isHighRisk ? 'ÉLEVÉ' : 'MODÉRÉ';
    const isOverride = zone.risqueOverride === true;
    const overrideIndicator = '';

    // Friability text
    const friabiliteText = zone.friabilite === 'friable' ? 'Friable' : 'Non friable';

    // Collecter toutes les photos (ancien format + nouveau format surfaces)
    const allPhotos = [];
    if (zone.photo?.dataUrl) {
        allPhotos.push({ dataUrl: zone.photo.dataUrl, name: zone.photo.name || 'Photo zone', surfaceIndex: null });
    }
    zone.surfaces?.forEach((s, i) => {
        if (s.photo?.dataUrl) {
            allPhotos.push({ dataUrl: s.photo.dataUrl, name: s.photo.name || `Photo mur ${i + 1}`, surfaceIndex: i });
        }
    });
    const hasPhotos = allPhotos.length > 0;

    // Générer le HTML des photos empilées verticalement
    const photosStackHtml = hasPhotos ? `
        <div class="zone-photos-stack mt-4 pt-4 border-t border-slate-100 space-y-2">
            ${allPhotos.map((photo, i) => `
                <div class="photo-item relative rounded-xl overflow-hidden bg-slate-100 cursor-pointer group" data-photo-index="${i}">
                    <img src="${photo.dataUrl}" alt="Photo ${i + 1}" 
                        class="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                        <span class="material-symbols-outlined text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">zoom_in</span>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';

    card.innerHTML = `
        <!-- Header: Icône + Nom + Boutons -->
        <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
                <div class="bg-slate-100 p-2.5 rounded-xl">
                    <span class="material-symbols-outlined text-slate-500">${icon}</span>
                </div>
                <div>
                    <h3 class="text-base font-bold text-slate-900">${zone.nom}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${riskClass}">
                            ${riskText}${overrideIndicator}
                        </span>
                        <button class="btn-toggle-risque w-5 h-5 flex items-center justify-center rounded ${isOverride ? 'bg-yellow-500 text-white' : 'bg-slate-200 text-slate-400 hover:text-slate-600'} transition-all" data-zone-id="${zone.id}" title="${isOverride ? 'Retour au calcul auto' : 'Modifier le risque'}">
                            <span class="material-symbols-outlined text-xs">${isOverride ? 'refresh' : 'edit'}</span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="btn-edit-zone w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors" data-zone-id="${zone.id}" title="Modifier">
                    <span class="material-symbols-outlined text-xl">edit</span>
                </button>
                <button class="btn-delete-zone w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" data-zone-id="${zone.id}" title="Supprimer">
                    <span class="material-symbols-outlined text-xl">delete</span>
                </button>
            </div>
        </div>

        <!-- Infos de la zone - Style tableau -->
        <div class="mt-3">
            <!-- Tableau des surfaces -->
            ${zone.surfaces && zone.surfaces.length > 0 ? `
                <table class="w-full text-xs border-collapse">
                    <thead>
                        <tr class="border-b border-slate-200">
                            <th class="text-left py-2 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Surface</th>
                            <th class="text-right py-2 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">L × H</th>
                            <th class="text-right py-2 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">pi²</th>
                            <th class="w-8"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${zone.surfaces.map((s, i) => `
                            <tr class="hover:bg-slate-50">
                                <td class="py-2 text-slate-600">Mur ${i + 1}</td>
                                <td class="py-2 text-right text-slate-700">${formatNumber(s.longueur, 0)} × ${formatNumber(s.hauteur, 0)}</td>
                                <td class="py-2 text-right font-medium text-slate-800">${formatNumber(s.longueur * s.hauteur, 0)}</td>
                                <td class="py-2 text-center">
                                    ${s.photo ? `
                                        <button class="btn-view-surface-photo text-blue-500 hover:text-blue-700 transition-colors" data-zone-id="${zone.id}" data-surface-index="${i}" title="Voir la photo">
                                            <span class="material-symbols-outlined text-base">photo_camera</span>
                                        </button>
                                    ` : `
                                        <span class="text-slate-300">
                                            <span class="material-symbols-outlined text-base">photo_camera</span>
                                        </span>
                                    `}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="border-t-2 border-slate-300 bg-slate-50">
                            <td class="py-2 font-semibold text-slate-700" colspan="2">Total</td>
                            <td class="py-2 text-right font-bold text-slate-900">${formatNumber(zone.surface || zone.surfaceTotal, 0)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            ` : `
                <div class="flex justify-between items-center py-2 border-b border-slate-100">
                    <span class="text-xs text-slate-500">Surface</span>
                    <span class="text-sm font-bold text-slate-900">${formatNumber(zone.surface || zone.surfaceTotal, 0)} pi²</span>
                </div>
            `}
            
            <!-- Autres infos -->
            <div class="divide-y divide-slate-100 mt-2">
                <div class="flex justify-between items-center py-2">
                    <span class="text-xs text-slate-500">Matériau</span>
                    <span class="text-xs font-semibold text-slate-700">${zone.materiauNom?.split(' ')[0] || 'N/A'}</span>
                </div>
                <div class="flex justify-between items-center py-2">
                    <span class="text-xs text-slate-500">Friabilité</span>
                    <span class="text-xs font-semibold text-slate-700">${friabiliteText}</span>
                </div>
            </div>
        </div>

        <!-- Photos empilées -->
        ${photosStackHtml}
    `;

    // Click sur photos → lightbox
    if (hasPhotos) {
        card.querySelectorAll('.photo-item').forEach((item, i) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openLightbox(allPhotos[i].dataUrl, `Photo ${i + 1}`);
            });
        });
    }

    // Toggle risque button listener
    const btnToggleRisque = card.querySelector('.btn-toggle-risque');
    btnToggleRisque?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleZoneRisque(zone.id);
    });

    // Edit button listener
    const btnEdit = card.querySelector('.btn-edit-zone');
    btnEdit?.addEventListener('click', (e) => {
        e.stopPropagation();
        editZone(zone.id);
    });

    // Delete button listener
    const btnDelete = card.querySelector('.btn-delete-zone');
    btnDelete?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteZone(zone.id);
    });

    // Surface photo buttons listener
    card.querySelectorAll('.btn-view-surface-photo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const zoneId = parseInt(btn.dataset.zoneId);
            const surfaceIndex = parseInt(btn.dataset.surfaceIndex);
            const targetZone = state.zones.find(z => z.id === zoneId);
            if (targetZone?.surfaces?.[surfaceIndex]?.photo?.dataUrl) {
                openLightbox(targetZone.surfaces[surfaceIndex].photo.dataUrl, `Photo Mur ${surfaceIndex + 1}`);
            }
        });
    });

    return card;
}

function deleteZone(zoneId) {
    if (!confirm('Supprimer cette zone ?')) return;

    state.zones = state.zones.filter(z => z.id !== zoneId);
    console.log('🗑️ Zone supprimée, total:', state.zones.length);
    renderZoneCards();
    
    // Save progress
    saveStateToStorage();
}

// Met à jour le carrousel de photos d'une carte
function updateCarousel(card) {
    if (!card.carouselPhotos || card.carouselPhotos.length === 0) return;
    
    const photo = card.carouselPhotos[card.carouselIndex];
    const img = card.querySelector('.carousel-photo');
    const caption = card.querySelector('.carousel-caption');
    const dots = card.querySelectorAll('.carousel-dot');
    
    if (img) img.src = photo.dataUrl;
    if (caption) caption.textContent = photo.name;
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('bg-primary', i === card.carouselIndex);
        dot.classList.toggle('bg-slate-300', i !== card.carouselIndex);
    });
}

// Toggle manuel du risque par zone (feedback équipe 21 jan 2026)
function toggleZoneRisque(zoneId) {
    const zone = state.zones.find(z => z.id === zoneId);
    if (!zone) return;

    if (zone.risqueOverride) {
        // Retour au calcul automatique
        delete zone.risqueOverride;
        zone.risque = determineRisque(zone.volume, zone.friabilite);
        console.log('🔄 Risque auto restauré pour zone:', zone.nom, '→', zone.risque);
    } else {
        // Toggle manuel : inverser le risque
        zone.risqueOverride = true;
        zone.risque = zone.risque === 'ÉLEVÉ' ? 'MODÉRÉ' : 'ÉLEVÉ';
        console.log('✏️ Risque modifié manuellement pour zone:', zone.nom, '→', zone.risque);
    }

    renderZoneCards();
    
    // Recalculer les prix si on est à l'étape 4
    if (state.currentStep === 4) {
        calculatePrix();
    }
    
    saveStateToStorage();
}

// Éditer une zone existante (Phase 4 - feedback équipe 21 jan 2026)
function editZone(zoneId) {
    const zone = state.zones.find(z => z.id === zoneId);
    if (!zone) {
        console.error('Zone non trouvée:', zoneId);
        return;
    }

    console.log('✏️ Édition de la zone:', zone.nom);

    // Stocker l'ID de la zone en édition
    state.editingZoneId = zoneId;

    // Pré-remplir les champs du formulaire
    const nomInput = document.getElementById('zone-nom');
    const categorieInput = document.getElementById('zone-categorie');
    const materiauInput = document.getElementById('zone-materiau');
    const materiauTriggerText = document.getElementById('materiau-dropdown-text');
    const epaisseurInput = document.getElementById('zone-epaisseur');

    if (nomInput) nomInput.value = zone.nom;
    if (categorieInput) categorieInput.value = zone.categorie;
    
    // Sélectionner visuellement la carte de catégorie
    document.querySelectorAll('.categorie-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.categorie === zone.categorie) {
            btn.classList.add('active');
        }
    });
    
    if (materiauInput) {
        materiauInput.value = zone.materiauId;
        materiauInput.dataset.friabilite = zone.friabilite;
    }
    if (materiauTriggerText) {
        materiauTriggerText.textContent = zone.materiauNom || 'Sélectionner un matériau';
        materiauTriggerText.classList.remove('text-slate-400');
        materiauTriggerText.classList.add('text-slate-900');
    }
    if (epaisseurInput) epaisseurInput.value = zone.epaisseur;

    // Charger les surfaces existantes ou migrer depuis l'ancien format
    if (zone.surfaces && zone.surfaces.length > 0) {
        // Nouveau format multi-surfaces
        state.currentSurfaces = zone.surfaces.map(s => ({
            id: s.id || Date.now() + Math.random(),
            longueur: s.longueur,
            hauteur: s.hauteur,
            surface: s.surface,
            volume: s.volume,
            photo: s.photo
        }));
    } else if (zone.longueur && zone.largeur) {
        // Ancien format : migrer vers multi-surfaces
        state.currentSurfaces = [{
            id: Date.now(),
            longueur: zone.longueur,
            hauteur: zone.largeur, // "largeur" était "hauteur" dans l'ancien système
            surface: zone.longueur * zone.largeur,
            volume: zone.longueur * zone.largeur * (zone.epaisseur / 12),
            photo: zone.photo
        }];
    } else {
        state.currentSurfaces = [];
    }

    // Mettre à jour le badge de friabilité
    updateFriabiliteBadge(zone.friabilite);
    
    // Activer les boutons selon les valeurs pré-remplies
    updateZoneWizardButtonStates();

    // Naviguer vers le wizard zone (étape 3a - nom)
    goToZoneStep('3a');
    
    // Mettre à jour le titre pour indiquer le mode édition
    updateZoneWizardTitle();
    
    // En mode édition, marquer toutes les étapes comme complétées
    updateZoneNavSteps('3a', true);
}

// Mettre à jour le titre du wizard selon le mode (création vs édition)
function updateZoneWizardTitle() {
    const titleEl = document.querySelector('#step-3a h2');
    if (titleEl) {
        titleEl.textContent = state.editingZoneId ? 'Modifier la zone' : 'Nom de la zone';
    }
}

function updateFriabiliteBadge(friabilite) {
    const badge = document.getElementById('friabilite-badge');
    const text = document.getElementById('friabilite-text');
    const desc = document.getElementById('friabilite-desc');
    if (!badge || !text) return;

    badge.classList.remove('hidden');

    if (friabilite === 'friable') {
        text.textContent = 'FRIABLE';
        text.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-bold tracking-wider uppercase bg-red-100 text-red-600';
        if (desc) desc.textContent = 'Risque élevé si volume > 3 pi³';
    } else {
        text.textContent = 'NON FRIABLE';
        text.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-bold tracking-wider uppercase bg-green-100 text-green-600';
        if (desc) desc.textContent = 'Risque élevé si volume > 10 pi³';
    }
}

// =====================================================
// MULTI-SURFACES - Gestion des surfaces multiples par zone
// =====================================================

// Initialiser la liste des surfaces avec une surface vide
function initSurfacesList() {
    state.currentSurfaces = [];
    addSurface(); // Ajouter une première surface
    renderSurfacesList();
    setupSurfaceEventDelegation(); // Initialiser la délégation une seule fois
}

// Ajouter une nouvelle surface
function addSurface() {
    const newSurface = {
        id: Date.now() + Math.random(), // ID unique
        longueur: 0,
        hauteur: 0,
        surface: 0,
        volume: 0,
        photo: null
    };
    state.currentSurfaces.push(newSurface);
    renderSurfacesList();
    updateSurfaceTotals();
    
    // Focus sur le premier champ de la nouvelle surface
    setTimeout(() => {
        const inputs = document.querySelectorAll(`[data-surface-id="${newSurface.id}"] input[name="longueur"]`);
        if (inputs.length > 0) {
            inputs[inputs.length - 1]?.focus();
        }
    }, 100);
}

// Supprimer une surface
function removeSurface(surfaceId) {
    if (state.currentSurfaces.length <= 1) {
        // Ne pas supprimer si c'est la dernière surface
        return;
    }
    state.currentSurfaces = state.currentSurfaces.filter(s => s.id !== surfaceId);
    renderSurfacesList();
    updateSurfaceTotals();
}

// Mettre à jour une surface
function updateSurface(surfaceId, field, value) {
    const surface = state.currentSurfaces.find(s => s.id === surfaceId);
    if (!surface) return;
    
    surface[field] = parseFloat(value) || 0;
    
    // Recalculer surface et volume pour cette surface
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) || 0;
    surface.surface = surface.longueur * surface.hauteur;
    surface.volume = surface.longueur * surface.hauteur * (epaisseur / 12);
    
    updateSurfaceTotals();
}

// Mettre à jour la photo d'une surface
function updateSurfacePhoto(surfaceId, photoData) {
    const surface = state.currentSurfaces.find(s => s.id === surfaceId);
    if (!surface) return;
    
    surface.photo = photoData;
    renderSurfacesList();
}

// Supprimer la photo d'une surface
function deleteSurfacePhoto(surfaceId) {
    const surface = state.currentSurfaces.find(s => s.id === surfaceId);
    if (!surface) return;
    
    surface.photo = null;
    renderSurfacesList();
    console.log('Photo supprimée pour surface', surfaceId);
}

// Rendre la liste des surfaces
function renderSurfacesList() {
    const container = document.getElementById('surfaces-list');
    if (!container) return;
    
    container.innerHTML = state.currentSurfaces.map((surface, index) => `
        <div class="surface-item bg-white border-2 border-slate-200 rounded-xl p-4 relative" data-surface-id="${surface.id}">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-semibold text-slate-600">Surface ${index + 1}</span>
                <div class="flex items-center gap-2">
                    <!-- Bouton photo -->
                    <button type="button" class="btn-surface-photo w-8 h-8 flex items-center justify-center rounded-lg ${surface.photo ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'} transition-colors" 
                            data-surface-id="${surface.id}" title="${surface.photo ? 'Photo ajoutée' : 'Ajouter une photo'}">
                        <span class="material-symbols-outlined text-lg">${surface.photo ? 'photo' : 'add_a_photo'}</span>
                    </button>
                    <!-- Bouton supprimer (caché si une seule surface) -->
                    ${state.currentSurfaces.length > 1 ? `
                        <button type="button" class="btn-remove-surface w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors" 
                                data-surface-id="${surface.id}" title="Supprimer cette surface">
                            <span class="material-symbols-outlined text-lg">close</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Longueur</label>
                    <div class="relative">
                        <input type="number" name="longueur" min="0" step="0.1"
                            class="surface-input w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-base text-slate-900 text-center focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder="0" value="${surface.longueur || ''}"
                            data-surface-id="${surface.id}" data-field="longueur">
                        <span class="absolute -bottom-4 left-0 right-0 text-[9px] text-slate-400 text-center">pieds</span>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hauteur</label>
                    <div class="relative">
                        <input type="number" name="hauteur" min="0" step="0.1"
                            class="surface-input w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-base text-slate-900 text-center focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            placeholder="0" value="${surface.hauteur || ''}"
                            data-surface-id="${surface.id}" data-field="hauteur">
                        <span class="absolute -bottom-4 left-0 right-0 text-[9px] text-slate-400 text-center">pieds</span>
                    </div>
                </div>
            </div>
            ${surface.photo ? `
                <div class="mt-6">
                    <div class="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        <!-- Photo -->
                        <img src="${surface.photo.dataUrl}" alt="Photo surface ${index + 1}" 
                            class="w-full object-contain max-h-64 cursor-pointer" data-surface-id="${surface.id}" data-action="preview-photo">
                        <!-- Barre d'actions - toujours visible -->
                        <div class="absolute top-2 right-2 flex gap-1">
                            <button class="btn-photo-zoom w-9 h-9 flex items-center justify-center bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-colors" data-surface-id="${surface.id}" title="Agrandir">
                                <span class="material-symbols-outlined text-xl">zoom_in</span>
                            </button>
                            <button class="btn-photo-replace w-9 h-9 flex items-center justify-center bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-300 rounded-lg transition-colors" data-surface-id="${surface.id}" title="Remplacer">
                                <span class="material-symbols-outlined text-xl">sync</span>
                            </button>
                            <button class="btn-photo-delete w-9 h-9 flex items-center justify-center bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-300 rounded-lg transition-colors" data-surface-id="${surface.id}" title="Supprimer">
                                <span class="material-symbols-outlined text-xl">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');
    
    // Pas besoin de setupSurfaceEventListeners ici - on utilise la délégation
}

// Flag pour éviter d'initialiser plusieurs fois la délégation
let surfacesDelegationSetup = false;

// Configurer la délégation d'événements pour les surfaces (une seule fois)
function setupSurfaceEventDelegation() {
    if (surfacesDelegationSetup) return;
    surfacesDelegationSetup = true;
    
    const container = document.getElementById('surfaces-list');
    if (!container) return;
    
    // Délégation pour tous les événements sur le container
    container.addEventListener('click', (e) => {
        // Bouton photo
        const photoBtn = e.target.closest('.btn-surface-photo');
        if (photoBtn) {
            e.stopPropagation();
            const surfaceId = parseFloat(photoBtn.dataset.surfaceId);
            openSurfacePhotoUpload(surfaceId);
            return;
        }
        
        // Bouton supprimer
        const removeBtn = e.target.closest('.btn-remove-surface');
        if (removeBtn) {
            e.stopPropagation();
            const surfaceId = parseFloat(removeBtn.dataset.surfaceId);
            removeSurface(surfaceId);
            return;
        }
        
        // Preview photo → lightbox (clic sur l'image)
        const preview = e.target.closest('[data-action="preview-photo"]');
        if (preview) {
            e.stopPropagation();
            const surfaceId = parseFloat(preview.dataset.surfaceId);
            const surface = state.currentSurfaces.find(s => s.id === surfaceId);
            if (surface?.photo?.dataUrl) {
                openLightbox(surface.photo.dataUrl, 'Photo');
            }
            return;
        }
        
        // Bouton zoom photo
        const zoomBtn = e.target.closest('.btn-photo-zoom');
        if (zoomBtn) {
            e.stopPropagation();
            const surfaceId = parseFloat(zoomBtn.dataset.surfaceId);
            const surface = state.currentSurfaces.find(s => s.id === surfaceId);
            if (surface?.photo?.dataUrl) {
                openLightbox(surface.photo.dataUrl, 'Photo');
            }
            return;
        }
        
        // Bouton remplacer photo
        const replaceBtn = e.target.closest('.btn-photo-replace');
        if (replaceBtn) {
            e.stopPropagation();
            const surfaceId = parseFloat(replaceBtn.dataset.surfaceId);
            openSurfacePhotoUpload(surfaceId);
            return;
        }
        
        // Bouton supprimer photo
        const deletePhotoBtn = e.target.closest('.btn-photo-delete');
        if (deletePhotoBtn) {
            e.stopPropagation();
            const surfaceId = parseFloat(deletePhotoBtn.dataset.surfaceId);
            deleteSurfacePhoto(surfaceId);
            return;
        }
    });
    
    // Délégation pour les inputs
    container.addEventListener('input', (e) => {
        const input = e.target.closest('.surface-input');
        if (input) {
            const surfaceId = parseFloat(input.dataset.surfaceId);
            const field = input.dataset.field;
            updateSurface(surfaceId, field, input.value);
        }
    });
    
    console.log('Surface event delegation setup');
}

// Calculer et afficher les totaux de toutes les surfaces
function updateSurfaceTotals() {
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) || 0;
    const materiauInput = document.getElementById('zone-materiau');
    const friabilite = materiauInput?.dataset.friabilite || 'non_friable';
    
    // Recalculer chaque surface avec l'épaisseur actuelle
    state.currentSurfaces.forEach(surface => {
        surface.surface = surface.longueur * surface.hauteur;
        surface.volume = surface.longueur * surface.hauteur * (epaisseur / 12);
    });
    
    // Calculer les totaux
    const surfaceTotal = state.currentSurfaces.reduce((sum, s) => sum + s.surface, 0);
    const volumeTotal = state.currentSurfaces.reduce((sum, s) => sum + s.volume, 0);
    const risque = determineRisque(volumeTotal, friabilite);
    
    // Mettre à jour l'UI
    document.getElementById('calc-surface').textContent = surfaceTotal > 0 ? formatNumber(surfaceTotal, 1) : '--';
    document.getElementById('calc-volume').textContent = volumeTotal > 0 ? formatNumber(volumeTotal, 2) : '--';
    
    const risqueEl = document.getElementById('calc-risque');
    if (risqueEl) {
        if (risque === 'ÉLEVÉ') {
            risqueEl.textContent = 'ÉLEVÉ';
            risqueEl.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-red-100 text-red-600';
        } else if (risque === 'MODÉRÉ') {
            risqueEl.textContent = 'MODÉRÉ';
            risqueEl.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-amber-100 text-amber-600';
        } else {
            risqueEl.textContent = '--';
            risqueEl.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-200 text-slate-400';
        }
    }
    
    // Activer/désactiver le bouton "Ajouter cette zone"
    const btnAddZone = document.getElementById('btn-add-zone-final');
    const hasValidSurface = state.currentSurfaces.some(s => s.longueur > 0 && s.hauteur > 0);
    if (btnAddZone) {
        btnAddZone.disabled = !(hasValidSurface && epaisseur > 0);
    }
    
    return { surfaceTotal, volumeTotal, risque, friabilite };
}

// Compresser une image pour réduire la taille du localStorage
function compressImage(dataUrl, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Redimensionner si trop grand
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compresser en JPEG
            const compressed = canvas.toDataURL('image/jpeg', quality);
            console.log(`📸 Image compressée: ${Math.round(dataUrl.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
            resolve(compressed);
        };
        img.src = dataUrl;
    });
}

// Ouvrir le sélecteur de photo pour une surface
let currentPhotoSurfaceId = null;

function openSurfacePhotoUpload(surfaceId) {
    currentPhotoSurfaceId = surfaceId;
    
    // Créer un input file temporaire
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Utiliser la caméra sur mobile
    
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            // Compresser l'image avant de la sauvegarder
            const compressedDataUrl = await compressImage(event.target.result);
            updateSurfacePhoto(currentPhotoSurfaceId, {
                name: file.name,
                dataUrl: compressedDataUrl
            });
        };
        reader.readAsDataURL(file);
    });
    
    input.click();
}

function calculateZoneValues() {
    // Utiliser le système multi-surfaces si on est sur step-3d
    if (state.currentSurfaces && state.currentSurfaces.length > 0) {
        const result = updateSurfaceTotals();
        fitAllAutoFitText();
        return { 
            surface: result.surfaceTotal, 
            volume: result.volumeTotal, 
            risque: result.risque, 
            friabilite: result.friabilite 
        };
    }
    
    // Fallback pour compatibilité (ne devrait plus être utilisé)
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) || 0;
    const materiauInput = document.getElementById('zone-materiau');
    const friabilite = materiauInput?.dataset.friabilite || 'non_friable';
    
    // Si pas de surfaces, retourner zéro
    return { surface: 0, volume: 0, risque: null, friabilite };
}

function determineRisque(volume, friabilite) {
    // CSTC Rules:
    // CSTC Rules (corrigé selon feedback équipe 21 jan 2026):
    // - Friable: > 3 pi³ = ÉLEVÉ
    // - Non friable: > 10 pi³ = ÉLEVÉ
    if (volume <= 0) return null;

    if (friabilite === 'friable') {
        return volume > 3 ? 'ÉLEVÉ' : 'MODÉRÉ';
    } else {
        return volume > 10 ? 'ÉLEVÉ' : 'MODÉRÉ';
    }
}

/**
 * Détermine le risque global du projet (propagation du risque élevé)
 * Selon feedback équipe 21 jan 2026:
 * - Si UNE zone est à risque élevé, TOUT le projet est à risque élevé
 * - Les frais globaux (douche, tests, perte de temps) s'appliquent une seule fois
 * @returns {Object} { risque: 'ÉLEVÉ'|'MODÉRÉ', hasZoneElevee: boolean, zonesElevees: number }
 */
function getProjetRisque() {
    const zones = state.zones || [];
    const zonesElevees = zones.filter(z => z.risque === 'ÉLEVÉ').length;
    const hasZoneElevee = zonesElevees > 0;
    
    return {
        risque: hasZoneElevee ? 'ÉLEVÉ' : 'MODÉRÉ',
        hasZoneElevee,
        zonesElevees,
        totalZones: zones.length
    };
}

function addZone() {
    const nom = document.getElementById('zone-nom')?.value.trim();
    const categorie = document.getElementById('zone-categorie')?.value;
    const materiauInput = document.getElementById('zone-materiau');
    const materiauId = materiauInput?.value;
    const materiauNom = document.getElementById('materiau-dropdown-text')?.textContent;
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) || 0;
    const friabilite = materiauInput?.dataset.friabilite || 'non_friable';

    // Valider qu'il y a au moins une surface valide
    const validSurfaces = state.currentSurfaces.filter(s => s.longueur > 0 && s.hauteur > 0);
    
    if (!nom || !categorie || !materiauId || validSurfaces.length === 0 || epaisseur <= 0) {
        alert('Veuillez remplir tous les champs et ajouter au moins une surface.');
        return;
    }

    // Calculer les totaux
    const surfaceTotal = validSurfaces.reduce((sum, s) => sum + (s.longueur * s.hauteur), 0);
    const volumeTotal = validSurfaces.reduce((sum, s) => sum + (s.longueur * s.hauteur * (epaisseur / 12)), 0);
    const risque = determineRisque(volumeTotal, friabilite);

    // Préparer les surfaces avec leurs calculs finaux
    const surfaces = validSurfaces.map((s, index) => ({
        id: s.id,
        nom: `Surface ${index + 1}`,
        longueur: s.longueur,
        hauteur: s.hauteur,
        surface: s.longueur * s.hauteur,
        volume: s.longueur * s.hauteur * (epaisseur / 12),
        photo: s.photo ? { name: s.photo.name, dataUrl: s.photo.dataUrl } : null
    }));

    // Créer l'objet zone avec la nouvelle structure multi-surfaces
    const zoneData = {
        nom,
        categorie,
        materiauId,
        materiauNom,
        friabilite,
        epaisseur,
        surfaces, // Nouveau: tableau de surfaces
        surfaceTotal,
        volumeTotal,
        risque,
        // Compatibilité avec l'ancien système (pour les calculs de prix)
        surface: surfaceTotal,
        volume: volumeTotal
    };

    // Mode édition ou création ?
    if (state.editingZoneId) {
        const index = state.zones.findIndex(z => z.id === state.editingZoneId);
        if (index !== -1) {
            const originalZone = state.zones[index];
            state.zones[index] = {
                ...zoneData,
                id: originalZone.id,
                risqueOverride: originalZone.risqueOverride
            };
            console.log('✏️ Zone mise à jour:', state.zones[index]);
        }
        delete state.editingZoneId;
    } else {
        const zone = {
            ...zoneData,
            id: Date.now()
        };
        state.zones.push(zone);
        console.log('✅ Zone ajoutée:', zone);
    }
    console.log('📋 Total zones:', state.zones.length);

    // Save progress
    saveStateToStorage();

    // Reset form
    resetZoneForm();

    // Return to zone list
    goToStep(3);
}

function resetZoneForm() {
    // Reset all inputs
    const nomInput = document.getElementById('zone-nom');
    const categorieInput = document.getElementById('zone-categorie');
    const materiauInput = document.getElementById('zone-materiau');
    const materiauTriggerText = document.getElementById('materiau-dropdown-text');
    const epaisseurInput = document.getElementById('zone-epaisseur');

    if (nomInput) nomInput.value = '';
    if (categorieInput) categorieInput.value = '';
    if (materiauInput) {
        materiauInput.value = '';
        delete materiauInput.dataset.friabilite;
        delete materiauInput.dataset.epaisseur;
    }
    // Reset dropdown trigger text
    if (materiauTriggerText) {
        materiauTriggerText.textContent = 'Sélectionner un matériau';
        materiauTriggerText.classList.add('text-slate-400');
        materiauTriggerText.classList.remove('text-slate-900');
    }
    // Reset selected state in dropdown options
    const optionsList = document.getElementById('materiau-options-list');
    optionsList?.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    if (epaisseurInput) epaisseurInput.value = '';
    
    // Reset multi-surfaces
    state.currentSurfaces = [];

    // Reset category buttons
    document.querySelectorAll('.categorie-btn').forEach(btn => btn.classList.remove('active'));

    // Reset calculated values
    const calcSurface = document.getElementById('calc-surface');
    const calcVolume = document.getElementById('calc-volume');
    const calcRisque = document.getElementById('calc-risque');

    if (calcSurface) calcSurface.textContent = '--';
    if (calcVolume) calcVolume.textContent = '--';
    if (calcRisque) {
        calcRisque.textContent = '--';
        calcRisque.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-200 text-slate-400';
    }

    // Hide friability badge
    document.getElementById('friabilite-badge')?.classList.add('hidden');

    // Disable continue buttons
    const btnNext3a = document.getElementById('btn-next-step3a');
    const btnNext3c = document.getElementById('btn-next-step3c');
    const btnAddFinal = document.getElementById('btn-add-zone-final');

    if (btnNext3a) btnNext3a.disabled = true;
    if (btnNext3c) btnNext3c.disabled = true;
    if (btnAddFinal) btnAddFinal.disabled = true;

    // Reset photo
    clearZonePhoto();

    // Reset editing state and title
    if (state.editingZoneId) {
        delete state.editingZoneId;
    }
    updateZoneWizardTitle();
}

// =====================================================
// ZONE PHOTO UPLOAD
// =====================================================

// Store current zone photo data
let currentZonePhoto = null;

function setupZonePhotoUpload() {
    const dropzone = document.getElementById('zone-photo-dropzone');
    const fileInput = document.getElementById('zone-photo-input');
    const placeholder = document.getElementById('zone-photo-placeholder');
    const preview = document.getElementById('zone-photo-preview');
    const previewImg = document.getElementById('zone-photo-img');
    const photoName = document.getElementById('zone-photo-name');
    const removeBtn = document.getElementById('zone-photo-remove');

    if (!dropzone || !fileInput) return;

    // Click to upload
    dropzone.addEventListener('click', (e) => {
        // Don't trigger if clicking on the remove button or the preview image (for lightbox)
        if (e.target.closest('#zone-photo-remove')) return;
        if (e.target.closest('#zone-photo-img') && currentZonePhoto) {
            openLightbox(currentZonePhoto.dataUrl, currentZonePhoto.name);
            return;
        }
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleZonePhotoFile(file);
    });

    // Drag & drop events (desktop)
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-primary', 'bg-blue-50/50');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-primary', 'bg-blue-50/50');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-primary', 'bg-blue-50/50');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleZonePhotoFile(file);
        }
    });

    // Remove photo button
    removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        clearZonePhoto();
    });

    // Setup lightbox
    setupLightbox();
}

function handleZonePhotoFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image (JPG, PNG, etc.)');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('L\'image est trop grande. Maximum 5 MB.');
        return;
    }

    // Read file and create preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        
        // Store photo data
        currentZonePhoto = {
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: dataUrl
        };

        // Update UI
        const placeholder = document.getElementById('zone-photo-placeholder');
        const preview = document.getElementById('zone-photo-preview');
        const previewImg = document.getElementById('zone-photo-img');
        const photoName = document.getElementById('zone-photo-name');

        if (placeholder) placeholder.classList.add('hidden');
        if (preview) preview.classList.remove('hidden');
        if (previewImg) previewImg.src = dataUrl;
        if (photoName) photoName.textContent = file.name;

        console.log('📷 Photo ajoutée:', file.name);
    };

    reader.readAsDataURL(file);
}

function clearZonePhoto() {
    currentZonePhoto = null;

    const placeholder = document.getElementById('zone-photo-placeholder');
    const preview = document.getElementById('zone-photo-preview');
    const previewImg = document.getElementById('zone-photo-img');
    const photoName = document.getElementById('zone-photo-name');
    const fileInput = document.getElementById('zone-photo-input');

    if (placeholder) placeholder.classList.remove('hidden');
    if (preview) preview.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (photoName) photoName.textContent = '';
    if (fileInput) fileInput.value = '';
}

function getZonePhoto() {
    return currentZonePhoto;
}

// =====================================================
// LIGHTBOX (Full Image Preview)
// =====================================================

// Lightbox state
let lightboxState = {
    scale: 1,
    minScale: 0.5,
    maxScale: 5,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    lastTouchDistance: 0
};

function setupLightbox() {
    const lightbox = document.getElementById('photo-lightbox');
    const backdrop = document.getElementById('lightbox-backdrop');
    const closeBtn = document.getElementById('lightbox-close');
    const container = document.getElementById('lightbox-container');
    const zoomInBtn = document.getElementById('lightbox-zoom-in');
    const zoomOutBtn = document.getElementById('lightbox-zoom-out');
    const zoomResetBtn = document.getElementById('lightbox-zoom-reset');

    if (!lightbox) return;

    // Close on backdrop click (only if not zoomed)
    backdrop?.addEventListener('click', () => {
        if (lightboxState.scale <= 1) {
            closeLightbox();
        }
    });

    // Close on button click
    closeBtn?.addEventListener('click', closeLightbox);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
            closeLightbox();
        }
    });

    // Zoom buttons (desktop)
    zoomInBtn?.addEventListener('click', () => lightboxZoom(0.5));
    zoomOutBtn?.addEventListener('click', () => lightboxZoom(-0.5));
    zoomResetBtn?.addEventListener('click', resetLightboxZoom);

    // Mouse wheel zoom (desktop)
    container?.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        lightboxZoom(delta, e.clientX, e.clientY);
    }, { passive: false });

    // Touch events for pinch-to-zoom (mobile)
    container?.addEventListener('touchstart', handleTouchStart, { passive: false });
    container?.addEventListener('touchmove', handleTouchMove, { passive: false });
    container?.addEventListener('touchend', handleTouchEnd);

    // Mouse drag for panning (desktop)
    container?.addEventListener('mousedown', handleMouseDown);
    container?.addEventListener('mousemove', handleMouseMove);
    container?.addEventListener('mouseup', handleMouseUp);
    container?.addEventListener('mouseleave', handleMouseUp);

    // Double-click to zoom in/reset
    container?.addEventListener('dblclick', (e) => {
        if (lightboxState.scale > 1) {
            resetLightboxZoom();
        } else {
            lightboxZoom(1, e.clientX, e.clientY);
        }
    });
}

function handleTouchStart(e) {
    if (e.touches.length === 2) {
        // Pinch start
        lightboxState.lastTouchDistance = getTouchDistance(e.touches);
    } else if (e.touches.length === 1 && lightboxState.scale > 1) {
        // Pan start
        lightboxState.isDragging = true;
        lightboxState.startX = e.touches[0].clientX - lightboxState.translateX;
        lightboxState.startY = e.touches[0].clientY - lightboxState.translateY;
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 2) {
        // Pinch zoom
        e.preventDefault();
        const newDistance = getTouchDistance(e.touches);
        const delta = (newDistance - lightboxState.lastTouchDistance) * 0.01;
        
        // Get center point between two fingers
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        lightboxZoom(delta, centerX, centerY);
        lightboxState.lastTouchDistance = newDistance;
    } else if (e.touches.length === 1 && lightboxState.isDragging && lightboxState.scale > 1) {
        // Pan
        e.preventDefault();
        lightboxState.translateX = e.touches[0].clientX - lightboxState.startX;
        lightboxState.translateY = e.touches[0].clientY - lightboxState.startY;
        updateLightboxTransform();
    }
}

function handleTouchEnd(e) {
    lightboxState.isDragging = false;
    lightboxState.lastTouchDistance = 0;
}

function handleMouseDown(e) {
    if (lightboxState.scale > 1) {
        lightboxState.isDragging = true;
        lightboxState.startX = e.clientX - lightboxState.translateX;
        lightboxState.startY = e.clientY - lightboxState.translateY;
        e.target.style.cursor = 'grabbing';
    }
}

function handleMouseMove(e) {
    if (lightboxState.isDragging && lightboxState.scale > 1) {
        lightboxState.translateX = e.clientX - lightboxState.startX;
        lightboxState.translateY = e.clientY - lightboxState.startY;
        updateLightboxTransform();
    }
}

function handleMouseUp(e) {
    lightboxState.isDragging = false;
    const container = document.getElementById('lightbox-container');
    if (container) container.style.cursor = lightboxState.scale > 1 ? 'grab' : 'default';
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function lightboxZoom(delta, centerX = null, centerY = null) {
    const newScale = Math.max(lightboxState.minScale, Math.min(lightboxState.maxScale, lightboxState.scale + delta));
    
    if (newScale !== lightboxState.scale) {
        // If zooming to center point, adjust translation
        if (centerX !== null && centerY !== null && newScale > 1) {
            const container = document.getElementById('lightbox-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                const relX = centerX - rect.left - rect.width / 2;
                const relY = centerY - rect.top - rect.height / 2;
                
                const scaleRatio = newScale / lightboxState.scale;
                lightboxState.translateX = lightboxState.translateX * scaleRatio - relX * (scaleRatio - 1);
                lightboxState.translateY = lightboxState.translateY * scaleRatio - relY * (scaleRatio - 1);
            }
        }
        
        lightboxState.scale = newScale;
        
        // Reset position if scale is 1 or less
        if (newScale <= 1) {
            lightboxState.translateX = 0;
            lightboxState.translateY = 0;
        }
        
        updateLightboxTransform();
        updateZoomLevel();
    }
}

function resetLightboxZoom() {
    lightboxState.scale = 1;
    lightboxState.translateX = 0;
    lightboxState.translateY = 0;
    updateLightboxTransform();
    updateZoomLevel();
}

function updateLightboxTransform() {
    const wrapper = document.getElementById('lightbox-img-wrapper');
    const container = document.getElementById('lightbox-container');
    
    if (wrapper) {
        wrapper.style.transform = `translate(${lightboxState.translateX}px, ${lightboxState.translateY}px) scale(${lightboxState.scale})`;
    }
    
    // Update cursor
    if (container) {
        container.style.cursor = lightboxState.scale > 1 ? 'grab' : 'default';
    }
}

function updateZoomLevel() {
    const zoomLevel = document.getElementById('lightbox-zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(lightboxState.scale * 100)}%`;
    }
}

function openLightbox(imageUrl, imageName) {
    const lightbox = document.getElementById('photo-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxName = document.getElementById('lightbox-name');

    if (!lightbox || !lightboxImg) return;

    // Reset zoom state
    resetLightboxZoom();

    lightboxImg.src = imageUrl;
    if (lightboxName) lightboxName.textContent = imageName || 'Image';

    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeLightbox() {
    const lightbox = document.getElementById('photo-lightbox');
    if (!lightbox) return;

    lightbox.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
    
    // Reset zoom state
    resetLightboxZoom();
}

// =====================================================
// STEP 4: RÉCAPITULATIF & PRIX
// =====================================================

async function loadConfig() {
    try {
        const { data, error } = await supabaseClient
            .from('config_prix')
            .select('*');

        if (error) throw error;

        // Convert array to object for easy lookup
        data.forEach(item => {
            state.config[item.cle] = item.valeur;
        });

        console.log(`✅ ${data.length} paramètres de prix chargés`);
    } catch (err) {
        console.error('Erreur chargement config:', err);
        // Fallback defaults
        state.config = {
            taux_horaire: 92,
            marge_profit: 20,
            prix_demo_palier1: 8,
            prix_demo_palier2: 6.5,
            prix_demo_palier3: 3,
            transport_0_50km: 55,
            transport_50_100km: 75,
            zone1_modere: 736,
            zone_supp_modere: 368,
            zone1_eleve: 1472,
            zone_supp_eleve: 736,
            douche_zone1: 800,
            douche_zone_supp: 600,
            test_zone1: 600,
            test_zone_supp: 400,
            perte_temps_heures_par_jour: 2,
            disposition_par_1000pi2: 400,
            assurance_petit: 250,
            assurance_grand: 500
        };
    }
}

function setupStep4Events() {
    const btnBack = document.getElementById('btn-back-step4');
    const btnContinue = document.getElementById('btn-continue-step4');

    btnBack?.addEventListener('click', () => {
        goToStep(3);
    });

    btnContinue?.addEventListener('click', () => {
        goToStep(5);
    });
}

function calculatePrix() {
    const config = state.config;
    const zones = state.zones;
    const distance = state.client.distanceKm || 0;

    // Utiliser la fonction de risque projet (propagation)
    const projetRisque = getProjetRisque();
    state.risqueGlobal = projetRisque.risque;

    // Séparer zones par risque pour le calcul des frais de zones
    const zonesModere = zones.filter(z => z.risque === 'MODÉRÉ');
    const zonesEleve = zones.filter(z => z.risque === 'ÉLEVÉ');

    // Surface totale (compatible ancien et nouveau format)
    const surfaceTotal = zones.reduce((sum, z) => sum + (z.surface || z.surfaceTotal || 0), 0);

    // 1. Coûts des zones
    let prixZones = 0;
    
    // Zones modérées
    if (zonesModere.length > 0) {
        prixZones += config.zone1_modere || 736;
        if (zonesModere.length > 1) {
            prixZones += (zonesModere.length - 1) * (config.zone_supp_modere || 368);
        }
    }
    
    // Zones élevées
    if (zonesEleve.length > 0) {
        prixZones += config.zone1_eleve || 1472;
        if (zonesEleve.length > 1) {
            prixZones += (zonesEleve.length - 1) * (config.zone_supp_eleve || 736);
        }
    }

    // 2. Prix démolition (selon surface totale)
    // NOTE: Le tarif de démolition au pi² reste le MÊME quel que soit le risque
    // (confirmation feedback équipe 21 jan 2026)
    let prixDemo = 0;
    if (surfaceTotal <= 500) {
        prixDemo = surfaceTotal * (config.prix_demo_palier1 || 8);
    } else if (surfaceTotal <= 1500) {
        prixDemo = 500 * (config.prix_demo_palier1 || 8);
        prixDemo += (surfaceTotal - 500) * (config.prix_demo_palier2 || 6.5);
    } else {
        prixDemo = 500 * (config.prix_demo_palier1 || 8);
        prixDemo += 1000 * (config.prix_demo_palier2 || 6.5);
        prixDemo += (surfaceTotal - 1500) * (config.prix_demo_palier3 || 3);
    }

    // 3. Frais GLOBAUX risque élevé (s'appliquent UNE SEULE FOIS au projet)
    // Selon feedback équipe 21 jan 2026:
    // - Si UNE zone est élevée, tout le projet bascule en risque élevé
    // - Les frais s'appliquent globalement, pas par zone élevée
    let prixDouches = 0;
    let prixTests = 0;
    let prixPerteTemps = 0;

    if (projetRisque.hasZoneElevee) {
        // Douches (frais global unique)
        prixDouches = config.douche_zone1 || 800;

        // Tests d'air (frais global unique: entrée + sortie = 2 tests)
        prixTests = (config.test_zone1 || 600) * 2;

        // Perte de temps (basée sur le prix de démolition)
        // heures = prix_demo / 92, jours = ceil(heures/8), perte = jours × 2h × 92$
        const tauxHoraire = config.taux_horaire || 92;
        const heuresPerteParJour = config.perte_temps_heures_par_jour || 2;
        const heuresTotales = prixDemo / tauxHoraire;
        const joursHommes = Math.ceil(heuresTotales / 8);
        prixPerteTemps = joursHommes * heuresPerteParJour * tauxHoraire;
    }

    // 4. Transport (dynamique selon durée du projet - feedback 21 jan 2026)
    // Formule: (heures totales ÷ 3 gars ÷ 8h/jour) × 75$/jour
    const tauxHoraireTransport = config.taux_horaire || 92;
    const heuresTotalesProjet = prixDemo / tauxHoraireTransport;
    const nbEmployesEquipe = config.nb_employes_equipe || 3;
    const nbJoursProjet = Math.max(1, Math.ceil(heuresTotalesProjet / nbEmployesEquipe / 8)); // minimum 1 jour
    const transportParJour = config.transport_50_100km || 75; // 75$/jour comme base
    let prixTransport = nbJoursProjet * transportParJour;
    
    // Stocker les détails pour affichage
    const transportDetails = {
        heures: Math.round(heuresTotalesProjet),
        jours: nbJoursProjet,
        equipe: nbEmployesEquipe,
        tarifJour: transportParJour
    };

    // 5. Disposition (par 1000 pi², minimum 400$)
    let prixDisposition = Math.ceil(surfaceTotal / 1000) * (config.disposition_par_1000pi2 || 400);
    prixDisposition = Math.max(prixDisposition, config.disposition_par_1000pi2 || 400);

    // 6. Assurance
    let prixAssurance = 0;
    if (surfaceTotal <= 500) {
        prixAssurance = config.assurance_petit || 250;
    } else {
        prixAssurance = config.assurance_grand || 500;
    }

    // Sous-total
    const sousTotal = prixZones + prixDemo + prixDouches + prixTests + prixPerteTemps + prixTransport + prixDisposition + prixAssurance;

    // Marge de profit
    // Handle both formats: 20 (percentage) or 0.2 (decimal)
    let margePourcent = config.marge_profit || 20;
    if (margePourcent < 1) {
        // Value is in decimal format (0.2), convert to percentage (20)
        margePourcent = margePourcent * 100;
    }
    const marge = sousTotal * (margePourcent / 100);

    // Total
    const total = sousTotal + marge;

    // Sauvegarder dans state
    state.prix = {
        zones: prixZones,
        demolition: prixDemo,
        douches: prixDouches,
        tests: prixTests,
        perteTemps: prixPerteTemps,
        transport: prixTransport,
        transportDetails: transportDetails,
        disposition: prixDisposition,
        assurance: prixAssurance,
        sousTotal: sousTotal,
        marge: marge,
        total: total,
        surfaceTotal: surfaceTotal,
        margePourcent: margePourcent
    };

    console.log('💰 Prix calculés:', state.prix);
    return state.prix;
}

function renderRecap() {
    // Client info
    document.getElementById('recap-client-nom').textContent = state.client.nom || '—';
    document.getElementById('recap-client-contact').textContent = `${state.client.telephone} • ${state.client.courriel}`;
    document.getElementById('recap-client-adresse').textContent = state.client.adresseChantier || '—';
    document.getElementById('recap-client-distance').textContent = state.client.distanceKm || 0;

    // Zones count
    document.getElementById('recap-zones-count').textContent = `${state.zones.length} zone(s)`;

    // Zones list
    const zonesList = document.getElementById('recap-zones-list');
    zonesList.innerHTML = '';
    
    state.zones.forEach(zone => {
        const isEleve = zone.risque === 'ÉLEVÉ';
        const riskClass = isEleve ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';
        
        // Nombre de surfaces et de photos
        const surfaceCount = zone.surfaces?.length || 1;
        const photoCount = zone.surfaces?.filter(s => s.photo?.dataUrl).length || (zone.photo ? 1 : 0);
        const surfaceLabel = surfaceCount > 1 ? `${surfaceCount} murs` : '';
        const photoLabel = photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''}` : '';
        const detailParts = [surfaceLabel, photoLabel].filter(Boolean);
        const detailText = detailParts.length > 0 ? `• ${detailParts.join(' • ')}` : '';
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-xl';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="font-medium text-slate-800">${zone.nom}</span>
                <span class="text-sm text-slate-500">${formatNumber(zone.surface || zone.surfaceTotal || 0, 0)} pi² ${detailText}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskClass}">${zone.risque}</span>
        `;
        zonesList.appendChild(div);
    });

    // Surface totale
    document.getElementById('recap-surface-total').textContent = formatNumber(state.prix.surfaceTotal || 0, 0);

    // Risque global
    const risqueEl = document.getElementById('recap-risque-global');
    if (state.risqueGlobal === 'ÉLEVÉ') {
        risqueEl.textContent = 'ÉLEVÉ';
        risqueEl.className = 'inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-600';
        document.getElementById('recap-warning-eleve')?.classList.remove('hidden');
        document.getElementById('prix-risque-eleve-section')?.classList.remove('hidden');
    } else {
        risqueEl.textContent = 'MODÉRÉ';
        risqueEl.className = 'inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-600';
        document.getElementById('recap-warning-eleve')?.classList.add('hidden');
        document.getElementById('prix-risque-eleve-section')?.classList.add('hidden');
    }

    // Prix details - Set values in inputs with formatted numbers (espaces milliers)
    document.getElementById('prix-zones').value = formatInputValue(state.prix.zones || 0);
    document.getElementById('prix-demolition').value = formatInputValue(state.prix.demolition || 0);
    document.getElementById('prix-douches').value = formatInputValue(state.prix.douches || 0);
    document.getElementById('prix-tests').value = formatInputValue(state.prix.tests || 0);
    document.getElementById('prix-perte-temps').value = formatInputValue(state.prix.perteTemps || 0);
    document.getElementById('prix-transport').value = formatInputValue(state.prix.transport || 0);
    
    // Afficher les détails du calcul transport
    if (state.prix.transportDetails) {
        const td = state.prix.transportDetails;
        
        // Explication simple et lisible
        const explication = `${td.jours} jour${td.jours > 1 ? 's' : ''} × ${td.equipe} employés × ${td.tarifJour}$/jour`;
        document.getElementById('transport-explication').textContent = explication;
    }
    
    document.getElementById('prix-disposition').value = formatInputValue(state.prix.disposition || 0);
    document.getElementById('prix-assurance').value = formatInputValue(state.prix.assurance || 0);
    document.getElementById('prix-sous-total').textContent = formatCurrency(state.prix.sousTotal);
    document.getElementById('marge-percent').value = state.prix.margePourcent || 20;
    document.getElementById('prix-marge').textContent = formatCurrency(state.prix.marge);
    document.getElementById('prix-total').value = formatInputValue(state.prix.total || 0);

    // Setup event listeners for editable inputs (only once)
    setupPrixInputListeners();
}

// =====================================================
// EDITABLE PRICE INPUTS
// =====================================================

let prixListenersSetup = false;

function setupPrixInputListeners() {
    // Only setup once
    if (prixListenersSetup) return;
    prixListenersSetup = true;

    // All editable price inputs
    const prixInputIds = [
        'prix-zones', 'prix-demolition', 'prix-douches', 'prix-tests',
        'prix-perte-temps', 'prix-transport', 'prix-disposition', 'prix-assurance'
    ];

    // Add listeners to recalculate when any price changes
    prixInputIds.forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('input', recalculerTotaux);
        // Reformat on blur (when user leaves the field)
        input?.addEventListener('blur', function() {
            const value = parseFormattedValue(this.value);
            this.value = formatInputValue(value);
        });
    });

    // Marge percent listener
    const margeInput = document.getElementById('marge-percent');
    margeInput?.addEventListener('input', recalculerTotaux);

    // Total direct edit listener (recalculates marge backwards)
    const totalInput = document.getElementById('prix-total');
    totalInput?.addEventListener('input', onTotalDirectEdit);
    // Reformat total on blur
    totalInput?.addEventListener('blur', function() {
        const value = parseFormattedValue(this.value);
        this.value = formatInputValue(value);
    });

    console.log('✅ Prix input listeners configurés');
}

function recalculerTotaux() {
    // Get all current values from inputs (parse formatted values)
    const zones = parseFormattedValue(document.getElementById('prix-zones')?.value);
    const demolition = parseFormattedValue(document.getElementById('prix-demolition')?.value);
    const douches = parseFormattedValue(document.getElementById('prix-douches')?.value);
    const tests = parseFormattedValue(document.getElementById('prix-tests')?.value);
    const perteTemps = parseFormattedValue(document.getElementById('prix-perte-temps')?.value);
    const transport = parseFormattedValue(document.getElementById('prix-transport')?.value);
    const disposition = parseFormattedValue(document.getElementById('prix-disposition')?.value);
    const assurance = parseFormattedValue(document.getElementById('prix-assurance')?.value);
    // Allow 0 as valid marge value (don't use || which treats 0 as falsy)
    const margeValue = document.getElementById('marge-percent')?.value;
    const margePourcent = margeValue !== '' && !isNaN(parseFloat(margeValue)) ? parseFloat(margeValue) : 20;

    // Calculate sous-total
    const sousTotal = zones + demolition + douches + tests + perteTemps + transport + disposition + assurance;

    // Calculate marge
    const marge = sousTotal * (margePourcent / 100);

    // Calculate total
    const total = sousTotal + marge;

    // Update displays
    document.getElementById('prix-sous-total').textContent = formatCurrency(sousTotal);
    document.getElementById('prix-marge').textContent = formatCurrency(marge);
    document.getElementById('prix-total').value = formatInputValue(total);

    // Update state
    state.prix.zones = zones;
    state.prix.demolition = demolition;
    state.prix.douches = douches;
    state.prix.tests = tests;
    state.prix.perteTemps = perteTemps;
    state.prix.transport = transport;
    state.prix.disposition = disposition;
    state.prix.assurance = assurance;
    state.prix.sousTotal = sousTotal;
    state.prix.margePourcent = margePourcent;
    state.prix.marge = marge;
    state.prix.total = total;

    console.log('💰 Totaux recalculés:', { sousTotal, marge, total });
}

function onTotalDirectEdit() {
    // When user edits total directly, we recalculate the marge backwards
    const totalInput = document.getElementById('prix-total');
    const newTotal = parseFormattedValue(totalInput?.value);

    // Get sous-total (parse formatted values)
    const zones = parseFormattedValue(document.getElementById('prix-zones')?.value);
    const demolition = parseFormattedValue(document.getElementById('prix-demolition')?.value);
    const douches = parseFormattedValue(document.getElementById('prix-douches')?.value);
    const tests = parseFormattedValue(document.getElementById('prix-tests')?.value);
    const perteTemps = parseFormattedValue(document.getElementById('prix-perte-temps')?.value);
    const transport = parseFormattedValue(document.getElementById('prix-transport')?.value);
    const disposition = parseFormattedValue(document.getElementById('prix-disposition')?.value);
    const assurance = parseFormattedValue(document.getElementById('prix-assurance')?.value);

    const sousTotal = zones + demolition + douches + tests + perteTemps + transport + disposition + assurance;

    // Calculate implied marge
    const marge = newTotal - sousTotal;
    const margePourcent = sousTotal > 0 ? (marge / sousTotal) * 100 : 0;

    // Update marge display
    document.getElementById('marge-percent').value = Math.round(margePourcent);
    document.getElementById('prix-marge').textContent = formatCurrency(marge);

    // Update state
    state.prix.total = newTotal;
    state.prix.marge = marge;
    state.prix.margePourcent = Math.round(margePourcent);

    console.log('💰 Total modifié directement:', { newTotal, marge, margePourcent: Math.round(margePourcent) });
}

// =====================================================
// NAVIGATION
// =====================================================

function goToStep(step) {
    console.log(`Navigation vers étape ${step}`);

    // Hide all steps (including sub-steps like 2a, 2b, etc.)
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="step-2"]').forEach(el => {
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
        // Start at step 2a (first sub-step)
        document.getElementById('step-2a').classList.remove('hidden');
        // Focus the input
        setTimeout(() => document.getElementById('client-nom')?.focus(), 100);
        // Show mobile back button
        document.getElementById('btn-back-mobile')?.classList.remove('invisible');
    } else if (step === 3) {
        // Hide all step-3 sub-steps first
        document.querySelectorAll('[id^="step-3"]').forEach(el => el.classList.add('hidden'));
        // Show zone list
        document.getElementById('step-3').classList.remove('hidden');
        // Render zone cards
        renderZoneCards();
        // Show mobile back button
        document.getElementById('btn-back-mobile')?.classList.remove('invisible');
    } else if (step === 4) {
        document.getElementById('step-4').classList.remove('hidden');
        // Calculate prices and render recap
        calculatePrix();
        renderRecap();
        // Show mobile back button
        document.getElementById('btn-back-mobile')?.classList.remove('invisible');
    } else if (step === 5) {
        document.getElementById('step-5').classList.remove('hidden');
        // Load config textes if not already loaded
        if (Object.keys(configTextes).length === 0) {
            loadConfigTextes().then(() => renderStep5());
        } else {
            renderStep5();
        }
        // Show mobile back button
        document.getElementById('btn-back-mobile')?.classList.remove('invisible');
    }

    // Update progress bar (desktop + mobile)
    updateProgressBar(step);

    state.currentStep = step;
    
    // Auto-save progress (except step 1)
    if (step > 1) {
        saveStateToStorage();
    }
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

    // Find and select the material using the new custom dropdown
    if (state.materiaux.length > 0) {
        // Select the first material for simplicity
        const mat = state.materiaux[0];
        selectMateriauOption(mat);
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
        // Also fill the form fields
        fillDevClientData();
    }
    if (step >= 3) {
        state.zones = DEV_DATA.zones;
    }
    if (step >= 4) {
        // S'assurer qu'on a des zones pour l'étape 4
        if (state.zones.length === 0) {
            state.zones = DEV_DATA.zones;
        }
    }

    // Forcer la navigation
    console.log(`🚀 DEV: Saut vers étape ${step}`);

    // Cacher toutes les étapes (including sub-steps)
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="step-2"]').forEach(el => {
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

    // Actions spécifiques par étape
    if (step === 3) {
        renderZoneCards();
    } else if (step === 4) {
        calculatePrix();
        renderRecap();
    } else if (step === 5) {
        calculatePrix();
        if (Object.keys(configTextes).length === 0) {
            loadConfigTextes().then(() => renderStep5());
        } else {
            renderStep5();
        }
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
    if (amount === null || amount === undefined || isNaN(amount)) return '0 $';
    // Format avec espaces comme séparateurs de milliers
    return formatNumber(amount, 0) + ' $';
}

/**
 * Formate une valeur pour affichage dans un input (avec espaces, 2 décimales)
 * Ex: 12000 -> "12 000,00"
 */
function formatInputValue(num) {
    if (num === null || num === undefined || isNaN(num)) return '0,00';
    return formatNumber(num, 2);
}

/**
 * Parse une valeur formatée (avec espaces et virgule) en nombre
 * Ex: "12 000,00" -> 12000
 */
function parseFormattedValue(str) {
    if (!str) return 0;
    // Enlever les espaces et remplacer virgule par point
    const cleaned = str.toString().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// =====================================================
// STEP 5: PDF GENERATION & SIGNATURE
// =====================================================

// Signature canvas state
let signatureCanvas = null;
let signatureCtx = null;
let isDrawing = false;
let hasSignature = false;
let lastX = 0;
let lastY = 0;

// Config textes state (loaded from Supabase)
let configTextes = {};

/**
 * Setup Step 5 events and signature canvas
 */
function setupStep5Events() {
    const btnBack = document.getElementById('btn-back-step5');
    const btnDownload = document.getElementById('btn-download-pdf');
    const btnClearSignature = document.getElementById('btn-clear-signature');

    btnBack?.addEventListener('click', () => {
        goToStep(4);
    });

    btnDownload?.addEventListener('click', async () => {
        await generateAndDownloadPDF();
    });

    btnClearSignature?.addEventListener('click', () => {
        clearSignature();
    });

    // Setup signature canvas
    setupSignatureCanvas();
}

/**
 * Setup signature canvas for mouse, touch and stylus
 */
function setupSignatureCanvas() {
    signatureCanvas = document.getElementById('signature-canvas');
    if (!signatureCanvas) return;

    signatureCtx = signatureCanvas.getContext('2d');

    // Set canvas size to match container
    resizeSignatureCanvas();
    window.addEventListener('resize', resizeSignatureCanvas);

    // Mouse events
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);

    // Touch events (for tablets and phones)
    signatureCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    signatureCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    signatureCanvas.addEventListener('touchend', stopDrawing);
    signatureCanvas.addEventListener('touchcancel', stopDrawing);

    // Pointer events (for stylus support)
    signatureCanvas.addEventListener('pointerdown', handlePointerStart);
    signatureCanvas.addEventListener('pointermove', handlePointerMove);
    signatureCanvas.addEventListener('pointerup', stopDrawing);
    signatureCanvas.addEventListener('pointercancel', stopDrawing);
}

function resizeSignatureCanvas() {
    if (!signatureCanvas) return;

    const container = signatureCanvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Store current drawing if any
    const imageData = hasSignature ? signatureCtx.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height) : null;

    // Set actual size in memory
    const dpr = window.devicePixelRatio || 1;
    signatureCanvas.width = rect.width * dpr;
    signatureCanvas.height = 200 * dpr;

    // Set display size
    signatureCanvas.style.width = rect.width + 'px';
    signatureCanvas.style.height = '200px';

    // Scale context
    signatureCtx.scale(dpr, dpr);

    // Setup drawing style
    signatureCtx.strokeStyle = '#1E73BE';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    // Restore drawing if any
    if (imageData) {
        signatureCtx.putImageData(imageData, 0, 0);
    }
}

function getCanvasCoordinates(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    let x, y;

    if (e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }

    return { x, y };
}

function startDrawing(e) {
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    lastX = coords.x;
    lastY = coords.y;

    // Hide placeholder on first draw
    if (!hasSignature) {
        document.getElementById('signature-placeholder')?.classList.add('opacity-0');
    }
}

function draw(e) {
    if (!isDrawing) return;

    const coords = getCanvasCoordinates(e);

    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(coords.x, coords.y);
    signatureCtx.stroke();

    lastX = coords.x;
    lastY = coords.y;

    // Mark as having signature
    if (!hasSignature) {
        hasSignature = true;
        updateSignatureStatus();
    }
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    startDrawing(e);
}

function handleTouchMove(e) {
    e.preventDefault();
    draw(e);
}

function handlePointerStart(e) {
    if (e.pointerType === 'pen' || e.pointerType === 'touch' || e.pointerType === 'mouse') {
        startDrawing(e);
    }
}

function handlePointerMove(e) {
    if (e.pointerType === 'pen' || e.pointerType === 'touch' || e.pointerType === 'mouse') {
        draw(e);
    }
}

function clearSignature() {
    if (!signatureCanvas || !signatureCtx) return;

    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    hasSignature = false;
    
    // Show placeholder again
    document.getElementById('signature-placeholder')?.classList.remove('opacity-0');
    
    updateSignatureStatus();
}

function updateSignatureStatus() {
    const statusEl = document.getElementById('signature-status');
    const downloadBtn = document.getElementById('btn-download-pdf');

    if (hasSignature) {
        if (statusEl) {
            statusEl.textContent = 'Signature capturée';
            statusEl.classList.remove('text-slate-400');
            statusEl.classList.add('text-green-600');
        }
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }
    } else {
        if (statusEl) {
            statusEl.textContent = 'En attente de signature';
            statusEl.classList.remove('text-green-600');
            statusEl.classList.add('text-slate-400');
        }
        if (downloadBtn) {
            downloadBtn.disabled = true;
        }
    }
}

function getSignatureDataUrl() {
    if (!signatureCanvas || !hasSignature) return null;
    return signatureCanvas.toDataURL('image/png');
}

/**
 * Load config textes from Supabase for PDF generation
 */
async function loadConfigTextes() {
    try {
        const { data, error } = await supabaseClient
            .from('config_textes')
            .select('*');

        if (error) throw error;

        // Convert array to object
        data.forEach(item => {
            configTextes[item.cle] = item.valeur;
        });

        console.log(`✅ ${data.length} config textes chargés pour PDF`);
    } catch (err) {
        console.error('Erreur chargement config textes:', err);
        // Use defaults
        configTextes = {
            entreprise_nom: 'Apex Désamiantage',
            entreprise_adresse: '689 rue des Caryers, Québec, QC G3G 2B4',
            numero_prefix: 'APEX-',
            texte_signature: 'Je, soussigné(e), reconnais avoir pris connaissance de la présente soumission et accepte les termes et conditions.',
            liste_inclusions: '["Installation zone hermétique","Retrait matériaux contaminés","Nettoyage HEPA","Disposition réglementaire"]',
            liste_exclusions: '["Reconstruction","Peinture","Électricité","Plomberie"]'
        };
    }
}

/**
 * Generate next soumission number
 */
function generateSoumissionNumber() {
    const prefix = configTextes.numero_prefix || 'APEX-';
    const year = new Date().getFullYear();
    
    // Get next number from localStorage (simple increment)
    let nextNum = parseInt(localStorage.getItem('apex_soumission_counter') || '0') + 1;
    localStorage.setItem('apex_soumission_counter', nextNum.toString());
    
    // Format: APEX-2026-001
    return `${prefix}${year}-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Render Step 5 content
 */
function renderStep5() {
    // Set date
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-CA', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    document.getElementById('pdf-date').textContent = dateStr;

    // Generate soumission number
    const soumissionNum = generateSoumissionNumber();
    document.getElementById('pdf-numero-soumission').textContent = soumissionNum;
    state.soumissionNumber = soumissionNum;

    // Set signature text
    const texteSignature = configTextes.texte_signature || 
        'Je, soussigné(e), reconnais avoir pris connaissance de la présente soumission et accepte les termes et conditions.';
    document.getElementById('pdf-texte-signature').textContent = texteSignature;

    // Render inclusions/exclusions
    renderInclusionsExclusions();

    // Update summary
    const zones = state.zones || [];
    const photosCount = zones.reduce((count, zone) => {
        const surfacePhotos = (zone.surfaces || []).filter(s => s.photo).length;
        return count + surfacePhotos;
    }, 0);

    document.getElementById('pdf-resume-zones').textContent = zones.length;
    document.getElementById('pdf-resume-photos').textContent = photosCount;
    document.getElementById('pdf-resume-total').textContent = formatPrix(state.prix?.total || 0);

    // Estimate pages
    let pages = 3; // Cover + pricing + inclusions
    if (photosCount > 0) pages += Math.ceil(photosCount / 2); // 2 photos per page
    pages += 1; // Signature page
    document.getElementById('pdf-resume-pages').textContent = pages;

    // Reset signature
    clearSignature();
    
    // Resize canvas after DOM is ready
    setTimeout(resizeSignatureCanvas, 100);
}

/**
 * Render inclusions/exclusions checkboxes
 */
function renderInclusionsExclusions() {
    const inclusionsList = document.getElementById('pdf-inclusions-list');
    const exclusionsList = document.getElementById('pdf-exclusions-list');

    if (!inclusionsList || !exclusionsList) return;

    // Parse JSON arrays
    let inclusions = [];
    let exclusions = [];

    try {
        inclusions = JSON.parse(configTextes.liste_inclusions || '[]');
    } catch (e) {
        inclusions = ['Installation zone hermétique', 'Retrait matériaux', 'Nettoyage HEPA', 'Disposition réglementaire'];
    }

    try {
        exclusions = JSON.parse(configTextes.liste_exclusions || '[]');
    } catch (e) {
        exclusions = ['Reconstruction', 'Peinture', 'Électricité', 'Plomberie'];
    }

    // Render inclusions
    inclusionsList.innerHTML = inclusions.map((item, i) => `
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked data-inclusion="${i}"
                class="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500 cursor-pointer">
            <span class="text-sm text-slate-700">${item}</span>
        </label>
    `).join('');

    // Render exclusions
    exclusionsList.innerHTML = exclusions.map((item, i) => `
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked data-exclusion="${i}"
                class="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500 cursor-pointer">
            <span class="text-sm text-slate-700">${item}</span>
        </label>
    `).join('');

    // Store in state for PDF generation
    state.pdfInclusions = inclusions;
    state.pdfExclusions = exclusions;
}

/**
 * Get selected inclusions/exclusions for PDF
 */
function getSelectedInclusionsExclusions() {
    const inclusions = [];
    const exclusions = [];

    document.querySelectorAll('[data-inclusion]').forEach(cb => {
        if (cb.checked) {
            const idx = parseInt(cb.dataset.inclusion);
            if (state.pdfInclusions && state.pdfInclusions[idx]) {
                inclusions.push(state.pdfInclusions[idx]);
            }
        }
    });

    document.querySelectorAll('[data-exclusion]').forEach(cb => {
        if (cb.checked) {
            const idx = parseInt(cb.dataset.exclusion);
            if (state.pdfExclusions && state.pdfExclusions[idx]) {
                exclusions.push(state.pdfExclusions[idx]);
            }
        }
    });

    return { inclusions, exclusions };
}

/**
 * Generate and download the PDF
 */
async function generateAndDownloadPDF() {
    if (!hasSignature) {
        alert('Veuillez signer avant de télécharger le PDF.');
        return;
    }

    // Show loading
    const loadingEl = document.getElementById('pdf-loading');
    loadingEl?.classList.remove('hidden');

    try {
        // Get options
        const includePhotos = document.getElementById('pdf-option-photos')?.checked ?? true;
        const includeLegalDocs = document.getElementById('pdf-option-legaux')?.checked ?? true;

        // Get selected inclusions/exclusions
        const { inclusions, exclusions } = getSelectedInclusionsExclusions();

        // Get signature
        const signatureDataUrl = getSignatureDataUrl();

        // Generate PDF (using pdf-generator.js)
        const pdfBlob = await generatePDF({
            state: state,
            configTextes: configTextes,
            signature: signatureDataUrl,
            includePhotos: includePhotos,
            includeLegalDocs: includeLegalDocs,
            inclusions: inclusions,
            exclusions: exclusions,
            soumissionNumber: state.soumissionNumber,
            date: new Date()
        });

        // Download
        const fileName = `Soumission_${state.soumissionNumber}_${state.client.nom?.replace(/\s+/g, '_') || 'Client'}.pdf`;
        downloadBlob(pdfBlob, fileName);

        console.log('✅ PDF généré et téléchargé:', fileName);

    } catch (err) {
        console.error('Erreur génération PDF:', err);
        alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
        // Hide loading
        loadingEl?.classList.add('hidden');
    }
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

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
        distanceKm: 0
    },
    zones: [],
    materiaux: [],
    config: {},
    risqueGlobal: null,
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
    setupWizardNavigation();

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
            nom: document.getElementById('client-nom').value.trim(),
            telephone: document.getElementById('client-telephone').value.trim(),
            courriel: document.getElementById('client-courriel').value.trim(),
            adresseChantier: document.getElementById('client-adresse').value.trim(),
            distanceKm: parseInt(document.getElementById('client-distance').value) || 0
        };
        console.log('Client info saved:', state.client);
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
    if (distance > 100) {
        return '75+ (pension)';
    } else if (distance > 50) {
        return 75;
    }
    return 55;
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
    const materiauSelect = document.getElementById('zone-materiau');
    const btnBackStep3c = document.getElementById('btn-back-step3c');
    const btnNextStep3c = document.getElementById('btn-next-step3c');
    const epaisseurInput = document.getElementById('zone-epaisseur');

    materiauSelect?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const friabilite = selectedOption.dataset.friabilite;
        const epaisseur = selectedOption.dataset.epaisseur;

        updateFriabiliteBadge(friabilite);
        btnNextStep3c.disabled = !materiauSelect.value;

        // Set default thickness
        if (epaisseur && epaisseurInput) {
            epaisseurInput.value = epaisseur;
        }
    });

    btnBackStep3c?.addEventListener('click', () => goToZoneStep('3b'));
    btnNextStep3c?.addEventListener('click', () => goToZoneStep('3d'));

    // === Step 3d: Dimensions ===
    const longueurInput = document.getElementById('zone-longueur');
    const largeurInput = document.getElementById('zone-largeur');
    const btnBackStep3d = document.getElementById('btn-back-step3d');
    const btnAddZoneFinal = document.getElementById('btn-add-zone-final');

    // Dimension inputs → recalculate
    [longueurInput, largeurInput, epaisseurInput].forEach(input => {
        input?.addEventListener('input', () => {
            calculateZoneValues();
            // Enable add button if all dimensions are filled
            const hasLong = parseFloat(longueurInput?.value) > 0;
            const hasLarg = parseFloat(largeurInput?.value) > 0;
            const hasEpais = parseFloat(epaisseurInput?.value) > 0;
            btnAddZoneFinal.disabled = !(hasLong && hasLarg && hasEpais);
        });
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

    // Update progress bar (still step 3)
    updateProgressBar(3);
    state.currentStep = 3;

    // Show mobile back button
    document.getElementById('btn-back-mobile')?.classList.remove('invisible');

    // Update button states
    updateZoneWizardButtonStates();
}

function updateZoneWizardButtonStates() {
    const nom = document.getElementById('zone-nom')?.value.trim();
    const categorie = document.getElementById('zone-categorie')?.value;
    const materiau = document.getElementById('zone-materiau')?.value;
    const longueur = parseFloat(document.getElementById('zone-longueur')?.value) > 0;
    const largeur = parseFloat(document.getElementById('zone-largeur')?.value) > 0;
    const epaisseur = parseFloat(document.getElementById('zone-epaisseur')?.value) > 0;

    const btnNext3a = document.getElementById('btn-next-step3a');
    const btnNext3c = document.getElementById('btn-next-step3c');
    const btnAddFinal = document.getElementById('btn-add-zone-final');

    if (btnNext3a) btnNext3a.disabled = !nom;
    if (btnNext3c) btnNext3c.disabled = !materiau;
    if (btnAddFinal) btnAddFinal.disabled = !(longueur && largeur && epaisseur);
}

function setupZoneWizardNavigation() {
    // Add click handlers to all zone nav buttons
    document.querySelectorAll('.zone-nav-btn').forEach(btn => {
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
        'Mur/Plafond': 'wall',
        'Plancher': 'foundation',
        'Isolation': 'thermostat',
        'Revêtement extérieur': 'roofing',
        'Panneaux thermiques': 'heat'
    };
    const icon = iconMap[zone.categorie] || 'square_foot';

    // Risk badge
    const isHighRisk = zone.risque === 'ÉLEVÉ';
    const riskClass = isHighRisk ? 'risk-high' : 'risk-moderate';
    const riskText = isHighRisk ? 'Risque élevé' : 'Risque modéré';

    // Friability text
    const friabiliteText = zone.friabilite === 'friable' ? 'Friable' : 'Non friable';

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="bg-slate-50 p-3 rounded-xl">
                <span class="material-symbols-outlined text-slate-400">${icon}</span>
            </div>
            <div class="flex flex-col items-end gap-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${riskClass}">
                    ${riskText}
                </span>
                <button class="btn-delete-zone w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors" data-zone-id="${zone.id}">
                    <span class="material-symbols-outlined text-xl">delete</span>
                </button>
            </div>
        </div>
        <div class="mt-auto">
            <h3 class="text-lg font-bold text-slate-900 mb-1">${zone.nom}</h3>
            <div class="space-y-2 pt-3 border-t border-slate-50">
                <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-400">Surface</span>
                    <span class="text-xs font-semibold text-slate-700">${zone.surface.toFixed(0)} pi²</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-400">Matériau</span>
                    <span class="text-xs font-semibold text-slate-700">${zone.materiauNom?.split(' ')[0] || 'N/A'}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-400">Friabilité</span>
                    <span class="text-xs font-semibold text-slate-700">${friabiliteText}</span>
                </div>
            </div>
        </div>
    `;

    // Delete button listener
    const btnDelete = card.querySelector('.btn-delete-zone');
    btnDelete?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteZone(zone.id);
    });

    return card;
}

function deleteZone(zoneId) {
    if (!confirm('Supprimer cette zone ?')) return;

    state.zones = state.zones.filter(z => z.id !== zoneId);
    console.log('🗑️ Zone supprimée, total:', state.zones.length);
    renderZoneCards();
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
        if (desc) desc.textContent = 'Risque élevé si volume > 1 pi³';
    } else {
        text.textContent = 'NON FRIABLE';
        text.className = 'inline-flex items-center px-4 py-2 rounded-full text-sm font-bold tracking-wider uppercase bg-green-100 text-green-600';
        if (desc) desc.textContent = 'Risque élevé si volume > 10 pi³';
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
            risqueEl.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-red-100 text-red-600';
        } else if (risque === 'MODÉRÉ') {
            risqueEl.textContent = 'MODÉRÉ';
            risqueEl.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-amber-100 text-amber-600';
        } else {
            risqueEl.textContent = '--';
            risqueEl.className = 'inline-block mt-1 px-4 py-2 rounded-xl text-sm font-bold bg-slate-200 text-slate-400';
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

    // Return to zone list
    goToStep(3);
}

function resetZoneForm() {
    // Reset all inputs
    const nomInput = document.getElementById('zone-nom');
    const categorieInput = document.getElementById('zone-categorie');
    const materiauSelect = document.getElementById('zone-materiau');
    const longueurInput = document.getElementById('zone-longueur');
    const largeurInput = document.getElementById('zone-largeur');
    const epaisseurInput = document.getElementById('zone-epaisseur');

    if (nomInput) nomInput.value = '';
    if (categorieInput) categorieInput.value = '';
    if (materiauSelect) materiauSelect.value = '';
    if (longueurInput) longueurInput.value = '';
    if (largeurInput) largeurInput.value = '';
    if (epaisseurInput) epaisseurInput.value = '';

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
            prix_demo_palier3: 4.5,
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
            disposition_par_1000pi2: 600,
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

    // Séparer zones par risque
    const zonesModere = zones.filter(z => z.risque === 'MODÉRÉ');
    const zonesEleve = zones.filter(z => z.risque === 'ÉLEVÉ');

    // Surface totale
    const surfaceTotal = zones.reduce((sum, z) => sum + (z.surface || 0), 0);

    // Déterminer risque global
    state.risqueGlobal = zonesEleve.length > 0 ? 'ÉLEVÉ' : 'MODÉRÉ';

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
    let prixDemo = 0;
    if (surfaceTotal <= 500) {
        prixDemo = surfaceTotal * (config.prix_demo_palier1 || 8);
    } else if (surfaceTotal <= 1500) {
        prixDemo = 500 * (config.prix_demo_palier1 || 8);
        prixDemo += (surfaceTotal - 500) * (config.prix_demo_palier2 || 6.5);
    } else {
        prixDemo = 500 * (config.prix_demo_palier1 || 8);
        prixDemo += 1000 * (config.prix_demo_palier2 || 6.5);
        prixDemo += (surfaceTotal - 1500) * (config.prix_demo_palier3 || 4.5);
    }

    // 3. Frais risque élevé (seulement si zones élevées)
    let prixDouches = 0;
    let prixTests = 0;
    let prixPerteTemps = 0;

    if (zonesEleve.length > 0) {
        // Douches
        prixDouches = config.douche_zone1 || 800;
        if (zonesEleve.length > 1) {
            prixDouches += (zonesEleve.length - 1) * (config.douche_zone_supp || 600);
        }

        // Tests d'air
        prixTests = config.test_zone1 || 600;
        if (zonesEleve.length > 1) {
            prixTests += (zonesEleve.length - 1) * (config.test_zone_supp || 400);
        }

        // Perte de temps (basée sur le prix de démolition - REGLES_METIER_MASTER.md)
        // heures = prix_demo / 92, jours = ceil(heures/8), perte = jours × 2h × 92$
        const tauxHoraire = config.taux_horaire || 92;
        const heuresPerteParJour = config.perte_temps_heures_par_jour || 2;
        const heuresTotales = prixDemo / tauxHoraire;
        const joursHommes = Math.ceil(heuresTotales / 8);
        prixPerteTemps = joursHommes * heuresPerteParJour * tauxHoraire;
    }

    // 4. Transport
    let prixTransport = 0;
    if (distance <= 50) {
        prixTransport = config.transport_0_50km || 55;
    } else {
        prixTransport = config.transport_50_100km || 75;
    }

    // 5. Disposition (par 1000 pi², minimum 600$)
    let prixDisposition = Math.ceil(surfaceTotal / 1000) * (config.disposition_par_1000pi2 || 600);
    prixDisposition = Math.max(prixDisposition, config.disposition_par_1000pi2 || 600);

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
    const margePourcent = config.marge_profit || 20;
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
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-xl';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="font-medium text-slate-800">${zone.nom}</span>
                <span class="text-sm text-slate-500">${zone.surface?.toFixed(0) || 0} pi²</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskClass}">${zone.risque}</span>
        `;
        zonesList.appendChild(div);
    });

    // Surface totale
    document.getElementById('recap-surface-total').textContent = state.prix.surfaceTotal?.toFixed(0) || 0;

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

    // Prix details
    document.getElementById('prix-zones').textContent = formatCurrency(state.prix.zones);
    document.getElementById('prix-demolition').textContent = formatCurrency(state.prix.demolition);
    document.getElementById('prix-douches').textContent = formatCurrency(state.prix.douches);
    document.getElementById('prix-tests').textContent = formatCurrency(state.prix.tests);
    document.getElementById('prix-perte-temps').textContent = formatCurrency(state.prix.perteTemps);
    document.getElementById('prix-transport').textContent = formatCurrency(state.prix.transport);
    document.getElementById('prix-disposition').textContent = formatCurrency(state.prix.disposition);
    document.getElementById('prix-assurance').textContent = formatCurrency(state.prix.assurance);
    document.getElementById('prix-sous-total').textContent = formatCurrency(state.prix.sousTotal);
    document.getElementById('marge-percent').textContent = state.prix.margePourcent || 20;
    document.getElementById('prix-marge').textContent = formatCurrency(state.prix.marge);
    document.getElementById('prix-total').textContent = formatCurrency(state.prix.total);
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

/* =====================================================
   APEX SOUMISSIONS AMIANTE - Application JavaScript
   ===================================================== */

// =====================================================
// CONFIGURATION SUPABASE
// =====================================================

const SUPABASE_URL = 'https://bmwfipxpbkofjsgdraau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtd2ZpcHhwYmtvZmpzZ2RyYWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTQ2MDgsImV4cCI6MjA4NDIzMDYwOH0.qSxu_WQlac2WBDSfxEWTqdOYaoVurwIJNqmr9MOeihw';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

    // Setup event listeners
    setupStep1Events();
    setupStep2Events();

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
        if (state.currentStep === 2) {
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
        // TODO: Navigate to step 3 (Zones)
        alert('Étape 3 (Zones) - À implémenter');
        return;
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
// UTILITY FUNCTIONS
// =====================================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

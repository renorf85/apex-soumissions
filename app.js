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

    // Test Supabase connection
    await testConnection();

    // Setup event listeners for Step 1
    setupStep1Events();

    console.log('Apex Soumissions - Prêt!');
});

// =====================================================
// SUPABASE CONNECTION
// =====================================================

async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('materiaux')
            .select('id')
            .limit(1);

        if (error) throw error;

        updateStatusIndicator(true);
        console.log('Connexion Supabase réussie');
    } catch (error) {
        console.error('Erreur connexion Supabase:', error);
        updateStatusIndicator(false);
    }
}

function updateStatusIndicator(connected) {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) return;

    if (connected) {
        indicator.innerHTML = `
            <span class="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span class="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.1em] font-display">Connecté</span>
        `;
        indicator.className = 'flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full border border-emerald-100 dark:border-emerald-800/50';
    } else {
        indicator.innerHTML = `
            <span class="size-2 bg-red-500 rounded-full"></span>
            <span class="text-[10px] font-extrabold text-red-700 dark:text-red-400 uppercase tracking-[0.1em] font-display">Erreur</span>
        `;
        indicator.className = 'flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-100 dark:border-red-800/50';
    }
}

// =====================================================
// STEP 1: RAPPORT
// =====================================================

function setupStep1Events() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');
    const btnChangeFile = document.getElementById('btn-change-file');
    const btnNoReport = document.getElementById('btn-no-report');
    const btnNext = document.getElementById('btn-next');

    if (!dropZone) return;

    // Click on drop zone or browse button
    dropZone.addEventListener('click', (e) => {
        if (e.target.id !== 'btn-change-file') {
            fileInput.click();
        }
    });

    btnBrowse?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    btnChangeFile?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

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

    // No report button
    btnNoReport?.addEventListener('click', () => {
        state.rapport = null;
        goToStep(2);
    });

    // Next button
    btnNext?.addEventListener('click', () => {
        goToStep(2);
    });
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

    // Update UI
    const dropZone = document.getElementById('drop-zone');
    const uploadDefault = document.getElementById('upload-default');
    const uploadSuccess = document.getElementById('upload-success');
    const fileName = document.getElementById('file-name');

    dropZone.classList.add('has-file');
    uploadDefault.classList.add('hidden');
    uploadSuccess.classList.remove('hidden');
    fileName.textContent = file.name;

    console.log('Fichier sélectionné:', file.name);
}

// =====================================================
// NAVIGATION
// =====================================================

function goToStep(step) {
    console.log(`Navigation vers étape ${step}`);

    // For now, just log - we'll implement full navigation when we have all steps
    if (step === 2) {
        // TODO: Navigate to step 2 (Client)
        alert('Étape 2 (Client) - À implémenter');
    }

    state.currentStep = step;
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

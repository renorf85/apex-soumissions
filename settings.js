/* =====================================================
   APEX SOUMISSIONS - Settings Page JavaScript
   ===================================================== */

// Supabase Configuration
const SUPABASE_URL = 'https://bmwfipxpbkofjsgdraau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtd2ZpcHhwYmtvZmpzZ2RyYWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTQ2MDgsImV4cCI6MjA4NDIzMDYwOH0.qSxu_WQlac2WBDSfxEWTqdOYaoVurwIJNqmr9MOeihw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// AUTHENTIFICATION ANONYME (Sécurité)
// =====================================================

/**
 * Authentifie l'utilisateur de façon anonyme
 * Requis pour accéder aux données (RLS activé)
 */
async function ensureAuthenticated() {
    try {
        // Vérifier si déjà authentifié
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            console.log('✅ Session existante trouvée');
            return true;
        }
        
        // Si pas de session, s'authentifier anonymement
        console.log('🔐 Authentification anonyme...');
        const { data, error } = await supabaseClient.auth.signInAnonymously();
        
        if (error) {
            console.error('❌ Erreur d\'authentification:', error.message);
            return false;
        }
        
        console.log('✅ Authentification réussie');
        return true;
    } catch (err) {
        console.error('❌ Erreur lors de l\'authentification:', err);
        return false;
    }
}

// Config keys mapping (input id -> database key) for config_prix table
const CONFIG_KEYS = {
    'config-taux_horaire': 'taux_horaire',
    'config-marge_profit': 'marge_profit',
    'config-prix_demo_palier1': 'prix_demo_palier1',
    'config-prix_demo_palier2': 'prix_demo_palier2',
    'config-prix_demo_palier3': 'prix_demo_palier3',
    'config-transport_0_50km': 'transport_0_50km',
    'config-transport_50_100km': 'transport_50_100km',
    'config-zone1_modere': 'zone1_modere',
    'config-zone_supp_modere': 'zone_supp_modere',
    'config-zone1_eleve': 'zone1_eleve',
    'config-zone_supp_eleve': 'zone_supp_eleve',
    'config-douche_zone1': 'douche_zone1',
    'config-douche_zone_supp': 'douche_zone_supp',
    'config-test_zone1': 'test_zone1',
    'config-test_zone_supp': 'test_zone_supp',
    'config-perte_temps_heures': 'perte_temps_heures_par_jour',
    'config-disposition_par_1000pi2': 'disposition_par_1000pi2',
    'config-assurance_petit': 'assurance_petit',
    'config-assurance_grand': 'assurance_grand'
};

// Config keys mapping for config_textes table (PDF configuration)
const CONFIG_TEXTES_KEYS = {
    'config-entreprise_nom': 'entreprise_nom',
    'config-entreprise_adresse': 'entreprise_adresse',
    'config-entreprise_telephone': 'entreprise_telephone',
    'config-entreprise_courriel': 'entreprise_courriel',
    'config-entreprise_licence_rbq': 'entreprise_licence_rbq',
    'config-numero_prefix': 'numero_prefix',
    'config-descriptif_risque_modere': 'descriptif_risque_modere',
    'config-descriptif_risque_eleve': 'descriptif_risque_eleve',
    'config-instructions_paiement': 'instructions_paiement',
    'config-texte_signature': 'texte_signature'
};

// Special handling for JSON arrays (inclusions/exclusions)
const CONFIG_TEXTES_JSON_KEYS = {
    'config-liste_inclusions': 'liste_inclusions',
    'config-liste_exclusions': 'liste_exclusions'
};

// Document storage state
const uploadedDocs = {
    licence: null,
    assurance: null,
    contrat: null
};

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Settings - Initialisation...');

    // Authentification anonyme (requis pour RLS)
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
        console.error('❌ Impossible de s\'authentifier - L\'application ne fonctionnera pas correctement');
        alert('Erreur de connexion. Veuillez rafraîchir la page.');
        return;
    }

    // Load config from Supabase
    await loadConfig();
    await loadConfigTextes();
    await loadDocumentsStatus();

    // Setup save button
    document.getElementById('btn-save')?.addEventListener('click', saveAllConfig);

    console.log('Settings - Prêt!');
});

// =====================================================
// LOAD CONFIG
// =====================================================

async function loadConfig() {
    try {
        const { data, error } = await supabaseClient
            .from('config_prix')
            .select('*');

        if (error) throw error;

        // Convert array to object for easy lookup
        const configMap = {};
        data.forEach(item => {
            configMap[item.cle] = item.valeur;
        });

        // Populate inputs
        Object.entries(CONFIG_KEYS).forEach(([inputId, dbKey]) => {
            const input = document.getElementById(inputId);
            if (input && configMap[dbKey] !== undefined) {
                input.value = configMap[dbKey];
            }
        });

        console.log(`✅ ${data.length} paramètres chargés`);

    } catch (err) {
        console.error('Erreur chargement config:', err);
        alert('Erreur lors du chargement des paramètres.');
    }
}

// =====================================================
// LOAD CONFIG TEXTES (PDF Configuration)
// =====================================================

async function loadConfigTextes() {
    try {
        const { data, error } = await supabaseClient
            .from('config_textes')
            .select('*');

        if (error) throw error;

        // Convert array to object for easy lookup
        const configMap = {};
        data.forEach(item => {
            configMap[item.cle] = item.valeur;
        });

        // Populate text inputs
        Object.entries(CONFIG_TEXTES_KEYS).forEach(([inputId, dbKey]) => {
            const input = document.getElementById(inputId);
            if (input && configMap[dbKey] !== undefined) {
                input.value = configMap[dbKey] || '';
            }
        });

        // Populate JSON array inputs (convert JSON to lines)
        Object.entries(CONFIG_TEXTES_JSON_KEYS).forEach(([inputId, dbKey]) => {
            const input = document.getElementById(inputId);
            if (input && configMap[dbKey]) {
                try {
                    const arr = JSON.parse(configMap[dbKey]);
                    if (Array.isArray(arr)) {
                        input.value = arr.join('\n');
                    }
                } catch (e) {
                    console.warn(`Erreur parsing JSON pour ${dbKey}:`, e);
                }
            }
        });

        console.log(`✅ ${data.length} paramètres textes chargés`);

    } catch (err) {
        console.error('Erreur chargement config textes:', err);
        // Don't alert - table might not exist yet
    }
}

// =====================================================
// LOAD DOCUMENTS STATUS
// =====================================================

async function loadDocumentsStatus() {
    // Check localStorage for uploaded documents info
    const docs = ['licence', 'assurance', 'contrat'];
    
    for (const docType of docs) {
        const docInfo = localStorage.getItem(`apex_doc_${docType}`);
        if (docInfo) {
            try {
                const info = JSON.parse(docInfo);
                uploadedDocs[docType] = info;
                updateDocStatus(docType, true, info.name);
            } catch (e) {
                console.warn(`Erreur chargement doc ${docType}:`, e);
            }
        }
    }
}

// =====================================================
// DOCUMENT UPLOAD HANDLING
// =====================================================

function handleDocUpload(docType, input) {
    const file = input.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        alert('Veuillez sélectionner un fichier PDF.');
        input.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('Le fichier est trop volumineux. Maximum 10 MB.');
        input.value = '';
        return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        
        // Store in memory and localStorage
        const docInfo = {
            name: file.name,
            size: file.size,
            type: file.type,
            data: base64,
            uploadedAt: new Date().toISOString()
        };
        
        uploadedDocs[docType] = docInfo;
        localStorage.setItem(`apex_doc_${docType}`, JSON.stringify(docInfo));
        
        updateDocStatus(docType, true, file.name);
        console.log(`📄 Document ${docType} téléversé: ${file.name}`);
    };
    
    reader.readAsDataURL(file);
}

function removeDoc(docType) {
    uploadedDocs[docType] = null;
    localStorage.removeItem(`apex_doc_${docType}`);
    
    // Reset file input
    const input = document.getElementById(`doc-${docType}`);
    if (input) input.value = '';
    
    updateDocStatus(docType, false);
    console.log(`🗑️ Document ${docType} supprimé`);
}

function updateDocStatus(docType, uploaded, fileName = '') {
    const statusEl = document.getElementById(`doc-${docType}-status`);
    const removeBtn = document.getElementById(`btn-remove-${docType}`);
    
    if (statusEl) {
        if (uploaded) {
            statusEl.textContent = fileName || 'Téléversé';
            statusEl.className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-600';
        } else {
            statusEl.textContent = 'Non téléversé';
            statusEl.className = 'text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500';
        }
    }
    
    if (removeBtn) {
        removeBtn.classList.toggle('hidden', !uploaded);
    }
}

// Make functions available globally for onclick handlers
window.handleDocUpload = handleDocUpload;
window.removeDoc = removeDoc;

// =====================================================
// SAVE ALL CONFIG
// =====================================================

async function saveAllConfig() {
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;

    // Show loading state
    btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Enregistrement...
    `;
    btn.disabled = true;

    try {
        // Save config_prix (numeric values)
        await saveConfigPrix();
        
        // Save config_textes (text values)
        await saveConfigTextes();

        // Update last saved timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('last-saved').textContent = `Dernière modification: Aujourd'hui à ${timeStr}`;

        // Show success
        btn.innerHTML = `
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Enregistré!
        `;
        btn.classList.remove('bg-primary', 'hover:bg-primary-dark');
        btn.classList.add('bg-green-500');

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-primary', 'hover:bg-primary-dark');
            btn.disabled = false;
        }, 2000);

        console.log('✅ Tous les paramètres enregistrés');

    } catch (err) {
        console.error('Erreur sauvegarde config:', err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert('Erreur lors de l\'enregistrement des paramètres.');
    }
}

async function saveConfigPrix() {
    const updates = [];

    Object.entries(CONFIG_KEYS).forEach(([inputId, dbKey]) => {
        const input = document.getElementById(inputId);
        if (input) {
            updates.push({
                cle: dbKey,
                valeur: parseFloat(input.value) || 0
            });
        }
    });

    // Upsert each config value
    for (const update of updates) {
        const { error } = await supabaseClient
            .from('config_prix')
            .upsert(update, { onConflict: 'cle' });

        if (error) throw error;
    }
}

async function saveConfigTextes() {
    const updates = [];

    // Regular text fields
    Object.entries(CONFIG_TEXTES_KEYS).forEach(([inputId, dbKey]) => {
        const input = document.getElementById(inputId);
        if (input) {
            updates.push({
                cle: dbKey,
                valeur: input.value || ''
            });
        }
    });

    // JSON array fields (convert lines to JSON)
    Object.entries(CONFIG_TEXTES_JSON_KEYS).forEach(([inputId, dbKey]) => {
        const input = document.getElementById(inputId);
        if (input) {
            const lines = input.value.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            updates.push({
                cle: dbKey,
                valeur: JSON.stringify(lines)
            });
        }
    });

    // Upsert each config value
    for (const update of updates) {
        const { error } = await supabaseClient
            .from('config_textes')
            .upsert(update, { onConflict: 'cle' });

        if (error) throw error;
    }
}

// Keep old function name for backwards compatibility
async function saveConfig() {
    return saveAllConfig();
}

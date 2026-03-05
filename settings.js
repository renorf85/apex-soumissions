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
    'config-assurance_grand': 'assurance_grand',
    'config-ventilateur_par_jour': 'ventilateur_par_jour'
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
    'config-descriptif_risque_eleve_allege': 'descriptif_risque_eleve_allege',
    'config-descriptif_risque_eleve': 'descriptif_risque_eleve',
    'config-instructions_paiement': 'instructions_paiement',
    'config-texte_signature': 'texte_signature',
    // Entreprise / Taxes
    'config-entreprise_ville': 'entreprise_ville',
    'config-numero_tps': 'numero_tps',
    'config-numero_tvq': 'numero_tvq',
    'config-signataire_nom': 'signataire_nom',
    'config-signataire_titre': 'signataire_titre',
    'config-validite_jours': 'validite_jours',
    // Paiement
    'config-paiement_cheque_destinataire': 'paiement_cheque_destinataire',
    'config-paiement_cheque_adresse': 'paiement_cheque_adresse',
    'config-paiement_interac_courriel': 'paiement_interac_courriel',
    'config-paiement_virement_transit': 'paiement_virement_transit',
    'config-paiement_virement_institution': 'paiement_virement_institution',
    'config-paiement_virement_compte': 'paiement_virement_compte',
    // Contrat (8 sections)
    'config-contrat_section_1': 'contrat_section_1',
    'config-contrat_section_2': 'contrat_section_2',
    'config-contrat_section_3': 'contrat_section_3',
    'config-contrat_section_4': 'contrat_section_4',
    'config-contrat_section_5': 'contrat_section_5',
    'config-contrat_section_6': 'contrat_section_6',
    'config-contrat_section_7': 'contrat_section_7',
    'config-contrat_section_8': 'contrat_section_8',
    // Notes techniques
    'config-notes_techniques': 'notes_techniques'
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
        console.warn('⚠️ Authentification échouée - certaines fonctions pourraient ne pas fonctionner');
    }

    // Load config from Supabase
    await loadConfig();
    await loadConfigTextes();
    await loadDocumentsStatus();
    await loadMateriauxSettings();

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

// =====================================================
// MATÉRIAUX CRUD
// =====================================================

const MATERIAUX_FALLBACK = [
    { id: 1, nom: 'Flocage (ignifugation projetée)', friabilite: 'friable', epaisseur_defaut: 2.0, categorie: 'Isolants', niveau_risque_typique: 'Élevé', actif: true },
    { id: 2, nom: 'Calorifugeage (tuyauterie, coudes)', friabilite: 'friable', epaisseur_defaut: 1.0, categorie: 'Isolants', niveau_risque_typique: 'Élevé (Modéré si < 1m linéaire)', actif: true },
    { id: 3, nom: 'Vermiculite (isolant en vrac)', friabilite: 'friable', epaisseur_defaut: 4.0, categorie: 'Isolants', niveau_risque_typique: 'Élevé', actif: true },
    { id: 4, nom: 'Isolant de chaudière / réservoir', friabilite: 'friable', epaisseur_defaut: 2.0, categorie: 'Isolants', niveau_risque_typique: 'Élevé', actif: true },
    { id: 5, nom: 'Plâtre cimentaire / Plâtre sur lattes', friabilite: 'friable', epaisseur_defaut: 0.875, categorie: 'Murs et Plafonds', niveau_risque_typique: 'Élevé (si > 10 pi³)', actif: true },
    { id: 6, nom: 'Stucco / Plafond "Popcorn"', friabilite: 'friable', epaisseur_defaut: 0.5, categorie: 'Murs et Plafonds', niveau_risque_typique: 'Modéré à Élevé', actif: true },
    { id: 7, nom: 'Gypse et composé à joint', friabilite: 'non_friable', epaisseur_defaut: 0.5, categorie: 'Murs et Plafonds', niveau_risque_typique: 'Modéré', actif: true },
    { id: 8, nom: 'Tuiles de plafond suspendu', friabilite: 'friable', epaisseur_defaut: 0.5, categorie: 'Murs et Plafonds', niveau_risque_typique: 'Modéré', actif: true },
    { id: 9, nom: 'Linoléum avec endos de feutre', friabilite: 'friable', epaisseur_defaut: 0.125, categorie: 'Sols', niveau_risque_typique: 'Élevé (si arraché)', actif: true },
    { id: 10, nom: 'Dalles de vinyle-amiante (V.A.T.)', friabilite: 'non_friable', epaisseur_defaut: 0.0625, categorie: 'Sols', niveau_risque_typique: 'Modéré', actif: true },
    { id: 11, nom: 'Mastic / Colle noire (sous dalles/bois)', friabilite: 'non_friable', epaisseur_defaut: 0.0625, categorie: 'Sols', niveau_risque_typique: 'Modéré', actif: true },
    { id: 12, nom: 'Bardeau / Déclin de ciment (Transite)', friabilite: 'non_friable', epaisseur_defaut: 0.25, categorie: 'Extérieur', niveau_risque_typique: 'Modéré', actif: true },
    { id: 13, nom: 'Bardeaux de toiture en asphalte', friabilite: 'non_friable', epaisseur_defaut: 0.125, categorie: 'Extérieur', niveau_risque_typique: 'Faible à Modéré', actif: true },
    { id: 14, nom: 'Calfeutrant de fenêtres / portes', friabilite: 'non_friable', epaisseur_defaut: 0.25, categorie: 'Extérieur', niveau_risque_typique: 'Faible à Modéré', actif: true },
    { id: 15, nom: 'Stucco extérieur', friabilite: 'non_friable', epaisseur_defaut: 0.5, categorie: 'Extérieur', niveau_risque_typique: 'Modéré', actif: true },
    { id: 16, nom: 'Conduits de ventilation (Transite)', friabilite: 'non_friable', epaisseur_defaut: 0.25, categorie: 'Mécanique', niveau_risque_typique: 'Modéré', actif: true },
    { id: 17, nom: 'Tuyaux de drainage / égout (Transite)', friabilite: 'non_friable', epaisseur_defaut: 1.0, categorie: 'Mécanique', niveau_risque_typique: 'Modéré (Élevé si scié)', actif: true },
    { id: 18, nom: 'Tissus de joints de dilatation', friabilite: 'friable', epaisseur_defaut: 0.125, categorie: 'Mécanique', niveau_risque_typique: 'Modéré à Élevé', actif: true },
    { id: 19, nom: 'Panneaux électriques (Ébène)', friabilite: 'non_friable', epaisseur_defaut: 0.25, categorie: 'Mécanique', niveau_risque_typique: 'Modéré', actif: true },
];

async function loadMateriauxSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('materiaux')
            .select('*')
            .order('ordre');

        if (error) throw error;

        const materiaux = (data && data.length > 0) ? data : MATERIAUX_FALLBACK;
        renderMateriauxTable(materiaux);

        const countEl = document.getElementById('materiaux-count');
        if (countEl) countEl.textContent = materiaux.length;

        console.log(`✅ ${materiaux.length} matériaux chargés dans settings`);
    } catch (err) {
        console.error('Erreur chargement matériaux settings:', err);
        // Fallback si Supabase échoue
        renderMateriauxTable(MATERIAUX_FALLBACK);
        const countEl = document.getElementById('materiaux-count');
        if (countEl) countEl.textContent = MATERIAUX_FALLBACK.length;
        console.log(`⚠️ Fallback: ${MATERIAUX_FALLBACK.length} matériaux affichés`);
    }
}

function renderMateriauxTable(materiaux) {
    const tbody = document.getElementById('materiaux-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    materiaux.forEach(mat => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 ${!mat.actif ? 'opacity-40' : ''} hover:bg-slate-50 transition-colors`;
        tr.dataset.id = mat.id;

        const friabiliteClass = mat.friabilite === 'friable' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600';
        const friabiliteText = mat.friabilite === 'friable' ? 'Friable' : 'Non friable';

        tr.innerHTML = `
            <td class="py-2.5 pr-2">
                <span class="font-medium text-slate-800">${mat.nom}</span>
            </td>
            <td class="py-2.5 pr-2 text-slate-500">${mat.categorie || '-'}</td>
            <td class="py-2.5 pr-2">
                <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${friabiliteClass}">${friabiliteText}</span>
            </td>
            <td class="py-2.5 pr-2 text-slate-500">${mat.epaisseur_defaut}"</td>
            <td class="py-2.5 pr-2 text-slate-500 text-xs">${mat.niveau_risque_typique || '-'}</td>
            <td class="py-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="editMateriau('${mat.id}')" class="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors" title="Modifier">
                        <span class="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button onclick="toggleMateriauActif('${mat.id}', ${mat.actif})" class="p-1.5 ${mat.actif ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-green-500 hover:text-green-600 hover:bg-green-50'} rounded-lg transition-colors" title="${mat.actif ? 'Désactiver' : 'Activer'}">
                        <span class="material-symbols-outlined text-base">${mat.actif ? 'visibility_off' : 'visibility'}</span>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function showAddMateriauForm() {
    const form = document.getElementById('add-materiau-form');
    const btn = document.getElementById('btn-add-materiau');
    if (form) form.classList.remove('hidden');
    if (btn) btn.classList.add('hidden');
    // Reset form
    document.getElementById('new-mat-nom').value = '';
    document.getElementById('new-mat-categorie').value = 'Murs et Plafonds';
    document.getElementById('new-mat-friabilite').value = 'non_friable';
    document.getElementById('new-mat-epaisseur').value = '0.5';
    document.getElementById('new-mat-risque').value = '';
}

function cancelAddMateriau() {
    const form = document.getElementById('add-materiau-form');
    const btn = document.getElementById('btn-add-materiau');
    if (form) form.classList.add('hidden');
    if (btn) btn.classList.remove('hidden');
}

async function saveNewMateriau() {
    const nom = document.getElementById('new-mat-nom').value.trim();
    const categorie = document.getElementById('new-mat-categorie').value;
    const friabilite = document.getElementById('new-mat-friabilite').value;
    const epaisseur = parseFloat(document.getElementById('new-mat-epaisseur').value) || 0.5;
    const risque = document.getElementById('new-mat-risque').value.trim();

    if (!nom) {
        alert('Veuillez entrer un nom de matériau.');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('materiaux')
            .insert({
                nom,
                categorie,
                friabilite,
                epaisseur_defaut: epaisseur,
                niveau_risque_typique: risque || null,
                actif: true,
                ordre: 99
            })
            .select();

        if (error) throw error;

        console.log('✅ Matériau ajouté:', data);
        cancelAddMateriau();
        await loadMateriauxSettings();
    } catch (err) {
        console.error('Erreur ajout matériau:', err);
        alert('Erreur lors de l\'ajout du matériau.');
    }
}

async function editMateriau(id) {
    // Find the row and make it editable inline
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Fetch current data
    try {
        const { data, error } = await supabaseClient
            .from('materiaux')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const mat = data;
        row.innerHTML = `
            <td class="py-2 pr-2">
                <input type="text" value="${mat.nom}" class="edit-mat-nom w-full px-2 py-1 border border-slate-200 rounded text-sm" data-id="${id}">
            </td>
            <td class="py-2 pr-2">
                <select class="edit-mat-categorie px-2 py-1 border border-slate-200 rounded text-sm bg-white" data-id="${id}">
                    <option value="Isolants" ${mat.categorie === 'Isolants' ? 'selected' : ''}>Isolants</option>
                    <option value="Murs et Plafonds" ${mat.categorie === 'Murs et Plafonds' ? 'selected' : ''}>Murs et Plafonds</option>
                    <option value="Sols" ${mat.categorie === 'Sols' ? 'selected' : ''}>Sols</option>
                    <option value="Extérieur" ${mat.categorie === 'Extérieur' ? 'selected' : ''}>Extérieur</option>
                    <option value="Mécanique" ${mat.categorie === 'Mécanique' ? 'selected' : ''}>Mécanique</option>
                </select>
            </td>
            <td class="py-2 pr-2">
                <select class="edit-mat-friabilite px-2 py-1 border border-slate-200 rounded text-sm bg-white" data-id="${id}">
                    <option value="non_friable" ${mat.friabilite === 'non_friable' ? 'selected' : ''}>Non friable</option>
                    <option value="friable" ${mat.friabilite === 'friable' ? 'selected' : ''}>Friable</option>
                </select>
            </td>
            <td class="py-2 pr-2">
                <input type="number" value="${mat.epaisseur_defaut}" class="edit-mat-epaisseur w-20 px-2 py-1 border border-slate-200 rounded text-sm" step="0.0625" data-id="${id}">
            </td>
            <td class="py-2 pr-2">
                <input type="text" value="${mat.niveau_risque_typique || ''}" class="edit-mat-risque w-full px-2 py-1 border border-slate-200 rounded text-sm" data-id="${id}">
            </td>
            <td class="py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="saveEditMateriau('${id}')" class="p-1.5 text-green-500 hover:bg-green-50 rounded-lg" title="Sauvegarder">
                        <span class="material-symbols-outlined text-base">check</span>
                    </button>
                    <button onclick="loadMateriauxSettings()" class="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg" title="Annuler">
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            </td>
        `;
    } catch (err) {
        console.error('Erreur chargement matériau pour édition:', err);
    }
}

async function saveEditMateriau(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const nom = row.querySelector('.edit-mat-nom').value.trim();
    const categorie = row.querySelector('.edit-mat-categorie').value;
    const friabilite = row.querySelector('.edit-mat-friabilite').value;
    const epaisseur = parseFloat(row.querySelector('.edit-mat-epaisseur').value) || 0.5;
    const risque = row.querySelector('.edit-mat-risque').value.trim();

    if (!nom) {
        alert('Le nom ne peut pas être vide.');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('materiaux')
            .update({
                nom,
                categorie,
                friabilite,
                epaisseur_defaut: epaisseur,
                niveau_risque_typique: risque || null
            })
            .eq('id', id);

        if (error) throw error;

        console.log('✅ Matériau mis à jour:', id);
        await loadMateriauxSettings();
    } catch (err) {
        console.error('Erreur mise à jour matériau:', err);
        alert('Erreur lors de la mise à jour.');
    }
}

async function toggleMateriauActif(id, currentState) {
    try {
        const { error } = await supabaseClient
            .from('materiaux')
            .update({ actif: !currentState })
            .eq('id', id);

        if (error) throw error;

        console.log(`✅ Matériau ${!currentState ? 'activé' : 'désactivé'}:`, id);
        await loadMateriauxSettings();
    } catch (err) {
        console.error('Erreur toggle matériau:', err);
    }
}

// Expose materials functions globally for onclick handlers
window.showAddMateriauForm = showAddMateriauForm;
window.cancelAddMateriau = cancelAddMateriau;
window.saveNewMateriau = saveNewMateriau;
window.editMateriau = editMateriau;
window.saveEditMateriau = saveEditMateriau;
window.toggleMateriauActif = toggleMateriauActif;
window.loadMateriauxSettings = loadMateriauxSettings;

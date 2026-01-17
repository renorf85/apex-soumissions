/* =====================================================
   APEX SOUMISSIONS - Settings Page JavaScript
   ===================================================== */

// Supabase Configuration
const SUPABASE_URL = 'https://bmwfipxpbkofjsgdraau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtd2ZpcHhwYmtvZmpzZ2RyYWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTQ2MDgsImV4cCI6MjA4NDIzMDYwOH0.qSxu_WQlac2WBDSfxEWTqdOYaoVurwIJNqmr9MOeihw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Config keys mapping (input id -> database key)
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

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Settings - Initialisation...');

    // Load config from Supabase
    await loadConfig();

    // Setup save button
    document.getElementById('btn-save')?.addEventListener('click', saveConfig);

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
// SAVE CONFIG
// =====================================================

async function saveConfig() {
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
        // Collect all values
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

        console.log('✅ Paramètres enregistrés');

    } catch (err) {
        console.error('Erreur sauvegarde config:', err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert('Erreur lors de l\'enregistrement des paramètres.');
    }
}

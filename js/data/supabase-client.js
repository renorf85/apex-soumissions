/* =====================================================
   SUPABASE CLIENT - Reference partagee
   ===================================================== */

// Le client Supabase est deja initialise dans app.js (ligne 62) :
//   const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
//
// Les nouveaux modules accedent a supabaseClient directement
// car c'est une variable globale definie dans app.js.
//
// Ce fichier sert de documentation et de point d'entree
// si on veut centraliser l'initialisation dans le futur.

window.getSupabaseClient = function() {
    return supabaseClient;
};

-- ============================================
-- MIGRATION 004 : Correctif securite RLS - 2026-04-01
-- STATUT : APPLIQUEE via supabase db query --linked
-- ============================================
-- CONTEXTE : Supabase a detecte que config_textes etait publiquement
-- accessible sans Row-Level Security. De plus, config_prix et
-- config_textes avaient des policies "anon" permettant l'acces
-- sans authentification, et materiaux manquait les policies
-- INSERT/UPDATE pour les reglages.
--
-- CORRECTIONS APPLIQUEES :
-- 1. ALTER TABLE config_textes ENABLE ROW LEVEL SECURITY
-- 2. Suppression des 6 policies "anon" sur config_prix et config_textes
-- 3. Ajout policies INSERT/UPDATE sur materiaux pour authenticated
-- ============================================

-- ========== Ce qui a ete execute ==========

-- 1. Activer RLS sur config_textes (la seule table sans RLS)
ALTER TABLE config_textes ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les policies anonymes dangereuses
DROP POLICY IF EXISTS "Allow anonymous insert config_textes" ON config_textes;
DROP POLICY IF EXISTS "Allow anonymous select config_textes" ON config_textes;
DROP POLICY IF EXISTS "Allow anonymous update config_textes" ON config_textes;
DROP POLICY IF EXISTS "Allow anonymous insert config_prix" ON config_prix;
DROP POLICY IF EXISTS "Allow anonymous select config_prix" ON config_prix;
DROP POLICY IF EXISTS "Allow anonymous update config_prix" ON config_prix;

-- 3. Ajouter INSERT/UPDATE sur materiaux (il n'avait que SELECT)
CREATE POLICY "materiaux_insert_auth" ON materiaux
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "materiaux_update_auth" ON materiaux
    FOR UPDATE TO authenticated
    USING (true);


-- ========== ETAT FINAL DES POLICIES (toutes tables) ==========
-- clients          : CRUD authenticated (ALL)
-- config_prix      : SELECT, INSERT, UPDATE authenticated
-- config_textes    : SELECT, INSERT, UPDATE authenticated
-- materiaux        : SELECT, INSERT, UPDATE authenticated
-- soumissions      : SELECT, INSERT, UPDATE authenticated
-- zones            : CRUD authenticated (ALL)
-- Aucune table n'a de policy "anon". Toutes ont RLS active.


-- ========== DOWN (annuler) ==========
-- DROP POLICY IF EXISTS "materiaux_update_auth" ON materiaux;
-- DROP POLICY IF EXISTS "materiaux_insert_auth" ON materiaux;
-- ALTER TABLE config_textes DISABLE ROW LEVEL SECURITY;
-- (Re-creer les policies anon si necessaire, mais non recommande)

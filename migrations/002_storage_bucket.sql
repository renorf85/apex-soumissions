-- ============================================
-- MIGRATION 002 : Bucket Storage pour PDFs
-- Phase 4.0 - Fondations
-- ============================================

-- ========== UP (appliquer) ==========
-- IMPORTANT : Le bucket doit etre cree via le Dashboard Supabase :
-- 1. Aller dans Storage
-- 2. Cliquer "New bucket"
-- 3. Nom : soumissions-pdfs
-- 4. Public : NON (prive)
-- 5. Sauvegarder
--
-- Ensuite executer ces policies dans le SQL Editor :

CREATE POLICY "auth_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'soumissions-pdfs');

CREATE POLICY "auth_write" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'soumissions-pdfs');

CREATE POLICY "auth_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'soumissions-pdfs');

CREATE POLICY "auth_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'soumissions-pdfs');


-- ========== DOWN (annuler) ==========
-- Pour annuler cette migration :
--
-- DROP POLICY IF EXISTS "auth_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "auth_update" ON storage.objects;
-- DROP POLICY IF EXISTS "auth_write" ON storage.objects;
-- DROP POLICY IF EXISTS "auth_read" ON storage.objects;
--
-- Puis dans le Dashboard Supabase > Storage :
-- Supprimer le bucket "soumissions-pdfs" (vider son contenu d'abord si necessaire)

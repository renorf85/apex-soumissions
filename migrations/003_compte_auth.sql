-- ============================================
-- MIGRATION 003 : Compte utilisateur partage
-- Phase 4.0 - Fondations
-- ============================================

-- ========== UP (appliquer) ==========
-- IMPORTANT : Ce compte doit etre cree via le Dashboard Supabase :
-- 1. Aller dans Authentication > Users
-- 2. Cliquer "Add user" > "Create new user"
-- 3. Email : equipe@apexdesamiantage.com
-- 4. Password : (a confirmer avec Luca, temporairement apex2026! pour dev)
-- 5. Cocher "Auto Confirm User"
-- 6. Sauvegarder
--
-- Ce compte sera utilise par toute l'equipe via un code d'acces partage.
-- L'app utilise signInWithPassword() avec cet email et le mot de passe comme "code d'acces".


-- ========== DOWN (annuler) ==========
-- Pour annuler cette migration :
-- 1. Dashboard Supabase > Authentication > Users
-- 2. Trouver equipe@apexdesamiantage.com
-- 3. Cliquer les 3 points > Delete user

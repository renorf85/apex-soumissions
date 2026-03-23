# Migrations Supabase - Apex Soumissions

## C'est quoi ce dossier?

Chaque fichier SQL ici represente un changement fait a la base de donnees Supabase.
Chaque fichier contient deux sections :
- **UP** : le SQL qui a ete execute pour appliquer le changement
- **DOWN** : le SQL a executer pour ANNULER le changement et revenir en arriere

Les fichiers sont numerotes dans l'ordre d'execution.

## Comment revenir en arriere

1. Ouvrir le dashboard Supabase : https://bmwfipxpbkofjsgdraau.supabase.co
2. Aller dans SQL Editor
3. Ouvrir le fichier de migration a annuler (le plus recent d'abord)
4. Copier-coller UNIQUEMENT la section "DOWN"
5. Executer
6. Repeter pour chaque migration a annuler, en ordre inverse (dernier -> premier)

## Exemple

Si tu veux annuler TOUT ce qui a ete fait en Phase 4 :
1. Executer le DOWN de `003_compte_auth.sql` en premier
2. Puis le DOWN de `002_storage_bucket.sql`
3. Puis le DOWN de `001_table_soumissions.sql`

Ensuite cote code, faire `git reset --hard b172631` pour revenir au code d'avant la Phase 4.

## Etat actuel

| # | Fichier | Description | Applique? |
|---|---------|-------------|-----------|
| 1 | 001_table_soumissions.sql | Table soumissions + index + RLS | Non |
| 2 | 002_storage_bucket.sql | Bucket Storage pour les PDFs | Non |
| 3 | 003_compte_auth.sql | Compte utilisateur partage | Non |

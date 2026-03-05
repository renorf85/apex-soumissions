# Apex Soumissions - App

## Déploiement / Publication

Le projet est déployé automatiquement sur **Netlify** via GitHub.

- **Repo GitHub** : https://github.com/renorf85/apex-soumissions
- **Site Netlify** : apexsoumission (auto-publish activé)
- **Branche de production** : `main`

### Pour publier :

```bash
cd /Users/luca/Documents/Apex/Apex_soumission_APP
git add <fichiers modifiés>
git commit -m "description des changements"
git push origin main
```

Netlify détecte automatiquement le push et déploie. Pas besoin du CLI Netlify.

## Stack

- Site statique (HTML / CSS / JavaScript vanilla)
- Pas de build nécessaire — le dossier racine est déployé tel quel

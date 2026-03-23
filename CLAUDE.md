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

## Convention du plan de tâches

- Ne PAS marquer les tâches avec ✅ dans le plan tant que Luca n'a pas validé lui-même
- Après implémentation, marquer la phase "à vérifier" et mettre ⚠️ devant chaque tâche
- Luca repasse, teste, et confirme. Seulement là on remplace ⚠️ par ✅.

## Agents en arrière-plan (background agents)

Quand tu lances des agents en arrière-plan (Task avec `run_in_background`), tu DOIS :

1. **Polling actif** : Faire une boucle de vérification avec `TaskOutput` (block: false) toutes les 30 secondes pour chaque agent lancé. Ne jamais attendre passivement que les agents se manifestent.
2. **Toujours revenir à l'utilisateur** : Dès que tous les agents sont terminés, faire un résumé et répondre immédiatement. Ne JAMAIS laisser l'utilisateur attendre sans nouvelles.
3. **Progrès intermédiaire** : Si le polling dure plus de 2 minutes, informer l'utilisateur que les agents travaillent encore et donner un statut (combien terminés / combien en cours).

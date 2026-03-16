# Tests à réaliser - Session Multi-surfaces & Propagation

Ce document contient tous les tests à effectuer pour valider les fonctionnalités implémentées.

---

## TEST A1 : Ajouter plusieurs murs dans une zone

### Ce qui a été ajouté
Un système **multi-surfaces** permettant d'ajouter plusieurs murs (surfaces) dans une même zone. Chaque mur a ses propres dimensions (Longueur × Hauteur), mais partage le même matériau et la même épaisseur.

### Étapes
1. Va à **Étape 3** (Zones de travail)
2. Clique sur **+ Ajouter une zone**
3. Remplis le nom, catégorie, et matériau
4. À l'étape **Dimensions**, tu verras "Surface 1" avec Longueur et Hauteur
5. Clique sur **+ Ajouter un mur**
6. Une "Surface 2" apparaît
7. Remplis les dimensions des deux murs
8. Vérifie les **Totaux de la zone** en bas

### Résultat attendu

| Champ | Ce qui se passe |
|-------|-----------------|
| Surface 2 | Nouveau bloc de saisie apparaît |
| Totaux | Surface et volume sont la **somme** des deux murs |
| Risque | Calculé sur le volume **total** cumulé |

### Pourquoi c'est utile ?
Gabriel a demandé cette fonctionnalité pour éviter de créer plusieurs zones pour une même pièce. Exemple : une cuisine en L avec 2 murs de gypite = 1 seule zone avec 2 surfaces.

---

## TEST A2 : Supprimer un mur

### Ce qui a été ajouté
Un bouton ✕ pour supprimer un mur de la liste (visible seulement s'il y a plus d'un mur).

### Étapes
1. Crée une zone avec **2 murs ou plus**
2. Sur le mur à supprimer, clique sur le **✕ rouge** à droite
3. Le mur disparaît
4. Vérifie que les totaux sont recalculés

### Résultat attendu

| Action | Ce qui se passe |
|--------|-----------------|
| Clic sur ✕ | Le mur est supprimé de la liste |
| Totaux | Recalculés automatiquement |
| Dernier mur | Le ✕ disparaît (impossible de tout supprimer) |

### Pourquoi c'est utile ?
Permet de corriger une erreur sans recommencer toute la zone.

---

## TEST A3 : Seuil de risque avec volume cumulé

### Ce qui a été ajouté
Le calcul de risque se fait sur le **volume total** de tous les murs combinés, pas individuellement.

### Étapes
1. Crée une zone avec un matériau **friable** (ex: Plâtre, Crépi)
2. Ajoute **2 murs** :
   - Mur 1 : 10 × 10 pi (= 100 pi²)
   - Mur 2 : 10 × 10 pi (= 100 pi²)
3. Épaisseur : **0.25 pouces**
4. Calcul : 200 pi² × (0.25/12) = **4.17 pi³**
5. Vérifie le badge de risque

### Résultat attendu

| Volume total | Risque attendu (friable) |
|--------------|--------------------------|
| ≤ 3 pi³ | MODÉRÉ |
| > 3 pi³ | **ÉLEVÉ** |

Dans cet exemple : 4.17 pi³ > 3 → **ÉLEVÉ**

### Pourquoi c'est utile ?
Chaque mur seul serait à ~2 pi³ (modéré), mais ensemble ils dépassent le seuil. C'est la vraie règle CSTC.

---

## TEST A4 : Affichage détaillé sur la carte de zone

### Ce qui a été ajouté
La carte de zone affiche maintenant le **détail de chaque mur** avec ses dimensions, au lieu de juste "2 200 pi² (2 murs)".

### Étapes
1. Crée une zone avec **2 murs** :
   - Mur 1 : 50 × 40 pi
   - Mur 2 : 25 × 8 pi
2. Sauvegarde la zone
3. Regarde la **carte de zone** dans la liste

### Résultat attendu

```
Surfaces
  Mur 1    50 × 40 pi
  Mur 2    25 × 8 pi
  ─────────────────
  Total    2 200 pi²

Matériau    Plâtre
Friabilité  Friable
```

### Pourquoi c'est utile ?
Permet de voir en un coup d'œil les dimensions exactes de chaque mur sans ouvrir la zone.

---

## TEST A5 : Édition d'une zone multi-surfaces

### Ce qui a été ajouté
Quand tu modifies une zone existante, les murs sont rechargés correctement.

### Étapes
1. Crée une zone avec **2 murs**
2. Sauvegarde
3. Clique sur le bouton **✏️ Modifier** de la carte
4. Navigue jusqu'à l'étape **Dimensions**

### Résultat attendu

| Ce qui se passe |
|-----------------|
| Les 2 murs sont affichés avec leurs dimensions |
| Les photos sont conservées |
| Tu peux modifier/ajouter/supprimer des murs |

### Pourquoi c'est utile ?
Permet de corriger une zone sans la recréer de zéro.

---

## TEST B1 : Photo sur un mur

### Ce qui a été ajouté
Chaque mur peut avoir sa propre photo (optionnel). Un bouton 📷 apparaît sur chaque ligne de surface.

### Étapes
1. Crée ou modifie une zone
2. À l'étape **Dimensions**, repère l'icône 📷 grise sur Surface 1
3. Clique dessus
4. Sélectionne une photo (ou prends-en une sur mobile)

### Résultat attendu

| Action | Ce qui se passe |
|--------|-----------------|
| Sélection photo | L'icône devient **verte** |
| Sous le mur | Texte "✓ Photo: nom_fichier.jpg" apparaît |

### Pourquoi c'est utile ?
Maxym a demandé une photo par mur pour que le contrat soit précis. Gabriel voulait que ce soit optionnel.

---

## TEST B2 : Indicateur photos sur la carte

### Ce qui a été ajouté
La carte de zone affiche un 📷 à côté des murs qui ont une photo.

### Étapes
1. Crée une zone avec 2 murs
2. Ajoute une photo seulement sur le **Mur 1**
3. Sauvegarde
4. Regarde la carte

### Résultat attendu

```
Surfaces
  Mur 1    50 × 40 pi 📷
  Mur 2    25 × 8 pi
```

### Pourquoi c'est utile ?
Permet de voir d'un coup d'œil quels murs ont des photos sans ouvrir la zone.

---

## TEST C1 : Propagation du risque élevé

### Ce qui a été ajouté
Si **UNE seule zone** est à risque élevé, **tout le projet** bascule en risque élevé. Les frais globaux (douche, tests, perte de temps) s'activent.

### Étapes
1. Crée **Zone 1** : petit volume → risque **MODÉRÉ**
2. Crée **Zone 2** : gros volume friable → risque **ÉLEVÉ**
3. Va à l'**Étape 4** (Récapitulatif)

### Résultat attendu

| Élément | Ce qui se passe |
|---------|-----------------|
| Badge risque projet | **ÉLEVÉ** (rouge) |
| Warning | "Attention : Risque élevé détecté" visible |
| Douches | 800$ (activé) |
| Tests d'air | 1 200$ (activé) |
| Perte de temps | Calculé et affiché |

### Pourquoi c'est utile ?
Gabriel a confirmé : "dès qu'une zone est à risque, automatiquement tout est en risque élevé". C'est la règle réglementaire.

---

## TEST C2 : Frais globaux (pas par zone)

### Ce qui a été ajouté
Les frais de douche et tests s'appliquent **une seule fois** au projet, pas multipliés par le nombre de zones élevées.

### Étapes
1. Crée **2 zones** à risque élevé
2. Va au récapitulatif
3. Vérifie le prix des douches

### Résultat attendu

| Frais | Montant |
|-------|---------|
| Douches | **800$** (pas 1600$) |
| Tests | **1 200$** (entrée + sortie) |

### Pourquoi c'est utile ?
Maxym a corrigé : "notre taux n'est pas plus cher par zone élevée". Les frais sont globaux au projet.

---

## TEST C3 : Tarif démolition inchangé

### Ce qui a été ajouté
Le tarif de démolition au pi² reste le **même** que le projet soit modéré ou élevé.

### Étapes
1. Crée une zone de 500 pi² en risque **modéré**
2. Note le prix de démolition
3. Change le risque en **élevé** (override manuel)
4. Compare le prix de démolition

### Résultat attendu

| Risque | Prix démo pour 500 pi² |
|--------|------------------------|
| Modéré | 4 000$ (8$/pi²) |
| Élevé | 4 000$ (8$/pi²) - **identique** |

La différence de prix vient des frais globaux (douche, tests, perte de temps), pas du tarif au pi².

### Pourquoi c'est utile ?
L'équipe a confirmé que le coup de marteau coûte le même prix. C'est la logistique (décontamination, protocoles) qui coûte plus cher.

---

## Résumé des tests

| # | Test | Statut |
|---|------|--------|
| A1 | Ajouter plusieurs murs | ✅ |
| A2 | Supprimer un mur | ✅ |
| A3 | Seuil risque volume cumulé | ✅ |
| A4 | Affichage détaillé carte | ✅ |
| A5 | Édition zone multi-surfaces | ✅ |
| B1 | Photo sur un mur | ✅ |
| B2 | Indicateur photos carte | ✅ |
| C1 | Propagation risque élevé | ✅ |
| C2 | Frais globaux uniques | ✅ |
| C3 | Tarif démo inchangé | ✅ |

---

*Document généré le 5 février 2026 - Session Multi-surfaces & Propagation*

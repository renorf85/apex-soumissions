# APEX Soumission App - Historique des versions

## Vue d'ensemble
Application web de génération de soumissions pour les travaux de désamiantage résidentiel.
Développée pour Apex Désamiantage.

---

## [v2.0] - En développement
**Date de début**: Février 2025
**Source du feedback**: Appel de présentation avec Gab, Max et Michael (21 janvier 2025)

### Contexte
Première présentation de l'application à l'équipe Apex. Tests en direct avec des scénarios réels (maison complète, petit mur). Plusieurs ajustements identifiés pour mieux correspondre aux processus terrain.

### Modifications à implémenter

#### Structure des zones
- [ ] **Multi-surfaces par zone** - Ajouter plusieurs surfaces (murs) dans une même zone avec bouton "+"
  - Raison: Une zone hermétique peut contenir plusieurs murs (ex: cuisine en L = plusieurs mesures, mais 1 seule zone)
  - Impact: Évite de multiplier les frais de zone inutilement

- [ ] **Renommer "Longueur x Largeur" → "Longueur x Hauteur"** pour les murs
  - Raison: Plus intuitif pour mesurer des murs (hauteur = plafond typiquement 8')

- [ ] **Photos par surface** - Option photo sur chaque ligne de mesure, pas juste par zone
  - Raison: Permet de documenter précisément chaque mur pour le contrat

- [ ] **Édition des zones existantes** - Permettre de modifier une zone après création
  - Raison: Actuellement impossible, oblige à supprimer et recréer

#### Gestion du risque
- [ ] **Validation/Override du risque** - Afficher le risque calculé ET permettre de le changer manuellement
  - Raison: Gab doit pouvoir ajuster selon son jugement terrain (proche de la limite, etc.)

- [ ] **Propagation risque élevé** - Si UNE zone est risque élevé, TOUT le projet devient risque élevé
  - Raison: Réglementation CSTC - on ne peut pas avoir modéré et élevé dans le même projet
  - Note: Avec possibilité d'override manuel

- [ ] **Corriger seuils de risque**:
  - Friable: risque élevé à partir de **3 pi³** (pas 1 pi³)
  - Non-friable: risque élevé à partir de **10 pi³**

#### Calculs de prix
- [ ] **Prix démolition palier 3** (>1500 pi²): 4.50$ → **3.00$/pi²**
  - Raison: Trop cher pour les gros volumes, tests donnaient ~53k au lieu de ~37k attendu

- [ ] **Disposition matériaux**: 600$/1000 pi² → **400$/1000 pi²**

- [ ] **Transport dynamique**: 75$ fixe → **75$/jour × nombre de jours**
  - Formule: (heures totales ÷ 3 gars ÷ 8h/jour) × 75$
  - Raison: Une job de 2 semaines ne peut pas avoir 75$ de transport total

#### Sommaire (Étape 4)
- [ ] **Tous les prix éditables** - Cliquer sur n'importe quel montant pour le modifier
- [ ] **Marge de profit éditable** - Ajuster le % au moment de la soumission
- [ ] **Frais risque élevé conditionnels** - Ne pas afficher si risque modéré

#### Génération PDF (Phase 2)
- [ ] Générer PDF avec prix final + descriptif selon niveau de risque
- [ ] Inclure photos des zones/surfaces avec mesures
- [ ] Section "Inclus" / "Non inclus" (suggestions modifiables)
- [ ] Joindre contrat, licences, assurances automatiquement
- [ ] **Signature électronique** dans l'app (pour tablette iPad)
- [ ] Pouvoir revenir en arrière et régénérer après modifications

#### UX / Qualité
- [ ] **Bouton "Signaler un bug"** dans l'app
- [ ] Option appareil photo direct + galerie photos sur mobile/tablette
- [ ] Optimisation tablette (iPad)

### En attente (infos requises d'Apex)
- [ ] Liste complète des matériaux corrigée (gyps vs composé à joint, etc.) - **Responsable: Gab**
- [ ] Descriptifs textes par niveau de risque pour le PDF - **Responsable: Gab**

---

## [v1.0] - Complétée
**Date**: Janvier 2025
**Status**: Fonctionnel, en test

### Fonctionnalités livrées

#### Étape 1 - Rapport de caractérisation
- [x] Question "Avez-vous un rapport?" (Oui/Non)
- [x] Upload PDF avec drag-and-drop (desktop) et click (mobile)
- [x] Validation: PDF uniquement, max 25MB
- [x] Note: OCR automatique prévu pour version future

#### Étape 2 - Informations client
- [x] Wizard multi-champs (un champ par écran)
- [x] Nom du client
- [x] Numéro de téléphone
- [x] Adresse courriel
- [x] Adresse du chantier avec autocomplete Mapbox
- [x] Calcul automatique de la distance depuis Apex (GTJ)
- [x] Frais de transport suggérés selon distance (0-50km: 55$, 50-100km: 75$)

#### Étape 3 - Zones de travail
- [x] Création de zones avec nom et photo optionnelle
- [x] Sélection du type de travaux (murs/plafonds, planchers, isolation, etc.)
- [x] Liste de matériaux filtrée par type de travaux
- [x] Dimensions: longueur × largeur × épaisseur
- [x] Calcul automatique du volume (pi³)
- [x] Détermination automatique friable/non-friable selon matériau
- [x] Calcul automatique du niveau de risque (modéré/élevé)
- [x] Affichage des zones en cartes avec photo, surface, matériau, risque
- [x] Suppression de zones
- [x] Lightbox photo avec zoom/pan

#### Étape 4 - Sommaire et prix
- [x] Calcul automatique de tous les coûts:
  - Démolition (paliers: 0-500, 500-1500, 1500+ pi²)
  - Frais de zone (première zone + zones supplémentaires)
  - Frais risque élevé (douches, tests d'air, perte de temps)
  - Transport, disposition, assurance
- [x] Affichage du sous-total
- [x] Marge de profit 20% automatique
- [x] Total final

#### Infrastructure
- [x] Connexion Supabase (auth anonyme, base de données)
- [x] Table `materiaux` avec friabilité et épaisseur par défaut
- [x] Table `config_prix` pour paramètres modifiables
- [x] Page Settings pour modifier les prix
- [x] Auto-sauvegarde localStorage
- [x] Modal de restauration de session
- [x] Mode sombre
- [x] Mode développeur (touches D, Z, 1-5, flèches)
- [x] Responsive: mobile, tablette, desktop

### Décisions techniques v1
- Stack: HTML/CSS/JS vanilla + Tailwind CSS (CDN)
- Pas de framework (React, Vue) pour simplicité
- Supabase pour backend (gratuit, simple)
- Mapbox pour géolocalisation et calcul de distance
- Déploiement: Netlify (drag-and-drop)

---

## Roadmap future

### v3.0 - Modules additionnels (planifié)
- [ ] Module vermiculite (pied carré, plus simple que amiante)
- [ ] Module décontamination entretoit (types de toiture, pente, etc.)
- [ ] Module reconstruction (gypse, tirage joint, peinture, isolation)

### v4.0 - Avancé
- [ ] OCR automatique des rapports de caractérisation
- [ ] Module plomb
- [ ] Historique des soumissions
- [ ] Intégration email

---

## Notes de réunion

### 21 janvier 2025 - Présentation v1
**Participants**: Luca, Gab (Gabriel Maranda), Max (Maxym Roberge), Michael Gauthier

**Points positifs**:
- "Pour un premier jet, c'est très bon" - Max
- Les prix calculés "font du sens" après ajustements
- Rapidité de création d'une soumission impressionnante

**Tests effectués**:
1. Maison complète (sous-sol + rez-de-chaussée, ~5500 pi², plâtre sur latte)
   - Résultat initial: ~53k$ (trop cher)
   - Après ajustements: ~37k$ (correct)

2. Petit mur (10×8, plâtre sur latte)
   - Résultat: ~5k$ en risque élevé
   - Sans frais risque élevé: ~3.5k$ (correct pour risque modéré)

**Citation importante** (Gab):
> "Quand tu tombes en risque élevé dans un projet, automatiquement, tout est en risque élevé, même si c'est dans une autre zone."

**Vision tablette** (Max):
> "T'arrives chez le client, tu prends tes photos avec ta tablette, tac tac, puis paf, tu serais capable d'ouvrir le dossier, il pourrait signer avec son crayon, tu confirmes, tu envoies la copie au client. On the spot, ça prendrait 10 minutes."

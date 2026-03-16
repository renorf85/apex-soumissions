# PLAN SPRINT V2 - 2 heures
**Date**: Février 2025
**Objectif**: Implémenter les corrections prioritaires du feedback équipe (21 jan 2025)

---

## PHASE 1 - Quick Wins (30 min)

### 1.1 Corriger seuil risque friable (1 min)
**Fichier**: `app.js`
**Ligne**: ~1763

```javascript
// AVANT (ligne 1764):
return volume > 1 ? 'ÉLEVÉ' : 'MODÉRÉ';

// APRÈS:
return volume > 3 ? 'ÉLEVÉ' : 'MODÉRÉ';
```

**Aussi mettre à jour le commentaire** (lignes 1758-1760):
```javascript
// CSTC Rules (corrigé selon feedback équipe 21 jan 2025):
// - Friable: > 3 pi³ = ÉLEVÉ
// - Non friable: > 10 pi³ = ÉLEVÉ
```

---

### 1.2 Baisser prix démolition palier 3 (1 min)
**Fichier**: `app.js`
**Ligne**: ~2357

```javascript
// AVANT:
prixDemo += (surfaceTotal - 1500) * (config.prix_demo_palier3 || 4.5);

// APRÈS:
prixDemo += (surfaceTotal - 1500) * (config.prix_demo_palier3 || 3);
```

---

### 1.3 Baisser disposition 600→400$ (1 min)
**Fichier**: `app.js`
**Lignes**: ~2395-2397

```javascript
// AVANT:
let prixDisposition = Math.ceil(surfaceTotal / 1000) * (config.disposition_par_1000pi2 || 600);
prixDisposition = Math.max(prixDisposition, config.disposition_par_1000pi2 || 600);

// APRÈS:
let prixDisposition = Math.ceil(surfaceTotal / 1000) * (config.disposition_par_1000pi2 || 400);
prixDisposition = Math.max(prixDisposition, config.disposition_par_1000pi2 || 400);
```

---

### 1.4 Renommer "Largeur" → "Hauteur" (2 min)
**Fichier**: `index.html`
**Ligne**: ~1170

```html
<!-- AVANT: -->
<label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Largeur</label>

<!-- APRÈS: -->
<label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hauteur</label>
```

---

### 1.5 Transport dynamique (15 min)
**Fichier**: `app.js`
**Lignes**: ~2387-2393

```javascript
// AVANT:
// 4. Transport
let prixTransport = 0;
if (distance <= 50) {
    prixTransport = config.transport_0_50km || 55;
} else {
    prixTransport = config.transport_50_100km || 75;
}

// APRÈS:
// 4. Transport (dynamique selon durée du projet - feedback 21 jan 2025)
// Formule: (heures totales ÷ 3 gars ÷ 8h/jour) × 75$/jour
const tauxHoraireTransport = config.taux_horaire || 92;
const heuresTotalesProjet = prixDemo / tauxHoraireTransport;
const nbJoursProjet = Math.max(1, Math.ceil(heuresTotalesProjet / 3 / 8)); // minimum 1 jour, équipe de 3
const transportParJour = config.transport_50_100km || 75; // 75$/jour comme base
let prixTransport = nbJoursProjet * transportParJour;
```

---

## PHASE 2 - Prix éditables dans le sommaire (45 min)

### 2.1 Rendre les montants éditables (30 min)

**Fichier**: `app.js`
**Fonction**: `renderStep4()` (chercher vers ligne 2440+)

**Concept**: Transformer chaque `<span>` de prix en `<input>` éditable

**Étapes**:
1. Trouver où les prix sont affichés dans le HTML (step 4)
2. Ajouter un `state.prixOverrides = {}` pour stocker les modifications manuelles
3. Créer une fonction `updatePrixManuel(cle, valeur)`:
```javascript
function updatePrixManuel(cle, valeur) {
    state.prixOverrides[cle] = parseFloat(valeur) || 0;
    recalculerTotal();
}

function recalculerTotal() {
    const prix = state.prix;
    const overrides = state.prixOverrides;

    const sousTotal =
        (overrides.zones ?? prix.zones) +
        (overrides.demolition ?? prix.demolition) +
        (overrides.douches ?? prix.douches) +
        (overrides.tests ?? prix.tests) +
        (overrides.perteTemps ?? prix.perteTemps) +
        (overrides.transport ?? prix.transport) +
        (overrides.disposition ?? prix.disposition) +
        (overrides.assurance ?? prix.assurance);

    const margePourcent = state.prixOverrides.margePourcent ?? state.prix.margePourcent;
    const marge = sousTotal * (margePourcent / 100);
    const total = sousTotal + marge;

    // Mettre à jour l'affichage
    document.getElementById('prix-sous-total').textContent = formatMoney(sousTotal);
    document.getElementById('prix-marge').textContent = formatMoney(marge);
    document.getElementById('prix-total').textContent = formatMoney(total);
}
```

4. Pour chaque ligne de prix dans `index.html` (step 4), utiliser des inputs:
```html
<input type="number"
       class="prix-editable w-24 text-right bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500"
       value="1234.00"
       onchange="updatePrixManuel('demolition', this.value)">
```

---

### 2.2 Marge de profit éditable (15 min)

Même principe, mais avec un input spécifique pour le pourcentage:
```html
<input type="number"
       id="marge-pourcent-input"
       class="w-16 text-right"
       value="20"
       min="0" max="100" step="1"
       onchange="updatePrixManuel('margePourcent', this.value)"> %
```

---

## PHASE 3 - Override du risque par zone (30 min)

### 3.1 Ajouter bouton toggle sur les zone cards (20 min)

**Fichier**: `app.js`
**Fonction**: `createZoneCard()` (vers ligne 1589)

**Ajouter dans le HTML de la carte**:
```javascript
// Dans createZoneCard(), ajouter un bouton après le badge de risque:
<button onclick="toggleZoneRisque(${zone.id})"
        class="ml-2 text-xs px-2 py-1 rounded ${zone.risqueOverride ? 'bg-yellow-500' : 'bg-slate-500'} text-white">
    ${zone.risqueOverride ? '↩️ Auto' : '✏️ Modifier'}
</button>
```

**Créer la fonction**:
```javascript
function toggleZoneRisque(zoneId) {
    const zone = state.zones.find(z => z.id === zoneId);
    if (!zone) return;

    if (zone.risqueOverride) {
        // Retour au calcul automatique
        delete zone.risqueOverride;
        zone.risque = determineRisque(zone.volume, zone.friabilite);
    } else {
        // Toggle manuel
        zone.risqueOverride = true;
        zone.risque = zone.risque === 'ÉLEVÉ' ? 'MODÉRÉ' : 'ÉLEVÉ';
    }

    renderZoneCards();
    calculatePrix();
    saveStateToStorage();
}
```

---

### 3.2 Recalculer les prix après modification (10 min)

Déjà géré par `calculatePrix()` qui est appelé dans `toggleZoneRisque()`.

S'assurer que `calculatePrix()` utilise bien `zone.risque` (la valeur actuelle, potentiellement overridée) et pas un recalcul.

**Vérifier dans calculatePrix()** (vers ligne 2320):
```javascript
// Déjà correct si on utilise:
const zonesEleve = zones.filter(z => z.risque === 'ÉLEVÉ');
const zonesModere = zones.filter(z => z.risque === 'MODÉRÉ');
```

---

## PHASE 4 - Édition des zones (si temps restant)

### 4.1 Bouton "Modifier" sur chaque zone card

**Dans `createZoneCard()`**, ajouter:
```javascript
<button onclick="editZone(${zone.id})"
        class="text-blue-500 hover:text-blue-700">
    ✏️ Modifier
</button>
```

**Fonction `editZone()`**:
```javascript
function editZone(zoneId) {
    const zone = state.zones.find(z => z.id === zoneId);
    if (!zone) return;

    // Pré-remplir les champs du wizard step 3
    document.getElementById('zone-nom').value = zone.nom;
    document.getElementById('zone-categorie').value = zone.categorie;
    // ... etc pour tous les champs

    // Stocker l'ID de la zone en édition
    state.editingZoneId = zoneId;

    // Aller au step 3
    goToStep(3);
    goToSubStep('3a');
}
```

**Modifier `addZone()`** pour gérer l'édition:
```javascript
function addZone() {
    // ... validation ...

    if (state.editingZoneId) {
        // Mode édition: mettre à jour la zone existante
        const index = state.zones.findIndex(z => z.id === state.editingZoneId);
        if (index !== -1) {
            state.zones[index] = { ...state.zones[index], ...newZoneData };
        }
        delete state.editingZoneId;
    } else {
        // Mode création: ajouter nouvelle zone
        state.zones.push(newZone);
    }

    // ... reste du code ...
}
```

---

## TESTS À FAIRE

1. **Créer une zone friable de 2 pi³** → doit être MODÉRÉ (pas élevé)
2. **Créer une zone friable de 4 pi³** → doit être ÉLEVÉ
3. **Tester maison complète** (~5500 pi²) → viser ~37k$ pas ~53k$
4. **Modifier un prix** dans le sommaire → total doit se recalculer
5. **Changer le risque** d'une zone → prix doit se recalculer

---

## FICHIERS MODIFIÉS

| Fichier | Lignes approximatives |
|---------|----------------------|
| `app.js` | 1758-1768, 2357, 2395-2397, 2387-2393, 1589+, 2440+ |
| `index.html` | 1170, step 4 section |

---

## CE QU'ON NE FAIT PAS

- Multi-surfaces par zone (trop complexe)
- Photos par surface
- Génération PDF
- Bouton signaler bug
- Signature électronique

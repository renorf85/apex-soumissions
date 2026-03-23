# Phase 4 - Historique des Soumissions et Back-end

## Contexte

L'application Apex Soumissions (`/Users/luca/Documents/Apex/Apex_soumission_APP`) est un outil de calcul statique (HTML/CSS/JS vanilla sur Netlify + Supabase). Les soumissions sont generees comme PDF et telechargees, mais il n'existe aucune "memoire" des projets. Phase 4 transforme l'outil en plateforme de gestion.

**Stack actuel :** HTML/CSS/JS vanilla, Tailwind CSS (CDN), Supabase (PostgreSQL), jsPDF + pdf-lib, deploye sur Netlify (auto-deploy depuis GitHub `main`)

**Tables Supabase existantes :** `materiaux`, `config_prix`, `config_textes`

**Fichiers principaux :**
- `app.js` (6040 lignes) : Formulaire multi-etapes, calculs, state management
- `pdf-generator.js` (1207 lignes) : Generation PDF client + detail
- `settings.js` (963 lignes) : Admin config/textes/materiaux
- `index.html` / `settings.html` : Pages HTML

**Lecon architecturale importante :** Separer clairement la logique metier (services), l'acces aux donnees (repos), et l'interface (UI). Ne pas melanger business logic et code UI. Voir transcription CRM : `/Users/luca/Downloads/02-02 Consultation_ Projet CRM pour Maxime - Problèmes d'architecture et bogues-transcript (2).txt`

**Decisions prises avec l'equipe :**
- Auth par code d'acces partage (pas de comptes individuels)
- Sauvegarde automatique quand le PDF est genere
- Photos sauvegardees avec les soumissions
- Statuts : brouillon, envoyee, acceptee, refusee, completee
- Modifications creent de nouvelles soumissions (jamais ecraser l'original)
- Les 2 PDFs (client + detail) sont stockes dans Supabase Storage

---

## Architecture des fichiers a creer

```
Apex_soumission_APP/
  js/                           (NOUVEAU dossier)
    auth.js                     -- Authentification (code d'acces partage)
    data/
      supabase-client.js        -- Init Supabase partagee
      soumission-repo.js        -- CRUD soumissions (acces BD)
      pdf-storage.js            -- Upload/download PDFs (Supabase Storage)
    services/
      submission-service.js     -- Logique metier (build snapshot, clone, validation)
    ui/
      history-ui.js             -- Interface historique (liste, recherche, filtres)
      toast.js                  -- Notifications toast
```

---

## Schema de base de donnees

### Table `soumissions`

```sql
CREATE TABLE soumissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero VARCHAR(20) NOT NULL,

    -- Infos client (colonnes plates pour recherche rapide)
    client_nom VARCHAR(255) NOT NULL DEFAULT '',
    client_telephone VARCHAR(30) DEFAULT '',
    client_courriel VARCHAR(255) DEFAULT '',
    client_adresse_chantier TEXT DEFAULT '',
    client_nom_projet VARCHAR(500) DEFAULT '',
    client_distance_km NUMERIC(8,2) DEFAULT 0,

    -- Snapshot complet du state (pour recharger dans le formulaire)
    state_snapshot JSONB NOT NULL,

    -- Champs denormalises pour affichage liste et analytique
    surface_totale NUMERIC(12,2) DEFAULT 0,
    nb_zones INTEGER DEFAULT 0,
    risque_global VARCHAR(20),
    prix_sous_total NUMERIC(12,2) DEFAULT 0,
    prix_total NUMERIC(12,2) DEFAULT 0,
    marge_pourcent NUMERIC(5,2) DEFAULT 0,

    -- Snapshot config (prix au moment de la soumission)
    config_snapshot JSONB,

    -- PDFs stockes dans Supabase Storage
    pdf_client_path TEXT,
    pdf_detail_path TEXT,

    -- Statut
    statut VARCHAR(20) DEFAULT 'envoyee',

    -- Lien vers soumission parente (si clone/revision)
    parent_id UUID REFERENCES soumissions(id),

    -- Metadata
    notes_internes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_soumissions_numero ON soumissions(numero);
CREATE INDEX idx_soumissions_client_nom ON soumissions(client_nom);
CREATE INDEX idx_soumissions_created_at ON soumissions(created_at DESC);
CREATE INDEX idx_soumissions_statut ON soumissions(statut);
```

### RLS Policies

```sql
ALTER TABLE soumissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON soumissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_auth" ON soumissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_auth" ON soumissions FOR UPDATE TO authenticated USING (true);
-- Pas de DELETE (records permanents)
```

### Bucket Supabase Storage

```
Bucket: soumissions-pdfs (prive, RLS active)
Policy: authenticated users can read/write
Structure: {numero}_{timestamp}/
    Soumission_{numero}.pdf
    Soumission_{numero}_detail.pdf
```

---

## Objet state existant (reference, app.js lignes 68-113)

```javascript
const state = {
    currentStep: 1,
    hasReport: null,
    rapport: null,
    client: {
        nom: '', telephone: '', courriel: '',
        adresseChantier: '', adresseFacturation: '', villeFacturation: '',
        nomProjet: '', distanceKm: 0, coordinates: null
    },
    zones: [],           // [{id, nom, categorie, materiauId, materiauNom, friabilite, epaisseur, surfaces[], surfaceTotal, volumeTotal, risque, photo}]
    materiaux: [],
    config: {},
    risqueGlobal: null,
    risqueGlobalOverride: null,
    doucheCount: null,
    testAirCount: null,
    ventilateurCount: null,
    transportCount: null,
    customLines: [],      // [{id, description, quantite, prixUnitaire, showInPdf}]
    currentSurfaces: [],
    prix: {
        zones: 0, demolition: 0, ventilateur: 0, douches: 0, tests: 0,
        perteTemps: 0, transport: 0, disposition: 0, assurance: 0,
        sousTotal: 0, marge: 0, total: 0
    },
    inlineEditingZoneId: null,
    inlineEditData: null,
    inlineEditSurfaces: []
};
```

---

# SOUS-PHASE 4.0 : Fondations (auth + BD + structure)

## Objectif
Mettre en place l'infrastructure : table Supabase, bucket Storage, authentification par code d'acces partage, structure de fichiers JS.

## Taches

### 1. Creer la table `soumissions` dans Supabase
- Executer le SQL ci-dessus dans le SQL Editor de Supabase (URL: `https://bmwfipxpbkofjsgdraau.supabase.co`)
- Les credentials Supabase sont dans `/Users/luca/Documents/Apex/Apex_soumission_APP/.env`
- Creer les index et les RLS policies

### 2. Creer le bucket Supabase Storage
- Nom: `soumissions-pdfs`
- Acces: prive
- RLS: authenticated users peuvent read et write
- Policy Storage:
```sql
CREATE POLICY "auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'soumissions-pdfs');
CREATE POLICY "auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'soumissions-pdfs');
```

### 3. Creer un compte utilisateur partage
- Dans Supabase Dashboard > Authentication > Users > Create user
- Email: `equipe@apexdesamiantage.com`
- Mot de passe: a confirmer avec Luca (temporairement `apex2026!` pour dev)
- Ce compte sera utilise par toute l'equipe

### 4. Creer `js/data/supabase-client.js`
```javascript
// Reutilise les constantes deja definies dans app.js (SUPABASE_URL, SUPABASE_ANON_KEY)
// Ce fichier expose une reference partagee au client Supabase
// Note: supabaseClient est deja initialise dans app.js ligne 62
// Les nouveaux modules utilisent window.supabaseClient directement
```
Ce fichier peut etre minimal - l'important est que les nouveaux modules accedent a `supabaseClient` via `window.supabaseClient` (deja global dans app.js).

### 5. Creer `js/auth.js` (~80 lignes)
**Fonctionnalites :**
- `checkSession()` : Verifie si une session Supabase existe
- `showLoginModal()` : Affiche le modal de code d'acces
- `login(code)` : `supabaseClient.auth.signInWithPassword({ email: 'equipe@apexdesamiantage.com', password: code })`
- `logout()` : `supabaseClient.auth.signOut()`
- `initAuth()` : Appelee au chargement, si pas de session -> affiche modal, sinon continue

**Le modal de login :** Champ password + bouton "Entrer". Style Tailwind coherent avec l'app existante. Message d'erreur si mauvais code.

### 6. Modifier `index.html`
- Ajouter le HTML du modal d'authentification (cache par defaut)
- Ajouter les tags `<script>` pour les nouveaux fichiers JS (avant app.js)
- Ajouter un bouton "Historique" dans le header (a cote du titre "Apex Soumissions")
- Ajouter un bouton "Se deconnecter" discret dans le header

### 7. Modifier `app.js`
- Au debut du `DOMContentLoaded`, appeler `initAuth()` et attendre la session avant de charger l'app
- Le reste de l'init existant ne change pas

## Verification
- Ouvrir l'app : le modal de code d'acces apparait
- Entrer le mauvais code : message d'erreur
- Entrer le bon code : l'app charge normalement
- Fermer le navigateur, rouvrir : pas de modal (session persistee)
- Cliquer "Se deconnecter" : retour au modal

---

# SOUS-PHASE 4.1 : Sauvegarde automatique

## Objectif
Quand un PDF est genere/telecharge, la soumission est automatiquement sauvegardee dans Supabase avec les 2 PDFs.

## Taches

### 1. Creer `js/ui/toast.js` (~40 lignes)
- `showToast(message, type)` : Affiche une notification temporaire (succes/erreur)
- Position: bas-droite de l'ecran, disparait apres 4 secondes
- Style: vert pour succes, rouge pour erreur

### 2. Creer `js/data/soumission-repo.js` (~100 lignes)
```javascript
window.SoumissionRepo = {
    async save(data) { /* INSERT into soumissions, .select().single() */ },
    async update(id, updates) { /* UPDATE with updated_at */ },
    async list({ search, statut, limit, offset }) { /* SELECT avec filtres, ORDER BY created_at DESC */ },
    async getById(id) { /* SELECT * WHERE id */ },
    async updateStatut(id, statut) { /* UPDATE statut */ }
};
```

### 3. Creer `js/data/pdf-storage.js` (~60 lignes)
```javascript
window.PdfStorage = {
    async uploadPdf(blob, path) { /* supabaseClient.storage.from('soumissions-pdfs').upload(path, blob) */ },
    async getDownloadUrl(path) { /* supabaseClient.storage.from('soumissions-pdfs').createSignedUrl(path, 3600) */ },
    async uploadBothPdfs(pdfClientBlob, pdfDetailBlob, numero) {
        // Genere les paths: {numero}_{timestamp}/Soumission_{numero}.pdf
        // Upload les 2 fichiers
        // Retourne { clientPath, detailPath }
    }
};
```

### 4. Creer `js/services/submission-service.js` (~200 lignes, debut)
```javascript
window.SubmissionService = {
    buildSoumissionData(state) {
        // Extrait les donnees du state actuel
        // Retourne l'objet pret pour SoumissionRepo.save()
        return {
            numero: state.soumissionNumber || '',
            client_nom: state.client.nom,
            client_telephone: state.client.telephone,
            client_courriel: state.client.courriel,
            client_adresse_chantier: state.client.adresseChantier,
            client_nom_projet: state.client.nomProjet,
            client_distance_km: state.client.distanceKm || 0,
            state_snapshot: this.buildStateSnapshot(state),
            surface_totale: this._calcSurfaceTotale(state.zones),
            nb_zones: state.zones.length,
            risque_global: state.risqueGlobal,
            prix_sous_total: state.prix.sousTotal || 0,
            prix_total: state.prix.total || 0,
            marge_pourcent: state.prix.margePourcent || 0,
            config_snapshot: { ...state.config },
            statut: 'envoyee'
        };
    },

    buildStateSnapshot(state) {
        // Copie complete du state pour pouvoir recharger la soumission
        // Inclut: client, zones (avec photos), prix, customLines, overrides, soumissionNumber, hasReport
        // Exclut: materiaux, config (reference data), currentSurfaces, inlineEdit*
    },

    _calcSurfaceTotale(zones) {
        return zones.reduce((sum, z) => sum + (z.surfaceTotal || 0), 0);
    }
};
```

### 5. Modifier `app.js` : Hook post-PDF
- **Localiser** : La fonction de telechargement ZIP est vers la ligne 5911-5943 (`downloadBlob()`)
- **Localiser** : L'envoi email est vers la ligne 6004 (Supabase Edge Function `send-soumission-email`)
- **Ajouter** apres le telechargement/envoi reussi :
```javascript
// Apres telechargement ou envoi email reussi :
async function saveSubmissionToHistory(pdfClientBlob, pdfDetailBlob) {
    try {
        const data = SubmissionService.buildSoumissionData(state);
        // Upload PDFs
        const paths = await PdfStorage.uploadBothPdfs(pdfClientBlob, pdfDetailBlob, state.soumissionNumber);
        data.pdf_client_path = paths.clientPath;
        data.pdf_detail_path = paths.detailPath;
        // Si en mode edition (revision), ajouter parent_id
        if (state._editingParentId) {
            data.parent_id = state._editingParentId;
        }
        await SoumissionRepo.save(data);
        showToast('Soumission #' + state.soumissionNumber + ' sauvegardee');
    } catch (err) {
        console.error('Erreur sauvegarde:', err);
        showToast('Erreur lors de la sauvegarde', 'error');
    }
}
```
- **Important** : Il faut capturer les blobs PDF avant le telechargement. Dans le code actuel, les blobs sont generes dans pdf-generator.js puis passes a `downloadBlob()`. Il faut les intercepter pour les passer aussi a `saveSubmissionToHistory()`.

## Verification
- Creer une soumission complete (client + zones + calculs)
- Generer le PDF (telechargement ZIP)
- Verifier dans Supabase Dashboard :
  - Table `soumissions` : nouvelle ligne avec toutes les colonnes remplies
  - Storage `soumissions-pdfs` : dossier avec les 2 PDFs
- Verifier le toast de confirmation dans l'app
- Envoyer par email : verifier qu'une soumission est aussi sauvegardee

---

# SOUS-PHASE 4.2 : Historique (lecture seule)

## Objectif
Ajouter un onglet "Historique" qui affiche la liste des soumissions sauvegardees avec recherche, filtres, telechargement PDF et changement de statut.

## Taches

### 1. Creer `js/ui/history-ui.js` (~350 lignes)

**Fonctions principales :**
- `initHistory()` : Setup des event listeners
- `showHistory()` : Affiche la section historique, cache le formulaire multi-etapes
- `hideHistory()` : Cache l'historique, affiche le formulaire
- `loadSubmissions(search, statut)` : Appelle `SoumissionRepo.list()` et render
- `renderSubmissionList(submissions)` : Genere le HTML des cartes
- `renderSubmissionCard(sub)` : Une carte individuelle avec :
  - Numero, nom client, nom projet, date
  - Prix total, nb zones, surface totale, risque global
  - Badge de statut (couleur selon statut)
  - Boutons : Telecharger PDF Client, PDF Detail, Ouvrir, Dupliquer
  - Dropdown changement de statut
- `setupSearch()` : Input avec debounce 300ms, appelle `loadSubmissions()`
- `setupStatusFilter()` : Select qui filtre par statut
- `downloadPdf(path, filename)` : Telecharge un PDF depuis Storage
- `changeStatus(id, newStatut)` : Appelle `SoumissionRepo.updateStatut()`

**Design des cartes :** Style coherent avec l'app existante (Tailwind, couleurs primary, border-card, etc.)

**Couleurs des statuts :**
- brouillon: gris
- envoyee: bleu (primary)
- acceptee: vert
- refusee: rouge
- completee: vert fonce

### 2. Ajouter le HTML dans `index.html`

**Dans le header :** Bouton "Historique" avec icone `history` (Material Symbols)

**Section historique (cachee par defaut) :**
```html
<section id="section-historique" class="hidden max-w-5xl w-full mx-auto p-4">
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Historique des soumissions</h2>
        <button id="btn-new-soumission" class="...">+ Nouvelle soumission</button>
    </div>
    <div class="flex gap-3 mb-4">
        <input type="text" id="historique-search" placeholder="Rechercher par client, numero, projet..." class="flex-1 ...">
        <select id="historique-filtre-statut" class="...">
            <option value="">Tous les statuts</option>
            <option value="envoyee">Envoyees</option>
            <option value="acceptee">Acceptees</option>
            <option value="refusee">Refusees</option>
            <option value="completee">Completees</option>
        </select>
    </div>
    <div id="historique-liste" class="space-y-3">
        <!-- Cartes renderees dynamiquement -->
    </div>
    <div id="historique-empty" class="hidden text-center text-text-muted py-12">
        Aucune soumission trouvee
    </div>
</section>
```

### 3. Navigation entre formulaire et historique
- Cliquer "Historique" -> `showHistory()` (cache `#app-container` ou equivalent, affiche `#section-historique`)
- Cliquer "Nouvelle soumission" ou bouton retour -> `hideHistory()` (inverse)
- Le formulaire multi-etapes reste intact, on ne fait que toggle la visibilite

## Verification
- Avoir au moins 2-3 soumissions sauvegardees (depuis phase 4.1)
- Cliquer "Historique" : la liste s'affiche avec les bonnes donnees
- Taper un nom de client dans la recherche : la liste se filtre
- Selectionner un statut dans le filtre : seules les soumissions de ce statut apparaissent
- Cliquer "Telecharger PDF Client" : le bon PDF se telecharge
- Cliquer "Telecharger PDF Detail" : le bon PDF detail se telecharge
- Changer le statut d'une soumission : le badge se met a jour, recharger la page, le statut est persist
- Cliquer "Nouvelle soumission" : retour au formulaire vide

---

# SOUS-PHASE 4.3 : Ouvrir et Dupliquer

## Objectif
Permettre d'ouvrir une soumission passee pour la modifier (cree une nouvelle version) ou de la dupliquer comme modele.

## Taches

### 1. Ajouter dans `js/services/submission-service.js`

```javascript
// Reconstruit un state a partir du snapshot sauvegarde
restoreStateFromSnapshot(snapshot) {
    return {
        currentStep: 2, // Commencer a l'etape client info
        hasReport: snapshot.hasReport || null,
        rapport: null, // Le fichier rapport n'est pas sauvegarde
        client: { ...snapshot.client },
        zones: snapshot.zones || [],
        risqueGlobal: snapshot.risqueGlobal,
        risqueGlobalOverride: snapshot.risqueGlobalOverride,
        doucheCount: snapshot.doucheCount,
        testAirCount: snapshot.testAirCount,
        ventilateurCount: snapshot.ventilateurCount,
        transportCount: snapshot.transportCount,
        customLines: snapshot.customLines || [],
        prix: snapshot.prix || {},
        soumissionNumber: snapshot.soumissionNumber
    };
},

// Clone complet pour revision (garde tout, lie au parent)
cloneAsRevision(soumission) {
    const restored = this.restoreStateFromSnapshot(soumission.state_snapshot);
    restored._editingParentId = soumission.id;
    restored._editingOriginalNumero = soumission.numero;
    return restored;
},

// Clone comme modele (vide infos client, garde technique)
cloneAsTemplate(soumission) {
    const restored = this.restoreStateFromSnapshot(soumission.state_snapshot);
    restored.client = {
        nom: '', telephone: '', courriel: '',
        adresseChantier: restored.client.adresseChantier, // Garder adresse chantier (souvent meme batiment)
        adresseFacturation: '', villeFacturation: '',
        nomProjet: '', distanceKm: restored.client.distanceKm,
        coordinates: restored.client.coordinates
    };
    restored.soumissionNumber = ''; // Nouveau numero
    return restored;
}
```

### 2. Brancher "Ouvrir" dans history-ui.js
1. Cliquer "Ouvrir" -> `SoumissionRepo.getById(id)`
2. `SubmissionService.cloneAsRevision(soumission)` -> state restaure avec `_editingParentId`
3. Appliquer le state restaure dans l'objet `state` global (app.js)
4. Appeler `applyRestoredStateToUI()` (fonction existante dans app.js, lignes 317-375)
5. Naviguer vers Step 2 (info client)
6. Afficher une banniere en haut : "Revision de la soumission #XXX. Les modifications seront sauvegardees comme nouvelle soumission."
7. Cacher la section historique, afficher le formulaire

### 3. Brancher "Dupliquer" dans history-ui.js
1. Cliquer "Dupliquer" -> `SoumissionRepo.getById(id)`
2. `SubmissionService.cloneAsTemplate(soumission)` -> state avec client vide
3. Appliquer dans state global + UI
4. Naviguer vers Step 2 (formulaire client vide, zones pre-remplies)
5. Pas de banniere (c'est une nouvelle soumission independante)

### 4. Modifier `app.js` : Mode edition
- Ajouter `state._editingParentId` et `state._editingOriginalNumero` (null par defaut)
- Quand `_editingParentId` est set, afficher la banniere de revision
- Bouton "Annuler la revision" dans la banniere -> reset le state, retour a l'historique
- La sauvegarde post-PDF (phase 4.1) utilise deja `state._editingParentId` pour setter `parent_id`

### 5. Exposer les fonctions necessaires depuis app.js
- `applyRestoredStateToUI()` doit etre accessible depuis les modules externes
- Soit l'exposer sur `window` : `window.applyRestoredStateToUI = applyRestoredStateToUI;`
- Soit creer une fonction wrapper dans app.js : `window.loadSubmissionIntoForm(restoredState)`

## Verification
**Test "Ouvrir" :**
- Aller dans Historique, cliquer "Ouvrir" sur une soumission
- Le formulaire se remplit avec les donnees de la soumission
- La banniere "Revision de #XXX" apparait
- Modifier le nom du client
- Generer le PDF
- Verifier dans l'historique : DEUX soumissions existent maintenant (l'originale + la revision)
- La revision a un `parent_id` pointant vers l'originale
- L'originale est intouchee

**Test "Dupliquer" :**
- Aller dans Historique, cliquer "Dupliquer" sur une soumission
- Le formulaire s'ouvre avec les zones pre-remplies
- Les champs client sont vides (sauf adresse chantier et distance)
- Le numero de soumission est vide
- Remplir un nouveau client, generer le PDF
- Verifier : nouvelle soumission independante dans l'historique (pas de parent_id)

**Test retour :**
- Depuis le formulaire en mode revision, cliquer "Annuler"
- Retour a l'historique, le formulaire est vide/reset

---

## Resume des modifications par fichier

| Fichier | Phase | Type | Description |
|---------|-------|------|-------------|
| Supabase Dashboard | 4.0 | Config | Table soumissions + bucket Storage + RLS + compte auth |
| `js/auth.js` | 4.0 | Nouveau | Auth code d'acces partage (~80 lignes) |
| `js/data/supabase-client.js` | 4.0 | Nouveau | Reference Supabase partagee (~15 lignes) |
| `js/ui/toast.js` | 4.1 | Nouveau | Notifications toast (~40 lignes) |
| `js/data/soumission-repo.js` | 4.1 | Nouveau | CRUD soumissions (~100 lignes) |
| `js/data/pdf-storage.js` | 4.1 | Nouveau | Upload/download PDFs Storage (~60 lignes) |
| `js/services/submission-service.js` | 4.1+4.3 | Nouveau | Build/restore/clone soumissions (~200 lignes) |
| `js/ui/history-ui.js` | 4.2+4.3 | Nouveau | Interface historique complete (~350 lignes) |
| `index.html` | 4.0-4.2 | Modifie | + modal auth, + bouton historique, + section historique, + scripts |
| `app.js` | 4.0-4.3 | Modifie | + init auth, + hook sauvegarde post-PDF, + mode edition (~80 lignes) |

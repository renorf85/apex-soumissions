/* =====================================================
   SUBMISSION SERVICE - Logique metier soumissions
   ===================================================== */

window.SubmissionService = {
    buildSoumissionData(state) {
        return {
            numero: state.soumissionNumber || '',
            client_nom: state.client.nom || '',
            client_telephone: state.client.telephone || '',
            client_courriel: state.client.courriel || '',
            client_adresse_chantier: state.client.adresseChantier || '',
            client_nom_projet: state.client.nomProjet || '',
            client_distance_km: state.client.distanceKm || 0,
            state_snapshot: this.buildStateSnapshot(state),
            surface_totale: this._calcSurfaceTotale(state.zones),
            nb_zones: state.zones.length,
            risque_global: state.risqueGlobal || null,
            prix_sous_total: state.prix.sousTotal || 0,
            prix_total: state.prix.total || 0,
            marge_pourcent: state.prix.margePourcent || 0,
            config_snapshot: state.config ? { ...state.config } : {},
            statut: 'envoyee'
        };
    },

    buildStateSnapshot(state) {
        return {
            hasReport: state.hasReport,
            client: { ...state.client },
            zones: state.zones.map(z => ({ ...z })),
            risqueGlobal: state.risqueGlobal,
            risqueGlobalOverride: state.risqueGlobalOverride,
            doucheCount: state.doucheCount,
            testAirCount: state.testAirCount,
            ventilateurCount: state.ventilateurCount,
            transportCount: state.transportCount,
            customLines: state.customLines ? state.customLines.map(l => ({ ...l })) : [],
            prix: { ...state.prix },
            soumissionNumber: state.soumissionNumber
        };
    },

    _calcSurfaceTotale(zones) {
        return zones.reduce((sum, z) => sum + (z.surfaceTotal || 0), 0);
    },

    // Phase 4.3 : Restauration depuis snapshot
    restoreStateFromSnapshot(snapshot) {
        return {
            currentStep: 2,
            hasReport: snapshot.hasReport || null,
            rapport: null,
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

    // Clone pour revision (garde tout, lie au parent)
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
            nom: '',
            telephone: '',
            courriel: '',
            adresseChantier: restored.client.adresseChantier,
            adresseFacturation: '',
            villeFacturation: '',
            nomProjet: '',
            distanceKm: restored.client.distanceKm,
            coordinates: restored.client.coordinates
        };
        restored.soumissionNumber = '';
        return restored;
    }
};

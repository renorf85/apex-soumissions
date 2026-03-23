-- ============================================
-- MIGRATION 001 : Table soumissions
-- Phase 4.0 - Fondations
-- ============================================

-- ========== UP (appliquer) ==========

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

-- RLS
ALTER TABLE soumissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON soumissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_auth" ON soumissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_auth" ON soumissions FOR UPDATE TO authenticated USING (true);
-- Pas de DELETE (records permanents)


-- ========== DOWN (annuler) ==========
-- Pour annuler cette migration, copier-coller ceci dans le SQL Editor :
--
-- DROP POLICY IF EXISTS "update_auth" ON soumissions;
-- DROP POLICY IF EXISTS "insert_auth" ON soumissions;
-- DROP POLICY IF EXISTS "read_all" ON soumissions;
-- DROP TABLE IF EXISTS soumissions;

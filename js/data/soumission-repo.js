/* =====================================================
   SOUMISSION REPO - CRUD soumissions (acces BD)
   ===================================================== */

window.SoumissionRepo = {
    async save(data) {
        const { data: result, error } = await supabaseClient
            .from('soumissions')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return result;
    },

    async update(id, updates) {
        updates.updated_at = new Date().toISOString();
        const { data: result, error } = await supabaseClient
            .from('soumissions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return result;
    },

    async list({ search = '', statut = '', limit = 50, offset = 0 } = {}) {
        let query = supabaseClient
            .from('soumissions')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (statut) {
            query = query.eq('statut', statut);
        }

        if (search) {
            query = query.or(
                `client_nom.ilike.%${search}%,numero.ilike.%${search}%,client_nom_projet.ilike.%${search}%`
            );
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getById(id) {
        const { data, error } = await supabaseClient
            .from('soumissions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async updateStatut(id, statut) {
        return this.update(id, { statut });
    }
};

/* =====================================================
   HISTORY UI - Interface historique des soumissions
   Vue tableau avec panneau de detail lateral
   ===================================================== */

window.HistoryUI = {
    _searchTimeout: null,
    _currentSearch: '',
    _currentStatut: '',
    _sortColumn: 'created_at',
    _sortDirection: 'desc',
    _allSubmissions: [],
    _undoTimeout: null,
    _selectedId: null,

    initHistory() {
        this.setupSearch();
        this.setupStatusFilter();
        this.setupStatButtons();
        this.setupButtons();
        this.setupDetailPanel();
    },

    // =============================================
    // Navigation
    // =============================================

    showHistory() {
        // Reset mode revision si actif
        if (typeof state !== 'undefined' && state._editingParentId) {
            state._editingParentId = null;
            state._editingOriginalNumero = null;
        }
        document.getElementById('revision-banner')?.classList.add('hidden');

        document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
        document.querySelector('main')?.classList.add('hidden');
        document.querySelector('footer')?.classList.add('hidden');

        document.querySelectorAll('header').forEach(h => {
            if (h.id !== 'header-historique') h.classList.add('hidden');
        });

        const container = document.getElementById('historique-container');
        if (container) {
            container.classList.remove('hidden');
            container.classList.add('flex');
        }

        this.loadSubmissions();
    },

    hideHistory() {
        this._closeDetailPanel();

        const container = document.getElementById('historique-container');
        if (container) {
            container.classList.add('hidden');
            container.classList.remove('flex');
        }

        document.querySelector('main')?.classList.remove('hidden');
        document.querySelector('footer')?.classList.remove('hidden');
        document.querySelectorAll('header').forEach(h => {
            if (h.id !== 'header-historique') h.classList.remove('hidden');
        });

        if (typeof goToStep === 'function') {
            goToStep(state.currentStep || 1);
        }
    },

    // =============================================
    // Chargement des donnees
    // =============================================

    async loadSubmissions() {
        const listeEl = document.getElementById('historique-liste');
        const emptyEl = document.getElementById('historique-empty');
        const loadingEl = document.getElementById('historique-loading');
        const statsEl = document.getElementById('historique-stats');
        const toolbarEl = document.getElementById('historique-toolbar');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (emptyEl) emptyEl.classList.add('hidden');
        if (statsEl) statsEl.classList.add('hidden');
        if (toolbarEl) toolbarEl.classList.add('hidden');
        if (listeEl) listeEl.innerHTML = '';

        try {
            const submissions = await SoumissionRepo.list({
                search: this._currentSearch,
                statut: this._currentStatut
            });

            if (loadingEl) loadingEl.classList.add('hidden');

            await this._loadStats();

            if (!submissions.length) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                this._updateCount(0);
                if (toolbarEl) toolbarEl.classList.remove('hidden');
                return;
            }

            this._allSubmissions = submissions;
            const sorted = this._sortSubmissions(submissions);
            this._updateCount(sorted.length);
            if (toolbarEl) toolbarEl.classList.remove('hidden');
            this.renderSubmissionList(sorted);
        } catch (err) {
            console.error('Erreur chargement historique:', err);
            if (loadingEl) loadingEl.classList.add('hidden');
            if (listeEl) listeEl.innerHTML = '<p class="text-center text-red-500 py-8">Erreur lors du chargement</p>';
        }
    },

    async _loadStats() {
        const statsEl = document.getElementById('historique-stats');
        if (!statsEl) return;

        try {
            const allSubs = await SoumissionRepo.list({ limit: 500 });
            const counts = { total: allSubs.length, envoyee: 0, acceptee: 0, refusee: 0, completee: 0 };
            allSubs.forEach(s => {
                if (counts[s.statut] !== undefined) counts[s.statut]++;
            });

            document.getElementById('stat-total').textContent = counts.total;
            document.getElementById('stat-envoyee').textContent = counts.envoyee;
            document.getElementById('stat-acceptee').textContent = counts.acceptee;
            document.getElementById('stat-refusee').textContent = counts.refusee;
            document.getElementById('stat-completee').textContent = counts.completee;

            statsEl.classList.remove('hidden');

            statsEl.querySelectorAll('.stat-filter-btn').forEach(btn => {
                const statut = btn.dataset.statut;
                if (statut === this._currentStatut) {
                    btn.classList.add('ring-2', 'ring-primary/30', 'border-primary/40');
                } else {
                    btn.classList.remove('ring-2', 'ring-primary/30', 'border-primary/40');
                }
            });
        } catch (err) {
            console.error('Erreur chargement stats:', err);
        }
    },

    // =============================================
    // Tri
    // =============================================

    _sortSubmissions(submissions) {
        const sorted = [...submissions];
        const col = this._sortColumn;
        const dir = this._sortDirection === 'asc' ? 1 : -1;

        sorted.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            if (col === 'created_at') {
                return dir * (new Date(valA) - new Date(valB));
            }
            if (col === 'prix_total' || col === 'nb_zones' || col === 'surface_totale') {
                return dir * ((valA || 0) - (valB || 0));
            }
            return dir * (valA || '').localeCompare(valB || '', 'fr');
        });

        return sorted;
    },

    _updateCount(count) {
        const el = document.getElementById('historique-count');
        if (!el) return;
        el.textContent = count + (count <= 1 ? ' soumission' : ' soumissions');
    },

    // =============================================
    // Rendu tableau
    // =============================================

    renderSubmissionList(submissions) {
        const listeEl = document.getElementById('historique-liste');
        if (!listeEl) return;
        listeEl.innerHTML = this._renderTable(submissions);
        this._attachTableListeners();
    },

    _renderTable(submissions) {
        const sortIcon = (col) => {
            if (this._sortColumn !== col) {
                return '<span class="material-symbols-outlined text-[14px] text-slate-300 ml-0.5 align-middle">unfold_more</span>';
            }
            const icon = this._sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
            return '<span class="material-symbols-outlined text-[14px] text-primary ml-0.5 align-middle">' + icon + '</span>';
        };

        const headers = `
            <thead>
                <tr class="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <th class="pl-4 pr-2 py-3 w-10">
                        <input type="checkbox" id="select-all-cb" class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer">
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap" data-sort-col="numero">
                        <span class="inline-flex items-center gap-0.5"># ${sortIcon('numero')}</span>
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap" data-sort-col="client_nom">
                        <span class="inline-flex items-center gap-0.5">Client ${sortIcon('client_nom')}</span>
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap hidden lg:table-cell" data-sort-col="client_nom_projet">
                        <span class="inline-flex items-center gap-0.5">Projet ${sortIcon('client_nom_projet')}</span>
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap" data-sort-col="created_at">
                        <span class="inline-flex items-center gap-0.5">Date ${sortIcon('created_at')}</span>
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap text-right" data-sort-col="prix_total">
                        <span class="inline-flex items-center gap-0.5 justify-end w-full">Montant ${sortIcon('prix_total')}</span>
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap text-center hidden md:table-cell" data-sort-col="nb_zones">
                        <span class="inline-flex items-center gap-0.5 justify-center w-full">Zones ${sortIcon('nb_zones')}</span>
                    </th>
                    <th class="px-3 py-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap text-center hidden lg:table-cell" data-sort-col="surface_totale">
                        <span class="inline-flex items-center gap-0.5 justify-center w-full">Surface ${sortIcon('surface_totale')}</span>
                    </th>
                    <th class="px-3 py-3 whitespace-nowrap">Statut</th>
                    <th class="px-3 py-3 w-20 text-center">Actions</th>
                </tr>
            </thead>`;

        const rows = submissions.map(sub => this._renderTableRow(sub)).join('');

        return `
            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        ${headers}
                        <tbody class="divide-y divide-slate-100">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    _renderTableRow(sub) {
        const date = new Date(sub.created_at).toLocaleDateString('fr-CA', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const prix = sub.prix_total ? this._formatMoney(sub.prix_total) : '-';
        const statutBadge = this._getStatutBadge(sub.statut);
        const isSelected = this._selectedId === sub.id;

        return `
            <tr class="table-row-click group cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50/80'}"
                data-soumission-id="${sub.id}">
                <td class="pl-4 pr-2 py-3" onclick="event.stopPropagation()">
                    <input type="checkbox" class="row-checkbox rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" data-id="${sub.id}">
                </td>
                <td class="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">#${this._escapeHtml(sub.numero || '')}</td>
                <td class="px-3 py-3">
                    <div class="font-medium text-slate-800 truncate max-w-[180px]" title="${this._escapeHtml(sub.client_nom || '')}">${this._escapeHtml(sub.client_nom || 'Sans nom')}</div>
                </td>
                <td class="px-3 py-3 hidden lg:table-cell">
                    <div class="text-slate-500 truncate max-w-[200px]" title="${this._escapeHtml(sub.client_nom_projet || '')}">${this._escapeHtml(sub.client_nom_projet || '-')}</div>
                </td>
                <td class="px-3 py-3 text-slate-600 whitespace-nowrap">${date}</td>
                <td class="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">${prix}</td>
                <td class="px-3 py-3 text-center text-slate-600 hidden md:table-cell">${sub.nb_zones || 0}</td>
                <td class="px-3 py-3 text-center text-slate-600 hidden lg:table-cell">${sub.surface_totale ? Math.round(sub.surface_totale) + ' pi\u00b2' : '-'}</td>
                <td class="px-3 py-3">${statutBadge}</td>
                <td class="px-3 py-3" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-center">
                        <button class="btn-ouvrir w-7 h-7 flex items-center justify-center text-slate-400 rounded-md hover:bg-slate-100 hover:text-primary transition-colors" data-id="${sub.id}" title="Modifier">
                            <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                    </div>
                </td>
            </tr>`;
    },

    // =============================================
    // Listeners tableau
    // =============================================

    _attachTableListeners() {
        // Headers triables
        document.querySelectorAll('[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortColumn === col) {
                    this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortColumn = col;
                    this._sortDirection = (col === 'created_at' || col === 'prix_total' || col === 'surface_totale' || col === 'nb_zones') ? 'desc' : 'asc';
                }
                if (this._allSubmissions.length) {
                    const sorted = this._sortSubmissions(this._allSubmissions);
                    this.renderSubmissionList(sorted);
                }
            });
        });

        // Clic sur une ligne -> ouvre le panneau
        document.querySelectorAll('.table-row-click').forEach(row => {
            row.addEventListener('click', () => {
                this._openDetailPanel(row.dataset.soumissionId);
            });
        });

        // Boutons Modifier (direct, sans passer par le panneau)
        document.querySelectorAll('.btn-ouvrir').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await this._openSubmission(e.currentTarget.dataset.id);
            });
        });

        // Select all checkbox
        document.getElementById('select-all-cb')?.addEventListener('change', (e) => {
            document.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    },

    // =============================================
    // Panneau de detail
    // =============================================

    setupDetailPanel() {
        document.getElementById('detail-close')?.addEventListener('click', () => this._closeDetailPanel());
        document.getElementById('detail-panel-overlay')?.addEventListener('click', () => this._closeDetailPanel());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._selectedId) this._closeDetailPanel();
        });

        document.getElementById('detail-btn-modifier')?.addEventListener('click', () => {
            if (this._selectedId) {
                const id = this._selectedId;
                this._closeDetailPanel();
                this._openSubmission(id);
            }
        });

        document.querySelectorAll('.detail-view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this._switchDetailView(tab.dataset.view);
            });
        });
    },

    _openDetailPanel(id) {
        this._selectedId = id;

        // Highlight la ligne selectionnee
        document.querySelectorAll('.table-row-click').forEach(row => {
            if (row.dataset.soumissionId === id) {
                row.classList.add('bg-primary/5');
                row.classList.remove('hover:bg-slate-50/80');
            } else {
                row.classList.remove('bg-primary/5');
                row.classList.add('hover:bg-slate-50/80');
            }
        });

        const sub = this._allSubmissions.find(s => s.id === id);
        if (!sub) return;

        this._populateDetailPanel(sub);

        const panel = document.getElementById('detail-panel');
        const overlay = document.getElementById('detail-panel-overlay');
        if (overlay) overlay.classList.remove('hidden');
        if (panel) {
            panel.classList.remove('translate-x-full');
            panel.classList.add('translate-x-0');
        }
    },

    _closeDetailPanel() {
        this._selectedId = null;

        const panel = document.getElementById('detail-panel');
        const overlay = document.getElementById('detail-panel-overlay');
        if (panel) {
            panel.classList.add('translate-x-full');
            panel.classList.remove('translate-x-0');
        }
        if (overlay) overlay.classList.add('hidden');

        document.querySelectorAll('.table-row-click').forEach(row => {
            row.classList.remove('bg-primary/5');
            row.classList.add('hover:bg-slate-50/80');
        });
    },

    _populateDetailPanel(sub) {
        // Header
        document.getElementById('detail-numero').textContent = '#' + (sub.numero || '');
        document.getElementById('detail-statut-badge').innerHTML = this._getStatutBadge(sub.statut);

        // Client
        const snap = sub.state_snapshot || {};
        const client = snap.client || {};
        let clientHtml = '';
        clientHtml += '<div class="flex items-center gap-2.5"><span class="material-symbols-outlined text-[16px] text-slate-400">person</span><span class="font-medium text-slate-800">' + this._escapeHtml(sub.client_nom || 'Sans nom') + '</span></div>';
        if (sub.client_nom_projet) {
            clientHtml += '<div class="flex items-center gap-2.5"><span class="material-symbols-outlined text-[16px] text-slate-400">work</span><span class="text-slate-600">' + this._escapeHtml(sub.client_nom_projet) + '</span></div>';
        }
        if (client.telephone) {
            clientHtml += '<div class="flex items-center gap-2.5"><span class="material-symbols-outlined text-[16px] text-slate-400">phone</span><span class="text-slate-600">' + this._escapeHtml(client.telephone) + '</span></div>';
        }
        if (client.courriel) {
            clientHtml += '<div class="flex items-center gap-2.5"><span class="material-symbols-outlined text-[16px] text-slate-400">mail</span><span class="text-slate-600">' + this._escapeHtml(client.courriel) + '</span></div>';
        }
        if (client.adresseChantier) {
            clientHtml += '<div class="flex items-center gap-2.5"><span class="material-symbols-outlined text-[16px] text-slate-400">location_on</span><span class="text-slate-600">' + this._escapeHtml(client.adresseChantier) + '</span></div>';
        }
        document.getElementById('detail-client-info').innerHTML = clientHtml;

        // Metriques
        const date = new Date(sub.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('detail-metrics').innerHTML = `
            <div class="bg-slate-50 rounded-xl p-3 text-center">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Montant total</p>
                <p class="text-xl font-bold text-slate-900 mt-1">${sub.prix_total ? this._formatMoney(sub.prix_total) : '-'}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3 text-center">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Date</p>
                <p class="text-sm font-medium text-slate-800 mt-1">${date}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3 text-center">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Zones</p>
                <p class="text-xl font-bold text-slate-900 mt-1">${sub.nb_zones || 0}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3 text-center">
                <p class="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Surface</p>
                <p class="text-sm font-medium text-slate-800 mt-1">${sub.surface_totale ? Math.round(sub.surface_totale) + ' pi\u00b2' : '-'}</p>
            </div>`;

        // Ventilation des couts
        const prix = snap.prix || {};
        const costLines = [
            { label: 'Zones (travaux)', value: prix.zones },
            { label: 'D\u00e9molition', value: prix.demolition },
            { label: 'Ventilateur(s)', value: prix.ventilateur },
            { label: 'Douche(s)', value: prix.douches },
            { label: 'Tests d\'air', value: prix.tests },
            { label: 'Perte de temps', value: prix.perteTemps },
            { label: 'Transport', value: prix.transport },
            { label: 'Disposition', value: prix.disposition },
            { label: 'Assurance', value: prix.assurance },
        ].filter(l => l.value && l.value > 0);

        // Lignes personnalisees
        const customLines = snap.customLines || [];
        customLines.forEach(cl => {
            if (cl.description && cl.prixUnitaire) {
                costLines.push({ label: cl.description, value: (cl.quantite || 1) * cl.prixUnitaire });
            }
        });

        let costsHtml = '<div class="space-y-1.5">';
        costLines.forEach(l => {
            costsHtml += '<div class="flex justify-between text-sm"><span class="text-slate-600">' + this._escapeHtml(l.label) + '</span><span class="font-medium text-slate-800">' + this._formatMoney(l.value) + '</span></div>';
        });
        if (costLines.length) {
            costsHtml += '<div class="border-t border-slate-200 pt-2 mt-2 flex justify-between"><span class="font-semibold text-slate-700">Sous-total</span><span class="font-bold text-slate-900">' + this._formatMoney(prix.sousTotal || sub.prix_sous_total || 0) + '</span></div>';
            if (prix.marge) {
                costsHtml += '<div class="flex justify-between text-sm"><span class="text-slate-600">Marge (' + (sub.marge_pourcent || 0) + '%)</span><span class="font-medium text-slate-800">' + this._formatMoney(prix.marge) + '</span></div>';
            }
            costsHtml += '<div class="flex justify-between text-base mt-1"><span class="font-bold text-slate-900">Total</span><span class="font-bold text-primary text-lg">' + this._formatMoney(prix.total || sub.prix_total || 0) + '</span></div>';
        } else {
            costsHtml += '<p class="text-sm text-slate-400">Aucune ventilation disponible</p>';
        }
        costsHtml += '</div>';
        document.getElementById('detail-costs').innerHTML = costsHtml;

        // Zones
        const zones = snap.zones || [];
        let zonesHtml = '';
        zones.forEach((z, i) => {
            zonesHtml += `
                <div class="bg-slate-50 rounded-lg p-3">
                    <div class="flex items-center justify-between">
                        <span class="font-medium text-sm text-slate-800">${this._escapeHtml(z.nom || 'Zone ' + (i + 1))}</span>
                        <span class="text-xs text-slate-500">${z.surfaceTotal ? Math.round(z.surfaceTotal) + ' pi\u00b2' : ''}</span>
                    </div>
                    <div class="text-xs text-slate-500 mt-1">
                        ${z.categorie ? this._escapeHtml(z.categorie) : ''}${z.materiauNom ? ' \u00b7 ' + this._escapeHtml(z.materiauNom) : ''}${z.risque ? ' \u00b7 Risque: ' + this._escapeHtml(z.risque) : ''}
                    </div>
                </div>`;
        });
        document.getElementById('detail-zones').innerHTML = zonesHtml || '<p class="text-sm text-slate-400">Aucune zone</p>';

        // Notes
        const notesSection = document.getElementById('detail-notes-section');
        const notesEl = document.getElementById('detail-notes');
        if (sub.notes_internes) {
            notesSection.classList.remove('hidden');
            notesEl.textContent = sub.notes_internes;
        } else {
            notesSection.classList.add('hidden');
        }

        // Store PDF paths for tab switching
        this._currentSub = sub;

        // Download buttons
        let dlHtml = '';
        if (sub.pdf_client_path) {
            dlHtml += `<button class="detail-dl-btn flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-sm" data-path="${this._escapeHtml(sub.pdf_client_path)}" data-numero="${this._escapeHtml(sub.numero || '')}" data-detail="false">
                <span class="material-symbols-outlined text-sm">download</span> Client
            </button>`;
        }
        if (sub.pdf_detail_path) {
            dlHtml += `<button class="detail-dl-btn flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-sm" data-path="${this._escapeHtml(sub.pdf_detail_path)}" data-numero="${this._escapeHtml(sub.numero || '')}" data-detail="true">
                <span class="material-symbols-outlined text-sm">download</span> D\u00e9tail
            </button>`;
        }
        document.getElementById('detail-pdfs').innerHTML = dlHtml;

        document.querySelectorAll('.detail-dl-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.dataset.path;
                const numero = btn.dataset.numero;
                const isDetail = btn.dataset.detail === 'true';
                PdfStorage.downloadPdf(path, 'Soumission_' + numero + (isDetail ? '_detail' : '') + '.pdf');
            });
        });

        // Activate default tab (PDF client if available, otherwise detail, otherwise resume)
        const defaultView = sub.pdf_client_path ? 'pdf-client' : sub.pdf_detail_path ? 'pdf-detail' : 'resume';
        this._switchDetailView(defaultView);
    },

    // =============================================
    // Detail View Tabs
    // =============================================

    _switchDetailView(view) {
        const pdfView = document.getElementById('detail-view-pdf');
        const resumeView = document.getElementById('detail-view-resume');
        const tabs = document.querySelectorAll('.detail-view-tab');

        tabs.forEach(tab => {
            const isActive = tab.dataset.view === view;
            tab.classList.toggle('border-primary', isActive);
            tab.classList.toggle('text-primary', isActive);
            tab.classList.toggle('border-transparent', !isActive);
            tab.classList.toggle('text-slate-500', !isActive);
        });

        if (view === 'resume') {
            pdfView.classList.add('hidden');
            resumeView.classList.remove('hidden');
        } else {
            resumeView.classList.add('hidden');
            pdfView.classList.remove('hidden');

            const sub = this._currentSub;
            const path = view === 'pdf-client' ? sub?.pdf_client_path : sub?.pdf_detail_path;
            if (path) {
                this._loadPdfPreview(path);
            } else {
                document.getElementById('detail-pdf-loading').innerHTML = '<span class="material-symbols-outlined text-slate-300 mr-2">picture_as_pdf</span> Aucun PDF disponible';
                document.getElementById('detail-pdf-loading').style.display = 'flex';
                document.getElementById('detail-pdf-iframe').style.display = 'none';
            }
        }
    },

    _isIosOrMobile() {
        const ua = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },

    async _loadPdfPreview(path) {
        const iframe = document.getElementById('detail-pdf-iframe');
        const loadingEl = document.getElementById('detail-pdf-loading');

        iframe.style.display = 'none';
        loadingEl.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Chargement du PDF...';
        loadingEl.style.display = 'flex';

        try {
            const url = await PdfStorage.getDownloadUrl(path);

            if (this._isIosOrMobile()) {
                loadingEl.innerHTML = `
                    <a href="${url}" target="_blank" rel="noopener" class="flex flex-col items-center gap-3 text-primary no-underline">
                        <span class="material-symbols-outlined text-4xl">picture_as_pdf</span>
                        <span class="text-sm font-medium">Ouvrir le PDF</span>
                    </a>`;
            } else {
                iframe.src = url;
                iframe.onload = () => {
                    loadingEl.style.display = 'none';
                    iframe.style.display = 'block';
                };
            }
        } catch (err) {
            loadingEl.innerHTML = '<span class="material-symbols-outlined text-red-400 mr-2">error</span> Impossible de charger le PDF';
        }
    },

    // =============================================
    // Actions soumission
    // =============================================

    async _openSubmission(id) {
        try {
            const soumission = await SoumissionRepo.getById(id);
            const restoredState = SubmissionService.cloneAsRevision(soumission);
            window.loadSubmissionIntoForm(restoredState, true);
            this.hideHistory();
        } catch (err) {
            console.error('Erreur ouverture soumission:', err);
            showToast('Erreur lors de l\'ouverture', 'error');
        }
    },


    // =============================================
    // Setup event listeners
    // =============================================

    setupSearch() {
        const input = document.getElementById('historique-search');
        if (!input) return;

        input.addEventListener('input', () => {
            clearTimeout(this._searchTimeout);
            this._searchTimeout = setTimeout(() => {
                this._currentSearch = input.value.trim();
                this.loadSubmissions();
            }, 300);
        });
    },

    setupStatusFilter() {
        const select = document.getElementById('historique-filtre-statut');
        if (!select) return;

        select.addEventListener('change', () => {
            this._currentStatut = select.value;
            this.loadSubmissions();
        });
    },

    setupStatButtons() {
        document.querySelectorAll('.stat-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const statut = btn.dataset.statut;
                if (this._currentStatut === statut) {
                    this._currentStatut = '';
                } else {
                    this._currentStatut = statut;
                }
                const select = document.getElementById('historique-filtre-statut');
                if (select) select.value = this._currentStatut;
                this.loadSubmissions();
            });
        });
    },

    setupButtons() {
        document.getElementById('btn-historique-desktop')?.addEventListener('click', () => this.showHistory());
        document.getElementById('btn-historique-mobile')?.addEventListener('click', () => this.showHistory());

        document.getElementById('btn-new-from-history')?.addEventListener('click', () => {
            if (typeof clearSavedState === 'function') clearSavedState();
            if (typeof resetAllState === 'function') resetAllState();
            this.hideHistory();
        });

        document.getElementById('btn-back-history')?.addEventListener('click', () => this.hideHistory());
    },

    // =============================================
    // Helpers
    // =============================================

    _getStatutBadge(statut) {
        const config = {
            brouillon: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Brouillon' },
            envoyee: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Envoy\u00e9e' },
            acceptee: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Accept\u00e9e' },
            refusee: { bg: 'bg-red-100', text: 'text-red-700', label: 'Refus\u00e9e' },
            completee: { bg: 'bg-green-100', text: 'text-green-800', label: 'Compl\u00e9t\u00e9e' }
        };
        const c = config[statut] || config.envoyee;
        return '<span class="text-xs font-semibold px-2.5 py-1 rounded-full ' + c.bg + ' ' + c.text + '">' + c.label + '</span>';
    },

    _formatMoney(amount) {
        return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(amount);
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

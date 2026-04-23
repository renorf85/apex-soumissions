/* =====================================================
   MODAL - Dialogues de confirmation et alertes custom
   ===================================================== */

window.apexModal = {
    _create(options) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" data-overlay></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm transform scale-95 opacity-0 transition-all duration-200" data-panel>
                <div class="p-6">
                    <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${options.iconBg || 'bg-blue-50'}">
                            <span class="material-symbols-outlined text-xl ${options.iconColor || 'text-blue-600'}">${options.icon || 'info'}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-base font-semibold text-slate-900">${options.title || ''}</h3>
                            <p class="mt-1 text-sm text-slate-500">${options.message}</p>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 px-6 pb-5 ${options.showCancel ? 'justify-end' : 'justify-end'}">
                    ${options.showCancel ? `<button data-action="cancel" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>` : ''}
                    <button data-action="confirm" class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${options.confirmClass || 'bg-[#1E73BE] hover:bg-[#1a65a8]'}">${options.confirmText || 'OK'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const panel = overlay.querySelector('[data-panel]');
        requestAnimationFrame(() => {
            panel.classList.remove('scale-95', 'opacity-0');
            panel.classList.add('scale-100', 'opacity-100');
        });

        return { overlay, panel };
    },

    _close(overlay) {
        const panel = overlay.querySelector('[data-panel]');
        panel.classList.remove('scale-100', 'opacity-100');
        panel.classList.add('scale-95', 'opacity-0');
        setTimeout(() => overlay.remove(), 150);
    },

    alert(message, options = {}) {
        return new Promise((resolve) => {
            const { overlay } = this._create({
                title: options.title || 'Information',
                message,
                icon: options.icon || 'info',
                iconBg: options.iconBg || 'bg-blue-50',
                iconColor: options.iconColor || 'text-blue-600',
                confirmText: 'OK',
                showCancel: false,
                ...options
            });

            overlay.addEventListener('click', (e) => {
                if (e.target.closest('[data-action="confirm"]')) {
                    this._close(overlay);
                    resolve();
                }
            });
        });
    },

    error(message, options = {}) {
        return this.alert(message, {
            title: options.title || 'Erreur',
            icon: 'error',
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            ...options
        });
    },

    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const { overlay } = this._create({
                title: options.title || 'Confirmation',
                message,
                icon: options.icon || 'help_outline',
                iconBg: options.iconBg || 'bg-amber-50',
                iconColor: options.iconColor || 'text-amber-600',
                confirmText: options.confirmText || 'Confirmer',
                confirmClass: options.confirmClass || 'bg-[#1E73BE] hover:bg-[#1a65a8]',
                showCancel: true,
                ...options
            });

            overlay.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'confirm') {
                    this._close(overlay);
                    resolve(true);
                } else if (action === 'cancel' || e.target.hasAttribute('data-overlay')) {
                    this._close(overlay);
                    resolve(false);
                }
            });
        });
    },

    confirmDanger(message, options = {}) {
        return this.confirm(message, {
            title: options.title || 'Supprimer',
            icon: 'delete',
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            confirmText: options.confirmText || 'Supprimer',
            confirmClass: 'bg-red-600 hover:bg-red-700',
            ...options
        });
    }
};

/* =====================================================
   AUTH - Authentification par code d'acces partage
   ===================================================== */

const AUTH_EMAIL = 'equipe@apexdesamiantage.com';

window.Auth = {
    async checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session;
    },

    async login(code) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: AUTH_EMAIL,
            password: code
        });
        if (error) throw error;
        return data;
    },

    async logout() {
        await supabaseClient.auth.signOut();
        this.showLoginModal();
    },

    showLoginModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.remove('hidden');

        const appContainer = document.querySelector('main');
        if (appContainer) appContainer.classList.add('hidden');

        const headers = document.querySelectorAll('header');
        headers.forEach(h => h.classList.add('hidden'));

        const footer = document.querySelector('footer');
        if (footer) footer.classList.add('hidden');
    },

    hideLoginModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');

        const appContainer = document.querySelector('main');
        if (appContainer) appContainer.classList.remove('hidden');

        const headers = document.querySelectorAll('header');
        headers.forEach(h => h.classList.remove('hidden'));

        const footer = document.querySelector('footer');
        if (footer) footer.classList.remove('hidden');
    },

    setupLoginForm() {
        const form = document.getElementById('auth-form');
        const input = document.getElementById('auth-code-input');
        const errorEl = document.getElementById('auth-error');
        const btn = document.getElementById('auth-submit-btn');

        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = input?.value?.trim();
            if (!code) return;

            btn.disabled = true;
            btn.textContent = 'Connexion...';
            if (errorEl) errorEl.classList.add('hidden');

            try {
                await this.login(code);
                this.hideLoginModal();
                if (input) input.value = '';
            } catch (err) {
                console.error('Erreur login:', err);
                if (errorEl) {
                    errorEl.textContent = 'Code incorrect. Veuillez reessayer.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                btn.disabled = false;
                btn.textContent = 'Entrer';
            }
        });
    },

    setupLogoutButton() {
        const btnLogout = document.getElementById('btn-logout');
        const btnLogoutMobile = document.getElementById('btn-logout-mobile');

        const handleLogout = () => {
            this.logout();
        };

        btnLogout?.addEventListener('click', handleLogout);
        btnLogoutMobile?.addEventListener('click', handleLogout);
    },

    async initAuth() {
        this.setupLoginForm();
        this.setupLogoutButton();

        const session = await this.checkSession();
        if (!session) {
            this.showLoginModal();
            return false;
        }
        return true;
    }
};

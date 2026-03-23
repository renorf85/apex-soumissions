/* =====================================================
   TOAST - Notifications temporaires
   ===================================================== */

window.showToast = function(message, type = 'success') {
    const existing = document.querySelectorAll('.apex-toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'apex-toast fixed bottom-6 right-6 z-[300] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all duration-300';

    if (type === 'error') {
        toast.classList.add('bg-red-600', 'text-white');
        toast.innerHTML = '<span class="material-symbols-outlined text-lg">error</span>' + escapeHtml(message);
    } else {
        toast.classList.add('bg-emerald-600', 'text-white');
        toast.innerHTML = '<span class="material-symbols-outlined text-lg">check_circle</span>' + escapeHtml(message);
    }

    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simple Bootstrap Toast helper
// Usage: import { showToast } from '/js/toast.js'; showToast('Message', { variant: 'danger' });

export function showToast(message, { title = 'Notice', variant = 'primary', delay = 5000 } = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.className = `toast align-items-center text-bg-${variant} border-0`;
  wrapper.setAttribute('role', 'alert');
  wrapper.setAttribute('aria-live', 'assertive');
  wrapper.setAttribute('aria-atomic', 'true');

  wrapper.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <strong class="me-2">${title}</strong>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(wrapper);
  if (window.bootstrap && bootstrap.Toast) {
    const toast = new bootstrap.Toast(wrapper, { delay });
    toast.show();
    // Auto-remove from DOM after hidden
    wrapper.addEventListener('hidden.bs.toast', () => wrapper.remove());
  }
}

(() => {
  const form = document.querySelector('form[name="demo-request"]');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('demo-status');
  let pending = false;
  let accepted = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || accepted || !form.reportValidity()) return;
    // Whitespace alone is not a usable name, dealership or region.
    for (const input of form.querySelectorAll('input[required]')) {
      input.value = input.value.trim();
    }
    if (!form.reportValidity()) return;
    pending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.dataset.state = 'pending';
    status.textContent = 'Sending your demo request…';
    try {
      const response = await fetch('/request-demo.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      });
      // Netlify returns 200 for an accepted AJAX submission. Redirected HTML,
      // errors and other statuses cannot stand in for that acknowledgement.
      if (response.status !== 200 || response.redirected) throw new Error('Not accepted');
      accepted = true;
      status.dataset.state = 'success';
      status.textContent = 'Thank you. Dave will contact you directly to arrange your ScanApp demo.';
      form.querySelectorAll('input, select').forEach(input => { input.disabled = true; });
      button.textContent = 'REQUEST RECEIVED';
      status.focus();
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'demo_request', {
            send_to: 'G-S8TZXDFMCD', transport_type: 'beacon',
            form_name: 'demo-request', page_path: window.location.pathname
          });
        }
      } catch (_) { /* Analytics cannot change the submission result. */ }
    } catch (_) {
      status.dataset.state = 'error';
      status.textContent = 'We couldn’t confirm your request. Please try again, or call or text Dave at 613.282.3283.';
      status.focus();
    } finally {
      pending = false;
      button.disabled = accepted;
      form.removeAttribute('aria-busy');
    }
  });
})();

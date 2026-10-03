/* Page-specific behavior.  Shared navigation and footer still come from site.js. */
(() => {
  'use strict';
  const brand = document.querySelector('[data-site-header] .brand img');
  if (brand) brand.src = 'graphics/SCANAPP_RED%26WHITE.png';
  const email = ['info', 'powersystemsinc.ca'].join('@');
  document.querySelectorAll('[data-demo-link]').forEach(link => {
    link.href = 'mail' + 'to:' + email + '?subject=' + encodeURIComponent('ScanApp Demo Request');
  });
  const menu = document.querySelector('[data-site-header] .menu');
  const navigation = document.querySelector('[data-site-header] nav');
  if (menu && navigation) {
    navigation.id = 'contact-navigation';
    menu.setAttribute('aria-controls', navigation.id);
    menu.setAttribute('type', 'button');
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && navigation.classList.contains('open')) {
        navigation.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
        menu.focus();
      }
    });
  }
})();

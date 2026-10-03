/* Contact behavior only. Shared header, navigation and footer are owned by site.js. */
(() => {
  'use strict';
  const email = ['info', 'powersystemsinc.ca'].join('@');
  document.querySelectorAll('[data-demo-link]').forEach(link => {
    link.href = 'mail' + 'to:' + email + '?subject=' + encodeURIComponent('ScanApp Demo Request');
  });
})();

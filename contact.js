/* Contact behavior only. Shared header, navigation and footer are owned by site.js. */
(() => {
  'use strict';
  document.querySelectorAll('[data-demo-link]').forEach(link => {
    link.href = 'request-demo.html';
  });
})();

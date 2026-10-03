const headerHTML=`<header><a class="brand" href="index.html"><img src="graphics/SCANAPP_COLOR.png" alt="ScanApp"></a><button class="menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-navigation">☰</button><nav id="site-navigation"><a href="index.html">About</a><div class="drop"><a href="features.html">Features</a><div class="dropmenu"><a href="receiving.html">Receiving</a><a href="invoicing.html">Invoicing</a><a href="lpo.html">LPO Management</a></div></div><a href="results.html">Results</a><a href="howtos.html">How-Tos</a><a href="contact.html">Contact</a></nav></header>`;
const footerHTML=`<footer class="footer"><img src="graphics/POWER%20SYSTEMS%20LOGO_WHITE.png" alt="Power Systems Inc."><div>ScanApp · Power Systems Inc. · Ottawa, Canada · Call or Text: <a href="tel:+16132823283">613.282.3283</a> · <span data-email></span></div></footer>`;
document.querySelectorAll('[data-site-header]').forEach(el=>el.innerHTML=headerHTML);
document.querySelectorAll('[data-site-footer]').forEach(el=>el.innerHTML=footerHTML);
// One shared menu implementation for every page, including Contact.
const btn = document.querySelector('[data-site-header] .menu');
const navigation = document.querySelector('[data-site-header] nav');
if (btn && navigation) {
  btn.addEventListener('click', () => {
    navigation.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(navigation.classList.contains('open')));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('open')) {
      navigation.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
}
const ep=['info','powersystemsinc.ca'];document.querySelectorAll('[data-email]').forEach(el=>{const a=document.createElement('a');a.href='mail'+'to:'+ep[0]+'@'+ep[1];a.textContent=ep[0]+'@'+ep[1];el.replaceWith(a);});

// Match both .html pages and Netlify clean URLs; the root is the About page.
function updateActiveNavigation(pathname) {
  const pageKey = path => path.replace(/\/+$/, '').split('/').pop().replace(/\.html$/i, '').toLowerCase() || 'index';
  const links = Array.from(document.querySelectorAll('[data-site-header] nav a[href]'));
  const currentPage = pageKey(pathname);

  links.forEach(link => {
    link.classList.remove('is-active');
    link.removeAttribute('aria-current');
  });

  const currentLink = links.find(link =>
    pageKey(new URL(link.getAttribute('href'), document.baseURI).pathname) === currentPage
  );
  if (!currentLink) return;

  currentLink.classList.add('is-active');
  currentLink.setAttribute('aria-current', 'page');

  // Feature detail pages also underline Features, without marking it as the page.
  const dropdown = currentLink.closest('.dropmenu');
  if (dropdown) {
    const sectionLink = dropdown.parentElement.querySelector(':scope > a');
    if (sectionLink) sectionLink.classList.add('is-active');
  }
}
updateActiveNavigation(window.location.pathname);

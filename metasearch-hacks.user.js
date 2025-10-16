// ==UserScript==
// @name Hacks for the cute metasearch engine https://github.com/mat-1/metasearch2
// @version 0.3
// @downloadURL https://userscripts.codonaft.com/metasearch-hacks.user.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title !== 'metasearch') return;

const REDIRECT_ON_FAILURE = true;
const FIX_IMAGES = true;

const body = document.body;
const params = new URLSearchParams(window.location.search);
if (!body) return;

const q = params.get('q');
const images = body.querySelectorAll('div.image-result');
if (REDIRECT_ON_FAILURE && q && images.length === 0 && !body.querySelector('div.search-result')) {
  const categories = params.get('tab') === 'images' ? 'images' : 'general';
  const newParams = new URLSearchParams({ q, categories });
  window.location.replace(`https://codonaft.com/searxng#${newParams}`);
}

if (FIX_IMAGES) {
  const HIDE = '__hide';
  try {
    const style = document.createElement('style');
    style.innerHTML = `.${HIDE} { display: none !important }`;
    body.appendChild(style);
  } catch (e) {
    console.error(e);
  }

  images.forEach(i => {
    const link = i.querySelector('a.image-result-anchor');
    const image = link?.querySelector('div.image-result-img-container img');
    const proxyHref = image?.src;
    if (!proxyHref) return;
    link.href = proxyHref;
    if (image.complete && image.naturalWidth === 0) {
      link.closest('div.image-result')?.classList.add(HIDE);
    }
  });
}
})();

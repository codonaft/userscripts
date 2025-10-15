// ==UserScript==
// @name Hacks for the cute metasearch engine https://github.com/mat-1/metasearch2
// @version 0.1
// @downloadURL https://userscripts.codonaft.com/metasearch-hacks.user.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title !== 'metasearch') return;

const DISABLE_AUTOCOMPLETE = true;
const REDIRECT_ON_FAILURE = true;
const FIX_IMAGES = true;

const body = document.body;
const params = new URLSearchParams(window.location.search);
const q = params.get('q');
if (!body || !q) return;

if (DISABLE_AUTOCOMPLETE) {
  const input = body.querySelector('input#search-input');
  ['click', 'input'].forEach(i => {
    input?.addEventListener(i, event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });
}

const images = body.querySelectorAll('div.image-result');
if (REDIRECT_ON_FAILURE && !body.querySelector('div.search-result') && images.length === 0) {
  const categories = params.get('tab') === 'images' ? 'images' : 'general';
  const newParams = new URLSearchParams({ q, categories });
  window.location.replace(`https://codonaft.com/searxng#${params}`);
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
      link.classList.add(HIDE);
    }
  });
}
})();

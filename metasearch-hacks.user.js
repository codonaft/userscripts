// ==UserScript==
// @name Hacks for the cute metasearch engine https://github.com/mat-1/metasearch2
// @version 0.7
// @downloadURL https://userscripts.codonaft.com/metasearch-hacks.user.js
// @grant GM_addStyle
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (document.head?.querySelector('link[type="application/opensearchdescription+xml"]')?.title !== 'metasearch') return;

const FIX_IMAGES = true;
const REDIRECT_ON_FAILURE = true;
const SEARXNG_BUTTON = true;

const body = document.body;
const params = new URLSearchParams(window.location.search);
if (!body) return;

const redirectToSearxng = q => {
  const categories = params.get('tab') === 'images' ? 'images' : 'general';
  const newParams = new URLSearchParams({ q, categories });
  window.location.replace(`https://codonaft.com/searxng#${newParams}`);
};

const q = params.get('q');
const imageResults = body.querySelectorAll('div.image-result');
if (REDIRECT_ON_FAILURE && q && imageResults.length === 0 && !body.querySelector('div.search-result')) {
  redirectToSearxng(q);
}

const DARK = '__dark';
const HIDE = '__hide';
const LARGE = '__large';
GM_addStyle(`
  .${DARK} {
    display: block !important;
    opacity: 0.18;
  }
  .${HIDE} { display: none !important }
  .${LARGE} {
    height: 30rem !important;
    object-fit: contain !important;
  }
`);

if (SEARXNG_BUTTON) {
  const redirectButton = document.createElement('input');
  redirectButton.type = 'submit';
  redirectButton.value = 'SearXNG';
  body.querySelector('form.search-form')?.appendChild(redirectButton);

  const progressUpdates = body.querySelector('div.progress-updates');
  redirectButton?.addEventListener('mouseenter', _ => progressUpdates?.classList.add(DARK));
  redirectButton?.addEventListener('mouseleave', _ => progressUpdates?.classList.remove(DARK));
  redirectButton?.addEventListener('click', event => {
    event.preventDefault();
    redirectToSearxng(body.querySelector('input#search-input')?.value || q);
  }, true);
}

if (FIX_IMAGES) {
  let scrollX;
  let scrollY;
  let largeImage;
  imageResults.forEach(i => {
    const link = i.querySelector('a.image-result-anchor');
    const image = link?.querySelector('div.image-result-img-container img');
    image?.addEventListener('error', _ => i.closest('div.image-result')?.classList.add(HIDE));

    const proxyHref = image?.src;
    if (!proxyHref || !image) return;
    link.href = proxyHref;
    link.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      largeImage?.classList?.remove(LARGE);
      if (largeImage === image) {
        largeImage = undefined;
        if (typeof scrollX === 'number') {
          window.scrollTo(scrollX, scrollY);
        }
      } else {
        scrollX = window.scrollX;
        scrollY = window.scrollY;
        image.classList?.add(LARGE);
        link.scrollIntoView();
        largeImage = image;
      }
    }, true);

    if (image.complete && image.naturalWidth === 0) {
      link.closest('div.image-result')?.classList.add(HIDE);
    }
  });
}
})();

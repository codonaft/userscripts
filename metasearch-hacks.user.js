// ==UserScript==
// @name Hacks for the cute metasearch engine https://github.com/mat-1/metasearch2
// @version 0.4
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
const imageResults = body.querySelectorAll('div.image-result');
if (REDIRECT_ON_FAILURE && q && imageResults.length === 0 && !body.querySelector('div.search-result')) {
  const categories = params.get('tab') === 'images' ? 'images' : 'general';
  const newParams = new URLSearchParams({ q, categories });
  window.location.replace(`https://codonaft.com/searxng#${newParams}`);
}

if (FIX_IMAGES) {
  const HIDE = '__hide';
  const LARGE = '__large';
  try {
    const style = document.createElement('style');
    style.innerHTML = `
      .${HIDE} { display: none !important }
      .${LARGE} {
        height: 30rem !important;
        object-fit: contain !important;
      }
    `;
    body.appendChild(style);
  } catch (e) {
    console.error(e);
  }

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
      if (largeImage == image) {
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

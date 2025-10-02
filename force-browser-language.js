// ==UserScript==
// @name Force Browser Language
// @version 0.6
// @downloadURL https://userscripts.codonaft.com/force-browser-language.js
// @match https://*.google.com/*
// ==/UserScript==

(_ => {
  'use strict';

   const first = lang => lang.split('-')[0]
   const lang = navigator.language || 'en';
   const url = new URL(window.location.href);
   if (!url.searchParams.has('hl') || first(url.searchParams.get('hl')) !== first(lang)) {
     window.stop();
     url.searchParams.set('hl', lang);
     window.location.replace(url.toString());
   }
})()

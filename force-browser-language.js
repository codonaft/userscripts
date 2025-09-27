// ==UserScript==
// @name Force Browser Language
// @version 0.4
// @downloadURL https://userscripts.codonaft.com/force-browser-language.js
// @match https://*.google.com/*
// ==/UserScript==

(() => {
  'use strict';

   const lang = navigator.language || 'en';
   const url = new URL(window.location.href);
   if (url.searchParams.get('hl') !== lang.split('-')[0]) {
     window.stop();
     url.searchParams.set('hl', lang);
     window.location.replace(url.toString());
   }
})()

// ==UserScript==
// @name Force Browser Language
// @version 0.2
// @downloadURL https://userscripts.codonaft.com/force-browser-language.js
// @match https://*.google.com/*
// ==/UserScript==

(() => {
  'use strict';

   const lang = navigator.language || 'en';
   const url = new URL(window.location.href);
   if (url.searchParams.get('hl') !== lang) {
     window.stop();
     url.searchParams.set('hl', lang);
     window.location.href = url.toString();
   }
})()

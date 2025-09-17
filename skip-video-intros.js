// ==UserScript==
// @name Skip Video Intros
// @match https://www.pornhub.com/view_video.php*
// ==/UserScript==

(function() {
  'use strict';

   function random() {
     const min = 240;
     const max = 400;
     return Math.floor(Math.random() * (max - min + 1)) + min;
   }

   const url = new URL(window.location.href);
   const params = url.searchParams;
   if (!params.has('t')) {
     window.stop();
     params.set('t', random());
     window.location.href = url.toString();
   }
})()

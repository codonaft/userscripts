// ==UserScript==
// @name Skip Video Intros
// @version 0.5
// @downloadURL https://userscripts.codonaft.com/skip-video-intros.js
// @match https://www.pornhub.com/view_video.php*
// ==/UserScript==

(() => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const url = new URL(window.location.href);
  const params = url.searchParams;

  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const timeToSeconds = time => time?.split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

  const redirect = (min, max) => {
    window.stop();
    params.set('t', random(Math.floor(min), Math.floor(max)));
    window.location.replace(url.toString());
  };

  if (params.has('t')) {
    setTimeout(
      () => {
        const duration = timeToSeconds(document.querySelector('span.mgp_total')?.innerText);
        if (duration) {
          if (Number(params.get('t')) >= duration) {
            redirect(duration / 4, duration / 2);
          }
        } else {
          window.location.replace(url.toString());
        }
      },
      random(2500, 3000))
  } else {
    redirect(120, 200);
  }
})()

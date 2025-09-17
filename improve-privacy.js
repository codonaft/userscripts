// ==UserScript==
// @name Improve Privacy
// ==/UserScript==

(function() {
  "use strict";

  setInterval(function() {
    document.querySelectorAll('span.style-scope.ytd-topbar-logo-renderer').forEach(i => i.style.display = 'none');

    document.querySelectorAll('a').forEach(i => {
      if (i.href.startsWith('https://www.youtube.com/watch?') || i.href.startsWith('https://youtu.be/')) {
        const url = new URL(i.href);
        [...url.searchParams.keys()]
          .filter(k => k !== 'v')
          .forEach(k => url.searchParams.delete(k));
        i.href = url.toString();
      }
    });
  }, 1000);
})();

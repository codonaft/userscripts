// ==UserScript==
// @name Clean Jitsi in Tile Mode for Podcasting
// @icon https://external-content.duckduckgo.com/ip3/jitsi.org.ico
// @version 0.15
// @downloadURL https://userscripts.codonaft.com/jitsi-podcaster.user.js
// @require https://userscripts.codonaft.com/utils.js
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (!document.head?.querySelector('meta[itemprop="name"][content="Jitsi Meet"]')) return;
const b = document.body;
if (!b) return;

const hiddenNodes = 'a.watermark.leftwatermark[href="https://jitsi.org"], div.audioindicator-container, div.bottom-indicators, div.details-container';
const someHiddenNodes = 'span.videocontainer';

const hide = node => node.style.display = 'none';

subscribeOnChanges(b, `${hiddenNodes}, ${someHiddenNodes}`, (node, _observer) => {
  if (node.matches(hiddenNodes)) {
    hide(node);
    return false;
  }

  if (node.matches(someHiddenNodes)) {
    if (node.classList.contains('display-video') && node.children.length >= 5) {
      [3, 4].forEach(i => hide(node.children[i]));
    }

    const classList = node.classList || [];
    const activeSpeaker = [...classList].find(i => i.endsWith('-activeSpeaker'));
    if (activeSpeaker) {
      node.classList.remove(activeSpeaker);
    }

    return false;
  }

  return true;
});
})();

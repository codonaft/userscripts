// ==UserScript==
// @name Dark Theme for Planka
// @description Redirect to a random SearXNG instance in case of error and empty result
// @icon https://external-content.duckduckgo.com/ip3/planka.cloud.ico
// @version 0.6
// @downloadURL https://userscripts.codonaft.com/planka-dark-theme.user.js
// @grant GM_addStyle
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;
if (window.location.hostname !== 'localhost' || !document.head?.querySelector('meta[name="description"]')?.content?.startsWith('Planka ')) return;

GM_addStyle(`
  div[class^="Card_name__"] {
    color: #ccc !important;
  }
  div[class^="List_headerName__"], div[class^="List_outerWrapper__"] {
    color: #eee !important;
    background: #333 !important;
    background-color: #333 !important;
    span {
      color: #fff !important;
      background: #222 !important;
      background-color: #222 !important;
    }
  }
  button[class^="List_addCardButton__"] {
    color: #eee !important;
    background: #333 !important;
    background-color: #333 !important;
    span {
      color: #fff !important;
      background: #333 !important;
      background-color: #333 !important;
    }
  }
  i, textarea, span, button, div[class^="CardModal_headerWrapper__"], div[class^="Card_details__"], div[class^="ui grid CardModal_grid__"], div[class^="CardModal_moduleHeader__"], div[class^="Activities_moduleHeader__"], div.markdown-body pre {
    color: #fff !important;
    background: #222 !important;
    background-color: #222 !important;
  }
  div[class^="Card_card__"] {
    box-shadow: 0 1px 0 #000000;
  }
`);
})();

// ==UserScript==
// @name Turn Embedded YouTube Videos Into Redirects
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.7
// @downloadURL https://userscripts.codonaft.com/disable-embedded-youtube-videos.user.js
// @require https://userscripts.codonaft.com/utils.js
// ==/UserScript==

(_ => {
'use strict';

//const REDIRECT = 'https://redirect.invidious.io';
//const REDIRECT = 'https://inv.nadeko.net';
const REDIRECT = 'https://invidious.smesh.lol';
const PROXY = pickRandom(['imgproxy.nostu.be/insecure/f:webp/rs:fill::360/plain/', 'imgproxy.nosotros.app/_/feed_img/plain/', 'wsrv.nl/?url=']);

const imageURL = url => {
  if (!PROXY) return url;
  return `https://${PROXY}${encodeURIComponent(url)}`;
};

subscribeOnChanges(document.body, 'iframe[src^="https://youtube.com/"], iframe[src^="https://youtube-nocookie.com/"], iframe[src^="https://www.youtube.com/"], iframe[src^="https://www.youtube-nocookie.com/"]', node => {
  const src = new URL(node.src);
  const videoId = src.searchParams.get('v') || src.pathname.split('/embed/')[1];
  if (videoId) {
    console.log(`detected embedded video ${videoId}`);

    const image = document.createElement('img');
    image.src = imageURL(`https://i.ytimg.com/vi_webp/${videoId}/hqdefault.webp`);
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.display = 'block';

    const url = new URL(REDIRECT);
    url.pathname = '/watch';
    url.searchParams.set('v', videoId);
    for (const i of ['index', 'list', 't']) {
      const value = src.searchParams.get(i);
      if (value) {
        url.searchParams.set(i, value);
      }
    }

    const link = document.createElement('a');
    link.href = url;
    link.textContent = `\u25B6 ${link.href}`;
    link.target = '_blank';
    link.style.width = '100%';
    link.style.height = 'auto';
    link.style.display = 'block';
    link.appendChild(image);

    node.parentNode.replaceChild(link, node);
  }

  return false;
});
})();

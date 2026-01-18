// ==UserScript==
// @name Disable Embedded YouTube Videos
// @icon https://external-content.duckduckgo.com/ip3/youtube.com.ico
// @version 0.3
// @downloadURL https://userscripts.codonaft.com/disable-embedded-youtube-videos.user.js
// @require https://userscripts.codonaft.com/utils.js
// ==/UserScript==

(_ => {
'use strict';

const PROXY = pickRandom(['imgproxy.nosotros.app/_/feed_img/plain/', 'wsrv.nl/?url=']);

const imageURL = url => {
  if (!PROXY) return url;
  return `https://${PROXY}${encodeURIComponent(url)}`;
};

subscribeOnChanges(document.body, 'iframe[src^="https://www.youtube.com/"], iframe[src^="https://www.youtube-nocookie.com/embed/"]', node => {
  const src = node.getAttribute('src');
  const videoId = src.split('?v=')[1] || src.split('/embed/')[1];
  if (videoId) {
    const image = document.createElement('img');
    image.src = imageURL(`https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`);
    image.style.width = '100%';
    image.style.height = 'auto';
    image.style.display = 'block';

    const link = document.createElement('a');
    link.href = `https://www.youtube.com/watch?v=${videoId}`;
    link.appendChild(image);

    node.parentNode.replaceChild(link, node);
  }

  return false;
});
})();

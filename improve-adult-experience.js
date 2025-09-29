// ==UserScript==
// @name Improve Adult Experience
// @description Skip intros, set best quality and duration filters by default, make unrelated video previews transparent
// @version 0.6
// @downloadURL https://userscripts.codonaft.com/improve-adult-experience.js
// @exclude-match https://spankbang.com/*/video/*
// @match https://spankbang.com/*
// @match https://www.pornhub.com/*
// @match https://www.porntrex.com/*
// @match https://www.xvideos.com/
// @match https://www.xvideos.com/c/*
// @match https://xhamster.com/
// @match https://xhamster.com/categories/*
// @match https://xhamster.com/channels/*
// @match https://xhamster.com/search/*
// ==/UserScript==

(_ => {
  'use strict';

  if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

  const url = new URL(window.location.href);
  const params = url.searchParams;
  const h = url.hostname;
  const p = url.pathname;
  let newUrl;

  const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

  const timeToSeconds = time => (time || '').trim().split(':').map(Number).reduceRight((total, value, index, parts) => total + value * 60 ** (parts.length - 1 - index), 0);

  const simulateClick = (document, node) => {
    console.log('simulateClick');
    const rect = node.getBoundingClientRect();
    const clientX = rect.x + rect.width / 2;
    const clientY = rect.y + rect.height / 2;
    const target = document.elementFromPoint(clientX, clientY);
    ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']
      .forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true })))
  };

  const pornhub = _ => {
    // TODO: never redirect, just update the URLs

    const processEmbedded = (document, similarVideos) => {
      const css = `
        div.mgp_topBar { display: none !important; }
        div.mgp_thumbnailsGrid { display: none !important; }
        img.mgp_pornhub { display: none !important; }
      `;
      const styleApplied = [...document.body.querySelectorAll('style')]
        .filter(i => i.innerHTML === css)
        .length > 0;
      if (styleApplied) {
        console.log('embedded video is already initialized');
        return;
      }
      console.log('applying style');
      const style = document.createElement('style');
      style.innerHTML = css;
      document.body.appendChild(style);

      const requiresRefresh = document.body.querySelector('div.mgp_errorIcon') &&
        document.body.querySelector('p')?.textContent.includes('Please refresh the page');
      if (requiresRefresh) {
        console.log('refreshing after error');
        window.location.href = window.location.href;
      }

      const video = document.body.querySelector('video');
      if (!video) {
        console.log('embedding this video is probably not allowed');
        window.stop();
        // window.parent.location = window.parent.location; // TODO: do this no more than once during 5 mins for a given video?
        if (similarVideos.length > 0) {
          console.log('redirecting to random non-boring similar video');
          // TODO: use non-watched videos as priority?
          window.location.href = similarVideos[random(0, similarVideos.length)]; // FIXME: back history
        } else {
          console.log('giving up');
        }
        return;
      }

      video.addEventListener('loadstart', _ => simulateClick(document, document.body.querySelector('div.mgp_playIcon')));
      video.addEventListener('loadedmetadata', _ => {
        // TODO: save video size? video.videoHeight
        video.currentTime = random(video.duration / 4, video.duration / 3);
      });
      document.body.querySelector('div.mgp_gridMenu')?.addEventListener('click', _ => setTimeout(_ => {
        if (video.paused) {
          console.log('paused on grid menu');
          const button = document.body.querySelector('div.mgp_playIcon');
          simulateClick(document, button);
          setTimeout(_ => {
            if (video.paused) {
              console.log('still paused');
              simulateClick(document, button);
            }
          }, 500);
        }
      }, 100));

      video.load();
    };

    const style = document.createElement('style');
    style.innerHTML = `
      div.boringcontent { opacity: 10%; }
      div.boringcontent:hover { opacity: 40%; }
    `;
    document.body.appendChild(style);

    const similarVideos = [...document.body.querySelectorAll('var.duration')]
      .flatMap(i => {
        const duration = timeToSeconds(i.textContent);
        const t = random(duration / 4, duration / 3);
        const link = i.closest('a');
        if (link) {
          link.href += `&t=${t}`;
          const div = link.closest('div.phimage')?.parentNode; // TODO: find previews from current playlist as well
          if (duration < 20 * 60) { // TODO: check quality, non-free-premiumness, my like or dislike; temporary (with exp backoff?) ban videos that fail to load?
            div?.classList.add('boringcontent');
          } else {
            return [link.href];
          }
        }
        return [];
      });

    if (p.startsWith('/embed/')) {
      // this branch gets selected for both iframed and redirected embedded player
      setTimeout(_ => {
        console.log('processing embedded');
        processEmbedded(document, similarVideos); // document is a part of iframe here
      }, 500);
    } else if (p === '/view_video.php') {
      const durationFromNormalPlayer = timeToSeconds(document.body.querySelector('span.mgp_total')?.textContent);
      if (durationFromNormalPlayer) {
        if (!params.has('t') || Number(params.get('t')) >= durationFromNormalPlayer) {
          window.stop();
          params.set('t', random(durationFromNormalPlayer / 4, durationFromNormalPlayer / 3));
          window.location.replace(url.toString());
        }
      } else {
        console.log('fallback to embedded player');
        const embedUrl = `https://www.pornhub.com/embed/${params.get('viewkey')}`;
        const container = document.body.querySelector('div.playerFlvContainer');
        if (container) {
          const iframe = document.createElement('iframe');
          iframe.onload = _ => {
            console.log('processing embedded video from onload');
            processEmbedded(iframe.contentWindow.document, similarVideos);
          };
          iframe.referrerpolicy = 'no-referrer';
          iframe.width = '100%';
          iframe.height = '100%';
          iframe.frameborder = '0';
          iframe.scrolling = 'no';
          iframe.allowfullscreen = '';
          iframe.src = embedUrl;
          container.appendChild(iframe);
        } else {
          console.log('player not found, redirecting to embedded player');
          window.stop();
          window.location.href = embedUrl;
        }
      }
    } else if (params.get('hd') !== '1' && !params.has('min_duration') && (p.startsWith('/categories/') || p === '/video' || p === '/video/search')) {
      params.set('min_duration', 20);
      params.set('hd', 1);
      newUrl = url.toString();
    }
  };

  const xvideos = _ => {
    // TODO: never redirect, just update the URLs

    if (p === '/' && params.has('k') && !params.has('quality')) {
      params.set('sort', 'rating');
      params.set('durf', '20min_more');
      params.set('quality', '1080P');
      newUrl = url.toString();
    } else if (p.startsWith('/c/') && !p.includes('q:1080P')) {
      const ps = p.split('/');
      if (ps.length >= 3) {
        url.pathname = `${ps[1]}/s:rating/d:20min_more/q:1080P/${ps[2]}`;
        newUrl = url.toString();
      }
    }
  };

  const spankbang = _ => {
    // TODO: never redirect, just update the URLs

    if (!p.endsWith('/tags') && !p.includes('/playlist/') && !(params.has('q') && params.has('d'))) {
      if (p === '/') {
        url.pathname = '/trending_videos/'
      }
      params.set('q', 'fhd');
      params.set('d', '20');
      newUrl = url.toString();
    }
  };

  const porntrex = _ => {
    const expectedPage = (page, href) => href.startsWith(`https://www.porntrex.com/${page}/`) && (page === 'top-rated' || href.split('/').length > 5);

    [...document.body.querySelectorAll('a')]
      .filter(i => ['categories', 'channels', 'models', 'top-rated'].filter(page => expectedPage(page, i.href)).length > 0)
      .forEach(i => {
        const url = new URL(i.href);
        const ps = url.pathname.split('/').filter(i => i.length > 0);
        for (const i of ['hd', 'top-rated', 'thirty-all-min']) {
          if (!ps.includes(i)) {
            ps.push(i);
          }
        }
        ps.push('');
        ps.unshift('');
        url.pathname = ps.join('/');
        i.href = url.toString();
      });
  };

  const xhamster = _ => {
    // TODO: never redirect, just update the URLs

    if (p.startsWith('/search/')) {
      if (params.get('length') !== 'full') {
        params.set('quality', '1080p');
        params.set('length', 'full');
        newUrl = url.toString();
      }
    } else if (p.startsWith('/categories/') || p.startsWith('/channels/')) {
      if (!p.includes('/hd/')) {
        newUrl = `${url}/hd/full-length/best?quality=1080p`;
      }
    } else if (p === '/') {
      newUrl = `${url}/hd/full-length/best/monthly?quality=1080p`;
    }
  };

  if (h === 'www.pornhub.com') {
    pornhub();
  } else if (h === 'www.xvideos.com') {
    xvideos();
  } else if (h === 'spankbang.com') {
    spankbang();
  } else if (h === 'www.porntrex.com') {
    porntrex();
  } else if (h === 'xhamster.com') {
    xhamster();
  }

  if (newUrl) {
    window.stop();
    window.location.replace(newUrl);
  }
})()

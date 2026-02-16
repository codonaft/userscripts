// ==UserScript==
// @name Bypass Various Popups
// @version 0.25
// @downloadURL https://userscripts.codonaft.com/bypass-various-popups.user.js
// @require https://userscripts.codonaft.com/utils.js
// @match https://*.archive.org/*
// @match https://*.pornhub.com/*
// @match https://chat.deepseek.com/*
// @match https://chat.qwen.ai/*
// @match https://chatgpt.com/*
// @match https://hdzog.tube/*
// @match https://hqporner.com/*
// @match https://inporn.com/*
// @match https://manysex.com/*
// @match https://pmvhaven.com/*
// @match https://pornone.com/*
// @match https://spankbang.com/*
// @match https://txxx.com/*
// @match https://vxxx.com/*
// @match https://www.cvedetails.com/*
// @match https://www.porntrex.com/*
// @match https://www.redtube.com/*
// @match https://www.tube8.com/*
// @match https://www.whoreshub.com/*
// @match https://www.xnxx.com/*
// @match https://www.xvideos.com/*
// @match https://www.youporn.com/*
// @match https://xhamster.com/*
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const simulateMouse = (document, node, events = ['mouseenter', 'mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) => {
  if (!node) return;

  console.log('simulateMouse', node, events);
  try {
    const { target, clientX, clientY } = getTopNode(document, node, 0.5, 0.5);
    console.log('simulateMouse target', target, clientX, clientY);
    events.forEach(i => target.dispatchEvent(new MouseEvent(i, { clientX, clientY, bubbles: true, cancelable: true })));
  } catch (e) {
    err(e, node);
  }
};

const getTopNode = (document, node, x, y) => {
  if (!node) return;
  try {
    const rect = node.getBoundingClientRect();
    const clientX = rect.x + rect.width * x;
    const clientY = rect.y + rect.height * y;
    const target = document.elementFromPoint(clientX, clientY) || node;
    return { target, clientX, clientY };
  } catch (e) {
    err(e, node);
  }
};

const process = (node, observer) => {
  if (node.matches('div[role=dialog]')) {
    setTimeout(_ => {
      node.querySelectorAll('button[aria-label="close"]').forEach(i => i.click());
      node.querySelectorAll('button.btn').forEach(i => {
        if (i.textContent?.includes('Not now')) {
          i.click();
        }
      });
      node.querySelectorAll('a').forEach(i => {
        if (i.textContent?.includes('Stay logged out')) {
          i.click();
        }
      });
    }, random(1000, 1500));
    observer.disconnect();
    return false;
  }

  if (node.matches('div.age-popup-btns > div#okButton') && node.textContent?.includes('18 or older')) {
    observer.disconnect();
    node.click();
    return false;
  }

  if (node.matches('button#ageagree') || node.matches('button#accessButton') || node.matches('div.age-verification-overlay button.btn-confirm')) {
    observer.disconnect();
    node.click();
    return false;
  }

  if (node.matches('div#embed-modal button') && node.textContent?.includes(' am 18 ')) {
    observer.disconnect();
    setTimeout(_ => simulateMouse(document, node), random(1000, 1500));
    return false;
  }

  /*
  // FIXME redtube
  if (node.matches('div.age_disclaimer_window a#btn_agree') && node.textContent?.includes(' am 18 or older ')) {
    console.log('detected', node);
    observer.disconnect();
    node.click();
    return false;
  }*/

  if (node.matches('div#ageDisclaimerWrapper button#accessButton')) {
    observer.disconnect();
    node.click();
    return false;
  }

  if (node.matches('button#age-check-yes')) {
    observer.disconnect();
    node.click();
    return false;
  }

  if (node.tagName === 'SPAN' && node.parentElement?.tagName === 'BUTTON' && node.textContent?.includes('Continue without disabling')) {
    observer.disconnect();
    node.parentElement.click();
    return false;
  }

  if (node.matches('div#credential_picker_container')) {
    node.style.display = 'none';
    return false;
  }

  if (node.tagName === 'BUTTON' && (node.getAttribute('data-role') === 'parental-control-confirm-button' || node.textContent?.includes('Stay logged out'))) {
    setTimeout(_ => node.click(), random(1000, 1500));
    return false;
  }

  if (node.matches('div#cookie-banner')) {
    observer.disconnect();
    node.querySelector('a#accept-essential')?.click();
    return false;
  }

  if (node.matches('button[role="button"] > span') && node.textContent === 'Continue') {
    node.closest('button')?.click();
    return false;
  }

  if (node.matches('#cookieconsentwarningcontainer, #donate_banner')) {
    observer.disconnect();
    node.parentNode?.removeChild(node);
    return false;
  }

  if (node.matches('#modalWrapMTubes button[data-label="over18_enter"]')) {
    observer.disconnect();
    simulateMouse(document, node);
    return false;
  }

  if (node.matches('div.disclaimer_message')) {
    observer.disconnect();
    node.querySelectorAll('span').forEach(i => {
      if (i.textContent?.includes('I am 18 years')) {
        i?.closest('button')?.click();
      }
    });
    node.querySelectorAll('button.current-main-cat').forEach(i => i.click());
    return false;
  }

  return true;
};

subscribeOnChanges(document.body, 'button, div, span', process);
})();

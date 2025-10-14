// ==UserScript==
// @name Bypass Various Popups
// @version 0.16
// @downloadURL https://userscripts.codonaft.com/bypass-various-popups.user.js
// @match https://*.archive.org/*
// @match https://chat.deepseek.com/*
// @match https://chat.qwen.ai/*
// @match https://chatgpt.com/*
// @match https://hqporner.com/*
// @match https://pmvhaven.com/*
// @match https://www.cvedetails.com/*
// @match https://*.pornhub.com/*
// @match https://www.porntrex.com/*
// @match https://www.xnxx.com/*
// @match https://www.xvideos.com/*
// @match https://xhamster.com/*
// ==/UserScript==

(_ => {
'use strict';

if (performance.getEntriesByType('navigation')[0]?.responseStatus !== 200) return;

const randomPause = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

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
    }, randomPause(1000, 1500));
    observer.disconnect();
    return false;
  }

  if (node.matches('div.age-popup-btns > div#okButton') && node.textContent?.includes('18 or older')) {
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
    setTimeout(_ => node.click(), randomPause(1000, 1500));
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
    console.log('detected', node);
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

const subscribeOnChanges = (node, selector, f) => {
  const apply = (node, observer) => {
    if (node?.nodeType !== 1) return;

    let observeChildren = true;
    if (node?.matches?.(selector)) {
      try {
        observeChildren = f(node, observer);
      } catch (e) {
        err(e, node);
        if (e.name === 'SecurityError') {
          observer.disconnect();
          return;
        }
      }
    }

    if (observeChildren) {
      const children = node?.childNodes || [];
      children.forEach(i => apply(i, observer));
    }
  };

  const observer = new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(i => apply(i, observer))));
  observer.observe(node, { childList: true, subtree: true });
  node.querySelectorAll(selector).forEach(i => apply(i, observer)); // TODO: apply to other scripts?
};

const err = (e, node) => {
  console.log(node);
  console.error(e);
};

subscribeOnChanges(document.body, 'button, div, span', process);
})();

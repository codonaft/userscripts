// ==UserScript==
// @name Forward Nostr Events
// @description Your events and of those you interacted with
// @version 0.2
// @downloadURL https://userscripts.codonaft.com/forward-nostr-events.user.js
// @run-at document-start
// @grant none
// ==/UserScript==

(_ => {
'use strict';

const MY_OUTBOX_RELAY = 'wss://nostr.codonaft.com';
const BROADCAST_RELAYS = ['wss://sendit.nosflare.com'];

const SECONDARY_KINDS = [6, 7, 16];
const KINDS = [1, 11, 17, 20, 21, 22, 24, 1018, 1068, 1111, 1337, 1617, 1618, 1619, 1621, 1630, 1631, 1632, 1633, 30023, 30617, 30618, ...SECONDARY_KINDS];
const TIMEOUT = 7000;
const MAX_REFERENCED_EVENTS = 127;

const FORWARDED_KEY = '__forwardedNostrEvents';
const CACHED_KEY = '__cachedNostrEvents';
const STORAGE_LIMIT = 1024;
const PERSIST_TIME_SECS = 3;

const MS_IN_SEC = 1000;

const sockets = new Map();
const pending = new Map();

let forwardedEvents;
let cachedEvents;
let cachePersistedSecs = 0;

let nostrClient = false;

let myPubkey;

const isNewBroadcastableEvent = event => {
  if (!KINDS.includes(event.kind) || event.pubkey !== myPubkey) {
    return false;
  }

  const age = now() - event.created_at;
  const maxAge = TIMEOUT / MS_IN_SEC;
  return age >= 0 && age < maxAge;
};

const tags = event => (event.tags || [])
  .filter(t => t.length > 1 && t[1]);

const isRoot = event => tags(event)
  .map(t => t[0])
  .every(t => !['e', 'E'].includes(t));

const hasPrimaryKind = event => !SECONDARY_KINDS.includes(event.kind);

const referencedEventIds = event => {
  const ids = tags(event)
    .filter(t => (['a', 'e', 'E', 'q'].includes(t[0])))
    .map(t => t[1]);
  const nextLevel = ids
    .map(id => cachedEvents[id])
    .filter(Boolean)
    .map(referencedEventIds)
    .flat();
  console.log('nextLevel', nextLevel);
  return [...new Set(ids.concat(nextLevel))];
};

const broadcastWithReferences = event => {
  if (!event || !event.id || !event.pubkey || !event.created_at || !event.sig) {
    return;
  }

  if (!myPubkey && event.pubkey) {
    myPubkey = event.pubkey;
    console.log('my pubkey is', myPubkey);
  }

  if (!isNewBroadcastableEvent(event) || forwardedEvents[event.id] === 1) {
    return;
  }

  console.log('detected own new broadcastable event', event);
  const referenced = referencedEventIds(event)
    .filter(id => forwardedEvents[id] !== 1)
    .map(id => cachedEvents[id])
    .filter(Boolean)
    .sort((a, b) => (isRoot(b) && hasPrimaryKind(b)) ? Number.MAX_SAFE_INTEGER : ((hasPrimaryKind(b) - hasPrimaryKind(a)) || (b.created_at - a.created_at)))
    .slice(0, MAX_REFERENCED_EVENTS);
  const sendable = [event, ...referenced];

  console.log('sendable', sendable);
  addForwarded(sendable.map(i => i.id));

  const targets = new Set([MY_OUTBOX_RELAY, ...BROADCAST_RELAYS]);
  const myOutboxRelay = normalize(MY_OUTBOX_RELAY);
  for (const relay of targets) {
    const url = normalize(relay);
    let socket = sockets.get(url);

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log('socket not ready', relay);
      socket = new WebSocket(relay);
      sockets.set(url, socket);
    }

    const send = _ => {
      if (socket.readyState !== WebSocket.OPEN) {
        console.log('socket not open', relay);
        return;
      }

      for (const e of sendable) {
        const isMe = e.pubkey === myPubkey;
        if (!isMe || url !== myOutboxRelay) {
          console.log('SEND', relay, e);
          socket.send(JSON.stringify(['EVENT', e]));
        }
      }
    };

    if (socket.readyState === WebSocket.OPEN) {
      console.log('socket is already open', relay);
      send();
    } else {
      console.log('waiting for new socket', relay);
      socket.addEventListener('open', send, { once: true });
    }
  }
};

const handleMessage = (message, socket) => {
  let data;

  try {
    data = JSON.parse(message);
  } catch {
    return;
  }

  if (!Array.isArray(data) || typeof data[0] !== 'string') {
    return;
  }

  const type = data[0];

  {
    const event = data[2];
    if (type === 'EVENT' && event?.id && KINDS.includes(event?.kind)) {
      console.log('received requested event');
      const ids = [event.id];

      const ts = tags(event);
      const d = (ts.find(i => i[0] === 'd') || [])[1];
      if (d && event.pubkey) {
        ids.push(`${event.kind}:${event.pubkey}:${d}`);
      }

      cacheEvents(ids, event);
      return;
    }
  }

  {
    if (!socket) {
      return;
    }

    const eventId = data[1];
    const result = data[2];
    const delivered = type === 'OK' && eventId && result === true && normalize(socket.url) === normalize(MY_OUTBOX_RELAY);
    if (!delivered) {
      return;
    }

    const timer = pending.get(eventId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    pending.delete(eventId);

    broadcastWithReferences(cachedEvents[eventId]);
  }
};

const handleOutgoing = (socket, message) => {
  let data;

  try {
    data = JSON.parse(message);
  } catch {
    return;
  }

  if (!Array.isArray(data) || typeof data[0] !== 'string') {
    return;
  }

  const type = data[0];
  const relay = normalize(socket.url);

  if (type === 'REQ') {
    sockets.set(relay, socket);
    nostrClient = !!window.nostr;
    return;
  }

  const event = data[1];
  if (type !== 'EVENT' || !KINDS.includes(event?.kind)) {
    return;
  }

  console.log('detected outgoing event');
  cacheEvents([event.id], event);

  if (pending.has(event.id)) {
    return;
  }

  const timer = setTimeout(_ => {
    pending.delete(event.id);
  }, TIMEOUT);

  pending.set(event.id, timer);
};

const loadForwardedEvents = _ => {
  forwardedEvents = JSON.parse(localStorage.getItem(FORWARDED_KEY) || '{}');
};

const addForwarded = ids => {
  if (ids.every(id => forwardedEvents[id] === 1)) {
    return;
  }

  loadForwardedEvents();

  for (const id of ids) {
    forwardedEvents[id] = 1;
  }

  Object
    .keys(forwardedEvents)
    .slice(0, Math.max(0, Object.getOwnPropertyNames(forwardedEvents).length - STORAGE_LIMIT))
    .forEach(i => {
      delete forwardedEvents[i];
    });

  localStorage.setItem(FORWARDED_KEY, JSON.stringify(forwardedEvents));
};

const loadCachedEvents = _ => {
  cachedEvents = JSON.parse(localStorage.getItem(CACHED_KEY) || '{}');
};

const cacheEvents = (ids, event) => {
  if (ids.every(id => cachedEvents[id])) {
    return;
  }

  const nowSecs = now();
  const persist = nowSecs - cachePersistedSecs >= PERSIST_TIME_SECS;
  console.log(`cacheEvents ${ids} kind=${event.kind} persist=${persist}`);

  if (persist) {
    cachePersistedSecs = nowSecs;

    loadCachedEvents();
    for (const id of ids) {
      if (cachedEvents[id] && forwardedEvents[id]) {
        console.log('remove cached event (which was already forwarded)?', id);
        delete cachedEvents[id];
      }
    }
  }

  for (const id of ids) {
    cachedEvents[id] = event;
  }

  if (persist) {
    Object
      .keys(cachedEvents)
      .slice(0, Math.max(0, Object.getOwnPropertyNames(cachedEvents).length - STORAGE_LIMIT))
      .forEach(i => {
        delete cachedEvents[i];
      });

    localStorage.setItem(CACHED_KEY, JSON.stringify(cachedEvents));
  }
};

const normalize = url => String(url).replace(/\/+$/, '');

const now = _ => Math.floor(Date.now() / MS_IN_SEC);

loadForwardedEvents();
loadCachedEvents();

const NativeWebSocket = window.WebSocket;

window.WebSocket = function (...args) {
  const socket = new NativeWebSocket(...args);

  socket.addEventListener('message', event => {
    handleMessage(event.data, socket);
  });

  const originalSend = socket.send;

  socket.send = function (message) {
    handleOutgoing(socket, message);
    return originalSend.call(this, message);
  };

  return socket;
};

Object.assign(window.WebSocket, NativeWebSocket);
window.WebSocket.prototype = NativeWebSocket.prototype;

window.addEventListener('beforeunload', (event) => {
  if (nostrClient) {
    console.log('save cached events');
    localStorage.setItem(CACHED_KEY, JSON.stringify(cachedEvents));
  }
});

try {
  const text = document.body?.querySelector?.('script[id="__NEXT_DATA__"][type="application/json"]').textContent || '{}';
  const pageEvent = JSON.parse(text).props?.pageProps?.event;
  if (pageEvent) {
    handleMessage(JSON.stringify(['EVENT', 'page', pageEvent]));
  }
} catch {}
})();

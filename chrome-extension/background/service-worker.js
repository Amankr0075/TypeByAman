/**
 * TypeByAman — Service Worker (Background)
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Handles keyboard command shortcuts and
 * relays messages between popup and content script.
 */

'use strict';

// ─── Keyboard Commands ─────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  let action;
  switch (command) {
    case 'start-typing':
      action = 'startTypingFromCommand';
      break;
    case 'pause-resume-typing':
      action = 'pauseResumeFromCommand';
      break;
    case 'stop-typing':
      action = 'stopTyping';
      break;
    default:
      return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch {
    // Content script not loaded on this page — silently ignore
  }
});

// ─── Extension Install / Update ────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      tba_theme:           'dark',
      tba_delay:           50,
      tba_linebreak_delay: 0,
      tba_start_delay:     0,
      tba_custom_mode:     false,
    });
  }
});

import '../remote/remote-bridge.js';

const remoteBridge = globalThis.remoteBridge;

// Initialize remote bridge for QR-code mobile control
if (remoteBridge) {
  remoteBridge.init().catch((err) => {
    console.warn('[TypeByAman] Remote bridge init warning:', err);
  });
}

// ─── Service Worker Keepalive Alarm ──────────────────────────────────────────

try {
  chrome.alarms.create('tba_remote_keepalive', { periodInMinutes: 0.4 }); // ~24s keepalive
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tba_remote_keepalive') {
      if (remoteBridge && (!remoteBridge.client || !remoteBridge.client.connected)) {
        remoteBridge.init().catch(() => {});
      }
    }
  });
} catch (_) {}

// ─── Message Relay ──────────────────────────────────────────────────────────

/**
 * Forward messages from content scripts to all extension views
 * (popup, options page) and to connected remote mobile devices.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Remote bridge request handlers from popup
  if (msg.action === 'getRemoteUrl') {
    (async () => {
      try {
        if (!remoteBridge || !remoteBridge.sessionId) {
          await remoteBridge.init();
        }
        sendResponse({
          url: remoteBridge ? remoteBridge.getRemoteUrl() : '',
          sessionId: remoteBridge ? remoteBridge.sessionId : '',
          connected: remoteBridge ? remoteBridge.remoteDeviceConnected : false,
        });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (msg.action === 'regenerateRemoteSession') {
    if (remoteBridge) {
      remoteBridge.regenerateSession().then((newId) => {
        sendResponse({
          url: remoteBridge.getRemoteUrl(),
          sessionId: newId,
        });
      });
      return true; // Keep channel open for async response
    }
  }

  if (msg.action === 'nativeOsCommand') {
    (async () => {
      try {
        const resp = await fetch('http://127.0.0.1:9876/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload || {}),
        });
        const data = await resp.json();
        sendResponse(data);
      } catch (err) {
        sendResponse({ ok: false, error: 'Native helper offline' });
      }
    })();
    return true;
  }

  if (msg.action === 'checkNativeHelper') {
    (async () => {
      try {
        const resp = await fetch('http://127.0.0.1:9876/ping', { method: 'GET' });
        const data = await resp.json();
        sendResponse({ online: data.ok === true });
      } catch {
        sendResponse({ online: false });
      }
    })();
    return true;
  }

  // Relay status/typing events and Design Mode events from content → popup & mobile remote
  const RELAY_ACTIONS = ['statusUpdate', 'targetPicked', 'typingDone', 'typingError', 'designStatus'];
  if (RELAY_ACTIONS.includes(msg.action)) {
    // Broadcast to remote device connected via QR code
    if (remoteBridge && typeof remoteBridge.broadcastStatus === 'function') {
      remoteBridge.broadcastStatus(msg);
    }

    // Broadcast to all extension pages (popup, options)
    chrome.runtime.sendMessage(msg).catch(() => {
      // Popup might be closed — that's fine
    });
  }
  // Always acknowledge
  sendResponse({ relayed: true });
  return false;
});



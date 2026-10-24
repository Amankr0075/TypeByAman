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

// ─── Message Relay ──────────────────────────────────────────────────────────

/**
 * Forward messages from content scripts to all extension views
 * (popup, options page) so they can update their UI.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Relay status/typing events and Design Mode events from content → popup
  const RELAY_ACTIONS = ['statusUpdate', 'targetPicked', 'typingDone', 'typingError', 'designStatus'];
  if (RELAY_ACTIONS.includes(msg.action)) {
    // Broadcast to all extension pages (popup, options)
    chrome.runtime.sendMessage(msg).catch(() => {
      // Popup might be closed — that's fine
    });
  }
  // Always acknowledge
  sendResponse({ relayed: true });
  return false;
});

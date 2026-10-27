/**
 * TypeByAman — Remote Control Bridge
 * Enables phone/tablet remote control via QR Code.
 * Works for both Typing and Design modes in real-time.
 * Zero-server, encrypted WebSocket pub/sub relay.
 * Author: Aman Kumar | github.com/Amankr0075
 */

'use strict';

// ─── Minimal Standalone MQTT-over-WebSocket Client ───────────────────────────
class MiniMqttClient {
  constructor(brokerUrl, clientId) {
    this.brokerUrl = brokerUrl;
    this.clientId = clientId || ('tba_' + Math.random().toString(36).slice(2, 10));
    this.ws = null;
    this.connected = false;
    this.subscriptions = new Set();
    this.onMessage = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.destroyed = false;
  }

  connect() {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.brokerUrl, 'mqtt');
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this._sendConnect();
      };

      this.ws.onmessage = (event) => {
        this._handleData(new Uint8Array(event.data));
      };

      this.ws.onclose = () => {
        this._cleanup();
        if (!this.destroyed) {
          this.reconnectTimer = setTimeout(() => this.connect(), 4000);
        }
      };

      this.ws.onerror = () => {
        try { this.ws.close(); } catch (_) {}
      };
    } catch (_) {
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }

  subscribe(topic) {
    this.subscriptions.add(topic);
    if (this.connected) {
      this._sendSubscribe(topic);
    }
  }

  publish(topic, payloadObj) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payloadStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
    const topicBytes = new TextEncoder().encode(topic);
    const payloadBytes = new TextEncoder().encode(payloadStr);

    const remainingLen = 2 + topicBytes.length + payloadBytes.length;
    const packet = [0x30]; // PUBLISH QoS 0
    packet.push(...this._encodeLength(remainingLen));
    packet.push((topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff);
    packet.push(...topicBytes);
    packet.push(...payloadBytes);

    try {
      this.ws.send(new Uint8Array(packet));
    } catch (_) {}
  }

  _sendConnect() {
    const protoBytes = [0, 4, 77, 81, 84, 84, 4]; // 'MQTT', protocol level 4 (3.1.1)
    const flags = 0x02; // clean session
    const keepAlive = 60; // 60s
    const clientBytes = new TextEncoder().encode(this.clientId);

    const remLen = protoBytes.length + 1 + 2 + 2 + clientBytes.length;
    const packet = [0x10]; // CONNECT
    packet.push(...this._encodeLength(remLen));
    packet.push(...protoBytes);
    packet.push(flags);
    packet.push((keepAlive >> 8) & 0xff, keepAlive & 0xff);
    packet.push((clientBytes.length >> 8) & 0xff, clientBytes.length & 0xff);
    packet.push(...clientBytes);

    this.ws.send(new Uint8Array(packet));
  }

  _sendSubscribe(topic) {
    const topicBytes = new TextEncoder().encode(topic);
    const packetId = 1;
    const remLen = 2 + 2 + topicBytes.length + 1;

    const packet = [0x82]; // SUBSCRIBE QoS 1
    packet.push(...this._encodeLength(remLen));
    packet.push((packetId >> 8) & 0xff, packetId & 0xff);
    packet.push((topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff);
    packet.push(...topicBytes);
    packet.push(0); // requested QoS 0

    this.ws.send(new Uint8Array(packet));
  }

  _handleData(bytes) {
    if (bytes.length < 2) return;
    const type = bytes[0] >> 4;

    // CONNACK
    if (type === 2) {
      if (bytes[3] === 0) {
        this.connected = true;
        this._startPing();
        for (const topic of this.subscriptions) {
          this._sendSubscribe(topic);
        }
        if (this.onConnect) this.onConnect();
      }
    }
    // PUBLISH
    else if (type === 3) {
      let offset = 1;
      let multiplier = 1;
      let remainingLen = 0;
      do {
        const digit = bytes[offset++];
        remainingLen += (digit & 0x7f) * multiplier;
        multiplier *= 128;
      } while ((bytes[offset - 1] & 0x80) !== 0 && offset < bytes.length);

      const topicLen = (bytes[offset] << 8) | bytes[offset + 1];
      offset += 2;
      const topic = new TextDecoder().decode(bytes.slice(offset, offset + topicLen));
      offset += topicLen;

      const payloadStr = new TextDecoder().decode(bytes.slice(offset));
      let payload = payloadStr;
      try { payload = JSON.parse(payloadStr); } catch (_) {}

      if (this.onMessage) this.onMessage(topic, payload);
    }
    // PINGRESP
    else if (type === 13) {
      // alive
    }
  }

  _startPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this.ws.send(new Uint8Array([0xc0, 0x00])); } catch (_) {}
      }
    }, 30000);
  }

  _encodeLength(len) {
    const bytes = [];
    do {
      let digit = len % 128;
      len = Math.floor(len / 128);
      if (len > 0) digit |= 0x80;
      bytes.push(digit);
    } while (len > 0);
    return bytes;
  }

  _cleanup() {
    this.connected = false;
    clearInterval(this.pingTimer);
    if (this.onDisconnect) this.onDisconnect();
  }

  destroy() {
    this.destroyed = true;
    this._cleanup();
    clearTimeout(this.reconnectTimer);
    try { this.ws.close(); } catch (_) {}
  }
}

// ─── Remote Control Manager ───────────────────────────────────────────────────

class RemoteControlBridge {
  constructor() {
    this.sessionId = null;
    this.client = null;
    this.remoteDeviceConnected = false;
    this.lastHandshake = null;
    this.brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    this.listeners = new Set();
  }

  async init() {
    // 1. Get or create high-entropy persistent session ID
    this.sessionId = await this._getOrCreateSessionId();

    if (this.client && this.client.connected) {
      return this.sessionId;
    }

    if (this.client) {
      this.client.destroy();
    }

    // 2. Initialize WebSocket MQTT client with unique random suffix
    const clientId = 'tba_pc_' + this.sessionId + '_' + Math.random().toString(36).slice(2, 6);
    this.client = new MiniMqttClient(this.brokerUrl, clientId);

    const cmdTopic = `typebyaman/remote/${this.sessionId}/cmd`;
    this.client.subscribe(cmdTopic);

    this.client.onConnect = () => {
      this._emit({ type: 'brokerConnected', sessionId: this.sessionId });
    };

    this.client.onDisconnect = () => {
      this._emit({ type: 'brokerDisconnected' });
    };

    this.client.onMessage = (topic, message) => {
      if (topic === cmdTopic) {
        this.handleRemoteCommand(message);
      }
    };

    this.client.connect();
    return this.sessionId;
  }

  async _getOrCreateSessionId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tba_remote_session_id'], (res) => {
        if (res.tba_remote_session_id) {
          resolve(res.tba_remote_session_id);
        } else {
          const arr = new Uint8Array(5);
          crypto.getRandomValues(arr);
          const hex = Array.from(arr, b => b.toString(36)).join('').slice(0, 8);
          const newId = 'tba-' + hex;
          chrome.storage.local.set({ tba_remote_session_id: newId }, () => {
            resolve(newId);
          });
        }
      });
    });
  }

  async regenerateSession() {
    const arr = new Uint8Array(5);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr, b => b.toString(36)).join('').slice(0, 8);
    const newId = 'tba-' + hex;
    await chrome.storage.local.set({ tba_remote_session_id: newId });

    if (this.client) {
      this.client.destroy();
    }
    this.sessionId = newId;
    this.remoteDeviceConnected = false;
    await this.init();
    return this.sessionId;
  }

  getRemoteUrl() {
    if (!this.sessionId) return '';
    return `https://amankr0075.github.io/TypeByAman/remote.html?session=${this.sessionId}`;
  }

  /**
   * Broadcast state changes to the connected mobile phone
   */
  broadcastStatus(data) {
    if (!this.client || !this.sessionId) return;
    const statusTopic = `typebyaman/remote/${this.sessionId}/status`;
    this.client.publish(statusTopic, data);
  }

  /**
   * Fast, synchronous platform detector from tab URL and title
   */
  _detectPlatformFromUrl(urlStr, title = '') {
    if (!urlStr) return 'Web Editor';
    try {
      const url = new URL(urlStr);
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      const t = (title || '').toLowerCase();

      if (host.includes('canva.com') || t.includes('canva')) return 'Canva';
      if (host.includes('figma.com') || t.includes('figma')) return 'Figma';
      if (host.includes('express.adobe') || host.includes('adobeexpress') || (host.includes('adobe.com') && path.includes('express'))) return 'Adobe Express';
      if (host.includes('photoshop.adobe') || (host.includes('adobe.com') && path.includes('photoshop')) || t.includes('photoshop')) return 'Photoshop Web';
      if (host.includes('illustrator.adobe') || (host.includes('adobe.com') && path.includes('illustrator'))) return 'Illustrator Web';
      if (host.includes('photopea.com') || t.includes('photopea')) return 'Photopea';
      if (host.includes('pixlr.com') || t.includes('pixlr')) return 'Pixlr';
      if (host.includes('picsart.com') || t.includes('picsart')) return 'Picsart';
      if (host.includes('penpot.app') || t.includes('penpot')) return 'Penpot';
      if (host.includes('framer.com')) return 'Framer';
      if (host.includes('webflow.com')) return 'Webflow';
      if (host.includes('spline.design')) return 'Spline 3D';
      if (host.includes('womp.com')) return 'Womp 3D';
      if (host.includes('kittl.com')) return 'Kittl';
      if (host.includes('visme.co')) return 'Visme';
      if (host.includes('desygner.com')) return 'Desygner';
      if (host.includes('snappa.com')) return 'Snappa';
      if (host.includes('creatopy.com')) return 'Creatopy';
      if (host.includes('lucid.app') || host.includes('lucidchart.com')) return 'Lucidchart';
      if (host.includes('vectr.com')) return 'Vectr';
      if (host.includes('gravit.io') || host.includes('corelvector.com')) return 'Corel Vector';
      if (host.includes('miro.com')) return 'Miro';
      if (host.includes('excalidraw.com')) return 'Excalidraw';
      if (host.includes('tldraw.com')) return 'tldraw';
      if (host.includes('polotno.com')) return 'Polotno Studio';
      if (host.includes('draw.io') || host.includes('diagrams.net')) return 'Diagrams.net';
    } catch (_) {}
    return 'Web Editor';
  }

  /**
   * Find target design tab with high intelligence:
   * 1. Check if user already has an active tab on a design platform (Canva, Figma, etc.)
   * 2. If not, scan all open tabs across all windows for any design platform!
   * 3. Exclude internal tabs (chrome://, chrome-extension://, remote.html)
   */
  async _getTargetTab() {
    try {
      const isDesignUrl = (u) => {
        if (!u) return false;
        const low = u.toLowerCase();
        return low.includes('canva.com') || low.includes('figma.com') || low.includes('adobe.com') ||
               low.includes('photopea.com') || low.includes('pixlr.com') || low.includes('picsart.com') ||
               low.includes('penpot.app') || low.includes('framer.com') || low.includes('webflow.com') ||
               low.includes('miro.com') || low.includes('excalidraw.com') || low.includes('tldraw.com') ||
               low.includes('polotno.com') || low.includes('kittl.com') || low.includes('spline.design') ||
               low.includes('visme.co') || low.includes('desygner.com') || low.includes('snappa.com');
      };

      const isInternalUrl = (u) => {
        if (!u) return true;
        const low = u.toLowerCase();
        return low.startsWith('chrome://') || low.startsWith('chrome-extension://') ||
               low.startsWith('edge://') || low.startsWith('about:') || low.includes('remote.html');
      };

      // 1. Try active tab in last focused window first
      const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (focusedTabs && focusedTabs.length > 0 && focusedTabs[0].id) {
        const t = focusedTabs[0];
        if (!isInternalUrl(t.url)) {
          return t;
        }
      }

      // 2. Scan all tabs across all windows for a known design tool tab
      const allTabs = await chrome.tabs.query({});
      const designTab = allTabs.find(t => isDesignUrl(t.url));
      if (designTab) return designTab;

      // 3. Any active tab across all windows
      const activeTabs = await chrome.tabs.query({ active: true });
      const candidate = activeTabs.find(t => !isInternalUrl(t.url));
      if (candidate) return candidate;

      // 4. Any valid webpage tab
      const anyWebTab = allTabs.find(t => !isInternalUrl(t.url));
      if (anyWebTab) return anyWebTab;

      return (focusedTabs && focusedTabs[0]) || (allTabs && allTabs[0]) || null;
    } catch (_) {}
    return null;
  }

  /**
   * Process commands originating from phone/tablet
   */
  async handleRemoteCommand(data) {
    if (!data || !data.action) return;

    this.remoteDeviceConnected = true;
    this.lastHandshake = Date.now();
    this._emit({ type: 'deviceConnected', device: data.device || 'Mobile Device' });

    // Notify extension views
    chrome.runtime.sendMessage({
      action: 'remoteDeviceConnected',
      device: data.device || 'Mobile Device'
    }).catch(() => {});

    // ── Handshake / Sync Request ──
    if (data.action === 'handshake' || data.action === 'requestSync' || data.action === 'ping') {
      const fullState = await this._collectFullState();
      this.broadcastStatus({
        action: 'handshakeAck',
        ack: true,
        state: fullState,
        serverTime: Date.now()
      });
      return;
    }

    // ── Typing Commands ──
    if (data.action === 'startTyping' || data.action === 'pauseTyping' || data.action === 'resumeTyping' || data.action === 'stopTyping' || data.action === 'updateSpeed') {
      const tab = await this._getTargetTab();
      if (tab?.id) {
        try {
          if (data.action === 'startTyping' && (!data.text || !data.text.trim())) {
            // No custom text sent from phone -> use extension's saved text
            await chrome.tabs.sendMessage(tab.id, { action: 'startTypingFromCommand' });
          } else {
            await chrome.tabs.sendMessage(tab.id, data);
          }
        } catch (_) {}
      }
      return;
    }

    // ── Design Mode Commands (Optimistic 0ms Latency Response + Reliable Tab Injection) ──
    if (data.action === 'designCmd') {
      const tab = await this._getTargetTab();
      const detectedPlatform = tab?.url ? this._detectPlatformFromUrl(tab.url, tab.title) : 'Web Editor';

      // 1. Instantly broadcast state change back to phone (Zero MQTT/UI lag!)
      if (data.cmd === 'start') {
        this.broadcastStatus({
          action: 'designStatus',
          detail: {
            state: 'running',
            platform: detectedPlatform,
            elapsed: 0,
            remaining: data.duration || 3600000,
            pct: 0,
            totalActions: 0,
            lastAction: 'Initializing autonomous design…',
            cursorSpeed: data.cursorSpeed || 'normal',
            operationSpeed: data.operationSpeed || 'normal',
          }
        });
      } else if (data.cmd === 'pause') {
        this.broadcastStatus({
          action: 'designStatus',
          detail: { state: 'paused', platform: detectedPlatform }
        });
      } else if (data.cmd === 'resume') {
        this.broadcastStatus({
          action: 'designStatus',
          detail: { state: 'running', platform: detectedPlatform }
        });
      } else if (data.cmd === 'stop') {
        this.broadcastStatus({
          action: 'designStatus',
          detail: { state: 'stopped', platform: detectedPlatform, totalActions: 0, pct: 0, elapsed: 0 }
        });
      }

      // 2. Dispatch to the target design tab
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, data);
        } catch (_) {
          // If content script was not yet present, inject and resend immediately
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/design-engine.js'],
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, data).catch(() => {});
            }, 60);
          } catch (_) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (payload) => window.postMessage(payload, '*'),
                args: [{
                  tbaDesign: data.cmd,
                  duration: data.duration,
                  cursorSpeed: data.cursorSpeed,
                  operationSpeed: data.operationSpeed,
                }],
              });
            } catch (_) {}
          }
        }
      }
      return;
    }

    if (data.action === 'designGetStatus') {
      const tab = await this._getTargetTab();
      const detectedPlatform = tab?.url ? this._detectPlatformFromUrl(tab.url, tab.title) : 'Web Editor';
      let dStatus = {
        running: false,
        paused: false,
        elapsed: 0,
        remaining: 3600000,
        pct: 0,
        totalActions: 0,
        platform: detectedPlatform,
        lastAction: 'Ready',
        cursorSpeed: 1.0,
        operationSpeed: 1.0,
      };
      if (tab?.id) {
        try {
          const res = await chrome.tabs.sendMessage(tab.id, data);
          if (res) dStatus = { ...dStatus, ...res };
        } catch (_) {}
      }
      this.broadcastStatus({ action: 'designStatus', detail: dStatus });
      return;
    }

    // ── Design Speed Update (Live Cursor & Operations Speed) ──
    if (data.action === 'designUpdateSpeed') {
      const tab = await this._getTargetTab();
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, data);
        } catch (_) {}
      }
      const toSave = {};
      if (data.cursorSpeed !== undefined) toSave.tba_design_cursor_speed = data.cursorSpeed;
      if (data.operationSpeed !== undefined) toSave.tba_design_operation_speed = data.operationSpeed;
      if (Object.keys(toSave).length > 0) {
        await chrome.storage.local.set(toSave);
      }
      this.broadcastStatus({
        action: 'designSpeedUpdated',
        cursorSpeed: data.cursorSpeed,
        operationSpeed: data.operationSpeed,
      });
      return;
    }

    // ── Settings Save ──
    if (data.action === 'saveSettings' && data.settings) {
      await chrome.storage.local.set(data.settings);
      this.broadcastStatus({ action: 'settingsSaved', settings: data.settings });
      return;
    }
  }

  async _collectFullState() {
    return new Promise(async (resolve) => {
      const tab = await this._getTargetTab();
      const detectedPlatform = tab?.url ? this._detectPlatformFromUrl(tab.url, tab.title) : 'Web Editor';
      let typingStatus = { status: 'idle', charIndex: 0, totalChars: 0 };
      let designStatus = {
        running: false,
        paused: false,
        elapsed: 0,
        remaining: 3600000,
        pct: 0,
        totalActions: 0,
        platform: detectedPlatform, // IMMEDIATELY DETECTED! Never 'Detecting...'
        lastAction: 'Ready',
        cursorSpeed: 1.0,
        operationSpeed: 1.0
      };

      if (tab?.id) {
        try {
          const tRes = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
          if (tRes) typingStatus = tRes;
        } catch (_) {}

        try {
          const dRes = await chrome.tabs.sendMessage(tab.id, { action: 'designGetStatus' });
          if (dRes) {
            designStatus = { ...designStatus, ...dRes };
            if (!designStatus.platform || designStatus.platform === 'unknown' || designStatus.platform === 'Detecting...') {
              designStatus.platform = detectedPlatform;
            }
          }
        } catch (_) {}
      }

      chrome.storage.local.get([
        'tba_delay', 'tba_linebreak_delay', 'tba_start_delay',
        'tba_last_text', 'tba_theme', 'tba_human_typo_mode',
        'tba_design_cursor_speed', 'tba_design_operation_speed'
      ], (storageRes) => {
        resolve({
          typing: typingStatus,
          design: designStatus,
          settings: {
            delay: storageRes.tba_delay || 50,
            linebreakDelay: storageRes.tba_linebreak_delay || 0,
            startDelay: storageRes.tba_start_delay || 0,
            lastText: storageRes.tba_last_text || '',
            theme: storageRes.tba_theme || 'dark',
            humanTypoMode: storageRes.tba_human_typo_mode !== undefined ? storageRes.tba_human_typo_mode : true,
            designCursorSpeed: storageRes.tba_design_cursor_speed || 'normal',
            designOperationSpeed: storageRes.tba_design_operation_speed || 'normal',
          }
        });
      });
    });
  }

  addListener(fn) {
    this.listeners.add(fn);
  }

  removeListener(fn) {
    this.listeners.delete(fn);
  }

  _emit(event) {
    for (const fn of this.listeners) {
      try { fn(event); } catch (_) {}
    }
  }
}

// Singleton instance for extension background & popup
const remoteBridge = new RemoteControlBridge();

globalThis.MiniMqttClient = MiniMqttClient;
globalThis.RemoteControlBridge = RemoteControlBridge;
globalThis.remoteBridge = remoteBridge;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MiniMqttClient, RemoteControlBridge, remoteBridge };
}


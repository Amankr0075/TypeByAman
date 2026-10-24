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

    // 2. Initialize WebSocket MQTT client
    const clientId = 'tba_ext_' + this.sessionId;
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
   * Process commands originating from phone/tablet
   */
  async handleRemoteCommand(data) {
    if (!data || !data.action) return;

    this.remoteDeviceConnected = true;
    this.lastHandshake = Date.now();
    this._emit({ type: 'deviceConnected', device: data.device || 'Mobile Device' });

    // ── Handshake / Sync Request ──
    if (data.action === 'handshake' || data.action === 'requestSync') {
      const fullState = await this._collectFullState();
      this.broadcastStatus({
        action: 'fullStateSync',
        state: fullState,
      });
      return;
    }

    // ── Typing Commands ──
    if (data.action === 'startTyping' || data.action === 'pauseTyping' || data.action === 'resumeTyping' || data.action === 'stopTyping' || data.action === 'updateSpeed') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, data);
        } catch (_) {}
      }
      return;
    }

    // ── Design Mode Commands ──
    if (data.action === 'designCmd' || data.action === 'designGetStatus') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Ensure design engine is injected
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/design-engine.js'],
          });
        } catch (_) {}

        try {
          await chrome.tabs.sendMessage(tab.id, data);
        } catch (_) {
          // Fallback to window message
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (payload) => window.postMessage(payload, '*'),
              args: [{ tbaDesign: data.cmd, duration: data.duration }],
            });
          } catch (_) {}
        }
      }
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let typingStatus = { status: 'idle', charIndex: 0, totalChars: 0 };
      let designStatus = { running: false, paused: false, elapsed: 0, remaining: 3600000, pct: 0, totalActions: 0, platform: 'Detecting...', lastAction: '—' };

      if (tab?.id) {
        try {
          const tRes = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
          if (tRes) typingStatus = tRes;
        } catch (_) {}

        try {
          const dRes = await chrome.tabs.sendMessage(tab.id, { action: 'designGetStatus' });
          if (dRes) designStatus = dRes;
        } catch (_) {}
      }

      chrome.storage.local.get([
        'tba_delay', 'tba_linebreak_delay', 'tba_start_delay',
        'tba_last_text', 'tba_theme', 'tba_human_typo_mode'
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

globalThis.RemoteControlBridge = RemoteControlBridge;
globalThis.remoteBridge = remoteBridge;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RemoteControlBridge, remoteBridge };
}


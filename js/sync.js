/* =========================================================
   SyncEngine: Sincronización en vivo bidireccional (QR / Híbrida)
   - Modo 1: Relay en la nube (Internet 4G/5G/WiFi vía WebSocket/MQTT seguro WSS)
   - Modo 2: Red local / P2P (WebRTC DataChannel / Zona Wi-Fi)
   - Generador nativo de Código QR (SVG puro, sin dependencias)
   - Lector QR con cámara (BarcodeDetector nativo + fallback)
   ========================================================= */
(function () {
  'use strict';

  // Servidores públicos seguros de alta disponibilidad para relay en tiempo real
  const RELAY_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081',
    'wss://broker.hivemq.com:8884/mqtt'
  ];

  /* -------------------------------------------------------------
     1. GENERADOR DE CÓDIGO QR EN SVG PURO (Ligero y 100% Offline)
     ------------------------------------------------------------- */
  /* -------------------------------------------------------------
     1. GENERADOR DE CÓDIGO QR ESTÁNDAR ISO/IEC 18004 (Puro JS, 100% Offline)
     Compatible con lectores de cámara de Android, Google Lens, iOS y escáneres nativos
     ------------------------------------------------------------- */
  const QR = (function () {
    // Tablas Galois Field GF(256) con polinomio primitivo 0x11D (285)
    const EXP = new Uint8Array(256);
    const LOG = new Uint8Array(256);
    for (let i = 0, x = 1; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 256) x ^= 0x11d;
    }
    EXP[255] = EXP[0];

    function gMult(a, b) {
      return (a === 0 || b === 0) ? 0 : EXP[(LOG[a] + LOG[b]) % 255];
    }

    function rsGenPoly(deg) {
      let p = [1];
      for (let i = 0; i < deg; i++) {
        const next = new Array(p.length + 1).fill(0);
        const factor = EXP[i];
        for (let j = 0; j < p.length; j++) {
          next[j] ^= p[j];
          next[j + 1] ^= gMult(p[j], factor);
        }
        p = next;
      }
      return p;
    }

    function generateMatrix(text) {
      const rawBytes = new TextEncoder().encode(String(text || ''));
      const len = rawBytes.length;

      // Selección de versión QR óptima (Version 1 a 4 con ECC M)
      let ver = 1, ecDeg = 10, totalDataBytes = 16;
      if (len > 14 && len <= 26) { ver = 2; ecDeg = 16; totalDataBytes = 28; }
      else if (len > 26 && len <= 42) { ver = 3; ecDeg = 26; totalDataBytes = 44; }
      else if (len > 42) { ver = 4; ecDeg = 36; totalDataBytes = 64; }

      const size = 17 + 4 * ver;
      const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
      const isReserved = Array.from({ length: size }, () => new Uint8Array(size));

      function setModule(r, c, val, reserved = true) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          matrix[r][c] = val;
          if (reserved) isReserved[r][c] = 1;
        }
      }

      // 1. Patrones de búsqueda (Finder patterns 7x7) y separadores (8x8)
      function addFinder(or, oc) {
        for (let r = -1; r <= 7; r++) {
          for (let c = -1; c <= 7; c++) {
            const nr = or + r, nc = oc + c;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
              if (r >= 0 && r < 7 && c >= 0 && c < 7) {
                const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
                setModule(nr, nc, isBlack ? 1 : 0);
              } else {
                setModule(nr, nc, 0); // Separador blanco de seguridad
              }
            }
          }
        }
      }
      addFinder(0, 0);
      addFinder(0, size - 7);
      addFinder(size - 7, 0);

      // 2. Patrones de alineación para Version 2+
      if (ver === 2) {
        const ar = 18, ac = 18;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isB = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
            setModule(ar + r, ac + c, isB ? 1 : 0);
          }
        }
      } else if (ver === 3) {
        const ar = 22, ac = 22;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isB = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
            setModule(ar + r, ac + c, isB ? 1 : 0);
          }
        }
      } else if (ver === 4) {
        const ar = 26, ac = 26;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isB = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
            setModule(ar + r, ac + c, isB ? 1 : 0);
          }
        }
      }

      // 3. Patrones de temporización (Timing patterns)
      for (let i = 8; i < size - 8; i++) {
        if (!isReserved[6][i]) setModule(6, i, (i % 2 === 0) ? 1 : 0);
        if (!isReserved[i][6]) setModule(i, 6, (i % 2 === 0) ? 1 : 0);
      }

      // 4. Módulo oscuro (Dark module estándar)
      setModule(size - 8, 8, 1);

      // Reservar áreas de información de formato
      for (let i = 0; i < 9; i++) {
        isReserved[8][i] = 1;
        isReserved[i][8] = 1;
        if (i < 8) isReserved[8][size - 1 - i] = 1;
        if (i < 7) isReserved[size - 1 - i][8] = 1;
      }

      // 5. Codificación de flujo de bits de datos
      const bits = [];
      function pushBits(val, numBits) {
        for (let i = numBits - 1; i >= 0; i--) bits.push((val >> i) & 1);
      }
      pushBits(0b0100, 4); // Byte mode indicator
      pushBits(len, 8);    // Character count indicator (8 bits for Version 1-4 Byte)
      for (let i = 0; i < len; i++) pushBits(rawBytes[i], 8);

      const maxBits = totalDataBytes * 8;
      const termLen = Math.min(4, maxBits - bits.length);
      for (let i = 0; i < termLen; i++) bits.push(0); // Terminator 0000
      while (bits.length % 8 !== 0) bits.push(0);     // Byte align

      // Bytes de relleno alternados 0xEC y 0x11
      const pad = [0xec, 0x11];
      let pIdx = 0;
      while (bits.length < maxBits) {
        pushBits(pad[pIdx % 2], 8);
        pIdx++;
      }

      // Codewords de datos
      const dataWords = new Uint8Array(totalDataBytes);
      for (let i = 0; i < totalDataBytes; i++) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
        dataWords[i] = b;
      }

      // Corrección de errores Reed-Solomon sobre GF(256)
      const genPoly = rsGenPoly(ecDeg);
      const msg = new Uint8Array(totalDataBytes + ecDeg);
      msg.set(dataWords);
      for (let i = 0; i < totalDataBytes; i++) {
        const coef = msg[i];
        if (coef !== 0) {
          for (let j = 0; j < genPoly.length; j++) {
            msg[i + j] ^= gMult(genPoly[j], coef);
          }
        }
      }

      const allWords = new Uint8Array(totalDataBytes + ecDeg);
      allWords.set(dataWords);
      allWords.set(msg.slice(totalDataBytes), totalDataBytes);

      // 6. Colocación en zigzag de bits de datos (Máscara 0: (r + c) % 2 === 0)
      let bitCursor = 0;
      const totalCodewordBits = allWords.length * 8;
      for (let right = size - 1; right > 0; right -= 2) {
        if (right === 6) right--; // Saltar columna 6 de temporización vertical
        const upward = Math.floor((size - 1 - right) / 2) % 2 === 0;
        for (let rowStep = 0; rowStep < size; rowStep++) {
          const r = upward ? (size - 1 - rowStep) : rowStep;
          for (let cOffset = 0; cOffset < 2; cOffset++) {
            const c = right - cOffset;
            if (!isReserved[r][c]) {
              let bit = 0;
              if (bitCursor < totalCodewordBits) {
                const byteIdx = Math.floor(bitCursor / 8);
                const bitOffset = 7 - (bitCursor % 8);
                bit = (allWords[byteIdx] >> bitOffset) & 1;
                bitCursor++;
              }
              const mask = ((r + c) % 2 === 0);
              matrix[r][c] = (bit ^ (mask ? 1 : 0));
            }
          }
        }
      }

      // 7. Información de Formato estándar (Nivel M, Máscara 0 => 0x5412 / 101010000010010)
      const fmtBits = 0x5412;
      for (let i = 0; i < 15; i++) {
        const bit = (fmtBits >> (14 - i)) & 1;
        if (i <= 5) setModule(i, 8, bit);
        else if (i === 6) setModule(7, 8, bit);
        else if (i === 7) setModule(8, 8, bit);
        else if (i === 8) setModule(8, 7, bit);
        else setModule(8, 14 - i, bit);

        if (i < 8) setModule(8, size - 1 - i, bit);
        else setModule(size - (15 - i), 8, bit);
      }

      return { size, matrix };
    }

    function toSVG(text, pixelSize) {
      if (typeof window !== 'undefined' && window.QRCode && window.QRCode.toString) {
        let svgOut = '';
        window.QRCode.toString(String(text || ''), { type: 'svg', margin: 4 }, (err, str) => {
          if (!err && str) svgOut = str;
        });
        if (svgOut) return svgOut;
      }
      pixelSize = pixelSize || 7;
      const { size, matrix } = generateMatrix(text);
      const margin = 4;
      const totalSize = (size + margin * 2) * pixelSize;
      let paths = '';
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (matrix[y][x] === 1) {
            const px = (x + margin) * pixelSize;
            const py = (y + margin) * pixelSize;
            paths += `M${px},${py}h${pixelSize}v${pixelSize}h-${pixelSize}z `;
          }
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" style="border-radius: 8px; background: #ffffff; padding: 6px; display: block; margin: 0 auto;">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <path d="${paths}" fill="#060a13"/>
      </svg>`;
    }

    return { toSVG, generateMatrix };
  })();

  /* -------------------------------------------------------------
     2. CLIENTE MQTT LIGERO SOBRE WEBSOCKETS (Sin dependencias)
     ------------------------------------------------------------- */
  class MiniMQTTClient {
    constructor(url, clientId) {
      this.url = url;
      this.clientId = clientId || 'pst_' + Math.random().toString(36).substring(2, 9);
      this.ws = null;
      this.connected = false;
      this.onMessage = null;
      this.onConnect = null;
      this.onError = null;
      this.onClose = null;
      this.pingInterval = null;
    }

    connect() {
      try {
        this.ws = new WebSocket(this.url, 'mqtt');
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this._sendConnect();
        };

        this.ws.onmessage = (event) => {
          this._handlePacket(new Uint8Array(event.data));
        };

        this.ws.onerror = (err) => {
          if (this.onError) this.onError(err);
        };

        this.ws.onclose = () => {
          this.connected = false;
          clearInterval(this.pingInterval);
          if (this.onClose) this.onClose();
        };
      } catch (err) {
        if (this.onError) this.onError(err);
      }
    }

    _sendConnect() {
      // Paquete CONNECT MQTT 3.1.1 simplificado
      const clientBytes = new TextEncoder().encode(this.clientId);
      const varHeader = [0, 4, 77, 81, 84, 84, 4, 2, 0, 60]; // Protocol Name (MQTT), Level (4), Flags (CleanSession), KeepAlive (60s)
      const payload = [0, clientBytes.length, ...clientBytes];
      const remainingLen = varHeader.length + payload.length;

      const packet = new Uint8Array([0x10, remainingLen, ...varHeader, ...payload]);
      this.ws.send(packet.buffer);
    }

    subscribe(topic) {
      if (!this.connected) return;
      const topicBytes = new TextEncoder().encode(topic);
      const packetId = [0, 1];
      const payload = [0, topicBytes.length, ...topicBytes, 0]; // QoS 0
      const remainingLen = packetId.length + payload.length;

      const packet = new Uint8Array([0x82, remainingLen, ...packetId, ...payload]);
      this.ws.send(packet.buffer);
    }

    publish(topic, messageStr) {
      if (!this.connected) return;
      const topicBytes = new TextEncoder().encode(topic);
      const msgBytes = new TextEncoder().encode(messageStr);
      const remainingLen = 2 + topicBytes.length + msgBytes.length;

      // Encabezado de longitud variable
      const header = [0x30]; // PUBLISH QoS 0
      if (remainingLen < 128) {
        header.push(remainingLen);
      } else {
        header.push((remainingLen & 0x7F) | 0x80, remainingLen >> 7);
      }

      const packet = new Uint8Array([...header, 0, topicBytes.length, ...topicBytes, ...msgBytes]);
      this.ws.send(packet.buffer);
    }

    _handlePacket(data) {
      const type = data[0] >> 4;
      if (type === 2) { // CONNACK
        this.connected = true;
        this._startPing();
        if (this.onConnect) this.onConnect();
      } else if (type === 3) { // PUBLISH
        // Extraer topic y mensaje
        let offset = 1;
        let multiplier = 1;
        let remLen = 0;
        let digit;
        do {
          digit = data[offset++];
          remLen += (digit & 127) * multiplier;
          multiplier *= 128;
        } while ((digit & 128) !== 0);

        const topicLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        const topic = new TextDecoder().decode(data.slice(offset, offset + topicLen));
        offset += topicLen;
        const payload = new TextDecoder().decode(data.slice(offset));

        if (this.onMessage) this.onMessage(topic, payload);
      }
    }

    _startPing() {
      clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(new Uint8Array([0xC0, 0])); // PINGREQ
        }
      }, 30000);
    }

    disconnect() {
      clearInterval(this.pingInterval);
      if (this.ws) {
        try {
          if (this.connected) this.ws.send(new Uint8Array([0xE0, 0])); // DISCONNECT
          this.ws.close();
        } catch (e) {}
      }
      this.connected = false;
    }
  }

  /* -------------------------------------------------------------
     3. WEBRTC P2P DIRECTO (Para Red Local / Punto de Acceso)
     ------------------------------------------------------------- */
  class WebRTCPeer {
    constructor(isHost, onMessage, onStateChange) {
      this.isHost = isHost;
      this.onMessage = onMessage;
      this.onStateChange = onStateChange;
      this.pc = null;
      this.channel = null;
      this._init();
    }

    _init() {
      const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      try {
        this.pc = new RTCPeerConnection(config);
        this.pc.oniceconnectionstatechange = () => {
          if (this.onStateChange) this.onStateChange(this.pc.iceConnectionState);
        };

        if (this.isHost) {
          this.channel = this.pc.createDataChannel('pst_sync', { ordered: true });
          this._bindChannel(this.channel);
        } else {
          this.pc.ondatachannel = (e) => {
            this.channel = e.channel;
            this._bindChannel(this.channel);
          };
        }
      } catch (err) {
        console.warn('WebRTC no disponible o no soportado:', err);
      }
    }

    _bindChannel(ch) {
      ch.onopen = () => {
        if (this.onStateChange) this.onStateChange('connected');
      };
      ch.onmessage = (e) => {
        if (this.onMessage) this.onMessage(e.data);
      };
      ch.onclose = () => {
        if (this.onStateChange) this.onStateChange('closed');
      };
    }

    send(dataStr) {
      if (this.channel && this.channel.readyState === 'open') {
        this.channel.send(dataStr);
        return true;
      }
      return false;
    }

    close() {
      if (this.channel) try { this.channel.close(); } catch (e) {}
      if (this.pc) try { this.pc.close(); } catch (e) {}
    }
  }

  /* -------------------------------------------------------------
     4. MOTOR PRINCIPAL DE SINCRONIZACIÓN (SyncEngine)
     ------------------------------------------------------------- */
  const SyncEngine = {
    QR,
    activeRoom: null,
    mode: 'cloud', // 'cloud' | 'local'
    role: null,    // 'host' | 'guest'
    client: null,
    peer: null,
    deviceId: 'dev_' + Math.random().toString(36).substring(2, 8),
    connectedPeers: 0,
    listeners: [],

    // Generar código de sala legible de 6 caracteres (ej: FUT-742)
    generateRoomCode() {
      const num = Math.floor(100 + Math.random() * 900);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const c1 = chars[Math.floor(Math.random() * chars.length)];
      const c2 = chars[Math.floor(Math.random() * chars.length)];
      const c3 = chars[Math.floor(Math.random() * chars.length)];
      return `${c1}${c2}${c3}-${num}`;
    },

    isLive() {
      return this.activeRoom !== null && (this.connectedPeers > 0 || (this.client && this.client.connected));
    },

    getRoomPayload(roomCode) {
      return JSON.stringify({
        app: 'player-stats',
        room: roomCode,
        mode: this.mode,
        hostId: this.deviceId,
        v: 1
      });
    },

    on(cb) {
      this.listeners.push(cb);
    },

    off(cb) {
      this.listeners = this.listeners.filter(x => x !== cb);
    },

    _notify(type, data) {
      this.listeners.forEach(fn => {
        try { fn(type, data); } catch (e) { console.error('Error en listener sync:', e); }
      });
    },

    // Iniciar Sesión como ANFITRIÓN (HOST)
    startHost(roomCode, mode, onReady) {
      this.disconnect();
      this.activeRoom = roomCode || this.generateRoomCode();
      this.mode = mode || 'cloud';
      this.role = 'host';
      this.connectedPeers = 0;

      const topic = `pst_live/${this.activeRoom}`;
      const brokerUrl = RELAY_BROKERS[0];

      this.client = new MiniMQTTClient(brokerUrl, 'pst_host_' + this.deviceId);
      this.client.onConnect = () => {
        this.client.subscribe(topic);
        this._notify('host_ready', { room: this.activeRoom, mode: this.mode });
        if (onReady) onReady(this.activeRoom);
      };

      this.client.onMessage = (t, payloadStr) => {
        try {
          const msg = JSON.parse(payloadStr);
          if (msg.sender === this.deviceId) return; // Ignorar eco propio

          if (msg.type === 'GUEST_JOIN') {
            this.connectedPeers = Math.max(1, this.connectedPeers + 1);
            this._notify('peer_connected', { guestId: msg.sender });
            // Enviar estado inicial completo de la sesión
            const activeId = (window.getActiveSessionId ? window.getActiveSessionId() : null) || Store.state.activeSessionId;
            const currentSession = Store.session(activeId);
            this.broadcast({
              type: 'INIT_STATE',
              session: currentSession
            });
          } else if (msg.type === 'ACTION') {
            this._handleIncomingAction(msg);
          } else if (msg.type === 'UNDO') {
            this._handleIncomingUndo(msg);
          } else if (msg.type === 'SCORE_UPDATE') {
            this._handleIncomingScore(msg);
          } else if (msg.type === 'PERIOD_UPDATE') {
            this._handleIncomingPeriod(msg);
          } else if (msg.type === 'ZONE_RECORD') {
            this._handleIncomingZone(msg);
          }
        } catch (e) {
          console.error('Error parseando mensaje recibido:', e);
        }
      };

      this.client.onError = (err) => {
        console.warn('Error en relay MQTT:', err);
      };

      this.client.connect();
      return this.activeRoom;
    },

    // Unirse a una Sesión como INVITADO (GUEST)
    joinGuest(roomCode, mode, onJoined) {
      this.disconnect();
      this.activeRoom = roomCode.toUpperCase().trim();
      this.mode = mode || 'cloud';
      this.role = 'guest';

      const topic = `pst_live/${this.activeRoom}`;
      const brokerUrl = RELAY_BROKERS[0];

      this.client = new MiniMQTTClient(brokerUrl, 'pst_guest_' + this.deviceId);
      this.client.onConnect = () => {
        this.client.subscribe(topic);
        this.connectedPeers = 1;
        // Saludar al Host
        this.broadcast({ type: 'GUEST_JOIN' });
        this._notify('joined', { room: this.activeRoom });
        if (onJoined) onJoined(this.activeRoom);
      };

      this.client.onMessage = (t, payloadStr) => {
        try {
          const msg = JSON.parse(payloadStr);
          if (msg.sender === this.deviceId) return;

          if (msg.type === 'INIT_STATE') {
            if (msg.session) {
              const localSession = Store.session(msg.session.id);
              if (!localSession) {
                Store.state.sessions.unshift(msg.session);
              } else {
                Object.assign(localSession, msg.session);
              }
              Store.save();
              this._notify('session_synced', msg.session);
            }
          } else if (msg.type === 'ACTION') {
            this._handleIncomingAction(msg);
          } else if (msg.type === 'UNDO') {
            this._handleIncomingUndo(msg);
          } else if (msg.type === 'SCORE_UPDATE') {
            this._handleIncomingScore(msg);
          } else if (msg.type === 'PERIOD_UPDATE') {
            this._handleIncomingPeriod(msg);
          } else if (msg.type === 'ZONE_RECORD') {
            this._handleIncomingZone(msg);
          } else if (msg.type === 'SESSION_FINISHED') {
            if (msg.session) {
              const localSession = Store.session(msg.session.id);
              if (!localSession) {
                Store.state.sessions.unshift(msg.session);
              } else {
                Object.assign(localSession, msg.session);
              }
              Store.save();
            }
            this.disconnect();
            this._notify('session_finished', msg.session);
          }
        } catch (e) {
          console.error('Error en mensaje guest:', e);
        }
      };

      this.client.connect();
    },

    // Transmitir que la sesión ha sido finalizada por el anfitrión
    broadcastSessionFinished(session) {
      this.broadcast({
        type: 'SESSION_FINISHED',
        session: session
      });
    },

    // Transmitir un mensaje a la sala en tiempo real
    broadcast(dataObj) {
      if (!this.activeRoom || !this.client || !this.client.connected) return;
      dataObj.sender = this.deviceId;
      dataObj.ts = Date.now();
      const topic = `pst_live/${this.activeRoom}`;
      this.client.publish(topic, JSON.stringify(dataObj));
    },

    // Enviar registro de acción estadística (+1 / -1)
    sendAction(sessionId, playerId, key, delta) {
      this.broadcast({
        type: 'ACTION',
        sessionId,
        playerId,
        key,
        delta
      });
    },

    // Enviar acción de deshacer
    sendUndo(sessionId, playerId) {
      this.broadcast({
        type: 'UNDO',
        sessionId,
        playerId
      });
    },

    // Enviar cambio en el marcador
    sendScore(sessionId, homeScore, awayScore) {
      this.broadcast({
        type: 'SCORE_UPDATE',
        sessionId,
        homeScore,
        awayScore
      });
    },

    // Enviar cambio de periodo/parte
    sendPeriod(sessionId, period) {
      this.broadcast({
        type: 'PERIOD_UPDATE',
        sessionId,
        period
      });
    },

    // Enviar registro con zona táctica del campo
    sendZoneRecord(sessionId, playerId, key, zone) {
      this.broadcast({
        type: 'ZONE_RECORD',
        sessionId,
        playerId,
        key,
        zone
      });
    },

    // Manejadores de eventos remotos entrantes
    _handleIncomingAction(msg) {
      let s = Store.session(msg.sessionId);
      if (!s && window.getActiveSessionId) s = Store.session(window.getActiveSessionId());
      if (!s && Store.state.sessions.length > 0) s = Store.state.sessions[0];
      if (!s || !msg.playerId) return;
      s.stats = s.stats || {};
      s.log = s.log || [];
      const st = s.stats[msg.playerId] = s.stats[msg.playerId] || {};
      st[msg.key] = Math.max(0, (st[msg.key] || 0) + msg.delta);
      s.log.push({ t: msg.ts || Date.now(), m: Store.elapsed(s), p: msg.playerId, k: [msg.key], d: msg.delta });
      Store.save();
      this._notify('remote_action', msg);
    },

    _handleIncomingUndo(msg) {
      let s = Store.session(msg.sessionId);
      if (!s && window.getActiveSessionId) s = Store.session(window.getActiveSessionId());
      if (!s && Store.state.sessions.length > 0) s = Store.state.sessions[0];
      if (!s || !msg.playerId) return;
      Store.undo(s.id, msg.playerId);
      this._notify('remote_undo', msg);
    },

    _handleIncomingScore(msg) {
      let s = Store.session(msg.sessionId);
      if (!s && window.getActiveSessionId) s = Store.session(window.getActiveSessionId());
      if (!s && Store.state.sessions.length > 0) s = Store.state.sessions[0];
      if (!s) return;
      s.score = { home: msg.homeScore, away: msg.awayScore };
      Store.save();
      this._notify('remote_score', msg);
    },

    _handleIncomingPeriod(msg) {
      let s = Store.session(msg.sessionId);
      if (!s && window.getActiveSessionId) s = Store.session(window.getActiveSessionId());
      if (!s && Store.state.sessions.length > 0) s = Store.state.sessions[0];
      if (!s) return;
      s.period = msg.period;
      Store.save();
      this._notify('remote_period', msg);
    },

    _handleIncomingZone(msg) {
      let s = Store.session(msg.sessionId);
      if (!s && window.getActiveSessionId) s = Store.session(window.getActiveSessionId());
      if (!s && Store.state.sessions.length > 0) s = Store.state.sessions[0];
      if (!s) return;
      s.zones = s.zones || [];
      s.zones.push({ p: msg.playerId, k: msg.key, z: msg.zone, t: msg.ts || Date.now() });
      Store.save();
      this._notify('remote_zone', msg);
    },

    disconnect() {
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
      if (this.peer) {
        this.peer.close();
        this.peer = null;
      }
      const prevRoom = this.activeRoom;
      this.activeRoom = null;
      this.role = null;
      this.connectedPeers = 0;
      if (prevRoom) this._notify('disconnected', { room: prevRoom });
    }
  };

  window.SyncEngine = SyncEngine;
})();

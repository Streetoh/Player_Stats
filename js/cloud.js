/* =========================================================
   CloudEngine (Firebase Firestore Sincronización en la Nube)
   Proyecto: player-stats-2ac9d
   - App Maestra (Entrenador): Sube jugadores, partidos y convocatorias.
   - App Jugadores: Lee datos en vivo y emite votos de asistencia.
   - Tiempo real bidireccional vía Firestore onSnapshot.
   ========================================================= */
(function (global) {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAC0np50XF3SVx2AHFv8LAFKaQuT-48nhw",
    authDomain: "player-stats-2ac9d.firebaseapp.com",
    projectId: "player-stats-2ac9d",
    storageBucket: "player-stats-2ac9d.firebasestorage.app",
    messagingSenderId: "676532397017",
    appId: "1:676532397017:web:d5942408db89c644c8afc8",
    measurementId: "G-5M1D2VTHXB"
  };

  let db = null;
  let isReady = false;
  let isSyncing = false;
  let lastPushTime = 0;
  let pushPendingTimer = null;
  let statusListeners = [];
  let responseUnsubscribe = null;
  let stateUnsubscribe = null;

  const CLUB_ID = 'default_club';

  let knownRemotePlayerIds = null;
  let knownRemoteConvIds = null;
  let knownRemoteSessionIds = null;

  // Cachés de hashes para sincronización delta incremental (ahorro del 95% de escrituras Firestore)
  let syncedHashes = {
    root: '',
    players: {},
    convocations: {},
    sessions: {}
  };
  let lastPresenceSendTimes = {};

  async function commitBatchOperations(operations) {
    if (!operations || !operations.length) return;
    const CHUNK_SIZE = 250;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach(op => op(batch));
      await Promise.race([
        batch.commit(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de Firestore al confirmar lote de datos (10s)')), 10000))
      ]);
    }
  }

  const Cloud = {
    config: FIREBASE_CONFIG,
    lastError: null,

    // Comprime fotos pesadas en Base64 a miniaturas optimizadas para no superar el límite de 1MB de Firestore
    _compressPhotoForCloud: function (photoDataUrl, maxDim = 128, quality = 0.68) {
      return new Promise((resolve) => {
        if (!photoDataUrl || typeof photoDataUrl !== 'string' || !photoDataUrl.startsWith('data:image')) {
          return resolve(photoDataUrl || '');
        }
        if (photoDataUrl.length < 8000) return resolve(photoDataUrl);

        try {
          const img = new Image();
          img.onload = () => {
            try {
              let w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (e) {
              resolve(photoDataUrl);
            }
          };
          img.onerror = () => resolve(photoDataUrl);
          img.src = photoDataUrl;
        } catch (e) {
          resolve(photoDataUrl);
        }
      });
    },

    init: function () {
      if (isReady && db) return true;

      try {
        if (!global.firebase) {
          console.warn('[Cloud] Firebase SDK no cargado todavía.');
          return false;
        }

        if (!global.firebase.apps.length) {
          global.firebase.initializeApp(FIREBASE_CONFIG);
        }

        db = global.firebase.firestore();
        isReady = true;
        console.log('[Cloud] Firebase Firestore inicializado con éxito.');
        this._notifyStatus('connected');
        return true;
      } catch (err) {
        console.error('[Cloud] Error inicializando Firebase:', err);
        this.lastError = err && err.message ? err.message : String(err);
        this._notifyStatus('error');
        return false;
      }
    },

    isReady: function () {
      return isReady && db !== null;
    },

    onStatusChange: function (cb) {
      if (typeof cb === 'function') statusListeners.push(cb);
    },

    _notifyStatus: function (status, detail) {
      statusListeners.forEach(fn => {
        try { fn(status, detail); } catch (e) {}
      });
    },

    /* -------------------------------------------------------------
       1. FUNCIONES PARA EL ENTRENADOR (APP MAESTRA)
       ------------------------------------------------------------- */

    // Sube el estado completo (jugadores, sesiones, convocatorias, equipos, entrenador, horarios) a Firestore de forma modular en subcolecciones
    pushCoachState: async function (stateData, force = false) {
      this.lastError = null;
      if (!this.init()) {
        this.lastError = 'Firebase SDK no disponible en este dispositivo.';
        return false;
      }
      if (!stateData) {
        this.lastError = 'Estado vacío';
        return false;
      }

      const now = Date.now();
      if (!force && (isSyncing || now - lastPushTime < 1200)) {
        clearTimeout(pushPendingTimer);
        pushPendingTimer = setTimeout(() => {
          this.pushCoachState(stateData, true);
        }, Math.max(400, 1300 - (now - lastPushTime)));
        return true;
      }
      clearTimeout(pushPendingTimer);
      lastPushTime = now;

      try {
        isSyncing = true;
        this._notifyStatus('syncing');

        // Optimizar y comprimir fotos de jugadores
        const sanitizedPlayers = await Promise.all((stateData.players || []).map(async (p) => {
          const copy = Object.assign({}, p);
          delete copy.originalPhoto;
          delete copy.cropSettings;
          if (copy.photo && copy.photo.length > 8000) {
            copy.photo = await Cloud._compressPhotoForCloud(copy.photo, 128, 0.68);
          }
          return copy;
        }));

        let sanitizedCoachProfile = Object.assign({}, stateData.coachProfile || {});
        if (sanitizedCoachProfile.photo && sanitizedCoachProfile.photo.length > 10000) {
          sanitizedCoachProfile.photo = await Cloud._compressPhotoForCloud(sanitizedCoachProfile.photo, 140, 0.7);
        }

        function cleanUndefined(obj) {
          if (obj === null || obj === undefined) return obj;
          if (typeof obj !== 'object') return obj;
          if (global.firebase && global.firebase.firestore) {
            if (obj instanceof global.firebase.firestore.FieldValue ||
                obj instanceof global.firebase.firestore.Timestamp ||
                obj instanceof global.firebase.firestore.GeoPoint) {
              return obj;
            }
          }
          if (obj.constructor && (
              obj.constructor.name === 'FieldValue' ||
              obj.constructor.name === 'Timestamp' ||
              obj.constructor.name === 'GeoPoint' ||
              obj.constructor.name === 'Blob' ||
              obj.constructor.name === 'DocumentReference')) {
            return obj;
          }
          if (Array.isArray(obj)) return obj.map(cleanUndefined);
          const out = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) out[k] = cleanUndefined(v);
          }
          return out;
        }

        const clubRef = db.collection('clubs').doc(CLUB_ID);

        // 1. Guardar documento raíz (configuración, perfil, equipos, horarios recurrentes y metadatos)
        // Se purgan 'players', 'convocations', 'sessions' del doc raíz para evitar superar el límite de 1MB de Firestore
        const rootPayload = {
          teams: stateData.teams || [],
          recurringSchedules: stateData.recurringSchedules || [],
          coachProfile: sanitizedCoachProfile,
          settings: {
            lang: (stateData.settings && stateData.settings.lang) || 'es',
            clubName: (stateData.settings && stateData.settings.clubName) || 'Jõhvi JK Noova',
            convocatoriaWebUrl: (stateData.settings && stateData.settings.convocatoriaWebUrl) || '',
            forceCachePurgeTimestamp: (stateData.settings && stateData.settings.forceCachePurgeTimestamp) || 0
          },
          schemaVersion: 2,
          updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
          clientTime: now,
          players: global.firebase.firestore.FieldValue.delete(),
          convocations: global.firebase.firestore.FieldValue.delete(),
          sessions: global.firebase.firestore.FieldValue.delete()
        };

        const rootHash = JSON.stringify({
          teams: rootPayload.teams,
          recurringSchedules: rootPayload.recurringSchedules,
          coachProfile: rootPayload.coachProfile,
          settings: rootPayload.settings
        });

        // Solo escribe el doc raíz si ha cambiado o si se fuerza la primera sincronización
        if (syncedHashes.root !== rootHash) {
          await clubRef.set(cleanUndefined(rootPayload), { merge: true });
          syncedHashes.root = rootHash;
        }

        // 2. Inicializar conjuntos de IDs remotos si es la primera sincronización de la sesión
        if (knownRemotePlayerIds === null || knownRemoteConvIds === null || knownRemoteSessionIds === null) {
          try {
            const [pSnap, cSnap, sSnap] = await Promise.race([
              Promise.all([
                clubRef.collection('players').get(),
                clubRef.collection('convocations').get(),
                clubRef.collection('sessions').get()
              ]),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);
            knownRemotePlayerIds = new Set(pSnap.docs.map(d => d.id));
            knownRemoteConvIds = new Set(cSnap.docs.map(d => d.id));
            knownRemoteSessionIds = new Set(sSnap.docs.map(d => d.id));
          } catch (e) {
            console.warn('[Cloud] Error o timeout inicializando IDs remotos:', e);
            knownRemotePlayerIds = new Set();
            knownRemoteConvIds = new Set();
            knownRemoteSessionIds = new Set();
          }
        }

        const batchOps = [];

        // 3. Subcolección de Jugadores (clubs/default_club/players/{playerId}) - DELTA SYNC
        const activePlayerIds = new Set();
        sanitizedPlayers.forEach(p => {
          if (!p || !p.id) return;
          activePlayerIds.add(p.id);
          knownRemotePlayerIds.add(p.id);

          const cleanP = cleanUndefined(p);
          // Si el jugador ya no está desvinculado, eliminar la propiedad unlinkedAt de Firestore
          if (!cleanP.unlinkedAt && global.firebase?.firestore?.FieldValue) {
            cleanP.unlinkedAt = global.firebase.firestore.FieldValue.delete();
          }
          const pHash = JSON.stringify(cleanP);

          if (syncedHashes.players[p.id] !== pHash) {
            const pRef = clubRef.collection('players').doc(p.id);
            batchOps.push(batch => batch.set(pRef, cleanP, { merge: true }));
            syncedHashes.players[p.id] = pHash;
          }
        });
        knownRemotePlayerIds.forEach(id => {
          if (!activePlayerIds.has(id)) {
            const pRef = clubRef.collection('players').doc(id);
            batchOps.push(batch => batch.delete(pRef));
            knownRemotePlayerIds.delete(id);
            delete syncedHashes.players[id];
          }
        });

        // 4. Subcolección de Convocatorias (clubs/default_club/convocations/{convId}) - DELTA SYNC
        const activeConvIds = new Set();
        (stateData.convocations || []).forEach(c => {
          if (!c || !c.id) return;
          activeConvIds.add(c.id);
          knownRemoteConvIds.add(c.id);

          const cleanC = cleanUndefined(c);
          const cHash = JSON.stringify(cleanC);

          if (syncedHashes.convocations[c.id] !== cHash) {
            const cRef = clubRef.collection('convocations').doc(c.id);
            batchOps.push(batch => batch.set(cRef, cleanC, { merge: true }));
            syncedHashes.convocations[c.id] = cHash;
          }
        });
        knownRemoteConvIds.forEach(id => {
          if (!activeConvIds.has(id)) {
            const cRef = clubRef.collection('convocations').doc(id);
            batchOps.push(batch => batch.delete(cRef));
            knownRemoteConvIds.delete(id);
            delete syncedHashes.convocations[id];
          }
        });

        // 5. Subcolección de Sesiones (clubs/default_club/sessions/{sessionId}) - DELTA SYNC
        const activeSessIds = new Set();
        (stateData.sessions || []).forEach(s => {
          if (!s || !s.id) return;
          activeSessIds.add(s.id);
          knownRemoteSessionIds.add(s.id);

          const cleanS = cleanUndefined(s);
          const sHash = JSON.stringify(cleanS);

          if (syncedHashes.sessions[s.id] !== sHash) {
            const sRef = clubRef.collection('sessions').doc(s.id);
            batchOps.push(batch => batch.set(sRef, cleanS, { merge: true }));
            syncedHashes.sessions[s.id] = sHash;
          }
        });
        knownRemoteSessionIds.forEach(id => {
          if (!activeSessIds.has(id)) {
            const sRef = clubRef.collection('sessions').doc(id);
            batchOps.push(batch => batch.delete(sRef));
            knownRemoteSessionIds.delete(id);
            delete syncedHashes.sessions[id];
          }
        });

        // 6. Ejecutar en lotes atómicos seguros solo los cambios pendientes
        if (batchOps.length > 0) {
          await commitBatchOperations(batchOps);
        }

        isSyncing = false;
        this.lastError = null;
        this._notifyStatus('synced', now);
        return true;
      } catch (err) {
        isSyncing = false;
        const errMsg = err && err.message ? err.message : String(err);
        this.lastError = errMsg;
        console.error('[Cloud] Error subiendo estado modular del entrenador:', err);
        if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || errMsg.includes('quota-exceeded')) {
          this.lastError = 'QUOTA_EXCEEDED';
        }
        this._notifyStatus('error', this.lastError);
        return false;
      } finally {
        isSyncing = false;
      }
    },

    // Escucha en tiempo real las respuestas de asistencia de los jugadores
    startListeningToResponses: function (onResponseCallback) {
      if (!this.init()) return;
      if (responseUnsubscribe) {
        try { responseUnsubscribe(); } catch (e) {}
        responseUnsubscribe = null;
      }

      let isFirstSnapshot = true;
      try {
        // Escucha la subcolección 'responses' del club
        responseUnsubscribe = db.collection('clubs')
          .doc(CLUB_ID)
          .collection('responses')
          .onSnapshot((snapshot) => {
            if (isFirstSnapshot) {
              // Carga inicial: sincroniza estado silenciosamente sin spamear toasts
              snapshot.forEach((doc) => {
                const data = doc.data();
                if (data && data.convId && data.playerId) {
                  if (typeof onResponseCallback === 'function') {
                    onResponseCallback(data, true);
                  }
                }
              });
              isFirstSnapshot = false;
              return;
            }

            // Cambios en vivo recibidos tras el inicio
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                const data = change.doc.data() || {};
                const parts = change.doc.id.split('_');
                const convId = data.convId || parts[0];
                const playerId = data.playerId || parts[1];
                if (convId && playerId) {
                  const pendingData = Object.assign({}, data, { convId, playerId, status: 'pending' });
                  if (typeof onResponseCallback === 'function') {
                    onResponseCallback(pendingData, false);
                  } else if (typeof window !== 'undefined' && typeof window.onPlayerAttendanceResponse === 'function') {
                    window.onPlayerAttendanceResponse(pendingData, false);
                  }
                }
              } else if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                if (data && data.convId && data.playerId) {
                  if (typeof onResponseCallback === 'function') {
                    onResponseCallback(data, false);
                  } else if (typeof window !== 'undefined' && typeof window.onPlayerAttendanceResponse === 'function') {
                    window.onPlayerAttendanceResponse(data, false);
                  }
                }
              }
            });
          }, (error) => {
            console.warn('[Cloud] Error escuchando respuestas de jugadores:', error);
          });
      } catch (err) {
        console.error('[Cloud] Error iniciando listener de respuestas:', err);
      }
    },

    /* -------------------------------------------------------------
       2. FUNCIONES PARA LOS JUGADORES (PORTAL JUGADOR / PWA)
       ------------------------------------------------------------- */

    // Carga o escucha el estado publicado por el entrenador en tiempo real desde subcolecciones modulares
    listenToClubState: function (onStateUpdate) {
      if (!this.init()) return null;

      try {
        if (stateUnsubscribe) {
          try { stateUnsubscribe(); } catch (e) {}
          stateUnsubscribe = null;
        }

        const clubRef = db.collection('clubs').doc(CLUB_ID);

        let currentRootData = null;
        let currentPlayers = [];
        let currentConvocations = [];
        let currentSessions = [];
        let hasReceivedPlayersSnapshot = false;
        let hasReceivedConvsSnapshot = false;
        let hasReceivedSessionsSnapshot = false;

        function emitCombinedState() {
          if (typeof onStateUpdate !== 'function') return;
          const root = currentRootData || {};
          const hasSubPlayers = Array.isArray(currentPlayers) && currentPlayers.length > 0;
          const hasSubConvs = Array.isArray(currentConvocations) && currentConvocations.length > 0;
          const hasSubSessions = Array.isArray(currentSessions) && currentSessions.length > 0;

          // EVITAR CARRERA: Nunca emitir un array vacío de jugadores si la subcolección aún no ha entregado su snapshot
          let finalPlayers = null;
          if (hasSubPlayers) {
            finalPlayers = currentPlayers;
          } else if (hasReceivedPlayersSnapshot) {
            finalPlayers = currentPlayers;
          } else if (Array.isArray(root.players) && root.players.length > 0) {
            finalPlayers = root.players;
          } else {
            finalPlayers = null; // Aún cargando subcolección
          }

          const combined = {
            settings: root.settings || {
              lang: 'es',
              clubName: 'Jõhvi JK Noova',
              convocatoriaWebUrl: '',
              forceCachePurgeTimestamp: 0
            },
            coachProfile: root.coachProfile || {},
            teams: root.teams || [],
            recurringSchedules: root.recurringSchedules || [],
            players: finalPlayers !== null ? finalPlayers : (root.players || []),
            convocations: hasSubConvs ? currentConvocations : (root.convocations || []),
            sessions: hasSubSessions ? currentSessions : (root.sessions || []),
            updatedAt: root.updatedAt || null,
            clientTime: root.clientTime || Date.now(),
            schemaVersion: 2,
            _playersLoaded: hasReceivedPlayersSnapshot || hasSubPlayers
          };

          onStateUpdate(combined);
        }

        // 1. Listener del Documento Raíz (Configuraciones, Perfil, Equipos y Horarios)
        const rootUnsub = clubRef.onSnapshot((doc) => {
          if (doc.exists) {
            currentRootData = doc.data();
            emitCombinedState();
          }
        }, (err) => {
          console.error('[Cloud] Error escuchando doc raíz del club:', err);
        });

        // 2. Listener de la Subcolección de Jugadores
        const playersUnsub = clubRef.collection('players').onSnapshot((snapshot) => {
          hasReceivedPlayersSnapshot = true;
          const list = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.id) list.push(data);
          });
          currentPlayers = list;
          emitCombinedState();
        }, (err) => {
          console.warn('[Cloud] Error escuchando subcolección players:', err);
        });

        // 3. Listener de la Subcolección de Convocatorias
        const convsUnsub = clubRef.collection('convocations').onSnapshot((snapshot) => {
          const list = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.id) list.push(data);
          });
          list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          currentConvocations = list;
          emitCombinedState();
        }, (err) => {
          console.warn('[Cloud] Error escuchando subcolección convocations:', err);
        });

        // 4. Listener de la Subcolección de Sesiones (Partidos y Entrenamientos)
        const sessionsUnsub = clubRef.collection('sessions').onSnapshot((snapshot) => {
          const list = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.id) list.push(data);
          });
          list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
          currentSessions = list;
          emitCombinedState();
        }, (err) => {
          console.warn('[Cloud] Error escuchando subcolección sessions:', err);
        });

        stateUnsubscribe = function unsubscribeAll() {
          try { if (rootUnsub) rootUnsub(); } catch (e) {}
          try { if (playersUnsub) playersUnsub(); } catch (e) {}
          try { if (convsUnsub) convsUnsub(); } catch (e) {}
          try { if (sessionsUnsub) sessionsUnsub(); } catch (e) {}
        };

        return stateUnsubscribe;
      } catch (err) {
        console.error('[Cloud] Error configurando listeners de estado modular:', err);
        return null;
      }
    },

    // Envía el voto de asistencia de un jugador (Asiste / Baja / Pendiente restablecido)
    voteAttendance: async function (convId, playerId, status, playerName, notes) {
      if (!this.init()) {
        throw new Error('No hay conexión con el servidor en la nube.');
      }

      if (!convId || !playerId || !status) {
        throw new Error('Datos incompletos para confirmar asistencia.');
      }

      const docId = `${convId}_${playerId}`;

      // Si el usuario cancela su voto (vuelve a pulsar), eliminar el documento de respuesta
      if (status === 'pending') {
        try {
          await db.collection('clubs')
            .doc(CLUB_ID)
            .collection('responses')
            .doc(docId)
            .delete();
          return true;
        } catch (e) {
          console.error('Error eliminando voto:', e);
        }
      }

      const payload = {
        convId: convId,
        playerId: playerId,
        playerName: playerName || '',
        status: status, // 'called' (asiste) o 'absent' (baja)
        notes: notes || '',
        timestamp: Date.now(),
        serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
      };

      // 1. Guarda en la subcolección 'responses' para que el entrenador lo reciba instantáneamente
      await db.collection('clubs')
        .doc(CLUB_ID)
        .collection('responses')
        .doc(docId)
        .set(payload, { merge: true });

      return true;
    },

    // Escucha las respuestas de una convocatoria específica para ver quién asiste
    listenToConvocationVotes: function (convId, onVotesUpdate) {
      if (!this.init() || !convId) return null;

      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('responses')
          .where('convId', '==', convId)
          .onSnapshot((snapshot) => {
            const votes = {};
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.playerId) votes[data.playerId] = data;
            });
            if (typeof onVotesUpdate === 'function') {
              onVotesUpdate(votes);
            }
          }, (err) => {
            console.warn('[Cloud] Error escuchando votos de convocatoria:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener votos:', err);
        return null;
      }
    },

    // Envía una solicitud de cambio de perfil (jugador -> entrenador)
    submitProfileRequest: async function (reqData) {
      if (!this.init()) throw new Error('No hay conexión con la nube.');
      if (!reqData || !reqData.id) throw new Error('Datos de solicitud incompletos.');

      await db.collection('clubs')
        .doc(CLUB_ID)
        .collection('profile_requests')
        .doc(reqData.id)
        .set({
          ...reqData,
          serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      return true;
    },

    // Escucha solicitudes pendientes (para el entrenador)
    listenToProfileRequests: function (callback) {
      if (!this.init()) return null;

      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_requests')
          .onSnapshot((snapshot) => {
            const requests = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data && data.status === 'pending') {
                requests.push(data);
              }
            });
            requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            if (typeof callback === 'function') callback(requests);
          }, (err) => {
            console.warn('[Cloud] Error escuchando solicitudes:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener solicitudes:', err);
        return null;
      }
    },

    // Resuelve una solicitud (aprobar o rechazar) por parte del entrenador
    resolveProfileRequest: async function (reqId, status) {
      if (!this.init() || !reqId) return false;

      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_requests')
          .doc(reqId)
          .update({
            status: status, // 'approved' o 'rejected'
            resolvedAt: Date.now()
          });

        // Eliminar definitivamente tras breve plazo para que el jugador reciba el aviso
        setTimeout(async () => {
          try {
            await db.collection('clubs')
              .doc(CLUB_ID)
              .collection('profile_requests')
              .doc(reqId)
              .delete();
          } catch (e) {}
        }, 4000);

        return true;
      } catch (err) {
        console.error('[Cloud] Error resolviendo solicitud:', err);
        return false;
      }
    },

    // Escucha el estado de una solicitud específica del jugador
    listenToMyProfileRequest: function (reqId, callback) {
      if (!this.init() || !reqId) return null;

      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_requests')
          .doc(reqId)
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              if (typeof callback === 'function') callback(data);
            }
          }, (err) => {
            console.warn('[Cloud] Error escuchando mi solicitud:', err);
          });
      } catch (err) {
        console.error(err);
        return null;
      }
    },

    /* =========================================================
       CHAT EN VIVO (DIRECTO, EQUIPO, GRUPOS Y ENTRENADOR)
       ========================================================= */
    createOrGetChat: async function (chatData) {
      if (!this.init() || !chatData || !chatData.id) return null;

      try {
        const ref = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatData.id);
        const doc = await ref.get();
        if (!doc.exists) {
          await ref.set({
            ...chatData,
            createdAt: Date.now(),
            lastMessageTime: Date.now(),
            lastMessage: '',
            lastSenderName: ''
          });
        }
        return true;
      } catch (err) {
        console.error('[Cloud] Error creating chat:', err);
        return false;
      }
    },

    listenToChats: function (callback) {
      if (!this.init()) return null;

      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('chats')
          .onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(d => {
              const data = d.data() || {};
              if (!data.id) data.id = d.id;
              list.push(data);
            });
            list.sort((a, b) => (b.lastMessageTime || b.createdAt || 0) - (a.lastMessageTime || a.createdAt || 0));
            if (typeof callback === 'function') callback(list);
          }, (err) => {
            console.warn('[Cloud] Error escuchando chats:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener chats:', err);
        return null;
      }
    },

    listenToChatMessages: function (chatId, callback) {
      if (!this.init() || !chatId) return null;

      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .limitToLast(100)
          .onSnapshot((snapshot) => {
            const msgs = [];
            snapshot.forEach(d => {
              msgs.push(d.data());
            });
            if (typeof callback === 'function') callback(msgs);
          }, (err) => {
            console.warn('[Cloud] Error escuchando mensajes:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener messages:', err);
        return null;
      }
    },

    sendChatMessage: async function (chatId, msg) {
      if (!this.init() || !chatId || !msg) return false;
      if (!msg.text && !msg.image && !msg.file) return false;

      try {
        const msgId = 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const textVal = (msg.text || '').trim();
        const payload = {
          id: msgId,
          chatId: chatId,
          senderId: msg.senderId || 'anon',
          senderName: msg.senderName || 'Usuario',
          text: textVal,
          image: msg.image || null,
          file: msg.file || null,
          replyTo: msg.replyTo || null,
          convId: msg.convId || null,
          eventTitle: msg.eventTitle || null,
          type: msg.type || 'text',
          reactions: {},
          timestamp: Date.now(),
          serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
        };

        const chatRef = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId);

        // 1. Añadir mensaje a subcolección
        await chatRef.collection('messages').doc(msgId).set(payload);

        // Preview de texto para cabecera
        let preview = payload.text;
        if (!preview && payload.image) preview = '📷 Foto';
        if (!preview && payload.file) preview = '📎 Archivo: ' + (payload.file.name || 'documento');

        // 2. Actualizar último mensaje en la cabecera del chat (restaurando si estaba borrado)
        await chatRef.set({
          id: chatId,
          deleted: false,
          isDeleted: false,
          lastMessage: preview,
          lastMessageTime: payload.timestamp,
          lastSenderName: payload.senderName,
          lastSenderId: payload.senderId
        }, { merge: true });

        return true;
      } catch (err) {
        console.error('[Cloud] Error enviando mensaje de chat:', err);
        return false;
      }
    },

    deleteChat: async function (chatId) {
      if (!this.init() || !chatId) return false;
      try {
        const messagesRef = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId).collection('messages');
        const snap = await messagesRef.limit(50).get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();

        await db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId).delete();
        return true;
      } catch (err) {
        console.error('[Cloud] Error borrando chat:', err);
        return false;
      }
    },

    leaveGroup: async function (chatId, userId) {
      if (!this.init() || !chatId || !userId) return false;
      try {
        const chatRef = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId);
        const doc = await chatRef.get();
        if (doc.exists) {
          const data = doc.data();
          const members = (data.members || []).filter(m => m !== userId);
          const memberDetails = (data.memberDetails || []).filter(m => m.id !== userId);
          await chatRef.update({
            members: members,
            memberDetails: memberDetails
          });
          return true;
        }
        return false;
      } catch (err) {
        console.error('[Cloud] Error saliendo de grupo:', err);
        return false;
      }
    },

    /* =========================================================
       PRESENCIA EN LÍNEA (ONLINE / ÚLTIMA CONEXIÓN)
       ========================================================= */
    updatePresence: async function (userId, userName, isOnline, metadata = {}) {
      if (!this.init() || !userId) return;
      const now = Date.now();
      const last = lastPresenceSendTimes[userId] || 0;
      // No reenviar latidos si ya se envió hace menos de 90s, salvo que pase a offline
      if (isOnline !== false && (now - last < 90000)) return;
      lastPresenceSendTimes[userId] = now;
      try {
        const isApk = !!(global.AndroidBridge || (typeof window !== 'undefined' && window.AndroidBridge));
        const platformVal = (metadata && metadata.platform) || (isApk ? 'apk' : 'pwa');
        const ref = db.collection('clubs').doc(CLUB_ID).collection('presence').doc(userId);
        await ref.set({
          userId: userId,
          userName: userName || '',
          isOnline: isOnline !== false,
          hasApp: true,
          platform: platformVal,
          lastSeen: Date.now(),
          serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('[Cloud] Error actualizando presencia:', err);
      }
    },

    listenToUserPresence: function (userId, callback) {
      if (!this.init() || !userId) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('presence')
          .doc(userId)
          .onSnapshot((doc) => {
            if (doc.exists && typeof callback === 'function') {
              callback(doc.data());
            } else if (typeof callback === 'function') {
              callback({ userId: userId, isOnline: false, lastSeen: null });
            }
          }, (err) => {
            console.warn('[Cloud] Error escuchando presencia:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener presencia:', err);
        return null;
      }
    },

    listenToAllPresence: function (callback) {
      if (!this.init()) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('presence')
          .onSnapshot((snapshot) => {
            const presenceMap = {};
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data && data.userId) presenceMap[data.userId] = data;
            });
            if (typeof callback === 'function') callback(presenceMap);
          }, (err) => {
            console.warn('[Cloud] Error escuchando presencia global:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener all presence:', err);
        return null;
      }
    },

    /* =========================================================
       SOLICITUDES DE ALTA DE JUGADOR NUEVO (NO EN LISTA)
       ========================================================= */
    submitPlayerCreationRequest: async function (reqData) {
      if (!this.init()) throw new Error('No hay conexión con la nube.');
      if (!reqData || !reqData.id) throw new Error('Datos incompletos.');
      await db.collection('clubs')
        .doc(CLUB_ID)
        .collection('player_creation_requests')
        .doc(reqData.id)
        .set({
          ...reqData,
          status: 'pending',
          serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      return true;
    },

    listenToPlayerCreationRequests: function (callback) {
      if (!this.init()) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('player_creation_requests')
          .onSnapshot((snapshot) => {
            const requests = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data && data.status === 'pending') {
                requests.push(data);
              }
            });
            requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            if (typeof callback === 'function') callback(requests);
          }, (err) => {
            console.warn('[Cloud] Error escuchando solicitudes de alta:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener creación jugador:', err);
        return null;
      }
    },

    listenToPlayerCreationRequest: function (reqId, callback) {
      if (!this.init() || !reqId) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('player_creation_requests')
          .doc(reqId)
          .onSnapshot((doc) => {
            if (doc.exists && typeof callback === 'function') {
              callback(doc.data());
            }
          });
      } catch (err) {
        return null;
      }
    },

    resolvePlayerCreationRequest: async function (reqId, status, createdPlayerId) {
      if (!this.init() || !reqId) return false;
      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('player_creation_requests')
          .doc(reqId)
          .update({
            status: status,
            createdPlayerId: createdPlayerId || null,
            resolvedAt: Date.now()
          });
        setTimeout(async () => {
          try {
            await db.collection('clubs')
              .doc(CLUB_ID)
              .collection('player_creation_requests')
              .doc(reqId)
              .delete();
          } catch (e) {}
        }, 5000);
        return true;
      } catch (err) {
        console.error('[Cloud] Error resolviendo solicitud de alta:', err);
        return false;
      }
    },

    /* =========================================================
       EXTENSIÓN DE CHAT: PARTICIPANTES, DETALLES Y REACCIONES
       ========================================================= */
    addChatParticipants: async function (chatId, newParticipants) {
      if (!this.init() || !chatId || !Array.isArray(newParticipants) || !newParticipants.length) return false;
      try {
        const ref = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId);
        await ref.update({
          participants: global.firebase.firestore.FieldValue.arrayUnion(...newParticipants)
        });
        return true;
      } catch (err) {
        console.error('[Cloud] Error añadiendo participantes:', err);
        return false;
      }
    },

    updateChatDetails: async function (chatId, updates) {
      if (!this.init() || !chatId || !updates) return false;
      try {
        const ref = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId);
        await ref.set(updates, { merge: true });
        return true;
      } catch (err) {
        console.error('[Cloud] Error actualizando detalles de chat:', err);
        return false;
      }
    },

    reactToChatMessage: async function (chatId, msgId, userId, userName, emoji) {
      if (!this.init() || !chatId || !msgId || !userId) return false;
      try {
        const msgRef = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId).collection('messages').doc(msgId);
        const doc = await msgRef.get();
        if (!doc.exists) return false;
        const data = doc.data();
        const reactions = Object.assign({}, data.reactions || {});
        if (reactions[userId] && reactions[userId].emoji === emoji) {
          delete reactions[userId];
        } else {
          reactions[userId] = { emoji: emoji, userName: userName || '', time: Date.now() };
        }
        await msgRef.update({ reactions: reactions });
        return true;
      } catch (err) {
        console.error('[Cloud] Error reaccionando a mensaje:', err);
        return false;
      }
    },

    editChatMessage: async function (chatId, msgId, newText) {
      if (!this.init() || !chatId || !msgId) return false;
      try {
        const msgRef = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId).collection('messages').doc(msgId);
        await msgRef.update({
          text: newText,
          isEdited: true,
          editedAt: Date.now()
        });
        return true;
      } catch (err) {
        console.error('[Cloud] Error editando mensaje:', err);
        return false;
      }
    },

    deleteChatMessageForEveryone: async function (chatId, msgId) {
      if (!this.init() || !chatId || !msgId) return false;
      try {
        const msgRef = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId).collection('messages').doc(msgId);
        await msgRef.update({
          text: '',
          image: null,
          file: null,
          isDeletedForEveryone: true,
          deletedAt: Date.now()
        });
        return true;
      } catch (err) {
        console.error('[Cloud] Error eliminando mensaje para todos:', err);
        return false;
      }
    },

    resetAllPlayersPresence: async function () {
      if (!this.init()) return false;
      try {
        const snap = await db.collection('clubs').doc(CLUB_ID).collection('presence').get();
        const batch = db.batch();
        snap.forEach(doc => {
          if (doc.id !== 'coach') {
            batch.delete(doc.ref);
          }
        });
        await batch.commit();

        const claimSnap = await db.collection('clubs').doc(CLUB_ID).collection('profile_claim_requests').get();
        const claimBatch = db.batch();
        claimSnap.forEach(doc => {
          claimBatch.delete(doc.ref);
        });
        await claimBatch.commit();
        return true;
      } catch (err) {
        console.error('[Cloud] Error reseteando presencia de jugadores:', err);
        return false;
      }
    },

    removeChatParticipant: async function (chatId, participantId) {
      if (!this.init() || !chatId || !participantId) return false;
      try {
        const ref = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId);
        await ref.update({
          participants: global.firebase.firestore.FieldValue.arrayRemove(participantId)
        });
        return true;
      } catch (err) {
        console.error('[Cloud] Error quitando participante:', err);
        return false;
      }
    },

    deleteChat: async function (chatId) {
      if (!this.init() || !chatId) return false;
      try {
        const ref = db.collection('clubs').doc(CLUB_ID).collection('chats').doc(chatId);
        await ref.set({ deleted: true, isDeleted: true, lastMessage: '', lastMessageTime: 0 }, { merge: true });
        try {
          await ref.delete();
        } catch (e) {}
        return true;
      } catch (err) {
        console.error('[Cloud] Error eliminando chat:', err);
        return false;
      }
    },

    /* =========================================================
       SOLICITUDES DE CONFIRMACIÓN Y CÓDIGO DE ACCESO A PERFIL
       ========================================================= */
    submitProfileClaimRequest: async function (claimData) {
      if (!this.init()) throw new Error('No hay conexión con la nube.');
      if (!claimData || (!claimData.id && !claimData.targetPlayerId)) throw new Error('Datos de solicitud incompletos.');
      // Usar ID determinista por targetPlayerId para garantizar 1 sola solicitud activa por jugador
      const docId = claimData.id || ('claim_' + claimData.targetPlayerId);
      claimData.id = docId;
      await db.collection('clubs')
        .doc(CLUB_ID)
        .collection('profile_claim_requests')
        .doc(docId)
        .set({
          ...claimData,
          status: 'pending',
          serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      return docId;
    },

    deleteProfileClaimRequest: async function (reqId) {
      if (!this.init() || !reqId) return false;
      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_claim_requests')
          .doc(reqId)
          .delete();
        return true;
      } catch (err) {
        console.warn('[Cloud] Error eliminando solicitud de acceso:', err);
        return false;
      }
    },

    listenToProfileClaimRequests: function (callback) {
      if (!this.init()) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_claim_requests')
          .onSnapshot((snapshot) => {
            const requests = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data && data.status === 'pending') {
                requests.push(data);
              }
            });
            requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            if (typeof callback === 'function') callback(requests);
          }, (err) => {
            console.warn('[Cloud] Error escuchando solicitudes de acceso:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error listener acceso perfil:', err);
        return null;
      }
    },

    listenToProfileClaimRequest: function (reqId, callback) {
      if (!this.init() || !reqId) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_claim_requests')
          .doc(reqId)
          .onSnapshot((doc) => {
            if (doc.exists && typeof callback === 'function') {
              callback(doc.data());
            }
          });
      } catch (err) {
        return null;
      }
    },

    resolveProfileClaimRequest: async function (reqId, status, targetPlayerId) {
      if (!this.init() || !reqId) return false;
      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('profile_claim_requests')
          .doc(reqId)
          .update({
            status: status,
            resolvedAt: Date.now()
          });
        if (status === 'approved' && targetPlayerId) {
          await this.clearPlayerUnlink(targetPlayerId);
        }
        // Dejar margen de 15 minutos para que el jugador vuelva de Viber/SMS y complete enlace
        setTimeout(async () => {
          try {
            await db.collection('clubs')
              .doc(CLUB_ID)
              .collection('profile_claim_requests')
              .doc(reqId)
              .delete();
          } catch (e) {}
        }, 15 * 60 * 1000);
        return true;
      } catch (err) {
        console.error('[Cloud] Error resolviendo solicitud de acceso a perfil:', err);
        return false;
      }
    },

    /* =========================================================
       RECORDATORIOS DE ASISTENCIA A CONVOCATORIAS
       ========================================================= */
    sendConvocationReminder: async function (reminderData) {
      if (!this.init()) return false;
      if (!reminderData || !reminderData.id) return false;
      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('convocation_reminders')
          .doc(reminderData.id)
          .set({
            ...reminderData,
            createdAt: reminderData.createdAt || Date.now()
          });
        return true;
      } catch (err) {
        console.error('[Cloud] Error enviando recordatorio de convocatoria:', err);
        return false;
      }
    },

    listenToConvocationReminders: function (playerId, callback) {
      if (!this.init() || !playerId) return null;
      try {
        const threshold = Date.now() - (15 * 60 * 1000);
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('convocation_reminders')
          .where('targetPlayerIds', 'array-contains', playerId)
          .onSnapshot((snapshot) => {
            if (!snapshot) return;
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const data = change.doc.data();
                if (data && (!data.createdAt || data.createdAt >= threshold)) {
                  if (typeof callback === 'function') callback(data);
                }
              }
            });
          }, (err) => {
            console.warn('[Cloud] Error escuchando recordatorios:', err);
          });
      } catch (err) {
        console.error('[Cloud] Error configurando listener de recordatorios:', err);
        return null;
      }
    },

    /* =========================================================
       DESVINCULACIÓN DE PERFIL DE JUGADOR POR EL ENTRENADOR
       ========================================================= */
    unlinkPlayerProfile: async function (playerId) {
      if (!this.init() || !playerId) return false;
      try {
        const now = Date.now();
        // 1. Guardar documento de desvinculación en Firestore
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('unlinks')
          .doc(playerId)
          .set({
            playerId: playerId,
            unlinkedAt: now,
            serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
          });

        // 2. Eliminar documento de presencia del jugador para apagar icono inmediatamente
        try {
          await db.collection('clubs')
            .doc(CLUB_ID)
            .collection('presence')
            .doc(playerId)
            .delete();
        } catch (e) {
          console.warn('[Cloud] Error borrando presencia al desvincular:', e);
        }

        // 3. Eliminar solicitudes de reclamo pendientes de este jugador
        try {
          const reqsSnap = await db.collection('clubs')
            .doc(CLUB_ID)
            .collection('profile_claim_requests')
            .where('targetPlayerId', '==', playerId)
            .get();
          const batch = db.batch();
          reqsSnap.forEach(d => batch.delete(d.ref));
          await batch.commit();
        } catch (e) {}

        return true;
      } catch (err) {
        console.error('[Cloud] Error desvinculando perfil de jugador:', err);
        return false;
      }
    },

    listenToPlayerUnlink: function (playerId, callback) {
      if (!this.init() || !playerId) return null;
      try {
        return db.collection('clubs')
          .doc(CLUB_ID)
          .collection('unlinks')
          .doc(playerId)
          .onSnapshot((doc) => {
            if (doc.exists && typeof callback === 'function') {
              callback(doc.data());
            }
          }, (err) => {
            console.warn('[Cloud] Error escuchando desvinculación:', err);
          });
      } catch (err) {
        return null;
      }
    },

    clearPlayerUnlink: async function (playerId) {
      if (!this.init() || !playerId) return;
      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('unlinks')
          .doc(playerId)
          .delete();
        if (global.firebase && global.firebase.firestore) {
          await db.collection('clubs')
            .doc(CLUB_ID)
            .collection('players')
            .doc(playerId)
            .update({
              unlinkedAt: global.firebase.firestore.FieldValue.delete()
            }).catch(() => {});
        }
      } catch (e) {
        console.warn('[Cloud] Error clearing player unlink:', e);
      }
    }
  };

  global.Cloud = Cloud;
})(typeof window !== 'undefined' ? window : this);

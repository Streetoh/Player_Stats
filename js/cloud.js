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
  const LS_SYNCED_HASHES_KEY = 'cloud_synced_hashes_v2';
  const LS_KNOWN_REMOTE_IDS_KEY = 'cloud_known_remote_ids_v2';

  let knownRemotePlayerIds = null;
  let knownRemoteConvIds = null;
  let knownRemoteSessionIds = null;

  // Cachés de hashes persistentes para sincronización delta incremental (ahorro del 99% de escrituras Firestore)
  let syncedHashes = {
    root: '',
    players: {},
    photos: {},
    convocations: {},
    sessions: {}
  };
  let lastPresenceSendTimes = {};
  let cachedLinkedPlayersMap = null;
  let lastLinkedPlayersFetchTime = 0;
  const LINKED_PLAYERS_CACHE_TTL = 20 * 60 * 1000; // 20 minutos de caché estricto para proteger la cuota Spark

  /* =========================================================
     IndexedDB Local Cache (PlayerStatsCacheDB)
     - 'photos': { playerId, photoHash, dataUrl, updatedAt }
     - 'sessions': { sessionId, data, updatedAt }
     ========================================================= */
  const DB_NAME = 'PlayerStatsCacheDB';
  const DB_VERSION = 1;
  let idbInstance = null;

  function openIndexedDB() {
    if (idbInstance) return Promise.resolve(idbInstance);
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const idb = e.target.result;
          if (!idb.objectStoreNames.contains('photos')) {
            idb.createObjectStore('photos', { keyPath: 'playerId' });
          }
          if (!idb.objectStoreNames.contains('sessions')) {
            idb.createObjectStore('sessions', { keyPath: 'sessionId' });
          }
        };
        req.onsuccess = (e) => {
          idbInstance = e.target.result;
          resolve(idbInstance);
        };
        req.onerror = () => {
          console.warn('[CacheDB] Error abriendo IndexedDB');
          resolve(null);
        };
      } catch (err) {
        console.warn('[CacheDB] Excepción abriendo IndexedDB:', err);
        resolve(null);
      }
    });
  }

  const photoMemoryCache = new Map();
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('photo_cache_')) {
          const pid = k.slice('photo_cache_'.length);
          try {
            const val = JSON.parse(localStorage.getItem(k));
            if (val && val.dataUrl && val.dataUrl.length > 50) {
              photoMemoryCache.set(pid, val);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  const CacheDB = {
    getPhotoSync: function (playerId) {
      if (!playerId) return null;
      const mem = photoMemoryCache.get(playerId);
      if (mem && mem.dataUrl) return mem;
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('photo_cache_' + playerId);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.dataUrl) {
              photoMemoryCache.set(playerId, parsed);
              return parsed;
            }
          }
        }
      } catch (e) {}
      return null;
    },

    getPhoto: async function (playerId) {
      if (!playerId) return null;
      const mem = this.getPhotoSync(playerId);
      if (mem && mem.dataUrl) return mem;
      try {
        const idb = await openIndexedDB();
        if (idb) {
          const rec = await new Promise((res) => {
            const tx = idb.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const req = store.get(playerId);
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => res(null);
          });
          if (rec && rec.dataUrl) {
            photoMemoryCache.set(playerId, rec);
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('photo_cache_' + playerId, JSON.stringify(rec));
              }
            } catch (e) {}
            return rec;
          }
        }
      } catch (e) {}
      return this.getPhotoSync(playerId);
    },

    setPhoto: async function (playerId, photoHash, dataUrl) {
      if (!playerId || !dataUrl) return false;
      const record = {
        playerId,
        photoHash: photoHash || '',
        dataUrl,
        updatedAt: Date.now()
      };
      photoMemoryCache.set(playerId, record);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('photo_cache_' + playerId, JSON.stringify(record));
        }
      } catch (e) {}
      try {
        const idb = await openIndexedDB();
        if (idb) {
          return new Promise((res) => {
            const tx = idb.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            store.put(record);
            tx.oncomplete = () => res(true);
            tx.onerror = () => res(false);
          });
        }
      } catch (e) {}
      return true;
    },

    getSession: async function (sessionId) {
      if (!sessionId) return null;
      try {
        const idb = await openIndexedDB();
        if (idb) {
          return new Promise((res) => {
            const tx = idb.transaction('sessions', 'readonly');
            const store = tx.objectStore('sessions');
            const req = store.get(sessionId);
            req.onsuccess = () => res(req.result ? req.result.data : null);
            req.onerror = () => res(null);
          });
        }
      } catch (e) {}
      try {
        const raw = localStorage.getItem('session_cache_' + sessionId);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    setSession: async function (sessionId, sessionData) {
      if (!sessionId || !sessionData) return false;
      const record = {
        sessionId,
        data: sessionData,
        updatedAt: Date.now()
      };
      try {
        const idb = await openIndexedDB();
        if (idb) {
          return new Promise((res) => {
            const tx = idb.transaction('sessions', 'readwrite');
            const store = tx.objectStore('sessions');
            store.put(record);
            tx.oncomplete = () => res(true);
            tx.onerror = () => res(false);
          });
        }
      } catch (e) {}
      try {
        localStorage.setItem('session_cache_' + sessionId, JSON.stringify(sessionData));
        return true;
      } catch (e) { return false; }
    }
  };

  global.CacheDB = CacheDB;

  function loadPersistedSyncState() {
    try {
      if (typeof localStorage === 'undefined') return;
      const rawHashes = localStorage.getItem(LS_SYNCED_HASHES_KEY);
      if (rawHashes) {
        const parsed = JSON.parse(rawHashes);
        if (parsed && typeof parsed === 'object') {
          syncedHashes = {
            root: parsed.root || '',
            players: parsed.players || {},
            photos: parsed.photos || {},
            convocations: parsed.convocations || {},
            sessions: parsed.sessions || {}
          };
        }
      }
      const rawIds = localStorage.getItem(LS_KNOWN_REMOTE_IDS_KEY);
      if (rawIds) {
        const parsedIds = JSON.parse(rawIds);
        if (parsedIds && typeof parsedIds === 'object') {
          if (Array.isArray(parsedIds.players) && parsedIds.players.length > 0) {
            knownRemotePlayerIds = new Set(parsedIds.players);
          }
          if (Array.isArray(parsedIds.convocations) && parsedIds.convocations.length > 0) {
            knownRemoteConvIds = new Set(parsedIds.convocations);
          }
          if (Array.isArray(parsedIds.sessions) && parsedIds.sessions.length > 0) {
            knownRemoteSessionIds = new Set(parsedIds.sessions);
          }
        }
      }
      const rawLinked = localStorage.getItem('cached_linked_players_map');
      if (rawLinked) {
        try {
          cachedLinkedPlayersMap = JSON.parse(rawLinked);
          lastLinkedPlayersFetchTime = parseInt(localStorage.getItem('cached_linked_players_time') || '0', 10);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[Cloud] Error cargando hashes persistidos:', e);
    }
  }

  function savePersistedSyncState() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(LS_SYNCED_HASHES_KEY, JSON.stringify(syncedHashes));
      localStorage.setItem(LS_KNOWN_REMOTE_IDS_KEY, JSON.stringify({
        players: knownRemotePlayerIds ? Array.from(knownRemotePlayerIds) : [],
        convocations: knownRemoteConvIds ? Array.from(knownRemoteConvIds) : [],
        sessions: knownRemoteSessionIds ? Array.from(knownRemoteSessionIds) : []
      }));
    } catch (e) {
      console.warn('[Cloud] Error guardando hashes persistidos:', e);
    }
  }

  // Restaurar hashes del almacenamiento local inmediatamente
  loadPersistedSyncState();

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

        // Activar persistencia local en caché (IndexedDB) para evitar descargar 144 docs en cada apertura (reduce lecturas en un 85%)
        if (typeof window !== 'undefined' && !window._firestorePersistenceEnabled) {
          window._firestorePersistenceEnabled = true;
          try {
            db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
              if (err && err.code === 'failed-precondition') {
                console.warn('[Cloud] Múltiples pestañas abiertas con persistencia');
              } else if (err && err.code === 'unimplemented') {
                console.warn('[Cloud] Navegador sin soporte de persistencia');
              }
            });
          } catch (e) {}
        }

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
      if (isSyncing || (!force && (now - lastPushTime < 1200))) {
        clearTimeout(pushPendingTimer);
        pushPendingTimer = setTimeout(() => {
          this.pushCoachState(stateData, true);
        }, isSyncing ? 600 : Math.max(400, 1300 - (now - lastPushTime)));
        return true;
      }
      clearTimeout(pushPendingTimer);
      lastPushTime = now;

      try {
        isSyncing = true;
        this._notifyStatus('syncing');

        // 1. Capa Caliente: Pre-computar estadísticas agregadas y desacoplar fotos
        const sanitizedPlayers = await Promise.all((stateData.players || []).map(async (p) => {
          const copy = Object.assign({}, p);
          delete copy.originalPhoto;
          delete copy.cropSettings;

          // Si no tiene foto en copy.photo, pero está en CacheDB, recuperarla
          if ((!copy.photo || copy.photo.length < 50) && copy.id) {
            try {
              const cached = await CacheDB.getPhoto(copy.id);
              if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
                copy.photo = cached.dataUrl;
                if (!copy.photoHash && cached.photoHash) copy.photoHash = cached.photoHash;
                p.photo = cached.dataUrl;
                if (!p.photoHash && cached.photoHash) p.photoHash = cached.photoHash;
              }
            } catch (e) {}
          }

          // Si tiene foto y no tiene photoHash, generarlo
          if (copy.photo && !copy.photoHash) {
            copy.photoHash = 'p_' + Date.now().toString(36);
            p.photoHash = copy.photoHash;
          }

          // Guardar en IndexedDB localmente de inmediato
          if (copy.photo && copy.photoHash) {
            CacheDB.setPhoto(copy.id, copy.photoHash, copy.photo);
          }

          // Pre-computar Capa Caliente (los 6 atributos actuales, OVR, mvpCount, streak, etc.)
          if (global.Store && Store.calculatePlayerRadar) {
            copy.radar = Store.calculatePlayerRadar(copy.id, stateData.sessions);
          }
          if (global.FutCard && FutCard.computeOvr && copy.radar) {
            copy.ovr = FutCard.computeOvr(copy.radar, copy.mainPosition);
          }
          if (global.Store && Store.calculatePlayerMvpCount) {
            copy.mvpCount = Store.calculatePlayerMvpCount(copy.id);
          }
          if (global.Store && Store.calculatePlayerAttendanceStreak) {
            copy.streak = Store.calculatePlayerAttendanceStreak(copy.id);
          }
          if (global.Store && Store.getPlayerStreakMilestone) {
            copy.medals = Store.getPlayerStreakMilestone(copy.streak);
          }
          if (global.Store && Store.calculatePlayerStats) {
            copy.statsSummary = Store.calculatePlayerStats(copy.id, stateData.sessions);
          }
          if (global.Store && Store.getPlayer1v1Stats) {
            copy.duel1v1 = Store.getPlayer1v1Stats(copy.id, stateData.sessions);
          }

          // Historial resumido de sesiones (partidos y entrenamientos) para este jugador (incluyendo asistencias sin seguimiento individual)
          const pSessions = (stateData.sessions || [])
            .filter(s => {
              if (!s) return false;
              const st = s.stats && s.stats[copy.id];
              const hasStats = !!(st && Object.values(st).some(v => Number(v) > 0));
              const att = s.attendance && s.attendance[copy.id];
              const attSt = (typeof att === 'object' && att !== null) ? att.status : att;
              const attended = (attSt === 'present' || attSt === 'late');
              return hasStats || attended;
            })
            .slice(0, 30)
            .map(s => {
              const st = (s.stats && s.stats[copy.id]) || {};
              const hasStats = Object.values(st).some(v => Number(v) > 0);
              const att = s.attendance && s.attendance[copy.id];
              const attSt = (typeof att === 'object' && att !== null) ? att.status : att;
              const attended = (attSt === 'present' || attSt === 'late') || (hasStats && attSt !== 'absent');
              const r = (global.Store && Store.calculateMatchRating) ? Store.calculateMatchRating(st, copy.mainPosition) : 6.0;
              const totP = (st.passOk || 0) + (st.passKo || 0);
              return {
                id: s.id,
                sessionId: s.id,
                type: s.type || 'training',
                date: s.date || '',
                title: s.title || '',
                rival: s.rival || '',
                venue: s.venue || '',
                score: s.score || null,
                rating: r,
                hasStats: hasStats,
                attended: attended,
                attendanceStatus: attSt || (hasStats ? 'present' : null),
                stats: {
                  goal: st.goal || 0,
                  assist: st.assist || 0,
                  passOk: st.passOk || 0,
                  passKo: st.passKo || 0,
                  shotOn: st.shotOn || 0,
                  shotOff: st.shotOff || 0,
                  recovery: st.recovery || st.recoveries || 0,
                  recoveries: st.recovery || st.recoveries || 0,
                  touches: st.touches || 0,
                  dribbleOk: st.dribbleOk || 0,
                  duelsWon: st.duelsWon || 0,
                  duel1v1WonGoal: st.duel1v1WonGoal || 0,
                  duel1v1WonStop: st.duel1v1WonStop || 0,
                  duel1v1LostTurnover: st.duel1v1LostTurnover || 0,
                  duel1v1LostGoal: st.duel1v1LostGoal || 0
                },
                goal: st.goal || 0,
                assist: st.assist || 0,
                passOk: st.passOk || 0,
                passKo: st.passKo || 0,
                totalPass: totP,
                passPct: totP > 0 ? Math.round(((st.passOk || 0) / totP) * 100) : null,
                shotOn: st.shotOn || 0,
                shotOff: st.shotOff || 0,
                recovery: st.recovery || st.recoveries || 0,
                touches: st.touches || 0,
                dribbleOk: st.dribbleOk || 0
              };
            });
          copy.sessionHistorySummary = pSessions;
          copy.matchHistorySummary = pSessions.filter(s => s.type === 'match');

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

        // 1. Guardar documento raíz (Capa Caliente: configuración, perfil, equipos, horarios, latestMatchMvp y sessionsSummary)
        const todayIsoStr = new Date().toISOString().slice(0, 10);
        const allMatches = (stateData.sessions || []).filter(s => s && (s.type === 'match' || s.rival || s.score) && s.date);
        const finishedMatches = allMatches
          .filter(s => !!(s.finished === true || s.isFinished === true || s.status === 'finished' || s.endedAt != null || s.finishedAt != null))
          .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (Number(b.endedAt || b.finishedAt || 0)) - (Number(a.endedAt || a.finishedAt || 0)));

        const sortedMatches = allMatches.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const latestMatch = finishedMatches[0] || sortedMatches.find(s => (s.date || '') <= todayIsoStr) || sortedMatches[0] || null;

        const latestMatchMvp = latestMatch ? {
          id: latestMatch.id,
          type: 'match',
          title: latestMatch.title || 'Partido',
          rival: latestMatch.rival || '',
          date: latestMatch.date || '',
          time: latestMatch.time || '',
          status: latestMatch.status || (latestMatch.finished ? 'finished' : 'scheduled'),
          finished: !!(latestMatch.finished === true || latestMatch.isFinished === true || latestMatch.status === 'finished' || latestMatch.endedAt != null),
          isFinished: !!(latestMatch.finished === true || latestMatch.isFinished === true || latestMatch.status === 'finished' || latestMatch.endedAt != null),
          endedAt: latestMatch.endedAt || null,
          finishedAt: latestMatch.finishedAt || null,
          teamId: latestMatch.teamId || null,
          teamIds: latestMatch.teamIds || [],
          convocationId: latestMatch.convocationId || null,
          trackedPlayerIds: latestMatch.trackedPlayerIds || [],
          slots: latestMatch.slots || [],
          attendance: latestMatch.attendance || {},
          coachPicks: latestMatch.coachPicks || [],
          officialMvpId: latestMatch.officialMvpId || latestMatch.mvpWinnerId || latestMatch.mvpOfficialId || null,
          mvpOfficialId: latestMatch.officialMvpId || latestMatch.mvpWinnerId || latestMatch.mvpOfficialId || null,
          stats: latestMatch.stats || {},
          score: latestMatch.score || null
        } : null;

        const sessionsSummary = (stateData.sessions || []).map(s => ({
          id: s.id,
          type: s.type || 'training',
          date: s.date || '',
          time: s.time || '',
          title: s.title || '',
          rival: s.rival || '',
          score: s.score || null,
          status: s.status || (s.finished ? 'finished' : 'scheduled'),
          finished: !!(s.finished === true || s.isFinished === true || s.status === 'finished' || s.endedAt != null),
          isFinished: !!(s.finished === true || s.isFinished === true || s.status === 'finished' || s.endedAt != null),
          endedAt: s.endedAt || null,
          finishedAt: s.finishedAt || null,
          teamId: s.teamId || null,
          teamIds: s.teamIds || [],
          convocationId: s.convocationId || null,
          trackedPlayerIds: s.trackedPlayerIds || [],
          slots: s.slots || [],
          attendance: s.attendance || {},
          coachPicks: s.coachPicks || [],
          officialMvpId: s.officialMvpId || s.mvpWinnerId || s.mvpOfficialId || null,
          mvpOfficialId: s.officialMvpId || s.mvpWinnerId || s.mvpOfficialId || null,
          stats: s.stats || {}
        })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const playersSummary = sanitizedPlayers.map(p => ({
          id: p.id,
          name: p.name || '',
          lastName: p.lastName || '',
          nickname: p.nickname || '',
          birthDate: p.birthDate || '',
          teamId: p.teamId || '',
          mainDorsal: p.mainDorsal != null ? p.mainDorsal : null,
          mainPosition: p.mainPosition || 'Jugador',
          secondaryPositions: p.secondaryPositions || [],
          foot: p.foot || 'Diestro',
          heightCm: p.heightCm || null,
          photoHash: p.photoHash || '',
          ovr: p.ovr || 50,
          radar: p.radar || null,
          statsSummary: p.statsSummary || null
        }));

        const rootPayload = {
          teams: stateData.teams || [],
          recurringSchedules: stateData.recurringSchedules || [],
          deletedRecurringIds: stateData.deletedRecurringIds || [],
          coachProfile: sanitizedCoachProfile,
          settings: {
            lang: (stateData.settings && stateData.settings.lang) || 'es',
            clubName: (stateData.settings && stateData.settings.clubName) || 'Jõhvi JK Noova',
            convocatoriaWebUrl: (stateData.settings && stateData.settings.convocatoriaWebUrl) || '',
            forceCachePurgeTimestamp: (stateData.settings && stateData.settings.forceCachePurgeTimestamp) || 0
          },
          playersSummary: playersSummary,
          latestMatchMvp: latestMatchMvp,
          sessionsSummary: sessionsSummary,
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
          deletedRecurringIds: rootPayload.deletedRecurringIds,
          coachProfile: rootPayload.coachProfile,
          settings: rootPayload.settings,
          playersSummary: rootPayload.playersSummary,
          latestMatchMvp: rootPayload.latestMatchMvp,
          sessionsSummary: rootPayload.sessionsSummary
        });

        // Solo escribe el doc raíz si ha cambiado o si se fuerza la sincronización
        if (force || syncedHashes.root !== rootHash) {
          await clubRef.set(cleanUndefined(rootPayload), { merge: true });
          syncedHashes.root = rootHash;
          savePersistedSyncState();
        }

        // 2. Inicializar conjuntos de IDs remotos SOLO si no estaban guardados en localStorage
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
            savePersistedSyncState();
          } catch (e) {
            console.warn('[Cloud] Error o timeout inicializando IDs remotos:', e);
            knownRemotePlayerIds = knownRemotePlayerIds || new Set();
            knownRemoteConvIds = knownRemoteConvIds || new Set();
            knownRemoteSessionIds = knownRemoteSessionIds || new Set();
          }
        }

        const batchOps = [];
        const onCommitCallbacks = [];

        // 3. Subcolección de Jugadores (clubs/default_club/players/{playerId}) - DELTA SYNC + FOTOS DESACOPLADAS
        const activePlayerIds = new Set();
        sanitizedPlayers.forEach(p => {
          if (!p || !p.id) return;
          activePlayerIds.add(p.id);

          // Si el jugador tiene foto, sincronizarla en la subcolección desacoplada player_photos
          if (p.photo && p.photoHash) {
            if (syncedHashes.photos[p.id] !== p.photoHash) {
              const photoRef = clubRef.collection('player_photos').doc(p.id);
              batchOps.push(batch => batch.set(photoRef, {
                playerId: p.id,
                photo: p.photo,
                photoHash: p.photoHash,
                updatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true }));
              onCommitCallbacks.push(() => {
                syncedHashes.photos[p.id] = p.photoHash;
              });
            }
          }

          const cleanP = cleanUndefined(p);
          // DESACOPLAR FOTO: Quitar string Base64 del documento de estadísticas del jugador
          cleanP.photo = '';
          cleanP.photoHash = p.photoHash || '';

          // Si el jugador ya no está desvinculado, eliminar la propiedad unlinkedAt de Firestore
          if (!cleanP.unlinkedAt && global.firebase?.firestore?.FieldValue) {
            cleanP.unlinkedAt = global.firebase.firestore.FieldValue.delete();
          }

          // Si el jugador no tiene misión semanal activa o fue borrada, eliminarla explícitamente en Firestore
          if (!cleanP.weeklyMission && global.firebase?.firestore?.FieldValue) {
            cleanP.weeklyMission = global.firebase.firestore.FieldValue.delete();
          }

          if (p.forceCachePurgeTimestamp) {
            cleanP.forceCachePurgeTimestamp = p.forceCachePurgeTimestamp;
          }

          const pHash = JSON.stringify(cleanP);

          if (syncedHashes.players[p.id] !== pHash || !knownRemotePlayerIds.has(p.id)) {
            const pRef = clubRef.collection('players').doc(p.id);
            batchOps.push(batch => batch.set(pRef, cleanP, { merge: true }));
            onCommitCallbacks.push(() => {
              knownRemotePlayerIds.add(p.id);
              syncedHashes.players[p.id] = pHash;
            });
          }
        });
        Array.from(knownRemotePlayerIds).forEach(id => {
          if (!activePlayerIds.has(id)) {
            const pRef = clubRef.collection('players').doc(id);
            batchOps.push(batch => batch.delete(pRef));
            const photoRef = clubRef.collection('player_photos').doc(id);
            batchOps.push(batch => batch.delete(photoRef));
            onCommitCallbacks.push(() => {
              knownRemotePlayerIds.delete(id);
              delete syncedHashes.players[id];
              delete syncedHashes.photos[id];
            });
          }
        });

        // 4. Subcolección de Convocatorias (clubs/default_club/convocations/{convId}) - DELTA SYNC
        const activeConvIds = new Set();
        (stateData.convocations || []).forEach(c => {
          if (!c || !c.id) return;
          activeConvIds.add(c.id);

          const cleanC = cleanUndefined(c);
          const cHash = JSON.stringify(cleanC);

          if (syncedHashes.convocations[c.id] !== cHash || !knownRemoteConvIds.has(c.id)) {
            const cRef = clubRef.collection('convocations').doc(c.id);
            batchOps.push(batch => batch.set(cRef, cleanC, { merge: true }));
            onCommitCallbacks.push(() => {
              knownRemoteConvIds.add(c.id);
              syncedHashes.convocations[c.id] = cHash;
            });
          }
        });
        Array.from(knownRemoteConvIds).forEach(id => {
          if (!activeConvIds.has(id)) {
            const cRef = clubRef.collection('convocations').doc(id);
            batchOps.push(batch => batch.delete(cRef));
            onCommitCallbacks.push(() => {
              knownRemoteConvIds.delete(id);
              delete syncedHashes.convocations[id];
            });
          }
        });

        // 5. Subcolección de Sesiones (clubs/default_club/sessions/{sessionId}) - DELTA SYNC
        const activeSessIds = new Set();
        (stateData.sessions || []).forEach(s => {
          if (!s || !s.id) return;
          activeSessIds.add(s.id);

          const cleanS = cleanUndefined(s);
          const sHash = JSON.stringify(cleanS);

          if (syncedHashes.sessions[s.id] !== sHash || !knownRemoteSessionIds.has(s.id)) {
            const sRef = clubRef.collection('sessions').doc(s.id);
            batchOps.push(batch => batch.set(sRef, cleanS, { merge: true }));
            onCommitCallbacks.push(() => {
              knownRemoteSessionIds.add(s.id);
              syncedHashes.sessions[s.id] = sHash;
            });
          }
        });
        Array.from(knownRemoteSessionIds).forEach(id => {
          if (!activeSessIds.has(id)) {
            const sRef = clubRef.collection('sessions').doc(id);
            batchOps.push(batch => batch.delete(sRef));
            onCommitCallbacks.push(() => {
              knownRemoteSessionIds.delete(id);
              delete syncedHashes.sessions[id];
            });
          }
        });

        // 6. Ejecutar en lotes atómicos seguros solo los cambios pendientes
        if (batchOps.length > 0) {
          await commitBatchOperations(batchOps);
          onCommitCallbacks.forEach(fn => { try { fn(); } catch (e) {} });
        }
        savePersistedSyncState();

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

    // Elimina una sesión específica de la subcolección de Firestore y limpia el estado local de sincronización
    deleteSessionFromCloud: async function (sessionId) {
      if (!sessionId) return;
      if (!this.init()) return;
      try {
        const clubRef = db.collection('clubs').doc(CLUB_ID);
        await clubRef.collection('sessions').doc(sessionId).delete();
        if (knownRemoteSessionIds) {
          knownRemoteSessionIds.delete(sessionId);
        }
        if (syncedHashes && syncedHashes.sessions) {
          delete syncedHashes.sessions[sessionId];
        }
        savePersistedSyncState();
        console.log('[Cloud] Sesión eliminada definitivamente de Firestore:', sessionId);
      } catch (err) {
        console.error('[Cloud] Error eliminando sesión de Firestore:', err);
      }
    },

    // Elimina una convocatoria específica de la subcolección de Firestore y limpia el estado local de sincronización
    deleteConvocationFromCloud: async function (convId) {
      if (!convId) return;
      if (!this.init()) return;
      try {
        const clubRef = db.collection('clubs').doc(CLUB_ID);
        await clubRef.collection('convocations').doc(convId).delete();
        if (knownRemoteConvIds) {
          knownRemoteConvIds.delete(convId);
        }
        if (syncedHashes && syncedHashes.convocations) {
          delete syncedHashes.convocations[convId];
        }
        savePersistedSyncState();
        console.log('[Cloud] Convocatoria eliminada definitivamente de Firestore:', convId);
      } catch (err) {
        console.error('[Cloud] Error eliminando convocatoria de Firestore:', err);
      }
    },

    // Sube inmediatamente un jugador recién creado o editado a la subcolección players de Firestore sin esperar lotes
    upsertPlayerToCloud: async function (player, stateData) {
      if (!player || !player.id) return false;
      if (!this.init()) return false;
      try {
        const clubRef = db.collection('clubs').doc(CLUB_ID);
        const copy = Object.assign({}, player);
        delete copy.originalPhoto;
        delete copy.cropSettings;

        if ((!copy.photo || copy.photo.length < 50) && copy.id) {
          try {
            const cached = await CacheDB.getPhoto(copy.id);
            if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
              copy.photo = cached.dataUrl;
              if (!copy.photoHash && cached.photoHash) copy.photoHash = cached.photoHash;
              player.photo = cached.dataUrl;
              if (!player.photoHash && cached.photoHash) player.photoHash = cached.photoHash;
            }
          } catch (e) {}
        }

        if (copy.photo && !copy.photoHash) {
          copy.photoHash = 'p_' + Date.now().toString(36);
          player.photoHash = copy.photoHash;
        }
        if (copy.photo && copy.photoHash) {
          await CacheDB.setPhoto(copy.id, copy.photoHash, copy.photo);
          await clubRef.collection('player_photos').doc(copy.id).set({
            playerId: copy.id,
            photo: copy.photo,
            photoHash: copy.photoHash,
            updatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          if (syncedHashes && syncedHashes.photos) {
            syncedHashes.photos[copy.id] = copy.photoHash;
          }
        }

        const sessions = (stateData && stateData.sessions) || (global.Store && Store.state && Store.state.sessions) || [];
        if (global.Store && Store.calculatePlayerRadar) {
          copy.radar = Store.calculatePlayerRadar(copy.id, sessions);
        }
        if (global.FutCard && FutCard.computeOvr && copy.radar) {
          copy.ovr = FutCard.computeOvr(copy.radar, copy.mainPosition);
        }
        if (global.Store && Store.calculatePlayerMvpCount) {
          copy.mvpCount = Store.calculatePlayerMvpCount(copy.id);
        }
        if (global.Store && Store.calculatePlayerAttendanceStreak) {
          copy.streak = Store.calculatePlayerAttendanceStreak(copy.id);
        }
        if (global.Store && Store.getPlayerStreakMilestone) {
          copy.medals = Store.getPlayerStreakMilestone(copy.streak);
        }
        if (global.Store && Store.calculatePlayerStats) {
          copy.statsSummary = Store.calculatePlayerStats(copy.id, sessions);
        }

        copy.photo = '';
        copy.photoHash = player.photoHash || copy.photoHash || '';

        const cleanP = {};
        Object.keys(copy).forEach(k => {
          if (copy[k] !== undefined) cleanP[k] = copy[k];
        });

        await clubRef.collection('players').doc(copy.id).set(cleanP, { merge: true });
        if (knownRemotePlayerIds) knownRemotePlayerIds.add(copy.id);
        savePersistedSyncState();

        // Actualizar también playersSummary en el doc raíz de inmediato para que la App Jugadores lo reciba al instante
        try {
          const rootSnap = await clubRef.get();
          if (rootSnap.exists) {
            const rootData = rootSnap.data() || {};
            let pSummary = Array.isArray(rootData.playersSummary) ? rootData.playersSummary.slice() : [];
            const summaryEntry = {
              id: copy.id,
              name: copy.name || '',
              lastName: copy.lastName || '',
              nickname: copy.nickname || '',
              birthDate: copy.birthDate || '',
              teamId: copy.teamId || '',
              mainDorsal: copy.mainDorsal != null ? copy.mainDorsal : null,
              mainPosition: copy.mainPosition || 'Jugador',
              secondaryPositions: copy.secondaryPositions || [],
              foot: copy.foot || 'Diestro',
              heightCm: copy.heightCm || null,
              photoHash: copy.photoHash || '',
              ovr: copy.ovr || 50,
              radar: copy.radar || null,
              statsSummary: copy.statsSummary || null
            };
            const idx = pSummary.findIndex(x => x.id === copy.id);
            if (idx >= 0) {
              pSummary[idx] = Object.assign({}, pSummary[idx], summaryEntry);
            } else {
              pSummary.push(summaryEntry);
            }
            await clubRef.set({
              playersSummary: pSummary,
              updatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        } catch (rootErr) {
          console.warn('[Cloud] Error actualizando playersSummary en doc raíz:', rootErr);
        }

        console.log('[Cloud] Jugador sincronizado instantáneamente en Firestore:', copy.id, copy.name);
        return true;
      } catch (err) {
        console.error('[Cloud] Error en upsertPlayerToCloud:', err);
        return false;
      }
    },

    // Descarga bajo demanda la lista más reciente de jugadores desde Firestore (bypass de caché local si hay red)
    fetchPlayersFromServer: async function () {
      if (!this.init()) return null;
      try {
        const clubRef = db.collection('clubs').doc(CLUB_ID);
        let snap = null;
        try {
          snap = await clubRef.collection('players').get({ source: 'server' });
        } catch (e) {
          snap = await clubRef.collection('players').get();
        }
        const list = [];
        if (snap) {
          snap.forEach(doc => {
            const d = doc.data();
            if (d && d.id) list.push(d);
          });
        }
        return list;
      } catch (err) {
        console.warn('[Cloud] Error en fetchPlayersFromServer:', err);
        return null;
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
          const deletedSet = new Set(Array.isArray(root.deletedRecurringIds) ? root.deletedRecurringIds : []);
          const hasSubPlayers = Array.isArray(currentPlayers) && currentPlayers.length > 0;
          const hasSubConvs = Array.isArray(currentConvocations) && currentConvocations.length > 0;
          const hasSubSessions = Array.isArray(currentSessions) && currentSessions.length > 0;

          // EVITAR CARRERA Y FUSIONAR CON playersSummary DEL DOCUMENTO RAÍZ:
          // Si un jugador nuevo está en root.playersSummary o en currentPlayers, incluirlo siempre.
          let finalPlayers = null;
          if (hasSubPlayers) {
            finalPlayers = currentPlayers.slice();
          } else if (hasReceivedPlayersSnapshot) {
            finalPlayers = currentPlayers.slice();
          } else if (Array.isArray(root.players) && root.players.length > 0) {
            finalPlayers = root.players.slice();
          } else if (Array.isArray(root.playersSummary) && root.playersSummary.length > 0) {
            finalPlayers = root.playersSummary.slice();
          } else {
            finalPlayers = null; // Aún cargando subcolección
          }

          if (Array.isArray(finalPlayers) && Array.isArray(root.playersSummary) && root.playersSummary.length > 0) {
            const byId = new Map();
            finalPlayers.forEach(p => { if (p && p.id) byId.set(p.id, p); });
            root.playersSummary.forEach(ps => {
              if (!ps || !ps.id) return;
              if (!byId.has(ps.id)) {
                finalPlayers.push(ps);
              }
            });
          }

          let finalConvs = currentConvocations;
          if (!hasSubConvs && !hasReceivedConvsSnapshot && Array.isArray(root.convocations) && root.convocations.length > 0) {
            finalConvs = root.convocations;
          }
          if (deletedSet.size > 0 && Array.isArray(finalConvs)) {
            finalConvs = finalConvs.filter(c => {
              if (!c || !c.id) return false;
              if (deletedSet.has(c.id)) return false;
              if (c.scheduleId && c.date && deletedSet.has(`rec_${c.scheduleId}_${String(c.date).replace(/-/g, '')}`)) return false;
              return true;
            });
          }

          let finalSessions = [];
          if (root.sessionsSummary && Array.isArray(root.sessionsSummary)) {
            finalSessions = root.sessionsSummary.slice();
          }
          if (root.latestMatchMvp && !finalSessions.some(s => s.id === root.latestMatchMvp.id)) {
            finalSessions.unshift(root.latestMatchMvp);
          }
          if (deletedSet.size > 0 && Array.isArray(finalSessions)) {
            finalSessions = finalSessions.filter(s => s && !deletedSet.has(s.id));
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
            deletedRecurringIds: root.deletedRecurringIds || [],
            players: finalPlayers !== null ? finalPlayers : (root.players || root.playersSummary || []),
            convocations: finalConvs,
            sessions: finalSessions,
            latestMatchMvp: root.latestMatchMvp || null,
            updatedAt: root.updatedAt || null,
            clientTime: root.clientTime || Date.now(),
            schemaVersion: 2,
            _playersLoaded: hasReceivedPlayersSnapshot || hasSubPlayers || (Array.isArray(root.playersSummary) && root.playersSummary.length > 0)
          };

          onStateUpdate(combined);
        }

        // 1. Listener del Documento Raíz (Capa Caliente: Configuraciones, Perfil, Equipos, Horarios, latestMatchMvp, sessionsSummary)
        const rootUnsub = clubRef.onSnapshot((doc) => {
          if (doc.exists) {
            currentRootData = doc.data();
            emitCombinedState();
          }
        }, (err) => {
          console.error('[Cloud] Error escuchando doc raíz del club:', err);
        });

        // 2. Listener de la Subcolección de Jugadores (Capa Caliente ligera sin fotos pesadas)
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
          hasReceivedConvsSnapshot = true;
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

        // Nota: Las sesiones brutas (Capa Fría) NO se descargan en masa al abrir la app.
        // Se cargan bajo demanda con Cloud.fetchSessionDetail(sessionId) y se cachean en IndexedDB/localStorage.

        stateUnsubscribe = function unsubscribeAll() {
          try { if (rootUnsub) rootUnsub(); } catch (e) {}
          try { if (playersUnsub) playersUnsub(); } catch (e) {}
          try { if (convsUnsub) convsUnsub(); } catch (e) {}
        };

        return stateUnsubscribe;
      } catch (err) {
        console.error('[Cloud] Error configurando listeners de estado modular:', err);
        return null;
      }
    },

    // Descarga/hidrata fotos de jugadores desde IndexedDB con descarga bajo demanda de Firestore
    hydratePlayerPhotos: async function (players, onPhotoLoaded) {
      if (!Array.isArray(players) || players.length === 0) return;
      await Promise.all(players.map(async (p) => {
        if (!p || !p.id) return;

        // 1. Si ya tiene foto en memoria, asegurar caché y notificar
        if (p.photo && typeof p.photo === 'string' && p.photo.length > 50) {
          CacheDB.setPhoto(p.id, p.photoHash || ('p_' + p.id), p.photo);
          if (typeof onPhotoLoaded === 'function') onPhotoLoaded(p);
          return;
        }

        // 2. Intentar cargar desde caché síncrona o CacheDB (IndexedDB / localStorage)
        try {
          const cached = await CacheDB.getPhoto(p.id);
          if (cached && cached.dataUrl && cached.dataUrl.length > 50 && (!p.photoHash || cached.photoHash === p.photoHash)) {
            p.photo = cached.dataUrl;
            if (!p.photoHash && cached.photoHash) p.photoHash = cached.photoHash;
            if (typeof onPhotoLoaded === 'function') onPhotoLoaded(p);
            return;
          }
        } catch (e) {}

        // 3. Descargar de Firestore subcolección player_photos si no está en caché o cambió
        try {
          if (!this.init()) return;
          const photoDoc = await db.collection('clubs').doc(CLUB_ID).collection('player_photos').doc(p.id).get();
          if (photoDoc.exists) {
            const data = photoDoc.data();
            if (data && data.photo && typeof data.photo === 'string' && data.photo.length > 50) {
              p.photo = data.photo;
              p.photoHash = data.photoHash || p.photoHash || ('p_' + p.id);
              await CacheDB.setPhoto(p.id, p.photoHash, p.photo);
              if (typeof onPhotoLoaded === 'function') onPhotoLoaded(p);
            }
          }
        } catch (err) {
          console.warn('[Cloud] Error descargando foto para jugador', p.id, err);
        }
      }));
    },

    // Capa Fría: Carga bajo demanda el detalle bruto de una sesión específica cacheando en IndexedDB/localStorage
    fetchSessionDetail: async function (sessionId) {
      if (!sessionId) return null;
      // 1. Comprobar en IndexedDB / localStorage
      try {
        const cached = await CacheDB.getSession(sessionId);
        if (cached && typeof cached === 'object' && cached.stats) {
          return cached;
        }
      } catch (e) {}

      // 2. Si no está en caché, descargar de Firestore
      try {
        if (!this.init()) return null;
        const sDoc = await db.collection('clubs').doc(CLUB_ID).collection('sessions').doc(sessionId).get();
        if (sDoc.exists) {
          const data = sDoc.data();
          await CacheDB.setSession(sessionId, data);
          return data;
        }
      } catch (err) {
        console.warn('[Cloud] Error cargando detalle de sesión de Capa Fría:', sessionId, err);
      }
      return null;
    },

    // Procesa y recorta fotos a WebP (400x400) en el cliente
    processPlayerPhotoWebp: function (fileOrDataUrl) {
      if (global.IO && IO.processPlayerPhotoWebp) {
        return IO.processPlayerPhotoWebp(fileOrDataUrl);
      }
      return new Promise((resolve) => {
        function processImgData(dataUrl) {
          if (!dataUrl || typeof dataUrl !== 'string') {
            return resolve({ dataUrl: '', photoHash: '' });
          }
          if (dataUrl.startsWith('data:application/octet-stream') || dataUrl.startsWith('data:;')) {
            dataUrl = dataUrl.replace(/^data:[^;]*/, 'data:image/jpeg');
          }
          if (!dataUrl.startsWith('data:image')) {
            return resolve({ dataUrl: '', photoHash: '' });
          }
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = 400;
              canvas.height = 400;
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              const s = Math.min(img.width, img.height);
              const sx = (img.width - s) / 2;
              const sy = (img.height - s) / 2;
              ctx.drawImage(img, sx, sy, s, s, 0, 0, 400, 400);

              let webpUrl = canvas.toDataURL('image/webp', 0.80);
              if (!webpUrl || (!webpUrl.startsWith('data:image/webp') && !webpUrl.startsWith('data:image/jpeg') && !webpUrl.startsWith('data:image/png'))) {
                webpUrl = canvas.toDataURL('image/jpeg', 0.80);
              }
              const photoHash = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
              resolve({ dataUrl: webpUrl, photoHash });
            } catch (e) {
              resolve({ dataUrl, photoHash: 'p_' + Date.now().toString(36) });
            }
          };
          img.onerror = () => resolve({ dataUrl: '', photoHash: '' });
          img.src = dataUrl;
        }

        if (typeof fileOrDataUrl === 'string') {
          processImgData(fileOrDataUrl);
        } else if (fileOrDataUrl && typeof fileOrDataUrl === 'object') {
          const reader = new FileReader();
          reader.onload = () => processImgData(reader.result);
          reader.onerror = () => resolve({ dataUrl: '', photoHash: '' });
          reader.readAsDataURL(fileOrDataUrl);
        } else {
          resolve({ dataUrl: '', photoHash: '' });
        }
      });
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

    // Registra el voto de MVP de un jugador para un partido determinado
    voteMatchMvp: async function (sessionId, voterPlayerId, targetPlayerId) {
      if (!this.init() || !sessionId || !voterPlayerId || !targetPlayerId) return false;
      try {
        const docRef = db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId);
        await docRef.set({
          sessionId: sessionId,
          votes: {
            [voterPlayerId]: targetPlayerId
          },
          updatedAt: Date.now()
        }, { merge: true });
        return true;
      } catch (e) {
        console.error('[Cloud] Error registrando voto MVP:', e);
        return false;
      }
    },

    // Establece el MVP Oficial del partido por parte del entrenador
    setOfficialMatchMvp: async function (sessionId, officialMvpId) {
      if (!this.init() || !sessionId) return false;
      try {
        const docRef = db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId);
        await docRef.set({
          sessionId: sessionId,
          officialMvpId: officialMvpId || null,
          closed: true,
          updatedAt: Date.now()
        }, { merge: true });
        return true;
      } catch (e) {
        console.error('[Cloud] Error asignando MVP Oficial:', e);
        return false;
      }
    },

    // Guarda hasta 3 destacados del entrenador para la votación de MVP
    setMatchCoachPicks: async function (sessionId, coachPicks) {
      if (!this.init() || !sessionId) return false;
      try {
        const docRef = db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId);
        await docRef.set({
          sessionId: sessionId,
          coachPicks: coachPicks || [],
          updatedAt: Date.now()
        }, { merge: true });
        try {
          await db.collection('clubs').doc(CLUB_ID).collection('sessions').doc(sessionId).set({
            coachPicks: coachPicks || []
          }, { merge: true });
        } catch (e) {}
        return true;
      } catch (e) {
        console.error('[Cloud] Error guardando coachPicks:', e);
        return false;
      }
    },

    // Escucha votos de MVP de un partido
    listenToMatchMvp: function (sessionId, callback) {
      if (!this.init() || !sessionId) return null;
      try {
        return db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId).onSnapshot(doc => {
          if (doc && doc.exists) {
            callback(doc.data());
          } else {
            callback(null);
          }
        }, err => console.warn('[Cloud] listenToMatchMvp error:', err));
      } catch (err) {
        console.warn('[Cloud] listenToMatchMvp setup error:', err);
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
        const headerUpdate = {
          id: chatId,
          deleted: false,
          isDeleted: false,
          lastMessage: preview,
          lastMessageTime: payload.timestamp,
          lastSenderName: payload.senderName,
          lastSenderId: payload.senderId
        };
        if (chatId.startsWith('team_')) {
          headerUpdate.type = 'team';
          headerUpdate.teamId = chatId.replace(/^team_/, '');
        } else if (chatId.startsWith('direct_')) {
          headerUpdate.type = 'direct';
          headerUpdate.participants = chatId.replace(/^direct_/, '').split('_');
        } else if (chatId.startsWith('coach_')) {
          headerUpdate.type = 'coach';
          headerUpdate.participants = [chatId.replace(/^coach_/, ''), 'coach'];
        }
        await chatRef.set(headerUpdate, { merge: true });

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
       ESTADO DE VINCULACIÓN DE DISPOSITIVOS (CACHÉ 20 MINUTOS)
       - 📱: Perfil vinculado a la app en el teléfono
       - ⚫: Perfil no vinculado todavía
       - 0 escrituras recurrentes / 0 listeners en tiempo real
       ========================================================= */
    getLinkedPlayersMap: async function (force = false) {
      const now = Date.now();
      if (!force && cachedLinkedPlayersMap && (now - lastLinkedPlayersFetchTime < LINKED_PLAYERS_CACHE_TTL)) {
        return cachedLinkedPlayersMap;
      }
      if (!this.init()) {
        return this.getCachedLinkedPlayersMap();
      }
      try {
        const snap = await db.collection('clubs').doc(CLUB_ID).collection('presence').get();
        const map = {};
        snap.forEach(doc => {
          map[doc.id] = doc.data() || { hasApp: true };
        });
        cachedLinkedPlayersMap = map;
        lastLinkedPlayersFetchTime = now;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('cached_linked_players_map', JSON.stringify(map));
            localStorage.setItem('cached_linked_players_time', String(now));
          }
        } catch (e) {}
        return map;
      } catch (err) {
        console.warn('[Cloud] Error obteniendo perfiles vinculados:', err);
        return this.getCachedLinkedPlayersMap();
      }
    },

    getCachedLinkedPlayersMap: function () {
      if (cachedLinkedPlayersMap) return cachedLinkedPlayersMap;
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('cached_linked_players_map');
          if (raw) {
            cachedLinkedPlayersMap = JSON.parse(raw);
            lastLinkedPlayersFetchTime = parseInt(localStorage.getItem('cached_linked_players_time') || '0', 10);
            return cachedLinkedPlayersMap;
          }
        }
      } catch (e) {}
      return {};
    },

    registerPlayerDeviceLink: async function (playerId, playerName) {
      if (!this.init() || !playerId) return false;
      try {
        await db.collection('clubs')
          .doc(CLUB_ID)
          .collection('presence')
          .doc(playerId)
          .set({
            userId: playerId,
            userName: playerName || '',
            hasApp: true,
            linkedAt: Date.now()
          }, { merge: true });
        if (cachedLinkedPlayersMap) {
          cachedLinkedPlayersMap[playerId] = { hasApp: true, linkedAt: Date.now() };
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('cached_linked_players_map', JSON.stringify(cachedLinkedPlayersMap));
            }
          } catch (e) {}
        }
        return true;
      } catch (err) {
        console.warn('[Cloud] Error registrando vinculación de dispositivo:', err);
        return false;
      }
    },

    updatePresence: async function () {
      // Desactivada: 0 escrituras en Firestore
      return;
    },

    listenToUserPresence: function () {
      // Desactivada: 0 lecturas en Firestore
      return null;
    },

    listenToAllPresence: function () {
      // Desactivada: 0 lecturas en Firestore
      return null;
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
          await this.registerPlayerDeviceLink(targetPlayerId, '');
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

        // Actualizar caché de vinculaciones inmediatamente
        if (cachedLinkedPlayersMap && cachedLinkedPlayersMap[playerId]) {
          delete cachedLinkedPlayersMap[playerId];
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('cached_linked_players_map', JSON.stringify(cachedLinkedPlayersMap));
            }
          } catch (e) {}
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
    },

    // 👑 Votación del MVP de un Partido
    voteMatchMvp: async function (sessionId, voterId, targetPlayerId) {
      if (!this.init() || !sessionId || !voterId || !targetPlayerId) {
        throw new Error('Datos incompletos para registrar voto de MVP');
      }
      try {
        const voteRef = db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId);
        await voteRef.set({
          votes: {
            [voterId]: targetPlayerId
          },
          lastVoteAt: Date.now()
        }, { merge: true });
        return true;
      } catch (err) {
        console.error('[Cloud] Error al votar MVP:', err);
        return false;
      }
    },

    setOfficialMatchMvp: async function (sessionId, targetPlayerId) {
      if (!this.init() || !sessionId) return false;
      try {
        const voteRef = db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId);
        await voteRef.set({
          officialMvpId: targetPlayerId || null,
          officialMvpSetAt: Date.now()
        }, { merge: true });

        // Actualizar también en la sesión si está en Firestore
        try {
          await db.collection('clubs').doc(CLUB_ID).collection('sessions').doc(sessionId).set({
            officialMvpId: targetPlayerId || null
          }, { merge: true });
        } catch (e) {}

        return true;
      } catch (err) {
        console.error('[Cloud] Error fijando MVP oficial:', err);
        return false;
      }
    },

    setMatchCoachPicks: async function (sessionId, coachPicks) {
      if (!this.init() || !sessionId) return false;
      try {
        const voteRef = db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId);
        await voteRef.set({
          coachPicks: coachPicks || [],
          coachPicksSetAt: Date.now()
        }, { merge: true });
        try {
          await db.collection('clubs').doc(CLUB_ID).collection('sessions').doc(sessionId).set({
            coachPicks: coachPicks || []
          }, { merge: true });
        } catch (e) {}
        return true;
      } catch (err) {
        console.error('[Cloud] Error fijando coachPicks:', err);
        return false;
      }
    },

    listenToMatchMvp: function (sessionId, callback) {
      if (!this.init() || !sessionId) return null;
      try {
        return db.collection('clubs').doc(CLUB_ID).collection('mvp_votes').doc(sessionId)
          .onSnapshot((doc) => {
            if (typeof callback === 'function') {
              callback(doc.exists ? doc.data() : null);
            }
          }, (err) => {
            console.warn('[Cloud] Error escuchando votos MVP:', err);
          });
      } catch (err) {
        return null;
      }
    },
    CacheDB: CacheDB
  };

  global.Cloud = Cloud;
  global.CacheDB = CacheDB;
})(typeof window !== 'undefined' ? window : this);

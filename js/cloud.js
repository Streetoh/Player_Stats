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
  let statusListeners = [];
  let responseUnsubscribe = null;
  let stateUnsubscribe = null;

  const CLUB_ID = 'default_club';

  const Cloud = {
    config: FIREBASE_CONFIG,

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

    // Sube el estado completo (jugadores, sesiones, convocatorias, equipos) a Firestore
    pushCoachState: async function (stateData) {
      if (!this.init()) return false;
      if (isSyncing) return false;

      // Anti-flood: no sincronizar más de una vez cada 2 segundos a menos que sea forzado
      const now = Date.now();
      if (now - lastPushTime < 2000) return true;
      lastPushTime = now;

      try {
        isSyncing = true;
        this._notifyStatus('syncing');

        const cleanData = {
          players: stateData.players || [],
          teams: stateData.teams || [],
          sessions: stateData.sessions || [],
          convocations: stateData.convocations || [],
          settings: {
            lang: (stateData.settings && stateData.settings.lang) || 'es',
            clubName: (stateData.settings && stateData.settings.clubName) || 'Jõhvi JK Noova',
            convocatoriaWebUrl: (stateData.settings && stateData.settings.convocatoriaWebUrl) || ''
          },
          updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
          clientTime: now
        };

        await db.collection('clubs').doc(CLUB_ID).set(cleanData, { merge: true });

        isSyncing = false;
        this._notifyStatus('synced', now);
        return true;
      } catch (err) {
        isSyncing = false;
        console.error('[Cloud] Error subiendo estado del entrenador:', err);
        this._notifyStatus('error', err.message);
        return false;
      }
    },

    // Escucha en tiempo real las respuestas de asistencia de los jugadores
    startListeningToResponses: function (onResponseCallback) {
      if (!this.init()) return;
      if (responseUnsubscribe) return;

      try {
        // Escucha la subcolección 'responses' del club
        responseUnsubscribe = db.collection('clubs')
          .doc(CLUB_ID)
          .collection('responses')
          .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                if (data && data.convId && data.playerId && typeof onResponseCallback === 'function') {
                  onResponseCallback(data);
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

    // Carga o escucha el estado publicado por el entrenador en tiempo real
    listenToClubState: function (onStateUpdate) {
      if (!this.init()) return null;

      try {
        if (stateUnsubscribe) stateUnsubscribe();

        stateUnsubscribe = db.collection('clubs').doc(CLUB_ID)
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              if (typeof onStateUpdate === 'function') {
                onStateUpdate(data);
              }
            }
          }, (error) => {
            console.error('[Cloud] Error escuchando datos del club:', error);
          });

        return stateUnsubscribe;
      } catch (err) {
        console.error('[Cloud] Error configurando listener de estado:', err);
        return null;
      }
    },

    // Envía el voto de asistencia de un jugador (Asiste / Baja)
    voteAttendance: async function (convId, playerId, status, playerName, notes) {
      if (!this.init()) {
        throw new Error('No hay conexión con el servidor en la nube.');
      }

      if (!convId || !playerId || !status) {
        throw new Error('Datos incompletos para confirmar asistencia.');
      }

      const docId = `${convId}_${playerId}`;
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
    }
  };

  global.Cloud = Cloud;
})(typeof window !== 'undefined' ? window : this);

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

    // Sube el estado completo (jugadores, sesiones, convocatorias, equipos, entrenador, horarios) a Firestore
    pushCoachState: async function (stateData, force = false) {
      if (!this.init() || !stateData) return false;

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

        const cleanData = {
          players: stateData.players || [],
          teams: stateData.teams || [],
          sessions: stateData.sessions || [],
          convocations: stateData.convocations || [],
          recurringSchedules: stateData.recurringSchedules || [],
          coachProfile: stateData.coachProfile || {},
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
                    onResponseCallback(data);
                  }
                }
              });
              isFirstSnapshot = false;
              return;
            }

            // Cambios en vivo recibidos tras el inicio
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                if (data && data.convId && data.playerId) {
                  if (typeof onResponseCallback === 'function') {
                    onResponseCallback(data);
                  }
                  if (typeof window !== 'undefined' && typeof window.onPlayerAttendanceResponse === 'function') {
                    window.onPlayerAttendanceResponse(data);
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
              list.push(d.data());
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

        // 2. Actualizar último mensaje en la cabecera del chat
        await chatRef.set({
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
    updatePresence: async function (userId, userName, isOnline) {
      if (!this.init() || !userId) return;
      try {
        const ref = db.collection('clubs').doc(CLUB_ID).collection('presence').doc(userId);
        await ref.set({
          userId: userId,
          userName: userName || '',
          isOnline: isOnline !== false,
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
      if (!claimData || !claimData.id) throw new Error('Datos de solicitud incompletos.');
      await db.collection('clubs')
        .doc(CLUB_ID)
        .collection('profile_claim_requests')
        .doc(claimData.id)
        .set({
          ...claimData,
          status: 'pending',
          serverTime: global.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      return true;
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

    resolveProfileClaimRequest: async function (reqId, status) {
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
        setTimeout(async () => {
          try {
            await db.collection('clubs')
              .doc(CLUB_ID)
              .collection('profile_claim_requests')
              .doc(reqId)
              .delete();
          } catch (e) {}
        }, 8000);
        return true;
      } catch (err) {
        console.error('[Cloud] Error resolviendo solicitud de acceso a perfil:', err);
        return false;
      }
    }
  };

  global.Cloud = Cloud;
})(typeof window !== 'undefined' ? window : this);

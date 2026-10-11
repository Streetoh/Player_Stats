/* =========================================================
   Chat en Vivo • Player Stats (Coach & Player)
   - Chat directo 1 a 1 entre jugadores y con el entrenador
   - Chat grupal automático por equipo
   - Grupos personalizados con selección libre de participantes (incluyendo entrenador)
   - Envío de fotos, emojis y archivos
   - Presencia en línea (🟢 En línea / Última vez)
   - Silenciar notificaciones por chat y globales
   - Indicador / insignia de mensajes no leídos en chats y pestaña
   - Opciones para eliminar chat y abandonar grupo
   - Sincronización instantánea con Firebase Firestore
   - Bilingüe (EN / ES)
   ========================================================= */
(function (global) {
  'use strict';

  function t(key, fallback) {
    return global.t ? global.t(key, fallback) : (fallback || key);
  }

  function haptic(ms = 25) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  function isChatMuted(chatId) {
    try {
      if (localStorage.getItem('chat_muted_all') === 'true') return true;
      if (chatId && localStorage.getItem('chat_muted_' + chatId) === 'true') return true;
    } catch (e) {}
    return false;
  }

  let currentlyOpenChatId = null;

  function isChatMuted(chatId) {
    try {
      if (localStorage.getItem('chat_global_muted') === 'true') return true;
      if (chatId && localStorage.getItem('chat_muted_' + chatId) === 'true') return true;
    } catch (e) {}
    return false;
  }

  function sendNotification(title, body, chatId) {
    if (chatId && currentlyOpenChatId === chatId) return; // NO NOTIFICAR SI EL CHAT ESTÁ ABIERTO
    if (chatId && isChatMuted(chatId)) return;
    if (global.AndroidBridge && global.AndroidBridge.showSystemNotification) {
      try { global.AndroidBridge.showSystemNotification(title, body); } catch (e) {}
    }
    if ('Notification' in global && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body, icon: 'icons/icon-192.png' });
      } catch (e) {}
    }
  }

  function openPhotoLightbox(src) {
    const box = document.createElement('div');
    box.className = 'chat-photo-lightbox dialog-overlay';
    box.style.cssText = 'position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; padding: 12px; touch-action: none;';
    box.innerHTML = `
      <button type="button" class="icon-btn ghost" id="btn-close-lightbox" style="position: absolute; top: calc(16px + env(safe-area-inset-top)); right: 16px; width: 44px; height: 44px; background: rgba(0,0,0,0.6); color: #fff; font-size: 24px; border-radius: 50%; z-index: 10; border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;">✕</button>
      <img src="${src}" style="max-width: 96vw; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);" />
    `;
    function close() { box.remove(); }
    box.querySelector('#btn-close-lightbox').onclick = close;
    box.onclick = (e) => { if (e.target !== box.querySelector('img')) close(); };
    document.body.appendChild(box);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(ts) {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxWidth || h > maxHeight) {
            if (w > h) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            } else {
              w = Math.round((w * maxHeight) / h);
              h = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const ChatUI = {
    hasUnread: false,

    // Actualiza la insignia de mensajes no leídos en la barra de navegación inferior
    updateTabBadge: function (hasUnread) {
      ChatUI.hasUnread = !!hasUnread;
      const chatTabBtns = document.querySelectorAll('#portal-tabbar [data-tab="chat"], #tabbar [data-tab="chat"], .tabbar [data-tab="chat"], .tab-bar [data-tab="chat"], button[data-tab="chat"], #tab-chat');
      chatTabBtns.forEach(chatTabBtn => {
        let badge = chatTabBtn.querySelector('.chat-unread-dot');
        if (hasUnread) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'chat-unread-dot';
            badge.style.cssText = 'position: absolute; top: 4px; right: calc(50% - 16px); width: 10px; height: 10px; border-radius: 50%; background: #ef4444; border: 2px solid #0f172a; box-shadow: 0 0 6px rgba(239, 68, 68, 0.8); pointer-events: none; z-index: 5;';
            chatTabBtn.style.position = 'relative';
            chatTabBtn.appendChild(badge);
          }
        } else {
          if (badge) badge.remove();
        }
      });
    },

    // Marca un chat como leído inmediatamente, limpiando badges del DOM y local storage
    markChatAsRead: function (curId, chatId, lastMessageTime) {
      if (!curId || !chatId) return;
      const readTime = Math.max(Date.now(), (lastMessageTime || 0)) + 10000;
      try {
        localStorage.setItem(`chat_last_read_${curId}_${chatId}`, String(readTime));
      } catch (e) {}

      // Limpiar inmediatamente de la tarjeta del chat en el DOM
      const card = document.querySelector(`.chat-room-card[data-chat-id="${chatId}"]`);
      if (card) {
        card.style.borderColor = 'var(--border)';
        card.style.background = 'var(--surface2)';
        const dot = card.querySelector('.chat-card-unread-dot');
        if (dot) dot.remove();
        const badge = card.querySelector('.chat-card-new-badge');
        if (badge) badge.remove();
      }

      // Recalcular el indicador de mensajes no leídos en la pestaña
      ChatUI.recalculateUnreadBadge(curId);
    },

    // Recalcula si queda algún chat no leído
    recalculateUnreadBadge: function (curId) {
      if (!curId) return;
      const cards = document.querySelectorAll('.chat-room-card');
      let anyUnread = false;
      cards.forEach(card => {
        const dot = card.querySelector('.chat-card-unread-dot');
        const badge = card.querySelector('.chat-card-new-badge');
        if (dot || badge) anyUnread = true;
      });
      ChatUI.updateTabBadge(anyUnread);
    },

    // Escucha global en segundo plano para notificar y mostrar insignia al instante
    initGlobalUnreadListener: function (curUserId) {
      if (!curUserId || !global.Cloud || !global.Cloud.listenToChats) return;
      if (window._chatUnreadUnsub) {
        try { window._chatUnreadUnsub(); } catch (e) {}
      }
      window._chatUnreadUnsub = global.Cloud.listenToChats((chats) => {
        if (!chats) return;
        let unreadCount = 0;
        chats.forEach(c => {
          if (c.participants && !c.participants.includes(curUserId) && curUserId !== 'coach') return;
          const lastRead = parseInt(localStorage.getItem(`chat_last_read_${curUserId}_${c.id}`) || '0', 10);
          if ((c.lastMessageTime || 0) > lastRead && c.lastSenderId && c.lastSenderId !== curUserId) {
            if (currentlyOpenChatId === c.id) {
              ChatUI.markChatAsRead(curUserId, c.id, c.lastMessageTime);
            } else {
              unreadCount++;
              const knownKey = `last_notified_${c.id}_${c.lastMessageTime}`;
              if (!sessionStorage.getItem(knownKey)) {
                sessionStorage.setItem(knownKey, '1');
                sendNotification(c.lastSenderName || 'Chat', c.lastMessage || 'Nuevo mensaje', c.id);
              }
            }
          }
        });
        ChatUI.updateTabBadge(unreadCount > 0);
      });
    },

    // Inicia latido de presencia en línea
    initPresenceHeartbeat: function (userId, userName) {
      if (!userId || !global.Cloud || !global.Cloud.updatePresence) return;
      global.Cloud.updatePresence(userId, userName, true);
      if (!window._presenceInterval) {
        window._presenceInterval = setInterval(() => {
          global.Cloud.updatePresence(userId, userName, !document.hidden);
        }, 60000);
        document.addEventListener('visibilitychange', () => {
          global.Cloud.updatePresence(userId, userName, !document.hidden);
        });
        window.addEventListener('pagehide', () => {
          global.Cloud.updatePresence(userId, userName, false);
        });
      }
    },

    // Renderiza la lista general de chats
    renderChatList: function (container, options) {
      if (!container) return;
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || (options.isCoach ? 'Entrenador' : 'Jugador');
      const isCoach = !!options.isCoach;
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      // Iniciar presencia
      ChatUI.initPresenceHeartbeat(curId, curName);

      let activeSearch = '';
      let chatListListenerUnsub = null;
      let rawChats = [];

      const isMutedGlobal = localStorage.getItem('chat_muted_all') === 'true';

      container.innerHTML = `
        <div class="chat-portal-container" style="display: flex; flex-direction: column; height: 100%;">
          <!-- Cabecera de Chat -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
            <div>
              <h2 style="font-size: 19px; font-weight: 900; margin: 0 0 2px;">💬 ${t('chatTitle', 'Chat de Equipo y Jugadores')}</h2>
              <span style="font-size: 12px; color: var(--muted);">${isCoach ? t('chatCoachRole', 'Canal oficial del Entrenador') : `${curName}`}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="btn sm ghost" id="btn-toggle-global-mute" style="font-size: 14px; height: 36px; padding: 0 8px;" title="${isMutedGlobal ? t('unmuteNotifications', 'Activar notificaciones') : t('muteNotifications', 'Silenciar notificaciones')}">
                ${isMutedGlobal ? '🔕' : '🔔'}
              </button>
              <button type="button" class="btn sm primary" id="btn-create-custom-group" style="font-weight: 800; font-size: 12px; height: 36px; padding: 0 12px;">
                ➕ ${t('newGroupChat', 'Nuevo Grupo')}
              </button>
            </div>
          </div>

          <!-- Barra de búsqueda rápida de chats y compañeros -->
          <div style="margin-bottom: 12px;">
            <input type="text" id="chat-search-input" placeholder="${t('searchTeammate', 'Buscar chat o compañero...')}" style="width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>

          <!-- Lista de Chats -->
          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;" id="chat-rooms-list">
            <div style="text-align: center; padding: 24px; color: var(--muted); font-size: 13px;">
              ⏳ ${t('loading', 'Cargando chats en vivo...')}
            </div>
          </div>
        </div>
      `;

      const listEl = container.querySelector('#chat-rooms-list');
      const searchInput = container.querySelector('#chat-search-input');
      const btnNewGroup = container.querySelector('#btn-create-custom-group');
      const btnGlobalMute = container.querySelector('#btn-toggle-global-mute');

      if (btnGlobalMute) {
        btnGlobalMute.onclick = () => {
          const currentlyMuted = localStorage.getItem('chat_muted_all') === 'true';
          const nextMuted = !currentlyMuted;
          localStorage.setItem('chat_muted_all', nextMuted ? 'true' : 'false');
          btnGlobalMute.textContent = nextMuted ? '🔕' : '🔔';
          if (global.UI && global.UI.toast) {
            global.UI.toast(nextMuted ? t('muteNotifications', 'Notificaciones silenciadas') : t('unmuteNotifications', 'Notificaciones activadas'), 'info');
          }
        };
      }

      if (btnNewGroup) {
        btnNewGroup.onclick = () => {
          ChatUI.openNewGroupModal({
            currentUserId: curId,
            currentUserName: curName,
            isCoach: isCoach,
            players: allPlayers,
            teams: allTeams,
            onCreated: (chatId) => {
              ChatUI.openConversationModal(chatId, {
                currentUserId: curId,
                currentUserName: curName,
                isCoach: isCoach
              });
            }
          });
        };
      }

      function renderRooms() {
        if (!listEl) return;
        const q = activeSearch.toLowerCase().trim();

        // 1. Chats por equipo por defecto (siempre disponibles)
        const teamChats = allTeams.map(tm => ({
          id: `team_${tm.id}`,
          type: 'team',
          name: `🛡️ Chat: ${tm.name}`,
          teamId: tm.id,
          participants: allPlayers.filter(p => p.teamId === tm.id).map(p => p.id).concat(['coach']),
          lastMessage: '',
          lastMessageTime: 0
        }));

        // 2. Chat directo con Entrenador (para cada jugador)
        let coachDirectChat = null;
        if (!isCoach) {
          coachDirectChat = {
            id: `coach_${curId}`,
            type: 'coach',
            name: `👨‍🏫 ${t('chatWithCoach', 'Chat con el Entrenador')}`,
            participants: [curId, 'coach'],
            lastMessage: '',
            lastMessageTime: 0
          };
        }

        // Combinar con chats de la nube
        const mergedMap = {};
        teamChats.forEach(c => { mergedMap[c.id] = c; });
        if (coachDirectChat) mergedMap[coachDirectChat.id] = coachDirectChat;
        rawChats.forEach(c => {
          if (c && c.id) {
            mergedMap[c.id] = Object.assign({}, mergedMap[c.id] || {}, c);
          }
        });

        let displayChats = Object.values(mergedMap).filter(c => {
          // Filtrar por membresía: coach ve todo, jugador ve donde es participante o de su equipo
          if (!isCoach) {
            if (c.type === 'team') {
              const myP = allPlayers.find(p => p.id === curId);
              if (myP && myP.teamId && c.teamId !== myP.teamId) return false;
            } else if (c.participants && !c.participants.includes(curId)) {
              return false;
            }
          }
          if (q) {
            const nameMatch = (c.name || '').toLowerCase().includes(q);
            const lastMsgMatch = (c.lastMessage || '').toLowerCase().includes(q);
            return nameMatch || lastMsgMatch;
          }
          return true;
        });

        // Ordenar: primero los que tienen mensajes más recientes
        displayChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        // Calcular mensajes no leídos para actualizar insignia en tab
        let totalUnreadRooms = 0;
        displayChats.forEach(c => {
          const lastRead = parseInt(localStorage.getItem(`chat_last_read_${curId}_${c.id}`) || '0', 10);
          if ((c.lastMessageTime || 0) > lastRead && c.lastSenderId && c.lastSenderId !== curId) {
            totalUnreadRooms++;
          }
        });
        ChatUI.updateTabBadge(totalUnreadRooms > 0);

        if (displayChats.length === 0) {
          listEl.innerHTML = `
            <div style="padding: 30px 16px; text-align: center; color: var(--muted); background: var(--surface2); border: 1px dashed var(--border); border-radius: 14px;">
              <div style="font-size: 32px; margin-bottom: 6px;">💬</div>
              <h4 style="margin: 0 0 4px; color: #fff;">${t('noChatsFound', 'No hay chats activos')}</h4>
              <p style="font-size: 12px; margin: 0 0 12px;">${t('noChatsDesc', 'Crea un nuevo grupo o inicia una conversación directa con un compañero.')}</p>
            </div>
          `;
          return;
        }

        listEl.innerHTML = displayChats.map(c => {
          let displayName = c.name || 'Chat';
          if (c.type === 'direct' || c.id.startsWith('direct_')) {
            const parts = c.participants || [];
            const otherId = parts.find(p => p !== curId) || (parts[0] === curId ? parts[1] : parts[0]);
            if (!otherId || otherId === 'coach') {
              displayName = `🛡️ ${t('coach', 'Entrenador (Coach)')}`;
            } else {
              const p = (allPlayers || []).find(x => x.id === otherId);
              if (p) displayName = `#${p.mainDorsal != null ? p.mainDorsal : '-'} ${p.name || ''} ${p.lastName || ''}`.trim();
            }
          }

          const timeStr = formatTime(c.lastMessageTime);
          const iconEmoji = (c.id.includes('coach') || (c.participants && c.participants.includes('coach'))) ? '👨‍🏫' : (c.type === 'team' ? '🛡️' : (c.type === 'group' ? '👥' : '👤'));
          const snippet = c.lastMessage
            ? `<span style="color: #cbd5e1;">${escapeHtml(c.lastSenderName ? c.lastSenderName + ': ' : '')}${escapeHtml(c.lastMessage)}</span>`
            : `<span style="color: var(--muted); font-style: italic;">${t('noMessagesYet', 'Toca para empezar a hablar')}</span>`;

          const lastRead = parseInt(localStorage.getItem(`chat_last_read_${curId}_${c.id}`) || '0', 10);
          const isUnread = (c.lastMessageTime || 0) > lastRead && c.lastSenderId && c.lastSenderId !== curId;
          const isMuted = isChatMuted(c.id);

          return `
            <div class="card chat-room-card" data-chat-id="${c.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid ${isUnread ? 'rgba(34, 211, 238, 0.5)' : 'var(--border)'}; cursor: pointer; transition: all 0.15s; background: ${isUnread ? 'rgba(34, 211, 238, 0.05)' : 'var(--surface2)'}; border-radius: 14px; position: relative;">
              <div style="width: 44px; height: 44px; border-radius: 13px; background: rgba(34, 211, 238, 0.12); border: 1.5px solid rgba(34, 211, 238, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; position: relative;">
                ${iconEmoji}
                ${isUnread ? `<span class="chat-card-unread-dot" style="position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 50%; background: #ef4444; border: 2px solid var(--surface2);"></span>` : ''}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <b style="font-size: 14.5px; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: flex; align-items: center; gap: 6px;">
                    ${escapeHtml(displayName)}
                    ${isMuted ? '<small style="font-size: 11px; opacity: 0.6;">🔕</small>' : ''}
                  </b>
                  <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    ${isUnread ? `<span class="badge chat-card-new-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: 900; font-size: 9.5px; padding: 1px 5px; border-radius: 8px;">● ${t('newBadge', 'NUEVO')}</span>` : ''}
                    <small style="font-size: 11px; color: var(--muted);">${timeStr}</small>
                  </div>
                </div>
                <div style="font-size: 12.5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                  ${snippet}
                </div>
              </div>
            </div>
          `;
        }).join('');

        listEl.querySelectorAll('.chat-room-card').forEach(item => {
          item.onclick = () => {
            const cid = item.getAttribute('data-chat-id');
            const targetChat = displayChats.find(x => x.id === cid);
            haptic(20);
            ChatUI.markChatAsRead(curId, cid, targetChat ? targetChat.lastMessageTime : 0);
            ChatUI.openConversationModal(cid, {
              currentUserId: curId,
              currentUserName: curName,
              isCoach: isCoach,
              title: targetChat ? targetChat.name : 'Chat',
              chatData: targetChat,
              onClose: () => {
                ChatUI.markChatAsRead(curId, cid, targetChat ? targetChat.lastMessageTime : 0);
                renderRooms();
              }
            });
          };
        });
      }

      if (searchInput) {
        searchInput.oninput = () => {
          activeSearch = searchInput.value;
          renderRooms();
        };
      }

      if (global.Cloud && global.Cloud.listenToChats) {
        chatListListenerUnsub = global.Cloud.listenToChats((list) => {
          rawChats = list || [];
          renderRooms();
        });
      } else {
        renderRooms();
      }

      return () => {
        if (chatListListenerUnsub) chatListListenerUnsub();
      };
    },

    // Abre el modal de conversación en tiempo real
    openConversationModal: function (chatId, options) {
      if (!chatId) return;
      currentlyOpenChatId = chatId;
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || (options.isCoach ? 'Entrenador' : 'Jugador');
      const isCoach = !!options.isCoach;
      const chatData = options.chatData || {};

      let resolvedTitle = options.title || 'Chat';
      if (chatData.type === 'direct' || chatId.startsWith('direct_')) {
        const parts = chatData.participants || chatId.replace('direct_', '').split('_');
        const otherId = parts.find(p => p !== curId) || (parts[0] === curId ? parts[1] : parts[0]);
        if (!otherId || otherId === 'coach') {
          resolvedTitle = `🛡️ ${t('coach', 'Entrenador (Coach)')}`;
        }
      }

      // Marcar como leído inmediatamente
      ChatUI.markChatAsRead(curId, chatId, chatData ? chatData.lastMessageTime : 0);

      let messagesListenerUnsub = null;
      let presenceListenerUnsub = null;
      let messagesList = [];
      let pendingAttachment = null; // { type: 'image'|'file', data: '...', name: '...' }

      // Si el chat es nuevo, registrar en Firestore
      if (global.Cloud && global.Cloud.createOrGetChat) {
        global.Cloud.createOrGetChat({
          id: chatId,
          name: resolvedTitle,
          type: chatData.type || 'direct',
          participants: chatData.participants || [curId, 'coach']
        });
      }

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay chat-dialog-overlay';
      overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 0;';

      const isMutedThis = localStorage.getItem('chat_muted_' + chatId) === 'true';

      overlay.innerHTML = `
        <div class="dialog-box chat-modal-box" style="width: 100%; height: 100%; max-width: 600px; max-height: 100%; display: flex; flex-direction: column; background: var(--bg); border: none; border-radius: 0; padding: 0; overflow: hidden;">
          <!-- Barra superior del chat -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: calc(12px + env(safe-area-inset-top)) 14px 12px; background: var(--surface2); border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1;">
              <button type="button" class="icon-btn ghost" id="chat-back-btn" style="width: 36px; height: 36px; flex-shrink: 0;">
                ◀
              </button>
              <div style="overflow: hidden; flex: 1;">
                <h3 style="margin: 0; font-size: 15.5px; font-weight: 900; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: #fff;">
                  ${escapeHtml(resolvedTitle)}
                </h3>
                <span id="chat-presence-indicator" style="font-size: 11px; color: #22d3ee; font-weight: 700;">🟢 ${t('live', 'En vivo')}</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              <button type="button" class="icon-btn ghost" id="chat-menu-btn" style="width: 36px; height: 36px; font-size: 18px;" title="Opciones">
                ⋮
              </button>
              <button type="button" class="icon-btn ghost" id="chat-close-btn" style="width: 36px; height: 36px;">
                ✕
              </button>
            </div>
          </div>

          <!-- Menú desplegable de opciones de chat -->
          <div id="chat-options-dropdown" style="display: none; background: var(--surface); border-bottom: 1.5px solid var(--border); padding: 8px 12px; flex-direction: column; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <button type="button" class="btn sm ghost" id="opt-mute-chat" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
              ${isMutedThis ? '🔔 ' + t('unmuteNotifications', 'Activar notificaciones') : '🔕 ' + t('muteNotifications', 'Silenciar notificaciones')}
            </button>
            ${chatData.type === 'group' ? `
              <button type="button" class="btn sm danger ghost" id="opt-leave-group" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
                🚪 ${t('leaveGroup', 'Abandonar grupo')}
              </button>
            ` : ''}
            <button type="button" class="btn sm danger ghost" id="opt-delete-chat" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
              🗑️ ${t('deleteChat', 'Eliminar conversación')}
            </button>
          </div>

          <!-- Área de Mensajes -->
          <div id="chat-messages-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; -webkit-overflow-scrolling: touch;">
            <div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12.5px;">
              ${t('loading', 'Cargando mensajes...')}
            </div>
          </div>

          <!-- Barra de entrada inferior -->
          <div style="display: flex; flex-direction: column; background: var(--surface); border-top: 1px solid var(--border); flex-shrink: 0;">
            <!-- Cajón de emojis futboleros y populares -->
            <div id="chat-emoji-drawer" style="display: none; padding: 8px 12px; gap: 6px; flex-wrap: wrap; background: var(--surface2); border-bottom: 1px solid var(--border); max-height: 110px; overflow-y: auto;">
              ${['⚽', '🥅', '🧤', '🏆', '🥇', '🥈', '🏃‍♂️', '🔥', '👏', '👍', '💪', '🤝', '💯', '😎', '😃', '😅', '😂', '❤️', '❌', '⏳', '📅', '📍', '💪'].map(em => `
                <button type="button" class="btn sm ghost emoji-btn" data-emoji="${em}" style="font-size: 20px; padding: 4px 6px; min-width: 36px; height: 36px;">${em}</button>
              `).join('')}
            </div>

            <!-- Previsualización de foto/archivo adjunto -->
            <div id="chat-attachment-preview" style="display: none; padding: 8px 14px; background: rgba(34, 211, 238, 0.08); border-bottom: 1px solid var(--border); align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1;">
                <div id="attachment-thumb" style="font-size: 20px; display: flex; align-items: center;">📎</div>
                <span id="attachment-name" style="font-size: 12px; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;"></span>
              </div>
              <button type="button" class="icon-btn ghost" id="chat-clear-attach" style="width: 28px; height: 28px;">✕</button>
            </div>

            <!-- Entrada de texto y botones -->
            <div style="padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 6px;">
              <button type="button" class="icon-btn ghost" id="chat-emoji-toggle" title="Emojis" style="width: 36px; height: 36px; font-size: 18px; flex-shrink: 0;">
                😊
              </button>
              <button type="button" class="icon-btn ghost" id="chat-attach-btn" title="Adjuntar foto o archivo" style="width: 36px; height: 36px; font-size: 18px; flex-shrink: 0;">
                📎
              </button>
              <input type="file" id="chat-file-input" style="display: none;" accept="image/*,application/pdf,text/plain" />
              <input type="text" id="chat-msg-input" placeholder="${t('typeMessage', 'Escribe un mensaje...')}" style="flex: 1; padding: 11px 14px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--bg2); color: #fff; font-size: 14px;" autocomplete="off" />
              <button type="button" class="btn primary" id="chat-send-btn" style="width: 42px; height: 42px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900; flex-shrink: 0;">
                ➤
              </button>
            </div>
          </div>
        </div>
      `;

      function close() {
        currentlyOpenChatId = null;
        if (messagesListenerUnsub) messagesListenerUnsub();
        if (presenceListenerUnsub) presenceListenerUnsub();
        ChatUI.markChatAsRead(curId, chatId, chatData ? chatData.lastMessageTime : 0);
        overlay.remove();
        if (typeof options.onClose === 'function') options.onClose();
      }

      overlay.querySelector('#chat-back-btn').onclick = close;
      overlay.querySelector('#chat-close-btn').onclick = close;

      const msgsContainer = overlay.querySelector('#chat-messages-container');
      const inputEl = overlay.querySelector('#chat-msg-input');
      const sendBtn = overlay.querySelector('#chat-send-btn');
      const emojiToggle = overlay.querySelector('#chat-emoji-toggle');
      const emojiDrawer = overlay.querySelector('#chat-emoji-drawer');
      const attachBtn = overlay.querySelector('#chat-attach-btn');
      const fileInput = overlay.querySelector('#chat-file-input');
      const attachPreview = overlay.querySelector('#chat-attachment-preview');
      const attachName = overlay.querySelector('#attachment-name');
      const attachThumb = overlay.querySelector('#attachment-thumb');
      const clearAttachBtn = overlay.querySelector('#chat-clear-attach');
      const menuBtn = overlay.querySelector('#chat-menu-btn');
      const menuDropdown = overlay.querySelector('#chat-options-dropdown');
      const optMute = overlay.querySelector('#opt-mute-chat');
      const optLeave = overlay.querySelector('#opt-leave-group');
      const optDelete = overlay.querySelector('#opt-delete-chat');
      const presenceIndicator = overlay.querySelector('#chat-presence-indicator');

      // Escuchar presencia en directo si es chat 1 a 1
      if (chatData.participants && chatData.participants.length === 2 && global.Cloud && global.Cloud.listenToUserPresence) {
        const otherId = chatData.participants.find(p => p !== curId);
        if (otherId && otherId !== 'coach') {
          presenceListenerUnsub = global.Cloud.listenToUserPresence(otherId, (pr) => {
            if (!presenceIndicator) return;
            if (pr && pr.isOnline) {
              presenceIndicator.innerHTML = `🟢 <span style="color: #4ade80;">${t('online', 'En línea')}</span>`;
            } else if (pr && pr.lastSeen) {
              presenceIndicator.innerHTML = `⚪ <span style="color: var(--muted);">${t('lastSeen', 'Última vez')}: ${formatTime(pr.lastSeen)}</span>`;
            }
          });
        }
      }

      // Desplegable de menú
      if (menuBtn && menuDropdown) {
        menuBtn.onclick = () => {
          menuDropdown.style.display = menuDropdown.style.display === 'none' ? 'flex' : 'none';
        };
      }

      if (optMute) {
        optMute.onclick = () => {
          const currentMute = localStorage.getItem('chat_muted_' + chatId) === 'true';
          const next = !currentMute;
          localStorage.setItem('chat_muted_' + chatId, next ? 'true' : 'false');
          optMute.textContent = next ? '🔔 ' + t('unmuteNotifications', 'Activar notificaciones') : '🔕 ' + t('muteNotifications', 'Silenciar notificaciones');
          menuDropdown.style.display = 'none';
          if (global.UI && global.UI.toast) {
            global.UI.toast(next ? t('muteNotifications', 'Silenciado') : t('unmuteNotifications', 'Notificaciones activadas'), 'info');
          }
        };
      }

      if (optLeave) {
        optLeave.onclick = async () => {
          if (!confirm(t('leaveGroupConfirm', '¿Seguro que deseas salir del grupo?'))) return;
          if (global.Cloud && global.Cloud.leaveGroup) {
            await global.Cloud.leaveGroup(chatId, curId);
          }
          if (global.UI && global.UI.toast) global.UI.toast(t('leaveGroup', 'Has salido del grupo'), 'info');
          close();
        };
      }

      if (optDelete) {
        optDelete.onclick = async () => {
          if (!confirm(t('deleteChatConfirm', '¿Eliminar esta conversación?'))) return;
          if (global.Cloud && global.Cloud.deleteChat) {
            await global.Cloud.deleteChat(chatId);
          }
          if (global.UI && global.UI.toast) global.UI.toast(t('deleteChat', 'Chat eliminado'), 'info');
          close();
        };
      }

      // Emojis
      if (emojiToggle && emojiDrawer) {
        emojiToggle.onclick = () => {
          emojiDrawer.style.display = emojiDrawer.style.display === 'none' ? 'flex' : 'none';
        };
        emojiDrawer.querySelectorAll('.emoji-btn').forEach(b => {
          b.onclick = () => {
            const em = b.getAttribute('data-emoji');
            inputEl.value += em;
            inputEl.focus();
            haptic(15);
          };
        });
      }

      // Adjuntos (fotos y archivos)
      if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;

          if (file.type.startsWith('image/')) {
            try {
              const base64 = await compressImage(file, 800, 800, 0.75);
              pendingAttachment = { type: 'image', data: base64, name: file.name };
              attachThumb.innerHTML = `<img src="${base64}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;" />`;
              attachName.textContent = file.name;
              attachPreview.style.display = 'flex';
            } catch (err) {
              console.error('Error comprimiendo imagen:', err);
            }
          } else {
            // Archivo genérico
            const reader = new FileReader();
            reader.onload = (e) => {
              pendingAttachment = {
                type: 'file',
                data: e.target.result,
                name: file.name,
                size: file.size,
                mime: file.type
              };
              attachThumb.innerHTML = '📄';
              attachName.textContent = file.name;
              attachPreview.style.display = 'flex';
            };
            reader.readAsDataURL(file);
          }
          fileInput.value = '';
        };
      }

      if (clearAttachBtn) {
        clearAttachBtn.onclick = () => {
          pendingAttachment = null;
          attachPreview.style.display = 'none';
        };
      }

      function scrollToBottom() {
        if (msgsContainer) {
          setTimeout(() => {
            msgsContainer.scrollTop = msgsContainer.scrollHeight;
          }, 40);
        }
      }

      function renderMessages() {
        if (!msgsContainer) return;
        if (messagesList.length === 0) {
          msgsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 16px; color: var(--muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">👋</div>
              <p style="margin: 0; font-size: 13px;">${t('noMessagesYet', 'Aún no hay mensajes en este chat. ¡Envía el primero!')}</p>
            </div>
          `;
          return;
        }

        msgsContainer.innerHTML = messagesList.map(m => {
          const isMine = m.senderId === curId;
          const time = formatTime(m.timestamp);

          let mediaHtml = '';
          if (m.image) {
            mediaHtml += `
              <img src="${m.image}" class="chat-photo-bubble" style="max-width: 220px; max-height: 220px; border-radius: 10px; cursor: pointer; display: block; margin-bottom: ${m.text ? '6px' : '0'}; object-fit: cover;" />
            `;
          }
          if (m.file) {
            mediaHtml += `
              <a href="${m.file.data}" download="${escapeHtml(m.file.name || 'archivo')}" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(0,0,0,0.2); color: inherit; text-decoration: none; font-size: 12px; margin-bottom: ${m.text ? '6px' : '0'}; font-weight: 700;">
                📁 ${escapeHtml(m.file.name || 'documento')}
              </a>
            `;
          }

          return `
            <div style="display: flex; flex-direction: column; align-items: ${isMine ? 'flex-end' : 'flex-start'};">
              ${!isMine ? `<small style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 3px; padding-left: 4px;">${escapeHtml(m.senderName || 'Usuario')}</small>` : ''}
              <div style="max-width: 82%; padding: 10px 14px; border-radius: ${isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; background: ${isMine ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'var(--surface2)'}; color: ${isMine ? '#031206' : '#fff'}; border: ${isMine ? 'none' : '1px solid var(--border)'}; font-size: 14px; line-height: 1.45; word-break: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                ${mediaHtml}
                ${m.text ? `<div>${escapeHtml(m.text)}</div>` : ''}
              </div>
              <small style="font-size: 10px; color: var(--muted); margin-top: 2px; padding: 0 4px;">${time}</small>
            </div>
          `;
        }).join('');

        msgsContainer.querySelectorAll('.chat-photo-bubble').forEach(img => {
          img.onclick = () => openPhotoLightbox(img.src);
        });

        scrollToBottom();
      }

      async function handleSend() {
        const text = inputEl.value.trim();
        const hasAttach = !!pendingAttachment;
        if (!text && !hasAttach) return;

        const attachToSend = pendingAttachment;
        inputEl.value = '';
        pendingAttachment = null;
        if (attachPreview) attachPreview.style.display = 'none';
        if (emojiDrawer) emojiDrawer.style.display = 'none';
        haptic(25);

        if (global.Cloud && global.Cloud.sendChatMessage) {
          const payload = {
            senderId: curId,
            senderName: curName,
            text: text
          };
          if (attachToSend && attachToSend.type === 'image') {
            payload.image = attachToSend.data;
          } else if (attachToSend && attachToSend.type === 'file') {
            payload.file = attachToSend;
          }
          await global.Cloud.sendChatMessage(chatId, payload);
          // Actualizar hora de lectura propia
          ChatUI.markChatAsRead(curId, chatId);
        }
        inputEl.focus();
      }

      sendBtn.onclick = handleSend;
      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSend();
        }
      };

      if (global.Cloud && global.Cloud.listenToChatMessages) {
        messagesListenerUnsub = global.Cloud.listenToChatMessages(chatId, (msgs) => {
          const prevLen = messagesList.length;
          messagesList = msgs || [];
          renderMessages();

          // Actualizar marca de lectura
          const maxMsgTime = msgs.reduce((acc, m) => Math.max(acc, m.timestamp || 0), Date.now());
          ChatUI.markChatAsRead(curId, chatId, maxMsgTime);

          if (messagesList.length > prevLen && prevLen > 0) {
            const lastMsg = messagesList[messagesList.length - 1];
            if (lastMsg && lastMsg.senderId !== curId) {
              haptic(35);
              sendNotification(lastMsg.senderName || 'Chat', lastMsg.text || '📷 Archivo nuevo', chatId);
            }
          }
        });
      }

      document.body.appendChild(overlay);
      setTimeout(() => { if (inputEl) inputEl.focus(); }, 120);
    },

    // Modal para crear grupo de chat personalizado
    openNewGroupModal: function (options) {
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || 'Usuario';
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">👥 ${t('newGroupChat', 'Nuevo Grupo de Chat')}</h3>
            <button type="button" class="icon-btn ghost" id="dlg-group-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <label style="display: block; font-size: 12px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">
            ${t('groupName', 'Nombre del Grupo *')}
          </label>
          <input type="text" id="inp-group-name" placeholder="Ej: Delanteros, Torneo Sábado..." style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px; margin-bottom: 12px;" />

          <label style="display: block; font-size: 12px; font-weight: 800; color: var(--muted); margin-bottom: 6px;">
            ${t('groupMembers', 'Seleccionar Participantes:')}
          </label>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 40vh; overflow-y: auto; margin-bottom: 14px;" id="group-players-picker">
            ${!options.isCoach ? `
              <label style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); cursor: pointer;">
                <input type="checkbox" value="coach" class="group-p-chk" style="width: 18px; height: 18px; accent-color: var(--cyan);" />
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 13px; color: #fff; display: block;">👨‍🏫 ${t('coach', 'Entrenador')}</b>
                  <small style="color: var(--cyan); font-size: 11px;">Staff Técnico</small>
                </div>
              </label>
            ` : ''}
            ${allPlayers.filter(p => p.id !== curId).map(p => {
              const tm = allTeams.find(t => t.id === p.teamId);
              return `
                <label style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer;">
                  <input type="checkbox" value="${p.id}" class="group-p-chk" style="width: 18px; height: 18px; accent-color: var(--cyan);" />
                  <div style="flex: 1; overflow: hidden;">
                    <b style="font-size: 13px; color: #fff; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                      #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                    </b>
                    <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'} ${tm ? '• ' + escapeHtml(tm.name) : ''}</small>
                  </div>
                </label>
              `;
            }).join('')}
          </div>

          <button type="button" class="btn block primary" id="btn-submit-create-group" style="height: 44px; font-weight: 900; font-size: 13.5px;">
            🚀 ${t('createGroupBtn', 'Crear y Abrir Grupo')}
          </button>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-group-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      const btnSubmit = overlay.querySelector('#btn-submit-create-group');
      btnSubmit.onclick = async () => {
        const name = overlay.querySelector('#inp-group-name').value.trim();
        if (!name) {
          if (global.UI && global.UI.toast) global.UI.toast('Por favor introduce un nombre para el grupo', 'error');
          return;
        }

        const selectedIds = [];
        overlay.querySelectorAll('.group-p-chk:checked').forEach(c => {
          selectedIds.push(c.value);
        });

        if (selectedIds.length === 0) {
          if (global.UI && global.UI.toast) global.UI.toast('Selecciona al menos un participante para el grupo', 'error');
          return;
        }

        selectedIds.push(curId);

        btnSubmit.disabled = true;
        btnSubmit.textContent = t('creating', 'Creando...');

        const groupId = 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const chatData = {
          id: groupId,
          name: name,
          type: 'group',
          createdBy: curId,
          participants: selectedIds,
          createdAt: Date.now()
        };

        if (global.Cloud && global.Cloud.createOrGetChat) {
          await global.Cloud.createOrGetChat(chatData);
        }

        close();
        if (typeof options.onCreated === 'function') {
          options.onCreated(groupId);
        }
      };

      document.body.appendChild(overlay);
    },

    // Iniciar chat directo con un jugador concreto
    startDirectChat: function (otherUserId, otherUserName, options = {}) {
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || 'Usuario';
      const isCoach = !!options.isCoach;

      const p1 = curId < otherUserId ? curId : otherUserId;
      const p2 = curId < otherUserId ? otherUserId : curId;
      const chatId = `direct_${p1}_${p2}`;

      ChatUI.openConversationModal(chatId, {
        currentUserId: curId,
        currentUserName: curName,
        isCoach: isCoach,
        title: otherUserName || 'Chat Directo',
        chatData: {
          id: chatId,
          type: 'direct',
          name: otherUserName || 'Chat Directo',
          participants: [curId, otherUserId]
        }
      });
    }
  };

  global.ChatUI = ChatUI;
})(typeof window !== 'undefined' ? window : this);

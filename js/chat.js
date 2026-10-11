/* =========================================================
   Chat en Vivo • Player Stats (Coach & Player)
   - Chat directo 1 a 1 entre jugadores y con el entrenador
   - Chats fijados (pinned) en la parte superior para jugadores:
     1) Chat grupal del equipo (con entrenador y jugadores)
     2) Chat privado 1 a 1 con el entrenador
   - Botón "+" compacto con opciones: Crear grupo o Mensaje privado
   - Grupos personalizados con selección de icono/emoji y foto de grupo (ampliable)
   - Posibilidad de editar nombre/foto/emoji del grupo y añadir nuevos participantes
   - Notificaciones canceladas en Android al entrar al chat
   - Teclado no se abre automáticamente al abrir la ventana de chat
   - Miniatura y nombre del emisor clicable para abrir su perfil
   - Reacciones con emojis a los mensajes (👍, ❤️, 😂, 🔥, 👏, ⚽)
   - Citar / responder mensajes (reply/quote)
   - Presencia en línea (🟢 En línea / Última vez)
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

  let currentlyOpenChatId = null;

  function isChatMuted(chatId) {
    try {
      if (localStorage.getItem('chat_global_muted') === 'true' || localStorage.getItem('chat_muted_all') === 'true') return true;
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

  function getChatAvatar(c, curId, allPlayers) {
    if (c.photo) {
      return `<img src="${c.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover; cursor: pointer;" class="chat-avatar-thumb" />`;
    }
    if (c.iconEmoji) {
      return `<span>${c.iconEmoji}</span>`;
    }
    if (c.type === 'coach' || c.id.startsWith('coach_')) {
      return '<span>👨‍🏫</span>';
    }
    if (c.type === 'team' || c.id.startsWith('team_')) {
      return '<span>🛡️</span>';
    }
    if (c.type === 'direct' || c.id.startsWith('direct_')) {
      const parts = c.participants || [];
      const otherId = parts.find(p => p !== curId) || (parts[0] === curId ? parts[1] : parts[0]);
      if (!otherId || otherId === 'coach') return '<span>👨‍🏫</span>';
      const p = (allPlayers || []).find(x => x.id === otherId);
      if (p && p.photo) {
        return `<img src="${p.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />`;
      }
      return '<span>👤</span>';
    }
    if (c.type === 'group' || c.id.startsWith('group_')) {
      return '<span>👥</span>';
    }
    return '<span>💬</span>';
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
            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn sm ghost" id="btn-toggle-global-mute" style="font-size: 15px; height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%;" title="${isMutedGlobal ? t('unmuteNotifications', 'Activar notificaciones') : t('muteNotifications', 'Silenciar notificaciones')}">
                ${isMutedGlobal ? '🔕' : '🔔'}
              </button>
              <button type="button" class="btn sm primary" id="btn-chat-plus" style="font-weight: 900; font-size: 18px; width: 38px; height: 38px; border-radius: 50%; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="${t('newChat', 'Nuevo chat o grupo')}">
                ➕
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
      const btnChatPlus = container.querySelector('#btn-chat-plus');
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

      if (btnChatPlus) {
        btnChatPlus.onclick = () => {
          ChatUI.openNewChatActionSheet({
            currentUserId: curId,
            currentUserName: curName,
            isCoach: isCoach,
            players: allPlayers,
            teams: allTeams
          });
        };
      }

      function renderRooms() {
        if (!listEl) return;
        const q = activeSearch.toLowerCase().trim();

        // Identificar equipo del jugador si no es coach
        const myP = allPlayers.find(p => p.id === curId);
        const myTeamId = myP ? myP.teamId : null;
        const myTeam = allTeams.find(t => t.id === myTeamId);

        // Chats del sistema
        const defaultTeamChats = allTeams.map(tm => ({
          id: `team_${tm.id}`,
          type: 'team',
          name: `🛡️ Chat: ${tm.name}`,
          teamId: tm.id,
          participants: allPlayers.filter(p => p.teamId === tm.id).map(p => p.id).concat(['coach']),
          lastMessage: '',
          lastMessageTime: 0
        }));

        const mergedMap = {};
        defaultTeamChats.forEach(c => { mergedMap[c.id] = c; });

        // PINES OBLIGATORIOS PARA JUGADORES:
        // 1) Chat grupal de su equipo con el entrenador
        // 2) Chat privado 1 a 1 con el entrenador
        let pinnedTeamId = null;
        let pinnedCoachChatId = null;

        if (!isCoach) {
          pinnedTeamId = myTeamId ? `team_${myTeamId}` : 'team_general';
          const teamDisplayName = myTeam ? myTeam.name : t('squadGeneral', 'General del Equipo');
          mergedMap[pinnedTeamId] = Object.assign({
            id: pinnedTeamId,
            type: 'team',
            teamId: myTeamId,
            participants: myTeamId ? allPlayers.filter(p => p.teamId === myTeamId).map(p => p.id).concat(['coach']) : allPlayers.map(p => p.id).concat(['coach'])
          }, mergedMap[pinnedTeamId] || {}, {
            isPinned: true,
            name: `🛡️ Chat: ${teamDisplayName} (${t('coachAndTeammates', 'con Entrenador y jugadores')})`
          });

          pinnedCoachChatId = `coach_${curId}`;
          mergedMap[pinnedCoachChatId] = Object.assign({
            id: pinnedCoachChatId,
            type: 'coach',
            participants: [curId, 'coach']
          }, mergedMap[pinnedCoachChatId] || {}, {
            isPinned: true,
            name: `👨‍🏫 ${t('privateWithCoach', 'Chat Privado con el Entrenador')}`
          });
        }

        // Combinar con chats de la nube
        rawChats.forEach(c => {
          if (c && c.id) {
            const wasPinned = mergedMap[c.id] ? mergedMap[c.id].isPinned : false;
            mergedMap[c.id] = Object.assign({}, mergedMap[c.id] || {}, c);
            if (wasPinned) mergedMap[c.id].isPinned = true;
          }
        });

        let displayChats = Object.values(mergedMap).filter(c => {
          // Filtrar por membresía: coach ve todo, jugador ve donde es participante o de su equipo
          if (!isCoach) {
            if (c.type === 'team') {
              if (c.teamId && myTeamId && c.teamId !== myTeamId) return false;
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

        // ORDEN: Fijados (pinned) arriba de todo, luego por fecha de mensaje reciente
        displayChats.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (a.isPinned && b.isPinned) {
            if (a.type === 'team') return -1;
            if (b.type === 'team') return 1;
          }
          return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
        });

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
              displayName = `👨‍🏫 ${t('coach', 'Entrenador (Coach)')}`;
            } else {
              const p = (allPlayers || []).find(x => x.id === otherId);
              if (p) displayName = `#${p.mainDorsal != null ? p.mainDorsal : '-'} ${p.name || ''} ${p.lastName || ''}`.trim();
            }
          }

          const timeStr = formatTime(c.lastMessageTime);
          const avatarHtml = getChatAvatar(c, curId, allPlayers);
          const snippet = c.lastMessage
            ? `<span style="color: #cbd5e1;">${escapeHtml(c.lastSenderName ? c.lastSenderName + ': ' : '')}${escapeHtml(c.lastMessage)}</span>`
            : `<span style="color: var(--muted); font-style: italic;">${t('noMessagesYet', 'Toca para empezar a hablar')}</span>`;

          const lastRead = parseInt(localStorage.getItem(`chat_last_read_${curId}_${c.id}`) || '0', 10);
          const isUnread = (c.lastMessageTime || 0) > lastRead && c.lastSenderId && c.lastSenderId !== curId;
          const isMuted = isChatMuted(c.id);

          return `
            <div class="card chat-room-card" data-chat-id="${c.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid ${isUnread ? 'rgba(34, 211, 238, 0.6)' : (c.isPinned ? 'rgba(250, 204, 21, 0.35)' : 'var(--border)')}; cursor: pointer; transition: all 0.15s; background: ${isUnread ? 'rgba(34, 211, 238, 0.06)' : (c.isPinned ? 'rgba(250, 204, 21, 0.04)' : 'var(--surface2)')}; border-radius: 14px; position: relative;">
              <div style="width: 44px; height: 44px; border-radius: 13px; background: rgba(34, 211, 238, 0.12); border: 1.5px solid rgba(34, 211, 238, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; position: relative; overflow: hidden;">
                ${avatarHtml}
                ${isUnread ? `<span class="chat-card-unread-dot" style="position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 50%; background: #ef4444; border: 2px solid var(--surface2);"></span>` : ''}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <b style="font-size: 14.5px; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: flex; align-items: center; gap: 6px;">
                    ${c.isPinned ? '<span style="font-size: 13px;" title="' + t('pinned', 'Fijado') + '">📌</span>' : ''}
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
              players: allPlayers,
              teams: allTeams,
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

    // Menú de acción del botón "+" (Crear grupo o Mandar mensaje privado)
    openNewChatActionSheet: function (options) {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-width: 380px; width: 90%; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">➕ ${t('newChat', 'Nuevo Chat')}</h3>
            <button type="button" class="icon-btn ghost" id="dlg-action-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="btn primary block" id="btn-action-create-group" style="height: 48px; justify-content: flex-start; padding: 0 16px; gap: 12px; font-weight: 800; font-size: 13.5px;">
              <span style="font-size: 20px;">👥</span>
              <div style="text-align: left;">
                <div>${t('createGroupChat', 'Crear un grupo')}</div>
                <small style="font-size: 11px; opacity: 0.85; font-weight: 600;">${t('createGroupSub', 'Seleccionar varios compañeros y entrenador')}</small>
              </div>
            </button>

            <button type="button" class="btn ghost block" id="btn-action-direct-msg" style="height: 48px; justify-content: flex-start; padding: 0 16px; gap: 12px; font-weight: 800; font-size: 13.5px; border: 1.5px solid var(--border); background: var(--surface2);">
              <span style="font-size: 20px;">💬</span>
              <div style="text-align: left;">
                <div>${t('sendPrivateMsg', 'Mandar mensaje privado')}</div>
                <small style="font-size: 11px; color: var(--muted); font-weight: 600;">${t('sendPrivateMsgSub', 'Iniciar chat directo 1 a 1')}</small>
              </div>
            </button>
          </div>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-action-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      overlay.querySelector('#btn-action-create-group').onclick = () => {
        close();
        ChatUI.openNewGroupModal({
          currentUserId: options.currentUserId,
          currentUserName: options.currentUserName,
          isCoach: options.isCoach,
          players: options.players,
          teams: options.teams,
          onCreated: (chatId) => {
            ChatUI.openConversationModal(chatId, options);
          }
        });
      };

      overlay.querySelector('#btn-action-direct-msg').onclick = () => {
        close();
        ChatUI.openSelectUserForDirectChatModal(options);
      };

      document.body.appendChild(overlay);
    },

    // Selector de usuario para chat directo 1 a 1
    openSelectUserForDirectChatModal: function (options) {
      const curId = options.currentUserId || 'coach';
      const isCoach = !!options.isCoach;
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 420px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">💬 ${t('sendPrivateMsg', 'Mandar mensaje privado')}</h3>
            <button type="button" class="icon-btn ghost" id="dlg-direct-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <input type="text" id="direct-search-inp" placeholder="${t('searchUser', 'Buscar jugador o entrenador...')}" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px; margin-bottom: 10px;" />

          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;" id="direct-users-list">
            ${!isCoach ? `
              <div class="card direct-user-item" data-uid="coach" data-uname="${t('coach', 'Entrenador')}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1.5px solid rgba(250, 204, 21, 0.4); background: rgba(250, 204, 21, 0.08); cursor: pointer; border-radius: 12px;">
                <span style="font-size: 24px;">👨‍🏫</span>
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 14px; color: #fff; display: block;">${t('coach', 'Entrenador')}</b>
                  <small style="color: #fde047; font-size: 11px;">Staff Técnico Principal</small>
                </div>
                <span style="color: #facc15; font-size: 13px;">➔</span>
              </div>
            ` : ''}

            ${allPlayers.filter(p => p.id !== curId).map(p => {
              const tm = allTeams.find(t => t.id === p.teamId);
              const displayName = `#${p.mainDorsal != null ? p.mainDorsal : '-'} ${p.name || ''} ${p.lastName || ''}`.trim();
              return `
                <div class="card direct-user-item" data-uid="${p.id}" data-uname="${escapeHtml(displayName)}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); background: var(--surface2); cursor: pointer; border-radius: 12px;">
                  <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(34, 211, 238, 0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; overflow: hidden;">
                    ${p.photo ? `<img src="${p.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : '👤'}
                  </div>
                  <div style="flex: 1; overflow: hidden;">
                    <b style="font-size: 13.5px; color: #fff; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                      ${escapeHtml(displayName)}
                    </b>
                    <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'} ${tm ? '• ' + escapeHtml(tm.name) : ''}</small>
                  </div>
                  <span style="color: var(--cyan); font-size: 13px;">➔</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-direct-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      const searchInp = overlay.querySelector('#direct-search-inp');
      const listEl = overlay.querySelector('#direct-users-list');

      if (searchInp && listEl) {
        searchInp.oninput = () => {
          const q = searchInp.value.toLowerCase().trim();
          listEl.querySelectorAll('.direct-user-item').forEach(it => {
            const name = it.getAttribute('data-uname').toLowerCase();
            it.style.display = (!q || name.includes(q)) ? 'flex' : 'none';
          });
        };
      }

      listEl.querySelectorAll('.direct-user-item').forEach(it => {
        it.onclick = () => {
          const uid = it.getAttribute('data-uid');
          const uname = it.getAttribute('data-uname');
          close();
          ChatUI.startDirectChat(uid, uname, options);
        };
      });

      document.body.appendChild(overlay);
    },

    // Modal para crear grupo de chat personalizado con foto y selector de emoji
    openNewGroupModal: function (options) {
      const curId = options.currentUserId || 'coach';
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      let selectedEmoji = '👥';
      let customPhotoData = null;

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">👥 ${t('newGroupChat', 'Nuevo Grupo de Chat')}</h3>
            <button type="button" class="icon-btn ghost" id="dlg-group-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <div style="overflow-y: auto; flex: 1; padding-right: 2px;">
            <!-- Nombre del Grupo -->
            <label style="display: block; font-size: 12px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">
              ${t('groupName', 'Nombre del Grupo *')}
            </label>
            <input type="text" id="inp-group-name" placeholder="Ej: Delanteros, Torneo Sábado..." style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px; margin-bottom: 12px;" />

            <!-- Icono y Foto del Grupo -->
            <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: 12px;">
              <label style="display: block; font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 6px;">
                🎨 ${t('groupIconAndPhoto', 'Icono o Foto del Grupo')}
              </label>

              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div id="group-icon-preview" style="width: 48px; height: 48px; border-radius: 14px; background: rgba(34, 211, 238, 0.15); border: 2px solid var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; overflow: hidden; cursor: pointer;">
                  <span>👥</span>
                </div>
                <div style="flex: 1;">
                  <button type="button" class="btn sm ghost" id="btn-upload-group-photo" style="font-size: 12px; height: 34px; padding: 0 10px; border: 1px dashed var(--cyan); color: var(--cyan); font-weight: 800;">
                    📷 ${t('uploadGroupPhoto', 'Subir foto de grupo')}
                  </button>
                  <input type="file" id="inp-group-photo-file" accept="image/*" style="display: none;" />
                  <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${t('groupPhotoSub', 'Se podrá pulsar para ampliarla')}</div>
                </div>
              </div>

              <!-- Selector rápido de emojis -->
              <div style="font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">${t('pickGroupEmoji', 'O elige un emoji para el grupo:')}</div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="group-emoji-picker">
                ${['👥', '⚽', '🔥', '🏆', '🎯', '⭐', '💪', '🧤', '⚡', '👑'].map(em => `
                  <button type="button" class="btn sm ghost group-em-btn ${em === '👥' ? 'primary' : ''}" data-em="${em}" style="font-size: 18px; padding: 4px 6px; min-width: 34px; height: 34px; border-radius: 8px;">${em}</button>
                `).join('')}
              </div>
            </div>

            <!-- Participantes -->
            <label style="display: block; font-size: 12px; font-weight: 800; color: var(--muted); margin-bottom: 6px;">
              ${t('groupMembers', 'Seleccionar Participantes:')}
            </label>
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 35vh; overflow-y: auto; margin-bottom: 14px;" id="group-players-picker">
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
          </div>

          <button type="button" class="btn block primary" id="btn-submit-create-group" style="height: 44px; font-weight: 900; font-size: 13.5px; margin-top: 10px;">
            🚀 ${t('createGroupBtn', 'Crear y Abrir Grupo')}
          </button>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-group-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      const iconPreview = overlay.querySelector('#group-icon-preview');
      const btnUploadPhoto = overlay.querySelector('#btn-upload-group-photo');
      const inpPhotoFile = overlay.querySelector('#inp-group-photo-file');

      if (btnUploadPhoto && inpPhotoFile) {
        btnUploadPhoto.onclick = () => inpPhotoFile.click();
        inpPhotoFile.onchange = async () => {
          const file = inpPhotoFile.files && inpPhotoFile.files[0];
          if (!file) return;
          try {
            const base64 = await compressImage(file, 400, 400, 0.8);
            customPhotoData = base64;
            iconPreview.innerHTML = `<img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            haptic(20);
          } catch (e) {
            console.error('Error foto grupo:', e);
          }
        };
      }

      overlay.querySelectorAll('.group-em-btn').forEach(b => {
        b.onclick = () => {
          overlay.querySelectorAll('.group-em-btn').forEach(x => { x.className = 'btn sm ghost group-em-btn'; });
          b.className = 'btn sm primary group-em-btn';
          selectedEmoji = b.getAttribute('data-em');
          customPhotoData = null;
          iconPreview.innerHTML = `<span>${selectedEmoji}</span>`;
          haptic(15);
        };
      });

      const btnSubmit = overlay.querySelector('#btn-submit-create-group');
      btnSubmit.onclick = async () => {
        const name = overlay.querySelector('#inp-group-name').value.trim();
        if (!name) {
          if (global.UI && global.UI.toast) global.UI.toast('Introduce un nombre para el grupo', 'error');
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
          iconEmoji: selectedEmoji || '👥',
          photo: customPhotoData || null,
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

    // Modal para editar nombre, foto o emoji de un grupo existente
    openEditGroupModal: function (chatId, currentChatData, onUpdated) {
      let selectedEmoji = currentChatData.iconEmoji || '👥';
      let customPhotoData = currentChatData.photo || null;

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-width: 400px; width: 92%; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">✏️ ${t('editGroup', 'Editar Grupo')}</h3>
            <button type="button" class="icon-btn ghost" id="dlg-edit-g-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <label style="display: block; font-size: 12px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">
            ${t('groupName', 'Nombre del Grupo')}
          </label>
          <input type="text" id="inp-edit-g-name" value="${escapeHtml(currentChatData.name || '')}" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px; margin-bottom: 12px;" />

          <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <div id="edit-g-icon-preview" style="width: 48px; height: 48px; border-radius: 14px; background: rgba(34, 211, 238, 0.15); border: 2px solid var(--cyan); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; overflow: hidden; cursor: pointer;">
                ${customPhotoData ? `<img src="${customPhotoData}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span>${selectedEmoji}</span>`}
              </div>
              <div style="flex: 1;">
                <button type="button" class="btn sm ghost" id="btn-edit-g-upload-photo" style="font-size: 12px; height: 34px; padding: 0 10px; border: 1px dashed var(--cyan); color: var(--cyan); font-weight: 800;">
                  📷 ${t('changePhoto', 'Cambiar foto')}
                </button>
                <input type="file" id="inp-edit-g-photo-file" accept="image/*" style="display: none;" />
              </div>
            </div>

            <div style="font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">${t('pickGroupEmoji', 'O elige emoji:')}</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${['👥', '⚽', '🔥', '🏆', '🎯', '⭐', '💪', '🧤', '⚡', '👑'].map(em => `
                <button type="button" class="btn sm ghost edit-em-btn ${em === selectedEmoji && !customPhotoData ? 'primary' : ''}" data-em="${em}" style="font-size: 18px; padding: 4px 6px; min-width: 34px; height: 34px; border-radius: 8px;">${em}</button>
              `).join('')}
            </div>
          </div>

          <button type="button" class="btn block primary" id="btn-save-group-edits" style="height: 44px; font-weight: 900; font-size: 13.5px;">
            💾 ${t('save', 'Guardar Cambios')}
          </button>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-edit-g-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      const iconPreview = overlay.querySelector('#edit-g-icon-preview');
      const btnUpload = overlay.querySelector('#btn-edit-g-upload-photo');
      const inpFile = overlay.querySelector('#inp-edit-g-photo-file');

      if (btnUpload && inpFile) {
        btnUpload.onclick = () => inpFile.click();
        inpFile.onchange = async () => {
          const file = inpFile.files && inpFile.files[0];
          if (!file) return;
          try {
            const base64 = await compressImage(file, 400, 400, 0.8);
            customPhotoData = base64;
            iconPreview.innerHTML = `<img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            haptic(20);
          } catch (e) {}
        };
      }

      overlay.querySelectorAll('.edit-em-btn').forEach(b => {
        b.onclick = () => {
          overlay.querySelectorAll('.edit-em-btn').forEach(x => { x.className = 'btn sm ghost edit-em-btn'; });
          b.className = 'btn sm primary edit-em-btn';
          selectedEmoji = b.getAttribute('data-em');
          customPhotoData = null;
          iconPreview.innerHTML = `<span>${selectedEmoji}</span>`;
          haptic(15);
        };
      });

      overlay.querySelector('#btn-save-group-edits').onclick = async () => {
        const name = overlay.querySelector('#inp-edit-g-name').value.trim();
        if (!name) return;
        const updates = {
          name: name,
          iconEmoji: selectedEmoji,
          photo: customPhotoData
        };
        if (global.Cloud && global.Cloud.updateChatDetails) {
          await global.Cloud.updateChatDetails(chatId, updates);
        }
        if (global.UI && global.UI.toast) global.UI.toast(t('savedSuccess', 'Guardado con éxito'), 'success');
        close();
        if (onUpdated) onUpdated(updates);
      };

      document.body.appendChild(overlay);
    },

    // Modal para añadir jugadores a un grupo existente
    openAddParticipantsModal: function (chatId, currentChatData, allPlayers, onAdded) {
      const existing = new Set(currentChatData.participants || []);
      const candidates = (allPlayers || []).filter(p => !existing.has(p.id));

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 420px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">➕ ${t('addParticipants', 'Añadir al Grupo')}</h3>
            <button type="button" class="icon-btn ghost" id="dlg-add-p-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
            ${candidates.length === 0 ? `
              <div style="text-align: center; padding: 24px; color: var(--muted); font-size: 12.5px;">
                ${t('allPlayersAlreadyInGroup', 'Todos los jugadores ya forman parte del grupo.')}
              </div>
            ` : candidates.map(p => `
              <label style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer;">
                <input type="checkbox" value="${p.id}" class="add-cand-chk" style="width: 18px; height: 18px; accent-color: var(--cyan);" />
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 13px; color: #fff; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </b>
                  <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                </div>
              </label>
            `).join('')}
          </div>

          ${candidates.length > 0 ? `
            <button type="button" class="btn block primary" id="btn-submit-add-cand" style="height: 44px; font-weight: 900; font-size: 13.5px;">
              🚀 ${t('addSelected', 'Añadir Seleccionados')}
            </button>
          ` : ''}
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-add-p-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      const btnSubmit = overlay.querySelector('#btn-submit-add-cand');
      if (btnSubmit) {
        btnSubmit.onclick = async () => {
          const selected = [];
          overlay.querySelectorAll('.add-cand-chk:checked').forEach(c => selected.push(c.value));
          if (selected.length === 0) return;
          if (global.Cloud && global.Cloud.addChatParticipants) {
            await global.Cloud.addChatParticipants(chatId, selected);
          }
          if (global.UI && global.UI.toast) global.UI.toast(t('playersAdded', 'Jugadores añadidos al grupo'), 'success');
          close();
          if (onAdded) onAdded(selected);
        };
      }

      document.body.appendChild(overlay);
    },

    // Abre el modal de conversación en tiempo real
    openConversationModal: function (chatId, options) {
      if (!chatId) return;
      currentlyOpenChatId = chatId;
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || (options.isCoach ? 'Entrenador' : 'Jugador');
      const isCoach = !!options.isCoach;
      const chatData = options.chatData || {};
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      // Cancelar notificaciones de Android del sistema al entrar
      if (global.AndroidBridge && global.AndroidBridge.clearNotifications) {
        try { global.AndroidBridge.clearNotifications(); } catch (e) {}
      }

      let resolvedTitle = options.title || 'Chat';
      if (chatData.type === 'direct' || chatId.startsWith('direct_')) {
        const parts = chatData.participants || chatId.replace('direct_', '').split('_');
        const otherId = parts.find(p => p !== curId) || (parts[0] === curId ? parts[1] : parts[0]);
        if (!otherId || otherId === 'coach') {
          resolvedTitle = `👨‍🏫 ${t('coach', 'Entrenador (Coach)')}`;
        }
      }

      // Marcar como leído inmediatamente
      ChatUI.markChatAsRead(curId, chatId, chatData ? chatData.lastMessageTime : 0);

      let messagesListenerUnsub = null;
      let presenceListenerUnsub = null;
      let messagesList = [];
      let pendingAttachment = null;
      let currentReplyTo = null; // { id, text, senderName }

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
              <div id="chat-header-avatar" style="width: 36px; height: 36px; border-radius: 10px; background: rgba(34,211,238,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; overflow: hidden; cursor: pointer;">
                ${getChatAvatar(chatData, curId, allPlayers)}
              </div>
              <div style="overflow: hidden; flex: 1;">
                <h3 id="chat-header-title" style="margin: 0; font-size: 15.5px; font-weight: 900; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: #fff;">
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
            ${(chatData.type === 'group' || chatId.startsWith('group_')) ? `
              <button type="button" class="btn sm ghost" id="opt-edit-group" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
                ✏️ ${t('editGroup', 'Cambiar nombre e icono del grupo')}
              </button>
              <button type="button" class="btn sm ghost" id="opt-add-participants" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
                ➕ ${t('addParticipants', 'Añadir jugadores al grupo')}
              </button>
            ` : ''}
            <button type="button" class="btn sm ghost" id="opt-mute-chat" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
              ${isMutedThis ? '🔔 ' + t('unmuteNotifications', 'Activar notificaciones') : '🔕 ' + t('muteNotifications', 'Silenciar notificaciones')}
            </button>
            ${(chatData.type === 'group' || chatId.startsWith('group_')) ? `
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
            <!-- Barra de respuesta / cita (reply) -->
            <div id="chat-reply-preview" style="display: none; padding: 8px 14px; background: rgba(34, 211, 238, 0.12); border-bottom: 1px solid var(--border); align-items: center; justify-content: space-between; font-size: 12px; color: #38bdf8;">
              <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1;">
                <span>↩️</span>
                <span id="chat-reply-text" style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden; flex: 1;"></span>
              </div>
              <button type="button" class="icon-btn ghost" id="chat-clear-reply" style="width: 26px; height: 26px; font-size: 13px;">✕</button>
            </div>

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
      const optEditGroup = overlay.querySelector('#opt-edit-group');
      const optAddParticipants = overlay.querySelector('#opt-add-participants');
      const presenceIndicator = overlay.querySelector('#chat-presence-indicator');
      const replyPreview = overlay.querySelector('#chat-reply-preview');
      const replyText = overlay.querySelector('#chat-reply-text');
      const clearReplyBtn = overlay.querySelector('#chat-clear-reply');
      const headerAvatar = overlay.querySelector('#chat-header-avatar');
      const headerTitle = overlay.querySelector('#chat-header-title');

      if (headerAvatar && chatData.photo) {
        headerAvatar.onclick = () => openPhotoLightbox(chatData.photo);
      }

      if (clearReplyBtn) {
        clearReplyBtn.onclick = () => {
          currentReplyTo = null;
          replyPreview.style.display = 'none';
        };
      }

      // Presencia en directo si es chat 1 a 1
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

      if (optEditGroup) {
        optEditGroup.onclick = () => {
          menuDropdown.style.display = 'none';
          ChatUI.openEditGroupModal(chatId, chatData, (updates) => {
            if (updates.name && headerTitle) headerTitle.textContent = updates.name;
            if (headerAvatar) {
              headerAvatar.innerHTML = getChatAvatar(Object.assign(chatData, updates), curId, allPlayers);
            }
          });
        };
      }

      if (optAddParticipants) {
        optAddParticipants.onclick = () => {
          menuDropdown.style.display = 'none';
          ChatUI.openAddParticipantsModal(chatId, chatData, allPlayers, (added) => {
            chatData.participants = (chatData.participants || []).concat(added);
          });
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

      // Emojis en entrada
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

      function onSenderProfileClick(senderId) {
        haptic(25);
        if (senderId === 'coach') {
          if (typeof global.__showCoachProfile === 'function') {
            global.__showCoachProfile();
          }
        } else {
          if (typeof global.__showPlayerProfile === 'function') {
            global.__showPlayerProfile(senderId);
          }
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

        const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '⚽'];

        msgsContainer.innerHTML = messagesList.map((m, idx) => {
          const isMine = m.senderId === curId;
          const time = formatTime(m.timestamp);

          // Avatar y nombre del emisor
          let senderAvatarHtml = '👤';
          if (m.senderId === 'coach') {
            senderAvatarHtml = '👨‍🏫';
          } else {
            const p = (allPlayers || []).find(x => x.id === m.senderId);
            if (p && p.photo) {
              senderAvatarHtml = `<img src="${p.photo}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            }
          }

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

          // Cita / respuesta previa (replyTo)
          let quoteHtml = '';
          if (m.replyTo) {
            quoteHtml = `
              <div style="border-left: 3px solid ${isMine ? '#031206' : '#22d3ee'}; padding: 4px 8px; margin-bottom: 6px; background: rgba(0,0,0,0.15); border-radius: 4px; font-size: 11.5px; opacity: 0.9;">
                <b style="color: ${isMine ? '#031206' : '#38bdf8'};">${escapeHtml(m.replyTo.senderName || 'Usuario')}</b>:
                <span>${escapeHtml(m.replyTo.text || '')}</span>
              </div>
            `;
          }

          // Reacciones
          const reactionsMap = m.reactions || {};
          const reactionsEntries = Object.entries(reactionsMap).filter(([em, users]) => Array.isArray(users) && users.length > 0);

          return `
            <div class="chat-msg-row" data-mid="${m.id}" data-idx="${idx}" style="display: flex; gap: 8px; align-items: flex-end; justify-content: ${isMine ? 'flex-end' : 'flex-start'}; margin-bottom: 4px;">
              ${!isMine ? `
                <div class="chat-sender-avatar" data-sender-id="${m.senderId}" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(34, 211, 238, 0.2); border: 1.5px solid rgba(34, 211, 238, 0.4); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; cursor: pointer; overflow: hidden; margin-bottom: 2px;" title="${t('viewProfile', 'Ver perfil')}">
                  ${senderAvatarHtml}
                </div>
              ` : ''}

              <div style="display: flex; flex-direction: column; align-items: ${isMine ? 'flex-end' : 'flex-start'}; max-width: 82%;">
                ${!isMine ? `
                  <span class="chat-sender-name" data-sender-id="${m.senderId}" style="font-size: 11.5px; font-weight: 800; color: #38bdf8; margin-bottom: 3px; padding-left: 4px; cursor: pointer;">
                    ${escapeHtml(m.senderName || 'Usuario')}
                  </span>
                ` : ''}

                <div style="padding: 10px 14px; border-radius: ${isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; background: ${isMine ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'var(--surface2)'}; color: ${isMine ? '#031206' : '#fff'}; border: ${isMine ? 'none' : '1px solid var(--border)'}; font-size: 14px; line-height: 1.45; word-break: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.15); position: relative;">
                  ${quoteHtml}
                  ${mediaHtml}
                  ${m.text ? `<div>${escapeHtml(m.text)}</div>` : ''}
                </div>

                <!-- Barra de acciones rápidas (Reaccionar y Citar) y fecha -->
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; padding: 0 4px;">
                  <small style="font-size: 10.5px; color: var(--muted);">${time}</small>

                  <button type="button" class="icon-btn ghost btn-msg-react" data-mid="${m.id}" style="width: 22px; height: 22px; font-size: 13px; padding: 0; opacity: 0.75;" title="Reaccionar">
                    😊
                  </button>

                  <button type="button" class="icon-btn ghost btn-msg-reply" data-mid="${m.id}" data-text="${escapeHtml(m.text || '')}" data-sname="${escapeHtml(m.senderName || '')}" style="width: 22px; height: 22px; font-size: 13px; padding: 0; opacity: 0.75;" title="Responder">
                    ↩️
                  </button>
                </div>

                <!-- Lista de Reacciones activas debajo del mensaje -->
                ${reactionsEntries.length > 0 ? `
                  <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px;">
                    ${reactionsEntries.map(([em, users]) => {
                      const hasMyReaction = users.some(u => (typeof u === 'string' ? u : u.id) === curId);
                      return `
                        <button type="button" class="btn sm badge-reaction" data-mid="${m.id}" data-emoji="${em}" style="height: 22px; padding: 1px 6px; font-size: 11.5px; font-weight: 800; border-radius: 12px; border: 1px solid ${hasMyReaction ? '#22c55e' : 'var(--border)'}; background: ${hasMyReaction ? 'rgba(34,197,94,0.2)' : 'var(--surface)'}; color: ${hasMyReaction ? '#86efac' : '#fff'}; cursor: pointer;">
                          ${em} ${users.length}
                        </button>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- Popover de selector de emojis de reacción (oculto por defecto) -->
                <div class="msg-reaction-popover" id="popover-${m.id}" style="display: none; gap: 4px; padding: 4px 8px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 4px 14px rgba(0,0,0,0.4); margin-top: 4px;">
                  ${AVAILABLE_REACTIONS.map(em => `
                    <button type="button" class="icon-btn ghost pick-popover-em" data-mid="${m.id}" data-emoji="${em}" style="width: 30px; height: 30px; font-size: 17px; padding: 0;">${em}</button>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Clic en avatar o nombre para abrir ficha / perfil
        msgsContainer.querySelectorAll('.chat-sender-avatar, .chat-sender-name').forEach(el => {
          el.onclick = (e) => {
            e.stopPropagation();
            const sid = el.getAttribute('data-sender-id');
            onSenderProfileClick(sid);
          };
        });

        // Clic en foto para lightbox
        msgsContainer.querySelectorAll('.chat-photo-bubble').forEach(img => {
          img.onclick = () => openPhotoLightbox(img.src);
        });

        // Botón responder (quote)
        msgsContainer.querySelectorAll('.btn-msg-reply').forEach(btn => {
          btn.onclick = () => {
            const mid = btn.getAttribute('data-mid');
            const txt = btn.getAttribute('data-text');
            const sname = btn.getAttribute('data-sname');
            currentReplyTo = { id: mid, text: txt, senderName: sname };
            replyText.textContent = `${sname}: "${txt ? txt.slice(0, 45) : '📷'}"`;
            replyPreview.style.display = 'flex';
            haptic(20);
            inputEl.focus();
          };
        });

        // Botón reaccionar (mostrar popover)
        msgsContainer.querySelectorAll('.btn-msg-react').forEach(btn => {
          btn.onclick = () => {
            const mid = btn.getAttribute('data-mid');
            const pop = msgsContainer.querySelector('#popover-' + mid);
            if (pop) {
              pop.style.display = pop.style.display === 'none' ? 'flex' : 'none';
            }
          };
        });

        // Selección de emoji en popover
        msgsContainer.querySelectorAll('.pick-popover-em').forEach(b => {
          b.onclick = async () => {
            const mid = b.getAttribute('data-mid');
            const emoji = b.getAttribute('data-emoji');
            const pop = msgsContainer.querySelector('#popover-' + mid);
            if (pop) pop.style.display = 'none';
            haptic(25);
            if (global.Cloud && global.Cloud.reactToChatMessage) {
              await global.Cloud.reactToChatMessage(chatId, mid, curId, curName, emoji);
            }
          };
        });

        // Toggle reacción pulsando sobre la insignia existente
        msgsContainer.querySelectorAll('.badge-reaction').forEach(b => {
          b.onclick = async () => {
            const mid = b.getAttribute('data-mid');
            const emoji = b.getAttribute('data-emoji');
            haptic(20);
            if (global.Cloud && global.Cloud.reactToChatMessage) {
              await global.Cloud.reactToChatMessage(chatId, mid, curId, curName, emoji);
            }
          };
        });

        scrollToBottom();
      }

      async function handleSend() {
        const text = inputEl.value.trim();
        const hasAttach = !!pendingAttachment;
        if (!text && !hasAttach) return;

        const attachToSend = pendingAttachment;
        const replyToSend = currentReplyTo;

        inputEl.value = '';
        pendingAttachment = null;
        currentReplyTo = null;
        if (replyPreview) replyPreview.style.display = 'none';
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
          if (replyToSend) {
            payload.replyTo = replyToSend;
          }
          await global.Cloud.sendChatMessage(chatId, payload);
          ChatUI.markChatAsRead(curId, chatId);
        }
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
      // No forzamos auto-focus para no abrir el teclado automáticamente en móviles
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
        players: options.players || [],
        teams: options.teams || [],
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

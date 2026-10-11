/* =========================================================
   Chat en Vivo • Player Stats (Coach & Player)
   - Chat directo 1 a 1 entre jugadores y con el entrenador
   - Chat grupal automático por equipo
   - Grupos personalizados con selección libre de participantes
   - Sincronización instantánea en la nube con Firebase Firestore
   - Notificaciones y avisos en tiempo real
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

  function sendNotification(title, body) {
    if (global.AndroidBridge && global.AndroidBridge.showSystemNotification) {
      try { global.AndroidBridge.showSystemNotification(title, body); } catch (e) {}
    }
    if ('Notification' in global && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body, icon: 'icons/icon-192.png' });
      } catch (e) {}
    }
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

  const ChatUI = {
    // Renderiza la lista general de chats (dentro de una pestaña o contenedor)
    renderChatList: function (container, options) {
      if (!container) return;
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || (options.isCoach ? 'Entrenador' : 'Jugador');
      const isCoach = !!options.isCoach;
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      let activeSearch = '';
      let chatListListenerUnsub = null;
      let rawChats = [];

      container.innerHTML = `
        <div class="chat-portal-container" style="display: flex; flex-direction: column; height: 100%;">
          <!-- Cabecera de Chat -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
            <div>
              <h2 style="font-size: 19px; font-weight: 900; margin: 0 0 2px;">💬 ${t('chatTitle', 'Chat de Equipo y Jugadores')}</h2>
              <span style="font-size: 12px; color: var(--muted);">${isCoach ? t('chatCoachRole', 'Canal oficial del Entrenador') : `${curName}`}</span>
            </div>
            <div style="display: flex; gap: 6px;">
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

        // Ordenar: primero los que tienen mensajes recientes
        displayChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

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
          const timeStr = formatTime(c.lastMessageTime);
          const iconEmoji = c.type === 'team' ? '🛡️' : (c.type === 'coach' ? '👨‍🏫' : (c.type === 'group' ? '👥' : '👤'));
          const snippet = c.lastMessage
            ? `<span style="color: #cbd5e1;">${escapeHtml(c.lastSenderName ? c.lastSenderName + ': ' : '')}${escapeHtml(c.lastMessage)}</span>`
            : `<span style="color: var(--muted); font-style: italic;">${t('noMessagesYet', 'Toca para empezar a hablar')}</span>`;

          return `
            <div class="card chat-room-card" data-chat-id="${c.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid var(--border); cursor: pointer; transition: all 0.15s; background: var(--surface2); border-radius: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 13px; background: rgba(34, 211, 238, 0.12); border: 1.5px solid rgba(34, 211, 238, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                ${iconEmoji}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <b style="font-size: 14.5px; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    ${escapeHtml(c.name || 'Chat')}
                  </b>
                  <small style="font-size: 11px; color: var(--muted); flex-shrink: 0;">${timeStr}</small>
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
            ChatUI.openConversationModal(cid, {
              currentUserId: curId,
              currentUserName: curName,
              isCoach: isCoach,
              title: targetChat ? targetChat.name : 'Chat',
              chatData: targetChat
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
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || (options.isCoach ? 'Entrenador' : 'Jugador');
      const isCoach = !!options.isCoach;
      const title = options.title || 'Chat';

      let messagesListenerUnsub = null;
      let messagesList = [];

      // Si el chat es nuevo, registrar en Firestore
      if (global.Cloud && global.Cloud.createOrGetChat) {
        global.Cloud.createOrGetChat({
          id: chatId,
          name: title,
          type: options.chatData ? options.chatData.type : 'direct',
          participants: options.chatData && options.chatData.participants ? options.chatData.participants : [curId, 'coach']
        });
      }

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay chat-dialog-overlay';
      overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 0;';

      overlay.innerHTML = `
        <div class="dialog-box chat-modal-box" style="width: 100%; height: 100%; max-width: 600px; max-height: 100%; display: flex; flex-direction: column; background: var(--bg); border: none; border-radius: 0; padding: 0; overflow: hidden;">
          <!-- Barra superior del chat -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: calc(12px + env(safe-area-inset-top)) 16px 12px; background: var(--surface2); border-bottom: 1px solid var(--border); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
              <button type="button" class="icon-btn ghost" id="chat-back-btn" style="width: 36px; height: 36px; flex-shrink: 0;">
                ◀
              </button>
              <div style="overflow: hidden;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 900; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: #fff;">
                  ${escapeHtml(title)}
                </h3>
                <span style="font-size: 11px; color: #22d3ee; font-weight: 700;">🟢 ${t('live', 'En vivo')}</span>
              </div>
            </div>
            <button type="button" class="icon-btn ghost" id="chat-close-btn" style="width: 36px; height: 36px;">
              ✕
            </button>
          </div>

          <!-- Área de Mensajes -->
          <div id="chat-messages-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; -webkit-overflow-scrolling: touch;">
            <div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12.5px;">
              ${t('loading', 'Cargando mensajes...')}
            </div>
          </div>

          <!-- Barra de entrada de texto inferior -->
          <div style="padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); background: var(--surface); border-top: 1px solid var(--border); display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <input type="text" id="chat-msg-input" placeholder="${t('typeMessage', 'Escribe un mensaje...')}" style="flex: 1; padding: 12px 14px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--bg2); color: #fff; font-size: 14px;" autocomplete="off" />
            <button type="button" class="btn primary" id="chat-send-btn" style="width: 44px; height: 44px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; flex-shrink: 0;">
              ➤
            </button>
          </div>
        </div>
      `;

      function close() {
        if (messagesListenerUnsub) messagesListenerUnsub();
        overlay.remove();
        if (typeof options.onClose === 'function') options.onClose();
      }

      overlay.querySelector('#chat-back-btn').onclick = close;
      overlay.querySelector('#chat-close-btn').onclick = close;

      const msgsContainer = overlay.querySelector('#chat-messages-container');
      const inputEl = overlay.querySelector('#chat-msg-input');
      const sendBtn = overlay.querySelector('#chat-send-btn');

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

          return `
            <div style="display: flex; flex-direction: column; align-items: ${isMine ? 'flex-end' : 'flex-start'};">
              ${!isMine ? `<small style="font-size: 11px; font-weight: 800; color: #38bdf8; margin-bottom: 3px; padding-left: 4px;">${escapeHtml(m.senderName || 'Usuario')}</small>` : ''}
              <div style="max-width: 82%; padding: 10px 14px; border-radius: ${isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; background: ${isMine ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'var(--surface2)'}; color: ${isMine ? '#031206' : '#fff'}; border: ${isMine ? 'none' : '1px solid var(--border)'}; font-size: 14px; line-height: 1.45; word-break: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                ${escapeHtml(m.text)}
              </div>
              <small style="font-size: 10px; color: var(--muted); margin-top: 2px; padding: 0 4px;">${time}</small>
            </div>
          `;
        }).join('');

        scrollToBottom();
      }

      async function handleSend() {
        const text = inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';
        haptic(25);

        if (global.Cloud && global.Cloud.sendChatMessage) {
          await global.Cloud.sendChatMessage(chatId, {
            senderId: curId,
            senderName: curName,
            text: text
          });
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

          if (messagesList.length > prevLen && prevLen > 0) {
            const lastMsg = messagesList[messagesList.length - 1];
            if (lastMsg && lastMsg.senderId !== curId) {
              haptic(35);
              sendNotification(lastMsg.senderName || 'Chat', lastMsg.text || 'Nuevo mensaje');
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
          if (global.UI && global.UI.toast) global.UI.toast('Selecciona al menos un compañero para el grupo', 'error');
          return;
        }

        selectedIds.push(curId);
        if (!options.isCoach) selectedIds.push('coach');

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
    startDirectChat: function (otherUserId, otherUserName, options) {
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

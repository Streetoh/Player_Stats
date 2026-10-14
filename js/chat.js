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

  const CHAT_I18N = {
    es: {
      searchChatOrTeammate: 'Buscar chat o compañero...',
      searchTeammate: 'Buscar chat o compañero...',
      newChat: 'Nuevo Chat',
      newChatOrGroup: 'Nuevo chat o grupo',
      createGroupChat: 'Crear un grupo',
      createGroupSub: 'Seleccionar varios compañeros y entrenador',
      sendPrivateMsg: 'Mandar mensaje privado',
      sendPrivateMsgSub: 'Iniciar chat directo 1 a 1',
      searchUser: 'Buscar jugador o entrenador...',
      coach: 'Entrenador',
      technicalStaff: 'Cuerpo Técnico Principal',
      player: 'Jugador',
      newGroupChat: 'Nuevo Grupo de Chat',
      groupName: 'Nombre del Grupo *',
      groupNamePlaceholder: 'Ej: Delanteros, Torneo Sábado...',
      groupIconAndPhoto: 'Icono o Foto del Grupo',
      uploadGroupPhoto: 'Subir foto de grupo',
      groupPhotoSub: 'Se podrá pulsar para ampliarla',
      pickGroupEmoji: 'O elige un emoji para el grupo:',
      groupMembers: 'Seleccionar Participantes:',
      createGroupBtn: 'Crear y Abrir Grupo',
      loading: 'Cargando chats en vivo...',
      loadingChats: 'Cargando chats en vivo...',
      loadingMessages: 'Cargando mensajes en vivo...',
      chatCoachRole: 'Canal oficial del Entrenador',
      typeMessage: 'Escribe un mensaje...',
      unmuteNotifications: 'Activar notificaciones',
      muteNotifications: 'Silenciar notificaciones',
      deleteChat: 'Eliminar conversación',
      deleteGroup: 'Eliminar grupo',
      deleteGroupConfirm: '¿Eliminar este grupo de forma definitiva para todos?',
      deleteChatConfirm: '¿Eliminar esta conversación de tu lista?',
      deleteForEveryoneConfirm: '¿Eliminar este mensaje para todos?',
      chatDeletedForYou: 'Conversación eliminada de tu lista',
      groupDeleted: 'Grupo eliminado',
      messageDeletedForMe: 'Mensaje eliminado para ti',
      removeMember: 'Eliminar participante',
      removeMemberConfirm: '¿Eliminar a este participante del grupo?',
      squadGeneral: 'General del Equipo',
      coachAndTeammates: 'con Entrenador y compañeros',
      pinnedPermanently: 'Fijado de forma permanente',
      unpin: 'Desanclar conversación',
      pin: 'Anclar al principio',
      chatPinned: '📌 Chat anclado',
      chatUnpinned: '📍 Chat desanclado',
      notifsMuted: '🔕 Chat silenciado',
      notifsEnabled: '🔔 Notificaciones activadas',
      offline: 'Desconectado',
      group: 'Grupo',
      online: 'En línea',
      lastSeen: 'Última vez',
      noMessagesYet: 'Aún no hay mensajes en este chat. ¡Envía el primero!',
      today: 'Hoy',
      yesterday: 'Ayer',
      msgDeletedForEveryone: 'Este mensaje fue eliminado',
      edited: 'editado',
      messageOptions: 'Opciones del mensaje',
      copyMessage: 'Copiar mensaje',
      editMessage: 'Editar mensaje',
      deleteForEveryone: 'Borrar para todos',
      deleteForMe: 'Borrar para mí',
      copiedToClipboard: 'Mensaje copiado al portapapeles',
      messageDeleted: 'Mensaje eliminado para todos',
      cancel: 'Cancelar',
      save: 'Guardar',
      messageEdited: 'Mensaje actualizado',
      profileInactiveMsg: 'Tu perfil de jugador ya no está activo. No puedes enviar mensajes.',
      editGroup: 'Cambiar nombre e icono del grupo',
      leaveGroup: 'Abandonar grupo',
      addParticipants: 'Añadir jugadores al grupo',
      viewGroupMembers: 'Ver miembros del grupo',
      changePhoto: 'Cambiar foto',
      allPlayersAlreadyInGroup: 'Todos los jugadores ya forman parte del grupo.',
      addSelected: 'Añadir Seleccionados',
      you: 'Tú'
    },
    en: {
      searchChatOrTeammate: 'Search chat or teammate...',
      searchTeammate: 'Search chat or teammate...',
      newChat: 'New Chat',
      newChatOrGroup: 'New chat or group',
      createGroupChat: 'Create a group',
      createGroupSub: 'Select multiple teammates and coach',
      sendPrivateMsg: 'Send private message',
      sendPrivateMsgSub: 'Start direct 1-on-1 chat',
      searchUser: 'Search player or coach...',
      coach: 'Coach',
      technicalStaff: 'Head Coaching Staff',
      player: 'Player',
      newGroupChat: 'New Group Chat',
      groupName: 'Group Name *',
      groupNamePlaceholder: 'Ex: Strikers, Saturday Tournament...',
      groupIconAndPhoto: 'Group Icon or Photo',
      uploadGroupPhoto: 'Upload group photo',
      groupPhotoSub: 'Can be tapped to enlarge',
      pickGroupEmoji: 'Or choose an emoji for the group:',
      groupMembers: 'Select Participants:',
      createGroupBtn: 'Create & Open Group',
      loading: 'Loading live chats...',
      loadingChats: 'Loading live chats...',
      loadingMessages: 'Loading live messages...',
      chatCoachRole: 'Official Coach Channel',
      typeMessage: 'Type a message...',
      unmuteNotifications: 'Unmute notifications',
      muteNotifications: 'Mute notifications',
      deleteChat: 'Delete conversation',
      deleteGroup: 'Delete group',
      deleteGroupConfirm: 'Permanently delete this group for everyone?',
      deleteChatConfirm: 'Delete this conversation from your list?',
      deleteForEveryoneConfirm: 'Are you sure you want to delete this message for everyone?',
      chatDeletedForYou: 'Conversation removed from your list',
      groupDeleted: 'Group deleted',
      messageDeletedForMe: 'Message removed for you',
      removeMember: 'Remove participant',
      removeMemberConfirm: 'Remove this participant from the group?',
      squadGeneral: 'Team General',
      coachAndTeammates: 'with Coach & teammates',
      pinnedPermanently: 'Permanently pinned by club',
      unpin: 'Unpin conversation',
      pin: 'Pin conversation to top',
      chatPinned: '📌 Chat pinned to top',
      chatUnpinned: '📍 Chat unpinned',
      notifsMuted: '🔕 Notifications muted',
      notifsEnabled: '🔔 Notifications enabled',
      offline: 'Offline',
      group: 'Group',
      online: 'Online',
      lastSeen: 'Last seen',
      noMessagesYet: 'No messages in this chat yet. Send the first one!',
      today: 'Today',
      yesterday: 'Yesterday',
      msgDeletedForEveryone: 'This message was deleted',
      edited: 'edited',
      messageOptions: 'Message Options',
      copyMessage: 'Copy message',
      editMessage: 'Edit message',
      deleteForEveryone: 'Delete for everyone',
      deleteForMe: 'Delete for me',
      copiedToClipboard: 'Message copied to clipboard',
      messageDeleted: 'Message deleted for everyone',
      cancel: 'Cancel',
      save: 'Save',
      messageEdited: 'Message updated',
      profileInactiveMsg: 'Your player profile is no longer active. You cannot send messages.',
      editGroup: 'Change group name & icon',
      leaveGroup: 'Leave group',
      addParticipants: 'Add players to group',
      viewGroupMembers: 'View group members',
      changePhoto: 'Change photo',
      allPlayersAlreadyInGroup: 'All players are already in this group.',
      addSelected: 'Add Selected',
      you: 'You'
    },
    ee: {
      searchChatOrTeammate: 'Otsi vestlust või meeskonnakaaslast...',
      searchTeammate: 'Otsi vestlust või meeskonnakaaslast...',
      newChat: 'Uus Vestlus',
      newChatOrGroup: 'Uus vestlus või grupp',
      createGroupChat: 'Loo grupp',
      createGroupSub: 'Vali mitu meeskonnakaaslast ja treener',
      sendPrivateMsg: 'Saada privaatsõnum',
      sendPrivateMsgSub: 'Alusta 1-ühele vestlust',
      searchUser: 'Otsi mängijat või treenerit...',
      coach: 'Treener',
      technicalStaff: 'Peatreenerite tiim',
      player: 'Mängija',
      newGroupChat: 'Uus Grupivestlus',
      groupName: 'Grupi nimi *',
      groupNamePlaceholder: 'nt Ründajad, Laupäevane Turniir...',
      groupIconAndPhoto: 'Grupi ikoon või foto',
      uploadGroupPhoto: 'Laadi üles grupi foto',
      groupPhotoSub: 'Võimalik suurendamiseks vajutada',
      pickGroupEmoji: 'Või vali grupile emoji:',
      groupMembers: 'Vali osalejad:',
      createGroupBtn: 'Loo ja ava grupp',
      loading: 'Vestluste laadimine...',
      loadingChats: 'Vestluste laadimine...',
      loadingMessages: 'Sõnumite laadimine...',
      chatCoachRole: 'Treeneri ametlik kanal',
      typeMessage: 'Kirjuta sõnum...',
      unmuteNotifications: 'Lülita teated sisse',
      muteNotifications: 'Vaigista teated',
      deleteChat: 'Kustuta vestlus',
      deleteGroup: 'Kustuta grupp',
      deleteGroupConfirm: 'Kas kustutada see grupp jäädavalt kõigi jaoks?',
      deleteChatConfirm: 'Kas eemaldada see vestlus oma nimekirjast?',
      deleteForEveryoneConfirm: 'Kas soovid kindlasti selle sõnumi kõigilt kustutada?',
      chatDeletedForYou: 'Vestlus eemaldatud sinu nimekirjast',
      groupDeleted: 'Grupp kustutatud',
      messageDeletedForMe: 'Sõnum eemaldatud sinu jaoks',
      removeMember: 'Eemalda osaleja',
      removeMemberConfirm: 'Kas eemaldada see osaleja grupist?',
      squadGeneral: 'Meeskonna Üldine',
      coachAndTeammates: 'Treeneri ja tiimikaaslastega',
      pinnedPermanently: 'Klubi poolt püsivalt kinnitatud',
      unpin: 'Eemalda vestluse kinnitus',
      pin: 'Kinnita vestlus üles',
      chatPinned: '📌 Vestlus kinnitatud',
      chatUnpinned: '📍 Vestluse kinnitus eemaldatud',
      notifsMuted: '🔕 Teated vaigistatud',
      notifsEnabled: '🔔 Teated lubatud',
      offline: 'Võrguühenduseta',
      group: 'Grupp',
      online: 'Võrgus',
      lastSeen: 'Viimati nähtud',
      noMessagesYet: 'Selles vestluses pole veel sõnumeid. Saada esimene!',
      today: 'Täna',
      yesterday: 'Eile',
      msgDeletedForEveryone: 'See sõnum kustutati',
      edited: 'muudetud',
      messageOptions: 'Sõnumi valikud',
      copyMessage: 'Kopeeri sõnum',
      editMessage: 'Muuda sõnumit',
      deleteForEveryone: 'Kustuta kõigilt',
      deleteForMe: 'Kustuta minu jaoks',
      copiedToClipboard: 'Sõnum kopeeritud lõikelauale',
      messageDeleted: 'Sõnum kustutatud kõigilt',
      cancel: 'Tühista',
      save: 'Salvesta',
      messageEdited: 'Sõnum uuendatud',
      profileInactiveMsg: 'Sinu mängijaprofiil pole enam aktiivne. Sa ei saa sõnumeid saata.',
      editGroup: 'Muuda grupi nime ja ikooni',
      leaveGroup: 'Lahku grupist',
      addParticipants: 'Lisa mängijaid gruppi',
      viewGroupMembers: 'Vaata grupi liikmeid',
      changePhoto: 'Muuda fotot',
      allPlayersAlreadyInGroup: 'Kõik mängijad on juba sellesse gruppi lisatud.',
      addSelected: 'Lisa valitud',
      you: 'Sina'
    }
  };

  function getChatLang() {
    try {
      if (global.currentLang === 'ee' || global.currentLang === 'es' || global.currentLang === 'en') {
        return global.currentLang;
      }
      const stored = localStorage.getItem('lang') || localStorage.getItem('preferred_lang');
      if (stored === 'ee' || stored === 'es' || stored === 'en') return stored;
      if (global.Store && global.Store.state && global.Store.state.lang) {
        const sl = global.Store.state.lang;
        if (sl === 'ee' || sl === 'es' || sl === 'en') return sl;
      }
    } catch (e) {}
    return 'en';
  }

  function t(key, fallback) {
    const lang = getChatLang();
    if (CHAT_I18N[lang] && CHAT_I18N[lang][key] !== undefined) {
      return CHAT_I18N[lang][key];
    }
    if (global.t) {
      try {
        const res = global.t(key, null);
        if (res && res !== key) return res;
      } catch (e) {}
    }
    if (CHAT_I18N.en && CHAT_I18N.en[key] !== undefined) {
      return CHAT_I18N.en[key];
    }
    return fallback !== undefined ? fallback : key;
  }

  function checkIsEn() {
    return getChatLang() === 'en';
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
      try { global.AndroidBridge.showSystemNotification(title, body, chatId || ''); } catch (e) {}
    }
    if ('Notification' in global && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body, icon: 'icons/icon-192.png', tag: chatId || undefined });
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

  function getCoachName() {
    let cp = (global.clubData && global.clubData.coachProfile) ||
             (global.Store && global.Store.state && global.Store.state.coachProfile);
    if (!cp || !cp.name) {
      try {
        const cached = JSON.parse(localStorage.getItem('cached_club_state') || '{}');
        if (cached && cached.coachProfile && cached.coachProfile.name) {
          cp = cached.coachProfile;
        }
      } catch (e) {}
    }
    if (!cp || !cp.name) {
      try {
        const cpRaw = localStorage.getItem('coach_profile') || localStorage.getItem('coachProfile');
        if (cpRaw) {
          const parsed = JSON.parse(cpRaw);
          if (parsed && parsed.name) cp = parsed;
        }
      } catch (e) {}
    }
    if (cp && cp.name && cp.name.trim() && cp.name.trim().toLowerCase() !== 'coach') {
      return cp.name.trim();
    }
    return 'Daniel Requena';
  }

  function getCoachProfile() {
    let cp = (global.clubData && global.clubData.coachProfile) ||
             (global.Store && global.Store.state && global.Store.state.coachProfile);
    if (!cp || !cp.photo) {
      try {
        const cached = JSON.parse(localStorage.getItem('cached_club_state') || '{}');
        if (cached && cached.coachProfile) {
          cp = Object.assign({}, cp || {}, cached.coachProfile);
        }
      } catch (e) {}
    }
    if (!cp || !cp.photo) {
      try {
        const cpRaw = localStorage.getItem('coach_profile') || localStorage.getItem('coachProfile');
        if (cpRaw) {
          const parsed = JSON.parse(cpRaw);
          if (parsed) cp = Object.assign({}, cp || {}, parsed);
        }
      } catch (e) {}
    }
    return cp || {};
  }

  function getCoachAvatarHtml(size = 32, isRounded = true) {
    const cp = getCoachProfile();
    if (cp && cp.photo) {
      return `<img src="${cp.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: ${isRounded ? '50%' : '10px'}; display: block;" />`;
    }
    const name = getCoachName() || 'Coach';
    const parts = name.trim().split(/\s+/);
    const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    return `<span style="font-weight: 900; font-size: ${Math.round(size * 0.42)}px; color: var(--cyan); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: ${isRounded ? '50%' : '10px'}; background: rgba(34, 211, 238, 0.15);">${initials}</span>`;
  }

  function getReactionsSummary(rawReactions) {
    const summary = {};
    if (!rawReactions || typeof rawReactions !== 'object') return [];
    for (const [key, val] of Object.entries(rawReactions)) {
      if (Array.isArray(val)) {
        if (!summary[key]) summary[key] = [];
        summary[key].push(...val);
      } else if (val && typeof val === 'object' && val.emoji) {
        const em = val.emoji;
        if (!summary[em]) summary[em] = [];
        if (!summary[em].includes(key)) summary[em].push(key);
      } else if (typeof val === 'string') {
        const em = val;
        if (!summary[em]) summary[em] = [];
        if (!summary[em].includes(key)) summary[em].push(key);
      }
    }
    return Object.entries(summary).filter(([em, users]) => users.length > 0);
  }

  function getChatAvatar(c, curId, allPlayers) {
    if (c.photo) {
      return `<img src="${c.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover; cursor: pointer;" class="chat-avatar-thumb" />`;
    }
    if (c.iconEmoji) {
      return `<span>${c.iconEmoji}</span>`;
    }

    const isCoachUser = (curId === 'coach');

    if (c.type === 'coach' || c.id.startsWith('coach_')) {
      if (isCoachUser) {
        // En la app de coach, el otro participante es el jugador
        let pid = c.id.replace('coach_', '');
        if ((!pid || pid === 'coach') && Array.isArray(c.participants)) {
          pid = c.participants.find(p => p !== 'coach') || '';
        }
        const p = (allPlayers || []).find(x => x.id === pid) || (global.Store && global.Store.player ? global.Store.player(pid) : null);
        if (p && p.photo) {
          return `<img src="${p.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />`;
        }
        if (p) {
          const init = (p.name || '?')[0].toUpperCase();
          return `<span style="font-weight: 900; font-size: 16px; color: var(--cyan);">${init}</span>`;
        }
        return '<span>👤</span>';
      } else {
        // En la app de jugador, mostrar el avatar del entrenador
        return getCoachAvatarHtml(36, false);
      }
    }

    if (c.type === 'team' || c.id.startsWith('team_')) {
      return '<span>🛡️</span>';
    }

    if (c.type === 'direct' || c.id.startsWith('direct_')) {
      const parts = (Array.isArray(c.participants) && c.participants.length)
        ? c.participants
        : c.id.replace('direct_', '').split('_');
      const otherId = parts.find(p => p !== curId) || (parts[0] === curId ? parts[1] : parts[0]);

      if (isCoachUser) {
        // En app de coach, el otro siempre es un jugador
        const pid = (otherId && otherId !== 'coach') ? otherId : parts.find(p => p !== 'coach');
        const p = (allPlayers || []).find(x => x.id === pid) || (global.Store && global.Store.player ? global.Store.player(pid) : null);
        if (p && p.photo) {
          return `<img src="${p.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />`;
        }
        if (p) {
          const init = (p.name || '?')[0].toUpperCase();
          return `<span style="font-weight: 900; font-size: 16px; color: var(--cyan);">${init}</span>`;
        }
        return '<span>👤</span>';
      } else {
        if (!otherId || otherId === 'coach') {
          return getCoachAvatarHtml(36, false);
        }
        const p = (allPlayers || []).find(x => x.id === otherId) || (global.Store && global.Store.player ? global.Store.player(otherId) : null);
        if (p && p.photo) {
          return `<img src="${p.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />`;
        }
        if (p) {
          const init = (p.name || '?')[0].toUpperCase();
          return `<span style="font-weight: 900; font-size: 16px; color: var(--cyan);">${init}</span>`;
        }
        return '<span>👤</span>';
      }
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
        if (lastMessageTime) {
          localStorage.setItem(`chat_notified_${chatId}_${lastMessageTime}`, '1');
        }
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

      // Notificar al puente nativo de Android para cancelar la notificación activa y sincronizar el servicio
      if (global.AndroidBridge && global.AndroidBridge.markChatAsRead) {
        try {
          global.AndroidBridge.markChatAsRead(chatId, readTime);
        } catch (e) {}
      }

      // Limpiar notificación del Centro de Notificaciones en Inicio
      if (global.NotifManager && global.NotifManager.removeByTarget) {
        global.NotifManager.removeByTarget(chatId);
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
    initGlobalUnreadListener: function (curUserId, myTeamId) {
      if (!curUserId || !global.Cloud || !global.Cloud.listenToChats) return;
      if (window._chatUnreadUnsub) {
        try { window._chatUnreadUnsub(); } catch (e) {}
      }
      let isFirstSnapshot = true;
      const sCurUserId = String(curUserId);
      window._chatUnreadUnsub = global.Cloud.listenToChats((chats) => {
        if (!chats) return;
        let unreadCount = 0;
        chats.forEach(c => {
          let isParticipant = false;
          if (curUserId === 'coach') {
            if (c.id === 'general') {
              isParticipant = true;
            } else if (c.type === 'coach' || c.id.startsWith('coach_')) {
              isParticipant = true;
            } else if (c.type === 'team' || c.id.startsWith('team_')) {
              isParticipant = true;
            } else if (c.type === 'direct' || c.id.startsWith('direct_')) {
              // El míster NO es participante de chats privados directos entre dos jugadores
              isParticipant = Array.isArray(c.participants)
                ? c.participants.map(String).includes('coach')
                : c.id.split('_').slice(1).map(String).includes('coach');
            } else if (Array.isArray(c.participants)) {
              isParticipant = c.participants.map(String).includes('coach');
            } else {
              isParticipant = true;
            }
          } else {
            isParticipant =
              (c.id === 'coach_' + sCurUserId) ||
              (c.id.startsWith('direct_') && c.id.split('_').slice(1).map(String).includes(sCurUserId)) ||
              ((c.type === 'team' || c.id.startsWith('team_')) && (!c.teamId || !myTeamId || c.teamId === myTeamId || c.id === 'team_' + myTeamId)) ||
              (Array.isArray(c.participants) && c.participants.some(p => String(p) === sCurUserId));
          }

          if (!isParticipant) return;

          const lastRead = parseInt(localStorage.getItem(`chat_last_read_${curUserId}_${c.id}`) || '0', 10);
          const isFromOther = c.lastSenderId && String(c.lastSenderId) !== sCurUserId;
          const isUnread = (c.lastMessageTime || 0) > lastRead && isFromOther;

          if (isUnread) {
            try { localStorage.removeItem('chat_deleted_' + c.id); } catch (e) {}

            if (currentlyOpenChatId === c.id) {
              ChatUI.markChatAsRead(curUserId, c.id, c.lastMessageTime);
            } else {
              unreadCount++;
              const knownKey = `chat_notified_${c.id}_${c.lastMessageTime}`;
              if (!isFirstSnapshot && !localStorage.getItem(knownKey)) {
                try { localStorage.setItem(knownKey, '1'); } catch (e) {}
                sendNotification(c.lastSenderName || 'Chat', c.lastMessage || 'Nuevo mensaje', c.id);
                if (global.NotifManager && global.NotifManager.add) {
                  const chatName = c.name || (c.type === 'direct' ? (c.lastSenderName || 'Chat') : (c.title || 'Chat'));
                  global.NotifManager.add({
                    id: 'chat_' + c.id,
                    type: 'chat',
                    title: `💬 ${chatName}`,
                    body: `${c.lastSenderName ? c.lastSenderName + ': ' : ''}${c.lastMessage || 'Nuevo mensaje'}`,
                    targetId: c.id,
                    time: c.lastMessageTime || Date.now()
                  });
                }
              }
            }
          }
          if (isFirstSnapshot) {
            try { localStorage.setItem(`chat_notified_${c.id}_${c.lastMessageTime}`, '1'); } catch (e) {}
          }
        });
        isFirstSnapshot = false;
        ChatUI.updateTabBadge(unreadCount > 0);
      });
    },

    // Inicia latido de presencia (DESACTIVADO PARA PROTEGER LA CUOTA SPARK)
    initPresenceHeartbeat: function () {},

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
            <input type="text" id="chat-search-input" placeholder="${t('searchChatOrTeammate', 'Buscar chat o compañero...')}" style="width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
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
        global._refreshChatList = renderRooms;
        const q = activeSearch.toLowerCase().trim();
        const isEn = (global.Store && global.Store.state && global.Store.state.lang === 'en') || (localStorage.getItem('preferred_lang') === 'en');

        // Identificar equipo del jugador si no es coach
        const myP = allPlayers.find(p => p.id === curId);
        const myTeamId = myP ? myP.teamId : null;
        const myTeam = allTeams.find(t => t.id === myTeamId);

        // Chats del sistema
        const defaultTeamChats = allTeams.map(tm => ({
          id: `team_${tm.id}`,
          type: 'team',
          name: `🛡️ ${tm.name}`,
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
            name: `🛡️ ${teamDisplayName} (${t('coachAndTeammates', 'con Entrenador y compañeros')})`
          });

          pinnedCoachChatId = `coach_${curId}`;
          const coachName = getCoachName();
          mergedMap[pinnedCoachChatId] = Object.assign({
            id: pinnedCoachChatId,
            type: 'coach',
            participants: [curId, 'coach']
          }, mergedMap[pinnedCoachChatId] || {}, {
            isPinned: true,
            name: `(Coach) ${coachName}`
          });
        }

        // Combinar con chats de la nube
        rawChats.forEach(c => {
          if (c) {
            const cid = c.id || c.chatId;
            if (!cid) return;
            c.id = cid;
            const wasPinned = mergedMap[cid] ? mergedMap[cid].isPinned : false;
            mergedMap[cid] = Object.assign({}, mergedMap[cid] || {}, c);
            if (wasPinned) mergedMap[cid].isPinned = true;
          }
        });

        function isChatCustomPinned(cid) {
          try {
            return localStorage.getItem(`chat_pinned_${curId}_${cid}`) === 'true';
          } catch (e) {
            return false;
          }
        }

        function toggleChatCustomPin(cid) {
          try {
            const k = `chat_pinned_${curId}_${cid}`;
            if (localStorage.getItem(k) === 'true') {
              localStorage.removeItem(k);
            } else {
              localStorage.setItem(k, 'true');
            }
          } catch (e) {}
        }

        function canDeleteChat(c) {
          if (!c || !c.id) return false;
          if (isCoach) return true;
          // Para jugadores:
          // 1) Chat con el entrenador NUNCA se puede borrar
          if (c.id === pinnedCoachChatId || c.id === `coach_${curId}`) return false;
          // 2) Chat de equipo sólo se puede borrar si NO pertenece a ese equipo
          if (c.type === 'team' || c.id.startsWith('team_')) {
            if (c.id === pinnedTeamId) return false;
            if (myTeamId && c.teamId === myTeamId) return false;
            return true;
          }
          return true;
        }

        let displayChats = Object.values(mergedMap).filter(c => {
          if (!c || !c.id) return false;
          // Filtrar chats borrados por el usuario:
          // El chat con el entrenador NUNCA se oculta para el jugador
          if (!isCoach && (c.id === pinnedCoachChatId || c.id === `coach_${curId}`)) {
            try { localStorage.removeItem('chat_deleted_' + c.id); } catch (e) {}
          } else {
            const delFlag = localStorage.getItem('chat_deleted_' + c.id);
            if (delFlag) {
              const delTime = parseInt(delFlag, 10) || 0;
              // Si llegó o se envió cualquier mensaje posterior al momento de borrado, volver a mostrar
              if (c.lastMessageTime && c.lastMessageTime > delTime) {
                try { localStorage.removeItem('chat_deleted_' + c.id); } catch (e) {}
              } else {
                return false;
              }
            }
          }
          if (c.deleted === true || c.isDeleted === true) {
            if (c.lastMessageTime && c.lastMessageTime > ((c.deletedAt) || 0)) {
              // Reactivar si hay actividad
            } else {
              return false;
            }
          }
          // Filtrar por membresía: coach ve general, equipos, grupos y chats directos donde participa (no chats privados entre jugadores)
          if (isCoach) {
            if (c.type === 'direct' || c.id.startsWith('direct_')) {
              const parts = Array.isArray(c.participants)
                ? c.participants.map(String)
                : c.id.replace('direct_', '').split('_').map(String);
              if (!parts.includes('coach')) return false;
            }
          } else {
            if (c.type === 'team') {
              if (c.teamId && myTeamId && c.teamId !== myTeamId) return false;
            } else if (c.participants && !c.participants.includes(curId)) {
              return false;
            }
          }
          // Filtrar conversaciones directas vacías sin mensajes
          if ((c.type === 'direct' || c.type === 'coach' || c.id.startsWith('direct_') || c.id.startsWith('coach_')) && !c.lastMessage && !c.lastMessageTime) {
            if (!isCoach && (c.id === pinnedCoachChatId || c.id === `coach_${curId}`)) {
              // Permitir acceso permanente del jugador al chat con el entrenador
            } else {
              return false;
            }
          }
          if (q) {
            const cleanName = (c.name || '').replace(/^Chat:\s*/i, '').replace(/^🛡️\s*Chat:\s*/i, '🛡️ ');
            const nameMatch = cleanName.toLowerCase().includes(q);
            const lastMsgMatch = (c.lastMessage || '').toLowerCase().includes(q);
            return nameMatch || lastMsgMatch;
          }
          return true;
        });

        // Marcar estado fijado de cada conversación
        displayChats.forEach(c => {
          if (!isCoach) {
            c.isPinned = (c.id === pinnedCoachChatId || c.id === pinnedTeamId || isChatCustomPinned(c.id));
          } else {
            c.isPinned = isChatCustomPinned(c.id);
          }
        });

        // ORDEN DE CONVERSACIONES:
        // 1) En App de Jugadores:
        //    a. Chat con el entrenador SIEMPRE el 1º arriba de todo
        //    b. Chat del equipo en 2º lugar
        //    c. Chats fijados por el jugador
        //    d. Resto de conversaciones por orden cronológico reciente
        // 2) En App de Entrenador:
        //    a. Chats fijados por el entrenador arriba de todo
        //    b. Resto de conversaciones por orden cronológico reciente
        displayChats.sort((a, b) => {
          if (!isCoach) {
            if (a.id === pinnedCoachChatId) return -1;
            if (b.id === pinnedCoachChatId) return 1;

            if (a.id === pinnedTeamId) return -1;
            if (b.id === pinnedTeamId) return 1;
          }

          const aCustom = isChatCustomPinned(a.id);
          const bCustom = isChatCustomPinned(b.id);
          if (aCustom && !bCustom) return -1;
          if (!aCustom && bCustom) return 1;

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
          let displayName = (c.name || 'Chat').replace(/^Chat:\s*/i, '').replace(/^🛡️\s*Chat:\s*/i, '🛡️ ');
          if (c.type === 'direct' || c.id.startsWith('direct_') || c.id.startsWith('coach_')) {
            let parts = (Array.isArray(c.participants) && c.participants.length)
              ? c.participants
              : (c.id.startsWith('direct_') ? c.id.replace('direct_', '').split('_') : [c.id.replace('coach_', ''), 'coach']);
            let otherId = parts.find(p => p !== curId);
            if (!otherId && c.id.startsWith('coach_')) {
              const cand = c.id.replace('coach_', '');
              if (cand !== curId) otherId = cand;
            }
            if (curId !== 'coach' && (!otherId || otherId === 'coach')) {
              displayName = `(Coach) ${getCoachName()}`;
            } else {
              const p = (allPlayers || []).find(x => x.id === otherId) || (global.Store && global.Store.player ? global.Store.player(otherId) : null);
              if (p) {
                displayName = `${p.mainDorsal != null ? '#' + p.mainDorsal + ' ' : ''}${p.name || ''} ${p.lastName || ''}`.trim();
              } else if (c.name) {
                displayName = c.name.replace(/^Chat:\s*/i, '').replace(/^👨‍🏫\s*/i, '').replace(/^\(Coach\)\s*/i, '');
              }
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
          const isTeamChat = c.type === 'team' || c.id.startsWith('team_');

          return `
            <div class="card chat-room-card" data-chat-id="${c.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid ${isUnread ? 'rgba(34, 211, 238, 0.6)' : (c.isPinned ? 'rgba(250, 204, 21, 0.35)' : 'var(--border)')}; cursor: pointer; transition: all 0.15s; background: ${isUnread ? 'rgba(34, 211, 238, 0.06)' : (c.isPinned ? 'rgba(250, 204, 21, 0.04)' : 'var(--surface2)')}; border-radius: 14px; position: relative; -webkit-touch-callout: none; user-select: none;">
              <div style="width: 44px; height: 44px; border-radius: 13px; background: rgba(34, 211, 238, 0.12); border: 1.5px solid rgba(34, 211, 238, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; position: relative; overflow: hidden;">
                ${avatarHtml}
                ${isUnread ? `<span class="chat-card-unread-dot" style="position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 50%; background: #ef4444; border: 2px solid var(--surface2);"></span>` : ''}
              </div>
              <div style="flex: 1; min-width: 0; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; gap: 6px;">
                  <div style="overflow-x: auto; white-space: nowrap; scrollbar-width: none; -ms-overflow-style: none; flex: 1; min-width: 0;">
                    <b style="font-size: 14.5px; color: #fff; display: inline-flex; align-items: center; gap: 6px;">
                      ${c.isPinned ? '<span style="font-size: 13px;" title="' + t('pinned', 'Fijado') + '">📌</span>' : ''}
                      <span>${escapeHtml(displayName)}</span>
                      ${isMuted ? '<small style="font-size: 11px; opacity: 0.6;">🔕</small>' : ''}
                    </b>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    ${isUnread ? `<span class="badge chat-card-new-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: 900; font-size: 9.5px; padding: 1px 5px; border-radius: 8px;">● ${t('newBadge', 'NUEVO')}</span>` : ''}
                    <small style="font-size: 11px; color: var(--muted);">${timeStr}</small>
                    ${canDeleteChat(c) ? `
                      <button type="button" class="icon-btn ghost btn-delete-chat-card" data-chat-id="${c.id}" data-chat-name="${escapeHtml(displayName)}" style="width: 24px; height: 24px; font-size: 12px; color: #f87171; opacity: 0.7; padding: 0;" title="${t('deleteChat', 'Eliminar conversación')}">
                        🗑️
                      </button>
                    ` : ''}
                  </div>
                </div>
                <div style="font-size: 12.5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                  ${snippet}
                </div>
              </div>
            </div>
          `;
        }).join('');

        function openRoomContextMenu(chatObj) {
          if (!chatObj) return;
          haptic(30);
          const cid = chatObj.id;
          const cleanName = (chatObj.name || 'Chat').replace(/^Chat:\s*/i, '').replace(/^🛡️\s*Chat:\s*/i, '🛡️ ');
          const isPermPinned = !isCoach && (cid === pinnedCoachChatId || cid === pinnedTeamId);
          const isPinned = isPermPinned || isChatCustomPinned(cid);
          const isMuted = isChatMuted(cid);
          const deletable = canDeleteChat(chatObj);

          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay';
          overlay.style.zIndex = '99999';
          overlay.innerHTML = `
            <div class="dialog-box" style="max-width: 360px; width: 90%; padding: 18px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                <b style="font-size: 15px; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; flex: 1;">
                  ${escapeHtml(cleanName)}
                </b>
                <button type="button" class="icon-btn ghost" id="dlg-ctx-x" style="width: 28px; height: 28px;">✕</button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${isPermPinned ? `
                  <div style="padding: 10px 12px; border-radius: 10px; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.3); font-size: 12px; color: #fde047; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <span>📌</span>
                    <span>${t('pinnedPermanently', 'Fijado de forma permanente')}</span>
                  </div>
                ` : `
                  <button type="button" class="btn block ghost" id="btn-ctx-pin" style="height: 42px; justify-content: flex-start; padding: 0 12px; gap: 10px; font-weight: 700; font-size: 13px; border: 1px solid var(--border); background: var(--surface2);">
                    <span style="font-size: 16px;">${isPinned ? '📍' : '📌'}</span>
                    <span>${isPinned ? t('unpin', 'Desanclar conversación') : t('pin', 'Anclar al principio')}</span>
                  </button>
                `}

                <button type="button" class="btn block ghost" id="btn-ctx-mute" style="height: 42px; justify-content: flex-start; padding: 0 12px; gap: 10px; font-weight: 700; font-size: 13px; border: 1px solid var(--border); background: var(--surface2);">
                  <span style="font-size: 16px;">${isMuted ? '🔔' : '🔕'}</span>
                  <span>${isMuted ? t('unmuteNotifications', 'Activar notificaciones') : t('muteNotifications', 'Silenciar notificaciones')}</span>
                </button>

                ${deletable ? `
                  <button type="button" class="btn block danger ghost" id="btn-ctx-delete" style="height: 42px; justify-content: flex-start; padding: 0 12px; gap: 10px; font-weight: 700; font-size: 13px; border: 1.5px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1); color: #fca5a5;">
                    <span style="font-size: 16px;">🗑️</span>
                    <span>${t('deleteChat', 'Eliminar conversación')}</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `;

          function close() { overlay.remove(); }
          overlay.querySelector('#dlg-ctx-x').onclick = close;
          overlay.onclick = (e) => { if (e.target === overlay) close(); };

          const btnPin = overlay.querySelector('#btn-ctx-pin');
          if (btnPin) {
            btnPin.onclick = () => {
              close();
              toggleChatCustomPin(cid);
              const nowPinned = isChatCustomPinned(cid);
              if (global.UI && global.UI.toast) {
                global.UI.toast(nowPinned ? t('chatPinned', '📌 Chat anclado') : t('chatUnpinned', '📍 Chat desanclado'), 'info');
              }
              renderRooms();
            };
          }

          const btnMute = overlay.querySelector('#btn-ctx-mute');
          if (btnMute) {
            btnMute.onclick = () => {
              close();
              toggleChatMute(cid);
              const nowMuted = isChatMuted(cid);
              if (global.UI && global.UI.toast) {
                global.UI.toast(nowMuted ? t('notifsMuted', '🔕 Chat silenciado') : t('notifsEnabled', '🔔 Notificaciones activadas'), 'info');
              }
              renderRooms();
            };
          }

          const btnDelete = overlay.querySelector('#btn-ctx-delete');
          if (btnDelete) {
            btnDelete.onclick = () => {
              close();
              handleDeleteChat(cid, cleanName, chatObj);
            };
          }

          document.body.appendChild(overlay);
        }

        async function handleDeleteChat(cid, cname, chatObj) {
          haptic(25);
          if (!canDeleteChat(chatObj || { id: cid })) return;
          const isGroupChat = (chatObj && (chatObj.type === 'group' || cid.startsWith('group_')));

          if (isGroupChat && isCoach) {
            const confirmMsg = t('deleteGroupConfirm', '¿Eliminar este grupo de forma definitiva para todos?');
            if (!confirm(confirmMsg)) return;
            const maxTime = Math.max(Date.now(), (chatObj && chatObj.lastMessageTime) || 0);
            localStorage.setItem('chat_deleted_' + cid, String(maxTime));
            if (global.Cloud && global.Cloud.deleteChat) {
              await global.Cloud.deleteChat(cid);
            }
            renderRooms();
            if (global.UI && global.UI.toast) global.UI.toast(t('groupDeleted', 'Grupo eliminado'), 'info');
          } else {
            const confirmMsg = t('deleteChatConfirm', '¿Eliminar esta conversación de tu lista?');
            if (!confirm(confirmMsg)) return;
            const maxTime = Math.max(Date.now(), (chatObj && chatObj.lastMessageTime) || 0);
            localStorage.setItem('chat_deleted_' + cid, String(maxTime));
            renderRooms();
            if (global.UI && global.UI.toast) global.UI.toast(t('chatDeletedForYou', 'Conversación eliminada de tu lista'), 'info');
          }
        }

        listEl.querySelectorAll('.btn-delete-chat-card').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const cid = btn.getAttribute('data-chat-id');
            const cname = btn.getAttribute('data-chat-name');
            const chatObj = displayChats.find(x => x.id === cid);
            handleDeleteChat(cid, cname, chatObj);
          };
        });

        listEl.querySelectorAll('.chat-room-card').forEach(item => {
          let pressTimer = null;
          let pressFired = false;
          let touchX = 0;
          let touchY = 0;

          item.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
              touchX = e.touches[0].clientX;
              touchY = e.touches[0].clientY;
              pressFired = false;
              pressTimer = setTimeout(() => {
                pressFired = true;
                const cid = item.getAttribute('data-chat-id');
                const chatObj = displayChats.find(x => x.id === cid);
                openRoomContextMenu(chatObj);
              }, 480);
            }
          }, { passive: true });

          item.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            if (Math.abs(e.touches[0].clientX - touchX) > 10 || Math.abs(e.touches[0].clientY - touchY) > 10) {
              if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            }
          }, { passive: true });

          item.addEventListener('touchend', (e) => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            if (pressFired && e.cancelable) e.preventDefault();
          });

          item.addEventListener('touchcancel', () => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
          });

          item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const cid = item.getAttribute('data-chat-id');
            const chatObj = displayChats.find(x => x.id === cid);
            openRoomContextMenu(chatObj);
          });

          item.onclick = () => {
            if (pressFired) {
              pressFired = false;
              return;
            }
            const cid = item.getAttribute('data-chat-id');
            const targetChat = displayChats.find(x => x.id === cid);
            haptic(20);
            const cleanTitle = (targetChat ? targetChat.name : 'Chat').replace(/^Chat:\s*/i, '').replace(/^🛡️\s*Chat:\s*/i, '🛡️ ');
            ChatUI.markChatAsRead(curId, cid, targetChat ? targetChat.lastMessageTime : 0);
            ChatUI.openConversationModal(cid, {
              currentUserId: curId,
              currentUserName: curName,
              isCoach: isCoach,
              title: cleanTitle,
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
          onCreated: (chatId, chatData) => {
            ChatUI.openConversationModal(chatId, Object.assign({}, options, {
              title: chatData ? chatData.name : 'Grupo',
              chatData: chatData
            }));
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
                <div style="width: 38px; height: 38px; border-radius: 10px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${getCoachAvatarHtml(38, false)}</div>
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 14px; color: #fff; display: block;">${t('coach', 'Entrenador')} (${getCoachName()})</b>
                  <small style="color: #fde047; font-size: 11px;">${t('technicalStaff', 'Cuerpo Técnico Principal')}</small>
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
                    <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || t('player', 'Jugador')} ${tm ? '• ' + escapeHtml(tm.name) : ''}</small>
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
            <input type="text" id="inp-group-name" placeholder="${t('groupNamePlaceholder', 'Ej: Delanteros, Torneo Sábado...')}" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px; margin-bottom: 12px;" />

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
                  <div style="width: 28px; height: 28px; border-radius: 8px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${getCoachAvatarHtml(28, false)}</div>
                  <div style="flex: 1; overflow: hidden;">
                    <b style="font-size: 13px; color: #fff; display: block;">${t('coach', 'Entrenador')} (${getCoachName()})</b>
                    <small style="color: var(--cyan); font-size: 11px;">${t('technicalStaff', 'Staff Técnico')}</small>
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
                      <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || t('player', 'Jugador')} ${tm ? '• ' + escapeHtml(tm.name) : ''}</small>
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
          if (global.UI && global.UI.toast) global.UI.toast(t('enterGroupName', 'Introduce un nombre para el grupo'), 'error');
          return;
        }

        const selectedIds = [];
        overlay.querySelectorAll('.group-p-chk:checked').forEach(c => {
          selectedIds.push(c.value);
        });

        if (selectedIds.length === 0) {
          if (global.UI && global.UI.toast) global.UI.toast(t('selectAtLeastOneMember', 'Selecciona al menos un participante para el grupo'), 'error');
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

        try {
          if (global.Cloud && global.Cloud.createOrGetChat) {
            await global.Cloud.createOrGetChat(chatData);
          }
        } catch (err) {
          console.error('Error creating group in cloud:', err);
        }

        close();
        if (global.UI && global.UI.toast) global.UI.toast(t('groupCreated', 'Grupo creado con éxito'), 'success');
        if (typeof options.onCreated === 'function') {
          options.onCreated(groupId, chatData);
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

    // Modal para ver miembros del grupo, con opción a eliminarlos o gestionar el grupo
    openGroupMembersModal: function (chatId, currentChatData, allPlayers, options = {}) {
      const curId = options.currentUserId || 'coach';
      const isCoach = !!options.isCoach;
      const isCreator = currentChatData.createdBy === curId;
      const canManage = isCoach || isCreator;
      const participants = currentChatData.participants || [];

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 440px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">
              👥 ${t('groupMembers', 'Miembros del Grupo')} (${participants.length})
            </h3>
            <button type="button" class="icon-btn ghost" id="dlg-members-x" style="width: 32px; height: 32px;">✕</button>
          </div>

          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;" id="group-members-list">
            ${participants.map(pid => {
              if (pid === 'coach') {
                return `
                  <div class="card member-item-row" data-pid="coach" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; background: rgba(250, 204, 21, 0.08); border: 1px solid rgba(250, 204, 21, 0.3);">
                    <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${getCoachAvatarHtml(32, true)}</div>
                      <div>
                        <b style="font-size: 13.5px; color: #fff; display: block;">${t('coach', 'Entrenador')} (${getCoachName()})</b>
                        <small style="color: #fde047; font-size: 11px;">Staff Técnico Principal</small>
                      </div>
                    </div>
                    <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; font-size: 10px; padding: 2px 6px;">ADMIN</span>
                  </div>
                `;
              }
              const p = (allPlayers || []).find(x => x.id === pid);
              const displayName = p ? `#${p.mainDorsal != null ? p.mainDorsal : '-'} ${p.name || ''} ${p.lastName || ''}`.trim() : `Jugador (${pid})`;
              const isSelf = pid === curId;
              return `
                <div class="card member-item-row" data-pid="${pid}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border);">
                  <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(34,211,238,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; overflow: hidden;">
                      ${p && p.photo ? `<img src="${p.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : '👤'}
                    </div>
                    <div style="overflow: hidden; flex: 1;">
                      <b style="font-size: 13.5px; color: #fff; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                        ${escapeHtml(displayName)} ${isSelf ? '<small style="color: var(--cyan); font-weight: 700;">(' + t('you', 'Tú') + ')</small>' : ''}
                      </b>
                      <small style="color: var(--muted); font-size: 11px;">${p ? p.mainPosition || 'Jugador' : 'Participante'}</small>
                    </div>
                  </div>
                  ${(canManage && !isSelf) ? `
                    <button type="button" class="btn sm danger ghost btn-remove-member" data-pid="${pid}" data-pname="${escapeHtml(displayName)}" style="height: 32px; font-size: 11.5px; padding: 0 10px; font-weight: 800; border-radius: 8px;">
                      🗑️ ${t('removeMember', 'Eliminar')}
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border); padding-top: 12px;">
            <button type="button" class="btn primary block" id="btn-modal-add-parts" style="height: 42px; font-weight: 900; font-size: 13.5px;">
              ➕ ${t('addParticipants', 'Añadir participantes')}
            </button>
            ${canManage ? `
              <button type="button" class="btn danger ghost block" id="btn-modal-del-group" style="height: 38px; font-weight: 800; font-size: 12.5px;">
                🗑️ ${t('deleteGroup', 'Eliminar grupo')}
              </button>
            ` : ''}
          </div>
        </div>
      `;

      function close() { overlay.remove(); }
      overlay.querySelector('#dlg-members-x').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      // Eliminar miembro
      overlay.querySelectorAll('.btn-remove-member').forEach(btn => {
        btn.onclick = async () => {
          const pid = btn.getAttribute('data-pid');
          const pname = btn.getAttribute('data-pname');
          if (!confirm(`${t('removeMemberConfirm', '¿Eliminar a este miembro del grupo?')}\n${pname}`)) return;
          btn.disabled = true;
          if (global.Cloud && global.Cloud.removeChatParticipant) {
            await global.Cloud.removeChatParticipant(chatId, pid);
          }
          currentChatData.participants = (currentChatData.participants || []).filter(x => x !== pid);
          const row = overlay.querySelector(`.member-item-row[data-pid="${pid}"]`);
          if (row) row.remove();
          if (global.UI && global.UI.toast) global.UI.toast(t('memberRemoved', 'Miembro eliminado del grupo'), 'info');
        };
      });

      // Añadir participantes
      const btnAddParts = overlay.querySelector('#btn-modal-add-parts');
      if (btnAddParts) {
        btnAddParts.onclick = () => {
          close();
          ChatUI.openAddParticipantsModal(chatId, currentChatData, allPlayers, (added) => {
            currentChatData.participants = (currentChatData.participants || []).concat(added);
          });
        };
      }

      // Eliminar grupo
      const btnDelGroup = overlay.querySelector('#btn-modal-del-group');
      if (btnDelGroup) {
        btnDelGroup.onclick = async () => {
          if (!confirm(t('deleteGroupConfirm', '¿Eliminar este grupo de forma definitiva?'))) return;
          localStorage.setItem('chat_deleted_' + chatId, String(Date.now()));
          if (global.Cloud && global.Cloud.deleteChat) {
            await global.Cloud.deleteChat(chatId);
          }
          if (global.UI && global.UI.toast) global.UI.toast(t('groupDeleted', 'Grupo eliminado'), 'info');
          close();
          if (typeof options.onDeleted === 'function') options.onDeleted();
        };
      }

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
      const isEn = checkIsEn();
      currentlyOpenChatId = chatId;
      const curId = options.currentUserId || 'coach';
      const isCoach = !!options.isCoach || (curId === 'coach');
      const isCoachUser = isCoach;
      const curName = options.currentUserName || (isCoachUser ? t('coach', 'Entrenador') : t('player', 'Jugador'));
      const chatData = options.chatData || {};
      const allPlayers = options.players || [];
      const allTeams = options.teams || [];

      // Cancelar notificaciones de Android del sistema al entrar
      if (global.AndroidBridge && global.AndroidBridge.clearNotifications) {
        try { global.AndroidBridge.clearNotifications(); } catch (e) {}
      }

      let otherPlayerId = null;
      let otherPlayerObj = null;
      const isDirectOrCoachChat = (chatData.type === 'coach' || chatData.type === 'direct' || chatId.startsWith('coach_') || chatId.startsWith('direct_'));

      let resolvedTitle = options.title || 'Chat';
      if (isDirectOrCoachChat) {
        let parts = Array.isArray(chatData.participants) && chatData.participants.length ? chatData.participants : null;
        if (!parts) {
          if (chatId.startsWith('coach_')) {
            const pid = chatId.replace('coach_', '');
            parts = ['coach', pid];
          } else if (chatId.startsWith('direct_')) {
            parts = chatId.replace('direct_', '').split('_');
          }
        }
        const otherId = (parts || []).find(p => p !== curId) || ((parts && parts[0] === curId) ? parts[1] : (parts ? parts[0] : null));

        if (isCoachUser) {
          // En app de coach, el interlocutor en chat 1 a 1 siempre es un jugador
          otherPlayerId = (otherId && otherId !== 'coach') ? otherId : (parts || []).find(p => p !== 'coach');
          otherPlayerObj = (allPlayers || []).find(x => x.id === otherPlayerId) || (global.Store && global.Store.player ? global.Store.player(otherPlayerId) : null);
          if (otherPlayerObj) {
            resolvedTitle = `${otherPlayerObj.mainDorsal != null ? '#' + otherPlayerObj.mainDorsal + ' ' : ''}${otherPlayerObj.name || ''} ${otherPlayerObj.lastName || ''}`.trim();
          } else if (otherPlayerId) {
            resolvedTitle = `Jugador #${otherPlayerId}`;
          }
        } else {
          // En app de jugador:
          if (!otherId || otherId === 'coach' || chatData.type === 'coach' || chatId.startsWith('coach_')) {
            resolvedTitle = `(Coach) ${getCoachName()}`;
          } else {
            otherPlayerId = otherId;
            otherPlayerObj = (allPlayers || []).find(x => x.id === otherPlayerId) || (global.Store && global.Store.player ? global.Store.player(otherPlayerId) : null);
            if (otherPlayerObj) {
              resolvedTitle = `${otherPlayerObj.mainDorsal != null ? '#' + otherPlayerObj.mainDorsal + ' ' : ''}${otherPlayerObj.name || ''} ${otherPlayerObj.lastName || ''}`.trim();
            }
          }
        }

        if (!chatData.participants || !chatData.participants.length) {
          chatData.participants = isCoachUser ? ['coach', otherPlayerId] : [curId, otherPlayerId || 'coach'];
        }
      }

      // Marcar como leído inmediatamente
      ChatUI.markChatAsRead(curId, chatId, chatData ? chatData.lastMessageTime : 0);

      let messagesListenerUnsub = null;
      let presenceListenerUnsub = null;
      let messagesList = [];
      let pendingAttachment = null;
      let currentReplyTo = null; // { id, text, senderName }

      // Si el chat es de grupo o equipo nuevo, registrar en Firestore (los 1 a 1 se crean al enviar el primer mensaje)
      if (global.Cloud && global.Cloud.createOrGetChat) {
        if (chatData.type !== 'coach' && chatData.type !== 'direct' && !chatId.startsWith('coach_') && !chatId.startsWith('direct_')) {
          global.Cloud.createOrGetChat({
            id: chatId,
            name: resolvedTitle,
            type: chatData.type || 'group',
            participants: chatData.participants || [curId]
          });
        }
      }

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay chat-dialog-overlay';
      overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 0;';

      const isMutedThis = localStorage.getItem('chat_muted_' + chatId) === 'true';

      overlay.innerHTML = `
        <div class="dialog-box chat-modal-box" style="width: 100%; height: 100%; max-width: 600px; max-height: 100%; display: flex; flex-direction: column; background: var(--bg); border: none; border-radius: 0; padding: 0; overflow: hidden;">
          <!-- Barra superior del chat -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: calc(12px + env(safe-area-inset-top)) 14px 12px; background: var(--surface2); border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1; min-width: 0;">
              <button type="button" class="icon-btn ghost" id="chat-back-btn" style="width: 36px; height: 36px; flex-shrink: 0;">
                ◀
              </button>
              <div id="chat-header-avatar" style="width: 36px; height: 36px; border-radius: 10px; background: rgba(34,211,238,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; overflow: hidden; cursor: pointer;">
                ${getChatAvatar(chatData, curId, allPlayers)}
              </div>
              <div style="overflow: hidden; flex: 1; min-width: 0;">
                <div style="overflow-x: auto; white-space: nowrap; scrollbar-width: none; -ms-overflow-style: none;">
                  <h3 id="chat-header-title" style="margin: 0; font-size: 15px; font-weight: 900; color: #fff; display: inline-block;">
                    ${escapeHtml(resolvedTitle.replace(/^Chat:\s*/i, '').replace(/^🛡️\s*Chat:\s*/i, '🛡️ '))}
                  </h3>
                </div>
                <span id="chat-presence-indicator" style="font-size: 11px; font-weight: 600;">
                  ${isDirectOrCoachChat
                    ? `⚪ <span style="color: var(--muted);">${t('offline', 'Desconectado')}</span>`
                    : `👥 <span style="color: #22d3ee;">${t('group', 'Grupo')}</span>`
                  }
                </span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              ${(chatData.type === 'group' || chatData.type === 'team' || chatId.startsWith('group_') || chatId.startsWith('team_')) ? `
                <button type="button" class="icon-btn ghost" id="chat-members-btn" style="width: 36px; height: 36px; font-size: 17px; color: var(--cyan);" title="${t('groupMembers', 'Miembros del Grupo')}">
                  👥
                </button>
              ` : ''}
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
            ${(chatData.type === 'group' || chatData.type === 'team' || chatId.startsWith('group_') || chatId.startsWith('team_')) ? `
              <button type="button" class="btn sm ghost" id="opt-view-members" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
                👥 ${t('groupMembers', 'Ver miembros del grupo')}
              </button>
              <button type="button" class="btn sm ghost" id="opt-add-participants" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
                ➕ ${t('addParticipants', 'Añadir jugadores al grupo')}
              </button>
            ` : ''}
            ${(chatData.type === 'group' || chatId.startsWith('group_')) ? `
              <button type="button" class="btn sm ghost" id="opt-edit-group" style="justify-content: flex-start; gap: 8px; width: 100%; height: 36px;">
                ✏️ ${t('editGroup', 'Cambiar nombre e icono del grupo')}
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
              🗑️ ${(chatData.type === 'group' || chatId.startsWith('group_') || chatData.type === 'team') ? t('deleteGroup', 'Eliminar grupo') : t('deleteChat', 'Eliminar conversación')}
            </button>
          </div>

          <!-- Área de Mensajes -->
          <div id="chat-messages-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; -webkit-overflow-scrolling: touch;">
            <div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12.5px;">
              ${t('loading', 'Cargando mensajes...')}
            </div>
          </div>

          <!-- Barra de entrada inferior -->
          <div style="display: flex; flex-direction: column; background: var(--surface); border-top: 1px solid var(--border); flex-shrink: 0; position: relative;">
            <!-- Autocomplete de menciones (@jugador) -->
            <div id="chat-mention-popup" style="display: none; position: absolute; bottom: 100%; left: 8px; right: 8px; max-height: 180px; overflow-y: auto; background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 100; flex-direction: column; gap: 4px; padding: 6px;">
            </div>
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
      const membersBtn = overlay.querySelector('#chat-members-btn');
      const optViewMembers = overlay.querySelector('#opt-view-members');
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
      const mentionPopup = overlay.querySelector('#chat-mention-popup');

      const openPartnerProfile = () => {
        haptic(25);
        if (isCoachUser) {
          if (otherPlayerId && typeof global.__showPlayerProfile === 'function') {
            global.__showPlayerProfile(otherPlayerId);
          }
        } else {
          if (!otherPlayerId || otherPlayerId === 'coach') {
            if (typeof global.__showCoachProfile === 'function') {
              global.__showCoachProfile();
            }
          } else {
            if (typeof global.__showPlayerProfile === 'function') {
              global.__showPlayerProfile(otherPlayerId);
            }
          }
        }
      };

      if (isDirectOrCoachChat) {
        if (headerAvatar) {
          headerAvatar.style.cursor = 'pointer';
          headerAvatar.title = t('viewProfile', 'Ver perfil');
          headerAvatar.onclick = openPartnerProfile;
        }
        if (headerTitle) {
          headerTitle.style.cursor = 'pointer';
          headerTitle.title = t('viewProfile', 'Ver perfil');
          headerTitle.onclick = openPartnerProfile;
        }
      } else {
        if (headerAvatar && chatData.photo) {
          headerAvatar.onclick = () => openPhotoLightbox(chatData.photo);
        }
      }

      if (clearReplyBtn) {
        clearReplyBtn.onclick = () => {
          currentReplyTo = null;
          replyPreview.style.display = 'none';
        };
      }

      // Presencia en directo desactivada para proteger la cuota de Firebase

      // Desplegable de menú
      if (menuBtn && menuDropdown) {
        menuBtn.onclick = () => {
          menuDropdown.style.display = menuDropdown.style.display === 'none' ? 'flex' : 'none';
        };
      }

      function handleOpenMembers() {
        if (menuDropdown) menuDropdown.style.display = 'none';
        ChatUI.openGroupMembersModal(chatId, chatData, allPlayers, {
          currentUserId: curId,
          currentUserName: curName,
          isCoach: isCoach,
          onDeleted: () => {
            close();
          }
        });
      }

      if (membersBtn) membersBtn.onclick = handleOpenMembers;
      if (optViewMembers) optViewMembers.onclick = handleOpenMembers;

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
          const isGroupChat = (chatData.type === 'group' || chatId.startsWith('group_'));
          if (isGroupChat && isCoachUser) {
            const confirmMsg = t('deleteGroupConfirm', '¿Eliminar este grupo de forma definitiva para todos?');
            if (!confirm(confirmMsg)) return;
            try {
              const maxTime = Math.max(Date.now(), (chatData && chatData.lastMessageTime) || 0);
              localStorage.setItem('chat_deleted_' + chatId, String(maxTime));
              if (global.Cloud && global.Cloud.deleteChat) {
                await global.Cloud.deleteChat(chatId);
              }
            } catch (e) {
              console.error('Error deleting chat:', e);
            }
            if (global.UI && global.UI.toast) global.UI.toast(t('groupDeleted', 'Grupo eliminado'), 'info');
          } else {
            // Conversaciones directas / 1 a 1 / con jugador:
            // NUNCA eliminar de la nube para el otro lado. Se elimina / oculta solo para el usuario actual.
            const confirmMsg = t('deleteChatConfirm', '¿Eliminar esta conversación de tu lista?');
            if (!confirm(confirmMsg)) return;
            const maxTime = Math.max(Date.now(), (chatData && chatData.lastMessageTime) || 0);
            localStorage.setItem('chat_deleted_' + chatId, String(maxTime));
            if (global.UI && global.UI.toast) global.UI.toast(t('chatDeletedForYou', 'Conversación eliminada de tu lista'), 'info');
          }
          close();
          if (typeof global._refreshChatList === 'function') {
            global._refreshChatList();
          }
        };
      }

      // Autocomplete de menciones (@jugador) SOLO en chats grupales o de equipo
      const isGroupOrTeamChat = (chatData.type === 'group' || chatData.type === 'team' || chatId.startsWith('group_') || chatId.startsWith('team_'));
      if (inputEl && mentionPopup && isGroupOrTeamChat) {
        inputEl.addEventListener('input', () => {
          const val = inputEl.value;
          const selStart = inputEl.selectionStart || val.length;
          const beforeCursor = val.slice(0, selStart);
          const match = beforeCursor.match(/@([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]*)$/);

          if (match) {
            const q = match[1].toLowerCase();
            const candidateList = [];
            if (!isCoach) candidateList.push({ id: 'coach', name: 'Entrenador' });
            allPlayers.forEach(p => {
              if (p.id !== curId) {
                candidateList.push({
                  id: p.id,
                  name: `${p.name || ''} ${p.lastName || ''}`.trim() || `Jugador #${p.mainDorsal || ''}`,
                  dorsal: p.mainDorsal,
                  photo: p.photo
                });
              }
            });

            const filtered = candidateList.filter(c => !q || c.name.toLowerCase().includes(q));
            if (filtered.length > 0) {
              mentionPopup.innerHTML = filtered.slice(0, 6).map(c => `
                <div class="mention-candidate-item" data-cname="${escapeHtml(c.name)}" style="display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 8px; cursor: pointer; background: var(--surface2);">
                  <div style="width: 26px; height: 26px; border-radius: 50%; background: rgba(34,211,238,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; overflow: hidden; flex-shrink: 0;">
                    ${c.photo ? `<img src="${c.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : (c.id === 'coach' ? getCoachAvatarHtml(26, true) : '👤')}
                  </div>
                  <b style="font-size: 13px; color: #fff;">@${escapeHtml(c.name)}</b>
                </div>
              `).join('');

              mentionPopup.style.display = 'flex';

              mentionPopup.querySelectorAll('.mention-candidate-item').forEach(it => {
                it.onclick = (e) => {
                  e.stopPropagation();
                  const targetName = it.getAttribute('data-cname').replace(/\s+/g, '_');
                  const prefix = val.slice(0, match.index);
                  const suffix = val.slice(selStart);
                  inputEl.value = `${prefix}@${targetName} ${suffix}`;
                  mentionPopup.style.display = 'none';
                  inputEl.focus();
                };
              });
              return;
            }
          }

          mentionPopup.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
          if (!inputEl.contains(e.target) && !mentionPopup.contains(e.target)) {
            mentionPopup.style.display = 'none';
          }
        });
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
        const visibleMessages = (messagesList || []).filter(m => localStorage.getItem('msg_deleted_' + m.id) !== 'true');
        if (visibleMessages.length === 0) {
          msgsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 16px; color: var(--muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">👋</div>
              <p style="margin: 0; font-size: 13px;">${t('noMessagesYet', 'Aún no hay mensajes en este chat. ¡Envía el primero!')}</p>
            </div>
          `;
          return;
        }

        const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '⚽'];

        function getDateKey(ts) {
          if (!ts) return '';
          const d = new Date(ts);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function formatDateDivider(ts) {
          if (!ts) return '';
          const d = new Date(ts);
          const now = new Date();
          const todayKey = getDateKey(now.getTime());
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayKey = getDateKey(yesterday.getTime());
          const msgKey = getDateKey(ts);
          const lang = getChatLang();

          if (msgKey === todayKey) {
            return t('today', lang === 'ee' ? 'Täna' : (lang === 'es' ? 'Hoy' : 'Today'));
          } else if (msgKey === yesterdayKey) {
            return t('yesterday', lang === 'ee' ? 'Eile' : (lang === 'es' ? 'Ayer' : 'Yesterday'));
          } else {
            try {
              const locale = lang === 'ee' ? 'et-EE' : (lang === 'es' ? 'es-ES' : 'en-US');
              return d.toLocaleDateString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
              });
            } catch (e) {
              return msgKey;
            }
          }
        }

        function formatMessageText(txt, convId, eventTitle, isMine) {
          if (!txt) return '';
          let escaped = escapeHtml(txt);

          // Ocultar etiquetas técnicas de evento en el texto visible
          escaped = escaped.replace(/\n?\[(?:event|conv|conv_ref):[a-zA-Z0-9_\-]+\]/g, '');

          // Hacer clicable el nombre del evento si el mensaje contiene el título del evento
          if (convId && eventTitle) {
            const escapedTitle = escapeHtml(eventTitle);
            const regexTitle = new RegExp(`&quot;${escapedTitle}&quot;|"${escapedTitle}"`, 'g');
            const linkColor = isMine ? '#ffffff' : '#38bdf8';
            escaped = escaped.replace(regexTitle, `<span class="chat-conv-link" data-conv-id="${convId}" style="text-decoration: underline; color: ${linkColor}; font-weight: 900; cursor: pointer;">"${escapedTitle}"</span>`);
          }

          // Resaltar menciones con @ con contraste óptimo (blanco nítido sobre fondo verde para mensajes propios)
          const mentionStyle = isMine
            ? 'background: rgba(0, 0, 0, 0.35); color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: 900; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.25);'
            : 'background: rgba(34, 211, 238, 0.2); color: #38bdf8; font-weight: 900; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(34, 211, 238, 0.35);';

          escaped = escaped.replace(/@([^\n\r@<]+)/g, `<span style="${mentionStyle}">@$1</span>`);

          // Conservar saltos de línea
          escaped = escaped.replace(/\n/g, '<br/>');
          return escaped;
        }

        msgsContainer.innerHTML = visibleMessages.map((m, idx) => {
          const isMine = m.senderId === curId;
          const time = formatTime(m.timestamp);

          // Divisor de días si la fecha cambia respecto al mensaje anterior
          let dateDividerHtml = '';
          const prevMsg = idx > 0 ? visibleMessages[idx - 1] : null;
          const prevDateKey = prevMsg ? getDateKey(prevMsg.timestamp) : '';
          const curDateKey = getDateKey(m.timestamp);

          if (curDateKey && curDateKey !== prevDateKey) {
            const label = formatDateDivider(m.timestamp);
            dateDividerHtml = `
              <div class="chat-day-divider" style="display: flex; align-items: center; justify-content: center; margin: 18px 0 12px; gap: 12px; width: 100%;">
                <div style="flex: 1; height: 1px; background: var(--border); opacity: 0.6;"></div>
                <span style="font-size: 11px; font-weight: 800; color: var(--muted); background: var(--surface2); padding: 3px 12px; border-radius: 12px; border: 1px solid var(--border); text-transform: capitalize; letter-spacing: 0.3px;">
                  ${label}
                </span>
                <div style="flex: 1; height: 1px; background: var(--border); opacity: 0.6;"></div>
              </div>
            `;
          }

          // Avatar y nombre del emisor
          let senderAvatarHtml = '👤';
          if (m.senderId === 'coach') {
            senderAvatarHtml = getCoachAvatarHtml(32, true);
          } else {
            const p = (allPlayers || []).find(x => String(x.id) === String(m.senderId)) ||
                      (global.Store && global.Store.player ? global.Store.player(m.senderId) : null);
            if (p && p.photo) {
              senderAvatarHtml = `<img src="${p.photo}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            } else if (p) {
              const init = (p.name || '?')[0].toUpperCase();
              senderAvatarHtml = `<span style="font-weight: 900; font-size: 13px; color: #38bdf8;">${init}</span>`;
            }
          }

          if (m.isDeletedForEveryone) {
            return dateDividerHtml + `
              <div class="chat-msg-row" data-mid="${m.id}" style="display: flex; gap: 8px; align-items: flex-end; justify-content: ${isMine ? 'flex-end' : 'flex-start'}; margin-bottom: 4px; touch-action: pan-y;">
                ${!isMine ? `
                  <div class="chat-sender-avatar" data-sender-id="${m.senderId}" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(34, 211, 238, 0.2); border: 1.5px solid rgba(34, 211, 238, 0.4); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; cursor: pointer; overflow: hidden; margin-bottom: 2px;" title="${t('viewProfile', 'Ver perfil')}">
                    ${senderAvatarHtml}
                  </div>
                ` : ''}

                <div style="display: flex; flex-direction: column; align-items: ${isMine ? 'flex-end' : 'flex-start'}; max-width: 82%;">
                  ${!isMine ? `
                    <span class="chat-sender-name" data-sender-id="${m.senderId}" style="font-size: 11.5px; font-weight: 800; color: #38bdf8; margin-bottom: 3px; padding-left: 4px; cursor: pointer;">
                      ${escapeHtml(m.senderName || t('user', 'Usuario'))}
                    </span>
                  ` : ''}

                  <div style="padding: 8px 12px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px dashed var(--border); color: var(--muted); font-size: 13px; font-style: italic; display: flex; align-items: center; gap: 6px;">
                    <span>🚫</span>
                    <span>${t('msgDeletedForEveryone', 'Este mensaje fue eliminado')}</span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; padding: 0 4px;">
                    <small style="font-size: 10.5px; color: var(--muted);">${time}</small>
                  </div>
                </div>
              </div>
            `;
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
          const reactionsEntries = getReactionsSummary(m.reactions || {});

          // Botón directo para ir al evento si el mensaje incluye convId o es recordatorio de asistencia
          let convLinkHtml = '';
          let targetConvId = m.convId;
          if (!targetConvId && m.text) {
            const evMatch = m.text.match(/\[(?:event|conv|conv_ref):([a-zA-Z0-9_\-]+)\]/);
            if (evMatch) {
              targetConvId = evMatch[1];
            } else if (m.text.includes('[Attendance reminder]')) {
              const titleMatch = m.text.match(/for "([^"]+)"/);
              const evTitleMatch = titleMatch ? titleMatch[1] : '';
              const convs = (window.clubData && window.clubData.convocations) || (window.Store && window.Store.state && window.Store.state.convocations) || [];
              const found = convs.find(c => (c.title === evTitleMatch) || (c.rival && evTitleMatch.includes(c.rival)));
              if (found) targetConvId = found.id;
              else if (convs.length > 0) targetConvId = convs[convs.length - 1].id;
              else targetConvId = '';
            }
          }

          const isAttendanceReminder = (m.type === 'attendance_reminder') || (m.text && m.text.includes('[Attendance reminder]')) || !!targetConvId;

          if (isAttendanceReminder) {
            const evTitle = m.eventTitle || (m.text && m.text.match(/for "([^"]+)"/) ? m.text.match(/for "([^"]+)"/)[1] : '');
            const btnBg = isMine ? '#031206' : 'linear-gradient(135deg, #0284c7, #0369a1)';
            const btnColor = isMine ? '#86efac' : '#ffffff';
            const btnBorder = isMine ? '1.5px solid rgba(0,0,0,0.5)' : '1px solid #38bdf8';
            const buttonLabel = evTitle ? `Go to Event (${escapeHtml(evTitle)})` : 'Go to Event';
            convLinkHtml = `
              <div style="margin-top: 10px;">
                <button type="button" class="btn block chat-btn-go-event" data-conv-id="${targetConvId || ''}" style="height: 40px; font-size: 13px; font-weight: 900; border-radius: 10px; background: ${btnBg}; color: ${btnColor}; border: ${btnBorder}; box-shadow: 0 3px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; width: 100%;">
                  <span>📅</span>
                  <span>${buttonLabel}</span>
                  <span style="font-size: 15px;">➔</span>
                </button>
              </div>
            `;
          }

          return dateDividerHtml + `
            <div class="chat-msg-row" data-mid="${m.id}" style="display: flex; gap: 8px; align-items: flex-end; justify-content: ${isMine ? 'flex-end' : 'flex-start'}; margin-bottom: 4px; touch-action: pan-y;">
              ${!isMine ? `
                <div class="chat-sender-avatar" data-sender-id="${m.senderId}" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(34, 211, 238, 0.2); border: 1.5px solid rgba(34, 211, 238, 0.4); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; cursor: pointer; overflow: hidden; margin-bottom: 2px;" title="${t('viewProfile', 'Ver perfil')}">
                  ${senderAvatarHtml}
                </div>
              ` : ''}

              <div style="display: flex; flex-direction: column; align-items: ${isMine ? 'flex-end' : 'flex-start'}; max-width: 82%;">
                ${!isMine ? `
                  <span class="chat-sender-name" data-sender-id="${m.senderId}" style="font-size: 11.5px; font-weight: 800; color: #38bdf8; margin-bottom: 3px; padding-left: 4px; cursor: pointer;">
                    ${escapeHtml(m.senderName || t('user', 'Usuario'))}
                  </span>
                ` : ''}

                <div style="padding: 10px 14px; border-radius: ${isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; background: ${isMine ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'var(--surface2)'}; color: ${isMine ? '#031206' : '#fff'}; border: ${isMine ? 'none' : '1px solid var(--border)'}; font-size: 14px; line-height: 1.45; word-break: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.15); position: relative;">
                  ${quoteHtml}
                  ${mediaHtml}
                  ${m.text ? `<div>${formatMessageText(m.text, targetConvId || m.convId, m.eventTitle, isMine)}</div>` : ''}
                  ${convLinkHtml}
                </div>

                <!-- Barra de acciones rápidas (Reaccionar, Citar, Opciones) y fecha -->
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; padding: 0 4px;">
                  <small style="font-size: 10.5px; color: var(--muted);">${time}${m.isEdited ? ` • ${t('edited', 'editado')}` : ''}</small>

                  <button type="button" class="icon-btn ghost btn-msg-react" data-mid="${m.id}" style="width: 22px; height: 22px; font-size: 13px; padding: 0; opacity: 0.75;" title="${t('react', 'Reaccionar')}">
                    😊
                  </button>

                  <button type="button" class="icon-btn ghost btn-msg-reply" data-mid="${m.id}" data-text="${escapeHtml(m.text || '')}" data-sname="${escapeHtml(m.senderName || '')}" style="width: 22px; height: 22px; font-size: 13px; padding: 0; opacity: 0.75;" title="${t('reply', 'Responder')}">
                    ↩️
                  </button>
                </div>

                <!-- Lista de Reacciones activas debajo del mensaje -->
                ${reactionsEntries.length > 0 ? `
                  <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px;">
                    ${reactionsEntries.map(([em, users]) => {
                      const hasMyReaction = Array.isArray(users) && users.includes(curId);
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

        // Clic en enlace o tarjeta de convocatoria / evento
        msgsContainer.querySelectorAll('[data-conv-id]').forEach(el => {
          el.onclick = (e) => {
            e.stopPropagation();
            const cid = el.getAttribute('data-conv-id');
            if (cid) {
              haptic(30);
              if (typeof window.__openConvocationInPortal === 'function') {
                window.__openConvocationInPortal(cid);
              } else if (typeof window.__openConvocationInCoach === 'function') {
                window.__openConvocationInCoach(cid);
              }
            }
          };
        });

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

        // Deslizar mensaje hacia la izquierda para responder (swipe-to-reply)
        // Y mantener pulsado (long-press) para desplegar menú contextual
        msgsContainer.querySelectorAll('.chat-msg-row').forEach(row => {
          let touchStartX = 0;
          let touchStartY = 0;
          let isSwiping = false;
          let diffX = 0;
          let longPressTimer = null;
          let longPressFired = false;

          const mid = row.getAttribute('data-mid');
          const m = messagesList.find(x => x.id === mid);

          const triggerContextMenu = () => {
            if (!m) return;
            longPressFired = true;
            haptic(35);
            openMessageOptionsMenu(m);
          };

          row.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
              touchStartX = e.touches[0].clientX;
              touchStartY = e.touches[0].clientY;
              isSwiping = false;
              diffX = 0;
              longPressFired = false;
              longPressTimer = setTimeout(() => {
                triggerContextMenu();
              }, 480);
            }
          }, { passive: true });

          row.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            diffX = currentX - touchStartX;
            const diffY = currentY - touchStartY;

            if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
            }

            if (!longPressFired && diffX < -15 && Math.abs(diffX) > Math.abs(diffY)) {
              isSwiping = true;
              const translateX = Math.max(diffX, -65);
              row.style.transform = `translateX(${translateX}px)`;
              row.style.transition = 'none';
            }
          }, { passive: true });

          row.addEventListener('touchend', (e) => {
            if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
            if (longPressFired) {
              if (e.cancelable) e.preventDefault();
              return;
            }

            if (isSwiping) {
              row.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
              row.style.transform = 'translateX(0px)';

              if (diffX < -45 && m) {
                currentReplyTo = { id: m.id, text: m.text, senderName: m.senderName };
                if (replyText) replyText.textContent = `${m.senderName}: "${m.text ? m.text.slice(0, 45) : '📷'}"`;
                if (replyPreview) replyPreview.style.display = 'flex';
                haptic(35);
                if (inputEl) inputEl.focus();
              }
              isSwiping = false;
            }
          });

          row.addEventListener('touchcancel', () => {
            if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
          });

          // Compatibilidad con PC / click derecho / ratón
          row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            triggerContextMenu();
          });
        });

        // Función para aplicar o alternar reacción
        async function applyReaction(mid, emoji) {
          haptic(25);
          const msgObj = messagesList.find(x => x.id === mid);
          if (msgObj) {
            if (!msgObj.reactions || typeof msgObj.reactions !== 'object') msgObj.reactions = {};
            if (msgObj.reactions[curId] && (msgObj.reactions[curId].emoji === emoji || msgObj.reactions[curId] === emoji)) {
              delete msgObj.reactions[curId];
            } else {
              msgObj.reactions[curId] = { emoji: emoji, userName: curName, time: Date.now() };
            }
            renderMessages();
          }
          if (global.Cloud && global.Cloud.reactToChatMessage) {
            await global.Cloud.reactToChatMessage(chatId, mid, curId, curName, emoji);
          }
        }

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
            await applyReaction(mid, emoji);
          };
        });

        // Toggle reacción pulsando sobre la insignia existente
        msgsContainer.querySelectorAll('.badge-reaction').forEach(b => {
          b.onclick = async () => {
            const mid = b.getAttribute('data-mid');
            const emoji = b.getAttribute('data-emoji');
            await applyReaction(mid, emoji);
          };
        });

        // Botón directo para ir al evento de la convocatoria
        msgsContainer.querySelectorAll('.chat-btn-go-event, .chat-conv-link').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const convId = btn.getAttribute('data-conv-id');
            if (typeof window.__openConvocationInPortal === 'function') {
              window.__openConvocationInPortal(convId);
            } else {
              const dlg = document.querySelector('.chat-dialog-overlay');
              if (dlg) dlg.remove();
              if (window.Store && window.Store.convocation && convId) {
                const conv = window.Store.convocation(convId);
                if (conv && typeof showConvocationDetailsModal === 'function') {
                  showConvocationDetailsModal(conv);
                } else if (typeof navigate === 'function') {
                  navigate('convocations');
                }
              } else if (typeof navigate === 'function') {
                navigate('convocations');
              }
            }
          };
        });

        function openMessageOptionsMenu(m) {
          haptic(25);
          const isMine = m.senderId === curId;
          const isDeletedForEveryone = !!m.isDeletedForEveryone;
          // Solo mensajes propios pueden editarse o borrarse para todos:
          const canDeleteForEveryone = isMine && !isDeletedForEveryone;
          const canEdit = isMine && !isDeletedForEveryone && !!(m.text && m.text.trim());

          const menuOverlay = document.createElement('div');
          menuOverlay.className = 'dialog-overlay';
          menuOverlay.style.cssText = 'position: fixed; inset: 0; z-index: 10005; background: rgba(0,0,0,0.65); display: flex; align-items: flex-end; justify-content: center; padding: 14px;';
          menuOverlay.innerHTML = `
            <div class="dialog-box" style="width: 100%; max-width: 360px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); animation: sheetUp 0.18s ease;">
              <div style="font-size: 12px; font-weight: 800; color: var(--muted); padding: 0 4px 6px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <span>💬 ${t('messageOptions', 'Opciones del mensaje')}</span>
                <button type="button" class="icon-btn ghost" id="msg-menu-x" style="width: 26px; height: 26px; font-size: 14px;">✕</button>
              </div>

              <!-- Copiar: disponible para TODOS los mensajes -->
              <button type="button" class="btn sm ghost" id="btn-msg-opt-copy" style="justify-content: flex-start; gap: 10px; width: 100%; height: 40px; font-size: 13.5px; font-weight: 700;">
                📋 ${t('copyMessage', 'Copiar mensaje')}
              </button>

              ${canEdit ? `
                <!-- Editar: solo para mensajes propios -->
                <button type="button" class="btn sm ghost" id="btn-msg-opt-edit" style="justify-content: flex-start; gap: 10px; width: 100%; height: 40px; font-size: 13.5px; font-weight: 700;">
                  ✏️ ${t('editMessage', 'Editar mensaje')}
                </button>
              ` : ''}

              ${canDeleteForEveryone ? `
                <!-- Borrar para todos: solo para mensajes propios -->
                <button type="button" class="btn sm danger ghost" id="btn-msg-opt-del-everyone" style="justify-content: flex-start; gap: 10px; width: 100%; height: 40px; font-size: 13.5px; font-weight: 700; color: #f87171;">
                  🗑️ ${t('deleteForEveryone', 'Borrar para todos')}
                </button>
              ` : ''}

              <!-- Borrar para mí: disponible para TODOS los mensajes -->
              <button type="button" class="btn sm ghost" id="btn-msg-opt-del-me" style="justify-content: flex-start; gap: 10px; width: 100%; height: 40px; font-size: 13.5px; font-weight: 700; color: #fca5a5;">
                👁️ ${t('deleteForMe', 'Borrar para mí')}
              </button>
            </div>
          `;

          function closeMenu() { menuOverlay.remove(); }
          menuOverlay.querySelector('#msg-menu-x').onclick = closeMenu;
          menuOverlay.onclick = (e) => { if (e.target === menuOverlay) closeMenu(); };

          const btnCopy = menuOverlay.querySelector('#btn-msg-opt-copy');
          if (btnCopy) {
            btnCopy.onclick = () => {
              closeMenu();
              let textToCopy = m.text || '';
              if (m.isDeletedForEveryone) textToCopy = t('msgDeletedForEveryone', 'Este mensaje fue eliminado');
              else if (!textToCopy && m.file) textToCopy = m.file.name || '';
              else if (!textToCopy && m.image) textToCopy = m.image;

              if (textToCopy) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(textToCopy).catch(() => {});
                } else {
                  const ta = document.createElement('textarea');
                  ta.value = textToCopy;
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand('copy');
                  ta.remove();
                }
                if (global.UI && global.UI.toast) global.UI.toast(t('copiedToClipboard', 'Mensaje copiado al portapapeles'), 'success');
              }
            };
          }

          const btnEdit = menuOverlay.querySelector('#btn-msg-opt-edit');
          if (btnEdit) {
            btnEdit.onclick = () => {
              closeMenu();
              openEditMessageModal(m);
            };
          }

          const btnDelEveryone = menuOverlay.querySelector('#btn-msg-opt-del-everyone');
          if (btnDelEveryone) {
            btnDelEveryone.onclick = async () => {
              closeMenu();
              if (!confirm(t('deleteForEveryoneConfirm', '¿Eliminar este mensaje para todos?'))) return;
              try {
                if (global.Cloud && global.Cloud.deleteChatMessageForEveryone) {
                  await global.Cloud.deleteChatMessageForEveryone(chatId, m.id);
                }
                m.isDeletedForEveryone = true;
                m.text = '';
                m.image = null;
                m.file = null;
                renderMessages();
                if (global.UI && global.UI.toast) global.UI.toast(t('messageDeleted', 'Mensaje eliminado para todos'), 'info');
              } catch (err) {
                console.error(err);
              }
            };
          }

          const btnDelMe = menuOverlay.querySelector('#btn-msg-opt-del-me');
          if (btnDelMe) {
            btnDelMe.onclick = () => {
              closeMenu();
              localStorage.setItem('msg_deleted_' + m.id, 'true');
              renderMessages();
              if (global.UI && global.UI.toast) global.UI.toast(t('messageDeletedForMe', 'Mensaje eliminado para ti'), 'info');
            };
          }

          document.body.appendChild(menuOverlay);
        }

        function openEditMessageModal(m) {
          const editOverlay = document.createElement('div');
          editOverlay.className = 'dialog-overlay';
          editOverlay.style.cssText = 'position: fixed; inset: 0; z-index: 10010; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; padding: 14px;';
          editOverlay.innerHTML = `
            <div class="dialog-box" style="width: 100%; max-width: 400px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">✏️ ${t('editMessage', 'Editar mensaje')}</h3>
                <button type="button" class="icon-btn ghost" id="dlg-edit-x" style="width: 30px; height: 30px;">✕</button>
              </div>
              <textarea id="edit-msg-inp" rows="3" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 14px; resize: none; font-family: inherit;">${escapeHtml(m.text || '')}</textarea>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn ghost block" id="btn-cancel-edit-msg" style="flex: 1; height: 38px;">${t('cancel', 'Cancelar')}</button>
                <button type="button" class="btn primary block" id="btn-save-edit-msg" style="flex: 1; height: 38px; font-weight: 800;">${t('save', 'Guardar')}</button>
              </div>
            </div>
          `;

          function closeEdit() { editOverlay.remove(); }
          editOverlay.querySelector('#dlg-edit-x').onclick = closeEdit;
          editOverlay.querySelector('#btn-cancel-edit-msg').onclick = closeEdit;
          editOverlay.onclick = (e) => { if (e.target === editOverlay) closeEdit(); };

          const btnSave = editOverlay.querySelector('#btn-save-edit-msg');
          const inp = editOverlay.querySelector('#edit-msg-inp');
          btnSave.onclick = async () => {
            const newTxt = inp.value.trim();
            if (!newTxt) return;
            closeEdit();
            try {
              if (global.Cloud && global.Cloud.editChatMessage) {
                await global.Cloud.editChatMessage(chatId, m.id, newTxt);
              }
              m.text = newTxt;
              m.isEdited = true;
              renderMessages();
              if (global.UI && global.UI.toast) global.UI.toast(t('messageEdited', 'Mensaje actualizado'), 'success');
            } catch (err) {
              console.error(err);
            }
          };

          document.body.appendChild(editOverlay);
          setTimeout(() => inp.focus(), 100);
        }

        scrollToBottom();
      }

      async function handleSend() {
        if (!isCoach) {
          const validPlayerId = localStorage.getItem('portal_player_id');
          const allPlayers = (global.clubData && global.clubData.players) || (global.Store && global.Store.state && global.Store.state.players) || [];
          const playerExists = validPlayerId && allPlayers.some(p => p.id === validPlayerId);
          if (!validPlayerId || (allPlayers.length > 0 && !playerExists)) {
            alert(t('profileInactiveMsg', 'Tu perfil de jugador ya no está activo. No puedes enviar mensajes.'));
            const overlay = document.querySelector('.chat-dialog-overlay');
            if (overlay) overlay.remove();
            return;
          }
        }

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
          if (global.Cloud.createOrGetChat && (chatData.type === 'coach' || chatData.type === 'direct' || chatId.startsWith('coach_') || chatId.startsWith('direct_'))) {
            try {
              let directParts = chatData.participants || [curId];
              if (!directParts.includes('coach') && (chatId.startsWith('coach_') || chatData.type === 'coach')) {
                const otherPlayer = chatId.replace('coach_', '');
                directParts = ['coach', otherPlayer];
              }
              await global.Cloud.createOrGetChat({
                id: chatId,
                name: resolvedTitle,
                type: chatData.type || (chatId.startsWith('coach_') ? 'coach' : 'direct'),
                participants: directParts
              });
            } catch (err) {
              console.warn('[Chat] Error asegurando chat doc:', err);
            }
          }
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
          try { localStorage.removeItem('chat_deleted_' + chatId); } catch (e) {}
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

    // Iniciar chat directo con un jugador concreto o con el entrenador
    startDirectChat: function (otherUserId, otherUserName, options = {}) {
      const curId = options.currentUserId || 'coach';
      const curName = options.currentUserName || 'Usuario';
      const isCoach = !!options.isCoach;
      const isEn = (global.Store && global.Store.state && global.Store.state.lang === 'en') || (localStorage.getItem('preferred_lang') === 'en');
      const coachName = getCoachName();

      let chatId;
      let title = otherUserName || 'Chat';
      let chatType = 'direct';

      const isCoachTarget = (otherUserId === 'coach') || (otherUserName && coachName && otherUserName.toLowerCase().includes(coachName.toLowerCase()));

      if (isCoachTarget || curId === 'coach') {
        const playerId = (otherUserId === 'coach' || isCoachTarget) ? curId : otherUserId;
        chatId = `coach_${playerId}`;
        chatType = 'coach';
        if (!isCoach) {
          title = `(Coach) ${coachName}`;
        }
      } else {
        const p1 = curId < otherUserId ? curId : otherUserId;
        const p2 = curId < otherUserId ? otherUserId : curId;
        chatId = `direct_${p1}_${p2}`;
      }

      try { localStorage.removeItem('chat_deleted_' + chatId); } catch (e) {}

      ChatUI.openConversationModal(chatId, {
        currentUserId: curId,
        currentUserName: curName,
        isCoach: isCoach,
        title: title,
        players: options.players || [],
        teams: options.teams || [],
        chatData: {
          id: chatId,
          type: chatType,
          name: title,
          participants: [curId, otherUserId]
        }
      });
    }
  };

  global.ChatUI = ChatUI;
})(typeof window !== 'undefined' ? window : this);

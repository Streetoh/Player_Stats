/* =========================================================
   Player stats (Player) • Official Player Portal & PWA
   Project: player-stats-2ac9d
   - English by default, fully bilingual (EN / ES)
   - Real-time sync with Coach App (Firebase Firestore)
   - 1-tap call-up voting & attendees status
   - Player profile with match rating, radar, skill explanations (English)
   - Matches & Trainings attended breakdown (no minutes)
   - Multi-team squad browser with full player profiles
   - Profile lock & Coach approval request workflow
   - Face to Face comparator
   ========================================================= */
(function () {
  'use strict';

  let currentTab = 'convocations';
  let clubData = null;
  let myPlayerId = localStorage.getItem('portal_player_id') || null;
  let liveVotes = {}; // { [convId]: { [pid]: response } }
  let currentLang = localStorage.getItem('lang') || 'en';
  let activeTeamFilter = 'all';
  let myPendingReqUnsub = null;
  let convFilterType = 'all'; // 'all' | 'match' | 'training'

  function formatDisplayDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);

      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const dayName = (currentLang === 'en' ? daysEn : daysEs)[dateObj.getDay()] || '';
      const dayPad = String(d).padStart(2, '0');
      const monthPad = String(m + 1).padStart(2, '0');
      return `${dayName}, ${dayPad}/${monthPad}/${y}`;
    }
    return isoStr;
  }

  window.__handleAppBack = function () {
    const lightbox = document.querySelector('.chat-photo-lightbox');
    if (lightbox) {
      lightbox.remove();
      return true;
    }
    const overlays = document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop');
    if (overlays.length > 0) {
      const topOverlay = overlays[overlays.length - 1];
      if (topOverlay.classList.contains('chat-dialog-overlay')) {
        const backBtn = topOverlay.querySelector('#chat-back-btn, #chat-close-btn');
        if (backBtn) {
          backBtn.click();
          return true;
        }
      }
      topOverlay.remove();
      return true;
    }
    if (currentTab !== 'convocations') {
      currentTab = 'convocations';
      const convTabBtn = document.querySelector('#tab-convocations, button[data-tab="convocations"]');
      if (convTabBtn) {
        document.querySelectorAll('.tabbar button, .tab-bar button').forEach(b => b.classList.remove('active'));
        convTabBtn.classList.add('active');
      }
      renderCurrentTab();
      return true;
    }
    return false;
  };

  const view = document.getElementById('portal-view');
  const toastRoot = document.getElementById('toast-root');

  /* -------------------------------------------------------------
     DICCIONARIO BILINGÜE COMPLETO (POR DEFECTO INGLÉS)
     ------------------------------------------------------------- */
  const DICT = {
    en: {
      appName: 'Player stats (Player)',
      convocations: 'Call-ups',
      myProfile: 'My Profile',
      squad: 'Squad',
      h2h: 'Face to Face',
      chat: 'Chat',
      live: 'Live',
      selectIdentity: 'Select who you are...',
      profileLocked: 'Profile Locked',
      changeProfile: 'Change ▾',
      reqChange: 'Request Change',
      allTeams: 'All Teams',
      searchTeammate: 'Search teammate by name or number...',
      callUpOfficial: 'Official Call-up',
      match: 'Match',
      training: 'Training',
      venue: 'Ground / Venue',
      address: 'Address',
      openInMaps: 'Open in Google Maps ↗',
      coachNote: "Coach's note",
      willYouAttend: 'Will you attend this session?',
      iWillAttend: '🟢 I will attend',
      iCannotAttend: '❌ Cannot attend',
      attendanceConfirmed: '🟢 Attendance confirmed',
      absenceReported: '❌ Absent reported',
      pendingResponse: '⏳ Pending your response',
      notCalledUp: 'ℹ️ You are not on this call-up list',
      confirmedBadge: 'Confirmed',
      absentBadge: 'Unavailable',
      pendingBadge: 'Pending',
      viewAttendees: '👥 See who is attending ▾',
      attendeesTitle: 'Call-up Attendance List',
      noAttendeesYet: 'Nobody has confirmed yet',
      noAbsentYet: 'No absences reported',
      allAnswered: 'All called players have responded',
      emptyConvs: 'No active call-ups',
      emptyConvsDesc: 'The coach has not published any call-ups for upcoming matches or trainings yet.',
      chooseIdentityTitle: 'Who are you in the team?',
      chooseIdentityDesc: 'Select your name to link your player profile to this device. Once chosen, it will be locked.',
      confirmIdentityBtn: 'Link My Profile',
      reqChangeTitle: 'Request Profile Change',
      reqChangeDesc: 'Your profile is currently locked to {name}. To prevent mistakes, selecting another player sends an authorization request to your coach:',
      selectNewPlayer: 'Select the correct player:',
      reasonPlaceholder: 'Reason (e.g. Selected by mistake, new phone...)',
      sendReqBtn: '🚀 Send Request to Coach',
      reqSentBanner: '⏳ Request sent to coach to switch to {name}. Awaiting approval...',
      reqApprovedToast: '✅ Your coach approved your profile change!',
      reqRejectedToast: '❌ Your coach rejected the profile change request.',
      performanceRating: 'Performance Rating',
      ratingDesc: 'Match Rating calculated from actual tactical contributions, ball actions and efficiency.',
      matchesAttended: 'Matches Attended',
      trainingsAttended: 'Trainings Attended',
      totalSessions: 'Total Sessions',
      goalsScored: 'Goals Scored',
      passAccuracy: 'Pass Accuracy',
      passesAccurate: 'accurate passes',
      shotAccuracy: 'Shot Accuracy',
      shotsOnTarget: 'on target',
      ballTouches: 'Ball Touches',
      dribblesWon: 'Successful Take-ons',
      duelsWon: 'Duels Won',
      recoveries: 'Ball Recoveries',
      recentMatchesTitle: 'Recent Matches & Actions Breakdown',
      noMatchesYet: 'No matches or sessions recorded yet.',
      noActionsYet: 'No individual actions recorded yet.',
      tapSkillHint: 'Tap any skill on the radar to see its full explanation in English ℹ️',
      footRight: 'Right-footed',
      footLeft: 'Left-footed',
      footBoth: 'Ambidextrous',
      h2hTitle: 'Face to Face Comparator',
      h2hDesc: 'Select two teammates to compare their skills and performance metrics head to head:',
      player1: 'Player 1',
      player2: 'Player 2',
      choosePlayer: 'Choose Player',
      fullProfile: 'Full Profile',
      close: 'Close',
      skillsRadar: 'Athletic Qualities Radar',
      cumulativeStats: 'Cumulative Stats',
      squadTitle: 'Player Squad',
      squadSubtitle: 'Browse teammates across all teams in the club and tap to inspect their full stats:',
      h2hNeedTwo: 'At least 2 players are needed in the squad to compare.',
      locked: 'Locked',
      reasonLabel: 'Reason / Notes:',
      chooseWhoYouAre: '-- Select who you really are --',
      reqSelectTargetErr: 'Please select the player you want to switch to',
      reqSentSuccess: 'Request sent to coach! It will update automatically once approved.',
      sending: 'Sending...',
      linkedSuccess: 'Profile linked successfully!',
      loadingPlayers: 'Loading players from the cloud...',
      passesLabel: 'PASSES',
      shotsLabel: 'SHOTS',
      goalsLabel: 'GOALS',
      dribblesLabel: 'DRIBBLES',
      recoveriesLabel: 'RECOV.',
      touchesLabel: 'TOUCHES',
      pitchGoalsTitle: 'Tactical Goal Map',
      pitchGoalsDesc: 'Goals scored by field zone',
      untrackedGoalsHint: 'goals recorded without specific field zone assigned',
      chatWithPlayer: '💬 Chat with this teammate',
      zone_box_opp: 'Opponent Box',
      zone_front: 'Front of Box',
      zone_wing_off_l: 'Attacking Left Wing',
      zone_wing_off_r: 'Attacking Right Wing',
      zone_wing_l: 'Left Wing',
      zone_wing_r: 'Right Wing',
      zone_mid: 'Midfield',
      filterAll: 'All',
      filterMatches: '🏆 Matches',
      filterTrainings: '⚽ Trainings',
      requestCoachProfile: '➕ Not on the list? Request registration from coach',
      requestCoachProfileTitle: 'Request Registration from Coach',
      requestCoachProfileDesc: 'Send your details to the coach so they can create your profile in the team database.',
      fullNameLabel: 'Full Name *',
      fullNamePlaceholder: 'e.g. Lucas Martinez',
      dorsalLabel: 'Jersey Number',
      dorsalPlaceholder: 'e.g. 10',
      positionLabel: 'Position',
      positionPlaceholder: 'e.g. Striker, Goalkeeper...',
      notesLabel: 'Notes / Team',
      notesPlaceholder: 'e.g. U14 Team, new signing...',
      sendRequest: 'Send Request to Coach',
      nameRequired: 'Please enter your full name',
      requestSent: 'Request sent to coach!',
      coachCardTitle: 'Head Coach Profile',
      viewCoachProfile: 'View Coach Profile',
      coachProfileSubtitle: 'Technical Director & Coaching Staff',
      chatWithCoach: '💬 Chat with Coach',
      confirmPlayerIdentity: 'Confirm Identity',
      areYouPlayer: 'Are you {name}?',
      securityCodeDesc: 'To protect your player profile, this security code has been generated. Give this code to your coach so they can verify and authorize access on your device.',
      securityCodeTitle: 'Security Code',
      waitingCoachApproval: 'Waiting for your coach to authorize the code...',
      copyCode: '📋 Copy Code',
      codeCopied: '✅ Code copied to clipboard!',
      sendViaViber: '📱 Send via Viber',
      cancelSelectOther: '✕ Cancel and select another player',
      viberShareMsg: 'Hi Coach, my verification security code is {code} to access my profile ({name}) on Player Stats app.',
      player: 'Player',
      allPlayers: 'All Players',
      creationApproved: '🎉 Your coach approved and created your profile! You can now view your stats.',
      creationRejected: '❌ Your coach declined the registration request.',
      profileChangeSecurityTitle: 'Confirm Profile Change',
      profileChangeSecurityDesc: 'To protect your player account, this security code has been generated. Give this code to your coach so they can authorize switching your profile to {name}.',
      viberProfileChangeMsg: 'Hi Coach, my verification code is {code} to change my profile to {name} on Player Stats app.',
      birthDate: 'Date of Birth',
      age: 'Age',
      secondaryPositions: 'Secondary Positions',
      guardian: 'Parent / Guardian',
      callCoach: 'Call Coach',
      call: 'Call',
      voteReset: 'Attendance vote cancelled (pending)',
      viberCoachContactMsg: 'Hi Coach!',
      messageViaViber: 'Message via Viber',
      contact: 'Contact',
      msgDeletedForEveryone: 'This message was deleted',
      messageOptions: 'Message Options',
      copyMessage: 'Copy message',
      editMessage: 'Edit message',
      deleteForEveryone: 'Delete for everyone',
      deleteForMe: 'Delete for me',
      deleteForEveryoneConfirm: 'Are you sure you want to delete this message for everyone?',
      messageDeleted: 'Message deleted for everyone',
      messageDeletedForMe: 'Message removed for you',
      messageEdited: 'Message updated',
      copiedToClipboard: 'Message copied to clipboard'
    },
    es: {
      appName: 'Player stats (Player)',
      convocations: 'Convocatorias',
      myProfile: 'Mi Ficha',
      squad: 'Plantilla',
      h2h: 'Face to Face',
      chat: 'Chat',
      live: 'En vivo',
      selectIdentity: 'Seleccionar quién eres...',
      profileLocked: 'Perfil Bloqueado',
      changeProfile: 'Cambiar ▾',
      reqChange: 'Solicitar Cambio',
      allTeams: 'Todos los equipos',
      searchTeammate: 'Buscar compañero por nombre o dorsal...',
      callUpOfficial: 'Convocatoria Oficial',
      match: 'Partido',
      training: 'Entrenamiento',
      venue: 'Lugar / Campo',
      address: 'Dirección',
      openInMaps: 'Abrir en Google Maps ↗',
      coachNote: 'Nota del míster',
      willYouAttend: '¿Asistirás a esta cita?',
      iWillAttend: '🟢 Asistiré',
      iCannotAttend: '❌ No puedo asistir',
      attendanceConfirmed: '🟢 Asistencia confirmada',
      absenceReported: '❌ Baja notificada',
      pendingResponse: '⏳ Pendiente de responder',
      notCalledUp: 'ℹ️ No estás convocado para esta cita',
      confirmedBadge: 'Confirmados',
      absentBadge: 'Bajas',
      pendingBadge: 'Pendientes',
      viewAttendees: '👥 Ver lista de asistencia ▾',
      attendeesTitle: 'Lista de Asistencia',
      noAttendeesYet: 'Nadie ha confirmado todavía',
      noAbsentYet: 'Ninguna baja registrada',
      allAnswered: 'Todos los convocados han respondido',
      emptyConvs: 'Sin convocatorias activas',
      emptyConvsDesc: 'El entrenador aún no ha publicado ninguna convocatoria para los próximos partidos o entrenamientos.',
      chooseIdentityTitle: '¿Quién eres en el equipo?',
      chooseIdentityDesc: 'Selecciona tu nombre para vincular tu ficha a este dispositivo. Una vez elegido, quedará fijado.',
      confirmIdentityBtn: 'Vincular mi perfil',
      reqChangeTitle: 'Solicitar Cambio de Perfil',
      reqChangeDesc: 'Tu perfil está vinculado a {name}. Para evitar confusiones, cambiar a otro jugador requiere autorización del entrenador:',
      selectNewPlayer: 'Selecciona el jugador correcto:',
      reasonPlaceholder: 'Motivo (ej. Selección errónea, móvil nuevo...)',
      sendReqBtn: '🚀 Enviar Solicitud al Entrenador',
      reqSentBanner: '⏳ Solicitud enviada al entrenador para cambiar a {name}. Esperando aprobación...',
      reqApprovedToast: '✅ ¡Tu entrenador ha aprobado el cambio de perfil!',
      reqRejectedToast: '❌ El entrenador ha rechazado la solicitud de cambio.',
      performanceRating: 'Nota de Rendimiento',
      ratingDesc: 'Índice de rendimiento calculado a partir de acciones reales, toques y eficacia táctica.',
      matchesAttended: 'Partidos Jugados',
      trainingsAttended: 'Entrenamientos Asistidos',
      totalSessions: 'Sesiones Totales',
      goalsScored: 'Goles Marcados',
      passAccuracy: 'Precisión de Pase',
      passesAccurate: 'pases acertados',
      shotAccuracy: 'Efectividad Tiro',
      shotsOnTarget: 'a puerta',
      ballTouches: 'Toques Balón',
      dribblesWon: 'Regates con Éxito',
      duelsWon: 'Duelos Ganados',
      recoveries: 'Recuperaciones',
      recentMatchesTitle: 'Mis Partidos y Acciones Detalladas',
      noMatchesYet: 'Todavía no hay partidos o sesiones registradas.',
      noActionsYet: 'Aún no tienes acciones registradas en partidos.',
      tapSkillHint: 'Pulsa sobre cualquier habilidad del radar para ver su explicación en inglés ℹ️',
      footRight: 'Diestro',
      footLeft: 'Zurdo',
      footBoth: 'Ambidiestro',
      h2hTitle: 'Comparador Face to Face',
      h2hDesc: 'Selecciona a dos compañeros para comparar sus estadísticas y radares frente a frente:',
      player1: 'Jugador 1',
      player2: 'Jugador 2',
      choosePlayer: 'Elegir Jugador',
      fullProfile: 'Ficha Completa',
      close: 'Cerrar',
      skillsRadar: 'Radar de Cualidades Deportivas',
      cumulativeStats: 'Mis Cifras Acumuladas',
      squadTitle: 'Plantilla de Jugadores',
      squadSubtitle: 'Explora la plantilla de todos los equipos del club y toca para ver sus estadísticas completas:',
      h2hNeedTwo: 'Se necesitan al menos 2 jugadores en la plantilla para comparar.',
      locked: 'Bloqueado',
      reasonLabel: 'Motivo / Comentario:',
      chooseWhoYouAre: '-- Elige quién eres realmente --',
      reqSelectTargetErr: 'Por favor selecciona el jugador al que deseas cambiarte',
      reqSentSuccess: '¡Solicitud enviada al entrenador! Se actualizará automáticamente en cuanto la apruebe.',
      sending: 'Enviando...',
      linkedSuccess: '¡Perfil vinculado con éxito!',
      loadingPlayers: 'Cargando jugadores desde la nube...',
      passesLabel: 'PASES',
      shotsLabel: 'TIROS',
      goalsLabel: 'GOLES',
      dribblesLabel: 'REGATES',
      recoveriesLabel: 'RECUP.',
      touchesLabel: 'TOQUES',
      pitchGoalsTitle: 'Mapa Táctico de Goles',
      pitchGoalsDesc: 'Goles anotados según la zona del campo',
      untrackedGoalsHint: 'goles contabilizados en partidos anteriores sin zona asignada',
      chatWithPlayer: '💬 Chatear con este jugador',
      zone_box_opp: 'Área Rival',
      zone_front: 'Frontal',
      zone_wing_off_l: 'Banda Of. Izq',
      zone_wing_off_r: 'Banda Of. Der',
      zone_wing_l: 'Banda Izquierda',
      zone_wing_r: 'Banda Derecha',
      zone_mid: 'Centro Campo',
      filterAll: 'Todos',
      filterMatches: '🏆 Partidos',
      filterTrainings: '⚽ Entrenamientos',
      requestCoachProfile: '➕ ¿No estás en la lista? Solicitar alta al entrenador',
      requestCoachProfileTitle: 'Solicitar Alta al Entrenador',
      requestCoachProfileDesc: 'Envía tus datos al entrenador para que cree tu ficha en el equipo y puedas seleccionarte.',
      fullNameLabel: 'Nombre y Apellidos *',
      fullNamePlaceholder: 'Ej: Lucas Martínez',
      dorsalLabel: 'Dorsal habitual',
      dorsalPlaceholder: 'Ej: 10',
      positionLabel: 'Posición',
      positionPlaceholder: 'Ej: Delantero, Portero...',
      notesLabel: 'Notas / Equipo',
      notesPlaceholder: 'Ej: Infantil A, nuevo fichaje...',
      sendRequest: 'Enviar Solicitud al Entrenador',
      nameRequired: 'Por favor introduce tu nombre y apellidos',
      requestSent: '¡Solicitud enviada al entrenador!',
      coachCardTitle: 'Ficha del Entrenador',
      viewCoachProfile: 'Ver Perfil del Entrenador',
      coachProfileSubtitle: 'Cuerpo Técnico y Dirección',
      chatWithCoach: '💬 Chatear con el Entrenador',
      confirmPlayerIdentity: 'Confirmar Identidad',
      areYouPlayer: '¿Eres {name}?',
      securityCodeDesc: 'Para proteger tu perfil, se ha generado este código de seguridad. Dáselo a tu entrenador para que confirme y autorice tu acceso en tu dispositivo.',
      securityCodeTitle: 'Código de Seguridad',
      waitingCoachApproval: 'Esperando que tu entrenador autorice el código...',
      copyCode: '📋 Copiar Código',
      codeCopied: '✅ ¡Código copiado al portapapeles!',
      sendViaViber: '📱 Enviar por Viber',
      cancelSelectOther: '✕ Cancelar y elegir otro jugador',
      viberShareMsg: 'Hola míster, mi código de seguridad es {code} para acceder a mi perfil ({name}) en la app Player Stats.',
      player: 'Jugador',
      allPlayers: 'Todos los jugadores',
      creationApproved: '🎉 ¡El entrenador ha creado tu perfil! Ya puedes ver tus estadísticas.',
      creationRejected: '❌ El entrenador ha denegado la solicitud de alta.',
      profileChangeSecurityTitle: 'Confirmar Cambio de Perfil',
      profileChangeSecurityDesc: 'Para proteger tu cuenta, se ha generado este código de seguridad. Facilita este código a tu entrenador para que autorice el cambio de perfil a {name}.',
      viberProfileChangeMsg: 'Hola míster, mi código de verificación es {code} para cambiar mi perfil a {name} en la app Player Stats.',
      birthDate: 'Fecha de Nacimiento',
      age: 'Edad',
      secondaryPositions: 'Posiciones Secundarias',
      guardian: 'Padre / Tutor',
      callCoach: 'Llamar al Entrenador',
      call: 'Llamar',
      voteReset: 'Respuesta cancelada (pendiente)',
      viberCoachContactMsg: '¡Hola míster!',
      messageViaViber: 'Mensaje por Viber',
      contact: 'Contacto',
      msgDeletedForEveryone: 'Este mensaje fue eliminado',
      messageOptions: 'Opciones del mensaje',
      copyMessage: 'Copiar mensaje',
      editMessage: 'Editar mensaje',
      deleteForEveryone: 'Borrar para todos',
      deleteForMe: 'Borrar para mí',
      deleteForEveryoneConfirm: '¿Eliminar este mensaje para todos?',
      messageDeleted: 'Mensaje eliminado para todos',
      messageDeletedForMe: 'Mensaje eliminado para ti',
      messageEdited: 'Mensaje actualizado',
      copiedToClipboard: 'Mensaje copiado al portapapeles'
    }
  };

  /* -------------------------------------------------------------
     EXPLICACIONES DE CUALIDADES EN INGLÉS (PUNTO 7 OBLIGATORIO)
     ------------------------------------------------------------- */
  const SKILL_EXPLANATIONS_EN = {
    pas: {
      name: 'Passing (PAS)',
      icon: '🎯',
      desc: 'Evaluates distribution vision, ground and aerial passing accuracy, progressive passes into the final third, and execution speed under opposition pressure.'
    },
    tir: {
      name: 'Shooting (SHT / TIR)',
      icon: '⚽',
      desc: 'Measures finishing composure inside the box, shot power, shots-on-target percentage, distance shooting accuracy, and clinical goal conversion rate.'
    },
    reg: {
      name: 'Dribbling (DRI / REG)',
      icon: '⚡',
      desc: 'Reflects 1v1 take-on success rate, close ball control in tight spaces, change of direction, technical agility, and ability to eliminate defenders.'
    },
    fis: {
      name: 'Physical (PHY / FIS)',
      icon: '💪',
      desc: 'Reflects match stamina, high-intensity running work rate, aerial duel competitiveness, physical resistance in tackles, and active involvement across all periods.'
    },
    def: {
      name: 'Defending (DEF)',
      icon: '🛡️',
      desc: 'Evaluates defensive positioning, clean ball recoveries, defensive ground duels won, interceptions, and defensive pressing contribution.'
    },
    dis: {
      name: 'Discipline (DIS)',
      icon: '🏅',
      desc: 'Measures sportsmanship, fair play conduct, respect for referees and teammates, tactical adherence to the coach instructions, and maintaining a low foul/card count.'
    },
    rating: {
      name: 'Match Rating (⭐ 1.0 - 10.0)',
      icon: '⭐',
      desc: 'Overall performance index calculated with an advanced position-weighted algorithm that balances passing accuracy, goal involvement, defensive recoveries, duels won, and active ball volume.'
    }
  };

  function t(key, fallback) {
    const dict = DICT[currentLang] || DICT.en;
    if (dict[key] !== undefined) return dict[key];
    if (DICT.en[key] !== undefined) return DICT.en[key];
    return fallback || key;
  }

  const POSITION_MAP = {
    // Standard tactical codes
    'POR': { en: 'Goalkeeper (GK)', es: 'Portero (POR)' },
    'GK': { en: 'Goalkeeper (GK)', es: 'Portero (POR)' },
    'DFC': { en: 'Centre Back (CB)', es: 'Defensa Central (DFC)' },
    'CB': { en: 'Centre Back (CB)', es: 'Defensa Central (DFC)' },
    'LI': { en: 'Left Back (LB)', es: 'Lateral Izquierdo (LI)' },
    'LB': { en: 'Left Back (LB)', es: 'Lateral Izquierdo (LI)' },
    'LD': { en: 'Right Back (RB)', es: 'Lateral Derecho (LD)' },
    'RB': { en: 'Right Back (RB)', es: 'Lateral Derecho (LD)' },
    'MCD': { en: 'Defensive Midfield (CDM)', es: 'Mediocentro Defensivo (MCD)' },
    'CDM': { en: 'Defensive Midfield (CDM)', es: 'Mediocentro Defensivo (MCD)' },
    'MC': { en: 'Central Midfield (CM)', es: 'Mediocentro (MC)' },
    'CM': { en: 'Central Midfield (CM)', es: 'Mediocentro (MC)' },
    'MCO': { en: 'Attacking Midfield (CAM)', es: 'Mediapunta (MCO)' },
    'CAM': { en: 'Attacking Midfield (CAM)', es: 'Mediapunta (MCO)' },
    'EI': { en: 'Left Winger (LW)', es: 'Extremo Izquierdo (EI)' },
    'LW': { en: 'Left Winger (LW)', es: 'Extremo Izquierdo (EI)' },
    'ED': { en: 'Right Winger (RW)', es: 'Extremo Derecho (ED)' },
    'RW': { en: 'Right Winger (RW)', es: 'Extremo Derecho (ED)' },
    'DC': { en: 'Striker (ST)', es: 'Delantero Centro (DC)' },
    'ST': { en: 'Striker (ST)', es: 'Delantero Centro (DC)' },
    // Full names and keywords
    'portero': { en: 'Goalkeeper', es: 'Portero' },
    'goalkeeper': { en: 'Goalkeeper', es: 'Portero' },
    'defensa central': { en: 'Centre Back', es: 'Defensa Central' },
    'centre back': { en: 'Centre Back', es: 'Defensa Central' },
    'defensa': { en: 'Defender', es: 'Defensa' },
    'defender': { en: 'Defender', es: 'Defensa' },
    'lateral izquierdo': { en: 'Left Back', es: 'Lateral Izquierdo' },
    'left back': { en: 'Left Back', es: 'Lateral Izquierdo' },
    'lateral derecho': { en: 'Right Back', es: 'Lateral Derecho' },
    'right back': { en: 'Right Back', es: 'Lateral Derecho' },
    'lateral': { en: 'Full Back', es: 'Lateral' },
    'full back': { en: 'Full Back', es: 'Lateral' },
    'carrilero': { en: 'Wing Back', es: 'Carrilero' },
    'wing back': { en: 'Wing Back', es: 'Carrilero' },
    'mediocentro defensivo': { en: 'Defensive Midfielder', es: 'Mediocentro Defensivo' },
    'defensive midfielder': { en: 'Defensive Midfielder', es: 'Mediocentro Defensivo' },
    'pivote': { en: 'Defensive Midfielder', es: 'Pivote' },
    'mediocentro': { en: 'Central Midfielder', es: 'Mediocentro' },
    'central midfielder': { en: 'Central Midfielder', es: 'Mediocentro' },
    'centrocampista': { en: 'Midfielder', es: 'Centrocampista' },
    'midfielder': { en: 'Midfielder', es: 'Centrocampista' },
    'mediapunta': { en: 'Attacking Midfielder', es: 'Mediapunta' },
    'attacking midfielder': { en: 'Attacking Midfielder', es: 'Mediapunta' },
    'extremo izquierdo': { en: 'Left Winger', es: 'Extremo Izquierdo' },
    'left winger': { en: 'Left Winger', es: 'Extremo Izquierdo' },
    'extremo derecho': { en: 'Right Winger', es: 'Extremo Derecho' },
    'right winger': { en: 'Right Winger', es: 'Extremo Derecho' },
    'extremo': { en: 'Winger', es: 'Extremo' },
    'winger': { en: 'Winger', es: 'Extremo' },
    'delantero centro': { en: 'Striker', es: 'Delantero Centro' },
    'delantero': { en: 'Forward / Striker', es: 'Delantero' },
    'striker': { en: 'Striker', es: 'Delantero Centro' },
    'forward': { en: 'Forward', es: 'Delantero' },
    'jugador': { en: 'Player', es: 'Jugador' },
    'player': { en: 'Player', es: 'Jugador' }
  };

  function formatPosition(pos) {
    if (!pos) return currentLang === 'en' ? 'Player' : 'Jugador';
    const clean = String(pos).trim();
    const upper = clean.toUpperCase();
    if (POSITION_MAP[upper]) {
      return currentLang === 'en' ? POSITION_MAP[upper].en : POSITION_MAP[upper].es;
    }
    const lower = clean.toLowerCase();
    if (POSITION_MAP[lower]) {
      return currentLang === 'en' ? POSITION_MAP[lower].en : POSITION_MAP[lower].es;
    }
    if (clean.includes('/')) {
      const parts = clean.split('/').map(s => s.trim());
      if (currentLang === 'en' && parts[1]) {
        return formatPosition(parts[1]);
      }
      if (currentLang === 'es' && parts[0]) {
        return formatPosition(parts[0]);
      }
    }
    return clean;
  }

  function formatPositionsList(list) {
    if (!list) return '';
    if (Array.isArray(list)) {
      return list.map(p => formatPosition(p)).join(', ');
    }
    return formatPosition(list);
  }

  function toast(msg, type = 'info', onClick) {
    if (!toastRoot) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    if (onClick) {
      el.style.cursor = 'pointer';
      el.innerHTML = `<span style="flex:1;">${msg}</span><span style="font-size:14px; margin-left:8px; opacity:0.85; font-weight:900;">➔</span>`;
      el.onclick = () => {
        try { onClick(); } catch(e) {}
        el.remove();
      };
    } else {
      el.innerHTML = msg;
    }
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 250);
    }, 2800);
  }

  function haptic(ms = 25) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
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

  function getDeviceId() {
    let devId = localStorage.getItem('portal_device_id');
    if (!devId) {
      devId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem('portal_device_id', devId); } catch (e) {}
    }
    return devId;
  }

  function isProfileLocked() {
    return localStorage.getItem('portal_player_locked') === 'true' && Boolean(myPlayerId);
  }

  function renderAvatar(player, sizeClass = '') {
    const cls = sizeClass ? `avatar ${sizeClass}` : 'avatar';
    if (!player) return `<div class="${cls}"><span>?</span></div>`;
    const initial = (player.name ? player.name[0] : (player.nickname ? player.nickname[0] : 'P')).toUpperCase();
    const dorsalHtml = player.mainDorsal != null ? `<span class="dorsal">${player.mainDorsal}</span>` : '';
    if (player.photo) {
      return `<div class="${cls}"><img src="${player.photo}" alt="" loading="lazy" />${dorsalHtml}</div>`;
    }
    return `<div class="${cls}"><span>${initial}</span>${dorsalHtml}</div>`;
  }

  function getMyPlayer() {
    if (myPlayerId) {
      const p = (clubData && clubData.players) ? clubData.players.find(x => x.id === myPlayerId) : null;
      if (p) return p;
      const pendingCreationId = localStorage.getItem('portal_pending_creation_id');
      if (myPlayerId === pendingCreationId) {
        return {
          id: pendingCreationId,
          name: localStorage.getItem('portal_pending_creation_name') || 'Jugador',
          lastName: '',
          mainDorsal: parseInt(localStorage.getItem('portal_pending_creation_dorsal') || '0', 10) || null,
          mainPosition: localStorage.getItem('portal_pending_creation_pos') || 'Delantero',
          teamId: '',
          isPendingApproval: true
        };
      }
    }
    return null;
  }

  function getPlayerFootLabel(footVal) {
    if (!footVal) return t('footRight');
    const f = String(footVal).toLowerCase();
    if (f.includes('zurdo') || f.includes('left')) return t('footLeft');
    if (f.includes('ambi') || f.includes('both')) return t('footBoth');
    return t('footRight');
  }

  /* -------------------------------------------------------------
     ALGORITMO OFICIAL DE NOTA DE RENDIMIENTO (MATCH RATING 1.0 - 10.0)
     ------------------------------------------------------------- */
  function calculateMatchRating(stats, position) {
    if (!stats || Object.keys(stats).length === 0) return 6.0;
    const p = (position || 'Jugador').toUpperCase();

    const goal = stats.goal || 0;
    const assist = stats.assist || 0;
    const shotOn = stats.shotOn || 0;
    const shotOff = stats.shotOff || 0;
    const passOk = stats.passOk || 0;
    const passKo = stats.passKo || 0;
    const keyPass = stats.keyPass || 0;
    const dribbleOk = stats.dribbleOk || 0;
    const dribbleKo = stats.dribbleKo || 0;
    const recovery = stats.recovery || 0;
    const loss = stats.loss || 0;
    const duelWon = stats.duelWon || 0;
    const duelLost = stats.duelLost || 0;
    const save = stats.save || 0;
    const foul = stats.foul || 0;
    const yellow = stats.yellow || 0;
    const red = stats.red || 0;
    const touches = stats.touches || 0;

    const totalActions = goal + assist + shotOn + shotOff + passOk + passKo + keyPass +
      dribbleOk + dribbleKo + recovery + loss + duelWon + duelLost + save + foul + yellow + red;

    let scoreDelta = 0;
    const passes = passOk + passKo;
    if (passes > 0) {
      const passAcc = passOk / passes;
      const netPass = (passOk * 0.08) - (passKo * 0.12);
      const volumeFactor = Math.min(1.0, Math.log10(passes + 1) * 0.7);
      scoreDelta += netPass + (passAcc - 0.65) * volumeFactor;
    }

    scoreDelta += goal * 1.25;
    scoreDelta += assist * 0.85;
    scoreDelta += shotOn * 0.35;
    scoreDelta += shotOff * 0.05;
    scoreDelta += keyPass * 0.45;
    scoreDelta += dribbleOk * 0.30;
    scoreDelta -= dribbleKo * 0.18;
    scoreDelta += recovery * 0.38;
    scoreDelta -= loss * 0.22;
    scoreDelta += duelWon * 0.28;
    scoreDelta -= duelLost * 0.18;
    scoreDelta += save * 0.65;
    scoreDelta -= foul * 0.15;
    scoreDelta -= yellow * 0.80;
    scoreDelta -= red * 2.50;
    scoreDelta += Math.min(0.7, touches * 0.02);

    if (p.includes('POR') || p.includes('GK')) {
      scoreDelta += save * 0.5;
    } else if (p.includes('DC') || p.includes('DEL') || p.includes('ST') || p.includes('CF') || p.includes('EXT') || p.includes('RW') || p.includes('LW')) {
      scoreDelta += goal * 0.3 + shotOn * 0.2;
    } else if (p.includes('DFC') || p.includes('CB') || p.includes('DEF') || p.includes('RB') || p.includes('LB') || p.includes('MCD') || p.includes('DM')) {
      scoreDelta += recovery * 0.3 + duelWon * 0.2;
    }

    const confidence = Math.min(1.0, (totalActions + touches * 0.5) / 5.0);
    const finalScore = 6.0 + (scoreDelta * confidence);
    return Math.min(10.0, Math.max(1.0, Math.round(finalScore * 10) / 10));
  }

  /* -------------------------------------------------------------
     CÁLCULO DE MÉTRICAS DEL JUGADOR (SIN MINUTOS, CON ASISTENCIAS SEPARADAS)
     ------------------------------------------------------------- */
  function calculatePlayerStats(pid) {
    const res = {
      matchesAttended: 0,
      trainingsAttended: 0,
      totalSessions: 0,
      goals: 0,
      shotsOn: 0,
      shotsOff: 0,
      passOk: 0,
      passKo: 0,
      touches: 0,
      dribbleOk: 0,
      duelWon: 0,
      recoveries: 0,
      aggregatedRating: 6.0,
      ratingsSum: 0,
      ratingsCount: 0
    };

    if (!clubData) return res;

    const p = clubData.players ? clubData.players.find(x => x.id === pid) : null;
    const pos = p ? p.mainPosition : 'Jugador';

    if (clubData.sessions) {
      clubData.sessions.forEach(s => {
        const pStats = s.stats && s.stats[pid];
        const hasActions = pStats && Object.values(pStats).some(v => v > 0);
        const wasPresent = hasActions || (s.list && s.list[pid] === 'called');

        if (wasPresent) {
          if (s.type === 'match') res.matchesAttended++;
          else res.trainingsAttended++;
        }

        if (hasActions) {
          res.goals += pStats.goal || 0;
          res.shotsOn += pStats.shotOn || 0;
          res.shotsOff += pStats.shotOff || 0;
          res.passOk += pStats.passOk || 0;
          res.passKo += pStats.passKo || 0;
          res.touches += pStats.touches || 0;
          res.dribbleOk += pStats.dribbleOk || 0;
          res.duelWon += pStats.duelWon || 0;
          res.recoveries += pStats.recovery || 0;

          const matchRat = calculateMatchRating(pStats, pos);
          res.ratingsSum += matchRat;
          res.ratingsCount++;
        }
      });
    }

    res.totalSessions = res.matchesAttended + res.trainingsAttended;
    const totalPass = res.passOk + res.passKo;
    res.passAcc = totalPass > 0 ? Math.round((res.passOk / totalPass) * 100) : 0;
    const totalShots = res.shotsOn + res.shotsOff;
    res.shotAcc = totalShots > 0 ? Math.round((res.shotsOn / totalShots) * 100) : 0;

    res.aggregatedRating = res.ratingsCount > 0
      ? (Math.round((res.ratingsSum / res.ratingsCount) * 10) / 10).toFixed(1)
      : '6.0';

    return res;
  }

  function calculatePlayerRadar(pid) {
    const s = calculatePlayerStats(pid);
    const totalActions = (s.passOk || 0) + (s.passKo || 0) + (s.shotsOn || 0) + (s.goals || 0) + (s.dribbleOk || 0) + (s.recoveries || 0) + (s.touches || 0);

    // Sin sesiones ni acciones trackeadas: empezar todas las habilidades en 50
    if (s.totalSessions === 0 && totalActions === 0) {
      return { pas: 50, tir: 50, reg: 50, fis: 50, def: 50, dis: 50 };
    }

    const passScore = s.passAcc > 0 ? Math.min(99, Math.max(20, Math.round(50 + (s.passAcc - 50) * 0.7))) : 50;
    const shotScore = s.goals > 0 ? Math.min(99, Math.max(20, Math.round(50 + s.goals * 5 + (s.shotAcc - 50) * 0.3))) : (s.shotsOn > 0 ? 52 : 50);
    const regScore = s.dribbleOk > 0 ? Math.min(99, Math.max(20, Math.round(50 + s.dribbleOk * 5))) : 50;
    const defScore = s.recoveries > 0 ? Math.min(99, Math.max(20, Math.round(50 + s.recoveries * 4))) : 50;
    const fisScore = s.totalSessions > 0 ? Math.min(99, Math.max(20, Math.round(50 + s.totalSessions * 3 + (s.touches > 20 ? 8 : 0)))) : 50;

    return {
      pas: passScore,
      tir: shotScore,
      reg: regScore,
      fis: fisScore,
      def: defScore,
      dis: 50
    };
  }

  /* -------------------------------------------------------------
     RADAR SVG INTERACTIVO (CLIC = EXPLICACIÓN EN INGLÉS)
     ------------------------------------------------------------- */
  function renderRadarSVG(rd) {
    const axes = [
      { key: 'pas', label: 'PASS', val: rd.pas },
      { key: 'tir', label: 'SHOT', val: rd.tir },
      { key: 'reg', label: 'DRIB', val: rd.reg },
      { key: 'fis', label: 'PHYS', val: rd.fis },
      { key: 'def', label: 'DEF', val: rd.def }
    ];

    const cx = 130, cy = 130, rMax = 88;
    const totalAxes = 5;

    function getCoords(index, value) {
      const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
      const normalized = Math.max(10, Math.min(99, value)) / 100;
      const r = rMax * normalized;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }

    const levels = [0.25, 0.50, 0.75, 1.0];
    const gridPolygons = levels.map(lvl => {
      const pts = [];
      for (let i = 0; i < totalAxes; i++) {
        const a = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
        const r = rMax * lvl;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>`;
    }).join('');

    const dataPoints = axes.map((a, i) => ({ ...getCoords(i, a.val), a }));
    const dataPolyPoints = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const labels = axes.map((a, i) => {
      const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
      const labelR = rMax + 24;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      return `
        <g class="radar-click-label" data-skill="${a.key}" style="cursor: pointer;">
          <circle cx="${lx.toFixed(1)}" cy="${(ly + 5).toFixed(1)}" r="18" fill="rgba(34, 211, 238, 0.08)" />
          <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#e2e8f0" font-size="10.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.label}
          </text>
          <text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" fill="#22d3ee" font-size="11.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.val}
          </text>
        </g>
      `;
    }).join('');

    return `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 6px 0;">
        <svg class="radar-svg" viewBox="0 0 260 260" style="width: 100%; max-width: 270px; height: auto;">
          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#22c55e" stop-opacity="0.12" />
            </radialGradient>
          </defs>
          ${gridPolygons}
          <polygon points="${dataPolyPoints}" fill="url(#radarFill)" stroke="#22d3ee" stroke-width="2.5" />
          ${dataPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#22c55e" stroke="#060a13" stroke-width="1.8" />`).join('')}
          ${labels}
        </svg>
        <span style="font-size: 11px; color: var(--muted); margin-top: 6px; text-align: center;">
          ${t('tapSkillHint')}
        </span>
      </div>
    `;
  }

  /* -------------------------------------------------------------
     POPUP MODAL: EXPLICACIÓN DE HABILIDADES EN INGLÉS (PUNTO 7)
     ------------------------------------------------------------- */
  function showSkillExplanationModal(skillKey) {
    const info = SKILL_EXPLANATIONS_EN[skillKey] || SKILL_EXPLANATIONS_EN.rating;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-width: 400px; padding: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">${info.icon}</span>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">${info.name}</h3>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-skill-x" style="width: 32px; height: 32px;">✕</button>
        </div>
        <p style="font-size: 13.5px; line-height: 1.6; color: #e2e8f0; margin-bottom: 16px;">
          ${info.desc}
        </p>
        <button type="button" class="btn block primary" id="dlg-skill-ok" style="font-weight: 800; font-size: 13px;">
          Got it
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-skill-x').onclick = close;
    overlay.querySelector('#dlg-skill-ok').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
    haptic(20);
  }

  /* -------------------------------------------------------------
     ACTUALIZAR CABECERA E IDENTIDAD (BLOQUEO DE PERFIL)
     ------------------------------------------------------------- */
  function updateHeaderIdentity() {
    const nameEl = document.getElementById('portal-my-name');
    const avatarEl = document.getElementById('portal-my-avatar');
    const lockIndicatorEl = document.getElementById('portal-lbl-change');
    const lblProfile = document.getElementById('portal-lbl-profile');
    if (lblProfile) lblProfile.textContent = t('myProfile') + ':';

    const myP = getMyPlayer();

    if (myP) {
      if (myP.isPendingApproval) {
        if (nameEl) nameEl.textContent = `⏳ #${myP.mainDorsal != null ? myP.mainDorsal : '-'} ${myP.name || ''} (${t('pendingApproval', 'Pendiente')})`;
      } else {
        if (nameEl) nameEl.textContent = `#${myP.mainDorsal != null ? myP.mainDorsal : '-'} ${myP.name || ''} ${myP.lastName || ''}`.trim();
      }
      if (avatarEl) {
        avatarEl.innerHTML = myP.photo ? `<img src="${myP.photo}" alt="" />` : `<span>${(myP.name ? myP.name[0] : 'P').toUpperCase()}</span>`;
      }
      if (lockIndicatorEl) {
        const locked = isProfileLocked();
        lockIndicatorEl.innerHTML = locked ? `🔒 ${t('locked', 'Locked')}` : `${t('changeProfile', 'Change ▾')}`;
        lockIndicatorEl.style.color = locked ? '#facc15' : 'var(--cyan)';
        lockIndicatorEl.style.background = locked ? 'rgba(250, 204, 21, 0.15)' : 'rgba(6, 182, 212, 0.15)';
        lockIndicatorEl.style.border = locked ? '1px solid rgba(250, 204, 21, 0.35)' : '1px solid rgba(6, 182, 212, 0.3)';
      }
      if (window.ChatUI && ChatUI.initPresenceHeartbeat) {
        ChatUI.initPresenceHeartbeat(myPlayerId, `${myP.name || ''} ${myP.lastName || ''}`.trim());
      }
      if (window.ChatUI && ChatUI.initGlobalUnreadListener) {
        ChatUI.initGlobalUnreadListener(myPlayerId, myP.teamId || null);
      }
    } else {
      if (nameEl) nameEl.textContent = t('selectIdentity');
      if (avatarEl) avatarEl.innerHTML = '<span>?</span>';
      if (lockIndicatorEl) {
        lockIndicatorEl.textContent = `${t('changeProfile', 'Change ▾')}`;
        lockIndicatorEl.style.color = 'var(--cyan)';
        lockIndicatorEl.style.background = 'rgba(6, 182, 212, 0.15)';
        lockIndicatorEl.style.border = '1px solid rgba(6, 182, 212, 0.3)';
      }
    }

    const btnLang = document.getElementById('btn-portal-lang');
    if (btnLang) btnLang.textContent = currentLang.toUpperCase();
    const badge = document.getElementById('portal-cloud-badge');
    if (badge) badge.textContent = `🟢 ${t('live')}`;
  }

  /* -------------------------------------------------------------
     VENTANA MODAL EN INGLÉS PARA REINICIAR APP TRAS APROBACIÓN DE PERFIL
     ------------------------------------------------------------- */
  function showProfileApprovedRestartModal(newPlayerId) {
    try {
      localStorage.setItem('portal_player_id', newPlayerId);
      localStorage.setItem('portal_player_locked', 'true');
      localStorage.removeItem('portal_pending_creation_id');
      localStorage.removeItem('portal_pending_creation_name');
      localStorage.removeItem('portal_pending_creation_dorsal');
      localStorage.removeItem('portal_pending_creation_pos');
      localStorage.removeItem('cached_club_state');
    } catch (e) {}

    haptic(60);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <div class="dialog-box" style="width: 90%; max-width: 400px; text-align: center; padding: 24px 20px;">
        <div style="font-size: 46px; margin-bottom: 12px;">🎉</div>
        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 900; color: #fff;">Profile Created & Approved!</h3>
        <p style="font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0 0 20px;">
          Your coach has approved your registration and created your player profile. Please restart the app now to clear cache and activate your profile.
        </p>
        <button type="button" class="btn block primary" id="btn-restart-app-now" style="height: 48px; font-weight: 900; font-size: 14.5px; background: linear-gradient(135deg, #06b6d4, #3b82f6); border: none; box-shadow: 0 4px 18px rgba(6, 182, 212, 0.4);">
          🔄 Restart App
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-restart-app-now').onclick = () => {
      if ('caches' in window) {
        caches.keys().then(names => {
          for (let name of names) caches.delete(name);
        }).catch(() => {});
      }
      const cleanUrl = window.location.pathname + '?_t=' + Date.now();
      window.location.replace(cleanUrl);
    };
  }

  /* -------------------------------------------------------------
     SOLICITUD DE ALTA DE NUEVO JUGADOR (SI NO ESTÁ EN LA LISTA)
     ------------------------------------------------------------- */
  function listenToMyCreationRequest(reqId) {
    if (!reqId || !window.Cloud || !window.Cloud.listenToPlayerCreationRequest) return;
    if (window._myCreationRequestUnsub) {
      try { window._myCreationRequestUnsub(); } catch (e) {}
    }
    window._myCreationRequestUnsub = window.Cloud.listenToPlayerCreationRequest(reqId, (r) => {
      if (!r) return;
      if (r.status === 'approved') {
        const newPlayerId = r.createdPlayerId;
        if (newPlayerId) {
          myPlayerId = newPlayerId;
          showProfileApprovedRestartModal(newPlayerId);
        }
      } else if (r.status === 'rejected') {
        try {
          localStorage.removeItem('portal_pending_creation_id');
          localStorage.removeItem('portal_player_id');
          localStorage.removeItem('portal_player_locked');
        } catch (e) {}
        myPlayerId = null;
        toast(t('creationRejected', '❌ Your coach declined the registration request.'), 'error');
        updateHeaderIdentity();
        renderCurrentTab();
      }
    });
  }

  /* -------------------------------------------------------------
     REVOCACIÓN INMEDIATA DE ACCESO SI EL ENTRENADOR BORRA EL PERFIL
     ------------------------------------------------------------- */
  function handlePlayerProfileRemoved() {
    console.warn('[Portal] Active player profile was deleted by coach.');
    try {
      localStorage.removeItem('portal_player_id');
      localStorage.removeItem('portal_player_locked');
      localStorage.removeItem('portal_pending_creation_id');
      localStorage.removeItem('portal_pending_creation_name');
      localStorage.removeItem('portal_pending_creation_dorsal');
      localStorage.removeItem('portal_pending_creation_pos');
      localStorage.removeItem('portal_pending_req_id');
      localStorage.removeItem('cached_club_state');
    } catch (e) {}
    myPlayerId = null;

    // Cerrar cualquier diálogo, chat o modal abierto
    document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop').forEach(el => el.remove());

    updateHeaderIdentity();
    renderCurrentTab();

    // Mostrar ventana emergente en inglés
    const alertBox = document.createElement('div');
    alertBox.className = 'dialog-overlay';
    alertBox.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 16px;';
    alertBox.innerHTML = `
      <div class="dialog-box" style="max-width: 380px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 24px 20px;">
        <div style="font-size: 42px; margin-bottom: 10px;">⚠️</div>
        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 900; color: #ef4444;">Profile Removed</h3>
        <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
          Your player profile has been removed by the coach. Access has been revoked. Please select an available profile or request access.
        </p>
        <button type="button" class="btn primary block" id="btn-profile-removed-ok" style="height: 44px; font-size: 14px; font-weight: 800; border-radius: 12px; background: #ef4444; border-color: #ef4444;">
          Select Profile
        </button>
      </div>
    `;
    alertBox.querySelector('#btn-profile-removed-ok').onclick = () => {
      alertBox.remove();
      updateHeaderIdentity();
      renderCurrentTab();
      showSelectIdentityModal();
    };
    document.body.appendChild(alertBox);
  }

  function matchTeamByText(text, teams) {
    if (!text || !Array.isArray(teams) || teams.length === 0) return null;
    const clean = String(text).trim().toLowerCase();
    if (!clean) return null;

    // 1. Coincidencia por año de 4 dígitos (ej: 2015, 2019, 2017, 2016)
    const yearMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      const yr = yearMatch[1];
      const found = teams.find(t => {
        const name = (t.name || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        return name.includes(yr) || desc.includes(yr);
      });
      if (found) return found;
    }

    // 2. Coincidencia por categoría "U" (ej: U9, U10, U11, U12, U-9, etc.)
    const uMatch = clean.match(/\bu-?(\d{1,2})\b/i);
    if (uMatch) {
      const uNum = uMatch[1];
      const found = teams.find(t => {
        const name = (t.name || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        return new RegExp(`\\bu-?${uNum}\\b`, 'i').test(name) || id.includes(`u${uNum}`);
      });
      if (found) return found;
    }

    // 3. Coincidencia por nombre o nombre corto del equipo
    for (const t of teams) {
      const tName = (t.name || '').toLowerCase();
      const tShort = (t.shortName || '').toLowerCase().trim();
      if (tName && clean.includes(tName)) return t;
      if (tShort && clean.includes(tShort)) return t;
      if (tName && tName.includes(clean)) return t;
    }

    return null;
  }
  window.matchTeamByText = matchTeamByText;

  function showPlayerCreationRequestModal() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">➕ ${t('requestCoachProfileTitle', 'Request Registration from Coach')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-pcr-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px;">
          ${t('requestCoachProfileDesc', 'Send your details to the coach so they can create your profile in the team database.')}
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">Name *</label>
            <input type="text" id="pcr-name" placeholder="First name" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">Surname *</label>
            <input type="text" id="pcr-surname" placeholder="Last name" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 11.5px; font-weight: 800; color: #86efac; margin-bottom: 4px;">Team, Category or Birth Year</label>
          <input type="text" id="pcr-team-text" placeholder="e.g. U9 or 2015 or U12" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(34, 197, 94, 0.4); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          <small id="pcr-team-preview" style="display: block; margin-top: 4px; font-size: 11px; color: #86efac; font-weight: 700;"></small>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">${t('dorsalLabel', 'Dorsal')}</label>
            <input type="number" id="pcr-dorsal" placeholder="e.g. 10" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">${t('positionLabel', 'Position')}</label>
            <input type="text" id="pcr-pos" placeholder="e.g. DEL" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">${t('notesLabel', 'Notes')}</label>
          <input type="text" id="pcr-notes" placeholder="${t('notesPlaceholder', 'Optional notes...')}" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
        </div>

        <button type="button" class="btn block primary" id="btn-submit-pcr" style="height: 44px; font-weight: 900; font-size: 13.5px;">
          🚀 ${t('sendRequest', 'Send Request to Coach')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-pcr-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const inpTeam = overlay.querySelector('#pcr-team-text');
    const previewTeam = overlay.querySelector('#pcr-team-preview');
    if (inpTeam && previewTeam) {
      const updateTeamPreview = () => {
        const txt = inpTeam.value.trim();
        const matched = matchTeamByText(txt, (clubData && clubData.teams) ? clubData.teams : []);
        if (matched) {
          previewTeam.textContent = `✓ Auto-detected team: ${matched.name}`;
        } else {
          previewTeam.textContent = '';
        }
      };
      inpTeam.addEventListener('input', updateTeamPreview);
    }

    const btnSubmit = overlay.querySelector('#btn-submit-pcr');
    btnSubmit.onclick = async () => {
      const name = overlay.querySelector('#pcr-name').value.trim();
      const surname = overlay.querySelector('#pcr-surname').value.trim();
      const teamText = overlay.querySelector('#pcr-team-text').value.trim();
      const dorsal = overlay.querySelector('#pcr-dorsal').value.trim();
      const pos = overlay.querySelector('#pcr-pos').value.trim();
      const notes = overlay.querySelector('#pcr-notes').value.trim();

      if (!name) {
        toast('Please enter first name', 'error');
        return;
      }
      if (!surname) {
        toast('Please enter surname', 'error');
        return;
      }

      const matchedTeam = matchTeamByText(teamText || notes, (clubData && clubData.teams) ? clubData.teams : []);

      btnSubmit.disabled = true;
      btnSubmit.textContent = t('sending', 'Sending...');

      try {
        const reqId = 'pcr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const fullName = `${name} ${surname}`.trim();

        if (window.Cloud && window.Cloud.submitPlayerCreationRequest) {
          await window.Cloud.submitPlayerCreationRequest({
            id: reqId,
            name: name,
            lastName: surname,
            fullName: fullName,
            teamText: teamText,
            suggestedTeamId: matchedTeam ? matchedTeam.id : null,
            dorsal: dorsal ? parseInt(dorsal, 10) : null,
            position: pos || 'DEL',
            notes: notes || '',
            createdAt: Date.now()
          });
        }

        // Auto-seleccionar este perfil en estado pendiente para el usuario actual
        myPlayerId = reqId;
        try {
          localStorage.setItem('portal_player_id', reqId);
          localStorage.setItem('portal_player_locked', 'true');
          localStorage.setItem('portal_pending_creation_id', reqId);
          localStorage.setItem('portal_pending_creation_name', fullName);
          localStorage.setItem('portal_pending_creation_dorsal', dorsal || '');
          localStorage.setItem('portal_pending_creation_pos', pos || 'DEL');
        } catch (e) {}

        listenToMyCreationRequest(reqId);
        updateHeaderIdentity();
        renderCurrentTab();

        toast(t('requestSent', '✅ Request sent to coach. Your profile will be activated once approved.'), 'success');
        haptic(40);
        close();
      } catch (err) {
        toast('Error: ' + err.message, 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = t('sendRequest', 'Send Request to Coach');
      }
    };

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     CARGA DE DATOS INICIALES Y FALLBACK ROBUSTO
     ------------------------------------------------------------- */
  let isFetchingFallbackClubData = false;

  async function loadInitialClubData() {
    // 1. Intentar desde caché local si tiene jugadores
    try {
      const cached = localStorage.getItem('cached_club_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
          clubData = parsed;
          updateHeaderIdentity();
          renderCurrentTab();
          return clubData;
        }
      }
    } catch (e) {}

    // 2. Cargar desde data/database_reference.json
    if (isFetchingFallbackClubData) return clubData;
    isFetchingFallbackClubData = true;
    try {
      const res = await fetch('data/database_reference.json');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.players) && json.players.length > 0) {
          if (!clubData || !clubData.players || clubData.players.length === 0) {
            clubData = Object.assign({}, clubData || {}, json);
            try { localStorage.setItem('cached_club_state', JSON.stringify(clubData)); } catch (e) {}
            updateHeaderIdentity();
            renderCurrentTab();

            // Si el modal de carga provisional estaba abierto, actualizarlo con la lista de jugadores
            const loadingModal = document.getElementById('dialog-id-loading-overlay');
            if (loadingModal) {
              loadingModal.remove();
              showSelectIdentityModal();
            }
          }
        }
      }
    } catch (err) {
      console.warn('Fallback data/database_reference.json no disponible:', err);
    } finally {
      isFetchingFallbackClubData = false;
    }
    return clubData;
  }

  function showIdentityLoadingModal() {
    const existing = document.getElementById('dialog-id-loading-overlay');
    if (existing) return;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-id-loading-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 420px; text-align: center; padding: 24px 18px;">
        <div style="font-size: 38px; margin-bottom: 12px;">⏳</div>
        <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 900; color: #fff;">${t('chooseIdentityTitle')}</h3>
        <p style="font-size: 12.5px; color: var(--muted); margin: 0 0 16px; line-height: 1.4;">
          ${t('loadingPlayers')}
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn primary" id="btn-retry-load-id" style="height: 42px; font-weight: 800; font-size: 13px;">
            🔄 ${currentLang === 'en' ? 'Retry Loading' : 'Reintentar Carga'}
          </button>
          <button type="button" class="btn sm ghost" id="btn-dialog-id-req-fallback" style="border: 1.5px dashed var(--cyan); color: var(--cyan); font-weight: 800; font-size: 12px; height: 38px; border-radius: 10px;">
            ${t('requestCoachProfile', '➕ ¿No estás en la lista? Solicitar alta al entrenador')}
          </button>
          <button type="button" class="btn sm ghost" id="btn-close-id-loading" style="color: var(--muted); font-size: 12px;">
            ${t('close', 'Cerrar')}
          </button>
        </div>
      </div>
    `;
    function close() { overlay.remove(); }
    overlay.querySelector('#btn-close-id-loading').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    overlay.querySelector('#btn-dialog-id-req-fallback').onclick = () => {
      close();
      showPlayerCreationRequestModal();
    };
    overlay.querySelector('#btn-retry-load-id').onclick = async () => {
      const btn = overlay.querySelector('#btn-retry-load-id');
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      await loadInitialClubData();
      if (clubData && clubData.players && clubData.players.length > 0) {
        close();
        showSelectIdentityModal();
      } else {
        btn.disabled = false;
        btn.textContent = '🔄 ' + (currentLang === 'en' ? 'Retry Loading' : 'Reintentar Carga');
        toast(t('loadingPlayers'), 'info');
      }
    };
    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     SOLICITUD DE CAMBIO DE PERFIL (PUNTO 6)
     ------------------------------------------------------------- */
  async function showSelectIdentityModal() {
    if (!clubData || !clubData.players || clubData.players.length === 0) {
      await loadInitialClubData();
    }

    if (!clubData || !clubData.players || clubData.players.length === 0) {
      showIdentityLoadingModal();
      return;
    }

    // Si ya tiene perfil bloqueado, debe tramitar solicitud al entrenador
    if (isProfileLocked()) {
      showRequestProfileChangeModal();
      return;
    }

    // Primera vez: selección inicial de perfil con selector de idioma accesible directamente
    const players = clubData.players.slice().sort((a,b) => (a.name||'').localeCompare(b.name||''));
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900;">${t('chooseIdentityTitle')}</h3>
            <span style="font-size: 11.5px; color: var(--muted);">${t('chooseIdentityDesc')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <button type="button" class="btn sm ghost" id="dialog-id-lang" style="font-weight: 900; font-size: 12px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 8px;">🌐 ${currentLang.toUpperCase()}</button>
            <button type="button" class="icon-btn ghost" id="dialog-id-close" style="width: 32px; height: 32px;">✕</button>
          </div>
        </div>

        <input type="text" id="id-search" placeholder="${t('searchTeammate')}" style="width: 100%; margin-bottom: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13px;" />

        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 48vh; overflow-y: auto;" id="id-players-list">
          ${players.map(p => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
            return `
              <div class="portal-player-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer;">
                ${renderAvatar(p, 'sm')}
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 14px; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </b>
                  <small style="color: var(--muted); font-size: 11.5px;">
                    ${formatPosition(p.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
                  </small>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
          <button type="button" class="btn sm ghost" id="btn-dialog-id-req-creation" style="width: 100%; border: 1.5px dashed var(--cyan); color: var(--cyan); font-weight: 800; font-size: 12px; height: 38px; border-radius: 10px;">
            ${t('requestCoachProfile', '➕ Not on the list? Request registration from coach')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dialog-id-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const btnReqCreation = overlay.querySelector('#btn-dialog-id-req-creation');
    if (btnReqCreation) {
      btnReqCreation.onclick = () => {
        close();
        showPlayerCreationRequestModal();
      };
    }

    const langBtn = overlay.querySelector('#dialog-id-lang');
    if (langBtn) {
      langBtn.onclick = () => {
        currentLang = currentLang === 'en' ? 'es' : 'en';
        try { localStorage.setItem('lang', currentLang); } catch (e) {}
        overlay.remove();
        updateHeaderIdentity();
        renderCurrentTab();
        showSelectIdentityModal();
      };
    }

    const searchInp = overlay.querySelector('#id-search');
    const listCont = overlay.querySelector('#id-players-list');
    if (searchInp && listCont) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        listCont.querySelectorAll('.portal-player-pick-item').forEach(it => {
          it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    listCont.querySelectorAll('.portal-player-pick-item').forEach(it => {
      it.onclick = () => {
        const pid = it.getAttribute('data-pid');
        const targetPlayer = (clubData.players || []).find(p => p.id === pid);
        if (!targetPlayer) return;
        close();
        showConfirmIdentitySecurityCodeModal(targetPlayer);
      };
    });

    document.body.appendChild(overlay);
    if (searchInp) setTimeout(() => searchInp.focus(), 80);
  }

  /* -------------------------------------------------------------
     CONFIRMACIÓN CON CÓDIGO DE SEGURIDAD AL RECLAMAR PERFIL
     ------------------------------------------------------------- */
  function showConfirmIdentitySecurityCodeModal(player) {
    if (!player) return;

    // Generar código de seguridad de 3 letras y 3 números (ej. JKN-742)
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    let codeL = '';
    for (let i = 0; i < 3; i++) {
      codeL += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    let codeD = '';
    for (let i = 0; i < 3; i++) {
      codeD += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    const securityCode = `${codeL}-${codeD}`;

    const claimReqId = 'claim_' + player.id + '_' + Date.now().toString(36);
    let claimUnsub = null;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const pName = `${player.name || ''} ${player.lastName || ''}`.trim();
    const pDorsal = player.mainDorsal != null ? `#${player.mainDorsal}` : '';
    const team = clubData.teams ? clubData.teams.find(t => t.id === player.teamId) : null;

    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; padding: 22px 18px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 8px;">🔐</div>
        
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 900; color: #fff;">
          ${t('confirmPlayerIdentity', 'Confirm Identity')}
        </h3>
        <p style="margin: 0 0 16px; font-size: 13.5px; color: var(--cyan); font-weight: 800;">
          ${t('areYouPlayer', 'Are you {name}?').replace('{name}', pName)}
        </p>

        <!-- Tarjeta del jugador seleccionado -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); margin-bottom: 16px; text-align: left;">
          ${renderAvatar(player, 'md')}
          <div style="flex: 1; overflow: hidden;">
            <b style="font-size: 15px; color: #fff; display: block;" class="ellipsis">
              ${pDorsal} ${escapeHtml(pName)}
            </b>
            <small style="color: var(--muted); font-size: 12px;">
              ${formatPosition(player.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
            </small>
          </div>
        </div>

        <!-- Explicación de seguridad -->
        <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.45; margin: 0 0 14px; text-align: left;">
          ${t('securityCodeDesc', 'To protect your player profile, this security code has been generated. Give this code to your coach so they can verify and authorize access on your device.')}
        </p>

        <!-- Código de seguridad destacado -->
        <div style="background: var(--bg2); border: 2.5px dashed #22d3ee; border-radius: 14px; padding: 14px 10px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 4px;">
            ${t('securityCodeTitle', 'Security Code')}
          </span>
          <b style="font-size: 32px; color: #22d3ee; letter-spacing: 5px; font-family: monospace; font-weight: 900; display: block;">
            ${securityCode}
          </b>
        </div>

        <!-- Botones de Acción: Copiar Código y Enviar por Viber -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
          <button type="button" class="btn sm secondary" id="btn-copy-claim-code" style="height: 40px; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('copyCode', '📋 Copy Code')}
          </button>
          <button type="button" class="btn sm" id="btn-viber-claim-code" style="height: 40px; font-weight: 800; font-size: 12px; background: #7c3aed; color: #fff; border: 1px solid #a855f7; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('sendViaViber', '📱 Send via Viber')}
          </button>
        </div>

        <!-- Indicador de espera -->
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); font-size: 12px; color: #fde047; font-weight: 800; margin-bottom: 16px;">
          <span>⏳</span>
          <span>${t('waitingCoachApproval', 'Waiting for your coach to authorize the code...')}</span>
        </div>

        <button type="button" class="btn sm ghost block" id="btn-cancel-claim-req" style="height: 38px; font-weight: 800; font-size: 12.5px;">
          ${t('cancelSelectOther', '✕ Cancel and select another player')}
        </button>
      </div>
    `;

    function close() {
      if (claimUnsub) {
        try { claimUnsub(); } catch (e) {}
      }
      overlay.remove();
    }

    function fallbackCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast(t('codeCopied', '✅ Code copied to clipboard!'), 'success');
        haptic(40);
      } catch (e) {
        toast('Code: ' + text, 'info');
      }
    }

    const btnCopy = overlay.querySelector('#btn-copy-claim-code');
    if (btnCopy) {
      btnCopy.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(securityCode).then(() => {
            toast(t('codeCopied', '✅ Code copied to clipboard!'), 'success');
            haptic(40);
          }).catch(() => fallbackCopy(securityCode));
        } else {
          fallbackCopy(securityCode);
        }
      };
    }

    const btnViber = overlay.querySelector('#btn-viber-claim-code');
    if (btnViber) {
      btnViber.onclick = () => {
        const vMsg = t('viberShareMsg', 'Hi Coach, my verification security code is {code} to access my profile ({name}) on Player Stats app.')
          .replace('{code}', securityCode)
          .replace('{name}', pName);
        haptic(30);
        const vUrl = 'viber://forward?text=' + encodeURIComponent(vMsg);
        try {
          window.location.href = vUrl;
        } catch (e) {
          window.open(vUrl, '_blank');
        }
      };
    }

    overlay.querySelector('#btn-cancel-claim-req').onclick = () => {
      close();
      showSelectIdentityModal();
    };

    document.body.appendChild(overlay);

    // Enviar solicitud a Firestore
    if (window.Cloud && window.Cloud.submitProfileClaimRequest) {
      window.Cloud.submitProfileClaimRequest({
        id: claimReqId,
        targetPlayerId: player.id,
        targetPlayerName: pName,
        targetPlayerDorsal: player.mainDorsal != null ? player.mainDorsal : null,
        securityCode: securityCode,
        createdAt: Date.now()
      }).catch(err => {
        console.error('Error enviando solicitud de acceso:', err);
      });
    }

    // Escuchar respuesta en tiempo real
    if (window.Cloud && window.Cloud.listenToProfileClaimRequest) {
      claimUnsub = window.Cloud.listenToProfileClaimRequest(claimReqId, (data) => {
        if (!data) return;
        if (data.status === 'approved') {
          close();
          myPlayerId = player.id;
          try {
            localStorage.setItem('portal_player_id', player.id);
            localStorage.setItem('portal_player_locked', 'true');
          } catch (e) {}
          haptic(50);
          if (window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
            window.ChatUI.initGlobalUnreadListener(myPlayerId);
          }
          updateHeaderIdentity();
          toast(t('profileAccessApproved', '🎉 ¡Acceso autorizado por el entrenador! Ya puedes ver tu perfil.'), 'success');
          renderCurrentTab();
        } else if (data.status === 'rejected') {
          close();
          toast(t('profileAccessDenied', '❌ Acceso denegado por el entrenador'), 'error');
          haptic(30);
          showSelectIdentityModal();
        }
      });
    }
  }

  function showRequestProfileChangeModal() {
    const myP = getMyPlayer();
    const curName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador Actual';
    const players = (clubData.players || []).filter(p => p.id !== myPlayerId).sort((a,b) => (a.name||'').localeCompare(b.name||''));
    let selectedTargetPid = null;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #facc15;">🔒 ${t('reqChangeTitle')}</h3>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-req-close" style="width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 12px; color: var(--muted); margin-bottom: 10px; line-height: 1.4;">
          ${t('reqChangeDesc').replace('{name}', `<b>${escapeHtml(curName)}</b>`)}
        </p>

        <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 6px;">
          ${t('selectNewPlayer')}
        </label>
        <input type="text" id="req-player-search" placeholder="${t('searchTeammate')}" style="width: 100%; margin-bottom: 8px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 12.5px;" />

        <div style="flex: 1; max-height: 38vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; padding: 2px;" id="req-players-list">
          ${players.map(p => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
            return `
              <div class="portal-req-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--surface2); border: 2px solid var(--border); cursor: pointer; transition: all 0.15s;">
                ${renderAvatar(p, 'sm')}
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 13.5px; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: #fff;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </b>
                  <small style="color: var(--muted); font-size: 11px;">
                    ${formatPosition(p.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
                  </small>
                </div>
                <span class="req-check" style="display: none; font-size: 16px;">✅</span>
              </div>
            `;
          }).join('')}
        </div>

        <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">
          ${t('reasonLabel')}
        </label>
        <input type="text" id="inp-req-reason" placeholder="${t('reasonPlaceholder')}" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13px; margin-bottom: 12px;" />

        <button type="button" class="btn block primary" id="btn-submit-req" style="height: 44px; font-weight: 800; font-size: 13.5px;">
          ${t('sendReqBtn')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-req-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const searchInp = overlay.querySelector('#req-player-search');
    const listCont = overlay.querySelector('#req-players-list');
    if (searchInp && listCont) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        listCont.querySelectorAll('.portal-req-pick-item').forEach(it => {
          it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    listCont.querySelectorAll('.portal-req-pick-item').forEach(it => {
      it.onclick = () => {
        listCont.querySelectorAll('.portal-req-pick-item').forEach(el => {
          el.style.borderColor = 'var(--border)';
          el.style.background = 'var(--surface2)';
          const chk = el.querySelector('.req-check');
          if (chk) chk.style.display = 'none';
        });
        it.style.borderColor = 'var(--cyan)';
        it.style.background = 'rgba(34, 211, 238, 0.15)';
        const chk = it.querySelector('.req-check');
        if (chk) chk.style.display = 'inline';
        selectedTargetPid = it.getAttribute('data-pid');
        haptic(20);
      };
    });

    const btnSubmit = overlay.querySelector('#btn-submit-req');
    btnSubmit.onclick = async () => {
      if (!selectedTargetPid) {
        toast(t('reqSelectTargetErr'), 'error');
        return;
      }
      const targetP = (clubData.players || []).find(p => p.id === selectedTargetPid);
      const targetName = targetP ? `${targetP.name || ''} ${targetP.lastName || ''}`.trim() : 'Nuevo Jugador';
      const reason = overlay.querySelector('#inp-req-reason').value.trim();

      btnSubmit.disabled = true;
      btnSubmit.textContent = t('sending');

      // Generar código de seguridad de 3 letras y 3 números
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const digits = '23456789';
      let codeL = '';
      for (let i = 0; i < 3; i++) codeL += letters.charAt(Math.floor(Math.random() * letters.length));
      let codeD = '';
      for (let i = 0; i < 3; i++) codeD += digits.charAt(Math.floor(Math.random() * digits.length));
      const securityCode = `${codeL}-${codeD}`;

      const reqId = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const reqData = {
        id: reqId,
        deviceId: getDeviceId(),
        fromPlayerId: myPlayerId,
        fromPlayerName: curName,
        toPlayerId: selectedTargetPid,
        toPlayerName: targetName,
        reason: reason,
        securityCode: securityCode,
        status: 'pending',
        createdAt: Date.now()
      };

      try {
        if (window.Cloud && window.Cloud.submitProfileRequest) {
          await window.Cloud.submitProfileRequest(reqData);
          localStorage.setItem('portal_pending_req_id', reqId);
          close();
          showConfirmProfileChangeSecurityCodeModal(targetP, securityCode, reqId);
        } else {
          toast('Error de conexión a la nube', 'error');
          btnSubmit.disabled = false;
        }
      } catch (err) {
        console.error(err);
        toast('Error: ' + err.message, 'error');
        btnSubmit.disabled = false;
      }
    };

    document.body.appendChild(overlay);
    if (searchInp) setTimeout(() => searchInp.focus(), 60);
  }

  function showConfirmProfileChangeSecurityCodeModal(player, securityCode, reqId) {
    if (!player || !securityCode || !reqId) return;

    let reqUnsub = null;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const pName = `${player.name || ''} ${player.lastName || ''}`.trim();
    const pDorsal = player.mainDorsal != null ? `#${player.mainDorsal}` : '';
    const team = clubData.teams ? clubData.teams.find(t => t.id === player.teamId) : null;

    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; padding: 22px 18px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 8px;">🔐</div>
        
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 900; color: #fff;">
          ${t('profileChangeSecurityTitle', 'Confirm Profile Change')}
        </h3>
        <p style="margin: 0 0 16px; font-size: 13.5px; color: var(--cyan); font-weight: 800;">
          ➔ ${escapeHtml(pName)}
        </p>

        <!-- Tarjeta del nuevo jugador seleccionado -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); margin-bottom: 16px; text-align: left;">
          ${renderAvatar(player, 'md')}
          <div style="flex: 1; overflow: hidden;">
            <b style="font-size: 15px; color: #fff; display: block;" class="ellipsis">
              ${pDorsal} ${escapeHtml(pName)}
            </b>
            <small style="color: var(--muted); font-size: 12px;">
              ${formatPosition(player.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
            </small>
          </div>
        </div>

        <!-- Explicación de seguridad -->
        <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.45; margin: 0 0 14px; text-align: left;">
          ${t('profileChangeSecurityDesc', 'To protect your player account, this security code has been generated. Give this code to your coach so they can authorize switching your profile to {name}.').replace('{name}', pName)}
        </p>

        <!-- Código de seguridad destacado -->
        <div style="background: var(--bg2); border: 2.5px dashed #22d3ee; border-radius: 14px; padding: 14px 10px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 4px;">
            ${t('securityCodeTitle', 'Security Code')}
          </span>
          <b style="font-size: 32px; color: #22d3ee; letter-spacing: 5px; font-family: monospace; font-weight: 900; display: block;">
            ${securityCode}
          </b>
        </div>

        <!-- Botones de Acción: Copiar Código y Enviar por Viber -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
          <button type="button" class="btn sm secondary" id="btn-copy-change-code" style="height: 40px; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('copyCode', '📋 Copy Code')}
          </button>
          <button type="button" class="btn sm" id="btn-viber-change-code" style="height: 40px; font-weight: 800; font-size: 12px; background: #7c3aed; color: #fff; border: 1px solid #a855f7; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('sendViaViber', '📱 Send via Viber')}
          </button>
        </div>

        <!-- Indicador de espera -->
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); font-size: 12px; color: #fde047; font-weight: 800; margin-bottom: 16px;">
          <span>⏳</span>
          <span>${t('waitingCoachApproval', 'Waiting for your coach to authorize the code...')}</span>
        </div>

        <button type="button" class="btn sm ghost block" id="btn-cancel-change-req" style="height: 38px; font-weight: 800; font-size: 12.5px;">
          ${t('cancelSelectOther', '✕ Cancel and select another player')}
        </button>
      </div>
    `;

    function close() {
      if (reqUnsub) {
        try { reqUnsub(); } catch (e) {}
      }
      overlay.remove();
    }

    overlay.querySelector('#btn-cancel-change-req').onclick = close;

    // Copiar código
    overlay.querySelector('#btn-copy-change-code').onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(securityCode);
        } else {
          const ta = document.createElement('textarea');
          ta.value = securityCode;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        toast(t('codeCopied', '✅ Code copied to clipboard!'), 'success');
        haptic(30);
      } catch (err) {
        toast(`Code: ${securityCode}`, 'info');
      }
    };

    // Compartir por Viber
    overlay.querySelector('#btn-viber-change-code').onclick = () => {
      const shareText = t('viberProfileChangeMsg', 'Hi Coach, my verification code is {code} to change my profile to {name} on Player Stats app.')
        .replace('{code}', securityCode)
        .replace('{name}', pName);
      const viberUrl = `viber://forward?text=${encodeURIComponent(shareText)}`;
      window.location.href = viberUrl;
    };

    // Escuchar aprobación del entrenador
    if (window.Cloud && window.Cloud.listenToMyProfileRequest) {
      reqUnsub = window.Cloud.listenToMyProfileRequest(reqId, (reqDoc) => {
        if (!reqDoc) return;
        if (reqDoc.status === 'approved') {
          close();
          myPlayerId = player.id;
          localStorage.setItem('portal_selected_player_id', player.id);
          localStorage.removeItem('portal_pending_req_id');
          haptic(50);
          toast(t('profileAccessApproved', 'Access authorized by coach! You can now view your stats.'), 'success');
          renderCurrentTab();
        } else if (reqDoc.status === 'rejected') {
          close();
          localStorage.removeItem('portal_pending_req_id');
          haptic(30);
          toast(t('profileAccessDenied', 'Access denied by coach'), 'error');
        }
      });
    }

    document.body.appendChild(overlay);
  }

  function listenToMyPendingRequest(reqId) {
    if (!reqId || !window.Cloud || !window.Cloud.listenToMyProfileRequest) return;
    if (myPendingReqUnsub) myPendingReqUnsub();

    myPendingReqUnsub = window.Cloud.listenToMyProfileRequest(reqId, (reqData) => {
      if (!reqData) return;
      if (reqData.status === 'approved') {
        myPlayerId = reqData.toPlayerId;
        try {
          localStorage.setItem('portal_player_id', reqData.toPlayerId);
          localStorage.setItem('portal_player_locked', 'true');
          localStorage.removeItem('portal_pending_req_id');
        } catch (e) {}
        toast(t('reqApprovedToast'), 'success');
        haptic(50);
        updateHeaderIdentity();
        renderCurrentTab();
      } else if (reqData.status === 'rejected') {
        try { localStorage.removeItem('portal_pending_req_id'); } catch (e) {}
        toast(t('reqRejectedToast'), 'error');
        renderCurrentTab();
      }
    });
  }

  /* -------------------------------------------------------------
     NAVEGACIÓN DIRECTA A UNA CONVOCATORIA DESDE EL CHAT O NOTIFICACIÓN
     ------------------------------------------------------------- */
  window.__openConvocationInPortal = function (convId) {
    if (!convId) return;
    document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop').forEach(el => el.remove());
    convFilterType = 'all';
    currentTab = 'convocations';
    const convTabBtn = document.querySelector('#tab-convocations, button[data-tab="convocations"]');
    if (convTabBtn) {
      document.querySelectorAll('.tabbar button, .tab-bar button, #portal-tabbar .tab-btn').forEach(b => b.classList.remove('active'));
      convTabBtn.classList.add('active');
    }
    renderCurrentTab();
    setTimeout(() => {
      const card = document.querySelector(`.card[data-cid="${convId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 0.3s, border-color 0.3s';
        card.style.boxShadow = '0 0 0 3px #38bdf8';
        card.style.borderColor = '#38bdf8';
        setTimeout(() => {
          card.style.boxShadow = '';
          card.style.borderColor = '';
        }, 2500);
      }
    }, 120);
  };

  /* -------------------------------------------------------------
     PESTAÑA 1: CONVOCATORIAS (PUNTOS 2, 3, 4)
     ------------------------------------------------------------- */
  function renderConvocationsView() {
    const convs = (clubData && clubData.convocations) ? clubData.convocations : [];
    const myP = getMyPlayer();
    const pendingReqId = localStorage.getItem('portal_pending_req_id');

    let bannerHtml = '';
    if (pendingReqId) {
      bannerHtml = `
        <div style="background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; font-size: 12px; color: #fde047; display: flex; align-items: center; gap: 8px;">
          <span>⏳</span>
          <div>${t('reqSentBanner').replace('{name}', 'tu nuevo perfil')}</div>
        </div>
      `;
    }

    if (convs.length === 0) {
      view.innerHTML = `
        <div style="padding: 16px 0;">
          ${bannerHtml}
          <div class="empty-state card">
            <div class="e-ic">📋</div>
            <h3>${t('emptyConvs')}</h3>
            <p>${t('emptyConvsDesc')}</p>
          </div>
        </div>
      `;
      return;
    }

    const filteredConvs = convs.filter(c => {
      if (convFilterType !== 'all' && c.type !== convFilterType) return false;
      if (!myP || !myPlayerId) return false;

      // Debe pertenecer al equipo de la convocatoria
      const convTeams = (Array.isArray(c.teamIds) && c.teamIds.length > 0)
        ? c.teamIds
        : (c.teamId ? [c.teamId] : []);
      
      if (convTeams.length > 0) {
        if (!myP.teamId || !convTeams.includes(myP.teamId)) return false;
      } else {
        if (!myP.teamId) return false;
      }

      // Debe haber sido explícitamente convocado en la lista
      const list = c.list || {};
      const st = list[myPlayerId];
      const isCalled = !!(st && st !== 'uncalled' && st !== 'absent');
      if (!isCalled) return false;

      return true;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

    const allPlayersMap = {};
    (clubData.players || []).forEach(p => { allPlayersMap[p.id] = p; });

    view.innerHTML = `
      <div style="padding: 10px 0;">
        ${bannerHtml}

        <!-- FILTROS DE CONVOCATORIAS: TODOS, PARTIDOS, ENTRENAMIENTOS -->
        <div class="segmented" style="display: flex; gap: 4px; margin-bottom: 12px; background: var(--surface2); padding: 4px; border-radius: 12px; border: 1px solid var(--border);">
          <button type="button" class="btn sm ${convFilterType === 'all' ? 'primary' : 'ghost'}" data-conv-filter="all" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">${t('filterAll', 'Todos')}</button>
          <button type="button" class="btn sm ${convFilterType === 'match' ? 'primary' : 'ghost'}" data-conv-filter="match" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">${t('filterMatches', '🏆 Partidos')}</button>
          <button type="button" class="btn sm ${convFilterType === 'training' ? 'primary' : 'ghost'}" data-conv-filter="training" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">${t('filterTrainings', '⚽ Entrenamientos')}</button>
        </div>

        ${filteredConvs.length === 0 ? `
          <div class="empty-state card">
            <div class="e-ic">📋</div>
            <h3>${t('emptyConvs')}</h3>
            <p>${t('emptyConvsDesc')}</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${filteredConvs.map(c => {
              const team = clubData.teams ? clubData.teams.find(t => t.id === c.teamId) : null;
              const list = c.list || {};
              const responses = liveVotes[c.id] || {};

              // SÓLO jugadores efectivamente convocados (st !== 'uncalled' y st !== 'absent')
              const calledPlayerIds = Object.keys(list).filter(pid => {
                const st = list[pid];
                return st && st !== 'uncalled' && st !== 'absent';
              });

              const isCalled = true;

              // Recuentos reales entre los convocados
              let nAttending = 0;
              let nAbsent = 0;
              let nPending = 0;

              calledPlayerIds.forEach(pid => {
                const r = responses[pid] || (c.responses && c.responses[pid]);
                const st = r ? r.status : null;
                if (st === 'called' || st === 'attending' || st === 'yes') nAttending++;
                else if (st === 'absent' || st === 'no') nAbsent++;
                else nPending++;
              });

              // Voto del usuario actual
              const myVoteObj = myPlayerId ? (responses[myPlayerId] || (c.responses && c.responses[myPlayerId])) : null;
              const mySt = myVoteObj ? myVoteObj.status : null;
              const isAttending = mySt && (mySt === 'called' || mySt === 'attending' || mySt === 'yes');
              const isAbsent = mySt && (mySt === 'absent' || mySt === 'no');

              const isMatch = c.type === 'match';

              return `
                <div class="card" style="border: 1px solid var(--border); padding: 16px;" data-cid="${c.id}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div>
                      <span class="badge ${c.type}" style="margin-bottom: 6px;">
                        ${isMatch ? '🏆 ' + t('match') : '⚽ ' + t('training')}
                      </span>
                      <h3 style="margin: 0; font-size: 17px; font-weight: 900;">
                        ${escapeHtml(c.title || (c.rival ? 'vs ' + c.rival : t('callUpOfficial')))}
                      </h3>
                      <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.4;">
                        📅 <b>${formatDisplayDate(c.date)}</b> • ⏰ ${c.time || '10:00'}<br />
                        ${c.venue ? `📍 <b>${t('venue')}:</b> ${escapeHtml(c.venue)}<br />` : ''}
                        ${c.address ? `
                          🗺️ <b>${t('address')}:</b> ${escapeHtml(c.address)}
                          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}" target="_blank" style="color: var(--cyan); font-weight: 800; text-decoration: underline; margin-left: 4px;">
                            ${t('openInMaps')}
                          </a><br />
                        ` : ''}
                        ${team ? `<span style="color: ${team.color || 'var(--cyan)'}; font-weight: 800;">🛡️ ${escapeHtml(team.name)}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  ${c.notes ? `
                    <div style="background: rgba(0,0,0,0.25); border-left: 3px solid var(--cyan); padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-top: 10px; color: #bae6fd;">
                      📝 <b>${t('coachNote')}:</b> ${escapeHtml(c.notes)}
                    </div>
                  ` : ''}

                  <!-- CAJA DE ASISTENCIA -->
                  <div class="portal-vote-box">
                    ${isCalled ? `
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; font-weight: 800; color: #fff;">${t('willYouAttend')}</span>
                        <span id="vote-badge-${c.id}" class="badge" style="${isAttending ? 'background: rgba(34,197,94,0.2); color: #86efac;' : (isAbsent ? 'background: rgba(239,68,68,0.2); color: #fca5a5;' : 'background: var(--surface); color: var(--muted);')}">
                          ${isAttending ? t('attendanceConfirmed') : (isAbsent ? t('absenceReported') : t('pendingResponse'))}
                        </span>
                      </div>

                      <div class="portal-vote-btns">
                        <button class="btn-vote yes ${isAttending ? 'active' : ''}" data-cid="${c.id}" data-vote="called">
                          ${t('iWillAttend')}
                        </button>
                        <button class="btn-vote no ${isAbsent ? 'active' : ''}" data-cid="${c.id}" data-vote="absent">
                          ${t('iCannotAttend')}
                        </button>
                      </div>
                    ` : `
                      <div style="text-align: center; padding: 6px 0; color: var(--muted); font-size: 12.5px;">
                        ${t('notCalledUp')}
                      </div>
                    `}

                    <!-- RECUENTO EN VIVO Y MODAL DE COMPAÑEROS QUE ASISTEN -->
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                      <div style="display: flex; gap: 8px;">
                        <span style="color: #86efac; font-weight: 800;">🟢 ${nAttending}</span>
                        <span style="color: #fca5a5; font-weight: 800;">❌ ${nAbsent}</span>
                        <span style="color: #fde047; font-weight: 800;">⏳ ${nPending}</span>
                      </div>
                      <button type="button" class="btn sm ghost" data-open-squad-status="${c.id}" style="color: var(--cyan); font-weight: 800; font-size: 11.5px; padding: 4px 8px;">
                        ${t('viewAttendees')}
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    // Filtros de convocatorias
    view.querySelectorAll('[data-conv-filter]').forEach(b => {
      b.onclick = () => {
        convFilterType = b.getAttribute('data-conv-filter');
        renderConvocationsView();
      };
    });

    // Conectar botones de voto
    view.querySelectorAll('.btn-vote').forEach(btn => {
      btn.onclick = async () => {
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }

        const cid = btn.getAttribute('data-cid');
        const vote = btn.getAttribute('data-vote');
        const myP = getMyPlayer();
        const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Player';

        haptic(35);

        const isCurrentlyActive = btn.classList.contains('active');
        const nextVote = isCurrentlyActive ? 'pending' : vote;

        // Actualizar caché de votos local al instante
        liveVotes[cid] = liveVotes[cid] || {};
        if (nextVote === 'pending') {
          delete liveVotes[cid][myPlayerId];
          const convObj = (clubData && clubData.convocations) ? clubData.convocations.find(x => x.id === cid) : null;
          if (convObj && convObj.responses) delete convObj.responses[myPlayerId];
        } else {
          liveVotes[cid][myPlayerId] = { status: nextVote, playerName: pName, timestamp: Date.now() };
        }

        // Feedback visual inmediato
        const box = btn.closest('.portal-vote-box');
        if (box) {
          box.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
          if (nextVote !== 'pending') {
            btn.classList.add('active');
          }
          const badge = document.getElementById(`vote-badge-${cid}`);
          if (badge) {
            if (nextVote === 'called') {
              badge.textContent = t('attendanceConfirmed');
              badge.style.background = 'rgba(34,197,94,0.2)';
              badge.style.color = '#86efac';
            } else if (nextVote === 'absent') {
              badge.textContent = t('absenceReported');
              badge.style.background = 'rgba(239,68,68,0.2)';
              badge.style.color = '#fca5a5';
            } else {
              badge.textContent = t('pendingResponse');
              badge.style.background = 'var(--surface)';
              badge.style.color = 'var(--muted)';
            }
          }
        }

        try {
          if (window.Cloud && window.Cloud.voteAttendance) {
            await window.Cloud.voteAttendance(cid, myPlayerId, nextVote, pName);
            if (nextVote === 'pending') {
              toast(t('voteReset', 'Respuesta cancelada (pendiente)'), 'info');
            } else {
              toast(nextVote === 'called' ? t('attendanceConfirmed') : t('absenceReported'), 'success');
            }
          } else {
            toast('Guardado localmente.', 'info');
          }
        } catch (err) {
          console.error(err);
          toast('Error: ' + err.message, 'error');
        }
        renderConvocationsView();
      };
    });

    // Abrir desglose de asistentes
    view.querySelectorAll('[data-open-squad-status]').forEach(btn => {
      btn.onclick = () => {
        const cid = btn.getAttribute('data-open-squad-status');
        const conv = convs.find(x => x.id === cid);
        if (conv) showAttendeesBreakdownModal(conv);
      };
    });
  }

  function showAttendeesBreakdownModal(conv) {
    const list = conv.list || {};
    const responses = liveVotes[conv.id] || {};
    const allPlayersMap = {};
    (clubData.players || []).forEach(p => { allPlayersMap[p.id] = p; });

    // SÓLO jugadores convocados
    const calledPids = Object.keys(list).filter(pid => list[pid] && list[pid] !== 'uncalled');

    const attending = [];
    const absent = [];
    const pending = [];

    calledPids.forEach(pid => {
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, ''), mainPosition: 'Jugador' };
      const r = responses[pid] || (conv.responses && conv.responses[pid]);
      const st = r ? r.status : null;

      if (st === 'called' || st === 'attending' || st === 'yes') attending.push(p);
      else if (st === 'absent' || st === 'no') absent.push(p);
      else pending.push(p);
    });

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 95%; max-width: 540px; display: flex; flex-direction: column; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">${t('attendeesTitle')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-attendees-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Confirmados -->
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #86efac; margin-bottom: 6px;">
              🟢 ${t('confirmedBadge').toUpperCase()} (${attending.length})
            </div>
            ${attending.length === 0 ? `<div style="font-size: 12px; color: var(--muted);">${t('noAttendeesYet')}</div>` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${attending.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface2); border: 1px solid var(--border); padding: 8px 10px; border-radius: 10px; overflow: hidden;">
                    ${renderAvatar(p, 'sm')}
                    <b style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</b>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Ausentes -->
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #fca5a5; margin-bottom: 6px;">
              ❌ ${t('absentBadge').toUpperCase()} (${absent.length})
            </div>
            ${absent.length === 0 ? `<div style="font-size: 12px; color: var(--muted);">${t('noAbsentYet')}</div>` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${absent.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface2); border: 1px solid var(--border); padding: 8px 10px; border-radius: 10px; overflow: hidden;">
                    ${renderAvatar(p, 'sm')}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Pendientes -->
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #fde047; margin-bottom: 6px;">
              ⏳ ${t('pendingBadge').toUpperCase()} (${pending.length})
            </div>
            ${pending.length === 0 ? `<div style="font-size: 12px; color: var(--muted);">${t('allAnswered')}</div>` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${pending.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); background: var(--surface2); border: 1px solid var(--border); padding: 8px 10px; border-radius: 10px; overflow: hidden;">
                    ${renderAvatar(p, 'sm')}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-attendees-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     MAPA TÁCTICO DE GOLES POR ZONAS DEL CAMPO (PUNTO 10)
     ------------------------------------------------------------- */
  function getPlayerGoalsByZone(pid) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 };
    let totalTrackedGoals = 0;
    (clubData.sessions || []).forEach(s => {
      (s.zones || []).forEach(zItem => {
        if (zItem.p === pid && zItem.k === 'goal') {
          const zid = parseInt(zItem.z, 10);
          if (counts[zid] !== undefined) {
            counts[zid]++;
            totalTrackedGoals++;
          }
        }
      });
    });
    return { counts, totalTrackedGoals };
  }

  function renderPlayerGoalsPitchHtml(pid) {
    const { counts, totalTrackedGoals } = getPlayerGoalsByZone(pid);
    const pStats = calculatePlayerStats(pid);
    const totalGoals = pStats.goals;

    function cellContent(zoneId, label, emoji) {
      const qty = counts[zoneId] || 0;
      const hasGoals = qty > 0;
      return `
        <span class="z-emoji" style="font-size: ${hasGoals ? '18px' : '14px'};">${hasGoals ? '⚽' : emoji}</span>
        <span style="font-size: 10px; font-weight: 700; opacity: 0.9;">${label}</span>
        ${hasGoals ? `
          <span class="badge" style="background: #facc15; color: #000; font-weight: 900; font-size: 11px; padding: 2px 7px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.4); margin-top: 2px;">
            ${qty} ${qty === 1 ? (currentLang === 'en' ? 'goal' : 'gol') : (currentLang === 'en' ? 'goals' : 'goles')}
          </span>
        ` : `
          <span style="font-size: 9px; opacity: 0.55; color: #fff;">0</span>
        `}
      `;
    }

    return `
      <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border); padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>🗺️</span> <span>${t('pitchGoalsTitle', 'Mapa Táctico de Goles')}</span>
            </div>
            <small style="color: var(--muted); font-size: 11px;">
              ${t('pitchGoalsDesc', 'Goles anotados según la zona del campo')}
            </small>
          </div>
          <div style="text-align: right;">
            <span class="badge" style="background: rgba(134, 239, 172, 0.18); color: #86efac; border: 1px solid rgba(134, 239, 172, 0.4); font-size: 11.5px; font-weight: 900;">
              ⚽ ${totalGoals} ${t('goalsScored')}
            </span>
          </div>
        </div>

        <div class="pitch-field-grid" style="margin: 0 auto; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
          <div class="pitch-grid-cell pz-top-l ${counts[3] > 0 ? 'has-actions' : ''}" style="background: ${counts[3] > 0 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(56, 189, 248, 0.25)'};">
            ${cellContent(3, t('zone_wing_off_l', 'Banda Of. Izq'), '↖️')}
          </div>
          <div class="pitch-grid-cell pz-top-c ${counts[1] > 0 ? 'has-actions' : ''}" style="background: ${counts[1] > 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.35)'}; border: ${counts[1] > 0 ? '2px solid #facc15' : '1.5px dashed rgba(255,255,255,0.4)'};">
            ${cellContent(1, t('zone_box_opp', 'Área Rival'), '🥅')}
          </div>
          <div class="pitch-grid-cell pz-top-r ${counts[4] > 0 ? 'has-actions' : ''}" style="background: ${counts[4] > 0 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(6, 182, 212, 0.25)'};">
            ${cellContent(4, t('zone_wing_off_r', 'Banda Of. Der'), '↗️')}
          </div>

          <div class="pitch-grid-cell pz-wing-l ${counts[7] > 0 ? 'has-actions' : ''}" style="background: ${counts[7] > 0 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(59, 130, 246, 0.25)'};">
            ${cellContent(7, t('zone_wing_l', 'Banda Izq'), '⬅️')}
          </div>
          <div class="pitch-grid-cell pz-mid-t ${counts[2] > 0 ? 'has-actions' : ''}" style="background: ${counts[2] > 0 ? 'rgba(249, 115, 22, 0.65)' : 'rgba(249, 115, 22, 0.35)'}; border: ${counts[2] > 0 ? '2px solid #facc15' : '1.5px dashed rgba(255,255,255,0.4)'};">
            ${cellContent(2, t('zone_front', 'Frontal'), '🎯')}
          </div>
          <div class="pitch-grid-cell pz-wing-r ${counts[8] > 0 ? 'has-actions' : ''}" style="background: ${counts[8] > 0 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(14, 165, 233, 0.25)'};">
            ${cellContent(8, t('zone_wing_r', 'Banda Der'), '➡️')}
          </div>

          <div class="pitch-grid-cell pz-mid-b ${counts[5] > 0 ? 'has-actions' : ''}" style="background: ${counts[5] > 0 ? 'rgba(34, 197, 94, 0.65)' : 'rgba(34, 197, 94, 0.35)'};">
            ${cellContent(5, t('zone_mid', 'Medio'), '⚽')}
          </div>
        </div>
        
        ${totalGoals > 0 && totalTrackedGoals < totalGoals ? `
          <div style="margin-top: 8px; text-align: center; font-size: 11px; color: var(--muted);">
            ℹ️ ${totalGoals - totalTrackedGoals} ${t('untrackedGoalsHint', 'goles contabilizados en partidos anteriores sin zona asignada')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function calculateAgeYearsMonths(birthDateStr, lang) {
    if (!birthDateStr) return '';
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return '';
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return '';
    const isEn = (lang || currentLang || 'en') === 'en';
    if (isEn) {
      const yStr = years === 1 ? '1 year' : `${years} years`;
      const mStr = months === 1 ? '1 month' : `${months} months`;
      return `${yStr}, ${mStr}`;
    } else {
      const yStr = years === 1 ? '1 año' : `${years} años`;
      const mStr = months === 1 ? '1 mes' : `${months} meses`;
      return `${yStr}, ${mStr}`;
    }
  }

  /* -------------------------------------------------------------
     PESTAÑA 2: MI FICHA PERSONAL (PUNTOS 1, 7, 8)
     ------------------------------------------------------------- */
  function renderMyStatsView() {
    const myP = getMyPlayer();

    if (!myP) {
      view.innerHTML = `
        <div style="padding: 24px 0; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">👤</div>
            <h3>${t('chooseIdentityTitle')}</h3>
            <p>${t('chooseIdentityDesc')}</p>
            <button class="btn primary" id="btn-portal-choose-me">${t('confirmIdentityBtn')}</button>
          </div>
        </div>
      `;
      const btn = view.querySelector('#btn-portal-choose-me');
      if (btn) btn.onclick = showSelectIdentityModal;
      return;
    }

    if (myP.isPendingApproval) {
      view.innerHTML = `
        <div style="padding: 20px 0; text-align: center;">
          <div class="card" style="padding: 28px 16px; border: 1.5px solid rgba(250, 204, 21, 0.4); background: linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%); border-radius: 16px;">
            <div style="font-size: 40px; margin-bottom: 10px;">⏳</div>
            <h3 style="margin: 0 0 6px; font-size: 18px; color: #fde047; font-weight: 900;">
              ${t('creationPendingTitle', 'Solicitud enviada al Entrenador')}
            </h3>
            <p style="margin: 0 0 14px; font-size: 13px; color: #cbd5e1; line-height: 1.45;">
              ${t('creationPendingDesc', 'Has solicitado crear el perfil para')} <b>${escapeHtml(myP.name || '')}</b> (${myP.mainDorsal ? '#' + myP.mainDorsal : formatPosition(myP.mainPosition)}).
              <br/>
              ${t('creationPendingNote', 'Tu perfil se vinculará y mostrará tus estadísticas automáticamente en cuanto el entrenador confirme tu alta.')}
            </p>
            <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; background: rgba(250, 204, 21, 0.2); border: 1px solid rgba(250, 204, 21, 0.5); font-size: 12px; color: #fde047; font-weight: 800;">
              🔒 ${t('pendingApproval', 'Esperando confirmación del entrenador')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    const team = clubData.teams ? clubData.teams.find(t => t.id === myP.teamId) : null;
    const stats = calculatePlayerStats(myP.id);
    const radar = calculatePlayerRadar(myP.id);
    const secPositions = myP.secondaryPositions && myP.secondaryPositions.length ? myP.secondaryPositions : (myP.secondaryPosition ? [myP.secondaryPosition] : []);
    const ageStr = myP.birthDate ? calculateAgeYearsMonths(myP.birthDate, currentLang) : '';

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <!-- Ficha Hero -->
        <div class="card p-hero" style="margin-bottom: 14px; border: 1px solid var(--border);">
          ${renderAvatar(myP, 'lg')}
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 19px; font-weight: 900; margin: 0 0 4px;">
              ${escapeHtml(myP.name || '')} ${escapeHtml(myP.lastName || '')}
            </h2>
            <div class="meta" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted); align-items: center;">
              <span class="pos-tag">${formatPosition(myP.mainPosition)}</span>
              ${secPositions.length ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.4); font-size: 11px;">🔄 ${formatPositionsList(secPositions)}</span>` : ''}
              <span>•</span>
              <span>#${myP.mainDorsal != null ? myP.mainDorsal : '—'}</span>
              <span>•</span>
              <span>${getPlayerFootLabel(myP.foot)}</span>
            </div>
            ${myP.birthDate ? `
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                <span>🎂</span>
                <span>${myP.birthDate}</span>
                <span style="color: var(--cyan); font-weight: 800;">(${ageStr})</span>
              </div>
            ` : ''}
            ${team ? `
              <div style="margin-top: 6px;">
                <span class="badge" style="background: ${team.color || 'var(--cyan)'}25; color: ${team.color || 'var(--cyan)'}; border: 1px solid ${team.color || 'var(--cyan)'}50; font-weight: 800;">
                  🛡️ ${escapeHtml(team.name)}
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- NOTA DE RENDIMIENTO (MATCH RATING) DESTACADA -->
        <div class="card" style="margin-bottom: 14px; border: 1px solid rgba(34, 211, 238, 0.35); background: linear-gradient(135deg, rgba(34, 211, 238, 0.12) 0%, rgba(19, 31, 56, 0.7) 100%); cursor: pointer;" id="card-rating-explain">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px;">
                ⭐ ${t('performanceRating')} ℹ️
              </div>
              <div style="font-size: 28px; font-weight: 900; color: #fff; margin-top: 2px;">
                ${stats.aggregatedRating} <span style="font-size: 16px; color: var(--muted); font-weight: 700;">/ 10</span>
              </div>
              <small style="font-size: 11px; color: var(--muted);">${t('ratingDesc')}</small>
            </div>
            <div style="font-size: 32px; padding-right: 8px;">📊</div>
          </div>
        </div>

        <!-- Radar de Habilidades (Interactivo) -->
        <div class="section-title"><span>${t('skillsRadar')}</span></div>
        <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border);" id="radar-card">
          ${renderRadarSVG(radar)}
        </div>

        <!-- Cifras Clave (Partidos y Entrenamientos Asistidos por separado, Sin Minutos) -->
        <div class="section-title"><span>${t('cumulativeStats')}</span></div>
        <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--match); text-transform: uppercase;">🏟️ ${t('matchesAttended')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 2px;">${stats.matchesAttended}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--train); text-transform: uppercase;">🏃‍♂️ ${t('trainingsAttended')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 2px;">${stats.trainingsAttended}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #86efac; text-transform: uppercase;">⚽ ${t('goalsScored')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #86efac; margin-top: 2px;">${stats.goals}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase;">🎯 ${t('passAccuracy')}</div>
            <div style="font-size: 24px; font-weight: 900; color: var(--cyan); margin-top: 2px;">${stats.passAcc}%</div>
            <small style="font-size: 10.5px; color: var(--muted);">${stats.passOk} ${t('passesAccurate')}</small>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #facc15; text-transform: uppercase;">🎯 ${t('shotAccuracy')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #facc15; margin-top: 2px;">${stats.shotAcc}%</div>
            <small style="font-size: 10.5px; color: var(--muted);">${stats.shotsOn} ${t('shotsOnTarget')}</small>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">👟 ${t('ballTouches')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #c084fc; margin-top: 2px;">${stats.touches}</div>
          </div>
        </div>

        <!-- Mapa Táctico de Goles por Zonas (Punto 10) -->
        ${renderPlayerGoalsPitchHtml(myP.id)}

        <!-- Historial de Partidos y Acciones Detalladas -->
        <div class="section-title"><span>${t('recentMatchesTitle')}</span></div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          ${renderPlayerMatchHistory(myP.id)}
        </div>
      </div>
    `;

    // Conectar popup de explicación de rating
    const ratingCard = view.querySelector('#card-rating-explain');
    if (ratingCard) ratingCard.onclick = () => showSkillExplanationModal('rating');

    // Conectar clic en etiquetas del radar
    view.querySelectorAll('.radar-click-label').forEach(el => {
      el.onclick = () => {
        const skill = el.getAttribute('data-skill');
        showSkillExplanationModal(skill);
      };
    });
  }

  function renderPlayerMatchHistory(pid) {
    if (!clubData || !clubData.sessions || clubData.sessions.length === 0) {
      return `
        <div class="card" style="padding: 16px; text-align: center; border: 1px dashed var(--border); color: var(--muted); font-size: 13px;">
          ${t('noMatchesYet')}
        </div>
      `;
    }

    const matches = clubData.sessions.filter(s => {
      const st = s.stats && s.stats[pid];
      return st && Object.values(st).some(v => v > 0);
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (matches.length === 0) {
      return `
        <div class="card" style="padding: 16px; text-align: center; border: 1px dashed var(--border); color: var(--muted); font-size: 13px;">
          ${t('noActionsYet')}
        </div>
      `;
    }

    const p = (clubData.players || []).find(x => x.id === pid);
    const pos = p ? p.mainPosition : 'Jugador';

    return matches.map(s => {
      const st = s.stats[pid] || {};
      const isMatch = s.type === 'match';
      const title = s.title || (isMatch ? (s.rival ? 'vs ' + s.rival : t('match')) : t('training'));
      const scoreStr = (s.score && (s.score.home != null || s.score.away != null))
        ? `${s.score.home || 0} - ${s.score.away || 0}`
        : '';

      const matchRating = calculateMatchRating(st, pos);
      const totalP = (st.passOk || 0) + (st.passKo || 0);
      const passPct = totalP > 0 ? Math.round(((st.passOk || 0) / totalP) * 100) : null;
      const totalShots = (st.shotOn || 0) + (st.shotOff || 0);

      return `
        <div class="card" style="padding: 14px; border: 1px solid var(--border); background: var(--surface2);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge" style="background: ${isMatch ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isMatch ? '#86efac' : '#38bdf8'}; font-size: 10px; font-weight: 800;">
                ${isMatch ? '🏟️ ' + t('match').toUpperCase() : '🏃‍♂️ ' + t('training').toUpperCase()}
              </span>
              <h4 style="margin: 4px 0 2px; font-size: 15px; font-weight: 900; color: #fff;">
                ${escapeHtml(title)}
              </h4>
              <div style="font-size: 11.5px; color: var(--muted);">
                📅 ${s.date || ''} ${s.venue ? '• 📍 ' + escapeHtml(s.venue) : ''}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              ${scoreStr ? `
                <div style="font-size: 14px; font-weight: 900; background: var(--bg2); padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border); color: #fff;">
                  ${scoreStr}
                </div>
              ` : ''}
              <div style="font-size: 12px; font-weight: 900; color: #22d3ee; background: rgba(34, 211, 238, 0.15); padding: 2px 7px; border-radius: 6px;">
                ⭐ ${matchRating}
              </div>
            </div>
          </div>

          <!-- Acciones de este partido -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11.5px; text-align: center; margin-top: 8px;">
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('passesLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.passOk || 0}/${totalP} ${passPct !== null ? `<span style="font-size: 9.5px; color: var(--cyan);">(${passPct}%)</span>` : ''}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('shotsLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.shotOn || 0} ${t('shotsOnTarget')} <span style="font-size: 9.5px; color: var(--muted);">(${totalShots})</span></div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('goalsLabel')}</div>
              <div style="font-weight: 800; color: #86efac;">⚽ ${st.goal || 0}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('dribblesLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.dribbleOk || 0}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('recoveriesLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.recovery || 0}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('touchesLabel')}</div>
              <div style="font-weight: 800; color: #c084fc;">${st.touches || 0}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function hasApprovedProfile() {
    if (!myPlayerId) return false;
    const pendingCreationId = localStorage.getItem('portal_pending_creation_id');
    if (myPlayerId === pendingCreationId || String(myPlayerId).startsWith('pcr_')) return false;
    const p = (clubData && clubData.players) ? clubData.players.find(x => x.id === myPlayerId) : null;
    return !!p && !p.isPendingApproval;
  }

  /* -------------------------------------------------------------
     VISTA DE BLOQUEO PARA SECCIONES QUE REQUIEREN PERFIL ACTIVO
     ------------------------------------------------------------- */
  function renderNoProfileAccessView(featureName) {
    const isPendingCreation = !!(localStorage.getItem('portal_pending_creation_id') || (myPlayerId && String(myPlayerId).startsWith('pcr_')));
    const pendingName = localStorage.getItem('portal_pending_creation_name') || 'Player';

    if (isPendingCreation) {
      view.innerHTML = `
        <div style="padding: 44px 16px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
          <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 900; color: #fde047;">${currentLang === 'en' ? 'Registration Pending' : 'Registro Pendiente'}</h3>
          <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
            ${currentLang === 'en'
              ? `Your registration request for <b>${escapeHtml(pendingName)}</b> is currently pending approval by your coach. You will be able to access ${featureName} once approved.`
              : `Tu solicitud de alta para <b>${escapeHtml(pendingName)}</b> está pendiente de aprobación por el entrenador. Tendrás acceso a ${featureName} una vez aprobada.`}
          </p>
          <button type="button" class="btn ghost sm" id="btn-cancel-pending-creation" style="font-weight: 800; border-radius: 12px; padding: 8px 18px;">
            ${currentLang === 'en' ? 'Cancel Request / Choose Another' : 'Cancelar solicitud / Elegir otro'}
          </button>
        </div>
      `;
      const btnCancel = view.querySelector('#btn-cancel-pending-creation');
      if (btnCancel) {
        btnCancel.onclick = () => {
          try {
            localStorage.removeItem('portal_pending_creation_id');
            localStorage.removeItem('portal_player_id');
            localStorage.removeItem('portal_player_locked');
            localStorage.removeItem('portal_pending_creation_name');
            localStorage.removeItem('portal_pending_creation_dorsal');
            localStorage.removeItem('portal_pending_creation_pos');
          } catch (e) {}
          myPlayerId = null;
          updateHeaderIdentity();
          renderCurrentTab();
          showSelectIdentityModal();
        };
      }
      return;
    }

    view.innerHTML = `
      <div style="padding: 44px 16px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
        <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 900;">${t('selectIdentity', 'Select your profile')}</h3>
        <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
          ${currentLang === 'en' 
            ? `You must select or activate an active player profile to view ${featureName}.` 
            : `Debes seleccionar o activar un perfil de jugador para ver ${featureName}.`}
        </p>
        <button type="button" class="btn primary" id="btn-no-profile-select-act" style="font-weight: 800; border-radius: 12px; padding: 10px 24px;">
          ${t('selectIdentity', 'Select Profile')}
        </button>
      </div>
    `;
    const btn = view.querySelector('#btn-no-profile-select-act');
    if (btn) btn.onclick = showSelectIdentityModal;
  }

  /* -------------------------------------------------------------
     PESTAÑA 3: PLANTILLA Y DEMÁS EQUIPOS (PUNTO 9)
     ------------------------------------------------------------- */
  function renderSquadView() {
    if (!hasApprovedProfile()) {
      renderNoProfileAccessView(t('squad', 'Squad'));
      return;
    }
    const teams = clubData && clubData.teams ? clubData.teams : [];
    let players = (clubData && clubData.players) ? clubData.players.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')) : [];

    if (activeTeamFilter !== 'all') {
      players = players.filter(p => p.teamId === activeTeamFilter);
    }

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 4px;">${t('squadTitle')}</h2>
        <p style="font-size: 12px; color: var(--muted); margin: 0 0 10px;">
          ${t('squadSubtitle')}
        </p>

        <!-- FILTROS POR EQUIPO (PUNTO 9) -->
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 8px; -webkit-overflow-scrolling: touch;">
          <button class="btn sm ${activeTeamFilter === 'all' ? 'primary' : 'ghost'}" data-filter-team="all" style="white-space: nowrap; font-weight: 800; font-size: 11.5px; border-radius: 10px;">
            ${t('allTeams')}
          </button>
          ${teams.map(tm => `
            <button class="btn sm ${activeTeamFilter === tm.id ? 'primary' : 'ghost'}" data-filter-team="${tm.id}" style="white-space: nowrap; font-weight: 800; font-size: 11.5px; border-radius: 10px; border-color: ${tm.color || 'var(--border)'};">
              🛡️ ${escapeHtml(tm.name)}
            </button>
          `).join('')}
        </div>

        <!-- FICHA DEL ENTRENADOR (PUNTO 8) -->
        <div class="card coach-profile-card" id="btn-view-coach-card" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid rgba(250, 204, 21, 0.5); background: linear-gradient(135deg, rgba(250, 204, 21, 0.12) 0%, rgba(15, 23, 42, 0.7) 100%); border-radius: 14px; margin-bottom: 12px; cursor: pointer;">
          <div style="width: 44px; height: 44px; border-radius: 14px; background: rgba(250, 204, 21, 0.2); border: 2px solid #facc15; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
            ${(clubData.coachProfile && clubData.coachProfile.photo) ? `<img src="${clubData.coachProfile.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />` : '<span style="color: #facc15; font-weight: 900; font-size: 16px;">DR</span>'}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; font-size: 10px; font-weight: 900; border: 1px solid rgba(250, 204, 21, 0.4);">
                🛡️ ${t('coachCardTitle', 'Cuerpo Técnico')}
              </span>
            </div>
            <h4 style="margin: 2px 0 0; font-size: 14.5px; font-weight: 900; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${escapeHtml((clubData.coachProfile && clubData.coachProfile.name) || 'Entrenador Principal')}
            </h4>
            <small style="color: var(--muted); font-size: 11px;">
              ${escapeHtml((clubData.coachProfile && (clubData.coachProfile.role || clubData.coachProfile.title)) || t('coachProfileSubtitle', 'Director Técnico'))}
            </small>
          </div>
          <div style="color: #facc15; font-size: 11.5px; font-weight: 800; white-space: nowrap;">
            ${t('viewCoachProfile', 'Ver Ficha')} ➔
          </div>
        </div>

        <input type="text" id="squad-search" placeholder="${t('searchTeammate')}" style="width: 100%; margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />

        <div style="display: flex; flex-direction: column; gap: 8px;" id="squad-list">
          ${players.map(p => {
            const team = teams.find(t => t.id === p.teamId);
            const pStats = calculatePlayerStats(p.id);

            return `
              <div class="card squad-item-card" data-pid="${p.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border); cursor: pointer;">
                ${renderAvatar(p, 'md')}
                <div style="flex: 1; overflow: hidden;">
                  <h4 style="margin: 0 0 2px; font-size: 15px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </h4>
                  <div style="font-size: 12px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap;">
                    <span class="pos-tag">${formatPosition(p.mainPosition)}</span>
                    <span>•</span>
                    <span>${getPlayerFootLabel(p.foot)}</span>
                    ${team ? `<span>• 🛡️ ${escapeHtml(team.name)}</span>` : ''}
                  </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 13px; font-weight: 900; color: #22d3ee;">⭐ ${pStats.aggregatedRating}</div>
                  <small style="font-size: 10.5px; color: var(--muted);">⚽ ${pStats.goals} ${currentLang === 'en' ? 'goals' : 'goles'}</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Conectar botón ficha del entrenador
    const btnCoachCard = view.querySelector('#btn-view-coach-card');
    if (btnCoachCard) btnCoachCard.onclick = showCoachFullProfileModal;

    // Conectar filtros de equipo
    view.querySelectorAll('[data-filter-team]').forEach(btn => {
      btn.onclick = () => {
        activeTeamFilter = btn.getAttribute('data-filter-team');
        renderSquadView();
      };
    });

    // Conectar buscador
    const searchInp = view.querySelector('#squad-search');
    const squadList = view.querySelector('#squad-list');
    if (searchInp && squadList) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        squadList.querySelectorAll('.squad-item-card').forEach(c => {
          c.style.display = (!q || c.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    // Tocar jugador = ver ficha completa (Punto 9)
    view.querySelectorAll('.squad-item-card').forEach(card => {
      card.onclick = () => {
        const pid = card.getAttribute('data-pid');
        showPlayerFullProfileModal(pid);
      };
    });
  }

  function showCoachFullProfileModal() {
    const cp = clubData.coachProfile || {
      name: 'Entrenador Principal',
      role: 'Primer Entrenador',
      title: 'Director Técnico / Head Coach',
      license: 'UEFA Pro / Nivel 3',
      bio: 'Responsable técnico del club.',
      philosophy: '',
      phone: '',
      email: '',
      photo: ''
    };

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; padding: 18px; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #facc15;">🛡️ ${t('coachCardTitle', 'Ficha del Entrenador')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-coach-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div class="card p-hero" style="margin-bottom: 14px; padding: 14px; border: 1.5px solid rgba(250, 204, 21, 0.4); background: var(--surface2);">
          <div style="width: 64px; height: 64px; border-radius: 18px; background: rgba(250, 204, 21, 0.2); border: 2.5px solid #facc15; display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; overflow: hidden;">
            ${cp.photo ? `<img src="${cp.photo}" style="width: 100%; height: 100%; border-radius: 16px; object-fit: cover;" />` : '<span style="color: #facc15; font-weight: 900; font-size: 22px;">DR</span>'}
          </div>
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 2px; color: #fff;">
              ${escapeHtml(cp.name || 'Entrenador Principal')}
            </h2>
            <div style="font-size: 12px; color: var(--cyan); font-weight: 800;">
              ${escapeHtml(cp.role || cp.title || 'Director Técnico')}
            </div>
            ${cp.license ? `
              <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                🏅 Licencia: ${escapeHtml(cp.license)}
              </div>
            ` : ''}
          </div>
        </div>

        ${(cp.bio || cp.philosophy) ? `
          <div class="card" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); background: var(--bg2);">
            ${cp.bio ? `
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase; margin-bottom: 4px;">${t('coachBio', 'Presentación / Trayectoria')}</div>
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #e2e8f0;">
                ${escapeHtml(cp.bio)}
              </p>
            ` : ''}
            ${cp.philosophy ? `
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase; margin-bottom: 4px;">${t('notes', 'Filosofía y Metodología')}</div>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #e2e8f0;">
                ${escapeHtml(cp.philosophy)}
              </p>
            ` : ''}
          </div>
        ` : ''}

        ${(cp.phone || cp.email) ? `
          <div class="card" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); background: var(--bg2); display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
            ${cp.phone ? `<div>📞 <b>${t('contact', 'Contacto')}:</b> ${escapeHtml(cp.phone)}</div>` : ''}
            ${cp.email ? `<div>✉️ <b>Email:</b> ${escapeHtml(cp.email)}</div>` : ''}
          </div>
        ` : ''}

        <!-- BOTONES DE CONTACTO: LLAMADA Y VIBER -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          ${cp.phone ? `
            <a href="tel:${encodeURIComponent(cp.phone.replace(/[^0-9+]/g, ''))}" class="btn ghost sm" style="flex: 1; text-decoration: none; font-size: 12.5px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface2); color: #fff;">
              📞 ${t('callCoach', 'Llamar')}
            </a>
            <a href="viber://chat?number=${encodeURIComponent(cp.phone.replace(/[^0-9+]/g, ''))}" target="_blank" rel="noopener" class="btn sm" style="flex: 1; text-decoration: none; font-size: 12.5px; font-weight: 800; background: #7c3aed; color: #ffffff !important; border: 1.5px solid #a855f7; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px;">
              🟣 Viber
            </a>
          ` : `
            <a href="viber://forward?text=${encodeURIComponent(t('viberCoachContactMsg', '¡Hola míster!'))}" target="_blank" rel="noopener" class="btn sm" style="flex: 1; text-decoration: none; font-size: 12.5px; font-weight: 800; background: #7c3aed; color: #ffffff !important; border: 1.5px solid #a855f7; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px;">
              🟣 ${t('messageViaViber', 'Mensaje por Viber')}
            </a>
          `}
        </div>

        <button type="button" class="btn block primary" id="btn-coach-chat" style="height: 44px; font-weight: 800; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          ${t('chatWithCoach', '💬 Chatear con el Entrenador')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-coach-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const btnChat = overlay.querySelector('#btn-coach-chat');
    if (btnChat) {
      btnChat.onclick = () => {
        close();
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }
        if (window.ChatUI && ChatUI.startDirectChat) {
          const myP = getMyPlayer();
          ChatUI.startDirectChat('coach', cp.name || 'Entrenador', {
            currentUserId: myPlayerId,
            currentUserName: myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador',
            isCoach: false,
            players: clubData.players || [],
            teams: clubData.teams || []
          });
        }
      };
    }

    document.body.appendChild(overlay);
  }

  function showPlayerFullProfileModal(pid) {
    const p = (clubData.players || []).find(x => x.id === pid);
    if (!p) return;

    const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
    const stats = calculatePlayerStats(pid);
    const radar = calculatePlayerRadar(pid);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 94%; max-width: 480px; padding: 18px; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900;">${t('fullProfile')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-pfull-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div class="card p-hero" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--border);">
          ${renderAvatar(p, 'lg')}
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 2px;">
              #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
            </h2>
            <div style="font-size: 12px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <span class="pos-tag">${formatPosition(p.mainPosition)}</span>
              ${(p.secondaryPositions && p.secondaryPositions.length) ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.4); font-size: 11px;">🔄 ${formatPositionsList(p.secondaryPositions)}</span>` : ''}
              <span>•</span>
              <span>${getPlayerFootLabel(p.foot)}</span>
              ${team ? `<span>• 🛡️ ${escapeHtml(team.name)}</span>` : ''}
            </div>
            ${p.birthDate ? `
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                <span>🎂</span>
                <span>${p.birthDate}</span>
                <span style="color: var(--cyan); font-weight: 800;">(${calculateAgeYearsMonths(p.birthDate, currentLang)})</span>
              </div>
            ` : ''}
            <div style="margin-top: 6px; font-size: 13.5px; font-weight: 900; color: #22d3ee;">
              ⭐ ${t('performanceRating')}: ${stats.aggregatedRating} / 10
            </div>
          </div>
        </div>

        <!-- Radar -->
        <div class="card" style="margin-bottom: 12px; border: 1px solid var(--border);" id="dlg-radar-box">
          ${renderRadarSVG(radar)}
        </div>

        <!-- Cifras -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; margin-bottom: 14px;">
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: var(--match);">${t('matchesAttended')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #fff;">${stats.matchesAttended}</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: var(--train);">${t('trainingsAttended')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #fff;">${stats.trainingsAttended}</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #86efac;">${t('goalsScored')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #86efac;">${stats.goals}</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: var(--cyan);">${t('passAccuracy')}</div>
            <div style="font-size: 18px; font-weight: 900; color: var(--cyan);">${stats.passAcc}%</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #facc15;">${t('shotAccuracy')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #facc15;">${stats.shotAcc}%</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #c084fc;">${t('ballTouches')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #c084fc;">${stats.touches}</div>
          </div>
        </div>

        <!-- Botón Chatear con este jugador (Punto 8) -->
        ${pid !== myPlayerId ? `
          <button type="button" class="btn block primary" id="btn-chat-with-player-${pid}" style="height: 42px; font-weight: 800; font-size: 13.5px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            💬 ${t('chatWithPlayer', 'Chatear con este compañero')}
          </button>
        ` : ''}

        <!-- Mapa Táctico de Goles por Zonas (Punto 10) -->
        ${renderPlayerGoalsPitchHtml(pid)}

        <!-- Partidos Recientes -->
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px;">${t('recentMatchesTitle')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${renderPlayerMatchHistory(pid)}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-pfull-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const btnChat = overlay.querySelector(`#btn-chat-with-player-${pid}`);
    if (btnChat) {
      btnChat.onclick = () => {
        close();
        if (window.ChatUI && ChatUI.startDirectChat) {
          const myP = getMyPlayer();
          ChatUI.startDirectChat(pid, `${p.name || ''} ${p.lastName || ''}`.trim(), {
            currentUserId: myPlayerId,
            currentUserName: myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador',
            isCoach: false
          });
          const tabBtn = document.querySelector('#portal-tabbar [data-tab="chat"]');
          if (tabBtn) tabBtn.click();
        }
      };
    }

    overlay.querySelectorAll('.radar-click-label').forEach(el => {
      el.onclick = () => {
        const skill = el.getAttribute('data-skill');
        showSkillExplanationModal(skill);
      };
    });

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     PESTAÑA 4: FACE TO FACE (COMPARADOR ENTRE COMPAÑEROS)
     ------------------------------------------------------------- */
  let h2hPlayer1Id = null;
  let h2hPlayer2Id = null;

  function renderH2HView() {
    if (!hasApprovedProfile()) {
      renderNoProfileAccessView(t('h2h', 'Face to Face'));
      return;
    }
    const players = clubData && clubData.players ? clubData.players : [];

    if (players.length < 2) {
      view.innerHTML = `
        <div style="padding: 24px 0; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">⚔️</div>
            <h3>${t('h2hTitle')}</h3>
            <p>${t('h2hNeedTwo')}</p>
          </div>
        </div>
      `;
      return;
    }

    if (!h2hPlayer1Id) h2hPlayer1Id = myPlayerId || players[0].id;
    if (!h2hPlayer2Id) {
      const other = players.find(p => p.id !== h2hPlayer1Id);
      h2hPlayer2Id = other ? other.id : players[1].id;
    }

    const p1 = players.find(p => p.id === h2hPlayer1Id) || players[0];
    const p2 = players.find(p => p.id === h2hPlayer2Id) || players[1];

    const s1 = calculatePlayerStats(p1.id);
    const s2 = calculatePlayerStats(p2.id);
    const r1 = calculatePlayerRadar(p1.id);
    const r2 = calculatePlayerRadar(p2.id);

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 4px;">${t('h2hTitle')}</h2>
        <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px;">${t('h2hDesc')}</p>

        <!-- Selector Cara a Cara -->
        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-bottom: 14px;">
          <!-- Jugador 1 -->
          <div class="card" style="padding: 10px; text-align: center; border: 1.5px solid #22d3ee; cursor: pointer;" id="btn-change-h2h-1">
            ${renderAvatar(p1, 'md')}
            <h4 style="margin: 6px 0 2px; font-size: 13.5px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              #${p1.mainDorsal != null ? p1.mainDorsal : '-'} ${escapeHtml(p1.name || '')}
            </h4>
            <span class="pos-tag" style="font-size: 10.5px;">${formatPosition(p1.mainPosition)}</span>
            <div style="font-size: 11px; color: #22d3ee; margin-top: 4px; font-weight: 800;">${t('changeProfile')}</div>
          </div>

          <div style="font-size: 20px; font-weight: 900; color: var(--muted);">VS</div>

          <!-- Jugador 2 -->
          <div class="card" style="padding: 10px; text-align: center; border: 1.5px solid #f472b6; cursor: pointer;" id="btn-change-h2h-2">
            ${renderAvatar(p2, 'md')}
            <h4 style="margin: 6px 0 2px; font-size: 13.5px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              #${p2.mainDorsal != null ? p2.mainDorsal : '-'} ${escapeHtml(p2.name || '')}
            </h4>
            <span class="pos-tag" style="font-size: 10.5px;">${formatPosition(p2.mainPosition)}</span>
            <div style="font-size: 11px; color: #f472b6; margin-top: 4px; font-weight: 800;">${t('changeProfile')}</div>
          </div>
        </div>

        <!-- Duelos Métricos -->
        <div class="card" style="margin-bottom: 14px; padding: 14px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;">
          ${renderH2HMetricRow(t('performanceRating'), `⭐ ${s1.aggregatedRating}`, `⭐ ${s2.aggregatedRating}`, '⭐')}
          ${renderH2HMetricRow(t('matchesAttended'), s1.matchesAttended, s2.matchesAttended, '🏟️')}
          ${renderH2HMetricRow(t('trainingsAttended'), s1.trainingsAttended, s2.trainingsAttended, '🏃‍♂️')}
          ${renderH2HMetricRow(t('goalsScored'), s1.goals, s2.goals, '⚽')}
          ${renderH2HMetricRow(t('passAccuracy'), s1.passAcc + '%', s2.passAcc + '%', '🎯')}
          ${renderH2HMetricRow(t('shotAccuracy'), s1.shotAcc + '%', s2.shotAcc + '%', '🎯')}
          ${renderH2HMetricRow(t('ballTouches'), s1.touches, s2.touches, '👟')}
        </div>

        <!-- Radares individuales -->
        <div class="section-title"><span>${t('comparativeRadars', 'Comparative Skill Radars')}</span></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="card" style="padding: 8px; text-align: center; border: 1px solid var(--border);">
            <b style="font-size: 12px; color: #22d3ee;">${escapeHtml(p1.name || '')}</b>
            ${renderRadarSVG(r1)}
          </div>
          <div class="card" style="padding: 8px; text-align: center; border: 1px solid var(--border);">
            <b style="font-size: 12px; color: #f472b6;">${escapeHtml(p2.name || '')}</b>
            ${renderRadarSVG(r2)}
          </div>
        </div>
      </div>
    `;

    function renderH2HMetricRow(label, v1, v2, icon) {
      const num1 = parseFloat(String(v1).replace(/[^0-9.]/g, '')) || 0;
      const num2 = parseFloat(String(v2).replace(/[^0-9.]/g, '')) || 0;
      const c1 = num1 > num2 ? '#22d3ee; font-weight: 900;' : (num1 === num2 ? '#fff;' : 'var(--muted);');
      const c2 = num2 > num1 ? '#f472b6; font-weight: 900;' : (num1 === num2 ? '#fff;' : 'var(--muted);');

      return `
        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
          <div style="color: ${c1}; text-align: right; font-size: 15px;">${v1}</div>
          <div style="font-size: 11.5px; font-weight: 800; color: var(--muted); text-align: center; padding: 0 10px;">
            ${icon} ${label}
          </div>
          <div style="color: ${c2}; text-align: left; font-size: 15px;">${v2}</div>
        </div>
      `;
    }

    view.querySelector('#btn-change-h2h-1').onclick = () => showPickerForH2H(1);
    view.querySelector('#btn-change-h2h-2').onclick = () => showPickerForH2H(2);

    view.querySelectorAll('.radar-click-label').forEach(el => {
      el.onclick = () => {
        const skill = el.getAttribute('data-skill');
        showSkillExplanationModal(skill);
      };
    });
  }

  function showPickerForH2H(targetSlot) {
    const players = clubData.players || [];
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 80vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">${t('choosePlayer')} ${targetSlot}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-h2h-x" style="width: 32px; height: 32px;">✕</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 60vh; overflow-y: auto;">
          ${players.map(p => `
            <div class="h2h-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer;">
              ${renderAvatar(p, 'sm')}
              <b>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</b>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-h2h-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelectorAll('.h2h-pick-item').forEach(it => {
      it.onclick = () => {
        const pid = it.getAttribute('data-pid');
        if (targetSlot === 1) h2hPlayer1Id = pid;
        else h2hPlayer2Id = pid;
        close();
        renderH2HView();
      };
    });

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     RENDERIZADO Y NAVEGACIÓN
     ------------------------------------------------------------- */
  function updateTabbarLabels() {
    const tabbar = document.getElementById('portal-tabbar');
    if (!tabbar) return;
    const labels = {
      convocations: t('convocations'),
      stats: t('myProfile'),
      squad: t('squad'),
      h2h: t('h2h'),
      chat: t('chat', 'Chat')
    };
    tabbar.querySelectorAll('.tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      const lbl = btn.querySelector('.t-lbl');
      if (lbl && labels[tab]) lbl.textContent = labels[tab];
    });
  }

  function renderChatTab() {
    if (!hasApprovedProfile()) {
      renderNoProfileAccessView(t('chat', 'Chat'));
      return;
    }
    if (!window.ChatUI) {
      view.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);">Chat no disponible</div>';
      return;
    }
    const myP = getMyPlayer();
    window.ChatUI.renderChatList(view, {
      currentUserId: myPlayerId,
      currentUserName: myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Player',
      isCoach: false,
      players: (clubData && clubData.players) ? clubData.players : [],
      teams: (clubData && clubData.teams) ? clubData.teams : []
    });
  }

  function renderCurrentTab() {
    updateTabbarLabels();
    if (currentTab === 'convocations') renderConvocationsView();
    else if (currentTab === 'stats') renderMyStatsView();
    else if (currentTab === 'squad') renderSquadView();
    else if (currentTab === 'h2h') renderH2HView();
    else if (currentTab === 'chat') renderChatTab();
  }

  function setupNavigation() {
    document.querySelectorAll('#portal-tabbar .tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;
        currentTab = tab;
        document.querySelectorAll('#portal-tabbar .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        haptic(20);
        renderCurrentTab();
      };
    });

    const myInfoBtn = document.getElementById('portal-my-info-btn');
    if (myInfoBtn) {
      myInfoBtn.onclick = (e) => {
        e.stopPropagation();
        if (isProfileLocked()) {
          const tabBtn = document.querySelector('#portal-tabbar [data-tab="stats"]');
          if (tabBtn) tabBtn.click();
        } else {
          showSelectIdentityModal();
        }
      };
    }

    const lblChange = document.getElementById('portal-lbl-change');
    if (lblChange) {
      lblChange.onclick = (e) => {
        e.stopPropagation();
        if (isProfileLocked()) {
          showRequestProfileChangeModal();
        } else {
          showSelectIdentityModal();
        }
      };
    }

    const btnLang = document.getElementById('btn-portal-lang');
    if (btnLang) {
      btnLang.textContent = currentLang.toUpperCase();
      btnLang.onclick = () => {
        currentLang = currentLang === 'en' ? 'es' : 'en';
        try { localStorage.setItem('lang', currentLang); } catch (e) {}
        btnLang.textContent = currentLang.toUpperCase();
        updateHeaderIdentity();
        renderCurrentTab();
      };
    }
  }

  /* -------------------------------------------------------------
     MANEJO DE RECORDATORIOS DE ASISTENCIA ENVIADOS POR EL ENTRENADOR
     ------------------------------------------------------------- */
  function handleIncomingConvocationReminder(reminder) {
    if (!reminder || !reminder.id) return;
    const seenKey = 'reminder_seen_' + reminder.id;
    if (localStorage.getItem(seenKey)) return;
    try { localStorage.setItem(seenKey, 'true'); } catch (e) {}

    const convId = reminder.convId;
    if (convId && liveVotes[convId] && liveVotes[convId][myPlayerId]) {
      const existingStatus = liveVotes[convId][myPlayerId].status;
      if (existingStatus === 'called' || existingStatus === 'attending' || existingStatus === 'yes' || existingStatus === 'absent' || existingStatus === 'no') {
        return;
      }
    }

    const title = reminder.title || 'Call-up Attendance Reminder';
    const message = reminder.message || 'Coach Daniel Requena is waiting for your attendance response. Please respond now!';

    if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
      try { window.AndroidBridge.showSystemNotification(title, message); } catch (e) {}
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: message, icon: 'icons/icon-192.png' }); } catch (e) {}
    }

    haptic(60);
    toast(`🔔 ${title}`, 'info');

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <div class="dialog-box" style="width: 90%; max-width: 420px; text-align: center; padding: 22px 18px;">
        <div style="font-size: 44px; margin-bottom: 8px;">📋</div>
        <h3 style="margin: 0 0 8px; font-size: 17.5px; font-weight: 900; color: #fff;">${escapeHtml(title)}</h3>
        <p style="font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0 0 18px;">
          ${escapeHtml(message)}
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn block" id="btn-remind-yes" style="height: 44px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 900; font-size: 14px; border: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
            🟢 Confirm Attendance (Yes)
          </button>
          <button type="button" class="btn block" id="btn-remind-no" style="height: 44px; background: rgba(239, 68, 68, 0.18); color: #fca5a5; font-weight: 800; font-size: 13.5px; border: 1.5px solid rgba(239, 68, 68, 0.4);">
            ❌ Can't Attend (No)
          </button>
          <button type="button" class="btn ghost block" id="btn-remind-dismiss" style="height: 38px; color: var(--muted); font-size: 12.5px;">
            Dismiss
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#btn-remind-dismiss').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const myP = getMyPlayer();
    const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Player';

    overlay.querySelector('#btn-remind-yes').onclick = async () => {
      close();
      if (convId) {
        liveVotes[convId] = liveVotes[convId] || {};
        liveVotes[convId][myPlayerId] = { status: 'called', playerName: pName, timestamp: Date.now() };
        if (window.Cloud && window.Cloud.voteAttendance) {
          try { await window.Cloud.voteAttendance(convId, myPlayerId, 'called', pName); } catch (e) {}
        }
        toast(t('attendanceConfirmed', '✅ Attendance confirmed!'), 'success');
        if (currentTab === 'convocations') renderConvocationsView();
      }
    };

    overlay.querySelector('#btn-remind-no').onclick = async () => {
      close();
      if (convId) {
        liveVotes[convId] = liveVotes[convId] || {};
        liveVotes[convId][myPlayerId] = { status: 'absent', playerName: pName, timestamp: Date.now() };
        if (window.Cloud && window.Cloud.voteAttendance) {
          try { await window.Cloud.voteAttendance(convId, myPlayerId, 'absent', pName); } catch (e) {}
        }
        toast(t('absenceReported', '❌ Absence registered.'), 'info');
        if (currentTab === 'convocations') renderConvocationsView();
      }
    };

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     INICIALIZACIÓN Y ENLACE EN VIVO CON FIREBASE
     ------------------------------------------------------------- */
  function init() {
    // 1. Cargar caché previo si existe
    try {
      const cached = localStorage.getItem('cached_club_state');
      if (cached) {
        clubData = JSON.parse(cached);
        window.clubData = clubData;
        if (myPlayerId && Array.isArray(clubData.players) && clubData.players.length > 0) {
          const isPending = (myPlayerId === localStorage.getItem('portal_pending_creation_id'));
          const stillExists = clubData.players.some(p => p.id === myPlayerId);
          if (!stillExists && !isPending) {
            handlePlayerProfileRemoved();
            return;
          }
        }
        updateHeaderIdentity();
      }
    } catch (e) {}

    setupNavigation();
    updateHeaderIdentity();
    renderCurrentTab();

    // Iniciar escucha global de mensajes no leídos para el jugador si ya tiene perfil
    if (myPlayerId && window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
      window.ChatUI.initGlobalUnreadListener(myPlayerId);
    }

    // Solicitar activación de notificaciones nativas de Android / PWA
    if (window.AndroidBridge && window.AndroidBridge.requestNotificationPermission) {
      try { window.AndroidBridge.requestNotificationPermission(); } catch (e) {}
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }

    // 2. Conectar en tiempo real con Firebase Firestore
    if (window.Cloud) {
      window.Cloud.init();

      if (myPlayerId && window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
        const curP = getMyPlayer();
        window.ChatUI.initGlobalUnreadListener(myPlayerId, curP ? curP.teamId : null);
      }

      const badge = document.getElementById('portal-cloud-badge');

      // Escuchar estado completo del club
      window.Cloud.listenToClubState((remoteState) => {
        if (!remoteState) return;

        // Comprobar si el perfil del jugador ha sido eliminado por el entrenador
        if (myPlayerId && Array.isArray(remoteState.players)) {
          const isPending = (myPlayerId === localStorage.getItem('portal_pending_creation_id'));
          const stillExists = remoteState.players.some(p => p.id === myPlayerId);
          if (!stillExists && !isPending) {
            handlePlayerProfileRemoved();
            return;
          }
        }

        if (Array.isArray(remoteState.players) && remoteState.players.length > 0) {
          clubData = remoteState;
        } else if (clubData && clubData.players && clubData.players.length > 0) {
          clubData = Object.assign({}, clubData, remoteState, {
            players: (remoteState.players && Array.isArray(remoteState.players)) ? remoteState.players : clubData.players,
            teams: (remoteState.teams && remoteState.teams.length > 0) ? remoteState.teams : clubData.teams
          });
        } else {
          clubData = remoteState;
        }
        if (remoteState.coachProfile) {
          clubData.coachProfile = remoteState.coachProfile;
        }
        if (remoteState.recurringSchedules) {
          clubData.recurringSchedules = remoteState.recurringSchedules;
        }
        if (remoteState.convocations) {
          clubData.convocations = remoteState.convocations;
        }
        window.clubData = clubData;
        try { localStorage.setItem('cached_club_state', JSON.stringify(clubData)); } catch (e) {}

        if (remoteState.settings && remoteState.settings.clubName) {
          const titleEl = document.getElementById('portal-club-title');
          if (titleEl) titleEl.textContent = remoteState.settings.clubName;
        }

        if (badge) {
          badge.textContent = `🟢 ${t('live')}`;
          badge.style.background = 'rgba(34, 197, 94, 0.15)';
          badge.style.color = '#86efac';
        }

        updateHeaderIdentity();
        renderCurrentTab();

        // Si el modal de carga estaba esperando jugadores y acaban de llegar, abrir selector
        const loadingModal = document.getElementById('dialog-id-loading-overlay');
        if (loadingModal && clubData && clubData.players && clubData.players.length > 0) {
          loadingModal.remove();
          showSelectIdentityModal();
        }
      });

      // Escuchar respuestas de asistencia de convocatorias
      if (window.Cloud.startListeningToResponses) {
        window.Cloud.startListeningToResponses((resp) => {
          if (resp && resp.convId && resp.playerId) {
            liveVotes[resp.convId] = liveVotes[resp.convId] || {};
            liveVotes[resp.convId][resp.playerId] = resp;
            if (currentTab === 'convocations') {
              renderConvocationsView();
            }
          }
        });
      }

      // Escuchar si hay alguna solicitud de cambio de perfil pendiente
      const pendingReqId = localStorage.getItem('portal_pending_req_id');
      if (pendingReqId) {
        listenToMyPendingRequest(pendingReqId);
      }

      // Escuchar si hay alguna solicitud de alta de nuevo jugador pendiente
      const pendingCreationId = localStorage.getItem('portal_pending_creation_id');
      if (pendingCreationId) {
        listenToMyCreationRequest(pendingCreationId);
      }

      // Escuchar recordatorios de convocatoria del entrenador
      if (myPlayerId && window.Cloud && window.Cloud.listenToConvocationReminders) {
        window.Cloud.listenToConvocationReminders(myPlayerId, (reminder) => {
          handleIncomingConvocationReminder(reminder);
        });
      }
    }

    // 3. Cargar datos locales de respaldo y pedir identidad si aún no la tiene
    loadInitialClubData().then(() => {
      if (!myPlayerId && clubData && clubData.players && clubData.players.length > 0) {
        setTimeout(() => {
          if (!myPlayerId) showSelectIdentityModal();
        }, 300);
      }
    });
  }

  window.__showPlayerProfile = function (pid) {
    showPlayerFullProfileModal(pid);
  };

  window.__showCoachProfile = function () {
    showCoachFullProfileModal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

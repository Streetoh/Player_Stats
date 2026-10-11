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
      touchesLabel: 'TOUCHES'
    },
    es: {
      appName: 'Player stats (Player)',
      convocations: 'Convocatorias',
      myProfile: 'Mi Ficha',
      squad: 'Plantilla',
      h2h: 'Face to Face',
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
      touchesLabel: 'TOQUES'
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

  function toast(msg, type = 'info') {
    if (!toastRoot) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
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
    if (!clubData || !clubData.players || !myPlayerId) return null;
    return clubData.players.find(p => p.id === myPlayerId) || null;
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
    const passScore = s.passAcc > 0 ? Math.min(99, Math.max(45, Math.round(s.passAcc * 0.95))) : 65;
    const shotScore = s.goals > 0 ? Math.min(99, Math.max(50, 60 + s.goals * 6)) : 55;
    const regScore = s.dribbleOk > 0 ? Math.min(99, Math.max(50, 60 + s.dribbleOk * 5)) : 60;
    const defScore = s.recoveries > 0 ? Math.min(99, Math.max(50, 55 + s.recoveries * 5)) : 55;
    const fisScore = s.totalSessions > 0 ? Math.min(99, Math.max(50, 60 + s.totalSessions * 3)) : 65;

    return {
      pas: passScore,
      tir: shotScore,
      reg: regScore,
      fis: fisScore,
      def: defScore,
      dis: 100
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
    const lockIndicatorEl = document.querySelector('#btn-select-identity span:last-child');
    const lblProfile = document.getElementById('portal-lbl-profile');
    if (lblProfile) lblProfile.textContent = t('myProfile') + ':';

    const myP = getMyPlayer();

    if (myP) {
      if (nameEl) nameEl.textContent = `#${myP.mainDorsal != null ? myP.mainDorsal : '-'} ${myP.name || ''} ${myP.lastName || ''}`.trim();
      if (avatarEl) {
        avatarEl.innerHTML = myP.photo ? `<img src="${myP.photo}" alt="" />` : `<span>${(myP.name ? myP.name[0] : 'P').toUpperCase()}</span>`;
      }
      if (lockIndicatorEl) {
        lockIndicatorEl.innerHTML = isProfileLocked() ? `🔒 ${t('locked')}` : `${t('changeProfile')}`;
        lockIndicatorEl.style.color = isProfileLocked() ? '#facc15' : 'var(--cyan)';
      }
    } else {
      if (nameEl) nameEl.textContent = t('selectIdentity');
      if (avatarEl) avatarEl.innerHTML = '<span>?</span>';
      if (lockIndicatorEl) {
        lockIndicatorEl.textContent = `${t('changeProfile')}`;
        lockIndicatorEl.style.color = 'var(--cyan)';
      }
    }

    const btnLang = document.getElementById('btn-portal-lang');
    if (btnLang) btnLang.textContent = currentLang.toUpperCase();
    const badge = document.getElementById('portal-cloud-badge');
    if (badge) badge.textContent = `🟢 ${t('live')}`;
  }

  /* -------------------------------------------------------------
     SOLICITUD DE CAMBIO DE PERFIL (PUNTO 6)
     ------------------------------------------------------------- */
  function showSelectIdentityModal() {
    if (!clubData || !clubData.players || clubData.players.length === 0) {
      toast(t('loadingPlayers'), 'info');
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

        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow-y: auto;" id="id-players-list">
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
                    ${p.mainPosition || 'Jugador'} ${team ? '• ' + escapeHtml(team.name) : ''}
                  </small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dialog-id-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

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
        myPlayerId = pid;
        try {
          localStorage.setItem('portal_player_id', pid);
          localStorage.setItem('portal_player_locked', 'true');
        } catch (e) {}
        haptic(35);
        updateHeaderIdentity();
        close();
        toast(t('linkedSuccess'), 'success');
        renderCurrentTab();
      };
    });

    document.body.appendChild(overlay);
    if (searchInp) setTimeout(() => searchInp.focus(), 80);
  }

  function showRequestProfileChangeModal() {
    const myP = getMyPlayer();
    const curName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador Actual';
    const players = (clubData.players || []).filter(p => p.id !== myPlayerId).sort((a,b) => (a.name||'').localeCompare(b.name||''));

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #facc15;">🔒 ${t('reqChangeTitle')}</h3>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-req-close" style="width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.5;">
          ${t('reqChangeDesc').replace('{name}', `<b>${escapeHtml(curName)}</b>`)}
        </p>

        <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 6px;">
          ${t('selectNewPlayer')}
        </label>
        <select id="sel-target-player" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px; margin-bottom: 10px; font-weight: 700;">
          <option value="">${t('chooseWhoYouAre')}</option>
          ${players.map(p => `
            <option value="${p.id}">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')} (${p.mainPosition || 'Jugador'})</option>
          `).join('')}
        </select>

        <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 6px;">
          ${t('reasonLabel')}
        </label>
        <input type="text" id="inp-req-reason" placeholder="${t('reasonPlaceholder')}" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13px; margin-bottom: 14px;" />

        <button type="button" class="btn block primary" id="btn-submit-req" style="height: 44px; font-weight: 800; font-size: 13.5px;">
          ${t('sendReqBtn')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-req-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const btnSubmit = overlay.querySelector('#btn-submit-req');
    btnSubmit.onclick = async () => {
      const targetPid = overlay.querySelector('#sel-target-player').value;
      if (!targetPid) {
        toast(t('reqSelectTargetErr'), 'error');
        return;
      }
      const targetP = (clubData.players || []).find(p => p.id === targetPid);
      const targetName = targetP ? `${targetP.name || ''} ${targetP.lastName || ''}`.trim() : 'Nuevo Jugador';
      const reason = overlay.querySelector('#inp-req-reason').value.trim();

      btnSubmit.disabled = true;
      btnSubmit.textContent = t('sending');

      const reqId = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const reqData = {
        id: reqId,
        deviceId: getDeviceId(),
        fromPlayerId: myPlayerId,
        fromPlayerName: curName,
        toPlayerId: targetPid,
        toPlayerName: targetName,
        reason: reason,
        status: 'pending',
        createdAt: Date.now()
      };

      try {
        if (window.Cloud && window.Cloud.submitProfileRequest) {
          await window.Cloud.submitProfileRequest(reqData);
          localStorage.setItem('portal_pending_req_id', reqId);
          close();
          toast(t('reqSentSuccess'), 'success');
          listenToMyPendingRequest(reqId);
          renderCurrentTab();
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

    const allPlayersMap = {};
    (clubData.players || []).forEach(p => { allPlayersMap[p.id] = p; });

    view.innerHTML = `
      <div style="padding: 10px 0;">
        ${bannerHtml}
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${convs.map(c => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === c.teamId) : null;
            const list = c.list || {};
            const responses = liveVotes[c.id] || {};

            // SÓLO jugadores efectivamente convocados (st !== 'uncalled')
            const calledPlayerIds = Object.keys(list).filter(pid => {
              const st = list[pid];
              return st && st !== 'uncalled';
            });

            const isCalled = myPlayerId ? calledPlayerIds.includes(myPlayerId) : false;

            // Recuentos reales entre los convocados
            let nAttending = 0;
            let nAbsent = 0;
            let nPending = 0;

            calledPlayerIds.forEach(pid => {
              const r = responses[pid];
              const st = r ? r.status : list[pid];
              if (st === 'called' || st === 'attending' || st === 'yes') nAttending++;
              else if (st === 'absent' || st === 'no') nAbsent++;
              else nPending++;
            });

            // Voto del usuario actual
            const myVoteObj = myPlayerId ? (responses[myPlayerId] || (c.responses && c.responses[myPlayerId])) : null;
            const mySt = myVoteObj ? myVoteObj.status : (list[myPlayerId] || null);
            const isAttending = (mySt === 'called' || mySt === 'attending' || mySt === 'yes');
            const isAbsent = (mySt === 'absent' || mySt === 'no');

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
                      📅 <b>${c.date}</b> • ⏰ ${c.time || '10:00'}<br />
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
      </div>
    `;

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

        // Feedback visual inmediato
        const box = btn.closest('.portal-vote-box');
        if (box) {
          box.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const badge = document.getElementById(`vote-badge-${cid}`);
          if (badge) {
            badge.textContent = vote === 'called' ? t('attendanceConfirmed') : t('absenceReported');
            badge.style.background = vote === 'called' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)';
            badge.style.color = vote === 'called' ? '#86efac' : '#fca5a5';
          }
        }

        try {
          if (window.Cloud && window.Cloud.voteAttendance) {
            await window.Cloud.voteAttendance(cid, myPlayerId, vote, pName);
            toast(vote === 'called' ? t('attendanceConfirmed') : t('absenceReported'), 'success');
          } else {
            toast('Guardado localmente.', 'info');
          }
        } catch (err) {
          console.error(err);
          toast('Error: ' + err.message, 'error');
        }
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
      const r = responses[pid];
      const st = r ? r.status : list[pid];

      if (st === 'called' || st === 'attending' || st === 'yes') attending.push(p);
      else if (st === 'absent' || st === 'no') absent.push(p);
      else pending.push(p);
    });

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">${t('attendeesTitle')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-attendees-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="font-size: 12.5px; font-weight: 800; color: #86efac; margin: 8px 0 4px;">
          🟢 ${t('confirmedBadge').toUpperCase()} (${attending.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; max-height: 25vh; overflow-y: auto;">
          ${attending.length === 0 ? `<span style="font-size: 12px; color: var(--muted);">${t('noAttendeesYet')}</span>` : attending.map(p => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface2); padding: 6px 10px; border-radius: 8px;">
              ${renderAvatar(p, 'sm')}
              <b>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</b>
            </div>
          `).join('')}
        </div>

        <div style="font-size: 12.5px; font-weight: 800; color: #fca5a5; margin: 8px 0 4px;">
          ❌ ${t('absentBadge').toUpperCase()} (${absent.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; max-height: 20vh; overflow-y: auto;">
          ${absent.length === 0 ? `<span style="font-size: 12px; color: var(--muted);">${t('noAbsentYet')}</span>` : absent.map(p => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface2); padding: 6px 10px; border-radius: 8px;">
              ${renderAvatar(p, 'sm')}
              <span>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
            </div>
          `).join('')}
        </div>

        <div style="font-size: 12.5px; font-weight: 800; color: #fde047; margin: 8px 0 4px;">
          ⏳ ${t('pendingBadge').toUpperCase()} (${pending.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 20vh; overflow-y: auto;">
          ${pending.length === 0 ? `<span style="font-size: 12px; color: var(--muted);">${t('allAnswered')}</span>` : pending.map(p => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); background: var(--surface2); padding: 6px 10px; border-radius: 8px;">
              ${renderAvatar(p, 'sm')}
              <span>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-attendees-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
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

    const team = clubData.teams ? clubData.teams.find(t => t.id === myP.teamId) : null;
    const stats = calculatePlayerStats(myP.id);
    const radar = calculatePlayerRadar(myP.id);

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <!-- Ficha Hero -->
        <div class="card p-hero" style="margin-bottom: 14px; border: 1px solid var(--border);">
          ${renderAvatar(myP, 'lg')}
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 19px; font-weight: 900; margin: 0 0 4px;">
              ${escapeHtml(myP.name || '')} ${escapeHtml(myP.lastName || '')}
            </h2>
            <div class="meta" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted);">
              <span class="pos-tag">${myP.mainPosition || 'Jugador'}</span>
              <span>•</span>
              <span>#${myP.mainDorsal != null ? myP.mainDorsal : '—'}</span>
              <span>•</span>
              <span>${getPlayerFootLabel(myP.foot)}</span>
            </div>
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

  /* -------------------------------------------------------------
     PESTAÑA 3: PLANTILLA Y DEMÁS EQUIPOS (PUNTO 9)
     ------------------------------------------------------------- */
  function renderSquadView() {
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
                    <span class="pos-tag">${p.mainPosition || 'Jugador'}</span>
                    <span>•</span>
                    <span>${getPlayerFootLabel(p.foot)}</span>
                    ${team ? `<span>• 🛡️ ${escapeHtml(team.name)}</span>` : ''}
                  </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 13px; font-weight: 900; color: #22d3ee;">⭐ ${pStats.aggregatedRating}</div>
                  <small style="font-size: 10.5px; color: var(--muted);">⚽ ${pStats.goals} goles</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

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
            <div style="font-size: 12px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap;">
              <span class="pos-tag">${p.mainPosition || 'Jugador'}</span>
              <span>•</span>
              <span>${getPlayerFootLabel(p.foot)}</span>
              ${team ? `<span>• 🛡️ ${escapeHtml(team.name)}</span>` : ''}
            </div>
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
            <span class="pos-tag" style="font-size: 10.5px;">${p1.mainPosition || 'Jugador'}</span>
            <div style="font-size: 11px; color: #22d3ee; margin-top: 4px; font-weight: 800;">${t('changeProfile')}</div>
          </div>

          <div style="font-size: 20px; font-weight: 900; color: var(--muted);">VS</div>

          <!-- Jugador 2 -->
          <div class="card" style="padding: 10px; text-align: center; border: 1.5px solid #f472b6; cursor: pointer;" id="btn-change-h2h-2">
            ${renderAvatar(p2, 'md')}
            <h4 style="margin: 6px 0 2px; font-size: 13.5px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              #${p2.mainDorsal != null ? p2.mainDorsal : '-'} ${escapeHtml(p2.name || '')}
            </h4>
            <span class="pos-tag" style="font-size: 10.5px;">${p2.mainPosition || 'Jugador'}</span>
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
        <div class="section-title"><span>Radares Comparativos</span></div>
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
      h2h: t('h2h')
    };
    tabbar.querySelectorAll('.tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      const lbl = btn.querySelector('.t-lbl');
      if (lbl && labels[tab]) lbl.textContent = labels[tab];
    });
  }

  function renderCurrentTab() {
    updateTabbarLabels();
    if (currentTab === 'convocations') renderConvocationsView();
    else if (currentTab === 'stats') renderMyStatsView();
    else if (currentTab === 'squad') renderSquadView();
    else if (currentTab === 'h2h') renderH2HView();
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

    const btnIdentity = document.getElementById('btn-select-identity');
    if (btnIdentity) btnIdentity.onclick = showSelectIdentityModal;

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
     INICIALIZACIÓN Y ENLACE EN VIVO CON FIREBASE
     ------------------------------------------------------------- */
  function init() {
    // 1. Cargar caché previo si existe
    try {
      const cached = localStorage.getItem('cached_club_state');
      if (cached) {
        clubData = JSON.parse(cached);
        updateHeaderIdentity();
      }
    } catch (e) {}

    setupNavigation();
    updateHeaderIdentity();
    renderCurrentTab();

    // 2. Conectar en tiempo real con Firebase Firestore
    if (window.Cloud) {
      window.Cloud.init();

      const badge = document.getElementById('portal-cloud-badge');

      // Escuchar estado completo del club
      window.Cloud.listenToClubState((remoteState) => {
        if (!remoteState) return;
        clubData = remoteState;
        try { localStorage.setItem('cached_club_state', JSON.stringify(remoteState)); } catch (e) {}

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
    }

    // Si aún no ha seleccionado identidad, pedirla tras breve retardo
    if (!myPlayerId) {
      setTimeout(() => {
        if (!myPlayerId && clubData && clubData.players && clubData.players.length > 0) {
          showSelectIdentityModal();
        }
      }, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

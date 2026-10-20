/* =========================================================
   Store: modelo de datos, persistencia y cálculo de estadísticas
   - Guardado inmediato en localStorage en cada acción
   - Espejo en almacenamiento interno nativo (Android) como respaldo
   - Orden canónico estricto de botones
   - Idioma y presets configurables
   ========================================================= */
(function () {
  'use strict';

  const LS_KEY = 'pst_state_v1';

  /* Catálogo de acciones contables en ORDEN CANÓNICO ESTRICTO */
  const STATS = [
    { key: 'touches',   labelKey: 'stat_touches',   shortKey: 'short_touches',   emoji: '⚽', color: '#94a3b8', def: true },
    { key: 'passOk',    labelKey: 'stat_passOk',    shortKey: 'short_passOk',    emoji: '✅', color: '#22c55e', def: true },
    { key: 'passOk_split', baseKey: 'passOk', isSplit: true, labelKey: 'stat_passOk_split', shortKey: 'short_passOk_split', emoji: '✅', color: '#22c55e', def: false },
    { key: 'passKo',    labelKey: 'stat_passKo',    shortKey: 'short_passKo',    emoji: '❌', color: '#ef4444', def: true },
    { key: 'passKo_split', baseKey: 'passKo', isSplit: true, labelKey: 'stat_passKo_split', shortKey: 'short_passKo_split', emoji: '❌', color: '#ef4444', def: false },
    { key: 'shotOn',    labelKey: 'stat_shotOn',    shortKey: 'short_shotOn',    emoji: '🎯', color: '#06b6d4', def: true },
    { key: 'shotOn_split', baseKey: 'shotOn', isSplit: true, labelKey: 'stat_shotOn_split', shortKey: 'short_shotOn_split', emoji: '🎯', color: '#06b6d4', def: false },
    { key: 'shotOff',   labelKey: 'stat_shotOff',   shortKey: 'short_shotOff',   emoji: '↗️', color: '#f97316', def: true },
    { key: 'shotOff_split', baseKey: 'shotOff', isSplit: true, labelKey: 'stat_shotOff_split', shortKey: 'short_shotOff_split', emoji: '↗️', color: '#f97316', def: false },
    { key: 'goal',      labelKey: 'stat_goal',      shortKey: 'short_goal',      emoji: '🥅', color: '#facc15', def: true, linked: ['shotOn'] },
    { key: 'goal_split', baseKey: 'goal', isSplit: true, labelKey: 'stat_goal_split', shortKey: 'short_goal_split', emoji: '🥅', color: '#facc15', def: false, linked: ['shotOn'] },
    { key: 'assist',    labelKey: 'stat_assist',    shortKey: 'short_assist',    emoji: '🅰️', color: '#a855f7', def: true },
    { key: 'dribbleOk', labelKey: 'stat_dribbleOk', shortKey: 'short_dribbleOk', emoji: '💨', color: '#14b8a6', def: true },
    { key: 'dribbleKo', labelKey: 'stat_dribbleKo', shortKey: 'short_dribbleKo', emoji: '🚫', color: '#be123c', def: false },
    { key: 'recovery',  labelKey: 'stat_recovery',  shortKey: 'short_recovery',  emoji: '🛡️', color: '#3b82f6', def: true },
    { key: 'loss',      labelKey: 'stat_loss',      shortKey: 'short_loss',      emoji: '⚠️', color: '#f43f5e', def: true },
    { key: 'duelWon',   labelKey: 'stat_duelWon',   shortKey: 'short_duelWon',   emoji: '💪', color: '#84cc16', def: false },
    { key: 'duelLost',  labelKey: 'stat_duelLost',  shortKey: 'short_duelLost',  emoji: '🤕', color: '#e11d48', def: false },
    { key: 'cross',     labelKey: 'stat_cross',     shortKey: 'short_cross',     emoji: '🔀', color: '#0ea5e9', def: false },
    { key: 'keyPass',   labelKey: 'stat_keyPass',   shortKey: 'short_keyPass',   emoji: '🔑', color: '#d946ef', def: false },
    { key: 'header',    labelKey: 'stat_header',    shortKey: 'short_header',    emoji: '🗣️', color: '#64748b', def: false },
    { key: 'foulRecv',  labelKey: 'stat_foulRecv',  shortKey: 'short_foulRecv',  emoji: '🙋', color: '#10b981', def: false },
    { key: 'foul',      labelKey: 'stat_foul',      shortKey: 'short_foul',      emoji: '🦵', color: '#fb923c', def: false },
    { key: 'save',      labelKey: 'stat_save',      shortKey: 'short_save',      emoji: '🧤', color: '#38bdf8', def: false },
    { key: 'yellow',    labelKey: 'stat_yellow',    shortKey: 'short_yellow',    emoji: '🟨', color: '#eab308', def: false },
    { key: 'red',       labelKey: 'stat_red',       shortKey: 'short_red',       emoji: '🟥', color: '#dc2626', def: false },
    { key: 'duel1v1WonGoal',     labelKey: 'stat_duel1v1WonGoal',     shortKey: 'short_duel1v1WonGoal',     emoji: '⚽', color: '#22c55e', def: false },
    { key: 'duel1v1WonStop',     labelKey: 'stat_duel1v1WonStop',     shortKey: 'short_duel1v1WonStop',     emoji: '🛡️', color: '#3b82f6', def: false },
    { key: 'duel1v1LostTurnover', labelKey: 'stat_duel1v1LostTurnover', shortKey: 'short_duel1v1LostTurnover', emoji: '❌', color: '#f43f5e', def: false },
    { key: 'duel1v1LostGoal',     labelKey: 'stat_duel1v1LostGoal',     shortKey: 'short_duel1v1LostGoal',     emoji: '🥅', color: '#ef4444', def: false }
  ];

  // Helper para textos dinámicos según idioma
  STATS.forEach(s => {
    Object.defineProperty(s, 'label', {
      get: function () { return window.t ? window.t(s.labelKey, s.key) : s.key; }
    });
    Object.defineProperty(s, 'short', {
      get: function () { return window.t ? window.t(s.shortKey, s.key) : s.key; }
    });
  });

  const STAT_MAP = {};
  STATS.forEach(s => { STAT_MAP[s.key] = s; });

  /* Métricas derivadas (porcentajes) */
  const RATIOS = [
    { key: 'passAcc',    labelKey: 'passAccuracy', ok: 'passOk',    total: ['passOk', 'passKo'],     color: '#22c55e' },
    { key: 'shotAcc',    labelKey: 'shotAccuracy', ok: 'shotOn',    total: ['shotOn', 'shotOff'],    color: '#06b6d4' },
    { key: 'conversion', labelKey: 'totalGoals',   ok: 'goal',      total: ['shotOn', 'shotOff'],    color: '#facc15' },
    { key: 'dribbleAcc', labelKey: 'stat_dribbleOk', ok: 'dribbleOk', total: ['dribbleOk', 'dribbleKo'], color: '#14b8a6' },
    { key: 'duelAcc',    labelKey: 'stat_duelWon',   ok: 'duelWon',   total: ['duelWon', 'duelLost'],  color: '#84cc16' }
  ];

  RATIOS.forEach(r => {
    Object.defineProperty(r, 'label', {
      get: function () { return window.t ? window.t(r.labelKey, r.key) : r.key; }
    });
  });

  const POSITIONS = [
    { v: 'POR', l: 'Portero / Goalkeeper' },
    { v: 'DFC', l: 'Defensa central / Centre back' },
    { v: 'LD',  l: 'Lateral derecho / Right back' },
    { v: 'LI',  l: 'Lateral izquierdo / Left back' },
    { v: 'MCD', l: 'Mediocentro def. / Defensive mid' },
    { v: 'MC',  l: 'Mediocentro / Central mid' },
    { v: 'MCO', l: 'Mediapunta / Attacking mid' },
    { v: 'ED',  l: 'Extremo derecho / Right winger' },
    { v: 'EI',  l: 'Extremo izquierdo / Left winger' },
    { v: 'DC',  l: 'Delantero centro / Striker' },
    { v: 'Jugador', l: 'Jugador / Player' }
  ];

  /* Zonas tácticas del campo (Pitch Map) */
  const ZONES = [
    // Campo Rival (Ataque)
    { id: 1, key: 'zone_box_opp',    short: 'Área rival',           emoji: '🥅', color: '#ef4444', half: 'rival' },
    { id: 2, key: 'zone_front',      short: 'Frontal del área',     emoji: '🎯', color: '#f97316', half: 'rival' },
    { id: 3, key: 'zone_wing_off_l', short: 'Banda ofensiva izq.',  emoji: '↖️', color: '#38bdf8', half: 'rival' },
    { id: 4, key: 'zone_wing_off_r', short: 'Banda ofensiva der.',  emoji: '↗️', color: '#06b6d4', half: 'rival' },
    { id: 5, key: 'zone_mid',        short: 'Centro del campo',     emoji: '⚽', color: '#22c55e', half: 'both' },
    { id: 7, key: 'zone_wing_l',     short: 'Banda izquierda',      emoji: '⬅️', color: '#3b82f6', half: 'both' },
    { id: 8, key: 'zone_wing_r',     short: 'Banda derecha',        emoji: '➡️', color: '#0ea5e9', half: 'both' },

    // Campo Propio (Defensa)
    { id: 6,  key: 'zone_own',        short: 'Área de portería',    emoji: '🛡️', color: '#8b5cf6', half: 'own' },
    { id: 9,  key: 'zone_front_own',  short: 'Frontal propia',      emoji: '🛡️', color: '#a855f7', half: 'own' },
    { id: 10, key: 'zone_wing_def_l', short: 'Banda defensiva izq.', emoji: '↙️', color: '#6366f1', half: 'own' },
    { id: 11, key: 'zone_wing_def_r', short: 'Banda defensiva der.', emoji: '↘️', color: '#4f46e5', half: 'own' }
  ];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultState() {
    return {
      app: 'player-stats-tracker',
      version: 1,
      updatedAt: 0,
      players: [],
      teams: [],
      sessions: [],
      convocations: [],
      recurringSchedules: [],
      deletedRecurringIds: [],
      lateVoteAttempts: {},
      coachProfile: {
        name: 'Entrenador Principal',
        title: 'Director Técnico / Head Coach',
        license: 'UEFA Pro / Nivel 3',
        phone: '',
        email: '',
        bio: 'Responsable técnico del club.',
        photo: ''
      },
      settings: {
        lang: 'en',
        enabledStats: STATS.filter(s => s.def).map(s => s.key),
        vibrate: true,
        linkGoalShot: true,
        keepAwake: true,
        askZoneOnShots: true,
        convocatoriaWebUrl: 'https://streetoh.github.io/Player_Stats/convocatoria.html'
      }
    };
  }

  function normalize(s) {
    const d = defaultState();
    if (!s || typeof s !== 'object') return d;
    s.players = Array.isArray(s.players) ? s.players : [];
    // Deduplicación preventiva de jugadores para evitar perfiles duplicados (ej. Glen)
    const seenPIds = new Set();
    const seenPNames = new Set();
    s.players = s.players.filter(p => {
      if (!p || !p.id) return false;
      if (seenPIds.has(p.id)) return false;
      const norm = `${(p.name || '').trim().toLowerCase()} ${(p.lastName || '').trim().toLowerCase()}`.trim();
      if (norm && seenPNames.has(norm)) return false;
      seenPIds.add(p.id);
      if (norm) seenPNames.add(norm);
      return true;
    });
    s.teams = Array.isArray(s.teams) ? s.teams : [];
    s.sessions = Array.isArray(s.sessions) ? s.sessions : [];
    s.convocations = Array.isArray(s.convocations) ? s.convocations : [];
    s.deletedRecurringIds = Array.isArray(s.deletedRecurringIds)
      ? Array.from(new Set(s.deletedRecurringIds.filter(Boolean)))
      : [];
    const deletedRecSet = new Set(s.deletedRecurringIds);

    // Limpieza de convocatorias recurrentes vacías generadas a más de 21 días en el futuro (cuota Spark) y tombstones eliminados
    const maxFutureLimit = new Date();
    maxFutureLimit.setDate(maxFutureLimit.getDate() + 21);
    const maxFutureStr = maxFutureLimit.toISOString().slice(0, 10);
    s.convocations = s.convocations.filter(c => {
      if (!c || !c.id) return false;
      if (deletedRecSet.has(c.id)) return false;
      if (c.scheduleId && c.date) {
        const recKey = `rec_${c.scheduleId}_${String(c.date).replace(/-/g, '')}`;
        if (deletedRecSet.has(recKey)) return false;
      }
      if (c.id.startsWith('rec_') && (!c.responses || Object.keys(c.responses).length === 0)) {
        if (c.date && c.date > maxFutureStr) return false;
      }
      return true;
    });
    s.lateVoteAttempts = (s.lateVoteAttempts && typeof s.lateVoteAttempts === 'object') ? s.lateVoteAttempts : {};
    s.recurringSchedules = Array.isArray(s.recurringSchedules) ? s.recurringSchedules : [];
    const validScheduleIds = new Set(s.recurringSchedules.map(r => r.id));
    const nowNorm = new Date();
    const todayNormStr = `${nowNorm.getFullYear()}-${String(nowNorm.getMonth() + 1).padStart(2, '0')}-${String(nowNorm.getDate()).padStart(2, '0')}`;

    // Limpieza de convocatorias huérfanas de horarios recurrentes eliminados (hoy y futuras)
    s.convocations = s.convocations.filter(c => {
      if (!c || !c.id) return false;
      const isRec = !!(c.isRecurring || c.id.startsWith('rec_') || c.scheduleId);
      if (!isRec) return true;
      let schedId = c.scheduleId;
      if (!schedId && c.id.startsWith('rec_')) {
        const parts = c.id.split('_');
        if (parts.length >= 3) schedId = parts[1];
      }
      if (schedId && !validScheduleIds.has(schedId) && c.date >= todayNormStr) {
        return false;
      }
      return true;
    });

    // Limpieza de sesiones huérfanas de horarios recurrentes eliminados o tombstones
    s.sessions = s.sessions.filter(sess => {
      if (!sess) return false;
      if (sess.id && deletedRecSet.has(sess.id)) return false;
      if (sess.convocationId && deletedRecSet.has(sess.convocationId)) return false;
      if (sess.scheduleId && sess.date) {
        const recKey = `rec_${sess.scheduleId}_${String(sess.date).replace(/-/g, '')}`;
        if (deletedRecSet.has(recKey)) return false;
      }
      const hasSchedId = !!sess.scheduleId;
      const isRecConv = !!(sess.convocationId && sess.convocationId.startsWith('rec_'));
      if (!hasSchedId && !isRecConv) return true;
      let schedId = sess.scheduleId;
      if (!schedId && isRecConv) {
        const parts = sess.convocationId.split('_');
        if (parts.length >= 3) schedId = parts[1];
      }
      if (schedId && !validScheduleIds.has(schedId)) {
        const isTodayOrFuture = (sess.date >= todayNormStr);
        const hasData = (sess.elapsedMs > 0) ||
                        (sess.stats && Object.keys(sess.stats).length > 0) ||
                        (sess.log && sess.log.length > 0) ||
                        (sess.status === 'completed');
        if (isTodayOrFuture || !hasData) {
          return false;
        }
      }
      return true;
    });
    s.coachProfile = Object.assign({}, d.coachProfile, s.coachProfile || {});
    s.settings = Object.assign({}, d.settings, s.settings || {});
    if (!s.settings.convocatoriaWebUrl) s.settings.convocatoriaWebUrl = d.settings.convocatoriaWebUrl;
    s.settings.enabledStats = (s.settings.enabledStats || []).filter(k => STAT_MAP[k]);
    if (!s.settings.enabledStats.length) s.settings.enabledStats = d.settings.enabledStats;
    s.settings.customButtonPresets = Array.isArray(s.settings.customButtonPresets) ? s.settings.customButtonPresets : [];
    s.sessions.forEach(x => {
      x.type = (x.type === 'match' ? 'match' : 'training');
      x.stats = x.stats || {};
      x.log = Array.isArray(x.log) ? x.log : [];
      x.slots = Array.isArray(x.slots) ? x.slots : [null, null];
      x.elapsedMs = x.elapsedMs || 0;
      x.score = x.score || { home: 0, away: 0 };
      x.period = x.period || (x.type === 'match' ? '1T' : 'B1');
      x.zones = Array.isArray(x.zones) ? x.zones : [];
      x.coachPicks = Array.isArray(x.coachPicks) ? x.coachPicks : [];
    });
    s.players.forEach(p => {
      p.photoHash = p.photoHash || '';
      if ((!p.photo || p.photo.length < 50) && p.id && typeof window !== 'undefined' && window.CacheDB && window.CacheDB.getPhotoSync) {
        const cached = window.CacheDB.getPhotoSync(p.id);
        if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
          p.photo = cached.dataUrl;
          if (!p.photoHash && cached.photoHash) p.photoHash = cached.photoHash;
        }
      }
      if (p.photo && !p.photoHash) {
        p.photoHash = 'p_' + Date.now().toString(36);
      }
      if (p.photo && p.photoHash && typeof window !== 'undefined' && window.CacheDB && window.CacheDB.setPhoto) {
        window.CacheDB.setPhoto(p.id, p.photoHash, p.photo);
      }
      if (p.mvpCount == null) {
        let count = 0;
        const sPid = String(p.id);
        s.sessions.forEach(sess => {
          if (sess && sess.type === 'match') {
            if ((sess.mvpOfficialId && String(sess.mvpOfficialId) === sPid) || (sess.mvpWinnerId && String(sess.mvpWinnerId) === sPid)) {
              count++;
            }
          }
        });
        p.mvpCount = count;
      }
    });
    s.app = d.app;
    s.version = d.version;
    return s;
  }

  function hasNative() {
    return typeof window.AndroidBridge !== 'undefined' && window.AndroidBridge;
  }

  function loadInitial() {
    let local = null, native = null;
    try { local = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { local = null; }
    if (hasNative() && window.AndroidBridge.loadState) {
      try { native = JSON.parse(window.AndroidBridge.loadState() || 'null'); } catch (e) { native = null; }
    }
    let chosen = local;
    if (native && (!local || (native.updatedAt || 0) > (local.updatedAt || 0))) chosen = native;
    const norm = normalize(chosen);
    if (window.I18N && window.I18N.setLang && norm.settings && norm.settings.lang) {
      window.I18N.setLang(norm.settings.lang);
    }
    return norm;
  }

  const Store = {
    STATS, STAT_MAP, RATIOS, POSITIONS, ZONES, uid,
    state: loadInitial(),
    _nativeTimer: null,
    _cloudTimer: null,
    listeners: [],

    save() {
      this.state.updatedAt = Date.now();
      const json = JSON.stringify(this.state);
      try {
        localStorage.setItem(LS_KEY, json);
      } catch (e) {
        console.error('localStorage lleno', e);
        if (window.UI && UI.toast) UI.toast('⚠️ Almacenamiento lleno', 'error');
      }
      if (hasNative() && window.AndroidBridge.saveState) {
        clearTimeout(this._nativeTimer);
        this._nativeTimer = setTimeout(() => this.flushNative(), 600);
      }
      if (window.Cloud && window.Cloud.pushCoachState) {
        clearTimeout(this._cloudTimer);
        // Si hay una sesión activa en progreso (partido o entrenamiento en vivo),
        // ampliar el debounce a 15 segundos para no agotar la cuota Spark con cada pase/tiro individual.
        // Los datos se guardan instantáneamente en localStorage y AndroidBridge sin riesgo.
        const isLiveSession = !!(this.state.currentSessionId || (this.state.sessions && this.state.sessions.some(s => s && s.live)));
        const debounceMs = isLiveSession ? 15000 : 3500;
        this._cloudTimer = setTimeout(() => {
          window.Cloud.pushCoachState(this.state);
        }, debounceMs);
      }
      this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    },

    handleIncomingPlayerResponse(resp, isInitialSync = false) {
      if (!resp || !resp.convId || !resp.playerId) return;
      let conv = this.convocation(resp.convId);
      if (!conv && this.state.convocations) {
        conv = this.state.convocations.find(c => c && (c.sessionId === resp.convId || c.id === resp.convId || (c.scheduleId && c.scheduleId === resp.convId)));
      }

      if (conv) {
        conv.list = conv.list || {};
        conv.responses = conv.responses || {};

        if (resp.status === 'pending' || !resp.status) {
          delete conv.responses[resp.playerId];
        } else {
          const isAttending = (resp.status === 'called' || resp.status === 'attending' || resp.status === 'yes');
          const statusKey = isAttending ? 'attending' : 'absent';
          const rTime = resp.timestamp || resp.time || Date.now();
          conv.responses[resp.playerId] = {
            status: statusKey,
            playerName: resp.playerName || '',
            notes: resp.notes || '',
            time: rTime,
            timestamp: rTime
          };
        }
        this.save();
      }

      if (typeof window.onPlayerAttendanceResponse === 'function') {
        window.onPlayerAttendanceResponse(resp, isInitialSync);
      }
    },

    handleIncomingLateVoteAttempt(attempt) {
      if (!attempt || !attempt.convId || !attempt.playerId) return;
      this.state.lateVoteAttempts = this.state.lateVoteAttempts || {};
      const key = `${attempt.convId}_${attempt.playerId}`;
      this.state.lateVoteAttempts[key] = attempt;

      let conv = this.convocation(attempt.convId);
      if (!conv && this.state.convocations) {
        conv = this.state.convocations.find(c => c && (c.sessionId === attempt.convId || c.id === attempt.convId || (c.scheduleId && c.scheduleId === attempt.convId)));
      }
      if (conv) {
        conv.lateAttempts = conv.lateAttempts || {};
        conv.lateAttempts[attempt.playerId] = {
          attemptedStatus: attempt.attemptedStatus,
          timestamp: attempt.timestamp || Date.now(),
          playerName: attempt.playerName || ''
        };
      }
      this.save();

      if (typeof window.onLateVoteAttempt === 'function') {
        window.onLateVoteAttempt(attempt);
      }
    },

    flushNative() {
      clearTimeout(this._nativeTimer);
      if (hasNative() && window.AndroidBridge.saveState) {
        try { window.AndroidBridge.saveState(JSON.stringify(this.state)); } catch (e) { console.error(e); }
      }
    },

    replaceState(newState) {
      this.state = normalize(newState);
      if (window.I18N && this.state.settings && this.state.settings.lang) {
        window.I18N.setLang(this.state.settings.lang);
      }
      this.save();
      this.flushNative();
    },

    /* Garantiza SIEMPRE el orden canónico estricto para cualquier subconjunto de botones */
    getSortedStats(enabledKeys) {
      const set = new Set(enabledKeys || this.state.settings.enabledStats);
      return STATS.filter(s => set.has(s.key));
    },

    /* Jugadores */
    player(id) { return this.state.players.find(p => p.id === id) || null; },
    team(id) { return this.state.teams.find(t => t.id === id) || null; },

    playerName(p, short) {
      if (!p) return '—';
      if (short) return p.nickname || p.name || '—';
      return [p.name, p.lastName].filter(Boolean).join(' ') || p.nickname || '—';
    },

    sortedPlayers(teamFilter) {
      return this.state.players
        .filter(p => {
          if (p.isTestPlayer || p.isTest) return false;
          if (!teamFilter || teamFilter === 'all') return true;
          if (Array.isArray(teamFilter)) return teamFilter.includes(p.teamId);
          return p.teamId === teamFilter;
        })
        .slice()
        .sort((a, b) => {
          const da = parseInt(a.mainDorsal, 10), db = parseInt(b.mainDorsal, 10);
          const na = isNaN(da) ? 999 : da, nb = isNaN(db) ? 999 : db;
          if (na !== nb) return na - nb;
          return Store.playerName(a).localeCompare(Store.playerName(b));
        });
    },

    realPlayersCount() {
      return (this.state.players || []).filter(p => !p.isTestPlayer && !p.isTest).length;
    },

    getTestPlayer() {
      return (this.state.players || []).find(p => p.isTestPlayer || p.isTest || p.id === 'test_player_profile') || null;
    },

    ensureTestPlayer(options) {
      let tp = this.getTestPlayer();
      if (!tp) {
        tp = {
          id: 'test_player_profile',
          name: (options && options.name) || 'Jugador Test',
          lastName: (options && options.lastName) || '(Prueba)',
          mainPosition: (options && options.mainPosition) || 'MED',
          mainDorsal: (options && options.mainDorsal != null) ? options.mainDorsal : 99,
          foot: 'right',
          teamId: (options && options.teamId) || (this.state.teams[0] ? this.state.teams[0].id : ''),
          assignedTeamIds: (options && options.assignedTeamIds) || [],
          isTestPlayer: true,
          isTest: true,
          photo: '',
          securityCode: (options && options.securityCode) || '0000',
          createdAt: Date.now()
        };
        this.state.players.push(tp);
      } else {
        if (options) {
          if (options.teamId !== undefined) tp.teamId = options.teamId;
          if (options.assignedTeamIds !== undefined) tp.assignedTeamIds = options.assignedTeamIds;
          if (options.name !== undefined) tp.name = options.name;
          if (options.lastName !== undefined) tp.lastName = options.lastName;
          if (options.mainDorsal !== undefined) tp.mainDorsal = options.mainDorsal;
          if (options.mainPosition !== undefined) tp.mainPosition = options.mainPosition;
          if (options.securityCode !== undefined) tp.securityCode = options.securityCode;
        }
      }
      this.save();
      if (window.Cloud && window.Cloud.pushCoachState) {
        window.Cloud.pushCoachState(this.state, true);
      }
      return tp;
    },

    updateTestPlayerTeam(teamId) {
      return this.ensureTestPlayer({ teamId: teamId || '' });
    },

    upsertPlayer(data) {
      if (data.photo && !data.photoHash) {
        data.photoHash = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      }
      const cleanData = Object.assign({}, data);
      if (cleanData.heightCm !== undefined) {
        cleanData.heightCm = cleanData.heightCm ? (parseInt(cleanData.heightCm, 10) || null) : null;
      }
      if (data.id) {
        const i = this.state.players.findIndex(p => p.id === data.id);
        if (i >= 0) {
          // Si no se pasó una foto nueva pero el jugador ya tenía una foto previa en memoria o en CacheDB, conservarla
          if (!cleanData.photo && !cleanData.removePhoto) {
            if (this.state.players[i].photo) {
              cleanData.photo = this.state.players[i].photo;
              cleanData.photoHash = this.state.players[i].photoHash || cleanData.photoHash;
            } else if (typeof window !== 'undefined' && window.CacheDB && window.CacheDB.getPhotoSync) {
              const cached = window.CacheDB.getPhotoSync(data.id);
              if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
                cleanData.photo = cached.dataUrl;
                cleanData.photoHash = cached.photoHash || cleanData.photoHash;
              }
            }
          }
          if (cleanData.photo && !cleanData.photoHash) {
            cleanData.photoHash = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          }
          this.state.players[i] = Object.assign({}, this.state.players[i], cleanData);
          if (this.state.players[i].photo && this.state.players[i].photoHash && typeof window !== 'undefined' && window.CacheDB && window.CacheDB.setPhoto) {
            window.CacheDB.setPhoto(this.state.players[i].id, this.state.players[i].photoHash, this.state.players[i].photo);
          }
          this.save();
          if (typeof window !== 'undefined' && window.Cloud) {
            if (typeof window.Cloud.upsertPlayerToCloud === 'function') {
              window.Cloud.upsertPlayerToCloud(this.state.players[i], this.state);
            }
            if (typeof window.Cloud.pushCoachState === 'function') {
              window.Cloud.pushCoachState(this.state, true);
            }
          }
          return this.state.players[i];
        }
      }
      const p = Object.assign({
        id: uid('p'), name: '', lastName: '', nickname: '', birthDate: '', teamId: '',
        mainDorsal: null, secondaryDorsal: null, foot: 'Diestro', mainPosition: 'Jugador',
        secondaryPosition: '', secondaryPositions: [],
        parentContact: { name: '', phone: '', email: '' },
        photo: '', photoHash: '', disciplineScore: 100, heightCm: null
      }, cleanData);
      if (!p.id) p.id = uid('p');
      if (p.photo && !p.photoHash) {
        p.photoHash = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      }
      if (p.photo && p.photoHash && typeof window !== 'undefined' && window.CacheDB && window.CacheDB.setPhoto) {
        window.CacheDB.setPhoto(p.id, p.photoHash, p.photo);
      }
      this.state.players.push(p);

      // Si el nuevo jugador pertenece a un equipo, añadirlo automáticamente a las convocatorias vigentes de ese equipo
      if (p.teamId && Array.isArray(this.state.convocations)) {
        const todayIso = new Date().toISOString().slice(0, 10);
        this.state.convocations.forEach(c => {
          if (!c || (c.date && c.date < todayIso)) return;
          const tIds = Array.isArray(c.teamIds) ? c.teamIds : (c.teamId ? [c.teamId] : []);
          if (tIds.includes(p.teamId)) {
            c.list = c.list || {};
            if (!c.list[p.id]) c.list[p.id] = 'called';
          }
        });
      }

      this.save();
      if (typeof window !== 'undefined' && window.Cloud) {
        if (typeof window.Cloud.upsertPlayerToCloud === 'function') {
          window.Cloud.upsertPlayerToCloud(p, this.state);
        }
        if (typeof window.Cloud.pushCoachState === 'function') {
          window.Cloud.pushCoachState(this.state, true);
        }
      }
      return p;
    },

    setPlayerDiscipline(id, score) {
      const p = this.player(id);
      if (!p) return;
      p.disciplineScore = Math.min(100, Math.max(0, parseInt(score, 10) || 100));
      this.save();
      return p;
    },

    setPlayerWeeklyMission(id, missionData) {
      const p = this.player(id);
      if (!p) return null;
      if (!missionData || (!missionData.text && !missionData.text_es && !missionData.title)) {
        delete p.weeklyMission;
      } else {
        const isAuto = missionData.type === 'auto';
        p.weeklyMission = {
          id: missionData.id || ('m_' + Date.now()),
          title: missionData.title || missionData.text || missionData.text_es || '',
          text: missionData.text || missionData.text_es || missionData.title || '',
          text_es: missionData.text_es || missionData.text || missionData.title || '',
          text_en: missionData.text_en || missionData.text || missionData.title || '',
          text_ee: missionData.text_ee || missionData.text || missionData.title || '',
          text_ru: missionData.text_ru || missionData.text || missionData.title || '',
          presetKey: missionData.presetKey || '',
          category: missionData.category || 'General',
          icon: missionData.icon || '🎯',
          type: isAuto ? 'auto' : 'manual',
          metric: isAuto ? (missionData.metric || 'pass_acc') : null,
          target: isAuto ? (Number(missionData.target) || 0) : 0,
          minAttempts: isAuto ? (Number(missionData.minAttempts) || 0) : 0,
          currentProgress: isAuto ? (Number(missionData.currentProgress) || 0) : 0,
          comment: (missionData.comment || '').trim(),
          status: missionData.status || (isAuto ? 'in_progress' : 'pending'),
          assignedAt: missionData.assignedAt || Date.now(),
          completedAt: missionData.status === 'completed' ? (missionData.completedAt || Date.now()) : null
        };
        if (isAuto) {
          this.evaluateAutoWeeklyMissions([id]);
        }
      }
      this.save();
      return p;
    },

    setPlayerMissionStatus(id, status) {
      const p = this.player(id);
      if (!p || !p.weeklyMission) return null;
      p.weeklyMission.status = status;
      if (status === 'completed') {
        p.weeklyMission.completedAt = Date.now();
      } else {
        p.weeklyMission.completedAt = null;
      }
      this.save();
      return p;
    },

    clearPlayerWeeklyMission(id) {
      const p = this.player(id);
      if (!p) return null;
      p.weeklyMission = null;
      delete p.weeklyMission;
      this.save();
      return p;
    },

    isSessionFinished(s) {
      if (!s) return false;
      return !!(s.finished === true || s.status === 'finished' || s.status === 'completed' || s.endedAt != null);
    },

    finishSession(sId) {
      const s = this.session(sId);
      if (!s) return null;
      s.status = 'finished';
      s.finished = true;
      s.isFinished = true;
      s.endedAt = s.endedAt || Date.now();
      s.finishedAt = s.finishedAt || Date.now();
      if (s.timerStartedAt) this.toggleTimer(s);

      // Desconectar asistente remoto si estaba activo para esta sesión
      if (s._liveTrackerCode || sId) {
        if (window.Cloud && window.Cloud.closeLiveTrackerForSession) {
          window.Cloud.closeLiveTrackerForSession(s._liveTrackerCode || sId);
        } else if (s._liveTrackerCode && window.Cloud && window.Cloud.closeLiveTrackerSession) {
          window.Cloud.closeLiveTrackerSession(s._liveTrackerCode);
        }
      }
      s._liveTrackerActive = false;
      s._liveTrackerConnected = false;
      s._liveTrackerCode = null;
      s._connectedAssistants = [];
      s._lastNotifiedAssistant = null;

      this.save();
      if (window.Cloud && window.Cloud.pushCoachState) {
        window.Cloud.pushCoachState(this.state, true);
      }
      return s;
    },

    evaluateAutoWeeklyMissions(playerIds) {
      if (!Array.isArray(playerIds) || playerIds.length === 0) return;
      const now = Date.now();
      const d = new Date();
      const day = d.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() + diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStartTs = startOfWeek.getTime();

      let modified = false;

      playerIds.forEach(pid => {
        const p = this.player(pid);
        if (!p || !p.weeklyMission) return;
        const m = p.weeklyMission;
        if (m.type !== 'auto') return;
        if (m.status === 'completed') return;

        const sinceTs = Math.min(weekStartTs, m.assignedAt || weekStartTs);
        const recentSessions = (this.state.sessions || []).filter(s => {
          if (!s) return false;
          const sDate = s.date ? new Date(s.date).getTime() : 0;
          return sDate >= sinceTs;
        });

        let progress = 0;
        let attemptsMet = true;

        switch (m.metric) {
          case 'pass_acc': {
            let totalGood = 0, totalBad = 0;
            recentSessions.forEach(s => {
              const st = (s.stats && s.stats[pid]) || {};
              totalGood += (st.passGood || st.pass || 0);
              totalBad += (st.passBad || 0);
            });
            const totalPasses = totalGood + totalBad;
            if (m.minAttempts && totalPasses < m.minAttempts) {
              attemptsMet = false;
            }
            progress = totalPasses > 0 ? Math.round((totalGood / totalPasses) * 100) : 0;
            break;
          }
          case 'duels_won': {
            let duelsWon = 0;
            let totalDuels = 0;
            recentSessions.forEach(s => {
              if (s.duels1v1 && Array.isArray(s.duels1v1.history)) {
                s.duels1v1.history.forEach(h => {
                  if (h.player1Id === pid || h.player2Id === pid) {
                    totalDuels++;
                    if (h.winnerId === pid) duelsWon++;
                  }
                });
              }
              const st = (s.stats && s.stats[pid]) || {};
              duelsWon += (st.duelsWon || st.wonDuel || 0);
            });
            if (m.minAttempts && totalDuels < m.minAttempts) {
              attemptsMet = false;
            }
            progress = duelsWon;
            break;
          }
          case 'recoveries': {
            let recoveries = 0;
            recentSessions.forEach(s => {
              const st = (s.stats && s.stats[pid]) || {};
              recoveries += (st.recovery || st.ballRecovery || 0);
            });
            progress = recoveries;
            break;
          }
          case 'goals': {
            let goals = 0;
            recentSessions.forEach(s => {
              const st = (s.stats && s.stats[pid]) || {};
              goals += (st.goal || 0);
            });
            progress = goals;
            break;
          }
          case 'attendance_streak': {
            progress = this.calculatePlayerAttendanceStreak(pid);
            break;
          }
        }

        m.currentProgress = progress;
        if (progress >= m.target && attemptsMet) {
          m.status = 'completed';
          m.completedAt = now;
          modified = true;
        } else {
          m.status = 'in_progress';
          modified = true;
        }
      });

      if (modified) {
        this.save();
        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(this.state, true);
        }
      }
    },

    setOfficialMatchMvp(sessionId, playerId) {
      const s = this.session(sessionId);
      if (!s) return null;
      const prevMvpId = s.mvpOfficialId;
      s.mvpOfficialId = playerId || null;
      if (prevMvpId) this.calculatePlayerMvpCount(prevMvpId);
      if (playerId) this.calculatePlayerMvpCount(playerId);
      this.save();
      if (window.Cloud && window.Cloud.setOfficialMatchMvp) {
        window.Cloud.setOfficialMatchMvp(sessionId, playerId);
      }
      if (window.Cloud && window.Cloud.pushCoachState) {
        window.Cloud.pushCoachState(this.state, true);
      }
      return s;
    },

    setMatchCoachPicks(sessionId, coachPicks) {
      const s = this.session(sessionId);
      if (!s) return null;
      s.coachPicks = Array.isArray(coachPicks) ? coachPicks.slice(0, 3) : [];
      this.save();
      if (window.Cloud && window.Cloud.setMatchCoachPicks) {
        window.Cloud.setMatchCoachPicks(sessionId, s.coachPicks);
      }
      if (window.Cloud && window.Cloud.pushCoachState) {
        window.Cloud.pushCoachState(this.state, true);
      }
      return s;
    },

    deletePlayer(id) {
      this.state.players = this.state.players.filter(p => p.id !== id);
      this.state.sessions.forEach(s => { s.slots = s.slots.map(x => (x === id ? null : x)); });
      this.save();
    },

    upsertTeam(data) {
      if (data.id) {
        const i = this.state.teams.findIndex(t => t.id === data.id);
        if (i >= 0) { this.state.teams[i] = Object.assign({}, this.state.teams[i], data); this.save(); return this.state.teams[i]; }
      }
      const t = Object.assign({ id: uid('team'), name: 'Equipo', shortName: '', color: '#22c55e' }, data);
      if (!t.id) t.id = uid('team');
      this.state.teams.push(t);
      this.save();
      return t;
    },

    deleteTeam(id) {
      this.state.teams = this.state.teams.filter(t => t.id !== id);
      this.state.players.forEach(p => { if (p.teamId === id) p.teamId = ''; });
      this.save();
    },

    /* Sesiones */
    session(id) { return this.state.sessions.find(s => s.id === id) || null; },

    createSession(opts) {
      const s = {
        id: uid('s'),
        type: opts.type === 'match' ? 'match' : 'training',
        date: opts.date || new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        title: opts.title || '',
        rival: opts.rival || '',
        venue: opts.venue || '',
        teamId: opts.teamId || '',
        teamIds: opts.teamIds || (opts.teamId ? [opts.teamId] : []),
        convocationId: opts.convocationId || null,
        notes: opts.notes || '',
        status: 'active',
        elapsedMs: 0,
        timerStartedAt: null,
        slots: opts.slots || [null, null],
        enabledStats: opts.enabledStats || null, // Configuración específica de botones de esta sesión
        attendance: opts.attendance || {},
        score: opts.score || { home: 0, away: 0 },
        period: opts.period || (opts.type === 'match' ? '1T' : 'B1'),
        zones: opts.zones || [],
        stats: opts.stats || {},
        log: []
      };
      this.state.sessions.unshift(s);
      this.save();
      return s;
    },

    /* Añadir datos recopilados manualmente (ej. por un compañero o app externa) */
    addManualPlayerSession(playerId, sessionOpts, counts) {
      const p = this.player(playerId);
      if (!p) return null;
      const statsObj = {};
      statsObj[playerId] = Object.assign({}, counts || {});

      const s = {
        id: uid('s_manual'),
        type: sessionOpts.type === 'match' ? 'match' : 'training',
        date: sessionOpts.date || new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        title: sessionOpts.title || (sessionOpts.type === 'match' ? (sessionOpts.rival ? 'vs ' + sessionOpts.rival : 'Partido manual') : 'Entreno manual'),
        rival: sessionOpts.rival || '',
        venue: sessionOpts.venue || '',
        teamId: p.teamId || '',
        notes: sessionOpts.notes || 'Datos añadidos manualmente',
        status: 'finished',
        elapsedMs: (sessionOpts.minutes ? sessionOpts.minutes * 60000 : 0),
        timerStartedAt: null,
        slots: [playerId, null],
        enabledStats: null,
        attendance: sessionOpts.attendance || {},
        stats: statsObj,
        log: []
      };
      this.state.sessions.unshift(s);
      this.save();
      return s;
    },

    markRecurringDeleted(item) {
      if (!item) return;
      this.state.deletedRecurringIds = Array.isArray(this.state.deletedRecurringIds)
        ? this.state.deletedRecurringIds
        : [];
      const set = new Set(this.state.deletedRecurringIds);
      if (typeof item === 'string') {
        set.add(item);
      } else if (typeof item === 'object') {
        if (item.id) set.add(String(item.id));
        if (item.convocationId) set.add(String(item.convocationId));
        if (item.sessionId) set.add(String(item.sessionId));
        if (item.scheduleId && item.date) {
          set.add(`rec_${item.scheduleId}_${String(item.date).replace(/-/g, '')}`);
        }
      }
      this.state.deletedRecurringIds = Array.from(set);
    },

    deleteSession(id) {
      const targetSess = (this.state.sessions || []).find(s => s && s.id === id) || null;
      if (targetSess) {
        this.markRecurringDeleted(targetSess);
      } else if (id) {
        this.markRecurringDeleted(id);
      }

      this.state.sessions = (this.state.sessions || []).filter(s => s && s.id !== id);

      const convsToDelete = [];
      if (Array.isArray(this.state.convocations)) {
        const sTeams = targetSess
          ? ((Array.isArray(targetSess.teamIds) && targetSess.teamIds.length > 0) ? targetSess.teamIds : (targetSess.teamId ? [targetSess.teamId] : []))
          : [];
        const sTeamsSorted = sTeams.slice().map(String).sort().join(',');

        this.state.convocations = this.state.convocations.filter(c => {
          if (!c) return false;
          const isDirectMatch = (c.sessionId === id) ||
                                (targetSess && targetSess.convocationId && c.id === targetSess.convocationId) ||
                                (c.id === 'conv_' + id) ||
                                (targetSess && targetSess.scheduleId && c.scheduleId && c.scheduleId === targetSess.scheduleId && c.date === targetSess.date);
          let isSameTrainingMatch = false;
          if (!isDirectMatch && targetSess && targetSess.type === 'training' && c.type === 'training' && c.date === targetSess.date) {
            const cTeams = (Array.isArray(c.teamIds) && c.teamIds.length > 0) ? c.teamIds : (c.teamId ? [c.teamId] : []);
            const cTeamsSorted = cTeams.slice().map(String).sort().join(',');
            if (sTeamsSorted === cTeamsSorted && (!c.sessionId || c.sessionId === id)) {
              isSameTrainingMatch = true;
            }
          }
          if (isDirectMatch || isSameTrainingMatch) {
            this.markRecurringDeleted(c);
            convsToDelete.push(c);
            return false;
          }
          return true;
        });
      }

      this.save();
      if (typeof window !== 'undefined' && window.Cloud) {
        try {
          if (typeof window.Cloud.deleteSessionFromCloud === 'function') {
            window.Cloud.deleteSessionFromCloud(id);
          }
          if (typeof window.Cloud.deleteConvocationFromCloud === 'function') {
            convsToDelete.forEach(c => {
              if (c && c.id) window.Cloud.deleteConvocationFromCloud(c.id);
            });
          }
          if (typeof window.Cloud.pushCoachState === 'function') {
            window.Cloud.pushCoachState(this.state, true);
          }
        } catch (e) {
          console.warn('[Store] Error notificando borrado de sesión a la nube:', e);
        }
      }
    },

    /* Gestión de Asistencia (Pasar Lista) */
    setSessionAttendance(sessionId, attendanceMap, replace = false) {
      const s = this.session(sessionId);
      if (!s) return null;
      s.attendance = replace ? Object.assign({}, attendanceMap) : Object.assign({}, s.attendance || {}, attendanceMap);
      s.updatedAt = Date.now();
      this.save();
      this.evaluateAutoWeeklyMissions(Object.keys(attendanceMap || {}));
      return s.attendance;
    },

    getSessionAttendance(sessionId) {
      const s = this.session(sessionId);
      return (s && s.attendance) || {};
    },

    getPlayerAttendanceStatus(s, playerId) {
      if (!s || !playerId || !s.attendance) return null;
      const att = s.attendance[playerId];
      if (!att) return null;
      return (typeof att === 'object' && att !== null) ? (att.status || null) : att;
    },

    hasPlayerAttended(s, playerId) {
      const st = this.getPlayerAttendanceStatus(s, playerId);
      return st === 'present' || st === 'late';
    },

    hasPlayerStats(s, playerId) {
      if (!s || !playerId || !s.stats || !s.stats[playerId]) return false;
      const st = s.stats[playerId];
      return Object.keys(st).some(k => Number(st[k]) > 0);
    },

    getSessionPlayersForAttendance(sessionId) {
      const s = this.session(sessionId);
      if (!s) return [];
      const playerIds = new Set();

      // 1. Si la sesión está vinculada a una convocatoria, usar convocados
      let c = null;
      if (s.convocationId) {
        c = this.convocation(s.convocationId);
      }
      if (!c) {
        c = (this.state.convocations || []).find(cv => cv.sessionId === s.id || (cv.date === s.date && cv.type === s.type && (!cv.rival || !s.rival || cv.rival === s.rival)));
        if (c && !s.convocationId) {
          s.convocationId = c.id;
          c.sessionId = s.id;
        }
      }
      if (c && c.list) {
        Object.keys(c.list).forEach(pid => {
          const st = c.list[pid];
          if (st && st !== 'uncalled' && st !== 'absent') playerIds.add(pid);
        });
      }

      // 2. Si no hay jugadores por convocatoria, usar los del equipo de la sesión
      if (playerIds.size === 0) {
        const teamIds = (Array.isArray(s.teamIds) && s.teamIds.length) ? s.teamIds : (s.teamId ? [s.teamId] : []);
        if (teamIds.length > 0) {
          (this.state.players || []).forEach(p => {
            if (p.teamId && teamIds.includes(p.teamId) && p.active !== false) {
              playerIds.add(p.id);
            }
          });
        }
      }

      // 3. Fallback: Todos los jugadores activos
      if (playerIds.size === 0) {
        (this.state.players || []).forEach(p => {
          if (p.active !== false) playerIds.add(p.id);
        });
      }

      // 4. Si ya existen registros previos de asistencia en esta sesión, asegurar que aparezcan
      if (s.attendance && typeof s.attendance === 'object') {
        Object.keys(s.attendance).forEach(pid => {
          if (this.player(pid)) playerIds.add(pid);
        });
      }

      const players = Array.from(playerIds).map(id => this.player(id)).filter(p => p && !p.isTestPlayer && !p.isTest);
      players.sort((a, b) => {
        const numA = (a.jersey != null && a.jersey !== '') ? Number(a.jersey) : 999;
        const numB = (b.jersey != null && b.jersey !== '') ? Number(b.jersey) : 999;
        if (numA !== numB) return numA - numB;
        return (a.name || '').localeCompare(b.name || '');
      });
      return players;
    },

    calculateAttendanceStreak(playerId, sessions) {
      if (!playerId) return 0;
      const allSessions = (sessions || this.state.sessions || [])
        .filter(s => {
          if (!s) return false;
          const hasAtt = s.attendance && s.attendance[playerId] != null;
          const hasAct = this.hasPlayerStats(s, playerId);
          return hasAtt || hasAct;
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

      let streak = 0;
      for (const s of allSessions) {
        const st = this.getPlayerAttendanceStatus(s, playerId);
        const hasAct = this.hasPlayerStats(s, playerId);
        if (st === 'present' || st === 'late' || (st == null && hasAct)) {
          streak++;
        } else if (st === 'justified') {
          continue; // Justificado no rompe la racha
        } else {
          break; // Ausente rompe la racha
        }
      }
      return streak;
    },

    calculatePlayerAttendanceStreak(playerId, sessions) {
      return this.calculateAttendanceStreak(playerId, sessions);
    },

    sessionTitle(s) {
      if (!s) return '';
      if (s.type === 'match') {
        let tObj = s.teamId ? this.team(s.teamId) : null;
        if (!tObj && s.slots && s.slots.length) {
          for (const pid of s.slots) {
            const pl = pid ? this.player(pid) : null;
            if (pl && pl.teamId) { tObj = this.team(pl.teamId); break; }
          }
        }
        if (!tObj && this.state.teams && this.state.teams.length) {
          tObj = this.state.teams[0];
        }
        const myTeamName = tObj ? tObj.name : (window.t ? window.t('myTeam', 'Mi Equipo') : 'Mi Equipo');
        if (s.rival) {
          return `${myTeamName} vs ${s.rival}`;
        }
        return s.title ? `${myTeamName} - ${s.title}` : (window.t ? window.t('match', 'Partido') : 'Partido');
      }
      const pfxTr = window.t ? window.t('training', 'Entrenamiento') : 'Entrenamiento';
      return s.title || pfxTr;
    },

    /* Botones habilitados para una sesión específica */
    getSessionStats(session) {
      const keys = (session && session.enabledStats && session.enabledStats.length)
        ? session.enabledStats
        : this.state.settings.enabledStats;
      return this.getSortedStats(keys);
    },

    setSessionStats(session, keys) {
      if (!session) return;
      session.enabledStats = Array.isArray(keys) && keys.length ? keys : null;
      this.save();
    },

    /* Gestión de Presets Personalizados de Botones */
    getCustomButtonPresets() {
      if (!this.state.settings.customButtonPresets) {
        this.state.settings.customButtonPresets = [];
      }
      return this.state.settings.customButtonPresets;
    },

    saveCustomButtonPreset(name, statsKeys) {
      if (!name || !Array.isArray(statsKeys) || statsKeys.length === 0) return null;
      if (!this.state.settings.customButtonPresets) {
        this.state.settings.customButtonPresets = [];
      }
      const trimmed = name.trim();
      const existing = this.state.settings.customButtonPresets.find(p => p.name.trim().toLowerCase() === trimmed.toLowerCase());
      const preset = {
        id: existing ? existing.id : ('pst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        name: trimmed,
        stats: statsKeys.slice()
      };
      if (existing) {
        existing.stats = preset.stats;
      } else {
        this.state.settings.customButtonPresets.push(preset);
      }
      this.save();
      return preset;
    },

    deleteCustomButtonPreset(id) {
      if (!this.state.settings.customButtonPresets) return;
      this.state.settings.customButtonPresets = this.state.settings.customButtonPresets.filter(p => p.id !== id);
      this.save();
    },

    /* Determina si la acción se realizó con el pie no dominante del jugador */
    isNonDominantFoot(player, foot) {
      if (!player || !foot) return false;
      const f = String(player.foot || 'Diestro').toLowerCase();
      if (f.includes('ambi') || f.includes('both')) return false;
      if (f.includes('zurdo') || f.includes('left')) return foot === 'right';
      return foot === 'left';
    },

    /* Registro de acciones (+1 / -1) con soporte para pie dominante / no dominante */
    record(sessionId, playerId, key, delta, author = 'coach', authorName = null, foot = null) {
      const s = this.session(sessionId);
      if (!s || !playerId || !STAT_MAP[key]) return null;
      s.type = s.type === 'match' ? 'match' : 'training';
      
      const statDef = STAT_MAP[key];
      const baseKey = statDef.baseKey || key;
      const isSplit = !!statDef.isSplit;

      const keys = [baseKey];
      if (isSplit && !keys.includes(key)) {
        keys.push(key);
      }
      if (delta > 0 && this.state.settings.linkGoalShot && statDef.linked) {
        keys.push.apply(keys, statDef.linked);
      }
      // Acciones con balón que suman automáticamente +1 toque
      const TOUCH_KEYS = ['passOk', 'passKo', 'shotOn', 'shotOff', 'goal', 'assist', 'dribbleOk', 'dribbleKo', 'recovery', 'cross', 'keyPass', 'header', 'save'];
      if (delta > 0 && (TOUCH_KEYS.includes(key) || TOUCH_KEYS.includes(baseKey)) && !keys.includes('touches')) {
        keys.push('touches');
      }

      const st = s.stats[playerId] = s.stats[playerId] || {};
      const applied = [];
      keys.forEach(k => {
        const cur = st[k] || 0;
        const next = Math.max(0, cur + delta);
        if (next !== cur) { st[k] = next; applied.push(k); }
      });

      const appliedFootKeys = [];
      let isNonDominant = false;
      const playerObj = this.player(playerId);

      if (foot) {
        const footKeysToTrack = [baseKey + '_' + foot];
        if (isSplit) footKeysToTrack.push(key + '_' + foot);

        isNonDominant = this.isNonDominantFoot(playerObj, foot);
        if (isNonDominant) {
          footKeysToTrack.push(baseKey + '_nonDominant');
          footKeysToTrack.push('nonDominantActions');
        }

        footKeysToTrack.forEach(fk => {
          const cur = st[fk] || 0;
          const next = Math.max(0, cur + delta);
          if (next !== cur) {
            st[fk] = next;
            appliedFootKeys.push(fk);
          }
        });
      }

      if (!applied.length && !appliedFootKeys.length) return null;

      // Incrementar marcador local automáticamente cuando se marca un gol
      let goalDeltaHome = 0;
      if ((key === 'goal' || baseKey === 'goal') && delta > 0 && s.type === 'match') {
        s.score = s.score || { home: 0, away: 0 };
        s.score.home = (s.score.home || 0) + delta;
        goalDeltaHome = delta;
      }

      const defaultAuthorName = (author === 'coach') 
        ? ((this.state && this.state.settings && this.state.settings.coachName) || 'Entrenador')
        : 'Asistente';

      const entry = {
        t: Date.now(),
        m: this.elapsed(s),
        p: playerId,
        k: applied,
        d: delta,
        appliedFootKeys,
        foot: foot || null,
        isNonDominant,
        baseKey,
        key,
        type: s.type,
        author: author || 'coach',
        authorName: (authorName && authorName.trim()) ? authorName.trim() : defaultAuthorName
      };
      if (goalDeltaHome > 0) {
        entry.goalScoreHome = goalDeltaHome;
      }
      s.log.push(entry);
      this.save();
      return entry;
    },

    /* Registro atómico de duelo 1v1 (1-Tap para ambos jugadores con soporte de pie y pie no dominante) */
    recordDuel1v1Outcome(sessionId, outcomeType, pAId, pBId, author = 'coach', authorName = null, foot = null) {
      const s = this.session(sessionId);
      if (!s || !pAId || !pBId) return null;
      s.type = s.type === 'match' ? 'match' : 'training';
      const stA = s.stats[pAId] = s.stats[pAId] || {};
      const stB = s.stats[pBId] = s.stats[pBId] || {};

      const changesA = {};
      const changesB = {};

      if (outcomeType === 'goal_A') {
        // Gol 1v1 A (+1 duel1v1WonGoal A, +1 duel1v1LostGoal B)
        stA.duel1v1WonGoal = (stA.duel1v1WonGoal || 0) + 1;
        stB.duel1v1LostGoal = (stB.duel1v1LostGoal || 0) + 1;
        changesA.duel1v1WonGoal = 1;
        changesB.duel1v1LostGoal = 1;
      } else if (outcomeType === 'goal_B') {
        // Gol 1v1 B (+1 duel1v1WonGoal B, +1 duel1v1LostGoal A)
        stB.duel1v1WonGoal = (stB.duel1v1WonGoal || 0) + 1;
        stA.duel1v1LostGoal = (stA.duel1v1LostGoal || 0) + 1;
        changesB.duel1v1WonGoal = 1;
        changesA.duel1v1LostGoal = 1;
      } else if (outcomeType === 'steal_goal_A') {
        // Robo y Gol A (+1 duel1v1WonGoal A, +1 recovery A, +1 duel1v1LostGoal B)
        stA.duel1v1WonGoal = (stA.duel1v1WonGoal || 0) + 1;
        stA.recovery = (stA.recovery || 0) + 1;
        stB.duel1v1LostGoal = (stB.duel1v1LostGoal || 0) + 1;
        changesA.duel1v1WonGoal = 1;
        changesA.recovery = 1;
        changesB.duel1v1LostGoal = 1;
      } else if (outcomeType === 'steal_goal_B') {
        // Robo y Gol B (+1 duel1v1WonGoal B, +1 recovery B, +1 duel1v1LostGoal A)
        stB.duel1v1WonGoal = (stB.duel1v1WonGoal || 0) + 1;
        stB.recovery = (stB.recovery || 0) + 1;
        stA.duel1v1LostGoal = (stA.duel1v1LostGoal || 0) + 1;
        changesB.duel1v1WonGoal = 1;
        changesB.recovery = 1;
        changesA.duel1v1LostGoal = 1;
      } else if (outcomeType === 'out_loss_A') {
        // Fuera / Pérdida A (+1 duel1v1LostTurnover A, +1 duel1v1WonStop B)
        stA.duel1v1LostTurnover = (stA.duel1v1LostTurnover || 0) + 1;
        stB.duel1v1WonStop = (stB.duel1v1WonStop || 0) + 1;
        changesA.duel1v1LostTurnover = 1;
        changesB.duel1v1WonStop = 1;
      } else if (outcomeType === 'out_loss_B') {
        // Fuera / Pérdida B (+1 duel1v1LostTurnover B, +1 duel1v1WonStop A)
        stB.duel1v1LostTurnover = (stB.duel1v1LostTurnover || 0) + 1;
        stA.duel1v1WonStop = (stA.duel1v1WonStop || 0) + 1;
        changesB.duel1v1LostTurnover = 1;
        changesA.duel1v1WonStop = 1;
      }

      // Registro de pie y pie no dominante para goles de 1v1
      let scorerId = null;
      let scorerChanges = null;
      let scorerStats = null;
      if (outcomeType === 'goal_A' || outcomeType === 'steal_goal_A') {
        scorerId = pAId;
        scorerChanges = changesA;
        scorerStats = stA;
      } else if (outcomeType === 'goal_B' || outcomeType === 'steal_goal_B') {
        scorerId = pBId;
        scorerChanges = changesB;
        scorerStats = stB;
      }

      let isNonDominant = false;
      if (scorerId && foot) {
        const scorerObj = this.player(scorerId);
        const footKey = 'duel1v1WonGoal_' + foot;
        scorerStats[footKey] = (scorerStats[footKey] || 0) + 1;
        scorerChanges[footKey] = 1;

        if (this.isNonDominantFoot(scorerObj, foot)) {
          isNonDominant = true;
          scorerStats.duel1v1WonGoal_nonDominant = (scorerStats.duel1v1WonGoal_nonDominant || 0) + 1;
          scorerChanges.duel1v1WonGoal_nonDominant = 1;
          scorerStats.goal_nonDominant = (scorerStats.goal_nonDominant || 0) + 1;
          scorerChanges.goal_nonDominant = 1;
          scorerStats.nonDominantActions = (scorerStats.nonDominantActions || 0) + 1;
          scorerChanges.nonDominantActions = 1;
        }
      }

      const defaultAuthorName = (author === 'coach') 
        ? ((this.state && this.state.settings && this.state.settings.coachName) || 'Entrenador')
        : 'Asistente';

      const logEntry = {
        t: Date.now(),
        m: this.elapsed(s),
        isDuel1v1: true,
        outcomeType,
        pA: pAId,
        pB: pBId,
        foot: foot || null,
        isNonDominant,
        changesA,
        changesB,
        type: s.type,
        author: author || 'coach',
        authorName: (authorName && authorName.trim()) ? authorName.trim() : defaultAuthorName
      };
      s.log.push(logEntry);
      this.save();
      return logEntry;
    },

    /* Deshacer (Undo) silencioso por jugador o por duelo con filtro de autor opcional ('coach' | 'assistant') */
    undo(sessionId, playerId, authorFilter = null) {
      const s = this.session(sessionId);
      if (!s) return null;
      for (let i = s.log.length - 1; i >= 0; i--) {
        const e = s.log[i];
        if (authorFilter) {
          const entryAuthor = e.author || 'coach';
          if (entryAuthor !== authorFilter) {
            continue;
          }
        }
        if (e.isDuel1v1 && (e.pA === playerId || e.pB === playerId || !playerId)) {
          const stA = s.stats[e.pA] || {};
          const stB = s.stats[e.pB] || {};
          Object.keys(e.changesA || {}).forEach(k => {
            stA[k] = Math.max(0, (stA[k] || 0) - e.changesA[k]);
          });
          Object.keys(e.changesB || {}).forEach(k => {
            stB[k] = Math.max(0, (stB[k] || 0) - e.changesB[k]);
          });
          s.log.splice(i, 1);
          this.save();
          return e;
        } else if (e.p === playerId) {
          const st = s.stats[playerId] || {};
          e.k.forEach(k => { st[k] = Math.max(0, (st[k] || 0) - e.d); });
          if (Array.isArray(e.appliedFootKeys)) {
            e.appliedFootKeys.forEach(k => { st[k] = Math.max(0, (st[k] || 0) - e.d); });
          }
          if (e.goalScoreHome && s.type === 'match' && s.score) {
            s.score.home = Math.max(0, (s.score.home || 0) - e.goalScoreHome);
          }
          s.log.splice(i, 1);
          this.save();
          return e;
        }
      }
      return null;
    },

    setCount(sessionId, playerId, key, value) {
      const s = this.session(sessionId);
      if (!s) return;
      s.type = s.type === 'match' ? 'match' : 'training';
      const st = s.stats[playerId] = s.stats[playerId] || {};
      st[key] = Math.max(0, parseInt(value, 10) || 0);
      this.save();
    },

    calculatePlayerMvpCount(playerId) {
      if (!playerId) return 0;
      const sPid = String(playerId);
      let count = 0;
      (this.state.sessions || []).forEach(s => {
        if (s && s.type === 'match') {
          if (s.mvpOfficialId && String(s.mvpOfficialId) === sPid) {
            count++;
          } else if (s.mvpWinnerId && String(s.mvpWinnerId) === sPid) {
            count++;
          }
        }
      });
      const p = this.player(playerId);
      if (p) p.mvpCount = count;
      return count;
    },

    calculatePlayerAttendanceStreak(playerId) {
      if (!playerId || !Array.isArray(this.state.sessions)) return 0;
      const sPid = String(playerId);
      const allSessions = this.state.sessions
        .slice()
        .filter(s => {
          if (!s) return false;
          return (s.attendance && s.attendance[sPid] != null) || (s.stats && s.stats[sPid] && Object.values(s.stats[sPid]).some(v => v > 0));
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

      let streak = 0;
      for (const s of allSessions) {
        const att = s.attendance ? s.attendance[sPid] : null;
        const st = (typeof att === 'object' && att !== null) ? att.status : att;
        const hasAction = s.stats && s.stats[sPid] && Object.values(s.stats[sPid]).some(v => v > 0);

        if (st === 'present' || st === 'late' || (st == null && hasAction)) {
          streak++;
        } else if (st === 'justified') {
          continue;
        } else {
          break;
        }
      }
      return streak;
    },

    /* Cronómetro y Cuenta Atrás */
    elapsed(s) {
      if (!s) return 0;
      return (s.elapsedMs || 0) + (s.timerStartedAt ? Date.now() - s.timerStartedAt : 0);
    },
    toggleTimer(s) {
      if (s.timerStartedAt) { s.elapsedMs = this.elapsed(s); s.timerStartedAt = null; }
      else s.timerStartedAt = Date.now();
      this.save();
    },
    resetTimer(s) {
      if (!s) return;
      s.elapsedMs = 0;
      s.timerStartedAt = s.timerStartedAt ? Date.now() : null;
      this.save();
    },
    setTimerMode(sessionId, mode, countdownMinutes) {
      const s = this.session(sessionId);
      if (!s) return;
      s.timerMode = mode || 'chrono';
      if (mode === 'countdown' && countdownMinutes) {
        s.countdownTargetMs = parseInt(countdownMinutes, 10) * 60 * 1000;
      }
      this.save();
    },

    /* Agregados */
    sessionPlayerIds(s) {
      if (!s) return [];
      const ids = new Set();
      Object.keys(s.stats || {}).forEach(pid => {
        const st = s.stats[pid];
        if (st && Object.keys(st).some(k => Number(st[k]) > 0)) ids.add(pid);
      });
      Object.keys(s.attendance || {}).forEach(pid => {
        if (this.hasPlayerAttended(s, pid)) ids.add(pid);
      });
      // Fallback a convocados si aún no se han registrado acciones ni asistencia
      if (ids.size === 0) {
        let c = s.convocationId ? this.convocation(s.convocationId) : null;
        if (!c) {
          c = (this.state.convocations || []).find(cv => cv.sessionId === s.id || (cv.date === s.date && cv.type === s.type && (!cv.rival || !s.rival || cv.rival === s.rival)));
          if (c && !s.convocationId) {
            s.convocationId = c.id;
            c.sessionId = s.id;
          }
        }
        if (c && c.list) {
          Object.keys(c.list).forEach(pid => {
            const st = c.list[pid];
            if (st && st !== 'uncalled' && st !== 'absent') ids.add(pid);
          });
        }
      }
      return Array.from(ids);
    },

    ratio(stats, r) {
      const total = r.total.reduce((a, k) => a + (stats[k] || 0), 0);
      if (!total) return null;
      return Math.round(((stats[r.ok] || 0) / total) * 100);
    },

    filterSessions(type, period) {
      const now = Date.now();
      const days = period === '7' ? 7 : period === '30' ? 30 : period === '90' ? 90 : 0;
      const res = this.state.sessions.filter(s => {
        if (type && type !== 'all' && s.type !== type) return false;
        if (days) {
          const t = new Date(s.date + 'T12:00:00').getTime();
          if (now - t > days * 86400000) return false;
        }
        return true;
      });
      // Invertir orden: de más reciente a más antigua / próximas primero
      res.sort((a, b) => {
        const da = (a.date || '') + ' ' + (a.time || '00:00');
        const db = (b.date || '') + ' ' + (b.time || '00:00');
        return db.localeCompare(da);
      });
      return res;
    },

    playerAggregate(playerId, sessions) {
      const sessList = Array.isArray(sessions) ? sessions : ((this.state && this.state.sessions) || []);
      const totals = {};
      const perSession = [];
      let attendedCount = 0;
      let trackedCount = 0;
      sessList.forEach(s => {
        if (!s) return;
        const st = (s.stats || {})[playerId] || {};
        const hasStats = Object.keys(st).some(k => Number(st[k]) > 0);
        const attStatus = this.getPlayerAttendanceStatus(s, playerId);
        const attended = (attStatus === 'present' || attStatus === 'late');
        if (!hasStats && !attended) return;
        if (attended || (hasStats && attStatus !== 'absent')) attendedCount++;
        if (hasStats) trackedCount++;
        perSession.push({
          session: s,
          stats: st,
          hasStats,
          attended: attended || (hasStats && attStatus !== 'absent'),
          attendanceStatus: attStatus || (hasStats ? 'present' : null)
        });
        if (hasStats) {
          Object.keys(st).forEach(k => { totals[k] = (totals[k] || 0) + (st[k] || 0); });
        }
      });
      perSession.sort((a, b) => ((a.session.date || '') + (a.session.createdAt || '')).localeCompare((b.session.date || '') + (b.session.createdAt || '')));
      return { totals, sessions: perSession, count: perSession.length, attendedCount, trackedCount };
    },

    calculatePlayerStats(playerId, sessions) {
      const sessList = Array.isArray(sessions) ? sessions : ((this.state && this.state.sessions) || []);
      const p = this.player(playerId);
      const pos = p ? p.mainPosition : 'Jugador';
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
        dribbleKo: 0,
        duelWon: 0,
        duelLost: 0,
        recoveries: 0,
        losses: 0,
        keyPass: 0,
        assists: 0,
        saves: 0,
        fouls: 0,
        foulsRecv: 0,
        yellows: 0,
        reds: 0,
        crosses: 0,
        headers: 0,
        totals: {},
        aggregatedRating: '6.0',
        ratingsSum: 0,
        ratingsCount: 0
      };
      sessList.forEach(s => {
        if (!s) return;
        const sType = s.type === 'match' ? 'match' : 'training';
        const pStats = (s.stats && s.stats[playerId]) || {};
        const hasActions = Object.keys(pStats).some(k => Number(pStats[k]) > 0);
        const attSt = this.getPlayerAttendanceStatus(s, playerId);
        let wasPresent = (attSt === 'present' || attSt === 'late') || (hasActions && attSt !== 'absent');
        if (wasPresent) {
          if (sType === 'match') res.matchesAttended++;
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
          res.dribbleKo += pStats.dribbleKo || 0;
          res.duelWon += pStats.duelWon || 0;
          res.duelLost += pStats.duelLost || 0;
          res.recoveries += pStats.recovery || 0;
          res.losses += pStats.loss || 0;
          res.keyPass += pStats.keyPass || 0;
          res.assists += pStats.assist || 0;
          res.saves += pStats.save || 0;
          res.fouls += pStats.foul || 0;
          res.foulsRecv += pStats.foulRecv || 0;
          res.yellows += pStats.yellow || 0;
          res.reds += pStats.red || 0;
          res.crosses += pStats.cross || 0;
          res.headers += pStats.header || 0;
          Object.keys(pStats).forEach(k => {
            res.totals[k] = (res.totals[k] || 0) + (pStats[k] || 0);
          });
          const matchRat = this.calculateMatchRating(pStats, pos);
          res.ratingsSum += matchRat;
          res.ratingsCount++;
        }
      });
      res.totalSessions = res.matchesAttended + res.trainingsAttended;
      const totalPass = res.passOk + res.passKo;
      res.passAcc = totalPass > 0 ? Math.round((res.passOk / totalPass) * 100) : 0;
      const totalShots = res.shotsOn + res.shotsOff;
      res.shotAcc = totalShots > 0 ? Math.round((res.shotsOn / totalShots) * 100) : 0;
      res.aggregatedRating = res.ratingsCount > 0
        ? (Math.round((res.ratingsSum / res.ratingsCount) * 10) / 10).toFixed(1)
        : '6.0';
      return res;
    },

    /* Marcador y Periodo */
    updateScore(sessionId, home, away) {
      const s = this.session(sessionId);
      if (!s) return;
      s.score = {
        home: Math.max(0, parseInt(home, 10) || 0),
        away: Math.max(0, parseInt(away, 10) || 0)
      };
      this.save();
    },

    updatePeriod(sessionId, period) {
      const s = this.session(sessionId);
      if (!s) return;
      s.period = period;
      this.save();
    },

    /* Zonas tácticas del campo (Pitch Map) */
    recordZone(sessionId, playerId, key, zoneId) {
      const s = this.session(sessionId);
      if (!s || !playerId || !zoneId) return;
      s.zones = s.zones || [];
      s.zones.push({
        p: playerId,
        k: key,
        z: parseInt(zoneId, 10),
        t: Date.now()
      });
      this.save();
    },

    playerZones(playerId, sessions, keyFilter) {
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 };
      const sessList = sessions || this.state.sessions;
      sessList.forEach(s => {
        (s.zones || []).forEach(item => {
          if (item.p === playerId && (!keyFilter || keyFilter === 'all' || item.k === keyFilter)) {
            if (counts[item.z] !== undefined) counts[item.z]++;
          }
        });
      });
      return counts;
    },

    /* Algoritmo de Índice de Rendimiento / Match Rating (1.0 a 10.0)
       Calibración realista: 6.0 estándar, 7.5-8.5 muy bueno, 8.5-9.2 sobresaliente, 9.5+ casi imposible */
    calculateMatchRating(stats, position) {
      if (!stats || Object.keys(stats).length === 0) return 6.0;
      const p = (position || 'Jugador').toUpperCase();

      const passOk = stats.passOk || 0;
      const passKo = stats.passKo || 0;
      const passes = passOk + passKo;
      const goal = stats.goal || 0;
      const assist = stats.assist || 0;
      const shotOn = stats.shotOn || 0;
      const shotOff = stats.shotOff || 0;
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

      // Eventos de 1v1
      const d1v1Goal = stats.duel1v1WonGoal || 0;
      const d1v1Stop = stats.duel1v1WonStop || 0;
      const d1v1Turnover = stats.duel1v1LostTurnover || 0;
      const d1v1LostGoal = stats.duel1v1LostGoal || 0;

      const goalBonus = goal + (stats.goal_nonDominant || 0);
      const d1v1GoalBonus = d1v1Goal + (stats.duel1v1WonGoal_nonDominant || 0);

      const totalActions = passes + shotOn + shotOff + goalBonus + assist + keyPass + dribbleOk + dribbleKo + recovery + loss + duelWon + duelLost + save + foul + yellow + red + d1v1GoalBonus + d1v1Stop + d1v1Turnover + d1v1LostGoal;
      if (totalActions === 0 && touches === 0) return 6.0;

      // Acciones positivas puras (el gol con pie no dominante pesa el doble)
      let posScore = 0;
      if (passes > 0) {
        const passAcc = passOk / passes;
        posScore += (passOk * 0.05) + Math.max(0, (passAcc - 0.70) * 1.2);
      }

      posScore += goalBonus * 0.95;
      posScore += assist * 0.65;
      posScore += shotOn * 0.20;
      posScore += keyPass * 0.35;
      posScore += dribbleOk * 0.22;
      posScore += recovery * 0.28;
      posScore += duelWon * 0.20;
      posScore += save * 0.45;
      posScore += d1v1GoalBonus * 0.35;
      posScore += d1v1Stop * 0.25;

      // Bonus posicional específico
      if (p.includes('POR') || p.includes('GK')) {
        posScore += save * 0.30;
      } else if (p.includes('DC') || p.includes('DEL') || p.includes('ST') || p.includes('EXT')) {
        posScore += (goalBonus * 0.20) + (shotOn * 0.15);
      } else if (p.includes('DFC') || p.includes('DEF') || p.includes('MCD')) {
        posScore += (recovery * 0.20) + (duelWon * 0.15);
      }

      // Acciones negativas puras
      let negScore = 0;
      negScore += passKo * 0.06;
      negScore += shotOff * 0.08;
      negScore += dribbleKo * 0.14;
      negScore += loss * 0.20;
      negScore += duelLost * 0.14;
      negScore += foul * 0.15;
      negScore += yellow * 0.75;
      negScore += red * 2.50;
      negScore += d1v1Turnover * 0.18;
      negScore += d1v1LostGoal * 0.30;

      const rawNet = posScore - negScore;

      // Factor de volumen: requiere volumen sostenido para notas altas
      const effectiveVolume = totalActions + (touches * 0.3);
      const volumeFactor = Math.min(1.0, Math.sqrt(effectiveVolume / 22.0));

      let delta = 0;
      if (rawNet >= 0) {
        delta = 4.0 * (1 - Math.exp(-rawNet / 7.2)) * volumeFactor;
      } else {
        delta = -5.0 * (1 - Math.exp(-Math.abs(rawNet) / 5.5));
      }

      const finalScore = 6.0 + delta;
      return Math.min(10.0, Math.max(1.0, Math.round(finalScore * 10) / 10));
    },

    /* Rating General (1 al 10) estilo FIFA: promedio de Entrenamientos y Partidos.
       Calcula la media por sesión para no inflar la nota por acumulación histórica de partidos. */
    calculatePlayerOverallRating(playerId, position) {
      const allSessions = (this.state && this.state.sessions) || [];
      const trainingSessions = allSessions.filter(s => (s.type || 'training') === 'training');
      const matchSessions = allSessions.filter(s => (s.type || 'training') === 'match');

      const aggTrain = this.playerAggregate(playerId, trainingSessions);
      const aggMatch = this.playerAggregate(playerId, matchSessions);

      const hasTrain = aggTrain.count > 0;
      const hasMatch = aggMatch.count > 0;

      let rTrain = null;
      const trackedTrain = aggTrain.sessions.filter(item => item.hasStats);
      if (trackedTrain.length > 0) {
        const trainRatings = trackedTrain.map(item => this.calculateMatchRating(item.stats, position));
        rTrain = trainRatings.reduce((a, b) => a + b, 0) / trainRatings.length;
      } else if (hasTrain) {
        rTrain = 6.0;
      }

      let rMatch = null;
      const trackedMatch = aggMatch.sessions.filter(item => item.hasStats);
      if (trackedMatch.length > 0) {
        const matchRatings = trackedMatch.map(item => this.calculateMatchRating(item.stats, position));
        rMatch = matchRatings.reduce((a, b) => a + b, 0) / matchRatings.length;
      } else if (hasMatch) {
        rMatch = 6.0;
      }

      let rating = 6.0;
      let mode = 'none'; // 'combined' | 'training' | 'match' | 'none'

      if (trackedTrain.length > 0 && trackedMatch.length > 0) {
        rating = (rTrain + rMatch) / 2;
        mode = 'combined';
      } else if (trackedTrain.length > 0) {
        rating = rTrain;
        mode = 'training';
      } else if (trackedMatch.length > 0) {
        rating = rMatch;
        mode = 'match';
      } else if (rTrain != null && rMatch != null) {
        rating = (rTrain + rMatch) / 2;
        mode = 'combined';
      } else if (rTrain != null) {
        rating = rTrain;
        mode = 'training';
      } else if (rMatch != null) {
        rating = rMatch;
        mode = 'match';
      } else {
        rating = 6.0;
        mode = 'none';
      }

      if (typeof rating !== 'number' || isNaN(rating)) rating = 6.0;

      return {
        rating: Number(rating.toFixed(1)),
        mode,
        hasTrain,
        hasMatch,
        rTrain: rTrain != null ? Number(rTrain.toFixed(1)) : null,
        rMatch: rMatch != null ? Number(rMatch.toFixed(1)) : null
      };
    },

    /* Radar de Habilidades (Spider Chart de 0 a 99) — delega en SkillsEngine v2 (js/skills-engine.js) */
    _skillsLeagueCache: null,
    _skillsLeague() {
      const sessions = (this.state && this.state.sessions) || [];
      const key = (this.state.updatedAt || 0) + '|' + sessions.length + '|' + ((this.state.players || []).length);
      if (!this._skillsLeagueCache || this._skillsLeagueCache.key !== key) {
        this._skillsLeagueCache = { key, league: window.SkillsEngine.buildLeagueContext(this.state.players || [], sessions) };
      }
      return this._skillsLeagueCache.league;
    },

    calculatePlayerRadar(playerId, sessions) {
      if (window.SkillsEngine) {
        // Los priors se calculan con TODA la historia; el filtro de periodo solo afecta al jugador
        return window.SkillsEngine.computePlayerSkills(playerId, {
          players: this.state.players || [],
          sessions: this.state.sessions || [],
          playerSessions: sessions || this.state.sessions || [],
          league: this._skillsLeague()
        });
      }
      return this._legacyPlayerRadar(playerId, sessions);
    },

    /* Fórmula EMA asimétrica (escala 50-99) */
    _legacyPlayerRadar(playerId, sessions) {
      const allSess = sessions || this.state.sessions || [];
      const pl = this.player(playerId);
      const pos = (pl && pl.mainPosition) || 'MED';

      const currentSkills = {
        pas: 50, tir: 50, reg: 50, def: 50, fis: 50,
        dis: (pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null && pl.disciplineScore !== '') ? Math.min(99, Math.max(50, Number(pl.disciplineScore))) : 50
      };

      const validSessions = allSess.filter(s => s && s.stats && s.stats[playerId] && Object.keys(s.stats[playerId]).some(k => Number(s.stats[playerId][k]) > 0));
      if (!validSessions.length) return currentSkills;

      const sorted = validSessions.slice().sort((a, b) => ((a.date || '').localeCompare(b.date || '')) || ((a.createdAt || 0) - (b.createdAt || 0)));

      sorted.forEach(s => {
        const st = s.stats[playerId];
        const rating = this.calculateMatchRating(st, pos);
        const baseSessionScore = Math.min(99, Math.max(50, Math.round(rating * 10)));

        const S_hoy = {
          pas: baseSessionScore, tir: baseSessionScore, reg: baseSessionScore,
          def: baseSessionScore, fis: baseSessionScore,
          dis: (pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null && pl.disciplineScore !== '') ? Math.min(99, Math.max(50, Number(pl.disciplineScore))) : 85
        };

        const passes = (Number(st.passOk) || 0) + (Number(st.passKo) || 0);
        if (passes > 0) {
          const passAcc = (Number(st.passOk) || 0) / passes;
          const pasScore = Math.round(50 + (passAcc - 0.5) * 40 + Math.min(25, (Number(st.keyPass) || 0) * 4 + (Number(st.assist) || 0) * 5 + (Number(st.passOk) || 0) * 1.5));
          S_hoy.pas = Math.min(99, Math.max(50, Math.round(0.6 * pasScore + 0.4 * baseSessionScore)));
        }

        const shots = (Number(st.shotOn) || 0) + (Number(st.shotOff) || 0);
        const goals = Number(st.goal) || 0;
        const d1v1Goal = Number(st.duel1v1WonGoal) || 0;
        if (shots > 0 || goals > 0 || d1v1Goal > 0) {
          const shotAcc = shots > 0 ? (Number(st.shotOn) || 0) / shots : 0.5;
          const tirScore = Math.round(50 + (shotAcc - 0.5) * 30 + Math.min(35, goals * 10 + (Number(st.shotOn) || 0) * 3 + d1v1Goal * 4));
          S_hoy.tir = Math.min(99, Math.max(50, Math.round(0.6 * tirScore + 0.4 * baseSessionScore)));
        }

        const dribbles = (Number(st.dribbleOk) || 0) + (Number(st.dribbleKo) || 0);
        if (dribbles > 0 || d1v1Goal > 0) {
          const dribAcc = dribbles > 0 ? (Number(st.dribbleOk) || 0) / dribbles : 0.5;
          const regScore = Math.round(50 + (dribAcc - 0.5) * 35 + Math.min(25, (Number(st.dribbleOk) || 0) * 4 + d1v1Goal * 3));
          S_hoy.reg = Math.min(99, Math.max(50, Math.round(0.6 * regScore + 0.4 * baseSessionScore)));
        }

        const rec = Number(st.recovery) || 0;
        const stops = Number(st.duel1v1WonStop) || 0;
        const saves = Number(st.save) || 0;
        const losses = Number(st.loss) || 0;
        if (rec > 0 || stops > 0 || saves > 0 || losses > 0) {
          const defScore = Math.round(50 + Math.min(35, rec * 4 + stops * 4 + saves * 6 - losses * 2));
          S_hoy.def = Math.min(99, Math.max(50, Math.round(0.6 * defScore + 0.4 * baseSessionScore)));
        }

        const duels = (Number(st.duelWon) || 0) + (Number(st.duelLost) || 0);
        const touches = Number(st.touches) || 0;
        if (duels > 0 || touches > 0) {
          const duelAcc = duels > 0 ? (Number(st.duelWon) || 0) / duels : 0.5;
          const fisScore = Math.round(50 + (duelAcc - 0.5) * 30 + Math.min(25, touches * 0.8 + (Number(st.duelWon) || 0) * 2));
          S_hoy.fis = Math.min(99, Math.max(50, Math.round(0.6 * fisScore + 0.4 * baseSessionScore)));
        }

        if (!pl || pl.disciplineScore === undefined || pl.disciplineScore === null || pl.disciplineScore === '') {
          const foulDeduction = (Number(st.foul) || 0) * 3 + (Number(st.yellow) || 0) * 8 + (Number(st.red) || 0) * 20;
          S_hoy.dis = Math.min(99, Math.max(50, Math.round(85 - foulDeduction)));
        }

        ['pas', 'tir', 'reg', 'def', 'fis', 'dis'].forEach(k => {
          if (k === 'dis' && pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null && pl.disciplineScore !== '') {
            currentSkills.dis = Math.min(99, Math.max(50, Number(pl.disciplineScore)));
            return;
          }
          const S_val = Math.min(99, Math.max(50, S_hoy[k]));
          const A_actual = currentSkills[k];
          if (S_val >= A_actual) {
            currentSkills[k] = Math.min(99, Math.round(A_actual + 0.20 * (S_val - A_actual)));
          } else {
            currentSkills[k] = Math.max(50, A_actual - 1, Math.round(A_actual - 0.04 * (A_actual - S_val)));
          }
        });
      });

      return currentSkills;
    },

    /* Estadísticas de Duelos 1v1 */
    getPlayer1v1Stats(pid, sessions) {
      const sessList = sessions || this.state.sessions || [];
      let wonGoal = 0, wonStop = 0, lostTurnover = 0, lostGoal = 0;
      sessList.forEach(s => {
        const st = (s && s.stats && s.stats[pid]) ? s.stats[pid] : {};
        wonGoal += st.duel1v1WonGoal || 0;
        wonStop += st.duel1v1WonStop || 0;
        lostTurnover += st.duel1v1LostTurnover || 0;
        lostGoal += st.duel1v1LostGoal || 0;
      });
      const won = wonGoal + wonStop;
      const lost = lostTurnover + lostGoal;
      const total = won + lost;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      return { won, lost, total, winRate, wonGoal, wonStop, lostTurnover, lostGoal };
    },

    /* Algoritmo predictivo de probabilidad de victoria en 1v1 */
    calculate1v1WinProbability(p1, p2, r1, r2, d1, d2) {
      // 1. Atributos técnicos/físicos clave para 1v1: Regate (35%), Defensa (30%), Físico (25%), Tiro (10%)
      const skill1 = (r1.reg * 0.35) + (r1.def * 0.30) + (r1.fis * 0.25) + (r1.tir * 0.10);
      const skill2 = (r2.reg * 0.35) + (r2.def * 0.30) + (r2.fis * 0.25) + (r2.tir * 0.10);

      // 2. Ajuste por historial empírico de duelos (ponderado por tamaño de muestra)
      let empAdj1 = 0;
      if (d1.total > 0) {
        const conf1 = Math.min(1.0, d1.total / 12);
        empAdj1 = conf1 * (d1.winRate - 50) * 0.22;
      }
      let empAdj2 = 0;
      if (d2.total > 0) {
        const conf2 = Math.min(1.0, d2.total / 12);
        empAdj2 = conf2 * (d2.winRate - 50) * 0.22;
      }

      // 3. Diferencia de edad y maduración biológica a partir de fecha de nacimiento
      let ageBonus1 = 0;
      let ageBonus2 = 0;
      let ageDiffText = '';

      if (p1 && p2 && p1.birthDate && p2.birthDate) {
        const b1 = new Date(p1.birthDate);
        const b2 = new Date(p2.birthDate);
        if (!isNaN(b1.getTime()) && !isNaN(b2.getTime())) {
          const diffYears = (b2.getTime() - b1.getTime()) / (365.25 * 24 * 3600 * 1000); // positivo si p1 nació antes (es mayor)
          const diffMonths = Math.round(diffYears * 12);

          // En fútbol base/formativo, la diferencia de meses aporta ventaja de fuerza y velocidad
          const ageImpact = Math.max(-9, Math.min(9, diffYears * 3.2));
          ageBonus1 = ageImpact;
          ageBonus2 = -ageImpact;

          if (Math.abs(diffMonths) >= 1) {
            const name1 = (p1.name || 'J1').split(' ')[0];
            const name2 = (p2.name || 'J2').split(' ')[0];
            if (diffMonths > 0) {
              ageDiffText = `${name1} es ${Math.abs(diffMonths)} ${Math.abs(diffMonths) === 1 ? 'mes' : 'meses'} mayor`;
            } else {
              ageDiffText = `${name2} es ${Math.abs(diffMonths)} ${Math.abs(diffMonths) === 1 ? 'mes' : 'meses'} mayor`;
            }
          } else {
            ageDiffText = 'Misma edad biológica';
          }
        }
      }

      const finalScore1 = skill1 + empAdj1 + ageBonus1;
      const finalScore2 = skill2 + empAdj2 + ageBonus2;

      // Modelo logístico de probabilidad
      const scoreDiff = finalScore1 - finalScore2;
      const rawProb1 = 1 / (1 + Math.exp(-scoreDiff / 14));
      let prob1 = Math.round(rawProb1 * 100);
      prob1 = Math.max(12, Math.min(88, prob1)); // Acotar entre 12% y 88%
      const prob2 = 100 - prob1;

      let favorite = null;
      const reasons = [];
      if (prob1 >= 53) {
        favorite = 1;
        if (r1.reg > r2.reg) reasons.push('Mayor desborde / regate');
        if (r1.fis > r2.fis) reasons.push('Superioridad física');
        if (r1.def > r2.def) reasons.push('Mayor solidez defensiva');
        if (d1.winRate > d2.winRate && d1.total >= 3) reasons.push('Mejor % victorias 1v1 previo');
        if (ageBonus1 >= 2) reasons.push('Ventaja por madurez física');
      } else if (prob2 >= 53) {
        favorite = 2;
        if (r2.reg > r1.reg) reasons.push('Mayor desborde / regate');
        if (r2.fis > r1.fis) reasons.push('Superioridad física');
        if (r2.def > r1.def) reasons.push('Mayor solidez defensiva');
        if (d2.winRate > d1.winRate && d2.total >= 3) reasons.push('Mejor % victorias 1v1 previo');
        if (ageBonus2 >= 2) reasons.push('Ventaja por madurez física');
      }

      return {
        prob1,
        prob2,
        favorite,
        reasons: reasons.slice(0, 3),
        ageDiffText
      };
    },

    upsertCoachProfile(profile) {
      this.state.coachProfile = Object.assign({}, this.state.coachProfile || {}, profile);
      this.save();
      if (window.Cloud && window.Cloud.pushCoachState) {
        window.Cloud.pushCoachState(this.state);
      }
      return this.state.coachProfile;
    },

    /* Comparador Cara a Cara (Head-to-Head) */
    comparePlayers(p1Id, p2Id, sessions) {
      const sess = sessions || this.state.sessions;
      const p1 = this.player(p1Id);
      const p2 = this.player(p2Id);
      if (!p1 || !p2) return null;

      const agg1 = this.playerAggregate(p1Id, sess);
      const agg2 = this.playerAggregate(p2Id, sess);

      const r1 = this.calculateMatchRating(agg1.totals, p1.mainPosition);
      const r2 = this.calculateMatchRating(agg2.totals, p2.mainPosition);

      const passTot1 = (agg1.totals.passOk || 0) + (agg1.totals.passKo || 0);
      const passPct1 = passTot1 > 0 ? Math.round(((agg1.totals.passOk || 0) / passTot1) * 100) : 0;
      const passTot2 = (agg2.totals.passOk || 0) + (agg2.totals.passKo || 0);
      const passPct2 = passTot2 > 0 ? Math.round(((agg2.totals.passOk || 0) / passTot2) * 100) : 0;

      const shotTot1 = (agg1.totals.shotOn || 0) + (agg1.totals.shotOff || 0);
      const shotPct1 = shotTot1 > 0 ? Math.round(((agg1.totals.shotOn || 0) / shotTot1) * 100) : 0;
      const shotTot2 = (agg2.totals.shotOn || 0) + (agg2.totals.shotOff || 0);
      const shotPct2 = shotTot2 > 0 ? Math.round(((agg2.totals.shotOn || 0) / shotTot2) * 100) : 0;

      return {
        p1, p2,
        rating1: r1, rating2: r2,
        metrics: [
          { key: 'rating', labelKey: 'rating', v1: r1, v2: r2, suffix: '', higherIsBetter: true },
          { key: 'passAcc', labelKey: 'passAccuracy', v1: passPct1, v2: passPct2, suffix: '%', higherIsBetter: true },
          { key: 'shotAcc', labelKey: 'shotAccuracy', v1: shotPct1, v2: shotPct2, suffix: '%', higherIsBetter: true },
          { key: 'touches', labelKey: 'stat_touches', v1: agg1.totals.touches || 0, v2: agg2.totals.touches || 0, suffix: '', higherIsBetter: true },
          { key: 'goal', labelKey: 'stat_goal', v1: agg1.totals.goal || 0, v2: agg2.totals.goal || 0, suffix: '', higherIsBetter: true },
          { key: 'assist', labelKey: 'stat_assist', v1: agg1.totals.assist || 0, v2: agg2.totals.assist || 0, suffix: '', higherIsBetter: true },
          { key: 'recovery', labelKey: 'stat_recovery', v1: agg1.totals.recovery || 0, v2: agg2.totals.recovery || 0, suffix: '', higherIsBetter: true },
          { key: 'dribbleOk', labelKey: 'stat_dribbleOk', v1: agg1.totals.dribbleOk || 0, v2: agg2.totals.dribbleOk || 0, suffix: '', higherIsBetter: true }
        ]
      };
    },

    /* Evolución Temporal y Progreso */
    playerTimeline(playerId, metricKey, sessions) {
      const sess = (sessions || this.state.sessions)
        .slice()
        .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
      const points = [];

      sess.forEach(s => {
        const st = (s.stats || {})[playerId];
        if (!st || !Object.keys(st).some(k => st[k] > 0)) return;

        let val = 0;
        if (metricKey === 'rating') {
          const p = Store.player(playerId);
          val = Store.calculateMatchRating(st, p ? p.mainPosition : 'Jugador');
        } else if (metricKey === 'passAcc') {
          const tot = (st.passOk || 0) + (st.passKo || 0);
          val = tot > 0 ? Math.round(((st.passOk || 0) / tot) * 100) : 0;
        } else if (metricKey === 'shotAcc') {
          const tot = (st.shotOn || 0) + (st.shotOff || 0);
          val = tot > 0 ? Math.round(((st.shotOn || 0) / tot) * 100) : 0;
        } else {
          val = st[metricKey] || 0;
        }

        points.push({
          date: s.date,
          title: Store.sessionTitle(s),
          type: s.type,
          val
        });
      });

      return points;
    },

    /* Convocatorias y Asistencia */
    convocation(id) {
      return (this.state.convocations || []).find(c => c.id === id) || null;
    },

    upsertConvocation(data) {
      this.state.convocations = this.state.convocations || [];
      if (data.id) {
        const i = this.state.convocations.findIndex(c => c.id === data.id);
        if (i >= 0) {
          this.state.convocations[i] = Object.assign({}, this.state.convocations[i], data);
          this.save();
          return this.state.convocations[i];
        }
      }
      const c = Object.assign({
        id: uid('conv'),
        title: '',
        type: 'match',
        date: new Date().toISOString().slice(0, 10),
        time: '10:00',
        venue: '',
        address: '',
        rival: '',
        teamId: '',
        notes: '',
        list: {}, // { [pid]: 'called' | 'bench' | 'uncalled' | 'injured' | 'absent' }
        responses: {} // { [pid]: { status: 'attending' | 'absent', time: number } }
      }, data);
      if (!c.id) c.id = uid('conv');
      this.state.convocations.unshift(c);
      this.save();
      return c;
    },

    deleteConvocation(id) {
      const conv = (this.state.convocations || []).find(c => c && c.id === id) || null;
      const linkedSessionId = conv ? conv.sessionId : null;

      if (conv) {
        this.markRecurringDeleted(conv);
      } else if (id) {
        this.markRecurringDeleted(id);
      }

      this.state.convocations = (this.state.convocations || []).filter(c => c && c.id !== id);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const cTeams = conv
        ? ((Array.isArray(conv.teamIds) && conv.teamIds.length > 0) ? conv.teamIds : (conv.teamId ? [conv.teamId] : []))
        : [];
      const cTeamsSorted = cTeams.slice().map(String).sort().join(',');

      // Eliminar también la sesión asociada (en Inicio y Sesiones)
      const sessionsToDelete = [];
      this.state.sessions = (this.state.sessions || []).filter(s => {
        if (!s) return false;
        const isDirectLink = (s.convocationId === id) ||
                             (linkedSessionId && s.id === linkedSessionId) ||
                             ('conv_' + s.id === id) ||
                             (conv && conv.scheduleId && s.scheduleId === conv.scheduleId && s.date === conv.date);
        let isSameTraining = false;
        if (!isDirectLink && conv && conv.type === 'training' && s.type === 'training' && s.date === conv.date) {
          const sTeams = (Array.isArray(s.teamIds) && s.teamIds.length > 0) ? s.teamIds : (s.teamId ? [s.teamId] : []);
          const sTeamsSorted = sTeams.slice().map(String).sort().join(',');
          if (cTeamsSorted === sTeamsSorted) {
            isSameTraining = true;
          }
        }
        if (!isDirectLink && !isSameTraining) return true;

        const isTodayOrFuture = (s.date >= todayStr);
        const hasData = (s.elapsedMs > 0) ||
                        (s.stats && Object.keys(s.stats).length > 0) ||
                        (s.log && s.log.length > 0) ||
                        (s.status === 'completed');

        if (isDirectLink || isTodayOrFuture || !hasData) {
          this.markRecurringDeleted(s);
          sessionsToDelete.push(s);
          return false;
        }
        return true;
      });

      this.save();

      if (typeof window !== 'undefined' && window.Cloud) {
        try {
          if (typeof window.Cloud.deleteConvocationFromCloud === 'function') {
            window.Cloud.deleteConvocationFromCloud(id);
          }
          sessionsToDelete.forEach(s => {
            if (typeof window.Cloud.deleteSessionFromCloud === 'function') {
              window.Cloud.deleteSessionFromCloud(s.id);
            }
          });
          if (typeof window.Cloud.pushCoachState === 'function') {
            window.Cloud.pushCoachState(this.state, true);
          }
        } catch (e) {
          console.warn('[Store] Error borrando convocatoria/sesión vinculada de la nube:', e);
        }
      }
    },

    recurringSchedule(id) {
      return (this.state.recurringSchedules || []).find(r => r.id === id) || null;
    },

    upsertRecurringSchedule(data) {
      this.state.recurringSchedules = this.state.recurringSchedules || [];
      let item = null;
      if (data.id) {
        const i = this.state.recurringSchedules.findIndex(r => r.id === data.id);
        if (i >= 0) {
          item = Object.assign({}, this.state.recurringSchedules[i], data);
          this.state.recurringSchedules[i] = item;
        }
      }
      if (!item) {
        item = Object.assign({
          id: uid('rec'),
          title: '',
          teamId: '',
          teamIds: [],
          excludedPlayerIds: [],
          includedPlayerIds: [],
          daysOfWeek: [2, 4], // 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab, 0=Dom
          time: '18:00',
          endTime: '19:30',
          duration: 90,
          dayTimes: {},
          dayEndTimes: {},
          dayDurations: {},
          venue: '',
          address: '',
          notes: '',
          startDate: '',
          endDate: '',
          active: true,
          createdAt: Date.now()
        }, data);
        if (!item.id) item.id = uid('rec');
        // Deduplicar cualquier horario previo con mismo id
        this.state.recurringSchedules = this.state.recurringSchedules.filter(r => r.id !== item.id);
        this.state.recurringSchedules.push(item);
      } else {
        if (Array.isArray(data.excludedPlayerIds)) {
          item.excludedPlayerIds = [...data.excludedPlayerIds];
        }
        if (Array.isArray(data.includedPlayerIds)) {
          item.includedPlayerIds = [...data.includedPlayerIds];
        }
      }
      this.save();
      this.generateRecurringConvocations(30, item.startDate, item.endDate);
      return item;
    },

    removePlayerFromRecurringSchedule(schedId, playerId) {
      if (!playerId) return 0;
      let removedCount = 0;

      // 1. Marcar como excluido en el horario recurrente si se conoce
      if (schedId) {
        const sched = this.recurringSchedule(schedId);
        if (sched) {
          sched.excludedPlayerIds = Array.isArray(sched.excludedPlayerIds) ? sched.excludedPlayerIds : [];
          if (!sched.excludedPlayerIds.includes(playerId)) {
            sched.excludedPlayerIds.push(playerId);
          }
          if (Array.isArray(sched.includedPlayerIds)) {
            sched.includedPlayerIds = sched.includedPlayerIds.filter(id => id !== playerId);
          }
        }
      }

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      // 2. Eliminar al jugador de todas las convocatorias de hoy y futuras de este horario recurrente
      (this.state.convocations || []).forEach(c => {
        if (!c) return;
        const isTargetSched = schedId 
          ? (c.scheduleId === schedId || (c.id && c.id.startsWith(`rec_${schedId}_`)))
          : (c.isRecurring || (c.id && c.id.startsWith('rec_')));
        if (isTargetSched && c.date >= todayStr) {
          if (c.list && c.list[playerId]) {
            delete c.list[playerId];
            removedCount++;
          }
          if (c.responses && c.responses[playerId]) {
            delete c.responses[playerId];
          }
        }
      });

      // 3. Eliminar al jugador de sesiones vinculadas no disputadas
      (this.state.sessions || []).forEach(s => {
        if (!s) return;
        const isTargetSess = schedId
          ? (s.scheduleId === schedId || (s.convocationId && s.convocationId.startsWith(`rec_${schedId}_`)))
          : (s.scheduleId || (s.convocationId && s.convocationId.startsWith('rec_')));
        if (isTargetSess && s.date >= todayStr && (s.elapsedMs === 0 || s.elapsedMs == null)) {
          if (s.attendance && s.attendance[playerId]) {
            delete s.attendance[playerId];
          }
          if (Array.isArray(s.slots)) {
            s.slots = s.slots.map(x => (x === playerId ? null : x));
          }
        }
      });

      this.save();
      return removedCount;
    },

    includePlayerInRecurringSchedule(schedId, playerId) {
      if (!schedId || !playerId) return;
      const sched = this.recurringSchedule(schedId);
      if (sched) {
        if (Array.isArray(sched.excludedPlayerIds)) {
          sched.excludedPlayerIds = sched.excludedPlayerIds.filter(id => id !== playerId);
        }
        const p = this.player(playerId);
        const targetTeamIds = Array.isArray(sched.teamIds) && sched.teamIds.length > 0 ? sched.teamIds : (sched.teamId ? [sched.teamId] : []);
        if (p && targetTeamIds.length > 0 && !targetTeamIds.includes(p.teamId)) {
          sched.includedPlayerIds = Array.isArray(sched.includedPlayerIds) ? sched.includedPlayerIds : [];
          if (!sched.includedPlayerIds.includes(playerId)) {
            sched.includedPlayerIds.push(playerId);
          }
        }
      }
      this.generateRecurringConvocations(30);
      this.save();
    },

    deleteRecurringSchedule(id) {
      this.state.recurringSchedules = (this.state.recurringSchedules || []).filter(r => r.id !== id);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Identificar convocatorias vinculadas a este horario recurrente
      const isConvFromSchedule = (c) => {
        if (!c) return false;
        return c.scheduleId === id || (c.id && c.id.startsWith(`rec_${id}_`));
      };

      const schedConvs = (this.state.convocations || []).filter(isConvFromSchedule);
      const schedConvIds = new Set(schedConvs.map(c => c.id));
      const schedConvSessionIds = new Set(schedConvs.map(c => c.sessionId).filter(Boolean));

      // 2. Eliminar convocatorias de hoy y futuras generadas por este plan recurrente
      const convsToDelete = [];
      this.state.convocations = (this.state.convocations || []).filter(c => {
        if (!isConvFromSchedule(c)) return true;
        const isTodayOrFuture = c.date >= todayStr;
        if (isTodayOrFuture) {
          convsToDelete.push(c);
          return false;
        }
        return true;
      });

      // 3. Identificar y eliminar sesiones asociadas a este plan recurrente
      const isSessionFromSchedule = (s) => {
        if (!s) return false;
        if (s.scheduleId === id) return true;
        if (s.convocationId && (s.convocationId.startsWith(`rec_${id}_`) || schedConvIds.has(s.convocationId))) return true;
        if (schedConvSessionIds.has(s.id)) return true;
        return false;
      };

      const sessionsToDelete = [];
      this.state.sessions = (this.state.sessions || []).filter(s => {
        if (!isSessionFromSchedule(s)) return true;

        const isTodayOrFuture = (s.date >= todayStr);
        const hasData = (s.elapsedMs > 0) ||
                        (s.stats && Object.keys(s.stats).length > 0) ||
                        (s.log && s.log.length > 0) ||
                        (s.status === 'completed');

        // Si es de hoy, futura, o no tiene datos de partido/entrenamiento jugados, eliminar
        if (isTodayOrFuture || !hasData) {
          sessionsToDelete.push(s);
          return false;
        }
        return true;
      });

      // 4. Notificar a la nube el borrado de las sesiones y convocatorias individuales
      if (typeof window !== 'undefined' && window.Cloud) {
        convsToDelete.forEach(c => {
          try {
            if (typeof window.Cloud.deleteConvocationFromCloud === 'function') {
              window.Cloud.deleteConvocationFromCloud(c.id);
            }
          } catch (e) {}
        });
        sessionsToDelete.forEach(s => {
          try {
            if (typeof window.Cloud.deleteSessionFromCloud === 'function') {
              window.Cloud.deleteSessionFromCloud(s.id);
            }
          } catch (e) {
            console.warn('[Store] Error borrando sesión recurrente de la nube:', e);
          }
        });
      }

      this.save();
    },

    cleanupOrphanRecurring() {
      const schedules = this.state.recurringSchedules || [];
      const validScheduleIds = new Set(schedules.map(r => r.id));
      const deletedSet = new Set(this.state.deletedRecurringIds || []);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Limpiar convocatorias huérfanas de horarios recurrentes que ya no existen o que están en deletedRecurringIds
      const convsToDelete = [];
      this.state.convocations = (this.state.convocations || []).filter(c => {
        if (!c) return false;
        if (c.id && deletedSet.has(c.id)) {
          convsToDelete.push(c);
          return false;
        }
        if (c.scheduleId && c.date && deletedSet.has(`rec_${c.scheduleId}_${String(c.date).replace(/-/g, '')}`)) {
          convsToDelete.push(c);
          return false;
        }
        const isRec = !!(c.isRecurring || (c.id && c.id.startsWith('rec_')) || c.scheduleId);
        if (!isRec) return true;

        let schedId = c.scheduleId;
        if (!schedId && c.id && c.id.startsWith('rec_')) {
          const parts = c.id.split('_');
          if (parts.length >= 3) schedId = parts[1];
        }

        if (schedId && !validScheduleIds.has(schedId)) {
          if (c.date >= todayStr) {
            convsToDelete.push(c);
            return false;
          }
        }
        return true;
      });

      // 2. Limpiar sesiones huérfanas de horarios recurrentes que ya no existen o están en deletedRecurringIds
      const sessionsToDelete = [];
      const remainingSessions = [];
      (this.state.sessions || []).forEach(s => {
        if (!s) return;
        if ((s.id && deletedSet.has(s.id)) ||
            (s.convocationId && deletedSet.has(s.convocationId)) ||
            (s.scheduleId && s.date && deletedSet.has(`rec_${s.scheduleId}_${String(s.date).replace(/-/g, '')}`))) {
          sessionsToDelete.push(s);
          return;
        }
        const hasScheduleId = !!s.scheduleId;
        const isRecConv = !!(s.convocationId && s.convocationId.startsWith('rec_'));

        if (!hasScheduleId && !isRecConv) {
          remainingSessions.push(s);
          return;
        }

        let schedId = s.scheduleId;
        if (!schedId && isRecConv) {
          const parts = s.convocationId.split('_');
          if (parts.length >= 3) schedId = parts[1];
        }

        if (schedId && !validScheduleIds.has(schedId)) {
          const isTodayOrFuture = (s.date >= todayStr);
          const hasData = (s.elapsedMs > 0) ||
                          (s.stats && Object.keys(s.stats).length > 0) ||
                          (s.log && s.log.length > 0) ||
                          (s.status === 'completed');

          if (isTodayOrFuture || !hasData) {
            sessionsToDelete.push(s);
            return;
          }
        }
        remainingSessions.push(s);
      });

      if (sessionsToDelete.length > 0 || convsToDelete.length > 0) {
        this.state.sessions = remainingSessions;
        this.save();
        if (typeof window !== 'undefined' && window.Cloud) {
          convsToDelete.forEach(c => {
            try {
              if (typeof window.Cloud.deleteConvocationFromCloud === 'function') {
                window.Cloud.deleteConvocationFromCloud(c.id);
              }
            } catch (e) {}
          });
          sessionsToDelete.forEach(s => {
            try {
              if (typeof window.Cloud.deleteSessionFromCloud === 'function') {
                window.Cloud.deleteSessionFromCloud(s.id);
              }
            } catch (e) {
              console.warn('[Store] Error borrando sesión huérfana de la nube:', e);
            }
          });
          if (typeof window.Cloud.pushCoachState === 'function') {
            window.Cloud.pushCoachState(this.state, true);
          }
        }
      }
    },

    generateRecurringConvocations(daysAhead = 30, startDateStr = '', endDateStr = '') {
      this.state.recurringSchedules = this.state.recurringSchedules || [];
      const activeSchedules = this.state.recurringSchedules.filter(r => r.active !== false);
      if (!activeSchedules.length) return 0;

      const deletedSet = new Set(this.state.deletedRecurringIds || []);
      let generatedCount = 0;

      function formatLocalDate(dt) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      const now = new Date();
      let startD = new Date();
      if (startDateStr) {
        const parts = startDateStr.split('-').map(x => parseInt(x, 10));
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          startD = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        } else {
          startD.setHours(12, 0, 0, 0);
        }
      } else {
        startD.setHours(12, 0, 0, 0);
      }

      activeSchedules.forEach(sched => {
        const targetDays = Array.isArray(sched.daysOfWeek) ? sched.daysOfWeek : [2, 4];
        const targetTeamIds = Array.isArray(sched.teamIds) && sched.teamIds.length > 0
          ? sched.teamIds
          : (sched.teamId ? [sched.teamId] : []);

        const excludedPlayerIds = new Set(sched.excludedPlayerIds || []);
        const includedPlayerIds = new Set(sched.includedPlayerIds || []);

        const teamPlayers = this.state.players.filter(p => {
          if (!p || !p.id) return false;
          if (excludedPlayerIds.has(p.id)) return false;
          if (includedPlayerIds.has(p.id)) return true;
          if (!targetTeamIds.length) return true;
          return targetTeamIds.includes(p.teamId);
        });

        const allowedPlayerIds = new Set(teamPlayers.map(p => p.id));

        let curEndD = null;
        const targetEndStr = endDateStr || sched.endDate || '';
        if (targetEndStr) {
          const parts = targetEndStr.split('-').map(x => parseInt(x, 10));
          if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            curEndD = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
          }
        }
        const maxAheadD = new Date(startD);
        maxAheadD.setDate(startD.getDate() + (daysAhead || 21));
        maxAheadD.setHours(23, 59, 59, 999);

        if (!curEndD || isNaN(curEndD.getTime()) || curEndD > maxAheadD) {
          curEndD = maxAheadD;
        }

        let curD = new Date(startD);
        while (curD <= curEndD) {
          const dayOfWeek = curD.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb

          if (targetDays.includes(dayOfWeek)) {
            const dateStr = formatLocalDate(curD);
            const targetId = `rec_${sched.id}_${dateStr.replace(/-/g, '')}`;

            // Si el entrenador borró explícitamente este entrenamiento recurrente, no volver a generarlo
            if (deletedSet.has(targetId)) {
              curD.setDate(curD.getDate() + 1);
              continue;
            }

            const targetTime = (sched.dayTimes && sched.dayTimes[dayOfWeek]) ? sched.dayTimes[dayOfWeek] : (sched.time || '18:00');
            const targetEndTime = (sched.dayEndTimes && sched.dayEndTimes[dayOfWeek]) ? sched.dayEndTimes[dayOfWeek] : (sched.endTime || '');
            const targetDuration = (sched.dayDurations && sched.dayDurations[dayOfWeek]) ? sched.dayDurations[dayOfWeek] : (sched.duration || 90);

            const existingConv = (this.state.convocations || []).find(c => 
              c.id === targetId ||
              (c.date === dateStr && c.scheduleId === sched.id)
            );

            if (existingConv) {
              const todayStr = formatLocalDate(new Date());
              const isFuture = (dateStr >= todayStr);
              if (isFuture) {
                if (existingConv.time !== targetTime) existingConv.time = targetTime;
                existingConv.endTime = targetEndTime;
                existingConv.duration = targetDuration;
                if (sched.venue) existingConv.venue = sched.venue;
                if (sched.address) existingConv.address = sched.address;
                if (sched.notes) existingConv.notes = sched.notes;
                existingConv.teamIds = targetTeamIds;
                existingConv.teamId = targetTeamIds[0] || '';
                if (!existingConv.list) existingConv.list = {};

                // Limpiar jugadores excluidos o de otros equipos que ya no deban estar convocados en este horario recurrente
                Object.keys(existingConv.list).forEach(pid => {
                  if (!allowedPlayerIds.has(pid)) {
                    delete existingConv.list[pid];
                    if (existingConv.responses) delete existingConv.responses[pid];
                  }
                });

                teamPlayers.forEach(p => {
                  if (!existingConv.list[p.id]) {
                    existingConv.list[p.id] = 'called';
                  }
                });
              }
            } else {
              const defaultList = {};
              teamPlayers.forEach(p => { defaultList[p.id] = 'called'; });

              let autoTitle = sched.title;
              if (!autoTitle) {
                if (targetTeamIds.length === 1) {
                  const teamObj = this.team(targetTeamIds[0]);
                  autoTitle = teamObj ? 'Entrenamiento ' + teamObj.name : 'Entrenamiento';
                } else if (targetTeamIds.length > 1) {
                  const teamNames = targetTeamIds.map(tid => {
                    const tm = this.team(tid);
                    return tm ? tm.name : '';
                  }).filter(Boolean);
                  autoTitle = teamNames.length > 0 ? 'Entrenamiento (' + teamNames.join(' / ') + ')' : 'Entrenamiento';
                } else {
                  autoTitle = 'Entrenamiento';
                }
              }

              this.upsertConvocation({
                id: targetId,
                scheduleId: sched.id,
                isRecurring: true,
                title: autoTitle,
                type: 'training',
                date: dateStr,
                time: targetTime,
                endTime: targetEndTime,
                duration: targetDuration,
                venue: sched.venue || '',
                address: sched.address || '',
                teamId: targetTeamIds[0] || '',
                teamIds: targetTeamIds,
                notes: sched.notes || '',
                list: defaultList,
                responses: {}
              });
              generatedCount++;
            }
          }
          curD.setDate(curD.getDate() + 1);
        }
      });

      if (generatedCount > 0) {
        this.save();
      }
      return generatedCount;
    },

    autoCreateTodayScheduledSessions() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const tomDate = new Date();
      tomDate.setDate(tomDate.getDate() + 1);
      const ty = tomDate.getFullYear();
      const tm_m = String(tomDate.getMonth() + 1).padStart(2, '0');
      const td = String(tomDate.getDate()).padStart(2, '0');
      const tomorrowStr = `${ty}-${tm_m}-${td}`;

      this.state.sessions = Array.isArray(this.state.sessions) ? this.state.sessions : [];
      this.state.convocations = Array.isArray(this.state.convocations) ? this.state.convocations : [];

      // Limpiar convocatorias y sesiones huérfanas de horarios recurrentes previamente eliminados
      this.cleanupOrphanRecurring();

      // Asegurar que las convocatorias recurrentes estén generadas hasta la fecha
      if (this.state.recurringSchedules && this.state.recurringSchedules.length > 0) {
        this.generateRecurringConvocations(30);
      }

      const deletedSet = new Set(this.state.deletedRecurringIds || []);
      // Incluir convocatorias activas (hoy, mañana y eventos planificados)
      const activeConvocations = this.state.convocations.filter(c => {
        if (!c || !c.date) return false;
        if (c.id && deletedSet.has(c.id)) return false;
        if (c.scheduleId && deletedSet.has(`rec_${c.scheduleId}_${c.date.replace(/-/g, '')}`)) return false;
        return true;
      });
      if (!activeConvocations.length) return 0;

      let createdCount = 0;

      activeConvocations.forEach(c => {
        const targetTeamIds = Array.isArray(c.teamIds) && c.teamIds.length > 0
          ? c.teamIds
          : (c.teamId ? [c.teamId] : []);
        const targetTeamsSortedStr = targetTeamIds.slice().sort().join(',');

        // Comprobar si ya existe una sesión vinculada a esta convocatoria
        const exists = this.state.sessions.find(s => {
          if (!s) return false;
          if (s.convocationId && s.convocationId === c.id) return true;
          if (c.sessionId && s.id === c.sessionId) return true;
          if (s.scheduleId && c.scheduleId && s.scheduleId === c.scheduleId && s.date === c.date) return true;
          if (s.date === c.date && s.type === c.type) {
            if (c.type === 'match') {
              if (c.rival && s.rival && c.rival.toLowerCase().trim() === s.rival.toLowerCase().trim()) return true;
              if (!c.rival && !s.rival) return true;
            } else {
              const sTeams = Array.isArray(s.teamIds) && s.teamIds.length > 0 ? s.teamIds : (s.teamId ? [s.teamId] : []);
              const sTeamsSortedStr = sTeams.slice().sort().join(',');
              if (sTeamsSortedStr === targetTeamsSortedStr) return true;
            }
          }
          return false;
        });

        if (exists) {
          if (!c.sessionId) c.sessionId = exists.id;
          if (!exists.convocationId) exists.convocationId = c.id;
          if (exists.timerStartedAt == null && exists.elapsedMs === 0) {
            if (c.time && !exists.time) exists.time = c.time;
            if (c.venue && !exists.venue) exists.venue = c.venue;
            if (c.address && !exists.address) exists.address = c.address;
            if (c.rival && !exists.rival) exists.rival = c.rival;
          }
        } else {
          const autoTitle = c.title || (c.type === 'match'
            ? (c.rival ? 'Partido vs ' + c.rival : 'Partido')
            : (targetTeamIds.length > 1
              ? 'Entrenamiento (' + targetTeamIds.map(tid => { const tm = this.team(tid); return tm ? tm.name : ''; }).filter(Boolean).join(' / ') + ')'
              : (targetTeamIds[0] && this.team(targetTeamIds[0]) ? 'Entrenamiento ' + this.team(targetTeamIds[0]).name : 'Entrenamiento')));

          const newSession = {
            id: c.sessionId || uid('s'),
            convocationId: c.id,
            scheduleId: c.scheduleId || '',
            type: c.type || 'training',
            date: c.date,
            time: c.time || '18:00',
            endTime: c.endTime || '',
            duration: c.duration || 90,
            createdAt: Date.now(),
            title: autoTitle,
            rival: c.rival || '',
            venue: c.venue || '',
            address: c.address || '',
            teamId: targetTeamIds[0] || '',
            teamIds: targetTeamIds,
            notes: c.notes || '',
            status: 'active',
            elapsedMs: 0,
            timerStartedAt: null,
            slots: [null, null],
            enabledStats: null,
            attendance: c.list || {},
            score: { home: 0, away: 0 },
            period: 'B1',
            zones: [],
            stats: {},
            log: []
          };

          c.sessionId = newSession.id;
          this.state.sessions.unshift(newSession);
          createdCount++;
        }
      });

      if (createdCount > 0) {
        this.save();
        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(this.state, true);
        }
      }
      return createdCount;
    },

    fmtTime(ms, session) {
      if (session && session.timerMode === 'countdown' && session.countdownTargetMs) {
        const diff = session.countdownTargetMs - ms;
        if (diff < 0) {
          const pos = Math.abs(diff);
          const tot = Math.floor(pos / 1000);
          const m = Math.floor(tot / 60), s = tot % 60;
          return '-' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        } else {
          const tot = Math.floor(diff / 1000);
          const m = Math.floor(tot / 60), s = tot % 60;
          return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        }
      }
      const tot = Math.floor(ms / 1000);
      const m = Math.floor(tot / 60), s = tot % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flushNative(); });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', () => Store.flushNative());
  }

  window.Store = Store;
  try {
    setTimeout(() => {
      if (Store.evaluateAutoWeeklyMissions && Store.state && Array.isArray(Store.state.players)) {
        Store.evaluateAutoWeeklyMissions(Store.state.players.map(p => p.id));
      }
    }, 600);
  } catch (e) {}
})();

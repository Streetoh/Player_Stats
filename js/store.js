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
    { key: 'passKo',    labelKey: 'stat_passKo',    shortKey: 'short_passKo',    emoji: '❌', color: '#ef4444', def: true },
    { key: 'shotOn',    labelKey: 'stat_shotOn',    shortKey: 'short_shotOn',    emoji: '🎯', color: '#06b6d4', def: true },
    { key: 'shotOff',   labelKey: 'stat_shotOff',   shortKey: 'short_shotOff',   emoji: '↗️', color: '#f97316', def: true },
    { key: 'goal',      labelKey: 'stat_goal',      shortKey: 'short_goal',      emoji: '🥅', color: '#facc15', def: true, linked: ['shotOn'] },
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
    { key: 'red',       labelKey: 'stat_red',       shortKey: 'short_red',       emoji: '🟥', color: '#dc2626', def: false }
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
    s.teams = Array.isArray(s.teams) ? s.teams : [];
    s.sessions = Array.isArray(s.sessions) ? s.sessions : [];
    s.convocations = Array.isArray(s.convocations) ? s.convocations : [];
    // Limpieza de convocatorias recurrentes vacías generadas a más de 21 días en el futuro (cuota Spark)
    const maxFutureLimit = new Date();
    maxFutureLimit.setDate(maxFutureLimit.getDate() + 21);
    const maxFutureStr = maxFutureLimit.toISOString().slice(0, 10);
    s.convocations = s.convocations.filter(c => {
      if (!c || !c.id) return false;
      if (c.id.startsWith('rec_') && (!c.responses || Object.keys(c.responses).length === 0)) {
        if (c.date && c.date > maxFutureStr) return false;
      }
      return true;
    });
    s.recurringSchedules = Array.isArray(s.recurringSchedules) ? s.recurringSchedules : [];
    s.coachProfile = Object.assign({}, d.coachProfile, s.coachProfile || {});
    s.settings = Object.assign({}, d.settings, s.settings || {});
    if (!s.settings.convocatoriaWebUrl) s.settings.convocatoriaWebUrl = d.settings.convocatoriaWebUrl;
    s.settings.enabledStats = (s.settings.enabledStats || []).filter(k => STAT_MAP[k]);
    if (!s.settings.enabledStats.length) s.settings.enabledStats = d.settings.enabledStats;
    s.sessions.forEach(x => {
      x.type = (x.type === 'match' ? 'match' : 'training');
      x.stats = x.stats || {};
      x.log = Array.isArray(x.log) ? x.log : [];
      x.slots = Array.isArray(x.slots) ? x.slots : [null, null];
      x.elapsedMs = x.elapsedMs || 0;
      x.score = x.score || { home: 0, away: 0 };
      x.period = x.period || (x.type === 'match' ? '1T' : 'B1');
      x.zones = Array.isArray(x.zones) ? x.zones : [];
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
      const conv = this.convocation(resp.convId);
      if (!conv) return;

      conv.list = conv.list || {};
      conv.responses = conv.responses || {};

      if (resp.status === 'pending' || !resp.status) {
        delete conv.responses[resp.playerId];
      } else {
        const isAttending = (resp.status === 'called' || resp.status === 'attending' || resp.status === 'yes');
        const statusKey = isAttending ? 'attending' : 'absent';
        conv.responses[resp.playerId] = {
          status: statusKey,
          playerName: resp.playerName || '',
          notes: resp.notes || '',
          time: resp.timestamp || Date.now()
        };
      }

      this.save();

      if (!isInitialSync && typeof window.onPlayerAttendanceResponse === 'function') {
        window.onPlayerAttendanceResponse(resp, isInitialSync);
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

    upsertPlayer(data) {
      if (data.id) {
        const i = this.state.players.findIndex(p => p.id === data.id);
        if (i >= 0) { this.state.players[i] = Object.assign({}, this.state.players[i], data); this.save(); return this.state.players[i]; }
      }
      const p = Object.assign({
        id: uid('p'), name: '', lastName: '', nickname: '', birthDate: '', teamId: '',
        mainDorsal: null, secondaryDorsal: null, foot: 'Diestro', mainPosition: 'Jugador',
        secondaryPosition: '', secondaryPositions: [],
        parentContact: { name: '', phone: '', email: '' },
        photo: '', disciplineScore: 100
      }, data);
      if (!p.id) p.id = uid('p');
      this.state.players.push(p);
      this.save();
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
      if (!missionData || !missionData.text) {
        delete p.weeklyMission;
      } else {
        p.weeklyMission = {
          text: missionData.text,
          presetKey: missionData.presetKey || '',
          status: missionData.status || 'pending',
          assignedAt: missionData.assignedAt || Date.now(),
          completedAt: missionData.status === 'completed' ? (missionData.completedAt || Date.now()) : null
        };
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
      delete p.weeklyMission;
      this.save();
      return p;
    },

    setOfficialMatchMvp(sessionId, playerId) {
      const s = this.session(sessionId);
      if (!s) return null;
      s.mvpOfficialId = playerId || null;
      this.save();
      if (window.Cloud && window.Cloud.setOfficialMatchMvp) {
        window.Cloud.setOfficialMatchMvp(sessionId, playerId);
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

    deleteSession(id) {
      this.state.sessions = this.state.sessions.filter(s => s.id !== id);
      this.save();
    },

    /* Gestión de Asistencia (Pasar Lista) */
    setSessionAttendance(sessionId, attendanceMap, replace = false) {
      const s = this.session(sessionId);
      if (!s) return null;
      s.attendance = replace ? Object.assign({}, attendanceMap) : Object.assign({}, s.attendance || {}, attendanceMap);
      s.updatedAt = Date.now();
      this.save();
      return s.attendance;
    },

    getSessionAttendance(sessionId) {
      const s = this.session(sessionId);
      return (s && s.attendance) || {};
    },

    getSessionPlayersForAttendance(sessionId) {
      const s = this.session(sessionId);
      if (!s) return [];
      const playerIds = new Set();

      // 1. Si la sesión está vinculada a una convocatoria, usar convocados
      if (s.convocationId) {
        const c = this.convocation(s.convocationId);
        if (c && c.list) {
          Object.keys(c.list).forEach(pid => {
            const st = c.list[pid];
            if (st && st !== 'uncalled' && st !== 'absent') playerIds.add(pid);
          });
        }
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

      const players = Array.from(playerIds).map(id => this.player(id)).filter(Boolean);
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
        .filter(s => s && s.attendance && s.attendance[playerId])
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

      let streak = 0;
      for (const s of allSessions) {
        const att = s.attendance[playerId];
        const st = (typeof att === 'object' && att !== null) ? att.status : att;
        if (st === 'present' || st === 'late') {
          streak++;
        } else if (st === 'justified') {
          continue; // Justificado no rompe la racha
        } else {
          break; // Ausente rompe la racha
        }
      }
      return streak;
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

    /* Registro de acciones (+1 / -1) */
    record(sessionId, playerId, key, delta) {
      const s = this.session(sessionId);
      if (!s || !playerId || !STAT_MAP[key]) return null;
      s.type = s.type === 'match' ? 'match' : 'training';
      const keys = [key];
      if (delta > 0 && this.state.settings.linkGoalShot && STAT_MAP[key].linked) {
        keys.push.apply(keys, STAT_MAP[key].linked);
      }
      // Acciones con balón que suman automáticamente +1 toque
      const TOUCH_KEYS = ['passOk', 'passKo', 'shotOn', 'shotOff', 'goal', 'assist', 'dribbleOk', 'dribbleKo', 'recovery', 'cross', 'keyPass', 'header', 'save'];
      if (delta > 0 && TOUCH_KEYS.includes(key) && !keys.includes('touches')) {
        keys.push('touches');
      }

      const st = s.stats[playerId] = s.stats[playerId] || {};
      const applied = [];
      keys.forEach(k => {
        const cur = st[k] || 0;
        const next = Math.max(0, cur + delta);
        if (next !== cur) { st[k] = next; applied.push(k); }
      });
      if (!applied.length) return null;

      // Incrementar marcador local automáticamente cuando se marca un gol
      let goalDeltaHome = 0;
      if (key === 'goal' && delta > 0 && s.type === 'match') {
        s.score = s.score || { home: 0, away: 0 };
        s.score.home = (s.score.home || 0) + delta;
        goalDeltaHome = delta;
      }

      const entry = { t: Date.now(), m: this.elapsed(s), p: playerId, k: applied, d: delta, type: s.type };
      if (goalDeltaHome > 0) {
        entry.goalScoreHome = goalDeltaHome;
      }
      s.log.push(entry);
      this.save();
      return entry;
    },

    /* Deshacer (Undo) silencioso por jugador */
    undo(sessionId, playerId) {
      const s = this.session(sessionId);
      if (!s) return null;
      for (let i = s.log.length - 1; i >= 0; i--) {
        const e = s.log[i];
        if (e.p === playerId) {
          const st = s.stats[playerId] || {};
          e.k.forEach(k => { st[k] = Math.max(0, (st[k] || 0) - e.d); });
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
        if (s.type === 'match') {
          if (s.mvpOfficialId && String(s.mvpOfficialId) === sPid) {
            count++;
          } else if (s.mvpWinnerId && String(s.mvpWinnerId) === sPid) {
            count++;
          }
        }
      });
      return count;
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
      return Object.keys(s.stats || {}).filter(pid => {
        const st = s.stats[pid];
        return st && Object.keys(st).some(k => st[k] > 0);
      });
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
      sessList.forEach(s => {
        const st = (s.stats || {})[playerId];
        if (!st || !Object.keys(st).some(k => st[k] > 0)) return;
        perSession.push({ session: s, stats: st });
        Object.keys(st).forEach(k => { totals[k] = (totals[k] || 0) + (st[k] || 0); });
      });
      perSession.sort((a, b) => (a.session.date + a.session.createdAt).localeCompare(b.session.date + b.session.createdAt));
      return { totals, sessions: perSession, count: perSession.length };
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

    /* Algoritmo de Índice de Rendimiento / Match Rating (1.0 a 10.0) ponderado por volumen e impacto real */
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

      const totalActions = passes + shotOn + shotOff + goal + assist + keyPass + dribbleOk + dribbleKo + recovery + loss + duelWon + duelLost + save;
      if (totalActions === 0 && touches === 0) return 6.0;

      let scoreDelta = 0;

      // Pases: el volumen real premia más que un porcentaje aislado sin juego
      if (passes > 0) {
        const netPass = passOk * 0.08 - passKo * 0.06;
        const passAcc = passOk / passes;
        const volumeFactor = Math.min(1.0, Math.log10(passes + 1) * 0.7);
        scoreDelta += netPass + (passAcc - 0.65) * volumeFactor;
      }

      // Acciones ofensivas y defensivas
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

      // Volumen de participación activa
      scoreDelta += Math.min(0.7, touches * 0.02);

      // Ponderación por rol posicional
      if (p.includes('POR')) {
        scoreDelta += save * 0.5;
      } else if (p.includes('DC') || p.includes('DEL') || p.includes('EXT') || p.includes('ED') || p.includes('EI')) {
        scoreDelta += goal * 0.3 + shotOn * 0.2;
      } else if (p.includes('DFC') || p.includes('DEF') || p.includes('LD') || p.includes('LI') || p.includes('MCD')) {
        scoreDelta += recovery * 0.3 + duelWon * 0.2;
      }

      // Amortiguación por muestra reducida: menos de 4 acciones totales evita notas infladas arbitrarias
      const confidence = Math.min(1.0, (totalActions + touches * 0.5) / 5.0);
      const finalScore = 6.0 + (scoreDelta * confidence);

      return Math.min(10.0, Math.max(1.0, Math.round(finalScore * 10) / 10));
    },

    /* Rating General (1 al 10) estilo FIFA: promedio de Entrenamientos y Partidos.
       Si solo tiene entrenamientos, muestra directamente entrenamientos sin penalizar. */
    calculatePlayerOverallRating(playerId, position) {
      const allSessions = (this.state && this.state.sessions) || [];
      const trainingSessions = allSessions.filter(s => (s.type || 'training') === 'training');
      const matchSessions = allSessions.filter(s => (s.type || 'training') === 'match');

      const aggTrain = this.playerAggregate(playerId, trainingSessions);
      const aggMatch = this.playerAggregate(playerId, matchSessions);

      const hasTrain = aggTrain.count > 0;
      const hasMatch = aggMatch.count > 0;

      let rTrain = hasTrain ? this.calculateMatchRating(aggTrain.totals, position) : null;
      let rMatch = hasMatch ? this.calculateMatchRating(aggMatch.totals, position) : null;

      let rating = 6.0;
      let mode = 'none'; // 'combined' | 'training' | 'match' | 'none'

      if (hasTrain && hasMatch) {
        rating = (rTrain + rMatch) / 2;
        mode = 'combined';
      } else if (hasTrain && !hasMatch) {
        rating = rTrain;
        mode = 'training';
      } else if (!hasTrain && hasMatch) {
        rating = rMatch;
        mode = 'match';
      } else {
        rating = 6.0;
        mode = 'none';
      }

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

    /* Fórmula v1 (solo respaldo si skills-engine.js no está cargado) */
    _legacyPlayerRadar(playerId, sessions) {
      const agg = this.playerAggregate(playerId, sessions || this.state.sessions);
      const st = agg.totals || {};
      const count = agg.count || 0;
      const pl = this.player(playerId);

      const totalActions = Object.values(st).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);

      // Si no tiene sesiones trackeadas ni acciones registradas, empezar en 50 en todas las habilidades
      if (count === 0 || totalActions === 0) {
        return { pas: 50, tir: 50, reg: 50, fis: 50, def: 50, dis: 50 };
      }

      const passes = (st.passOk || 0) + (st.passKo || 0);
      let pas = 50;
      if (passes > 0) {
        const passAcc = (st.passOk || 0) / passes;
        pas = Math.min(99, Math.max(20, Math.round(50 + (passAcc - 0.5) * 40 + Math.min(25, (st.keyPass || 0) * 3 + ((st.passOk || 0) / count) * 1.5))));
      }

      const shots = (st.shotOn || 0) + (st.shotOff || 0);
      let tir = 50;
      if (shots > 0 || (st.goal || 0) > 0) {
        const shotAcc = shots > 0 ? (st.shotOn || 0) / shots : 0.5;
        tir = Math.min(99, Math.max(20, Math.round(50 + (shotAcc - 0.5) * 30 + Math.min(35, (st.goal || 0) * 8 + (st.shotOn || 0) * 2))));
      }

      const dribbles = (st.dribbleOk || 0) + (st.dribbleKo || 0);
      let reg = 50;
      if (dribbles > 0) {
        const dribAcc = (st.dribbleOk || 0) / dribbles;
        reg = Math.min(99, Math.max(20, Math.round(50 + (dribAcc - 0.5) * 35 + Math.min(25, (st.dribbleOk || 0) * 3))));
      }

      const recoveries = st.recovery || 0;
      const losses = st.loss || 0;
      let def = Math.min(99, Math.max(20, Math.round(50 + Math.min(35, ((recoveries / count) * 5) + ((st.save || 0) * 6) - ((losses / count) * 3)))));

      const duels = (st.duelWon || 0) + (st.duelLost || 0);
      let fis = 50;
      if (duels > 0 || (st.touches || 0) > 0) {
        const duelAcc = duels > 0 ? (st.duelWon || 0) / duels : 0.5;
        fis = Math.min(99, Math.max(20, Math.round(50 + (duelAcc - 0.5) * 30 + Math.min(25, ((st.touches || 0) / count) * 1.2))));
      }

      let dis = 50;
      if (pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null) {
        dis = Number(pl.disciplineScore);
      } else {
        const foulDeduction = (st.foul || 0) * 2 + (st.yellow || 0) * 5 + (st.red || 0) * 15;
        dis = Math.min(99, Math.max(20, Math.round(50 + Math.min(45, count * 5) - (foulDeduction / count))));
      }

      return { pas, tir, reg, def, fis, dis };
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
      this.state.convocations = (this.state.convocations || []).filter(c => c.id !== id);
      this.save();
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
      }
      this.save();
      this.generateRecurringConvocations(30, item.startDate, item.endDate);
      return item;
    },

    deleteRecurringSchedule(id) {
      this.state.recurringSchedules = (this.state.recurringSchedules || []).filter(r => r.id !== id);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Eliminar entrenamientos futuros generados por este plan recurrente
      // Los entrenamientos pasados se conservan en el historial
      this.state.convocations = (this.state.convocations || []).filter(c => {
        const isFromSchedule = (c.scheduleId === id || (c.id && c.id.startsWith(`rec_${id}_`)));
        if (!isFromSchedule) return true;
        const isFuture = (c.date > todayStr) || (c.date === todayStr && (c.time || '23:59') >= curTime);
        return !isFuture;
      });

      this.save();
    },

    generateRecurringConvocations(daysAhead = 30, startDateStr = '', endDateStr = '') {
      this.state.recurringSchedules = this.state.recurringSchedules || [];
      const activeSchedules = this.state.recurringSchedules.filter(r => r.active !== false);
      if (!activeSchedules.length) return 0;

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

        const teamPlayers = this.state.players.filter(p => {
          if (!targetTeamIds.length) return true;
          return targetTeamIds.includes(p.teamId);
        });

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

      this.state.sessions = Array.isArray(this.state.sessions) ? this.state.sessions : [];
      this.state.convocations = Array.isArray(this.state.convocations) ? this.state.convocations : [];

      // Asegurar que las convocatorias recurrentes estén generadas hasta la fecha
      if (this.state.recurringSchedules && this.state.recurringSchedules.length > 0) {
        this.generateRecurringConvocations(30);
      }

      const todayTrainings = this.state.convocations.filter(c => c.date === todayStr && c.type === 'training');
      if (!todayTrainings.length) return 0;

      let createdCount = 0;

      todayTrainings.forEach(c => {
        const targetTeamIds = Array.isArray(c.teamIds) && c.teamIds.length > 0
          ? c.teamIds
          : (c.teamId ? [c.teamId] : []);
        const targetTeamsSortedStr = targetTeamIds.slice().sort().join(',');

        // Comprobar si ya existe una sesión en el menú sesiones vinculada a este entrenamiento de hoy
        const exists = this.state.sessions.some(s => {
          if (s.convocationId && s.convocationId === c.id) return true;
          if (c.sessionId && s.id === c.sessionId) return true;
          if (s.scheduleId && c.scheduleId && s.scheduleId === c.scheduleId && s.date === c.date) return true;
          // Misma fecha, tipo entrenamiento y mismos equipos
          if (s.date === c.date && s.type === 'training') {
            const sTeams = Array.isArray(s.teamIds) && s.teamIds.length > 0 ? s.teamIds : (s.teamId ? [s.teamId] : []);
            const sTeamsSortedStr = sTeams.slice().sort().join(',');
            if (sTeamsSortedStr === targetTeamsSortedStr) return true;
          }
          return false;
        });

        if (!exists) {
          const autoTitle = c.title || (targetTeamIds.length > 1
            ? 'Entrenamiento (' + targetTeamIds.map(tid => { const tm = this.team(tid); return tm ? tm.name : ''; }).filter(Boolean).join(' / ') + ')'
            : (targetTeamIds[0] && this.team(targetTeamIds[0]) ? 'Entrenamiento ' + this.team(targetTeamIds[0]).name : 'Entrenamiento'));

          const newSession = {
            id: uid('s'),
            convocationId: c.id,
            scheduleId: c.scheduleId || '',
            type: 'training',
            date: c.date,
            time: c.time || '18:00',
            endTime: c.endTime || '',
            duration: c.duration || 90,
            createdAt: Date.now(),
            title: autoTitle,
            rival: '',
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
            attendance: {},
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

  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flushNative(); });
  window.addEventListener('pagehide', () => Store.flushNative());

  window.Store = Store;
})();

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
    s.settings = Object.assign({}, d.settings, s.settings || {});
    if (!s.settings.convocatoriaWebUrl) s.settings.convocatoriaWebUrl = d.settings.convocatoriaWebUrl;
    s.settings.enabledStats = (s.settings.enabledStats || []).filter(k => STAT_MAP[k]);
    if (!s.settings.enabledStats.length) s.settings.enabledStats = d.settings.enabledStats;
    s.sessions.forEach(x => {
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
        this._cloudTimer = setTimeout(() => {
          window.Cloud.pushCoachState(this.state);
        }, 1200);
      }
      this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    },

    handleIncomingPlayerResponse(resp) {
      if (!resp || !resp.convId || !resp.playerId) return;
      const conv = this.convocation(resp.convId);
      if (!conv) return;

      conv.list = conv.list || {};
      conv.responses = conv.responses || {};

      const isAttending = (resp.status === 'called' || resp.status === 'attending' || resp.status === 'yes');
      const newSt = isAttending ? 'called' : 'absent';
      const statusKey = isAttending ? 'attending' : 'absent';

      conv.list[resp.playerId] = newSt;
      conv.responses[resp.playerId] = {
        status: statusKey,
        playerName: resp.playerName || '',
        notes: resp.notes || '',
        time: resp.timestamp || Date.now()
      };

      this.save();

      if (typeof window.onPlayerAttendanceResponse === 'function') {
        window.onPlayerAttendanceResponse(resp);
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

    sortedPlayers(teamId) {
      return this.state.players
        .filter(p => !teamId || teamId === 'all' || p.teamId === teamId)
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
        secondaryPosition: '', photo: '', disciplineScore: 100
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
        notes: opts.notes || '',
        status: 'active',
        elapsedMs: 0,
        timerStartedAt: null,
        slots: opts.slots || [null, null],
        enabledStats: opts.enabledStats || null, // Configuración específica de botones de esta sesión
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

      const entry = { t: Date.now(), m: this.elapsed(s), p: playerId, k: applied, d: delta };
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
      const st = s.stats[playerId] = s.stats[playerId] || {};
      st[key] = Math.max(0, parseInt(value, 10) || 0);
      this.save();
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
      return this.state.sessions.filter(s => {
        if (type && type !== 'all' && s.type !== type) return false;
        if (days) {
          const t = new Date(s.date + 'T12:00:00').getTime();
          if (now - t > days * 86400000) return false;
        }
        return true;
      });
    },

    playerAggregate(playerId, sessions) {
      const totals = {};
      const perSession = [];
      sessions.forEach(s => {
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

    /* Radar de Habilidades (Spider Chart de 0 a 99) */
    calculatePlayerRadar(playerId, sessions) {
      const agg = this.playerAggregate(playerId, sessions || this.state.sessions);
      const st = agg.totals;
      const count = Math.max(1, agg.count);
      const pl = this.player(playerId);

      const passes = (st.passOk || 0) + (st.passKo || 0);
      const passAcc = passes > 0 ? (st.passOk || 0) / passes : 0.65;
      const pas = Math.min(99, Math.max(45, Math.round(passAcc * 65 + Math.min(34, (st.keyPass || 0) * 4 + ((st.passOk || 0) / count) * 1.5))));

      const shots = (st.shotOn || 0) + (st.shotOff || 0);
      const shotAcc = shots > 0 ? (st.shotOn || 0) / shots : 0.5;
      const tir = Math.min(99, Math.max(40, Math.round(shotAcc * 50 + Math.min(49, (st.goal || 0) * 8 + (st.shotOn || 0) * 2))));

      const dribbles = (st.dribbleOk || 0) + (st.dribbleKo || 0);
      const dribAcc = dribbles > 0 ? (st.dribbleOk || 0) / dribbles : 0.6;
      const reg = Math.min(99, Math.max(40, Math.round(dribAcc * 55 + Math.min(44, (st.dribbleOk || 0) * 4))));

      const def = Math.min(99, Math.max(40, Math.round(50 + Math.min(49, ((st.recovery || 0) / count) * 6 + (st.save || 0) * 8 - ((st.loss || 0) / count) * 2))));

      const duels = (st.duelWon || 0) + (st.duelLost || 0);
      const duelAcc = duels > 0 ? (st.duelWon || 0) / duels : 0.55;
      const fis = Math.min(99, Math.max(45, Math.round(duelAcc * 50 + Math.min(49, ((st.touches || 0) / count) * 1.2 + (st.duelWon || 0) * 2))));

      // Disciplina establecida por el entrenador y ajustada por tarjetas/faltas
      const baseDis = (pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null) ? Number(pl.disciplineScore) : 100;
      const foulDeduction = (st.foul || 0) * 2 + (st.yellow || 0) * 5 + (st.red || 0) * 15;
      const dis = Math.min(99, Math.max(30, Math.round(baseDis - (foulDeduction / count))));

      return { pas, tir, reg, def, fis, dis };
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

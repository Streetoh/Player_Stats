/* =========================================================
   SkillsEngine v2 — Motor de habilidades (Football Analytics)
   ---------------------------------------------------------
   Funciones PURAS: no leen ni escriben estado global, no tocan
   la base de datos. Reciben datos brutos y devuelven números.
   Funciona en navegador (window.SkillsEngine) y en Node (require).

   Modelo:
   1. Agregación ponderada por contexto (partido 1.0, entreno 0.75):
      los rondos de entrenamiento inflan la precisión.
   2. Bayes empírico: los priors salen de la propia plantilla
      (tasa agrupada), mezclados con valores por defecto cuando
      la muestra de la plantilla aún es pequeña.
   3. Tasas suavizadas:   (éxitos + α·μ) / (intentos + α)
      Volúmenes suavizados: (total + β·μ_sesión) / (sesiones + β)
   4. Cada componente se expresa como desviación respecto a la
      media de la plantilla: diferencia de log-odds para tasas y
      log-ratio para volúmenes. Índice 0 = jugador medio.
   5. Calibración: tanh asimétrica  →  [20, 99], media = 50.
      Sin datos ⇒ el prior domina ⇒ 50 (comportamiento previo).
   ========================================================= */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SkillsEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ENGINE_VERSION = '2.0.0';

  /**
   * @typedef {Object<string, number>} StatLine  Contadores brutos de un jugador en una sesión.
   * @typedef {{ id: string, type?: string, stats?: Object<string, StatLine> }} Session
   * @typedef {{ id: string, disciplineScore?: number|null }} Player
   * @typedef {{ totals: StatLine, exposure: number, matches: number, trainings: number }} PlayerAggregate
   * @typedef {{ pas: number, tir: number, reg: number, fis: number, def: number, dis: number }} SkillSet
   */

  const CONFIG = Object.freeze({
    /** Peso de cada evento según el contexto de la sesión. */
    contextWeight: Object.freeze({ match: 1.0, training: 0.75 }),
    /** Priors por defecto (fútbol base). Se usan mientras la plantilla tenga poca muestra. */
    defaultPriors: Object.freeze({
      passAcc: 0.72,       // pases completados / pases
      shotOnRate: 0.45,    // tiros a puerta / tiros
      convOnTarget: 0.30,  // goles / tiros a puerta
      dribbleAcc: 0.50,    // regates ok / regates
      duelAcc: 0.50,       // duelos ganados / duelos
      lossRate: 0.12,      // pérdidas no forzadas / volumen de juego
      retention: 0.70      // acciones positivas / (positivas + pérdidas de posesión)
    }),
    /** α: intentos "virtuales" del prior. Más alto ⇒ más escepticismo con muestras pequeñas. */
    priorStrength: Object.freeze({
      passAcc: 15, shotOnRate: 6, convOnTarget: 5, dribbleAcc: 6,
      duelAcc: 8, lossRate: 20, retention: 20
    }),
    /** β: sesiones virtuales para suavizar volúmenes por sesión. */
    volumePriorSessions: 2,
    /** Intentos agrupados de la plantilla a partir de los cuales el prior es 50 % empírico. */
    pooledHalfLife: 30,
    /** ε de los log-ratios (evita log(0) y amortigua volúmenes casi nulos). */
    logEps: 0.25,
    scale: Object.freeze({ min: 20, neutral: 50, max: 99, temperature: 1.1 }),
    weights: Object.freeze({
      tir: Object.freeze({ volume: 0.25, accuracy: 0.35, conversion: 0.40 }),
      pas: Object.freeze({ accuracy: 0.50, lossRate: 0.25, creativity: 0.15, volume: 0.10 }),
      reg: Object.freeze({ dribbleAcc: 0.40, retention: 0.40, volume: 0.20 }),
      def: Object.freeze({ recoveries: 0.45, duelAcc: 0.30, saves: 0.15, fouls: 0.10 }),
      fis: Object.freeze({ touches: 0.40, involvement: 0.35, duelAcc: 0.25 }),
      dis: Object.freeze({ infractions: 0.60, attendance: 0.25 })
    })
  });

  const SKILL_KEYS = Object.freeze(['pas', 'tir', 'reg', 'fis', 'def', 'dis']);
  const RATE_KEYS = Object.freeze(Object.keys(CONFIG.defaultPriors));
  const VOLUME_KEYS = Object.freeze([
    'shots', 'passes', 'creative', 'dribbles', 'recovery', 'saves',
    'fouls', 'touches', 'involvement', 'infractions'
  ]);

  /* ---------------- Primitivas matemáticas ---------------- */

  /** @param {number} x @param {number} lo @param {number} hi */
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  /** log-odds con recorte para evitar ±∞. @param {number} p */
  function logit(p) {
    const q = clamp(p, 1e-4, 1 - 1e-4);
    return Math.log(q / (1 - q));
  }

  /**
   * Suavizado bayesiano (Beta-Binomial / Laplace generalizado).
   * @param {number} successes @param {number} attempts @param {number} prior @param {number} alpha
   */
  function bayesRate(successes, attempts, prior, alpha) {
    return (successes + alpha * prior) / (attempts + alpha);
  }

  /**
   * Volumen por sesión suavizado hacia la media de la plantilla.
   * @param {number} total @param {number} exposure @param {number} leagueMean @param {number} beta
   */
  function shrunkPerSession(total, exposure, leagueMean, beta) {
    return (total + beta * leagueMean) / (exposure + beta);
  }

  /** Desviación logarítmica de un volumen frente a la referencia. */
  function logRatio(x, ref, eps) {
    const e = eps === undefined ? CONFIG.logEps : eps;
    return Math.log((Math.max(0, x) + e) / (Math.max(0, ref) + e));
  }

  /**
   * Calibración: tanh asimétrica. Índice 0 ⇒ 50; satura suavemente en 20 y 99.
   * @param {number} index
   */
  function calibrate(index) {
    const s = CONFIG.scale;
    if (!Number.isFinite(index)) return s.neutral;
    const t = Math.tanh(index / s.temperature);
    const span = t >= 0 ? (s.max - s.neutral) : (s.neutral - s.min);
    return Math.round(clamp(s.neutral + span * t, s.min, s.max));
  }

  /* ---------------- Agregación de datos brutos ---------------- */

  /** @param {Session} session */
  function contextWeightOf(session) {
    return session && session.type === 'match' ? CONFIG.contextWeight.match : CONFIG.contextWeight.training;
  }

  /** @param {StatLine|undefined} st */
  function hasActivity(st) {
    return !!st && Object.keys(st).some(k => Number(st[k]) > 0);
  }

  /**
   * Suma ponderada de los contadores de un jugador. No muta las sesiones.
   * @param {string} playerId @param {Session[]} sessions @returns {PlayerAggregate}
   */
  function aggregatePlayer(playerId, sessions) {
    const totals = {};
    let exposure = 0, matches = 0, trainings = 0;
    (sessions || []).forEach(s => {
      const st = s && s.stats ? s.stats[playerId] : null;
      if (!hasActivity(st)) return;
      const w = contextWeightOf(s);
      exposure += w;
      if (s.type === 'match') matches++; else trainings++;
      Object.keys(st).forEach(k => {
        const v = Number(st[k]);
        if (Number.isFinite(v) && v > 0) totals[k] = (totals[k] || 0) + v * w;
      });
    });
    return { totals, exposure, matches, trainings };
  }

  /**
   * Magnitudes derivadas (éxitos/intentos y volúmenes) a partir de los totales.
   * `goal` va enlazado a `shotOn` por defecto; usamos max() por si el enlace está desactivado.
   * @param {StatLine} t
   */
  function derive(t) {
    const g = k => Number(t[k]) || 0;
    const passOk = g('passOk'), passKo = g('passKo');
    const goals = g('goal');
    const shotOn = Math.max(g('shotOn'), goals), shotOff = g('shotOff');
    const dribbleOk = g('dribbleOk'), dribbleKo = g('dribbleKo');
    const duelWon = g('duelWon'), duelLost = g('duelLost');
    const recovery = g('recovery'), loss = g('loss');
    const passes = passOk + passKo, shots = shotOn + shotOff;
    const dribbles = dribbleOk + dribbleKo, duels = duelWon + duelLost;
    const positive = passOk + recovery + dribbleOk;
    const possessionLost = loss + passKo + dribbleKo;
    const involvement = g('touches') + passes + dribbles + shots + recovery + loss + duels;
    return {
      rates: {
        passAcc: [passOk, passes],
        shotOnRate: [shotOn, shots],
        convOnTarget: [goals, shotOn],
        dribbleAcc: [dribbleOk, dribbles],
        duelAcc: [duelWon, duels],
        lossRate: [loss, involvement],
        retention: [positive, positive + possessionLost]
      },
      volumes: {
        shots, passes, dribbles, recovery, involvement,
        creative: g('keyPass') + g('assist'),
        saves: g('save'),
        fouls: g('foul'),
        touches: g('touches'),
        infractions: g('foul') + 3 * g('yellow') + 8 * g('red')
      },
      totalEvents: Object.keys(t).reduce((a, k) => a + (Number(t[k]) || 0), 0)
    };
  }

  /* ---------------- Contexto de plantilla (priors empíricos) ---------------- */

  /**
   * Calcula los priors y medias por sesión de toda la plantilla.
   * @param {Player[]} players @param {Session[]} sessions
   */
  function buildLeagueContext(players, sessions) {
    const pooledRates = {};
    RATE_KEYS.forEach(k => { pooledRates[k] = [0, 0]; });
    const pooledVol = {};
    VOLUME_KEYS.forEach(k => { pooledVol[k] = 0; });
    let pooledExposure = 0, activePlayers = 0;

    const ids = new Set((players || []).map(p => p && p.id).filter(Boolean));
    (sessions || []).forEach(s => Object.keys((s && s.stats) || {}).forEach(id => ids.add(id)));

    ids.forEach(id => {
      const agg = aggregatePlayer(id, sessions);
      if (agg.exposure <= 0) return;
      activePlayers++;
      pooledExposure += agg.exposure;
      const d = derive(agg.totals);
      RATE_KEYS.forEach(k => {
        pooledRates[k][0] += d.rates[k][0];
        pooledRates[k][1] += d.rates[k][1];
      });
      VOLUME_KEYS.forEach(k => { pooledVol[k] += d.volumes[k]; });
    });

    const priors = {};
    RATE_KEYS.forEach(k => {
      const [ok, n] = pooledRates[k];
      const def = CONFIG.defaultPriors[k];
      const w = n / (n + CONFIG.pooledHalfLife);            // confianza en la tasa empírica
      const empirical = n > 0 ? ok / n : def;
      priors[k] = clamp(w * empirical + (1 - w) * def, 0.02, 0.98);
    });

    const perSession = {};
    VOLUME_KEYS.forEach(k => { perSession[k] = pooledExposure > 0 ? pooledVol[k] / pooledExposure : 0; });

    return {
      priors,
      perSession,
      avgExposure: activePlayers > 0 ? pooledExposure / activePlayers : 0,
      activePlayers
    };
  }

  /* ---------------- Cálculo de habilidades ---------------- */

  function neutralSkills(player) {
    return { pas: 50, tir: 50, reg: 50, fis: 50, def: 50, dis: disciplineOverride(player, 50) };
  }

  function disciplineOverride(player, fallback) {
    if (player && player.disciplineScore !== undefined && player.disciplineScore !== null && player.disciplineScore !== '') {
      const v = Number(player.disciplineScore);
      if (Number.isFinite(v)) return Math.round(clamp(v, 0, 100));
    }
    return fallback;
  }

  /**
   * Habilidades de un jugador a partir de su agregado y el contexto de plantilla.
   * @param {PlayerAggregate} agg @param {ReturnType<typeof buildLeagueContext>} league @param {Player} [player]
   * @returns {SkillSet & { components: Object, confidence: number }}
   */
  function computeSkillsFromAggregate(agg, league, player) {
    const d = derive(agg.totals || {});
    if (!agg || agg.exposure <= 0 || d.totalEvents <= 0) {
      return Object.assign(neutralSkills(player), { components: {}, confidence: 0 });
    }

    const P = league.priors, M = league.perSession, A = CONFIG.priorStrength, B = CONFIG.volumePriorSessions;
    const rateDev = k => {
      const [ok, n] = d.rates[k];
      return logit(bayesRate(ok, n, P[k], A[k])) - logit(P[k]);
    };
    const volDev = k => logRatio(shrunkPerSession(d.volumes[k], agg.exposure, M[k], B), M[k]);

    const c = {
      shotVolume: volDev('shots'),
      shotAccuracy: rateDev('shotOnRate'),
      conversion: rateDev('convOnTarget'),
      passAccuracy: rateDev('passAcc'),
      lossRate: rateDev('lossRate'),
      creativity: volDev('creative'),
      passVolume: volDev('passes'),
      dribbleAcc: rateDev('dribbleAcc'),
      retention: rateDev('retention'),
      dribbleVolume: volDev('dribbles'),
      recoveries: volDev('recovery'),
      duelAcc: rateDev('duelAcc'),
      saves: Math.max(0, volDev('saves')),           // solo suma: no penaliza a jugadores de campo
      fouls: volDev('fouls'),
      touches: volDev('touches'),
      involvement: volDev('involvement'),
      infractions: volDev('infractions'),
      attendance: logRatio(agg.exposure, league.avgExposure, 1)
    };

    const W = CONFIG.weights;
    const idx = {
      tir: W.tir.volume * c.shotVolume + W.tir.accuracy * c.shotAccuracy + W.tir.conversion * c.conversion,
      pas: W.pas.accuracy * c.passAccuracy - W.pas.lossRate * c.lossRate + W.pas.creativity * c.creativity + W.pas.volume * c.passVolume,
      reg: W.reg.dribbleAcc * c.dribbleAcc + W.reg.retention * c.retention + W.reg.volume * c.dribbleVolume,
      def: W.def.recoveries * c.recoveries + W.def.duelAcc * c.duelAcc + W.def.saves * c.saves - W.def.fouls * c.fouls,
      fis: W.fis.touches * c.touches + W.fis.involvement * c.involvement + W.fis.duelAcc * c.duelAcc,
      dis: -W.dis.infractions * c.infractions + W.dis.attendance * c.attendance
    };

    return {
      pas: calibrate(idx.pas),
      tir: calibrate(idx.tir),
      reg: calibrate(idx.reg),
      fis: calibrate(idx.fis),
      def: calibrate(idx.def),
      dis: disciplineOverride(player, calibrate(idx.dis)),
      components: c,
      confidence: Math.round((agg.exposure / (agg.exposure + B)) * 100) / 100
    };
  }

  /**
   * API principal: habilidades de un jugador.
   * @param {string} playerId
   * @param {{ players: Player[], sessions: Session[], playerSessions?: Session[], league?: Object }} data
   *   `sessions` define los priors (toda la historia); `playerSessions` permite filtrar el periodo del jugador.
   * @returns {SkillSet}
   */
  function computePlayerSkills(playerId, data) {
    const players = (data && data.players) || [];
    const sessions = (data && data.sessions) || [];
    const league = (data && data.league) || buildLeagueContext(players, sessions);
    const agg = aggregatePlayer(playerId, (data && data.playerSessions) || sessions);
    const player = players.find(p => p && p.id === playerId);
    const r = computeSkillsFromAggregate(agg, league, player);
    return { pas: r.pas, tir: r.tir, reg: r.reg, fis: r.fis, def: r.def, dis: r.dis };
  }

  /**
   * Objeto persistible para `player.skills` (determinista salvo `computedAt`).
   * @param {Player} player @param {Session[]} sessions @param {Object} league @param {number} [now]
   */
  function buildPersistedSkills(player, sessions, league, now) {
    const agg = aggregatePlayer(player.id, sessions);
    const r = computeSkillsFromAggregate(agg, league, player);
    return {
      pas: r.pas, tir: r.tir, reg: r.reg, fis: r.fis, def: r.def, dis: r.dis,
      confidence: r.confidence,
      sample: { matches: agg.matches, trainings: agg.trainings },
      engine: ENGINE_VERSION,
      computedAt: now || Date.now()
    };
  }

  /** Igualdad semántica de dos objetos `skills` (ignora `computedAt`). Base de la idempotencia. */
  function skillsEqual(a, b) {
    if (!a || !b) return false;
    if (a.engine !== b.engine) return false;
    if (Number(a.confidence) !== Number(b.confidence)) return false;
    const sa = a.sample || {}, sb = b.sample || {};
    if (Number(sa.matches) !== Number(sb.matches) || Number(sa.trainings) !== Number(sb.trainings)) return false;
    return SKILL_KEYS.every(k => Number(a[k]) === Number(b[k]));
  }

  return Object.freeze({
    ENGINE_VERSION,
    CONFIG,
    SKILL_KEYS,
    // primitivas (exportadas para tests)
    clamp, logit, bayesRate, shrunkPerSession, logRatio, calibrate,
    // pipeline
    aggregatePlayer, derive, buildLeagueContext, computeSkillsFromAggregate,
    computePlayerSkills, buildPersistedSkills, skillsEqual
  });
});

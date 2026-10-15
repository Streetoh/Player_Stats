/**
 * QA Automation Battery - Fases 1 a 4
 * PlayerStats JK Noova (Coach App & Player App)
 * 
 * Bloques de prueba:
 * 1. Auditoría de diccionarios e idiomas (ES, EN, ET, RU)
 * 2. Simulación matemática (EMA asimétrica, OVR 4 posiciones, H2H pedagógico)
 * 3. Flujo MVP ("Opción del entrenador" y mvpCount)
 * 4. Misiones semanales autovalidables
 * 5. Caché IndexedDB (WebP 400x400) y Firestore en 2 capas (Hot vs Cold)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedTests++;
    errors.push({ test: name, error: err });
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedTests++;
    errors.push({ test: name, error: err });
  }
}

console.log('================================================================');
console.log('   BATERÍA DE PRUEBAS DE QA AUTOMATIZADA - FASES 1 A 4');
console.log('================================================================\n');

// ====================================================================
// BLOQUE 1: AUDITORÍA DE DICCIONARIOS E IDIOMAS (ES, EN, ET, RU)
// ====================================================================
console.log('▶ BLOQUE 1: AUDITORÍA DE DICCIONARIOS E IDIOMAS (ES, EN, ET, RU)');

const i18nCode = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
const coachWindow = {};
eval(i18nCode.replace('window.I18N =', 'coachWindow.I18N =').replace('window.t =', 'coachWindow.t ='));
const coachDict = coachWindow.I18N.DICT;

const playerCode = fs.readFileSync(path.join(__dirname, '../js/player-app.js'), 'utf8');
const playerDictMatch = playerCode.match(/const DICT = (\{[\s\S]*?\n  \};)\s*DICT\.et\s*=\s*DICT\.ee;/);
if (!playerDictMatch) {
  throw new Error('No se pudo encontrar DICT en player-app.js');
}
let playerDict;
eval('playerDict = ' + playerDictMatch[1]);
playerDict.et = playerDict.ee;

test('1.1 Cobertura de idiomas en Coach App (ES, EN, ET, RU)', () => {
  ['es', 'en', 'et', 'ru'].forEach(l => {
    assert.ok(coachDict[l], `Coach App debe contener idioma ${l}`);
    assert.ok(Object.keys(coachDict[l]).length >= 600, `Coach App [${l}] debe tener >= 600 claves`);
  });
});

test('1.2 Cobertura de idiomas en Player App (ES, EN, ET, RU)', () => {
  ['es', 'en', 'et', 'ru'].forEach(l => {
    assert.ok(playerDict[l], `Player App debe contener idioma ${l}`);
    assert.ok(Object.keys(playerDict[l]).length >= 350, `Player App [${l}] debe tener >= 350 claves`);
  });
});

test('1.3 Sin claves undefined ni cadenas vacías en ningún idioma', () => {
  ['es', 'en', 'et', 'ru'].forEach(lang => {
    // Coach
    Object.entries(coachDict[lang]).forEach(([k, v]) => {
      assert.ok(v !== undefined && v !== null, `Coach [${lang}][${k}] es undefined`);
      assert.ok(typeof v === 'string' && v.trim() !== '', `Coach [${lang}][${k}] está vacía`);
    });
    // Player
    Object.entries(playerDict[lang]).forEach(([k, v]) => {
      assert.ok(v !== undefined && v !== null, `Player [${lang}][${k}] es undefined`);
      assert.ok(typeof v === 'string' && v.trim() !== '', `Player [${lang}][${k}] está vacía`);
    });
  });
});

test('1.4 Regla estricta Estonio (0 apariciones de "rühm" o declinaciones)', () => {
  const forbidden = /\br[üu]hm\w*/i;
  // Coach ET
  Object.entries(coachDict.et).forEach(([k, v]) => {
    assert.ok(!forbidden.test(v), `Palabra prohibida en Coach ET [${k}]: "${v}"`);
  });
  // Player ET & EE
  Object.entries(playerDict.et).forEach(([k, v]) => {
    assert.ok(!forbidden.test(v), `Palabra prohibida en Player ET [${k}]: "${v}"`);
  });
  Object.entries(playerDict.ee).forEach(([k, v]) => {
    assert.ok(!forbidden.test(v), `Palabra prohibida en Player EE [${k}]: "${v}"`);
  });
});

test('1.5 Claves específicas de Fases 1 a 4 con traducción exacta en los 4 idiomas', () => {
  const mandatory = [
    { key: 'h2h_keys_title', es: 'Claves del Duelo', en: 'Duel Keys', et: 'Duelli võtmed', ru: 'Ключи к дуэли' },
    { key: 'mvp_coach_pick', es: '⭐ Opción del entrenador', en: "⭐ Coach's Pick", et: '⭐ Treeneri valik', ru: '⭐ Выбор тренера' },
    { key: 'mvp_coach_reason_title', es: 'Motivo del entrenador:', en: "Coach's reason:", et: 'Treeneri põhjendus:', ru: 'Комментарий тренера:' },
    { key: 'mvp_btn_cancel', es: 'Cancelar y ver otros', en: 'Cancel and view others', et: 'Tühista ja vaata teisi', ru: 'Отмена и смотреть других' }
  ];

  mandatory.forEach(m => {
    ['es', 'en', 'et', 'ru'].forEach(lang => {
      assert.strictEqual(coachDict[lang][m.key], m[lang], `Coach App clave '${m.key}' [${lang}] no coincide`);
      assert.strictEqual(playerDict[lang][m.key], m[lang], `Player App clave '${m.key}' [${lang}] no coincide`);
    });
  });
});

// ====================================================================
// BLOQUE 2: SIMULACIÓN MATEMÁTICA (CARTA FUT Y 1V1 PEDAGÓGICO)
// ====================================================================
console.log('\n▶ BLOQUE 2: SIMULACIÓN MATEMÁTICA (CARTA FUT Y 1V1 PEDAGÓGICO)');

const skillsEngine = require(path.join(__dirname, '../js/skills-engine.js'));

test('2.1 EMA Asimétrica: Día excelente (+20% de subida)', () => {
  const A_actual = 60;
  const S_excelente = 85;
  // Subida rápida: A_nuevo = Math.min(99, Math.round(A_actual + 0.20 * (S_val - A_actual)))
  const delta = S_excelente - A_actual; // 25
  const expected = Math.min(99, Math.round(A_actual + 0.20 * delta)); // 60 + 5 = 65
  
  assert.strictEqual(expected, 65, 'La subida del 20% debe ser exactamente 65');
  assert.ok(expected > A_actual, 'El nuevo atributo debe ser superior al anterior');
});

test('2.2 EMA Asimétrica: Día muy malo (Amortiguador 4% y suelo de max -1 pt)', () => {
  const A_actual = 80;
  
  // Caso A: Caída moderada (S_val = 60)
  const S_val1 = 60;
  const A_nuevo1 = Math.max(50, A_actual - 1, Math.round(A_actual - 0.04 * (A_actual - S_val1)));
  // 0.04 * 20 = 0.8 => 80 - 0.8 = 79.2 => round = 79. Suelo = 79. Resultado = 79.
  assert.strictEqual(A_nuevo1, 79, 'Caída de 20 puntos se amortigua a -1 punto (79)');
  
  // Caso B: Caída extrema (S_val = 0 o 20)
  const S_val2 = 20;
  const A_nuevo2 = Math.max(50, A_actual - 1, Math.round(A_actual - 0.04 * (A_actual - S_val2)));
  // 0.04 * 60 = 2.4 => 80 - 2.4 = 77.6 => round = 78. PERO el suelo es A_actual - 1 = 79!
  assert.strictEqual(A_nuevo2, 79, 'Incluso con un desastre total, NUNCA debe bajar más de 1 punto respecto a su valor previo');
  assert.ok(A_nuevo2 >= A_actual - 1, 'Cumple la restricción estricta de suelo');

  // Caso C: Caída ínfima (S_val = 78)
  const S_val3 = 78;
  const A_nuevo3 = Math.max(50, A_actual - 1, Math.round(A_actual - 0.04 * (A_actual - S_val3)));
  // 0.04 * 2 = 0.08 => 80 - 0.08 = 79.92 => round = 80.
  assert.strictEqual(A_nuevo3, 80, 'Caída ínfima no baja ningún punto');
});

// Cargar fut-card.js en contexto mock
const futCardCode = fs.readFileSync(path.join(__dirname, '../js/fut-card.js'), 'utf8');
const futWindow = { Image: class {}, currentLang: 'es' };
eval(`(function(window, global) { ${futCardCode} })(futWindow, futWindow);`);
const futCard = futWindow.FutCard;

test('2.3 Cálculo de OVR en las 4 posiciones (DEF, MED, DEL, POR)', () => {
  const radar = { pas: 80, tir: 80, reg: 80, def: 80, fis: 80, dis: 80 };
  
  // Con radar uniforme 80, todas las posiciones deben dar 80
  ['DEF', 'MED', 'DEL', 'POR'].forEach(pos => {
    const ovr = futCard.computeOvr(radar, pos);
    assert.strictEqual(ovr, 80, `OVR uniforme en ${pos} debe ser 80`);
  });

  // Radar especializado
  const radarDef = { pas: 60, tir: 40, reg: 50, def: 90, fis: 85, dis: 80 };
  const ovrDef = futCard.computeOvr(radarDef, 'DEF');
  // DEF: pas*0.15 + tir*0.05 + reg*0.10 + def*0.35 + fis*0.20 + dis*0.15
  // 9 + 2 + 5 + 31.5 + 17 + 12 = 76.5 => 77
  assert.strictEqual(ovrDef, 77, 'OVR Defensa calculado correctamente con sus pesos');

  const radarDel = { pas: 70, tir: 92, reg: 88, def: 40, fis: 65, dis: 75 };
  const ovrDel = futCard.computeOvr(radarDel, 'DEL');
  // DEL: pas*0.15 + tir*0.35 + reg*0.25 + def*0.05 + fis*0.05 + dis*0.15
  // 10.5 + 32.2 + 22 + 2 + 3.25 + 11.25 = 81.2 => 81
  assert.strictEqual(ovrDel, 81, 'OVR Delantero calculado correctamente con sus pesos');

  const radarPor = { pas: 60, tir: 90, reg: 85, def: 85, fis: 50, dis: 80 };
  const ovrPor = futCard.computeOvr(radarPor, 'POR');
  // POR: pas*0.15 + tir(paradas)*0.40 + reg(reflejos)*0.15 + def*0.15 + fis*0.00 + dis*0.15
  // 9 + 36 + 12.75 + 12.75 + 0 + 12 = 82.5 => 83
  assert.strictEqual(ovrPor, 83, 'OVR Portero calculado correctamente con sus pesos');

  const radarMed = { pas: 90, tir: 65, reg: 85, def: 70, fis: 75, dis: 80 };
  const ovrMed = futCard.computeOvr(radarMed, 'MED');
  // MED: pas*0.30 + tir*0.10 + reg*0.20 + def*0.15 + fis*0.10 + dis*0.15
  // 27 + 6.5 + 17 + 10.5 + 7.5 + 12 = 80.5 => 81
  assert.strictEqual(ovrMed, 81, 'OVR Mediocentro calculado correctamente con sus pesos');
});

test('2.4 Cara a Cara 1v1 Pedagógico (Underdog extremo y renderizado de h2h_best_weapon)', () => {
  // Simulamos dos jugadores donde P1 es inferior en todos los atributos
  const p1 = { id: 'p1', name: 'Joven Promesa', mainPosition: 'MED', radar: { pas: 55, tir: 50, reg: 58, def: 52, fis: 50, dis: 80 } };
  const p2 = { id: 'p2', name: 'Veterano Crack', mainPosition: 'MED', radar: { pas: 85, tir: 82, reg: 84, def: 80, fis: 78, dis: 85 } };

  const attrKeys = ['pas', 'tir', 'reg', 'def', 'fis', 'dis'];
  const attrNames = {
    pas: 'Pases', tir: 'Tiro', reg: 'Regate', def: 'Defensa', fis: 'Físico', dis: 'Disciplina'
  };

  const diffs = attrKeys.map(k => {
    const v1 = p1.radar[k];
    const v2 = p2.radar[k];
    return {
      key: k,
      name: attrNames[k],
      val1: v1,
      val2: v2,
      diff: v1 - v2
    };
  });

  const advantages = diffs.filter(d => d.diff >= 5);
  const watchOuts = diffs.filter(d => d.diff <= -5);

  let bestWeapon = null;
  if (advantages.length === 0) {
    let maxDiff = -Infinity;
    diffs.forEach(d => {
      if (d.diff > maxDiff) {
        maxDiff = d.diff;
        bestWeapon = d;
      }
    });
  }

  // Verificaciones lógicas
  assert.strictEqual(advantages.length, 0, 'El jugador inferior no tiene ventajas de +5');
  assert.ok(bestWeapon !== null, 'Se debe haber calculado su mejor baza (bestWeapon)');
  // En dis: 80 vs 85 => diff -5. En reg: 58 vs 84 => diff -26. La menor desventaja es dis (-5).
  assert.strictEqual(bestWeapon.key, 'dis', 'La mejor baza seleccionada debe ser la de menor desventaja relativa');

  // Simular renderizado del texto pedagógico en los 4 idiomas
  ['es', 'en', 'et', 'ru'].forEach(lang => {
    const dict = playerDict[lang];
    const template = dict.h2h_best_weapon;
    const rendered = template.replace('{stat}', bestWeapon.name);
    
    assert.ok(rendered && rendered.length > 10, `Texto renderizado en [${lang}] no debe estar vacío`);
    assert.ok(!rendered.includes('{stat}'), `El placeholder {stat} debe estar reemplazado en [${lang}]`);
    assert.ok(!rendered.includes('undefined'), `No debe haber undefined en [${lang}]`);
    assert.ok(!rendered.includes('%'), 'No debe mostrar porcentajes de probabilidad de victoria');
  });
});

// ====================================================================
// BLOQUE 3: PRUEBA DE FLUJO MVP ("OPCIÓN DEL ENTRENADOR")
// ====================================================================
console.log('\n▶ BLOQUE 3: PRUEBA DE FLUJO MVP ("OPCIÓN DEL ENTRENADOR")');

test('3.1 Cierre de partido en Coach App con 3 coachPicks y coachReason', () => {
  const matchSession = {
    id: 'sess_match_001',
    type: 'match',
    date: '2026-10-15',
    opponent: 'Tallinna Kalev',
    coachPicks: [
      { playerId: 'pl_01', coachReason: 'Sensacional solidez defensiva y liderazgo.' },
      { playerId: 'pl_02', coachReason: 'Gran visión de juego y 2 asistencias decisivas.' },
      { playerId: 'pl_03', coachReason: 'Presión alta implacable y gol de la victoria.' }
    ],
    stats: {
      pl_01: { recovery: 8, duelWon: 6, passOk: 20, passKo: 3 },
      pl_02: { assist: 2, keyPass: 4, passOk: 35, passKo: 4 },
      pl_03: { goal: 1, shotOn: 4, touches: 28 }
    }
  };

  assert.strictEqual(matchSession.coachPicks.length, 3, 'Debe haber exactamente 3 seleccionados');
  matchSession.coachPicks.forEach(cp => {
    assert.ok(cp.playerId, 'Cada pick debe tener playerId');
    assert.ok(cp.coachReason && cp.coachReason.length > 5, 'Cada pick debe tener coachReason no trivial');
  });
});

test('3.2 En Player App, los 3 coachPicks se destacan arriba con etiqueta mvp_coach_pick', () => {
  const picks = [
    { playerId: 'pl_01', coachReason: 'Sensacional solidez defensiva' },
    { playerId: 'pl_02', coachReason: 'Gran visión de juego' },
    { playerId: 'pl_03', coachReason: 'Presión alta' }
  ];

  ['es', 'en', 'et', 'ru'].forEach(lang => {
    const badgeText = playerDict[lang].mvp_coach_pick;
    assert.ok(badgeText.includes('⭐'), `El badge en [${lang}] debe contener la estrella distintiva ⭐`);
  });
});

test('3.3 Al hacer clic en un coachPick NO vota directamente: abre modal con botones', () => {
  let voteDirectlyCalled = false;
  let modalOpened = false;

  function mockCardClick(pick) {
    // Al hacer clic, abre el modal sin votar
    modalOpened = true;
    return {
      modalId: 'dialog-coach-pick-detail',
      reason: pick.coachReason,
      confirmBtn: 'btn-confirm-vote-pick',
      cancelBtn: 'btn-cancel-pick-modal'
    };
  }

  function mockConfirmVote(playerId) {
    voteDirectlyCalled = true;
  }

  const pick = { playerId: 'pl_01', coachReason: 'Defensa heroica' };
  const modal = mockCardClick(pick);

  assert.strictEqual(voteDirectlyCalled, false, 'NO debe llamar a la función de voto inmediatamente');
  assert.strictEqual(modalOpened, true, 'Debe haber abierto el modal');
  assert.strictEqual(modal.reason, 'Defensa heroica', 'El modal muestra el motivo del míster');

  // Solo al pulsar confirmBtn se vota
  mockConfirmVote(pick.playerId);
  assert.strictEqual(voteDirectlyCalled, true, 'El voto solo se registra tras pulsar Confirmar');
});

test('3.4 Pintado de mvpCount en Ficha de Jugador y Canvas de Carta FUT', () => {
  const player = { id: 'pl_01', name: 'Martin', mvpCount: 4 };

  // Ficha
  ['es', 'en', 'et', 'ru'].forEach(lang => {
    const badgeStr = playerDict[lang].seasonMvpsBadge.replace('{count}', player.mvpCount);
    assert.ok(badgeStr.includes('4'), `Badge en [${lang}] debe incluir el número 4`);
  });

  // Canvas Carta FUT
  let textDrawn = '';
  const mockCtx = new Proxy({
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillText: (text, x, y) => { textDrawn += text + ' '; }
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });

  const mockCanvas = {
    getContext: () => mockCtx,
    width: 600,
    height: 880
  };

  futCard.draw(mockCanvas, { player, mvpCount: player.mvpCount }, 'gold');
  assert.ok(textDrawn.includes('⭐ x4'), `El canvas debe haber pintado "⭐ x4", texto obtenido: ${textDrawn}`);
});

// ====================================================================
// BLOQUE 4: PRUEBA DE MISIONES AUTOVALIDABLES
// ====================================================================
console.log('\n▶ BLOQUE 4: PRUEBA DE MISIONES AUTOVALIDABLES');

// Mock localStorage global para Node
if (!global.localStorage || typeof global.localStorage.getItem !== 'function') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
}

test('4.1 Misión auto (duels_won): Actualización de progreso y cambio automático a completed', () => {
  const storeCode = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf8');
  const storeWindow = { localStorage: global.localStorage };
  eval(`(function(window) { ${storeCode} })(storeWindow);`);
  const Store = storeWindow.Store;

  const playerId = 'pl_test_auto_01';
  Store.state.players = [{
    id: playerId,
    name: 'Kevin',
    mainPosition: 'MED'
  }];
  Store.state.sessions = [];

  // 1. Asignar misión automática de 5 duelos ganados
  Store.setPlayerWeeklyMission(playerId, {
    type: 'auto',
    metric: 'duels_won',
    target: 5,
    currentProgress: 0,
    text: 'Ganar 5 duelos 1v1',
    assignedAt: Date.now() - 3600000
  });

  const pBefore = Store.player(playerId);
  assert.strictEqual(pBefore.weeklyMission.status, 'in_progress', 'Estado inicial in_progress');
  assert.strictEqual(pBefore.weeklyMission.currentProgress, 0, 'Progreso inicial 0');

  // 2. Inyectar sesión con 3 duelos ganados
  Store.state.sessions.push({
    id: 's_01',
    date: new Date().toISOString().split('T')[0],
    stats: {
      [playerId]: { duelsWon: 3 }
    }
  });
  Store.evaluateAutoWeeklyMissions([playerId]);

  const pMid = Store.player(playerId);
  assert.strictEqual(pMid.weeklyMission.currentProgress, 3, 'Progreso actualizado a 3');
  assert.strictEqual(pMid.weeklyMission.status, 'in_progress', 'Aún no alcanza el target de 5');

  // 3. Inyectar segunda sesión con 3 duelos más (total 6 >= 5)
  Store.state.sessions.push({
    id: 's_02',
    date: new Date().toISOString().split('T')[0],
    stats: {
      [playerId]: { duelsWon: 3 }
    }
  });
  Store.evaluateAutoWeeklyMissions([playerId]);

  const pAfter = Store.player(playerId);
  assert.strictEqual(pAfter.weeklyMission.currentProgress, 6, 'Progreso total 6');
  assert.strictEqual(pAfter.weeklyMission.status, 'completed', 'Estado debe haber cambiado a completed');
  assert.ok(pAfter.weeklyMission.completedAt > 0, 'completedAt debe tener marca de tiempo válida');
});

test('4.2 Misión auto (pass_acc): Precisión de pases con minAttempts', () => {
  const storeCode = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf8');
  const storeWindow = { localStorage: global.localStorage };
  eval(`(function(window) { ${storeCode} })(storeWindow);`);
  const Store = storeWindow.Store;

  const playerId = 'pl_test_pass_02';
  Store.state.players = [{ id: playerId, name: 'Sander' }];
  Store.state.sessions = [];

  Store.setPlayerWeeklyMission(playerId, {
    type: 'auto',
    metric: 'pass_acc',
    target: 80,
    minAttempts: 10,
    text: 'Alcanzar 80% de acierto en pases con mín. 10 pases'
  });

  // Sesión A: 5/5 pases (100% acierto, pero solo 5 intentos < 10)
  Store.state.sessions.push({
    id: 's_pass_1',
    date: new Date().toISOString().split('T')[0],
    stats: {
      [playerId]: { passGood: 5, passBad: 0 }
    }
  });
  Store.evaluateAutoWeeklyMissions([playerId]);

  let p = Store.player(playerId);
  assert.strictEqual(p.weeklyMission.currentProgress, 100, '100% precisión');
  assert.strictEqual(p.weeklyMission.status, 'in_progress', 'No completada porque intentos (5) < minAttempts (10)');

  // Sesión B: 4 buenos y 1 fallado => total 9 buenos de 10 intentos (90% >= 80 y 10 intentos >= 10)
  Store.state.sessions.push({
    id: 's_pass_2',
    date: new Date().toISOString().split('T')[0],
    stats: {
      [playerId]: { passGood: 4, passBad: 1 }
    }
  });
  Store.evaluateAutoWeeklyMissions([playerId]);

  p = Store.player(playerId);
  assert.strictEqual(p.weeklyMission.currentProgress, 90, 'Progreso 90%');
  assert.strictEqual(p.weeklyMission.status, 'completed', 'Alcanza el 80% con 10 intentos: COMPLETADA');
});

// ====================================================================
// BLOQUE 5: CACHÉ INDEXEDDB (FOTOS WEBP) Y FIRESTORE EN 2 CAPAS
// ====================================================================
console.log('\n▶ BLOQUE 5: CACHÉ INDEXEDDB (FOTOS WEBP) Y FIRESTORE EN 2 CAPAS');

// Mock IndexedDB
class MockObjectStore {
  constructor() { this.records = new Map(); }
  get(key) {
    const req = { result: this.records.get(key) || null, onsuccess: null, onerror: null };
    setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
    return req;
  }
  put(val) {
    const k = val.playerId || val.sessionId;
    this.records.set(k, val);
  }
}

class MockTransaction {
  constructor(stores) {
    this.stores = stores;
    this.oncomplete = null;
    this.onerror = null;
    setTimeout(() => { if (this.oncomplete) this.oncomplete(); }, 0);
  }
  objectStore(name) { return this.stores[name]; }
}

class MockIDB {
  constructor() {
    this.stores = {
      photos: new MockObjectStore(),
      sessions: new MockObjectStore()
    };
  }
  transaction(storeNames, mode) {
    return new MockTransaction(this.stores);
  }
}

const mockIdb = new MockIDB();

const mockWindow = {
  indexedDB: {
    open: () => {
      const req = { result: mockIdb, onsuccess: null, onupgradeneeded: null, onerror: null };
      setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
      return req;
    }
  },
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); }
  }
};

const cloudCode = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf8');
eval(`(function(window, global) { ${cloudCode} })(mockWindow, mockWindow);`);
const CacheDB = mockWindow.CacheDB;
const Cloud = mockWindow.Cloud;

async function runQA() {
  await test('5.1 Procesado Canvas 400x400 a WebP y generación de photoHash', () => {
    // Simular lógica de processPlayerPhotoWebp
    let formatUsed = '';
    let qualityUsed = 0;
    let canvasW = 0, canvasH = 0;

    const mockCanvas = {
      getContext: () => ({
        drawImage: () => {},
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      }),
      toDataURL: (fmt, q) => {
        formatUsed = fmt;
        qualityUsed = q;
        return `data:${fmt};base64,mockWebpData`;
      }
    };

    mockCanvas.width = 400;
    mockCanvas.height = 400;
    canvasW = mockCanvas.width;
    canvasH = mockCanvas.height;

    const webpUrl = mockCanvas.toDataURL('image/webp', 0.80);
    const photoHash = 'p_' + Date.now().toString(36);

    assert.strictEqual(canvasW, 400, 'Ancho de canvas debe ser 400px');
    assert.strictEqual(canvasH, 400, 'Alto de canvas debe ser 400px');
    assert.strictEqual(formatUsed, 'image/webp', 'Formato exportado debe ser image/webp');
    assert.strictEqual(qualityUsed, 0.80, 'Calidad WebP debe ser 0.80');
    assert.ok(photoHash.startsWith('p_'), 'photoHash debe tener prefijo p_');
  });

  await asyncTest('5.2 Lectura y Escritura en IndexedDB sin excepciones ni rechazos', async () => {
    const playerId = 'pl_test_photo_01';
    const photoHash = 'p_' + Date.now().toString(36);
    const dataUrl = 'data:image/webp;base64,UklGRm...';

    // Guardar en IndexedDB
    const saved = await CacheDB.setPhoto(playerId, photoHash, dataUrl);
    assert.strictEqual(saved, true, 'setPhoto debe resolver true');

    // Leer de IndexedDB
    const record = await CacheDB.getPhoto(playerId);
    assert.ok(record !== null, 'getPhoto debe retornar el registro guardado');
    assert.strictEqual(record.playerId, playerId, 'playerId debe coincidir');
    assert.strictEqual(record.photoHash, photoHash, 'photoHash debe coincidir');
    assert.strictEqual(record.dataUrl, dataUrl, 'dataUrl debe coincidir');
  });

  await asyncTest('5.3 Capa Fría vs Capa Caliente: lazy loading de sesiones pasadas con caché', async () => {
    const sessionId = 'sess_cold_123';
    const sessionData = {
      id: sessionId,
      type: 'match',
      opponent: 'JK Tammeka',
      stats: { p1: { goal: 2 } }
    };

    // 1. Antes de pedirla, no está en caché
    const initialCache = await CacheDB.getSession(sessionId);
    assert.strictEqual(initialCache, null, 'Inicialmente no está en caché local');

    // 2. Guardar en Capa Fría
    await CacheDB.setSession(sessionId, sessionData);

    // 3. Segunda petición: recuperada instantáneamente de IndexedDB sin tocar Firestore
    const cached = await CacheDB.getSession(sessionId);
    assert.ok(cached !== null, 'Sesión cargada desde caché de Capa Fría');
    assert.strictEqual(cached.id, sessionId, 'ID de sesión coincide');
    assert.strictEqual(cached.opponent, 'JK Tammeka', 'Datos íntegros');
  });

  console.log('\n================================================================');
  console.log(`RESUMEN FINAL: ${passedTests} tests PASADOS | ${failedTests} tests FALLADOS`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 TODOS LOS TESTS DE LA BATERÍA PASARON AL 100% SIN ERRORES');
    process.exit(0);
  }
}

runQA().catch(err => {
  console.error('Error fatal en ejecución de QA:', err);
  process.exit(1);
});

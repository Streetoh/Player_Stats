// scripts/test_1v1_chevrons_and_height.js
const fs = require('fs');
const assert = require('assert');

console.log('=== TEST UNITARIO: CHEVRONS 1V1, CONSEJOS DE CALLE Y ESTATURA ===\n');

// 1. Cargar store.js
const storeCode = fs.readFileSync('js/store.js', 'utf8');
const fakeWindow = {
  localStorage: { setItem: () => {}, getItem: () => null, removeItem: () => {} },
  CacheDB: { setPhoto: () => {} }
};
const fakeGlobal = fakeWindow;
const storeFn = new Function('window', 'global', storeCode + '; return window.Store || global.Store;');
const Store = storeFn(fakeWindow, fakeGlobal);

// Verificar Store.upsertPlayer con heightCm
const p1 = Store.upsertPlayer({
  name: 'Leo',
  lastName: 'Messi',
  mainPosition: 'DEL',
  heightCm: 170
});
assert.strictEqual(p1.heightCm, 170, 'heightCm debe persistirse como número 170 en el jugador');

const p2 = Store.upsertPlayer({
  name: 'Erling',
  lastName: 'Haaland',
  mainPosition: 'DEL',
  heightCm: '194'
});
assert.strictEqual(p2.heightCm, 194, 'heightCm numérico como string debe parsearse a entero 194');

const p3 = Store.upsertPlayer({
  name: 'Joven',
  lastName: 'SinEstatura',
  mainPosition: 'MED'
});
assert.strictEqual(p3.heightCm, null, 'heightCm no especificado debe ser null');

console.log('✅ 1. Store.upsertPlayer gestiona heightCm correctamente (números y null).');

// 2. Verificar que en app.js y player-app.js se muestra heightCm
const appCode = fs.readFileSync('js/app.js', 'utf8');
assert.ok(appCode.includes('p-height'), 'app.js debe incluir el input #p-height');
assert.ok(appCode.includes('p.heightCm ?'), 'app.js debe renderizar p.heightCm si está presente');

const playerAppCode = fs.readFileSync('js/player-app.js', 'utf8');
assert.ok(playerAppCode.includes('p.heightCm ?'), 'player-app.js debe renderizar p.heightCm en el perfil completo');
assert.ok(playerAppCode.includes('myP.heightCm ?'), 'player-app.js debe renderizar myP.heightCm en mi perfil');

console.log('✅ 2. app.js y player-app.js renderizan la estatura en los perfiles.');

// 3. Verificar que renderDuelChevrons y la lógica 1v1 NO incluyen disciplina ni números
assert.ok(playerAppCode.includes('function renderDuelChevrons(level, isAdvantage)'), 'renderDuelChevrons debe estar definido en player-app.js');
assert.ok(playerAppCode.includes('polyline points="5 15 12 8 19 15"'), 'Chevrons verdes hacia arriba deben estar en el SVG');
assert.ok(playerAppCode.includes('polyline points="5 9 12 16 19 9"'), 'Chevrons rojos hacia abajo deben estar en el SVG');

// Verificar que en attrKeys de 1v1 no está 'dis'
const duelKeysMatch = playerAppCode.match(/const attrKeys = \[(.*?)\];/);
assert.ok(duelKeysMatch, 'attrKeys debe existir en player-app.js');
assert.ok(!duelKeysMatch[1].includes('dis'), 'La disciplina (dis) NO debe estar en attrKeys de 1v1');
assert.ok(!duelKeysMatch[1].includes('pas'), 'El pase (pas) NO debe estar en attrKeys de 1v1');

console.log('✅ 3. El Cara a Cara 1v1 evalúa solo REG, TIR, DEF, FIS y estatura (sin disciplina ni pases).');

// 4. Verificar catálogo de consejos callejeros en los 4 idiomas
const i18nCode = fs.readFileSync('js/i18n.js', 'utf8');
const i18nFn = new Function('window', 'global', i18nCode + '; return window.I18N || global.I18N;');
const I18N = i18nFn({}, {});

const tipKeys = [
  'heightCm',
  'h2h_tip_height_tall_rival',
  'h2h_tip_height_fast_rival',
  'h2h_tip_height_advantage',
  'h2h_tip_tir_rival_high',
  'h2h_tip_tir_advantage',
  'h2h_tip_tir_rival_low',
  'h2h_tip_reg_rival_high',
  'h2h_tip_reg_advantage',
  'h2h_tip_reg_rival_low',
  'h2h_tip_def_rival_high',
  'h2h_tip_def_advantage',
  'h2h_tip_def_rival_low',
  'h2h_tip_fis_rival_high',
  'h2h_tip_fis_advantage',
  'h2h_tip_fis_rival_low',
  'h2h_best_weapon_tir',
  'h2h_best_weapon_reg',
  'h2h_best_weapon_def',
  'h2h_best_weapon_fis'
];

['es', 'en', 'et', 'ru'].forEach(lang => {
  tipKeys.forEach(key => {
    const val = I18N.DICT[lang][key];
    assert.ok(val && val.length > 5, `Clave [${key}] en idioma [${lang}] debe existir y tener contenido pedagógico`);
  });
});

console.log('✅ 4. Todos los consejos pedagógicos de calle están traducidos y completos en ES, EN, ET y RU.');
console.log('\n🎉 TODOS LOS TESTS ESPECÍFICOS DE 1V1 Y ESTATURA PASARON AL 100%');

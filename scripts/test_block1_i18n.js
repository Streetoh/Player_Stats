const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('BLOCK 1: AUDITORÍA DE DICCIONARIOS E IDIOMAS (ES, EN, ET, RU)');
console.log('====================================================');

// 1. Cargar diccionarios de Coach App (js/i18n.js)
const i18nCode = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
const coachWindow = {};
eval(i18nCode.replace('window.I18N =', 'coachWindow.I18N =').replace('window.t =', 'coachWindow.t ='));
const coachDict = coachWindow.I18N.DICT;

// 2. Cargar diccionarios de Player App (js/player-app.js)
const playerCode = fs.readFileSync(path.join(__dirname, '../js/player-app.js'), 'utf8');
const playerDictMatch = playerCode.match(/const DICT = (\{[\s\S]*?\n  \};)\s*DICT\.et\s*=\s*DICT\.ee;/);
if (!playerDictMatch) {
  console.error('ERROR: No se pudo extraer DICT de js/player-app.js');
  process.exit(1);
}
let playerDict;
eval('playerDict = ' + playerDictMatch[1]);
playerDict.et = playerDict.ee;

const languages = ['es', 'en', 'et', 'ru'];
let totalErrors = 0;

// Test A: Coach App
console.log('\n--- 1.1 AUDITORÍA COACH APP (js/i18n.js) ---');
const coachLanguages = Object.keys(coachDict).filter(l => languages.includes(l));
console.log('Idiomas encontrados en Coach App:', coachLanguages);

// Reunir todas las claves de todos los idiomas de Coach App
const coachAllKeys = new Set();
for (const lang of languages) {
  if (coachDict[lang]) {
    Object.keys(coachDict[lang]).forEach(k => coachAllKeys.add(k));
  }
}
console.log(`Total claves únicas en Coach App: ${coachAllKeys.size}`);

for (const lang of languages) {
  if (!coachDict[lang]) {
    console.error(`[ERROR] Falta idioma '${lang}' en Coach App`);
    totalErrors++;
    continue;
  }
  let missing = [];
  let empty = [];
  let untranslated = [];

  for (const key of coachAllKeys) {
    const val = coachDict[lang][key];
    if (val === undefined) {
      missing.push(key);
    } else if (typeof val !== 'string' || val.trim() === '') {
      empty.push(key);
    } else if (val === key && key.length > 3 && !['POR', 'DEF', 'MED', 'DEL', 'MVP'].includes(key)) {
      untranslated.push(key);
    }
  }

  console.log(`Idioma [${lang.toUpperCase()}]: Claves presentes: ${Object.keys(coachDict[lang]).length} | Faltantes: ${missing.length} | Vacías: ${empty.length}`);
  if (missing.length > 0) {
    console.error(`  -> Claves faltantes en Coach [${lang}]:`, missing.slice(0, 10));
    totalErrors += missing.length;
  }
  if (empty.length > 0) {
    console.error(`  -> Claves vacías en Coach [${lang}]:`, empty.slice(0, 10));
    totalErrors += empty.length;
  }
}

// Test B: Player App
console.log('\n--- 1.2 AUDITORÍA PLAYER APP (js/player-app.js) ---');
const playerLanguages = ['es', 'en', 'et', 'ru'];
const playerAllKeys = new Set();
for (const lang of playerLanguages) {
  const d = playerDict[lang] || playerDict[lang === 'et' ? 'ee' : lang];
  if (d) {
    Object.keys(d).forEach(k => playerAllKeys.add(k));
  }
}
console.log(`Total claves únicas en Player App: ${playerAllKeys.size}`);

for (const lang of playerLanguages) {
  const d = playerDict[lang] || playerDict[lang === 'et' ? 'ee' : lang];
  if (!d) {
    console.error(`[ERROR] Falta idioma '${lang}' en Player App`);
    totalErrors++;
    continue;
  }
  let missing = [];
  let empty = [];
  let untranslated = [];

  for (const key of playerAllKeys) {
    const val = d[key];
    if (val === undefined) {
      missing.push(key);
    } else if (typeof val !== 'string' || val.trim() === '') {
      empty.push(key);
    } else if (val === key && key.length > 3 && !['POR', 'DEF', 'MED', 'DEL', 'MVP'].includes(key)) {
      untranslated.push(key);
    }
  }

  console.log(`Idioma [${lang.toUpperCase()}]: Claves presentes: ${Object.keys(d).length} | Faltantes: ${missing.length} | Vacías: ${empty.length}`);
  if (missing.length > 0) {
    console.error(`  -> Claves faltantes en Player [${lang}]:`, missing.slice(0, 10));
    totalErrors += missing.length;
  }
  if (empty.length > 0) {
    console.error(`  -> Claves vacías en Player [${lang}]:`, empty.slice(0, 10));
    totalErrors += empty.length;
  }
}

// Test C: Regla Estricta Estonio (NUNCA 'rühm' ni sus declinaciones)
console.log('\n--- 1.3 VERIFICACIÓN REGLA ESTRICTA ESTONIO (0 "rühm") ---');
const forbiddenRegex = /\br[üu]hm\w*/i;
let estonianViolations = 0;

// Coach App ET
const coachEt = coachDict.et || coachDict.ee || {};
for (const [k, v] of Object.entries(coachEt)) {
  if (typeof v === 'string' && forbiddenRegex.test(v)) {
    console.error(`[ERROR Coach ET] Clave '${k}' contiene término prohibido: "${v}"`);
    estonianViolations++;
  }
}

// Player App ET / EE
const playerEt = playerDict.et || playerDict.ee || {};
for (const [k, v] of Object.entries(playerEt)) {
  if (typeof v === 'string' && forbiddenRegex.test(v)) {
    console.error(`[ERROR Player ET] Clave '${k}' contiene término prohibido: "${v}"`);
    estonianViolations++;
  }
}

console.log(`Violaciones de la palabra "rühm" encontradas: ${estonianViolations}`);
totalErrors += estonianViolations;

// Test D: Verificación de claves obligatorias de Fases 1 a 4
console.log('\n--- 1.4 CLAVES OBLIGATORIAS DE LAS FASES 1 A 4 ---');
const requiredKeys = [
  'h2h_keys_title',
  'h2h_your_advantage',
  'h2h_watch_out',
  'h2h_best_weapon',
  'mvp_coach_pick',
  'mvp_coach_reason_title',
  'mvp_btn_confirm_vote',
  'mvp_btn_cancel',
  'autoMissionBadge',
  'currentProgressLabel',
  'minAttemptsLabel'
];

for (const k of requiredKeys) {
  for (const lang of ['es', 'en', 'et', 'ru']) {
    const coachVal = coachDict[lang] ? coachDict[lang][k] : undefined;
    const playerD = playerDict[lang] || playerDict[lang === 'et' ? 'ee' : lang];
    const playerVal = playerD ? playerD[k] : undefined;

    if (!coachVal) {
      console.error(`[ERROR Coach App] Falta clave requerida '${k}' en [${lang}]`);
      totalErrors++;
    }
    if (!playerVal) {
      console.error(`[ERROR Player App] Falta clave requerida '${k}' en [${lang}]`);
      totalErrors++;
    }
  }
}

console.log('\n====================================================');
if (totalErrors === 0) {
  console.log('✅ BLOCK 1: AUDITORÍA DE DICCIONARIOS E IDIOMAS PASÓ AL 100%');
} else {
  console.error(`❌ BLOCK 1: SE ENCONTRARON ${totalErrors} ERRORES.`);
}
console.log('====================================================');

process.exit(totalErrors === 0 ? 0 : 1);

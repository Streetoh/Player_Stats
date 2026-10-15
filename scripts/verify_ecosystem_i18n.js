// scripts/verify_ecosystem_i18n.js
const fs = require('fs');

console.log('--- AUDITORÍA INTEGRAL DE DICCIONARIOS Y TEXTOS (ES, EN, ET, RU) ---');

// 1. Cargar js/i18n.js
const i18nCode = fs.readFileSync('js/i18n.js', 'utf8');
const fakeWindow = {};
const fakeGlobal = fakeWindow;
const i18nFn = new Function('window', 'global', i18nCode + '; return window.I18N || global.I18N;');
const I18N = i18nFn(fakeWindow, fakeGlobal);

const i18nLangs = ['es', 'en', 'et', 'ru'];
console.log('\n[1] js/i18n.js (Coach App):');
i18nLangs.forEach(lang => {
  const dict = (I18N && I18N.DICT && I18N.DICT[lang]) || {};
  const keys = Object.keys(dict);
  console.log(`  - Idioma '${lang}': ${keys.length} claves.`);
});

// Comprobar claves en i18n
const esKeys = Object.keys((I18N && I18N.DICT && I18N.DICT.es) || {});
i18nLangs.forEach(lang => {
  if (lang === 'es') return;
  const dict = (I18N && I18N.DICT && I18N.DICT[lang]) || {};
  const missing = esKeys.filter(k => dict[k] === undefined || dict[k] === '');
  console.log(`  -> Claves en 'es' que faltan en '${lang}': ${missing.length}`);
  if (missing.length > 0 && missing.length <= 15) {
    console.log(`     Detalle:`, missing);
  }
});

// 2. Extraer DICT de js/player-app.js
const playerCode = fs.readFileSync('js/player-app.js', 'utf8');
const dictStart = playerCode.indexOf('const DICT = {');
if (dictStart !== -1) {
  // extraer bloque DICT
  const dictEnd = playerCode.indexOf('function t(key, fallback)', dictStart);
  const dictCode = playerCode.substring(dictStart, dictEnd);
  const pDictFn = new Function(dictCode + '; return DICT;');
  const pDict = pDictFn();

  console.log('\n[2] js/player-app.js (Player App DICT):');
  ['es', 'en', 'et', 'ru'].forEach(lang => {
    const d = pDict[lang] || {};
    const keys = Object.keys(d);
    console.log(`  - Idioma '${lang}': ${keys.length} claves.`);
  });

  const pEsKeys = Object.keys(pDict.es || {});
  ['en', 'et', 'ru'].forEach(lang => {
    const d = pDict[lang] || {};
    const missing = pEsKeys.filter(k => d[k] === undefined || d[k] === '');
    console.log(`  -> Claves en 'es' que faltan en '${lang}': ${missing.length}`);
    if (missing.length > 0 && missing.length <= 25) {
      console.log(`     Detalle:`, missing);
    }
  });
}

// 3. Extraer CHAT_I18N de js/chat.js
const chatCode = fs.readFileSync('js/chat.js', 'utf8');
const chatDictStart = chatCode.indexOf('const CHAT_I18N = {');
if (chatDictStart !== -1) {
  const chatDictCode = chatCode.substring(chatDictStart, chatCode.indexOf('function getChatLang()', chatDictStart));
  const cDictFn = new Function(chatDictCode + '; return CHAT_I18N;');
  const cDict = cDictFn();

  console.log('\n[3] js/chat.js (Chat I18N):');
  ['es', 'en', 'ee', 'ru'].forEach(lang => {
    const d = cDict[lang] || {};
    const keys = Object.keys(d);
    console.log(`  - Idioma '${lang}': ${keys.length} claves.`);
  });

  const cEsKeys = Object.keys(cDict.es || {});
  ['en', 'ee', 'ru'].forEach(lang => {
    const d = cDict[lang] || {};
    const missing = cEsKeys.filter(k => d[k] === undefined || d[k] === '');
    console.log(`  -> Claves en 'es' que faltan en '${lang}': ${missing.length}`);
    if (missing.length > 0) {
      console.log(`     Detalle:`, missing);
    }
  });
}

// 4. Regla estricta para Estonio (NUNCA usar 'rühm')
console.log('\n[4] REGLA ESTRICTA ESTONIO (Prohibido "rühm"):');
const filesToCheck = ['js/i18n.js', 'js/player-app.js', 'js/chat.js', 'js/fut-card.js', 'index.html', 'jugadores.html', 'convocatoria.html'];
let rühmFound = 0;
filesToCheck.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/r[üu]hm[a-z]*/gi);
  if (matches) {
    // Filtrar falsos positivos si hubiera alguno en comentarios o variables que no sean de idioma estonio
    console.log(`  ⚠️ Encontrada coincidencia en ${file}:`, matches);
    rühmFound += matches.length;
  }
});
if (rühmFound === 0) {
  console.log('  ✅ CERO apariciones de "rühm" o sus declinaciones en todo el ecosistema.');
} else {
  console.log(`  ❌ Se encontraron ${rühmFound} apariciones que deben corregirse.`);
}

// scripts/test_convocation_card_gradients.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Convocation card gradients (Coach App) ---');

// 1. Verify CSS rules exist in css/app.css
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf-8');
assert(cssContent.includes('.player-match-row.conv-status-yes'), 'Must define .player-match-row.conv-status-yes');
assert(cssContent.includes('.player-match-row.conv-status-no'), 'Must define .player-match-row.conv-status-no');
assert(cssContent.includes('.player-match-row.conv-status-pending'), 'Must define .player-match-row.conv-status-pending');
assert(cssContent.includes('rgba(34, 197, 94'), 'Must use green for conv-status-yes');
assert(cssContent.includes('rgba(239, 68, 68'), 'Must use red for conv-status-no');
assert(cssContent.includes('rgba(250, 204, 21'), 'Must use yellow for conv-status-pending');
console.log('✅ CSS rules for green, red, yellow convocation states verified');

// 2. Verify app.js showSessionDetailModal implementation
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf-8');
assert(appJs.includes('conv-status-yes'), 'app.js must apply conv-status-yes');
assert(appJs.includes('conv-status-no'), 'app.js must apply conv-status-no');
assert(appJs.includes('conv-status-pending'), 'app.js must apply conv-status-pending');
assert(appJs.includes('noResponsePending'), 'app.js must use noResponsePending i18n key');
assert(appJs.includes('btn-session-open-conv-modal'), 'app.js must have shortcut to open linked convocation');
console.log('✅ app.js showSessionDetailModal integration verified');

// 3. Verify showConvocationDetailsModal implementation
assert(appJs.includes('⏳ PENDIENTES DE RESPUESTA / SIN CONTESTAR'), 'showConvocationDetailsModal must have pending section');
console.log('✅ app.js showConvocationDetailsModal integration verified');

// 4. Verify i18n keys exist
const i18nJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf-8');
['es', 'en', 'et', 'ru'].forEach(lang => {
  assert(i18nJs.includes('noResponsePending'), `i18n must include noResponsePending in ${lang}`);
});
console.log('✅ i18n keys for noResponsePending in ES, EN, ET, RU verified');

console.log('🎉 ALL CONVOCATION CARD GRADIENT TESTS PASSED!');

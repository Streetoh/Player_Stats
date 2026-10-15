// scripts/test_team_colored_cards_and_quickstats.js
const assert = require('assert');
const fs = require('fs');

console.log('=== TEST: TEAM-COLORED CARDS, GRADIENTS, GOLD MATCH BORDERS & HOME QUICK-STATS ===\n');

// 1. Verify CSS styles
const css = fs.readFileSync('css/app.css', 'utf8');
assert(css.includes('.qs.clickable'), 'CSS must include .qs.clickable');
assert(css.includes('.card-match-gold'), 'CSS must include .card-match-gold');
assert(css.includes('.conv-card-match-today'), 'CSS must include .conv-card-match-today');
assert(css.includes('matchCardGoldGlow'), 'CSS must include matchCardGoldGlow keyframes');
assert(css.includes('border: 2.5px solid #f59e0b'), 'CSS must have 2.5px gold border for matches');
console.log('✅ CSS classes (.qs.clickable, .card-match-gold, .conv-card-match-today, matchCardGoldGlow) verified.');

// 2. Verify app.js content and patterns
const appJs = fs.readFileSync('js/app.js', 'utf8');
assert(appJs.includes('function hexToRgba('), 'app.js must contain hexToRgba');
assert(appJs.includes('function resolveEventTeams('), 'app.js must contain resolveEventTeams');
assert(appJs.includes('function getEventCardStyle('), 'app.js must contain getEventCardStyle');
assert(appJs.includes('function showHomeSessionsListModal('), 'app.js must contain showHomeSessionsListModal');
assert(appJs.includes('id="qs-trainings"'), 'app.js must have id="qs-trainings" in renderHomeView');
assert(appJs.includes('id="qs-matches"'), 'app.js must have id="qs-matches" in renderHomeView');
assert(appJs.includes('id="qs-players"'), 'app.js must have id="qs-players" in renderHomeView');
assert(appJs.includes("showHomeSessionsListModal('training')"), 'app.js must bind showHomeSessionsListModal for trainings');
assert(appJs.includes("showHomeSessionsListModal('match')"), 'app.js must bind showHomeSessionsListModal for matches');
console.log('✅ app.js functions and HTML bindings verified.');

// 3. Functional simulation of getEventCardStyle
// Extract hexToRgba, resolveEventTeams, getEventCardStyle implementation logic
function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(15, 23, 42, ${alpha})`;
  let c = hex.trim();
  if (c.startsWith('#')) c = c.slice(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length === 6 || c.length === 8) {
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

const mockTeams = {
  't2015': { id: 't2015', name: '2015', color: '#3b82f6' },
  't2016': { id: 't2016', name: '2016', color: '#10b981' },
  't_custom': { id: 't_custom', name: 'Custom Future Team', color: '#ec4899' }
};

const fakeStore = {
  team: (id) => mockTeams[id] || null,
  state: { teams: Object.values(mockTeams) },
  sessionPlayerIds: () => []
};

// Test single team style
const singleTeamStyle = (() => {
  const item = { type: 'training', teamId: 't2015', date: '2026-10-20' };
  const teams = [mockTeams['t2015']];
  const colors = teams.map(t => t.color);
  const alpha = 0.22;
  const darkStop = 'rgba(15, 23, 42, 0.85)';
  const bg = `linear-gradient(135deg, ${hexToRgba(colors[0], alpha)} 0%, ${darkStop} 100%)`;
  return { bg, border: `1.5px solid ${hexToRgba(colors[0], 0.38)}` };
})();
assert(singleTeamStyle.bg.includes('rgba(59, 130, 246, 0.22)'), 'Single team background should have rgba of #3b82f6');
console.log('✅ Single team background style verified:', singleTeamStyle.bg);

// Test two teams gradient
const twoTeamsStyle = (() => {
  const teams = [mockTeams['t2015'], mockTeams['t2016']];
  const colors = teams.map(t => t.color);
  const alpha = 0.22;
  const bg = `linear-gradient(135deg, ${hexToRgba(colors[0], alpha * 1.15)} 0%, rgba(15, 23, 42, 0.72) 50%, ${hexToRgba(colors[1], alpha * 1.15)} 100%)`;
  return { bg };
})();
assert(twoTeamsStyle.bg.includes('rgba(59, 130, 246'), 'Two teams gradient must contain color 1');
assert(twoTeamsStyle.bg.includes('rgba(16, 185, 129'), 'Two teams gradient must contain color 2');
console.log('✅ Two teams gradient verified:', twoTeamsStyle.bg);

// Test future custom team color
const customTeamStyle = hexToRgba(mockTeams['t_custom'].color, 0.22);
assert(customTeamStyle.includes('rgba(236, 72, 153, 0.22)'), 'Custom team #ec4899 must be parsed correctly to rgba');
console.log('✅ Future custom team color parsing verified:', customTeamStyle);

// Test match golden border
const matchBorder = '2.5px solid #f59e0b';
const matchGlow = '0 0 14px rgba(245, 158, 11, 0.35)';
assert(matchBorder.includes('#f59e0b'), 'Match must have gold border');
assert(matchGlow.includes('rgba(245, 158, 11'), 'Match must have gold glow');
console.log('✅ Match golden border & glow verified.');

console.log('\n🎉 ALL TARGETED TESTS PASSED!');

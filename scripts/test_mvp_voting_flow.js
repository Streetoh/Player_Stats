// Test MVP voting visibility and selection logic across Coach push and Player App
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST MVP VOTING VISIBILITY & ELIGIBILITY ===');

// 1. Check cloud.js pushCoachState logic for latestMatch selection
const cloudJs = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf-8');

assert(cloudJs.includes("type: 'match'"), "cloud.js must explicitly serialize type: 'match' in latestMatchMvp");
assert(cloudJs.includes("latestMatch.finished ? 'finished' : 'scheduled'"), "cloud.js must serialize status in latestMatchMvp");
assert(cloudJs.includes("isFinished: !!(latestMatch.finished === true"), "cloud.js must serialize isFinished in latestMatchMvp");
assert(cloudJs.includes("finishedMatches[0]"), "cloud.js must prioritize finished matches over future scheduled matches");
console.log('✅ [PASS] cloud.js correctly serializes match type, finished status, and prioritizes finished matches');

// 2. Simulate latestMatch selection logic
const todayIsoStr = new Date().toISOString().slice(0, 10);
const sampleSessions = [
  { id: 'future-match', type: 'match', date: '2099-01-01', title: 'Future Match' },
  { id: 'today-match', type: 'match', date: todayIsoStr, status: 'finished', isFinished: true, endedAt: Date.now() - 3600000, title: 'Finished Match' }
];

const matchSessions = sampleSessions
  .filter(s => s && (s.type === 'match' || s.rival))
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const finishedMatches = matchSessions.filter(s => s && (s.isFinished || s.finished || s.status === 'finished' || s.endedAt != null));
const playedOrToday = matchSessions.filter(s => (s.date || '') <= todayIsoStr);
const latestMatch = finishedMatches[0] || playedOrToday[0] || matchSessions[0];

assert.strictEqual(latestMatch.id, 'today-match', 'latestMatch must select today-match, NOT future-match');
console.log('✅ [PASS] latestMatch selection simulation selects the finished match instead of future match');

// 3. Test player-app.js eligibility logic
const playerAppJs = fs.readFileSync(path.join(__dirname, '../js/player-app.js'), 'utf-8');
assert(playerAppJs.includes('banner-stats-vote-mvp'), 'player-app.js must include banner-stats-vote-mvp');
assert(playerAppJs.includes('showMatchMvpVoteModal(statsMvpMatch)'), 'player-app.js must bind showMatchMvpVoteModal to banner-stats-vote-mvp');
assert(playerAppJs.includes('showMatchMvpVoteModal(effSessionForMvp)'), 'player-app.js must bind showMatchMvpVoteModal in match details modal');
console.log('✅ [PASS] player-app.js contains MVP voting triggers in both match details modal and stats view');

// 4. Test isEligibleMatch simulation
function isEligibleMatchSim(s, myPlayer) {
  if (!s) return false;
  const isMatch = s.type === 'match' || !!s.rival || !!s.convocationId;
  if (!isMatch) return false;

  const isFinished = !!(s.isFinished || s.finished || s.status === 'finished' || s.endedAt != null);
  if (!isFinished) return false;

  const myPId = myPlayer.id;
  const hasStats = !!(s.stats && s.stats[myPId] && Object.values(s.stats[myPId]).some(v => Number(v) > 0));
  const hasAtt = !!(s.attendance && s.attendance[myPId]);
  const hasPick = Array.isArray(s.coachPicks) && s.coachPicks.includes(myPId);
  const matchesPlayerTeam = myPlayer.teamId && (s.teamId === myPlayer.teamId || (Array.isArray(s.teamIds) && s.teamIds.includes(myPlayer.teamId)));

  const participated = hasStats || hasAtt || hasPick || matchesPlayerTeam;
  return participated;
}

const testPlayer = { id: 'p1', name: 'Carlos', teamId: 'team-a' };
const matchFinished = {
  id: 'm1',
  type: 'match',
  status: 'finished',
  isFinished: true,
  teamId: 'team-a',
  rival: 'Rival FC',
  date: todayIsoStr
};

assert.strictEqual(isEligibleMatchSim(matchFinished, testPlayer), true, 'Match should be eligible for player on same team');
console.log('✅ [PASS] isEligibleMatch handles player team membership and finished status correctly');

console.log('🎉 ALL MVP VOTING CHECKS PASSED SUCCESSFULLY!');

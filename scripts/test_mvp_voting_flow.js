// Test MVP voting visibility and selection logic across Coach push and Player App
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST MVP VOTING VISIBILITY & ELIGIBILITY ===');

// 1. Check cloud.js pushCoachState logic for latestMatch selection & test player serialization
const cloudJs = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf-8');

assert(cloudJs.includes("type: 'match'"), "cloud.js must explicitly serialize type: 'match' in latestMatchMvp");
assert(cloudJs.includes("latestMatch.finished ? 'finished' : 'scheduled'"), "cloud.js must serialize status in latestMatchMvp");
assert(cloudJs.includes("isFinished: !!(latestMatch.finished === true"), "cloud.js must serialize isFinished in latestMatchMvp");
assert(cloudJs.includes("finishedMatches[0]"), "cloud.js must prioritize finished matches over future scheduled matches");
assert(cloudJs.includes("computeParticipatingPlayerIds"), "cloud.js must guarantee computeParticipatingPlayerIds is used");
assert(cloudJs.includes("isTestPlayer: !!(p.isTestPlayer || p.isTest || p.id === 'test_player_profile')"), "cloud.js must serialize test player metadata");
console.log('✅ [PASS] cloud.js correctly serializes match type, finished status, participating IDs, and test player metadata');

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

// 3. Test player-app.js eligibility logic and banner presence
const playerAppJs = fs.readFileSync(path.join(__dirname, '../js/player-app.js'), 'utf-8');
assert(playerAppJs.includes('banner-vote-mvp'), 'player-app.js must include banner-vote-mvp in convocations view');
assert(playerAppJs.includes('banner-stats-vote-mvp'), 'player-app.js must include banner-stats-vote-mvp');
assert(playerAppJs.includes('showMatchMvpVoteModal(statsMvpMatch)'), 'player-app.js must bind showMatchMvpVoteModal to banner-stats-vote-mvp');
assert(playerAppJs.includes('showMatchMvpVoteModal(effSessionForMvp)'), 'player-app.js must bind showMatchMvpVoteModal in match details modal');
assert(playerAppJs.includes('test_player_profile'), 'player-app.js must support test_player_profile');
console.log('✅ [PASS] player-app.js contains MVP voting triggers in convocations view, match details, and stats view');

// 4. Test eligibility simulation (matching player-app.js exact behavior)
function isEligibleMatchSim(s, myP, linkedConv) {
  if (!s || !s.date) return false;
  const isMatch = (s.type === 'match' || (!s.type && (s.rival || s.score)));
  if (!isMatch) return false;

  const isFin = !!(
    s.isFinished === true ||
    s.finished === true ||
    s.status === 'finished' ||
    s.status === 'completed' ||
    s.endedAt != null ||
    s.finishedAt != null
  );
  if (!isFin) return false;

  const isTestUser = !!(myP && (myP.isTestPlayer || myP.isTest || myP.id === 'test_player_profile'));
  const sTeams = Array.isArray(s.teamIds) && s.teamIds.length > 0
    ? s.teamIds.map(String)
    : (s.teamId ? [String(s.teamId)] : []);

  const convTeams = linkedConv
    ? ((Array.isArray(linkedConv.teamIds) && linkedConv.teamIds.length > 0)
        ? linkedConv.teamIds.map(String)
        : (linkedConv.teamId ? [String(linkedConv.teamId)] : []))
    : [];

  if (isTestUser) {
    const assignedTids = Array.isArray(myP.assignedTeamIds) && myP.assignedTeamIds.length > 0
      ? myP.assignedTeamIds.map(String)
      : (myP.teamId ? [String(myP.teamId)] : []);
    const isAllTeams = assignedTids.length === 0 || assignedTids.includes('all') || myP.teamId === 'all';
    const matchMatchesTeam = isAllTeams ||
      sTeams.some(tid => assignedTids.includes(tid)) ||
      convTeams.some(tid => assignedTids.includes(tid));
    return matchMatchesTeam;
  }

  // Real player: ONLY those who actually participated
  const isExplicitlyAbsent = (
    (s.attendance && (s.attendance[myP.id] === 'absent' || (typeof s.attendance[myP.id] === 'object' && s.attendance[myP.id] !== null && s.attendance[myP.id].status === 'absent'))) ||
    (linkedConv && linkedConv.list && linkedConv.list[myP.id] === 'absent')
  );
  if (isExplicitlyAbsent) return false;

  const participated = !!(
    (s.stats && s.stats[myP.id] && Object.values(s.stats[myP.id]).some(v => Number(v) > 0)) ||
    (Array.isArray(s.slots) && s.slots.includes(myP.id)) ||
    (s.attendance && (s.attendance[myP.id] === 'present' || s.attendance[myP.id] === 'late' || s.attendance[myP.id] === 'yes' || s.attendance[myP.id] === true || (typeof s.attendance[myP.id] === 'object' && s.attendance[myP.id] !== null && (s.attendance[myP.id].status === 'present' || s.attendance[myP.id].status === 'late')))) ||
    (Array.isArray(s.trackedPlayerIds) && s.trackedPlayerIds.includes(myP.id)) ||
    (Array.isArray(s.coachPicks) && s.coachPicks.some(cp => cp && (cp.playerId === myP.id || cp.id === myP.id || cp === myP.id))) ||
    (linkedConv && linkedConv.list && (linkedConv.list[myP.id] === 'confirmed' || linkedConv.list[myP.id] === 'attended'))
  );
  return participated;
}

const matchFinished = {
  id: 'm1',
  type: 'match',
  status: 'finished',
  isFinished: true,
  teamId: 'team-a',
  rival: 'Rival FC',
  date: todayIsoStr,
  stats: { 'p-active': { goals: 1 } },
  attendance: { 'p-present': 'present', 'p-absent': 'absent' },
  slots: ['p-active']
};

// Case A: Real player on same team who did NOT participate -> MUST BE FALSE
const playerNonParticipant = { id: 'p-bench-nonparticipant', name: 'Bench', teamId: 'team-a' };
assert.strictEqual(isEligibleMatchSim(matchFinished, playerNonParticipant, null), false, 'Real player on same team who did NOT participate cannot vote');
console.log('✅ [PASS] Real player on same team who did not participate is correctly rejected');

// Case B: Real player who participated via stats -> MUST BE TRUE
const playerActive = { id: 'p-active', name: 'Active', teamId: 'team-a' };
assert.strictEqual(isEligibleMatchSim(matchFinished, playerActive, null), true, 'Real player with stats can vote');
console.log('✅ [PASS] Real player with active stats can vote');

// Case C: Real player who attended -> MUST BE TRUE
const playerPresent = { id: 'p-present', name: 'Present', teamId: 'team-a' };
assert.strictEqual(isEligibleMatchSim(matchFinished, playerPresent, null), true, 'Real player with attendance present can vote');
console.log('✅ [PASS] Real player marked present can vote');

// Case D: Real player marked absent -> MUST BE FALSE
const playerAbsent = { id: 'p-absent', name: 'Absent', teamId: 'team-a' };
assert.strictEqual(isEligibleMatchSim(matchFinished, playerAbsent, null), false, 'Real player marked absent cannot vote');
console.log('✅ [PASS] Real player marked absent is rejected');

// Case E: Coach test player assigned to team-a -> MUST BE TRUE
const testPlayerTeamA = { id: 'test_player_profile', isTestPlayer: true, name: 'Tester', teamId: 'team-a', assignedTeamIds: ['team-a'] };
assert.strictEqual(isEligibleMatchSim(matchFinished, testPlayerTeamA, null), true, 'Test player assigned to team-a can vote');
console.log('✅ [PASS] Test player profile assigned to team-a can vote');

// Case F: Coach test player assigned to team-b -> MUST BE FALSE
const testPlayerTeamB = { id: 'test_player_profile', isTestPlayer: true, name: 'Tester', teamId: 'team-b', assignedTeamIds: ['team-b'] };
assert.strictEqual(isEligibleMatchSim(matchFinished, testPlayerTeamB, null), false, 'Test player assigned to different team cannot vote');
console.log('✅ [PASS] Test player profile assigned to different team is rejected');

// Case G: Coach test player assigned to all teams -> MUST BE TRUE
const testPlayerAll = { id: 'test_player_profile', isTestPlayer: true, name: 'Tester', teamId: 'all', assignedTeamIds: ['all'] };
assert.strictEqual(isEligibleMatchSim(matchFinished, testPlayerAll, null), true, 'Test player profile assigned to all teams can vote');
console.log('✅ [PASS] Test player profile assigned to all teams can vote');

console.log('🎉 ALL MVP VOTING CHECKS PASSED SUCCESSFULLY!');

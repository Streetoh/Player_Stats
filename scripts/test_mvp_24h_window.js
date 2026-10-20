const fs = require('fs');
const path = require('path');

// Extract the functions from player-app.js
const playerAppCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'player-app.js'), 'utf-8');

// Test isMatchMvpVotingActive and getMatchFinishedTimestamp extraction
const getMatchFinishedTimestampMatch = playerAppCode.match(/function getMatchFinishedTimestamp\([\s\S]*?\n  \}/);
const isMatchMvpVotingActiveMatch = playerAppCode.match(/function isMatchMvpVotingActive\([\s\S]*?\n  \}/);

if (!getMatchFinishedTimestampMatch || !isMatchMvpVotingActiveMatch) {
  console.error("Failed to extract functions");
  process.exit(1);
}

eval(getMatchFinishedTimestampMatch[0]);
eval(isMatchMvpVotingActiveMatch[0]);

console.log("Testing MVP 24-hour voting window rules...");

const now = Date.now();

// Test 1: Match finished 2 hours ago
const recentMatch = {
  id: 'sess_1',
  type: 'match',
  status: 'finished',
  endedAt: now - (2 * 3600 * 1000)
};
if (!isMatchMvpVotingActive(recentMatch)) {
  console.error("FAIL: 2h ago match should be active");
  process.exit(1);
}
console.log("✅ Match 2h ago is ACTIVE for voting");

// Test 2: Match finished 23 hours ago
const almostExpiredMatch = {
  id: 'sess_2',
  type: 'match',
  status: 'finished',
  endedAt: now - (23 * 3600 * 1000)
};
if (!isMatchMvpVotingActive(almostExpiredMatch)) {
  console.error("FAIL: 23h ago match should be active");
  process.exit(1);
}
console.log("✅ Match 23h ago is ACTIVE for voting");

// Test 3: Match finished 25 hours ago
const expiredMatch = {
  id: 'sess_3',
  type: 'match',
  status: 'finished',
  endedAt: now - (25 * 3600 * 1000)
};
if (isMatchMvpVotingActive(expiredMatch)) {
  console.error("FAIL: 25h ago match should be EXPIRED");
  process.exit(1);
}
console.log("✅ Match 25h ago is EXPIRED (cannot vote, won't show)");

// Test 4: Match from Sunday (e.g. 48h ago) with date + time only
const sundayDate = new Date(now - (48 * 3600 * 1000)).toISOString().slice(0, 10);
const sundayMatch = {
  id: 'sess_sunday',
  type: 'match',
  status: 'finished',
  date: sundayDate,
  time: '12:00'
};
if (isMatchMvpVotingActive(sundayMatch)) {
  console.error("FAIL: Sunday match should be EXPIRED");
  process.exit(1);
}
console.log("✅ Match from Sunday (48h ago) is EXPIRED");

// Test 5: Match not finished yet
const scheduledMatch = {
  id: 'sess_future',
  type: 'match',
  status: 'scheduled',
  date: new Date(now + 3600000).toISOString().slice(0, 10)
};
if (isMatchMvpVotingActive(scheduledMatch)) {
  console.error("FAIL: Future/scheduled match should not be active");
  process.exit(1);
}
console.log("✅ Scheduled future match is NOT active for voting");

console.log("\n🎉 ALL MVP 24H WINDOW TESTS PASSED SUCCESSFULLY!");

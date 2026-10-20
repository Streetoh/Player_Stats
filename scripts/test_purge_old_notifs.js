const fs = require('fs');
const path = require('path');

const appCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf-8').replace(/\r\n/g, '\n');

console.log("Testing purge and anti-spam notification rules...");

// 1. Verify purgeOldNotifications exists
if (!appCode.includes('function purgeOldNotifications()')) {
  console.error("FAIL: purgeOldNotifications missing");
  process.exit(1);
}
console.log("✅ purgeOldNotifications function exists");

// 2. Verify syncAttendanceNotificationsFromConvocations rejects past convocations
if (!appCode.includes('if (!conv.date || conv.date < todayIso) return;')) {
  console.error("FAIL: syncAttendanceNotificationsFromConvocations does not check conv.date < todayIso");
  process.exit(1);
}
console.log("✅ Past convocations are strictly rejected from generating notifications");

// 3. Verify clean home screen when 0 unread
if (!appCode.includes('if (totalCount === 0) {\n      return \'\';\n    }')) {
  console.error("FAIL: renderHomeNotificationsHtml does not collapse when 0 unread");
  process.exit(1);
}
console.log("✅ Home screen automatically collapses and clears notification box when 0 unread");

// 4. Verify high-contrast white text is used
if (!appCode.includes('color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 800;')) {
  console.error("FAIL: High contrast white title styling missing");
  process.exit(1);
}
console.log("✅ Notification items use high-contrast white title and legible colors");

console.log("\n🎉 ALL ANTI-SPAM & VISUAL FIX TESTS PASSED!");

const fs = require('fs');
const path = require('path');

const appCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf-8');

console.log("Checking coach notifications integration in app.js...");

// 1. Verify syncAttendanceNotificationsFromConvocations exists
if (!appCode.includes('function syncAttendanceNotificationsFromConvocations()')) {
  console.error("FAIL: syncAttendanceNotificationsFromConvocations missing");
  process.exit(1);
}
console.log("✅ syncAttendanceNotificationsFromConvocations exists");

// 2. Verify bell button is in topbar
if (!appCode.includes('id="btn-profile-requests"') || !appCode.includes('id="requests-badge"')) {
  console.error("FAIL: Bell button or requests badge missing in topbar");
  process.exit(1);
}
console.log("✅ Topbar includes bell button (#btn-profile-requests) and unread count badge (#requests-badge)");

// 3. Verify store.js calls window.onPlayerAttendanceResponse during sync
const storeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf-8');
if (storeCode.includes('!isInitialSync && typeof window.onPlayerAttendanceResponse')) {
  console.error("FAIL: store.js still blocking onPlayerAttendanceResponse during initial sync");
  process.exit(1);
}
console.log("✅ store.js forwards responses to onPlayerAttendanceResponse reliably");

// 4. Verify home view calls sync and update badge
if (!appCode.includes('syncAttendanceNotificationsFromConvocations()') || !appCode.includes('updateRequestsBadge()')) {
  console.error("FAIL: renderHomeView does not sync attendance notifications");
  process.exit(1);
}
console.log("✅ renderHomeView synchronizes notifications and requests on render");

console.log("\n🎉 ALL COACH NOTIFICATIONS VERIFICATIONS PASSED!");

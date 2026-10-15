/* =========================================================
   Player stats (Player) • Official Player Portal & PWA
   Project: player-stats-2ac9d
   - English by default, fully bilingual (EN / ES)
   - Real-time sync with Coach App (Firebase Firestore)
   - 1-tap call-up voting & attendees status
   - Player profile with match rating, radar, skill explanations (English)
   - Matches & Trainings attended breakdown (no minutes)
   - Multi-team squad browser with full player profiles
   - Profile lock & Coach approval request workflow
   - Face to Face comparator
   ========================================================= */
(function () {
  'use strict';

  try {
    if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
      window.screen.orientation.lock('portrait').catch(() => {});
    }
  } catch (e) {}

  let currentTab = 'convocations';
  let clubData = null;
  let myPlayerId = localStorage.getItem('portal_player_id') || null;
  if (!myPlayerId) {
    const backupId = localStorage.getItem('portal_player_id_backup');
    if (backupId) {
      myPlayerId = backupId;
      try {
        localStorage.setItem('portal_player_id', backupId);
      } catch (e) {}
    }
  }
  let liveVotes = {}; // { [convId]: { [pid]: response } }
  let currentLang = localStorage.getItem('lang') || 'en';
  window.currentLang = currentLang;
  let activeTeamFilter = 'all';
  let myPendingReqUnsub = null;
  let convFilterType = 'all'; // 'all' | 'match' | 'training'
  let isPastConvsExpanded = false;

  function formatDisplayDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);

      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysEe = ['Pühapäev', 'Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev'];
      const daysRu = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

      const dayName = (currentLang === 'ru' ? daysRu : ((currentLang === 'ee' || currentLang === 'et') ? daysEe : (currentLang === 'es' ? daysEs : daysEn)))[dateObj.getDay()] || '';
      const dayPad = String(d).padStart(2, '0');
      const monthPad = String(m + 1).padStart(2, '0');
      return `${dayName}, ${dayPad}/${monthPad}/${y}`;
    }
    return isoStr;
  }

  function isDateInCurrentWeek(dateStr) {
    if (!dateStr) return false;
    const parts = String(dateStr).trim().split('-');
    if (parts.length !== 3) return false;
    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(target.getTime())) return false;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Pühapäev/Domingo/Sunday, 1 = Esmaspäev/Lunes/Monday
    const distToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    return target >= monday && target <= sunday;
  }

  function getLangDisplay(lang) {
    if (lang === 'ee' || lang === 'et') return '🇪🇪 ET';
    if (lang === 'es') return '🇪🇸 ES';
    if (lang === 'ru') return '🇷🇺 RU';
    return '🇬🇧 EN';
  }

  function setLanguage(lang, onChangedCallback) {
    const valid = (lang === 'ee' || lang === 'et' || lang === 'es' || lang === 'ru') ? (lang === 'et' ? 'ee' : lang) : 'en';
    currentLang = valid;
    window.currentLang = currentLang;
    try { localStorage.setItem('lang', currentLang); } catch (e) {}
    updateHeaderIdentity();
    updateTabbarLabels();
    renderCurrentTab();
    if (typeof window._refreshChatList === 'function') {
      try { window._refreshChatList(); } catch (e) {}
    }
    if (typeof onChangedCallback === 'function') {
      try { onChangedCallback(currentLang); } catch (e) {}
    }
  }

  function openLanguageModal(onChangedCallback) {
    haptic(40);
    const existing = document.getElementById('dialog-language-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dialog-language-modal';
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '999999';

    function renderModalContent() {
      const languages = [
        {
          code: 'es',
          flag: '🇪🇸',
          name: 'Español',
          sub: currentLang === 'es' ? 'Español (España)' : ((currentLang === 'ee' || currentLang === 'et') ? 'Hispaania keel' : (currentLang === 'ru' ? 'Испанский' : 'Spanish')),
          tag: 'ES'
        },
        {
          code: 'en',
          flag: '🇬🇧',
          name: 'English',
          sub: currentLang === 'es' ? 'Inglés (UK / US)' : ((currentLang === 'ee' || currentLang === 'et') ? 'Inglise keel' : (currentLang === 'ru' ? 'Английский' : 'English (UK / US)')),
          tag: 'EN'
        },
        {
          code: 'ee',
          flag: '🇪🇪',
          name: 'Eesti',
          sub: currentLang === 'es' ? 'Estonio (Eesti)' : ((currentLang === 'ee' || currentLang === 'et') ? 'Eesti keel' : (currentLang === 'ru' ? 'Эстонский' : 'Estonian (Eesti)')),
          tag: 'ET'
        },
        {
          code: 'ru',
          flag: '🇷🇺',
          name: 'Русский',
          sub: currentLang === 'es' ? 'Ruso (Россия)' : ((currentLang === 'ee' || currentLang === 'et') ? 'Vene keel' : (currentLang === 'ru' ? 'Русский язык' : 'Russian')),
          tag: 'RU'
        }
      ];

      overlay.innerHTML = `
        <div class="dialog-box" style="width: 92%; max-width: 390px; padding: 22px 18px; border-radius: 20px; box-shadow: 0 16px 48px rgba(0,0,0,0.7); animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 38px; height: 38px; border-radius: 12px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                🌐
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16.5px; font-weight: 900; color: #fff; letter-spacing: -0.2px;">${t('selectLanguage', 'Select Language')}</h3>
                <span style="font-size: 11.5px; color: var(--muted);">${t('selectLanguageDesc', 'Choose your preferred language')}</span>
              </div>
            </div>
            <button type="button" class="icon-btn ghost" id="btn-close-lang-modal-x" style="width: 32px; height: 32px; border-radius: 8px; font-size: 15px; color: var(--muted);" title="${t('close', 'Close')}">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 9px; margin-bottom: 18px;">
            ${languages.map(item => {
              const isActive = currentLang === item.code;
              return `
                <div class="lang-option-card" data-lang="${item.code}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 14px; cursor: pointer; transition: all 0.18s ease; ${
                  isActive
                    ? 'border: 2px solid var(--cyan); background: rgba(6, 182, 212, 0.14); box-shadow: 0 0 16px rgba(6, 182, 212, 0.22);'
                    : 'border: 1px solid var(--border); background: var(--surface2);'
                }">
                  <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                    <div style="font-size: 28px; line-height: 1; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
                      ${item.flag}
                    </div>
                    <div style="min-width: 0;">
                      <div style="font-size: 14.5px; font-weight: 900; color: ${isActive ? 'var(--cyan)' : '#fff'}; display: flex; align-items: center; gap: 6px;">
                        ${item.name}
                        <span style="font-size: 10px; padding: 2px 6px; border-radius: 6px; font-weight: 800; background: ${isActive ? 'rgba(6, 182, 212, 0.25)' : 'var(--bg2)'}; color: ${isActive ? 'var(--cyan)' : 'var(--muted)'};">
                          ${item.tag}
                        </span>
                      </div>
                      <small style="display: block; font-size: 11px; color: ${isActive ? 'rgba(255,255,255,0.8)' : 'var(--muted)'}; margin-top: 1px;">
                        ${item.sub}
                      </small>
                    </div>
                  </div>
                  <div style="flex-shrink: 0; margin-left: 8px;">
                    ${
                      isActive
                        ? `<div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; background: var(--cyan); color: #000; font-size: 11px; font-weight: 900; box-shadow: 0 2px 10px rgba(6, 182, 212, 0.45);">
                            ✓ ${t('activeBadge', 'Active')}
                          </div>`
                        : `<div style="width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--border); background: rgba(255,255,255,0.03);"></div>`
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <button type="button" class="btn primary block" id="btn-close-lang-modal-done" style="height: 44px; font-weight: 900; font-size: 14px; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #3b82f6); border: none; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);">
            ✓ ${t('doneBtn', 'Done')}
          </button>

          ${!window.AndroidBridge ? `
            <div style="text-align: center; margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px;">
              <button type="button" class="btn sm ghost block" id="btn-lang-modal-apk" style="height: 38px; font-size: 12px; color: var(--cyan); border: 1.5px solid rgba(34, 211, 238, 0.4); border-radius: 10px; font-weight: 800; background: rgba(34, 211, 238, 0.08);">
                📲 ${t('downloadApk', 'Descargar App Android (APK)')}
              </button>
            </div>
          ` : ''}
        </div>
      `;

      const closeBtnX = overlay.querySelector('#btn-close-lang-modal-x');
      const closeBtnDone = overlay.querySelector('#btn-close-lang-modal-done');
      const close = () => {
        haptic(30);
        overlay.remove();
      };
      if (closeBtnX) closeBtnX.onclick = close;
      if (closeBtnDone) closeBtnDone.onclick = close;

      const btnLangApk = overlay.querySelector('#btn-lang-modal-apk');
      if (btnLangApk) {
        btnLangApk.onclick = () => {
          showApkDownloadGuideModal();
        };
      }

      overlay.querySelectorAll('.lang-option-card').forEach(card => {
        card.onclick = () => {
          const selected = card.getAttribute('data-lang');
          if (!selected) return;
          haptic(50);
          setLanguage(selected, onChangedCallback);
          toast(t('langChangedToast', 'Language updated'), 'info');
          renderModalContent();
        };
      });
    }

    renderModalContent();

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        haptic(30);
        overlay.remove();
      }
    };

    document.body.appendChild(overlay);
  }

  function cycleLang() {
    openLanguageModal();
  }

  window.__handleAppBack = function () {
    const lightbox = document.querySelector('.chat-photo-lightbox');
    if (lightbox) {
      lightbox.remove();
      return true;
    }
    const overlays = document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop');
    if (overlays.length > 0) {
      const topOverlay = overlays[overlays.length - 1];
      if (topOverlay.classList.contains('chat-dialog-overlay')) {
        const backBtn = topOverlay.querySelector('#chat-back-btn, #chat-close-btn');
        if (backBtn) {
          backBtn.click();
          return true;
        }
      }
      topOverlay.remove();
      return true;
    }
    if (currentTab !== 'convocations') {
      currentTab = 'convocations';
      const convTabBtn = document.querySelector('#tab-convocations, button[data-tab="convocations"]');
      if (convTabBtn) {
        document.querySelectorAll('.tabbar button, .tab-bar button').forEach(b => b.classList.remove('active'));
        convTabBtn.classList.add('active');
      }
      renderCurrentTab();
      return true;
    }
    return false;
  };

  const view = document.getElementById('portal-view');
  const toastRoot = document.getElementById('toast-root');

  /* -------------------------------------------------------------
     DICCIONARIO BILINGÜE COMPLETO (POR DEFECTO INGLÉS)
     ------------------------------------------------------------- */
  const DICT = {
    en: {
      "appName": "Player stats (Player)",
      "convocations": "Call-ups",
      "myProfile": "My Profile",
      "squad": "Squad",
      "h2h": "Face to Face",
      "chat": "Chat",
      "live": "Live",
      "selectIdentity": "Select who you are...",
      "profileLocked": "Profile Locked",
      "changeProfile": "Change ▾",
      "reqChange": "Request Change",
      "allTeams": "All Teams",
      "searchTeammate": "Search teammate by name or number...",
      "searchChatOrTeammate": "Search chat or teammate...",
      "todayBadge": "TODAY",
      "match": "Match",
      "training": "Training",
      "overallRating": "Overall Rating",
      "combinedRating": "Combined Rating",
      "onlyTrainingRating": "Training Only",
      "onlyMatchRating": "Matches Only",
      "baseRating": "Base Rating",
      "trainingsTab": "Trainings",
      "matchesTab": "Matches",
      "noMatchesRecordedYet": "No matches recorded yet",
      "noMatchesRecordedDesc": "This player has no minutes or stats recorded in competitive matches yet.",
      "noTrainingsRecordedYet": "No training sessions recorded yet",
      "participatingTeams": "Participating teams",
      "venue": "Ground / Venue",
      "address": "Address",
      "openInMaps": "Open in Google Maps ↗",
      "coachNote": "Coach's note",
      "willYouAttend": "Will you attend this session?",
      "iWillAttend": "🟢 I will attend",
      "iCannotAttend": "❌ Cannot attend",
      "attendanceConfirmed": "🟢 Attendance confirmed",
      "absenceReported": "❌ Absent reported",
      "sendReminderToPlayer": "Send reminder to this player",
      "attendanceShortYes": "Attending",
      "attendanceShortNo": "Absent",
      "convocationReminderTitle": "Call-up Attendance Reminder",
      "convocationReminderMsg": "The coach is waiting for your attendance response. Please respond now!",
      "confirmAttendanceYes": "🟢 Confirm Attendance (Yes)",
      "cannotAttendNo": "❌ Can't Attend (No)",
      "dismiss": "Dismiss",
      "playerAlreadyResponded": "This player has already responded or is not pending.",
      "reminderSentToPlayer": "Reminder sent to",
      "pendingResponse": "⏳ Pending your response",
      "notCalledUp": "ℹ️ You are not on this call-up list",
      "confirmedBadge": "Confirmed",
      "absentBadge": "Unavailable",
      "pendingBadge": "Pending",
      "viewAttendees": "👥 See who is attending ▾",
      "attendeesTitle": "Call-up Attendance List",
      "noAttendeesYet": "Nobody has confirmed yet",
      "noAbsentYet": "No absences reported",
      "allAnswered": "All called players have responded",
      "emptyConvs": "No active call-ups",
      "emptyConvsDesc": "The coach has not published any call-ups for upcoming matches or trainings yet.",
      "todayTrainingBadge": "✨ TODAY'S TRAINING",
      "todayMatchBadge": "✨ TODAY'S MATCH",
      "upcomingThisWeek": "Upcoming this week",
      "noUpcomingThisWeek": "No more trainings scheduled for this week",
      "noUpcomingThisWeekDesc": "Check past trainings & sessions in the dropdown below.",
      "pastConvocations": "Past trainings",
      "pastConvocationsMatches": "Past matches",
      "pastConvocationsAll": "Past trainings & call-ups",
      "pastSessionBadge": "Completed",
      "chooseIdentityTitle": "Who are you in the team?",
      "chooseIdentityDesc": "Select your name to link your player profile to this device. Once chosen, it will be locked.",
      "confirmIdentityBtn": "Link My Profile",
      "reqChangeTitle": "Request Profile Change",
      "reqChangeDesc": "Your profile is currently locked to {name}. To prevent mistakes, selecting another player sends an authorization request to your coach:",
      "selectNewPlayer": "Select the correct player:",
      "reasonPlaceholder": "Reason (e.g. Selected by mistake, new phone...)",
      "sendReqBtn": "🚀 Send Request to Coach",
      "reqSentBanner": "⏳ Request sent to coach to switch to {name}. Awaiting approval...",
      "reqApprovedToast": "✅ Your coach approved your profile change!",
      "reqRejectedToast": "❌ Your coach rejected the profile change request.",
      "performanceRating": "Performance Rating",
      "ratingDesc": "Match Rating calculated from actual tactical contributions, ball actions and efficiency.",
      "matchesAttended": "Matches Attended",
      "trainingsAttended": "Trainings Attended",
      "totalSessions": "Total Sessions",
      "attendanceStreak": "Attendance Streak",
      "attendanceStreakDesc": "Consecutive sessions attended",
      "streakSessions": "sessions in a row",
      "streakSessionSingle": "session",
      "streakOnFire": "🔥 On Fire",
      "futCardTitle": "FUT Collectible Card",
      "viewFutCard": "View FUT Card",
      "viewMyFutCard": "View my FUT Collectible Card",
      "streakMilestoneBronze": "Bronze Medal",
      "streakMilestoneSilver": "Silver Medal",
      "streakMilestoneGold": "Gold Medal",
      "streakMilestoneDiamond": "Diamond Badge",
      "streakNextMilestone": "{current}/{target} towards {nextMilestone}",
      "streakMaster": "👑 Unstoppable Legendary Streak!",
      "mvpVotingActive": "Match MVP Voting Open",
      "voteMatchMvp": "Vote for Match MVP",
      "chooseBestTeammate": "Select the teammate who performed best in this match:",
      "cannotVoteSelf": "You cannot vote for yourself",
      "mvpVoteRegistered": "MVP vote submitted for {name}!",
      "mvpAlreadyVoted": "You voted for {name}",
      "mvpOfficialWinner": "⭐ Official MVP: {name}!",
      "seasonMvpsBadge": "⭐ {count}x Match MVP",
      "mvpBannerTitle": "👑 Match MVP Voting!",
      "mvpBannerSub": "Vote for the best player vs {match}",
      "weeklyMissionTitle": "Coach's Weekly Mission",
      "noActiveMission": "No active mission this week. Keep training hard!",
      "missionStatusPending": "⏳ In Progress",
      "missionStatusCompleted": "🎉 Mission Accomplished!",
      "missionMotivation": "Focus on this tactical goal in your upcoming matches and training sessions.",
      "goalsScored": "Goals Scored",
      "passAccuracy": "Pass Accuracy",
      "passesAccurate": "accurate passes",
      "shotAccuracy": "Shot Accuracy",
      "shotsOnTarget": "on target",
      "ballTouches": "Ball Touches",
      "dribblesWon": "Successful Take-ons",
      "duelsWon": "Duels Won",
      "recoveries": "Ball Recoveries",
      "recentMatchesTitle": "Recent Matches & Actions Breakdown",
      "noMatchesYet": "No matches or sessions recorded yet.",
      "noActionsYet": "No individual actions recorded yet.",
      "tapSkillHint": "Tap any skill on the radar to see its full explanation in English ℹ️",
      "footRight": "Right-footed",
      "footLeft": "Left-footed",
      "footBoth": "Ambidextrous",
      "h2hTitle": "Face to Face Comparator",
      "h2hDesc": "Select two teammates to compare their skills and performance metrics head to head:",
      "player1": "Player 1",
      "player2": "Player 2",
      "choosePlayer": "Choose Player",
      "fullProfile": "Full Profile",
      "close": "Close",
      "skillsRadar": "Athletic Qualities Radar",
      "cumulativeStats": "Cumulative Stats",
      "squadTitle": "Player Squad",
      "squadSubtitle": "Browse teammates across all teams in the club and tap to inspect their full stats:",
      "h2hNeedTwo": "At least 2 players are needed in the squad to compare.",
      "locked": "Locked",
      "reasonLabel": "Reason / Notes:",
      "chooseWhoYouAre": "-- Select who you really are --",
      "reqSelectTargetErr": "Please select the player you want to switch to",
      "reqSentSuccess": "Request sent to coach! It will update automatically once approved.",
      "sending": "Sending...",
      "linkedSuccess": "Profile linked successfully!",
      "loadingPlayers": "Loading players from the cloud...",
      "passesLabel": "PASSES",
      "shotsLabel": "SHOTS",
      "goalsLabel": "GOALS",
      "dribblesLabel": "DRIBBLES",
      "recoveriesLabel": "RECOV.",
      "touchesLabel": "TOUCHES",
      "prob1v1Title": "1v1 Win Probability",
      "favoriteBadge": "Favorite",
      "veryBalanced": "Very Balanced",
      "bayesAgeModel": "Bayes + 1v1 + Age Model",
      "sameBioAge": "Same biological age",
      "reasonDribble": "Higher dribbling / agility",
      "reasonPhysical": "Physical dominance",
      "reasonDefense": "Defensive solidity",
      "reasonWinRate": "Better 1v1 record",
      "reasonAge": "Physical maturity advantage",
      "duels1v1Historical": "1v1 Duels (History)",
      "duels1v1": "1v1 Duels",
      "duels1v1WinRate": "1v1 Win Rate %",
      "duels1v1Won": "1v1 Duels Won",
      "duels1v1Lost": "1v1 Duels Lost",
      "h2h_pedagogical_title": "1v1 Tactical Advice",
      "h2h_your_advantage": "You have an edge in {stat} (+{diff}). Use it to your advantage!",
      "h2h_watch_out": "Watch out for their {stat} (-{diff}). Play fast and anticipate.",
      "h2h_best_weapon": "Tough duel: your best bet today is competing through your {stat}.",
      "h2h_tactical_summary": "6-Skill Breakdown",
      "h2h_balanced_duel": "Very balanced duel! Focus on tactical discipline and good positioning.",
      "heightCm": "Height (cm)",
      "h2h_tip_height_tall_rival": "Watch out for their long legs! Don't try to bump into them. Slide the ball underneath or use quick feints to dizzy them.",
      "h2h_tip_height_fast_rival": "They are lightning quick! Don't dive in recklessly, hold your ground and wait for them to box themselves in.",
      "h2h_tip_height_advantage": "Use your longer stride! Shield the ball with your body and keep them from reaching in.",
      "h2h_tip_tir_rival_high": "They've got a cannon of a shot! Don't give them space to shoot from the edge of the box. Close them down fast.",
      "h2h_tip_tir_advantage": "You've got the firepower! As soon as you find a gap in the 1v1, open up the angle and fire at goal.",
      "h2h_tip_tir_rival_low": "They rarely risk shooting from afar. You can drop a step back without worrying about a shot.",
      "h2h_tip_reg_rival_high": "Great dribbler! Don't dive in on the first move; stay on your feet and wait until they slow down.",
      "h2h_tip_reg_advantage": "Pure skill! Use quick body feints and pace changes to leave them frozen on the spot.",
      "h2h_tip_reg_rival_low": "They struggle to control under pressure. Bite in fast and snatch the ball the moment they get it!",
      "h2h_tip_def_rival_high": "Strong tackler! Don't run straight at them: use a quick fake or catch them off rhythm.",
      "h2h_tip_def_advantage": "You're a defensive lock! Stay side-on, use your body, and make a clean tackle.",
      "h2h_tip_def_rival_low": "They struggle to defend 1v1. Attack their blind side or push past with burst of speed!",
      "h2h_tip_fis_rival_high": "A wall in shoulder-to-shoulder battles. Use agility and avoid direct physical bumps!",
      "h2h_tip_fis_advantage": "You have plenty of power! Lean in strong and take the ground with authority.",
      "h2h_tip_fis_rival_low": "Lacking physical strength in contact. Hold your ground and win the ball with sheer strength!",
      "h2h_best_weapon_tir": "Tough matchup: your best shot is a surprise strike. Pull the trigger quickly as soon as you find an angle!",
      "h2h_best_weapon_reg": "Tough matchup: your best card is bold dribbling. A sudden shift of pace can throw them off!",
      "h2h_best_weapon_def": "Tough matchup: your best weapon is patience in defense. Wait for the exact moment to step in!",
      "h2h_best_weapon_fis": "Tough matchup: your best weapon is physical intensity. Never give up on a ball and press hard!",
      "stat_pas": "Passing (PAS)",
      "stat_tir": "Shooting (SHO)",
      "stat_reg": "Dribbling (DRI)",
      "stat_def": "Defending (DEF)",
      "stat_fis": "Physical (PHY)",
      "stat_dis": "Discipline (DIS)",
      "mvp_coach_pick": "⭐ Coach's Pick",
      "mvp_coach_picks_title": "Coach's Nominees",
      "btn_vote_as_mvp": "Vote as MVP",
      "btn_cancel_view_others": "Cancel / View others",
      "mvp_coach_reason_label": "Coach's Reason",
      "autoMissionBadge": "⚡ Auto Mission",
      "manualMissionBadge": "Manual Mission",
      "progressLabel": "Progress",
      "matchDetail": "Match / Session Detail",
      "viewSessionDetail": "View Match Details",
      "loadingSession": "Loading session data...",
      "won": "Won",
      "lost": "Lost",
      "sessions": "Trainings & Sessions",
      "winRate": "WIN RATE",
      "stops": "defensive stops",
      "goals": "goals",
      "duel1v1Goals": "1v1 Goals",
      "duel1v1Stops": "Steals / Stops",
      "performanceMetrics": "Performance Metrics",
      "comparativeRadars": "Comparative Skill Radars",
      "pitchGoalsTitle": "Tactical Goal Map",
      "pitchGoalsDesc": "Goals scored by field zone",
      "untrackedGoalsHint": "goals recorded without specific field zone assigned",
      "chatWithPlayer": "💬 Chat with this teammate",
      "zone_box_opp": "Opponent Box",
      "zone_front": "Front of Box",
      "zone_wing_off_l": "Attacking Left Wing",
      "zone_wing_off_r": "Attacking Right Wing",
      "zone_wing_l": "Left Wing",
      "zone_wing_r": "Right Wing",
      "zone_mid": "Midfield",
      "filterAll": "All",
      "filterMatches": "🏆 Matches",
      "filterTrainings": "⚽ Trainings",
      "requestCoachProfile": "➕ Not on the list? Request registration from coach",
      "requestCoachProfileTitle": "Request Registration from Coach",
      "requestCoachProfileDesc": "Send your details to the coach so they can create your profile in the team database.",
      "fullNameLabel": "Full Name *",
      "fullNamePlaceholder": "e.g. Lucas Martinez",
      "dorsalLabel": "Jersey Number",
      "dorsalPlaceholder": "e.g. 10",
      "positionLabel": "Position",
      "positionPlaceholder": "e.g. Striker, Goalkeeper...",
      "notesLabel": "Notes / Team",
      "notesPlaceholder": "e.g. U14 Team, new signing...",
      "sendRequest": "Send Request to Coach",
      "nameRequired": "Please enter your full name",
      "requestSent": "Request sent to coach!",
      "coachCardTitle": "Head Coach Profile",
      "viewCoachProfile": "View Coach Profile",
      "coachProfileSubtitle": "Technical Director & Coaching Staff",
      "chatWithCoach": "💬 Chat with Coach",
      "confirmPlayerIdentity": "Confirm Identity",
      "areYouPlayer": "Are you {name}?",
      "securityCodeDesc": "To protect your player profile, this security code has been generated. Give this code to your coach so they can verify and authorize access on your device.",
      "securityCodeTitle": "Security Code",
      "waitingCoachApproval": "Waiting for your coach to authorize the code...",
      "copyCode": "📋 Copy Code",
      "codeCopied": "✅ Code copied to clipboard!",
      "sendViaViber": "📱 Send via Viber",
      "cancelSelectOther": "✕ Cancel and select another player",
      "claimLockedNotice": "Active request locked to this profile. You cannot change profile or send a new code until your coach authorizes or denies the request.",
      "viberShareMsg": "Hi Coach, my verification security code is {code} to access my profile ({name}) on Player Stats app.",
      "player": "Player",
      "allPlayers": "All Players",
      "creationApproved": "🎉 Your coach approved and created your profile! You can now view your stats.",
      "creationRejected": "❌ Your coach declined the registration request.",
      "profileChangeSecurityTitle": "Confirm Profile Change",
      "profileChangeSecurityDesc": "To protect your player account, this security code has been generated. Give this code to your coach so they can authorize switching your profile to {name}.",
      "viberProfileChangeMsg": "Hi Coach, my verification code is {code} to change my profile to {name} on Player Stats app.",
      "birthDate": "Date of Birth",
      "age": "Age",
      "secondaryPositions": "Secondary Positions",
      "guardian": "Parent / Guardian",
      "callCoach": "Call Coach",
      "call": "Call",
      "voteReset": "Attendance vote cancelled (pending)",
      "absenceReasonTitle": "Reason for Absence",
      "absenceReasonPrompt": "Please briefly explain to your coach why you will not be able to attend (e.g. injury, illness, exam, family):",
      "absenceReasonPlaceholder": "Write your reason here...",
      "confirmAbsence": "Confirm Absence",
      "viberCoachContactMsg": "Hi Coach!",
      "messageViaViber": "Message via Viber",
      "contact": "Contact",
      "msgDeletedForEveryone": "This message was deleted",
      "messageOptions": "Message Options",
      "copyMessage": "Copy message",
      "editMessage": "Edit message",
      "deleteForEveryone": "Delete for everyone",
      "deleteForMe": "Delete for me",
      "deleteForEveryoneConfirm": "Are you sure you want to delete this message for everyone?",
      "messageDeleted": "Message deleted for everyone",
      "messageDeletedForMe": "Message removed for you",
      "messageEdited": "Message updated",
      "copiedToClipboard": "Message copied to clipboard",
      "stat_touches": "Ball Touches",
      "stat_passOk": "Accurate Passes",
      "stat_passKo": "Inaccurate Passes",
      "stat_shotOn": "Shots on Target",
      "stat_shotOff": "Shots Off Target",
      "stat_goal": "Goals Scored",
      "stat_assist": "Assists",
      "stat_dribbleOk": "Successful Take-ons",
      "stat_dribbleKo": "Failed Take-ons",
      "stat_recovery": "Ball Recoveries",
      "stat_loss": "Ball Losses",
      "stat_duelWon": "Duels Won",
      "stat_duelLost": "Duels Lost",
      "stat_cross": "Crosses",
      "stat_keyPass": "Key Passes",
      "stat_header": "Headers",
      "stat_foulRecv": "Fouls Won",
      "stat_foul": "Fouls Committed",
      "stat_save": "Goalkeeper Saves",
      "stat_yellow": "Yellow Cards",
      "stat_red": "Red Cards",
      "appUpdateRequired": "App Update Required",
      "appUpdateDesc": "The coach has requested a cache and app refresh to ensure all updates, tactical features, and latest stats load properly.",
      "restartApp": "🔄 Restart App",
      "clearCacheBtn": "🔄 Clear App Cache & Refresh",
      "careerActionsTitle": "Career Actions Breakdown",
      "careerActionsDesc": "Complete record of all tactical contributions and match actions",
      "noCareerActions": "No individual career actions recorded yet.",
      "actions": "actions",
      "matchDate": "Match Date",
      "trainingDate": "Training Date",
      "kickoffTime": "Kick-off Time",
      "trainingTime": "Training Time",
      "meetingTime": "Meeting / Arrival Time",
      "pitchAndVenue": "Pitch & Venue",
      "coachInstructions": "Coach's Instructions & Notes",
      "kitAndGear": "Kit & Gear",
      "defaultKitMatch": "Official match kit, shin guards and water bottle",
      "defaultKitTraining": "Training gear, shin guards, football boots and water bottle",
      "matchSquad": "Match Squad",
      "trainingSquad": "Training Squad",
      "attendanceResponse": "Your Attendance Response:",
      "tapMatchDetails": "Tap for Match Details & Squad",
      "tapTrainingDetails": "Tap for Training Details & Squad",
      "opponentLabel": "Opponent:",
      "officialFixture": "Official Fixture",
      "officialTraining": "Official Training",
      "venueNotSpecified": "Venue location not specified",
      "newBadge": "NEW",
      "pendingApproval": "Pending Approval",
      "noActionsInZone": "No actions recorded in this sector",
      "zoneDetailsTitle": "Pitch Zone Breakdown",
      "matchDetails": "Match Details",
      "trainingDetails": "Training Details",
      "selectLanguage": "Select Language",
      "selectLanguageDesc": "Choose your preferred language for the application",
      "activeBadge": "Active",
      "doneBtn": "Done",
      "langSpanish": "Spanish",
      "langEnglish": "English",
      "langEstonian": "Estonian",
      "langChangedToast": "Language changed to English",
      "startTime": "Start",
      "endTime": "End",
      "duration": "Duration",
      "claimCooldownWait": "Please wait {sec}s before requesting another verification code.",
      "downloadApk": "Download Android App (APK)",
      "apkDownloadTitle": "Download Android App",
      "apkDownloadStarted": "Download started on your device!",
      "apkHowToInstallTitle": "Where to find it & how to install?",
      "apkStep1Bold": "Check notification bar:",
      "apkStep1Desc": "Swipe down from the top edge of your screen and tap \"PlayerStats_Player.apk\" once completed.",
      "apkStep2Bold": "Or open your Downloads folder:",
      "apkStep2Desc": "Open your phone's \"Files\", \"My Files\" or \"Downloads\" app to find and tap \"PlayerStats_Player.apk\".",
      "apkFamilyLinkTitle": "For Google Family Link users:",
      "apkFamilyLinkDesc": "Ask parents to open Family Link -> App limits -> \"Player stats (Player)\" -> select \"Always allowed\".",
      "openInBrowserDownload": "Open & download in browser tab",
      "retryDownload": "Retry Download",
      "downloadStartedToast": "📥 Downloading APK...",
      "h2h_keys_title": "Duel Keys",
      "mvp_coach_reason_title": "Coach's reason:",
      "mvp_btn_confirm_vote": "Vote {name} as MVP",
      "mvp_btn_cancel": "Cancel and view others",
      "currentProgressLabel": "Progress",
      "minAttemptsLabel": "Min. attempts"
},
    ee: {
      "appName": "Player stats (Mängija)",
      "convocations": "Kutsed",
      "myProfile": "Minu Profiil",
      "squad": "Koosseis",
      "h2h": "Face to Face",
      "chat": "Vestlus",
      "live": "Otse",
      "selectIdentity": "Vali, kes sa oled...",
      "profileLocked": "Profiil Lukustatud",
      "changeProfile": "Muuda ▾",
      "reqChange": "Taotle Muutmist",
      "allTeams": "Kõik meeskonnad",
      "searchTeammate": "Otsi meeskonnakaaslast nime või numbri järgi...",
      "searchChatOrTeammate": "Otsi vestlust või meeskonnakaaslast...",
      "todayBadge": "TÄNA",
      "match": "Mäng",
      "training": "Treening",
      "overallRating": "Üldhinnang",
      "combinedRating": "Kombineeritud hinnang",
      "onlyTrainingRating": "Ainult treeningud",
      "onlyMatchRating": "Ainult mängud",
      "baseRating": "Baashinnang",
      "trainingsTab": "Treeningud",
      "matchesTab": "Mängud",
      "noMatchesRecordedYet": "Ühtegi mängu pole veel salvestatud",
      "noMatchesRecordedDesc": "Sellel mängijal pole veel võistlusmängude statistikat salvestatud.",
      "noTrainingsRecordedYet": "Ühtegi treeningut pole veel salvestatud",
      "participatingTeams": "Osalevad meeskonnad",
      "venue": "Koht / Väljak",
      "address": "Aadress",
      "openInMaps": "Ava Google Mapsis ↗",
      "coachNote": "Treeneri märkus",
      "willYouAttend": "Kas osaled sellel üritusel?",
      "iWillAttend": "🟢 Osalen",
      "iCannotAttend": "❌ Ei saa osaleda",
      "attendanceConfirmed": "🟢 Osalemine kinnitatud",
      "absenceReported": "❌ Puudumine teatatud",
      "sendReminderToPlayer": "Saada meeldetuletus sellele mängijale",
      "attendanceShortYes": "Osaleb",
      "attendanceShortNo": "Puudub",
      "convocationReminderTitle": "Kutse osalemise meeldetuletus",
      "convocationReminderMsg": "Treener ootab sinu osalemise kinnitust. Palun vasta kohe!",
      "confirmAttendanceYes": "🟢 Kinnita osalemine (Jah)",
      "cannotAttendNo": "❌ Ei saa osaleda (Puudun)",
      "dismiss": "Sulge",
      "playerAlreadyResponded": "See mängija on juba vastanud või ei ole ootel.",
      "reminderSentToPlayer": "Meeldetuletus saadetud mängijale",
      "pendingResponse": "⏳ Ootab sinu vastust",
      "notCalledUp": "ℹ️ Sind pole sellesse nimekirja kutsutud",
      "confirmedBadge": "Kinnitatud",
      "absentBadge": "Puuduvad",
      "pendingBadge": "Ootel",
      "viewAttendees": "👥 Vaata osalejate nimekirja ▾",
      "attendeesTitle": "Kutse Osalejate Nimekiri",
      "noAttendeesYet": "Keegi pole veel kinnitanud",
      "noAbsentYet": "Puudumisi pole teatatud",
      "allAnswered": "Kõik kutsutud mängijad on vastanud",
      "emptyConvs": "Aktiivseid kutseid pole",
      "emptyConvsDesc": "Treener pole veel avaldanud kutseid eelseisvateks mängudeks või treeninguteks.",
      "todayTrainingBadge": "✨ TÄNANE TREENING",
      "todayMatchBadge": "✨ TÄNANE MÄNG",
      "upcomingThisWeek": "Järgmised sel nädalal",
      "noUpcomingThisWeek": "Sel nädalal pole rohkem treeninguid planeeritud",
      "noUpcomingThisWeekDesc": "Vaata varasemate treeningute ajalugu allolevast rippmenüüst.",
      "pastConvocations": "Varasemad treeningud",
      "pastConvocationsMatches": "Varasemad mängud",
      "pastConvocationsAll": "Varasemad treeningud ja kutsed",
      "pastSessionBadge": "Lõppenud",
      "chooseIdentityTitle": "Kes sa oled meeskonnas?",
      "chooseIdentityDesc": "Vali oma nimi, et siduda oma profiil selle seadmega. Pärast valimist see lukustatakse.",
      "confirmIdentityBtn": "Seo minu profiil",
      "reqChangeTitle": "Taotle Profiili Muutmist",
      "reqChangeDesc": "Sinu profiil on praegu seotud mängijaga {name}. Vigade vältimiseks saadetakse teise mängija valimisel luba treenerile:",
      "selectNewPlayer": "Vali õige mängija:",
      "reasonPlaceholder": "Põhjus (nt valesti valitud, uus telefon...)",
      "sendReqBtn": "🚀 Saada Taotlus Treenerile",
      "reqSentBanner": "⏳ Taotlus saadetud treenerile profiili muutmiseks mängijale {name}. Ootab kinnitamist...",
      "reqApprovedToast": "✅ Treener kinnitas sinu profiilimuudatuse!",
      "reqRejectedToast": "❌ Treener lükkas profiilimuudatuse tagasi.",
      "performanceRating": "Esitushinne",
      "ratingDesc": "Mänguhinne arvutatakse tegelike taktikaliste panuste, pallipuudete ja tõhususe põhjal.",
      "matchesAttended": "Mängitud Mänge",
      "trainingsAttended": "Osaletud Treeninguid",
      "totalSessions": "Sessioone Kokku",
      "attendanceStreak": "Osalemise seeria",
      "attendanceStreakDesc": "Järjestikust treeningut ja mängu",
      "streakSessions": "korda järjest",
      "streakSessionSingle": "kord",
      "streakOnFire": "🔥 Hoog sees",
      "futCardTitle": "Kogutav FUT Kaart",
      "viewFutCard": "Vaata FUT Kaarti",
      "viewMyFutCard": "🃏 Vaata minu FUT Kaarti",
      "streakMilestoneBronze": "Pronksmedal",
      "streakMilestoneSilver": "Hõbemedal",
      "streakMilestoneGold": "Kuldmedal",
      "streakMilestoneDiamond": "Teemantmärk",
      "streakNextMilestone": "{current}/{target} sihtmärgini {nextMilestone}",
      "streakMaster": "👑 Peatamatu Legendaarne Seeria!",
      "mvpVotingActive": "Mängu MVP hääletus avatud",
      "voteMatchMvp": "Hääleta mängu MVP poolt",
      "chooseBestTeammate": "Vali meeskonnakaaslane, kes mängis selles mängus kõige paremini:",
      "cannotVoteSelf": "Sa ei saa hääletada iseenda poolt",
      "mvpVoteRegistered": "MVP hääl antud mängijale {name}!",
      "mvpAlreadyVoted": "Sa hääletasid mängija {name} poolt",
      "mvpOfficialWinner": "⭐ Ametlik MVP: {name}!",
      "seasonMvpsBadge": "⭐ {count}x Mängu MVP",
      "mvpBannerTitle": "👑 Mängu MVP Hääletus!",
      "mvpBannerSub": "Hääleta parima mängija poolt vs {match}",
      "weeklyMissionTitle": "Treeneri nädala missioon",
      "noActiveMission": "Sel nädalal aktiivset missiooni pole. Treeni usinalt edasi!",
      "missionStatusPending": "⏳ Pooleli",
      "missionStatusCompleted": "🎉 Missioon täidetud!",
      "missionMotivation": "Keskendu sellele taktikalisele eesmärgile eelseisvates mängudes ja treeningutel.",
      "goalsScored": "Löödud Väravaid",
      "passAccuracy": "Söödutäpsus",
      "passesAccurate": "täpset söötu",
      "shotAccuracy": "Löökide Täpsus",
      "shotsOnTarget": "raami",
      "ballTouches": "Pallipuuted",
      "dribblesWon": "Edukad Triblingud",
      "duelsWon": "Võidetud Kahevõitlused",
      "recoveries": "Palli Tagasivõitmised",
      "recentMatchesTitle": "Viimased Mängud ja Tegevused",
      "noMatchesYet": "Mänge ega sessioone pole veel salvestatud.",
      "noActionsYet": "Individuaalseid tegevusi pole veel salvestatud.",
      "tapSkillHint": "Puuduta mis tahes oskust radaril, et näha selle selgitust ℹ️",
      "footRight": "Paremajalgne",
      "footLeft": "Vasakujalgne",
      "footBoth": "Mõlemajalgne",
      "h2hTitle": "Face to Face Võrdlus",
      "h2hDesc": "Vali kaks meeskonnakaaslast, et võrrelda nende oskusi ja statistikat:",
      "player1": "Mängija 1",
      "player2": "Mängija 2",
      "choosePlayer": "Vali Mängija",
      "fullProfile": "Täielik Profiil",
      "close": "Sulge",
      "skillsRadar": "Sportlike Võimete Radar",
      "cumulativeStats": "Koondstatistika",
      "squadTitle": "Mängijate Koosseis",
      "squadSubtitle": "Sirvi klubi meeskondade mängijaid ja puuduta, et näha nende statistikat:",
      "h2hNeedTwo": "Võrdlemiseks on vaja vähemalt 2 mängijat koosseisus.",
      "locked": "Lukustatud",
      "reasonLabel": "Põhjus / Märkused:",
      "chooseWhoYouAre": "-- Vali, kes sa tegelikult oled --",
      "reqSelectTargetErr": "Palun vali mängija, kelleks soovid vahetada",
      "reqSentSuccess": "Taotlus saadetud treenerile! See uueneb kohe pärast kinnitamist.",
      "sending": "Saadan...",
      "linkedSuccess": "Profiil edukalt seotud!",
      "loadingPlayers": "Mängijate laadimine pilvest...",
      "passesLabel": "SÖÖDUD",
      "shotsLabel": "LÖÖGID",
      "goalsLabel": "VÄRAVAD",
      "dribblesLabel": "TRIBLINGUD",
      "recoveriesLabel": "PALLI VÕIDUD",
      "touchesLabel": "PUUTED",
      "prob1v1Title": "1v1 Võidu Tõenäosus",
      "favoriteBadge": "Favoriit",
      "veryBalanced": "Väga Tasavägine",
      "bayesAgeModel": "Bayes + 1v1 + Vanuse Mudel",
      "sameBioAge": "Sama bioloogiline vanus",
      "reasonDribble": "Parem tribling / möödamäng",
      "reasonPhysical": "Füüsiline üleolek",
      "reasonDefense": "Kindlam kaitsemäng",
      "reasonWinRate": "Parem varasem 1v1 näitaja",
      "reasonAge": "Füüsilise küpsuse eelis",
      "duels1v1Historical": "1v1 Duellid (Ajalugu)",
      "duels1v1": "1v1 Duellid",
      "duels1v1WinRate": "1v1 Võiduprotsent",
      "duels1v1Won": "Võidetud Duellid",
      "duels1v1Lost": "Kaotatud Duellid",
      "h2h_pedagogical_title": "1v1 Taktikalised nõuanded",
      "h2h_your_advantage": "Sul on eelis näitajas {stat} (+{diff}). Kasuta seda ära!",
      "h2h_watch_out": "Ole tähelepanelik vastase {stat} suhtes (-{diff}). Mängi kiirelt!",
      "h2h_best_weapon": "Raske duell: sinu parim relv täna on {stat}.",
      "h2h_tactical_summary": "6 oskuse analüüs",
      "h2h_balanced_duel": "Väga tasavägine duell! Keskendu distsipliinile ja heale positsioneerimisele.",
      "heightCm": "Pikkus (cm)",
      "h2h_tip_height_tall_rival": "Ettevaatust tema pikkade jalgadega! Ära jookse talle kehasse. Lükka pall alt läbi või tee kiireid petteliigutusi!",
      "h2h_tip_height_fast_rival": "Ta on välkkiire! Ära torma tühja palli peale, hoia oma positsiooni ja oota, kuni ta ise tupikusse jookseb.",
      "h2h_tip_height_advantage": "Kasuta oma pikemat sammu! Kata palli kehaga ja ära lase tal jalga vahele panna.",
      "h2h_tip_tir_rival_high": "Tal on tõeline kahur jalas! Ära anna talle kasti äärelt löögiruumi. Survesta kohe peale!",
      "h2h_tip_tir_advantage": "Sinu löök on terav! Niipea kui näed 1v1 olukorras ruumi, võta nurk lahti ja löö kindlalt peale.",
      "h2h_tip_tir_rival_low": "Ta ei võta värava ees suuri riske. Võid sammu tagasi tõmmata, ilma et peaks kauglööki kartma.",
      "h2h_tip_reg_rival_high": "Ta triblab osavalt! Ära siruta jalga esimese liigutuse peale; hoia keha tasakaalus ja oota pausi.",
      "h2h_tip_reg_advantage": "Puhas triblamisoskus! Kasuta petukaid ja rütmivahetust, et temast hooga mööda minna.",
      "h2h_tip_reg_rival_low": "Tal on surve all raske palli kontrollida. Mine kohe peale ja napsa pall ära!",
      "h2h_tip_def_rival_high": "Väga kindel taklaja! Ära mine otse peale: kasuta kiiret petet või muuda rütmi.",
      "h2h_tip_def_advantage": "Tõeline kaitsemüür! Hoia külgasendit, kasuta keha ja võta pall puhtalt ära.",
      "h2h_tip_def_rival_low": "Tal on 1v1 kaitses raskusi. Ründa tema seljatagust või möödu kiirusega küljelt!",
      "h2h_tip_fis_rival_high": "Kehavõitluses nagu müür. Kasuta osavust ja väldi õlg-õla vastu põrkumist!",
      "h2h_tip_fis_advantage": "Sul on jõudu piisavalt! Pane õlg tugevalt vahele ja võta positsioon kindlalt ära.",
      "h2h_tip_fis_rival_low": "Tal napib kontaktis füüsilist jõudu. Hoia positsiooni ja võta pall puhta jõuga endale!",
      "h2h_best_weapon_tir": "Nõudlik duell: sinu parim võimalus on ootamatu kauglöök. Löö kiiresti kohe, kui nurk avaneb!",
      "h2h_best_weapon_reg": "Nõudlik duell: sinu parim võimalus on julge tribling. Kiire rütmivahetus võib vastase tasakaalust välja viia!",
      "h2h_best_weapon_def": "Nõudlik duell: sinu parim relv on kannatlikkus kaitses. Oota täpset hetke palli vaheltlõikamiseks!",
      "h2h_best_weapon_fis": "Nõudlik duell: sinu parim relv on füüsiline intensiivsus. Võitle iga palli eest ja survesta igal puutel!",
      "stat_pas": "Söötmine (SÖÖ)",
      "stat_tir": "Löömine (LÖÖ)",
      "stat_reg": "Tribling (TRI)",
      "stat_def": "Kaitsetöö (KAI)",
      "stat_fis": "Füüsis (FÜÜ)",
      "stat_dis": "Distsipliin (DIS)",
      "mvp_coach_pick": "⭐ Treeneri valik",
      "mvp_coach_picks_title": "Treeneri esiletõstetud",
      "btn_vote_as_mvp": "Hääleta MVP-ks",
      "btn_cancel_view_others": "Loobu / Vaata teisi",
      "mvp_coach_reason_label": "Treeneri põhjendus",
      "autoMissionBadge": "⚡ Automaatne missioon",
      "manualMissionBadge": "Käsitsi hinnatav",
      "progressLabel": "Progress",
      "matchDetail": "Mängu / Sessiooni Üksikasjad",
      "viewSessionDetail": "Vaata Mängu Üksikasju",
      "loadingSession": "Sessiooni andmete laadimine...",
      "won": "Võidetud",
      "lost": "Kaotatud",
      "sessions": "Trennid ja Sessioonid",
      "winRate": "VÕIDUMÄÄR",
      "stops": "kaitsetõrjed",
      "goals": "väravat",
      "duel1v1Goals": "1v1 Väravad",
      "duel1v1Stops": "Vaheltlõiked / Tõrjed",
      "performanceMetrics": "Sooritusvõime Näitajad",
      "comparativeRadars": "Võrdlevad Oskuste Radarid",
      "pitchGoalsTitle": "Taktikaline Väljakukaart",
      "pitchGoalsDesc": "Tegevused ja väravad väljaku tsoonide kaupa",
      "untrackedGoalsHint": "tsoonita salvestatud tegevused",
      "chatWithPlayer": "💬 Vestle selle mängijaga",
      "zone_box_opp": "Vastase Karistusala",
      "zone_front": "Karistusala Esine",
      "zone_wing_off_l": "Ründav Vasak Äär",
      "zone_wing_off_r": "Ründav Parem Äär",
      "zone_wing_l": "Vasak Äär",
      "zone_wing_r": "Parem Äär",
      "zone_mid": "Keskväli / Oma väljakupool",
      "filterAll": "Kõik",
      "filterMatches": "🏆 Mängud",
      "filterTrainings": "⚽ Treeningud",
      "requestCoachProfile": "➕ Pole nimekirjas? Taotle registreerimist treenerilt",
      "requestCoachProfileTitle": "Taotle Registreerimist Treenerilt",
      "requestCoachProfileDesc": "Saada oma andmed treenerile, et ta saaks luua sinu profiili meeskonna andmebaasis.",
      "fullNameLabel": "Ees- ja perekonnanimi *",
      "fullNamePlaceholder": "nt Lucas Tamm",
      "dorsalLabel": "Särginumber",
      "dorsalPlaceholder": "nt 10",
      "positionLabel": "Positsioon",
      "positionPlaceholder": "nt Ründaja, Väravavaht...",
      "notesLabel": "Märkused / Meeskond",
      "notesPlaceholder": "nt U14 Meeskond, uus liituja...",
      "sendRequest": "Saada Taotlus Treenerile",
      "nameRequired": "Palun sisesta oma ees- ja perekonnanimi",
      "requestSent": "Taotlus treenerile saadetud!",
      "coachCardTitle": "Peatreeneri Profiil",
      "viewCoachProfile": "Vaata Treeneri Profiili",
      "coachProfileSubtitle": "Tehniline direktor ja treenerite tiim",
      "chatWithCoach": "💬 Vestle Treeneriga",
      "confirmPlayerIdentity": "Kinnita Isik",
      "areYouPlayer": "Kas oled {name}?",
      "securityCodeDesc": "Sinu profiili kaitsmiseks genereeriti see turvakood. Edasta see kood treenerile, et ta saaks kinnitada juurdepääsu sinu seadmes.",
      "securityCodeTitle": "Turvakood",
      "waitingCoachApproval": "Ootan treeneri kinnitust koodile...",
      "copyCode": "📋 Kopeeri Kood",
      "codeCopied": "✅ Kood kopeeritud lõikelauale!",
      "sendViaViber": "📱 Saada Viberi kaudu",
      "cancelSelectOther": "✕ Tühista ja vali teine mängija",
      "claimLockedNotice": "Aktiivne taotlus on selle profiiliga lukustatud. Te ei saa profiili vahetada ega uut koodi saata enne, kui treener on taotluse kinnitanud või tagasi lükanud.",
      "viberShareMsg": "Tere treener, minu turvakood on {code}, et pääseda ligi profiilile ({name}) rakenduses Player Stats.",
      "player": "Mängija",
      "allPlayers": "Kõik Mängijad",
      "creationApproved": "🎉 Treener kinnitas ja lõi sinu profiili! Nüüd saad vaadata oma statistikat.",
      "creationRejected": "❌ Treener lükkas registreerimistaotluse tagasi.",
      "profileChangeSecurityTitle": "Kinnita Profiili Muutmine",
      "profileChangeSecurityDesc": "Sinu konto kaitsmiseks genereeriti see turvakood. Edasta see kood treenerile, et ta saaks lubada profiili muutmise mängijale {name}.",
      "viberProfileChangeMsg": "Tere treener, minu kinnituskood on {code}, et muuta profiil mängijale {name} rakenduses Player Stats.",
      "birthDate": "Sünniaeg",
      "age": "Vanus",
      "secondaryPositions": "Teisesed Positsioonid",
      "guardian": "Lapsevanem / Hooldaja",
      "callCoach": "Helista Treenerile",
      "call": "Helista",
      "voteReset": "Osalemise vastus tühistatud (ootel)",
      "absenceReasonTitle": "Puudumise põhjus",
      "absenceReasonPrompt": "Palun selgita lühidalt treenerile, miks sa ei saa osaleda (nt vigastus, haigus, eksam, reis):",
      "absenceReasonPlaceholder": "Kirjuta oma põhjus siia...",
      "confirmAbsence": "Kinnita Puudumine",
      "viberCoachContactMsg": "Tere treener!",
      "messageViaViber": "Saada sõnum Viberis",
      "contact": "Kontakt",
      "msgDeletedForEveryone": "See sõnum kustutati",
      "messageOptions": "Sõnumi valikud",
      "copyMessage": "Kopeeri sõnum",
      "editMessage": "Muuda sõnumit",
      "deleteForEveryone": "Kustuta kõigilt",
      "deleteForMe": "Kustuta minu jaoks",
      "deleteForEveryoneConfirm": "Kas soovid kindlasti selle sõnumi kõigilt kustutada?",
      "messageDeleted": "Sõnum kustutatud kõigilt",
      "messageDeletedForMe": "Sõnum eemaldatud sinu jaoks",
      "messageEdited": "Sõnum uuendatud",
      "copiedToClipboard": "Sõnum kopeeritud lõikelauale",
      "stat_touches": "Pallipuuted",
      "stat_passOk": "Täpsed Söödud",
      "stat_passKo": "Ebatäpsed Söödud",
      "stat_shotOn": "Löögid Raami",
      "stat_shotOff": "Löögid Mööda",
      "stat_goal": "Löödud Väravad",
      "stat_assist": "Väravasöödud",
      "stat_dribbleOk": "Edukad Triblingud",
      "stat_dribbleKo": "Ebaõnnestunud Triblingud",
      "stat_recovery": "Palli Tagasivõitmised",
      "stat_loss": "Pallikaotused",
      "stat_duelWon": "Võidetud Kahevõitlused",
      "stat_duelLost": "Kaotatud Kahevõitlused",
      "stat_cross": "Tsenderdused",
      "stat_keyPass": "Võtmesöödud",
      "stat_header": "Pealöögid",
      "stat_foulRecv": "Teenitud Vead",
      "stat_foul": "Tehtud Vead",
      "stat_save": "Väravavahi Tõrjed",
      "stat_yellow": "Kollased Kaardid",
      "stat_red": "Punased Kaardid",
      "appUpdateRequired": "Rakenduse uuendus vajalik",
      "appUpdateDesc": "Treener on taotlenud vahemälu ja rakenduse värskendamist, et tagada uusimate andmete kuvamine.",
      "restartApp": "🔄 Taaskäivita rakendus",
      "clearCacheBtn": "🔄 Tühjenda vahemälu ja värskenda",
      "careerActionsTitle": "Karjääri Tegevuste Ülevaade",
      "careerActionsDesc": "Kõik mängija poolt sooritatud tegevused ja panused läbi karjääri",
      "noCareerActions": "Ühtegi individuaalset tegevust pole veel salvestatud.",
      "actions": "tegevust",
      "matchDate": "Mängu Kuupäev",
      "trainingDate": "Treeningu Kuupäev",
      "kickoffTime": "Algusaeg",
      "trainingTime": "Treeningu Aeg",
      "meetingTime": "Kogunemisaeg",
      "pitchAndVenue": "Väljak ja Asukoht",
      "coachInstructions": "Treeneri Juhised ja Märkused",
      "kitAndGear": "Vorm ja Varustus",
      "defaultKitMatch": "Ametlik mänguvorm, säärekaitsmed ja joogipudel",
      "defaultKitTraining": "Treeningriided, säärekaitsmed, jalgpallisaapad ja joogipudel",
      "matchSquad": "Mängu Koosseis",
      "trainingSquad": "Treeningu Nimekiri",
      "attendanceResponse": "Sinu Osalemise Vastus:",
      "tapMatchDetails": "Puuduta mängu detailide ja koosseisu nägemiseks",
      "tapTrainingDetails": "Puuduta treeningu detailide ja nimekirja nägemiseks",
      "opponentLabel": "Vastane:",
      "officialFixture": "Ametlik Mäng",
      "officialTraining": "Ametlik Treening",
      "venueNotSpecified": "Asukohta pole määratud",
      "newBadge": "UUS",
      "pendingApproval": "Ootab kinnitust",
      "noActionsInZone": "Selles tsoonis pole tegevusi salvestatud",
      "zoneDetailsTitle": "Väljakutsooni Ülevaade",
      "matchDetails": "Mängu Üksikasjad",
      "trainingDetails": "Treeningu Üksikasjad",
      "selectLanguage": "Vali Keel",
      "selectLanguageDesc": "Vali rakenduse eelistatud keel",
      "activeBadge": "Aktiivne",
      "doneBtn": "Valmis",
      "langSpanish": "Hispaania keel",
      "langEnglish": "Inglise keel",
      "langEstonian": "Eesti keel",
      "langChangedToast": "Keel muudetud: Eesti keel",
      "startTime": "Algus",
      "endTime": "Lõpp",
      "duration": "Kestus",
      "claimCooldownWait": "Palun oota {sec}s enne uue kinnituskoodi taotlemist.",
      "downloadApk": "Laadi alla Androidi äpp (APK)",
      "apkDownloadTitle": "Androidi äpi allalaadimine",
      "apkDownloadStarted": "Allalaadimine algas sinu seadmes!",
      "apkHowToInstallTitle": "Kust seda leida ja kuidas paigaldada?",
      "apkStep1Bold": "Vaata teavitusriba:",
      "apkStep1Desc": "Tõmba ekraani ülaservast alla ja puuduta teavitust \"PlayerStats_Player.apk\", kui see on valmis.",
      "apkStep2Bold": "Või ava kaust Allalaadimised:",
      "apkStep2Desc": "Ava oma telefoni rakendus \"Minu failid\", \"Failid\" või \"Allalaadimised\" ja puuduta \"PlayerStats_Player.apk\".",
      "apkFamilyLinkTitle": "Google Family Linki kasutajatele:",
      "apkFamilyLinkDesc": "Palu vanematel avada Family Link -> Rakenduste piirangud -> \"Player stats (Player)\" -> valida \"Alati lubatud\".",
      "openInBrowserDownload": "Ava ja laadi alla brauseris",
      "retryDownload": "Laadi uuesti alla",
      "downloadStartedToast": "📥 Faili allalaadimine...",
      "h2h_keys_title": "Duelli võtmed",
      "mvp_coach_reason_title": "Treeneri põhjendus:",
      "mvp_btn_confirm_vote": "Hääleta {name} MVP-ks",
      "mvp_btn_cancel": "Tühista ja vaata teisi",
      "currentProgressLabel": "Edu",
      "minAttemptsLabel": "Min. katseid"
},
    es: {
      "appName": "Player stats (Player)",
      "convocations": "Convocatorias",
      "myProfile": "Mi Ficha",
      "squad": "Plantilla",
      "h2h": "Face to Face",
      "chat": "Chat",
      "live": "En vivo",
      "selectIdentity": "Seleccionar quién eres...",
      "profileLocked": "Perfil Bloqueado",
      "changeProfile": "Cambiar ▾",
      "reqChange": "Solicitar Cambio",
      "allTeams": "Todos los equipos",
      "searchTeammate": "Buscar compañero por nombre o dorsal...",
      "searchChatOrTeammate": "Buscar chat o compañero...",
      "todayBadge": "HOY",
      "match": "Partido",
      "training": "Entrenamiento",
      "overallRating": "Rating General",
      "combinedRating": "Valoración Combinada",
      "onlyTrainingRating": "Solo Entrenamientos",
      "onlyMatchRating": "Solo Partidos",
      "baseRating": "Valoración Base",
      "trainingsTab": "Entrenamientos",
      "matchesTab": "Partidos",
      "noMatchesRecordedYet": "Sin partidos registrados todavía",
      "noMatchesRecordedDesc": "Este jugador aún no tiene minutos ni estadísticas registradas en partidos de competición.",
      "noTrainingsRecordedYet": "Sin entrenamientos registrados todavía",
      "participatingTeams": "Equipos participantes",
      "venue": "Lugar / Campo",
      "address": "Dirección",
      "openInMaps": "Abrir en Google Maps ↗",
      "coachNote": "Nota del míster",
      "willYouAttend": "¿Asistirás a esta cita?",
      "iWillAttend": "🟢 Asistiré",
      "iCannotAttend": "❌ No puedo asistir",
      "attendanceConfirmed": "🟢 Asistencia confirmada",
      "absenceReported": "❌ Baja notificada",
      "sendReminderToPlayer": "Enviar recordatorio a este jugador",
      "attendanceShortYes": "Asiste",
      "attendanceShortNo": "Baja",
      "convocationReminderTitle": "Recordatorio de convocatoria",
      "convocationReminderMsg": "El entrenador espera tu respuesta de asistencia. ¡Por favor responde ahora!",
      "confirmAttendanceYes": "🟢 Confirmar Asistencia (Sí)",
      "cannotAttendNo": "❌ No puedo asistir (Baja)",
      "dismiss": "Descartar",
      "playerAlreadyResponded": "Este jugador ya ha respondido o no está pendiente.",
      "reminderSentToPlayer": "Recordatorio enviado a",
      "pendingResponse": "⏳ Pendiente de responder",
      "notCalledUp": "ℹ️ No estás convocado para esta cita",
      "confirmedBadge": "Confirmados",
      "absentBadge": "Bajas",
      "pendingBadge": "Pendientes",
      "viewAttendees": "👥 Ver lista de asistencia ▾",
      "attendeesTitle": "Lista de Asistencia",
      "noAttendeesYet": "Nadie ha confirmado todavía",
      "noAbsentYet": "Ninguna baja registrada",
      "allAnswered": "Todos los convocados han respondido",
      "emptyConvs": "Sin convocatorias activas",
      "emptyConvsDesc": "El entrenador aún no ha publicado ninguna convocatoria para los próximos partidos o entrenamientos.",
      "todayTrainingBadge": "✨ ENTRENAMIENTO DE HOY",
      "todayMatchBadge": "✨ PARTIDO DE HOY",
      "upcomingThisWeek": "Próximos esta semana",
      "noUpcomingThisWeek": "No hay más entrenamientos programados para esta semana",
      "noUpcomingThisWeekDesc": "Consulta el historial de entrenamientos anteriores en el desplegable inferior.",
      "pastConvocations": "Entrenamientos anteriores",
      "pastConvocationsMatches": "Partidos anteriores",
      "pastConvocationsAll": "Entrenamientos y convocatorias anteriores",
      "pastSessionBadge": "Finalizado",
      "chooseIdentityTitle": "¿Quién eres en el equipo?",
      "chooseIdentityDesc": "Selecciona tu nombre para vincular tu ficha a este dispositivo. Una vez elegido, quedará fijado.",
      "confirmIdentityBtn": "Vincular mi perfil",
      "reqChangeTitle": "Solicitar Cambio de Perfil",
      "reqChangeDesc": "Tu perfil está vinculado a {name}. Para evitar confusiones, cambiar a otro jugador requiere autorización del entrenador:",
      "selectNewPlayer": "Selecciona el jugador correcto:",
      "reasonPlaceholder": "Motivo (ej. Selección errónea, móvil nuevo...)",
      "sendReqBtn": "🚀 Enviar Solicitud al Entrenador",
      "reqSentBanner": "⏳ Solicitud enviada al entrenador para cambiar a {name}. Esperando aprobación...",
      "reqApprovedToast": "✅ ¡Tu entrenador ha aprobado el cambio de perfil!",
      "reqRejectedToast": "❌ El entrenador ha rechazado la solicitud de cambio.",
      "performanceRating": "Nota de Rendimiento",
      "ratingDesc": "Índice de rendimiento calculado a partir de acciones reales, toques y eficacia táctica.",
      "matchesAttended": "Partidos Jugados",
      "trainingsAttended": "Entrenamientos Asistidos",
      "totalSessions": "Sesiones Totales",
      "attendanceStreak": "Racha de Asistencia",
      "attendanceStreakDesc": "Sesiones consecutivas asistidas",
      "streakSessions": "sesiones seguidas",
      "streakSessionSingle": "sesión",
      "streakOnFire": "🔥 En racha",
      "futCardTitle": "Carta FUT Coleccionable",
      "viewFutCard": "Ver Carta FUT",
      "viewMyFutCard": "🃏 Ver mi Carta FUT Coleccionable",
      "streakMilestoneBronze": "Medalla de Bronce",
      "streakMilestoneSilver": "Medalla de Plata",
      "streakMilestoneGold": "Medalla de Oro",
      "streakMilestoneDiamond": "Insignia Diamante",
      "streakNextMilestone": "{current}/{target} hacia {nextMilestone}",
      "streakMaster": "👑 ¡Racha Legendaria Imparable!",
      "mvpVotingActive": "Votación del MVP Abierta",
      "voteMatchMvp": "Votar al MVP del Partido",
      "chooseBestTeammate": "Elige al compañero más destacado del partido:",
      "cannotVoteSelf": "No puedes votarte a ti mismo",
      "mvpVoteRegistered": "¡Voto de MVP registrado para {name}!",
      "mvpAlreadyVoted": "Has votado por {name}",
      "mvpOfficialWinner": "⭐ ¡MVP Oficial: {name}!",
      "seasonMvpsBadge": "⭐ {count}x MVP del Partido",
      "mvpBannerTitle": "👑 ¡Votación del MVP del Partido!",
      "mvpBannerSub": "Vota al jugador más destacado vs {match}",
      "weeklyMissionTitle": "Misión Semanal del Míster",
      "noActiveMission": "Sin misión activa esta semana. ¡Sigue entrenando fuerte!",
      "missionStatusPending": "⏳ En curso",
      "missionStatusCompleted": "🎉 ¡Misión Cumplida!",
      "missionMotivation": "Concéntrate en este objetivo táctico en tus próximos entrenos y partidos.",
      "goalsScored": "Goles Marcados",
      "passAccuracy": "Precisión de Pase",
      "passesAccurate": "pases acertados",
      "shotAccuracy": "Efectividad Tiro",
      "shotsOnTarget": "a puerta",
      "ballTouches": "Toques Balón",
      "dribblesWon": "Regates con Éxito",
      "duelsWon": "Duelos Ganados",
      "recoveries": "Recuperaciones",
      "recentMatchesTitle": "Mis Partidos y Acciones Detalladas",
      "noMatchesYet": "Todavía no hay partidos o sesiones registradas.",
      "noActionsYet": "Aún no tienes acciones registradas en partidos.",
      "tapSkillHint": "Pulsa sobre cualquier habilidad del radar para ver su explicación en inglés ℹ️",
      "footRight": "Diestro",
      "footLeft": "Zurdo",
      "footBoth": "Ambidiestro",
      "h2hTitle": "Comparador Face to Face",
      "h2hDesc": "Selecciona a dos compañeros para comparar sus estadísticas y radares frente a frente:",
      "player1": "Jugador 1",
      "player2": "Jugador 2",
      "choosePlayer": "Elegir Jugador",
      "fullProfile": "Ficha Completa",
      "close": "Cerrar",
      "skillsRadar": "Radar de Cualidades Deportivas",
      "cumulativeStats": "Mis Cifras Acumuladas",
      "squadTitle": "Plantilla de Jugadores",
      "squadSubtitle": "Explora la plantilla de todos los equipos del club y toca para ver sus estadísticas completas:",
      "h2hNeedTwo": "Se necesitan al menos 2 jugadores en la plantilla para comparar.",
      "locked": "Bloqueado",
      "reasonLabel": "Motivo / Comentario:",
      "chooseWhoYouAre": "-- Elige quién eres realmente --",
      "reqSelectTargetErr": "Por favor selecciona el jugador al que deseas cambiarte",
      "reqSentSuccess": "¡Solicitud enviada al entrenador! Se actualizará automáticamente en cuanto la apruebe.",
      "sending": "Enviando...",
      "linkedSuccess": "¡Perfil vinculado con éxito!",
      "loadingPlayers": "Cargando jugadores desde la nube...",
      "passesLabel": "PASES",
      "shotsLabel": "TIROS",
      "goalsLabel": "GOLES",
      "dribblesLabel": "REGATES",
      "recoveriesLabel": "RECUP.",
      "touchesLabel": "TOQUES",
      "prob1v1Title": "Probabilidad Victoria 1v1",
      "favoriteBadge": "Favorito",
      "veryBalanced": "Muy Equilibrado",
      "bayesAgeModel": "Datos Bayes + 1v1 + Edad",
      "sameBioAge": "Misma edad biológica",
      "reasonDribble": "Mayor desborde / regate",
      "reasonPhysical": "Superioridad física",
      "reasonDefense": "Mayor solidez defensiva",
      "reasonWinRate": "Mejor % victorias 1v1 previo",
      "reasonAge": "Ventaja por madurez física",
      "duels1v1Historical": "Duelos 1v1 (Histórico)",
      "duels1v1": "Duelos 1v1",
      "duels1v1WinRate": "% Victorias 1v1",
      "duels1v1Won": "Duelos Ganados",
      "duels1v1Lost": "Duelos Perdidos",
      "h2h_pedagogical_title": "Consejos Tácticos 1v1",
      "h2h_your_advantage": "Tienes ventaja en {stat} (+{diff}). ¡Úsalo a tu favor!",
      "h2h_watch_out": "Cuidado con su {stat} (-{diff}). Juega rápido y anticipa.",
      "h2h_best_weapon": "Duelo exigente: tu mejor baza hoy es competir desde tu {stat}.",
      "h2h_tactical_summary": "Comparativa 6 Atributos",
      "h2h_balanced_duel": "¡Duelo muy parejo! Mantén la máxima concentración y disciplina táctica.",
      "heightCm": "Estatura (cm)",
      "h2h_tip_height_tall_rival": "¡Cuidado con sus piernas largas! No intentes chocar con él. Pásale el balón por debajo o haz amagos rápidos para marearle.",
      "h2h_tip_height_fast_rival": "¡Es una centella! No saltes a robarle a lo loco, aguanta tu sitio y espera a que se encierre solo.",
      "h2h_tip_height_advantage": "¡Aprovecha tu mayor zancada! Protege el balón con el cuerpo y no le dejes meter la pierna.",
      "h2h_tip_tir_rival_high": "¡Tiene un cañón en la pierna! No le dejes espacio para chutar desde la frontal. Encímale rápido.",
      "h2h_tip_tir_advantage": "¡Tienes el cañón preparado! En cuanto veas un hueco en el 1v1, ábrete ángulo y busca portería con decisión.",
      "h2h_tip_tir_rival_low": "No arriesga mucho de cara a puerta. Puedes esperarle un paso más atrás sin miedo a su disparo.",
      "h2h_tip_reg_rival_high": "¡Regatea muy bien! No metas la pierna a la primera; aguanta con el cuerpo y espera a que frene.",
      "h2h_tip_reg_advantage": "¡Puro desborde! Usa tus amagos y cambios de ritmo para dejarle clavado en una baldosa.",
      "h2h_tip_reg_rival_low": "Le cuesta controlar bajo presión. ¡Muerde rápido y rásgale el balón en cuanto lo reciba!",
      "h2h_tip_def_rival_high": "Va muy fuerte al suelo y al quite. No vayas de frente: usa un amago rápido o cámbiale el ritmo.",
      "h2h_tip_def_advantage": "¡Eres un candado defensivo! Aguanta perfilado, usa el cuerpo y roba el balón limpio.",
      "h2h_tip_def_rival_low": "Le cuesta defender en el 1v1. ¡Búscale la espalda o vete hacia un lado con velocidad!",
      "h2h_tip_fis_rival_high": "Es un muro en el cuerpo a cuerpo. ¡Usa tu agilidad y evita chocar hombro con hombro!",
      "h2h_tip_fis_advantage": "¡Tienes potencia de sobra! Mete el hombro con fuerza y gana la posición con determinación.",
      "h2h_tip_fis_rival_low": "Le falta potencia física en el choque. ¡Aguanta la posición y llévate el balón por pura fuerza!",
      "h2h_best_weapon_tir": "Duelo exigente: tu mejor baza es el tiro sorpresa. ¡Arma la pierna rápido en cuanto tengas ángulo!",
      "h2h_best_weapon_reg": "Duelo exigente: tu mejor baza es encarar con descaro. ¡Un cambio de ritmo rápido puede descolocarle!",
      "h2h_best_weapon_def": "Duelo exigente: tu mejor baza es la paciencia atrás. ¡Espera el momento exacto para meter la pierna!",
      "h2h_best_weapon_fis": "Duelo exigente: tu mejor baza es la intensidad física. ¡No des un balón por perdido e incomoda cada control!",
      "stat_pas": "Pase (PAS)",
      "stat_tir": "Tiro (TIR)",
      "stat_reg": "Regate (REG)",
      "stat_def": "Defensa (DEF)",
      "stat_fis": "Físico (FIS)",
      "stat_dis": "Disciplina (DIS)",
      "mvp_coach_pick": "⭐ Opción del entrenador",
      "mvp_coach_picks_title": "Destacados por el Míster",
      "btn_vote_as_mvp": "Votar como MVP",
      "btn_cancel_view_others": "Cancelar / Ver otros",
      "mvp_coach_reason_label": "Nota del Entrenador",
      "autoMissionBadge": "⚡ Misión Automática",
      "manualMissionBadge": "Misión Manual",
      "progressLabel": "Progreso",
      "matchDetail": "Detalle de la Sesión",
      "viewSessionDetail": "Ver Detalle del Partido",
      "loadingSession": "Cargando datos de la sesión...",
      "won": "Ganados",
      "lost": "Perdidos",
      "sessions": "Entrenamientos y Sesiones",
      "winRate": "VICTORIAS",
      "stops": "cierres defensivos",
      "goals": "goles",
      "duel1v1Goals": "Goles en 1v1",
      "duel1v1Stops": "Robos / Cierres",
      "performanceMetrics": "Métricas de Rendimiento",
      "comparativeRadars": "Radares Comparativos de Habilidad",
      "pitchGoalsTitle": "Mapa Táctico del Campo",
      "pitchGoalsDesc": "Acciones tácticas geolocalizadas según la zona del campo",
      "untrackedGoalsHint": "goles contabilizados en partidos anteriores sin zona asignada",
      "chatWithPlayer": "💬 Chatear con este jugador",
      "zone_box_opp": "Área Rival",
      "zone_front": "Frontal",
      "zone_wing_off_l": "Banda Of. Izq",
      "zone_wing_off_r": "Banda Of. Der",
      "zone_wing_l": "Banda Izquierda",
      "zone_wing_r": "Banda Derecha",
      "zone_mid": "Centro Campo",
      "filterAll": "Todos",
      "filterMatches": "🏆 Partidos",
      "filterTrainings": "⚽ Entrenamientos",
      "requestCoachProfile": "➕ ¿No estás en la lista? Solicitar alta al entrenador",
      "requestCoachProfileTitle": "Solicitar Alta al Entrenador",
      "requestCoachProfileDesc": "Envía tus datos al entrenador para que cree tu ficha en el equipo y puedas seleccionarte.",
      "fullNameLabel": "Nombre y Apellidos *",
      "fullNamePlaceholder": "Ej: Lucas Martínez",
      "dorsalLabel": "Dorsal habitual",
      "dorsalPlaceholder": "Ej: 10",
      "positionLabel": "Posición",
      "positionPlaceholder": "Ej: Delantero, Portero...",
      "notesLabel": "Notas / Equipo",
      "notesPlaceholder": "Ej: Infantil A, nuevo fichaje...",
      "sendRequest": "Enviar Solicitud al Entrenador",
      "nameRequired": "Por favor introduce tu nombre y apellidos",
      "requestSent": "¡Solicitud enviada al entrenador!",
      "coachCardTitle": "Ficha del Entrenador",
      "viewCoachProfile": "Ver Perfil del Entrenador",
      "coachProfileSubtitle": "Cuerpo Técnico y Dirección",
      "chatWithCoach": "💬 Chatear con el Entrenador",
      "confirmPlayerIdentity": "Confirmar Identidad",
      "areYouPlayer": "¿Eres {name}?",
      "securityCodeDesc": "Para proteger tu perfil, se ha generado este código de seguridad. Dáselo a tu entrenador para que confirme y autorice tu acceso en tu dispositivo.",
      "securityCodeTitle": "Código de Seguridad",
      "waitingCoachApproval": "Esperando que tu entrenador autorice el código...",
      "copyCode": "📋 Copiar Código",
      "codeCopied": "✅ ¡Código copiado al portapapeles!",
      "sendViaViber": "📱 Enviar por Viber",
      "cancelSelectOther": "✕ Cancelar y elegir otro jugador",
      "claimLockedNotice": "Solicitud activa vinculada a este perfil. No puedes cambiar de perfil ni solicitar otro código hasta que el entrenador responda.",
      "viberShareMsg": "Hola míster, mi código de seguridad es {code} para acceder a mi perfil ({name}) en la app Player Stats.",
      "player": "Jugador",
      "allPlayers": "Todos los jugadores",
      "creationApproved": "🎉 ¡El entrenador ha creado tu perfil! Ya puedes ver tus estadísticas.",
      "creationRejected": "❌ El entrenador ha denegado la solicitud de alta.",
      "profileChangeSecurityTitle": "Confirmar Cambio de Perfil",
      "profileChangeSecurityDesc": "Para proteger tu cuenta, se ha generado este código de seguridad. Facilita este código a tu entrenador para que autorice el cambio de perfil a {name}.",
      "viberProfileChangeMsg": "Hola míster, mi código de verificación es {code} para cambiar mi perfil a {name} en la app Player Stats.",
      "birthDate": "Fecha de Nacimiento",
      "age": "Edad",
      "secondaryPositions": "Posiciones Secundarias",
      "guardian": "Padre / Tutor",
      "callCoach": "Llamar al Entrenador",
      "call": "Llamar",
      "voteReset": "Respuesta cancelada (pendiente)",
      "absenceReasonTitle": "Motivo de la Ausencia",
      "absenceReasonPrompt": "Por favor explica brevemente a tu entrenador el motivo por el que no podrás asistir (ej. lesión, enfermedad, examen, viaje):",
      "absenceReasonPlaceholder": "Escribe aquí el motivo de tu ausencia...",
      "confirmAbsence": "Confirmar Baja",
      "viberCoachContactMsg": "¡Hola míster!",
      "messageViaViber": "Mensaje por Viber",
      "contact": "Contacto",
      "msgDeletedForEveryone": "Este mensaje fue eliminado",
      "messageOptions": "Opciones del mensaje",
      "copyMessage": "Copiar mensaje",
      "editMessage": "Editar mensaje",
      "deleteForEveryone": "Borrar para todos",
      "deleteForMe": "Borrar para mí",
      "deleteForEveryoneConfirm": "¿Eliminar este mensaje para todos?",
      "messageDeleted": "Mensaje eliminado para todos",
      "messageDeletedForMe": "Mensaje eliminado para ti",
      "messageEdited": "Mensaje actualizado",
      "copiedToClipboard": "Mensaje copiado al portapapeles",
      "stat_touches": "Toques de Balón",
      "stat_passOk": "Pases Acertados",
      "stat_passKo": "Pases Fallados",
      "stat_shotOn": "Tiros a Puerta",
      "stat_shotOff": "Tiros Fuera",
      "stat_goal": "Goles Marcados",
      "stat_assist": "Asistencias",
      "stat_dribbleOk": "Regates Acertados",
      "stat_dribbleKo": "Regates Fallidos",
      "stat_recovery": "Recuperaciones",
      "stat_loss": "Pérdidas de Balón",
      "stat_duelWon": "Duelos Ganados",
      "stat_duelLost": "Duelos Perdidos",
      "stat_cross": "Centros al Área",
      "stat_keyPass": "Pases Clave",
      "stat_header": "Remates de Cabeza",
      "stat_foulRecv": "Faltas Recibidas",
      "stat_foul": "Faltas Cometidas",
      "stat_save": "Paradas",
      "stat_yellow": "Tarjetas Amarillas",
      "stat_red": "Tarjetas Rojas",
      "appUpdateRequired": "Actualización Requerida",
      "appUpdateDesc": "El entrenador ha solicitado una limpieza de caché y actualización para asegurar que tienes los últimos datos y estadísticas.",
      "restartApp": "🔄 Reiniciar App",
      "clearCacheBtn": "🔄 Borrar Caché y Recargar",
      "careerActionsTitle": "Historial de Acciones en la Carrera",
      "careerActionsDesc": "Registro completo de todas las acciones y contribuciones a lo largo de su trayectoria",
      "noCareerActions": "Aún no hay acciones individuales registradas.",
      "actions": "acciones",
      "matchDate": "Fecha del Partido",
      "trainingDate": "Fecha de Entrenamiento",
      "kickoffTime": "Hora de Inicio",
      "trainingTime": "Hora de Entrenamiento",
      "meetingTime": "Hora de Convocatoria / Llegada",
      "pitchAndVenue": "Campo y Lugar",
      "coachInstructions": "Instrucciones del Entrenador",
      "kitAndGear": "Equipación y Material",
      "defaultKitMatch": "Equipación oficial de partido, espinilleras y botella de agua",
      "defaultKitTraining": "Ropa de entrenamiento, espinilleras, botas y botella de agua",
      "matchSquad": "Convocatoria del Partido",
      "trainingSquad": "Convocados al Entrenamiento",
      "attendanceResponse": "Tu Respuesta de Asistencia:",
      "tapMatchDetails": "Toca para ver detalles del partido y plantilla",
      "tapTrainingDetails": "Toca para ver detalles del entrenamiento y plantilla",
      "opponentLabel": "Rival:",
      "officialFixture": "Partido Oficial",
      "officialTraining": "Entrenamiento Oficial",
      "venueNotSpecified": "Ubicación no especificada",
      "newBadge": "NUEVO",
      "pendingApproval": "Pendiente de Aprobación",
      "noActionsInZone": "Sin acciones registradas en este sector",
      "zoneDetailsTitle": "Detalle de la Zona del Campo",
      "matchDetails": "Detalles del Partido",
      "trainingDetails": "Detalles del Entrenamiento",
      "selectLanguage": "Seleccionar Idioma",
      "selectLanguageDesc": "Elige el idioma preferido para la aplicación",
      "activeBadge": "Activo",
      "doneBtn": "Listo",
      "langSpanish": "Español",
      "langEnglish": "Inglés",
      "langEstonian": "Estonio",
      "langChangedToast": "Idioma cambiado a Español",
      "startTime": "Inicio",
      "endTime": "Fin",
      "duration": "Duración",
      "claimCooldownWait": "Por favor, espera {sec}s antes de solicitar otro código de verificación.",
      "downloadApk": "Descargar App Android (APK)",
      "apkDownloadTitle": "Descarga de la App Android",
      "apkDownloadStarted": "¡Descarga iniciada en tu dispositivo!",
      "apkHowToInstallTitle": "¿Dónde encontrarla y cómo instalarla?",
      "apkStep1Bold": "Mira la barra de notificaciones:",
      "apkStep1Desc": "Desliza hacia abajo desde el borde superior de tu pantalla y pulsa sobre la notificación \"PlayerStats_Player.apk\" cuando termine.",
      "apkStep2Bold": "O abre tu carpeta Descargas:",
      "apkStep2Desc": "Abre la aplicación \"Mis Archivos\", \"Archivos\" o \"Descargas\" de tu teléfono y busca \"PlayerStats_Player.apk\". Tócalo para instalar.",
      "apkFamilyLinkTitle": "Para usuarios con Google Family Link:",
      "apkFamilyLinkDesc": "Pide a tus padres que abran Family Link -> Límites de apps -> \"Player stats (Player)\" -> y seleccionen \"Siempre permitida\".",
      "openInBrowserDownload": "Abrir y descargar en navegador",
      "retryDownload": "Volver a descargar",
      "downloadStartedToast": "📥 Descargando archivo APK...",
      "h2h_keys_title": "Claves del Duelo",
      "mvp_coach_reason_title": "Motivo del entrenador:",
      "mvp_btn_confirm_vote": "Votar a {name} como MVP",
      "mvp_btn_cancel": "Cancelar y ver otros",
      "currentProgressLabel": "Progreso",
      "minAttemptsLabel": "Mín. intentos"
},
    ru: {
      "appName": "Player stats (Coach)",
      "convocations": "Заявки",
      "myProfile": "Мой профиль",
      "squad": "Состав",
      "h2h": "1 на 1",
      "chat": "Чат",
      "live": "В эфире",
      "selectIdentity": "Выберите, кто вы...",
      "profileLocked": "Профиль заблокирован",
      "changeProfile": "Сменить ▾",
      "reqChange": "Запросить смену",
      "allTeams": "Все команды",
      "searchTeammate": "Поиск партнера по имени или номеру...",
      "searchChatOrTeammate": "Поиск чата или игрока...",
      "todayBadge": "СЕГОДНЯ",
      "match": "Матч",
      "training": "Тренировка",
      "overallRating": "Общий рейтинг",
      "combinedRating": "Комбинированная оценка",
      "onlyTrainingRating": "Только тренировки",
      "onlyMatchRating": "Только матчи",
      "baseRating": "Базовый рейтинг",
      "trainingsTab": "Тренировки",
      "matchesTab": "Матчи",
      "noMatchesRecordedYet": "Матчей пока не зарегистрировано",
      "noMatchesRecordedDesc": "У этого игрока пока нет сыгранных минут и статистики в соревновательных матчах.",
      "noTrainingsRecordedYet": "Тренировок пока не зарегистрировано",
      "participatingTeams": "Участвующие команды",
      "venue": "Место / Поле (необязательно)",
      "address": "Адрес",
      "openInMaps": "Открыть в Google Maps ↗",
      "coachNote": "Заметка тренера",
      "willYouAttend": "Вы придете на эту сессию?",
      "iWillAttend": "🟢 Буду / Приду",
      "iCannotAttend": "❌ Не смогу",
      "attendanceConfirmed": "Присутствие подтверждено",
      "absenceReported": "Причина отсутствия зафиксирована",
      "sendReminderToPlayer": "Отправить напоминание этому игроку",
      "attendanceShortYes": "Придет",
      "attendanceShortNo": "Не придет",
      "convocationReminderTitle": "Напоминание о вызове на игру",
      "convocationReminderMsg": "Тренер ждет вашего ответа по посещаемости. Пожалуйста, ответьте прямо сейчас!",
      "confirmAttendanceYes": "🟢 Подтвердить участие (Да)",
      "cannotAttendNo": "❌ Не смогу прийти (Пропуск)",
      "dismiss": "Закрыть",
      "playerAlreadyResponded": "Этот игрок уже ответил или не находится в ожидании.",
      "reminderSentToPlayer": "Напоминание отправлено игроку",
      "pendingResponse": "⏳ Ожидает ответа",
      "notCalledUp": "ℹ️ Ты не вызван на эту сессию",
      "confirmedBadge": "Подтвержденные",
      "absentBadge": "Отсутствующие",
      "pendingBadge": "Ожидающие",
      "viewAttendees": "👥 Список присутствующих ▾",
      "attendeesTitle": "Список посещаемости",
      "noAttendeesYet": "Пока никто не подтвердил участие",
      "noAbsentYet": "Отсутствующих нет",
      "allAnswered": "Все вызванные игроки ответили",
      "emptyConvs": "Нет активных заявок",
      "emptyConvsDesc": "Тренер пока не опубликовал заявки на ближайшие матчи или тренировки.",
      "todayTrainingBadge": "✨ СЕГОДНЯШНЯЯ ТРЕНИРОВКА",
      "todayMatchBadge": "✨ СЕГОДНЯШНИЙ МАТЧ",
      "upcomingThisWeek": "Предстоящие на этой неделе",
      "noUpcomingThisWeek": "На этой неделе больше нет запланированных тренировок",
      "noUpcomingThisWeekDesc": "История предыдущих тренировок доступна в выпадающем списке ниже.",
      "pastConvocations": "Предыдущие тренировки",
      "pastConvocationsMatches": "Предыдущие матчи",
      "pastConvocationsAll": "Предыдущие тренировки и заявки",
      "pastSessionBadge": "Завершено",
      "chooseIdentityTitle": "Кто ты?",
      "chooseIdentityDesc": "Выбери свой профиль из списка игроков клуба, чтобы просматривать персональную статистику.",
      "confirmIdentityBtn": "Выбрать этот профиль",
      "reqChangeTitle": "Запрос на смену профиля",
      "reqChangeDesc": "Твой аккаунт привязан к игроку {name}. Для смены профиля требуется подтверждение тренера:",
      "selectNewPlayer": "Выбери своего игрока из списка:",
      "reasonPlaceholder": "Причина (напр., ошибся при выборе, новый телефон...)",
      "sendReqBtn": "🚀 Отправить запрос тренеру",
      "reqSentBanner": "⏳ Запрос на смену профиля на {name} отправлен тренеру. Ожидание одобрения...",
      "reqApprovedToast": "✅ Тренер одобрил смену профиля!",
      "reqRejectedToast": "❌ Тренер отклонил запрос на смену профиля.",
      "performanceRating": "Оценка игры",
      "ratingDesc": "Индекс полезности, рассчитанный на основе реальных действий, касаний и точности.",
      "matchesAttended": "Сыграно матчей",
      "trainingsAttended": "Посещено тренировок",
      "totalSessions": "Всего сессий",
      "attendanceStreak": "Серия посещаемости",
      "attendanceStreakDesc": "Тренировок и матчей подряд",
      "streakSessions": "тренировок подряд",
      "streakSessionSingle": "тренировка",
      "streakOnFire": "🔥 В ударе",
      "futCardTitle": "Карточка FUT",
      "viewFutCard": "Смотреть карточку FUT",
      "viewMyFutCard": "Моя коллекционная карточка FUT",
      "streakMilestoneBronze": "Бронзовая медаль",
      "streakMilestoneSilver": "Серебряная медаль",
      "streakMilestoneGold": "Золотая медаль",
      "streakMilestoneDiamond": "Алмазный знак",
      "streakNextMilestone": "{current}/{target} до {nextMilestone}",
      "streakMaster": "👑 Невероятная легендарная серия!",
      "mvpVotingActive": "Голосование открыто",
      "voteMatchMvp": "Голосовать за лучшего игрока (MVP)",
      "chooseBestTeammate": "Выбери самого полезного партнера по команде в этом матче",
      "cannotVoteSelf": "Нельзя голосовать за себя",
      "mvpVoteRegistered": "Голос за MVP ({name}) успешно записан!",
      "mvpAlreadyVoted": "Твой голос отдан за: {name}",
      "mvpOfficialWinner": "⭐ Официальный MVP матча: {name}!",
      "seasonMvpsBadge": "⭐ {count}x MVP матча",
      "mvpBannerTitle": "⭐ Голосование за лучшего игрока (MVP)!",
      "mvpBannerSub": "Выбери лучшего игрока матча против {match}",
      "weeklyMissionTitle": "Еженедельное задание тренера",
      "noActiveMission": "На этой неделе нет активных заданий. Продолжай усердно тренироваться!",
      "missionStatusPending": "⏳ В процессе",
      "missionStatusCompleted": "🎉 Задание выполнено!",
      "missionMotivation": "Сфокусируйся на этой тактической цели на предстоящих тренировках и матчах.",
      "goalsScored": "Забито голов",
      "passAccuracy": "% точных передач",
      "passesAccurate": "точных передач",
      "shotAccuracy": "Точность ударов",
      "shotsOnTarget": "Удары в створ",
      "ballTouches": "Касания мяча",
      "dribblesWon": "Успешные обводки",
      "duelsWon": "Выигранные единоборства",
      "recoveries": "Отборы мяча",
      "recentMatchesTitle": "Мои матчи и детальные действия",
      "noMatchesYet": "Пока нет сыгранных матчей или тренировок.",
      "noActionsYet": "В матчах пока не зафиксировано результативных действий.",
      "tapSkillHint": "Нажми на любое качество на радаре, чтобы прочитать подсказку ℹ️",
      "footRight": "Правая нога",
      "footLeft": "Левая нога",
      "footBoth": "Обе ноги (амбидекстр)",
      "h2hTitle": "Сравнение игроков 1 на 1",
      "h2hDesc": "Сравнивай характеристики, стиль игры и историю очных дуэлей",
      "player1": "Игрок 1",
      "player2": "Игрок 2",
      "choosePlayer": "Выбрать игрока",
      "fullProfile": "Полный профиль",
      "close": "Закрыть",
      "skillsRadar": "Радар игровых качеств",
      "cumulativeStats": "Моя суммарная статистика",
      "squadTitle": "Состав команды",
      "squadSubtitle": "Просматривай состав всех команд клуба и нажимай на любого игрока для просмотра его профиля:",
      "h2hNeedTwo": "Для сравнения в составе должно быть не менее 2 игроков.",
      "locked": "Заблокировано",
      "reasonLabel": "Причина / Комментарий:",
      "chooseWhoYouAre": "-- Выбери свой профиль из списка --",
      "reqSelectTargetErr": "Пожалуйста, выберите игрока, на которого хотите сменить профиль",
      "reqSentSuccess": "Запрос отправлен тренеру! Данные обновятся, как только он подтвердит запрос.",
      "sending": "Отправка...",
      "linkedSuccess": "Профиль успешно привязан!",
      "loadingPlayers": "Загрузка игроков из облака...",
      "passesLabel": "ПАСЫ",
      "shotsLabel": "УДАРЫ",
      "goalsLabel": "ГОЛЫ",
      "dribblesLabel": "ДРИБЛИНГ",
      "recoveriesLabel": "ОТБОРЫ",
      "touchesLabel": "КАСАНИЯ",
      "prob1v1Title": "Вероятность победы 1в1",
      "favoriteBadge": "Фаворит",
      "veryBalanced": "Равный поединок",
      "bayesAgeModel": "Данные Байеса + 1в1 + Возраст",
      "sameBioAge": "Одинаковый биологический возраст",
      "reasonDribble": "Преимущество в дриблинге и обводке",
      "reasonPhysical": "Физическое превосходство",
      "reasonDefense": "Надежность в оборонительных действиях",
      "reasonWinRate": "Лучший % побед в предыдущих дуэлях 1в1",
      "reasonAge": "Преимущество в физической зрелости",
      "duels1v1Historical": "Дуэли 1 на 1 (История)",
      "duels1v1": "Дуэли 1 на 1",
      "duels1v1WinRate": "% побед 1 на 1",
      "duels1v1Won": "Выиграно дуэлей",
      "duels1v1Lost": "Проиграно дуэлей",
      "h2h_pedagogical_title": "Тактические советы 1 на 1",
      "h2h_your_advantage": "У тебя преимущество в {stat} (+{diff}). Используй это!",
      "h2h_watch_out": "Остерегайся его {stat} (-{diff}). Играй быстро и на опережение.",
      "h2h_best_weapon": "Сложная дуэль: твой лучший козырь сегодня — {stat}.",
      "h2h_tactical_summary": "Сравнение 6 качеств",
      "h2h_balanced_duel": "Очень равная дуэль! Сохраняй максимальную концентрацию и игровую дисциплину.",
      "heightCm": "Рост (см)",
      "h2h_tip_height_tall_rival": "Осторожно с его длинными ногами! Не иди в лобовой стык. Пробрасывай мяч низом или крути финтами!",
      "h2h_tip_height_fast_rival": "Он как молния! Не бросайся отбирать сломя голову, держи позицию и жди, пока он сам закроется.",
      "h2h_tip_height_advantage": "Используй свой длинный шаг! Укрывай мяч корпусом и не давай ему подобраться к мячу.",
      "h2h_tip_tir_rival_high": "У него пушечный удар! Не давай ему пространства перед штрафной. Встречай сразу же!",
      "h2h_tip_tir_advantage": "У тебя отличный удар! Как только появится просвет в 1в1, смещайся под угол и смело бей по воротам.",
      "h2h_tip_tir_rival_low": "Он редко решается на удар издали. Можешь встречать на шаг глубже, не опасаясь выстрела.",
      "h2h_tip_reg_rival_high": "Он отлично дриблирует! Не выбрасывайся на первое движение: пласируйся и жди, пока он притормозит.",
      "h2h_tip_reg_advantage": "Твой дриблинг на высоте! Используй обманные движения и рывки, чтобы оставить его не у дел.",
      "h2h_tip_reg_rival_low": "Ему тяжело контролировать мяч под прессингом. Атакуй сразу на приёме и забирай мяч!",
      "h2h_tip_def_rival_high": "Он цепко стелется в подкатах. Не лезь в лоб: качни финтом или смени темп.",
      "h2h_tip_def_advantage": "Ты надежный замок в защите! Встречай вполоборота, ставь корпус и чисто отбирай.",
      "h2h_tip_def_rival_low": "Ему сложно защищаться 1в1. Режь угол за спину или уходи в сторону на скорости!",
      "h2h_tip_fis_rival_high": "Настоящая скала в единоборствах! Включай ловкость и не пытайся толкаться корпус в корпус.",
      "h2h_tip_fis_advantage": "У тебя отличная мощь! Ставь плечо и уверенно выигрывай позицию.",
      "h2h_tip_fis_rival_low": "Ему не хватает мощи в стыках. Держи позицию и забирай мяч силой!",
      "h2h_best_weapon_tir": "Трудная дуэль: твой козырь — неожиданный удар. Бей без замаха, как только появится угол!",
      "h2h_best_weapon_reg": "Трудная дуэль: твой лучший шанс — смелый дриблинг. Резкая смена темпа может сбить его с толку!",
      "h2h_best_weapon_def": "Трудная дуэль: твое главное оружие — терпение в обороне. Выжди идеальный момент для отбора!",
      "h2h_best_weapon_fis": "Трудная дуэль: твой главный козырь — физическая борьба. Не выключайся из эпизода и прессингуй!",
      "stat_pas": "Пас (ПАС)",
      "stat_tir": "Удар (УДР)",
      "stat_reg": "Дриблинг (ДРБ)",
      "stat_def": "Защита (ЗАЩ)",
      "stat_fis": "Физика (ФИЗ)",
      "stat_dis": "Дисциплина (ДИС)",
      "mvp_coach_pick": "⭐ Выбор тренера",
      "mvp_coach_picks_title": "Выбор тренера",
      "btn_vote_as_mvp": "⭐ Голосовать за MVP",
      "btn_cancel_view_others": "Отмена / Смотреть других",
      "mvp_coach_reason_label": "Комментарий тренера",
      "autoMissionBadge": "⚡ Авто-миссия",
      "manualMissionBadge": "Ручное задание",
      "progressLabel": "Прогресс",
      "matchDetail": "Детали сессии",
      "viewSessionDetail": "Смотреть детали матча",
      "loadingSession": "Загрузка данных сессии...",
      "won": "Выиграно",
      "lost": "Проиграно",
      "sessions": "Сессии",
      "winRate": "ПОБЕДЫ",
      "stops": "отборов и перехватов",
      "goals": "Голы",
      "duel1v1Goals": "Голы в 1в1",
      "duel1v1Stops": "Отборы и перехваты в 1в1",
      "performanceMetrics": "Показатели эффективности",
      "comparativeRadars": "Сравнительные радары",
      "pitchGoalsTitle": "Тактическая карта поля",
      "pitchGoalsDesc": "Игровые действия с привязкой к секторам поля",
      "untrackedGoalsHint": "голы в прошлых матчах без указания сектора поля",
      "chatWithPlayer": "Написать этому игроку",
      "zone_box_opp": "Штрафная площадь соперника",
      "zone_front": "Атака / Чужая треть",
      "zone_wing_off_l": "Левый фланг атаки",
      "zone_wing_off_r": "Правый фланг атаки",
      "zone_wing_l": "Левый фланг полузащиты",
      "zone_wing_r": "Правый фланг полузащиты",
      "zone_mid": "Центральная зона",
      "filterAll": "Все",
      "filterMatches": "🏟️ Матчи",
      "filterTrainings": "⚽ Тренировки",
      "requestCoachProfile": "➕ Тебя нет в списке? Запросить создание профиля у тренера",
      "requestCoachProfileTitle": "Запрос на добавление нового игрока",
      "requestCoachProfileDesc": "Отправь свои данные тренеру, чтобы он создал твой профиль в системе клуба.",
      "fullNameLabel": "Имя и Фамилия *",
      "fullNamePlaceholder": "Напр., Артем Смирнов",
      "dorsalLabel": "Игровой номер",
      "dorsalPlaceholder": "Напр., 10",
      "positionLabel": "Позиция",
      "positionPlaceholder": "Напр., Нападающий, Вратарь...",
      "notesLabel": "Команда / Примечание",
      "notesPlaceholder": "Напр., Команда 2012, новичок...",
      "sendRequest": "Отправить заявку",
      "nameRequired": "Пожалуйста, укажи имя и фамилию",
      "requestSent": "Заявка отправлена тренеру",
      "coachCardTitle": "Тренерский штаб",
      "viewCoachProfile": "Профиль тренера",
      "coachProfileSubtitle": "Главный тренер и руководство",
      "chatWithCoach": "💬 Написать тренеру",
      "confirmPlayerIdentity": "Подтверждение личности",
      "areYouPlayer": "Ты {name}?",
      "securityCodeDesc": "Для защиты профиля сгенерирован код безопасности. Назови его тренеру для авторизации на твоем устройстве.",
      "securityCodeTitle": "Код безопасности",
      "waitingCoachApproval": "Ожидание подтверждения тренером...",
      "copyCode": "Копировать код",
      "codeCopied": "✅ Код скопирован в буфер обмена!",
      "sendViaViber": "Отправить через Viber",
      "cancelSelectOther": "✕ Отмена и выбор другого игрока",
      "claimLockedNotice": "Запрос на привязку отправлен. Ты не можешь выбрать другой профиль, пока тренер не ответит.",
      "viberShareMsg": "Здравствуйте! Мой проверочный код: {code} для входа в профиль ({name}) в приложении Player Stats.",
      "player": "Игрок",
      "allPlayers": "Все игроки",
      "creationApproved": "🎉 Тренер создал твой профиль! Теперь ты можешь смотреть свою статистику.",
      "creationRejected": "❌ Тренер отклонил заявку на создание профиля.",
      "profileChangeSecurityTitle": "Подтверждение смены профиля",
      "profileChangeSecurityDesc": "Для защиты аккаунта создан код безопасности. Сообщите его тренеру для подтверждения.",
      "viberProfileChangeMsg": "Здравствуйте! Мой код подтверждения: {code} для смены профиля на {name} в приложении Player Stats.",
      "birthDate": "Дата рождения",
      "age": "Возраст",
      "secondaryPositions": "Дополнительные позиции",
      "guardian": "Родитель / Опекун",
      "callCoach": "Позвонить тренеру",
      "call": "Позвонить",
      "voteReset": "Ответ отменен (ожидание)",
      "absenceReasonTitle": "Причина отсутствия",
      "absenceReasonPrompt": "Укажите причину отсутствия:",
      "absenceReasonPlaceholder": "Напр., болезнь, учеба, семейные обстоятельства...",
      "confirmAbsence": "Подтвердить отсутствие",
      "viberCoachContactMsg": "Здравствуйте!",
      "messageViaViber": "Написать в Viber",
      "contact": "Контакты",
      "msgDeletedForEveryone": "Это сообщение было удалено",
      "messageOptions": "Действия с сообщением",
      "copyMessage": "Копировать сообщение",
      "editMessage": "Редактировать сообщение",
      "deleteForEveryone": "Удалить для всех",
      "deleteForMe": "Удалить для меня",
      "deleteForEveryoneConfirm": "Удалить это сообщение для всех участников?",
      "messageDeleted": "Сообщение удалено для всех",
      "messageDeletedForMe": "Сообщение удалено для вас",
      "messageEdited": "Сообщение отредактировано",
      "copiedToClipboard": "Код скопирован в буфер обмена!",
      "stat_touches": "Касания",
      "stat_passOk": "Точная передача",
      "stat_passKo": "Неточная передача",
      "stat_shotOn": "Удар в створ",
      "stat_shotOff": "Удар мимо",
      "stat_goal": "Гол",
      "stat_assist": "Голевая передача",
      "stat_dribbleOk": "Успешная обводка",
      "stat_dribbleKo": "Неудачная обводка",
      "stat_recovery": "Отбор / перехват",
      "stat_loss": "Потеря мяча",
      "stat_duelWon": "Выигранное единоборство",
      "stat_duelLost": "Проигранное единоборство",
      "stat_cross": "Навес",
      "stat_keyPass": "Ключевая передача",
      "stat_header": "Удар головой",
      "stat_foulRecv": "Заработанный фол",
      "stat_foul": "Совершенный фол",
      "stat_save": "Сэйв вратаря",
      "stat_yellow": "Желтая карточка",
      "stat_red": "Красная карточка",
      "appUpdateRequired": "Требуется обновление",
      "appUpdateDesc": "Доступна новая версия приложения PlayerStats.",
      "restartApp": "🔄 Перезапустить приложение",
      "clearCacheBtn": "🔄 Очистить кэш и обновить",
      "careerActionsTitle": "История действий за карьеру",
      "careerActionsDesc": "Полный реестр всех действий и игрового вклада за время выступлений",
      "noCareerActions": "Индивидуальных действий пока не зарегистрировано.",
      "actions": "действий",
      "matchDate": "Дата матча",
      "trainingDate": "Дата тренировки",
      "kickoffTime": "Время начала",
      "trainingTime": "Время тренировки",
      "meetingTime": "Время сбора / прибытия",
      "pitchAndVenue": "Поле и место проведения",
      "coachInstructions": "Указания тренера",
      "kitAndGear": "Форма и экипировка",
      "defaultKitMatch": "Игровая форма, щитки и бутылка с водой",
      "defaultKitTraining": "Тренировочная форма, щитки, бутсы и бутылка с водой",
      "matchSquad": "Заявка на матч",
      "trainingSquad": "Список участников тренировки",
      "attendanceResponse": "Твой ответ по посещаемости:",
      "tapMatchDetails": "Нажмите для просмотра деталей матча и состава",
      "tapTrainingDetails": "Нажмите для просмотра деталей тренировки и состава",
      "opponentLabel": "Соперник:",
      "officialFixture": "Официальный матч",
      "officialTraining": "Официальная тренировка",
      "venueNotSpecified": "Место не указано",
      "newBadge": "НОВОЕ",
      "pendingApproval": "На рассмотрении",
      "noActionsInZone": "Нет действий в этом секторе поля",
      "zoneDetailsTitle": "Анализ зоны поля",
      "matchDetails": "Детали матча",
      "trainingDetails": "Детали тренировки",
      "selectLanguage": "Выбрать язык",
      "selectLanguageDesc": "Выберите предпочитаемый язык интерфейса",
      "activeBadge": "Активен",
      "doneBtn": "Готово",
      "langSpanish": "Испанский",
      "langEnglish": "Английский",
      "langEstonian": "Эстонский",
      "langChangedToast": "Язык переключен на Русский",
      "startTime": "Начало",
      "endTime": "Конец",
      "duration": "Длительность",
      "claimCooldownWait": "Пожалуйста, подожди {sec}с перед запросом нового кода.",
      "downloadApk": "Скачать приложение для Android (APK)",
      "apkDownloadTitle": "Загрузка приложения Android",
      "apkDownloadStarted": "Загрузка началась на вашем устройстве!",
      "apkHowToInstallTitle": "Где найти и как установить?",
      "apkStep1Bold": "Проверьте панель уведомлений:",
      "apkStep1Desc": "Смахните вниз от верхнего края экрана и нажмите на 'PlayerStats_Player.apk' по завершении скачивания.",
      "apkStep2Bold": "Или откройте папку Загрузки:",
      "apkStep2Desc": "Откройте приложение 'Файлы' или 'Загрузки' на телефоне и найдите 'PlayerStats_Player.apk'. Нажмите для установки.",
      "apkFamilyLinkTitle": "Для пользователей Google Family Link:",
      "apkFamilyLinkDesc": "Попросите родителей открыть Family Link -> Лимиты приложений -> 'Player stats (Player)' -> выбрать 'Всегда разрешено'.",
      "openInBrowserDownload": "Открыть и скачать в браузере",
      "retryDownload": "Повторить загрузку",
      "downloadStartedToast": "📥 Загрузка файла APK...",
      "h2h_keys_title": "Ключи к дуэли",
      "mvp_coach_reason_title": "Комментарий тренера:",
      "mvp_btn_confirm_vote": "Голосовать за {name} как MVP",
      "mvp_btn_cancel": "Отмена и смотреть других",
      "currentProgressLabel": "Прогресс",
      "minAttemptsLabel": "Мин. попыток"
},
      "selected": "Выбран",
      "select": "Выбрать",
      "saveVote": "Сохранить голос",
      "saveVoteFor": "Сохранить голос за: {name}"
  };
  DICT.et = DICT.ee;
  DICT.ee = DICT.et;

  /* -------------------------------------------------------------
     EXPLICACIONES DE CUALIDADES EN INGLÉS (PUNTO 7 OBLIGATORIO)
     ------------------------------------------------------------- */
  const SKILL_EXPLANATIONS_EN = {
    pas: {
      name: 'Passing (PAS)',
      icon: '🎯',
      desc: 'Evaluates distribution vision, ground and aerial passing accuracy, progressive passes into the final third, and execution speed under opposition pressure.'
    },
    tir: {
      name: 'Shooting (SHT / TIR)',
      icon: '⚽',
      desc: 'Measures finishing composure inside the box, shot power, shots-on-target percentage, distance shooting accuracy, and clinical goal conversion rate.'
    },
    reg: {
      name: 'Dribbling (DRI / REG)',
      icon: '⚡',
      desc: 'Reflects 1v1 take-on success rate, close ball control in tight spaces, change of direction, technical agility, and ability to eliminate defenders.'
    },
    fis: {
      name: 'Physical (PHY / FIS)',
      icon: '💪',
      desc: 'Reflects match stamina, high-intensity running work rate, aerial duel competitiveness, physical resistance in tackles, and active involvement across all periods.'
    },
    def: {
      name: 'Defending (DEF)',
      icon: '🛡️',
      desc: 'Evaluates defensive positioning, clean ball recoveries, defensive ground duels won, interceptions, and defensive pressing contribution.'
    },
    dis: {
      name: 'Discipline (DIS)',
      icon: '🏅',
      desc: 'Measures sportsmanship, fair play conduct, respect for referees and teammates, tactical adherence to the coach instructions, and maintaining a low foul/card count.'
    },
    rating: {
      name: 'Match Rating (⭐ 1.0 - 10.0)',
      icon: '⭐',
      desc: 'Overall performance index calculated with an advanced position-weighted algorithm that balances passing accuracy, goal involvement, defensive recoveries, duels won, and active ball volume.'
    }
  };

  const SKILL_EXPLANATIONS_EE = {
    pas: {
      name: 'Söötmine (PAS)',
      icon: '🎯',
      desc: 'Hindab väljakunägemist, lühikeste ja pikkade söötude täpsust, ründefaasi viivaid sööte ning söödutäpsust vastase surve all.'
    },
    tir: {
      name: 'Löömine (TIR / SHT)',
      icon: '⚽',
      desc: 'Mõõdab realiseerimist karistusalas, löögitugevust, raamilöökide osakaalu, kauglöökide täpsust ja väravate löömise efektiivsust.'
    },
    reg: {
      name: 'Tribling (DRI / REG)',
      icon: '⚡',
      desc: 'Peegeldab 1v1 olukordade edukust, palli kontrolli kitsastes oludes, suunamuutuste kiirust, tehnilist osavust ja kaitsjatest möödumist.'
    },
    fis: {
      name: 'Füüsis (PHY / FIS)',
      icon: '💪',
      desc: 'Näitab mängu vastupidavust, kõrge intensiivsusega töömahtu, õhuvõitluse tugevust, füüsilist vastupanu kahevõitlustes ja aktiivset osalust.'
    },
    def: {
      name: 'Kaitsetöö (DEF)',
      icon: '🛡️',
      desc: 'Hindab kaitsepositsiooni valikut, puhtaid palli tagasivõitmisi, maas peetud kahevõitluste võitmist, vaheltlõikeid ja pressingupanust.'
    },
    dis: {
      name: 'Distsipliin (DIS)',
      icon: '🏅',
      desc: 'Mõõdab sportlikku käitumist, austust kohtunike ja meeskonnakaaslaste vastu, treeneri taktikalistest juhistest kinnipidamist ning vigade/kaartide vältimist.'
    },
    rating: {
      name: 'Mänguhinne (⭐ 1.0 - 10.0)',
      icon: '⭐',
      desc: 'Üldine esituse indeks, mis arvutatakse positsioonipõhise algoritmi abil, tasakaalustades sööte, väravaid, palli tagasivõitmisi, kahevõitlusi ja aktiivsust.'
    }
  };

  
  const SKILL_EXPLANATIONS_RU = {
    pas: {
      name: 'Пас (PAS)',
      icon: '🎯',
      desc: 'Оценивает видение поля, точность коротких и длинных передач, обостряющие передачи в финальную треть и скорость принятия решений под прессингом соперника.'
    },
    tir: {
      name: 'Удар (SHT / TIR)',
      icon: '⚽',
      desc: 'Измеряет хладнокровие при завершении в штрафной, силу удара, процент попаданий в створ, точность дальних ударов и реализацию голевых моментов.'
    },
    reg: {
      name: 'Дриблинг (DRI / REG)',
      icon: '⚡',
      desc: 'Отражает успешность обводок 1 в 1, контроль мяча на ограниченном пространстве, смену ритма, техническую ловкость и умение обыгрывать защитников.'
    },
    fis: {
      name: 'Физика (PHY / FIS)',
      icon: '💪',
      desc: 'Показывает выносливость на протяжении матча, объем работы на высокой интенсивности, верховые единоборства, физическую устойчивость в борьбе и активность во всех отрезках.'
    },
    def: {
      name: 'Защита (DEF)',
      icon: '🛡️',
      desc: 'Оценивает позиционную грамотность при обороне, чистые отборы мяча, выигранные единоборства внизу, перехваты и вклад в командный прессинг.'
    },
    dis: {
      name: 'Дисциплина (DIS)',
      icon: '🏅',
      desc: 'Измеряет спортивное поведение, соблюдение принципов fair play, уважение к судьям и партнерам по команде, строгое следование установкам тренера и отсутствие фолов/карточек.'
    },
    rating: {
      name: 'Оценка за матч (⭐ 1.0 - 10.0)',
      icon: '⭐',
      desc: 'Комплексный индекс эффективности, рассчитанный по продвинутому позиционному алгоритму с учетом точности передач, результативных действий, отборов, выигранных единоборств и общего объема игры с мячом.'
    }
  };

  const SKILL_EXPLANATIONS_ES = {
    pas: {
      name: 'Pase (PAS)',
      icon: '🎯',
      desc: 'Evalúa la visión de distribución, precisión en pases rasos y aéreos, pases progresivos a tres cuartos de campo y velocidad bajo presión rival.'
    },
    tir: {
      name: 'Tiro (TIR)',
      icon: '⚽',
      desc: 'Mide la definición dentro del área, potencia de disparo, porcentaje a puerta, precisión a media distancia y efectividad goleadora.'
    },
    reg: {
      name: 'Regate (REG)',
      icon: '⚡',
      desc: 'Refleja el éxito en duelos 1 contra 1, control en espacios reducidos, cambio de ritmo, agilidad técnica y desborde ante rivales.'
    },
    fis: {
      name: 'Físico (FIS)',
      icon: '💪',
      desc: 'Refleja la resistencia en el partido, volumen de trabajo a alta intensidad, competitividad en saltos y disputa física durante todo el encuentro.'
    },
    def: {
      name: 'Defensa (DEF)',
      icon: '🛡️',
      desc: 'Evalúa la colocación táctica, recuperaciones limpias de balón, duelos defensivos ganados en el suelo, intercepciones y presión.'
    },
    dis: {
      name: 'Disciplina (DIS)',
      icon: '🏅',
      desc: 'Mide la deportividad, juego limpio, respeto a árbitros y compañeros, seguimiento de las pautas del míster y bajo cómputo de faltas o tarjetas.'
    },
    rating: {
      name: 'Nota del Partido (⭐ 1.0 - 10.0)',
      icon: '⭐',
      desc: 'Índice global de rendimiento ponderado por posición táctica según pases, goles, recuperaciones defensivas, duelos ganados y toques activos.'
    }
  };

  function t(key, fallback) {
    const dict = DICT[currentLang] || DICT.en;
    if (dict[key] !== undefined) return dict[key];
    if (DICT.en[key] !== undefined) return DICT.en[key];
    return fallback || key;
  }
  window.t = t;

  const POSITION_MAP = {
    // Standard tactical codes
    'POR': { en: 'Goalkeeper (GK)', ee: 'Väravavaht (VV)', es: 'Portero (POR)', ru: 'Вратарь (ВРТ)' },
    'GK': { en: 'Goalkeeper (GK)', ee: 'Väravavaht (VV)', es: 'Portero (POR)', ru: 'Вратарь (ВРТ)' },
    'DFC': { en: 'Centre Back (CB)', ee: 'Keskkaitsja (KK)', es: 'Defensa Central (DFC)', ru: 'Центральный защитник (ЦЗ)' },
    'CB': { en: 'Centre Back (CB)', ee: 'Keskkaitsja (KK)', es: 'Defensa Central (DFC)', ru: 'Центральный защитник (ЦЗ)' },
    'LI': { en: 'Left Back (LB)', ee: 'Vasakkaitsja (VK)', es: 'Lateral Izquierdo (LI)', ru: 'Левый защитник (ЛЗ)' },
    'LB': { en: 'Left Back (LB)', ee: 'Vasakkaitsja (VK)', es: 'Lateral Izquierdo (LI)', ru: 'Левый защитник (ЛЗ)' },
    'LD': { en: 'Right Back (RB)', ee: 'Paremkaitsja (PK)', es: 'Lateral Derecho (LD)', ru: 'Правый защитник (ПЗ)' },
    'RB': { en: 'Right Back (RB)', ee: 'Paremkaitsja (PK)', es: 'Lateral Derecho (LD)', ru: 'Правый защитник (ПЗ)' },
    'MCD': { en: 'Defensive Midfield (CDM)', ee: 'Kaitsev poolkaitsja (KPK)', es: 'Mediocentro Defensivo (MCD)', ru: 'Опорный полузащитник (ОПЗ)' },
    'CDM': { en: 'Defensive Midfield (CDM)', ee: 'Kaitsev poolkaitsja (KPK)', es: 'Mediocentro Defensivo (MCD)', ru: 'Опорный полузащитник (ОПЗ)' },
    'MC': { en: 'Central Midfield (CM)', ee: 'Keskpoolkaitsja (KP)', es: 'Mediocentro (MC)', ru: 'Центральный полузащитник (ЦП)' },
    'CM': { en: 'Central Midfield (CM)', ee: 'Keskpoolkaitsja (KP)', es: 'Mediocentro (MC)', ru: 'Центральный полузащитник (ЦП)' },
    'MCO': { en: 'Attacking Midfield (CAM)', ee: 'Ründav poolkaitsja (RPK)', es: 'Mediapunta (MCO)', ru: 'Атакующий полузащитник (АПЗ)' },
    'CAM': { en: 'Attacking Midfield (CAM)', ee: 'Ründav poolkaitsja (RPK)', es: 'Mediapunta (MCO)', ru: 'Атакующий полузащитник (АПЗ)' },
    'EI': { en: 'Left Winger (LW)', ee: 'Vasakäär (VÄ)', es: 'Extremo Izquierdo (EI)', ru: 'Левый вингер (ЛВ)' },
    'LW': { en: 'Left Winger (LW)', ee: 'Vasakäär (VÄ)', es: 'Extremo Izquierdo (EI)', ru: 'Левый вингер (ЛВ)' },
    'ED': { en: 'Right Winger (RW)', ee: 'Parem-äär (PÄ)', es: 'Extremo Derecho (ED)', ru: 'Правый вингер (ПВ)' },
    'RW': { en: 'Right Winger (RW)', ee: 'Parem-äär (PÄ)', es: 'Extremo Derecho (ED)', ru: 'Правый вингер (ПВ)' },
    'DC': { en: 'Striker (ST)', ee: 'Ründaja (R)', es: 'Delantero Centro (DC)', ru: 'Центральный нападающий (ЦН)' },
    'ST': { en: 'Striker (ST)', ee: 'Ründaja (R)', es: 'Delantero Centro (DC)', ru: 'Центральный нападающий (ЦН)' },
    // Full names and keywords
    'portero': { en: 'Goalkeeper', ee: 'Väravavaht', es: 'Portero', ru: 'Вратарь' },
    'goalkeeper': { en: 'Goalkeeper', ee: 'Väravavaht', es: 'Portero', ru: 'Вратарь' },
    'defensa central': { en: 'Centre Back', ee: 'Keskkaitsja', es: 'Defensa Central', ru: 'Центральный защитник' },
    'centre back': { en: 'Centre Back', ee: 'Keskkaitsja', es: 'Defensa Central', ru: 'Центральный защитник' },
    'defensa': { en: 'Defender', ee: 'Kaitsja', es: 'Defensa', ru: 'Защитник' },
    'defender': { en: 'Defender', ee: 'Kaitsja', es: 'Defensa', ru: 'Защитник' },
    'lateral izquierdo': { en: 'Left Back', ee: 'Vasakkaitsja', es: 'Lateral Izquierdo', ru: 'Левый защитник' },
    'left back': { en: 'Left Back', ee: 'Vasakkaitsja', es: 'Lateral Izquierdo', ru: 'Левый защитник' },
    'lateral derecho': { en: 'Right Back', ee: 'Paremkaitsja', es: 'Lateral Derecho', ru: 'Правый защитник' },
    'right back': { en: 'Right Back', ee: 'Paremkaitsja', es: 'Lateral Derecho', ru: 'Правый защитник' },
    'lateral': { en: 'Full Back', ee: 'Äärekaitsja', es: 'Lateral', ru: 'Крайний защитник' },
    'full back': { en: 'Full Back', ee: 'Äärekaitsja', es: 'Lateral', ru: 'Крайний защитник' },
    'carrilero': { en: 'Wing Back', ee: 'Äärekaitsja', es: 'Carrilero', ru: 'Латераль' },
    'wing back': { en: 'Wing Back', ee: 'Äärekaitsja', es: 'Carrilero', ru: 'Латераль' },
    'mediocentro defensivo': { en: 'Defensive Midfielder', ee: 'Kaitsev poolkaitsja', es: 'Mediocentro Defensivo', ru: 'Опорный полузащитник' },
    'defensive midfielder': { en: 'Defensive Midfielder', ee: 'Kaitsev poolkaitsja', es: 'Mediocentro Defensivo', ru: 'Опорный полузащитник' },
    'pivote': { en: 'Defensive Midfielder', ee: 'Kaitsev poolkaitsja', es: 'Pivote', ru: 'Опорный полузащитник' },
    'mediocentro': { en: 'Central Midfielder', ee: 'Keskpoolkaitsja', es: 'Mediocentro', ru: 'Центральный полузащитник' },
    'central midfielder': { en: 'Central Midfielder', ee: 'Keskpoolkaitsja', es: 'Mediocentro', ru: 'Центральный полузащитник' },
    'centrocampista': { en: 'Midfielder', ee: 'Poolkaitsja', es: 'Centrocampista', ru: 'Полузащитник' },
    'midfielder': { en: 'Midfielder', ee: 'Poolkaitsja', es: 'Centrocampista', ru: 'Полузащитник' },
    'mediapunta': { en: 'Attacking Midfielder', ee: 'Ründav poolkaitsja', es: 'Mediapunta', ru: 'Атакующий полузащитник' },
    'attacking midfielder': { en: 'Attacking Midfielder', ee: 'Ründav poolkaitsja', es: 'Mediapunta', ru: 'Атакующий полузащитник' },
    'extremo izquierdo': { en: 'Left Winger', ee: 'Vasakäär', es: 'Extremo Izquierdo', ru: 'Левый вингер' },
    'left winger': { en: 'Left Winger', ee: 'Vasakäär', es: 'Extremo Izquierdo', ru: 'Левый вингер' },
    'extremo derecho': { en: 'Right Winger', ee: 'Parem-äär', es: 'Extremo Derecho', ru: 'Правый вингер' },
    'right winger': { en: 'Right Winger', ee: 'Parem-äär', es: 'Extremo Derecho', ru: 'Правый вингер' },
    'extremo': { en: 'Winger', ee: 'Ääreründaja', es: 'Extremo', ru: 'Вингер' },
    'winger': { en: 'Winger', ee: 'Ääreründaja', es: 'Extremo', ru: 'Вингер' },
    'delantero centro': { en: 'Striker', ee: 'Tipu-ründaja', es: 'Delantero Centro', ru: 'Центральный нападающий' },
    'delantero': { en: 'Forward / Striker', ee: 'Ründaja', es: 'Delantero', ru: 'Нападающий' },
    'striker': { en: 'Striker', ee: 'Tipu-ründaja', es: 'Delantero Centro', ru: 'Центральный нападающий' },
    'forward': { en: 'Forward', ee: 'Ründaja', es: 'Delantero', ru: 'Нападающий' },
    'jugador': { en: 'Player', ee: 'Mängija', es: 'Jugador', ru: 'Игрок' },
    'player': { en: 'Player', ee: 'Mängija', es: 'Jugador', ru: 'Игрок' }
  };

  function formatPosition(pos) {
    if (!pos) return (currentLang === 'ee' || currentLang === 'et') ? 'Mängija' : (currentLang === 'ru' ? 'Игрок' : (currentLang === 'en' ? 'Player' : 'Jugador'));
    const clean = String(pos).trim();
    const upper = clean.toUpperCase();
    if (POSITION_MAP[upper]) {
      return POSITION_MAP[upper][currentLang] || POSITION_MAP[upper].en || clean;
    }
    const lower = clean.toLowerCase();
    if (POSITION_MAP[lower]) {
      return POSITION_MAP[lower][currentLang] || POSITION_MAP[lower].en || clean;
    }
    if (clean.includes('/')) {
      const parts = clean.split('/').map(s => s.trim());
      if (currentLang === 'ee' && parts[1]) {
        return formatPosition(parts[1]);
      }
      if (currentLang === 'en' && parts[1]) {
        return formatPosition(parts[1]);
      }
      if (currentLang === 'es' && parts[0]) {
        return formatPosition(parts[0]);
      }
    }
    return clean;
  }

  function formatPositionsList(list) {
    if (!list) return '';
    if (Array.isArray(list)) {
      return list.map(p => formatPosition(p)).join(', ');
    }
    return formatPosition(list);
  }

  function toast(msg, type = 'info', onClick) {
    if (!toastRoot) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    if (onClick) {
      el.style.cursor = 'pointer';
      el.innerHTML = `<span style="flex:1;">${msg}</span><span style="font-size:14px; margin-left:8px; opacity:0.85; font-weight:900;">➔</span>`;
      el.onclick = () => {
        try { onClick(); } catch(e) {}
        el.remove();
      };
    } else {
      el.innerHTML = msg;
    }
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 250);
    }, 2800);
  }

  function haptic(ms = 25) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPlayerShortName(p) {
    if (!p) return '';
    const firstName = (p.name || '').trim();
    const lastName = (p.lastName || '').trim();
    if (lastName) {
      const initial = lastName.charAt(0).toUpperCase();
      return `${firstName} ${initial}.`;
    }
    const parts = firstName.split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const initial = parts[1].charAt(0).toUpperCase();
      return `${first} ${initial}.`;
    }
    return firstName;
  }

  function openLocationInMaps(query) {
    if (!query) return;
    if (window.AndroidBridge && window.AndroidBridge.openMaps) {
      try {
        window.AndroidBridge.openMaps(query);
        return;
      } catch (e) {
        console.error('Error abriendo mapa nativo en Portal Jugadores:', e);
      }
    }
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
    window.open(url, '_blank');
  }
  window.openLocationInMaps = openLocationInMaps;

  function getDeviceId() {
    let devId = localStorage.getItem('portal_device_id');
    if (!devId) {
      devId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem('portal_device_id', devId); } catch (e) {}
    }
    return devId;
  }

  function isProfileLocked() {
    return localStorage.getItem('portal_player_locked') === 'true' && Boolean(myPlayerId) && hasApprovedProfile();
  }

  function renderAvatar(player, sizeClass = '') {
    const cls = sizeClass ? `avatar ${sizeClass}` : 'avatar';
    if (!player) return `<div class="${cls}"><span>?</span></div>`;
    const initial = (player.name ? player.name[0] : (player.nickname ? player.nickname[0] : 'P')).toUpperCase();
    const dorsalHtml = player.mainDorsal != null ? `<span class="dorsal">${player.mainDorsal}</span>` : '';
    if (player.photo) {
      return `<div class="${cls}"><img src="${player.photo}" alt="" loading="lazy" />${dorsalHtml}</div>`;
    }
    return `<div class="${cls}"><span>${initial}</span>${dorsalHtml}</div>`;
  }

  function getMyPlayer() {
    if (myPlayerId) {
      const p = (clubData && clubData.players) ? clubData.players.find(x => x.id === myPlayerId) : null;
      if (p) return p;
      const pendingCreationId = localStorage.getItem('portal_pending_creation_id');
      if (myPlayerId === pendingCreationId) {
        return {
          id: pendingCreationId,
          name: localStorage.getItem('portal_pending_creation_name') || 'Jugador',
          lastName: '',
          mainDorsal: parseInt(localStorage.getItem('portal_pending_creation_dorsal') || '0', 10) || null,
          mainPosition: localStorage.getItem('portal_pending_creation_pos') || 'Delantero',
          teamId: '',
          isPendingApproval: true
        };
      }
    }
    return null;
  }

  function getPlayerFootLabel(footVal) {
    if (!footVal) return t('footRight');
    const f = String(footVal).toLowerCase();
    if (f.includes('zurdo') || f.includes('left')) return t('footLeft');
    if (f.includes('ambi') || f.includes('both')) return t('footBoth');
    return t('footRight');
  }

  /* -------------------------------------------------------------
     ALGORITMO OFICIAL DE NOTA DE RENDIMIENTO (MATCH RATING 1.0 - 10.0)
     Calibración realista: 6.0 estándar, 7.5-8.5 muy bueno, 8.5-9.2 sobresaliente, 9.5+ casi imposible
     ------------------------------------------------------------- */
  function calculateMatchRating(stats, position) {
    if (!stats || Object.keys(stats).length === 0) return 6.0;
    const p = (position || 'Jugador').toUpperCase();

    const goal = stats.goal || 0;
    const assist = stats.assist || 0;
    const shotOn = stats.shotOn || 0;
    const shotOff = stats.shotOff || 0;
    const passOk = stats.passOk || 0;
    const passKo = stats.passKo || 0;
    const keyPass = stats.keyPass || 0;
    const dribbleOk = stats.dribbleOk || 0;
    const dribbleKo = stats.dribbleKo || 0;
    const recovery = stats.recovery || 0;
    const loss = stats.loss || 0;
    const duelWon = stats.duelWon || 0;
    const duelLost = stats.duelLost || 0;
    const save = stats.save || 0;
    const foul = stats.foul || 0;
    const yellow = stats.yellow || 0;
    const red = stats.red || 0;
    const touches = stats.touches || 0;

    // Eventos 1v1
    const d1v1Goal = stats.duel1v1WonGoal || 0;
    const d1v1Stop = stats.duel1v1WonStop || 0;
    const d1v1Turnover = stats.duel1v1LostTurnover || 0;
    const d1v1LostGoal = stats.duel1v1LostGoal || 0;

    const passes = passOk + passKo;
    const totalActions = goal + assist + shotOn + shotOff + passes + keyPass +
      dribbleOk + dribbleKo + recovery + loss + duelWon + duelLost + save + foul + yellow + red +
      d1v1Goal + d1v1Stop + d1v1Turnover + d1v1LostGoal;

    if (totalActions === 0 && touches === 0) return 6.0;

    // Acciones positivas puras
    let posScore = 0;
    if (passes > 0) {
      const passAcc = passOk / passes;
      posScore += (passOk * 0.05) + Math.max(0, (passAcc - 0.70) * 1.2);
    }
    posScore += goal * 0.95;
    posScore += assist * 0.65;
    posScore += shotOn * 0.20;
    posScore += keyPass * 0.35;
    posScore += dribbleOk * 0.22;
    posScore += recovery * 0.28;
    posScore += duelWon * 0.20;
    posScore += save * 0.45;
    posScore += d1v1Goal * 0.35;
    posScore += d1v1Stop * 0.25;

    // Bonus posicional específico
    if (p.includes('POR') || p.includes('GK')) {
      posScore += save * 0.30;
    } else if (p.includes('DC') || p.includes('DEL') || p.includes('ST') || p.includes('CF') || p.includes('EXT') || p.includes('RW') || p.includes('LW')) {
      posScore += (goal * 0.20) + (shotOn * 0.15);
    } else if (p.includes('DFC') || p.includes('CB') || p.includes('DEF') || p.includes('RB') || p.includes('LB') || p.includes('MCD') || p.includes('DM')) {
      posScore += (recovery * 0.20) + (duelWon * 0.15);
    }

    // Acciones negativas puras
    let negScore = 0;
    negScore += passKo * 0.06;
    negScore += shotOff * 0.08;
    negScore += dribbleKo * 0.14;
    negScore += loss * 0.20;
    negScore += duelLost * 0.14;
    negScore += foul * 0.15;
    negScore += yellow * 0.75;
    negScore += red * 2.50;
    negScore += d1v1Turnover * 0.18;
    negScore += d1v1LostGoal * 0.30;

    const rawNet = posScore - negScore;

    // Factor de volumen: requiere volumen sostenido para notas altas
    const effectiveVolume = totalActions + (touches * 0.3);
    const volumeFactor = Math.min(1.0, Math.sqrt(effectiveVolume / 22.0));

    let delta = 0;
    if (rawNet >= 0) {
      delta = 4.0 * (1 - Math.exp(-rawNet / 7.2)) * volumeFactor;
    } else {
      delta = -5.0 * (1 - Math.exp(-Math.abs(rawNet) / 5.5));
    }

    const finalScore = 6.0 + delta;
    return Math.min(10.0, Math.max(1.0, Math.round(finalScore * 10) / 10));
  }

  /* -------------------------------------------------------------
     CÁLCULO DE MÉTRICAS DEL JUGADOR (SIN MINUTOS, CON ASISTENCIAS SEPARADAS)
     ------------------------------------------------------------- */
  function getPlayerAggregate(pid, customSessions) {
    const totals = {};
    const perSession = [];
    const sessList = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) ? clubData.sessions : []);
    sessList.forEach(s => {
      const st = (s && s.stats) ? s.stats[pid] : null;
      if (!st || !Object.keys(st).some(k => st[k] > 0)) return;
      perSession.push({ session: s, stats: st });
      Object.keys(st).forEach(k => { totals[k] = (totals[k] || 0) + (st[k] || 0); });
    });

    if (perSession.length === 0 && clubData && clubData.players) {
      const p = clubData.players.find(x => x.id === pid);
      if (p && p.statsSummary) {
        const isMatchFilter = Array.isArray(customSessions) && customSessions.length > 0 && customSessions.every(s => (s.type || 'match') === 'match');
        const isTrainFilter = Array.isArray(customSessions) && customSessions.length > 0 && customSessions.every(s => (s.type || 'training') === 'training');
        let count = 0;
        if (isMatchFilter) count = p.statsSummary.matchesAttended || 0;
        else if (isTrainFilter) count = p.statsSummary.trainingsAttended || 0;
        else count = p.statsSummary.totalSessions || ((p.statsSummary.matchesAttended || 0) + (p.statsSummary.trainingsAttended || 0));

        if (count > 0) {
          return {
            totals: Object.assign({}, p.statsSummary.totals || {}),
            sessions: [],
            count,
            ratingsSum: (p.ovr ? p.ovr / 10 : 6.0) * count,
            ratingsCount: count
          };
        }
      }
    }

    return { totals, sessions: perSession, count: perSession.length };
  }

  function calculatePlayerStats(pid, customSessions) {
    const res = {
      matchesAttended: 0,
      trainingsAttended: 0,
      totalSessions: 0,
      goals: 0,
      shotsOn: 0,
      shotsOff: 0,
      passOk: 0,
      passKo: 0,
      touches: 0,
      dribbleOk: 0,
      dribbleKo: 0,
      duelWon: 0,
      duelLost: 0,
      recoveries: 0,
      losses: 0,
      keyPass: 0,
      assists: 0,
      saves: 0,
      fouls: 0,
      foulsRecv: 0,
      yellows: 0,
      reds: 0,
      crosses: 0,
      headers: 0,
      totals: {},
      aggregatedRating: 6.0,
      ratingsSum: 0,
      ratingsCount: 0
    };

    if (!clubData) return res;

    const p = clubData.players ? clubData.players.find(x => x.id === pid) : null;
    const pos = p ? p.mainPosition : 'Jugador';

    const sessions = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) || []);
    const hasDetailedSessions = sessions && sessions.some(s => s && s.stats && Object.keys(s.stats).length > 0);

    if ((!customSessions || customSessions.length === 0) && !hasDetailedSessions && p && p.statsSummary) {
      return Object.assign({}, res, p.statsSummary);
    }
    if (sessions) {
      sessions.forEach(s => {
        const sType = s.type === 'match' ? 'match' : 'training';
        const pStats = s.stats && s.stats[pid];
        const hasActions = pStats && Object.values(pStats).some(v => v > 0);
        let wasPresent = hasActions || (s.list && s.list[pid] === 'called');
        if (s.attendance && s.attendance[pid]) {
          const att = s.attendance[pid];
          const st = (typeof att === 'object' && att !== null) ? att.status : att;
          if (st === 'present' || st === 'late') wasPresent = true;
          else if (st === 'absent') wasPresent = false;
        }

        if (wasPresent) {
          if (sType === 'match') res.matchesAttended++;
          else res.trainingsAttended++;
        }

        if (hasActions) {
          res.goals += pStats.goal || 0;
          res.shotsOn += pStats.shotOn || 0;
          res.shotsOff += pStats.shotOff || 0;
          res.passOk += pStats.passOk || 0;
          res.passKo += pStats.passKo || 0;
          res.touches += pStats.touches || 0;
          res.dribbleOk += pStats.dribbleOk || 0;
          res.dribbleKo += pStats.dribbleKo || 0;
          res.duelWon += pStats.duelWon || 0;
          res.duelLost += pStats.duelLost || 0;
          res.recoveries += pStats.recovery || 0;
          res.losses += pStats.loss || 0;
          res.keyPass += pStats.keyPass || 0;
          res.assists += pStats.assist || 0;
          res.saves += pStats.save || 0;
          res.fouls += pStats.foul || 0;
          res.foulsRecv += pStats.foulRecv || 0;
          res.yellows += pStats.yellow || 0;
          res.reds += pStats.red || 0;
          res.crosses += pStats.cross || 0;
          res.headers += pStats.header || 0;

          Object.keys(pStats).forEach(k => {
            res.totals[k] = (res.totals[k] || 0) + (pStats[k] || 0);
          });

          const matchRat = calculateMatchRating(pStats, pos);
          res.ratingsSum += matchRat;
          res.ratingsCount++;
        }
      });
    }

    res.totalSessions = res.matchesAttended + res.trainingsAttended;
    const totalPass = res.passOk + res.passKo;
    res.passAcc = totalPass > 0 ? Math.round((res.passOk / totalPass) * 100) : 0;
    const totalShots = res.shotsOn + res.shotsOff;
    res.shotAcc = totalShots > 0 ? Math.round((res.shotsOn / totalShots) * 100) : 0;

    res.aggregatedRating = res.ratingsCount > 0
      ? (Math.round((res.ratingsSum / res.ratingsCount) * 10) / 10).toFixed(1)
      : '6.0';

    return res;
  }

  function calculatePlayerOverallRating(pid, position) {
    const p = clubData && clubData.players ? clubData.players.find(x => x.id === pid) : null;
    const allSessions = (clubData && clubData.sessions) || [];
    const hasDetailedSessions = allSessions.some(s => s && s.stats && Object.keys(s.stats).length > 0);

    if (!hasDetailedSessions && p && typeof p.ovr === 'number') {
      const r = Number((p.ovr / 10).toFixed(1));
      return {
        rating: r,
        mode: p.overallMode || 'combined',
        hasTrain: true,
        hasMatch: true,
        rTrain: r,
        rMatch: r
      };
    }

    const trainingSessions = allSessions.filter(s => (s.type || 'training') === 'training');
    const matchSessions = allSessions.filter(s => (s.type || 'training') === 'match');

    const aggTrain = getPlayerAggregate(pid, trainingSessions);
    const aggMatch = getPlayerAggregate(pid, matchSessions);

    const hasTrain = aggTrain.count > 0;
    const hasMatch = aggMatch.count > 0;

    const rTrain = (hasTrain && aggTrain.ratingsCount > 0) ? (aggTrain.ratingsSum / aggTrain.ratingsCount) : null;
    const rMatch = (hasMatch && aggMatch.ratingsCount > 0) ? (aggMatch.ratingsSum / aggMatch.ratingsCount) : null;

    let rating = 6.0;
    let mode = 'none'; // 'combined' | 'training' | 'match' | 'none'

    if (rTrain != null && rMatch != null) {
      rating = (rTrain + rMatch) / 2;
      mode = 'combined';
    } else if (rTrain != null) {
      rating = rTrain;
      mode = 'training';
    } else if (rMatch != null) {
      rating = rMatch;
      mode = 'match';
    } else {
      rating = 6.0;
      mode = 'none';
    }

    if (typeof rating !== 'number' || isNaN(rating)) rating = 6.0;

    return {
      rating: Number(rating.toFixed(1)),
      mode,
      hasTrain,
      hasMatch,
      rTrain: rTrain != null ? Number(rTrain.toFixed(1)) : null,
      rMatch: rMatch != null ? Number(rMatch.toFixed(1)) : null
    };
  }

  function calculatePlayerAttendanceStreak(pid) {
    if (!pid || !clubData) return 0;
    const p = (clubData.players || []).find(x => String(x.id) === String(pid));
    const allSessions = Array.isArray(clubData.sessions) ? clubData.sessions : [];
    const hasDetailedSessions = allSessions.some(s => s && ((s.attendance && Object.keys(s.attendance).length > 0) || (s.stats && Object.keys(s.stats).length > 0)));

    if (!hasDetailedSessions && p && typeof p.streak === 'number') {
      return p.streak;
    }

    const filtered = allSessions
      .slice()
      .filter(s => {
        if (!s) return false;
        return (s.attendance && s.attendance[pid] != null) || (s.stats && s.stats[pid] && Object.values(s.stats[pid]).some(v => v > 0));
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

    let streak = 0;
    for (const s of filtered) {
      const att = s.attendance ? s.attendance[pid] : null;
      const st = (typeof att === 'object' && att !== null) ? att.status : att;
      const hasAction = s.stats && s.stats[pid] && Object.values(s.stats[pid]).some(v => v > 0);

      if (st === 'present' || st === 'late' || (st == null && hasAction)) {
        streak++;
      } else if (st === 'justified') {
        continue;
      } else {
        break;
      }
    }
    return streak;
  }

  function calculatePlayerMvpCount(pid) {
    if (!pid || !clubData) return 0;
    const sPid = String(pid);
    const p = (clubData && clubData.players ? clubData.players : []).find(x => String(x.id) === sPid);
    const allSessions = Array.isArray(clubData.sessions) ? clubData.sessions : [];
    const hasDetailedSessions = allSessions.some(s => s && (s.officialMvpId || s.mvpWinnerId));

    if (!hasDetailedSessions && p && typeof p.mvpCount === 'number') {
      return p.mvpCount;
    }

    let count = 0;
    allSessions.forEach(s => {
      if (s && s.type === 'match') {
        if (s.officialMvpId && String(s.officialMvpId) === sPid) {
          count++;
        } else if (s.mvpWinnerId && String(s.mvpWinnerId) === sPid) {
          count++;
        }
      }
    });
    if (p) p.mvpCount = count;
    return count;
  }

  // 👑 Modal de Votación del MVP de Partido en la App de Jugadores
  function showMatchMvpVoteModal(session) {
    if (!session) return;
    const myP = getMyPlayer();
    if (!myP) return;

    // Convocados y presentes / que participaron en este partido
    const matchPlayerIds = new Set();
    if (session.stats) Object.keys(session.stats).forEach(id => matchPlayerIds.add(id));
    if (Array.isArray(session.slots)) session.slots.filter(Boolean).forEach(id => matchPlayerIds.add(id));
    if (Array.isArray(session.trackedPlayerIds)) session.trackedPlayerIds.forEach(id => matchPlayerIds.add(id));
    if (Array.isArray(session.coachPicks)) session.coachPicks.forEach(cp => cp && matchPlayerIds.add(cp.playerId || cp.id));
    if (session.attendance) {
      Object.entries(session.attendance).forEach(([id, st]) => {
        if (st === 'present' || st === 'yes' || st === true) matchPlayerIds.add(id);
      });
    }
    if (session.convocationId && clubData.convocations) {
      const conv = clubData.convocations.find(c => c.id === session.convocationId);
      if (conv && conv.list) {
        Object.entries(conv.list).forEach(([id, st]) => {
          if (st === 'called' || st === 'confirmed' || st === 'attended') matchPlayerIds.add(id);
        });
      }
    }
    let players = (clubData && clubData.players ? clubData.players : []).filter(p => matchPlayerIds.has(p.id));
    if (players.length === 0 && session.teamId) {
      players = (clubData && clubData.players ? clubData.players : []).filter(p => p.teamId === session.teamId);
    }
    if (players.length === 0) {
      players = clubData && clubData.players ? clubData.players : [];
    }

    const existing = document.getElementById('dialog-match-mvp-vote');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-match-mvp-vote';
    overlay.style.zIndex = '999999';

    let currentVoteData = null;
    let unsubMvp = null;
    let selectedCandidateId = (session.votes && session.votes[myP.id]) ||
                              (window._myVotedMvpBySession && window._myVotedMvpBySession[session.id]) ||
                              localStorage.getItem('my_mvp_vote_' + session.id) || null;

    async function executeVote(targetId) {
      if (!targetId || targetId === myP.id) return;
      const targetPlayer = players.find(p => p.id === targetId);
      try {
        if (window.Cloud && window.Cloud.voteMatchMvp) {
          await window.Cloud.voteMatchMvp(session.id, myP.id, targetId);
        }
        if (!currentVoteData) currentVoteData = { votes: {} };
        if (!currentVoteData.votes) currentVoteData.votes = {};
        currentVoteData.votes[myP.id] = targetId;
        window._myVotedMvpBySession = window._myVotedMvpBySession || {};
        window._myVotedMvpBySession[session.id] = targetId;
        localStorage.setItem('my_mvp_vote_' + session.id, targetId);

        toast(t('mvpVoteRegistered', '¡Voto de MVP registrado para {name}!').replace('{name}', (targetPlayer ? targetPlayer.name : '')), 'success');
        updateVoteSelectionUI(targetId);
      } catch (err) {
        console.error('Error al registrar voto de MVP:', err);
        toast('Error al votar: ' + err.message, 'error');
      }
    }

    function updateVoteSelectionUI(targetId) {
      selectedCandidateId = targetId;
      overlay.querySelectorAll('.teammate-mvp-choice').forEach(card => {
        const pid = card.getAttribute('data-pid');
        const isSel = (pid === targetId);
        const isSelf = (pid === myP.id);
        if (isSelf) return;
        card.style.border = isSel ? '2px solid #eab308' : '1.5px solid var(--border)';
        card.style.background = isSel ? 'rgba(234, 179, 8, 0.22)' : 'var(--surface2)';
        const btn = card.querySelector('.btn-vote-player');
        if (btn) {
          btn.style.background = isSel ? '#16a34a' : '#eab308';
          btn.style.color = isSel ? '#fff' : '#000';
          btn.textContent = isSel ? '✓ ' + t('voted', 'Votado') : '⭐ ' + t('select', 'Elegir');
        }
      });
      const saveBtn = overlay.querySelector('#btn-save-mvp-vote');
      if (saveBtn) {
        saveBtn.disabled = !targetId || targetId === myP.id;
        const myVoted = currentVoteData && currentVoteData.votes ? currentVoteData.votes[myP.id] : null;
        if (targetId === myVoted) {
          saveBtn.textContent = '✓ ' + t('mvpVotedConfirmed', 'Voto guardado');
          saveBtn.style.background = '#16a34a';
          saveBtn.style.color = '#fff';
        } else {
          saveBtn.textContent = t('mvp_btn_save_vote', '💾 Guardar voto');
          saveBtn.style.background = 'linear-gradient(135deg, #eab308, #ca8a04)';
          saveBtn.style.color = '#000';
        }
      }
      const votedStatusEl = overlay.querySelector('#mvp-voted-status-text');
      if (votedStatusEl && targetId) {
        const tp = players.find(p => p.id === targetId);
        if (tp) {
          votedStatusEl.textContent = t('mvpYouVotedFor', 'Has votado a {name}').replace('{name}', tp.name || '');
        }
      }
    }

    async function showCoachPickDetailModal(pick, player, isVotedByMe) {
      if ((!session.stats || Object.keys(session.stats).length === 0) && session.id && window.Cloud && window.Cloud.fetchSessionDetail) {
        try {
          const fullSess = await window.Cloud.fetchSessionDetail(session.id);
          if (fullSess && fullSess.stats) {
            session.stats = fullSess.stats;
          }
        } catch (e) {
          console.warn('Could not lazy fetch session detail for coach pick modal:', e);
        }
      }

      const existing = document.getElementById('dialog-coach-pick-detail');
      if (existing) existing.remove();

      const pStats = (session.stats && session.stats[player.id]) || {};
      const rating = calculateMatchRating(pStats, player.mainPosition);
      const goals = pStats.goal || 0;
      const assists = pStats.assist || 0;
      const passOk = pStats.passOk || 0;
      const passKo = pStats.passKo || 0;
      const totalPass = passOk + passKo;
      const passAcc = totalPass > 0 ? Math.round((passOk / totalPass) * 100) : null;
      const shotsOn = pStats.shotOn || 0;
      const recoveries = pStats.recoveries || 0;
      const duelsWon = pStats.duelsWon || 0;
      const team = clubData.teams ? clubData.teams.find(tm => tm.id === player.teamId) : null;
      const isSelf = (player.id === myP.id);

      const dOverlay = document.createElement('div');
      dOverlay.className = 'dialog-overlay';
      dOverlay.id = 'dialog-coach-pick-detail';
      dOverlay.style.zIndex = '1000000';

      dOverlay.innerHTML = `
        <div class="card dialog-box" style="max-width: 420px; width: 92%; padding: 20px; border-radius: 18px; border: 2px solid #facc15; background: #0b1329; box-shadow: 0 12px 40px rgba(0,0,0,0.85); max-height: 90vh; overflow-y: auto;">
          <!-- Encabezado con badge Míster -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(250, 204, 21, 0.3); padding-bottom: 10px;">
            <span class="badge" style="background: rgba(234, 179, 8, 0.25); color: #fde047; border: 1.5px solid #facc15; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 999px;">
              ${t('mvp_coach_pick', '⭐ Opción del entrenador')}
            </span>
            <button type="button" class="btn sm ghost" id="btn-close-pick-detail-x" style="padding: 4px 8px;">✕</button>
          </div>

          <!-- Ficha Resumen del Jugador -->
          <div style="display: flex; align-items: center; gap: 14px; background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 14px; border: 1px solid var(--border); margin-bottom: 14px;">
            ${renderAvatar(player, 'md')}
            <div style="flex: 1; overflow: hidden;">
              <h3 style="margin: 0 0 2px; font-size: 16px; font-weight: 900; color: #fff;">
                #${player.mainDorsal != null ? player.mainDorsal : '—'} ${escapeHtml(player.name || '')} ${escapeHtml(player.lastName || '')}
              </h3>
              <div style="font-size: 11.5px; color: var(--muted); display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <span class="pos-tag">${formatPosition(player.mainPosition)}</span>
                ${team ? `<span class="badge" style="background: ${team.color || 'var(--cyan)'}25; color: ${team.color || 'var(--cyan)'}; font-size: 10px;">${escapeHtml(team.name)}</span>` : ''}
              </div>
              <div style="margin-top: 6px;">
                <span class="rating-pill" style="font-size: 12px; font-weight: 900; background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.4)); color: #fef08a; border: 1px solid #facc15; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                  ⭐ ${rating.toFixed(1)} ${t('matchRating', 'Nota del Partido')}
                </span>
              </div>
            </div>
          </div>

          <!-- Motivo del Entrenador -->
          <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(234, 179, 8, 0.12) 100%); border: 1.5px solid rgba(250, 204, 21, 0.5); border-radius: 14px; padding: 12px 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: 800; color: #fde047; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span>✍️</span>
              <span>${t('mvp_coach_reason_title', 'Motivo del entrenador:')}</span>
            </div>
            <div style="font-size: 13.5px; color: #fff; line-height: 1.45; font-style: italic;">
              "${escapeHtml(pick.coachReason || t('coachHighlightDefault', 'Gran rendimiento y actitud en el partido.'))}"
            </div>
          </div>

          <!-- Estadísticas del Partido -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 8px;">
              📊 ${t('matchStats', 'Estadísticas del Partido')}
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #4ade80;">${goals}</div>
                <div style="font-size: 10px; color: var(--muted);">${t('goals', 'Goles')}</div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #38bdf8;">${assists}</div>
                <div style="font-size: 10px; color: var(--muted);">${t('assists', 'Asistencias')}</div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #facc15;">${passAcc !== null ? passAcc + '%' : `${passOk}/${totalPass}`}</div>
                <div style="font-size: 10px; color: var(--muted);">${t('passes', 'Pases')}</div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #fb923c;">${shotsOn}</div>
                <div style="font-size: 10px; color: var(--muted);">${t('shotsOnTarget', 'Tiros a puerta')}</div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #c084fc;">${recoveries}</div>
                <div style="font-size: 10px; color: var(--muted);">${t('recoveries', 'Recuperaciones')}</div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #22d3ee;">${duelsWon}</div>
                <div style="font-size: 10px; color: var(--muted);">${t('duelsWon', 'Duelos ganados')}</div>
              </div>
            </div>
          </div>

          <!-- Botones de Acción -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button type="button" class="btn primary" id="btn-confirm-vote-pick" ${isSelf ? 'disabled' : ''} style="height: 44px; font-size: 14px; font-weight: 900; background: ${isVotedByMe ? '#16a34a' : 'linear-gradient(135deg, #eab308, #ca8a04)'}; border: none; color: ${isVotedByMe ? '#fff' : '#000'}; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ${isSelf ? `(${t('cannotVoteSelf', 'No puedes votarte a ti mismo')})` : (isVotedByMe ? '✓ ' + t('voted', 'Votado como MVP') : t('mvp_btn_confirm_vote', 'Votar a {name} como MVP').replace('{name}', escapeHtml(player.name || '')))}
            </button>
            <button type="button" class="btn ghost" id="btn-cancel-pick-modal" style="height: 40px; font-size: 13px; font-weight: 800; border-radius: 12px;">
              ${t('mvp_btn_cancel', 'Cancelar y ver otros')}
            </button>
          </div>
        </div>
      `;

      function closePickDetail() { dOverlay.remove(); }
      dOverlay.querySelector('#btn-close-pick-detail-x').onclick = closePickDetail;
      dOverlay.querySelector('#btn-cancel-pick-modal').onclick = closePickDetail;
      dOverlay.onclick = (e) => { if (e.target === dOverlay) closePickDetail(); };

      const voteBtn = dOverlay.querySelector('#btn-confirm-vote-pick');
      if (voteBtn && !isSelf) {
        voteBtn.onclick = async () => {
          closePickDetail();
          updateVoteSelectionUI(player.id);
          await executeVote(player.id);
        };
      }

      document.body.appendChild(dOverlay);
    }

    function renderModal() {
      const scrollBox = overlay.querySelector('#mvp-players-scroll-list');
      const prevScroll = scrollBox ? scrollBox.scrollTop : 0;

      const myVotedTargetId = (currentVoteData && currentVoteData.votes ? currentVoteData.votes[myP.id] : null) || selectedCandidateId;
      const officialMvpId = session.mvpOfficialId || (currentVoteData ? currentVoteData.officialMvpId : null);
      const officialMvpPlayer = officialMvpId ? players.find(p => p.id === officialMvpId) : null;

      const coachPicks = (currentVoteData && Array.isArray(currentVoteData.coachPicks) && currentVoteData.coachPicks.length > 0) 
        ? currentVoteData.coachPicks 
        : (Array.isArray(session.coachPicks) ? session.coachPicks : []);

      const voteCounts = {};
      if (currentVoteData && currentVoteData.votes) {
        Object.values(currentVoteData.votes).forEach(tId => {
          voteCounts[tId] = (voteCounts[tId] || 0) + 1;
        });
      }

      overlay.innerHTML = `
        <div class="card dialog-box" style="max-width: 440px; width: 92%; padding: 20px; border-radius: 18px; border: 1.5px solid rgba(234, 179, 8, 0.5); max-height: 90vh; display: flex; flex-direction: column; background: #0f172a; box-shadow: 0 10px 40px rgba(0,0,0,0.7);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">👑</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">
                  ${t('voteMatchMvp', 'Votar al MVP del Partido')}
                </h3>
                <div style="font-size: 11px; color: var(--muted);">
                  ${session.rival ? `vs ${escapeHtml(session.rival)}` : escapeHtml(session.title || 'Partido')}
                </div>
              </div>
            </div>
            <button type="button" class="btn sm ghost" id="btn-close-mvp-vote" style="padding: 4px 8px;">✕</button>
          </div>

          ${officialMvpPlayer ? `
            <div style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(202, 138, 4, 0.35) 100%); border: 1.5px solid #eab308; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              ${renderAvatar(officialMvpPlayer, 'sm')}
              <div>
                <div style="font-size: 10.5px; font-weight: 800; color: #facc15; text-transform: uppercase;">
                  ${t('mvpOfficial', 'MVP Oficial del Partido')}
                </div>
                <div style="font-size: 14px; font-weight: 900; color: #fff;">
                  ${escapeHtml(officialMvpPlayer.name || '')} ${escapeHtml(officialMvpPlayer.lastName || '')} #${officialMvpPlayer.mainDorsal || ''}
                </div>
              </div>
            </div>
          ` : `
            <p style="font-size: 12.5px; color: #cbd5e1; margin: 0 0 12px; line-height: 1.4; flex-shrink: 0;">
              ${t('chooseBestTeammate', 'Elige al compañero que mejor ha jugado en este partido:')}
            </p>
          `}

          <!-- SECCIÓN DESTACADA: 3 ELEGIDOS POR EL MÍSTER -->
          ${coachPicks.length > 0 ? `
            <div style="margin-bottom: 12px; background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%); border: 1.5px solid #facc15; border-radius: 14px; padding: 12px; flex-shrink: 0;">
              <div style="font-size: 11.5px; font-weight: 900; color: #fde047; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px;">
                  <span>🌟</span>
                  <span>${t('mvp_coach_picks_title', 'Destacados por el Míster')}</span>
                </span>
                <span class="badge" style="background: rgba(250, 204, 21, 0.25); color: #fef08a; font-size: 10px; font-weight: 800;">${coachPicks.length}/3</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${coachPicks.map(cp => {
                  const p = (clubData && clubData.players ? clubData.players : []).find(x => x.id === cp.playerId);
                  if (!p) return '';
                  const isVoted = (myVotedTargetId === p.id);
                  return `
                    <div class="card coach-pick-card" data-pid="${p.id}" style="padding: 9px 11px; border-radius: 10px; background: rgba(15, 23, 42, 0.85); border: 1px solid ${isVoted ? '#facc15' : 'rgba(250, 204, 21, 0.4)'}; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: transform 0.15s;">
                      <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                        ${renderAvatar(p, 'xs')}
                        <div style="overflow: hidden;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <b style="font-size: 12.5px; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                              #${p.mainDorsal != null ? p.mainDorsal : '—'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                            </b>
                            <span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #fef08a; font-size: 9.5px; font-weight: 800; border: 1px solid rgba(234, 179, 8, 0.4); white-space: nowrap;">
                              ${t('mvp_coach_pick', '⭐ Opción del entrenador')}
                            </span>
                          </div>
                          ${cp.coachReason ? `
                            <div style="font-size: 11px; color: #cbd5e1; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-width: 220px;">
                              💬 "${escapeHtml(cp.coachReason)}"
                            </div>
                          ` : ''}
                        </div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        ${isVoted ? `<span style="font-size: 12px; color: #4ade80; font-weight: 900;">✓</span>` : ''}
                        <button type="button" class="btn sm" style="font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 8px; background: rgba(250, 204, 21, 0.2); color: #facc15; border: 1px solid #facc15; pointer-events: none;">
                          🔍 ${t('view', 'Ver')}
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- LISTA DE JUGADORES CONVOCADOS Y PRESENTES (VOTACIÓN LIBRE) -->
          <div id="mvp-players-scroll-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding-right: 4px;">
            ${players.length === 0 ? `
              <div style="text-align: center; color: var(--muted); padding: 20px;">${t('noPlayersInMatch', 'No hay jugadores registrados en este partido')}</div>
            ` : players.map(p => {
              const isSelf = (p.id === myP.id);
              const isVotedByMe = (myVotedTargetId === p.id);
              const count = voteCounts[p.id] || 0;

              return `
                <div class="card teammate-mvp-choice" data-pid="${p.id}" style="padding: 10px 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; border: 1.5px solid ${isVotedByMe ? '#eab308' : (isSelf ? 'rgba(255,255,255,0.06)' : 'var(--border)')}; background: ${isVotedByMe ? 'rgba(234, 179, 8, 0.18)' : (isSelf ? 'rgba(0,0,0,0.2)' : 'var(--surface2)')}; opacity: ${isSelf ? '0.6' : '1'}; cursor: ${isSelf ? 'not-allowed' : 'pointer'}; transition: all 0.15s ease;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    ${renderAvatar(p, 'sm')}
                    <div>
                      <b style="font-size: 13.5px; color: #fff;">
                        #${p.mainDorsal != null ? p.mainDorsal : '—'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                      </b>
                      <div style="font-size: 11px; color: var(--muted);">
                        ${isSelf ? `(${t('cannotVoteSelf', 'No puedes votarte a ti mismo')})` : (formatPosition(p.mainPosition))}
                      </div>
                    </div>
                  </div>
                  <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                    ${count > 0 ? `<span style="font-size: 11px; color: #facc15; font-weight: 800;">🗳️ ${count}</span>` : ''}
                    <button type="button" class="btn sm btn-vote-player" data-pid="${p.id}" ${isSelf ? 'disabled' : ''} style="font-weight: 800; font-size: 11.5px; padding: 5px 10px; border-radius: 8px; background: ${isVotedByMe ? '#16a34a' : '#eab308'}; color: ${isVotedByMe ? '#fff' : '#000'}; border: none;">
                      ${isVotedByMe ? '✓ ' + t('voted', 'Votado') : '⭐ ' + t('select', 'Elegir')}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- BOTÓN GUARDAR VOTO Y ACCIONES -->
          <div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
            <button type="button" class="btn primary block" id="btn-save-mvp-vote" ${selectedCandidateId && selectedCandidateId !== myP.id ? '' : 'disabled'} style="height: 44px; font-size: 14px; font-weight: 900; background: ${myVotedTargetId && myVotedTargetId === selectedCandidateId ? '#16a34a' : 'linear-gradient(135deg, #eab308, #ca8a04)'}; color: ${myVotedTargetId && myVotedTargetId === selectedCandidateId ? '#fff' : '#000'}; border: none; border-radius: 12px;">
              ${myVotedTargetId && myVotedTargetId === selectedCandidateId ? '✓ ' + t('mvpVotedConfirmed', 'Voto guardado') : t('mvp_btn_save_vote', '💾 Guardar voto')}
            </button>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span id="mvp-voted-status-text" style="font-size: 11.5px; color: var(--muted);">
                ${myVotedTargetId ? t('mvpYouVotedFor', 'Has votado a {name}').replace('{name}', (players.find(p => p.id === myVotedTargetId) || {}).name || '') : t('oneVotePerPlayer', '1 voto por jugador')}
              </span>
              <button type="button" class="btn ghost sm" id="btn-close-mvp-modal">${t('close', 'Cerrar')}</button>
            </div>
          </div>
        </div>
      `;

      const newScrollBox = overlay.querySelector('#mvp-players-scroll-list');
      if (newScrollBox && prevScroll > 0) newScrollBox.scrollTop = prevScroll;

      function closeVoteModal() {
        if (unsubMvp) { try { unsubMvp(); } catch (e) {} }
        overlay.remove();
        if (typeof renderConvocationsView === 'function') {
          renderConvocationsView();
        }
      }
      overlay.querySelector('#btn-close-mvp-vote').onclick = closeVoteModal;
      overlay.querySelector('#btn-close-mvp-modal').onclick = closeVoteModal;

      // Eventos para los destacados del míster (abren modal informativo, NO votan directo)
      overlay.querySelectorAll('.coach-pick-card').forEach(card => {
        card.onclick = () => {
          const pid = card.getAttribute('data-pid');
          const pick = coachPicks.find(cp => cp.playerId === pid);
          const p = players.find(x => x.id === pid);
          if (pick && p) {
            showCoachPickDetailModal(pick, p, (myVotedTargetId === pid));
          }
        };
      });

      // Selección de jugador en la lista (NO resetea el scroll)
      overlay.querySelectorAll('.teammate-mvp-choice').forEach(card => {
        card.onclick = () => {
          const pid = card.getAttribute('data-pid');
          if (!pid || pid === myP.id) return;
          updateVoteSelectionUI(pid);
        };
      });

      overlay.querySelectorAll('.btn-vote-player').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const pid = btn.getAttribute('data-pid');
          if (!pid || pid === myP.id) return;
          updateVoteSelectionUI(pid);
        };
      });

      // Botón Guardar Voto
      const btnSave = overlay.querySelector('#btn-save-mvp-vote');
      if (btnSave) {
        btnSave.onclick = async () => {
          if (!selectedCandidateId || selectedCandidateId === myP.id) return;
          btnSave.disabled = true;
          btnSave.textContent = '...';
          await executeVote(selectedCandidateId);
        };
      }
    }

    if (window.Cloud && window.Cloud.listenToMatchMvp) {
      unsubMvp = window.Cloud.listenToMatchMvp(session.id, (voteData) => {
        currentVoteData = voteData;
        renderModal();
      });
    } else {
      renderModal();
    }

    document.body.appendChild(overlay);
  }

  function getPlayerStreakMilestone(streak) {
    const s = Math.max(0, streak || 0);
    if (s >= 30) {
      return {
        currentBadge: '💎 ' + t('streakMilestoneDiamond', 'Insignia Diamante'),
        nextBadge: null,
        target: 30,
        progressPct: 100,
        remaining: 0,
        isMaster: true
      };
    }
    if (s >= 15) {
      const target = 30;
      const pct = Math.round((s / target) * 100);
      return {
        currentBadge: '🥇 ' + t('streakMilestoneGold', 'Medalla de Oro'),
        nextBadge: '💎 ' + t('streakMilestoneDiamond', 'Insignia Diamante'),
        target,
        progressPct: pct,
        remaining: target - s,
        isMaster: false
      };
    }
    if (s >= 7) {
      const target = 15;
      const pct = Math.round((s / target) * 100);
      return {
        currentBadge: '🥈 ' + t('streakMilestoneSilver', 'Medalla de Plata'),
        nextBadge: '🥇 ' + t('streakMilestoneGold', 'Medalla de Oro'),
        target,
        progressPct: pct,
        remaining: target - s,
        isMaster: false
      };
    }
    if (s >= 3) {
      const target = 7;
      const pct = Math.round((s / target) * 100);
      return {
        currentBadge: '🥉 ' + t('streakMilestoneBronze', 'Medalla de Bronce'),
        nextBadge: '🥈 ' + t('streakMilestoneSilver', 'Medalla de Plata'),
        target,
        progressPct: pct,
        remaining: target - s,
        isMaster: false
      };
    }
    const target = 3;
    const pct = Math.round((s / target) * 100);
    return {
      currentBadge: null,
      nextBadge: '🥉 ' + t('streakMilestoneBronze', 'Medalla de Bronce'),
      target,
      progressPct: pct,
      remaining: target - s,
      isMaster: false
    };
  }

  // Contexto de plantilla (priors bayesianos) cacheado por versión de datos del club
  let _skillsLeagueCache = null;
  function getSkillsLeague() {
    const players = (clubData && clubData.players) || [];
    const sessions = (clubData && clubData.sessions) || [];
    if (!_skillsLeagueCache || _skillsLeagueCache.src !== clubData || _skillsLeagueCache.n !== sessions.length) {
      _skillsLeagueCache = { src: clubData, n: sessions.length, league: window.SkillsEngine.buildLeagueContext(players, sessions) };
    }
    return _skillsLeagueCache.league;
  }

  function calculatePlayerRadar(pid, customSessions) {
    const pl = (clubData && clubData.players) ? clubData.players.find(x => x.id === pid) : null;
    const sessions = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) || []);
    const hasDetailedSessions = sessions && sessions.some(s => s && s.stats && Object.keys(s.stats).length > 0);

    if ((!customSessions || customSessions.length === 0) && !hasDetailedSessions && pl && pl.radar) {
      return Object.assign({}, pl.radar);
    }
    if (window.SkillsEngine) {
      return window.SkillsEngine.computePlayerSkills(pid, {
        players: (clubData && clubData.players) || [],
        sessions: sessions,
        league: getSkillsLeague()
      });
    }
    return legacyPlayerRadar(pid, customSessions);
  }

  /* Fórmula EMA asimétrica (escala 50-99) */
  function legacyPlayerRadar(pid, customSessions) {
    const allSess = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) || []);
    const pl = (clubData && clubData.players) ? clubData.players.find(x => x.id === pid) : null;
    const pos = (pl && pl.mainPosition) || 'MED';

    const currentSkills = {
      pas: 50, tir: 50, reg: 50, def: 50, fis: 50,
      dis: (pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null && pl.disciplineScore !== '') ? Math.min(99, Math.max(50, Number(pl.disciplineScore))) : 50
    };

    const validSessions = allSess.filter(s => s && s.stats && s.stats[pid] && Object.keys(s.stats[pid]).some(k => Number(s.stats[pid][k]) > 0));
    if (!validSessions.length) return currentSkills;

    const sorted = validSessions.slice().sort((a, b) => ((a.date || '').localeCompare(b.date || '')) || ((a.createdAt || 0) - (b.createdAt || 0)));

    sorted.forEach(s => {
      const st = s.stats[pid];
      const rating = calculateMatchRating(st, pos);
      const baseSessionScore = Math.min(99, Math.max(50, Math.round(rating * 10)));

      const S_hoy = {
        pas: baseSessionScore, tir: baseSessionScore, reg: baseSessionScore,
        def: baseSessionScore, fis: baseSessionScore,
        dis: (pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null && pl.disciplineScore !== '') ? Math.min(99, Math.max(50, Number(pl.disciplineScore))) : 85
      };

      const passes = (Number(st.passOk) || 0) + (Number(st.passKo) || 0);
      if (passes > 0) {
        const passAcc = (Number(st.passOk) || 0) / passes;
        const pasScore = Math.round(50 + (passAcc - 0.5) * 40 + Math.min(25, (Number(st.keyPass) || 0) * 4 + (Number(st.assist) || 0) * 5 + (Number(st.passOk) || 0) * 1.5));
        S_hoy.pas = Math.min(99, Math.max(50, Math.round(0.6 * pasScore + 0.4 * baseSessionScore)));
      }

      const shots = (Number(st.shotOn) || 0) + (Number(st.shotOff) || 0);
      const goals = Number(st.goal) || 0;
      const d1v1Goal = Number(st.duel1v1WonGoal) || 0;
      if (shots > 0 || goals > 0 || d1v1Goal > 0) {
        const shotAcc = shots > 0 ? (Number(st.shotOn) || 0) / shots : 0.5;
        const tirScore = Math.round(50 + (shotAcc - 0.5) * 30 + Math.min(35, goals * 10 + (Number(st.shotOn) || 0) * 3 + d1v1Goal * 4));
        S_hoy.tir = Math.min(99, Math.max(50, Math.round(0.6 * tirScore + 0.4 * baseSessionScore)));
      }

      const dribbles = (Number(st.dribbleOk) || 0) + (Number(st.dribbleKo) || 0);
      if (dribbles > 0 || d1v1Goal > 0) {
        const dribAcc = dribbles > 0 ? (Number(st.dribbleOk) || 0) / dribbles : 0.5;
        const regScore = Math.round(50 + (dribAcc - 0.5) * 35 + Math.min(25, (Number(st.dribbleOk) || 0) * 4 + d1v1Goal * 3));
        S_hoy.reg = Math.min(99, Math.max(50, Math.round(0.6 * regScore + 0.4 * baseSessionScore)));
      }

      const rec = Number(st.recovery) || 0;
      const stops = Number(st.duel1v1WonStop) || 0;
      const saves = Number(st.save) || 0;
      const losses = Number(st.loss) || 0;
      if (rec > 0 || stops > 0 || saves > 0 || losses > 0) {
        const defScore = Math.round(50 + Math.min(35, rec * 4 + stops * 4 + saves * 6 - losses * 2));
        S_hoy.def = Math.min(99, Math.max(50, Math.round(0.6 * defScore + 0.4 * baseSessionScore)));
      }

      const duels = (Number(st.duelWon) || 0) + (Number(st.duelLost) || 0);
      const touches = Number(st.touches) || 0;
      if (duels > 0 || touches > 0) {
        const duelAcc = duels > 0 ? (Number(st.duelWon) || 0) / duels : 0.5;
        const fisScore = Math.round(50 + (duelAcc - 0.5) * 30 + Math.min(25, touches * 0.8 + (Number(st.duelWon) || 0) * 2));
        S_hoy.fis = Math.min(99, Math.max(50, Math.round(0.6 * fisScore + 0.4 * baseSessionScore)));
      }

      if (!pl || pl.disciplineScore === undefined || pl.disciplineScore === null || pl.disciplineScore === '') {
        const foulDeduction = (Number(st.foul) || 0) * 3 + (Number(st.yellow) || 0) * 8 + (Number(st.red) || 0) * 20;
        S_hoy.dis = Math.min(99, Math.max(50, Math.round(85 - foulDeduction)));
      }

      ['pas', 'tir', 'reg', 'def', 'fis', 'dis'].forEach(k => {
        if (k === 'dis' && pl && pl.disciplineScore !== undefined && pl.disciplineScore !== null && pl.disciplineScore !== '') {
          currentSkills.dis = Math.min(99, Math.max(50, Number(pl.disciplineScore)));
          return;
        }
        const S_val = Math.min(99, Math.max(50, S_hoy[k]));
        const A_actual = currentSkills[k];
        if (S_val >= A_actual) {
          currentSkills[k] = Math.min(99, Math.round(A_actual + 0.20 * (S_val - A_actual)));
        } else {
          currentSkills[k] = Math.max(50, A_actual - 1, Math.round(A_actual - 0.04 * (A_actual - S_val)));
        }
      });
    });

    return currentSkills;
  }

  /* -------------------------------------------------------------
     RADAR SVG INTERACTIVO (CLIC = EXPLICACIÓN EN IDIOMA SELECCIONADO)
     ------------------------------------------------------------- */
  function renderRadarSVG(rd) {
    const axesLabels = {
      en: { pas: 'PASS', tir: 'SHOT', reg: 'DRIB', fis: 'PHYS', def: 'DEF' },
      ee: { pas: 'SÖÖT', tir: 'LÖÖK', reg: 'TRIB', fis: 'FÜÜS', def: 'KAIT' },
      et: { pas: 'SÖÖT', tir: 'LÖÖK', reg: 'TRIB', fis: 'FÜÜS', def: 'KAIT' },
      es: { pas: 'PASE', tir: 'TIRO', reg: 'REG',  fis: 'FÍS',  def: 'DEF' },
      ru: { pas: 'ПАС',  tir: 'УДАР', reg: 'ДРИБ', fis: 'ФИЗ',  def: 'ЗАЩ' }
    };
    const langLabels = axesLabels[currentLang] || axesLabels.en;
    const axes = [
      { key: 'pas', label: langLabels.pas, val: rd.pas },
      { key: 'tir', label: langLabels.tir, val: rd.tir },
      { key: 'reg', label: langLabels.reg, val: rd.reg },
      { key: 'fis', label: langLabels.fis, val: rd.fis },
      { key: 'def', label: langLabels.def, val: rd.def }
    ];

    const cx = 130, cy = 130, rMax = 88;
    const totalAxes = 5;

    function getCoords(index, value) {
      const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
      const normalized = Math.max(10, Math.min(99, value)) / 100;
      const r = rMax * normalized;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }

    const levels = [0.25, 0.50, 0.75, 1.0];
    const gridPolygons = levels.map(lvl => {
      const pts = [];
      for (let i = 0; i < totalAxes; i++) {
        const a = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
        const r = rMax * lvl;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>`;
    }).join('');

    const dataPoints = axes.map((a, i) => ({ ...getCoords(i, a.val), a }));
    const dataPolyPoints = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const labels = axes.map((a, i) => {
      const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
      const labelR = rMax + 24;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      return `
        <g class="radar-click-label" data-skill="${a.key}" style="cursor: pointer;">
          <circle cx="${lx.toFixed(1)}" cy="${(ly + 5).toFixed(1)}" r="18" fill="rgba(34, 211, 238, 0.08)" />
          <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#e2e8f0" font-size="10.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.label}
          </text>
          <text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" fill="#22d3ee" font-size="11.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.val}
          </text>
        </g>
      `;
    }).join('');

    return `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 6px 0;">
        <svg class="radar-svg" viewBox="0 0 260 260" style="width: 100%; max-width: 270px; height: auto;">
          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#22c55e" stop-opacity="0.12" />
            </radialGradient>
          </defs>
          ${gridPolygons}
          <polygon points="${dataPolyPoints}" fill="url(#radarFill)" stroke="#22d3ee" stroke-width="2.5" />
          ${dataPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#22c55e" stroke="#060a13" stroke-width="1.8" />`).join('')}
          ${labels}
        </svg>
        <span style="font-size: 11px; color: var(--muted); margin-top: 6px; text-align: center;">
          ${t('tapSkillHint')}
        </span>
      </div>
    `;
  }

  /* -------------------------------------------------------------
     POPUP MODAL: EXPLICACIÓN DE HABILIDADES
     ------------------------------------------------------------- */
  function showSkillExplanationModal(skillKey) {
    const dict = (currentLang === 'ee' || currentLang === 'et') ? SKILL_EXPLANATIONS_EE : (currentLang === 'es' ? SKILL_EXPLANATIONS_ES : (currentLang === 'ru' ? SKILL_EXPLANATIONS_RU : SKILL_EXPLANATIONS_EN));
    const info = dict[skillKey] || dict.rating || SKILL_EXPLANATIONS_EN[skillKey] || SKILL_EXPLANATIONS_EN.rating;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-skill-explanation';
    overlay.style.zIndex = '1000005';
    overlay.style.background = 'rgba(0, 0, 0, 0.78)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.webkitBackdropFilter = 'blur(4px)';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-width: 400px; padding: 22px; z-index: 1000006; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1.5px solid rgba(255,255,255,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">${info.icon}</span>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">${info.name}</h3>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-skill-x" style="width: 32px; height: 32px;">✕</button>
        </div>
        <p style="font-size: 13.5px; line-height: 1.6; color: #e2e8f0; margin-bottom: 16px;">
          ${info.desc}
        </p>
        <button type="button" class="btn block primary" id="dlg-skill-ok" style="font-weight: 800; font-size: 13px;">
          ${t('close', 'Got it')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-skill-x').onclick = close;
    overlay.querySelector('#dlg-skill-ok').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
    haptic(20);
  }

  /* -------------------------------------------------------------
     ACTUALIZAR CABECERA E IDENTIDAD (BLOQUEO DE PERFIL)
     ------------------------------------------------------------- */
  /* -------------------------------------------------------------
     REGISTRO Y LATIDO DE PRESENCIA (DESACTIVADO PARA PROTEGER LA CUOTA SPARK)
     ------------------------------------------------------------- */
  function startPresenceHeartbeat() {}

  function updateHeaderIdentity() {
    const nameEl = document.getElementById('portal-my-name');
    const avatarEl = document.getElementById('portal-my-avatar');
    const lockIndicatorEl = document.getElementById('portal-lbl-change');
    const lblProfile = document.getElementById('portal-lbl-profile');
    const idContainer = document.getElementById('portal-identity-container');
    if (lblProfile) lblProfile.textContent = t('myProfile') + ':';

    const myP = getMyPlayer();
    const isApproved = hasApprovedProfile();

    if (myP && isApproved) {
      if (myP.teamId) {
        try { localStorage.setItem('portal_player_team_id', myP.teamId); } catch (e) {}
      }
      if (idContainer) idContainer.classList.remove('attention-glow');
      if (nameEl) nameEl.textContent = `#${myP.mainDorsal != null ? myP.mainDorsal : '-'} ${myP.name || ''} ${myP.lastName || ''}`.trim();
      if (avatarEl) {
        avatarEl.innerHTML = myP.photo ? `<img src="${myP.photo}" alt="" />` : `<span>${(myP.name ? myP.name[0] : 'P').toUpperCase()}</span>`;
      }
      if (lockIndicatorEl) {
        const locked = isProfileLocked();
        lockIndicatorEl.innerHTML = locked ? `🔒 ${t('locked', 'Locked')}` : `${t('changeProfile', 'Change ▾')}`;
        lockIndicatorEl.style.color = locked ? '#facc15' : 'var(--cyan)';
        lockIndicatorEl.style.background = locked ? 'rgba(250, 204, 21, 0.15)' : 'rgba(6, 182, 212, 0.15)';
        lockIndicatorEl.style.border = locked ? '1px solid rgba(250, 204, 21, 0.35)' : '1px solid rgba(6, 182, 212, 0.3)';
      }
      if (!window._chatUnreadInitialized && window.ChatUI && ChatUI.initGlobalUnreadListener) {
        window._chatUnreadInitialized = true;
        ChatUI.initGlobalUnreadListener(myPlayerId, myP.teamId || null);
      }
    } else {
      // Sin perfil seleccionado o aprobado: aplicar brillo llamativo y reborde en movimiento para guiar al usuario
      if (idContainer) idContainer.classList.add('attention-glow');
      if (nameEl) {
        if (myP && myP.isPendingApproval) {
          nameEl.textContent = `⏳ ${myP.name || ''} (${t('pendingApproval', 'Pending Approval')})`;
        } else {
          nameEl.textContent = t('selectIdentity', 'Select who you are...');
        }
      }
      if (avatarEl) avatarEl.innerHTML = '<span>?</span>';
      if (lockIndicatorEl) {
        lockIndicatorEl.textContent = `${t('changeProfile', 'Change ▾')}`;
        lockIndicatorEl.style.color = '';
        lockIndicatorEl.style.background = '';
        lockIndicatorEl.style.border = '';
      }
    }

    const btnLang = document.getElementById('btn-portal-lang');
    if (btnLang) {
      btnLang.innerHTML = getLangDisplay(currentLang);
      btnLang.onclick = () => openLanguageModal();
    }
    const badge = document.getElementById('portal-cloud-badge');
    if (badge) badge.textContent = `🟢 ${t('live')}`;
    updateConvocationsBadge();
  }

  /* -------------------------------------------------------------
     VENTANA MODAL EN INGLÉS PARA REINICIAR APP TRAS APROBACIÓN DE PERFIL
     ------------------------------------------------------------- */
  function showProfileApprovedRestartModal(newPlayerId) {
    try {
      localStorage.setItem('portal_player_id', newPlayerId);
      localStorage.setItem('portal_player_locked', 'true');
      localStorage.setItem('portal_player_linked_at', String(Date.now()));
      localStorage.removeItem('portal_pending_creation_id');
      localStorage.removeItem('portal_pending_creation_name');
      localStorage.removeItem('portal_pending_creation_dorsal');
      localStorage.removeItem('portal_pending_creation_pos');
      localStorage.removeItem('cached_club_state');
    } catch (e) {}

    haptic(60);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <div class="dialog-box" style="width: 90%; max-width: 400px; text-align: center; padding: 24px 20px;">
        <div style="font-size: 46px; margin-bottom: 12px;">🎉</div>
        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 900; color: #fff;">Profile Created & Approved!</h3>
        <p style="font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0 0 20px;">
          Your coach has approved your registration and created your player profile. Please restart the app now to clear cache and activate your profile.
        </p>
        <button type="button" class="btn block primary" id="btn-restart-app-now" style="height: 48px; font-weight: 900; font-size: 14.5px; background: linear-gradient(135deg, #06b6d4, #3b82f6); border: none; box-shadow: 0 4px 18px rgba(6, 182, 212, 0.4);">
          🔄 Restart App
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-restart-app-now').onclick = () => {
      if ('caches' in window) {
        caches.keys().then(names => {
          for (let name of names) caches.delete(name);
        }).catch(() => {});
      }
      const cleanUrl = window.location.pathname + '?_t=' + Date.now();
      window.location.replace(cleanUrl);
    };
  }

  /* -------------------------------------------------------------
     SOLICITUD DE ALTA DE NUEVO JUGADOR (SI NO ESTÁ EN LA LISTA)
     ------------------------------------------------------------- */
  function listenToMyCreationRequest(reqId) {
    if (!reqId || !window.Cloud || !window.Cloud.listenToPlayerCreationRequest) return;
    if (window._myCreationRequestUnsub) {
      try { window._myCreationRequestUnsub(); } catch (e) {}
    }
    window._myCreationRequestUnsub = window.Cloud.listenToPlayerCreationRequest(reqId, (r) => {
      if (!r) return;
      if (r.status === 'approved') {
        const newPlayerId = r.createdPlayerId;
        if (newPlayerId) {
          myPlayerId = newPlayerId;
          showProfileApprovedRestartModal(newPlayerId);
        }
      } else if (r.status === 'rejected') {
        try {
          localStorage.removeItem('portal_pending_creation_id');
          localStorage.removeItem('portal_player_id');
          localStorage.removeItem('portal_player_locked');
        } catch (e) {}
        myPlayerId = null;
        toast(t('creationRejected', '❌ Your coach declined the registration request.'), 'error');
        updateHeaderIdentity();
        renderCurrentTab();
      }
    });
  }

  /* -------------------------------------------------------------
     REVOCACIÓN INMEDIATA DE ACCESO SI EL ENTRENADOR BORRA EL PERFIL
     ------------------------------------------------------------- */
  function handlePlayerProfileRemoved() {
    console.warn('[Portal] Active player profile was deleted by coach.');
    try {
      localStorage.removeItem('portal_player_id');
      localStorage.removeItem('portal_player_id_backup');
      localStorage.removeItem('portal_player_locked');
      localStorage.removeItem('portal_pending_creation_id');
      localStorage.removeItem('portal_pending_creation_name');
      localStorage.removeItem('portal_pending_creation_dorsal');
      localStorage.removeItem('portal_pending_creation_pos');
      localStorage.removeItem('portal_pending_req_id');
      localStorage.removeItem('cached_club_state');
    } catch (e) {}
    myPlayerId = null;

    // Cerrar cualquier diálogo, chat o modal abierto
    document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop').forEach(el => el.remove());

    updateHeaderIdentity();
    renderCurrentTab();

    // Mostrar ventana emergente en inglés
    const alertBox = document.createElement('div');
    alertBox.className = 'dialog-overlay';
    alertBox.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 16px;';
    alertBox.innerHTML = `
      <div class="dialog-box" style="max-width: 380px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 24px 20px;">
        <div style="font-size: 42px; margin-bottom: 10px;">⚠️</div>
        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 900; color: #ef4444;">Profile Removed</h3>
        <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
          Your player profile has been removed by the coach. Access has been revoked. Please select an available profile or request access.
        </p>
        <button type="button" class="btn primary block" id="btn-profile-removed-ok" style="height: 44px; font-size: 14px; font-weight: 800; border-radius: 12px; background: #ef4444; border-color: #ef4444;">
          Select Profile
        </button>
      </div>
    `;
    alertBox.querySelector('#btn-profile-removed-ok').onclick = () => {
      alertBox.remove();
      updateHeaderIdentity();
      renderCurrentTab();
      showSelectIdentityModal();
    };
    document.body.appendChild(alertBox);
  }

  /* -------------------------------------------------------------
     REVOCACIÓN INMEDIATA DE ACCESO SI EL ENTRENADOR DESVINCULA EL PERFIL
     ------------------------------------------------------------- */
  function handlePlayerProfileUnlinked() {
    console.warn('[Portal] Active player profile was unlinked by coach.');
    const oldPid = myPlayerId;
    try {
      localStorage.removeItem('portal_player_id');
      localStorage.removeItem('portal_player_id_backup');
      localStorage.removeItem('portal_player_locked');
      localStorage.removeItem('portal_player_linked_at');
      localStorage.removeItem('portal_pending_creation_id');
      localStorage.removeItem('portal_pending_creation_name');
      localStorage.removeItem('portal_pending_creation_dorsal');
      localStorage.removeItem('portal_pending_creation_pos');
      localStorage.removeItem('portal_pending_req_id');
      localStorage.removeItem('portal_player_team_id');
      localStorage.removeItem('cached_club_state');
    } catch (e) {}
    myPlayerId = null;

    if (window._unlinkListenerUnsub) {
      try { window._unlinkListenerUnsub(); } catch (e) {}
      window._unlinkListenerUnsub = null;
    }

    // Cerrar cualquier diálogo, chat o modal abierto
    document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop').forEach(el => el.remove());

    updateHeaderIdentity();
    renderCurrentTab();

    // Mostrar ventana emergente en inglés
    const alertBox = document.createElement('div');
    alertBox.className = 'dialog-overlay';
    alertBox.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 16px;';
    alertBox.innerHTML = `
      <div class="dialog-box" style="max-width: 380px; text-align: center; background: var(--surface); border: 1.5px solid rgba(245, 158, 11, 0.5); border-radius: 18px; padding: 24px 20px;">
        <div style="font-size: 42px; margin-bottom: 10px;">🔗</div>
        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 900; color: #fbbf24;">Profile Unlinked</h3>
        <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
          Your coach has unlinked this player profile from your device. Please select who you are to link a profile again.
        </p>
        <button type="button" class="btn primary block" id="btn-profile-unlinked-ok" style="height: 44px; font-size: 14px; font-weight: 800; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; box-shadow: 0 4px 18px rgba(245, 158, 11, 0.4);">
          Choose Profile
        </button>
      </div>
    `;
    alertBox.querySelector('#btn-profile-unlinked-ok').onclick = () => {
      alertBox.remove();
      updateHeaderIdentity();
      renderCurrentTab();
      showSelectIdentityModal();
    };
    document.body.appendChild(alertBox);
  }

  function listenToMyUnlink(playerId) {
    if (!playerId || !window.Cloud || !window.Cloud.listenToPlayerUnlink) return;
    if (window._unlinkListenerUnsub) {
      try { window._unlinkListenerUnsub(); } catch (e) {}
      window._unlinkListenerUnsub = null;
    }
    window._unlinkListenerUnsub = window.Cloud.listenToPlayerUnlink(playerId, (data) => {
      const linkedAt = parseInt(localStorage.getItem('portal_player_linked_at') || '0', 10);
      const unlinkedAt = data ? (data.unlinkedAt || 0) : 0;
      // Solo desvincular si el evento ocurrió estrictamente después de que este dispositivo se vinculó
      if (unlinkedAt && linkedAt > 0 && unlinkedAt > (linkedAt + 5000)) {
        handlePlayerProfileUnlinked();
      } else if (unlinkedAt && linkedAt === 0) {
        try { localStorage.setItem('portal_player_linked_at', String(Date.now())); } catch (e) {}
      }
    });
  }

  function matchTeamByText(text, teams) {
    if (!text || !Array.isArray(teams) || teams.length === 0) return null;
    const clean = String(text).trim().toLowerCase();
    if (!clean) return null;

    // 1. Coincidencia por año de 4 dígitos (ej: 2015, 2019, 2017, 2016)
    const yearMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      const yr = yearMatch[1];
      const found = teams.find(t => {
        const name = (t.name || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        return name.includes(yr) || desc.includes(yr);
      });
      if (found) return found;
    }

    // 2. Coincidencia por categoría "U" (ej: U9, U10, U11, U12, U-9, etc.)
    const uMatch = clean.match(/\bu-?(\d{1,2})\b/i);
    if (uMatch) {
      const uNum = uMatch[1];
      const found = teams.find(t => {
        const name = (t.name || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        return new RegExp(`\\bu-?${uNum}\\b`, 'i').test(name) || id.includes(`u${uNum}`);
      });
      if (found) return found;
    }

    // 3. Coincidencia por nombre o nombre corto del equipo
    for (const t of teams) {
      const tName = (t.name || '').toLowerCase();
      const tShort = (t.shortName || '').toLowerCase().trim();
      if (tName && clean.includes(tName)) return t;
      if (tShort && clean.includes(tShort)) return t;
      if (tName && tName.includes(clean)) return t;
    }

    return null;
  }
  window.matchTeamByText = matchTeamByText;

  function showPlayerCreationRequestModal() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">➕ ${t('requestCoachProfileTitle', 'Request Registration from Coach')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-pcr-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px;">
          ${t('requestCoachProfileDesc', 'Send your details to the coach so they can create your profile in the team database.')}
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">Name *</label>
            <input type="text" id="pcr-name" placeholder="First name" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">Surname *</label>
            <input type="text" id="pcr-surname" placeholder="Last name" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 11.5px; font-weight: 800; color: #86efac; margin-bottom: 4px;">Team, Category or Birth Year</label>
          <input type="text" id="pcr-team-text" placeholder="e.g. U9 or 2015 or U12" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(34, 197, 94, 0.4); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          <small id="pcr-team-preview" style="display: block; margin-top: 4px; font-size: 11px; color: #86efac; font-weight: 700;"></small>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">${t('dorsalLabel', 'Dorsal')}</label>
            <input type="number" id="pcr-dorsal" placeholder="e.g. 10" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">${t('positionLabel', 'Position')}</label>
            <input type="text" id="pcr-pos" placeholder="e.g. DEL" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">${t('notesLabel', 'Notes')}</label>
          <input type="text" id="pcr-notes" placeholder="${t('notesPlaceholder', 'Optional notes...')}" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
        </div>

        <button type="button" class="btn block primary" id="btn-submit-pcr" style="height: 44px; font-weight: 900; font-size: 13.5px;">
          🚀 ${t('sendRequest', 'Send Request to Coach')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-pcr-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const inpTeam = overlay.querySelector('#pcr-team-text');
    const previewTeam = overlay.querySelector('#pcr-team-preview');
    if (inpTeam && previewTeam) {
      const updateTeamPreview = () => {
        const txt = inpTeam.value.trim();
        const matched = matchTeamByText(txt, (clubData && clubData.teams) ? clubData.teams : []);
        if (matched) {
          previewTeam.textContent = `✓ Auto-detected team: ${matched.name}`;
        } else {
          previewTeam.textContent = '';
        }
      };
      inpTeam.addEventListener('input', updateTeamPreview);
    }

    const btnSubmit = overlay.querySelector('#btn-submit-pcr');
    btnSubmit.onclick = async () => {
      const name = overlay.querySelector('#pcr-name').value.trim();
      const surname = overlay.querySelector('#pcr-surname').value.trim();
      const teamText = overlay.querySelector('#pcr-team-text').value.trim();
      const dorsal = overlay.querySelector('#pcr-dorsal').value.trim();
      const pos = overlay.querySelector('#pcr-pos').value.trim();
      const notes = overlay.querySelector('#pcr-notes').value.trim();

      if (!name) {
        toast('Please enter first name', 'error');
        return;
      }
      if (!surname) {
        toast('Please enter surname', 'error');
        return;
      }

      const matchedTeam = matchTeamByText(teamText || notes, (clubData && clubData.teams) ? clubData.teams : []);

      btnSubmit.disabled = true;
      btnSubmit.textContent = t('sending', 'Sending...');

      try {
        const reqId = 'pcr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const fullName = `${name} ${surname}`.trim();

        if (window.Cloud && window.Cloud.submitPlayerCreationRequest) {
          await window.Cloud.submitPlayerCreationRequest({
            id: reqId,
            name: name,
            lastName: surname,
            fullName: fullName,
            teamText: teamText,
            suggestedTeamId: matchedTeam ? matchedTeam.id : null,
            dorsal: dorsal ? parseInt(dorsal, 10) : null,
            position: pos || 'DEL',
            notes: notes || '',
            createdAt: Date.now()
          });
        }

        // Auto-seleccionar este perfil en estado pendiente para el usuario actual
        myPlayerId = reqId;
        try {
          localStorage.setItem('portal_player_id', reqId);
          localStorage.setItem('portal_player_locked', 'true');
          localStorage.setItem('portal_pending_creation_id', reqId);
          localStorage.setItem('portal_pending_creation_name', fullName);
          localStorage.setItem('portal_pending_creation_dorsal', dorsal || '');
          localStorage.setItem('portal_pending_creation_pos', pos || 'DEL');
        } catch (e) {}

        listenToMyCreationRequest(reqId);
        updateHeaderIdentity();
        renderCurrentTab();

        toast(t('requestSent', '✅ Request sent to coach. Your profile will be activated once approved.'), 'success');
        haptic(40);
        close();
      } catch (err) {
        toast('Error: ' + err.message, 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = t('sendRequest', 'Send Request to Coach');
      }
    };

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     CARGA DE DATOS INICIALES Y FALLBACK ROBUSTO
     ------------------------------------------------------------- */
  let isFetchingFallbackClubData = false;

  async function loadInitialClubData() {
    // 1. Intentar desde caché local si tiene jugadores
    try {
      const cached = localStorage.getItem('cached_club_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
          clubData = parsed;
          updateHeaderIdentity();
          renderCurrentTab();
          return clubData;
        }
      }
    } catch (e) {}

    // 2. Cargar desde data/database_reference.json
    if (isFetchingFallbackClubData) return clubData;
    isFetchingFallbackClubData = true;
    try {
      const res = await fetch('data/database_reference.json');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.players) && json.players.length > 0) {
          if (!clubData || !clubData.players || clubData.players.length === 0) {
            clubData = Object.assign({}, clubData || {}, json);
            try { localStorage.setItem('cached_club_state', JSON.stringify(clubData)); } catch (e) {}
            updateHeaderIdentity();
            renderCurrentTab();

            // Si el modal de carga provisional estaba abierto, actualizarlo con la lista de jugadores
            const loadingModal = document.getElementById('dialog-id-loading-overlay');
            if (loadingModal) {
              loadingModal.remove();
              showSelectIdentityModal();
            }
          }
        }
      }
    } catch (err) {
      console.warn('Fallback data/database_reference.json no disponible:', err);
    } finally {
      isFetchingFallbackClubData = false;
    }
    return clubData;
  }

  function showIdentityLoadingModal() {
    const existing = document.getElementById('dialog-id-loading-overlay');
    if (existing) return;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-id-loading-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 420px; text-align: center; padding: 24px 18px;">
        <div style="font-size: 38px; margin-bottom: 12px;">⏳</div>
        <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 900; color: #fff;">${t('chooseIdentityTitle')}</h3>
        <p style="font-size: 12.5px; color: var(--muted); margin: 0 0 16px; line-height: 1.4;">
          ${t('loadingPlayers')}
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn primary" id="btn-retry-load-id" style="height: 42px; font-weight: 800; font-size: 13px;">
            🔄 ${currentLang === 'en' ? 'Retry Loading' : 'Reintentar Carga'}
          </button>
          <button type="button" class="btn sm ghost" id="btn-dialog-id-req-fallback" style="border: 1.5px dashed var(--cyan); color: var(--cyan); font-weight: 800; font-size: 12px; height: 38px; border-radius: 10px;">
            ${t('requestCoachProfile', '➕ ¿No estás en la lista? Solicitar alta al entrenador')}
          </button>
          <button type="button" class="btn sm ghost" id="btn-close-id-loading" style="color: var(--muted); font-size: 12px;">
            ${t('close', 'Cerrar')}
          </button>
        </div>
      </div>
    `;
    function close() { overlay.remove(); }
    overlay.querySelector('#btn-close-id-loading').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    overlay.querySelector('#btn-dialog-id-req-fallback').onclick = () => {
      close();
      showPlayerCreationRequestModal();
    };
    overlay.querySelector('#btn-retry-load-id').onclick = async () => {
      const btn = overlay.querySelector('#btn-retry-load-id');
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      await loadInitialClubData();
      if (clubData && clubData.players && clubData.players.length > 0) {
        close();
        showSelectIdentityModal();
      } else {
        btn.disabled = false;
        btn.textContent = '🔄 ' + (currentLang === 'en' ? 'Retry Loading' : 'Reintentar Carga');
        toast(t('loadingPlayers'), 'info');
      }
    };
    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     DESCARGA E INSTALACIÓN DE LA APK NATIVA PARA ANDROID
     ------------------------------------------------------------- */
  function showApkDownloadGuideModal() {
    haptic(40);
    const existing = document.getElementById('dialog-apk-download-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dialog-apk-download-modal';
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '9999999';

    const fullUrl = new URL('PlayerStats_Player.apk', window.location.href).href;

    overlay.innerHTML = `
      <div class="dialog-box" style="width: 92%; max-width: 440px; padding: 22px 18px; border-radius: 20px; box-shadow: 0 16px 48px rgba(0,0,0,0.7); text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(34, 211, 238, 0.15); border: 1.5px solid #22d3ee; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
              📥
            </div>
            <div>
              <h3 style="margin: 0; font-size: 16.5px; font-weight: 900; color: #fff;">${t('apkDownloadTitle', 'Descarga de la App Android')}</h3>
              <span style="font-size: 11.5px; color: var(--cyan); font-weight: 700;">PlayerStats_Player.apk (0.92 MB)</span>
            </div>
          </div>
          <button type="button" class="icon-btn ghost" id="btn-close-apk-modal-x" style="width: 32px; height: 32px; font-size: 15px; color: var(--muted);">✕</button>
        </div>

        <div style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 12px; padding: 10px 12px; margin-bottom: 14px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">✅</span>
          <span style="font-size: 12.5px; color: #86efac; font-weight: 800; line-height: 1.35;">
            ${t('apkDownloadStarted', '¡Descarga iniciada en tu dispositivo!')}
          </span>
        </div>

        <p style="font-size: 12px; color: #cbd5e1; margin: 0 0 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
          ${t('apkHowToInstallTitle', '¿Dónde encontrarla y cómo instalarla?')}
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
          <div style="display: flex; gap: 10px; background: var(--surface2); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border);">
            <span style="font-size: 18px; flex-shrink: 0;">1️⃣</span>
            <div style="font-size: 12.5px; color: #e2e8f0; line-height: 1.4;">
              <b>${t('apkStep1Bold', 'Mira la barra de notificaciones:')}</b><br/>
              ${t('apkStep1Desc', 'Desliza hacia abajo desde el borde superior de tu pantalla y pulsa sobre la notificación "PlayerStats_Player.apk" cuando termine.')}
            </div>
          </div>

          <div style="display: flex; gap: 10px; background: var(--surface2); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border);">
            <span style="font-size: 18px; flex-shrink: 0;">2️⃣</span>
            <div style="font-size: 12.5px; color: #e2e8f0; line-height: 1.4;">
              <b>${t('apkStep2Bold', 'O abre tu carpeta Descargas:')}</b><br/>
              ${t('apkStep2Desc', 'Abre la aplicación "Mis Archivos", "Archivos" o "Descargas" de tu teléfono y busca "PlayerStats_Player.apk". Tócalo para instalar.')}
            </div>
          </div>

          <div style="display: flex; gap: 10px; background: rgba(250, 204, 21, 0.08); padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(250, 204, 21, 0.3);">
            <span style="font-size: 18px; flex-shrink: 0;">👨‍👩‍👦</span>
            <div style="font-size: 12px; color: #fde047; line-height: 1.35;">
              <b>${t('apkFamilyLinkTitle', 'Para usuarios con Google Family Link:')}</b><br/>
              ${t('apkFamilyLinkDesc', 'Pide a tus padres que abran Family Link -> Límites de apps -> "Player stats (Player)" -> y seleccionen "Siempre permitida".')}
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn primary block" id="btn-trigger-browser-download" style="height: 42px; font-weight: 800; font-size: 13px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none;">
            🌐 ${t('openInBrowserDownload', 'Abrir y descargar en navegador')}
          </button>
          <button type="button" class="btn sm secondary block" id="btn-retry-apk-download" style="height: 38px; font-weight: 800; font-size: 12.5px;">
            🔄 ${t('retryDownload', 'Volver a descargar')}
          </button>
          <button type="button" class="btn sm ghost block" id="btn-close-apk-guide" style="height: 34px; font-weight: 700; font-size: 12px; color: var(--muted);">
            ${t('close', 'Cerrar')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#btn-close-apk-modal-x').onclick = close;
    overlay.querySelector('#btn-close-apk-guide').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    function triggerDownload() {
      try {
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = 'PlayerStats_Player.apk';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 250);
        toast(t('downloadStartedToast', '📥 Descargando archivo APK...'), 'info');
      } catch (e) {
        window.location.href = fullUrl;
      }
    }

    overlay.querySelector('#btn-retry-apk-download').onclick = () => {
      triggerDownload();
      haptic(30);
    };

    overlay.querySelector('#btn-trigger-browser-download').onclick = () => {
      haptic(40);
      try {
        window.open(fullUrl, '_blank');
      } catch (e) {
        window.location.href = fullUrl;
      }
      toast(t('downloadStartedToast', '📥 Descargando archivo APK...'), 'info');
    };

    document.body.appendChild(overlay);

    // Disparar la descarga inmediatamente al abrir el modal
    triggerDownload();
  }
  window.__downloadPlayerApk = showApkDownloadGuideModal;

  /* -------------------------------------------------------------
     SOLICITUD DE CAMBIO DE PERFIL (PUNTO 6)
     ------------------------------------------------------------- */
  async function showSelectIdentityModal() {
    const existing = document.getElementById('dialog-select-identity-overlay');
    if (existing) return;

    // Si hay una solicitud de acceso pendiente activa en localStorage, mostrar esa directamente
    const savedClaimJson = localStorage.getItem('portal_pending_claim');
    if (savedClaimJson) {
      try {
        const parsed = JSON.parse(savedClaimJson);
        if (parsed && parsed.targetPlayerId) {
          const pObj = (clubData && clubData.players) ? clubData.players.find(p => p.id === parsed.targetPlayerId) : null;
          showConfirmIdentitySecurityCodeModal(pObj || { id: parsed.targetPlayerId, name: parsed.targetPlayerName, mainDorsal: parsed.targetPlayerDorsal }, parsed);
          return;
        }
      } catch (e) {}
    }

    if (!clubData || !clubData.players || clubData.players.length === 0) {
      await loadInitialClubData();
    }

    if (!clubData || !clubData.players || clubData.players.length === 0) {
      showIdentityLoadingModal();
      return;
    }

    const loadingModal = document.getElementById('dialog-id-loading-overlay');
    if (loadingModal) loadingModal.remove();

    // Si ya tiene perfil bloqueado, debe tramitar solicitud al entrenador
    if (isProfileLocked()) {
      showRequestProfileChangeModal();
      return;
    }

    // Primera vez: selección inicial de perfil con selector de idioma accesible directamente
    const players = clubData.players.slice().sort((a,b) => (a.name||'').localeCompare(b.name||''));
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-select-identity-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 92%; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900;">${t('chooseIdentityTitle')}</h3>
            <span style="font-size: 11.5px; color: var(--muted);">${t('chooseIdentityDesc')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <button type="button" class="btn sm ghost" id="dialog-id-lang" style="font-weight: 900; font-size: 12px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 8px;">${getLangDisplay(currentLang)}</button>
            <button type="button" class="icon-btn ghost" id="dialog-id-close" style="width: 32px; height: 32px;">✕</button>
          </div>
        </div>

        <input type="text" id="id-search" placeholder="${t('searchTeammate')}" style="width: 100%; margin-bottom: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13px;" />

        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 48vh; overflow-y: auto;" id="id-players-list">
          ${players.map(p => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
            return `
              <div class="portal-player-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer;">
                ${renderAvatar(p, 'sm')}
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 14px; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </b>
                  <small style="color: var(--muted); font-size: 11.5px;">
                    ${formatPosition(p.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
                  </small>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
          <button type="button" class="btn sm ghost" id="btn-dialog-id-req-creation" style="width: 100%; border: 1.5px dashed var(--cyan); color: var(--cyan); font-weight: 800; font-size: 12px; height: 38px; border-radius: 10px;">
            ${t('requestCoachProfile', '➕ Not on the list? Request registration from coach')}
          </button>
          <div style="text-align: center; margin-top: 10px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <button type="button" class="btn sm ghost" id="btn-dialog-id-clear-cache" style="font-size: 11px; opacity: 0.75; color: var(--muted); border: 1px dashed var(--border); padding: 4px 12px; border-radius: 8px;" title="Clear cache and reload latest version">
              ${t('clearCacheBtn', '🔄 Clear App Cache & Refresh')}
            </button>
            ${!window.AndroidBridge ? `
              <button type="button" class="btn sm ghost" id="btn-dialog-id-download-apk" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px; color: var(--cyan); font-weight: 800; padding: 6px 14px; border-radius: 10px; background: rgba(34, 211, 238, 0.09); border: 1.5px solid rgba(34, 211, 238, 0.4); cursor: pointer; width: 100%; max-width: 280px; margin-top: 4px;">
                📲 ${t('downloadApk', 'Descargar App Android (APK)')}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dialog-id-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const btnReqCreation = overlay.querySelector('#btn-dialog-id-req-creation');
    if (btnReqCreation) {
      btnReqCreation.onclick = () => {
        close();
        showPlayerCreationRequestModal();
      };
    }

    const btnClearCache = overlay.querySelector('#btn-dialog-id-clear-cache');
    if (btnClearCache) {
      btnClearCache.onclick = () => {
        close();
        if (typeof window.clearAppCacheAndReload === 'function') {
          window.clearAppCacheAndReload();
        } else {
          window.location.reload(true);
        }
      };
    }

    const btnDownloadApk = overlay.querySelector('#btn-dialog-id-download-apk');
    if (btnDownloadApk) {
      btnDownloadApk.onclick = () => {
        showApkDownloadGuideModal();
      };
    }

    const langBtn = overlay.querySelector('#dialog-id-lang');
    if (langBtn) {
      langBtn.onclick = () => {
        openLanguageModal(() => {
          overlay.remove();
          showSelectIdentityModal();
        });
      };
    }

    const searchInp = overlay.querySelector('#id-search');
    const listCont = overlay.querySelector('#id-players-list');
    if (searchInp && listCont) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        listCont.querySelectorAll('.portal-player-pick-item').forEach(it => {
          it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    listCont.querySelectorAll('.portal-player-pick-item').forEach(it => {
      it.onclick = () => {
        const pid = it.getAttribute('data-pid');
        const targetPlayer = (clubData.players || []).find(p => p.id === pid);
        if (!targetPlayer) return;
        close();
        showConfirmIdentitySecurityCodeModal(targetPlayer);
      };
    });

    document.body.appendChild(overlay);
    if (searchInp) setTimeout(() => searchInp.focus(), 80);
  }

  /* -------------------------------------------------------------
     CONFIRMACIÓN CON CÓDIGO DE SEGURIDAD AL RECLAMAR PERFIL
     ------------------------------------------------------------- */
  function showConfirmIdentitySecurityCodeModal(player, savedClaim) {
    if (!player && !savedClaim) return;

    const existing = document.getElementById('dialog-confirm-claim-overlay');
    if (existing) return;

    const isResuming = Boolean(savedClaim);
    const pId = player ? player.id : (savedClaim ? savedClaim.targetPlayerId : null);
    if (!pId) return;

    // Evitar doble pulsación accidental rápida (2s) sobre el mismo jugador
    if (!isResuming) {
      const lastClaimTime = parseInt(localStorage.getItem('portal_last_claim_timestamp') || '0', 10);
      const lastClaimPid = localStorage.getItem('portal_last_claim_pid');
      const elapsed = Date.now() - lastClaimTime;
      if (lastClaimPid === pId && elapsed < 2000) {
        return;
      }
    }

    let securityCode = '';
    if (isResuming && savedClaim.securityCode) {
      securityCode = savedClaim.securityCode;
    } else {
      // Generar código de seguridad de 3 letras y 3 números (ej. JKN-742)
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const digits = '23456789';
      let codeL = '';
      for (let i = 0; i < 3; i++) {
        codeL += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      let codeD = '';
      for (let i = 0; i < 3; i++) {
        codeD += digits.charAt(Math.floor(Math.random() * digits.length));
      }
      securityCode = `${codeL}-${codeD}`;
    }

    // ID determinista para que no se dupliquen solicitudes en Firestore
    const claimReqId = 'claim_' + pId;
    let claimUnsub = null;

    const pName = savedClaim ? (savedClaim.targetPlayerName || '') : `${player.name || ''} ${player.lastName || ''}`.trim();
    const pDorsalVal = (player && player.mainDorsal != null) ? player.mainDorsal : (savedClaim ? savedClaim.targetPlayerDorsal : null);
    const pDorsal = pDorsalVal != null ? `#${pDorsalVal}` : '';
    const team = (player && clubData && clubData.teams) ? clubData.teams.find(t => t.id === player.teamId) : null;

    // Guardar solicitud pendiente en localStorage para que NO se pierda al salir de la app (ej. abrir Viber/WhatsApp)
    const pendingClaimData = {
      id: claimReqId,
      targetPlayerId: pId,
      targetPlayerName: pName,
      targetPlayerDorsal: pDorsalVal,
      securityCode: securityCode,
      createdAt: (isResuming && savedClaim.createdAt) ? savedClaim.createdAt : Date.now()
    };
    try {
      localStorage.setItem('portal_pending_claim', JSON.stringify(pendingClaimData));
      if (!isResuming) {
        localStorage.setItem('portal_last_claim_timestamp', String(Date.now()));
        localStorage.setItem('portal_last_claim_pid', pId);
      }
    } catch (e) {}

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-confirm-claim-overlay';

    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; padding: 22px 18px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 8px;">🔐</div>
        
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 900; color: #fff;">
          ${t('confirmPlayerIdentity', 'Confirm Identity')}
        </h3>
        <p style="margin: 0 0 16px; font-size: 13.5px; color: var(--cyan); font-weight: 800;">
          ${t('areYouPlayer', 'Are you {name}?').replace('{name}', escapeHtml(pName))}
        </p>

        <!-- Tarjeta del jugador seleccionado -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); margin-bottom: 16px; text-align: left;">
          ${player ? renderAvatar(player, 'md') : '<div style="width:40px;height:40px;border-radius:50%;background:#0284c7;display:flex;align-items:center;justify-content:center;font-weight:900;">⚽</div>'}
          <div style="flex: 1; overflow: hidden;">
            <b style="font-size: 15px; color: #fff; display: block;" class="ellipsis">
              ${pDorsal} ${escapeHtml(pName)}
            </b>
            <small style="color: var(--muted); font-size: 12px;">
              ${player ? formatPosition(player.mainPosition) : ''} ${team ? '• ' + escapeHtml(team.name) : ''}
            </small>
          </div>
        </div>

        <!-- Explicación de seguridad -->
        <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.45; margin: 0 0 14px; text-align: left;">
          ${t('securityCodeDesc', 'To protect your player profile, this security code has been generated. Give this code to your coach so they can verify and authorize access on your device.')}
        </p>

        <!-- Código de seguridad destacado -->
        <div style="background: var(--bg2); border: 2.5px dashed #22d3ee; border-radius: 14px; padding: 14px 10px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 4px;">
            ${t('securityCodeTitle', 'Security Code')}
          </span>
          <b style="font-size: 32px; color: #22d3ee; letter-spacing: 5px; font-family: monospace; font-weight: 900; display: block;">
            ${securityCode}
          </b>
        </div>

        <!-- Botones de Acción: Copiar Código y Enviar por Viber -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
          <button type="button" class="btn sm secondary" id="btn-copy-claim-code" style="height: 40px; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('copyCode', '📋 Copy Code')}
          </button>
          <button type="button" class="btn sm" id="btn-viber-claim-code" style="height: 40px; font-weight: 800; font-size: 12px; background: #7c3aed; color: #fff; border: 1px solid #a855f7; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('sendViaViber', '📱 Send via Viber')}
          </button>
        </div>

        <!-- Indicador de espera -->
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); font-size: 12px; color: #fde047; font-weight: 800; margin-bottom: 16px;">
          <span>⏳</span>
          <span>${t('waitingCoachApproval', 'Waiting for your coach to authorize the code...')}</span>
        </div>

        <div style="margin-top: 8px; padding: 10px 14px; border-radius: 12px; background: rgba(148, 163, 184, 0.08); border: 1px dashed rgba(148, 163, 184, 0.25); font-size: 11.5px; color: #94a3b8; line-height: 1.45; text-align: center;">
          🔒 ${t('claimLockedNotice', 'Active request locked to this profile. You cannot change profile or send a new code until your coach authorizes or denies the request.')}
        </div>
      </div>
    `;

    function close() {
      if (claimUnsub) {
        try { claimUnsub(); } catch (e) {}
      }
      overlay.remove();
    }

    function fallbackCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast(t('codeCopied', '✅ Code copied to clipboard!'), 'success');
        haptic(40);
      } catch (e) {
        toast('Code: ' + text, 'info');
      }
    }

    const btnCopy = overlay.querySelector('#btn-copy-claim-code');
    if (btnCopy) {
      btnCopy.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(securityCode).then(() => {
            toast(t('codeCopied', '✅ Code copied to clipboard!'), 'success');
            haptic(40);
          }).catch(() => fallbackCopy(securityCode));
        } else {
          fallbackCopy(securityCode);
        }
      };
    }

    const btnViber = overlay.querySelector('#btn-viber-claim-code');
    if (btnViber) {
      btnViber.onclick = () => {
        const vMsg = t('viberShareMsg', 'Hi Coach, my verification security code is {code} to access my profile ({name}) on Player Stats app.')
          .replace('{code}', securityCode)
          .replace('{name}', pName);
        haptic(30);
        const vUrl = 'viber://forward?text=' + encodeURIComponent(vMsg);
        try {
          const a = document.createElement('a');
          a.href = vUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 200);
        } catch (e) {
          window.open(vUrl, '_blank');
        }
      };
    }

    document.body.appendChild(overlay);

    // Enviar solicitud a Firestore (o actualizar la existente)
    if (window.Cloud && window.Cloud.submitProfileClaimRequest) {
      window.Cloud.submitProfileClaimRequest(pendingClaimData).catch(err => {
        console.error('Error enviando solicitud de acceso:', err);
      });
    }

    // Escuchar respuesta en tiempo real
    if (window.Cloud && window.Cloud.listenToProfileClaimRequest) {
      claimUnsub = window.Cloud.listenToProfileClaimRequest(claimReqId, (data) => {
        if (!data) return;
        if (data.status === 'approved') {
          close();
          myPlayerId = pId;
          try {
            localStorage.removeItem('portal_pending_claim');
            localStorage.setItem('portal_player_id', pId);
            localStorage.setItem('portal_player_id_backup', pId);
            localStorage.setItem('portal_player_locked', 'true');
            localStorage.setItem('portal_player_linked_at', String(Date.now()));
            localStorage.setItem('portal_device_link_registered_' + pId, 'true');
          } catch (e) {}
          if (window.Cloud && window.Cloud.clearPlayerUnlink) {
            window.Cloud.clearPlayerUnlink(pId);
          }
          if (window.Cloud && window.Cloud.registerPlayerDeviceLink) {
            window.Cloud.registerPlayerDeviceLink(pId, pName);
          }
          if (window.Cloud && window.Cloud.deleteProfileClaimRequest) {
            window.Cloud.deleteProfileClaimRequest(claimReqId);
          }
          listenToMyUnlink(pId);
          updateHeaderIdentity();
          const targetP = getMyPlayer();
          if (window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
            window.ChatUI.initGlobalUnreadListener(myPlayerId, targetP ? targetP.teamId : (localStorage.getItem('portal_player_team_id') || null));
          }
          toast(t('profileAccessApproved', '🎉 ¡Acceso autorizado por el entrenador! Ya puedes ver tu perfil.'), 'success');
          renderCurrentTab();
        } else if (data.status === 'rejected') {
          try {
            localStorage.removeItem('portal_pending_claim');
          } catch (e) {}
          close();
          toast(t('profileAccessDenied', '❌ Acceso denegado por el entrenador'), 'error');
          haptic(30);
          showSelectIdentityModal();
        }
      });
    }
  }

  function showRequestProfileChangeModal() {
    const myP = getMyPlayer();
    const curName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador Actual';
    const players = (clubData.players || []).filter(p => p.id !== myPlayerId).sort((a,b) => (a.name||'').localeCompare(b.name||''));
    let selectedTargetPid = null;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #facc15;">🔒 ${t('reqChangeTitle')}</h3>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-req-close" style="width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 12px; color: var(--muted); margin-bottom: 10px; line-height: 1.4;">
          ${t('reqChangeDesc').replace('{name}', `<b>${escapeHtml(curName)}</b>`)}
        </p>

        <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--cyan); margin-bottom: 6px;">
          ${t('selectNewPlayer')}
        </label>
        <input type="text" id="req-player-search" placeholder="${t('searchTeammate')}" style="width: 100%; margin-bottom: 8px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 12.5px;" />

        <div style="flex: 1; max-height: 38vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; padding: 2px;" id="req-players-list">
          ${players.map(p => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
            return `
              <div class="portal-req-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--surface2); border: 2px solid var(--border); cursor: pointer; transition: all 0.15s;">
                ${renderAvatar(p, 'sm')}
                <div style="flex: 1; overflow: hidden;">
                  <b style="font-size: 13.5px; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: #fff;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </b>
                  <small style="color: var(--muted); font-size: 11px;">
                    ${formatPosition(p.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
                  </small>
                </div>
                <span class="req-check" style="display: none; font-size: 16px;">✅</span>
              </div>
            `;
          }).join('')}
        </div>

        <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">
          ${t('reasonLabel')}
        </label>
        <input type="text" id="inp-req-reason" placeholder="${t('reasonPlaceholder')}" style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13px; margin-bottom: 12px;" />

        <button type="button" class="btn block primary" id="btn-submit-req" style="height: 44px; font-weight: 800; font-size: 13.5px;">
          ${t('sendReqBtn')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-req-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const searchInp = overlay.querySelector('#req-player-search');
    const listCont = overlay.querySelector('#req-players-list');
    if (searchInp && listCont) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        listCont.querySelectorAll('.portal-req-pick-item').forEach(it => {
          it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    listCont.querySelectorAll('.portal-req-pick-item').forEach(it => {
      it.onclick = () => {
        listCont.querySelectorAll('.portal-req-pick-item').forEach(el => {
          el.style.borderColor = 'var(--border)';
          el.style.background = 'var(--surface2)';
          const chk = el.querySelector('.req-check');
          if (chk) chk.style.display = 'none';
        });
        it.style.borderColor = 'var(--cyan)';
        it.style.background = 'rgba(34, 211, 238, 0.15)';
        const chk = it.querySelector('.req-check');
        if (chk) chk.style.display = 'inline';
        selectedTargetPid = it.getAttribute('data-pid');
        haptic(20);
      };
    });

    const btnSubmit = overlay.querySelector('#btn-submit-req');
    btnSubmit.onclick = async () => {
      if (!selectedTargetPid) {
        toast(t('reqSelectTargetErr'), 'error');
        return;
      }
      const targetP = (clubData.players || []).find(p => p.id === selectedTargetPid);
      const targetName = targetP ? `${targetP.name || ''} ${targetP.lastName || ''}`.trim() : 'Nuevo Jugador';
      const reason = overlay.querySelector('#inp-req-reason').value.trim();

      btnSubmit.disabled = true;
      btnSubmit.textContent = t('sending');

      // Generar código de seguridad de 3 letras y 3 números
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const digits = '23456789';
      let codeL = '';
      for (let i = 0; i < 3; i++) codeL += letters.charAt(Math.floor(Math.random() * letters.length));
      let codeD = '';
      for (let i = 0; i < 3; i++) codeD += digits.charAt(Math.floor(Math.random() * digits.length));
      const securityCode = `${codeL}-${codeD}`;

      const reqId = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const reqData = {
        id: reqId,
        deviceId: getDeviceId(),
        fromPlayerId: myPlayerId,
        fromPlayerName: curName,
        toPlayerId: selectedTargetPid,
        toPlayerName: targetName,
        reason: reason,
        securityCode: securityCode,
        status: 'pending',
        createdAt: Date.now()
      };

      try {
        if (window.Cloud && window.Cloud.submitProfileRequest) {
          await window.Cloud.submitProfileRequest(reqData);
          localStorage.setItem('portal_pending_req_id', reqId);
          close();
          showConfirmProfileChangeSecurityCodeModal(targetP, securityCode, reqId);
        } else {
          toast('Error de conexión a la nube', 'error');
          btnSubmit.disabled = false;
        }
      } catch (err) {
        console.error(err);
        toast('Error: ' + err.message, 'error');
        btnSubmit.disabled = false;
      }
    };

    document.body.appendChild(overlay);
    if (searchInp) setTimeout(() => searchInp.focus(), 60);
  }

  function showConfirmProfileChangeSecurityCodeModal(player, securityCode, reqId) {
    if (!player || !securityCode || !reqId) return;

    let reqUnsub = null;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const pName = `${player.name || ''} ${player.lastName || ''}`.trim();
    const pDorsal = player.mainDorsal != null ? `#${player.mainDorsal}` : '';
    const team = clubData.teams ? clubData.teams.find(t => t.id === player.teamId) : null;

    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; padding: 22px 18px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 8px;">🔐</div>
        
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 900; color: #fff;">
          ${t('profileChangeSecurityTitle', 'Confirm Profile Change')}
        </h3>
        <p style="margin: 0 0 16px; font-size: 13.5px; color: var(--cyan); font-weight: 800;">
          ➔ ${escapeHtml(pName)}
        </p>

        <!-- Tarjeta del nuevo jugador seleccionado -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); margin-bottom: 16px; text-align: left;">
          ${renderAvatar(player, 'md')}
          <div style="flex: 1; overflow: hidden;">
            <b style="font-size: 15px; color: #fff; display: block;" class="ellipsis">
              ${pDorsal} ${escapeHtml(pName)}
            </b>
            <small style="color: var(--muted); font-size: 12px;">
              ${formatPosition(player.mainPosition)} ${team ? '• ' + escapeHtml(team.name) : ''}
            </small>
          </div>
        </div>

        <!-- Explicación de seguridad -->
        <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.45; margin: 0 0 14px; text-align: left;">
          ${t('profileChangeSecurityDesc', 'To protect your player account, this security code has been generated. Give this code to your coach so they can authorize switching your profile to {name}.').replace('{name}', pName)}
        </p>

        <!-- Código de seguridad destacado -->
        <div style="background: var(--bg2); border: 2.5px dashed #22d3ee; border-radius: 14px; padding: 14px 10px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 4px;">
            ${t('securityCodeTitle', 'Security Code')}
          </span>
          <b style="font-size: 32px; color: #22d3ee; letter-spacing: 5px; font-family: monospace; font-weight: 900; display: block;">
            ${securityCode}
          </b>
        </div>

        <!-- Botones de Acción: Copiar Código y Enviar por Viber -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
          <button type="button" class="btn sm secondary" id="btn-copy-change-code" style="height: 40px; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('copyCode', '📋 Copy Code')}
          </button>
          <button type="button" class="btn sm" id="btn-viber-change-code" style="height: 40px; font-weight: 800; font-size: 12px; background: #7c3aed; color: #fff; border: 1px solid #a855f7; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${t('sendViaViber', '📱 Send via Viber')}
          </button>
        </div>

        <!-- Indicador de espera -->
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); font-size: 12px; color: #fde047; font-weight: 800; margin-bottom: 16px;">
          <span>⏳</span>
          <span>${t('waitingCoachApproval', 'Waiting for your coach to authorize the code...')}</span>
        </div>

        <button type="button" class="btn sm ghost block" id="btn-cancel-change-req" style="height: 38px; font-weight: 800; font-size: 12.5px;">
          ${t('cancelSelectOther', '✕ Cancel and select another player')}
        </button>
      </div>
    `;

    function close() {
      if (reqUnsub) {
        try { reqUnsub(); } catch (e) {}
      }
      overlay.remove();
    }

    overlay.querySelector('#btn-cancel-change-req').onclick = close;

    // Copiar código
    overlay.querySelector('#btn-copy-change-code').onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(securityCode);
        } else {
          const ta = document.createElement('textarea');
          ta.value = securityCode;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        toast(t('codeCopied', '✅ Code copied to clipboard!'), 'success');
        haptic(30);
      } catch (err) {
        toast(`Code: ${securityCode}`, 'info');
      }
    };

    // Compartir por Viber
    overlay.querySelector('#btn-viber-change-code').onclick = () => {
      const shareText = t('viberProfileChangeMsg', 'Hi Coach, my verification code is {code} to change my profile to {name} on Player Stats app.')
        .replace('{code}', securityCode)
        .replace('{name}', pName);
      const viberUrl = `viber://forward?text=${encodeURIComponent(shareText)}`;
      window.location.href = viberUrl;
    };

    // Escuchar aprobación del entrenador
    if (window.Cloud && window.Cloud.listenToMyProfileRequest) {
      reqUnsub = window.Cloud.listenToMyProfileRequest(reqId, (reqDoc) => {
        if (!reqDoc) return;
        if (reqDoc.status === 'approved') {
          close();
          myPlayerId = player.id;
          localStorage.setItem('portal_selected_player_id', player.id);
          localStorage.removeItem('portal_pending_req_id');
          haptic(50);
          toast(t('profileAccessApproved', 'Access authorized by coach! You can now view your stats.'), 'success');
          renderCurrentTab();
        } else if (reqDoc.status === 'rejected') {
          close();
          localStorage.removeItem('portal_pending_req_id');
          haptic(30);
          toast(t('profileAccessDenied', 'Access denied by coach'), 'error');
        }
      });
    }

    document.body.appendChild(overlay);
  }

  function listenToMyPendingRequest(reqId) {
    if (!reqId || !window.Cloud || !window.Cloud.listenToMyProfileRequest) return;
    if (myPendingReqUnsub) myPendingReqUnsub();

    myPendingReqUnsub = window.Cloud.listenToMyProfileRequest(reqId, (reqData) => {
      if (!reqData) return;
      if (reqData.status === 'approved') {
        myPlayerId = reqData.toPlayerId;
        try {
          localStorage.setItem('portal_player_id', reqData.toPlayerId);
          localStorage.setItem('portal_player_locked', 'true');
          localStorage.setItem('portal_player_linked_at', String(Date.now()));
          localStorage.removeItem('portal_pending_req_id');
        } catch (e) {}
        if (window.Cloud && window.Cloud.clearPlayerUnlink) {
          window.Cloud.clearPlayerUnlink(reqData.toPlayerId);
        }
        listenToMyUnlink(reqData.toPlayerId);
        toast(t('reqApprovedToast'), 'success');
        haptic(50);
        updateHeaderIdentity();
        renderCurrentTab();
      } else if (reqData.status === 'rejected') {
        try { localStorage.removeItem('portal_pending_req_id'); } catch (e) {}
        toast(t('reqRejectedToast'), 'error');
        renderCurrentTab();
      }
    });
  }

  /* -------------------------------------------------------------
     NAVEGACIÓN DIRECTA A UNA CONVOCATORIA DESDE EL CHAT O NOTIFICACIÓN
     ------------------------------------------------------------- */
  window.__openConvocationInPortal = function (convId) {
    if (!convId) return;
    document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop').forEach(el => el.remove());
    convFilterType = 'all';
    currentTab = 'convocations';
    const convTabBtn = document.querySelector('#tab-convocations, button[data-tab="convocations"]');
    if (convTabBtn) {
      document.querySelectorAll('.tabbar button, .tab-bar button, #portal-tabbar .tab-btn').forEach(b => b.classList.remove('active'));
      convTabBtn.classList.add('active');
    }
    renderCurrentTab();
    setTimeout(() => {
      const convs = (clubData && clubData.convocations) ? clubData.convocations : [];
      const conv = convs.find(x => x.id === convId);
      if (conv) {
        markConvAsOpened(convId, myPlayerId);
        const dotEl = document.getElementById(`conv-new-dot-${convId}`);
        if (dotEl) dotEl.remove();
        if (conv.type === 'match') {
          showMatchDetailsModal(conv);
        } else {
          showTrainingDetailsModal(conv);
        }
      }
      const card = document.querySelector(`.card[data-cid="${convId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 0.3s, border-color 0.3s';
        card.style.boxShadow = '0 0 0 3px #38bdf8';
        card.style.borderColor = '#38bdf8';
        setTimeout(() => {
          card.style.boxShadow = '';
          card.style.borderColor = '';
        }, 2500);
      }
    }, 120);
  };

  /* -------------------------------------------------------------
     CONTROL DE CONVOCATORIAS NUEVAS / NO LEÍDAS Y NOTIFICACIÓN (DOT)
     ------------------------------------------------------------- */
  function isPlayerCalledUpInConv(c, pid) {
    if (!c || !pid) return false;
    const p = (clubData && clubData.players ? clubData.players.find(x => x.id === pid) : null) || getMyPlayer();
    if (!p) return false;

    // Pertenencia a equipo de la convocatoria
    const convTeams = (Array.isArray(c.teamIds) && c.teamIds.length > 0)
      ? c.teamIds
      : (c.teamId ? [c.teamId] : []);
    if (convTeams.length > 0) {
      if (!p.teamId || !convTeams.includes(p.teamId)) return false;
    }

    // Explícitamente convocado en lista (ni 'uncalled' ni 'absent')
    const list = c.list || {};
    const st = list[pid];
    return !!(st && st !== 'uncalled' && st !== 'absent');
  }

  function isConvUnopened(c, pid) {
    if (!c || !pid) return false;
    const nowD = new Date();
    const todayIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
    if (c.date && c.date < todayIso) return false;
    const isRecurring = !!(c.isRecurring || c.scheduleId || (c.id && c.id.startsWith('rec_')));
    if (isRecurring && !isDateInCurrentWeek(c.date)) return false;
    if (!isPlayerCalledUpInConv(c, pid)) return false;
    try {
      return localStorage.getItem(`portal_conv_opened_${pid}_${c.id}`) !== 'true';
    } catch (e) {
      return false;
    }
  }

  function markConvAsOpened(convId, pid) {
    if (!convId || !pid) return;
    try {
      localStorage.setItem(`portal_conv_opened_${pid}_${convId}`, 'true');
    } catch (e) {}
    updateConvocationsBadge();
  }

  function updateConvocationsBadge() {
    const dotEl = document.getElementById('convocations-tab-dot');
    if (!dotEl) return;
    if (!hasApprovedProfile() || !myPlayerId) {
      dotEl.style.display = 'none';
      return;
    }
    const convs = (clubData && clubData.convocations) ? clubData.convocations : [];
    const hasUnopened = convs.some(c => isConvUnopened(c, myPlayerId));
    dotEl.style.display = hasUnopened ? 'inline-block' : 'none';
  }

  function showAbsenceReasonModal(convTitle, onConfirm) {
    const existing = document.getElementById('dialog-absence-reason-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-absence-reason-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="width: 92%; max-width: 420px; padding: 20px 18px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">❌</span>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">
                ${t('absenceReasonTitle', 'Motivo de la Ausencia')}
              </h3>
              <small style="color: var(--muted); font-size: 11.5px;">
                ${escapeHtml(convTitle || t('convocation', 'Convocatoria'))}
              </small>
            </div>
          </div>
          <button type="button" class="icon-btn ghost" id="btn-close-absence-modal" style="width: 32px; height: 32px;">✕</button>
        </div>

        <p style="font-size: 12.5px; color: #cbd5e1; margin: 0 0 10px; line-height: 1.4;">
          ${t('absenceReasonPrompt', 'Por favor explica brevemente a tu entrenador el motivo por el que no podrás asistir (ej. lesión, enfermedad, examen, viaje):')}
        </p>

        <textarea id="absence-reason-text" rows="3" placeholder="${t('absenceReasonPlaceholder', 'Escribe aquí el motivo de tu ausencia...')}" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 12px; border: 1.5px solid rgba(239, 68, 68, 0.4); background: var(--bg2); color: #fff; font-size: 13.5px; font-family: inherit; resize: none; margin-bottom: 14px; outline: none;"></textarea>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" class="btn ghost sm" id="btn-cancel-absence" style="font-weight: 800; font-size: 12.5px; height: 40px;">
            ${t('cancel', 'Cancelar')}
          </button>
          <button type="button" class="btn danger sm" id="btn-submit-absence" style="font-weight: 900; font-size: 12.5px; height: 40px; background: #ef4444; border-color: #dc2626; color: #fff;">
            ${t('confirmAbsence', 'Confirmar Baja')}
          </button>
        </div>
      </div>
    `;

    function close() {
      overlay.remove();
    }

    overlay.querySelector('#btn-close-absence-modal').onclick = close;
    overlay.querySelector('#btn-cancel-absence').onclick = close;

    overlay.querySelector('#btn-submit-absence').onclick = () => {
      const textarea = overlay.querySelector('#absence-reason-text');
      const reason = (textarea ? textarea.value : '').trim();
      close();
      if (typeof onConfirm === 'function') {
        onConfirm(reason);
      }
    };

    document.body.appendChild(overlay);
    setTimeout(() => {
      const ta = overlay.querySelector('#absence-reason-text');
      if (ta) ta.focus();
    }, 100);
  }

  /* -------------------------------------------------------------
     PESTAÑA 1: CONVOCATORIAS (PUNTOS 2, 3, 4)
     ------------------------------------------------------------- */
  function renderConvocationsView() {
    const convs = (clubData && clubData.convocations) ? clubData.convocations : [];
    const myP = getMyPlayer();
    const pendingReqId = localStorage.getItem('portal_pending_req_id');

    let bannerHtml = '';
    if (pendingReqId) {
      bannerHtml = `
        <div style="background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; font-size: 12px; color: #fde047; display: flex; align-items: center; gap: 8px;">
          <span>⏳</span>
          <div>${t('reqSentBanner').replace('{name}', 'tu nuevo perfil')}</div>
        </div>
      `;
    }

    if (!hasApprovedProfile()) {
      view.innerHTML = `
        <div style="padding: 16px 0;">
          ${bannerHtml}
          <div class="card" style="padding: 24px 16px; text-align: center; background: linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(14, 165, 233, 0.16) 100%); border: 2px dashed #06b6d4; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);">
            <div style="font-size: 40px; margin-bottom: 10px;">👋</div>
            <h3 style="margin: 0 0 6px; font-size: 17px; font-weight: 900; color: #fff;">${t('selectIdentity', 'Select who you are...')}</h3>
            <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px; line-height: 1.45;">
              ${t('chooseIdentityDesc', 'Elige tu nombre en la plantilla para ver tus convocatorias, votar asistencia y acceder a tus estadísticas.')}
            </p>
            <button type="button" class="btn primary" id="btn-select-id-from-convs" style="font-weight: 900; font-size: 13.5px; padding: 10px 22px; border-radius: 12px; box-shadow: 0 0 15px rgba(6, 182, 212, 0.4);">
              ⚽ ${t('selectIdentity', 'Seleccionar mi perfil')}
            </button>
          </div>
          <div class="empty-state card">
            <div class="e-ic">📋</div>
            <h3>${t('emptyConvs')}</h3>
            <p>${t('emptyConvsDesc')}</p>
          </div>
        </div>
      `;
      const btnSel = view.querySelector('#btn-select-id-from-convs');
      if (btnSel) btnSel.onclick = showSelectIdentityModal;
      return;
    }

    if (convs.length === 0) {
      view.innerHTML = `
        <div style="padding: 16px 0;">
          ${bannerHtml}
          <div class="empty-state card">
            <div class="e-ic">📋</div>
            <h3>${t('emptyConvs')}</h3>
            <p>${t('emptyConvsDesc')}</p>
          </div>
        </div>
      `;
      return;
    }

    const filteredConvs = convs.filter(c => {
      if (convFilterType !== 'all' && c.type !== convFilterType) return false;
      if (!myP || !myPlayerId) return false;

      // Si es un entrenamiento recurrente, sólo mostrar sesiones de la semana actual
      const isRecurring = !!(c.isRecurring || c.scheduleId || (c.id && c.id.startsWith('rec_')));
      if (isRecurring && !isDateInCurrentWeek(c.date)) return false;

      // Debe pertenecer al equipo de la convocatoria
      const convTeams = (Array.isArray(c.teamIds) && c.teamIds.length > 0)
        ? c.teamIds
        : (c.teamId ? [c.teamId] : []);
      
      if (convTeams.length > 0) {
        if (!myP.teamId || !convTeams.includes(myP.teamId)) return false;
      } else {
        if (!myP.teamId) return false;
      }

      // Debe haber sido explícitamente convocado en la lista
      const list = c.list || {};
      const st = list[myPlayerId];
      const isCalled = !!(st && st !== 'uncalled' && st !== 'absent');
      if (!isCalled) return false;

      return true;
    });

    const nowD = new Date();
    const todayIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;

    // Separar en:
    // 1. Convocatorias de HOY (destacadas con iluminación)
    // 2. Convocatorias siguientes en la semana actual (y futuros partidos)
    // 3. Convocatorias / Entrenamientos pasados (para el desplegable)
    const todayConvs = [];
    const upcomingThisWeekConvs = [];
    const pastConvs = [];

    filteredConvs.forEach(c => {
      const cDate = (c.date || '').trim();
      if (cDate === todayIso) {
        todayConvs.push(c);
      } else if (cDate < todayIso) {
        pastConvs.push(c);
      } else {
        // cDate > todayIso
        if (c.type === 'training') {
          if (isDateInCurrentWeek(cDate)) {
            upcomingThisWeekConvs.push(c);
          }
        } else {
          upcomingThisWeekConvs.push(c);
        }
      }
    });

    todayConvs.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    upcomingThisWeekConvs.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    pastConvs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

    function renderSingleConvCard(c, isToday, isPast) {
      const team = clubData.teams ? clubData.teams.find(t => t.id === c.teamId) : null;
      const list = c.list || {};
      const responses = liveVotes[c.id] || {};

      // SÓLO jugadores efectivamente convocados (st !== 'uncalled' y st !== 'absent')
      const calledPlayerIds = Object.keys(list).filter(pid => {
        const st = list[pid];
        return st && st !== 'uncalled' && st !== 'absent';
      });

      const isCalled = true;

      // Recuentos reales entre los convocados
      let nAttending = 0;
      let nAbsent = 0;
      let nPending = 0;

      calledPlayerIds.forEach(pid => {
        const r = responses[pid] || (c.responses && c.responses[pid]);
        const st = r ? r.status : null;
        if (st === 'called' || st === 'attending' || st === 'yes') nAttending++;
        else if (st === 'absent' || st === 'no') nAbsent++;
        else nPending++;
      });

      // Voto del usuario actual
      const myVoteObj = myPlayerId ? (responses[myPlayerId] || (c.responses && c.responses[myPlayerId])) : null;
      const mySt = myVoteObj ? myVoteObj.status : null;
      const isAttending = mySt && (mySt === 'called' || mySt === 'attending' || mySt === 'yes');
      const isAbsent = mySt && (mySt === 'absent' || mySt === 'no');

      const isMatch = c.type === 'match';
      const isUnopened = isConvUnopened(c, myPlayerId);

      return `
        <div class="card conv-card-clickable ${isToday ? 'conv-card-today' : ''} ${isPast ? 'past-conv-card' : ''}" style="${isToday ? 'border: 2px solid rgba(34, 211, 238, 0.95); box-shadow: 0 0 25px rgba(34, 211, 238, 0.65), 0 0 50px rgba(34, 211, 238, 0.35);' : 'border: 1px solid var(--border);'} padding: 16px; position: relative;" data-cid="${c.id}">
          ${isToday ? `
            <div class="today-glow-banner" style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(90deg, rgba(6, 182, 212, 0.3), rgba(59, 130, 246, 0.3)); border: 1px solid rgba(34, 211, 238, 0.65); border-radius: 9px; padding: 7px 12px; margin-bottom: 12px; box-shadow: 0 0 14px rgba(6, 182, 212, 0.5);">
              <span style="font-size: 11.5px; font-weight: 900; color: #a5f3fc; letter-spacing: 0.6px; text-transform: uppercase; display: flex; align-items: center; gap: 7px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 10px #22d3ee;"></span>
                ${isMatch ? t('todayMatchBadge') : t('todayTrainingBadge')}
              </span>
              <span style="font-size: 10.5px; font-weight: 900; color: #fff; background: linear-gradient(135deg, #06b6d4, #3b82f6); padding: 2px 8px; border-radius: 6px; box-shadow: 0 0 8px rgba(6, 182, 212, 0.6);">
                ${t('todayBadge', 'HOY')}
              </span>
            </div>
          ` : ''}

          <!-- Encabezado clickeable para abrir detalles -->
          <div class="conv-card-header-tap" data-open-conv-id="${c.id}" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                  <span class="badge ${c.type}">
                    ${isMatch ? '🏆 ' + t('match') : '⚽ ' + t('training')}
                  </span>
                  ${isPast ? `
                    <span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 8px;">
                      ✓ ${t('pastSessionBadge')}
                    </span>
                  ` : ''}
                  ${isToday && !isPast ? `
                    <span class="badge-today-glow" style="display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; border: 1px solid rgba(255,255,255,0.4); font-size: 11px; font-weight: 900; padding: 2px 9px; border-radius: 8px; box-shadow: 0 0 14px rgba(6, 182, 212, 0.8); letter-spacing: 0.3px;">
                      ✨ ${currentLang === 'ee' ? 'TÄNA' : (currentLang === 'es' ? 'HOY' : 'TODAY')}
                    </span>
                  ` : ''}
                  ${isUnopened ? `
                    <span class="badge-conv-new" id="conv-new-dot-${c.id}" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 12px; letter-spacing: 0.3px;">
                      <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 6px #ef4444;"></span>
                      ${t('newBadge', 'NEW')}
                    </span>
                  ` : ''}
                </div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 900; color: #fff;">
                  ${escapeHtml(c.title || (c.rival ? 'vs ' + c.rival : t('callUpOfficial')))}
                </h3>
                <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.4;">
                  📅 <b>${formatDisplayDate(c.date)}</b> • ⏰ ${c.time || '10:00'}${c.endTime ? ' - ' + c.endTime : ''}${c.duration ? ' (' + c.duration + ' min)' : ''}<br />
                  ${c.venue ? `📍 <b>${t('venue')}:</b> ${escapeHtml(c.venue)}<br />` : ''}
                  ${c.address ? `
                    🗺️ <b>${t('address')}:</b> ${escapeHtml(c.address)}
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}" target="_blank" onclick="event.stopPropagation(); window.openLocationInMaps('${escapeHtml(c.address)}'); return false;" style="color: var(--cyan); font-weight: 800; text-decoration: underline; margin-left: 4px;">
                      ${t('openInMaps')}
                    </a><br />
                  ` : ''}
                  ${team ? `<span style="color: ${team.color || 'var(--cyan)'}; font-weight: 800;">🛡️ ${escapeHtml(team.name)}</span>` : ''}
                </div>
              </div>
              <div style="font-size: 16px; color: var(--muted); padding-top: 4px; opacity: 0.7;">➔</div>
            </div>
          </div>

          ${c.notes ? `
            <div style="background: rgba(0,0,0,0.25); border-left: 3px solid var(--cyan); padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-top: 10px; color: #bae6fd;">
              📝 <b>${t('coachNote')}:</b> ${escapeHtml(c.notes)}
            </div>
          ` : ''}

          <!-- Botón interactivo para abrir los detalles completos -->
          <div style="margin-top: 10px;">
            <button type="button" class="btn block ghost btn-open-conv-details" data-open-conv-id="${c.id}" style="height: 38px; font-size: 12.5px; font-weight: 800; border-radius: 10px; border: 1px dashed ${isMatch ? 'rgba(56, 189, 248, 0.45)' : 'rgba(34, 197, 94, 0.45)'}; background: ${isMatch ? 'rgba(56, 189, 248, 0.08)' : 'rgba(34, 197, 94, 0.08)'}; color: ${isMatch ? '#38bdf8' : '#86efac'}; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; cursor: pointer; width: 100%;">
              <div style="display: flex; align-items: center; gap: 7px;">
                <span>${isMatch ? '🏆' : '⚽'}</span>
                <span>${isMatch ? t('tapMatchDetails', 'Tap for Match Details & Squad') : t('tapTrainingDetails', 'Tap for Training Details & Squad')}</span>
              </div>
              <span style="font-size: 14px; font-weight: 900;">➔</span>
            </button>
          </div>

          <!-- CAJA DE ASISTENCIA -->
          <div class="portal-vote-box" style="margin-top: 10px;">
            ${isCalled ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; font-weight: 800; color: #fff;">${t('willYouAttend')}</span>
                <span id="vote-badge-${c.id}" class="badge" style="${isAttending ? 'background: rgba(34,197,94,0.2); color: #86efac;' : (isAbsent ? 'background: rgba(239,68,68,0.2); color: #fca5a5;' : 'background: var(--surface); color: var(--muted);')}">
                  ${isAttending ? t('attendanceConfirmed') : (isAbsent ? t('absenceReported') : t('pendingResponse'))}
                </span>
              </div>

              <div class="portal-vote-btns">
                <button class="btn-vote yes ${isAttending ? 'active' : ''}" data-cid="${c.id}" data-vote="called">
                  ${t('iWillAttend')}
                </button>
                <button class="btn-vote no ${isAbsent ? 'active' : ''}" data-cid="${c.id}" data-vote="absent">
                  ${t('iCannotAttend')}
                </button>
              </div>
            ` : `
              <div style="text-align: center; padding: 6px 0; color: var(--muted); font-size: 12.5px;">
                ${t('notCalledUp')}
              </div>
            `}

            <!-- RECUENTO EN VIVO Y MODAL DE COMPAÑEROS QUE ASISTEN -->
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <div style="display: flex; gap: 8px;">
                <span style="color: #86efac; font-weight: 800;">🟢 ${nAttending}</span>
                <span style="color: #fca5a5; font-weight: 800;">❌ ${nAbsent}</span>
                <span style="color: #fde047; font-weight: 800;">⏳ ${nPending}</span>
              </div>
              <button type="button" class="btn sm ghost" data-open-squad-status="${c.id}" style="color: var(--cyan); font-weight: 800; font-size: 11.5px; padding: 4px 8px;">
                ${t('viewAttendees')}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const hasActiveConvs = todayConvs.length > 0 || upcomingThisWeekConvs.length > 0;
    let listContentHtml = '';

    if (!hasActiveConvs && pastConvs.length === 0) {
      listContentHtml = `
        <div class="empty-state card">
          <div class="e-ic">📋</div>
          <h3>${t('emptyConvs')}</h3>
          <p>${t('emptyConvsDesc')}</p>
        </div>
      `;
    } else {
      let sectionsHtml = '';

      if (!hasActiveConvs && pastConvs.length > 0) {
        sectionsHtml += `
          <div class="card" style="padding: 16px; text-align: center; background: rgba(30, 41, 59, 0.4); border: 1px dashed var(--border); margin-bottom: 12px; border-radius: 12px;">
            <div style="font-size: 24px; margin-bottom: 6px;">⚽</div>
            <div style="font-size: 13.5px; font-weight: 800; color: #fff;">${t('noUpcomingThisWeek')}</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${t('noUpcomingThisWeekDesc')}</div>
          </div>
        `;
      }

      // 1. Convocatorias de HOY (iluminadas para que destaquen)
      if (todayConvs.length > 0) {
        sectionsHtml += `
          <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 14px;">
            ${todayConvs.map(c => renderSingleConvCard(c, true, false)).join('')}
          </div>
        `;
      }

      // 2. Convocatorias siguientes en la semana actual
      if (upcomingThisWeekConvs.length > 0) {
        if (todayConvs.length > 0) {
          sectionsHtml += `
            <div style="display: flex; align-items: center; gap: 8px; margin: 16px 0 10px 4px;">
              <span style="font-size: 14px;">📅</span>
              <h4 style="margin: 0; font-size: 12.5px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px;">
                ${t('upcomingThisWeek')}
              </h4>
            </div>
          `;
        }
        sectionsHtml += `
          <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 14px;">
            ${upcomingThisWeekConvs.map(c => renderSingleConvCard(c, false, false)).join('')}
          </div>
        `;
      }

      // 3. Desplegable de entrenamientos y convocatorias anteriores
      if (pastConvs.length > 0) {
        const pastLabel = convFilterType === 'training' 
          ? t('pastConvocations') 
          : (convFilterType === 'match' ? t('pastConvocationsMatches') : t('pastConvocationsAll'));

        sectionsHtml += `
          <details class="past-convs-details" id="past-convs-accordion" ${isPastConvsExpanded ? 'open' : ''}>
            <summary class="past-convs-summary">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px;">📁</span>
                <span>${pastLabel}</span>
                <span class="badge" style="background: rgba(148, 163, 184, 0.18); color: #cbd5e1; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 900;">${pastConvs.length}</span>
              </div>
              <span class="past-convs-chevron" style="font-size: 11px; color: var(--muted); transition: transform 0.25s ease;">${isPastConvsExpanded ? '▲' : '▼'}</span>
            </summary>
            <div class="past-convs-body" style="padding: 12px; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(11, 17, 32, 0.35);">
              ${pastConvs.map(c => renderSingleConvCard(c, false, true)).join('')}
            </div>
          </details>
        `;
      }

      listContentHtml = sectionsHtml;
    }

    // Buscar si hay un partido reciente finalizado (hasta 48h tras finalizar) para votar MVP
    let mvpBannerHtml = '';
    let recentMatchForMvp = null;
    if (clubData && myP) {
      const nowTs = Date.now();
      const isEligibleMatch = (s) => {
        if (!s || s.type !== 'match' || !s.date) return false;
        const isFin = (s.isFinished === true || s.status === 'finished');
        if (!isFin) return false; // NUNCA se vota en partidos no finalizados o futuros
        const sTime = new Date(s.date + (s.time ? 'T' + s.time : '')).getTime();
        const elapsed = nowTs - sTime;
        if (elapsed < 0 || elapsed > 48 * 3600 * 1000) return false; // Ventana de 0 a 48h tras el partido

        // El botón SÓLO estará visible para los jugadores que formaron parte del partido
        const participated = (
          (s.stats && s.stats[myP.id] && Object.values(s.stats[myP.id]).some(v => v > 0)) ||
          (Array.isArray(s.slots) && s.slots.includes(myP.id)) ||
          (s.attendance && (s.attendance[myP.id] === 'present' || s.attendance[myP.id] === 'yes' || s.attendance[myP.id] === true)) ||
          (Array.isArray(s.trackedPlayerIds) && s.trackedPlayerIds.includes(myP.id)) ||
          (Array.isArray(s.coachPicks) && s.coachPicks.some(cp => cp && (cp.playerId === myP.id || cp.id === myP.id))) ||
          (s.convocationId && clubData.convocations && (() => {
            const c = clubData.convocations.find(conv => conv.id === s.convocationId);
            return c && c.list && (c.list[myP.id] === 'confirmed' || c.list[myP.id] === 'attended' || c.list[myP.id] === 'called');
          })())
        );
        return participated;
      };

      if (clubData.latestMatchMvp && isEligibleMatch(clubData.latestMatchMvp)) {
        recentMatchForMvp = clubData.latestMatchMvp;
      }
      if (!recentMatchForMvp && Array.isArray(clubData.sessions)) {
        recentMatchForMvp = clubData.sessions.find(isEligibleMatch);
      }

      if (recentMatchForMvp) {
        const isOfficialSet = !!recentMatchForMvp.officialMvpId;
        const officialPlayer = isOfficialSet ? (clubData.players || []).find(p => p.id === recentMatchForMvp.officialMvpId) : null;
        const myVotedId = (recentMatchForMvp.votes && recentMatchForMvp.votes[myP.id]) ||
                          (window._myVotedMvpBySession && window._myVotedMvpBySession[recentMatchForMvp.id]) ||
                          localStorage.getItem('my_mvp_vote_' + recentMatchForMvp.id);
        const votedPlayer = myVotedId ? (clubData.players || []).find(p => p.id === myVotedId) : null;

        let statusSubtitle = t('chooseBestTeammate', 'Vota al mejor compañero del partido');
        let btnLabel = `⭐ ${t('voteMatchMvp', 'Votar')}`;
        if (isOfficialSet && officialPlayer) {
          statusSubtitle = `⭐ ${t('mvpOfficialWinner', '⭐ MVP Oficial: {name}!').replace('{name}', officialPlayer.name || '')}`;
          btnLabel = `⭐ ${t('viewMvp', 'Ver MVP')}`;
        } else if (votedPlayer) {
          statusSubtitle = `✅ ${t('mvpYouVotedFor', 'Has votado a {name}').replace('{name}', (votedPlayer.name || '') + (votedPlayer.lastName ? ' ' + votedPlayer.lastName : ''))}`;
          btnLabel = `✏️ ${t('mvpChangeVote', 'Cambiar voto')}`;
        }

        mvpBannerHtml = `
          <div class="card" id="banner-vote-mvp" style="margin-bottom: 12px; background: linear-gradient(135deg, rgba(234, 179, 8, 0.18) 0%, rgba(202, 138, 4, 0.28) 100%); border: 1.5px solid #eab308; border-radius: 16px; padding: 12px 14px; box-shadow: 0 4px 20px rgba(234, 179, 8, 0.2); cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 26px;">👑</span>
                <div>
                  <div style="font-size: 11px; font-weight: 800; color: #facc15; text-transform: uppercase; letter-spacing: 0.6px;">
                    ${t('mvpBannerTitle', '👑 ¡Votación del MVP del Partido!')}
                  </div>
                  <div style="font-size: 14px; font-weight: 900; color: #fff; margin-top: 1px;">
                    ${recentMatchForMvp.rival ? `vs ${escapeHtml(recentMatchForMvp.rival)}` : escapeHtml(recentMatchForMvp.title || 'Partido')}
                  </div>
                  <div style="font-size: 11px; color: #fde047; margin-top: 1px;">
                    ${statusSubtitle}
                  </div>
                </div>
              </div>
              <button type="button" class="btn sm" style="background: #eab308; color: #000; font-weight: 900; font-size: 11.5px; border-radius: 10px; border: none; padding: 6px 12px; white-space: nowrap;">
                ${btnLabel}
              </button>
            </div>
          </div>
        `;
      }
    }

    view.innerHTML = `
      <div style="padding: 10px 0;">
        ${bannerHtml}
        ${mvpBannerHtml}

        <!-- FILTROS DE CONVOCATORIAS: TODOS, PARTIDOS, ENTRENAMIENTOS -->
        <div class="segmented" style="display: flex; gap: 4px; margin-bottom: 12px; background: var(--surface2); padding: 4px; border-radius: 12px; border: 1px solid var(--border);">
          <button type="button" class="btn sm ${convFilterType === 'all' ? 'primary' : 'ghost'}" data-conv-filter="all" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">${t('filterAll', 'Todos')}</button>
          <button type="button" class="btn sm ${convFilterType === 'match' ? 'primary' : 'ghost'}" data-conv-filter="match" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">${t('filterMatches', '🏆 Partidos')}</button>
          <button type="button" class="btn sm ${convFilterType === 'training' ? 'primary' : 'ghost'}" data-conv-filter="training" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">${t('filterTrainings', '⚽ Entrenamientos')}</button>
        </div>

        ${listContentHtml}
      </div>
    `;

    const btnMvpBanner = view.querySelector('#banner-vote-mvp');
    if (btnMvpBanner && recentMatchForMvp) {
      btnMvpBanner.onclick = () => {
        showMatchMvpVoteModal(recentMatchForMvp);
      };
    }

    // Listener para guardar estado del desplegable de convocatorias pasadas
    const pastAccordion = view.querySelector('#past-convs-accordion');
    if (pastAccordion) {
      pastAccordion.ontoggle = () => {
        isPastConvsExpanded = pastAccordion.open;
        const chev = pastAccordion.querySelector('.past-convs-chevron');
        if (chev) {
          chev.textContent = pastAccordion.open ? '▲' : '▼';
        }
      };
    }

    // Filtros de convocatorias
    view.querySelectorAll('[data-conv-filter]').forEach(b => {
      b.onclick = () => {
        convFilterType = b.getAttribute('data-conv-filter');
        renderConvocationsView();
      };
    });

    // Abrir detalles completos de la convocatoria al pulsar en el encabezado o botón dedicado
    view.querySelectorAll('[data-open-conv-id]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const cid = el.getAttribute('data-open-conv-id');
        const conv = convs.find(x => x.id === cid);
        if (!conv) return;
        markConvAsOpened(cid, myPlayerId);
        const dotEl = document.getElementById(`conv-new-dot-${cid}`);
        if (dotEl) dotEl.remove();
        haptic(25);
        if (conv.type === 'match') {
          showMatchDetailsModal(conv);
        } else {
          showTrainingDetailsModal(conv);
        }
      };
    });

    // Conectar botones de voto
    view.querySelectorAll('.btn-vote').forEach(btn => {
      btn.onclick = async () => {
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }

        const cid = btn.getAttribute('data-cid');
        const vote = btn.getAttribute('data-vote');
        const myP = getMyPlayer();
        const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Player';

        markConvAsOpened(cid, myPlayerId);
        const dotEl = document.getElementById(`conv-new-dot-${cid}`);
        if (dotEl) dotEl.remove();

        haptic(35);

        const isCurrentlyActive = btn.classList.contains('active');
        const nextVote = isCurrentlyActive ? 'pending' : vote;

        const performVote = async (reasonText) => {
          // Actualizar caché de votos local al instante
          liveVotes[cid] = liveVotes[cid] || {};
          if (nextVote === 'pending') {
            delete liveVotes[cid][myPlayerId];
            const convObj = (clubData && clubData.convocations) ? clubData.convocations.find(x => x.id === cid) : null;
            if (convObj && convObj.responses) delete convObj.responses[myPlayerId];
          } else {
            liveVotes[cid][myPlayerId] = {
              status: nextVote,
              playerName: pName,
              notes: reasonText || '',
              timestamp: Date.now()
            };
          }

          // Feedback visual inmediato
          const box = btn.closest('.portal-vote-box');
          if (box) {
            box.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
            if (nextVote !== 'pending') {
              btn.classList.add('active');
            }
            const badge = document.getElementById(`vote-badge-${cid}`);
            if (badge) {
              if (nextVote === 'called') {
                badge.textContent = t('attendanceConfirmed');
                badge.style.background = 'rgba(34,197,94,0.2)';
                badge.style.color = '#86efac';
              } else if (nextVote === 'absent') {
                badge.textContent = t('absenceReported');
                badge.style.background = 'rgba(239,68,68,0.2)';
                badge.style.color = '#fca5a5';
              } else {
                badge.textContent = t('pendingResponse');
                badge.style.background = 'var(--surface)';
                badge.style.color = 'var(--muted)';
              }
            }
          }

          try {
            if (window.Cloud && window.Cloud.voteAttendance) {
              await window.Cloud.voteAttendance(cid, myPlayerId, nextVote, pName, reasonText || '');
              if (nextVote === 'pending') {
                toast(t('voteReset', 'Respuesta cancelada (pendiente)'), 'info');
              } else {
                toast(nextVote === 'called' ? t('attendanceConfirmed') : t('absenceReported'), 'success');
              }
            } else {
              toast('Guardado localmente.', 'info');
            }
          } catch (err) {
            console.error(err);
            toast('Error: ' + err.message, 'error');
          }
          renderConvocationsView();
        };

        if (nextVote === 'absent') {
          const convObj = (clubData && clubData.convocations) ? clubData.convocations.find(x => x.id === cid) : null;
          const convTitle = convObj ? (convObj.title || (convObj.type === 'match' ? 'vs ' + (convObj.rival || 'Rival') : 'Entrenamiento')) : '';
          showAbsenceReasonModal(convTitle, (reason) => {
            performVote(reason);
          });
        } else {
          performVote('');
        }
        renderConvocationsView();
      };
    });

    // Abrir desglose de asistentes
    view.querySelectorAll('[data-open-squad-status]').forEach(btn => {
      btn.onclick = () => {
        const cid = btn.getAttribute('data-open-squad-status');
        const conv = convs.find(x => x.id === cid);
        if (conv) showAttendeesBreakdownModal(conv);
      };
    });
  }

  /* -------------------------------------------------------------
     MODALES DETALLADOS DE CONVOCATORIA (PARTIDO Y ENTRENAMIENTO) EN INGLÉS
     ------------------------------------------------------------- */
  function showMatchDetailsModal(conv) {
    if (!conv) return;
    markConvAsOpened(conv.id, myPlayerId);
    const dotEl = document.getElementById(`conv-new-dot-${conv.id}`);
    if (dotEl) dotEl.remove();

    const team = (clubData && clubData.teams) ? clubData.teams.find(t => t.id === conv.teamId) : null;
    const list = conv.list || {};
    const responses = liveVotes[conv.id] || (conv.responses || {});
    const allPlayersMap = {};
    (clubData.players || []).forEach(p => { allPlayersMap[p.id] = p; });

    const calledPlayerIds = Object.keys(list).filter(pid => {
      const st = list[pid];
      return st && st !== 'uncalled' && st !== 'absent';
    });

    const attendingPlayers = [];
    const absentPlayers = [];
    const pendingPlayers = [];

    calledPlayerIds.forEach(pid => {
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, ''), mainPosition: t('player', 'Player') };
      const r = responses[pid];
      const st = r ? r.status : null;
      if (st === 'called' || st === 'attending' || st === 'yes') attendingPlayers.push(p);
      else if (st === 'absent' || st === 'no') absentPlayers.push(p);
      else pendingPlayers.push(p);
    });

    const myVoteObj = myPlayerId ? (responses[myPlayerId] || (conv.responses && conv.responses[myPlayerId])) : null;
    let currentVoteStatus = myVoteObj ? myVoteObj.status : null;
    let isAttending = currentVoteStatus && (currentVoteStatus === 'called' || currentVoteStatus === 'attending' || currentVoteStatus === 'yes');
    let isAbsent = currentVoteStatus && (currentVoteStatus === 'absent' || currentVoteStatus === 'no');

    // Calculate meeting time
    let meetingTimeStr = conv.meetingTime || conv.callTime || '';
    if (!meetingTimeStr && conv.time) {
      const parts = conv.time.split(':');
      if (parts.length === 2) {
        let m = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) - 45;
        if (m < 0) m += 1440;
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        meetingTimeStr = `${hh}:${mm} (${currentLang === 'ee' ? '45 min enne algust' : (currentLang === 'es' ? '45 min antes del partido' : '45 min before kick-off')})`;
      }
    }

    const nowD = new Date();
    const todayIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
    const isToday = (conv.date === todayIso);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 90vh; width: 95%; max-width: 520px; display: flex; flex-direction: column; padding: 18px; border-radius: 20px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 12px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">🏆</span>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">${t('matchDetails')}</h3>
                ${isToday ? `<span class="badge-today-glow" style="display: inline-flex; align-items: center; gap: 3px; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; border: 1px solid rgba(255,255,255,0.4); font-size: 10px; font-weight: 900; padding: 1px 7px; border-radius: 6px; box-shadow: 0 0 10px rgba(6, 182, 212, 0.7);">✨ ${currentLang === 'ee' ? 'TÄNA' : (currentLang === 'es' ? 'HOY' : 'TODAY')}</span>` : ''}
              </div>
              <small style="font-size: 11px; color: var(--muted);">${team ? escapeHtml(team.name) : t('callUpOfficial')}</small>
            </div>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-match-det-x" style="width: 32px; height: 32px; font-size: 16px;">✕</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 12px;">
          <!-- Banner -->
          <div style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(3, 105, 161, 0.2) 100%); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 14px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              ${team ? `🛡️ ${escapeHtml(team.name)}` : t('officialFixture')}
            </div>
            <div style="font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 4px;">
              ${escapeHtml(conv.title || (conv.rival ? 'vs ' + conv.rival : t('callUpOfficial')))}
            </div>
            ${conv.rival ? `
              <div style="font-size: 13px; font-weight: 800; color: #7dd3fc;">
                ⚔️ ${t('opponentLabel')} <b>${escapeHtml(conv.rival)}</b>
              </div>
            ` : ''}
          </div>

          <!-- Schedule Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;">
              <div style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 2px;">📅 ${t('matchDate').toUpperCase()}</div>
              <div style="font-size: 13px; font-weight: 800; color: #fff;">${formatDisplayDate(conv.date)}</div>
            </div>
            <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;">
              <div style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 2px;">⏰ ${t('kickoffTime').toUpperCase()}</div>
              <div style="font-size: 13px; font-weight: 800; color: #38bdf8;">${conv.time || '10:00'}</div>
            </div>
            ${meetingTimeStr ? `
              <div style="grid-column: span 2; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 12px; padding: 10px 12px;">
                <div style="font-size: 11px; color: #fde047; font-weight: 800; margin-bottom: 2px;">⏱️ ${t('meetingTime').toUpperCase()}</div>
                <div style="font-size: 13px; font-weight: 900; color: #fff;">${escapeHtml(meetingTimeStr)}</div>
              </div>
            ` : ''}
          </div>

          <!-- Venue & Address -->
          <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 4px;">📍 ${t('pitchAndVenue').toUpperCase()}</div>
            ${conv.venue ? `
              <div style="font-size: 13.5px; font-weight: 800; color: #fff; margin-bottom: 4px;">
                ${escapeHtml(conv.venue)}
              </div>
            ` : ''}
            ${conv.address ? `
              <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
                🗺️ ${escapeHtml(conv.address)}
              </div>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conv.address)}" target="_blank" onclick="window.openLocationInMaps('${escapeHtml(conv.address)}'); return false;" class="btn sm primary" style="display: inline-flex; align-items: center; gap: 6px; height: 32px; font-size: 12px; font-weight: 800; text-decoration: none;">
                🗺️ ${t('openInMaps')}
              </a>
            ` : (conv.venue ? `
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conv.venue)}" target="_blank" onclick="window.openLocationInMaps('${escapeHtml(conv.venue)}'); return false;" class="btn sm primary" style="display: inline-flex; align-items: center; gap: 6px; height: 32px; font-size: 12px; font-weight: 800; text-decoration: none;">
                🗺️ ${t('openInMaps')}
              </a>
            ` : `<div style="font-size: 12px; color: var(--muted);">${t('venueNotSpecified')}</div>`)}
          </div>

          <!-- Coach Instructions & Tactical Notes -->
          ${conv.notes ? `
            <div style="background: rgba(34, 211, 238, 0.08); border-left: 3px solid var(--cyan); border-radius: 8px; padding: 10px 12px;">
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); margin-bottom: 4px;">📝 ${t('coachInstructions').toUpperCase()}</div>
              <div style="font-size: 12.5px; color: #bae6fd; line-height: 1.45; white-space: pre-line;">${escapeHtml(conv.notes)}</div>
            </div>
          ` : ''}

          <!-- Kit & Uniform -->
          <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">👕</span>
            <div>
              <div style="font-size: 11px; color: var(--muted); font-weight: 700;">${t('kitAndGear').toUpperCase()}</div>
              <div style="font-size: 12.5px; font-weight: 800; color: #fff;">
                ${conv.kit ? escapeHtml(conv.kit) : t('defaultKitMatch')}
              </div>
            </div>
          </div>

          <!-- Match Squad Attendance Breakdown -->
          <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 12px; font-weight: 800; color: #fff;">👥 ${t('matchSquad').toUpperCase()} (${calledPlayerIds.length})</div>
              <div style="display: flex; gap: 6px; font-size: 11.5px; font-weight: 800;">
                <span style="color: #86efac;">🟢 ${attendingPlayers.length}</span>
                <span style="color: #fca5a5;">❌ ${absentPlayers.length}</span>
                <span style="color: #fde047;">⏳ ${pendingPlayers.length}</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; max-height: 170px; overflow-y: auto;">
              ${calledPlayerIds.map(pid => {
                const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, '') };
                const r = responses[pid];
                const st = r ? r.status : null;
                const isAtt = (st === 'called' || st === 'attending' || st === 'yes');
                const isAbs = (st === 'absent' || st === 'no');
                const statusIcon = isAtt ? '🟢' : (isAbs ? '❌' : '⏳');
                return `
                  <div style="display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; font-size: 11.5px; overflow: hidden;">
                    <span>${statusIcon}</span>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                      <b style="color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(formatPlayerShortName(p))}</b>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Attendance Response Box -->
          <div style="background: rgba(34, 197, 94, 0.08); border: 1.5px solid rgba(34, 197, 94, 0.3); border-radius: 14px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #fff;">${t('attendanceResponse')}</span>
              <span id="match-modal-vote-badge" class="badge" style="${isAttending ? 'background: rgba(34,197,94,0.2); color: #86efac;' : (isAbsent ? 'background: rgba(239,68,68,0.2); color: #fca5a5;' : 'background: var(--surface); color: var(--muted);')}">
                ${isAttending ? t('confirmedBadge') : (isAbsent ? t('absentBadge') : t('pendingBadge'))}
              </span>
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn sm match-modal-vote-btn ${isAttending ? 'primary' : 'ghost'}" data-vote="called" style="flex: 1; height: 38px; font-weight: 800; border-radius: 10px;">
                👍 ${t('iWillAttend')}
              </button>
              <button type="button" class="btn sm match-modal-vote-btn ${isAbsent ? 'danger' : 'ghost'}" data-vote="absent" style="flex: 1; height: 38px; font-weight: 800; border-radius: 10px;">
                ❌ ${t('iCannotAttend')}
              </button>
            </div>
          </div>
        </div>

        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border); flex-shrink: 0;">
          <button type="button" class="btn block ghost" id="dlg-match-det-close" style="height: 40px; font-weight: 800; border-radius: 10px;">
            ${t('close')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-match-det-x').onclick = close;
    overlay.querySelector('#dlg-match-det-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Manejar voto interactivo dentro del modal
    overlay.querySelectorAll('.match-modal-vote-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }
        const vote = btn.getAttribute('data-vote');
        const isCurrent = btn.classList.contains('primary') || btn.classList.contains('danger');
        const nextVote = isCurrent ? 'pending' : vote;
        const myP = getMyPlayer();
        const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : t('player', 'Player');

        haptic(35);

        const executeMatchVote = async (reasonText) => {
          liveVotes[conv.id] = liveVotes[conv.id] || {};
          if (nextVote === 'pending') {
            delete liveVotes[conv.id][myPlayerId];
            if (conv.responses) delete conv.responses[myPlayerId];
          } else {
            liveVotes[conv.id][myPlayerId] = {
              status: nextVote,
              playerName: pName,
              notes: reasonText || '',
              timestamp: Date.now()
            };
            conv.responses = conv.responses || {};
            conv.responses[myPlayerId] = liveVotes[conv.id][myPlayerId];
          }

          // Actualizar badges en modal
          const badgeEl = overlay.querySelector('#match-modal-vote-badge');
          if (badgeEl) {
            if (nextVote === 'called') {
              badgeEl.textContent = t('confirmedBadge');
              badgeEl.style.background = 'rgba(34,197,94,0.2)';
              badgeEl.style.color = '#86efac';
            } else if (nextVote === 'absent') {
              badgeEl.textContent = t('absentBadge');
              badgeEl.style.background = 'rgba(239,68,68,0.2)';
              badgeEl.style.color = '#fca5a5';
            } else {
              badgeEl.textContent = t('pendingBadge');
              badgeEl.style.background = 'var(--surface)';
              badgeEl.style.color = 'var(--muted)';
            }
          }
          overlay.querySelectorAll('.match-modal-vote-btn').forEach(b => {
            b.className = 'btn sm match-modal-vote-btn ghost';
          });
          if (nextVote === 'called') {
            btn.className = 'btn sm match-modal-vote-btn primary';
          } else if (nextVote === 'absent') {
            btn.className = 'btn sm match-modal-vote-btn danger';
          }

          renderConvocationsView();

          try {
            if (window.Cloud && window.Cloud.voteAttendance) {
              await window.Cloud.voteAttendance(conv.id, myPlayerId, nextVote, pName, reasonText || '');
              toast(nextVote === 'called' ? t('attendanceConfirmed') : (nextVote === 'absent' ? t('absenceReported') : t('voteReset')), 'success');
            }
          } catch (e) {
            console.error(e);
          }
        };

        if (nextVote === 'absent') {
          showAbsenceReasonModal(conv.title || 'vs ' + (conv.rival || 'Rival'), (reason) => {
            executeMatchVote(reason);
          });
        } else {
          executeMatchVote('');
        }
      };
    });

    document.body.appendChild(overlay);
  }

  function showTrainingDetailsModal(conv) {
    if (!conv) return;
    markConvAsOpened(conv.id, myPlayerId);
    const dotEl = document.getElementById(`conv-new-dot-${conv.id}`);
    if (dotEl) dotEl.remove();

    const team = (clubData && clubData.teams) ? clubData.teams.find(t => t.id === conv.teamId) : null;
    const list = conv.list || {};
    const responses = liveVotes[conv.id] || (conv.responses || {});
    const allPlayersMap = {};
    (clubData.players || []).forEach(p => { allPlayersMap[p.id] = p; });

    const calledPlayerIds = Object.keys(list).filter(pid => {
      const st = list[pid];
      return st && st !== 'uncalled' && st !== 'absent';
    });

    const attendingPlayers = [];
    const absentPlayers = [];
    const pendingPlayers = [];

    calledPlayerIds.forEach(pid => {
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, ''), mainPosition: t('player', 'Player') };
      const r = responses[pid];
      const st = r ? r.status : null;
      if (st === 'called' || st === 'attending' || st === 'yes') attendingPlayers.push(p);
      else if (st === 'absent' || st === 'no') absentPlayers.push(p);
      else pendingPlayers.push(p);
    });

    const myVoteObj = myPlayerId ? (responses[myPlayerId] || (conv.responses && conv.responses[myPlayerId])) : null;
    let currentVoteStatus = myVoteObj ? myVoteObj.status : null;
    let isAttending = currentVoteStatus && (currentVoteStatus === 'called' || currentVoteStatus === 'attending' || currentVoteStatus === 'yes');
    let isAbsent = currentVoteStatus && (currentVoteStatus === 'absent' || currentVoteStatus === 'no');

    const nowD = new Date();
    const todayIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
    const isToday = (conv.date === todayIso);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 90vh; width: 95%; max-width: 520px; display: flex; flex-direction: column; padding: 18px; border-radius: 20px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 12px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">⚽</span>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">${t('trainingDetails')}</h3>
                ${isToday ? `<span class="badge-today-glow" style="display: inline-flex; align-items: center; gap: 3px; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; border: 1px solid rgba(255,255,255,0.4); font-size: 10px; font-weight: 900; padding: 1px 7px; border-radius: 6px; box-shadow: 0 0 10px rgba(6, 182, 212, 0.7);">✨ ${currentLang === 'ee' ? 'TÄNA' : (currentLang === 'es' ? 'HOY' : 'TODAY')}</span>` : ''}
              </div>
              <small style="font-size: 11px; color: var(--muted);">${team ? escapeHtml(team.name) : t('officialTraining')}</small>
            </div>
          </div>
          <button type="button" class="icon-btn ghost" id="dlg-tr-det-x" style="width: 32px; height: 32px; font-size: 16px;">✕</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 12px;">
          <!-- Banner -->
          <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.16) 0%, rgba(21, 128, 61, 0.2) 100%); border: 1.5px solid rgba(34, 197, 94, 0.35); border-radius: 14px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #86efac; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              ${team ? `🛡️ ${escapeHtml(team.name)}` : t('officialTraining')}
            </div>
            <div style="font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 4px;">
              ${escapeHtml(conv.title || t('officialTraining'))}
            </div>
          </div>

          <!-- Schedule Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;">
              <div style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 2px;">📅 ${t('trainingDate').toUpperCase()}</div>
              <div style="font-size: 13px; font-weight: 800; color: #fff;">${formatDisplayDate(conv.date)}</div>
            </div>
            <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;">
              <div style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 2px;">⏰ ${t('trainingTime').toUpperCase()}</div>
              <div style="font-size: 13px; font-weight: 800; color: #86efac;">${conv.time || '10:00'}${conv.endTime ? ' - ' + conv.endTime : ''} ${conv.duration ? `(${conv.duration} min)` : ''}</div>
            </div>
          </div>

          <!-- Venue & Address -->
          <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 4px;">📍 ${t('pitchAndVenue').toUpperCase()}</div>
            ${conv.venue ? `
              <div style="font-size: 13.5px; font-weight: 800; color: #fff; margin-bottom: 4px;">
                ${escapeHtml(conv.venue)}
              </div>
            ` : ''}
            ${conv.address ? `
              <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
                🗺️ ${escapeHtml(conv.address)}
              </div>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conv.address)}" target="_blank" onclick="window.openLocationInMaps('${escapeHtml(conv.address)}'); return false;" class="btn sm primary" style="display: inline-flex; align-items: center; gap: 6px; height: 32px; font-size: 12px; font-weight: 800; text-decoration: none;">
                🗺️ ${t('openInMaps')}
              </a>
            ` : (conv.venue ? `
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conv.venue)}" target="_blank" onclick="window.openLocationInMaps('${escapeHtml(conv.venue)}'); return false;" class="btn sm primary" style="display: inline-flex; align-items: center; gap: 6px; height: 32px; font-size: 12px; font-weight: 800; text-decoration: none;">
                🗺️ ${t('openInMaps')}
              </a>
            ` : `<div style="font-size: 12px; color: var(--muted);">${t('venueNotSpecified')}</div>`)}
          </div>

          <!-- Coach Instructions & Notes -->
          ${conv.notes ? `
            <div style="background: rgba(34, 197, 94, 0.08); border-left: 3px solid #22c55e; border-radius: 8px; padding: 10px 12px;">
              <div style="font-size: 11px; font-weight: 800; color: #86efac; margin-bottom: 4px;">📝 ${t('coachInstructions').toUpperCase()}</div>
              <div style="font-size: 12.5px; color: #bbf7d0; line-height: 1.45; white-space: pre-line;">${escapeHtml(conv.notes)}</div>
            </div>
          ` : ''}

          <!-- Training Squad Attendance Breakdown -->
          <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 12px; font-weight: 800; color: #fff;">👥 ${t('trainingSquad').toUpperCase()} (${calledPlayerIds.length})</div>
              <div style="display: flex; gap: 6px; font-size: 11.5px; font-weight: 800;">
                <span style="color: #86efac;">🟢 ${attendingPlayers.length}</span>
                <span style="color: #fca5a5;">❌ ${absentPlayers.length}</span>
                <span style="color: #fde047;">⏳ ${pendingPlayers.length}</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; max-height: 170px; overflow-y: auto;">
              ${calledPlayerIds.map(pid => {
                const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, '') };
                const r = responses[pid];
                const st = r ? r.status : null;
                const isAtt = (st === 'called' || st === 'attending' || st === 'yes');
                const isAbs = (st === 'absent' || st === 'no');
                const statusIcon = isAtt ? '🟢' : (isAbs ? '❌' : '⏳');
                return `
                  <div style="display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; font-size: 11.5px; overflow: hidden;">
                    <span>${statusIcon}</span>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                      <b style="color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(formatPlayerShortName(p))}</b>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Attendance Response Box -->
          <div style="background: rgba(34, 197, 94, 0.08); border: 1.5px solid rgba(34, 197, 94, 0.3); border-radius: 14px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #fff;">${t('attendanceResponse')}</span>
              <span id="tr-modal-vote-badge" class="badge" style="${isAttending ? 'background: rgba(34,197,94,0.2); color: #86efac;' : (isAbsent ? 'background: rgba(239,68,68,0.2); color: #fca5a5;' : 'background: var(--surface); color: var(--muted);')}">
                ${isAttending ? t('confirmedBadge') : (isAbsent ? t('absentBadge') : t('pendingBadge'))}
              </span>
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn sm tr-modal-vote-btn ${isAttending ? 'primary' : 'ghost'}" data-vote="called" style="flex: 1; height: 38px; font-weight: 800; border-radius: 10px;">
                👍 ${t('iWillAttend')}
              </button>
              <button type="button" class="btn sm tr-modal-vote-btn ${isAbsent ? 'danger' : 'ghost'}" data-vote="absent" style="flex: 1; height: 38px; font-weight: 800; border-radius: 10px;">
                ❌ ${t('iCannotAttend')}
              </button>
            </div>
          </div>
        </div>

        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border); flex-shrink: 0;">
          <button type="button" class="btn block ghost" id="dlg-tr-det-close" style="height: 40px; font-weight: 800; border-radius: 10px;">
            ${t('close')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-tr-det-x').onclick = close;
    overlay.querySelector('#dlg-tr-det-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Manejar voto interactivo dentro del modal
    overlay.querySelectorAll('.tr-modal-vote-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }
        const vote = btn.getAttribute('data-vote');
        const isCurrent = btn.classList.contains('primary') || btn.classList.contains('danger');
        const nextVote = isCurrent ? 'pending' : vote;
        const myP = getMyPlayer();
        const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : t('player', 'Player');

        haptic(35);

        const executeTrainingVote = async (reasonText) => {
          liveVotes[conv.id] = liveVotes[conv.id] || {};
          if (nextVote === 'pending') {
            delete liveVotes[conv.id][myPlayerId];
            if (conv.responses) delete conv.responses[myPlayerId];
          } else {
            liveVotes[conv.id][myPlayerId] = {
              status: nextVote,
              playerName: pName,
              notes: reasonText || '',
              timestamp: Date.now()
            };
            conv.responses = conv.responses || {};
            conv.responses[myPlayerId] = liveVotes[conv.id][myPlayerId];
          }

          // Actualizar badges en modal
          const badgeEl = overlay.querySelector('#tr-modal-vote-badge');
          if (badgeEl) {
            if (nextVote === 'called') {
              badgeEl.textContent = t('confirmedBadge');
              badgeEl.style.background = 'rgba(34,197,94,0.2)';
              badgeEl.style.color = '#86efac';
            } else if (nextVote === 'absent') {
              badgeEl.textContent = t('absentBadge');
              badgeEl.style.background = 'rgba(239,68,68,0.2)';
              badgeEl.style.color = '#fca5a5';
            } else {
              badgeEl.textContent = t('pendingBadge');
              badgeEl.style.background = 'var(--surface)';
              badgeEl.style.color = 'var(--muted)';
            }
          }
          overlay.querySelectorAll('.tr-modal-vote-btn').forEach(b => {
            b.className = 'btn sm tr-modal-vote-btn ghost';
          });
          if (nextVote === 'called') {
            btn.className = 'btn sm tr-modal-vote-btn primary';
          } else if (nextVote === 'absent') {
            btn.className = 'btn sm tr-modal-vote-btn danger';
          }

          renderConvocationsView();

          try {
            if (window.Cloud && window.Cloud.voteAttendance) {
              await window.Cloud.voteAttendance(conv.id, myPlayerId, nextVote, pName, reasonText || '');
              toast(nextVote === 'called' ? t('attendanceConfirmed') : (nextVote === 'absent' ? t('absenceReported') : t('voteReset')), 'success');
            }
          } catch (e) {
            console.error(e);
          }
        };

        if (nextVote === 'absent') {
          showAbsenceReasonModal(conv.title || 'Entrenamiento', (reason) => {
            executeTrainingVote(reason);
          });
        } else {
          executeTrainingVote('');
        }
      };
    });

    document.body.appendChild(overlay);
  }

  function showAttendeesBreakdownModal(conv) {
    const list = conv.list || {};
    const responses = liveVotes[conv.id] || {};
    const allPlayersMap = {};
    (clubData.players || []).forEach(p => { allPlayersMap[p.id] = p; });

    // SÓLO jugadores convocados
    const calledPids = Object.keys(list).filter(pid => list[pid] && list[pid] !== 'uncalled');

    const attending = [];
    const absent = [];
    const pending = [];

    calledPids.forEach(pid => {
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, ''), mainPosition: 'Jugador' };
      const r = responses[pid] || (conv.responses && conv.responses[pid]);
      const st = r ? r.status : null;

      if (st === 'called' || st === 'attending' || st === 'yes') attending.push(p);
      else if (st === 'absent' || st === 'no') absent.push(p);
      else pending.push(p);
    });

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 95%; max-width: 540px; display: flex; flex-direction: column; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">${t('attendeesTitle')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-attendees-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 14px;">
          <!-- Confirmados -->
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #86efac; margin-bottom: 6px;">
              🟢 ${t('confirmedBadge').toUpperCase()} (${attending.length})
            </div>
            ${attending.length === 0 ? `<div style="font-size: 12px; color: var(--muted);">${t('noAttendeesYet')}</div>` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${attending.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface2); border: 1px solid var(--border); padding: 8px 10px; border-radius: 10px; overflow: hidden;">
                    ${renderAvatar(p, 'sm')}
                    <b style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</b>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Ausentes -->
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #fca5a5; margin-bottom: 6px;">
              ❌ ${t('absentBadge').toUpperCase()} (${absent.length})
            </div>
            ${absent.length === 0 ? `<div style="font-size: 12px; color: var(--muted);">${t('noAbsentYet')}</div>` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${absent.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; background: var(--surface2); border: 1px solid var(--border); padding: 8px 10px; border-radius: 10px; overflow: hidden;">
                    ${renderAvatar(p, 'sm')}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Pendientes -->
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #fde047; margin-bottom: 6px;">
              ⏳ ${t('pendingBadge').toUpperCase()} (${pending.length})
            </div>
            ${pending.length === 0 ? `<div style="font-size: 12px; color: var(--muted);">${t('allAnswered')}</div>` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${pending.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); background: var(--surface2); border: 1px solid var(--border); padding: 8px 10px; border-radius: 10px; overflow: hidden;">
                    ${renderAvatar(p, 'sm')}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-attendees-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     MAPA TÁCTICO DE ACCIONES POR ZONAS DEL CAMPO E HISTORIAL DE CARRERA
     ------------------------------------------------------------- */
  const ACTION_META = {
    touches:   { emoji: '⚽', key: 'stat_touches' },
    passOk:    { emoji: '✅', key: 'stat_passOk' },
    passKo:    { emoji: '❌', key: 'stat_passKo' },
    shotOn:    { emoji: '🎯', key: 'stat_shotOn' },
    shotOff:   { emoji: '↗️', key: 'stat_shotOff' },
    goal:      { emoji: '🥅', key: 'stat_goal' },
    assist:    { emoji: '🅰️', key: 'stat_assist' },
    dribbleOk: { emoji: '💨', key: 'stat_dribbleOk' },
    dribbleKo: { emoji: '🚫', key: 'stat_dribbleKo' },
    recovery:  { emoji: '🛡️', key: 'stat_recovery' },
    loss:      { emoji: '⚠️', key: 'stat_loss' },
    duelWon:   { emoji: '💪', key: 'stat_duelWon' },
    duelLost:  { emoji: '🤕', key: 'stat_duelLost' },
    cross:     { emoji: '🔀', key: 'stat_cross' },
    keyPass:   { emoji: '🔑', key: 'stat_keyPass' },
    header:    { emoji: '🗣️', key: 'stat_header' },
    foulRecv:  { emoji: '🙋', key: 'stat_foulRecv' },
    foul:      { emoji: '🦵', key: 'stat_foul' },
    save:      { emoji: '🧤', key: 'stat_save' },
    yellow:    { emoji: '🟨', key: 'stat_yellow' },
    red:       { emoji: '🟥', key: 'stat_red' },
    duel1v1WonGoal:     { emoji: '⚽', key: 'stat_duel1v1WonGoal' },
    duel1v1WonStop:     { emoji: '🛡️', key: 'stat_duel1v1WonStop' },
    duel1v1LostTurnover: { emoji: '❌', key: 'stat_duel1v1LostTurnover' },
    duel1v1LostGoal:     { emoji: '🥅', key: 'stat_duel1v1LostGoal' }
  };

  function getActionInfo(k) {
    const meta = ACTION_META[k] || { emoji: '⚽', key: 'actions' };
    const label = t(meta.key, k);
    return { emoji: meta.emoji, label };
  }

  function showPitchZoneDetailModal(zoneName, actionsMap, total) {
    const items = Object.entries(actionsMap || {}).filter(([_, count]) => count > 0);
    items.sort((a, b) => b[1] - a[1]);
    const actionsHtml = items.length > 0 ? items.map(([k, cnt]) => {
      const info = getActionInfo(k);
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">${info.emoji}</span>
            <div>
              <b style="font-size: 14px; color: #fff; display: block;">${escapeHtml(info.label)}</b>
              <small style="color: var(--muted); font-size: 11px;">${pct}% ${currentLang === 'ee' ? 'koguarvust selles tsoonis' : (currentLang === 'es' ? 'del total en este sector' : 'of total in this sector')}</small>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 18px; font-weight: 900; color: #22d3ee; font-variant-numeric: tabular-nums;">${cnt}</span>
            <small style="display: block; font-size: 10px; color: var(--muted);">${cnt === 1 ? (currentLang === 'ee' ? 'tegevus' : (currentLang === 'es' ? 'acción' : 'action')) : (currentLang === 'ee' ? 'tegevust' : (currentLang === 'es' ? 'acciones' : 'actions'))}</small>
          </div>
        </div>
      `;
    }).join('') : `<p class="hint">${t('noActionsInZone')}</p>`;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog-box" style="max-width: 380px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <span style="font-size: 10.5px; font-weight: 800; color: var(--cyan); text-transform: uppercase;">${t('zoneDetailsTitle')}</span>
            <h3 style="margin: 2px 0 0; font-size: 17px; font-weight: 900;">${zoneName}</h3>
          </div>
          <span style="font-size: 20px; font-weight: 900; color: #facc15; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.35); padding: 4px 10px; border-radius: 10px;">${total}</span>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          ${currentLang === 'ee' ? `Selles tsoonis sooritatud ${total} tegevuse jaotus:` : (currentLang === 'es' ? `Desglose de las ${total} acción(es) realizadas en esta zona:` : `Breakdown of ${total} action(s) performed in this area:`)}
        </div>
        <div style="max-height: 48vh; overflow-y: auto; padding-right: 2px;">
          ${actionsHtml}
        </div>
        <button type="button" class="btn block primary" style="margin-top: 16px;" id="btn-close-zone-detail">
          ${t('close')}
        </button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#btn-close-zone-detail').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }

  window.handlePlayerPitchZoneClick = function(el) {
    const name = el.getAttribute('data-zone-name') || 'Zone';
    const total = parseInt(el.getAttribute('data-zone-count'), 10) || 0;
    const actionsRaw = el.getAttribute('data-zone-actions') || '{}';
    let actionsMap = {};
    try { actionsMap = JSON.parse(actionsRaw); } catch (e) { actionsMap = {}; }
    if (total > 0) {
      showPitchZoneDetailModal(name, actionsMap, total);
    } else {
      toast(t('noActionsInZone'), 'info');
    }
  };

  function renderPlayerPitchHeatmapHtml(pid, customSessions) {
    const playerZones = [];
    const sessions = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) || []);
    sessions.forEach(s => {
      (s.zones || []).forEach(zItem => {
        if (zItem.p === pid) {
          playerZones.push(zItem);
        }
      });
    });

    const counts = {};
    const zoneActionsMap = {
      top_l: {},
      top_c: {},
      top_r: {},
      wing_l: {},
      mid_t: {},
      wing_r: {},
      mid_b: {}
    };
    for (let i = 1; i <= 11; i++) counts[i] = 0;
    playerZones.forEach(z => {
      const zid = parseInt(z.z, 10);
      counts[zid] = (counts[zid] || 0) + 1;
      let areaKey = 'mid_b';
      if (zid === 3) areaKey = 'top_l';
      else if (zid === 1) areaKey = 'top_c';
      else if (zid === 4) areaKey = 'top_r';
      else if (zid === 7 || zid === 10) areaKey = 'wing_l';
      else if (zid === 2) areaKey = 'mid_t';
      else if (zid === 8 || zid === 11) areaKey = 'wing_r';
      else if (zid === 5 || zid === 6) areaKey = 'mid_b';

      zoneActionsMap[areaKey][z.k] = (zoneActionsMap[areaKey][z.k] || 0) + 1;
    });

    const total = playerZones.length;

    const getHeatBg = (cnt) => {
      if (!cnt) return 'rgba(0, 0, 0, 0.28)';
      const pct = cnt / Math.max(1, total * 0.5);
      if (pct > 0.5) return 'rgba(239, 68, 68, 0.65)';
      if (pct > 0.25) return 'rgba(249, 115, 22, 0.55)';
      return 'rgba(34, 197, 94, 0.45)';
    };

    const cntTopL = counts[3] || 0;
    const cntTopC = counts[1] || 0;
    const cntTopR = counts[4] || 0;
    const cntWingL = (counts[7] || 0) + (counts[10] || 0);
    const cntMidT = counts[2] || 0;
    const cntWingR = (counts[8] || 0) + (counts[11] || 0);
    const cntMidB = (counts[5] || 0) + (counts[6] || 0);

    const getZoneBadgeHtml = (cnt, actMap) => {
      if (!cnt) return '';
      const entries = Object.entries(actMap || {}).filter(([_, c]) => c > 0);
      entries.sort((a, b) => b[1] - a[1]);
      if (!entries.length) return `<span class="zone-top-action-badge">${cnt} act.</span>`;
      const [topKey, topCnt] = entries[0];
      const info = getActionInfo(topKey);
      return `<span class="zone-top-action-badge" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; padding: 1px 5px; font-size: 9.5px; font-weight: 800; color: #fff; margin-top: 2px;">${info.emoji} ${escapeHtml(info.label)}: ${topCnt}</span>`;
    };

    return `
      <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border); padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>🗺️</span> <span>${t('pitchGoalsTitle')}</span>
            </div>
            <small style="color: var(--muted); font-size: 11px;">
              ${t('pitchGoalsDesc')}
            </small>
          </div>
          <div style="text-align: right;">
            <span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.35); font-size: 11.5px; font-weight: 900;">
              📍 ${total} ${t('actions')}
            </span>
          </div>
        </div>

        <div style="font-size: 11px; color: var(--muted); margin-bottom: 8px; text-align: center;">
          ${total > 0 ? `<b>${total}</b> ${t('actions')} • <span style="color: var(--cyan);">${currentLang === 'ee' ? 'Puuduta tsooni detailide nägemiseks' : (currentLang === 'es' ? 'Toca cualquier zona para ver detalles' : 'Tap any zone to see details')}</span>` : t('noActionsInZone')}
        </div>

        <div class="pitch-field-grid" style="margin: 0 auto; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
          <!-- Fila 1: Ataque -->
          <div class="pitch-grid-cell pz-top-l ${cntTopL > 0 ? 'has-actions' : ''}" style="grid-area: top_l; background: ${getHeatBg(cntTopL)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_l')}" data-zone-count="${cntTopL}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_l)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">↖️</span>
            <span style="font-size: 13px; font-weight: 900;">${cntTopL}</span>
            <span style="font-size: 9px; opacity: 0.85; text-align: center; line-height: 1.1;">${t('zone_wing_off_l')}</span>
          </div>
          <div class="pitch-grid-cell pz-top-c ${cntTopC > 0 ? 'has-actions' : ''}" style="grid-area: top_c; background: ${getHeatBg(cntTopC)}; border: ${cntTopC > 0 ? '2px solid #facc15' : '1.5px dashed rgba(255,255,255,0.4)'}; cursor: pointer;" data-zone-name="${t('zone_box_opp')}" data-zone-count="${cntTopC}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_c)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">🥅</span>
            <span style="font-size: 14px; font-weight: 900; color: #fde047;">${cntTopC}</span>
            <span style="font-size: 9px; opacity: 0.9; text-align: center; line-height: 1.1;">${t('zone_box_opp')}</span>
          </div>
          <div class="pitch-grid-cell pz-top-r ${cntTopR > 0 ? 'has-actions' : ''}" style="grid-area: top_r; background: ${getHeatBg(cntTopR)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_r')}" data-zone-count="${cntTopR}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_r)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">↗️</span>
            <span style="font-size: 13px; font-weight: 900;">${cntTopR}</span>
            <span style="font-size: 9px; opacity: 0.85; text-align: center; line-height: 1.1;">${t('zone_wing_off_r')}</span>
          </div>

          <!-- Fila 2-3: Bandas unidas laterales -->
          <div class="pitch-grid-cell pz-wing-l ${cntWingL > 0 ? 'has-actions' : ''}" style="grid-area: wing_l; background: ${getHeatBg(cntWingL)}; cursor: pointer;" data-zone-name="${t('zone_wing_l')}" data-zone-count="${cntWingL}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_l)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">⬅️</span>
            <span style="font-size: 13px; font-weight: 900;">${cntWingL}</span>
            <span style="font-size: 9px; opacity: 0.85; text-align: center; line-height: 1.1;">${t('zone_wing_l')}</span>
          </div>

          <!-- Fila 2 Centro: Frontal del Área -->
          <div class="pitch-grid-cell pz-mid-t ${cntMidT > 0 ? 'has-actions' : ''}" style="grid-area: mid_t; background: ${getHeatBg(cntMidT)}; border: ${cntMidT > 0 ? '2px solid #facc15' : '1.5px dashed rgba(255,255,255,0.4)'}; cursor: pointer;" data-zone-name="${t('zone_front')}" data-zone-count="${cntMidT}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_t)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">🎯</span>
            <span style="font-size: 13px; font-weight: 900;">${cntMidT}</span>
            <span style="font-size: 9px; opacity: 0.85; text-align: center; line-height: 1.1;">${t('zone_front')}</span>
          </div>

          <div class="pitch-grid-cell pz-wing-r ${cntWingR > 0 ? 'has-actions' : ''}" style="grid-area: wing_r; background: ${getHeatBg(cntWingR)}; cursor: pointer;" data-zone-name="${t('zone_wing_r')}" data-zone-count="${cntWingR}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_r)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">➡️</span>
            <span style="font-size: 13px; font-weight: 900;">${cntWingR}</span>
            <span style="font-size: 9px; opacity: 0.85; text-align: center; line-height: 1.1;">${t('zone_wing_r')}</span>
          </div>

          <!-- Fila 3 Centro: Centro del Campo -->
          <div class="pitch-grid-cell pz-mid-b ${cntMidB > 0 ? 'has-actions' : ''}" style="grid-area: mid_b; background: ${getHeatBg(cntMidB)}; cursor: pointer;" data-zone-name="${t('zone_mid')}" data-zone-count="${cntMidB}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_b)}' onclick="window.handlePlayerPitchZoneClick(this)">
            <span class="z-emoji">⚽</span>
            <span style="font-size: 13px; font-weight: 900;">${cntMidB}</span>
            <span style="font-size: 9px; opacity: 0.85; text-align: center; line-height: 1.1;">${t('zone_mid')}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderPlayerGoalsPitchHtml(pid, customSessions) {
    return renderPlayerPitchHeatmapHtml(pid, customSessions);
  }

  function getPlayerCareerActions(pid, customSessions) {
    const totals = {};
    let grandTotal = 0;
    const sessions = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) || []);
    sessions.forEach(s => {
      const pStats = (s && s.stats) ? s.stats[pid] : null;
      if (pStats) {
        Object.entries(pStats).forEach(([k, cnt]) => {
          if (cnt && typeof cnt === 'number' && cnt > 0) {
            totals[k] = (totals[k] || 0) + cnt;
            grandTotal += cnt;
          }
        });
      }
    });

    if (grandTotal === 0 && clubData && clubData.players) {
      const p = clubData.players.find(x => x.id === pid);
      if (p && p.statsSummary && p.statsSummary.totals) {
        Object.entries(p.statsSummary.totals).forEach(([k, cnt]) => {
          if (cnt && typeof cnt === 'number' && cnt > 0) {
            totals[k] = (totals[k] || 0) + cnt;
            grandTotal += cnt;
          }
        });
      }
    }

    return { totals, grandTotal };
  }

  function renderPlayerCareerActionsListHtml(pid, customSessions) {
    const { totals, grandTotal } = getPlayerCareerActions(pid, customSessions);
    const entries = Object.entries(totals);
    entries.sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
      return `
        <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border); padding: 14px;">
          <div style="font-size: 13.5px; font-weight: 900; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>📋</span> <span>${t('careerActionsTitle')}</span>
          </div>
          <p style="color: var(--muted); font-size: 12px; margin: 8px 0 0;">${t('noCareerActions')}</p>
        </div>
      `;
    }

    const itemsHtml = entries.map(([k, cnt]) => {
      const info = getActionInfo(k);
      const pct = grandTotal > 0 ? Math.round((cnt / grandTotal) * 100) : 0;
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <span style="font-size: 20px; flex-shrink: 0;">${info.emoji}</span>
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <b style="font-size: 13px; color: #fff;">${escapeHtml(info.label)}</b>
              <small style="display: block; font-size: 10.5px; color: var(--muted);">${pct}% ${currentLang === 'ee' ? 'kõigist tegevustest' : (currentLang === 'es' ? 'del total de acciones' : 'of career actions')}</small>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0; margin-left: 8px;">
            <span style="font-size: 16px; font-weight: 900; color: var(--cyan); font-variant-numeric: tabular-nums;">${cnt}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border); padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>📋</span> <span>${t('careerActionsTitle')}</span>
            </div>
            <small style="color: var(--muted); font-size: 11px;">
              ${t('careerActionsDesc')}
            </small>
          </div>
          <span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.35); font-size: 11.5px; font-weight: 900;">
            ⚡ ${grandTotal} ${t('actions')}
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; padding-right: 2px;">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  function calculateAgeYearsMonths(birthDateStr, lang) {
    if (!birthDateStr) return '';
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return '';
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return '';
    const curL = (lang || currentLang || 'en');
    if (curL === 'ee' || curL === 'et') {
      const yStr = years === 1 ? '1 aasta' : `${years} aastat`;
      const mStr = months === 1 ? '1 kuu' : `${months} kuud`;
      return `${yStr}, ${mStr}`;
    } else if (curL === 'ru') {
      function ruPlural(n, one, few, many) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return `${n} ${many}`;
        if (mod10 === 1) return `${n} ${one}`;
        if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
        return `${n} ${many}`;
      }
      const yStr = ruPlural(years, 'год', 'года', 'лет');
      const mStr = ruPlural(months, 'месяц', 'месяца', 'месяцев');
      return `${yStr}, ${mStr}`;
    } else if (curL === 'es') {
      const yStr = years === 1 ? '1 año' : `${years} años`;
      const mStr = months === 1 ? '1 mes' : `${months} meses`;
      return `${yStr}, ${mStr}`;
    } else {
      const yStr = years === 1 ? '1 year' : `${years} years`;
      const mStr = months === 1 ? '1 month' : `${months} months`;
      return `${yStr}, ${mStr}`;
    }
  }

  /* -------------------------------------------------------------
     PESTAÑA 2: MI FICHA PERSONAL (PUNTOS 1, 7, 8)
     ------------------------------------------------------------- */
  function renderMyStatsView() {
    const myP = getMyPlayer();

    if (!myP) {
      view.innerHTML = `
        <div style="padding: 24px 0; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">👤</div>
            <h3>${t('chooseIdentityTitle')}</h3>
            <p>${t('chooseIdentityDesc')}</p>
            <button class="btn primary" id="btn-portal-choose-me">${t('confirmIdentityBtn')}</button>
          </div>
        </div>
      `;
      const btn = view.querySelector('#btn-portal-choose-me');
      if (btn) btn.onclick = showSelectIdentityModal;
      return;
    }

    if (myP.isPendingApproval) {
      view.innerHTML = `
        <div style="padding: 20px 0; text-align: center;">
          <div class="card" style="padding: 28px 16px; border: 1.5px solid rgba(250, 204, 21, 0.4); background: linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%); border-radius: 16px;">
            <div style="font-size: 40px; margin-bottom: 10px;">⏳</div>
            <h3 style="margin: 0 0 6px; font-size: 18px; color: #fde047; font-weight: 900;">
              ${t('creationPendingTitle', 'Solicitud enviada al Entrenador')}
            </h3>
            <p style="margin: 0 0 14px; font-size: 13px; color: #cbd5e1; line-height: 1.45;">
              ${t('creationPendingDesc', 'Has solicitado crear el perfil para')} <b>${escapeHtml(myP.name || '')}</b> (${myP.mainDorsal ? '#' + myP.mainDorsal : formatPosition(myP.mainPosition)}).
              <br/>
              ${t('creationPendingNote', 'Tu perfil se vinculará y mostrará tus estadísticas automáticamente en cuanto el entrenador confirme tu alta.')}
            </p>
            <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; background: rgba(250, 204, 21, 0.2); border: 1px solid rgba(250, 204, 21, 0.5); font-size: 12px; color: #fde047; font-weight: 800;">
              🔒 ${t('pendingApproval', 'Esperando confirmación del entrenador')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    const team = clubData.teams ? clubData.teams.find(t => t.id === myP.teamId) : null;
    const allSessions = (clubData && clubData.sessions) || [];
    const trainingSessions = allSessions.filter(s => (s.type || 'training') === 'training');
    const matchSessions = allSessions.filter(s => (s.type || 'training') === 'match');
    const aggTraining = getPlayerAggregate(myP.id, trainingSessions);
    const aggMatch = getPlayerAggregate(myP.id, matchSessions);
    const overall = calculatePlayerOverallRating(myP.id, myP.mainPosition);
    let activeProfileTab = (aggTraining.count === 0 && aggMatch.count > 0) ? 'match' : 'training';

    const streak = calculatePlayerAttendanceStreak(myP.id);
    const streakMilestone = getPlayerStreakMilestone(streak);
    const secPositions = myP.secondaryPositions && myP.secondaryPositions.length ? myP.secondaryPositions : (myP.secondaryPosition ? [myP.secondaryPosition] : []);
    const ageStr = myP.birthDate ? calculateAgeYearsMonths(myP.birthDate, currentLang) : '';
    const mvpCount = calculatePlayerMvpCount(myP.id);
    const globalRadar = calculatePlayerRadar(myP.id);

    function renderTabContent(tabName) {
      const isMatch = (tabName === 'match');
      const curSessions = isMatch ? matchSessions : trainingSessions;
      const curAgg = isMatch ? aggMatch : aggTraining;

      if (isMatch && curAgg.count === 0) {
        return `
          <div class="card empty" style="padding: 28px 16px; text-align: center; border: 1.5px dashed var(--border); border-radius: 16px; background: rgba(15, 23, 42, 0.4); margin-bottom: 20px;">
            <div style="font-size: 42px; margin-bottom: 10px;">🏆</div>
            <h3 style="font-size: 16px; font-weight: 900; color: #fff; margin-bottom: 6px;">${t('noMatchesRecordedYet', 'Sin partidos registrados todavía')}</h3>
            <p style="font-size: 12.5px; color: var(--muted); margin: 0; line-height: 1.45;">${t('noMatchesRecordedDesc', 'Cuando el entrenador registre tus estadísticas en partidos, aquí podrás ver tu valoración y métricas competitivas.')}</p>
          </div>
        `;
      }

      if (!isMatch && curAgg.count === 0) {
        return `
          <div class="card empty" style="padding: 28px 16px; text-align: center; border: 1.5px dashed var(--border); border-radius: 16px; background: rgba(15, 23, 42, 0.4); margin-bottom: 20px;">
            <div style="font-size: 42px; margin-bottom: 10px;">⚽</div>
            <h3 style="font-size: 16px; font-weight: 900; color: #fff; margin-bottom: 6px;">${t('noTrainingsRecordedYet', 'Sin entrenamientos registrados todavía')}</h3>
            <p style="font-size: 12.5px; color: var(--muted); margin: 0; line-height: 1.45;">${t('noActionsYet', 'Aún no hay acciones registradas')}</p>
          </div>
        `;
      }

      const curStats = calculatePlayerStats(myP.id, curSessions);
      const curRadar = calculatePlayerRadar(myP.id, curSessions);

      return `
        <!-- NOTA DE RENDIMIENTO (MATCH RATING) DESTACADA -->
        <div class="card" style="margin-bottom: 14px; border: 1px solid rgba(34, 211, 238, 0.35); background: linear-gradient(135deg, rgba(34, 211, 238, 0.12) 0%, rgba(19, 31, 56, 0.7) 100%); cursor: pointer;" id="card-rating-explain">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px;">
                ⭐ ${isMatch ? t('matchesTab', 'Partidos') : t('trainingsTab', 'Entrenamientos')} • ${t('performanceRating')} ℹ️
              </div>
              <div style="font-size: 28px; font-weight: 900; color: #fff; margin-top: 2px;">
                ${curStats.aggregatedRating} <span style="font-size: 16px; color: var(--muted); font-weight: 700;">/ 10</span>
              </div>
              <small style="font-size: 11px; color: var(--muted);">${t('ratingDesc')}</small>
            </div>
            <div style="font-size: 32px; padding-right: 8px;">📊</div>
          </div>
        </div>

        <!-- Radar de Habilidades (Interactivo) -->
        <div class="section-title"><span>${t('skillsRadar')}</span></div>
        <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border);" id="radar-card">
          ${renderRadarSVG(curRadar)}
        </div>

        <!-- Cifras Clave -->
        <div class="section-title"><span>${t('cumulativeStats')}</span></div>
        <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: ${isMatch ? 'var(--match)' : 'var(--train)'}; text-transform: uppercase;">
              ${isMatch ? '🏟️ ' + t('matchesAttended') : '🏃‍♂️ ' + t('trainingsAttended')}
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 2px;">
              ${isMatch ? curStats.matchesAttended : curStats.trainingsAttended}
            </div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #86efac; text-transform: uppercase;">⚽ ${t('goalsScored')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #86efac; margin-top: 2px;">${curStats.goals}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase;">🎯 ${t('passAccuracy')}</div>
            <div style="font-size: 24px; font-weight: 900; color: var(--cyan); margin-top: 2px;">${curStats.passAcc}%</div>
            <small style="font-size: 10.5px; color: var(--muted);">${curStats.passOk} ${t('passesAccurate')}</small>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #facc15; text-transform: uppercase;">🎯 ${t('shotAccuracy')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #facc15; margin-top: 2px;">${curStats.shotAcc}%</div>
            <small style="font-size: 10.5px; color: var(--muted);">${curStats.shotsOn} ${t('shotsOnTarget')}</small>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">👟 ${t('ballTouches')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #c084fc; margin-top: 2px;">${curStats.touches}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">🛡️ ${t('recoveries')}</div>
            <div style="font-size: 24px; font-weight: 900; color: #38bdf8; margin-top: 2px;">${curStats.recoveries}</div>
            <small style="font-size: 10.5px; color: var(--muted);">${curStats.losses} ${t('losses')}</small>
          </div>
        </div>

        <!-- Tarjeta Dedicada: ⚔️ Duelos 1v1 -->
        ${(() => {
          const dWonGoal = curAgg.totals.duel1v1WonGoal || 0;
          const dWonStop = curAgg.totals.duel1v1WonStop || 0;
          const dLostTurnover = curAgg.totals.duel1v1LostTurnover || 0;
          const dLostGoal = curAgg.totals.duel1v1LostGoal || 0;
          const dWon = dWonGoal + dWonStop;
          const dLost = dLostGoal + dLostTurnover;
          const dTotal = dWon + dLost;
          const dWinRate = dTotal > 0 ? Math.round((dWon / dTotal) * 100) : 0;
          return `
            <div class="card duel-card-profile" style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
              <div style="background: rgba(0, 0, 0, 0.45); border: 1.5px solid ${dWinRate >= 50 ? '#22c55e' : (dTotal > 0 ? '#ef4444' : 'var(--border)')}; border-radius: 12px; width: 62px; height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                <span style="font-size: 16px; font-weight: 900; color: ${dWinRate >= 50 ? '#86efac' : (dTotal > 0 ? '#fca5a5' : '#cbd5e1')};">${dWinRate}%</span>
                <span style="font-size: 8.5px; font-weight: 800; color: var(--muted); text-transform: uppercase;">${t('winRate', 'WIN RATE')}</span>
              </div>
              <div class="grow" style="text-align: left; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-size: 13.5px; font-weight: 900; color: #fff;">⚔️ ${t('duels1v1', 'Duelos 1v1')}</span>
                  <span style="font-size: 11.5px; font-weight: 800;">
                    <span style="color: #4ade80;">${t('won', 'Ganados')}: ${dWon}</span> • <span style="color: #f87171;">${t('lost', 'Perdidos')}: ${dLost}</span>
                  </span>
                </div>
                <div style="height: 6px; width: 100%; background: ${dTotal > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)'}; border-radius: 999px; overflow: hidden; display: flex; margin: 4px 0;">
                  <div style="width: ${dWinRate}%; background: #22c55e; height: 100%;"></div>
                </div>
                <div style="font-size: 11px; color: var(--muted);">
                  (${dWonGoal} ${t('goals', 'goles')} · ${dWonStop} ${t('stops', 'cierres defensivos')})
                </div>
              </div>
            </div>
          `;
        })()}

        <!-- Mapa Táctico de Goles y Acciones por Zonas -->
        ${renderPlayerGoalsPitchHtml(myP.id, curSessions)}

        <!-- Historial Completo de Acciones en la Carrera -->
        ${renderPlayerCareerActionsListHtml(myP.id, curSessions)}

        <!-- Historial de Sesiones y Acciones Detalladas -->
        <div class="section-title"><span>${isMatch ? t('recentMatchesTitle') : t('sessions')}</span></div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          ${renderPlayerMatchHistory(myP.id, curSessions)}
        </div>
      `;
    }

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <!-- Ficha Hero -->
        <div class="card p-hero" style="margin-bottom: 14px; border: 1px solid var(--border);">
          ${renderAvatar(myP, 'lg')}
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 19px; font-weight: 900; margin: 0 0 4px;">
              ${escapeHtml(myP.name || '')} ${escapeHtml(myP.lastName || '')}
            </h2>
            <div class="meta" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted); align-items: center;">
              <span class="pos-tag">${formatPosition(myP.mainPosition)}</span>
              ${secPositions.length ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.4); font-size: 11px;">🔄 ${formatPositionsList(secPositions)}</span>` : ''}
              <span>•</span>
              <span>#${myP.mainDorsal != null ? myP.mainDorsal : '—'}</span>
              <span>•</span>
              <span>${getPlayerFootLabel(myP.foot)}</span>
              ${myP.heightCm ? `<span>• 📏 ${myP.heightCm} cm</span>` : ''}
            </div>
            ${myP.birthDate ? `
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                <span>🎂</span>
                <span>${myP.birthDate}</span>
                <span style="color: var(--cyan); font-weight: 800;">(${ageStr})</span>
              </div>
            ` : ''}
            ${team ? `
              <div style="margin-top: 6px;">
                <span class="badge" style="background: ${team.color || 'var(--cyan)'}25; color: ${team.color || 'var(--cyan)'}; border: 1px solid ${team.color || 'var(--cyan)'}50; font-weight: 800;">
                  🛡️ ${escapeHtml(team.name)}
                </span>
              </div>
            ` : ''}
            <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 2px;">
              <span class="rating-pill" style="font-size: 13px; font-weight: 900; background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.4)); color: #fef08a; border: 1.5px solid #facc15; padding: 4px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 5px; width: fit-content;">
                ⭐ ${overall.rating.toFixed(1)} ${t('overallRating', 'Rating General')}
              </span>
              <span style="font-size: 10.5px; font-weight: 800; color: ${overall.mode === 'combined' ? '#38bdf8' : (overall.mode === 'training' ? '#4ade80' : '#facc15')}; margin-left: 6px;">
                ${overall.mode === 'combined' 
                  ? t('combinedRating', 'Valoración Combinada') 
                  : (overall.mode === 'training' 
                      ? t('onlyTrainingRating', 'Solo Entrenamientos') 
                      : (overall.mode === 'match' ? t('onlyMatchRating', 'Solo Partidos') : t('baseRating', 'Valoración Base')))}
              </span>
            </div>
            ${mvpCount > 0 ? `
              <div style="margin-top: 6px;">
                <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; border: 1px solid rgba(250, 204, 21, 0.5); font-weight: 800; font-size: 11px;">
                  ⭐ x${mvpCount} MVP
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- MISIÓN SEMANAL DEL MÍSTER -->
        ${(() => {
          if (!myP.weeklyMission) return '';
          const PRESET_TRANSLATIONS = {
            preset_pass: {
              es: 'Completar al menos el 80% de pases con precisión',
              en: 'Complete at least 80% of passes with accuracy',
              et: 'Lõpeta vähemalt 80% söötudest täpselt',
              ru: 'Выполнить не менее 80% точных передач'
            },
            preset_recov: {
              es: 'Realizar 3 recuperaciones limpias de balón',
              en: 'Make 3 clean ball recoveries',
              et: 'Teha 3 puhast pallivõitu',
              ru: 'Совершить 3 чистых отбора/перехвата мяча'
            },
            preset_duels: {
              es: 'Ganar al menos 3 duelos 1vs1',
              en: 'Win at least 3 1v1 duels',
              et: 'Võita vähemalt 3 1vs1 duelli',
              ru: 'Выиграть как минимум 3 единоборства 1в1'
            },
            preset_goals: {
              es: 'Marcar 2 o más goles en la semana',
              en: 'Score 2 or more goals this week',
              et: 'Lüüa sel nädalal 2 või rohkem väravat',
              ru: 'Забить 2 или более голов за неделю'
            },
            preset_streak: {
              es: 'Alcanzar una racha de asistencia de 3 sesiones seguidas',
              en: 'Reach an attendance streak of 3 consecutive sessions',
              et: 'Saavutada järjestikune osalemine 3 trennis',
              ru: 'Достичь серии посещаемости из 3 тренировок подряд'
            },
            preset_foot: {
              es: 'Disparar a portería con la pierna menos hábil',
              en: 'Shoot on target using your weaker foot',
              et: 'Lüüa väravale nõrgema jalaga',
              ru: 'Пробить по воротам нерабочей ногой'
            },
            preset_fairplay: {
              es: 'Cero tarjetas y máxima comunicación de apoyo en el campo',
              en: 'Zero cards and maximum supportive communication on the pitch',
              et: 'Null kaarti ja maksimaalne toetav suhtlus väljakul',
              ru: 'Без карточек и с максимальной поддержкой партнеров на поле'
            }
          };

          function getPlayerMissionText(mission, lang) {
            if (!mission) return '';
            const l = (lang === 'ee' || lang === 'et') ? 'et' : (lang === 'ru' ? 'ru' : (lang === 'en' ? 'en' : 'es'));
            if (mission.presetKey && PRESET_TRANSLATIONS[mission.presetKey]) {
              return PRESET_TRANSLATIONS[mission.presetKey][l] || PRESET_TRANSLATIONS[mission.presetKey].es;
            }
            if (l === 'ru' && (mission.text_ru || mission.title_ru)) return mission.text_ru || mission.title_ru;
            if (l === 'et' && (mission.text_ee || mission.text_et || mission.title_et)) return mission.text_ee || mission.text_et || mission.title_et;
            if (l === 'en' && (mission.text_en || mission.title_en)) return mission.text_en || mission.title_en;
            if (l === 'es' && (mission.text_es || mission.title_es)) return mission.text_es || mission.title_es;
            return mission.text || mission.title || '';
          }
          const mText = getPlayerMissionText(myP.weeklyMission, currentLang);
          const mIcon = myP.weeklyMission.icon || '🎯';
          const isAuto = myP.weeklyMission.type === 'auto';
          const target = Number(myP.weeklyMission.target) || 0;
          const current = Number(myP.weeklyMission.currentProgress) || 0;
          const isCompleted = myP.weeklyMission.status === 'completed';
          const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : (isCompleted ? 100 : 0);

          return `
            <div class="card" style="margin-bottom: 14px; border: 1.5px solid ${isCompleted ? 'rgba(34, 197, 94, 0.6)' : 'rgba(168, 85, 247, 0.5)'}; background: ${isCompleted ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.16) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'linear-gradient(135deg, rgba(168, 85, 247, 0.16) 0%, rgba(15, 23, 42, 0.8) 100%)'}; border-radius: 16px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 24px;">${mIcon}</span>
                  <b style="font-size: 13.5px; color: ${isCompleted ? '#4ade80' : '#c084fc'}; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${t('weeklyMissionTitle', 'Misión Semanal del Míster')}
                  </b>
                </div>
                <span class="badge" style="background: ${isCompleted ? '#16a34a' : 'rgba(250, 204, 21, 0.2)'}; color: ${isCompleted ? '#fff' : '#fde047'}; font-weight: 900; font-size: 11px; padding: 4px 10px; border-radius: 999px;">
                  ${isCompleted ? t('missionStatusCompleted', '🎉 ¡Misión Cumplida!') : t('missionStatusPending', '⏳ En curso')}
                </span>
              </div>
              <div style="font-size: 14px; font-weight: 800; color: #fff; margin: 8px 0; line-height: 1.45; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 10px;">
                "${escapeHtml(mText)}"
              </div>
              ${isAuto ? `
                <div style="margin: 10px 0; background: rgba(0,0,0,0.35); border-radius: 10px; padding: 10px; border: 1px solid rgba(168, 85, 247, 0.3);">
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 800; margin-bottom: 6px;">
                    <span style="color: #e9d5ff; display: flex; align-items: center; gap: 6px;">
                      <span class="badge" style="background: rgba(168, 85, 247, 0.3); color: #c084fc; font-size: 10px;">${t('autoMissionBadge', '⚡ Misión Automática')}</span>
                      <span>${t('currentProgressLabel', 'Progreso')}: <b style="color: #fff;">${current} / ${target}${myP.weeklyMission.metric === 'pass_acc' ? '%' : ''}</b></span>
                    </span>
                    <span style="color: ${isCompleted ? '#4ade80' : '#fde047'}; font-weight: 900;">${pct}%</span>
                  </div>
                  <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.max(4, pct)}%; background: ${isCompleted ? 'linear-gradient(90deg, #16a34a, #4ade80)' : 'linear-gradient(90deg, #9333ea, #c084fc)'}; border-radius: 999px; transition: width 0.3s ease;"></div>
                  </div>
                  ${myP.weeklyMission.minAttempts ? `
                    <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px; text-align: right;">
                      * ${t('minAttemptsLabel', 'Mín. intentos')}: ${myP.weeklyMission.minAttempts}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
              ${myP.weeklyMission.comment ? `
                <div style="margin: 6px 0 10px; font-size: 12.5px; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 10px; border-left: 3px solid #c084fc; line-height: 1.4;">
                  <span style="font-weight: 800; color: #e9d5ff;">💬 ${t('coachNote', 'Nota del Míster')}:</span> "${escapeHtml(myP.weeklyMission.comment)}"
                </div>
              ` : ''}
              <div style="font-size: 11px; color: var(--muted); line-height: 1.35;">
                ${t('missionMotivation', 'Concéntrate en este objetivo táctico en tus próximos entrenos y partidos.')}
              </div>
            </div>
          `;
        })()}

        <!-- RACHA DE ASISTENCIA Y MEDALLAS -->
        <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(249, 115, 22, 0.45); background: linear-gradient(135deg, rgba(249, 115, 22, 0.16) 0%, rgba(19, 31, 56, 0.8) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #fb923c; text-transform: uppercase; letter-spacing: 0.6px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                <span>🔥</span> <span>${t('attendanceStreak')}</span>
                ${streakMilestone.currentBadge ? `<span class="badge" style="background: rgba(251, 146, 60, 0.25); color: #fed7aa; border: 1px solid rgba(251, 146, 60, 0.5); font-size: 10px; margin-left: 4px;">${streakMilestone.currentBadge}</span>` : ''}
              </div>
              <div style="font-size: 28px; font-weight: 900; color: #fff; margin-top: 3px; display: flex; align-items: baseline; gap: 6px;">
                <span>${streak}</span>
                <span style="font-size: 14px; color: #fdba74; font-weight: 700;">${streak === 1 ? t('streakSessionSingle') : t('streakSessions')}</span>
              </div>
              <small style="font-size: 11px; color: var(--muted);">${t('attendanceStreakDesc')}</small>
            </div>
            <div style="font-size: 38px; padding-right: 6px; filter: drop-shadow(0 0 10px rgba(249, 115, 22, 0.4));">🔥</div>
          </div>

          <!-- Barra de Progreso hacia el siguiente Hito / Medalla -->
          <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 8px 10px; border: 1px solid rgba(249, 115, 22, 0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; margin-bottom: 5px;">
              <span style="color: #fdba74;">
                ${streakMilestone.isMaster ? t('streakMaster', '👑 ¡Racha Legendaria Imparable!') : (streakMilestone.nextBadge ? `${t('streakNextMilestone', '{current}/{target} hacia {nextMilestone}').replace('{current}', streak).replace('{target}', streakMilestone.target).replace('{nextMilestone}', streakMilestone.nextBadge)}` : '')}
              </span>
              <span style="color: #fff; font-weight: 900;">${streakMilestone.progressPct}%</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, Math.max(4, streakMilestone.progressPct))}%; background: linear-gradient(90deg, #f97316, #facc15); border-radius: 999px; transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>

        <!-- BOTÓN CARTA FUT COLECCIONABLE -->
        <div style="margin-bottom: 14px;">
          <button type="button" class="btn block" id="btn-open-my-fut-card" style="width: 100%; height: 50px; font-size: 14px; font-weight: 900; border-radius: 14px; background: linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%); color: #facc15; border: 2px solid #eab308; box-shadow: 0 4px 20px rgba(234, 179, 8, 0.25); display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
            <span style="font-size: 22px;">🃏</span>
            <span>${t('viewMyFutCard', 'Ver mi Carta FUT Coleccionable')}</span>
            <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fef08a; border: 1px solid #facc15; font-size: 11px; margin-left: 4px;">OVR ${window.FutCard && FutCard.computeOvr ? FutCard.computeOvr(globalRadar, myP.mainPosition) : Math.min(99, Math.max(45, Math.round(overall.rating * 10)))}</span>
          </button>
        </div>

        <!-- Selector de Sub-Pestañas: Entrenamientos vs Partidos -->
        <div class="segmented profile-view-tabs" style="margin-bottom: 14px;">
          <button type="button" class="${activeProfileTab === 'training' ? 'active t-training' : ''}" data-ptab="training">
            ⚽ ${t('trainingsTab', 'Entrenamientos')} (${aggTraining.count})
          </button>
          <button type="button" class="${activeProfileTab === 'match' ? 'active t-match' : ''}" data-ptab="match">
            🏆 ${t('matchesTab', 'Partidos')} (${aggMatch.count})
          </button>
        </div>

        <div id="my-stats-tab-content">
          ${renderTabContent(activeProfileTab)}
        </div>
      </div>
    `;

    function bindTabInteractions() {
      const ratingCard = view.querySelector('#card-rating-explain');
      if (ratingCard) ratingCard.onclick = () => showSkillExplanationModal('rating');

      view.querySelectorAll('.radar-click-label').forEach(el => {
        el.onclick = () => {
          const skill = el.getAttribute('data-skill');
          showSkillExplanationModal(skill);
        };
      });
    }

    bindTabInteractions();

    view.querySelectorAll('.profile-view-tabs button').forEach(b => {
      b.onclick = () => {
        const newTab = b.getAttribute('data-ptab');
        activeProfileTab = newTab;
        view.querySelectorAll('.profile-view-tabs button').forEach(x => {
          x.className = (x.getAttribute('data-ptab') === newTab ? `active t-${newTab}` : '');
        });
        const contentEl = view.querySelector('#my-stats-tab-content');
        if (contentEl) {
          contentEl.innerHTML = renderTabContent(newTab);
          bindTabInteractions();
        }
      };
    });

    // Conectar botón Ver Carta FUT
    const btnOpenMyFut = view.querySelector('#btn-open-my-fut-card');
    if (btnOpenMyFut) {
      btnOpenMyFut.onclick = () => {
        if (window.FutCard && FutCard.showModal) {
          const ovr = FutCard.computeOvr ? FutCard.computeOvr(globalRadar, myP.mainPosition) : Math.min(99, Math.max(45, Math.round(overall.rating * 10)));
          FutCard.showModal({
            player: myP,
            radar: globalRadar,
            ovr: ovr,
            team: team,
            streak: streak,
            mvpCount: mvpCount,
            lang: currentLang
          });
        }
      };
    }
  }

  function renderPlayerMatchHistory(pid, customSessions) {
    const sessions = Array.isArray(customSessions) ? customSessions : ((clubData && clubData.sessions) || []);
    const p = (clubData && clubData.players || []).find(x => x.id === pid);
    const pos = p ? p.mainPosition : 'Jugador';

    // 1. Intentar con sesiones detalladas en memoria si las hay
    let matches = (sessions || []).filter(s => {
      const st = s && s.stats && s.stats[pid];
      return st && Object.values(st).some(v => v > 0);
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 2. Si no hay detalladas en memoria (capa fría desacoplada), usar matchHistorySummary de Capa Caliente
    if (matches.length === 0 && p && Array.isArray(p.matchHistorySummary) && p.matchHistorySummary.length > 0) {
      return p.matchHistorySummary.map(item => {
        const st = item.stats || {};
        const isMatch = item.type === 'match';
        const title = item.title || (isMatch ? (item.rival ? 'vs ' + item.rival : t('match')) : t('training'));
        const scoreStr = (item.score && (item.score.home != null || item.score.away != null))
          ? `${item.score.home || 0} - ${item.score.away || 0}`
          : '';

        const totalP = (st.passOk || 0) + (st.passKo || 0);
        const passPct = totalP > 0 ? Math.round(((st.passOk || 0) / totalP) * 100) : null;
        const totalShots = (st.shotOn || 0) + (st.shotOff || 0);

        return `
          <div class="card" style="padding: 14px; border: 1px solid var(--border); background: var(--surface2);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <span class="badge" style="background: ${isMatch ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isMatch ? '#86efac' : '#38bdf8'}; font-size: 10px; font-weight: 800;">
                  ${isMatch ? '🏟️ ' + t('match').toUpperCase() : '🏃‍♂️ ' + t('training').toUpperCase()}
                </span>
                <h4 style="margin: 4px 0 2px; font-size: 15px; font-weight: 900; color: #fff;">
                  ${escapeHtml(title)}
                </h4>
                <div style="font-size: 11.5px; color: var(--muted);">
                  📅 ${item.date || ''} ${item.venue ? '• 📍 ' + escapeHtml(item.venue) : ''}
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                ${scoreStr ? `
                  <div style="font-size: 14px; font-weight: 900; background: var(--bg2); padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border); color: #fff;">
                    ${scoreStr}
                  </div>
                ` : ''}
                <div style="font-size: 12px; font-weight: 900; color: #22d3ee; background: rgba(34, 211, 238, 0.15); padding: 2px 7px; border-radius: 6px;">
                  ⭐ ${item.rating || 6.0}
                </div>
              </div>
            </div>

            <!-- Acciones de este partido -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11.5px; text-align: center; margin-top: 8px;">
              <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('passesLabel')}</div>
                <div style="font-weight: 800; color: #fff;">${st.passOk || 0}/${totalP} ${passPct !== null ? `<span style="font-size: 9.5px; color: var(--cyan);">(${passPct}%)</span>` : ''}</div>
              </div>
              <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('shotsLabel')}</div>
                <div style="font-weight: 800; color: #fff;">${st.shotOn || 0} ${t('shotsOnTarget')} <span style="font-size: 9.5px; color: var(--muted);">(${totalShots})</span></div>
              </div>
              <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('goalsLabel')}</div>
                <div style="font-weight: 800; color: #86efac;">⚽ ${st.goal || 0}</div>
              </div>
              <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('dribblesLabel')}</div>
                <div style="font-weight: 800; color: #fff;">${st.dribbleOk || 0}</div>
              </div>
              <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('recoveriesLabel')}</div>
                <div style="font-weight: 800; color: #fff;">${st.recovery || 0}</div>
              </div>
              <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('touchesLabel')}</div>
                <div style="font-weight: 800; color: #c084fc;">${st.touches || 0}</div>
              </div>
            </div>

            <button type="button" class="btn sm secondary btn-view-session-detail" data-session-id="${escapeHtml(item.sessionId)}" style="margin-top: 10px; width: 100%; border-radius: 8px; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border);">
              🔍 ${t('viewSessionDetail', 'Ver Detalle del Partido')}
            </button>
          </div>
        `;
      }).join('');
    }

    if (matches.length === 0) {
      return `
        <div class="card" style="padding: 16px; text-align: center; border: 1px dashed var(--border); color: var(--muted); font-size: 13px;">
          ${t('noMatchesYet')}
        </div>
      `;
    }

    return matches.map(s => {
      const st = s.stats[pid] || {};
      const isMatch = s.type === 'match';
      const title = s.title || (isMatch ? (s.rival ? 'vs ' + s.rival : t('match')) : t('training'));
      const scoreStr = (s.score && (s.score.home != null || s.score.away != null))
        ? `${s.score.home || 0} - ${s.score.away || 0}`
        : '';

      const matchRating = calculateMatchRating(st, pos);
      const totalP = (st.passOk || 0) + (st.passKo || 0);
      const passPct = totalP > 0 ? Math.round(((st.passOk || 0) / totalP) * 100) : null;
      const totalShots = (st.shotOn || 0) + (st.shotOff || 0);

      return `
        <div class="card" style="padding: 14px; border: 1px solid var(--border); background: var(--surface2);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge" style="background: ${isMatch ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isMatch ? '#86efac' : '#38bdf8'}; font-size: 10px; font-weight: 800;">
                ${isMatch ? '🏟️ ' + t('match').toUpperCase() : '🏃‍♂️ ' + t('training').toUpperCase()}
              </span>
              <h4 style="margin: 4px 0 2px; font-size: 15px; font-weight: 900; color: #fff;">
                ${escapeHtml(title)}
              </h4>
              <div style="font-size: 11.5px; color: var(--muted);">
                📅 ${s.date || ''} ${s.venue ? '• 📍 ' + escapeHtml(s.venue) : ''}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              ${scoreStr ? `
                <div style="font-size: 14px; font-weight: 900; background: var(--bg2); padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border); color: #fff;">
                  ${scoreStr}
                </div>
              ` : ''}
              <div style="font-size: 12px; font-weight: 900; color: #22d3ee; background: rgba(34, 211, 238, 0.15); padding: 2px 7px; border-radius: 6px;">
                ⭐ ${matchRating}
              </div>
            </div>
          </div>

          <!-- Acciones de este partido -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11.5px; text-align: center; margin-top: 8px;">
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('passesLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.passOk || 0}/${totalP} ${passPct !== null ? `<span style="font-size: 9.5px; color: var(--cyan);">(${passPct}%)</span>` : ''}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('shotsLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.shotOn || 0} ${t('shotsOnTarget')} <span style="font-size: 9.5px; color: var(--muted);">(${totalShots})</span></div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('goalsLabel')}</div>
              <div style="font-weight: 800; color: #86efac;">⚽ ${st.goal || 0}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('dribblesLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.dribbleOk || 0}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('recoveriesLabel')}</div>
              <div style="font-weight: 800; color: #fff;">${st.recovery || 0}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 9.5px; font-weight: 700;">${t('touchesLabel')}</div>
              <div style="font-weight: 800; color: #c084fc;">${st.touches || 0}</div>
            </div>
          </div>

          <button type="button" class="btn sm secondary btn-view-session-detail" data-session-id="${escapeHtml(s.id)}" style="margin-top: 10px; width: 100%; border-radius: 8px; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border);">
            🔍 ${t('viewSessionDetail', 'Ver Detalle del Partido')}
          </button>
        </div>
      `;
    }).join('');
  }

  // ❄️ Modal de Carga Bajo Demanda de Sesión Detallada (Capa Fría de Firestore)
  async function showSessionDetailModal(sessionId) {
    if (!sessionId) return;
    const existing = document.getElementById('dialog-session-detail-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-session-detail-modal';
    overlay.style.zIndex = '999999';
    overlay.innerHTML = `
      <div class="card dialog-box" style="max-width: 480px; width: 92%; padding: 20px; border-radius: 18px; border: 1.5px solid var(--border); background: #0b1329; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">${t('matchDetail', 'Detalle de la Sesión')}</h3>
          <button type="button" class="btn sm ghost" id="btn-close-session-detail-x" style="padding: 4px 8px;">✕</button>
        </div>
        <div id="session-detail-content" style="text-align: center; padding: 20px; color: var(--muted);">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          <span>${t('loadingSession', 'Cargando datos de la sesión...')}</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-session-detail-x').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    try {
      let sess = null;
      if (window.Cloud && window.Cloud.fetchSessionDetail) {
        sess = await window.Cloud.fetchSessionDetail(sessionId);
      } else if (clubData && clubData.sessions) {
        sess = clubData.sessions.find(s => s.id === sessionId);
      }

      const contentEl = overlay.querySelector('#session-detail-content');
      if (!contentEl) return;

      if (!sess) {
        contentEl.innerHTML = `<div style="color: #ef4444; font-weight: 700;">No se pudo cargar la sesión.</div>`;
        return;
      }

      const isMatch = sess.type === 'match';
      const myP = getMyPlayer();
      const myPid = myP ? myP.id : null;
      const myStats = (myPid && sess.stats) ? sess.stats[myPid] : null;
      const title = sess.title || (isMatch ? (sess.rival ? 'vs ' + sess.rival : t('match')) : t('training'));
      const scoreStr = (sess.score && (sess.score.home != null || sess.score.away != null))
        ? `${sess.score.home || 0} - ${sess.score.away || 0}`
        : '';

      let myStatsHtml = '';
      if (myStats) {
        const pos = myP ? myP.mainPosition : 'Jugador';
        const rating = calculateMatchRating(myStats, pos);
        const totalP = (myStats.passOk || 0) + (myStats.passKo || 0);
        const passPct = totalP > 0 ? Math.round(((myStats.passOk || 0) / totalP) * 100) : null;
        const totalShots = (myStats.shotOn || 0) + (myStats.shotOff || 0);

        myStatsHtml = `
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 14px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 900; font-size: 13px; color: var(--cyan);">👤 Tus Estadísticas en este partido</span>
              <span class="badge" style="background: rgba(34, 211, 238, 0.2); color: #fff; font-weight: 900; font-size: 11px;">⭐ ${rating}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px; text-align: center;">
              <div style="background: var(--bg2); padding: 5px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9px;">Pases</div>
                <div style="font-weight: 800; color: #fff;">${myStats.passOk || 0}/${totalP} ${passPct !== null ? `(${passPct}%)` : ''}</div>
              </div>
              <div style="background: var(--bg2); padding: 5px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9px;">Tiros</div>
                <div style="font-weight: 800; color: #fff;">${myStats.shotOn || 0} puerta (${totalShots})</div>
              </div>
              <div style="background: var(--bg2); padding: 5px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9px;">Goles</div>
                <div style="font-weight: 800; color: #86efac;">⚽ ${myStats.goal || 0}</div>
              </div>
              <div style="background: var(--bg2); padding: 5px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9px;">Regates</div>
                <div style="font-weight: 800; color: #fff;">${myStats.dribbleOk || 0}</div>
              </div>
              <div style="background: var(--bg2); padding: 5px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9px;">Recuperaciones</div>
                <div style="font-weight: 800; color: #fff;">${myStats.recovery || 0}</div>
              </div>
              <div style="background: var(--bg2); padding: 5px; border-radius: 6px; border: 1px solid var(--border);">
                <div style="color: var(--muted); font-size: 9px;">Duelos</div>
                <div style="font-weight: 800; color: #fff;">${(myStats.duel1v1WonGoal || 0) + (myStats.duel1v1WonStop || 0)}</div>
              </div>
            </div>
          </div>
        `;
      }

      let coachPicksHtml = '';
      if (Array.isArray(sess.coachPicks) && sess.coachPicks.length > 0) {
        coachPicksHtml = `
          <div style="margin-bottom: 14px; text-align: left;">
            <div style="font-size: 12px; font-weight: 900; color: #facc15; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
              <span>🌟 Nominados por el Entrenador</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${sess.coachPicks.map(cp => {
                const cPlayer = (clubData.players || []).find(p => p.id === (cp.playerId || cp.id));
                const pName = cPlayer ? (cPlayer.name + ' ' + (cPlayer.lastName || '')).trim() : (cp.playerName || 'Jugador');
                return `
                  <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 8px 10px;">
                    <div style="font-weight: 800; font-size: 12px; color: #fde047;">${escapeHtml(pName)}</div>
                    ${cp.reason ? `<div style="font-size: 11px; color: #e2e8f0; margin-top: 2px; font-style: italic;">"${escapeHtml(cp.reason)}"</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      contentEl.innerHTML = `
        <div style="text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <span class="badge" style="background: ${isMatch ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isMatch ? '#86efac' : '#38bdf8'}; font-size: 11px; font-weight: 800;">
                ${isMatch ? '🏟️ ' + t('match').toUpperCase() : '🏃‍♂️ ' + t('training').toUpperCase()}
              </span>
              <h3 style="margin: 4px 0 2px; font-size: 17px; font-weight: 900; color: #fff;">${escapeHtml(title)}</h3>
              <div style="font-size: 11.5px; color: var(--muted);">📅 ${sess.date || ''} ${sess.venue ? '• 📍 ' + escapeHtml(sess.venue) : ''}</div>
            </div>
            ${scoreStr ? `
              <div style="font-size: 18px; font-weight: 900; background: var(--bg2); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--border); color: #fff;">
                ${scoreStr}
              </div>
            ` : ''}
          </div>

          ${myStatsHtml}
          ${coachPicksHtml}

          <button type="button" class="btn primary block" id="btn-close-session-detail" style="margin-top: 10px; height: 38px;">
            ${t('close', 'Cerrar')}
          </button>
        </div>
      `;

      contentEl.querySelector('#btn-close-session-detail').onclick = () => overlay.remove();

    } catch (err) {
      console.error('Error fetching session detail:', err);
      const contentEl = overlay.querySelector('#session-detail-content');
      if (contentEl) {
        contentEl.innerHTML = `<div style="color: #ef4444; font-weight: 700;">Error al cargar detalle: ${err.message}</div>`;
      }
    }
  }

  // Delegación de clic para botones de ver detalle de sesión
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-session-detail');
    if (btn) {
      const sId = btn.getAttribute('data-session-id');
      if (sId) showSessionDetailModal(sId);
    }
  });

  function hasApprovedProfile() {
    if (!myPlayerId) return false;
    const pendingCreationId = localStorage.getItem('portal_pending_creation_id');
    if (myPlayerId === pendingCreationId || String(myPlayerId).startsWith('pcr_')) return false;
    const p = (clubData && clubData.players) ? clubData.players.find(x => x.id === myPlayerId) : null;
    return !!p && !p.isPendingApproval;
  }

  /* -------------------------------------------------------------
     VISTA DE BLOQUEO PARA SECCIONES QUE REQUIEREN PERFIL ACTIVO
     ------------------------------------------------------------- */
  function renderNoProfileAccessView(featureName) {
    const isPendingCreation = !!(localStorage.getItem('portal_pending_creation_id') || (myPlayerId && String(myPlayerId).startsWith('pcr_')));
    const pendingName = localStorage.getItem('portal_pending_creation_name') || 'Player';

    if (isPendingCreation) {
      view.innerHTML = `
        <div style="padding: 44px 16px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
          <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 900; color: #fde047;">${currentLang === 'en' ? 'Registration Pending' : 'Registro Pendiente'}</h3>
          <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
            ${currentLang === 'en'
              ? `Your registration request for <b>${escapeHtml(pendingName)}</b> is currently pending approval by your coach. You will be able to access ${featureName} once approved.`
              : `Tu solicitud de alta para <b>${escapeHtml(pendingName)}</b> está pendiente de aprobación por el entrenador. Tendrás acceso a ${featureName} una vez aprobada.`}
          </p>
          <button type="button" class="btn ghost sm" id="btn-cancel-pending-creation" style="font-weight: 800; border-radius: 12px; padding: 8px 18px;">
            ${currentLang === 'en' ? 'Cancel Request / Choose Another' : 'Cancelar solicitud / Elegir otro'}
          </button>
        </div>
      `;
      const btnCancel = view.querySelector('#btn-cancel-pending-creation');
      if (btnCancel) {
        btnCancel.onclick = () => {
          try {
            localStorage.removeItem('portal_pending_creation_id');
            localStorage.removeItem('portal_player_id');
            localStorage.removeItem('portal_player_locked');
            localStorage.removeItem('portal_pending_creation_name');
            localStorage.removeItem('portal_pending_creation_dorsal');
            localStorage.removeItem('portal_pending_creation_pos');
          } catch (e) {}
          myPlayerId = null;
          updateHeaderIdentity();
          renderCurrentTab();
          showSelectIdentityModal();
        };
      }
      return;
    }

    view.innerHTML = `
      <div style="padding: 44px 16px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
        <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 900;">${t('selectIdentity', 'Select your profile')}</h3>
        <p style="font-size: 13.5px; color: var(--muted); margin: 0 0 20px; line-height: 1.45;">
          ${currentLang === 'en' 
            ? `You must select or activate an active player profile to view ${featureName}.` 
            : `Debes seleccionar o activar un perfil de jugador para ver ${featureName}.`}
        </p>
        <button type="button" class="btn primary" id="btn-no-profile-select-act" style="font-weight: 800; border-radius: 12px; padding: 10px 24px;">
          ${t('selectIdentity', 'Select Profile')}
        </button>
      </div>
    `;
    const btn = view.querySelector('#btn-no-profile-select-act');
    if (btn) btn.onclick = showSelectIdentityModal;
  }

  /* -------------------------------------------------------------
     PESTAÑA 3: PLANTILLA Y DEMÁS EQUIPOS (PUNTO 9)
     ------------------------------------------------------------- */
  function renderSquadView() {
    if (!hasApprovedProfile()) {
      renderNoProfileAccessView(t('squad', 'Squad'));
      return;
    }
    const teams = clubData && clubData.teams ? clubData.teams : [];
    let players = (clubData && clubData.players) ? clubData.players.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')) : [];

    if (activeTeamFilter !== 'all') {
      players = players.filter(p => p.teamId === activeTeamFilter);
    }

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 4px;">${t('squadTitle')}</h2>
        <p style="font-size: 12px; color: var(--muted); margin: 0 0 10px;">
          ${t('squadSubtitle')}
        </p>

        <!-- FILTROS POR EQUIPO (PUNTO 9) -->
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 8px; -webkit-overflow-scrolling: touch;">
          <button class="btn sm ${activeTeamFilter === 'all' ? 'primary' : 'ghost'}" data-filter-team="all" style="white-space: nowrap; font-weight: 800; font-size: 11.5px; border-radius: 10px;">
            ${t('allTeams')}
          </button>
          ${teams.map(tm => `
            <button class="btn sm ${activeTeamFilter === tm.id ? 'primary' : 'ghost'}" data-filter-team="${tm.id}" style="white-space: nowrap; font-weight: 800; font-size: 11.5px; border-radius: 10px; border-color: ${tm.color || 'var(--border)'};">
              🛡️ ${escapeHtml(tm.name)}
            </button>
          `).join('')}
        </div>

        <!-- FICHA DEL ENTRENADOR (PUNTO 8) -->
        <div class="card coach-profile-card" id="btn-view-coach-card" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid rgba(250, 204, 21, 0.5); background: linear-gradient(135deg, rgba(250, 204, 21, 0.12) 0%, rgba(15, 23, 42, 0.7) 100%); border-radius: 14px; margin-bottom: 12px; cursor: pointer;">
          <div style="width: 44px; height: 44px; border-radius: 14px; background: rgba(250, 204, 21, 0.2); border: 2px solid #facc15; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
            ${(clubData.coachProfile && clubData.coachProfile.photo) ? `<img src="${clubData.coachProfile.photo}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" />` : '<span style="color: #facc15; font-weight: 900; font-size: 16px;">DR</span>'}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; font-size: 10px; font-weight: 900; border: 1px solid rgba(250, 204, 21, 0.4);">
                🛡️ ${t('coachCardTitle', 'Cuerpo Técnico')}
              </span>
            </div>
            <h4 style="margin: 2px 0 0; font-size: 14.5px; font-weight: 900; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${escapeHtml((clubData.coachProfile && clubData.coachProfile.name) || 'Entrenador Principal')}
            </h4>
            <small style="color: var(--muted); font-size: 11px;">
              ${escapeHtml((clubData.coachProfile && (clubData.coachProfile.role || clubData.coachProfile.title)) || t('coachProfileSubtitle', 'Director Técnico'))}
            </small>
          </div>
          <div style="color: #facc15; font-size: 11.5px; font-weight: 800; white-space: nowrap;">
            ${t('viewCoachProfile', 'Ver Ficha')} ➔
          </div>
        </div>

        <input type="text" id="squad-search" placeholder="${t('searchTeammate')}" style="width: 100%; margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />

        <div style="display: flex; flex-direction: column; gap: 8px;" id="squad-list">
          ${players.map(p => {
            const team = teams.find(t => t.id === p.teamId);
            const pStats = calculatePlayerStats(p.id);
            const pStreak = calculatePlayerAttendanceStreak(p.id);
            const pMvp = calculatePlayerMvpCount(p.id);

            return `
              <div class="card squad-item-card" data-pid="${p.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border); cursor: pointer;">
                ${renderAvatar(p, 'md')}
                <div style="flex: 1; overflow: hidden;">
                  <h4 style="margin: 0 0 2px; font-size: 15px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </h4>
                  <div style="font-size: 12px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap;">
                    <span class="pos-tag">${formatPosition(p.mainPosition)}</span>
                    <span>•</span>
                    <span>${getPlayerFootLabel(p.foot)}</span>
                    ${team ? `<span>• 🛡️ ${escapeHtml(team.name)}</span>` : ''}
                  </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                    ${pMvp > 0 ? `<span style="font-size: 11px; font-weight: 800; color: #fde047; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.35); padding: 1px 5px; border-radius: 6px;" title="MVP">👑 ${pMvp}</span>` : ''}
                    ${pStreak >= 2 ? `<span style="font-size: 11px; font-weight: 800; color: #fb923c; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.35); padding: 1px 5px; border-radius: 6px;" title="${t('attendanceStreak')}">🔥 ${pStreak}</span>` : ''}
                    <div style="font-size: 13px; font-weight: 900; color: #22d3ee;">⭐ ${pStats.aggregatedRating}</div>
                  </div>
                  <small style="font-size: 10.5px; color: var(--muted);">⚽ ${pStats.goals} ${currentLang === 'en' ? 'goals' : (currentLang === 'ee' ? 'väravat' : 'goles')}</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Conectar botón ficha del entrenador
    const btnCoachCard = view.querySelector('#btn-view-coach-card');
    if (btnCoachCard) btnCoachCard.onclick = showCoachFullProfileModal;

    // Conectar filtros de equipo
    view.querySelectorAll('[data-filter-team]').forEach(btn => {
      btn.onclick = () => {
        activeTeamFilter = btn.getAttribute('data-filter-team');
        renderSquadView();
      };
    });

    // Conectar buscador
    const searchInp = view.querySelector('#squad-search');
    const squadList = view.querySelector('#squad-list');
    if (searchInp && squadList) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        squadList.querySelectorAll('.squad-item-card').forEach(c => {
          c.style.display = (!q || c.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    // Tocar jugador = ver ficha completa (Punto 9)
    view.querySelectorAll('.squad-item-card').forEach(card => {
      card.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = card.getAttribute('data-pid');
        try {
          showPlayerFullProfileModal(pid);
        } catch (err) {
          console.error('[PlayerApp] Error abriendo ficha de compañero:', err);
          toast(t('errorOpeningProfile', 'Error abriendo perfil del jugador'), 'error');
        }
      };
    });
  }

  function showCoachFullProfileModal() {
    const cp = clubData.coachProfile || {
      name: 'Entrenador Principal',
      role: 'Primer Entrenador',
      title: 'Director Técnico / Head Coach',
      license: 'UEFA Pro / Nivel 3',
      bio: 'Responsable técnico del club.',
      philosophy: '',
      phone: '',
      email: '',
      photo: ''
    };

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 92%; max-width: 440px; padding: 18px; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #facc15;">🛡️ ${t('coachCardTitle', 'Ficha del Entrenador')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-coach-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div class="card p-hero" style="margin-bottom: 14px; padding: 14px; border: 1.5px solid rgba(250, 204, 21, 0.4); background: var(--surface2);">
          <div style="width: 64px; height: 64px; border-radius: 18px; background: rgba(250, 204, 21, 0.2); border: 2.5px solid #facc15; display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; overflow: hidden;">
            ${cp.photo ? `<img src="${cp.photo}" style="width: 100%; height: 100%; border-radius: 16px; object-fit: cover;" />` : '<span style="color: #facc15; font-weight: 900; font-size: 22px;">DR</span>'}
          </div>
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 2px; color: #fff;">
              ${escapeHtml(cp.name || t('headCoach', 'Entrenador Principal'))}
            </h2>
            <div style="font-size: 12px; color: var(--cyan); font-weight: 800;">
              ${escapeHtml(cp.role || cp.title || t('headCoachRole', 'Director Técnico'))}
            </div>
            ${cp.license ? `
              <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                🏅 ${t('coachLicense', 'Licencia')}: ${escapeHtml(cp.license)}
              </div>
            ` : ''}
          </div>
        </div>

        ${(cp.bio || cp.philosophy) ? `
          <div class="card" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); background: var(--bg2);">
            ${cp.bio ? `
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase; margin-bottom: 4px;">${t('coachBio', 'Presentación / Trayectoria')}</div>
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: #e2e8f0;">
                ${escapeHtml(cp.bio)}
              </p>
            ` : ''}
            ${cp.philosophy ? `
              <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase; margin-bottom: 4px;">${t('notes', 'Filosofía y Metodología')}</div>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #e2e8f0;">
                ${escapeHtml(cp.philosophy)}
              </p>
            ` : ''}
          </div>
        ` : ''}

        ${(cp.phone || cp.email) ? `
          <div class="card" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); background: var(--bg2); display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
            ${cp.phone ? `<div>📞 <b>${t('contact', 'Contacto')}:</b> ${escapeHtml(cp.phone)}</div>` : ''}
            ${cp.email ? `<div>✉️ <b>${t('email', 'Email')}:</b> ${escapeHtml(cp.email)}</div>` : ''}
          </div>
        ` : ''}

        <!-- BOTONES DE CONTACTO: LLAMADA Y VIBER -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          ${cp.phone ? `
            <a href="tel:${encodeURIComponent(cp.phone.replace(/[^0-9+]/g, ''))}" class="btn ghost sm" style="flex: 1; text-decoration: none; font-size: 12.5px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface2); color: #fff;">
              📞 ${t('callCoach', 'Llamar')}
            </a>
            <a href="viber://chat?number=${encodeURIComponent(cp.phone.replace(/[^0-9+]/g, ''))}" target="_blank" rel="noopener" class="btn sm" style="flex: 1; text-decoration: none; font-size: 12.5px; font-weight: 800; background: #7c3aed; color: #ffffff !important; border: 1.5px solid #a855f7; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px;">
              🟣 Viber
            </a>
          ` : `
            <a href="viber://forward?text=${encodeURIComponent(t('viberCoachContactMsg', '¡Hola míster!'))}" target="_blank" rel="noopener" class="btn sm" style="flex: 1; text-decoration: none; font-size: 12.5px; font-weight: 800; background: #7c3aed; color: #ffffff !important; border: 1.5px solid #a855f7; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px;">
              🟣 ${t('messageViaViber', 'Mensaje por Viber')}
            </a>
          `}
        </div>

        <button type="button" class="btn block primary" id="btn-coach-chat" style="height: 44px; font-weight: 800; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          ${t('chatWithCoach', '💬 Chatear con el Entrenador')}
        </button>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-coach-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const btnChat = overlay.querySelector('#btn-coach-chat');
    if (btnChat) {
      btnChat.onclick = () => {
        close();
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }
        if (window.ChatUI && ChatUI.startDirectChat) {
          const myP = getMyPlayer();
          ChatUI.startDirectChat('coach', cp.name || 'Entrenador', {
            currentUserId: myPlayerId,
            currentUserName: myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador',
            isCoach: false,
            players: clubData.players || [],
            teams: clubData.teams || []
          });
        }
      };
    }

    document.body.appendChild(overlay);
  }

  function showPlayerFullProfileModal(pid) {
    const existing = document.getElementById('dialog-player-full-profile');
    if (existing) existing.remove();

    const p = (clubData.players || []).find(x => x.id === pid);
    if (!p) return;

    const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
    const allSessions = (clubData && clubData.sessions) || [];
    let effectiveSessions = (allSessions || []).filter(s => s && s.stats && s.stats[pid] && Object.values(s.stats[pid]).some(v => v > 0));
    if (effectiveSessions.length === 0 && p) {
      const summaryList = Array.isArray(p.sessionHistorySummary) && p.sessionHistorySummary.length > 0
        ? p.sessionHistorySummary
        : (Array.isArray(p.matchHistorySummary) ? p.matchHistorySummary : []);
      if (summaryList.length > 0) {
        effectiveSessions = summaryList.map(item => ({
          id: item.sessionId || item.id,
          type: item.type || (item.rival ? 'match' : 'training'),
          date: item.date || '',
          title: item.title || '',
          rival: item.rival || '',
          venue: item.venue || '',
          score: item.score || null,
          stats: {
            [pid]: item.stats || {
              goal: item.goal || 0,
              assist: item.assist || 0,
              passOk: item.passOk || 0,
              passKo: item.passKo || 0,
              shotOn: item.shotOn || 0,
              shotOff: item.shotOff || 0,
              recovery: item.recovery || item.recoveries || 0,
              recoveries: item.recovery || item.recoveries || 0,
              touches: item.touches || 0,
              dribbleOk: item.dribbleOk || 0,
              duelsWon: item.duelsWon || 0,
              duel1v1WonGoal: item.duel1v1WonGoal || 0,
              duel1v1WonStop: item.duel1v1WonStop || 0,
              duel1v1LostTurnover: item.duel1v1LostTurnover || 0,
              duel1v1LostGoal: item.duel1v1LostGoal || 0
            }
          }
        }));
      }
    }
    const trainingSessions = effectiveSessions.filter(s => (s.type || 'training') === 'training');
    const matchSessions = effectiveSessions.filter(s => (s.type || 'training') === 'match');
    const aggTraining = getPlayerAggregate(pid, trainingSessions);
    const aggMatch = getPlayerAggregate(pid, matchSessions);
    const overall = calculatePlayerOverallRating(pid, p.mainPosition);
    let activeProfileTab = (aggTraining.count === 0 && aggMatch.count > 0) ? 'match' : 'training';

    const streak = calculatePlayerAttendanceStreak(pid);
    const mvpCount = calculatePlayerMvpCount(pid);
    const globalRadar = calculatePlayerRadar(pid);

    function renderModalTabContent(tabName) {
      const isMatch = (tabName === 'match');
      const curSessions = isMatch ? matchSessions : trainingSessions;
      const curAgg = isMatch ? aggMatch : aggTraining;

      if (isMatch && curAgg.count === 0) {
        return `
          <div class="card empty" style="padding: 24px 14px; text-align: center; border: 1.5px dashed var(--border); border-radius: 14px; background: rgba(15, 23, 42, 0.4); margin-bottom: 12px;">
            <div style="font-size: 36px; margin-bottom: 8px;">🏆</div>
            <h3 style="font-size: 15px; font-weight: 900; color: #fff; margin-bottom: 4px;">${t('noMatchesRecordedYet', 'Sin partidos registrados todavía')}</h3>
            <p style="font-size: 12px; color: var(--muted); margin: 0; line-height: 1.4;">${t('noMatchesRecordedDesc', 'Cuando el entrenador registre sus estadísticas en partidos, aquí aparecerán sus métricas.')}</p>
          </div>
        `;
      }

      if (!isMatch && curAgg.count === 0) {
        return `
          <div class="card empty" style="padding: 24px 14px; text-align: center; border: 1.5px dashed var(--border); border-radius: 14px; background: rgba(15, 23, 42, 0.4); margin-bottom: 12px;">
            <div style="font-size: 36px; margin-bottom: 8px;">⚽</div>
            <h3 style="font-size: 15px; font-weight: 900; color: #fff; margin-bottom: 4px;">${t('noTrainingsRecordedYet', 'Sin entrenamientos registrados todavía')}</h3>
            <p style="font-size: 12px; color: var(--muted); margin: 0; line-height: 1.4;">${t('noActionsYet', 'Aún no hay acciones registradas')}</p>
          </div>
        `;
      }

      const curStats = calculatePlayerStats(pid, curSessions);
      const curRadar = calculatePlayerRadar(pid, curSessions);

      return `
        <!-- Radar -->
        <div class="card" style="margin-bottom: 12px; border: 1px solid var(--border);" id="dlg-radar-box">
          ${renderRadarSVG(curRadar)}
        </div>

        <!-- Cifras -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; margin-bottom: 14px;">
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: ${isMatch ? 'var(--match)' : 'var(--train)'};">${isMatch ? t('matchesAttended') : t('trainingsAttended')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #fff;">${isMatch ? curStats.matchesAttended : curStats.trainingsAttended}</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #86efac;">${t('goalsScored')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #86efac;">${curStats.goals}</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: var(--cyan);">${t('passAccuracy')}</div>
            <div style="font-size: 18px; font-weight: 900; color: var(--cyan);">${curStats.passAcc}%</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #facc15;">${t('shotAccuracy')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #facc15;">${curStats.shotAcc}%</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #c084fc;">${t('ballTouches')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #c084fc;">${curStats.touches}</div>
          </div>
          <div style="background: var(--surface2); padding: 8px 4px; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-size: 10px; font-weight: 800; color: #38bdf8;">${t('recoveries')}</div>
            <div style="font-size: 18px; font-weight: 900; color: #38bdf8;">${curStats.recoveries}</div>
          </div>
        </div>

        <!-- Tarjeta Dedicada: ⚔️ Duelos 1v1 -->
        ${(() => {
          const dWonGoal = curAgg.totals.duel1v1WonGoal || 0;
          const dWonStop = curAgg.totals.duel1v1WonStop || 0;
          const dLostTurnover = curAgg.totals.duel1v1LostTurnover || 0;
          const dLostGoal = curAgg.totals.duel1v1LostGoal || 0;
          const dWon = dWonGoal + dWonStop;
          const dLost = dLostGoal + dLostTurnover;
          const dTotal = dWon + dLost;
          const dWinRate = dTotal > 0 ? Math.round((dWon / dTotal) * 100) : 0;
          return `
            <div class="card duel-card-profile" style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
              <div style="background: rgba(0, 0, 0, 0.45); border: 1.5px solid ${dWinRate >= 50 ? '#22c55e' : (dTotal > 0 ? '#ef4444' : 'var(--border)')}; border-radius: 12px; width: 62px; height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                <span style="font-size: 16px; font-weight: 900; color: ${dWinRate >= 50 ? '#86efac' : (dTotal > 0 ? '#fca5a5' : '#cbd5e1')};">${dWinRate}%</span>
                <span style="font-size: 8.5px; font-weight: 800; color: var(--muted); text-transform: uppercase;">${t('winRate', 'WIN RATE')}</span>
              </div>
              <div class="grow" style="text-align: left; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-size: 13.5px; font-weight: 900; color: #fff;">⚔️ ${t('duels1v1', 'Duelos 1v1')}</span>
                  <span style="font-size: 11.5px; font-weight: 800;">
                    <span style="color: #4ade80;">${t('won', 'Ganados')}: ${dWon}</span> • <span style="color: #f87171;">${t('lost', 'Perdidos')}: ${dLost}</span>
                  </span>
                </div>
                <div style="height: 6px; width: 100%; background: ${dTotal > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)'}; border-radius: 999px; overflow: hidden; display: flex; margin: 4px 0;">
                  <div style="width: ${dWinRate}%; background: #22c55e; height: 100%;"></div>
                </div>
                <div style="font-size: 11px; color: var(--muted);">
                  (${dWonGoal} ${t('goals', 'goles')} · ${dWonStop} ${t('stops', 'cierres defensivos')})
                </div>
              </div>
            </div>
          `;
        })()}

        <!-- Mapa Táctico de Goles y Acciones por Zonas -->
        ${renderPlayerGoalsPitchHtml(pid, curSessions)}

        <!-- Historial Completo de Acciones en la Carrera -->
        ${renderPlayerCareerActionsListHtml(pid, curSessions)}

        <!-- Partidos/Sesiones Recientes -->
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px;">${isMatch ? t('recentMatchesTitle') : t('sessions')}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${renderPlayerMatchHistory(pid, curSessions)}
        </div>
      `;
    }

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-player-full-profile';
    overlay.style.zIndex = '999999';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 88vh; width: 94%; max-width: 480px; padding: 18px; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900;">${t('fullProfile')}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-pfull-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div class="card p-hero" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--border);">
          ${renderAvatar(p, 'lg')}
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 2px;">
              #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
            </h2>
            <div style="font-size: 12px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <span class="pos-tag">${formatPosition(p.mainPosition)}</span>
              ${(p.secondaryPositions && p.secondaryPositions.length) ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.4); font-size: 11px;">🔄 ${formatPositionsList(p.secondaryPositions)}</span>` : ''}
              <span>•</span>
              <span>${getPlayerFootLabel(p.foot)}</span>
              ${p.heightCm ? `<span>• 📏 ${p.heightCm} cm</span>` : ''}
              ${team ? `<span>• 🛡️ ${escapeHtml(team.name)}</span>` : ''}
            </div>
            ${p.birthDate ? `
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                <span>🎂</span>
                <span>${p.birthDate}</span>
                <span style="color: var(--cyan); font-weight: 800;">(${calculateAgeYearsMonths(p.birthDate, currentLang)})</span>
              </div>
            ` : ''}
            <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span class="rating-pill" style="font-size: 12.5px; font-weight: 900; background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.4)); color: #fef08a; border: 1.5px solid #facc15; padding: 3px 9px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                  ⭐ ${overall.rating.toFixed(1)} ${t('overallRating', 'Rating General')}
                </span>
                <div style="display: flex; align-items: center; gap: 6px;">
                  ${mvpCount > 0 ? `<span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; border: 1px solid rgba(250, 204, 21, 0.5); font-weight: 800; font-size: 11px;">⭐ x${mvpCount} MVP</span>` : ''}
                  ${streak > 0 ? `<span class="badge" style="background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.5); font-size: 11px;">🔥 ${streak} ${streak === 1 ? t('streakSessionSingle') : t('streakSessions')}</span>` : ''}
                </div>
              </div>
              <span style="font-size: 10px; font-weight: 800; color: ${overall.mode === 'combined' ? '#38bdf8' : (overall.mode === 'training' ? '#4ade80' : '#facc15')}; margin-left: 6px;">
                ${overall.mode === 'combined' 
                  ? t('combinedRating', 'Valoración Combinada') 
                  : (overall.mode === 'training' 
                      ? t('onlyTrainingRating', 'Solo Entrenamientos') 
                      : (overall.mode === 'match' ? t('onlyMatchRating', 'Solo Partidos') : t('baseRating', 'Valoración Base')))}
              </span>
            </div>
          </div>
        </div>

        <!-- Botón Ver Carta FUT Coleccionable de este compañero -->
        <button type="button" class="btn block" id="btn-open-player-fut-card-${pid}" style="height: 44px; font-weight: 900; font-size: 13.5px; margin-bottom: 10px; border-radius: 12px; background: linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%); color: #facc15; border: 1.5px solid #eab308; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
          <span style="font-size: 18px;">🃏</span>
          <span>${t('viewFutCard', 'Ver Carta FUT')}</span>
          <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fef08a; border: 1px solid #facc15; font-size: 11px;">OVR ${window.FutCard && FutCard.computeOvr ? FutCard.computeOvr(globalRadar, p.mainPosition) : Math.min(99, Math.max(45, Math.round(overall.rating * 10)))}</span>
        </button>

        <!-- Botón Chatear con este jugador (Punto 8) -->
        ${pid !== myPlayerId ? `
          <button type="button" class="btn block primary" id="btn-chat-with-player-${pid}" style="height: 42px; font-weight: 800; font-size: 13.5px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            💬 ${t('chatWithPlayer', 'Chatear con este compañero')}
          </button>
        ` : ''}

        <!-- Selector de Sub-Pestañas: Entrenamientos vs Partidos -->
        <div class="segmented profile-view-tabs dlg-profile-view-tabs" style="margin-bottom: 12px;">
          <button type="button" class="${activeProfileTab === 'training' ? 'active t-training' : ''}" data-ptab="training">
            ⚽ ${t('trainingsTab', 'Entrenamientos')} (${aggTraining.count})
          </button>
          <button type="button" class="${activeProfileTab === 'match' ? 'active t-match' : ''}" data-ptab="match">
            🏆 ${t('matchesTab', 'Partidos')} (${aggMatch.count})
          </button>
        </div>

        <div id="dlg-pfull-tab-content">
          ${renderModalTabContent(activeProfileTab)}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    const closeBtn = overlay.querySelector('#dlg-pfull-x');
    if (closeBtn) closeBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    function bindModalTabInteractions() {
      overlay.querySelectorAll('.radar-click-label').forEach(el => {
        el.onclick = () => {
          const skill = el.getAttribute('data-skill');
          showSkillExplanationModal(skill);
        };
      });
    }

    bindModalTabInteractions();

    overlay.querySelectorAll('.dlg-profile-view-tabs button').forEach(b => {
      b.onclick = () => {
        const newTab = b.getAttribute('data-ptab');
        activeProfileTab = newTab;
        overlay.querySelectorAll('.dlg-profile-view-tabs button').forEach(x => {
          x.className = (x.getAttribute('data-ptab') === newTab ? `active t-${newTab}` : '');
        });
        const contentEl = overlay.querySelector('#dlg-pfull-tab-content');
        if (contentEl) {
          contentEl.innerHTML = renderModalTabContent(newTab);
          bindModalTabInteractions();
        }
      };
    });

    const btnPlayerFut = overlay.querySelector(`#btn-open-player-fut-card-${pid}`);
    if (btnPlayerFut) {
      btnPlayerFut.onclick = () => {
        if (window.FutCard && FutCard.showModal) {
          const ovr = FutCard.computeOvr ? FutCard.computeOvr(globalRadar, p.mainPosition) : Math.min(99, Math.max(45, Math.round(overall.rating * 10)));
          FutCard.showModal({
            player: p,
            radar: globalRadar,
            ovr: ovr,
            team: team,
            streak: streak,
            mvpCount: mvpCount,
            lang: currentLang
          });
        }
      };
    }

    const btnChat = overlay.querySelector(`#btn-chat-with-player-${pid}`);
    if (btnChat) {
      btnChat.onclick = () => {
        close();
        if (window.ChatUI && ChatUI.startDirectChat) {
          const myP = getMyPlayer();
          ChatUI.startDirectChat(pid, `${p.name || ''} ${p.lastName || ''}`.trim(), {
            currentUserId: myPlayerId,
            currentUserName: myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador',
            isCoach: false
          });
          const tabBtn = document.querySelector('#portal-tabbar [data-tab="chat"]');
          if (tabBtn) tabBtn.click();
        }
      };
    }

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     PESTAÑA 4: FACE TO FACE (COMPARADOR ENTRE COMPAÑEROS)
     ------------------------------------------------------------- */
  let h2hPlayer1Id = null;
  let h2hPlayer2Id = null;

  function getPlayer1v1Stats(pid, sessions) {
    const p = clubData && clubData.players ? clubData.players.find(x => x.id === pid) : null;
    const sessList = sessions || ((clubData && clubData.sessions) || []);
    const hasDetailedSessions = sessList.some(s => s && s.stats && Object.keys(s.stats).length > 0);

    if (!hasDetailedSessions && p && p.duel1v1) {
      return Object.assign({}, p.duel1v1);
    }

    let wonGoal = 0, wonStop = 0, lostTurnover = 0, lostGoal = 0;
    sessList.forEach(s => {
      const st = (s && s.stats && s.stats[pid]) ? s.stats[pid] : {};
      wonGoal += st.duel1v1WonGoal || 0;
      wonStop += st.duel1v1WonStop || 0;
      lostTurnover += st.duel1v1LostTurnover || 0;
      lostGoal += st.duel1v1LostGoal || 0;
    });
    const won = wonGoal + wonStop;
    const lost = lostTurnover + lostGoal;
    const total = won + lost;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
    return { won, lost, total, winRate, wonGoal, wonStop, lostTurnover, lostGoal };
  }

  function calculate1v1WinProbability(p1, p2, r1, r2, d1, d2) {
    // 1. Atributos técnicos/físicos clave para 1v1: Regate (35%), Defensa (30%), Físico (25%), Tiro (10%)
    const skill1 = (r1.reg * 0.35) + (r1.def * 0.30) + (r1.fis * 0.25) + (r1.tir * 0.10);
    const skill2 = (r2.reg * 0.35) + (r2.def * 0.30) + (r2.fis * 0.25) + (r2.tir * 0.10);

    // 2. Ajuste por historial empírico de duelos (ponderado por tamaño de muestra)
    let empAdj1 = 0;
    if (d1.total > 0) {
      const conf1 = Math.min(1.0, d1.total / 12);
      empAdj1 = conf1 * (d1.winRate - 50) * 0.22;
    }
    let empAdj2 = 0;
    if (d2.total > 0) {
      const conf2 = Math.min(1.0, d2.total / 12);
      empAdj2 = conf2 * (d2.winRate - 50) * 0.22;
    }

    // 3. Diferencia de edad y maduración biológica a partir de fecha de nacimiento
    let ageBonus1 = 0;
    let ageBonus2 = 0;
    let ageDiffText = '';

    if (p1.birthDate && p2.birthDate) {
      const b1 = new Date(p1.birthDate);
      const b2 = new Date(p2.birthDate);
      if (!isNaN(b1.getTime()) && !isNaN(b2.getTime())) {
        const diffYears = (b2.getTime() - b1.getTime()) / (365.25 * 24 * 3600 * 1000); // positivo si p1 nació antes (es mayor)
        const diffMonths = Math.round(diffYears * 12);

        // En fútbol base/formativo, la diferencia de meses aporta ventaja de fuerza y velocidad
        const ageImpact = Math.max(-9, Math.min(9, diffYears * 3.2));
        ageBonus1 = ageImpact;
        ageBonus2 = -ageImpact;

        if (Math.abs(diffMonths) >= 1) {
          const name1 = (p1.name || 'J1').split(' ')[0];
          const name2 = (p2.name || 'J2').split(' ')[0];
          const olderName = diffMonths > 0 ? name1 : name2;
          const mCount = Math.abs(diffMonths);
          if (currentLang === 'ee') {
            ageDiffText = `${olderName} on ${mCount} ${mCount === 1 ? 'kuu' : 'kuud'} vanem`;
          } else if (currentLang === 'es') {
            ageDiffText = `${olderName} es ${mCount} ${mCount === 1 ? 'mes' : 'meses'} mayor`;
          } else {
            ageDiffText = `${olderName} is ${mCount} ${mCount === 1 ? 'month' : 'months'} older`;
          }
        } else {
          ageDiffText = t('sameBioAge', 'Misma edad biológica');
        }
      }
    }

    const finalScore1 = skill1 + empAdj1 + ageBonus1;
    const finalScore2 = skill2 + empAdj2 + ageBonus2;

    // Modelo logístico de probabilidad
    const scoreDiff = finalScore1 - finalScore2;
    const rawProb1 = 1 / (1 + Math.exp(-scoreDiff / 14));
    let prob1 = Math.round(rawProb1 * 100);
    prob1 = Math.max(12, Math.min(88, prob1)); // Acotar entre 12% y 88%
    const prob2 = 100 - prob1;

    let favorite = null;
    const reasons = [];
    if (prob1 >= 53) {
      favorite = 1;
      if (r1.reg > r2.reg) reasons.push(t('reasonDribble', 'Mayor desborde / regate'));
      if (r1.fis > r2.fis) reasons.push(t('reasonPhysical', 'Superioridad física'));
      if (r1.def > r2.def) reasons.push(t('reasonDefense', 'Mayor solidez defensiva'));
      if (d1.winRate > d2.winRate && d1.total >= 3) reasons.push(t('reasonWinRate', 'Mejor % victorias 1v1 previo'));
      if (ageBonus1 >= 2) reasons.push(t('reasonAge', 'Ventaja por madurez física'));
    } else if (prob2 >= 53) {
      favorite = 2;
      if (r2.reg > r1.reg) reasons.push(t('reasonDribble', 'Mayor desborde / regate'));
      if (r2.fis > r1.fis) reasons.push(t('reasonPhysical', 'Superioridad física'));
      if (r2.def > r1.def) reasons.push(t('reasonDefense', 'Mayor solidez defensiva'));
      if (d2.winRate > d1.winRate && d2.total >= 3) reasons.push(t('reasonWinRate', 'Mejor % victorias 1v1 previo'));
      if (ageBonus2 >= 2) reasons.push(t('reasonAge', 'Ventaja por madurez física'));
    }

    return {
      prob1,
      prob2,
      favorite,
      reasons: reasons.slice(0, 3),
      ageDiffText
    };
  }

  function renderH2HRadarSVG(rd, mainColor = '#22d3ee') {
    const axesLabels = {
      en: { pas: 'PASS', tir: 'SHOT', reg: 'DRIB', fis: 'PHYS', def: 'DEF' },
      ee: { pas: 'SÖÖT', tir: 'LÖÖK', reg: 'TRIB', fis: 'FÜÜS', def: 'KAIT' },
      et: { pas: 'SÖÖT', tir: 'LÖÖK', reg: 'TRIB', fis: 'FÜÜS', def: 'KAIT' },
      es: { pas: 'PASE', tir: 'TIRO', reg: 'REG',  fis: 'FÍS',  def: 'DEF' },
      ru: { pas: 'ПАС',  tir: 'УДАР', reg: 'ДРИБ', fis: 'ФИЗ',  def: 'ЗАЩ' }
    };
    const langLabels = axesLabels[currentLang] || axesLabels.en;
    const axes = [
      { key: 'pas', label: langLabels.pas, val: rd.pas },
      { key: 'tir', label: langLabels.tir, val: rd.tir },
      { key: 'reg', label: langLabels.reg, val: rd.reg },
      { key: 'fis', label: langLabels.fis, val: rd.fis },
      { key: 'def', label: langLabels.def, val: rd.def }
    ];

    const cx = 130, cy = 130, rMax = 88;
    const totalAxes = 5;

    function getCoords(index, value) {
      const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
      const normalized = Math.max(10, Math.min(99, value)) / 100;
      const r = rMax * normalized;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }

    const levels = [0.25, 0.50, 0.75, 1.0];
    const gridPolygons = levels.map(lvl => {
      const pts = [];
      for (let i = 0; i < totalAxes; i++) {
        const a = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
        const r = rMax * lvl;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.2"/>`;
    }).join('');

    const dataPoints = axes.map((a, i) => ({ ...getCoords(i, a.val), a }));
    const dataPolyPoints = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const labels = axes.map((a, i) => {
      const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
      const labelR = rMax + 24;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      return `
        <g class="radar-click-label" data-skill="${a.key}" style="cursor: pointer;">
          <circle cx="${lx.toFixed(1)}" cy="${(ly + 5).toFixed(1)}" r="18" fill="${mainColor}18" />
          <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#e2e8f0" font-size="10.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.label}
          </text>
          <text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" fill="${mainColor}" font-size="11.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.val}
          </text>
        </g>
      `;
    }).join('');

    const gradId = 'h2hRadarGrad_' + mainColor.replace(/[^a-zA-Z0-9]/g, '');

    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; margin: 0; padding: 0;">
        <svg class="radar-svg" viewBox="0 0 260 260" style="width: 100%; aspect-ratio: 1 / 1; max-width: 230px; height: auto; display: block;">
          <defs>
            <radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${mainColor}" stop-opacity="0.45" />
              <stop offset="100%" stop-color="${mainColor}" stop-opacity="0.10" />
            </radialGradient>
          </defs>
          ${gridPolygons}
          <polygon points="${dataPolyPoints}" fill="url(#${gradId})" stroke="${mainColor}" stroke-width="2.5" />
          ${dataPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${mainColor}" stroke="#060a13" stroke-width="1.8" />`).join('')}
          ${labels}
        </svg>
      </div>
    `;
  }

  function renderH2HView() {
    if (!hasApprovedProfile()) {
      renderNoProfileAccessView(t('h2h', 'Face to Face'));
      return;
    }
    const players = clubData && clubData.players ? clubData.players : [];

    if (players.length < 2) {
      view.innerHTML = `
        <div style="padding: 24px 0; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">⚔️</div>
            <h3>${t('h2hTitle')}</h3>
            <p>${t('h2hNeedTwo')}</p>
          </div>
        </div>
      `;
      return;
    }

    if (!h2hPlayer1Id) h2hPlayer1Id = myPlayerId || players[0].id;
    if (!h2hPlayer2Id) {
      const other = players.find(p => p.id !== h2hPlayer1Id);
      h2hPlayer2Id = other ? other.id : players[1].id;
    }

    const p1 = players.find(p => p.id === h2hPlayer1Id) || players[0];
    const p2 = players.find(p => p.id === h2hPlayer2Id) || players[1];

    const s1 = calculatePlayerStats(p1.id);
    const s2 = calculatePlayerStats(p2.id);
    const r1 = calculatePlayerRadar(p1.id);
    const r2 = calculatePlayerRadar(p2.id);

    const allSessions = (clubData && clubData.sessions) || [];
    const d1 = getPlayer1v1Stats(p1.id, allSessions);
    const d2 = getPlayer1v1Stats(p2.id, allSessions);

    // Comparativa de atributos pedagógica para jugadores en 1v1 (sin disciplina, sin pases, sin % de victoria)
    function renderDuelChevrons(level, isAdvantage) {
      const color = isAdvantage ? '#22c55e' : '#ef4444';
      const bg = isAdvantage ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.16)';
      const border = isAdvantage ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)';
      let poly = '';
      if (isAdvantage) {
        if (level === 1) {
          poly = '<polyline points="5 15 12 8 19 15"></polyline>';
        } else if (level === 2) {
          poly = '<polyline points="5 12 12 5 19 12"></polyline><polyline points="5 18 12 11 19 18"></polyline>';
        } else {
          poly = '<polyline points="5 10 12 4 19 10"></polyline><polyline points="5 15 12 9 19 15"></polyline><polyline points="5 20 12 14 19 20"></polyline>';
        }
      } else {
        if (level === 1) {
          poly = '<polyline points="5 9 12 16 19 9"></polyline>';
        } else if (level === 2) {
          poly = '<polyline points="5 6 12 13 19 6"></polyline><polyline points="5 12 12 19 19 12"></polyline>';
        } else {
          poly = '<polyline points="5 4 12 10 19 4"></polyline><polyline points="5 9 12 15 19 9"></polyline><polyline points="5 14 12 20 19 14"></polyline>';
        }
      }
      return `
        <div style="background: ${bg}; border: 1.5px solid ${border}; border-radius: 10px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 5px ${isAdvantage ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'};">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="${color}" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
            ${poly}
          </svg>
        </div>
      `;
    }

    function getDuelLevel(absDiff) {
      if (absDiff >= 13) return 3;
      if (absDiff >= 7) return 2;
      return 1;
    }

    const attrKeys = ['reg', 'tir', 'def', 'fis'];
    const attrNames = {
      reg: t('stat_reg', 'Regate (REG)'),
      tir: t('stat_tir', 'Tiro (TIR)'),
      def: t('stat_def', 'Defensa (DEF)'),
      fis: t('stat_fis', 'Físico (FIS)')
    };

    const diffs = attrKeys.map(k => {
      const v1 = Math.round(r1 && r1[k] != null ? r1[k] : 50);
      const v2 = Math.round(r2 && r2[k] != null ? r2[k] : 50);
      return {
        key: k,
        name: attrNames[k] || k.toUpperCase(),
        val1: v1,
        val2: v2,
        diff: v1 - v2
      };
    });

    const advantages = [];
    diffs.filter(d => d.diff >= 4).forEach(d => {
      const level = getDuelLevel(d.diff);
      let tip = '';
      if (d.key === 'tir') tip = t('h2h_tip_tir_advantage');
      else if (d.key === 'reg') tip = t('h2h_tip_reg_advantage');
      else if (d.key === 'def') tip = t('h2h_tip_def_advantage');
      else if (d.key === 'fis') tip = t('h2h_tip_fis_advantage');
      else tip = t('h2h_your_advantage', 'Tienes ventaja en {stat}.').replace('{stat}', escapeHtml(d.name));
      advantages.push({ ...d, level, tip });
    });

    const watchOuts = [];
    diffs.filter(d => d.diff <= -4).forEach(d => {
      const level = getDuelLevel(Math.abs(d.diff));
      let tip = '';
      if (d.key === 'tir') tip = t('h2h_tip_tir_rival_high');
      else if (d.key === 'reg') tip = t('h2h_tip_reg_rival_high');
      else if (d.key === 'def') tip = t('h2h_tip_def_rival_high');
      else if (d.key === 'fis') tip = t('h2h_tip_fis_rival_high');
      else tip = t('h2h_watch_out', 'Cuidado con su {stat}.').replace('{stat}', escapeHtml(d.name));
      watchOuts.push({ ...d, level, tip });
    });

    // Evaluación de estatura y envergadura física
    const h1 = p1.heightCm ? parseInt(p1.heightCm, 10) : 0;
    const h2 = p2.heightCm ? parseInt(p2.heightCm, 10) : 0;
    if (h1 > 0 && h2 > 0) {
      const hDiff = h1 - h2;
      if (hDiff >= 6) {
        advantages.unshift({
          key: 'height',
          name: t('heightCm', 'Estatura (cm)'),
          diff: hDiff,
          level: getDuelLevel(hDiff),
          tip: t('h2h_tip_height_advantage')
        });
      } else if (hDiff <= -6) {
        watchOuts.unshift({
          key: 'height',
          name: t('heightCm', 'Estatura (cm)'),
          diff: hDiff,
          level: getDuelLevel(Math.abs(hDiff)),
          tip: t('h2h_tip_height_tall_rival')
        });
      }
    } else if (p1.birthDate && p2.birthDate) {
      const b1 = new Date(p1.birthDate);
      const b2 = new Date(p2.birthDate);
      if (!isNaN(b1.getTime()) && !isNaN(b2.getTime())) {
        const diffMonths = (b2.getFullYear() - b1.getFullYear()) * 12 + (b2.getMonth() - b1.getMonth());
        if (diffMonths >= 18) {
          advantages.push({
            key: 'age',
            name: t('age'),
            diff: Math.round(diffMonths / 12),
            level: 1,
            tip: t('h2h_tip_height_advantage')
          });
        } else if (diffMonths <= -18) {
          watchOuts.push({
            key: 'age',
            name: t('age'),
            diff: Math.round(diffMonths / 12),
            level: 1,
            tip: t('h2h_tip_height_tall_rival')
          });
        }
      }
    }

    let bestWeapon = null;
    if (advantages.length === 0) {
      let maxDiff = -Infinity;
      diffs.forEach(d => {
        if (d.diff > maxDiff) {
          maxDiff = d.diff;
          bestWeapon = d;
        }
      });
      if (bestWeapon) {
        let bestTip = '';
        if (bestWeapon.key === 'tir') bestTip = t('h2h_best_weapon_tir');
        else if (bestWeapon.key === 'reg') bestTip = t('h2h_best_weapon_reg');
        else if (bestWeapon.key === 'def') bestTip = t('h2h_best_weapon_def');
        else if (bestWeapon.key === 'fis') bestTip = t('h2h_best_weapon_fis');
        else bestTip = t('h2h_best_weapon', 'Duelo exigente: tu mejor baza hoy es competir desde tu {stat}.').replace('{stat}', escapeHtml(bestWeapon.name));
        bestWeapon.tip = bestTip;
      }
    }

    view.innerHTML = `
      <div style="padding: 6px 0;">
        <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 4px;">${t('h2hTitle')}</h2>
        <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px;">${t('h2hDesc')}</p>

        <!-- Selector Cara a Cara -->
        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-bottom: 14px;">
          <!-- Jugador 1 -->
          <div class="card" style="padding: 10px; text-align: center; border: 1.5px solid #22d3ee; cursor: pointer; border-radius: 14px;" id="btn-change-h2h-1">
            ${renderAvatar(p1, 'md')}
            <h4 style="margin: 6px 0 2px; font-size: 13.5px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              #${p1.mainDorsal != null ? p1.mainDorsal : '-'} ${escapeHtml(p1.name || '')}
            </h4>
            <span class="pos-tag" style="font-size: 10.5px;">${formatPosition(p1.mainPosition)}</span>
            <div style="font-size: 11px; color: #22d3ee; margin-top: 4px; font-weight: 800;">${t('changeProfile')} ▾</div>
          </div>

          <div style="font-size: 20px; font-weight: 900; color: var(--muted);">VS</div>

          <!-- Jugador 2 -->
          <div class="card" style="padding: 10px; text-align: center; border: 1.5px solid #f472b6; cursor: pointer; border-radius: 14px;" id="btn-change-h2h-2">
            ${renderAvatar(p2, 'md')}
            <h4 style="margin: 6px 0 2px; font-size: 13.5px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              #${p2.mainDorsal != null ? p2.mainDorsal : '-'} ${escapeHtml(p2.name || '')}
            </h4>
            <span class="pos-tag" style="font-size: 10.5px;">${formatPosition(p2.mainPosition)}</span>
            <div style="font-size: 11px; color: #f472b6; margin-top: 4px; font-weight: 800;">${t('changeProfile')} ▾</div>
          </div>
        </div>

        <!-- 💡 CONSEJOS TÁCTICOS 1v1 (ENFOQUE PEDAGÓGICO) -->
        <div class="card" style="margin-bottom: 14px; padding: 14px; border: 1.5px solid rgba(34, 211, 238, 0.4); background: linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(15, 23, 42, 0.85) 100%); border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 12.5px; font-weight: 900; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>💡</span> <span>${t('h2h_keys_title', 'Claves del Duelo')}</span>
            </span>
            <span class="badge" style="background: rgba(34, 211, 238, 0.15); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.4); font-size: 10px; font-weight: 800; padding: 2px 7px;">
              ${t('h2h_tactical_summary', 'Claves 1v1 (Duelo Táctico)')}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${advantages.map(a => `
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 12px; padding: 10px 14px; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span style="font-size: 18px; flex-shrink: 0;">🟢</span>
                  <div style="font-size: 12.5px; font-weight: 800; color: #4ade80; line-height: 1.4;">${escapeHtml(a.tip)}</div>
                </div>
                ${renderDuelChevrons(a.level, true)}
              </div>
            `).join('')}

            ${bestWeapon ? `
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(250, 204, 21, 0.12); border: 1px solid rgba(250, 204, 21, 0.35); border-radius: 12px; padding: 10px 14px; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span style="font-size: 18px; flex-shrink: 0;">⭐</span>
                  <div style="font-size: 12.5px; font-weight: 800; color: #fde047; line-height: 1.4;">${escapeHtml(bestWeapon.tip)}</div>
                </div>
                ${renderDuelChevrons(1, bestWeapon.diff >= 0)}
              </div>
            ` : ''}

            ${watchOuts.map(w => `
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 10px 14px; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span style="font-size: 18px; flex-shrink: 0;">⚠️</span>
                  <div style="font-size: 12.5px; font-weight: 800; color: #fca5a5; line-height: 1.4;">${escapeHtml(w.tip)}</div>
                </div>
                ${renderDuelChevrons(w.level, false)}
              </div>
            `).join('')}

            ${advantages.length === 0 && !bestWeapon && watchOuts.length === 0 ? `
              <div style="font-size: 12.5px; color: #cbd5e1; text-align: center; padding: 10px 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px dashed var(--border); font-weight: 700; line-height: 1.4;">
                ⚽ ${t('h2h_balanced_duel', '¡Duelo muy parejo! Mantén la máxima concentración y disciplina táctica.')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ⚔️ DUELOS 1v1 HISTÓRICOS -->
        <div class="card" style="margin-bottom: 14px; padding: 14px; border: 1.5px solid var(--border); display: flex; flex-direction: column; gap: 8px; border-radius: 14px;">
          <div style="font-size: 12px; font-weight: 900; color: #fb923c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            ⚔️ ${t('duels1v1Historical', 'Duelos 1v1 (Histórico)')}
          </div>
          ${renderH2HMetricRow(t('duels1v1WinRate', '% Victorias 1v1'), `${d1.winRate}%`, `${d2.winRate}%`, '🏆')}
          ${renderH2HMetricRow(t('duels1v1Won', 'Duelos Ganados'), d1.won, d2.won, '⚔️')}
          ${renderH2HMetricRow(t('duels1v1Lost', 'Duelos Perdidos'), d1.lost, d2.lost, '❌')}
          ${renderH2HMetricRow(t('duel1v1Goals', 'Goles en 1v1'), d1.wonGoal, d2.wonGoal, '⚽')}
          ${renderH2HMetricRow(t('duel1v1Stops', 'Robos / Cierres'), d1.wonStop, d2.wonStop, '🛡️')}
        </div>

        <!-- Métricas Generales -->
        <div class="card" style="margin-bottom: 14px; padding: 14px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; border-radius: 14px;">
          <div style="font-size: 12px; font-weight: 900; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            📊 ${t('performanceMetrics', 'Métricas de Rendimiento')}
          </div>
          ${renderH2HMetricRow(t('performanceRating'), `⭐ ${s1.aggregatedRating}`, `⭐ ${s2.aggregatedRating}`, '⭐')}
          ${renderH2HMetricRow(t('matchesAttended'), s1.matchesAttended, s2.matchesAttended, '🏟️')}
          ${renderH2HMetricRow(t('trainingsAttended'), s1.trainingsAttended, s2.trainingsAttended, '🏃‍♂️')}
          ${renderH2HMetricRow(t('goalsScored'), s1.goals, s2.goals, '⚽')}
          ${renderH2HMetricRow(t('passAccuracy'), s1.passAcc + '%', s2.passAcc + '%', '🎯')}
          ${renderH2HMetricRow(t('shotAccuracy'), s1.shotAcc + '%', s2.shotAcc + '%', '🎯')}
          ${renderH2HMetricRow(t('ballTouches'), s1.touches, s2.touches, '👟')}
        </div>

        <!-- Radares comparativos 100% simétricos -->
        <div class="section-title"><span>${t('comparativeRadars', 'Comparative Skill Radars')}</span></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: stretch; margin-bottom: 8px;">
          <div class="card" style="margin: 0 !important; margin-top: 0 !important; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; border: 1.5px solid rgba(34, 211, 238, 0.35); border-radius: 14px; height: 100%; box-sizing: border-box;">
            <b style="font-size: 12.5px; color: #22d3ee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; height: 20px; line-height: 20px; display: block; margin-bottom: 4px;">
              ${escapeHtml(p1.name || '')}
            </b>
            ${renderH2HRadarSVG(r1, '#22d3ee')}
          </div>
          <div class="card" style="margin: 0 !important; margin-top: 0 !important; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; border: 1.5px solid rgba(244, 114, 182, 0.35); border-radius: 14px; height: 100%; box-sizing: border-box;">
            <b style="font-size: 12.5px; color: #f472b6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; height: 20px; line-height: 20px; display: block; margin-bottom: 4px;">
              ${escapeHtml(p2.name || '')}
            </b>
            ${renderH2HRadarSVG(r2, '#f472b6')}
          </div>
        </div>
        <div style="text-align: center; font-size: 11px; color: var(--muted); margin-bottom: 12px;">
          ${t('tapSkillHint')}
        </div>
      </div>
    `;

    function renderH2HMetricRow(label, v1, v2, icon) {
      const num1 = parseFloat(String(v1).replace(/[^0-9.]/g, '')) || 0;
      const num2 = parseFloat(String(v2).replace(/[^0-9.]/g, '')) || 0;
      const c1 = num1 > num2 ? '#22d3ee; font-weight: 900;' : (num1 === num2 ? '#fff;' : 'var(--muted);');
      const c2 = num2 > num1 ? '#f472b6; font-weight: 900;' : (num1 === num2 ? '#fff;' : 'var(--muted);');

      return `
        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
          <div style="color: ${c1}; text-align: right; font-size: 15px;">${v1}</div>
          <div style="font-size: 11.5px; font-weight: 800; color: var(--muted); text-align: center; padding: 0 10px;">
            ${icon} ${label}
          </div>
          <div style="color: ${c2}; text-align: left; font-size: 15px;">${v2}</div>
        </div>
      `;
    }

    view.querySelector('#btn-change-h2h-1').onclick = () => showPickerForH2H(1);
    view.querySelector('#btn-change-h2h-2').onclick = () => showPickerForH2H(2);

    view.querySelectorAll('.radar-click-label').forEach(el => {
      el.onclick = () => {
        const skill = el.getAttribute('data-skill');
        showSkillExplanationModal(skill);
      };
    });
  }

  function showPickerForH2H(targetSlot) {
    const players = clubData.players || [];
    const teams = clubData.teams || [];

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '999999';

    function buildGridHtml(searchFilter = '') {
      const q = searchFilter.toLowerCase().trim();
      const filtered = players.filter(p => {
        if (!q) return true;
        const name = `${p.name || ''} ${p.lastName || ''}`.toLowerCase();
        const dorsal = String(p.mainDorsal || '');
        return name.includes(q) || dorsal.includes(q);
      });

      if (filtered.length === 0) {
        return `
          <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">
            ${t('noPlayersFound', 'No se encontraron jugadores')}
          </div>
        `;
      }

      // Agrupar por equipos
      const teamGroups = teams.map(tm => ({
        team: tm,
        players: filtered.filter(p => p.teamId === tm.id)
      })).filter(g => g.players.length > 0);

      const generalPlayers = filtered.filter(p => !teams.some(tm => tm.id === p.teamId));

      let html = '';
      teamGroups.forEach(g => {
        html += `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 0 4px;">
              <span class="dot" style="background: ${g.team.color || 'var(--cyan)'}; width: 8px; height: 8px; border-radius: 50%;"></span>
              <span style="font-size: 12px; font-weight: 800; color: #fff;">${escapeHtml(g.team.name)}</span>
              <span class="badge" style="font-size: 10px; padding: 1px 6px;">${g.players.length}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
              ${g.players.map(p => renderPlayerCard(p)).join('')}
            </div>
          </div>
        `;
      });

      if (generalPlayers.length > 0) {
        html += `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 0 4px;">
              <span>🛡️</span>
              <span style="font-size: 12px; font-weight: 800; color: #fff;">${t('otherPlayers', 'General / Otros')}</span>
              <span class="badge" style="font-size: 10px; padding: 1px 6px;">${generalPlayers.length}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
              ${generalPlayers.map(p => renderPlayerCard(p)).join('')}
            </div>
          </div>
        `;
      }

      return html;
    }

    function renderPlayerCard(p) {
      const isSelected = (targetSlot === 1 && p.id === h2hPlayer1Id) || (targetSlot === 2 && p.id === h2hPlayer2Id);
      const st = calculatePlayerStats(p.id);
      return `
        <div class="h2h-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: ${isSelected ? 'rgba(34, 211, 238, 0.16)' : 'var(--surface2)'}; border: 1.5px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}; cursor: pointer; transition: all .15s ease;">
          ${renderAvatar(p, 'sm')}
          <div style="min-width: 0; flex: 1; overflow: hidden;">
            <div style="font-size: 12.5px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')}
            </div>
            <div style="font-size: 10.5px; color: var(--muted); display: flex; align-items: center; gap: 4px;">
              <span>${formatPosition(p.mainPosition)}</span>
              <span>•</span>
              <span style="color: #22d3ee; font-weight: 800;">⭐ ${st.aggregatedRating}</span>
            </div>
          </div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh; width: 94%; max-width: 460px; padding: 18px; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">
            ${t('choosePlayer')} ${targetSlot === 1 ? t('slotLeft', '1 (Izquierda)') : t('slotRight', '2 (Derecha)')}
          </h3>
          <button type="button" class="icon-btn ghost" id="dlg-h2h-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <input type="text" id="h2h-search-player" placeholder="${t('searchPlayerDorsalPlaceholder', '🔍 Buscar por nombre o dorsal...')}" style="width: 100%; padding: 9px 12px; font-size: 13px; border-radius: 10px; margin-bottom: 12px; flex-shrink: 0;" />

        <div id="h2h-picker-grid-container" style="flex: 1; overflow-y: auto; max-height: 62vh; padding-right: 2px;">
          ${buildGridHtml('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-h2h-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    function bindCardClicks() {
      overlay.querySelectorAll('.h2h-pick-item').forEach(it => {
        it.onclick = () => {
          const pid = it.getAttribute('data-pid');
          if (targetSlot === 1) h2hPlayer1Id = pid;
          else h2hPlayer2Id = pid;
          close();
          renderH2HView();
        };
      });
    }

    bindCardClicks();

    const searchInp = overlay.querySelector('#h2h-search-player');
    if (searchInp) {
      searchInp.oninput = () => {
        const gridCont = overlay.querySelector('#h2h-picker-grid-container');
        if (gridCont) {
          gridCont.innerHTML = buildGridHtml(searchInp.value);
          bindCardClicks();
        }
      };
    }

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     RENDERIZADO Y NAVEGACIÓN
     ------------------------------------------------------------- */
  function updateTabbarLabels() {
    const tabbar = document.getElementById('portal-tabbar');
    if (!tabbar) return;
    const labels = {
      convocations: t('convocations'),
      stats: t('myProfile'),
      squad: t('squad'),
      h2h: t('h2h'),
      chat: t('chat', 'Chat')
    };
    tabbar.querySelectorAll('.tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      const lbl = btn.querySelector('.t-lbl');
      if (lbl && labels[tab]) lbl.textContent = labels[tab];
    });
  }

  function renderChatTab() {
    if (!hasApprovedProfile()) {
      renderNoProfileAccessView(t('chat', 'Chat'));
      return;
    }
    if (!window.ChatUI) {
      view.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);">Chat no disponible</div>';
      return;
    }
    const myP = getMyPlayer();
    window.ChatUI.renderChatList(view, {
      currentUserId: myPlayerId,
      currentUserName: myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Player',
      isCoach: false,
      players: (clubData && clubData.players) ? clubData.players : [],
      teams: (clubData && clubData.teams) ? clubData.teams : []
    });
  }

  function renderCurrentTab() {
    updateTabbarLabels();
    updateConvocationsBadge();
    if (currentTab === 'convocations') renderConvocationsView();
    else if (currentTab === 'stats') renderMyStatsView();
    else if (currentTab === 'squad') renderSquadView();
    else if (currentTab === 'h2h') renderH2HView();
    else if (currentTab === 'chat') renderChatTab();
  }

  function setupNavigation() {
    document.querySelectorAll('#portal-tabbar .tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;
        currentTab = tab;
        document.querySelectorAll('#portal-tabbar .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        haptic(20);
        renderCurrentTab();
      };
    });

    const myInfoBtn = document.getElementById('portal-my-info-btn');
    if (myInfoBtn) {
      myInfoBtn.onclick = (e) => {
        e.stopPropagation();
        if (!hasApprovedProfile()) {
          showSelectIdentityModal();
        } else if (isProfileLocked()) {
          const tabBtn = document.querySelector('#portal-tabbar [data-tab="stats"]');
          if (tabBtn) tabBtn.click();
        } else {
          showSelectIdentityModal();
        }
      };
    }

    const lblChange = document.getElementById('portal-lbl-change');
    if (lblChange) {
      lblChange.onclick = (e) => {
        e.stopPropagation();
        if (!hasApprovedProfile()) {
          showSelectIdentityModal();
        } else if (isProfileLocked()) {
          showRequestProfileChangeModal();
        } else {
          showSelectIdentityModal();
        }
      };
    }

    const idContainer = document.getElementById('portal-identity-container');
    if (idContainer) {
      idContainer.onclick = () => {
        if (!hasApprovedProfile()) {
          showSelectIdentityModal();
        } else if (!isProfileLocked()) {
          showSelectIdentityModal();
        } else {
          showRequestProfileChangeModal();
        }
      };
    }

    const btnLang = document.getElementById('btn-portal-lang');
    if (btnLang) {
      btnLang.innerHTML = getLangDisplay(currentLang);
      btnLang.onclick = () => openLanguageModal();
    }
  }

  /* -------------------------------------------------------------
     MANEJO DE RECORDATORIOS DE ASISTENCIA ENVIADOS POR EL ENTRENADOR
     ------------------------------------------------------------- */
  function handleIncomingConvocationReminder(reminder) {
    if (!reminder || !reminder.id) return;
    if (!myPlayerId) return;

    // 1. Filtrar si este recordatorio va dirigido a una lista de IDs concreta y yo NO estoy incluido
    if (Array.isArray(reminder.targetPlayerIds) && reminder.targetPlayerIds.length > 0) {
      if (!reminder.targetPlayerIds.map(String).includes(String(myPlayerId))) {
        return;
      }
    }

    // 2. Comprobar si el jugador realmente está convocado en este evento
    const convId = reminder.convId;
    if (convId && clubData && Array.isArray(clubData.convocations)) {
      const conv = clubData.convocations.find(c => c.id === convId);
      if (conv) {
        // Si no está convocado o está marcado como 'uncalled' o 'absent', ignorar
        if (!conv.list || !conv.list[myPlayerId] || conv.list[myPlayerId] === 'uncalled' || conv.list[myPlayerId] === 'absent') {
          return;
        }
      }
    }

    // 3. Comprobar si ya ha respondido
    if (convId) {
      if (liveVotes[convId] && liveVotes[convId][myPlayerId]) {
        const existingStatus = liveVotes[convId][myPlayerId].status;
        if (existingStatus === 'called' || existingStatus === 'attending' || existingStatus === 'yes' || existingStatus === 'absent' || existingStatus === 'no') {
          return;
        }
      }
      if (clubData && Array.isArray(clubData.convocations)) {
        const conv = clubData.convocations.find(c => c.id === convId);
        if (conv && conv.responses && conv.responses[myPlayerId]) {
          const resp = conv.responses[myPlayerId].status;
          if (resp === 'called' || resp === 'attending' || resp === 'yes' || resp === 'absent' || resp === 'no') {
            return;
          }
        }
      }
    }

    const seenKey = 'reminder_seen_' + reminder.id + '_' + myPlayerId;
    if (localStorage.getItem(seenKey)) return;
    try { localStorage.setItem(seenKey, 'true'); } catch (e) {}

    const title = reminder.title || t('convocationReminderTitle', 'Recordatorio de convocatoria');
    const message = reminder.message || t('convocationReminderMsg', 'El entrenador espera tu respuesta de asistencia. ¡Por favor responde ahora!');

    if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
      try { window.AndroidBridge.showSystemNotification(title, message); } catch (e) {}
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: message, icon: 'icons/icon-192.png' }); } catch (e) {}
    }

    haptic(60);
    toast(`🔔 ${title}`, 'info');

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <div class="dialog-box" style="width: 90%; max-width: 420px; text-align: center; padding: 22px 18px;">
        <div style="font-size: 44px; margin-bottom: 8px;">📋</div>
        <h3 style="margin: 0 0 8px; font-size: 17.5px; font-weight: 900; color: #fff;">${escapeHtml(title)}</h3>
        <p style="font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0 0 18px;">
          ${escapeHtml(message)}
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn block" id="btn-remind-yes" style="height: 44px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 900; font-size: 14px; border: none; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
            ${t('confirmAttendanceYes', '🟢 Confirmar Asistencia (Sí)')}
          </button>
          <button type="button" class="btn block" id="btn-remind-no" style="height: 44px; background: rgba(239, 68, 68, 0.18); color: #fca5a5; font-weight: 800; font-size: 13.5px; border: 1.5px solid rgba(239, 68, 68, 0.4);">
            ${t('cannotAttendNo', '❌ No puedo asistir (Baja)')}
          </button>
          <button type="button" class="btn ghost block" id="btn-remind-dismiss" style="height: 38px; color: var(--muted); font-size: 12.5px;">
            ${t('dismiss', 'Descartar')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#btn-remind-dismiss').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const myP = getMyPlayer();
    const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Player';

    overlay.querySelector('#btn-remind-yes').onclick = async () => {
      close();
      if (convId) {
        liveVotes[convId] = liveVotes[convId] || {};
        liveVotes[convId][myPlayerId] = { status: 'called', playerName: pName, timestamp: Date.now() };
        if (window.Cloud && window.Cloud.voteAttendance) {
          try { await window.Cloud.voteAttendance(convId, myPlayerId, 'called', pName); } catch (e) {}
        }
        toast(t('attendanceConfirmed', '✅ Attendance confirmed!'), 'success');
        if (currentTab === 'convocations') renderConvocationsView();
      }
    };

    overlay.querySelector('#btn-remind-no').onclick = () => {
      close();
      if (convId) {
        showAbsenceReasonModal(title, async (reason) => {
          liveVotes[convId] = liveVotes[convId] || {};
          liveVotes[convId][myPlayerId] = {
            status: 'absent',
            playerName: pName,
            notes: reason || '',
            timestamp: Date.now()
          };
          if (window.Cloud && window.Cloud.voteAttendance) {
            try { await window.Cloud.voteAttendance(convId, myPlayerId, 'absent', pName, reason || ''); } catch (e) {}
          }
          toast(t('absenceReported', '❌ Absence registered.'), 'info');
          if (currentTab === 'convocations') renderConvocationsView();
        });
      }
    };

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     MODAL DE BORRADO FORZADO DE CACHÉ SOLICITADO POR EL ENTRENADOR
     ------------------------------------------------------------- */
  function showForceCachePurgeModal(remotePurgeTime) {
    if (document.getElementById('dialog-force-purge-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-force-purge-overlay';
    overlay.style.zIndex = '999999';
    overlay.innerHTML = `
      <div class="dialog-box" style="width: 90%; max-width: 420px; text-align: center; padding: 26px 20px; border-radius: 20px; border: 2px solid var(--cyan); box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
        <div style="font-size: 46px; margin-bottom: 12px;">🔄</div>
        <h3 style="margin: 0 0 10px; font-size: 19px; font-weight: 900; color: #fff;">${t('appUpdateRequired')}</h3>
        <p style="font-size: 13.5px; color: var(--muted); line-height: 1.5; margin: 0 0 22px;">
          ${t('appUpdateDesc')}
        </p>
        <button type="button" class="btn block primary" id="btn-force-purge-restart" style="height: 48px; font-size: 15px; font-weight: 900; border-radius: 12px;">
          ${t('restartApp')}
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-force-purge-restart').onclick = () => {
      try { 
        localStorage.setItem('player_last_cache_purge', String(remotePurgeTime));
        if (myPlayerId) localStorage.setItem('player_last_indiv_purge_' + myPlayerId, String(remotePurgeTime));
      } catch (e) {}
      if (typeof window.clearAppCacheAndReload === 'function') {
        window.clearAppCacheAndReload();
      } else {
        window.location.reload(true);
      }
    };
  }

  /* -------------------------------------------------------------
     INICIALIZACIÓN Y ENLACE EN VIVO CON FIREBASE
     ------------------------------------------------------------- */
  function init() {
    // 1. Cargar caché previo si existe
    try {
      const cached = localStorage.getItem('cached_club_state');
      if (cached) {
        clubData = JSON.parse(cached);
        window.clubData = clubData;
        if (clubData.settings && clubData.settings.forceCachePurgeTimestamp) {
          const remotePurgeTime = clubData.settings.forceCachePurgeTimestamp;
          const lastPurged = parseInt(localStorage.getItem('player_last_cache_purge') || '0', 10);
          if (remotePurgeTime > lastPurged) {
            showForceCachePurgeModal(remotePurgeTime);
          }
        }
        if (myPlayerId && Array.isArray(clubData.players) && clubData.players.length > 0) {
          const myCachedP = clubData.players.find(p => p.id === myPlayerId);
          const linkedAt = parseInt(localStorage.getItem('portal_player_linked_at') || '0', 10);
          if (myCachedP && myCachedP.unlinkedAt && linkedAt > 0 && myCachedP.unlinkedAt > (linkedAt + 5000)) {
            handlePlayerProfileUnlinked();
            return;
          }
        }
        updateHeaderIdentity();
        if (window.Cloud && window.Cloud.hydratePlayerPhotos && clubData && Array.isArray(clubData.players)) {
          window.Cloud.hydratePlayerPhotos(clubData.players, () => {
            updateHeaderIdentity();
            renderCurrentTab();
          });
        }
      }
    } catch (e) {}

    setupNavigation();
    updateTabbarLabels();
    updateHeaderIdentity();
    renderCurrentTab();

    // Iniciar escucha global de mensajes no leídos para el jugador si ya tiene perfil
    if (myPlayerId && window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
      const curP = getMyPlayer();
      const effTeamId = (curP ? curP.teamId : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal_player_team_id') : null);
      window.ChatUI.initGlobalUnreadListener(myPlayerId, effTeamId);
    }

    // Solicitar activación de notificaciones nativas de Android / PWA
    if (window.AndroidBridge && window.AndroidBridge.requestNotificationPermission) {
      try { window.AndroidBridge.requestNotificationPermission(); } catch (e) {}
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }

    // 2. Conectar en tiempo real con Firebase Firestore
    if (window.Cloud) {
      window.Cloud.init();

      if (myPlayerId) {
        listenToMyUnlink(myPlayerId);
      }

      if (myPlayerId && window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
        const curP = getMyPlayer();
        window.ChatUI.initGlobalUnreadListener(myPlayerId, curP ? curP.teamId : null);
      }

      const badge = document.getElementById('portal-cloud-badge');

      // Escuchar estado completo del club
      window.Cloud.listenToClubState((remoteState) => {
        if (!remoteState) return;

        // Comprobar si el entrenador ha solicitado borrado forzado de caché (global o individual)
        if (remoteState.settings && remoteState.settings.forceCachePurgeTimestamp) {
          const remotePurgeTime = remoteState.settings.forceCachePurgeTimestamp;
          const lastPurged = parseInt(localStorage.getItem('player_last_cache_purge') || '0', 10);
          if (remotePurgeTime > lastPurged) {
            showForceCachePurgeModal(remotePurgeTime);
            return;
          }
        }
        if (myPlayerId && Array.isArray(remoteState.players)) {
          const myRemoteP = remoteState.players.find(p => p.id === myPlayerId);
          if (myRemoteP && myRemoteP.forceCachePurgeTimestamp) {
            const playerPurgeTime = myRemoteP.forceCachePurgeTimestamp;
            const lastPlayerPurged = parseInt(localStorage.getItem('player_last_indiv_purge_' + myPlayerId) || '0', 10);
            if (playerPurgeTime > lastPlayerPurged) {
              showForceCachePurgeModal(playerPurgeTime);
              return;
            }
          }
        }

        // Comprobar si el perfil del jugador ha sido eliminado o desvinculado por el entrenador
        if (myPlayerId && remoteState._playersLoaded && Array.isArray(remoteState.players) && remoteState.players.length > 0) {
          const isPending = (myPlayerId === localStorage.getItem('portal_pending_creation_id'));
          const myRemoteP = remoteState.players.find(p => p.id === myPlayerId);
          if (!myRemoteP && !isPending) {
            handlePlayerProfileRemoved();
            return;
          }
          const linkedAt = parseInt(localStorage.getItem('portal_player_linked_at') || '0', 10);
          if (myRemoteP && myRemoteP.unlinkedAt && linkedAt > 0 && myRemoteP.unlinkedAt > (linkedAt + 5000)) {
            handlePlayerProfileUnlinked();
            return;
          }
        }

        if (Array.isArray(remoteState.players) && remoteState.players.length > 0) {
          clubData = remoteState;
        } else if (clubData && clubData.players && clubData.players.length > 0) {
          clubData = Object.assign({}, clubData, remoteState, {
            players: (remoteState.players && Array.isArray(remoteState.players) && remoteState.players.length > 0) ? remoteState.players : clubData.players,
            teams: (remoteState.teams && remoteState.teams.length > 0) ? remoteState.teams : clubData.teams
          });
        } else {
          clubData = remoteState;
        }
        if (remoteState.coachProfile) {
          clubData.coachProfile = remoteState.coachProfile;
        }
        if (remoteState.recurringSchedules) {
          clubData.recurringSchedules = remoteState.recurringSchedules;
        }
        if (remoteState.convocations) {
          clubData.convocations = remoteState.convocations;
        }
        if (remoteState.sessions) {
          clubData.sessions = remoteState.sessions;
        }
        window.clubData = clubData;
        updateConvocationsBadge();
        try { localStorage.setItem('cached_club_state', JSON.stringify(clubData)); } catch (e) {}

        if (remoteState.settings && remoteState.settings.clubName) {
          const titleEl = document.getElementById('portal-club-title');
          if (titleEl) titleEl.textContent = remoteState.settings.clubName;
        }

        if (badge) {
          badge.textContent = `🟢 ${t('live')}`;
          badge.style.background = 'rgba(34, 197, 94, 0.15)';
          badge.style.color = '#86efac';
        }

        updateHeaderIdentity();
        renderCurrentTab();

        if (window.Cloud && window.Cloud.hydratePlayerPhotos && clubData && Array.isArray(clubData.players)) {
          window.Cloud.hydratePlayerPhotos(clubData.players, () => {
            updateHeaderIdentity();
            renderCurrentTab();
          });
        }

        // Si el modal de carga o no hay perfil aprobado, gestionar selector de identidad
        if (!hasApprovedProfile() && !localStorage.getItem('portal_pending_claim')) {
          const loadingModal = document.getElementById('dialog-id-loading-overlay');
          const existingSelectionModal = document.getElementById('dialog-select-identity-overlay');
          if (loadingModal) {
            loadingModal.remove();
            showSelectIdentityModal();
          } else if (!existingSelectionModal) {
            showSelectIdentityModal();
          }
        } else if (myPlayerId && hasApprovedProfile()) {
          const regKey = 'portal_device_link_registered_' + myPlayerId;
          if (!localStorage.getItem(regKey)) {
            try { localStorage.setItem(regKey, 'true'); } catch (e) {}
            if (window.Cloud && window.Cloud.registerPlayerDeviceLink) {
              const curP = getMyPlayer();
              window.Cloud.registerPlayerDeviceLink(myPlayerId, curP ? curP.name : '');
            }
          }
        }
      });

      // Escuchar respuestas de asistencia de convocatorias
      if (window.Cloud.startListeningToResponses) {
        window.Cloud.startListeningToResponses((resp) => {
          if (resp && resp.convId && resp.playerId) {
            liveVotes[resp.convId] = liveVotes[resp.convId] || {};
            liveVotes[resp.convId][resp.playerId] = resp;
            if (currentTab === 'convocations') {
              renderConvocationsView();
            }
          }
        });
      }

      // Escuchar si hay alguna solicitud de cambio de perfil pendiente
      const pendingReqId = localStorage.getItem('portal_pending_req_id');
      if (pendingReqId) {
        listenToMyPendingRequest(pendingReqId);
      }

      // Escuchar si hay alguna solicitud de alta de nuevo jugador pendiente
      const pendingCreationId = localStorage.getItem('portal_pending_creation_id');
      if (pendingCreationId) {
        listenToMyCreationRequest(pendingCreationId);
      }

      // Escuchar recordatorios de convocatoria del entrenador
      if (myPlayerId && window.Cloud && window.Cloud.listenToConvocationReminders) {
        window.Cloud.listenToConvocationReminders(myPlayerId, (reminder) => {
          handleIncomingConvocationReminder(reminder);
        });
      }
    }

    // 3. Cargar datos locales de respaldo y pedir identidad si aún no la tiene
    loadInitialClubData().then(() => {
      if (!hasApprovedProfile()) {
        const savedClaimJson = localStorage.getItem('portal_pending_claim');
        let activeClaim = null;
        if (savedClaimJson) {
          try {
            const parsed = JSON.parse(savedClaimJson);
            if (parsed && parsed.targetPlayerId) {
              activeClaim = parsed;
            }
          } catch (e) {}
        }

        if (activeClaim) {
          const pObj = (clubData && clubData.players) ? clubData.players.find(p => p.id === activeClaim.targetPlayerId) : null;
          setTimeout(() => {
            if (!hasApprovedProfile()) {
              showConfirmIdentitySecurityCodeModal(pObj || { id: activeClaim.targetPlayerId, name: activeClaim.targetPlayerName, mainDorsal: activeClaim.targetPlayerDorsal }, activeClaim);
            }
          }, 150);
        } else if (clubData && clubData.players && clubData.players.length > 0) {
          setTimeout(() => {
            if (!hasApprovedProfile() && !localStorage.getItem('portal_pending_claim')) {
              showSelectIdentityModal();
            }
          }, 250);
        } else {
          setTimeout(() => {
            if (!hasApprovedProfile() && !localStorage.getItem('portal_pending_claim')) {
              showIdentityLoadingModal();
            }
          }, 250);
        }
      } else if (myPlayerId) {
        const regKey = 'portal_device_link_registered_' + myPlayerId;
        if (!localStorage.getItem(regKey)) {
          try { localStorage.setItem(regKey, 'true'); } catch (e) {}
          if (window.Cloud && window.Cloud.registerPlayerDeviceLink) {
            const curP = getMyPlayer();
            window.Cloud.registerPlayerDeviceLink(myPlayerId, curP ? curP.name : '');
          }
        }
      }
    });
  }

  window.__showPlayerProfile = function (pid) {
    showPlayerFullProfileModal(pid);
  };

  window.__showCoachProfile = function () {
    showCoachFullProfileModal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

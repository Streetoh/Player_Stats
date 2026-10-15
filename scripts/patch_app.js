const fs = require('fs');

let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Reemplazar formatConvocationWhatsAppText
const funcStart = '  function formatConvocationWhatsAppText(conv, lang) {';
const funcEnd = '⚽ _Enviado desde Estadísticas Jugadores_`;\n    return text;\n  }';

const newFunc = `  function formatConvocationWhatsAppText(conv, lang) {
    const l = (lang || (Store.state.settings && Store.state.settings.lang) || 'es').toLowerCase();
    const isRu = (l === 'ru');
    const isEt = (l === 'et' || l === 'ee');
    const isEn = (l === 'en');
    const isEs = (!isRu && !isEt && !isEn);

    const team = Store.team(conv.teamId);
    const teamName = team ? team.name : '';
    const dateStr = conv.date || '';
    const timeFormatted = conv.time 
      ? (conv.time + (conv.endTime ? ' - ' + conv.endTime : '') + (conv.duration ? \` (\${conv.duration} min)\` : '')) 
      : '';
    const timeStr = conv.time || '';

    const venueStr = conv.venue ? (
      isRu ? \`📍 *Место:* \${conv.venue}\\n\` :
      isEt ? \`📍 *Koht:* \${conv.venue}\\n\` :
      isEn ? \`📍 *Venue:* \${conv.venue}\\n\` :
      \`📍 *Lugar:* \${conv.venue}\\n\`
    ) : '';

    const addressStr = conv.address ? (
      isRu ? \`🗺️ *Адрес:* \${conv.address}\\n\` :
      isEt ? \`🗺️ *Aadress:* \${conv.address}\\n\` :
      isEn ? \`🗺️ *Address:* \${conv.address}\\n\` :
      \`🗺️ *Dirección:* \${conv.address}\\n\`
    ) : '';

    const rivalStr = conv.rival ? (
      isRu ? \`⚔️ *Соперник:* \${conv.rival}\\n\` :
      isEt ? \`⚔️ *Vastane:* \${conv.rival}\\n\` :
      isEn ? \`⚔️ *Opponent:* \${conv.rival}\\n\` :
      \`🆚 *Rival:* \${conv.rival}\\n\`
    ) : '';

    const notesStr = conv.notes ? (
      isRu ? \`📝 *Примечания:* \${conv.notes}\\n\` :
      isEt ? \`📝 *Märkmed:* \${conv.notes}\\n\` :
      isEn ? \`📝 *Notes:* \${conv.notes}\\n\` :
      \`📝 *Notas:* \${conv.notes}\\n\`
    ) : '';

    const defTitle = conv.type === 'match'
      ? (isRu ? 'МАТЧ' : isEt ? 'MÄNG' : isEn ? 'MATCH' : 'PARTIDO')
      : (isRu ? 'ТРЕНИРОВКА' : isEt ? 'TREENING' : isEn ? 'TRAINING' : 'ENTRENAMIENTO');

    let text = isRu
      ? \`📋 *ОФИЦИАЛЬНАЯ ЗАЯВКА: \${conv.title || defTitle}*\\n\`
      : isEt
      ? \`📋 *AMETLIK KOKKUKUTSE: \${conv.title || defTitle}*\\n\`
      : isEn
      ? \`📋 *OFFICIAL CALL-UP: \${conv.title || defTitle}*\\n\`
      : \`📋 *CONVOCATORIA: \${conv.title || defTitle}*\\n\`;

    if (teamName) {
      text += isRu ? \`🛡️ *Команда:* \${teamName}\\n\` :
              isEt ? \`🛡️ *Võistkond:* \${teamName}\\n\` :
              isEn ? \`🛡️ *Team:* \${teamName}\\n\` :
              \`🛡️ *Equipo:* \${teamName}\\n\`;
    }

    text += isRu ? \`📅 *Дата:* \${dateStr} • ⏰ *Время:* \${timeFormatted}\\n\` :
            isEt ? \`📅 *Kuupäev:* \${dateStr} • ⏰ *Kellaaeg:* \${timeFormatted}\\n\` :
            isEn ? \`📅 *Date:* \${dateStr} • ⏰ *Time:* \${timeFormatted}\\n\` :
            \`📅 *Fecha:* \${dateStr} • ⏰ *Hora:* \${timeFormatted}\\n\`;

    if (rivalStr) text += rivalStr;
    if (venueStr) text += venueStr;
    if (addressStr) text += addressStr;
    if (notesStr) text += notesStr;

    const list = conv.list || {};
    const called = [];
    const bench = [];
    const injured = [];
    const absent = [];
    const calledNamesSimple = [];

    const allPlayersMap = {};
    Store.sortedPlayers().forEach(p => { allPlayersMap[p.id] = p; });

    Object.keys(list).forEach(pid => {
      const st = list[pid];
      if (!st || st === 'uncalled') return;
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, ''), mainPosition: 'Jugador' };
      const dorsal = p.mainDorsal != null ? \`#\${p.mainDorsal} \` : '';
      const pos = p.mainPosition ? \` (\${p.mainPosition})\` : '';
      const name = \`\${dorsal}\${Store.playerName(p)}\${pos}\`;

      if (st === 'called') {
        called.push(name);
        calledNamesSimple.push(Store.playerName(p));
      } else if (st === 'bench') {
        bench.push(name);
      } else if (st === 'injured') {
        injured.push(name);
      } else if (st === 'absent') {
        absent.push(name);
      }
    });

    // Enlace web de confirmación arriba destacado
    const webBaseUrl = (conv.webUrl || (Store.state.settings && Store.state.settings.convocatoriaWebUrl) || 'https://streetoh.github.io/Player_Stats/convocatoria.html').trim();
    if (webBaseUrl) {
      const qParams = new URLSearchParams();
      const titleVal = conv.title || (conv.type === 'match'
        ? (isRu ? 'Матч' : isEt ? 'Mäng' : isEn ? 'Match' : 'Partido')
        : (isRu ? 'Тренировка' : isEt ? 'Treening' : isEn ? 'Training' : 'Entrenamiento'));
      qParams.set('t', titleVal);
      if (teamName) qParams.set('tm', teamName);
      if (dateStr) qParams.set('d', dateStr);
      if (timeStr) qParams.set('h', timeFormatted || timeStr);
      if (conv.venue) qParams.set('v', conv.venue);
      if (conv.address) qParams.set('a', conv.address);
      if (conv.rival) qParams.set('r', conv.rival);
      if (calledNamesSimple.length > 0) {
        qParams.set('p', calledNamesSimple.join(','));
      }
      qParams.set('lang', isRu ? 'ru' : (isEt ? 'et' : (isEn ? 'en' : 'es')));

      const sep = webBaseUrl.includes('?') ? '&' : '?';
      text += isRu
        ? \`\\n🌐 *Подтвердить участие онлайн:*\\n👉 \${webBaseUrl}\${sep}\${qParams.toString()}\\n\`
        : isEt
        ? \`\\n🌐 *Kinnita osalemine veebis:*\\n👉 \${webBaseUrl}\${sep}\${qParams.toString()}\\n\`
        : isEn
        ? \`\\n🌐 *Confirm online attendance:*\\n👉 \${webBaseUrl}\${sep}\${qParams.toString()}\\n\`
        : \`\\n🌐 *Confirmar asistencia en enlace web:*\\n👉 \${webBaseUrl}\${sep}\${qParams.toString()}\\n\`;
    }

    if (called.length > 0) {
      text += isRu ? \`\\n🟢 *В ЗАЯВКЕ (\${called.length}):*\\n\` :
              isEt ? \`\\n🟢 *KOKKU KUTSUTUD (\${called.length}):*\\n\` :
              isEn ? \`\\n🟢 *CALLED UP (\${called.length}):*\\n\` :
              \`\\n🟢 *CONVOCADOS (\${called.length}):*\\n\`;
      called.forEach(item => { text += \`  • \${item}\\n\`; });
    } else {
      text += isRu ? \`\\n🟢 *В ЗАЯВКЕ (0):*\\n  (Игроки еще не выбраны)\\n\` :
              isEt ? \`\\n🟢 *KOKKU KUTSUTUD (0):*\\n  (Mängijaid pole veel valitud)\\n\` :
              isEn ? \`\\n🟢 *CALLED UP (0):*\\n  (No players selected yet)\\n\` :
              \`\\n🟢 *CONVOCADOS (0):*\\n  (Sin jugadores seleccionados aún)\\n\`;
    }

    if (bench.length > 0) {
      text += isRu ? \`\\n🟡 *ЗАПАСНЫЕ (\${bench.length}):*\\n\` :
              isEt ? \`\\n🟡 *PINGIL (\${bench.length}):*\\n\` :
              isEn ? \`\\n🟡 *BENCH (\${bench.length}):*\\n\` :
              \`\\n🟡 *SUPLENTES (\${bench.length}):*\\n\`;
      bench.forEach(item => { text += \`  • \${item}\\n\`; });
    }

    if (injured.length > 0) {
      text += isRu ? \`\\n🏥 *ТРАВМИРОВАНЫ (\${injured.length}):*\\n\` :
              isEt ? \`\\n🏥 *VIGASTATUD (\${injured.length}):*\\n\` :
              isEn ? \`\\n🏥 *INJURED (\${injured.length}):*\\n\` :
              \`\\n🏥 *LESIONADOS (\${injured.length}):*\\n\`;
      injured.forEach(item => { text += \`  • \${item}\\n\`; });
    }

    if (absent.length > 0) {
      text += isRu ? \`\\n❌ *НЕ МОГУТ (\${absent.length}):*\\n\` :
              isEt ? \`\\n❌ *PUUDUVAD (\${absent.length}):*\\n\` :
              isEn ? \`\\n❌ *UNAVAILABLE (\${absent.length}):*\\n\` :
              \`\\n❌ *NO DISPONIBLES (\${absent.length}):*\\n\`;
      absent.forEach(item => { text += \`  • \${item}\\n\`; });
    }

    text += isRu
      ? \`\\n📲 *Пожалуйста, подтвердите участие в Viber:*\\n  👉 Ответьте: "🟢 БУДУ" или "❌ НЕ МОГУ"\\n⚽ _Отправлено из Player Stats_\`
      : isEt
      ? \`\\n📲 *Palun kinnita oma osalemine vastates Viberis:*\\n  👉 Vasta: "🟢 TULEN" või "❌ EI SAA"\\n⚽ _Saadetud rakendusest Player Stats_\`
      : isEn
      ? \`\\n📲 *Please confirm attendance by replying via Viber:*\\n  👉 Reply: "🟢 ATTENDING" or "❌ CANNOT ATTEND"\\n⚽ _Sent from Player Stats_\`
      : \`\\n📲 *Por favor confirma tu asistencia respondiendo por Viber:*\\n  👉 Responde: "🟢 VOY" o "❌ NO PUEDO"\\n⚽ _Enviado desde Estadísticas Jugadores_\`;
    return text;
  }`;

const startIdx = code.indexOf(funcStart);
const endIdx = code.indexOf(funcEnd) + funcEnd.length;
if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + newFunc + code.substring(endIdx);
  console.log('Replaced formatConvocationWhatsAppText');
} else {
  console.error('ERROR finding formatConvocationWhatsAppText');
}

// 2. Botones de compartir en showConvocationDetailsModal
const oldDetailsGrid = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
            <button type="button" class="btn" id="btn-conv-share-viber-es" style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 12.5px; border-color: #a855f7;">
              💜 Viber (Español)
            </button>
            <button type="button" class="btn" id="btn-conv-share-viber-en" style="background: #6d28d9; color: #fff; font-weight: 800; font-size: 12.5px; border-color: #9333ea;">
              💜 Viber (English)
            </button>
          </div>`;

const newDetailsGrid = `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px;">
            <button type="button" class="btn" id="btn-conv-share-viber-es" style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 11.5px; padding: 6px 2px; border-color: #a855f7;">
              🇪🇸 ES
            </button>
            <button type="button" class="btn" id="btn-conv-share-viber-en" style="background: #6d28d9; color: #fff; font-weight: 800; font-size: 11.5px; padding: 6px 2px; border-color: #9333ea;">
              🇬🇧 EN
            </button>
            <button type="button" class="btn" id="btn-conv-share-viber-et" style="background: #5b21b6; color: #fff; font-weight: 800; font-size: 11.5px; padding: 6px 2px; border-color: #8b5cf6;">
              🇪🇪 ET
            </button>
            <button type="button" class="btn" id="btn-conv-share-viber-ru" style="background: #4c1d95; color: #fff; font-weight: 800; font-size: 11.5px; padding: 6px 2px; border-color: #7c3aed;">
              🇷🇺 RU
            </button>
          </div>`;
code = code.replace(oldDetailsGrid, newDetailsGrid);

const oldDetailsHandlers = `const btnViberEs = body.querySelector('#btn-conv-share-viber-es');
        if (btnViberEs) btnViberEs.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'es'));

        const btnViberEn = body.querySelector('#btn-conv-share-viber-en');
        if (btnViberEn) btnViberEn.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'en'));`;

const newDetailsHandlers = `const btnViberEs = body.querySelector('#btn-conv-share-viber-es');
        if (btnViberEs) btnViberEs.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'es'));

        const btnViberEn = body.querySelector('#btn-conv-share-viber-en');
        if (btnViberEn) btnViberEn.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'en'));

        const btnViberEt = body.querySelector('#btn-conv-share-viber-et');
        if (btnViberEt) btnViberEt.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'et'));

        const btnViberRu = body.querySelector('#btn-conv-share-viber-ru');
        if (btnViberRu) btnViberRu.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'ru'));`;
code = code.replace(oldDetailsHandlers, newDetailsHandlers);

// 3. Botones de compartir en showEditConvocationModal
const oldEditGrid = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <button class="btn" id="btn-conv-share-viber-es" style="background: #7c3aed; color: #fff; border-color: #a855f7; font-weight: 800; font-size: 12.5px;">
            💜 Viber (ES)
          </button>
          <button class="btn" id="btn-conv-share-viber-en" style="background: #6d28d9; color: #fff; border-color: #9333ea; font-weight: 800; font-size: 12.5px;">
            💜 Viber (EN)
          </button>
        </div>`;

const newEditGrid = `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;">
          <button class="btn" id="btn-conv-share-viber-es" style="background: #7c3aed; color: #fff; border-color: #a855f7; font-weight: 800; font-size: 11.5px; padding: 6px 2px;">
            🇪🇸 ES
          </button>
          <button class="btn" id="btn-conv-share-viber-en" style="background: #6d28d9; color: #fff; border-color: #9333ea; font-weight: 800; font-size: 11.5px; padding: 6px 2px;">
            🇬🇧 EN
          </button>
          <button class="btn" id="btn-conv-share-viber-et" style="background: #5b21b6; color: #fff; border-color: #8b5cf6; font-weight: 800; font-size: 11.5px; padding: 6px 2px;">
            🇪🇪 ET
          </button>
          <button class="btn" id="btn-conv-share-viber-ru" style="background: #4c1d95; color: #fff; border-color: #7c3aed; font-weight: 800; font-size: 11.5px; padding: 6px 2px;">
            🇷🇺 RU
          </button>
        </div>`;
code = code.replace(oldEditGrid, newEditGrid);

const oldEditHandlers = `foot.querySelector('#btn-conv-share-viber-es').onclick = () => triggerViberShare('es');
      foot.querySelector('#btn-conv-share-viber-en').onclick = () => triggerViberShare('en');`;

const newEditHandlers = `foot.querySelector('#btn-conv-share-viber-es').onclick = () => triggerViberShare('es');
      foot.querySelector('#btn-conv-share-viber-en').onclick = () => triggerViberShare('en');
      foot.querySelector('#btn-conv-share-viber-et').onclick = () => triggerViberShare('et');
      foot.querySelector('#btn-conv-share-viber-ru').onclick = () => triggerViberShare('ru');`;
code = code.replace(oldEditHandlers, newEditHandlers);

// 4. Selector de idioma en renderConfigView
const oldConfigSegmented = `<div class="segmented">
          <button type="button" class="\${I18N.getLang() === 'es' ? 'active' : ''}" id="lang-pick-es">Español 🇪🇸</button>
          <button type="button" class="\${I18N.getLang() === 'en' ? 'active' : ''}" id="lang-pick-en">English 🇬🇧</button>
        </div>`;

const newConfigSegmented = `<div class="segmented" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
          <button type="button" class="\${I18N.getLang() === 'es' ? 'active' : ''}" id="lang-pick-es">🇪🇸 ES</button>
          <button type="button" class="\${I18N.getLang() === 'en' ? 'active' : ''}" id="lang-pick-en">🇬🇧 EN</button>
          <button type="button" class="\${(I18N.getLang() === 'et' || I18N.getLang() === 'ee') ? 'active' : ''}" id="lang-pick-et">🇪🇪 ET</button>
          <button type="button" class="\${I18N.getLang() === 'ru' ? 'active' : ''}" id="lang-pick-ru">🇷🇺 RU</button>
        </div>`;
code = code.replace(oldConfigSegmented, newConfigSegmented);

const oldConfigClicks = `view.querySelector('#lang-pick-es').onclick = () => {
      I18N.setLang('es');
      renderTabbar();
      navigate('config');
    };
    view.querySelector('#lang-pick-en').onclick = () => {
      I18N.setLang('en');
      renderTabbar();
      navigate('config');
    };`;

const newConfigClicks = `view.querySelector('#lang-pick-es').onclick = () => {
      I18N.setLang('es');
      renderTabbar();
      navigate('config');
    };
    view.querySelector('#lang-pick-en').onclick = () => {
      I18N.setLang('en');
      renderTabbar();
      navigate('config');
    };
    const btnEt = view.querySelector('#lang-pick-et');
    if (btnEt) {
      btnEt.onclick = () => {
        I18N.setLang('et');
        renderTabbar();
        navigate('config');
      };
    }
    const btnRu = view.querySelector('#lang-pick-ru');
    if (btnRu) {
      btnRu.onclick = () => {
        I18N.setLang('ru');
        renderTabbar();
        navigate('config');
      };
    }`;
code = code.replace(oldConfigClicks, newConfigClicks);

fs.writeFileSync('js/app.js', code, 'utf8');
console.log('✅ js/app.js actualizado con soporte para los 4 idiomas (ES, EN, ET, RU).');

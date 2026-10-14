/* =========================================================
   FUT Card Generator (Carta Coleccionable estilo EA FC / FIFA)
   - Renderizado Canvas HD en el cliente (0 coste Firebase)
   - 3 temas: Oro Brillante, TOTW In-Form y Noova Diamante
   - Descarga en PNG de alta resolución y compartir en redes
   ========================================================= */
(function (global) {
  'use strict';

  const THEMES = {
    gold: {
      id: 'gold',
      name: { es: 'Oro Brillante', en: 'Gold Rare', ee: 'Kuldne' },
      bgGrad: ['#3b2d13', '#61481c', '#9e7930', '#fef08a', '#9e7930', '#3b2d13'],
      cardBorder: '#facc15',
      innerBg: 'linear-gradient(145deg, #1f1807 0%, #36290e 30%, #523e13 70%, #1a1405 100%)',
      glow: 'rgba(250, 204, 21, 0.45)',
      textColor: '#ffffff',
      numColor: '#fef08a',
      statLabelColor: '#cbd5e1',
      badgeBg: 'rgba(250, 204, 21, 0.2)',
      badgeBorder: '#eab308'
    },
    totw: {
      id: 'totw',
      name: { es: 'TOTW (Negra)', en: 'In-Form (Black)', ee: 'Must TOTW' },
      bgGrad: ['#09090b', '#18181b', '#27272a', '#18181b', '#09090b'],
      cardBorder: '#eab308',
      innerBg: 'linear-gradient(145deg, #09090b 0%, #1c1917 50%, #0c0a09 100%)',
      glow: 'rgba(234, 179, 8, 0.55)',
      textColor: '#ffffff',
      numColor: '#facc15',
      statLabelColor: '#a1a1aa',
      badgeBg: 'rgba(234, 179, 8, 0.25)',
      badgeBorder: '#f59e0b'
    },
    cyber: {
      id: 'cyber',
      name: { es: 'Noova Diamante', en: 'Noova Diamond', ee: 'Noova Teemant' },
      bgGrad: ['#042f2e', '#0e7490', '#06b6d4', '#67e8f9', '#0891b2', '#083344'],
      cardBorder: '#22d3ee',
      innerBg: 'linear-gradient(145deg, #021e28 0%, #083344 50%, #041f2d 100%)',
      glow: 'rgba(34, 211, 238, 0.55)',
      textColor: '#ffffff',
      numColor: '#a5f3fc',
      statLabelColor: '#94a3b8',
      badgeBg: 'rgba(6, 182, 212, 0.2)',
      badgeBorder: '#22d3ee'
    }
  };

  function getLang() {
    if (typeof window !== 'undefined') {
      return window.currentLang || (window.Store && window.Store.state && window.Store.state.settings && window.Store.state.settings.lang) || localStorage.getItem('lang') || 'es';
    }
    return 'es';
  }

  function getI18nText(key, fallback) {
    const lang = getLang();
    const dict = {
      es: {
        futCardTitle: 'Carta FUT Coleccionable',
        futCardSubtitle: 'Ficha oficial verificada con tus atributos en analítica real',
        downloadCard: 'Descargar Carta (PNG)',
        downloading: 'Generando imagen...',
        shareWhatsApp: 'Compartir en WhatsApp',
        shareViber: 'Compartir en Viber',
        shareText: '¡Mira mi Carta Oficial de Player Stats con media general de {ovr}!',
        close: 'Cerrar',
        selectTheme: 'Elige el diseño de tu carta:',
        statPas: 'PAS', statTir: 'TIR', statReg: 'REG', statFis: 'FIS', statDef: 'DEF', statDis: 'DIS',
        streakBadge: '🔥 RACHA DE ASISTENCIA: {streak}'
      },
      en: {
        futCardTitle: 'FUT Collectible Card',
        futCardSubtitle: 'Official verified card with your attributes in real analytics',
        downloadCard: 'Download Card (PNG)',
        downloading: 'Rendering image...',
        shareWhatsApp: 'Share on WhatsApp',
        shareViber: 'Share on Viber',
        shareText: 'Check out my official Player Stats card with an overall rating of {ovr}!',
        close: 'Close',
        selectTheme: 'Choose your card theme:',
        statPas: 'PAS', statTir: 'SHO', statReg: 'DRI', statFis: 'PHY', statDef: 'DEF', statDis: 'DIS',
        streakBadge: '🔥 ATTENDANCE STREAK: {streak}'
      },
      ee: {
        futCardTitle: 'Kogutav FUT Kaart',
        futCardSubtitle: 'Ametlik kinnitatud kaart sinu reaalsete oskustega',
        downloadCard: 'Laadi alla kaart (PNG)',
        downloading: 'Pildi loomine...',
        shareWhatsApp: 'Jaga WhatsAppis',
        shareViber: 'Jaga Viberis',
        shareText: 'Vaata minu ametlikku Player Stats kaarti üldhinnanguga {ovr}!',
        close: 'Sulge',
        selectTheme: 'Vali kaardi stiil:',
        statPas: 'SÖÖ', statTir: 'LÖÖ', statReg: 'TRI', statFis: 'FÜÜ', statDef: 'KAI', statDis: 'DIT',
        streakBadge: '🔥 TREENINGUTE SEERIA: {streak}'
      }
    };
    return (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || fallback || key;
  }

  function computeOvr(radar) {
    if (!radar) return 75;
    const p = radar.pas || 50;
    const t = radar.tir || 50;
    const r = radar.reg || 50;
    const f = radar.fis || 50;
    const d = radar.def || 50;
    const di = radar.dis || 50;
    const avg = (p * 0.22 + t * 0.20 + r * 0.20 + f * 0.15 + d * 0.13 + di * 0.10);
    return Math.min(99, Math.max(45, Math.round(avg)));
  }

  function drawFutCardCanvas(canvas, data, themeId) {
    const ctx = canvas.getContext('2d');
    const W = 600;
    const H = 880;
    canvas.width = W;
    canvas.height = H;

    const theme = THEMES[themeId] || THEMES.gold;
    const lang = getLang();

    // Helper path para la forma de escudo oficial FUT
    function makeCardPath(inset = 0) {
      ctx.beginPath();
      const x = inset;
      const y = inset;
      const w = W - inset * 2;
      const h = H - inset * 2;
      const r = 28;

      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h * 0.78);
      ctx.lineTo(x + w * 0.5, y + h);
      ctx.lineTo(x, y + h * 0.78);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    ctx.clearRect(0, 0, W, H);

    // 1. Sombra exterior del escudo
    ctx.save();
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    makeCardPath(12);
    ctx.fillStyle = '#060a13';
    ctx.fill();
    ctx.restore();

    // 2. Borde exterior metálico
    ctx.save();
    makeCardPath(12);
    ctx.clip();

    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    theme.bgGrad.forEach((col, idx) => {
      borderGrad.addColorStop(idx / (theme.bgGrad.length - 1), col);
    });
    ctx.fillStyle = borderGrad;
    ctx.fill();

    // 3. Fondo interior del escudo
    ctx.beginPath();
    makeCardPath(20);
    ctx.clip();

    const bgInner = ctx.createLinearGradient(0, 0, 0, H);
    if (themeId === 'gold') {
      bgInner.addColorStop(0, '#2b210a');
      bgInner.addColorStop(0.35, '#453511');
      bgInner.addColorStop(0.7, '#241a06');
      bgInner.addColorStop(1, '#120d03');
    } else if (themeId === 'totw') {
      bgInner.addColorStop(0, '#111114');
      bgInner.addColorStop(0.4, '#1c1917');
      bgInner.addColorStop(0.7, '#141211');
      bgInner.addColorStop(1, '#09090b');
    } else {
      bgInner.addColorStop(0, '#04222f');
      bgInner.addColorStop(0.4, '#083344');
      bgInner.addColorStop(0.75, '#05232e');
      bgInner.addColorStop(1, '#02131a');
    }
    ctx.fillStyle = bgInner;
    ctx.fill();

    // Rayos / Texturas de fondo sutiles
    ctx.save();
    ctx.strokeStyle = (themeId === 'gold' ? 'rgba(250, 204, 21, 0.08)' : (themeId === 'cyber' ? 'rgba(34, 211, 238, 0.08)' : 'rgba(255, 255, 255, 0.04)'));
    ctx.lineWidth = 1.5;
    for (let i = -W; i < W * 2; i += 38) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H * 0.6, H);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Panel Izquierdo Superior: OVR y Posición
    const ovr = data.ovr || computeOvr(data.radar);
    const pos = (data.player && data.player.mainPosition) ? data.player.mainPosition.toUpperCase() : 'MC';
    const dorsal = (data.player && data.player.mainDorsal != null) ? '#' + data.player.mainDorsal : '';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // OVR
    ctx.font = '900 68px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = theme.numColor;
    ctx.fillText(String(ovr), 110, 140);

    // Posición
    ctx.font = '900 30px "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pos, 110, 185);

    // Dorsal
    if (dorsal) {
      ctx.font = '800 20px sans-serif';
      ctx.fillStyle = theme.cardBorder;
      ctx.fillText(dorsal, 110, 216);
    }

    // Escudo del Club
    ctx.font = '36px sans-serif';
    ctx.fillText('🛡️', 110, 265);

    // 5. Centro Superior: Foto o Avatar del Jugador
    const avatarX = 360;
    const avatarY = 200;
    const avatarR = 115;

    // Círculo de resplandor detrás de la foto
    const auraGrad = ctx.createRadialGradient(avatarX, avatarY, 20, avatarX, avatarY, avatarR + 20);
    auraGrad.addColorStop(0, theme.glow);
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 20, 0, Math.PI * 2);
    ctx.fill();

    // Si tiene foto y se ha cargado una imagen Image
    if (data._avatarImage) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(data._avatarImage, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
    } else {
      // Avatar placeholder con inicial
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.fillStyle = (themeId === 'gold' ? '#785718' : (themeId === 'cyber' ? '#0e7490' : '#27272a'));
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = theme.cardBorder;
      ctx.stroke();

      const initial = ((data.player && data.player.name) ? data.player.name[0] : 'P').toUpperCase();
      ctx.font = '900 100px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, avatarX, avatarY);
      ctx.restore();
    }

    // Borde circular alrededor del avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = theme.cardBorder;
    ctx.stroke();
    ctx.restore();

    // 6. Placa con el Nombre del Jugador
    const nameY = 385;
    const fullName = (data.player ? `${data.player.name || ''} ${data.player.lastName || ''}` : 'PLAYER').trim();
    const displayName = fullName.length > 20 ? (data.player.name ? data.player.name[0] + '. ' + (data.player.lastName || data.player.name) : fullName) : fullName;

    // Cinta dorada / neón
    ctx.save();
    const ribbonGrad = ctx.createLinearGradient(60, nameY, W - 60, nameY);
    ribbonGrad.addColorStop(0, 'rgba(0,0,0,0)');
    ribbonGrad.addColorStop(0.2, theme.badgeBg);
    ribbonGrad.addColorStop(0.5, theme.badgeBg);
    ribbonGrad.addColorStop(0.8, theme.badgeBg);
    ribbonGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ribbonGrad;
    ctx.fillRect(40, nameY - 32, W - 80, 52);

    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(70, nameY + 20);
    ctx.lineTo(W - 70, nameY + 20);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 32px "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(displayName.toUpperCase(), W / 2, nameY - 5);
    ctx.restore();

    // 7. Rejilla de Atributos (6 Stats oficiales FIFA)
    const statsY = 470;
    const r = data.radar || { pas: 70, tir: 70, reg: 70, fis: 70, def: 70, dis: 70 };
    const leftStats = [
      { label: getI18nText('statPas', 'PAS'), val: r.pas },
      { label: getI18nText('statTir', 'TIR'), val: r.tir },
      { label: getI18nText('statReg', 'REG'), val: r.reg }
    ];
    const rightStats = [
      { label: getI18nText('statFis', 'FIS'), val: r.fis },
      { label: getI18nText('statDef', 'DEF'), val: r.def },
      { label: getI18nText('statDis', 'DIS'), val: r.dis }
    ];

    // Línea divisoria central vertical
    ctx.save();
    ctx.strokeStyle = (themeId === 'gold' ? 'rgba(250, 204, 21, 0.4)' : (themeId === 'cyber' ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255, 255, 255, 0.2)'));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, statsY - 30);
    ctx.lineTo(W / 2, statsY + 160);
    ctx.stroke();
    ctx.restore();

    // Renderizar columna izquierda
    leftStats.forEach((st, idx) => {
      const y = statsY + idx * 56;
      ctx.textAlign = 'right';
      ctx.font = '900 34px "Arial Black", sans-serif';
      ctx.fillStyle = theme.numColor;
      ctx.fillText(String(Math.round(st.val)), W / 2 - 80, y);

      ctx.textAlign = 'left';
      ctx.font = '900 24px sans-serif';
      ctx.fillStyle = theme.statLabelColor;
      ctx.fillText(st.label, W / 2 - 68, y - 2);
    });

    // Renderizar columna derecha
    rightStats.forEach((st, idx) => {
      const y = statsY + idx * 56;
      ctx.textAlign = 'right';
      ctx.font = '900 34px "Arial Black", sans-serif';
      ctx.fillStyle = theme.numColor;
      ctx.fillText(String(Math.round(st.val)), W / 2 + 50, y);

      ctx.textAlign = 'left';
      ctx.font = '900 24px sans-serif';
      ctx.fillStyle = theme.statLabelColor;
      ctx.fillText(st.label, W / 2 + 62, y - 2);
    });

    // 8. Racha de Asistencias (si tiene racha activa >= 2)
    const streak = data.streak || 0;
    if (streak >= 2) {
      ctx.save();
      const badgeY = 690;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      const bw = 380, bh = 38;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(W / 2 - bw / 2, badgeY, bw, bh, 10);
      else ctx.rect(W / 2 - bw / 2, badgeY, bw, bh);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 17px sans-serif';
      ctx.fillStyle = '#fed7aa';
      ctx.fillText(getI18nText('streakBadge', '🔥 RACHA DE ASISTENCIA: {streak}').replace('{streak}', streak), W / 2, badgeY + bh / 2);
      ctx.restore();
    }

    // 9. Pie de la Carta: Sello de Calidad y Equipo
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 14px sans-serif';
    ctx.fillStyle = (themeId === 'gold' ? '#fde047' : (themeId === 'cyber' ? '#67e8f9' : '#e4e4e7'));
    const teamName = (data.team && data.team.name) ? data.team.name : 'PLAYER STATS FC';
    ctx.fillText(`🛡️ ${teamName.toUpperCase()} • OFFICIAL ANALYTICS CARD`, W / 2, 785);

    ctx.font = '700 11.5px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('POWERED BY SKILLS ENGINE 2.0', W / 2, 808);
    ctx.restore();

    ctx.restore();
  }

  function showModal(opts = {}) {
    const player = opts.player;
    if (!player) return;

    let currentTheme = 'gold';
    const radar = opts.radar || { pas: 72, tir: 65, reg: 70, fis: 75, def: 60, dis: 80 };
    const ovr = opts.ovr || computeOvr(radar);
    const team = opts.team || null;
    const streak = opts.streak || 0;
    const lang = getLang();

    const existing = document.getElementById('dialog-fut-card-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dialog-fut-card-overlay';
    overlay.className = 'dialog-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(2, 6, 23, 0.92); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 12px; overflow-y: auto;';

    overlay.innerHTML = `
      <div class="dialog-box" style="width: 100%; max-width: 440px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 20px; padding: 20px 16px; text-align: center; max-height: 94vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
        <!-- Encabezado con botón de cerrar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="text-align: left;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 900; color: #fff;">🃏 ${getI18nText('futCardTitle', 'Carta FUT Coleccionable')}</h3>
            <span style="font-size: 11.5px; color: var(--muted);">${getI18nText('futCardSubtitle', 'Ficha oficial verificada')}</span>
          </div>
          <button type="button" class="icon-btn ghost" id="btn-close-fut-modal" style="width: 32px; height: 32px; font-size: 16px;">✕</button>
        </div>

        <!-- Selector de Estilo / Tema -->
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11.5px; font-weight: 800; color: var(--muted); display: block; margin-bottom: 6px; text-transform: uppercase;">
            ${getI18nText('selectTheme', 'Elige el diseño:')}
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;" id="fut-theme-selector">
            <button type="button" class="btn sm" data-theme="gold" style="font-size: 11px; font-weight: 900; padding: 6px 4px; border-radius: 10px; background: rgba(250, 204, 21, 0.15); color: #fde047; border: 2px solid #facc15;">
              🟡 ${THEMES.gold.name[lang] || THEMES.gold.name.es}
            </button>
            <button type="button" class="btn sm ghost" data-theme="totw" style="font-size: 11px; font-weight: 800; padding: 6px 4px; border-radius: 10px; background: rgba(24, 24, 27, 0.8); color: #d4d4d8; border: 1.5px solid #52525b;">
              ⚫ ${THEMES.totw.name[lang] || THEMES.totw.name.es}
            </button>
            <button type="button" class="btn sm ghost" data-theme="cyber" style="font-size: 11px; font-weight: 800; padding: 6px 4px; border-radius: 10px; background: rgba(6, 182, 212, 0.15); color: #67e8f9; border: 1.5px solid #0891b2;">
              💎 ${THEMES.cyber.name[lang] || THEMES.cyber.name.es}
            </button>
          </div>
        </div>

        <!-- Vista Previa de la Carta -->
        <div style="position: relative; margin-bottom: 16px; display: flex; justify-content: center;">
          <canvas id="fut-card-canvas" width="600" height="880" style="display: none;"></canvas>
          <div id="fut-card-loading" style="padding: 40px; color: var(--muted); font-size: 13px;">⏳ ${getI18nText('downloading', 'Generando imagen...')}</div>
          <img id="fut-card-img-preview" alt="FUT Card Preview" style="display: none; width: 100%; max-width: 330px; border-radius: 20px; box-shadow: 0 16px 40px rgba(0,0,0,0.7); cursor: pointer;" title="Toca para guardar" />
        </div>

        <!-- Botones de Acción -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn primary" id="btn-download-fut-png" style="height: 44px; font-weight: 900; font-size: 14px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; box-shadow: 0 4px 18px rgba(37, 99, 235, 0.4);">
            📥 ${getI18nText('downloadCard', 'Descargar Carta (PNG)')}
          </button>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" class="btn sm" id="btn-share-fut-wa" style="height: 38px; font-weight: 800; font-size: 12px; background: #16a34a; color: #fff; border: 1px solid #22c55e;">
              💬 WhatsApp
            </button>
            <button type="button" class="btn sm" id="btn-share-fut-viber" style="height: 38px; font-weight: 800; font-size: 12px; background: #7c3aed; color: #fff; border: 1px solid #c084fc;">
              💜 Viber
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#fut-card-canvas');
    const imgPreview = overlay.querySelector('#fut-card-img-preview');
    const loadEl = overlay.querySelector('#fut-card-loading');
    const closeBtn = overlay.querySelector('#btn-close-fut-modal');
    const downBtn = overlay.querySelector('#btn-download-fut-png');
    const btnWa = overlay.querySelector('#btn-share-fut-wa');
    const btnViber = overlay.querySelector('#btn-share-fut-viber');

    function close() { overlay.remove(); }
    closeBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    let avatarImgObj = null;

    function renderCurrentTheme() {
      drawFutCardCanvas(canvas, {
        player,
        radar,
        ovr,
        team,
        streak,
        _avatarImage: avatarImgObj
      }, currentTheme);

      try {
        const dataUrl = canvas.toDataURL('image/png');
        imgPreview.src = dataUrl;
        imgPreview.style.display = 'block';
        loadEl.style.display = 'none';
      } catch (err) {
        console.warn('Canvas toDataURL fallback:', err);
      }
    }

    // Cargar imagen de avatar si existe
    if (player.photo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        avatarImgObj = img;
        renderCurrentTheme();
      };
      img.onerror = () => {
        avatarImgObj = null;
        renderCurrentTheme();
      };
      img.src = player.photo;
    } else {
      setTimeout(renderCurrentTheme, 50);
    }

    // Conmutador de temas
    overlay.querySelectorAll('#fut-theme-selector button[data-theme]').forEach(btn => {
      btn.onclick = () => {
        const tId = btn.getAttribute('data-theme');
        currentTheme = tId;
        overlay.querySelectorAll('#fut-theme-selector button').forEach(b => {
          const isAct = b.getAttribute('data-theme') === tId;
          b.className = isAct ? 'btn sm' : 'btn sm ghost';
          if (isAct) {
            b.style.borderWidth = '2px';
            b.style.borderColor = THEMES[tId].cardBorder;
          } else {
            b.style.borderWidth = '1.5px';
            b.style.borderColor = 'var(--border)';
          }
        });
        renderCurrentTheme();
      };
    });

    // Descarga PNG
    function triggerDownload() {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `Carta_FUT_${(player.name || 'Player').replace(/\s+/g, '_')}_OVR${ovr}.png`;
        if (window.AndroidBridge && window.AndroidBridge.saveImage) {
          window.AndroidBridge.saveImage(dataUrl, filename);
          if (typeof window.toast === 'function') {
            window.toast('✅ ' + getI18nText('downloadCard', 'Carta guardada en la galería'), 'success');
          }
        } else {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 250);
          if (typeof window.toast === 'function') {
            window.toast('✅ ' + getI18nText('downloadCard', 'Carta descargada con éxito'), 'success');
          }
        }
      } catch (e) {
        console.error('Error downloading FUT Card:', e);
      }
    }

    downBtn.onclick = triggerDownload;
    imgPreview.onclick = triggerDownload;

    // Compartir por WhatsApp
    btnWa.onclick = () => {
      const shareMsg = getI18nText('shareText', '¡Mira mi Carta Oficial de Player Stats con media general de {ovr}!').replace('{ovr}', ovr)
        + `\n⭐ OVR: ${ovr} | PAS ${radar.pas} | TIR ${radar.tir} | REG ${radar.reg} | FIS ${radar.fis} | DEF ${radar.def} | DIS ${radar.dis}`
        + (streak >= 3 ? `\n🔥 Racha de asistencias: ${streak} seguidas!` : '');
      const filename = `Carta_FUT_${(player.name || 'Player').replace(/\s+/g, '_')}_OVR${ovr}.png`;
      if (window.AndroidBridge && window.AndroidBridge.shareImage) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          window.AndroidBridge.shareImage(dataUrl, filename, 'whatsapp', shareMsg);
          return;
        } catch (e) {}
      }
      const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareMsg);
      window.open(url, '_blank');
    };

    // Compartir por Viber
    btnViber.onclick = () => {
      const shareMsg = getI18nText('shareText', '¡Mira mi Carta Oficial de Player Stats con media general de {ovr}!').replace('{ovr}', ovr)
        + `\n⭐ OVR: ${ovr} | PAS ${radar.pas} | TIR ${radar.tir} | REG ${radar.reg} | FIS ${radar.fis} | DEF ${radar.def} | DIS ${radar.dis}`
        + (streak >= 3 ? `\n🔥 Racha de asistencias: ${streak} seguidas!` : '');
      const filename = `Carta_FUT_${(player.name || 'Player').replace(/\s+/g, '_')}_OVR${ovr}.png`;
      if (window.AndroidBridge && window.AndroidBridge.shareImage) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          window.AndroidBridge.shareImage(dataUrl, filename, 'viber', shareMsg);
          return;
        } catch (e) {}
      }
      const url = 'viber://forward?text=' + encodeURIComponent(shareMsg);
      window.open(url, '_blank');
    };
  }

  global.FutCard = {
    showModal,
    computeOvr,
    THEMES
  };

})(typeof window !== 'undefined' ? window : this);

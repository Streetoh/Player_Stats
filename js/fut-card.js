/* =========================================================
   FUT Card Generator (Carta Coleccionable estilo EA FC / FIFA)
   - Renderizado Canvas HD en el cliente (0 coste Firebase)
   - Diseños oficiales EA FC: Black Edition & White Edition + Oro Clásico
   - Insignias oficiales en pie: Bandera de Estonia, EJL y JK Noova
   - Descarga en PNG de alta resolución y compartir en redes
   ========================================================= */
(function (global) {
  'use strict';

  const ASSETS = {
    card_black: 'assets/fut/card_black.png',
    card_white: 'assets/fut/card_white.png',
    flag_estonia: 'assets/fut/flag_estonia.png',
    logo_ejl: 'assets/fut/logo_ejl.png',
    logo_noova: 'assets/fut/logo_noova.png'
  };

  const imageCache = {};
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache[src] && imageCache[src].complete && imageCache[src].naturalWidth > 0) {
      return Promise.resolve(imageCache[src]);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache[src] = img;
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = src;
    });
  }

  const THEMES = {
    black: {
      id: 'black',
      name: { es: 'Black Edition (EA FC)', en: 'Black Edition (EA FC)', ee: 'Must EA FC' },
      bgAsset: ASSETS.card_black,
      cardBorder: '#facc15',
      glow: 'rgba(250, 204, 21, 0.45)',
      numColor: '#ffffff',
      posColor: '#facc15',
      nameColor: '#ffffff',
      statLabelColor: '#94a3b8',
      statValColor: '#ffffff',
      avatarBorder: '#facc15'
    },
    white: {
      id: 'white',
      name: { es: 'White Edition (EA FC)', en: 'White Edition (EA FC)', ee: 'Valge EA FC' },
      bgAsset: ASSETS.card_white,
      cardBorder: '#0284c7',
      glow: 'rgba(2, 132, 199, 0.45)',
      numColor: '#0f172a',
      posColor: '#0284c7',
      nameColor: '#0f172a',
      statLabelColor: '#64748b',
      statValColor: '#0f172a',
      avatarBorder: '#0284c7'
    },
    gold: {
      id: 'gold',
      name: { es: 'Oro Clásico', en: 'Gold Classic', ee: 'Kuldne Klassika' },
      bgAsset: null,
      bgGrad: ['#3b2d13', '#61481c', '#9e7930', '#fef08a', '#9e7930', '#3b2d13'],
      cardBorder: '#facc15',
      glow: 'rgba(250, 204, 21, 0.45)',
      numColor: '#fef08a',
      posColor: '#ffffff',
      nameColor: '#ffffff',
      statLabelColor: '#cbd5e1',
      statValColor: '#fef08a',
      avatarBorder: '#eab308'
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
    const theme = THEMES[themeId] || THEMES.black;

    // Badges compartidos de pie de carta
    const flagImg = imageCache[ASSETS.flag_estonia];
    const ejlImg = imageCache[ASSETS.logo_ejl];
    const noovaImg = imageCache[ASSETS.logo_noova];

    // =========================================================
    // DISEÑO EA FC (BLACK / WHITE) CON PLANTILLA HD
    // =========================================================
    if (themeId === 'black' || themeId === 'white') {
      const W = 475;
      const H = 677;
      canvas.width = W;
      canvas.height = H;
      ctx.clearRect(0, 0, W, H);

      const bgImg = imageCache[theme.bgAsset];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, W, H);
      } else {
        // Fallback gradiente si la imagen aún no está disponible
        ctx.fillStyle = (themeId === 'black' ? '#09090b' : '#f8fafc');
        ctx.fillRect(0, 0, W, H);
      }

      const ovr = data.ovr || computeOvr(data.radar);
      const pos = (data.player && data.player.mainPosition) ? data.player.mainPosition.toUpperCase() : 'MC';

      // 1. OVR (Media General)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 68px "Arial Black", Impact, sans-serif';
      ctx.fillStyle = theme.numColor;
      ctx.shadowColor = (themeId === 'black' ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.15)');
      ctx.shadowBlur = 8;
      ctx.fillText(String(ovr), 100, 115);
      ctx.restore();

      // 2. Posición Oficial
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 28px "Arial Black", sans-serif';
      ctx.fillStyle = theme.posColor;
      ctx.fillText(pos, 100, 155);
      ctx.restore();

      // 3. Foto o Avatar del Jugador (Círculo con marco premium)
      const avatarX = 295;
      const avatarY = 250;
      const avatarR = 95;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.clip();

      if (data._avatarImage && data._avatarImage.complete && data._avatarImage.naturalWidth > 0) {
        ctx.drawImage(data._avatarImage, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      } else {
        ctx.fillStyle = (themeId === 'black' ? '#18181b' : '#e2e8f0');
        ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);

        const initial = ((data.player && data.player.name) ? data.player.name[0] : 'P').toUpperCase();
        ctx.font = '900 84px sans-serif';
        ctx.fillStyle = (themeId === 'black' ? '#facc15' : '#0284c7');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, avatarX, avatarY);
      }
      ctx.restore();

      // Borde circular alrededor del avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = theme.avatarBorder;
      ctx.stroke();
      ctx.restore();

      // 4. Nombre del Jugador
      const fullName = (data.player ? `${data.player.name || ''} ${data.player.lastName || ''}` : 'PLAYER').trim();
      const displayName = fullName.length > 18 ? (data.player.name ? data.player.name[0] + '. ' + (data.player.lastName || data.player.name) : fullName) : fullName;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let nameFontSize = 32;
      if (displayName.length > 14) nameFontSize = 26;
      if (displayName.length > 20) nameFontSize = 22;
      ctx.font = `900 ${nameFontSize}px "Arial Black", sans-serif`;
      ctx.fillStyle = theme.nameColor;
      ctx.shadowColor = (themeId === 'black' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.7)');
      ctx.shadowBlur = 6;
      ctx.fillText(displayName.toUpperCase(), 237, 498);
      ctx.restore();

      // 5. Atributos (6 Stats en barra horizontal EA FC)
      const r = data.radar || { pas: 70, tir: 70, reg: 70, fis: 70, def: 70, dis: 70 };
      const statsList = [
        { label: getI18nText('statTir', 'TIR'), val: r.tir },
        { label: getI18nText('statPas', 'PAS'), val: r.pas },
        { label: getI18nText('statReg', 'REG'), val: r.reg },
        { label: getI18nText('statDef', 'DEF'), val: r.def },
        { label: getI18nText('statFis', 'FIS'), val: r.fis },
        { label: getI18nText('statDis', 'DIS'), val: r.dis }
      ];

      const xCols = [73, 138, 206, 275, 340, 405];
      statsList.forEach((st, idx) => {
        const cx = xCols[idx];

        // Etiqueta (TIR, PAS, etc.)
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '800 15px sans-serif';
        ctx.fillStyle = theme.statLabelColor;
        ctx.fillText(st.label, cx, 549);

        // Valor numérico
        ctx.font = '900 25px "Arial Black", sans-serif';
        ctx.fillStyle = theme.statValColor;
        ctx.fillText(String(Math.round(st.val)), cx, 594);
        ctx.restore();
      });

      // 6. Pie de Carta: 3 Insignias (Bandera Estonia, Logo EJL, Logo JK Noova)
      // Sin texto inferior como solicitó el usuario
      const badgeY = 638;

      // Bandera de Estonia
      if (flagImg && flagImg.complete && flagImg.naturalWidth > 0) {
        ctx.drawImage(flagImg, 175 - 18, badgeY - 12, 36, 24);
      } else {
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🇪🇪', 175, badgeY);
      }

      // Logo EJL
      if (ejlImg && ejlImg.complete && ejlImg.naturalWidth > 0) {
        ctx.drawImage(ejlImg, 240 - 14, badgeY - 14, 28, 28);
      } else {
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚽', 240, badgeY);
      }

      // Logo JK Noova
      if (noovaImg && noovaImg.complete && noovaImg.naturalWidth > 0) {
        ctx.drawImage(noovaImg, 305 - 15, badgeY - 15, 30, 30);
      } else {
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 305, badgeY);
      }

      return;
    }

    // =========================================================
    // DISEÑO ORO CLÁSICO (VECTORIAL) CON LAS 3 INSIGNIAS
    // =========================================================
    const W = 600;
    const H = 880;
    canvas.width = W;
    canvas.height = H;

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

    // Sombra
    ctx.save();
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    makeCardPath(12);
    ctx.fillStyle = '#060a13';
    ctx.fill();
    ctx.restore();

    // Borde exterior
    ctx.save();
    makeCardPath(12);
    ctx.clip();
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    theme.bgGrad.forEach((col, idx) => {
      borderGrad.addColorStop(idx / (theme.bgGrad.length - 1), col);
    });
    ctx.fillStyle = borderGrad;
    ctx.fill();

    // Fondo interior
    ctx.beginPath();
    makeCardPath(20);
    ctx.clip();
    const bgInner = ctx.createLinearGradient(0, 0, 0, H);
    bgInner.addColorStop(0, '#2b210a');
    bgInner.addColorStop(0.35, '#453511');
    bgInner.addColorStop(0.7, '#241a06');
    bgInner.addColorStop(1, '#120d03');
    ctx.fillStyle = bgInner;
    ctx.fill();

    // Rayos sutiles
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.08)';
    ctx.lineWidth = 1.5;
    for (let i = -W; i < W * 2; i += 38) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H * 0.6, H);
      ctx.stroke();
    }

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

    // Logo del Club en panel lateral (reemplazando emoji del escudo por logo oficial)
    if (noovaImg && noovaImg.complete && noovaImg.naturalWidth > 0) {
      ctx.drawImage(noovaImg, 110 - 20, 240, 40, 40);
    } else {
      ctx.font = '36px sans-serif';
      ctx.fillText('🛡️', 110, 270);
    }

    // Avatar
    const avatarX = 360;
    const avatarY = 200;
    const avatarR = 115;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();
    if (data._avatarImage) {
      ctx.drawImage(data._avatarImage, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    } else {
      ctx.fillStyle = '#785718';
      ctx.fill();
      const initial = ((data.player && data.player.name) ? data.player.name[0] : 'P').toUpperCase();
      ctx.font = '900 100px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, avatarX, avatarY);
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = theme.cardBorder;
    ctx.stroke();
    ctx.restore();

    // Nombre
    const nameY = 385;
    const fullName = (data.player ? `${data.player.name || ''} ${data.player.lastName || ''}` : 'PLAYER').trim();
    const displayName = fullName.length > 20 ? (data.player.name ? data.player.name[0] + '. ' + (data.player.lastName || data.player.name) : fullName) : fullName;

    ctx.save();
    const ribbonGrad = ctx.createLinearGradient(60, nameY, W - 60, nameY);
    ribbonGrad.addColorStop(0, 'rgba(0,0,0,0)');
    ribbonGrad.addColorStop(0.2, 'rgba(250, 204, 21, 0.2)');
    ribbonGrad.addColorStop(0.8, 'rgba(250, 204, 21, 0.2)');
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
    ctx.fillText(displayName.toUpperCase(), W / 2, nameY - 5);
    ctx.restore();

    // Atributos 6 Stats en dos columnas
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

    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, statsY - 30);
    ctx.lineTo(W / 2, statsY + 160);
    ctx.stroke();
    ctx.restore();

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

    // Insignias en el pie de la carta (Bandera Estonia, Logo EJL, Logo JK Noova)
    // Sin texto inferior innecesario
    const goldBadgeY = 740;
    if (flagImg && flagImg.complete && flagImg.naturalWidth > 0) {
      ctx.drawImage(flagImg, 210 - 22, goldBadgeY - 15, 44, 30);
    } else {
      ctx.font = '28px sans-serif';
      ctx.fillText('🇪🇪', 210, goldBadgeY);
    }

    if (ejlImg && ejlImg.complete && ejlImg.naturalWidth > 0) {
      ctx.drawImage(ejlImg, 300 - 18, goldBadgeY - 18, 36, 36);
    } else {
      ctx.font = '26px sans-serif';
      ctx.fillText('⚽', 300, goldBadgeY);
    }

    if (noovaImg && noovaImg.complete && noovaImg.naturalWidth > 0) {
      ctx.drawImage(noovaImg, 390 - 20, goldBadgeY - 20, 40, 40);
    } else {
      ctx.font = '26px sans-serif';
      ctx.fillText('🛡️', 390, goldBadgeY);
    }

    ctx.restore();
  }

  async function showModal(opts = {}) {
    const player = opts.player;
    if (!player) return;

    let currentTheme = 'black';
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
            <button type="button" class="btn sm" data-theme="black" style="font-size: 11px; font-weight: 900; padding: 6px 4px; border-radius: 10px; background: rgba(24, 24, 27, 0.8); color: #facc15; border: 2px solid #facc15;">
              ⚫ Black
            </button>
            <button type="button" class="btn sm ghost" data-theme="white" style="font-size: 11px; font-weight: 800; padding: 6px 4px; border-radius: 10px; background: rgba(248, 250, 252, 0.12); color: #38bdf8; border: 1.5px solid var(--border);">
              ⚪ White
            </button>
            <button type="button" class="btn sm ghost" data-theme="gold" style="font-size: 11px; font-weight: 800; padding: 6px 4px; border-radius: 10px; background: rgba(250, 204, 21, 0.12); color: #fde047; border: 1.5px solid var(--border);">
              🟡 Gold
            </button>
          </div>
        </div>

        <!-- Vista Previa de la Carta -->
        <div style="position: relative; margin-bottom: 16px; display: flex; justify-content: center;">
          <canvas id="fut-card-canvas" width="475" height="677" style="display: none;"></canvas>
          <div id="fut-card-loading" style="padding: 40px; color: var(--muted); font-size: 13px;">⏳ ${getI18nText('downloading', 'Generando imagen...')}</div>
          <img id="fut-card-img-preview" alt="FUT Card Preview" style="display: none; width: 100%; max-width: 320px; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.7); cursor: pointer;" title="Toca para guardar" />
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

    // Pre-cargar assets base en paralelo
    const assetPromises = [
      loadImage(ASSETS.card_black),
      loadImage(ASSETS.card_white),
      loadImage(ASSETS.flag_estonia),
      loadImage(ASSETS.logo_ejl),
      loadImage(ASSETS.logo_noova)
    ];

    if (player.photo) {
      assetPromises.push(loadImage(player.photo).then(img => { avatarImgObj = img; return img; }));
    }

    Promise.all(assetPromises).then(() => {
      renderCurrentTheme();
    }).catch(() => {
      renderCurrentTheme();
    });

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

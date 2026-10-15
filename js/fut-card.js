/* =========================================================
   FUT Card Generator (Carta Coleccionable estilo EA FC / FIFA)
   - Renderizado Canvas HD Procedural Vectorial (Mismo estilo Gold)
   - Diseños Vectoriales: Oro Clásico, TOTW Black & Diamante Cyan
   - Cifras centrales y logos ampliados para ocupar armónicamente el espacio
   - Insignias oficiales en pie: Bandera de Estonia, EJL y JK Noova
   - Descarga en PNG de alta resolución (600x880) y compartir en redes
   ========================================================= */
(function (global) {
  'use strict';

  const ASSETS = {
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
    gold: {
      id: 'gold',
      name: { es: 'Oro Clásico', en: 'Gold Classic', ee: 'Kuldne Klassika', et: 'Kuldne Klassika', ru: 'Классическое золото' },
      bgGrad: ['#3b2d13', '#61481c', '#9e7930', '#fef08a', '#9e7930', '#3b2d13'],
      innerGrad: ['#2b210a', '#453511', '#241a06', '#120d03'],
      cardBorder: '#facc15',
      glow: 'rgba(250, 204, 21, 0.45)',
      numColor: '#fef08a',
      posColor: '#ffffff',
      nameColor: '#ffffff',
      statLabelColor: '#cbd5e1',
      statValColor: '#fef08a',
      avatarBorder: '#eab308',
      dividerColor: 'rgba(250, 204, 21, 0.45)',
      rayColor: 'rgba(250, 204, 21, 0.08)'
    },
    black: {
      id: 'black',
      name: { es: 'TOTW / Black', en: 'TOTW / Black', ee: 'Must TOTW', et: 'Must TOTW', ru: 'Черный TOTW' },
      bgGrad: ['#18181b', '#27272a', '#52525b', '#facc15', '#27272a', '#09090b'],
      innerGrad: ['#18181b', '#0f172a', '#09090b', '#000000'],
      cardBorder: '#facc15',
      glow: 'rgba(250, 204, 21, 0.45)',
      numColor: '#facc15',
      posColor: '#ffffff',
      nameColor: '#ffffff',
      statLabelColor: '#94a3b8',
      statValColor: '#ffffff',
      avatarBorder: '#facc15',
      dividerColor: 'rgba(250, 204, 21, 0.4)',
      rayColor: 'rgba(250, 204, 21, 0.06)'
    },
    diamond: {
      id: 'diamond',
      name: { es: 'Diamante Cyan', en: 'Diamond Cyan', ee: 'Teemant Tsüaan', et: 'Teemant Tsüaan', ru: 'Алмазный циан' },
      bgGrad: ['#082f49', '#0369a1', '#38bdf8', '#e0f2fe', '#0284c7', '#082f49'],
      innerGrad: ['#0c4a6e', '#075985', '#082f49', '#020617'],
      cardBorder: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.45)',
      numColor: '#38bdf8',
      posColor: '#ffffff',
      nameColor: '#ffffff',
      statLabelColor: '#93c5fd',
      statValColor: '#ffffff',
      avatarBorder: '#38bdf8',
      dividerColor: 'rgba(56, 189, 248, 0.45)',
      rayColor: 'rgba(56, 189, 248, 0.08)'
    }
  };

  function getLang() {
    if (typeof window !== 'undefined') {
      const l = window.currentLang || (window.Store && window.Store.state && window.Store.state.settings && window.Store.state.settings.lang) || localStorage.getItem('lang') || 'es';
      return (l === 'ee' ? 'et' : l);
    }
    return 'es';
  }

  function getI18nText(key, fallback) {
    let lang = getLang();
    if (lang === 'ee') lang = 'et';
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
        themeGold: '🟡 Oro Clásico',
        themeBlack: '⚫ TOTW Black',
        themeDiamond: '🔷 Diamante Cyan',
        statPas: 'PAS', statTir: 'TIR', statReg: 'REG', statFis: 'FIS', statDef: 'DEF', statDis: 'DIS',
        streakWhatsApp: '\n🔥 Racha de asistencias: {streak} seguidas!'
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
        themeGold: '🟡 Gold Classic',
        themeBlack: '⚫ TOTW Black',
        themeDiamond: '🔷 Diamond Cyan',
        statPas: 'PAS', statTir: 'SHO', statReg: 'DRI', statFis: 'PHY', statDef: 'DEF', statDis: 'DIS',
        streakWhatsApp: '\n🔥 Attendance streak: {streak} in a row!'
      },
      et: {
        futCardTitle: 'Kogutav FUT Kaart',
        futCardSubtitle: 'Ametlik kinnitatud kaart sinu reaalsete oskustega',
        downloadCard: 'Laadi alla kaart (PNG)',
        downloading: 'Pildi loomine...',
        shareWhatsApp: 'Jaga WhatsAppis',
        shareViber: 'Jaga Viberis',
        shareText: 'Vaata minu ametlikku Player Stats kaarti üldhinnanguga {ovr}!',
        close: 'Sulge',
        selectTheme: 'Vali kaardi stiil:',
        themeGold: '🟡 Kuldne Klassika',
        themeBlack: '⚫ Must TOTW',
        themeDiamond: '🔷 Teemant Tsüaan',
        statPas: 'SÖÖ', statTir: 'LÖÖ', statReg: 'TRI', statFis: 'FÜÜ', statDef: 'KAI', statDis: 'DIS',
        streakWhatsApp: '\n🔥 Osalemise seeria: {streak} järjest!'
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
        themeGold: '🟡 Kuldne Klassika',
        themeBlack: '⚫ Must TOTW',
        themeDiamond: '🔷 Teemant Tsüaan',
        statPas: 'SÖÖ', statTir: 'LÖÖ', statReg: 'TRI', statFis: 'FÜÜ', statDef: 'KAI', statDis: 'DIS',
        streakWhatsApp: '\n🔥 Osalemise seeria: {streak} järjest!'
      },
      ru: {
        futCardTitle: 'Коллекционная карточка FUT',
        futCardSubtitle: 'Официальная карточка с твоими реальными показателями',
        downloadCard: 'Скачать карточку (PNG)',
        downloading: 'Создание изображения...',
        shareWhatsApp: 'Поделиться в WhatsApp',
        shareViber: 'Поделиться в Viber',
        shareText: 'Посмотри мою официальную карточку Player Stats с общим рейтингом {ovr}!',
        close: 'Закрыть',
        selectTheme: 'Выбери дизайн карточки:',
        themeGold: '🟡 Классическое золото',
        themeBlack: '⚫ Черный TOTW',
        themeDiamond: '🔷 Алмазный циан',
        statPas: 'ПАС', statTir: 'УДР', statReg: 'ДРБ', statFis: 'ФИЗ', statDef: 'ЗАЩ', statDis: 'ДИС',
        streakWhatsApp: '\n🔥 Серия посещаемости: {streak} подряд!'
      }
    };
    return (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || fallback || key;
  }

  function getPositionCategory(pos) {
    if (!pos) return 'MED';
    const p = String(pos).toUpperCase().trim();
    if (p.includes('POR') || p.includes('GK') || p.includes('VÄRAVA') || p.includes('ВРАТАР')) return 'POR';
    if (p.includes('MED') || p.includes('MC') || p.includes('MID') || p.includes('CENTRO') || p.includes('POOL') || p.includes('ПОЛУЗАЩ')) return 'MED';
    if (p.includes('DFC') || p.includes('DEF') || p.includes('CB') || p.includes('LD') || p.includes('LI') || p.includes('RB') || p.includes('LB') || p.includes('LTD') || p.includes('LTI') || p.includes('KAITS') || p.includes('ЗАЩИТ')) return 'DEF';
    if (p.includes('DC') || p.includes('DEL') || p.includes('ST') || p.includes('EXT') || p.includes('ED') || p.includes('EI') || p.includes('RW') || p.includes('LW') || p.includes('FW') || p.includes('RÜND') || p.includes('НАПАД')) return 'DEL';
    return 'MED';
  }

  function computeOvr(radar, position) {
    if (!radar) return 75;
    const p = Number(radar.pas) || 50;
    const t = Number(radar.tir) || 50;
    const r = Number(radar.reg) || 50;
    const f = Number(radar.fis) || 50;
    const d = Number(radar.def) || 50;
    const dis = Number(radar.dis) || 50;

    const cat = getPositionCategory(position);
    let avg = 0;
    if (cat === 'DEF') {
      // Defensa: PAS 15%, TIR 5%, REG 10%, DEF 35%, FIS 20%, DIS 15%
      avg = p * 0.15 + t * 0.05 + r * 0.10 + d * 0.35 + f * 0.20 + dis * 0.15;
    } else if (cat === 'DEL') {
      // Delantero: PAS 15%, TIR 35%, REG 25%, DEF 5%, FIS 5%, DIS 15%
      avg = p * 0.15 + t * 0.35 + r * 0.25 + d * 0.05 + f * 0.05 + dis * 0.15;
    } else if (cat === 'POR') {
      // Portero: PAS 15%, Paradas/TIR 40%, Reflejos/REG 15%, DEF 15%, FIS 0%, DIS 15%
      avg = p * 0.15 + t * 0.40 + r * 0.15 + d * 0.15 + f * 0.00 + dis * 0.15;
    } else {
      // Mediocentro: PAS 30%, TIR 10%, REG 20%, DEF 15%, FIS 10%, DIS 15%
      avg = p * 0.30 + t * 0.10 + r * 0.20 + d * 0.15 + f * 0.10 + dis * 0.15;
    }
    return Math.min(99, Math.max(50, Math.round(avg)));
  }

  function drawFutCardCanvas(canvas, data, themeId) {
    const ctx = canvas.getContext('2d');
    const theme = THEMES[themeId] || THEMES.gold;

    // Badges compartidos de pie de carta y escudo del club
    const flagImg = imageCache[ASSETS.flag_estonia];
    const ejlImg = imageCache[ASSETS.logo_ejl];
    const noovaImg = imageCache[ASSETS.logo_noova];

    // Dimensiones HD de carta tipo escudo FIFA
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
      const r = 30;

      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h * 0.77);
      ctx.lineTo(x + w * 0.5, y + h);
      ctx.lineTo(x, y + h * 0.77);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    ctx.clearRect(0, 0, W, H);

    // Sombra exterior
    ctx.save();
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 36;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;
    makeCardPath(12);
    ctx.fillStyle = '#060a13';
    ctx.fill();
    ctx.restore();

    // Borde exterior degradado
    ctx.save();
    makeCardPath(12);
    ctx.clip();
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    theme.bgGrad.forEach((col, idx) => {
      borderGrad.addColorStop(idx / (theme.bgGrad.length - 1), col);
    });
    ctx.fillStyle = borderGrad;
    ctx.fill();

    // Fondo interior degradado
    ctx.beginPath();
    makeCardPath(20);
    ctx.clip();
    const bgInner = ctx.createLinearGradient(0, 0, 0, H);
    const inGrad = theme.innerGrad || ['#2b210a', '#453511', '#241a06', '#120d03'];
    inGrad.forEach((col, idx) => {
      bgInner.addColorStop(idx / (inGrad.length - 1), col);
    });
    ctx.fillStyle = bgInner;
    ctx.fill();

    // Rayos sutiles de fondo
    ctx.strokeStyle = theme.rayColor || 'rgba(250, 204, 21, 0.08)';
    ctx.lineWidth = 1.5;
    for (let i = -W; i < W * 2; i += 38) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H * 0.6, H);
      ctx.stroke();
    }

    const playerPos = data.position || (data.player && data.player.mainPosition) || 'MC';
    const ovr = data.ovr || computeOvr(data.radar, playerPos);
    const pos = playerPos.toUpperCase();
    const dorsal = (data.player && data.player.mainDorsal != null) ? '#' + data.player.mainDorsal : '';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // 1. OVR (Media General en esquina superior izquierda)
    ctx.font = '900 74px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = theme.numColor;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillText(String(ovr), 110, 140);

    // 2. Posición Oficial
    ctx.font = '900 30px "Arial Black", sans-serif';
    ctx.fillStyle = theme.posColor;
    ctx.fillText(pos, 110, 184);

    // 3. Dorsal
    if (dorsal) {
      ctx.font = '800 20px sans-serif';
      ctx.fillStyle = theme.cardBorder;
      ctx.fillText(dorsal, 110, 216);
    }

    // 4. Escudo del Club en panel lateral izquierdo (AMPLIADO a 86x86)
    const crestY = 270;
    if (noovaImg && noovaImg.complete && noovaImg.naturalWidth > 0) {
      ctx.drawImage(noovaImg, 110 - 43, crestY - 43, 86, 86);
    } else {
      ctx.font = '54px sans-serif';
      ctx.fillText('🛡️', 110, crestY + 18);
    }

    // 5. Avatar / Foto del Jugador (Círculo en panel derecho)
    const avatarX = 360;
    const avatarY = 200;
    const avatarR = 115;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();
    if (data._avatarImage && data._avatarImage.complete && data._avatarImage.naturalWidth > 0) {
      ctx.drawImage(data._avatarImage, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    } else {
      ctx.fillStyle = (themeId === 'black' ? '#27272a' : (themeId === 'diamond' ? '#0369a1' : '#785718'));
      ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      const initial = ((data.player && data.player.name) ? data.player.name[0] : 'P').toUpperCase();
      ctx.font = '900 100px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, avatarX, avatarY);
    }
    ctx.restore();

    // Marco exterior del avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = theme.avatarBorder;
    ctx.stroke();
    ctx.restore();

    // 6. Nombre del Jugador en cinta transversal
    const nameY = 385;
    const fullName = (data.player ? `${data.player.name || ''} ${data.player.lastName || ''}` : 'PLAYER').trim();
    const displayName = fullName.length > 20 ? (data.player.name ? data.player.name[0] + '. ' + (data.player.lastName || data.player.name) : fullName) : fullName;

    ctx.save();
    const ribbonGrad = ctx.createLinearGradient(60, nameY, W - 60, nameY);
    ribbonGrad.addColorStop(0, 'rgba(0,0,0,0)');
    ribbonGrad.addColorStop(0.2, (themeId === 'diamond' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(250, 204, 21, 0.25)'));
    ribbonGrad.addColorStop(0.8, (themeId === 'diamond' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(250, 204, 21, 0.25)'));
    ribbonGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ribbonGrad;
    ctx.fillRect(40, nameY - 32, W - 80, 54);

    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(65, nameY + 22);
    ctx.lineTo(W - 65, nameY + 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px "Arial Black", sans-serif';
    ctx.fillStyle = theme.nameColor;
    ctx.fillText(displayName.toUpperCase(), W / 2, nameY - 5);
    ctx.restore();

    // 7. Atributos: 5 Stats oficiales (Sin Disciplina, cifras ampliadas y bien distribuidas)
    const statsY = 462;
    const r = data.radar || { pas: 70, tir: 70, reg: 70, fis: 70, def: 70 };
    const rowStep = 78;

    // Fila 0: PAS | DEF
    // Fila 1: TIR | FIS
    // Fila 2: REG (centrado)
    const rowStats = [
      { left: { label: getI18nText('statPas', 'PAS'), val: r.pas }, right: { label: getI18nText('statDef', 'DEF'), val: r.def } },
      { left: { label: getI18nText('statTir', 'TIR'), val: r.tir }, right: { label: getI18nText('statFis', 'FIS'), val: r.fis } }
    ];

    // Línea divisoria central sólo entre filas 0 y 1
    ctx.save();
    ctx.strokeStyle = theme.dividerColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(W / 2, statsY - 26);
    ctx.lineTo(W / 2, statsY + rowStep + 18);
    ctx.stroke();
    ctx.restore();

    // Renderizar Filas 0 y 1 con cifras más grandes
    rowStats.forEach((row, idx) => {
      const y = statsY + idx * rowStep;

      // Izquierda (separado de la línea central divisoria en W/2)
      ctx.textAlign = 'right';
      ctx.font = '900 52px "Arial Black", Impact, sans-serif';
      ctx.fillStyle = theme.statValColor;
      ctx.fillText(String(Math.round(row.left.val)), W / 2 - 108, y);

      ctx.textAlign = 'left';
      ctx.font = '900 28px sans-serif';
      ctx.fillStyle = theme.statLabelColor;
      ctx.fillText(row.left.label, W / 2 - 95, y - 4);

      // Derecha
      ctx.textAlign = 'right';
      ctx.font = '900 52px "Arial Black", Impact, sans-serif';
      ctx.fillStyle = theme.statValColor;
      ctx.fillText(String(Math.round(row.right.val)), W / 2 + 95, y);

      ctx.textAlign = 'left';
      ctx.font = '900 28px sans-serif';
      ctx.fillStyle = theme.statLabelColor;
      ctx.fillText(row.right.label, W / 2 + 108, y - 4);
    });

    // Fila 2: REG (Dribbling) Centrado armónicamente para completar la tarjeta
    const yReg = statsY + 2 * rowStep;
    ctx.textAlign = 'right';
    ctx.font = '900 52px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = theme.statValColor;
    ctx.fillText(String(Math.round(r.reg)), W / 2 - 8, yReg);

    ctx.textAlign = 'left';
    ctx.font = '900 28px sans-serif';
    ctx.fillStyle = theme.statLabelColor;
    ctx.fillText(getI18nText('statReg', 'REG'), W / 2 + 6, yReg - 4);

    // 7.5 Contador de MVPs Oficiales: ⭐ x{mvpCount}
    const mvpCount = (data.player && data.player.mvpCount != null) ? data.player.mvpCount : (data.mvpCount || 0);
    const mvpY = 665;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pillW = 124;
    const pillH = 32;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.strokeStyle = themeId === 'diamond' ? '#38bdf8' : (themeId === 'black' ? '#facc15' : '#eab308');
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(W / 2 - pillW / 2, mvpY - pillH / 2, pillW, pillH, 16);
    } else {
      ctx.rect(W / 2 - pillW / 2, mvpY - pillH / 2, pillW, pillH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 19px "Arial Black", sans-serif';
    ctx.fillStyle = themeId === 'diamond' ? '#38bdf8' : '#fef08a';
    ctx.fillText(`⭐ x${mvpCount}`, W / 2, mvpY + 1);
    ctx.restore();

    // 8. Insignias en el pie de la carta (Bandera Estonia, Logo EJL, Logo JK Noova) - Ajustado en Y para no rozar borde
    const badgeY = 724;

    // Bandera de Estonia (ampliada a 74x48)
    if (flagImg && flagImg.complete && flagImg.naturalWidth > 0) {
      ctx.drawImage(flagImg, W / 2 - 105 - 37, badgeY - 24, 74, 48);
    } else {
      ctx.font = '38px sans-serif';
      ctx.fillText('🇪🇪', W / 2 - 105, badgeY + 14);
    }

    // Logo EJL (ampliado a 64x64)
    if (ejlImg && ejlImg.complete && ejlImg.naturalWidth > 0) {
      ctx.drawImage(ejlImg, W / 2 - 32, badgeY - 32, 64, 64);
    } else {
      ctx.font = '36px sans-serif';
      ctx.fillText('⚽', W / 2, badgeY + 14);
    }

    // Logo JK Noova (ampliado a 68x68)
    if (noovaImg && noovaImg.complete && noovaImg.naturalWidth > 0) {
      ctx.drawImage(noovaImg, W / 2 + 105 - 34, badgeY - 34, 68, 68);
    } else {
      ctx.font = '36px sans-serif';
      ctx.fillText('🛡️', W / 2 + 105, badgeY + 14);
    }

    ctx.restore();
  }

  async function showModal(opts = {}) {
    const player = opts.player;
    if (!player) return;

    let currentTheme = 'gold';
    const radar = opts.radar || (player && (player.skills || player.radar)) || { pas: 70, tir: 70, reg: 70, def: 70, fis: 70, dis: 75 };
    const playerPos = opts.position || (player && player.mainPosition) || 'MC';
    const ovr = opts.ovr || computeOvr(radar, playerPos);
    const team = opts.team || null;
    const streak = opts.streak || 0;
    const mvpCount = opts.mvpCount != null ? opts.mvpCount : ((player && player.mvpCount != null) ? player.mvpCount : 0);
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
              ${getI18nText('themeGold', '🟡 Oro Clásico')}
            </button>
            <button type="button" class="btn sm ghost" data-theme="black" style="font-size: 11px; font-weight: 800; padding: 6px 4px; border-radius: 10px; background: rgba(24, 24, 27, 0.8); color: #facc15; border: 1.5px solid var(--border);">
              ${getI18nText('themeBlack', '⚫ Black')}
            </button>
            <button type="button" class="btn sm ghost" data-theme="diamond" style="font-size: 11px; font-weight: 800; padding: 6px 4px; border-radius: 10px; background: rgba(3, 105, 161, 0.2); color: #38bdf8; border: 1.5px solid var(--border);">
              ${getI18nText('themeDiamond', '🔷 Diamante')}
            </button>
          </div>
        </div>

        <!-- Vista Previa de la Carta -->
        <div style="position: relative; margin-bottom: 16px; display: flex; justify-content: center;">
          <canvas id="fut-card-canvas" width="600" height="880" style="display: none;"></canvas>
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
        mvpCount,
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

    // Pre-cargar badges en paralelo
    const assetPromises = [
      loadImage(ASSETS.flag_estonia),
      loadImage(ASSETS.logo_ejl),
      loadImage(ASSETS.logo_noova)
    ];

    if (player.photo) {
      assetPromises.push(loadImage(player.photo).then(img => { avatarImgObj = img; return img; }));
    } else if (player.photoHash && typeof window !== 'undefined' && window.CacheDB && window.CacheDB.getPhoto) {
      assetPromises.push(window.CacheDB.getPhoto(player.id).then(cached => {
        if (cached && cached.dataUrl) {
          player.photo = cached.dataUrl;
          return loadImage(player.photo).then(img => { avatarImgObj = img; return img; });
        }
        return null;
      }).catch(() => null));
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
        + (streak >= 3 ? getI18nText('streakWhatsApp', '\n🔥 Racha de asistencias: {streak} seguidas!').replace('{streak}', streak) : '');
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
        + (streak >= 3 ? getI18nText('streakWhatsApp', '\n🔥 Racha de asistencias: {streak} seguidas!').replace('{streak}', streak) : '');
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
    drawFutCardCanvas,
    draw: drawFutCardCanvas,
    THEMES
  };

})(typeof window !== 'undefined' ? window : this);

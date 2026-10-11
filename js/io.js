/* =========================================================
   Importación / Exportación y Fusión Inteligente
   - JSON completo / Copia de seguridad
   - Exportación de jugador individual en JSON
   - Fusión inteligente por nombre coincidente (cero duplicados)
   - CSV / TXT / listas
   ========================================================= */
(function () {
  'use strict';

  const POS_CODES = ['POR', 'DFC', 'LD', 'LI', 'MCD', 'MC', 'MCO', 'ED', 'EI', 'DC', 'JUGADOR'];

  function norm(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readFileText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ''));
      r.onerror = () => rej(r.error);
      r.readAsText(file, 'utf-8');
    });
  }

  function readFileDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ''));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  function shrinkPhoto(dataUrl, size) {
    size = size || 192;
    return new Promise(resolve => {
      if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return resolve('');
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = size;
          const ctx = c.getContext('2d');
          const s = Math.min(img.width, img.height);
          const sx = (img.width - s) / 2, sy = (img.height - s) / 2.6;
          ctx.drawImage(img, sx, Math.max(0, sy), s, s, 0, 0, size, size);
          resolve(c.toDataURL('image/jpeg', 0.8));
        } catch (e) { resolve(''); }
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  }

  function mapPlayer(src) {
    const dorsal = parseInt(src.mainDorsal != null ? src.mainDorsal : (src.dorsal != null ? src.dorsal : src.number), 10);
    const sec = parseInt(src.secondaryDorsal, 10);
    return {
      id: src.id || null,
      name: String(src.name || src.nombre || src.firstName || '').trim(),
      lastName: String(src.lastName || src.apellido || src.apellidos || src.surname || '').trim(),
      nickname: String(src.nickname || src.apodo || '').trim(),
      birthDate: src.birthDate || src.nacimiento || '',
      teamId: src.teamId || '',
      mainDorsal: isNaN(dorsal) ? null : dorsal,
      secondaryDorsal: isNaN(sec) ? null : sec,
      foot: src.foot || src.pie || 'Diestro',
      mainPosition: src.mainPosition || src.position || src.posicion || 'Jugador',
      secondaryPosition: src.secondaryPosition || '',
      photo: src.photo || ''
    };
  }

  /* Fusión inteligente: si el nombre coincide, se vincula y no se duplica */
  async function mergeDataset(data) {
    const st = Store.state;
    let playersAdded = 0;
    let playersMatched = 0;
    let sessionsAdded = 0;
    let sessionsUpdated = 0;

    const incomingPlayers = Array.isArray(data.players) ? data.players : (Array.isArray(data) ? data : (data.jugadores || []));
    const incomingTeams = Array.isArray(data.teams) ? data.teams : (data.equipos || []);
    const incomingSessions = Array.isArray(data.sessions) ? data.sessions : (data.sesiones || []);

    // 1. Sincronizar equipos
    const teamIdMap = {};
    incomingTeams.forEach(t => {
      if (!t || !t.name) return;
      let ex = st.teams.find(x => x.id === t.id) || st.teams.find(x => norm(x.name) === norm(t.name));
      if (ex) {
        teamIdMap[t.id] = ex.id;
      } else {
        const nt = { id: t.id || Store.uid('team'), name: t.name, shortName: t.shortName || '', color: t.color || '#22c55e' };
        st.teams.push(nt);
        teamIdMap[t.id] = nt.id;
      }
    });

    // 2. Mapeo y fusión de jugadores por nombre coincidente
    const playerIdMap = {};

    for (const raw of incomingPlayers) {
      const p = mapPlayer(raw);
      if (!p.name && !p.lastName && !p.nickname) continue;

      const pFullNameNorm = norm(p.name + ' ' + p.lastName);
      const pNickNorm = norm(p.nickname);

      // Buscar si ya existe por nombre completo o apodo
      let existing = st.players.find(x => {
        const exFullName = norm(x.name + ' ' + x.lastName);
        if (pFullNameNorm && exFullName === pFullNameNorm) return true;
        if (pNickNorm && norm(x.nickname) === pNickNorm) return true;
        if (p.id && x.id === p.id) return true;
        return false;
      });

      if (existing) {
        // Coincidencia: NO duplicar
        playerIdMap[p.id || raw.id] = existing.id;
        playersMatched++;
        // Completar campos faltantes si los tuviera
        if (!existing.mainDorsal && p.mainDorsal != null) existing.mainDorsal = p.mainDorsal;
        if (!existing.photo && p.photo) existing.photo = await shrinkPhoto(p.photo);
      } else {
        // No existe: crearlo
        if (!p.id) p.id = Store.uid('p');
        if (p.teamId && teamIdMap[p.teamId]) p.teamId = teamIdMap[p.teamId];
        if (p.photo) p.photo = await shrinkPhoto(p.photo);
        st.players.push(p);
        playerIdMap[raw.id || p.id] = p.id;
        playersAdded++;
      }
    }

    // 3. Fusión de sesiones y reasignación de estadísticas a los IDs locales
    for (const rawS of incomingSessions) {
      if (!rawS || !rawS.stats) continue;

      // Reasignar el diccionario de stats a los IDs de jugadores locales
      const translatedStats = {};
      Object.keys(rawS.stats).forEach(incomingPid => {
        const targetPid = playerIdMap[incomingPid] || incomingPid;
        // Solo agregar si el jugador existe en el sistema local
        if (st.players.some(p => p.id === targetPid)) {
          translatedStats[targetPid] = Object.assign({}, rawS.stats[incomingPid]);
        }
      });

      if (Object.keys(translatedStats).length === 0) continue;

      // Comprobar si la sesión ya existe en nuestra base de datos
      let exSession = st.sessions.find(s => s.id === rawS.id);
      if (exSession) {
        // Fusionar estadísticas sumando o actualizando
        Object.keys(translatedStats).forEach(pid => {
          exSession.stats[pid] = Object.assign({}, exSession.stats[pid] || {}, translatedStats[pid]);
        });
        sessionsUpdated++;
      } else {
        // Añadir nueva sesión importada
        const newSlots = (rawS.slots || [null, null]).map(sid => playerIdMap[sid] || null);
        st.sessions.unshift({
          id: rawS.id || Store.uid('s'),
          type: rawS.type === 'match' ? 'match' : 'training',
          date: rawS.date || new Date().toISOString().slice(0, 10),
          createdAt: rawS.createdAt || Date.now(),
          title: rawS.title || '',
          rival: rawS.rival || '',
          venue: rawS.venue || '',
          teamId: teamIdMap[rawS.teamId] || '',
          notes: rawS.notes || '',
          status: 'finished',
          elapsedMs: rawS.elapsedMs || 0,
          timerStartedAt: null,
          slots: newSlots,
          stats: translatedStats,
          log: []
        });
        sessionsAdded++;
      }
    }

    Store.save();
    Store.flushNative();

    return { playersAdded, playersMatched, sessionsAdded, sessionsUpdated };
  }

  /* Parser de listas de texto o CSV */
  function parseList(text, teamId) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const out = [];

    lines.forEach(l => {
      const tokens = l.split(/[,;\t]|\s+/).filter(Boolean);
      let dorsal = null, pos = 'Jugador';
      const rest = [];
      tokens.forEach(t => {
        const clean = t.replace(/^#/, '');
        if (dorsal === null && /^\d{1,3}$/.test(clean)) dorsal = parseInt(clean, 10);
        else if (POS_CODES.indexOf(t.toUpperCase()) >= 0) pos = t.toUpperCase();
        else if (t) rest.push(t);
      });
      const name = rest[0] || '';
      const last = rest.slice(1).join(' ');
      if (name || last) {
        out.push({ name, lastName: last, mainDorsal: dorsal, mainPosition: pos, teamId: teamId || '' });
      }
    });
    return out;
  }

  /* Entrada principal de importación de archivo */
  async function importFile(file, opts) {
    opts = opts || {};
    const text = await readFileText(file);
    const trimmed = text.replace(/^\uFEFF/, '').trim();

    if (trimmed[0] === '{' || trimmed[0] === '[') {
      let data;
      try { data = JSON.parse(trimmed); } catch (e) { throw new Error('El archivo JSON no tiene un formato válido.'); }
      return mergeDataset(data);
    }

    const list = parseList(trimmed, opts.teamId);
    if (!list.length) throw new Error('No se reconocieron jugadores en el archivo.');
    return mergeDataset({ players: list });
  }

  async function importText(text, teamId) {
    const list = parseList(text, teamId);
    if (!list.length) throw new Error('No se reconocieron jugadores en el texto.');
    return mergeDataset({ players: list });
  }

  /* ---------- Descarga / Exportación ---------- */
  function exportFile(content, filename, mime) {
    if (window.AndroidBridge && window.AndroidBridge.exportFile) {
      window.AndroidBridge.exportFile(content, filename, mime || 'application/octet-stream');
      return;
    }
    const blob = new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function stamp() {
    const d = new Date();
    const p = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }

  // Exportar toda la base de datos completa a JSON
  function exportBackup() {
    const json = JSON.stringify(Store.state, null, 2);
    exportFile(json, 'Estadisticas_Backup_' + stamp() + '.json', 'application/json');
  }

  // Exportar datos de un jugador individual en formato JSON
  function exportPlayerJSON(playerId) {
    const p = Store.player(playerId);
    if (!p) return;
    const team = Store.team(p.teamId);
    const playerSessions = Store.state.sessions.filter(s => s.stats && s.stats[playerId]);

    const payload = {
      app: 'player-stats-tracker',
      exportedAt: new Date().toISOString(),
      player: p,
      team: team || null,
      sessions: playerSessions.map(s => ({
        id: s.id,
        type: s.type,
        date: s.date,
        title: s.title,
        rival: s.rival,
        venue: s.venue,
        stats: { [p.id]: s.stats[playerId] },
        elapsedMs: s.elapsedMs
      }))
    };

    const cleanName = (p.name + '_' + (p.lastName || '')).replace(/\s+/g, '_');
    exportFile(JSON.stringify(payload, null, 2), `Jugador_${cleanName}_${stamp()}.json`, 'application/json');
  }

  // Exportar una sesión específica a JSON
  function exportSessionJSON(sessionId) {
    const s = Store.session(sessionId);
    if (!s) return;
    const pids = Store.sessionPlayerIds(s);
    const players = pids.map(id => Store.player(id)).filter(Boolean);

    const payload = {
      app: 'player-stats-tracker',
      exportedAt: new Date().toISOString(),
      session: s,
      players: players
    };

    exportFile(JSON.stringify(payload, null, 2), `Sesion_${s.date}_${stamp()}.json`, 'application/json');
  }

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportStatsCSV(sessions) {
    sessions = sessions || Store.state.sessions;
    const head = ['Fecha', 'Tipo', 'Sesión', 'Jugador', 'Dorsal', 'Equipo']
      .concat(Store.STATS.map(s => s.label))
      .concat(Store.RATIOS.map(r => r.label));
    const rows = [head];
    sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      Store.sessionPlayerIds(s).forEach(pid => {
        const p = Store.player(pid);
        const st = s.stats[pid];
        const team = p ? Store.team(p.teamId) : null;
        rows.push([
          s.date, s.type === 'match' ? 'Partido' : 'Entrenamiento', Store.sessionTitle(s),
          p ? Store.playerName(p) : '(eliminado)', p && p.mainDorsal != null ? p.mainDorsal : '', team ? team.name : ''
        ].concat(Store.STATS.map(x => st[x.key] || 0))
         .concat(Store.RATIOS.map(r => { const v = Store.ratio(st, r); return v == null ? '' : v; })));
      });
    });
    const csv = '\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
    exportFile(csv, 'Estadisticas_' + stamp() + '.csv', 'text/csv');
  }

  window.IO = {
    importFile,
    importText,
    mergeDataset,
    exportBackup,
    exportPlayerJSON,
    exportSessionJSON,
    exportStatsCSV,
    shrinkPhoto,
    readFileDataURL
  };
})();

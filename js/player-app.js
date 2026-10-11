/* =========================================================
   Portal del Jugador (Player App & PWA)
   Proyecto: player-stats-2ac9d
   - Sincronización en tiempo real con la App Maestra del Entrenador
   - Consulta de estadísticas individuales, plantilla y radares
   - Votación de convocatorias en vivo en 1 toque
   - Comparador Face to Face entre compañeros
   ========================================================= */
(function () {
  'use strict';

  let currentTab = 'convocations';
  let clubData = null;
  let myPlayerId = localStorage.getItem('portal_player_id') || null;
  let liveVotes = {}; // { [convId]: { [pid]: response } }

  const view = document.getElementById('portal-view');
  const toastRoot = document.getElementById('toast-root');

  function t(key, fallback) {
    if (window.I18N && window.I18N.t) return window.I18N.t(key, fallback);
    return fallback || key;
  }

  function toast(msg, type = 'info') {
    if (!toastRoot) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
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

  function renderAvatar(player, sizeClass = '') {
    const cls = sizeClass ? `avatar ${sizeClass}` : 'avatar';
    if (!player) return `<div class="${cls}"><span>?</span></div>`;
    const initial = (player.name ? player.name[0] : (player.nickname ? player.nickname[0] : 'J')).toUpperCase();
    const dorsalHtml = player.mainDorsal != null ? `<span class="dorsal">${player.mainDorsal}</span>` : '';
    if (player.photo) {
      return `<div class="${cls}"><img src="${player.photo}" alt="" loading="lazy" />${dorsalHtml}</div>`;
    }
    return `<div class="${cls}"><span>${initial}</span>${dorsalHtml}</div>`;
  }

  function getMyPlayer() {
    if (!clubData || !clubData.players || !myPlayerId) return null;
    return clubData.players.find(p => p.id === myPlayerId) || null;
  }

  function getPlayerFootLabel(footVal) {
    if (!footVal) return t('footRight', 'Diestro');
    const f = String(footVal).toLowerCase();
    if (f.includes('zurdo') || f.includes('left')) return t('footLeft', 'Zurdo');
    if (f.includes('ambi') || f.includes('both')) return (t('footBoth') || t('footAmbi') || 'Ambidiestro');
    return t('footRight', 'Diestro');
  }

  /* -------------------------------------------------------------
     CÁLCULO DE MÉTRICAS Y RADAR DEL JUGADOR
     ------------------------------------------------------------- */
  function calculatePlayerStats(pid) {
    const res = {
      sessionsCount: 0,
      minutes: 0,
      goals: 0,
      shotsOn: 0,
      shotsOff: 0,
      passOk: 0,
      passKo: 0,
      touches: 0,
      dribbleOk: 0,
      duelWon: 0,
      recoveries: 0
    };

    if (!clubData || !clubData.sessions) return res;

    clubData.sessions.forEach(s => {
      const pStats = s.stats && s.stats[pid];
      if (pStats && Object.values(pStats).some(v => v > 0)) {
        res.sessionsCount++;
        res.goals += pStats.goal || 0;
        res.shotsOn += pStats.shotOn || 0;
        res.shotsOff += pStats.shotOff || 0;
        res.passOk += pStats.passOk || 0;
        res.passKo += pStats.passKo || 0;
        res.touches += pStats.touches || 0;
        res.dribbleOk += pStats.dribbleOk || 0;
        res.duelWon += pStats.duelWon || 0;
        res.recoveries += pStats.recovery || 0;
        if (s.playerMinutes && s.playerMinutes[pid]) {
          res.minutes += s.playerMinutes[pid];
        } else {
          res.minutes += s.type === 'match' ? 45 : 30;
        }
      }
    });

    const totalPass = res.passOk + res.passKo;
    res.passAcc = totalPass > 0 ? Math.round((res.passOk / totalPass) * 100) : 0;

    const totalShots = res.shotsOn + res.shotsOff;
    res.shotAcc = totalShots > 0 ? Math.round((res.shotsOn / totalShots) * 100) : 0;
    res.convAcc = totalShots > 0 ? Math.round((res.goals / totalShots) * 100) : (res.goals > 0 ? 100 : 0);

    return res;
  }

  function calculatePlayerRadar(pid) {
    const s = calculatePlayerStats(pid);
    const passScore = s.passAcc > 0 ? Math.min(99, Math.max(45, Math.round(s.passAcc * 0.95))) : 65;
    const shotScore = s.goals > 0 ? Math.min(99, Math.max(50, 60 + s.goals * 6)) : 55;
    const regScore = s.dribbleOk > 0 ? Math.min(99, Math.max(50, 60 + s.dribbleOk * 5)) : 60;
    const defScore = s.recoveries > 0 ? Math.min(99, Math.max(50, 55 + s.recoveries * 5)) : 55;
    const fisScore = s.sessionsCount > 0 ? Math.min(99, Math.max(50, 60 + s.sessionsCount * 3)) : 65;

    return {
      pas: passScore,
      tir: shotScore,
      reg: regScore,
      fis: fisScore,
      def: defScore,
      dis: 100
    };
  }

  function renderRadarSVG(rd) {
    const isEn = window.I18N && window.I18N.getLang() === 'en';
    const axes = [
      { key: 'pas', label: isEn ? 'PASS' : 'PASE', val: rd.pas },
      { key: 'tir', label: isEn ? 'SHOT' : 'TIRO', val: rd.tir },
      { key: 'reg', label: isEn ? 'DRIB' : 'REGATE', val: rd.reg },
      { key: 'fis', label: isEn ? 'PHYS' : 'FÍSICO', val: rd.fis },
      { key: 'def', label: isEn ? 'DEF' : 'DEFENSA', val: rd.def }
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
        <g>
          <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#e2e8f0" font-size="10.5" font-weight="800" text-anchor="middle" dominant-baseline="central">
            ${a.label}
          </text>
          <text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" fill="#22d3ee" font-size="11.5" font-weight="900" text-anchor="middle" dominant-baseline="central">
            ${a.val}
          </text>
        </g>
      `;
    }).join('');

    return `
      <div style="display: flex; justify-content: center; align-items: center; padding: 6px 0;">
        <svg class="radar-svg" viewBox="0 0 260 260" style="width: 100%; max-width: 270px; height: auto;">
          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#0284c7" stop-opacity="0.18"/>
            </radialGradient>
          </defs>
          ${gridPolygons}
          <polygon points="${dataPolyPoints}" fill="url(#radarFill)" stroke="#22d3ee" stroke-width="2.5"/>
          ${dataPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#22d3ee" stroke="#060a13" stroke-width="2"/>`).join('')}
          ${labels}
        </svg>
      </div>
    `;
  }

  /* -------------------------------------------------------------
     INTERFAZ Y NAVEGACIÓN
     ------------------------------------------------------------- */
  function updateHeaderIdentity() {
    const myP = getMyPlayer();
    const nameEl = document.getElementById('portal-my-name');
    const avatarEl = document.getElementById('portal-my-avatar');
    if (!nameEl || !avatarEl) return;

    if (myP) {
      nameEl.textContent = `#${myP.mainDorsal != null ? myP.mainDorsal : '-'} ${myP.name || ''} ${myP.lastName || ''}`.trim();
      avatarEl.innerHTML = myP.photo ? `<img src="${myP.photo}" alt="" />` : `<span>${(myP.name || 'J')[0].toUpperCase()}</span>`;
    } else {
      nameEl.textContent = 'Seleccionar quién eres...';
      avatarEl.innerHTML = '<span>?</span>';
    }
  }

  function showSelectIdentityModal() {
    const players = (clubData && clubData.players) ? clubData.players.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')) : [];

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">¿Quién eres en el equipo?</h3>
          <button type="button" class="icon-btn ghost" id="dialog-id-close" style="width: 32px; height: 32px;">✕</button>
        </div>
        <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          Selecciona tu nombre para que puedas confirmar asistencia a tus convocatorias y ver tus estadísticas con 1 toque:
        </p>
        <input type="text" id="id-search" placeholder="Buscar por nombre o dorsal..." style="width: 100%; margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />
        <div id="id-players-list" style="max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
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
                    ${p.mainPosition || 'Jugador'} ${team ? '• ' + escapeHtml(team.name) : ''}
                  </small>
                </div>
                ${myPlayerId === p.id ? '<span style="color: #86efac; font-weight: 900;">✓ Tú</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dialog-id-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const searchInp = overlay.querySelector('#id-search');
    const listCont = overlay.querySelector('#id-players-list');
    if (searchInp && listCont) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        listCont.querySelectorAll('.portal-player-pick-item').forEach(it => {
          const text = it.textContent.toLowerCase();
          it.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
        });
      };
    }

    listCont.querySelectorAll('.portal-player-pick-item').forEach(it => {
      it.onclick = () => {
        const pid = it.getAttribute('data-pid');
        myPlayerId = pid;
        localStorage.setItem('portal_player_id', pid);
        haptic(30);
        updateHeaderIdentity();
        close();
        toast('¡Perfil guardado! Bienvenido.', 'success');
        renderCurrentTab();
      };
    });

    document.body.appendChild(overlay);
    if (searchInp) setTimeout(() => searchInp.focus(), 100);
  }

  /* -------------------------------------------------------------
     PESTAÑA 1: CONVOCATORIAS Y ASISTENCIA EN VIVO
     ------------------------------------------------------------- */
  function renderConvocationsView() {
    const convs = (clubData && clubData.convocations) ? clubData.convocations : [];
    const myP = getMyPlayer();

    if (convs.length === 0) {
      view.innerHTML = `
        <div style="padding: 24px 16px; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">📋</div>
            <h3>Sin convocatorias activas</h3>
            <p>El entrenador todavía no ha publicado ninguna convocatoria para los próximos partidos o entrenamientos.</p>
          </div>
        </div>
      `;
      return;
    }

    view.innerHTML = `
      <div style="padding: 14px 16px;">
        <h2 style="font-size: 18px; font-weight: 900; margin-bottom: 4px;">Convocatorias Oficiales</h2>
        <p style="font-size: 12px; color: var(--muted); margin-bottom: 14px;">
          Confirma tu asistencia directamente al míster en un solo toque:
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px;" id="convs-list-container">
          ${convs.map(c => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === c.teamId) : null;
            const myVoteData = (liveVotes[c.id] && myPlayerId) ? liveVotes[c.id][myPlayerId] : null;
            const currentStatus = myVoteData ? myVoteData.status : ((c.list || {})[myPlayerId] || 'uncalled');

            const isAttending = (currentStatus === 'called');
            const isAbsent = (currentStatus === 'absent');

            // Recuento de compañeros
            const allPlayers = clubData.players || [];
            let nCalled = 0, nAbsent = 0, nPending = 0;
            const list = c.list || {};
            const responses = liveVotes[c.id] || {};

            allPlayers.forEach(p => {
              const r = responses[p.id];
              const st = r ? r.status : list[p.id];
              if (st === 'called') nCalled++;
              else if (st === 'absent') nAbsent++;
              else if (st === 'bench' || !st) nPending++;
            });

            return `
              <div class="card" style="border: 1px solid var(--border); padding: 16px;" data-cid="${c.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <div>
                    <span class="badge ${c.type}" style="margin-bottom: 6px;">
                      ${c.type === 'match' ? '🏆 Partido' : '⚽ Entrenamiento'}
                    </span>
                    <h3 style="margin: 0; font-size: 17px; font-weight: 900;">
                      ${escapeHtml(c.title || (c.rival ? 'vs ' + c.rival : 'Convocatoria'))}
                    </h3>
                    <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.4;">
                      📅 <b>${c.date}</b> • ⏰ ${c.time || '10:00'}<br />
                      ${c.venue ? `📍 ${escapeHtml(c.venue)}<br />` : ''}
                      ${team ? `<span style="color: ${team.color || 'var(--cyan)'}; font-weight: 800;">🛡️ ${escapeHtml(team.name)}</span>` : ''}
                    </div>
                  </div>
                </div>

                ${c.notes ? `
                  <div style="background: rgba(0,0,0,0.25); border-left: 3px solid var(--cyan); padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-top: 10px; color: #bae6fd;">
                    📝 <b>Nota del míster:</b> ${escapeHtml(c.notes)}
                  </div>
                ` : ''}

                <!-- CAJA DE VOTACIÓN DEL JUGADOR -->
                <div class="portal-vote-box">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; font-weight: 800; color: #fff;">¿Asistirás a esta cita?</span>
                    <span id="vote-badge-${c.id}" class="badge" style="${isAttending ? 'background: rgba(34,197,94,0.2); color: #86efac;' : (isAbsent ? 'background: rgba(239,68,68,0.2); color: #fca5a5;' : 'background: var(--surface); color: var(--muted);')}">
                      ${isAttending ? '🟢 Asistencia Confirmada' : (isAbsent ? '❌ Has notificado baja' : '⏳ Pendiente')}
                    </span>
                  </div>

                  <div class="portal-vote-btns">
                    <button type="button" class="btn-vote yes ${isAttending ? 'active' : ''}" data-vote="called" data-cid="${c.id}">
                      <span>✓</span>
                      <span>🟢 Asistiré</span>
                    </button>
                    <button type="button" class="btn-vote no ${isAbsent ? 'active' : ''}" data-vote="absent" data-cid="${c.id}">
                      <span>✕</span>
                      <span>❌ No puedo</span>
                    </button>
                  </div>
                </div>

                <!-- RESUMEN DE LA PLANTILLA -->
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--muted);">
                  <span>🟢 ${nCalled} Confirmados</span>
                  <span>❌ ${nAbsent} Bajas</span>
                  <button type="button" class="btn sm ghost" data-open-squad-status="${c.id}" style="font-size: 11px; padding: 2px 8px; height: auto;">
                    Ver lista ▾
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Conexión de botones de voto
    view.querySelectorAll('.btn-vote').forEach(btn => {
      btn.onclick = async () => {
        if (!myPlayerId) {
          showSelectIdentityModal();
          return;
        }

        const cid = btn.getAttribute('data-cid');
        const vote = btn.getAttribute('data-vote');
        const myP = getMyPlayer();
        const pName = myP ? `${myP.name || ''} ${myP.lastName || ''}`.trim() : 'Jugador';

        haptic(35);

        // Feedback optimista en UI
        const box = btn.closest('.portal-vote-box');
        if (box) {
          box.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const badge = document.getElementById(`vote-badge-${cid}`);
          if (badge) {
            badge.textContent = vote === 'called' ? '🟢 Asistencia Confirmada' : '❌ Has notificado baja';
            badge.style.background = vote === 'called' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)';
            badge.style.color = vote === 'called' ? '#86efac' : '#fca5a5';
          }
        }

        try {
          if (window.Cloud && window.Cloud.voteAttendance) {
            await window.Cloud.voteAttendance(cid, myPlayerId, vote, pName);
            toast(vote === 'called' ? '¡Asistencia confirmada! El míster ya lo ha recibido en vivo.' : 'Has notificado tu baja al míster.', 'success');
          } else {
            toast('Guardado en caché.', 'info');
          }
        } catch (err) {
          console.error(err);
          toast('Error enviando voto: ' + err.message, 'error');
        }
      };
    });

    // Ver lista de quién va
    view.querySelectorAll('[data-open-squad-status]').forEach(btn => {
      btn.onclick = () => {
        const cid = btn.getAttribute('data-open-squad-status');
        showConvocationAttendeesModal(cid);
      };
    });
  }

  function showConvocationAttendeesModal(cid) {
    const c = (clubData && clubData.convocations) ? clubData.convocations.find(x => x.id === cid) : null;
    if (!c) return;

    const allPlayers = clubData.players || [];
    const list = c.list || {};
    const responses = liveVotes[c.id] || {};

    const attending = [];
    const absent = [];
    const pending = [];

    allPlayers.forEach(p => {
      const r = responses[p.id];
      const st = r ? r.status : list[p.id];
      if (st === 'called') attending.push(p);
      else if (st === 'absent') absent.push(p);
      else pending.push(p);
    });

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 80vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">Estado de Convocatoria</h3>
          <button type="button" class="icon-btn ghost" id="dlg-attendees-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="font-size: 12.5px; font-weight: 800; color: #86efac; margin: 10px 0 6px;">🟢 CONFIRMADOS (${attending.length})</div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
          ${attending.length === 0 ? '<span style="font-size: 12px; color: var(--muted);">Nadie ha confirmado todavía</span>' : attending.map(p => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
              ${renderAvatar(p, 'sm')}
              <b>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</b>
            </div>
          `).join('')}
        </div>

        <div style="font-size: 12.5px; font-weight: 800; color: #fca5a5; margin: 10px 0 6px;">❌ BAJAS (${absent.length})</div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
          ${absent.length === 0 ? '<span style="font-size: 12px; color: var(--muted);">Ninguna baja registrada</span>' : absent.map(p => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
              ${renderAvatar(p, 'sm')}
              <span>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
            </div>
          `).join('')}
        </div>

        <div style="font-size: 12.5px; font-weight: 800; color: #fde047; margin: 10px 0 6px;">⏳ PENDIENTES (${pending.length})</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${pending.map(p => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted);">
              ${renderAvatar(p, 'sm')}
              <span>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-attendees-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     PESTAÑA 2: MI FICHA PERSONAL Y ESTADÍSTICAS
     ------------------------------------------------------------- */
  function renderMyStatsView() {
    const myP = getMyPlayer();

    if (!myP) {
      view.innerHTML = `
        <div style="padding: 24px 16px; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">👤</div>
            <h3>Selecciona tu perfil</h3>
            <p>Elige tu nombre en el equipo para ver tus estadísticas personales, goles, efectividad y radar de atributos.</p>
            <button class="btn primary" id="btn-portal-choose-me">Seleccionar mi nombre</button>
          </div>
        </div>
      `;
      const btn = view.querySelector('#btn-portal-choose-me');
      if (btn) btn.onclick = showSelectIdentityModal;
      return;
    }

    const team = clubData.teams ? clubData.teams.find(t => t.id === myP.teamId) : null;
    const stats = calculatePlayerStats(myP.id);
    const radar = calculatePlayerRadar(myP.id);

    view.innerHTML = `
      <div style="padding: 14px 16px;">
        <!-- Ficha Hero -->
        <div class="card p-hero" style="margin-bottom: 14px; border: 1px solid var(--border);">
          ${renderAvatar(myP, 'lg')}
          <div class="grow" style="overflow: hidden;">
            <h2 style="font-size: 19px; font-weight: 900; margin: 0 0 4px;">
              ${escapeHtml(myP.name || '')} ${escapeHtml(myP.lastName || '')}
            </h2>
            <div class="meta" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted);">
              <span class="pos-tag">${myP.mainPosition || 'Jugador'}</span>
              <span>•</span>
              <span>#${myP.mainDorsal != null ? myP.mainDorsal : '—'}</span>
              <span>•</span>
              <span>${getPlayerFootLabel(myP.foot)}</span>
            </div>
            ${team ? `
              <div style="margin-top: 6px;">
                <span class="badge" style="background: ${team.color || 'var(--cyan)'}25; color: ${team.color || 'var(--cyan)'}; border: 1px solid ${team.color || 'var(--cyan)'}50; font-weight: 800;">
                  🛡️ ${escapeHtml(team.name)}
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Radar de Habilidades -->
        <div class="section-title"><span>Radar de Cualidades Deportivas</span></div>
        <div class="card" style="margin-bottom: 14px; border: 1px solid var(--border);">
          ${renderRadarSVG(radar)}
        </div>

        <!-- Cifras Clave -->
        <div class="section-title"><span>Mis Cifras Acumuladas</span></div>
        <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">Partidos / Sesiones</div>
            <div style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 2px;">${stats.sessionsCount}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">Minutos Jugados</div>
            <div style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 2px;">${stats.minutes}'</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #86efac; text-transform: uppercase;">Goles Marcados</div>
            <div style="font-size: 24px; font-weight: 900; color: #86efac; margin-top: 2px;">⚽ ${stats.goals}</div>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: var(--cyan); text-transform: uppercase;">Precisión Pase</div>
            <div style="font-size: 24px; font-weight: 900; color: var(--cyan); margin-top: 2px;">${stats.passAcc}%</div>
            <small style="font-size: 10.5px; color: var(--muted);">${stats.passOk} acertados</small>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #facc15; text-transform: uppercase;">Efectividad Tiro</div>
            <div style="font-size: 24px; font-weight: 900; color: #facc15; margin-top: 2px;">${stats.shotAcc}%</div>
            <small style="font-size: 10.5px; color: var(--muted);">${stats.shotsOn} a puerta</small>
          </div>
          <div class="stat-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">Toques Balón</div>
            <div style="font-size: 24px; font-weight: 900; color: #c084fc; margin-top: 2px;">${stats.touches}</div>
          </div>
        </div>

        <!-- Historial de Partidos y Acciones del Jugador -->
        <div class="section-title"><span>Mis Partidos y Acciones Detalladas</span></div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          ${renderPlayerMatchHistory(myP.id)}
        </div>
      </div>
    `;
  }

  function renderPlayerMatchHistory(pid) {
    if (!clubData || !clubData.sessions || clubData.sessions.length === 0) {
      return `
        <div class="card" style="padding: 16px; text-align: center; border: 1px dashed var(--border); color: var(--muted); font-size: 13px;">
          Todavía no hay partidos o sesiones finalizadas.
        </div>
      `;
    }

    const matches = clubData.sessions.filter(s => {
      const st = s.stats && s.stats[pid];
      return st && Object.values(st).some(v => v > 0);
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (matches.length === 0) {
      return `
        <div class="card" style="padding: 16px; text-align: center; border: 1px dashed var(--border); color: var(--muted); font-size: 13px;">
          Aún no tienes acciones registradas en partidos anteriores.
        </div>
      `;
    }

    return matches.map(s => {
      const st = s.stats[pid] || {};
      const mins = (s.playerMinutes && s.playerMinutes[pid]) || (s.type === 'match' ? 45 : 30);
      const isMatch = s.type === 'match';
      const title = s.title || (isMatch ? (s.rival ? 'vs ' + s.rival : 'Partido') : 'Entrenamiento');
      const scoreStr = (s.score && (s.score.home != null || s.score.away != null))
        ? `${s.score.home || 0} - ${s.score.away || 0}`
        : '';

      const totalP = (st.passOk || 0) + (st.passKo || 0);
      const passPct = totalP > 0 ? Math.round(((st.passOk || 0) / totalP) * 100) : null;
      const totalShots = (st.shotOn || 0) + (st.shotOff || 0);

      return `
        <div class="card" style="padding: 14px; border: 1px solid var(--border); background: var(--surface2);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge" style="background: ${isMatch ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)'}; color: ${isMatch ? '#86efac' : '#38bdf8'}; font-size: 10px; font-weight: 800;">
                ${isMatch ? '🏟️ PARTIDO' : '🏃‍♂️ ENTRENAMIENTO'}
              </span>
              <h4 style="margin: 4px 0 2px; font-size: 15px; font-weight: 900; color: #fff;">
                ${escapeHtml(title)}
              </h4>
              <div style="font-size: 11.5px; color: var(--muted);">
                📅 ${s.date || 'Reciente'} ${s.venue ? '• 📍 ' + escapeHtml(s.venue) : ''}
              </div>
            </div>
            ${scoreStr ? `
              <div style="font-size: 15px; font-weight: 900; background: var(--bg2); padding: 4px 10px; border-radius: 10px; border: 1px solid var(--border); color: #fff;">
                ${scoreStr}
              </div>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted); margin-bottom: 10px;">
            <span>⏱️ <b>${mins}'</b> jugados</span>
            ${st.goal > 0 ? `<span style="color: #86efac; font-weight: 800;">⚽ ${st.goal} ${st.goal === 1 ? 'gol' : 'goles'}</span>` : ''}
          </div>

          <!-- Acciones de este partido -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 12px; text-align: center;">
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 10px; font-weight: 700;">PASES</div>
              <div style="font-weight: 800; color: #fff;">${st.passOk || 0}/${totalP} ${passPct !== null ? `<span style="font-size: 10px; color: var(--cyan);">(${passPct}%)</span>` : ''}</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 10px; font-weight: 700;">TIROS</div>
              <div style="font-weight: 800; color: #fff;">${st.shotOn || 0} a puerta <span style="font-size: 10px; color: var(--muted);">(${totalShots})</span></div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 10px; font-weight: 700;">REGATES</div>
              <div style="font-weight: 800; color: #fff;">${st.dribbleOk || 0} <span style="font-size: 10px; color: var(--muted);">éxitos</span></div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 10px; font-weight: 700;">DUELOS</div>
              <div style="font-weight: 800; color: #fff;">${st.duelWon || 0} ganados</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 10px; font-weight: 700;">RECUP.</div>
              <div style="font-weight: 800; color: #fff;">${st.recovery || 0} balones</div>
            </div>
            <div style="background: var(--bg2); padding: 6px 4px; border-radius: 8px; border: 1px solid var(--border);">
              <div style="color: var(--muted); font-size: 10px; font-weight: 700;">TOQUES</div>
              <div style="font-weight: 800; color: #c084fc;">${st.touches || 0}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* -------------------------------------------------------------
     PESTAÑA 3: PLANTILLA DE COMPAÑEROS
     ------------------------------------------------------------- */
  function renderSquadView() {
    const players = (clubData && clubData.players) ? clubData.players.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')) : [];

    view.innerHTML = `
      <div style="padding: 14px 16px;">
        <h2 style="font-size: 18px; font-weight: 900; margin-bottom: 4px;">Plantilla de Jugadores</h2>
        <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          Conoce a tus compañeros, sus dorsales, posición y estadísticas:
        </p>

        <input type="text" id="squad-search" placeholder="Buscar compañero..." style="width: 100%; margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 13.5px;" />

        <div style="display: flex; flex-direction: column; gap: 8px;" id="squad-list">
          ${players.map(p => {
            const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
            return `
              <div class="card squad-item-card" data-pid="${p.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border); cursor: pointer;">
                ${renderAvatar(p, 'md')}
                <div style="flex: 1; overflow: hidden;">
                  <h4 style="margin: 0 0 2px; font-size: 15px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}
                  </h4>
                  <div style="font-size: 12px; color: var(--muted);">
                    <span class="pos-tag">${p.mainPosition || 'Jugador'}</span>
                    <span>•</span>
                    <span>${getPlayerFootLabel(p.foot)}</span>
                    ${team ? `<span>•</span> <span style="color: ${team.color || 'var(--cyan)'}; font-weight: 700;">${escapeHtml(team.name)}</span>` : ''}
                  </div>
                </div>
                <span style="color: var(--muted); font-size: 18px;">›</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const search = view.querySelector('#squad-search');
    const list = view.querySelector('#squad-list');
    if (search && list) {
      search.oninput = () => {
        const q = search.value.toLowerCase().trim();
        list.querySelectorAll('.squad-item-card').forEach(it => {
          it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
      };
    }

    view.querySelectorAll('.squad-item-card').forEach(it => {
      it.onclick = () => {
        const pid = it.getAttribute('data-pid');
        showPlayerDetailModal(pid);
      };
    });
  }

  function showPlayerDetailModal(pid) {
    const p = clubData.players ? clubData.players.find(x => x.id === pid) : null;
    if (!p) return;

    const team = clubData.teams ? clubData.teams.find(t => t.id === p.teamId) : null;
    const stats = calculatePlayerStats(p.id);
    const radar = calculatePlayerRadar(p.id);

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 85vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">Ficha del Jugador</h3>
          <button type="button" class="icon-btn ghost" id="dlg-pdetail-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          ${renderAvatar(p, 'lg')}
          <div>
            <h2 style="margin: 0 0 2px; font-size: 18px; font-weight: 900;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')}</h2>
            <div style="font-size: 12px; color: var(--muted);">
              ${p.mainPosition || 'Jugador'} • ${getPlayerFootLabel(p.foot)}
            </div>
            ${team ? `<span class="badge" style="background: ${team.color}25; color: ${team.color}; font-weight: 800; margin-top: 4px;">🛡️ ${escapeHtml(team.name)}</span>` : ''}
          </div>
        </div>

        ${renderRadarSVG(radar)}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
          <div style="background: var(--bg2); padding: 8px; border-radius: 10px; text-align: center;">
            <div style="font-size: 10.5px; color: var(--muted); font-weight: 800;">GOLES</div>
            <div style="font-size: 18px; font-weight: 900; color: #86efac;">⚽ ${stats.goals}</div>
          </div>
          <div style="background: var(--bg2); padding: 8px; border-radius: 10px; text-align: center;">
            <div style="font-size: 10.5px; color: var(--muted); font-weight: 800;">PRECISIÓN PASE</div>
            <div style="font-size: 18px; font-weight: 900; color: var(--cyan);">${stats.passAcc}%</div>
          </div>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-pdetail-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     PESTAÑA 4: FACE TO FACE (COMPARADOR ENTRE COMPAÑEROS)
     ------------------------------------------------------------- */
  let h2hPlayer1Id = null;
  let h2hPlayer2Id = null;

  function renderH2HView() {
    const players = (clubData && clubData.players) ? clubData.players : [];

    if (players.length < 2) {
      view.innerHTML = `
        <div style="padding: 24px 16px; text-align: center;">
          <div class="empty-state card">
            <div class="e-ic">⚔️</div>
            <h3>Comparador Face to Face</h3>
            <p>Se necesitan al menos 2 jugadores en la plantilla para comparar estadísticas cara a cara.</p>
          </div>
        </div>
      `;
      return;
    }

    if (!h2hPlayer1Id) h2hPlayer1Id = myPlayerId || players[0].id;
    if (!h2hPlayer2Id) h2hPlayer2Id = players.find(p => p.id !== h2hPlayer1Id)?.id || players[1].id;

    const p1 = players.find(p => p.id === h2hPlayer1Id) || players[0];
    const p2 = players.find(p => p.id === h2hPlayer2Id) || players[1];

    const s1 = calculatePlayerStats(p1.id);
    const s2 = calculatePlayerStats(p2.id);

    const r1 = calculatePlayerRadar(p1.id);
    const r2 = calculatePlayerRadar(p2.id);

    view.innerHTML = `
      <div style="padding: 14px 16px;">
        <h2 style="font-size: 18px; font-weight: 900; margin-bottom: 4px;">Comparativa Face to Face</h2>
        <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          Compara tus estadísticas y atributos frente a frente con cualquier compañero:
        </p>

        <!-- Cabecera de Selección Cara a Cara -->
        <div class="card" style="padding: 14px; border: 1px solid var(--border); margin-bottom: 14px;">
          <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; text-align: center;">
            <!-- Jugador 1 -->
            <div>
              ${renderAvatar(p1, 'md')}
              <button class="btn sm ghost" id="btn-change-h2h-1" style="margin-top: 6px; font-size: 12px; font-weight: 800; color: #22d3ee; padding: 4px 8px; height: auto;">
                #${p1.mainDorsal != null ? p1.mainDorsal : '-'} ${escapeHtml(p1.name || '')} ▾
              </button>
            </div>

            <div style="font-size: 18px; font-weight: 900; color: #facc15;">VS</div>

            <!-- Jugador 2 -->
            <div>
              ${renderAvatar(p2, 'md')}
              <button class="btn sm ghost" id="btn-change-h2h-2" style="margin-top: 6px; font-size: 12px; font-weight: 800; color: #f472b6; padding: 4px 8px; height: auto;">
                #${p2.mainDorsal != null ? p2.mainDorsal : '-'} ${escapeHtml(p2.name || '')} ▾
              </button>
            </div>
          </div>
        </div>

        <!-- Métricas Cara a Cara -->
        <div class="section-title"><span>Duelo Estadístico</span></div>
        <div class="card" style="padding: 12px; border: 1px solid var(--border); margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px;">
          ${renderH2HMetricRow('Goles', s1.goals, s2.goals, '⚽')}
          ${renderH2HMetricRow('Precisión Pase', `${s1.passAcc}%`, `${s2.passAcc}%`, '🎯')}
          ${renderH2HMetricRow('Efectividad Tiro', `${s1.shotAcc}%`, `${s2.shotAcc}%`, '🥅')}
          ${renderH2HMetricRow('Toques Balón', s1.touches, s2.touches, '👟')}
          ${renderH2HMetricRow('Partidos', s1.sessionsCount, s2.sessionsCount, '🏟️')}
        </div>

        <!-- Radares individuales -->
        <div class="section-title"><span>Radares de Cualidades</span></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="card" style="padding: 8px; text-align: center; border: 1px solid var(--border);">
            <b style="font-size: 12px; color: #22d3ee;">${escapeHtml(p1.name || '')}</b>
            ${renderRadarSVG(r1)}
          </div>
          <div class="card" style="padding: 8px; text-align: center; border: 1px solid var(--border);">
            <b style="font-size: 12px; color: #f472b6;">${escapeHtml(p2.name || '')}</b>
            ${renderRadarSVG(r2)}
          </div>
        </div>
      </div>
    `;

    function renderH2HMetricRow(label, v1, v2, icon) {
      const num1 = parseFloat(v1) || 0;
      const num2 = parseFloat(v2) || 0;
      const c1 = num1 > num2 ? '#22d3ee; font-weight: 900;' : (num1 === num2 ? '#fff;' : 'var(--muted);');
      const c2 = num2 > num1 ? '#f472b6; font-weight: 900;' : (num1 === num2 ? '#fff;' : 'var(--muted);');

      return `
        <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
          <div style="color: ${c1}; text-align: right; font-size: 15px;">${v1}</div>
          <div style="font-size: 11.5px; font-weight: 800; color: var(--muted); text-align: center; padding: 0 12px;">
            ${icon} ${label}
          </div>
          <div style="color: ${c2}; text-align: left; font-size: 15px;">${v2}</div>
        </div>
      `;
    }

    view.querySelector('#btn-change-h2h-1').onclick = () => {
      showPickerForH2H(1);
    };
    view.querySelector('#btn-change-h2h-2').onclick = () => {
      showPickerForH2H(2);
    };
  }

  function showPickerForH2H(targetSlot) {
    const players = clubData.players || [];
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-height: 80vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">Elegir Jugador ${targetSlot}</h3>
          <button type="button" class="icon-btn ghost" id="dlg-h2h-x" style="width: 32px; height: 32px;">✕</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 60vh; overflow-y: auto;">
          ${players.map(p => `
            <div class="h2h-pick-item" data-pid="${p.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border); cursor: pointer;">
              ${renderAvatar(p, 'sm')}
              <b>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(p.name || '')} ${escapeHtml(p.lastName || '')}</b>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-h2h-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelectorAll('.h2h-pick-item').forEach(it => {
      it.onclick = () => {
        const pid = it.getAttribute('data-pid');
        if (targetSlot === 1) h2hPlayer1Id = pid;
        else h2hPlayer2Id = pid;
        close();
        renderH2HView();
      };
    });

    document.body.appendChild(overlay);
  }

  /* -------------------------------------------------------------
     RENDERIZADO Y NAVEGACIÓN PRINCIPAL
     ------------------------------------------------------------- */
  function renderCurrentTab() {
    if (currentTab === 'convocations') renderConvocationsView();
    else if (currentTab === 'stats') renderMyStatsView();
    else if (currentTab === 'squad') renderSquadView();
    else if (currentTab === 'h2h') renderH2HView();
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

    const btnIdentity = document.getElementById('btn-select-identity');
    if (btnIdentity) btnIdentity.onclick = showSelectIdentityModal;

    const btnLang = document.getElementById('btn-portal-lang');
    if (btnLang) {
      btnLang.onclick = () => {
        const next = (window.I18N && window.I18N.getLang() === 'es') ? 'en' : 'es';
        if (window.I18N) window.I18N.setLang(next);
        btnLang.textContent = next.toUpperCase();
        renderCurrentTab();
      };
    }
  }

  /* -------------------------------------------------------------
     INICIALIZACIÓN Y CONEXIÓN CON FIREBASE
     ------------------------------------------------------------- */
  function init() {
    // 1. Cargar caché previo si existe
    try {
      const cached = localStorage.getItem('cached_club_state');
      if (cached) {
        clubData = JSON.parse(cached);
        updateHeaderIdentity();
        renderCurrentTab();
      }
    } catch (e) {}

    setupNavigation();
    updateHeaderIdentity();

    // 2. Conectar con Firebase Cloud
    if (window.Cloud) {
      window.Cloud.init();

      const badge = document.getElementById('portal-cloud-badge');

      // Escuchar cambios de estado en vivo del club
      window.Cloud.listenToClubState((remoteState) => {
        if (!remoteState) return;
        clubData = remoteState;
        try { localStorage.setItem('cached_club_state', JSON.stringify(remoteState)); } catch (e) {}

        if (remoteState.settings && remoteState.settings.clubName) {
          const titleEl = document.getElementById('portal-club-title');
          if (titleEl) titleEl.textContent = remoteState.settings.clubName;
        }

        if (badge) {
          badge.textContent = '🟢 En vivo';
          badge.style.background = 'rgba(34, 197, 94, 0.15)';
          badge.style.color = '#86efac';
        }

        updateHeaderIdentity();
        renderCurrentTab();
      });

      // Escuchar votos en tiempo real
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
    }

    // Si aún no ha seleccionado identidad, pedirlo tras 1 segundo
    if (!myPlayerId) {
      setTimeout(() => {
        if (!myPlayerId && clubData && clubData.players && clubData.players.length > 0) {
          showSelectIdentityModal();
        }
      }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

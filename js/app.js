/* =========================================================
   Estadísticas Jugadores — Controlador de Interfaz (UI)
   - Bilingüe (Español / Inglés) con selector directo
   - Selector dinámico de botones en pantalla (presets: solo toques, solo tiros, etc.)
   - Orden canónico estricto garantizado
   - Deshacer (undo) 100% silencioso (sin toast molesto)
   - Añadir datos manuales al perfil del jugador
   - Exportación de jugador y sesiones en formato JSON
   ========================================================= */
(function () {
  'use strict';

  try {
    if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
      window.screen.orientation.lock('portrait').catch(() => {});
    }
  } catch (e) {}

  let currentTab = 'home';
  let activeSessionId = null;
  let timerInterval = null;
  let statsFilterType = 'all';
  let statsFilterPeriod = 'all';
  let statsSelectedPlayerId = 'all';
  let statsFilterTeams = ['all'];
  let playerListSearch = '';
  let playerListTeam = 'all';
  let historyInitialFilter = 'all';

  function haptic(ms) {
    if (!Store.state.settings.vibrate) return;
    try {
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(ms || 25);
      }
    } catch (e) {}
  }

  function toast(msg, type, onClick) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    if (onClick) {
      el.style.cursor = 'pointer';
      el.innerHTML = `<span style="flex:1;">${msg}</span><span style="font-size:14px; margin-left:8px; opacity:0.85; font-weight:900;">➔</span>`;
      el.onclick = () => {
        try { onClick(); } catch (e) {}
        el.remove();
      };
    } else {
      el.innerHTML = msg;
    }
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    }, 2800);
  }

  window.UI = { toast, haptic };
  window.getActiveSessionId = () => activeSessionId;

  function formatRequestTime(ts) {
    if (!ts) return '';
    try {
      let d;
      if (typeof ts === 'number') d = new Date(ts);
      else if (ts && typeof ts.toMillis === 'function') d = new Date(ts.toMillis());
      else if (ts && typeof ts.toDate === 'function') d = ts.toDate();
      else if (ts && ts.seconds) d = new Date(ts.seconds * 1000);
      else d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch (e) {
      return '';
    }
  }
  window.setActiveSessionId = (id) => { activeSessionId = id; };

  /* ---------- Modales / Bottom Sheets ---------- */
  function openSheet(title, renderBody, renderFoot, onClose) {
    const existing = document.getElementById('active-sheet-backdrop');
    if (existing) existing.remove();
    const closing = document.getElementById('closing-sheet-backdrop');
    if (closing) closing.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.id = 'active-sheet-backdrop';
    if (document.querySelector('.chat-dialog-overlay, .dialog-overlay')) {
      backdrop.style.zIndex = '11000';
    }

    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    // Altura inicial generosa y cómoda para la hoja inferior
    const defaultSheetH = Math.min(window.innerHeight * 0.70, 560);
    sheet.style.height = `${defaultSheetH}px`;
    sheet.style.maxHeight = '96vh';
    sheet.style.overflowX = 'hidden';

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <h2>${title}</h2>
        <button class="icon-btn ghost" id="sheet-expand-btn" title="Expandir/Reducir" style="width: 32px; height: 32px; font-size: 14px; opacity: 0.85;">⤢</button>
        <button class="icon-btn ghost" id="sheet-close-btn">${icon('x', 20)}</button>
      </div>
      <div class="sheet-body" id="sheet-body-content"></div>
      ${renderFoot ? '<div class="sheet-foot" id="sheet-foot-content"></div>' : ''}
    `;

    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    const bodyEl = sheet.querySelector('#sheet-body-content');
    if (bodyEl) {
      bodyEl.style.overflowX = 'hidden';
      bodyEl.style.maxWidth = '100%';
      bodyEl.style.boxSizing = 'border-box';
    }
    if (typeof renderBody === 'function') renderBody(bodyEl);

    if (renderFoot && typeof renderFoot === 'function') {
      const footEl = sheet.querySelector('#sheet-foot-content');
      renderFoot(footEl);
    }

    function handleClose() {
      closeSheet();
      if (typeof onClose === 'function') {
        try { onClose(); } catch (err) { console.error('Error on sheet close callback:', err); }
      }
    }

    const expandBtn = sheet.querySelector('#sheet-expand-btn');
    function toggleExpand() {
      const currentH = sheet.getBoundingClientRect().height;
      const maxH = window.innerHeight * 0.95;
      const isExpanded = currentH >= maxH * 0.9;
      sheet.style.transition = 'height 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), max-height 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
      sheet.classList.remove('expanded');
      if (isExpanded) {
        const resetH = Math.min(window.innerHeight * 0.68, 540);
        sheet.style.height = `${resetH}px`;
        sheet.style.maxHeight = '96vh';
        if (expandBtn) expandBtn.textContent = '⤢';
      } else {
        sheet.style.height = `${maxH}px`;
        sheet.style.maxHeight = '96vh';
        if (expandBtn) expandBtn.textContent = '⤡';
      }
      haptic(20);
    }

    if (expandBtn) expandBtn.onclick = toggleExpand;

    // Arrastrar / deslizar para redimensionar dinámicamente y mantenerse exactamente en la altura soltada
    const handleEl = sheet.querySelector('.sheet-handle');
    const headEl = sheet.querySelector('.sheet-head');
    let isDragging = false;
    let touchStartY = 0;
    let initialSheetHeight = 0;
    let currentDragHeight = 0;

    function startDrag(e) {
      if (!e.touches || !e.touches[0]) return;
      if (e.target.closest('#sheet-close-btn') || e.target.closest('#sheet-expand-btn')) return;
      isDragging = true;
      touchStartY = e.touches[0].clientY;
      initialSheetHeight = sheet.getBoundingClientRect().height;
      currentDragHeight = initialSheetHeight;
      sheet.classList.remove('expanded');
      sheet.style.transition = 'none';
    }

    function moveDrag(e) {
      if (!isDragging || !e.touches || !e.touches[0]) return;
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY - currentY; // Arriba positivo, abajo negativo
      const minH = 180;
      const maxH = window.innerHeight * 0.96;
      currentDragHeight = Math.max(minH, Math.min(initialSheetHeight + deltaY, maxH));
      sheet.style.height = `${currentDragHeight}px`;
      sheet.style.maxHeight = `${currentDragHeight}px`;
      if (e.cancelable) e.preventDefault();
    }

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      sheet.style.transition = 'height 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), max-height 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';

      const touchEndY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
      const deltaY = touchStartY - touchEndY;

      // Si se arrastra hacia abajo con fuerza o la altura final queda muy reducida, cerrar
      if (deltaY < -130 || currentDragHeight < 210) {
        handleClose();
        return;
      }

      // Mantener con total precisión la altura exacta a la que el usuario la ha dejado
      sheet.style.height = `${currentDragHeight}px`;
      sheet.style.maxHeight = '96vh';

      if (expandBtn) {
        const isNearMax = currentDragHeight >= window.innerHeight * 0.88;
        expandBtn.textContent = isNearMax ? '⤡' : '⤢';
      }
      haptic(15);
    }

    [handleEl, headEl].forEach(target => {
      if (!target) return;
      target.addEventListener('touchstart', startDrag, { passive: true });
      target.addEventListener('touchmove', moveDrag, { passive: false });
      target.addEventListener('touchend', endDrag, { passive: true });
      target.addEventListener('touchcancel', endDrag, { passive: true });
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) handleClose();
    });

    const closeBtn = sheet.querySelector('#sheet-close-btn');
    if (closeBtn) closeBtn.onclick = handleClose;

    return backdrop;
  }

  function closeSheet() {
    const backdrop = document.getElementById('active-sheet-backdrop');
    if (!backdrop) return;
    backdrop.id = 'closing-sheet-backdrop';
    backdrop.classList.add('closing');
    setTimeout(() => {
      if (backdrop && backdrop.parentNode) backdrop.remove();
    }, 200);
  }

  /* Modal superpuesto sin cerrar la hoja inferior (Stacked Modal) */
  function openModalDialog(title, bodyHtml, onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">${title}</h3>
          <button type="button" class="icon-btn ghost" id="dialog-close-x" style="width: 32px; height: 32px;">${icon('x', 18)}</button>
        </div>
        <div>${bodyHtml}</div>
        <div style="margin-top: 16px;">
          <button type="button" class="btn block ghost" id="dialog-close-btn">${t('close', 'Cerrar')}</button>
        </div>
      </div>
    `;

    function close() {
      overlay.remove();
      if (typeof onClose === 'function') onClose();
    }

    overlay.querySelector('#dialog-close-x').onclick = close;
    overlay.querySelector('#dialog-close-btn').onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };

    document.body.appendChild(overlay);
    return overlay;
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
        return name.includes(yr);
      });
      if (found) return found;
    }

    // 2. Coincidencia por categoría U (ej: u9, u-9, u12, u 14)
    const uMatch = clean.match(/\bu[-\s]?(\d{1,2})\b/);
    if (uMatch) {
      const uNum = uMatch[1];
      const found = teams.find(t => {
        const name = (t.name || '').toLowerCase();
        const tMatch = name.match(/\bu[-\s]?(\d{1,2})\b/);
        return tMatch && tMatch[1] === uNum;
      });
      if (found) return found;
    }

    // 3. Coincidencia por texto contenido en el nombre del equipo
    const foundDirect = teams.find(t => {
      const name = (t.name || '').toLowerCase();
      return name.includes(clean) || clean.includes(name);
    });
    if (foundDirect) return foundDirect;

    return null;
  }
  window.matchTeamByText = matchTeamByText;

  /* =========================================================
     DATE PICKER Y CALENDARIO INTERACTIVO
     ========================================================= */
  window.__datePickerCallbacks = window.__datePickerCallbacks || {};
  window.__onNativeDatePicked = function(callbackId, dateStr) {
    if (window.__datePickerCallbacks && window.__datePickerCallbacks[callbackId]) {
      try {
        window.__datePickerCallbacks[callbackId](dateStr);
      } finally {
        delete window.__datePickerCallbacks[callbackId];
      }
    }
  };

  function formatDisplayDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).trim().split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    return isoStr;
  }

  function formatConvocationDateWithDay(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);

      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const lang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : (localStorage.getItem('lang') || 'en');
      const dayName = (lang === 'en' ? daysEn : daysEs)[dateObj.getDay()] || '';
      const dayPad = String(d).padStart(2, '0');
      const monthPad = String(m + 1).padStart(2, '0');
      return `${dayName}, ${dayPad}/${monthPad}/${y}`;
    }
    return isoStr;
  }

  function parseInputDateToIso(displayStr) {
    if (!displayStr) return new Date().toISOString().slice(0, 10);
    const clean = String(displayStr).trim();
    // DD/MM/AAAA o DD-MM-AAAA o DD.MM.AAAA
    const m1 = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (m1) {
      const d = m1[1].padStart(2, '0');
      const m = m1[2].padStart(2, '0');
      const y = m1[3];
      return `${y}-${m}-${d}`;
    }
    // AAAA-MM-DD
    const m2 = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (m2) {
      const y = m2[1];
      const m = m2[2].padStart(2, '0');
      const d = m2[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return clean;
  }

  function openDatePicker(initialDate, onSelect, options) {
    const iso = initialDate ? parseInputDateToIso(initialDate) : '';
    openCalendarModal(iso, onSelect, options);
  }

  function openCalendarModal(initialDate, onSelect, options) {
    const opts = options || {};
    const now = new Date();
    const iso = initialDate ? parseInputDateToIso(initialDate) : '';
    let curYear, curMonth, curDay;
    if (iso && iso.includes('-')) {
      const parts = iso.split('-');
      curYear = parseInt(parts[0], 10) || now.getFullYear();
      curMonth = (parseInt(parts[1], 10) || 1) - 1;
      curDay = parseInt(parts[2], 10) || 1;
    } else if (opts.isBirthDate) {
      curYear = now.getFullYear() - 12;
      curMonth = 0;
      curDay = 1;
    } else {
      curYear = now.getFullYear();
      curMonth = now.getMonth();
      curDay = now.getDate();
    }

    let viewYear = curYear;
    let viewMonth = curMonth;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const monthNamesEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekdaysEs = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
    const weekdaysEn = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    const isEn = I18N.getLang() === 'en';
    const monthNames = isEn ? monthNamesEn : monthNamesEs;
    const weekdays = isEn ? weekdaysEn : weekdaysEs;

    function renderContent() {
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Lunes = 0
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDate = today.getDate();

      let daysHtml = '';

      for (let i = firstDayIndex - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        daysHtml += `<div class="calendar-day-cell other-month" data-action="prev-month" data-d="${d}">${d}</div>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const isSelected = (viewYear === curYear && viewMonth === curMonth && d === curDay);
        const isToday = (viewYear === todayYear && viewMonth === todayMonth && d === todayDate);
        let cls = 'calendar-day-cell current-month';
        if (isSelected) cls += ' selected';
        if (isToday) cls += ' today';
        const inlineStyle = isSelected
          ? 'style="background: linear-gradient(135deg, #06b6d4, #2563eb) !important; color: #ffffff !important; font-weight: 900 !important; border: 2px solid #ffffff !important; box-shadow: 0 0 16px rgba(6, 182, 212, 0.75), 0 3px 8px rgba(0, 0, 0, 0.5) !important; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6) !important; transform: scale(1.06) !important;"'
          : (isToday ? 'style="border: 1.5px solid rgba(34, 211, 238, 0.7) !important; color: #38bdf8 !important; background: rgba(34, 211, 238, 0.12) !important; font-weight: 800 !important;"' : '');
        daysHtml += `<div class="${cls}" data-action="select" data-d="${d}" ${inlineStyle}>${d}</div>`;
      }

      const totalCells = firstDayIndex + daysInMonth;
      const nextDays = (7 - (totalCells % 7)) % 7;
      for (let d = 1; d <= nextDays; d++) {
        daysHtml += `<div class="calendar-day-cell other-month" data-action="next-month" data-d="${d}">${d}</div>`;
      }

      const minYear = 1960;
      const maxYear = todayYear + 5;
      let yearOptionsHtml = '';
      for (let y = maxYear; y >= minYear; y--) {
        yearOptionsHtml += `<option value="${y}" ${y === viewYear ? 'selected' : ''}>${y}</option>`;
      }

      let monthOptionsHtml = '';
      for (let m = 0; m < 12; m++) {
        monthOptionsHtml += `<option value="${m}" ${m === viewMonth ? 'selected' : ''}>${monthNames[m]}</option>`;
      }

      overlay.innerHTML = `
        <div class="calendar-modal">
          <div class="calendar-header" style="gap: 6px;">
            <button type="button" class="calendar-nav-btn" id="cal-prev" title="Mes anterior">‹</button>
            <div class="calendar-title" style="display: flex; align-items: center; justify-content: center; gap: 6px; flex: 1;">
              <select id="cal-select-month" style="background: rgba(15, 23, 42, 0.85); color: #fff; border: 1.5px solid rgba(56, 189, 248, 0.45); border-radius: 8px; padding: 5px 8px; font-size: 13.5px; font-weight: 800; cursor: pointer;">
                ${monthOptionsHtml}
              </select>
              <select id="cal-select-year" style="background: rgba(15, 23, 42, 0.85); color: #38bdf8; border: 1.5px solid rgba(56, 189, 248, 0.45); border-radius: 8px; padding: 5px 8px; font-size: 13.5px; font-weight: 900; cursor: pointer;">
                ${yearOptionsHtml}
              </select>
            </div>
            <button type="button" class="calendar-nav-btn" id="cal-next" title="Mes siguiente">›</button>
          </div>

          <div class="calendar-weekdays">
            ${weekdays.map(w => `<div class="calendar-weekday">${w}</div>`).join('')}
          </div>

          <div class="calendar-days-grid" id="cal-days-grid">
            ${daysHtml}
          </div>

          ${opts.isBirthDate ? '' : `
          <div class="calendar-shortcuts">
            <button type="button" class="calendar-shortcut-btn" id="cal-btn-today">⚡ ${t('today', 'Hoy')}</button>
            <button type="button" class="calendar-shortcut-btn" id="cal-btn-tomorrow">⏩ ${t('tomorrow', 'Mañana')}</button>
            <button type="button" class="calendar-shortcut-btn" id="cal-btn-yesterday">⏪ ${t('yesterday', 'Ayer')}</button>
          </div>
          `}

          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button type="button" class="btn ghost block" id="cal-btn-cancel">${t('cancel', 'Cancelar')}</button>
          </div>
        </div>
      `;

      const monthSel = overlay.querySelector('#cal-select-month');
      const yearSel = overlay.querySelector('#cal-select-year');
      if (monthSel) {
        monthSel.onchange = (e) => {
          e.stopPropagation();
          viewMonth = parseInt(monthSel.value, 10);
          renderContent();
        };
      }
      if (yearSel) {
        yearSel.onchange = (e) => {
          e.stopPropagation();
          viewYear = parseInt(yearSel.value, 10);
          renderContent();
        };
      }

      overlay.querySelector('#cal-prev').onclick = (e) => {
        e.stopPropagation();
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderContent();
      };

      overlay.querySelector('#cal-next').onclick = (e) => {
        e.stopPropagation();
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderContent();
      };

      const btnToday = overlay.querySelector('#cal-btn-today');
      if (btnToday) {
        btnToday.onclick = (e) => {
          e.stopPropagation();
          const tNow = new Date();
          const isoStr = String(tNow.getFullYear()) + '-' + String(tNow.getMonth() + 1).padStart(2, '0') + '-' + String(tNow.getDate()).padStart(2, '0');
          finish(isoStr);
        };
      }

      const btnTomorrow = overlay.querySelector('#cal-btn-tomorrow');
      if (btnTomorrow) {
        btnTomorrow.onclick = (e) => {
          e.stopPropagation();
          const tNow = new Date();
          tNow.setDate(tNow.getDate() + 1);
          const isoStr = String(tNow.getFullYear()) + '-' + String(tNow.getMonth() + 1).padStart(2, '0') + '-' + String(tNow.getDate()).padStart(2, '0');
          finish(isoStr);
        };
      }

      const btnYesterday = overlay.querySelector('#cal-btn-yesterday');
      if (btnYesterday) {
        btnYesterday.onclick = (e) => {
          e.stopPropagation();
          const tNow = new Date();
          tNow.setDate(tNow.getDate() - 1);
          const isoStr = String(tNow.getFullYear()) + '-' + String(tNow.getMonth() + 1).padStart(2, '0') + '-' + String(tNow.getDate()).padStart(2, '0');
          finish(isoStr);
        };
      }

      overlay.querySelector('#cal-btn-cancel').onclick = (e) => {
        e.stopPropagation();
        overlay.remove();
      };

      overlay.querySelector('#cal-days-grid').onclick = (e) => {
        const cell = e.target.closest('.calendar-day-cell');
        if (!cell) return;
        const act = cell.getAttribute('data-action');
        const dayNum = parseInt(cell.getAttribute('data-d'), 10);
        if (act === 'select') {
          const isoStr = String(viewYear) + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
          finish(isoStr);
        } else if (act === 'prev-month') {
          viewMonth--;
          if (viewMonth < 0) { viewMonth = 11; viewYear--; }
          const isoStr = String(viewYear) + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
          finish(isoStr);
        } else if (act === 'next-month') {
          viewMonth++;
          if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          const isoStr = String(viewYear) + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
          finish(isoStr);
        }
      };
    }

    function finish(selectedIso) {
      overlay.remove();
      if (typeof onSelect === 'function') {
        onSelect(selectedIso);
      }
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
    renderContent();
  }

  function renderDatePickerFieldHtml(id, initialIsoDate, label) {
    const iso = initialIsoDate || new Date().toISOString().slice(0, 10);
    const displayVal = formatDisplayDate(iso);
    return `
      <div class="field">
        <label>${label || t('date')}</label>
        <div class="date-picker-group">
          <div class="date-picker-input-wrapper">
            <input type="text" id="${id}-text" value="${displayVal}" placeholder="DD/MM/AAAA" autocomplete="off" />
            <span class="date-picker-icon" id="${id}-icon" title="${t('openCalendar', 'Abrir calendario')}">📅</span>
          </div>
          <button type="button" class="btn-open-calendar" id="${id}-cal-btn" title="${t('openCalendar', 'Abrir calendario')}">
            <span>📅</span>
            <span>${t('calendar', 'Calendario')}</span>
          </button>
          <input type="hidden" id="${id}" value="${iso}" />
        </div>
      </div>
    `;
  }

  function bindDatePickerField(prefix, container) {
    const root = container || document;
    const textInp = root.querySelector('#' + prefix + '-text');
    const hiddenInp = root.querySelector('#' + prefix);
    const calBtn = root.querySelector('#' + prefix + '-cal-btn');
    const iconSpan = root.querySelector('#' + prefix + '-icon');

    function updateBoth(isoVal) {
      if (!isoVal) return;
      const cleanIso = parseInputDateToIso(isoVal);
      if (hiddenInp) hiddenInp.value = cleanIso;
      if (textInp) textInp.value = formatDisplayDate(cleanIso);
    }

    if (textInp) {
      textInp.oninput = () => {
        const parsed = parseInputDateToIso(textInp.value);
        if (parsed && parsed.length === 10 && hiddenInp) {
          hiddenInp.value = parsed;
        }
      };
      textInp.onblur = () => {
        const parsed = parseInputDateToIso(textInp.value);
        if (parsed && hiddenInp) {
          hiddenInp.value = parsed;
          textInp.value = formatDisplayDate(parsed);
        }
      };
    }

    const handleOpenCal = () => {
      const cur = hiddenInp ? hiddenInp.value : (textInp ? textInp.value : '');
      openDatePicker(cur, (newIso) => {
        updateBoth(newIso);
        haptic(25);
      });
    };

    if (calBtn) calBtn.onclick = handleOpenCal;
    if (iconSpan) iconSpan.onclick = handleOpenCal;
  }

  /* =========================================================
     TIME PICKER INTERACTIVO Y NATIVO (ANDROID & WEB/PWA)
     ========================================================= */
  const _timePickerCallbacks = {};
  window.__onNativeTimePicked = function(cbId, selectedTime) {
    if (_timePickerCallbacks[cbId]) {
      _timePickerCallbacks[cbId](selectedTime);
      delete _timePickerCallbacks[cbId];
    }
  };

  function addMinutesToTime(timeStr, minutes) {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    let totalMins = h * 60 + m + (parseInt(minutes, 10) || 0);
    while (totalMins < 0) totalMins += 24 * 60;
    totalMins = totalMins % (24 * 60);
    const newH = Math.floor(totalMins / 60);
    const newM = totalMins % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  function diffMinutesBetweenTimes(startStr, endStr, fallbackDur = 90) {
    if (!startStr || !endStr) return fallbackDur;
    const [h1, m1] = startStr.split(':').map(x => parseInt(x, 10) || 0);
    const [h2, m2] = endStr.split(':').map(x => parseInt(x, 10) || 0);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }

  function openTimePicker(initialTime, onSelect) {
    let curTime = (initialTime && /^\d{1,2}:\d{2}$/.test(String(initialTime).trim()))
      ? String(initialTime).trim()
      : '10:00';
    if (curTime.length === 4 && curTime.indexOf(':') === 1) {
      curTime = '0' + curTime;
    }

    // 1. Si estamos en Android nativo (Coach APK), usar el TimePickerDialog nativo de Android
    if (window.AndroidBridge && typeof window.AndroidBridge.pickTime === 'function') {
      const cbId = 'tp_' + Math.random().toString(36).slice(2, 9);
      _timePickerCallbacks[cbId] = onSelect;
      window.AndroidBridge.pickTime(curTime, cbId);
      return;
    }

    // 2. Fallback Web / PWA: selector interactivo de horas y minutos
    openWebTimePickerModal(curTime, onSelect);
  }

  function openWebTimePickerModal(initialTime, onSelect) {
    const parts = (initialTime || '10:00').split(':');
    let selH = parseInt(parts[0], 10);
    if (isNaN(selH) || selH < 0 || selH > 23) selH = 10;
    let selM = parseInt(parts[1], 10);
    if (isNaN(selM) || selM < 0 || selM > 59) selM = 0;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    function pad(n) { return String(n).padStart(2, '0'); }

    function renderContent() {
      const formatted = `${pad(selH)}:${pad(selM)}`;
      overlay.innerHTML = `
        <div class="dialog-box" style="max-width: 360px; width: 92%; padding: 20px; text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">⏰ ${t('pickTime', 'Seleccionar Hora')}</h3>
            <button type="button" class="icon-btn ghost" id="time-dlg-close" style="width: 30px; height: 30px;">✕</button>
          </div>

          <div style="font-size: 38px; font-weight: 900; color: var(--cyan); letter-spacing: 2px; margin: 10px 0 16px; background: var(--bg2); padding: 12px; border-radius: 14px; border: 1.5px solid var(--border);">
            ${formatted}
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; text-align: left;">
              ${t('hours', 'Hora')}:
            </div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; max-height: 120px; overflow-y: auto; padding: 2px;">
              ${Array.from({ length: 24 }, (_, i) => i).map(h => `
                <button type="button" class="btn sm ${h === selH ? 'primary' : 'ghost'}" data-h="${h}" style="padding: 6px 0; font-weight: 800; font-size: 12px; border-radius: 8px;">
                  ${pad(h)}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom: 18px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; text-align: left;">
              ${t('minutes', 'Minutos')}:
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => `
                <button type="button" class="btn sm ${m === selM ? 'primary' : 'ghost'}" data-m="${m}" style="padding: 6px 0; font-weight: 800; font-size: 12px; border-radius: 8px;">
                  :${pad(m)}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="btn-row" style="display: flex; gap: 8px;">
            <button type="button" class="btn ghost grow" id="time-dlg-cancel">${t('cancel', 'Cancelar')}</button>
            <button type="button" class="btn primary grow" id="time-dlg-ok" style="font-weight: 800;">✓ ${t('save', 'Aceptar')}</button>
          </div>
        </div>
      `;

      overlay.querySelector('#time-dlg-close').onclick = () => overlay.remove();
      overlay.querySelector('#time-dlg-cancel').onclick = () => overlay.remove();
      overlay.querySelector('#time-dlg-ok').onclick = () => {
        const finalTime = `${pad(selH)}:${pad(selM)}`;
        overlay.remove();
        if (typeof onSelect === 'function') onSelect(finalTime);
      };

      overlay.querySelectorAll('[data-h]').forEach(btn => {
        btn.onclick = () => {
          selH = parseInt(btn.getAttribute('data-h'), 10);
          renderContent();
        };
      });

      overlay.querySelectorAll('[data-m]').forEach(btn => {
        btn.onclick = () => {
          selM = parseInt(btn.getAttribute('data-m'), 10);
          renderContent();
        };
      });
    }

    renderContent();
    document.body.appendChild(overlay);
  }

  function renderTimePickerFieldHtml(id, initialTime, label) {
    const curVal = initialTime || '10:00';
    return `
      <div class="field">
        <label>⏰ ${label || t('time', 'Hora')}</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" id="${id}" value="${curVal}" placeholder="HH:MM" style="flex: 1; font-weight: 800; font-size: 15px; letter-spacing: 1px; cursor: pointer;" readonly />
          <button type="button" class="btn sm" id="${id}-btn" style="background: var(--surface2); color: var(--cyan); border: 1.5px solid var(--border); font-size: 13px; font-weight: 800; height: 42px; padding: 0 14px; white-space: nowrap; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            ⏰ ${t('pickTime', 'Elegir')}
          </button>
        </div>
      </div>
    `;
  }

  function bindTimePickerField(id, container, onChange) {
    const root = container || document;
    const inp = root.querySelector('#' + id);
    const btn = root.querySelector('#' + id + '-btn');

    const handleOpen = () => {
      const cur = inp ? inp.value.trim() : '10:00';
      openTimePicker(cur, (newTime) => {
        if (inp) {
          inp.value = newTime;
          inp.dispatchEvent(new Event('change'));
        }
        if (typeof onChange === 'function') onChange(newTime);
      });
    };

    if (btn) btn.onclick = handleOpen;
    if (inp) inp.onclick = handleOpen;
  }

  function confirmDialog(title, message, onConfirm, okText, okClass) {
    openSheet(title, (body) => {
      body.innerHTML = `
        <div class="confirm-body">
          <div class="c-ic">⚠️</div>
          <p>${message}</p>
        </div>
      `;
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="confirm-cancel">${t('cancel', 'Cancelar')}</button>
          <button class="btn ${okClass || 'danger'}" id="confirm-ok">${okText || t('delete', 'Eliminar')}</button>
        </div>
      `;
      foot.querySelector('#confirm-cancel').onclick = closeSheet;
      foot.querySelector('#confirm-ok').onclick = () => {
        closeSheet();
        onConfirm();
      };
    });
  }

  function renderAvatar(player, sizeClass) {
    const cls = sizeClass ? 'avatar ' + sizeClass : 'avatar';
    if (!player) return `<div class="${cls}"><span>?</span></div>`;
    const initial = (player.name ? player.name[0] : (player.nickname ? player.nickname[0] : 'J')).toUpperCase();
    const dorsalHtml = player.mainDorsal != null ? `<span class="dorsal">${player.mainDorsal}</span>` : '';
    
    let photo = player.photo;
    if ((!photo || photo.length < 50) && player.id && window.CacheDB && window.CacheDB.getPhotoSync) {
      const cached = window.CacheDB.getPhotoSync(player.id);
      if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
        photo = cached.dataUrl;
        player.photo = photo;
      }
    }

    if (photo && photo.length > 50) {
      return `<div class="${cls}"><img src="${photo}" alt="" loading="lazy" />${dorsalHtml}</div>`;
    }
    return `<div class="${cls}"><span>${initial}</span>${dorsalHtml}</div>`;
  }

  function getPlayerFootLabel(footVal) {
    if (!footVal) return t('footRight', 'Diestro');
    const f = String(footVal).toLowerCase();
    if (f.includes('zurdo') || f.includes('left')) return t('footLeft', 'Zurdo');
    if (f.includes('ambi') || f.includes('both')) return (t('footBoth') || t('footAmbi') || 'Ambidiestro');
    return t('footRight', 'Diestro');
  }

  /* =========================================================
     CENTRO DE NOTIFICACIONES Y GESTIÓN DE SOLICITUDES
     ========================================================= */
  function updateBadgeCountersOnly() {
    const unreadCount = NotifManager.getUnreadCount();
    const reqsCount = (pendingProfileRequests || []).length + (pendingPlayerCreationRequests || []).length + (pendingProfileClaimRequests || []).length;
    const count = Math.max(unreadCount, reqsCount);
    document.querySelectorAll('#requests-badge').forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    });

    const homeTabBtns = document.querySelectorAll('#tabbar [data-tab="home"], #portal-tabbar [data-tab="home"]');
    homeTabBtns.forEach(homeTabBtn => {
      let dot = homeTabBtn.querySelector('.home-notif-dot');
      if (count > 0) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'home-notif-dot';
          dot.style.cssText = 'position: absolute; top: 4px; right: calc(50% - 16px); width: 10px; height: 10px; border-radius: 50%; background: #22d3ee; border: 2px solid #0f172a; box-shadow: 0 0 6px #22d3ee; pointer-events: none; z-index: 5;';
          homeTabBtn.style.position = 'relative';
          homeTabBtn.appendChild(dot);
        }
      } else {
        if (dot) dot.remove();
      }
    });
  }

  const DismissedNotifs = {
    getAll() {
      try {
        const raw = localStorage.getItem('coach_dismissed_notifs_v1');
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) {
        return new Set();
      }
    },
    add(id) {
      if (!id) return;
      const set = this.getAll();
      set.add(id);
      try {
        localStorage.setItem('coach_dismissed_notifs_v1', JSON.stringify(Array.from(set).slice(-200)));
      } catch (e) {}
    },
    remove(id) {
      if (!id) return;
      const set = this.getAll();
      set.delete(id);
      try {
        localStorage.setItem('coach_dismissed_notifs_v1', JSON.stringify(Array.from(set).slice(-200)));
      } catch (e) {}
    },
    has(id) {
      return this.getAll().has(id);
    }
  };

  // Purga inmediata de notificaciones antiguas (más de 36 horas o de convocatorias pasadas)
  function purgeOldNotifications() {
    try {
      const raw = localStorage.getItem('coach_notifications_v2');
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;

      const now = Date.now();
      const todayIso = (typeof getTodayIso === 'function') ? getTodayIso() : new Date().toISOString().slice(0, 10);
      const maxAgeMs = 36 * 3600 * 1000; // 36 horas

      const cleaned = list.filter(n => {
        if (!n) return false;
        // Solicitudes pendientes de perfil se mantienen vivas hasta ser gestionadas
        if (n.type === 'profile_req' || n.type === 'creation_req' || n.type === 'claim_req') {
          return true;
        }
        // Notificaciones de asistencia: descartar si la fecha del evento ya pasó (< hoy) o si tienen >36h
        if (n.type === 'attendance') {
          if (n.targetId && window.Store && typeof Store.convocation === 'function') {
            const conv = Store.convocation(n.targetId);
            if (conv && conv.date && conv.date < todayIso) return false;
          }
          if (n.time && (now - n.time > maxAgeMs)) return false;
        }
        // Cualquier otra notificación con más de 48 horas se elimina
        if (n.time && (now - n.time > 48 * 3600 * 1000)) return false;
        return true;
      });

      if (cleaned.length !== list.length) {
        localStorage.setItem('coach_notifications_v2', JSON.stringify(cleaned));
      }
    } catch (e) {}
  }

  const NotifManager = {
    getAll() {
      try {
        purgeOldNotifications();
        const raw = localStorage.getItem('coach_notifications_v2');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },
    save(list) {
      try {
        localStorage.setItem('coach_notifications_v2', JSON.stringify((list || []).slice(0, 80)));
      } catch (e) {}
      // Actualizar badges en DOM sin invocar ciclo recursivo de re-render
      updateBadgeCountersOnly();
    },
    add(notif) {
      const list = this.getAll();
      const existingIdx = list.findIndex(n => n.id === notif.id || (notif.targetId && n.targetId === notif.targetId && n.type === notif.type));
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...notif, time: notif.time || list[existingIdx].time };
      } else {
        list.unshift({
          id: notif.id || 'notif_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          type: notif.type || 'info',
          title: notif.title || '',
          body: notif.body || '',
          time: notif.time || Date.now(),
          read: false,
          targetId: notif.targetId || null
        });
      }
      this.save(list);
    },
    remove(id) {
      if (id) DismissedNotifs.add(id);
      let list = this.getAll();
      list = list.filter(n => n.id !== id);
      this.save(list);
    },
    removeByTarget(targetId) {
      if (!targetId) return;
      DismissedNotifs.add(targetId);
      let list = this.getAll();
      list = list.filter(n => n.targetId !== targetId && n.id !== targetId && n.id !== ('create_' + targetId) && n.id !== ('req_' + targetId) && n.id !== ('chat_' + targetId));
      this.save(list);
    },
    markAsRead(id) {
      const list = this.getAll();
      const item = list.find(n => n.id === id || n.targetId === id);
      if (item) item.read = true;
      this.save(list);
    },
    markAllAsRead() {
      const list = this.getAll();
      list.forEach(n => { n.read = true; });
      this.save(list);
    },
    clearAll() {
      const list = this.getAll();
      list.forEach(n => { if (n.id) DismissedNotifs.add(n.id); });
      this.save([]);
    },
    getUnreadCount() {
      return this.getAll().filter(n => !n.read).length;
    }
  };

  // Sincroniza SOLO respuestas de convocatorias ACTIVAS (hoy o futuras, dentro de 24h)
  function syncAttendanceNotificationsFromConvocations() {
    if (!window.Store || !Store.state || !Array.isArray(Store.state.convocations)) return;
    const now = Date.now();
    const todayIso = (typeof getTodayIso === 'function') ? getTodayIso() : new Date().toISOString().slice(0, 10);
    const recentCutoff = now - (24 * 3600 * 1000); // Solo respuestas de las últimas 24h

    const existingList = NotifManager.getAll();
    const existingMap = new Map(existingList.map(n => [n.id, n]));

    Store.state.convocations.forEach(conv => {
      if (!conv || !conv.responses) return;
      // NUNCA generar notificaciones para eventos pasados (< hoy)
      if (!conv.date || conv.date < todayIso) return;

      const convTitle = conv.title || (conv.type === 'match' ? ('vs ' + (conv.rival || 'Rival')) : 'Entrenamiento');

      Object.entries(conv.responses).forEach(([pid, r]) => {
        if (!r) return;
        const status = (typeof r === 'object') ? r.status : r;
        if (!status || status === 'pending') return;

        const rTime = (typeof r === 'object' && (r.timestamp || r.time)) ? Number(r.timestamp || r.time) : 0;
        // Solo considerar respuestas con timestamp válido emitidas en las últimas 24 horas
        if (!rTime || (now - rTime > recentCutoff)) return;

        const notifId = 'att_' + (conv.id || 'c') + '_' + pid;
        if (DismissedNotifs.has(notifId)) return;

        const isAttending = (status === 'called' || status === 'attending' || status === 'yes');
        const p = Store.player(pid);
        const pName = (typeof r === 'object' && r.playerName) || (p ? (Store.playerName ? Store.playerName(p) : (p.name || 'Jugador')) : 'Jugador');
        const notes = (typeof r === 'object' && r.notes) ? r.notes : '';

        const timeFormatted = window.formatAttendanceDateTime ? window.formatAttendanceDateTime(rTime || now) : '';
        const notifTitle = isAttending ? `🟢 Asistencia confirmada` : `❌ Baja comunicada`;
        const notifBody = `${pName} • ${convTitle}${timeFormatted ? ' (' + timeFormatted + ')' : ''}${notes ? ' - ' + notes : ''}`;

        const existing = existingMap.get(notifId);
        if (!existing) {
          NotifManager.add({
            id: notifId,
            type: 'attendance',
            title: notifTitle,
            body: notifBody,
            targetId: conv.id,
            time: rTime || now,
            read: false
          });
        } else if (existing.title !== notifTitle || existing.body !== notifBody) {
          NotifManager.add({
            ...existing,
            title: notifTitle,
            body: notifBody,
            time: rTime || now
          });
        }
      });
    });
  }

  window.NotifManager = NotifManager;

  // Compatibilidad universal e inmediata para llamadas Sync.push()
  window.Sync = {
    push: function () {
      if (window.Cloud && window.Cloud.pushCoachState && window.Store) {
        window.Cloud.pushCoachState(window.Store.state, true);
      }
    }
  };

  function getPersistentNotifiedSet(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  function savePersistentNotifiedSet(storageKey, setInstance) {
    try {
      const arr = Array.from(setInstance).slice(-300);
      localStorage.setItem(storageKey, JSON.stringify(arr));
    } catch (e) {}
  }

  let pendingProfileRequests = [];
  let knownProfileRequestIds = getPersistentNotifiedSet('ps_notified_profile_req_ids');
  let isFirstRequestsSnapshot = true;

  let pendingPlayerCreationRequests = [];
  let knownPlayerCreationRequestIds = getPersistentNotifiedSet('ps_notified_creation_req_ids');
  let isFirstCreationRequestsSnapshot = true;

  let pendingProfileClaimRequests = [];
  let knownProfileClaimRequestIds = getPersistentNotifiedSet('ps_notified_claim_ids');
  let isFirstClaimRequestsSnapshot = true;

  function updateRequestsBadge() {
    const unreadCount = NotifManager.getUnreadCount();
    const reqsCount = (pendingProfileRequests || []).length + (pendingPlayerCreationRequests || []).length + (pendingProfileClaimRequests || []).length;
    const count = Math.max(unreadCount, reqsCount);
    document.querySelectorAll('#requests-badge').forEach(badge => {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    });

    // Indicador en el botón de la pestaña Home en la barra de navegación inferior
    const homeTabBtns = document.querySelectorAll('#tabbar [data-tab="home"], #portal-tabbar [data-tab="home"]');
    homeTabBtns.forEach(homeTabBtn => {
      let dot = homeTabBtn.querySelector('.home-notif-dot');
      if (count > 0) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'home-notif-dot';
          dot.style.cssText = 'position: absolute; top: 4px; right: calc(50% - 16px); width: 10px; height: 10px; border-radius: 50%; background: #22d3ee; border: 2px solid #0f172a; box-shadow: 0 0 6px #22d3ee; pointer-events: none; z-index: 5;';
          homeTabBtn.style.position = 'relative';
          homeTabBtn.appendChild(dot);
        }
      } else {
        if (dot) dot.remove();
      }
    });

    // Actualizar en tiempo real el Centro de Notificaciones en Inicio si la pantalla actual es Home
    if (typeof refreshHomeNotifications === 'function') {
      refreshHomeNotifications();
    }
  }

  function handleIncomingProfileRequests(requests) {
    pendingProfileRequests = requests || [];
    const validIds = new Set((requests || []).map(r => r.id));

    // Limpiar notificaciones obsoletas que ya no estén pendientes
    let stored = NotifManager.getAll();
    stored = stored.filter(n => {
      if (n.type === 'profile_req' && !validIds.has(n.targetId)) return false;
      return true;
    });
    NotifManager.save(stored);

    // Registrar en el Centro de Notificaciones
    (requests || []).forEach(r => {
      NotifManager.add({
        id: 'req_' + r.id,
        type: 'profile_req',
        title: t('profileRequests', 'Solicitud de cambio de perfil'),
        body: `${r.fromPlayerName || 'Jugador'} ➔ ${r.toPlayerName || 'Nuevo perfil'}`,
        targetId: r.id,
        time: r.createdAt || Date.now()
      });
    });

    updateRequestsBadge();

    const now = Date.now();
    if (!isFirstRequestsSnapshot) {
      (requests || []).forEach(r => {
        const reqId = String(r.id || 'unknown');
        const reqTimeMs = (r.createdAt && typeof r.createdAt.toMillis === 'function')
          ? r.createdAt.toMillis()
          : (r.createdAt && r.createdAt.seconds ? r.createdAt.seconds * 1000 : (Number(r.createdAt) || 0));
        const isRecent = reqTimeMs > 0 ? (now - reqTimeMs < 5 * 60 * 1000) : false;

        if (isRecent && !knownProfileRequestIds.has(reqId)) {
          knownProfileRequestIds.add(reqId);
          savePersistentNotifiedSet('ps_notified_profile_req_ids', knownProfileRequestIds);

          const reqPlayerName = r.toPlayerName || 'Jugador';
          toast(`🔔 ${t('newProfileRequest', 'Nueva solicitud de cambio de perfil')}: ${reqPlayerName}`, 'info', () => showNotificationsCenterModal());
          haptic(50);
          if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
            try { window.AndroidBridge.showSystemNotification('Player Stats', `Nueva solicitud de perfil: ${reqPlayerName}`, 'prof_' + reqId); } catch(e) {}
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Player Stats', { body: `Nueva solicitud de perfil: ${reqPlayerName}`, icon: 'icons/icon-192.png', tag: 'prof_' + reqId }); } catch(e) {}
          }
        } else {
          knownProfileRequestIds.add(reqId);
        }
      });
      savePersistentNotifiedSet('ps_notified_profile_req_ids', knownProfileRequestIds);
    } else {
      (requests || []).forEach(r => {
        if (r.id) knownProfileRequestIds.add(String(r.id));
      });
      savePersistentNotifiedSet('ps_notified_profile_req_ids', knownProfileRequestIds);
    }
    isFirstRequestsSnapshot = false;
  }

  function handleIncomingPlayerCreationRequests(requests) {
    pendingPlayerCreationRequests = requests || [];
    const validIds = new Set((requests || []).map(r => r.id));

    // Limpiar notificaciones obsoletas que ya no estén pendientes
    let stored = NotifManager.getAll();
    stored = stored.filter(n => {
      if (n.type === 'creation_req' && !validIds.has(n.targetId)) return false;
      return true;
    });
    NotifManager.save(stored);

    // Registrar en el Centro de Notificaciones
    (requests || []).forEach(cr => {
      NotifManager.add({
        id: 'create_' + cr.id,
        type: 'creation_req',
        title: t('requestCoachProfileTitle', 'Solicitud de alta de jugador'),
        body: `${cr.name || 'Nuevo jugador'} (${cr.dorsal ? '#' + cr.dorsal + ' - ' : ''}${cr.position || 'Jugador'})`,
        targetId: cr.id,
        time: cr.createdAt || Date.now()
      });
    });

    updateRequestsBadge();

    const now = Date.now();
    if (!isFirstCreationRequestsSnapshot) {
      (requests || []).forEach(r => {
        const createId = String(r.id || 'unknown');
        const reqTimeMs = (r.createdAt && typeof r.createdAt.toMillis === 'function')
          ? r.createdAt.toMillis()
          : (r.createdAt && r.createdAt.seconds ? r.createdAt.seconds * 1000 : (Number(r.createdAt) || 0));
        const isRecent = reqTimeMs > 0 ? (now - reqTimeMs < 5 * 60 * 1000) : false;

        if (isRecent && !knownPlayerCreationRequestIds.has(createId)) {
          knownPlayerCreationRequestIds.add(createId);
          savePersistentNotifiedSet('ps_notified_creation_req_ids', knownPlayerCreationRequestIds);

          const reqPlayerName = r.name || 'Nuevo Jugador';
          toast(`➕ ${t('requestCoachProfileTitle', 'Solicitud de alta de jugador')}: ${reqPlayerName}`, 'info', () => showNotificationsCenterModal());
          haptic(50);
          if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
            try { window.AndroidBridge.showSystemNotification('Player Stats', `Solicitud de alta: ${reqPlayerName}`, 'create_' + createId); } catch(e) {}
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Player Stats', { body: `Solicitud de alta: ${reqPlayerName}`, icon: 'icons/icon-192.png', tag: 'create_' + createId }); } catch(e) {}
          }
        } else {
          knownPlayerCreationRequestIds.add(createId);
        }
      });
      savePersistentNotifiedSet('ps_notified_creation_req_ids', knownPlayerCreationRequestIds);
    } else {
      (requests || []).forEach(r => {
        if (r.id) knownPlayerCreationRequestIds.add(String(r.id));
      });
      savePersistentNotifiedSet('ps_notified_creation_req_ids', knownPlayerCreationRequestIds);
    }
    isFirstCreationRequestsSnapshot = false;
  }

  function handleIncomingProfileClaimRequests(requests) {
    // Deduplicar solicitudes por targetPlayerId, conservando únicamente la más reciente por jugador
    const latestMap = new Map();
    (requests || []).forEach(r => {
      const key = r.targetPlayerId || r.id;
      if (!latestMap.has(key) || (r.createdAt || 0) > (latestMap.get(key).createdAt || 0)) {
        latestMap.set(key, r);
      }
    });
    const dedupedRequests = Array.from(latestMap.values());
    pendingProfileClaimRequests = dedupedRequests;
    const validIds = new Set(dedupedRequests.map(r => r.id));

    let stored = NotifManager.getAll();
    stored = stored.filter(n => {
      if (n.type === 'claim_req' && !validIds.has(n.targetId)) return false;
      return true;
    });
    NotifManager.save(stored);

    dedupedRequests.forEach(cl => {
      const timeMs = (cl.createdAt && typeof cl.createdAt.toMillis === 'function')
        ? cl.createdAt.toMillis()
        : (cl.createdAt && cl.createdAt.seconds ? cl.createdAt.seconds * 1000 : (Number(cl.createdAt) || Date.now()));
      const timeDisplay = formatRequestTime(timeMs);
      NotifManager.add({
        id: 'claim_' + cl.id,
        type: 'claim_req',
        title: t('profileClaimRequestTitle', '🔐 Solicitud de acceso a perfil'),
        body: `${cl.targetPlayerName || 'Jugador'} • ${t('securityCodeTitle', 'Código')}: ${cl.securityCode}${timeDisplay ? ` • 🕒 ${timeDisplay}` : ''}`,
        targetId: cl.id,
        time: timeMs
      });
    });

    updateRequestsBadge();

    const now = Date.now();
    if (!isFirstClaimRequestsSnapshot) {
      dedupedRequests.forEach(r => {
        const claimId = String(r.id || r.targetPlayerId || 'unknown');
        const reqTimeMs = (r.createdAt && typeof r.createdAt.toMillis === 'function')
          ? r.createdAt.toMillis()
          : (r.createdAt && r.createdAt.seconds ? r.createdAt.seconds * 1000 : (Number(r.createdAt) || 0));
        const isRecent = reqTimeMs > 0 ? (now - reqTimeMs < 5 * 60 * 1000) : false;

        // Solo notificar si la solicitud es reciente (< 5 min) y no se ha notificado previamente
        if (isRecent && !knownProfileClaimRequestIds.has(claimId)) {
          knownProfileClaimRequestIds.add(claimId);
          savePersistentNotifiedSet('ps_notified_claim_ids', knownProfileClaimRequestIds);

          const reqPlayerName = r.targetPlayerName || 'Jugador';
          const rTime = formatRequestTime(reqTimeMs || now);
          toast(`🔐 Acceso: ${reqPlayerName} (Código ${r.securityCode})${rTime ? ` [${rTime}]` : ''}`, 'info', () => showNotificationsCenterModal());
          haptic(50);
          if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
            try { window.AndroidBridge.showSystemNotification('Player Stats', `Solicitud de acceso: ${reqPlayerName} (Código ${r.securityCode})${rTime ? ` a las ${rTime}` : ''}`, 'claim_' + claimId); } catch (e) {}
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Player Stats', { body: `Solicitud de acceso: ${reqPlayerName} (Código ${r.securityCode})${rTime ? ` a las ${rTime}` : ''}`, icon: 'icons/icon-192.png', tag: 'claim_' + claimId }); } catch (e) {}
          }
        } else {
          // Si es vieja o ya conocida, guardarla en el conjunto persistente para suprimir spam
          knownProfileClaimRequestIds.add(claimId);
        }
      });
      savePersistentNotifiedSet('ps_notified_claim_ids', knownProfileClaimRequestIds);
    } else {
      // En el snapshot inicial, registrar todas las existentes para que nunca alerten
      dedupedRequests.forEach(r => {
        const claimId = String(r.id || r.targetPlayerId || 'unknown');
        knownProfileClaimRequestIds.add(claimId);
      });
      savePersistentNotifiedSet('ps_notified_claim_ids', knownProfileClaimRequestIds);
    }
    isFirstClaimRequestsSnapshot = false;
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
    const trackerEl = document.getElementById('tracker-fullscreen');
    if (trackerEl) {
      trackerEl.remove();
      return true;
    }
    if (currentTab !== 'home') {
      navigate('home');
      return true;
    }
    return false;
  };

  function clearAndroidSystemNotifications() {
    if (window.AndroidBridge && window.AndroidBridge.clearNotifications) {
      try { window.AndroidBridge.clearNotifications(); } catch (e) {}
    }
  }

  function showProfileRequestsModal() {
    clearAndroidSystemNotifications();
    openSheet(t('profileRequests', 'Solicitudes de Jugadores'), (body) => {
      function renderRequests() {
        const curReqs = pendingProfileRequests || [];
        const curCreations = pendingPlayerCreationRequests || [];
        const curClaims = pendingProfileClaimRequests || [];

        if (!curReqs.length && !curCreations.length && !curClaims.length) {
          body.innerHTML = `
            <div style="text-align: center; padding: 36px 16px; color: var(--muted);">
              <div style="font-size: 36px; margin-bottom: 10px;">🔔</div>
              <h3 style="margin: 0 0 6px; color: #fff; font-size: 15px;">${t('noProfileRequests', 'Sin solicitudes pendientes')}</h3>
              <p style="margin: 0; font-size: 12.5px;">${t('noProfileRequestsDesc', 'Cuando un jugador solicite entrar a un perfil, cambiar de perfil o solicitar alta en el club, aparecerá aquí para que puedas autorizarlo.')}</p>
            </div>
          `;
          return;
        }

        let html = '';

        // 1. Solicitudes de Código de Acceso a Perfil (Seguridad de 6 caracteres)
        if (curClaims.length > 0) {
          html += `
            <div style="font-size: 12.5px; font-weight: 800; color: #facc15; margin-bottom: 8px;">
              🔐 ${t('profileClaimRequestTitle', 'Solicitudes de Acceso a Perfil')} (${curClaims.length})
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
              ${curClaims.map(cl => {
                const claimTimeStr = formatRequestTime(cl.createdAt || cl.serverTime || cl.time);
                return `
                <div class="card" style="padding: 14px; border: 1.5px solid rgba(250, 204, 21, 0.5); border-radius: 14px; background: rgba(250, 204, 21, 0.08);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <b style="font-size: 14.5px; color: #fff;">👤 ${escapeHtml(cl.targetPlayerName || 'Jugador')}</b>
                    <span class="badge" style="background: rgba(250, 204, 21, 0.25); color: #fde047; font-size: 11px; font-weight: 900;">ACCESO</span>
                  </div>
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <div>
                      ${cl.targetPlayerDorsal != null ? `<span>#${escapeHtml(cl.targetPlayerDorsal)}</span> • ` : ''}
                      <span>${t('confirmPlayerIdentity', 'Confirmar identidad del jugador')}</span>
                    </div>
                    ${claimTimeStr ? `<span style="color: #fde047; font-weight: 800; font-size: 11.5px; background: rgba(250, 204, 21, 0.15); padding: 2px 7px; border-radius: 6px;">🕒 ${claimTimeStr}</span>` : ''}
                  </div>
                  <div style="background: var(--bg2); border: 2px dashed #facc15; border-radius: 10px; padding: 10px; text-align: center; margin-bottom: 12px;">
                    <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 2px;">${t('securityCodeTitle', 'Código de Seguridad')}</span>
                    <b style="font-size: 24px; color: #fde047; letter-spacing: 4px; font-family: monospace;">${escapeHtml(cl.securityCode)}</b>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" class="btn sm" data-approve-claim="${cl.id}" style="background: #22c55e; color: #04140a; font-weight: 900; font-size: 12px; height: 38px; border: none;">
                      ${t('authorizeAccess', '✅ Autorizar Acceso')}
                    </button>
                    <button type="button" class="btn sm danger ghost" data-reject-claim="${cl.id}" style="font-weight: 800; font-size: 12px; height: 38px;">
                      ${t('denyAccess', '❌ Denegar')}
                    </button>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          `;
        }

        // 2. Solicitudes de Alta de Nuevo Jugador
        if (curCreations.length > 0) {
          html += `
            <div style="font-size: 12.5px; font-weight: 800; color: var(--cyan); margin-bottom: 8px;">
              ➕ ${t('requestCoachProfileTitle', 'Solicitudes de Alta de Nuevo Jugador')} (${curCreations.length})
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
              ${curCreations.map(cr => {
                const displayName = cr.fullName || [cr.name, cr.lastName].filter(Boolean).join(' ') || cr.name || 'Nuevo Jugador';
                const matchedTeam = (cr.suggestedTeamId && Store.team(cr.suggestedTeamId)) || matchTeamByText(cr.teamText || cr.notes || '', Store.state.teams);
                const teamBadge = matchedTeam ? `<span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #86efac; font-size: 11px; font-weight: 800;">🏷️ ${escapeHtml(matchedTeam.name)}</span>` : '';
                const crTimeStr = formatRequestTime(cr.createdAt || cr.serverTime || cr.time);
                return `
                <div class="card" style="padding: 12px; border: 1.5px solid rgba(34, 211, 238, 0.4); border-radius: 14px; background: rgba(34, 211, 238, 0.06);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div>
                      <b style="font-size: 14px; color: #fff;">👤 ${escapeHtml(displayName)}</b>
                      ${cr.name && cr.lastName ? `<div style="font-size: 11px; color: var(--muted);">${escapeHtml(cr.name)} / ${escapeHtml(cr.lastName)}</div>` : ''}
                    </div>
                    <span class="badge" style="background: rgba(34, 211, 238, 0.2); color: #38bdf8; font-size: 10px; font-weight: 800;">ALTA ${crTimeStr ? '• 🕒 ' + crTimeStr : ''}</span>
                  </div>
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
                    ${cr.dorsal ? `<span>#${escapeHtml(cr.dorsal)}</span> • ` : ''}
                    <span>${escapeHtml(cr.position || 'Jugador')}</span>
                    ${teamBadge ? `<div style="margin-top: 4px;">${teamBadge}</div>` : ''}
                    ${cr.notes ? `<div style="margin-top: 4px; color: #cbd5e1; font-style: italic;">"${escapeHtml(cr.notes)}"</div>` : ''}
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" class="btn sm primary" data-approve-create="${cr.id}" style="font-weight: 900; font-size: 12px; height: 36px;">
                      ✅ Crear Jugador
                    </button>
                    <button type="button" class="btn sm danger ghost" data-reject-create="${cr.id}" style="font-weight: 800; font-size: 12px; height: 36px;">
                      ❌ Denegar
                    </button>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          `;
        }

        // 3. Solicitudes de Cambio de Perfil
        if (curReqs.length > 0) {
          html += `
            <div style="font-size: 12.5px; font-weight: 800; color: #fde047; margin-bottom: 8px;">
              🔄 ${t('profileRequestsDesc', 'Solicitudes de Cambio de Perfil')} (${curReqs.length})
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;" id="profile-requests-list">
              ${curReqs.map(r => {
                const fromPlayer = Store.player(r.fromPlayerId);
                const toPlayer = Store.player(r.toPlayerId);
                const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return `
                  <div class="card" style="padding: 12px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--surface2);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                      <span class="badge" style="background: rgba(250, 204, 21, 0.18); color: #fde047; font-size: 11px; font-weight: 800;">
                        ⏳ ${t('pending', 'Pendiente')} ${dateStr ? '• ' + dateStr : ''}
                      </span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13.5px;">
                      <div style="flex: 1; overflow: hidden;">
                        <small style="display: block; color: var(--muted); font-size: 10.5px; text-transform: uppercase; font-weight: 800;">${t('currentProfile', 'Perfil Actual')}:</small>
                        <b style="color: #cbd5e1; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                          ${escapeHtml(r.fromPlayerName || (fromPlayer ? Store.playerName(fromPlayer) : 'Ninguno'))}
                        </b>
                      </div>
                      <span style="font-size: 18px; color: var(--cyan); font-weight: 900;">➔</span>
                      <div style="flex: 1; overflow: hidden;">
                        <small style="display: block; color: var(--cyan); font-size: 10.5px; text-transform: uppercase; font-weight: 800;">${t('requestedProfile', 'Nuevo Perfil')}:</small>
                        <b style="color: #86efac; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                          ${escapeHtml(r.toPlayerName || (toPlayer ? Store.playerName(toPlayer) : 'Desconocido'))}
                        </b>
                      </div>
                    </div>

                    ${r.securityCode ? `
                      <div style="background: var(--bg2); border: 2px dashed #facc15; border-radius: 10px; padding: 10px; text-align: center; margin-bottom: 10px;">
                        <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 2px;">${t('securityCodeTitle', 'Código de Seguridad')}</span>
                        <b style="font-size: 24px; color: #fde047; letter-spacing: 4px; font-family: monospace;">${escapeHtml(r.securityCode)}</b>
                      </div>
                    ` : ''}

                    ${r.reason ? `
                      <div style="background: var(--bg2); padding: 8px 10px; border-radius: 8px; font-size: 12px; color: #cbd5e1; margin-bottom: 10px; border: 1px dashed var(--border);">
                        💬 <i>"${escapeHtml(r.reason)}"</i>
                      </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                      <button type="button" class="btn sm" data-approve-req="${r.id}" style="background: #22c55e; color: #04140a; font-weight: 900; font-size: 12px; height: 36px; border: none;">
                        ✅ ${t('approve', 'Aprobar')}
                      </button>
                      <button type="button" class="btn sm danger ghost" data-reject-req="${r.id}" style="font-weight: 800; font-size: 12px; height: 36px;">
                        ❌ ${t('reject', 'Denegar')}
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        body.innerHTML = html;

        // Listeners para solicitudes de código de acceso
        body.querySelectorAll('[data-approve-claim]').forEach(btn => {
          btn.onclick = async () => {
            const claimId = btn.getAttribute('data-approve-claim');
            btn.disabled = true;
            btn.textContent = '...';
            try {
              const reqObj = (pendingProfileClaimRequests || []).find(x => x.id === claimId);
              const targetPid = reqObj ? reqObj.targetPlayerId : null;
              if (window.Cloud && window.Cloud.resolveProfileClaimRequest) {
                await window.Cloud.resolveProfileClaimRequest(claimId, 'approved', targetPid);
              }
              if (targetPid) {
                const targetP = Store.player(targetPid);
                if (targetP) {
                  delete targetP.unlinkedAt;
                  Store.save();
                }
                if (window.Cloud && window.Cloud.clearPlayerUnlink) {
                  await window.Cloud.clearPlayerUnlink(targetPid);
                }
                if (window.Cloud && window.Cloud.pushCoachState) {
                  window.Cloud.pushCoachState(Store.state, true);
                }
              }
              pendingProfileClaimRequests = pendingProfileClaimRequests.filter(x => x.id !== claimId);
              NotifManager.removeByTarget(claimId);
              clearAndroidSystemNotifications();
              toast('✅ Acceso autorizado al jugador', 'success');
              haptic(40);
              updateRequestsBadge();
              closeSheet();
            } catch (err) {
              console.error('Error aprobando acceso:', err);
              toast('Error: ' + err.message, 'error');
              btn.disabled = false;
              btn.textContent = t('authorizeAccess', '✅ Autorizar Acceso');
            }
          };
        });

        body.querySelectorAll('[data-reject-claim]').forEach(btn => {
          btn.onclick = async () => {
            const claimId = btn.getAttribute('data-reject-claim');
            btn.disabled = true;
            btn.textContent = '...';
            try {
              if (window.Cloud && window.Cloud.resolveProfileClaimRequest) {
                await window.Cloud.resolveProfileClaimRequest(claimId, 'rejected');
              }
              pendingProfileClaimRequests = pendingProfileClaimRequests.filter(x => x.id !== claimId);
              NotifManager.removeByTarget(claimId);
              clearAndroidSystemNotifications();
              toast('❌ Solicitud de acceso denegada', 'info');
              haptic(25);
              updateRequestsBadge();
              closeSheet();
            } catch (err) {
              console.error('Error rechazando acceso:', err);
              btn.disabled = false;
              btn.textContent = t('denyAccess', '❌ Denegar');
            }
          };
        });

        // Listeners para altas
        body.querySelectorAll('[data-approve-create]').forEach(btn => {
          btn.onclick = async () => {
            const reqId = btn.getAttribute('data-approve-create');
            const item = pendingPlayerCreationRequests.find(x => x.id === reqId);
            if (!item) return;

            btn.disabled = true;
            btn.textContent = '...';

            try {
              // Determinar equipo asignado automáticamente por año o categoría
              const matchedTeam = (item.suggestedTeamId && Store.team(item.suggestedTeamId)) || matchTeamByText(item.teamText || item.notes || '', Store.state.teams);
              const teamId = matchedTeam ? matchedTeam.id : (Store.state.teams[0] ? Store.state.teams[0].id : null);

              // Crear jugador en Store con nombre, apellidos y equipo auto-asignado
              const newPlayer = Store.upsertPlayer({
                name: item.name || '',
                lastName: item.lastName || '',
                teamId: teamId,
                mainDorsal: item.dorsal ? parseInt(item.dorsal, 10) : null,
                mainPosition: item.position || 'Delantero',
                notes: item.notes || ''
              });

              if (window.Cloud && window.Cloud.pushCoachState) {
                await window.Cloud.pushCoachState(Store.state, true);
              }
              if (window.Cloud && window.Cloud.resolvePlayerCreationRequest) {
                await window.Cloud.resolvePlayerCreationRequest(reqId, 'approved', newPlayer ? newPlayer.id : null);
              }

              pendingPlayerCreationRequests = pendingPlayerCreationRequests.filter(x => x.id !== reqId);
              NotifManager.removeByTarget(reqId);
              clearAndroidSystemNotifications();
              toast('✅ Jugador creado y añadido al sistema', 'success');
              haptic(40);
              updateRequestsBadge();
              closeSheet();
            } catch (err) {
              console.error('Error aprobando jugador:', err);
              toast('Error: ' + err.message, 'error');
              btn.disabled = false;
              btn.textContent = '✅ Crear Jugador';
            }
          };
        });

        body.querySelectorAll('[data-reject-create]').forEach(btn => {
          btn.onclick = async () => {
            const reqId = btn.getAttribute('data-reject-create');
            btn.disabled = true;
            btn.textContent = '...';
            try {
              if (window.Cloud && window.Cloud.resolvePlayerCreationRequest) {
                await window.Cloud.resolvePlayerCreationRequest(reqId, 'rejected');
              }
              pendingPlayerCreationRequests = pendingPlayerCreationRequests.filter(x => x.id !== reqId);
              NotifManager.removeByTarget(reqId);
              clearAndroidSystemNotifications();
              toast('❌ Solicitud rechazada', 'info');
              haptic(25);
              updateRequestsBadge();
              closeSheet();
            } catch (err) {
              btn.disabled = false;
              btn.textContent = '❌ Denegar';
            }
          };
        });

        // Listeners para cambios de perfil
        body.querySelectorAll('[data-approve-req]').forEach(btn => {
          btn.onclick = async () => {
            const reqId = btn.getAttribute('data-approve-req');
            btn.disabled = true;
            btn.textContent = '...';
            if (window.Cloud && window.Cloud.resolveProfileRequest) {
              await window.Cloud.resolveProfileRequest(reqId, 'approved');
            }
            pendingProfileRequests = pendingProfileRequests.filter(x => x.id !== reqId);
            NotifManager.removeByTarget(reqId);
            clearAndroidSystemNotifications();
            toast(t('requestApproved', '✅ Solicitud de cambio de perfil aprobada'), 'success');
            haptic(40);
            updateRequestsBadge();
            closeSheet();
          };
        });

        body.querySelectorAll('[data-reject-req]').forEach(btn => {
          btn.onclick = async () => {
            const reqId = btn.getAttribute('data-reject-req');
            btn.disabled = true;
            btn.textContent = '...';
            if (window.Cloud && window.Cloud.resolveProfileRequest) {
              await window.Cloud.resolveProfileRequest(reqId, 'rejected');
            }
            pendingProfileRequests = pendingProfileRequests.filter(x => x.id !== reqId);
            NotifManager.removeByTarget(reqId);
            clearAndroidSystemNotifications();
            toast(t('requestRejected', '❌ Solicitud rechazada'), 'info');
            haptic(25);
            updateRequestsBadge();
            closeSheet();
          };
        });
      }

      renderRequests();
    });
  }

  function showNotificationsCenterModal() {
    const backdrop = openSheet(t('notificationCenter', 'Centro de Notificaciones'), (body) => {
      function renderNotifs() {
        const notifs = NotifManager.getAll();
        const pendingReqs = (pendingProfileRequests || []).length + (pendingPlayerCreationRequests || []).length;

        body.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
            <div style="font-size: 13px; font-weight: 800; color: #fff;">
              🔔 ${notifs.length} ${t('notifications', 'Notificaciones')}
            </div>
            <div style="display: flex; gap: 6px;">
              ${notifs.length > 0 ? `
                <button type="button" class="btn sm ghost" id="btn-notif-mark-all" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
                  ✓ ${t('markAllRead', 'Marcar leídas')}
                </button>
                <button type="button" class="btn sm danger ghost" id="btn-notif-clear-all" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
                  🗑️ ${t('clearAllNotifications', 'Limpiar')}
                </button>
              ` : ''}
            </div>
          </div>



          ${notifs.length === 0 ? `
            <div class="empty-state card" style="padding: 30px 16px; text-align: center;">
              <div style="font-size: 36px; margin-bottom: 8px;">🔔</div>
              <h3 style="margin: 0 0 6px; font-size: 15px; color: #fff;">${t('noNotifications', 'No tienes notificaciones')}</h3>
              <p style="margin: 0; font-size: 12px; color: var(--muted);">${t('allCaughtUp', 'Todas las solicitudes y convocatorias están al día.')}</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;" id="notif-cards-list">
              ${notifs.map(n => {
                let ic = '🔔';
                if (n.type === 'profile_req') ic = '🔄';
                else if (n.type === 'creation_req') ic = '➕';
                else if (n.type === 'attendance') ic = (n.title && n.title.includes('🟢')) ? '🟢' : '❌';
                else if (n.type === 'chat') ic = '💬';

                const dateStr = n.time ? new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return `
                  <div class="notif-card" data-nid="${n.id}" data-target="${n.targetId || ''}" data-type="${n.type}" style="background: ${n.read ? 'rgba(15, 23, 42, 0.7)' : 'rgba(30, 41, 59, 0.85)'}; border: 1.5px solid ${n.read ? 'rgba(148, 163, 184, 0.2)' : 'rgba(34, 211, 238, 0.4)'}; border-radius: 12px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; cursor: pointer; position: relative;">
                    <span style="font-size: 20px; line-height: 1; flex-shrink: 0; margin-top: 2px;">${ic}</span>
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <b style="font-size: 13.5px; color: #ffffff; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${escapeHtml(n.title)}
                        </b>
                        <span style="font-size: 11px; color: #94a3b8; margin-left: 6px; flex-shrink: 0; font-weight: 600;">${dateStr}</span>
                      </div>
                      <div style="font-size: 12px; color: #cbd5e1; line-height: 1.35; word-break: break-word;">
                        ${escapeHtml(n.body)}
                      </div>
                    </div>
                    <button type="button" class="icon-btn ghost" data-delete-nid="${n.id}" style="width: 28px; height: 28px; color: #94a3b8; flex-shrink: 0; margin-left: 2px;" title="Eliminar">
                      🗑️
                    </button>
                    ${!n.read ? `
                      <span style="position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 6px #22d3ee;"></span>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        `;

        const btnMarkAll = body.querySelector('#btn-notif-mark-all');
        if (btnMarkAll) {
          btnMarkAll.onclick = () => {
            NotifManager.markAllAsRead();
            updateRequestsBadge();
            refreshHomeNotifications(true);
            renderNotifs();
          };
        }

        const btnClearAll = body.querySelector('#btn-notif-clear-all');
        if (btnClearAll) {
          btnClearAll.onclick = () => {
            NotifManager.clearAll();
            updateRequestsBadge();
            refreshHomeNotifications(true);
            renderNotifs();
          };
        }

        const btnJumpReqs = body.querySelector('#btn-jump-to-requests');
        if (btnJumpReqs) {
          btnJumpReqs.onclick = () => {
            closeSheet();
            showProfileRequestsModal();
          };
        }

        body.querySelectorAll('[data-delete-nid]').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const nid = btn.getAttribute('data-delete-nid');
            NotifManager.remove(nid);
            updateRequestsBadge();
            refreshHomeNotifications(true);
            renderNotifs();
          };
        });

        body.querySelectorAll('.notif-card').forEach(card => {
          card.onclick = () => {
            const nid = card.getAttribute('data-nid');
            const targetId = card.getAttribute('data-target');
            const type = card.getAttribute('data-type');
            NotifManager.markAsRead(nid);
            updateRequestsBadge();
            refreshHomeNotifications(true);

            closeSheet();

            if (type === 'profile_req' || type === 'creation_req' || type === 'claim_req') {
              showProfileRequestsModal();
            } else if (type === 'attendance') {
              navigate('convocations');
              if (targetId) {
                const conv = Store.convocation(targetId);
                if (conv) showConvocationDetailsModal(conv);
              }
            } else if (type === 'chat') {
              navigate('chat');
            }
          };
        });
      }

      renderNotifs();
    }, null, () => {
      refreshHomeNotifications(true);
    });
    if (backdrop) {
      const sheet = backdrop.querySelector('.sheet');
      if (sheet) {
        const initH = Math.min(window.innerHeight * 0.72, 580);
        sheet.style.height = `${initH}px`;
        sheet.style.maxHeight = '96vh';
      }
    }
  }

  function renderLangButton() {
    const cur = I18N.getLang();
    const flags = { es: '🇪🇸 ES', en: '🇬🇧 EN', et: '🇪🇪 ET', ee: '🇪🇪 ET', ru: '🇷🇺 RU' };
    const label = flags[cur] || cur.toUpperCase();
    return `
      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="icon-btn" id="btn-toggle-lang" title="${t('appLanguage')}" style="width: auto; padding: 0 10px; border-radius: 10px; font-weight: 900; font-size: 12px; gap: 4px; display: inline-flex; align-items: center; border: 1px solid var(--border); background: var(--surface2); color: #fff;">
          <span>${label}</span>
        </button>
      </div>
    `;
  }

  function toggleLanguage() {
    const list = ['es', 'en', 'et', 'ru'];
    const cur = I18N.getLang();
    const curNorm = (cur === 'ee' ? 'et' : cur);
    const idx = list.indexOf(curNorm);
    const next = list[(idx + 1) % list.length];
    I18N.setLang(next);
    renderTabbar();
    navigate(currentTab);
  }

  document.addEventListener('click', (e) => {
    const reqBtn = e.target.closest('#btn-profile-requests');
    if (reqBtn) {
      showNotificationsCenterModal();
    }
  });

  const _attendanceToastDedup = new Map();

  window.onPlayerAttendanceResponse = function (resp, isInitialSync = false) {
    if (!resp || !resp.convId || !resp.playerId) return;

    const notifId = 'att_' + (resp.convId || 'c') + '_' + resp.playerId;
    const isPending = (resp.status === 'pending' || !resp.status);

    if (isPending) {
      NotifManager.remove(notifId);
      DismissedNotifs.add(notifId);
      updateRequestsBadge();
      if (currentTab === 'convocations') navigate('convocations');
      if (typeof window.activeConvocationModalRefresh === 'function') window.activeConvocationModalRefresh();
      return;
    }

    const isAttending = (resp.status === 'called' || resp.status === 'attending' || resp.status === 'yes');
    const p = (window.Store && window.Store.player) ? window.Store.player(resp.playerId) : null;
    const pName = resp.playerName || (p ? (window.Store.playerName ? window.Store.playerName(p) : (p.name || 'Jugador')) : 'Jugador');

    // Buscar título descriptivo de la convocatoria si está disponible
    let convTitle = '';
    try {
      const conv = (window.Store && window.Store.convocation) ? window.Store.convocation(resp.convId) : null;
      if (conv) {
        convTitle = conv.title || (conv.type === 'match' ? ('vs ' + (conv.rival || 'Rival')) : 'Entrenamiento');
      }
    } catch (e) {}

    const rTimestamp = Number(resp.timestamp || resp.time || Date.now());
    const timeFormatted = window.formatAttendanceDateTime ? window.formatAttendanceDateTime(rTimestamp) : '';
    const notifTitle = isAttending ? `🟢 Asistencia confirmada` : `❌ Baja comunicada`;
    const notifBody = convTitle
      ? `${pName} • ${convTitle}${timeFormatted ? ' (' + timeFormatted + ')' : ''}${resp.notes ? ' - ' + resp.notes : ''}`
      : `${pName} (${isAttending ? 'Asistirá' : 'No asistirá'}${timeFormatted ? ' • ' + timeFormatted : ''}${resp.notes ? ' - ' + resp.notes : ''})`;

    if (DismissedNotifs.has(notifId)) {
      if (isInitialSync) return;
      // Si el usuario ya descartó esta notificación, no la resucitamos a menos que sea un voto NUEVO
      const existingList = NotifManager.getAll();
      const existing = existingList.find(n => n.id === notifId);
      if (existing && existing.time && rTimestamp <= existing.time) {
        return;
      }
      DismissedNotifs.remove(notifId);
    }

    NotifManager.add({
      id: notifId,
      type: 'attendance',
      title: notifTitle,
      body: notifBody,
      targetId: resp.convId || null,
      time: rTimestamp
    });

    updateRequestsBadge();

    // Solo emitir avisos emergentes (toast / vibración / notificación nativa) si es un cambio en vivo reciente
    const isRecent = !isInitialSync && (Date.now() - rTimestamp < 120000);
    if (isRecent) {
      const dedupKey = `${resp.convId || ''}_${resp.playerId || ''}_${resp.status || ''}`;
      const now = Date.now();
      if (!_attendanceToastDedup.has(dedupKey) || (now - _attendanceToastDedup.get(dedupKey) >= 8000)) {
        _attendanceToastDedup.set(dedupKey, now);

        toast(
          isAttending
            ? `🟢 ${pName} ha confirmado asistencia${timeFormatted ? ' (' + timeFormatted + ')' : ''}`
            : `❌ ${pName} no puede asistir${timeFormatted ? ' (' + timeFormatted + ')' : ''}`,
          isAttending ? 'success' : 'info'
        );
        haptic(35);

        // Notificación nativa en la barra de Android
        if (window.AndroidBridge && typeof window.AndroidBridge.showSystemNotification === 'function') {
          try {
            window.AndroidBridge.showSystemNotification(
              notifTitle,
              notifBody,
              notifId
            );
          } catch (e) {
            console.error('Error enviando notificación AndroidBridge:', e);
          }
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(notifTitle, {
              body: notifBody,
              icon: 'icons/icon-192.png'
            });
          } catch (e) {}
        }
      }
    }

    if (currentTab === 'convocations') {
      navigate('convocations');
    }

    if (typeof window.activeConvocationModalRefresh === 'function') {
      window.activeConvocationModalRefresh();
    }
  };

  /* =========================================================
     INICIALIZACIÓN Y NAVEGACIÓN
     ========================================================= */
  function init() {
    if (window.Store && window.Store.autoCreateTodayScheduledSessions) {
      window.Store.autoCreateTodayScheduledSessions();
    }
    renderTabbar();
    autoSeedIfEmpty();
    navigate('home');

    // Solicitar permiso de notificaciones nativas de Android / PWA
    if (window.AndroidBridge && window.AndroidBridge.requestNotificationPermission) {
      try { window.AndroidBridge.requestNotificationPermission(); } catch (e) {}
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }

    // Sincronización en la Nube Firebase (App Jugadores <-> App Entrenador)
    if (window.Cloud) {
      window.Cloud.init();
      window.Cloud.startListeningToResponses((resp, isInitialSync) => {
        Store.handleIncomingPlayerResponse(resp, isInitialSync);
      });
      window.Cloud.listenToProfileRequests((requests) => {
        handleIncomingProfileRequests(requests);
      });
      window.Cloud.listenToPlayerCreationRequests((requests) => {
        handleIncomingPlayerCreationRequests(requests);
      });
      if (window.Cloud.listenToProfileClaimRequests) {
        window.Cloud.listenToProfileClaimRequests((requests) => {
          handleIncomingProfileClaimRequests(requests);
        });
      }
      if (window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
        window.ChatUI.initGlobalUnreadListener('coach');
      }
      setTimeout(() => {
        if (Store.state.players.length > 0 || Store.state.convocations.length > 0) {
          window.Cloud.pushCoachState(Store.state);
        }
      }, 2500);
    }

    // Escucha reactiva de eventos remotos en tiempo real (QR / WebSocket / WebRTC)
    if (window.SyncEngine) {
      SyncEngine.on((type, data) => {
        if (type === 'remote_action' || type === 'remote_undo' || type === 'remote_score' || type === 'remote_period' || type === 'remote_zone' || type === 'session_synced') {
          if (type === 'session_synced' && data && data.id) {
            const trackerEl = document.getElementById('tracker-fullscreen');
            if (!trackerEl || activeSessionId !== data.id) {
              openTracker(data.id);
              return;
            }
          }
          const trackerEl = document.getElementById('tracker-fullscreen');
          if (trackerEl && activeSessionId) {
            renderTracker();
          }
        } else if (type === 'peer_connected') {
          toast('¡Compañero sincronizado en vivo!', 'success');
          const trackerEl = document.getElementById('tracker-fullscreen');
          if (trackerEl) renderTracker();
        } else if (type === 'joined') {
          toast(`Conectado a la sala ${data.room}`, 'success');
          const trackerEl = document.getElementById('tracker-fullscreen');
          if (trackerEl) renderTracker();
        } else if (type === 'session_finished') {
          toast(t('sessionFinishedByHost', 'El anfitrión ha finalizado la sesión. Guardada en tu historial.'), 'info');
          closeTracker();
          navigate('convocations');
        }
      });
    }
  }

  async function autoSeedIfEmpty() {
    if (Store.state.players.length === 0) {
      try {
        const res = await fetch('data/database_reference.json');
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.players) && json.players.length > 0) {
            Store.state.players = json.players;
            if (json.teams && json.teams.length > 0) Store.state.teams = json.teams;
            if (json.sessions && json.sessions.length > 0 && Store.state.sessions.length === 0) {
              Store.state.sessions = json.sessions;
            }
            Store.save();
            render();
            return;
          }
        }
      } catch (e) {}
      if (Store.state.teams.length === 0) {
        Store.upsertTeam({ id: 'team_u12', name: 'U11 / U12 Base', color: '#10b981' });
        Store.upsertTeam({ id: 'team_u10', name: 'U10 Formativo', color: '#3b82f6' });
      }
    }
  }

  function renderTabbar() {
    const bar = document.getElementById('tabbar');
    if (!bar) return;
    const tabs = [
      { id: 'home',         label: t('home'),         ic: 'home' },
      { id: 'convocations', label: t('convocations'), ic: 'clipboard' },
      { id: 'players',      label: t('players'),      ic: 'users' },
      { id: 'chat',         label: t('chat', 'Chat'), ic: 'message' },
      { id: 'stats',        label: t('metrics'),      ic: 'chart' },
      { id: 'config',       label: t('settings'),     ic: 'sliders' }
    ];
    bar.innerHTML = tabs.map(t => `
      <button class="tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">
        <span class="tab-ic">${icon(t.ic, 20)}</span>
        <span>${t.label}</span>
      </button>
    `).join('');

    bar.querySelectorAll('.tab').forEach(b => {
      b.onclick = () => {
        const id = b.getAttribute('data-tab');
        navigate(id);
      };
    });

    if (window.ChatUI && window.ChatUI.updateTabBadge) {
      window.ChatUI.updateTabBadge(window.ChatUI.hasUnread);
    }
  }

  function renderChatView(view) {
    if (!window.ChatUI) {
      view.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted);">Chat no disponible</div>';
      return;
    }
    const coachName = (Store.state.settings && Store.state.settings.coachName) ? Store.state.settings.coachName : 'Entrenador';
    window.ChatUI.renderChatList(view, {
      currentUserId: 'coach',
      currentUserName: coachName,
      isCoach: true,
      players: Store.state.players || [],
      teams: Store.state.teams || []
    });
  }

  function navigate(tab) {
    if (tab === 'history') tab = 'convocations';
    currentTab = tab;
    renderTabbar();
    const view = document.getElementById('view');
    if (!view) return;
    view.className = 'anim';

    switch (tab) {
      case 'home':         renderHomeView(view); break;
      case 'convocations': renderConvocationsView(view); break;
      case 'players':      renderPlayersView(view); break;
      case 'chat':         renderChatView(view); break;
      case 'stats':        renderStatsView(view); break;
      case 'config':       renderConfigView(view); break;
    }
  }

  /* =========================================================
     VISTA 1: INICIO (HOME)
     ========================================================= */
  function renderHomeNotificationsHtml() {
    const notifs = NotifManager.getAll();
    const unreadNotifs = notifs.filter(n => !n.read);

    // Recopilar solicitudes pendientes en vivo
    const pendingItems = [];
    (pendingProfileRequests || []).forEach(r => {
      pendingItems.push({
        id: 'req_' + r.id,
        targetId: r.id,
        type: 'profile_req',
        title: t('profileRequests', 'Solicitud de cambio de perfil'),
        body: `${r.fromPlayerName || 'Jugador'} ➔ ${r.toPlayerName || 'Nuevo perfil'}`,
        time: r.createdAt || Date.now(),
        isPendingReq: true
      });
    });
    (pendingPlayerCreationRequests || []).forEach(cr => {
      pendingItems.push({
        id: 'create_' + cr.id,
        targetId: cr.id,
        type: 'creation_req',
        title: t('requestCoachProfileTitle', 'Solicitud de alta de jugador'),
        body: `${cr.name || 'Nuevo jugador'} (${cr.dorsal ? '#' + cr.dorsal + ' - ' : ''}${cr.position || 'Jugador'})`,
        time: cr.createdAt || Date.now(),
        isPendingReq: true
      });
    });
    (pendingProfileClaimRequests || []).forEach(cl => {
      pendingItems.push({
        id: 'claim_' + cl.id,
        targetId: cl.id,
        type: 'claim_req',
        title: 'Solicitud de acceso a perfil',
        body: `${cl.playerName || 'Jugador'} (Código ${cl.securityCode || '—'})`,
        time: cl.createdAt || Date.now(),
        isPendingReq: true
      });
    });

    const pendingReqsCount = pendingItems.length;
    const allActiveItems = [...pendingItems, ...unreadNotifs];
    const totalCount = Math.max(unreadNotifs.length, pendingReqsCount);

    // Si no hay notificaciones activas, la ventana permanece visible mostrando estado limpio
    if (allActiveItems.length === 0) {
      return `
        <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(148, 163, 184, 0.25); background: rgba(15, 23, 42, 0.92); box-shadow: 0 4px 20px rgba(0,0,0,0.4); padding: 12px 14px; border-radius: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 17px; line-height: 1;">🔔</span>
              <b style="font-size: 13.5px; color: #ffffff; font-weight: 800;">${t('notificationCenter', 'Centro de Notificaciones')}</b>
              <span class="badge" style="background: rgba(148, 163, 184, 0.25); color: #94a3b8; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 999px;">0</span>
            </div>
            <button type="button" class="btn sm ghost" id="btn-home-open-modal-center" style="font-size: 11px; padding: 3px 8px; font-weight: 800; color: #94a3b8;" title="Ver todas">
              Ver todas ➔
            </button>
          </div>
          <div style="padding: 16px 8px; text-align: center; color: #94a3b8; font-size: 12.5px; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <span style="font-size: 22px;">🎉</span>
            <b style="color: #cbd5e1; font-size: 13px;">${t('allCaughtUp', '¡Todo al día!')}</b>
            <span style="font-size: 11.5px; color: #64748b;">${t('noNotifications', 'No tienes notificaciones pendientes')}</span>
          </div>
        </div>
      `;
    }

    const maxDisplay = 8;
    const displayedItems = allActiveItems.slice(0, maxDisplay);
    const remainingCount = allActiveItems.length - displayedItems.length;

    return `
      <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(34, 211, 238, 0.45); background: rgba(15, 23, 42, 0.92); box-shadow: 0 4px 20px rgba(0,0,0,0.4); padding: 12px 14px; border-radius: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 17px; line-height: 1;">🔔</span>
            <b style="font-size: 13.5px; color: #ffffff; font-weight: 800;">${t('notificationCenter', 'Centro de Notificaciones')}</b>
            <span class="badge" style="background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 900; padding: 2px 7px; border-radius: 999px;">${totalCount}</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${pendingReqsCount > 0 ? `
              <button type="button" class="btn sm primary" id="btn-home-open-requests" style="font-size: 11px; padding: 3px 8px; font-weight: 800;">
                👥 ${t('requests', 'Solicitudes')} (${pendingReqsCount})
              </button>
            ` : ''}
            ${unreadNotifs.length > 0 ? `
              <button type="button" class="btn sm ghost" id="btn-home-notif-mark-all" style="font-size: 11px; padding: 3px 8px; font-weight: 800; color: #38bdf8;">
                ✓ ${t('markAllRead', 'Marcar leídas')}
              </button>
            ` : ''}
            <button type="button" class="btn sm ghost" id="btn-home-open-modal-center" style="font-size: 11px; padding: 3px 8px; font-weight: 800; color: #94a3b8;" title="Ver todas">
              Ver todas ➔
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 290px; overflow-y: auto; padding-right: 2px;">
          ${displayedItems.map(n => {
            let ic = '🔔';
            if (n.type === 'profile_req') ic = '🔄';
            else if (n.type === 'creation_req') ic = '➕';
            else if (n.type === 'claim_req') ic = '🔑';
            else if (n.type === 'attendance') ic = (n.title && n.title.includes('🟢')) ? '🟢' : '❌';
            else if (n.type === 'chat') ic = '💬';

            const dateStr = n.time ? new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
              <div class="home-notif-item" data-nid="${n.id}" data-target="${n.targetId || ''}" data-type="${n.type}" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 12px; padding: 9px 12px; display: flex; align-items: flex-start; gap: 10px; cursor: pointer; position: relative;">
                <span style="font-size: 18px; line-height: 1; flex-shrink: 0; margin-top: 1px;">${ic}</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <b style="font-size: 13px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 800;">
                      ${escapeHtml(n.title)}
                    </b>
                    <span style="font-size: 10.5px; color: #94a3b8; margin-left: 6px; flex-shrink: 0; font-weight: 600;">${dateStr}</span>
                  </div>
                  <div style="font-size: 12px; color: #cbd5e1; line-height: 1.35; word-break: break-word;">
                    ${escapeHtml(n.body)}
                  </div>
                </div>
                ${n.isPendingReq ? `
                  <span class="badge" style="background: rgba(34, 211, 238, 0.2); color: #38bdf8; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; flex-shrink: 0;">Revisar</span>
                ` : `
                  <button type="button" class="icon-btn ghost" data-home-delete-nid="${n.id}" style="width: 24px; height: 24px; font-size: 12px; color: #94a3b8; flex-shrink: 0;" title="Eliminar">✕</button>
                `}
              </div>
            `;
          }).join('')}
        </div>

        ${remainingCount > 0 ? `
          <div style="text-align: center; margin-top: 8px;">
            <button type="button" class="btn sm ghost" id="btn-home-see-more-notifs" style="font-size: 11.5px; font-weight: 800; color: #38bdf8;">
              ${t('showMoreNotifs', 'Ver {count} notificaciones más').replace('{count}', remainingCount)}
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function bindHomeNotificationsEvents(container) {
    if (!container) return;

    const btnHomeReqs = container.querySelector('#btn-home-open-requests');
    if (btnHomeReqs) btnHomeReqs.onclick = () => showProfileRequestsModal();

    const btnHomeModal = container.querySelector('#btn-home-open-modal-center');
    if (btnHomeModal) btnHomeModal.onclick = () => showNotificationsCenterModal();

    const btnSeeMore = container.querySelector('#btn-home-see-more-notifs');
    if (btnSeeMore) btnSeeMore.onclick = () => showNotificationsCenterModal();

    const btnHomeMarkAll = container.querySelector('#btn-home-notif-mark-all');
    if (btnHomeMarkAll) {
      btnHomeMarkAll.onclick = () => {
        NotifManager.markAllAsRead();
        updateRequestsBadge();
        refreshHomeNotifications(true);
      };
    }

    container.querySelectorAll('[data-home-delete-nid]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const nid = b.getAttribute('data-home-delete-nid');
        NotifManager.remove(nid);
        updateRequestsBadge();
        refreshHomeNotifications(true);
      };
    });

    container.querySelectorAll('.home-notif-item').forEach(card => {
      card.onclick = () => {
        const nid = card.getAttribute('data-nid');
        const type = card.getAttribute('data-type');
        const targetId = card.getAttribute('data-target');
        NotifManager.markAsRead(nid);
        updateRequestsBadge();

        if (type === 'profile_req' || type === 'creation_req' || type === 'claim_req') {
          showProfileRequestsModal();
        } else if (type === 'attendance' && targetId) {
          const conv = Store.convocation(targetId);
          if (conv) showConvocationDetailsModal(conv);
          else refreshHomeNotifications(true);
        } else if (type === 'chat' && targetId) {
          if (typeof window.openChatModal === 'function') {
            window.openChatModal(targetId);
          } else {
            navigate('chat');
          }
        } else {
          refreshHomeNotifications(true);
        }
      };
    });
  }

  let _refreshHomeNotifTimer = null;
  function refreshHomeNotifications(immediate = false) {
    if (currentTab !== 'home') return;
    if (_refreshHomeNotifTimer) clearTimeout(_refreshHomeNotifTimer);
    const doRefresh = () => {
      const container = document.getElementById('home-notifications-container');
      if (!container) return;
      const newHtml = renderHomeNotificationsHtml();
      if (container.dataset.lastHtml !== newHtml) {
        container.dataset.lastHtml = newHtml;
        container.innerHTML = newHtml;
        bindHomeNotificationsEvents(container);
      }
    };
    if (immediate) {
      doRefresh();
    } else {
      _refreshHomeNotifTimer = setTimeout(doRefresh, 60);
    }
  }
  window.refreshHomeNotifications = refreshHomeNotifications;

  window.openChatModal = function (chatId) {
    if (window.ChatUI && window.ChatUI.openConversationModal) {
      window.ChatUI.openConversationModal(chatId, {
        currentUserId: 'coach',
        currentUserName: (Store.state.settings && Store.state.settings.coachName) || 'Entrenador',
        isCoach: true,
        players: Store.state.players || [],
        teams: Store.state.teams || []
      });
    } else {
      navigate('chat');
    }
  };

  function renderHomeView(view) {
    if (!view) view = document.getElementById('view');
    if (!view) return;

    syncAttendanceNotificationsFromConvocations();
    updateRequestsBadge();

    if (window.Store && window.Store.autoCreateTodayScheduledSessions) {
      window.Store.autoCreateTodayScheduledSessions();
    }
    const todayIso = getTodayIso();
    const tomorrowIso = getTomorrowIso();

    // Sincronización garantizada de convocatorias para hoy y mañana
    const allConvs = Store.state.convocations || [];
    let stateModified = false;
    allConvs.forEach(c => {
      if (!c || !c.date) return;
      if (c.date === todayIso || c.date === tomorrowIso) {
        let s = c.sessionId ? Store.session(c.sessionId) : null;
        if (!s) {
          s = (Store.state.sessions || []).find(sess => sess.convocationId === c.id || (c.sessionId && sess.id === c.sessionId) || (sess.date === c.date && sess.type === c.type));
        }
        if (!s) {
          const targetTeamIds = Array.isArray(c.teamIds) && c.teamIds.length > 0 ? c.teamIds : (c.teamId ? [c.teamId] : []);
          const autoTitle = c.title || (c.type === 'match'
            ? (c.rival ? 'Partido vs ' + c.rival : 'Partido')
            : (targetTeamIds.length > 1
              ? 'Entrenamiento (' + targetTeamIds.map(tid => { const tm = Store.team(tid); return tm ? tm.name : ''; }).filter(Boolean).join(' / ') + ')'
              : (targetTeamIds[0] && Store.team(targetTeamIds[0]) ? 'Entrenamiento ' + Store.team(targetTeamIds[0]).name : 'Entrenamiento')));

          s = {
            id: c.sessionId || ('s_' + (c.id || Date.now())),
            convocationId: c.id,
            scheduleId: c.scheduleId || '',
            type: c.type || 'training',
            date: c.date,
            time: c.time || '18:00',
            endTime: c.endTime || '',
            duration: c.duration || 90,
            createdAt: Date.now(),
            title: autoTitle,
            rival: c.rival || '',
            venue: c.venue || '',
            address: c.address || '',
            teamId: targetTeamIds[0] || '',
            teamIds: targetTeamIds,
            notes: c.notes || '',
            status: 'active',
            elapsedMs: 0,
            timerStartedAt: null,
            slots: [null, null],
            enabledStats: null,
            attendance: c.list || {},
            score: { home: 0, away: 0 },
            period: 'B1',
            zones: [],
            stats: {},
            log: []
          };
          c.sessionId = s.id;
          Store.state.sessions = Store.state.sessions || [];
          Store.state.sessions.unshift(s);
          stateModified = true;
        } else {
          if (!c.sessionId) { c.sessionId = s.id; stateModified = true; }
          if (!s.convocationId) { s.convocationId = c.id; stateModified = true; }
        }
      }
    });
    if (stateModified) {
      Store.save();
    }

    const totalPlayers = Store.state.players.length;
    const allSessions = Store.state.sessions || [];
    const todaySessions = allSessions.filter(s => s.date === todayIso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const tomorrowSessions = allSessions.filter(s => s.date === tomorrowIso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const pastSessions = allSessions.filter(s => s.date < todayIso).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

    let html = `
      <div class="topbar">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="icons/club-logo.png" style="width: 38px; height: 38px; object-fit: contain; border-radius: 50%;" alt="Club Logo" onerror="this.style.display='none'">
          <div>
            <h1>${t('appName')}</h1>
            <span class="sub">${t('appSubtitle')}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="icon-btn" id="btn-profile-requests" title="${t('notificationCenter', 'Centro de Notificaciones')}" style="position: relative; width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface2); color: #fff; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 19px; line-height: 1;">🔔</span>
            <span id="requests-badge" class="badge danger" style="position: absolute; top: -3px; right: -3px; font-size: 10px; font-weight: 900; padding: 1px 5px; border-radius: 999px; min-width: 18px; text-align: center; border: 2px solid #060a13; display: none;">0</span>
          </button>
          ${renderLangButton()}
        </div>
      </div>

      <!-- Notificaciones y Solicitudes en Inicio (Ventana Expandible) -->
      <div id="home-notifications-container">
        ${renderHomeNotificationsHtml()}
      </div>

      ${totalPlayers === 0 ? `
        <div class="banner">
          <div class="b-ic">💡</div>
          <div class="grow">
            <b>${t('noPlayersTitle')}</b>
            <p>${t('noPlayersDesc')}</p>
          </div>
          <button class="btn sm primary" id="btn-home-import">${t('importPlayers')}</button>
        </div>
      ` : ''}

      <div class="section-title">
        <span>${t('recentSessions')}</span>
        <button class="link" id="btn-see-all-sessions">${t('seeAll')}</button>
      </div>

      <div id="recent-sessions-list" style="display: flex; flex-direction: column; gap: 10px;">
        ${allSessions.length === 0 ? `
          <div class="empty">
            <div class="big">📋</div>
            <h3>${t('noSessionsYet')}</h3>
            <p>${t('noSessionsDesc')}</p>
          </div>
        ` : `
          <!-- 1. Sesiones de Hoy -->
          ${todaySessions.length > 0 ? `
            <div style="font-size: 13px; font-weight: 800; color: var(--cyan); margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> ${t('todaySessions', 'Sesiones de Hoy')} (${todaySessions.length})
            </div>
            ${todaySessions.map(s => renderSessionItemHtml(s)).join('')}
          ` : `
            <div class="card" style="padding: 12px 14px; text-align: center; color: var(--muted); font-size: 12.5px; margin-bottom: 4px; border: 1px dashed var(--border);">
              📅 ${t('noSessionsToday', 'No hay sesiones programadas para hoy')}
            </div>
          `}

          <!-- 2. Sesiones de Mañana -->
          ${tomorrowSessions.length > 0 ? `
            <div style="font-size: 13px; font-weight: 800; color: #a5b4fc; margin-top: 10px; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
              <span>🌅</span> ${t('tomorrowSessions', 'Sesiones de Mañana')} (${tomorrowSessions.length})
            </div>
            ${tomorrowSessions.map(s => renderSessionItemHtml(s)).join('')}
          ` : `
            <div class="card" style="padding: 12px 14px; text-align: center; color: var(--muted); font-size: 12.5px; margin-top: 6px; margin-bottom: 4px; border: 1px dashed var(--border);">
              📅 ${t('noSessionsTomorrow', 'No hay sesiones programadas para mañana')}
            </div>
          `}

          <!-- 3. Grupo de sesiones anteriores -->
          ${pastSessions.length > 0 ? `
            <details class="card past-convs-details" style="margin-top: 10px; padding: 0; border-radius: 14px; overflow: hidden; background: rgba(15, 23, 42, 0.5);">
              <summary style="cursor: pointer; padding: 12px 14px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
                <span style="display: flex; align-items: center; gap: 6px; color: #cbd5e1;">
                  📁 ${t('pastSessionsTitle', 'Sesiones de días anteriores')} (${pastSessions.length})
                </span>
                <span style="font-size: 11px; color: var(--muted); font-weight: 700;">▼</span>
              </summary>
              <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 14px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                ${pastSessions.slice(0, 10).map(s => renderSessionItemHtml(s)).join('')}
                ${pastSessions.length > 10 ? `
                  <button type="button" class="btn sm ghost" id="btn-home-see-all-past" style="margin-top: 6px; font-size: 12px; font-weight: 800;">
                    ${t('seeAllConvs', 'Ver todas en Convocatorias')} (${pastSessions.length}) ➔
                  </button>
                ` : ''}
              </div>
            </details>
          ` : ''}
        `}
      </div>
    `;

    view.innerHTML = html;
    updateRequestsBadge();

    const btnLang = view.querySelector('#btn-toggle-lang');
    if (btnLang) btnLang.onclick = toggleLanguage;

    const btnSeeAll = view.querySelector('#btn-see-all-sessions');
    if (btnSeeAll) btnSeeAll.onclick = () => navigate('convocations');
    const btnPast = view.querySelector('#btn-home-see-all-past');
    if (btnPast) btnPast.onclick = () => navigate('convocations');

    bindHomeNotificationsEvents(view.querySelector('#home-notifications-container'));

    const btnImp = view.querySelector('#btn-home-import');
    if (btnImp) btnImp.onclick = () => showImportModal();

    // Al pulsar en cualquier sesión de Inicio, navegar a Convocatorias y abrir la ficha de esa convocatoria
    view.querySelectorAll('.session-item').forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute('data-id');
        const s = Store.session(id);
        if (!s) return;
        let conv = s.convocationId ? Store.convocation(s.convocationId) : null;
        if (!conv) {
          conv = (Store.state.convocations || []).find(c => c.sessionId === s.id || (c.date === s.date && c.type === s.type));
        }
        if (!conv) {
          conv = Store.upsertConvocation({
            id: 'conv_' + s.id,
            sessionId: s.id,
            type: s.type,
            title: Store.sessionTitle(s),
            date: s.date,
            time: s.time || '18:00',
            endTime: s.endTime || '',
            duration: s.duration || 90,
            venue: s.venue || '',
            address: s.address || '',
            rival: s.rival || '',
            teamId: s.teamId || '',
            teamIds: Array.isArray(s.teamIds) ? s.teamIds : (s.teamId ? [s.teamId] : []),
            notes: s.notes || '',
            list: s.attendance || {}
          });
          s.convocationId = conv.id;
          Store.save();
        }
        navigate('convocations');
        setTimeout(() => {
          showConvocationDetailsModal(conv);
        }, 80);
      };
    });

    view.querySelectorAll('.btn-quick-att').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sid = btn.getAttribute('data-att-sid');
        showSessionAttendanceModal(sid);
      };
    });
  }

  /* =========================================================
     UTILIDADES DINÁMICAS DE ESTILO POR EQUIPO (FONDO Y BORDES)
     Totalmente extensible para cualquier equipo o color futuro
     ========================================================= */
  function hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(15, 23, 42, ${alpha})`;
    let c = hex.trim();
    if (c.startsWith('#')) c = c.slice(1);
    if (c.length === 3) {
      c = c.split('').map(x => x + x).join('');
    }
    if (c.length === 6 || c.length === 8) {
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    if (c.startsWith('rgb(')) {
      return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    return hex;
  }

  function resolveEventTeams(item) {
    if (!item) return [];
    const teamIdSet = new Set();

    if (Array.isArray(item.teamIds)) {
      item.teamIds.forEach(id => { if (id) teamIdSet.add(String(id)); });
    }
    if (item.teamId) {
      teamIdSet.add(String(item.teamId));
    }

    // Fallback para sesiones si no tienen teamId explícito
    if (teamIdSet.size === 0) {
      const pids = (typeof Store.sessionPlayerIds === 'function') ? Store.sessionPlayerIds(item) : (item.playerIds || []);
      if (Array.isArray(pids) && pids.length > 0) {
        pids.forEach(pid => {
          const pl = Store.player(pid);
          if (pl && pl.teamId) teamIdSet.add(String(pl.teamId));
        });
      }
    }

    // Fallback para convocatorias basadas en lista de convocados
    if (teamIdSet.size === 0 && item.list && typeof item.list === 'object') {
      Object.keys(item.list).forEach(pid => {
        const pl = Store.player(pid);
        if (pl && pl.teamId) teamIdSet.add(String(pl.teamId));
      });
    }

    const teams = [];
    teamIdSet.forEach(tid => {
      const tm = Store.team(tid);
      if (tm) teams.push(tm);
    });

    // Para partidos, si sigue sin haber equipo identificado, fallback al primer equipo registrado
    if (teams.length === 0 && item.type === 'match' && Store.state.teams && Store.state.teams.length > 0) {
      teams.push(Store.state.teams[0]);
    }

    return teams;
  }

  function getEventCardStyle(item, options = {}) {
    const isMatch = options.isMatch != null ? options.isMatch : (item && item.type === 'match');
    const isPast = options.isPast != null ? options.isPast : false;
    const isToday = options.isToday != null ? options.isToday : false;

    const teams = resolveEventTeams(item);
    const colors = teams.map(tm => tm.color || '#22c55e').filter(Boolean);

    let background = '';
    let border = '';
    let boxShadow = '';

    const alphaMain = isPast ? 0.32 : 0.48;
    const alphaMid = isPast ? 0.18 : 0.28;
    const darkStop = isPast ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.86)';

    if (colors.length === 0) {
      background = isPast ? 'rgba(15, 23, 42, 0.65)' : 'rgba(30, 41, 59, 0.7)';
    } else if (colors.length === 1) {
      background = `linear-gradient(135deg, ${hexToRgba(colors[0], alphaMain)} 0%, ${hexToRgba(colors[0], alphaMid)} 55%, ${darkStop} 100%)`;
    } else if (colors.length === 2) {
      background = `linear-gradient(135deg, ${hexToRgba(colors[0], alphaMain)} 0%, rgba(15, 23, 42, 0.60) 50%, ${hexToRgba(colors[1], alphaMain)} 100%)`;
    } else {
      const stops = colors.map((col, idx) => {
        const pct = Math.round((idx / (colors.length - 1)) * 100);
        return `${hexToRgba(col, alphaMain)} ${pct}%`;
      });
      background = `linear-gradient(135deg, ${stops.join(', ')})`;
    }

    if (isMatch) {
      border = isToday ? '2.8px solid #f59e0b' : '2.5px solid #f59e0b';
      boxShadow = isToday
        ? '0 0 18px rgba(245, 158, 11, 0.55), inset 0 0 10px rgba(245, 158, 11, 0.12)'
        : '0 0 14px rgba(245, 158, 11, 0.35)';
    } else if (isToday) {
      border = '2px solid rgba(34, 211, 238, 0.95)';
    } else {
      if (colors.length > 0) {
        border = `1.5px solid ${hexToRgba(colors[0], isPast ? 0.30 : 0.50)}`;
      } else {
        border = `1px solid ${isPast ? 'rgba(255, 255, 255, 0.08)' : 'var(--border)'}`;
      }
    }

    let styleStr = `background: ${background};`;
    if (border) styleStr += ` border: ${border};`;
    if (boxShadow) styleStr += ` box-shadow: ${boxShadow};`;
    if (isPast) styleStr += ` opacity: 0.92;`;

    return {
      background,
      border,
      boxShadow,
      styleStr,
      teams,
      colors
    };
  }

  function showHomeSessionsListModal(type) {
    const isMatch = type === 'match';
    const title = isMatch 
      ? `🏆 ${t('matchesTab', 'Partidos')}` 
      : `⚽ ${t('trainingsTab', 'Entrenamientos')}`;

    openSheet(title, (body) => {
      const allSessions = (Store.state.sessions || []).filter(s => s.type === type);
      const todayIso = getTodayIso();
      const todaySessions = allSessions.filter(s => s.date === todayIso);
      const futureSessions = allSessions.filter(s => s.date > todayIso).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const pastSessions = allSessions.filter(s => s.date < todayIso).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      body.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
          <div style="font-size: 12.5px; color: var(--muted);">
            <b>${allSessions.length}</b> ${isMatch ? t('matchesCount', 'partidos registrados') : t('trainingsCount', 'entrenamientos registrados')}
          </div>
          <button type="button" class="btn sm primary" id="btn-modal-new-session" style="font-weight: 800; font-size: 12px;">
            ➕ ${isMatch ? t('newMatch', 'Nuevo Partido') : t('newTraining', 'Nuevo Entrenamiento')}
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${allSessions.length === 0 ? `
            <div style="text-align: center; padding: 32px 14px; color: var(--muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">${isMatch ? '🏆' : '⚽'}</div>
              <h4 style="margin: 0 0 4px; color: #fff;">${isMatch ? t('noMatchesYet', 'No hay partidos registrados') : t('noTrainingsYet', 'No hay entrenamientos registrados')}</h4>
              <p style="font-size: 12px; margin: 0 0 12px;">${isMatch ? t('noMatchesDesc', 'Crea un partido para registrar estadísticas en directo.') : t('noTrainingsDesc', 'Crea una sesión de entrenamiento para pasar lista.')}</p>
            </div>
          ` : `
            ${todaySessions.length > 0 ? `
              <div style="font-size: 12px; font-weight: 800; color: var(--cyan); margin-bottom: -2px; display: flex; align-items: center; gap: 6px;">
                <span>⚡</span> ${t('todaySessions', 'Sesiones de Hoy')} (${todaySessions.length})
              </div>
              ${todaySessions.map(s => renderSessionItemHtml(s)).join('')}
            ` : ''}

            ${futureSessions.length > 0 ? `
              <div style="font-size: 12px; font-weight: 800; color: #a5b4fc; margin-top: ${todaySessions.length > 0 ? '6px' : '0'}; margin-bottom: -2px; display: flex; align-items: center; gap: 6px;">
                <span>📅</span> ${t('futureSessionsTitle', 'Próximas Sesiones')} (${futureSessions.length})
              </div>
              ${futureSessions.map(s => renderSessionItemHtml(s)).join('')}
            ` : ''}

            ${pastSessions.length > 0 ? `
              <div style="font-size: 12px; font-weight: 800; color: #94a3b8; margin-top: ${(todaySessions.length > 0 || futureSessions.length > 0) ? '6px' : '0'}; margin-bottom: -2px; display: flex; align-items: center; gap: 6px;">
                <span>📁</span> ${t('pastSessionsTitle', 'Sesiones de días anteriores')} (${pastSessions.length})
              </div>
              ${pastSessions.map(s => renderSessionItemHtml(s)).join('')}
            ` : ''}

            <div style="margin-top: 10px; text-align: center;">
              <button type="button" class="btn sm ghost" id="btn-modal-see-history" style="font-size: 12px; font-weight: 800; width: 100%;">
                ${t('seeAllSessions', 'Ver todas las convocatorias')} ➔
              </button>
            </div>
          `}
        </div>
      `;

      const btnNew = body.querySelector('#btn-modal-new-session');
      if (btnNew) {
        btnNew.onclick = () => {
          closeSheet();
          showNewSessionModal(type);
        };
      }

      const btnHist = body.querySelector('#btn-modal-see-history');
      if (btnHist) {
        btnHist.onclick = () => {
          closeSheet();
          navigate('convocations');
        };
      }

      body.querySelectorAll('.session-item').forEach(el => {
        el.onclick = () => {
          const id = el.getAttribute('data-id');
          closeSheet();
          openTracker(id);
        };
      });

      body.querySelectorAll('.btn-quick-att').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const sid = btn.getAttribute('data-att-sid');
          showSessionAttendanceModal(sid);
        };
      });
    });
  }

  function getTodayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getTomorrowIso() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDateDDMMAAAA(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  function renderSessionItemHtml(s) {
    const isLive = s.timerStartedAt != null;
    const pids = Store.sessionPlayerIds(s);
    const players = pids.map(id => Store.player(id)).filter(Boolean);
    const typeLabel = s.type === 'match' ? t('match') : t('training');
    const typeClass = s.type === 'match' ? 'match' : 'training';
    const emoji = s.type === 'match' ? '🏆' : '⚽';

    let totalActions = 0;
    pids.forEach(pid => {
      const st = s.stats[pid] || {};
      Object.keys(st).forEach(k => { totalActions += (st[k] || 0); });
    });

    // Encontrar MVP del partido requiriendo un mínimo de volumen de participación
    let mvpPlayer = null;
    let mvpRating = 0;
    if (s.type === 'match' && pids.length > 0) {
      players.forEach(p => {
        const st = s.stats[p.id] || {};
        let actCount = 0;
        Object.keys(st).forEach(k => { actCount += (st[k] || 0); });
        const r = Store.calculateMatchRating(st, p.mainPosition);
        if (actCount >= 4 && r > mvpRating) {
          mvpRating = r;
          mvpPlayer = p;
        }
      });
      // Fallback si ningún jugador supera 4 acciones
      if (!mvpPlayer) {
        players.forEach(p => {
          const st = s.stats[p.id] || {};
          let actCount = 0;
          Object.keys(st).forEach(k => { actCount += (st[k] || 0); });
          const r = Store.calculateMatchRating(st, p.mainPosition);
          if (actCount > 0 && r > mvpRating && r >= 5.5) {
            mvpRating = r;
            mvpPlayer = p;
          }
        });
      }
    }

    const mvpHtml = (mvpPlayer && mvpRating >= 5.5) ? `
      <div class="mvp-chip" title="MVP: ${escapeHtml(Store.playerName(mvpPlayer))} (⭐ ${mvpRating.toFixed(1)})">
        ${renderAvatar(mvpPlayer, 'sm')}
        <div style="display: flex; flex-direction: column; line-height: 1.1; max-width: 65px;">
          <span style="font-size: 8.5px; font-weight: 800; color: #facc15;">⭐ MVP</span>
          <b class="ellipsis" style="font-size: 11px; color: var(--text);">${escapeHtml(Store.playerName(mvpPlayer).split(' ')[0])}</b>
          <span style="font-size: 9.5px; font-weight: 800; color: #22c55e;">${mvpRating.toFixed(1)}</span>
        </div>
      </div>
    ` : '';

    const attMap = s.attendance || {};
    const attKeys = Object.keys(attMap);
    let attPresent = 0;
    attKeys.forEach(k => {
      const rec = attMap[k];
      const st = (typeof rec === 'object' && rec !== null) ? rec.status : rec;
      if (st === 'present' || st === 'late') attPresent++;
    });
    const hasAtt = attKeys.length > 0;
    const todayIso = getTodayIso();
    const tomorrowIso = getTomorrowIso();
    const isToday = (s.date === todayIso);
    const isTomorrow = (s.date === tomorrowIso);
    const isPast = Boolean(s.date && s.date < todayIso);
    const cardStyle = getEventCardStyle(s, { isPast, isToday, isMatch: s.type === 'match' });

    const attChipHtml = hasAtt ? `
      <span class="btn-quick-att" data-att-sid="${s.id}" title="${t('rollCallTitle', 'Pasar Lista')}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 3px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
        📋 ${attPresent} ${t('present', 'Presentes')}
      </span>
    ` : (isToday ? `
      <span class="btn-quick-att pulse-att" data-att-sid="${s.id}" title="${t('rollCallTitle', 'Pasar Lista')}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 3px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
        📋 ${t('rollCallBtn', 'Pasar Lista')}
      </span>
    ` : `
      <span class="btn-quick-att" data-att-sid="${s.id}" title="${t('rollCallTitle', 'Pasar Lista')}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 3px; background: var(--surface2); color: var(--muted); border: 1px solid var(--border); font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 6px;">
        📋 ${t('attendance', 'Asistencia')}
      </span>
    `);

    // Obtener hora de inicio y duración programada de la sesión o de su convocatoria vinculada
    const linkedConv = s.convocationId ? Store.convocation(s.convocationId) : (Store.state.convocations || []).find(cv => cv.sessionId === s.id || (cv.date === s.date && cv.type === s.type));
    const schedStartTime = s.time || (linkedConv && linkedConv.time) || '';
    const schedEndTime = s.endTime || (linkedConv && linkedConv.endTime) || '';
    const schedDuration = s.duration || (linkedConv && linkedConv.duration) || 90;
    const timeBadgeHtml = schedStartTime ? `
      <span style="color: #38bdf8; font-weight: 800; display: inline-flex; align-items: center; gap: 3px; background: rgba(56, 189, 248, 0.12); padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10.5px;">
        ⏰ ${schedStartTime}${schedEndTime ? ' - ' + schedEndTime : ''}${schedDuration ? ' (' + schedDuration + ' min)' : ''}
      </span>
    ` : (schedDuration ? `
      <span style="color: #38bdf8; font-weight: 800; display: inline-flex; align-items: center; gap: 3px; background: rgba(56, 189, 248, 0.12); padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10.5px;">
        ⏱️ ${schedDuration} min
      </span>
    ` : '');

    if (s.type === 'match') {
      const matchTeams = cardStyle.teams;
      let teamObj = matchTeams[0] || null;
      if (!teamObj && Store.state.teams && Store.state.teams.length > 0) {
        teamObj = Store.state.teams[0];
      }
      const myTeamName = matchTeams.map(tm => tm.name).join(' / ') || (teamObj ? teamObj.name : 'Mi Equipo');
      const myTeamColor = teamObj ? (teamObj.color || '#22c55e') : '#22c55e';
      const rivalName = s.rival || (s.title ? s.title : t('rivalTeam', 'Rival'));
      const homeScore = (s.score && s.score.home != null) ? s.score.home : 0;
      const awayScore = (s.score && s.score.away != null) ? s.score.away : 0;

      const matchClass = isToday ? 'conv-card-match-today' : 'card-match-gold';

      return `
        <div class="session-item match ${isLive ? 'live' : ''} ${matchClass}" data-id="${s.id}" style="${cardStyle.styleStr}">
          <div class="grow" style="min-width: 0;">
            <div class="match-teams-bar">
              ${matchTeams.length > 1 ? `
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  ${matchTeams.map(tm => `
                    <span class="team-bubble-pill" style="border-color: ${tm.color || '#22c55e'}; background: ${tm.color || '#22c55e'}24; color: ${tm.color || '#22c55e'};" title="${escapeHtml(tm.name)}">
                      🛡️ ${escapeHtml(tm.name)}
                    </span>
                  `).join('')}
                </div>
              ` : `
                <span class="team-bubble-pill" style="border-color: ${myTeamColor}; background: ${myTeamColor}24; color: ${myTeamColor};" title="${escapeHtml(myTeamName)}">
                  🛡️ ${escapeHtml(myTeamName)}
                </span>
              `}
              <div class="score-pill-horiz">
                <span>${homeScore}</span>
                <span style="opacity: 0.55; font-size: 13px;">-</span>
                <span>${awayScore}</span>
              </div>
              <span class="rival-bubble-pill" title="${escapeHtml(rivalName)}">
                ⚔️ ${escapeHtml(rivalName)}
              </span>
            </div>
            <div class="meta" style="margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>📅 ${formatDateDDMMAAAA(s.date)}</span>
              ${timeBadgeHtml ? `<span>•</span>${timeBadgeHtml}` : ''}
              ${isToday ? `<span class="badge badge-today-glow" style="background: rgba(34, 211, 238, 0.25); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.6); font-weight: 900; font-size: 10px;">🌟 ${t('today', 'HOY')}</span>` : ''}
              ${isTomorrow ? `<span class="badge" style="background: rgba(165, 180, 252, 0.22); color: #c7d2fe; border: 1px solid rgba(165, 180, 252, 0.6); font-weight: 900; font-size: 10px;">🌅 ${t('tomorrow', 'MAÑANA')}</span>` : ''}
              <span>•</span>
              <span>⏱️ ${Store.fmtTime(Store.elapsed(s), s)}</span>
              ${isLive ? `<span class="badge live">${t('live')}</span>` : `<span class="badge match" style="font-size: 10px; padding: 2px 6px;">${typeLabel}</span>`}
              <span>•</span>
              ${attChipHtml}
            </div>
          </div>
          ${mvpHtml || (players.length > 0 ? `
            <div class="avatars-stack">
              ${players.slice(0, 3).map(p => renderAvatar(p, 'sm')).join('')}
            </div>
          ` : '')}
        </div>
      `;
    }

    const trainingTeams = cardStyle.teams;
    const todayClass = isToday ? 'conv-card-today' : '';

    return `
      <div class="session-item training ${isLive ? 'live' : ''} ${todayClass}" data-id="${s.id}" style="${cardStyle.styleStr}">
        <div class="s-ic">${emoji}</div>
        <div class="grow" style="min-width: 0;">
          <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; min-width: 0;">
              <h4 class="ellipsis" style="margin: 0;">${escapeHtml(Store.sessionTitle(s))}</h4>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              ${isToday ? `<span class="badge badge-today-glow" style="background: rgba(34, 211, 238, 0.25); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.6); font-weight: 900; font-size: 10px;">🌟 ${t('today', 'HOY')}</span>` : ''}
              ${isTomorrow ? `<span class="badge" style="background: rgba(165, 180, 252, 0.22); color: #c7d2fe; border: 1px solid rgba(165, 180, 252, 0.6); font-weight: 900; font-size: 10px;">🌅 ${t('tomorrow', 'MAÑANA')}</span>` : ''}
              ${isLive ? `<span class="badge live">${t('live')}</span>` : `<span class="badge training">${typeLabel}</span>`}
            </div>
          </div>
          ${trainingTeams.length > 0 ? `
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;">
              ${trainingTeams.map(tm => `
                <span class="badge" style="font-size: 9.5px; font-weight: 800; background: ${tm.color || '#22c55e'}22; color: ${tm.color || '#22c55e'}; border: 1px solid ${tm.color || '#22c55e'}50; padding: 1px 5px; border-radius: 5px;">
                  🛡️ ${escapeHtml(tm.name)}
                </span>
              `).join('')}
            </div>
          ` : ''}
          <div class="meta" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span>📅 ${formatDateDDMMAAAA(s.date)}</span>
            ${timeBadgeHtml ? `<span>•</span>${timeBadgeHtml}` : ''}
            <span>•</span>
            <span>${totalActions} ${t('actions')}</span>
            <span>•</span>
            <span>⏱️ ${Store.fmtTime(Store.elapsed(s), s)}</span>
            <span>•</span>
            ${attChipHtml}
          </div>
        </div>
        ${players.length > 0 ? `
          <div class="avatars-stack">
            ${players.slice(0, 3).map(p => renderAvatar(p, 'sm')).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /* =========================================================
     MODAL DE CONTROL DE ASISTENCIA (PASAR LISTA)
     ========================================================= */
  function showSessionAttendanceModal(sessionId) {
    const s = Store.session(sessionId);
    if (!s) return;

    const players = Store.getSessionPlayersForAttendance(sessionId);
    const existingAtt = Store.getSessionAttendance(sessionId) || {};

    const workingAtt = {};
    players.forEach(p => {
      const rec = existingAtt[p.id];
      if (rec) {
        workingAtt[p.id] = typeof rec === 'object'
          ? { status: rec.status, note: rec.note || '', updatedAt: rec.updatedAt || Date.now() }
          : { status: rec, note: '', updatedAt: Date.now() };
      }
    });

    let conv = s.convocationId ? Store.convocation(s.convocationId) : null;
    if (!conv) {
      conv = (Store.state.convocations || []).find(cv => cv.sessionId === s.id || (cv.date === s.date && cv.type === s.type && (!cv.rival || !s.rival || cv.rival === s.rival)));
      if (conv && !s.convocationId) {
        s.convocationId = conv.id;
        conv.sessionId = s.id;
        Store.save();
      }
    }
    let searchQuery = '';

    openSheet(t('rollCallTitle', 'Pasar Lista / Asistencia'), (body) => {
      const hasConvResponses = conv && conv.responses && Object.keys(conv.responses).length > 0;

      body.innerHTML = `
        <!-- Resumen de Sesión -->
        <div style="background: rgba(34, 211, 238, 0.07); border: 1px solid rgba(34, 211, 238, 0.25); border-radius: 14px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="min-width: 0; flex: 1;">
            <h4 style="margin: 0; font-size: 15px; font-weight: 900; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(Store.sessionTitle(s))}
            </h4>
            <div style="font-size: 11.5px; color: var(--muted); margin-top: 3px; display: flex; align-items: center; gap: 6px;">
              <span>📅 ${formatDateDDMMAAAA(s.date)}</span>
              <span>•</span>
              <span class="badge ${s.type}" style="font-size: 10px; padding: 1px 6px;">${s.type === 'match' ? t('match') : t('training')}</span>
            </div>
          </div>
          <div id="att-summary-mini" style="text-align: right; margin-left: 10px; flex-shrink: 0;"></div>
        </div>

        <!-- Acciones Rápidas -->
        <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
          <button type="button" class="btn sm" id="btn-att-mark-all" style="flex: 1; min-width: 140px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-weight: 800; border-radius: 10px; padding: 8px 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>✅</span> <span>${t('markAllPresent', 'Marcar todos presentes')}</span>
          </button>
          ${hasConvResponses ? `
            <button type="button" class="btn sm" id="btn-att-load-pwa" style="flex: 1; min-width: 140px; background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.4); font-weight: 800; border-radius: 10px; padding: 8px 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>📥</span> <span>${t('applyPlayerResponses', 'Cargar votos de la PWA')}</span>
            </button>
          ` : ''}
        </div>

        <!-- Búsqueda -->
        <div class="search" style="margin-bottom: 10px;">
          <input type="text" id="att-filter-search" placeholder="${t('searchPlayerPlaceholder', 'Buscar jugador...')}" style="width: 100%; border-radius: 10px; padding: 8px 12px; font-size: 13px; background: var(--surface2); color: #fff; border: 1px solid var(--border);" />
        </div>

        <!-- Píldoras de Estado -->
        <div id="att-counters-ribbon" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;"></div>

        <!-- Lista de Jugadores -->
        <div id="att-players-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
      `;

      function updateCounters() {
        let presentCount = 0;
        let absentCount = 0;
        let justifiedCount = 0;
        let lateCount = 0;
        let unmarkedCount = 0;

        players.forEach(p => {
          const rec = workingAtt[p.id];
          const st = rec ? rec.status : null;
          if (st === 'present') presentCount++;
          else if (st === 'absent') absentCount++;
          else if (st === 'justified') justifiedCount++;
          else if (st === 'late') lateCount++;
          else unmarkedCount++;
        });

        const total = players.length;
        const miniEl = body.querySelector('#att-summary-mini');
        if (miniEl) {
          miniEl.innerHTML = `
            <div style="font-size: 17px; font-weight: 900; color: #4ade80;">
              ${presentCount + lateCount} <span style="font-size: 12px; color: var(--muted); font-weight: 700;">/ ${total}</span>
            </div>
            <small style="font-size: 10px; color: var(--muted); text-transform: uppercase;">${t('present', 'Presentes')}</small>
          `;
        }

        const ribbonEl = body.querySelector('#att-counters-ribbon');
        if (ribbonEl) {
          ribbonEl.innerHTML = `
            <div style="flex-shrink: 0; background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #4ade80;">
              🟢 ${presentCount} ${t('present', 'Presentes')}
            </div>
            <div style="flex-shrink: 0; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #f87171;">
              ❌ ${absentCount} ${t('absent', 'Ausentes')}
            </div>
            <div style="flex-shrink: 0; background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.35); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #facc15;">
              🟡 ${justifiedCount} ${t('justified', 'Justificados')}
            </div>
            <div style="flex-shrink: 0; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #38bdf8;">
              ⏰ ${lateCount} ${t('late', 'Retraso')}
            </div>
            ${unmarkedCount > 0 ? `
              <div style="flex-shrink: 0; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.35); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #94a3b8;">
                ⚪ ${unmarkedCount} ${t('unmarked', 'Sin marcar')}
              </div>
            ` : ''}
          `;
        }
      }

      function renderList() {
        const q = searchQuery.trim().toLowerCase();
        const filtered = players.filter(p => {
          if (!q) return true;
          const name = (Store.playerName(p) || '').toLowerCase();
          const dorsal = String(p.mainDorsal != null ? p.mainDorsal : (p.jersey != null ? p.jersey : ''));
          return name.includes(q) || dorsal.includes(q);
        });

        const listEl = body.querySelector('#att-players-list');
        if (!listEl) return;

        if (filtered.length === 0) {
          listEl.innerHTML = `
            <div class="empty-state card" style="padding: 24px; text-align: center;">
              <p style="margin: 0; color: var(--muted);">${t('noPlayersFound', 'No se encontraron jugadores.')}</p>
            </div>
          `;
          return;
        }

        listEl.innerHTML = filtered.map(p => {
          const rec = workingAtt[p.id];
          const curStatus = rec ? rec.status : null;
          const pwaVote = (conv && conv.responses && conv.responses[p.id]) ? conv.responses[p.id] : null;
          const pwaStatus = (typeof pwaVote === 'object' && pwaVote !== null) ? pwaVote.status : pwaVote;
          const pwaNotes = (typeof pwaVote === 'object' && pwaVote !== null) ? (pwaVote.notes || pwaVote.reason || '') : '';
          const pwaTime = (typeof pwaVote === 'object' && pwaVote !== null) ? (pwaVote.timestamp || pwaVote.time) : null;
          const pwaTimeFormatted = pwaTime && window.formatAttendanceDateTime ? window.formatAttendanceDateTime(pwaTime) : '';
          let curNote = (rec && rec.note) || '';
          if (!curNote && pwaNotes) {
            curNote = pwaNotes;
            if (rec) rec.note = pwaNotes;
          }

          return `
            <div class="card att-player-card" data-pid="${p.id}" style="padding: 10px 12px; border: 1px solid ${curStatus ? 'rgba(34, 211, 238, 0.25)' : 'var(--border)'}; background: ${curStatus ? 'rgba(15, 23, 42, 0.7)' : 'var(--surface2)'}; border-radius: 12px; margin-bottom: 0;">
              <div style="display: flex; align-items: center; gap: 10px;">
                ${renderAvatar(p, 'sm')}
                <div style="flex: 1; min-width: 0;">
                  <b style="font-size: 13.5px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">
                    #${p.mainDorsal != null ? p.mainDorsal : (p.jersey != null ? p.jersey : '-')} ${escapeHtml(Store.playerName(p))}
                  </b>
                  <div style="font-size: 11px; color: var(--muted); display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 1px;">
                    <span>${p.mainPosition || 'Jugador'}</span>
                    ${pwaVote ? (pwaStatus === 'yes' || pwaStatus === 'attending' || pwaStatus === 'called'
                      ? `<span style="color: #4ade80; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">🟢 PWA: ${t('attendanceConfirmed', 'Asistirá')}${pwaTimeFormatted ? ` <span style="font-weight: 600; opacity: 0.9; font-size: 10px; color: #86efac; background: rgba(34, 197, 94, 0.15); padding: 1px 5px; border-radius: 4px;">🕒 ${escapeHtml(pwaTimeFormatted)}</span>` : ''}</span>`
                      : `<span style="color: #f87171; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">❌ PWA: ${t('absenceReported', 'No asistirá')}${pwaTimeFormatted ? ` <span style="font-weight: 600; opacity: 0.9; font-size: 10px; color: #fca5a5; background: rgba(239, 68, 68, 0.15); padding: 1px 5px; border-radius: 4px;">🕒 ${escapeHtml(pwaTimeFormatted)}</span>` : ''}</span>`)
                      : ''}
                    ${pwaNotes ? `<span style="color: #fca5a5; font-style: italic; background: rgba(239, 68, 68, 0.15); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">💬 ${escapeHtml(pwaNotes)}</span>` : ''}
                    ${(rec && rec.updatedAt) ? `
                      <span style="font-size: 10px; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 4px;" title="Registro manual">
                        ✏️ ${escapeHtml(window.formatAttendanceDateTime ? window.formatAttendanceDateTime(rec.updatedAt) : '')}
                      </span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- Botones de Estado -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;">
                <button type="button" class="att-status-btn ${curStatus === 'present' ? 'active-present' : ''}" data-status="present" style="padding: 6px 2px; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid ${curStatus === 'present' ? '#22c55e' : 'rgba(34, 197, 94, 0.3)'}; background: ${curStatus === 'present' ? '#22c55e' : 'rgba(34, 197, 94, 0.08)'}; color: ${curStatus === 'present' ? '#fff' : '#4ade80'}; cursor: pointer;">
                  🟢 ${t('present', 'Presente')}
                </button>
                <button type="button" class="att-status-btn ${curStatus === 'absent' ? 'active-absent' : ''}" data-status="absent" style="padding: 6px 2px; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid ${curStatus === 'absent' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)'}; background: ${curStatus === 'absent' ? '#ef4444' : 'rgba(239, 68, 68, 0.08)'}; color: ${curStatus === 'absent' ? '#fff' : '#f87171'}; cursor: pointer;">
                  ❌ ${t('absent', 'Ausente')}
                </button>
                <button type="button" class="att-status-btn ${curStatus === 'justified' ? 'active-justified' : ''}" data-status="justified" style="padding: 6px 2px; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid ${curStatus === 'justified' ? '#eab308' : 'rgba(234, 179, 8, 0.3)'}; background: ${curStatus === 'justified' ? '#eab308' : 'rgba(234, 179, 8, 0.08)'}; color: ${curStatus === 'justified' ? '#000' : '#facc15'}; cursor: pointer;">
                  🟡 ${t('justified', 'Justif.')}
                </button>
                <button type="button" class="att-status-btn ${curStatus === 'late' ? 'active-late' : ''}" data-status="late" style="padding: 6px 2px; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid ${curStatus === 'late' ? '#0284c7' : 'rgba(56, 189, 248, 0.3)'}; background: ${curStatus === 'late' ? '#0284c7' : 'rgba(56, 189, 248, 0.08)'}; color: ${curStatus === 'late' ? '#fff' : '#38bdf8'}; cursor: pointer;">
                  ⏰ ${t('late', 'Retraso')}
                </button>
              </div>

              <!-- Nota opcional -->
              <div style="margin-top: 6px;">
                <input type="text" class="att-note-input" data-note-pid="${p.id}" value="${escapeHtml(curNote)}" placeholder="${t('notePlaceholder', 'Nota opcional (ej. motivo, hora...)')}" style="width: 100%; font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.25); border: 1px solid var(--border); color: #cbd5e1;" />
              </div>
            </div>
          `;
        }).join('');

        // Bind status buttons in list
        listEl.querySelectorAll('.att-status-btn').forEach(btn => {
          btn.onclick = () => {
            const card = btn.closest('.att-player-card');
            const pid = card.getAttribute('data-pid');
            const st = btn.getAttribute('data-status');
            const prev = workingAtt[pid];
            const noteInput = card.querySelector('.att-note-input');
            const curNote = noteInput ? noteInput.value.trim() : ((prev && prev.note) || '');

            if (prev && prev.status === st) {
              delete workingAtt[pid];
            } else {
              workingAtt[pid] = { status: st, note: curNote, updatedAt: Date.now() };
            }
            haptic(20);
            updateCounters();
            renderList();
          };
        });

        // Bind note input
        listEl.querySelectorAll('.att-note-input').forEach(inp => {
          inp.onchange = () => {
            const pid = inp.getAttribute('data-note-pid');
            if (workingAtt[pid]) {
              workingAtt[pid].note = inp.value.trim();
            } else if (inp.value.trim()) {
              workingAtt[pid] = { status: 'present', note: inp.value.trim(), updatedAt: Date.now() };
              updateCounters();
            }
          };
        });
      }

      // Bind search input
      const searchInp = body.querySelector('#att-filter-search');
      if (searchInp) {
        searchInp.oninput = (e) => {
          searchQuery = e.target.value;
          renderList();
        };
      }

      // Marcar todos presentes
      const btnAll = body.querySelector('#btn-att-mark-all');
      if (btnAll) {
        btnAll.onclick = () => {
          players.forEach(p => {
            const prev = workingAtt[p.id];
            workingAtt[p.id] = {
              status: 'present',
              note: (prev && prev.note) || '',
              updatedAt: Date.now()
            };
          });
          haptic(30);
          updateCounters();
          renderList();
        };
      }

      // Cargar respuestas PWA
      const btnLoadPwa = body.querySelector('#btn-att-load-pwa');
      if (btnLoadPwa && conv && conv.responses) {
        btnLoadPwa.onclick = () => {
          players.forEach(p => {
            const resp = conv.responses[p.id];
            if (resp) {
              const isYes = (resp === 'yes' || resp === 'attending');
              const isNo = (resp === 'no' || resp === 'absent');
              if (isYes) {
                workingAtt[p.id] = { status: 'present', note: (workingAtt[p.id] && workingAtt[p.id].note) || '', updatedAt: Date.now() };
              } else if (isNo) {
                workingAtt[p.id] = { status: 'absent', note: (workingAtt[p.id] && workingAtt[p.id].note) || '', updatedAt: Date.now() };
              }
            }
          });
          haptic(35);
          toast(t('playerResponsesApplied', 'Votos de la PWA cargados'), 'info');
          updateCounters();
          renderList();
        };
      }

      updateCounters();
      renderList();
    }, (foot) => {
      foot.innerHTML = `
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn" id="btn-att-cancel" style="flex: 1;">${t('cancel', 'Cancelar')}</button>
          <button type="button" class="btn primary" id="btn-att-save" style="flex: 2; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>💾</span> <span>${t('saveAttendance', 'Guardar Asistencia')}</span>
          </button>
        </div>
      `;

      foot.querySelector('#btn-att-cancel').onclick = closeSheet;
      foot.querySelector('#btn-att-save').onclick = () => {
        Store.setSessionAttendance(sessionId, workingAtt, true);
        closeSheet();
        toast(t('attendanceSaved', 'Asistencia guardada con éxito'), 'success');

        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        if (activeSessionId === sessionId) {
          renderTracker();
        }
        if (currentTab === 'convocations') {
          renderConvocationsView();
        } else if (currentTab === 'home') {
          renderHomeView();
        }
      };
    });
  }

  window.openAttendanceModal = showSessionAttendanceModal;

  /* =========================================================
     MODAL NUEVA SESIÓN (CON PRESET DE BOTONES)
     ========================================================= */
  function showNewSessionModal(defaultType) {
    let selectedType = defaultType || 'training';
    let chosenButtonKeys = null;
    let selectedTeamIds = [];
    let customKeys = (Store.state.settings.enabledStats && Store.state.settings.enabledStats.length)
      ? Store.state.settings.enabledStats.slice()
      : Store.STATS.filter(s => s.def).map(s => s.key);

    openSheet(t('newSession'), (body) => {
      body.innerHTML = `
        <div class="type-pick">
          <button type="button" class="${selectedType === 'training' ? 'active training' : ''}" id="pick-training">
            <span>⚽</span>
            <b>${t('training')}</b>
          </button>
          <button type="button" class="${selectedType === 'match' ? 'active match' : ''}" id="pick-match">
            <span>🏆</span>
            <b>${t('match')}</b>
          </button>
        </div>

        ${renderDatePickerFieldHtml('sess-date', new Date().toISOString().slice(0, 10), t('date'))}
        ${renderTimePickerFieldHtml('sess-time', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), t('time', 'Hora'))}

        <div class="field" id="field-rival" style="${selectedType === 'match' ? '' : 'display: none;'}">
          <label>${t('rivalTeam')}</label>
          <input type="text" id="sess-rival" placeholder="${t('rivalPlaceholder')}" />
        </div>

        <div class="field" id="field-title" style="${selectedType === 'training' ? '' : 'display: none;'}">
          <label>${t('sessionTitle')}</label>
          <input type="text" id="sess-title" placeholder="${t('sessionTitlePlaceholder')}" />
        </div>

        <div class="field">
          <label>${t('activeButtons')}</label>
          <div class="segmented" id="preset-buttons-selector" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;">
            <button type="button" class="active" data-preset="all">${t('presetAll')}</button>
            <button type="button" data-preset="touches-passes">${t('presetTouchesPasses')}</button>
            <button type="button" data-preset="shots">${t('presetShots')}</button>
            <button type="button" data-preset="custom">${t('presetCustom')}</button>
          </div>

          <div id="custom-buttons-container" style="display: none;">
            <p class="hint" style="margin: 8px 0 4px;">${t('selectButtonsForView')}</p>
            <div class="custom-buttons-grid">
              ${Store.STATS.map(stat => {
                const isChecked = customKeys.includes(stat.key);
                return `
                  <div class="btn-check-chip ${isChecked ? 'active' : ''}" data-key="${stat.key}">
                    <span class="c-emoji">${stat.emoji}</span>
                    <span class="c-lbl">${stat.short}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="field">
          <label>${t('team')}</label>
          <input type="hidden" id="sess-team" value="" />
          <div class="team-bubbles-container" id="sess-team-bubbles">
            <div class="team-bubble active" data-tid="" style="border-color: rgba(255, 255, 255, 0.25);">
              <span class="dot" style="background: #94a3b8;"></span>
              <span>${t('allTeams')}</span>
              <span class="check-icon">✓</span>
            </div>
            ${Store.state.teams.map(tm => {
              const tmColor = tm.color || '#22d3ee';
              return `
                <div class="team-bubble" data-tid="${tm.id}" style="border-color: ${tmColor}; color: #fff;">
                  <span class="dot" style="background: ${tmColor};"></span>
                  <span>${escapeHtml(tm.name)}</span>
                  <span class="check-icon" style="color: ${tmColor};">✓</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      const btnTr = body.querySelector('#pick-training');
      const btnMt = body.querySelector('#pick-match');
      const fRival = body.querySelector('#field-rival');
      const fTitle = body.querySelector('#field-title');
      const customContainer = body.querySelector('#custom-buttons-container');

      selectedTeamIds = [];

      // Selección de burbujas de equipo:
      // - PARTIDO: Sólo se permite elegir UN ÚNICO EQUIPO
      // - ENTRENAMIENTO: Se permite seleccionar más de un equipo
      const allTeamsBubble = body.querySelector('#sess-team-bubbles .team-bubble[data-tid=""]');
      const specificTeamBubbles = body.querySelectorAll('#sess-team-bubbles .team-bubble:not([data-tid=""])');

      if (allTeamsBubble) {
        allTeamsBubble.onclick = () => {
          if (selectedType === 'match') return; // En partido no se puede seleccionar "todos los equipos"
          selectedTeamIds = [];
          allTeamsBubble.classList.add('active');
          specificTeamBubbles.forEach(x => x.classList.remove('active'));
          const inp = document.getElementById('sess-team');
          if (inp) inp.value = '';
          haptic(20);
        };
      }

      specificTeamBubbles.forEach(tb => {
        tb.onclick = () => {
          const tid = tb.getAttribute('data-tid');
          if (selectedType === 'match') {
            // Estrictamente UN SOLO EQUIPO en partidos
            selectedTeamIds = [tid];
            specificTeamBubbles.forEach(x => x.classList.remove('active'));
            tb.classList.add('active');
            if (allTeamsBubble) allTeamsBubble.classList.remove('active');
          } else {
            // En entrenamientos se permiten múltiples equipos
            if (selectedTeamIds.includes(tid)) {
              selectedTeamIds = selectedTeamIds.filter(x => x !== tid);
              tb.classList.remove('active');
            } else {
              selectedTeamIds.push(tid);
              tb.classList.add('active');
            }

            if (selectedTeamIds.length === 0) {
              if (allTeamsBubble) allTeamsBubble.classList.add('active');
            } else {
              if (allTeamsBubble) allTeamsBubble.classList.remove('active');
            }
          }

          const inp = document.getElementById('sess-team');
          if (inp) inp.value = selectedTeamIds.join(',');
          haptic(20);
        };
      });

      btnTr.onclick = () => {
        selectedType = 'training';
        btnTr.className = 'active training';
        btnMt.className = '';
        fRival.style.display = 'none';
        fTitle.style.display = '';
        if (allTeamsBubble) allTeamsBubble.style.display = '';
      };

      btnMt.onclick = () => {
        selectedType = 'match';
        btnMt.className = 'active match';
        btnTr.className = '';
        fRival.style.display = '';
        fTitle.style.display = 'none';
        if (allTeamsBubble) allTeamsBubble.style.display = 'none';
        // En partidos solo puede haber 1 equipo seleccionado
        if (selectedTeamIds.length > 1) {
          selectedTeamIds = [selectedTeamIds[0]];
        } else if (selectedTeamIds.length === 0 && Store.state.teams.length > 0) {
          selectedTeamIds = [Store.state.teams[0].id];
        }
        specificTeamBubbles.forEach(tb => {
          tb.classList.toggle('active', selectedTeamIds.includes(tb.getAttribute('data-tid')));
        });
        if (allTeamsBubble) allTeamsBubble.classList.remove('active');
        const inp = document.getElementById('sess-team');
        if (inp) inp.value = selectedTeamIds.join(',');
      };

      body.querySelectorAll('#preset-buttons-selector button').forEach(pb => {
        pb.onclick = () => {
          body.querySelectorAll('#preset-buttons-selector button').forEach(x => x.classList.remove('active'));
          pb.classList.add('active');
          const p = pb.getAttribute('data-preset');
          if (p === 'touches-passes') {
            customContainer.style.display = 'none';
            chosenButtonKeys = ['touches', 'passOk', 'passKo'];
          } else if (p === 'shots') {
            customContainer.style.display = 'none';
            chosenButtonKeys = ['shotOn', 'shotOff', 'goal'];
          } else if (p === 'custom') {
            customContainer.style.display = 'block';
            chosenButtonKeys = Store.getSortedStats(customKeys).map(s => s.key);
          } else {
            customContainer.style.display = 'none';
            chosenButtonKeys = null; // Todos
          }
        };
      });

      // Selección de botones en modo Personalizado
      customContainer.querySelectorAll('.btn-check-chip').forEach(chip => {
        chip.onclick = () => {
          const k = chip.getAttribute('data-key');
          const idx = customKeys.indexOf(k);
          if (idx >= 0) {
            if (customKeys.length <= 1) {
              toast(t('minTwoButtons'), 'error');
              return;
            }
            customKeys.splice(idx, 1);
            chip.classList.remove('active');
          } else {
            customKeys.push(k);
            chip.classList.add('active');
          }
          chosenButtonKeys = Store.getSortedStats(customKeys).map(s => s.key);
        };
      });

      bindDatePickerField('sess-date', body);
      bindTimePickerField('sess-time', body);
    }, (foot) => {
      foot.innerHTML = `
        <button class="btn block ${selectedType === 'match' ? 'match' : 'primary'}" id="btn-start-session">
          ${t('startSession')}
        </button>
      `;

      foot.querySelector('#btn-start-session').onclick = () => {
        const textInp = document.getElementById('sess-date-text');
        const hiddenInp = document.getElementById('sess-date');
        if (textInp && hiddenInp) {
          const parsed = parseInputDateToIso(textInp.value);
          if (parsed) hiddenInp.value = parsed;
        }
        const date = hiddenInp ? hiddenInp.value : new Date().toISOString().slice(0, 10);
        const rivalInp = document.getElementById('sess-rival');
        const titleInp = document.getElementById('sess-title');
        const rival = rivalInp ? rivalInp.value.trim() : '';
        const title = titleInp ? titleInp.value.trim() : '';

        const s = Store.createSession({
          type: selectedType,
          date,
          rival,
          title,
          teamId: selectedTeamIds[0] || '',
          teamIds: selectedTeamIds,
          enabledStats: chosenButtonKeys
        });

        // Crear automáticamente la convocatoria vinculada para que los jugadores la reciban en su app
        try {
          const targetPlayers = Store.state.players.filter(p => {
            if (!selectedTeamIds.length) return true;
            return selectedTeamIds.includes(p.teamId);
          });
          const convList = {};
          targetPlayers.forEach(p => { convList[p.id] = 'called'; });

          const autoTitle = title || (selectedType === 'match' ? (rival || t('match', 'Partido')) : t('training', 'Entrenamiento'));
          const sessTimeInp = document.getElementById('sess-time');
          const sessTime = (sessTimeInp && sessTimeInp.value) ? sessTimeInp.value.trim() : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          Store.upsertConvocation({
            id: 'conv_' + s.id,
            sessionId: s.id,
            type: selectedType,
            title: autoTitle,
            date: date,
            time: sessTime || '10:00',
            rival: rival || '',
            teamId: selectedTeamIds[0] || '',
            teamIds: selectedTeamIds,
            list: convList
          });
        } catch (err) {
          console.error('Error auto-creando convocatoria desde sesión:', err);
        }

        // Sincronizar inmediatamente a la nube
        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        closeSheet();
        openTracker(s.id);
      };
    });
  }

  /* =========================================================
     MODAL DE CONFIGURACIÓN DE MODO DEL TEMPORIZADOR (CRONO / CUENTA ATRÁS)
     ========================================================= */
  function showTimerSettingsModal(session) {
    let mode = session.timerMode || 'chrono';
    let targetMin = Math.round((session.countdownTargetMs || (25 * 60 * 1000)) / (60 * 1000));

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog-box" style="max-width: 380px;">
        <h3 style="margin: 0 0 8px; text-align: center; font-size: 18px; font-weight: 900;">
          ⏱️ Modo del Temporizador
        </h3>
        <p class="hint" style="margin-bottom: 14px; text-align: center;">
          Elige si deseas cronómetro progresivo o cuenta atrás con tiempo fijado:
        </p>

        <div class="segmented" style="margin-bottom: 14px;">
          <button type="button" id="btn-mode-chrono" class="${mode === 'chrono' ? 'active' : ''}">
            Cronómetro
          </button>
          <button type="button" id="btn-mode-countdown" class="${mode === 'countdown' ? 'active' : ''}">
            Cuenta Atrás
          </button>
        </div>

        <div id="countdown-config-section" style="${mode === 'countdown' ? '' : 'display: none;'} margin-bottom: 16px;">
          <label style="font-size: 12px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 6px;">
            Minutos de la cuenta atrás:
          </label>
          <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
            ${[15, 20, 25, 30, 40, 45].map(m => `
              <button type="button" class="btn sm ghost preset-min-btn" data-min="${m}" style="padding: 5px 10px; font-weight: 800; ${targetMin === m ? 'border-color: var(--cyan); color: var(--cyan); background: rgba(34,211,238,0.15);' : ''}">
                ${m} min
              </button>
            `).join('')}
          </div>
          <input type="number" id="input-countdown-min" value="${targetMin}" min="1" max="180" style="width: 100%; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-size: 16px; font-weight: 800; text-align: center;" />
          <small style="display: block; color: var(--muted); font-size: 11px; margin-top: 6px; text-align: center;">
            Al llegar a 00:00 continuará contando en negativo (-00:01, -00:02...) hasta que lo pares.
          </small>
        </div>

        <div class="btn-row" style="margin-top: 10px;">
          <button type="button" class="btn ghost" id="btn-reset-timer-time" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);">
            Reiniciar
          </button>
          <button type="button" class="btn primary grow" id="btn-save-timer-mode">
            Guardar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const bChrono = dialog.querySelector('#btn-mode-chrono');
    const bCountdown = dialog.querySelector('#btn-mode-countdown');
    const cdSection = dialog.querySelector('#countdown-config-section');
    const inputMin = dialog.querySelector('#input-countdown-min');

    bChrono.onclick = () => {
      mode = 'chrono';
      bChrono.classList.add('active');
      bCountdown.classList.remove('active');
      cdSection.style.display = 'none';
    };
    bCountdown.onclick = () => {
      mode = 'countdown';
      bCountdown.classList.add('active');
      bChrono.classList.remove('active');
      cdSection.style.display = 'block';
    };

    dialog.querySelectorAll('.preset-min-btn').forEach(btn => {
      btn.onclick = () => {
        const m = parseInt(btn.getAttribute('data-min'), 10);
        targetMin = m;
        inputMin.value = m;
        dialog.querySelectorAll('.preset-min-btn').forEach(x => {
          x.style.borderColor = '';
          x.style.color = '';
          x.style.background = '';
        });
        btn.style.borderColor = 'var(--cyan)';
        btn.style.color = 'var(--cyan)';
        btn.style.background = 'rgba(34,211,238,0.15)';
      };
    });

    dialog.querySelector('#btn-reset-timer-time').onclick = () => {
      confirmDialog('Reiniciar Tiempo', '¿Deseas reiniciar el contador de tiempo a cero?', () => {
        Store.resetTimer(session);
        dialog.remove();
        renderTracker();
      });
    };

    dialog.querySelector('#btn-save-timer-mode').onclick = () => {
      const minVal = parseInt(inputMin.value, 10) || 25;
      Store.setTimerMode(session.id, mode, minVal);
      dialog.remove();
      renderTracker();
    };

    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }

  /* =========================================================
     TRACKER EN PANTALLA DIVIDIDA (1 O 2 JUGADORES)
     ========================================================= */
  function openTracker(sessionId) {
    activeSessionId = sessionId;
    const session = Store.session(sessionId);
    if (!session) {
      toast('Sesión no encontrada', 'error');
      return;
    }

    let trackerEl = document.getElementById('tracker-fullscreen');
    if (!trackerEl) {
      trackerEl = document.createElement('div');
      trackerEl.id = 'tracker-fullscreen';
      trackerEl.className = 'tracker';
      document.body.appendChild(trackerEl);
    }

    startTimerTicker();
    renderTracker();

    // Si es sesión de hoy y aún no tiene lista pasada, abrir pasar lista
    const todayStr = getTodayIso();
    if (session.date === todayStr && (!session.attendance || Object.keys(session.attendance).length === 0) && !session._attendancePromptShown) {
      session._attendancePromptShown = true;
      setTimeout(() => {
        showSessionAttendanceModal(sessionId);
      }, 300);
    }
  }

  function closeTracker() {
    stopTimerTicker();
    if (activeLiveTrackerUnsub) {
      try { activeLiveTrackerUnsub(); } catch (e) {}
      activeLiveTrackerUnsub = null;
    }
    activeSessionId = null;
    const el = document.getElementById('tracker-fullscreen');
    if (el) el.remove();
    navigate(currentTab);
  }

  function startTimerTicker() {
    stopTimerTicker();
    timerInterval = setInterval(() => {
      const s = Store.session(activeSessionId);
      if (!s) return;
      const chronoEl = document.getElementById('tracker-chrono-val');
      const btnChrono = document.getElementById('tracker-btn-chrono');
      if (chronoEl) {
        const timeStr = Store.fmtTime(Store.elapsed(s), s);
        chronoEl.textContent = timeStr;
        if (btnChrono) {
          if (timeStr.startsWith('-')) btnChrono.classList.add('negative');
          else btnChrono.classList.remove('negative');
        }
      }
    }, 1000);
  }

  function stopTimerTicker() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /* =========================================================
     ASISTENTE DE EMPAREJAMIENTO PARA DUELOS 1v1 Y TRÍOS
     ========================================================= */
  function show1v1PairingModal(session, onDone) {
    session.duels1v1 = session.duels1v1 || { pairs: [], activePairIndex: 0 };
    let pairs = (session.duels1v1.pairs || []).slice();

    const pids = Store.sessionPlayerIds(session);
    let allSessionPlayers = pids.map(id => Store.player(id)).filter(Boolean);
    if (allSessionPlayers.length === 0) {
      const sessTeams = Array.isArray(session.teamIds) && session.teamIds.length > 0 ? session.teamIds : (session.teamId ? [session.teamId] : []);
      const filterT = sessTeams.length === 1 ? sessTeams[0] : (sessTeams.length > 1 ? sessTeams : 'all');
      allSessionPlayers = Store.sortedPlayers(filterT);
    }
    if (allSessionPlayers.length === 0) {
      allSessionPlayers = Store.sortedPlayers('all');
    }

    let mode = 'pair'; // 'pair' (2) | 'trio' (3)
    let selectedPlayerIds = [];

    openSheet('⚔️ ' + t('setup1v1Pairs', 'Configurar Parejas y Tríos 1v1'), (body) => {
      function renderWizard() {
        const pairedIdSet = new Set();
        pairs.forEach(pr => {
          (pr.playerIds || []).forEach(pid => pairedIdSet.add(pid));
        });

        const available = allSessionPlayers.filter(p => !pairedIdSet.has(p.id));

        body.innerHTML = `
          <!-- Selector de Modo: Parejas vs Tríos -->
          <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="segmented" style="margin: 0; flex: 1;">
              <button type="button" class="${mode === 'pair' ? 'active' : ''}" id="wizard-mode-pair">
                👥 ${t('modePair', 'Parejas (2)')}
              </button>
              <button type="button" class="${mode === 'trio' ? 'active' : ''}" id="wizard-mode-trio">
                🔺 ${t('modeTrio', 'Tríos (3)')}
              </button>
            </div>
            <button type="button" class="btn sm ghost" id="wizard-btn-auto-pair" style="font-size: 11px; font-weight: 800; border-color: rgba(34, 211, 238, 0.4); color: var(--cyan); white-space: nowrap;">
              ⚡ ${t('autoPair', 'Emparejar al azar')}
            </button>
          </div>

          <!-- Selección en curso -->
          ${selectedPlayerIds.length > 0 ? `
            <div style="background: rgba(34, 211, 238, 0.12); border: 1.5px solid var(--cyan); border-radius: 12px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 12px; font-weight: 800; color: var(--cyan);">
                Seleccionando para ${mode === 'pair' ? 'Pareja' : 'Trío'}: ${selectedPlayerIds.map(pid => {
                  const pl = Store.player(pid);
                  return pl ? `#${pl.mainDorsal || ''} ${escapeHtml(Store.playerName(pl))}` : pid;
                }).join(' + ')} (${selectedPlayerIds.length}/${mode === 'pair' ? 2 : 3})
              </div>
              <button type="button" class="btn sm ghost" id="wizard-btn-cancel-sel" style="font-size: 11px; padding: 2px 6px;">✕</button>
            </div>
          ` : ''}

          <!-- Jugadores Disponibles -->
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase;">
                Jugadores disponibles (${available.length})
              </span>
              <span style="font-size: 11px; color: var(--muted);">Toca para emparejar</span>
            </div>

            ${available.length === 0 ? `
              <div class="card" style="padding: 14px; text-align: center; color: #4ade80; font-size: 12.5px; border: 1px dashed rgba(34, 197, 94, 0.4);">
                ✅ ¡Todos los jugadores han sido asignados a un duelo!
              </div>
            ` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 6px; max-height: 28vh; overflow-y: auto; padding-right: 2px;">
                ${available.map(p => {
                  const isSel = selectedPlayerIds.includes(p.id);
                  return `
                    <div class="card wizard-player-chip" data-w-pid="${p.id}" style="padding: 8px 4px; text-align: center; cursor: pointer; border-radius: 10px; border: 1.5px solid ${isSel ? 'var(--cyan)' : 'var(--border)'}; background: ${isSel ? 'rgba(34, 211, 238, 0.2)' : 'var(--surface2)'};">
                      ${renderAvatar(p, 'sm')}
                      <div class="ellipsis" style="font-size: 11px; font-weight: 800; color: #fff; margin-top: 4px;">
                        ${escapeHtml(Store.playerName(p).split(' ')[0])}
                      </div>
                      <div style="font-size: 9.5px; color: var(--muted);">#${p.mainDorsal != null ? p.mainDorsal : '-'}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Parejas y Tríos Creados -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; font-weight: 800; color: var(--text); text-transform: uppercase;">
                Duelos Creados (${pairs.length})
              </span>
              ${pairs.length > 0 ? `
                <button type="button" class="link danger" id="wizard-btn-clear-all" style="font-size: 11px;">
                  🗑️ ${t('clearPairs', 'Vaciar')}
                </button>
              ` : ''}
            </div>

            ${pairs.length === 0 ? `
              <div class="card" style="padding: 16px; text-align: center; color: var(--muted); font-size: 12px; border: 1px dashed var(--border);">
                Pulsa sobre dos jugadores para crear tu primera pareja de duelo.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px; max-height: 24vh; overflow-y: auto;">
                ${pairs.map((pr, idx) => {
                  const prPlayers = (pr.playerIds || []).map(id => Store.player(id)).filter(Boolean);
                  return `
                    <div class="card" style="padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border); border-radius: 10px;">
                      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <span style="font-size: 12.5px; font-weight: 900; color: #fb923c;">${pr.name}</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          ${prPlayers.map(pl => `
                            <span class="badge" style="font-size: 10.5px; background: rgba(255,255,255,0.1); color: #fff;">
                              #${pl.mainDorsal || ''} ${escapeHtml(Store.playerName(pl).split(' ')[0])}
                            </span>
                          `).join('<span style="color: var(--muted); font-size: 11px;">vs</span>')}
                        </div>
                      </div>
                      <button type="button" class="icon-btn ghost danger wizard-delete-pair" data-del-idx="${idx}" style="width: 28px; height: 28px; font-size: 13px;">
                        🗑️
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        `;

        const btnPair = body.querySelector('#wizard-mode-pair');
        if (btnPair) btnPair.onclick = () => { mode = 'pair'; selectedPlayerIds = []; renderWizard(); };
        const btnTrio = body.querySelector('#wizard-mode-trio');
        if (btnTrio) btnTrio.onclick = () => { mode = 'trio'; selectedPlayerIds = []; renderWizard(); };

        const btnCancelSel = body.querySelector('#wizard-btn-cancel-sel');
        if (btnCancelSel) btnCancelSel.onclick = () => { selectedPlayerIds = []; renderWizard(); };

        const btnClearAll = body.querySelector('#wizard-btn-clear-all');
        if (btnClearAll) {
          btnClearAll.onclick = () => {
            pairs = [];
            selectedPlayerIds = [];
            renderWizard();
          };
        }

        const btnAutoPair = body.querySelector('#wizard-btn-auto-pair');
        if (btnAutoPair) {
          btnAutoPair.onclick = () => {
            const avail = allSessionPlayers.filter(p => !pairedIdSet.has(p.id));
            if (avail.length < 2) {
              toast('No hay suficientes jugadores disponibles para emparejar', 'warning');
              return;
            }
            const shuffled = avail.slice().sort(() => Math.random() - 0.5);
            while (shuffled.length >= 2) {
              if (shuffled.length === 3 && mode === 'trio') {
                const trioPlayers = [shuffled.pop().id, shuffled.pop().id, shuffled.pop().id];
                const letter = String.fromCharCode(65 + pairs.length);
                pairs.push({ id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), name: 'Trío ' + letter, type: 'trio', playerIds: trioPlayers, trioRotation: 0 });
                break;
              }
              const p1 = shuffled.pop().id;
              const p2 = shuffled.pop().id;
              const letter = String.fromCharCode(65 + pairs.length);
              pairs.push({ id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), name: 'Pareja ' + letter, type: 'pair', playerIds: [p1, p2], trioRotation: 0 });
            }
            selectedPlayerIds = [];
            haptic(30);
            renderWizard();
          };
        }

        body.querySelectorAll('.wizard-player-chip').forEach(chip => {
          chip.onclick = () => {
            const pid = chip.getAttribute('data-w-pid');
            if (selectedPlayerIds.includes(pid)) {
              selectedPlayerIds = selectedPlayerIds.filter(id => id !== pid);
            } else {
              selectedPlayerIds.push(pid);
              const maxNeeded = mode === 'pair' ? 2 : 3;
              if (selectedPlayerIds.length === maxNeeded) {
                const letter = String.fromCharCode(65 + pairs.length);
                const prefix = mode === 'pair' ? 'Pareja ' : 'Trío ';
                pairs.push({
                  id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  name: prefix + letter,
                  type: mode,
                  playerIds: selectedPlayerIds.slice(),
                  trioRotation: 0
                });
                selectedPlayerIds = [];
                haptic(35);
              }
            }
            renderWizard();
          };
        });

        body.querySelectorAll('.wizard-delete-pair').forEach(btn => {
          btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-del-idx'), 10);
            pairs.splice(idx, 1);
            pairs.forEach((pr, i) => {
              const letter = String.fromCharCode(65 + i);
              const prefix = pr.type === 'trio' ? 'Trío ' : 'Pareja ';
              pr.name = prefix + letter;
            });
            renderWizard();
          };
        });
      }

      renderWizard();
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="wizard-btn-cancel">${t('cancel')}</button>
          <button class="btn primary" id="wizard-btn-start" style="background: linear-gradient(135deg, #f97316, #ea580c); border: none; font-weight: 900;">
            ⚔️ ${t('startDuels', 'Comenzar Duelos')}
          </button>
        </div>
      `;

      foot.querySelector('#wizard-btn-cancel').onclick = closeSheet;

      foot.querySelector('#wizard-btn-start').onclick = () => {
        session.duels1v1 = session.duels1v1 || {};
        session.duels1v1.pairs = pairs;
        session.trainingModality = '1v1';
        if (pairs.length > 0) {
          session.duels1v1.activePairIndex = 0;
          const first = pairs[0];
          session.slots = [first.playerIds[0], first.playerIds[1]];
        }
        Store.save();
        closeSheet();
        haptic(40);
        if (typeof onDone === 'function') onDone();
        else renderTracker();
      };
    });
  }

  /* =========================================================
     TRACKER VERTICAL DIVIDIDO PARA DUELOS 1v1
     ========================================================= */
  function render1v1Tracker(trackerEl, s) {
    s.duels1v1 = s.duels1v1 || { pairs: [], activePairIndex: 0 };
    if (!Array.isArray(s.duels1v1.pairs)) s.duels1v1.pairs = [];

    if (s.duels1v1.pairs.length === 0 && s.slots && (s.slots[0] || s.slots[1])) {
      const p1 = s.slots[0] || '';
      const p2 = s.slots[1] || '';
      if (p1 && p2) {
        s.duels1v1.pairs.push({
          id: 'pair_' + Date.now(),
          name: 'Pareja A',
          type: 'pair',
          playerIds: [p1, p2],
          trioRotation: 0
        });
      }
    }

    let activeIdx = s.duels1v1.activePairIndex || 0;
    if (activeIdx >= s.duels1v1.pairs.length) activeIdx = 0;
    s.duels1v1.activePairIndex = activeIdx;
    const curPair = s.duels1v1.pairs[activeIdx] || null;

    let pAId = null;
    let pBId = null;
    let pRestId = null;

    if (curPair) {
      if (curPair.type === 'trio' && curPair.playerIds.length >= 3) {
        const rot = curPair.trioRotation || 0;
        if (rot === 0) {
          pAId = curPair.playerIds[0]; pBId = curPair.playerIds[1]; pRestId = curPair.playerIds[2];
        } else if (rot === 1) {
          pAId = curPair.playerIds[1]; pBId = curPair.playerIds[2]; pRestId = curPair.playerIds[0];
        } else {
          pAId = curPair.playerIds[2]; pBId = curPair.playerIds[0]; pRestId = curPair.playerIds[1];
        }
      } else if (curPair.playerIds.length >= 2) {
        pAId = curPair.playerIds[0];
        pBId = curPair.playerIds[1];
      }
      s.slots = [pAId, pBId];
    } else {
      pAId = s.slots ? s.slots[0] : null;
      pBId = s.slots ? s.slots[1] : null;
    }

    const playerA = pAId ? Store.player(pAId) : null;
    const playerB = pBId ? Store.player(pBId) : null;
    const restPlayer = pRestId ? Store.player(pRestId) : null;

    const isLive = s.timerStartedAt != null;
    const attMap = s.attendance || {};
    let attPresentCount = 0;
    Object.keys(attMap).forEach(k => {
      const rec = attMap[k];
      const st = (typeof rec === 'object' && rec !== null) ? rec.status : rec;
      if (st === 'present' || st === 'late') attPresentCount++;
    });
    const hasAttendance = Object.keys(attMap).length > 0;

    trackerEl.className = 'tracker tracker-1v1-mode';
    trackerEl.style.cssText = 'display: flex; flex-direction: column; height: 100vh; overflow: hidden;';

    trackerEl.innerHTML = `
      <!-- BARRA SUPERIOR DE CONTROL -->
      <div class="t-bar" style="border-radius: 0; margin-bottom: 2px;">
        <div class="t-bar-top">
          <button class="icon-btn ghost" id="tracker-btn-back" title="Volver">${icon('back', 18)}</button>
          <div class="t-title">
            <b>${escapeHtml(Store.sessionTitle(s))}</b>
            <span class="badge" style="background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1.5px solid #f97316; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
              ⚔️ 1v1 DUELOS
            </span>
          </div>

          <button class="icon-btn ${hasAttendance ? 'accent' : ''}" id="tracker-btn-attendance" title="${t('rollCallTitle', 'Pasar Lista')}">
            📋${hasAttendance ? `<span style="font-size: 10px; font-weight: 900; margin-left: 1px;">${attPresentCount}</span>` : ''}
          </button>

          <!-- Auditoría de Acciones y Asistentes -->
          <button class="icon-btn" id="tracker-btn-audit-actions" title="${t('auditActionsTitle', 'Auditoría de Acciones y Asistentes')}" style="position: relative;">
            👥${(s.log && s.log.length > 0) ? `<span style="position: absolute; top: -3px; right: -3px; background: var(--cyan); color: #0f172a; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 8px; line-height: 1;">${s.log.length > 99 ? '99+' : s.log.length}</span>` : ''}
          </button>

          <!-- Compartir Tracker con Asistente Remoto (Standalone) -->
          <button class="icon-btn ${s._liveTrackerConnected ? 'accent' : ''}" id="tracker-btn-share-assistant" title="${(s._connectedAssistants && s._connectedAssistants.length > 0) ? 'Asistentes conectados: ' + s._connectedAssistants.join(', ') : 'Compartir con Asistente Remoto'}" style="${s._liveTrackerConnected ? 'background: rgba(34, 197, 94, 0.2); border-color: #22c55e; color: #86efac; min-width: 38px;' : ''}">
            ${s._liveTrackerConnected ? '<span class="live-dot" style="margin-right:2px; background:#22c55e;"></span>' : ''}
            ${icon('share', 16)}
            ${(s._connectedAssistants && s._connectedAssistants.length > 0) ? `
              <span style="font-size: 10px; font-weight: 900; margin-left: 2px; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(s._connectedAssistants[s._connectedAssistants.length - 1])}
              </span>
            ` : ''}
          </button>

          <button class="icon-btn" id="tracker-btn-filter-buttons" title="${t('customizeButtons')}">
            ${icon('sliders', 16)}
          </button>

          <button class="finish-btn" id="tracker-btn-finish" title="${t('finish')}">
            ${icon('check', 15)} <span>${t('finish')}</span>
          </button>
        </div>

        <div class="t-bar-bottom" style="justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="btn sm" id="btn-1v1-open-wizard" style="background: rgba(15, 23, 42, 0.8); border: 1.5px solid var(--border); color: var(--cyan); font-weight: 800; font-size: 11.5px; padding: 4px 10px; border-radius: 8px;">
              👥 Parejas (${s.duels1v1.pairs.length})
            </button>
            ${(curPair && curPair.type === 'trio') ? `
              <button class="btn sm" id="btn-1v1-rotate-trio" style="background: rgba(245, 158, 11, 0.25); border: 1.5px solid #f59e0b; color: #fbbf24; font-weight: 900; font-size: 11.5px; padding: 4px 10px; border-radius: 8px;" title="Rotar turno del trío">
                🔄 Rotar (${restPlayer ? escapeHtml(Store.playerName(restPlayer).split(' ')[0]) : 'J3'} ${t('rests', 'descansa')})
              </button>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="chrono ${isLive ? 'running' : ''} ${Store.fmtTime(Store.elapsed(s), s).startsWith('-') ? 'negative' : ''}" id="tracker-btn-chrono">
              ${icon(isLive ? 'pause' : 'play', 16)}
              <span id="tracker-chrono-val">${Store.fmtTime(Store.elapsed(s), s)}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- CINTA DE PAREJAS / TRÍOS -->
      ${s.duels1v1.pairs.length > 0 ? `
        <div id="tracker-1v1-pairs-ribbon" style="display: flex; gap: 6px; overflow-x: auto; padding: 6px 10px; background: rgba(0,0,0,0.35); border-bottom: 1px solid var(--border); scrollbar-width: none; flex-shrink: 0;">
          ${s.duels1v1.pairs.map((pr, idx) => {
            const isActive = (idx === activeIdx);
            const p1Obj = Store.player(pr.playerIds[0]);
            const p2Obj = Store.player(pr.playerIds[1]);
            const p1Name = p1Obj ? Store.playerName(p1Obj).split(' ')[0] : 'J1';
            const p2Name = p2Obj ? Store.playerName(p2Obj).split(' ')[0] : 'J2';
            return `
              <button type="button" class="btn sm ${isActive ? 'primary' : 'ghost'}" data-pair-idx="${idx}" style="flex-shrink: 0; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 8px; white-space: nowrap; ${isActive ? 'box-shadow: 0 0 10px rgba(34, 211, 238, 0.4);' : ''}">
                ${pr.type === 'trio' ? '🔺' : '👥'} ${escapeHtml(pr.name)}: ${escapeHtml(p1Name)} vs ${escapeHtml(p2Name)}
              </button>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="padding: 6px 12px; background: rgba(249, 115, 22, 0.15); border-bottom: 1px solid rgba(249, 115, 22, 0.35); display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
          <span style="color: #fb923c; font-weight: 700;">Sin parejas configuradas para este entrenamiento</span>
          <button type="button" class="btn sm" id="btn-1v1-empty-create" style="background: #f97316; color: #fff; font-weight: 800; padding: 2px 8px; font-size: 11px;">
            Crear Parejas ➔
          </button>
        </div>
      `}

      <!-- PANTALLA DIVIDIDA VERTICALMENTE (IZQUIERDA = JUGADOR 1 | DERECHA = JUGADOR 2) -->
      <div class="tracker-1v1-split" style="flex: 1; padding: 8px; min-height: 0; overflow: hidden;">
        ${render1v1PlayerColumn(s, playerA, 0, playerB ? playerB.id : null)}
        ${render1v1PlayerColumn(s, playerB, 1, playerA ? playerA.id : null)}
      </div>
    `;

    bind1v1TrackerInteractions(trackerEl, s);
  }

  function render1v1PlayerColumn(session, player, slotIndex, opponentId) {
    const slotLetter = slotIndex === 0 ? 'A' : 'B';
    const isSlotA = slotIndex === 0;

    if (!player) {
      return `
        <div class="split-player-col" style="justify-content: center; align-items: center; border: 1.5px dashed var(--border); height: 100%; box-sizing: border-box;">
          <button class="add-slot" id="btn-pick-slot-${slotIndex}" style="background: none; border: none; color: var(--muted); cursor: pointer; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 6px;">➕</div>
            <span style="font-size: 12.5px; font-weight: 800; color: #fff;">${t('selectPlayer')} (${slotLetter})</span>
          </button>
        </div>
      `;
    }

    const st = session.stats[player.id] || {};
    const dWonGoal = st.duel1v1WonGoal || 0;
    const dWonStop = st.duel1v1WonStop || 0;
    const dLostTurnover = st.duel1v1LostTurnover || 0;
    const dLostGoal = st.duel1v1LostGoal || 0;
    const dWon = dWonGoal + dWonStop;
    const dLost = dLostGoal + dLostTurnover;
    const dTotal = dWon + dLost;
    const dWinRate = dTotal > 0 ? Math.round((dWon / dTotal) * 100) : 0;

    return `
      <div class="split-player-col" data-slot="${slotIndex}" data-player="${player.id}" style="height: 100%; box-sizing: border-box; display: flex; flex-direction: column;">
        <!-- Encabezado del Jugador -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 6px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
            ${renderAvatar(player, 'sm')}
            <div style="min-width: 0; flex: 1;">
              <h4 class="ellipsis" style="margin: 0; font-size: 13.5px; font-weight: 900; color: #fff;">
                #${player.mainDorsal != null ? player.mainDorsal : '-'} ${escapeHtml(Store.playerName(player))}
              </h4>
              <div style="font-size: 11px; font-weight: 800; color: ${dWinRate >= 50 ? '#4ade80' : (dTotal > 0 ? '#f87171' : 'var(--muted)')};">
                🏆 ${dWon}G / ${dLost}P (${dWinRate}%)
              </div>
            </div>
          </div>
          <button class="undo-btn" id="btn-undo-${slotIndex}" title="${t('undo')}" style="width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;">
            ${icon('undo', 16)}
          </button>
        </div>

        <!-- PANEL EXCLUSIVO 1-TAP DUELOS 1v1 (SIN OTRAS ACCIONES) -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin: 12px 0 6px; flex: 1; justify-content: space-evenly;">
          <button type="button" class="duel-1tap-btn duel-btn-goal" data-duel-action="${isSlotA ? 'goal_A' : 'goal_B'}" data-p-a="${session.slots[0] || ''}" data-p-b="${session.slots[1] || ''}" style="flex: 1; max-height: 115px; min-height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 14px; font-size: 15px; font-weight: 900; background: linear-gradient(135deg, rgba(34, 197, 94, 0.28) 0%, rgba(22, 163, 74, 0.45) 100%); border: 2px solid #22c55e; color: #86efac; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.22); cursor: pointer;">
            <span style="font-size: 24px;">⚽</span>
            <span>1v1 Gol (+1)</span>
          </button>
          <button type="button" class="duel-1tap-btn duel-btn-steal" data-duel-action="${isSlotA ? 'steal_goal_A' : 'steal_goal_B'}" data-p-a="${session.slots[0] || ''}" data-p-b="${session.slots[1] || ''}" style="flex: 1; max-height: 115px; min-height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 14px; font-size: 15px; font-weight: 900; background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.42) 100%); border: 2px solid #f59e0b; color: #fde047; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.22); cursor: pointer;">
            <span style="font-size: 24px;">⚡</span>
            <span>Robo y Gol</span>
          </button>
          <button type="button" class="duel-1tap-btn duel-btn-out" data-duel-action="${isSlotA ? 'out_loss_A' : 'out_loss_B'}" data-p-a="${session.slots[0] || ''}" data-p-b="${session.slots[1] || ''}" style="flex: 1; max-height: 115px; min-height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 14px; font-size: 15px; font-weight: 900; background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.42) 100%); border: 2px solid #ef4444; color: #fca5a5; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.22); cursor: pointer;">
            <span style="font-size: 24px;">❌</span>
            <span>Fuera / Pérdida</span>
          </button>
        </div>
      </div>
    `;
  }

  function bind1v1TrackerInteractions(container, session) {
    const ribbon = container.querySelector('#tracker-1v1-pairs-ribbon');
    if (ribbon) {
      ribbon.addEventListener('scroll', () => {
        session.duels1v1 = session.duels1v1 || {};
        session.duels1v1._scrollLeft = ribbon.scrollLeft;
      }, { passive: true });
    }

    container.querySelector('#tracker-btn-chrono').onclick = () => {
      Store.toggleTimer(session);
      haptic(30);
      renderTracker();
      syncActiveLiveTracker(session);
    };

    container.querySelector('#tracker-btn-back').onclick = () => {
      closeTracker();
    };

    container.querySelector('#tracker-btn-finish').onclick = () => {
      const isMatch = session.type === 'match';
      confirmDialog(t('finishSession', 'Finalizar Sesión'), isMatch ? '¿Deseas finalizar el partido?' : '¿Deseas finalizar el entrenamiento?', () => {
        if (session._liveTrackerCode && window.Cloud) {
          window.Cloud.closeLiveTrackerSession(session._liveTrackerCode);
          session._liveTrackerActive = false;
          session._liveTrackerCode = null;
          session._connectedAssistants = [];
          session._lastNotifiedAssistant = null;
        }
        Store.finishSession(session.id);
        closeTracker();
        Store.evaluateAutoWeeklyMissions(Object.keys(session.stats || {}));
        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }
        showSessionDetailModal(session.id);
        if (isMatch && (!session.coachPicks || session.coachPicks.length === 0)) {
          setTimeout(() => {
            showMatchCoachPicksModal(session, () => {
              showSessionDetailModal(session.id);
            });
          }, 400);
        }
      });
    };

    const btnAtt = container.querySelector('#tracker-btn-attendance');
    if (btnAtt) btnAtt.onclick = () => showSessionAttendanceModal(session.id);

    const btnShareAssistant1v1 = container.querySelector('#tracker-btn-share-assistant');
    if (btnShareAssistant1v1) btnShareAssistant1v1.onclick = () => showLiveTrackerShareModal(session);

    const btnAuditActions1v1 = container.querySelector('#tracker-btn-audit-actions-1v1');
    if (btnAuditActions1v1) btnAuditActions1v1.onclick = () => showSessionActionsAuditModal(session);

    container.querySelector('#tracker-btn-filter-buttons').onclick = () => {
      showCustomizeSessionButtonsModal(session);
    };

    const btnWiz = container.querySelector('#btn-1v1-open-wizard');
    if (btnWiz) btnWiz.onclick = () => show1v1PairingModal(session);

    const btnEmptyCreate = container.querySelector('#btn-1v1-empty-create');
    if (btnEmptyCreate) btnEmptyCreate.onclick = () => show1v1PairingModal(session);

    const btnRotateTrio = container.querySelector('#btn-1v1-rotate-trio');
    if (btnRotateTrio) {
      btnRotateTrio.onclick = () => {
        const ribbonEl = container.querySelector('#tracker-1v1-pairs-ribbon');
        if (ribbonEl) session.duels1v1._scrollLeft = ribbonEl.scrollLeft;
        const pairs = session.duels1v1 ? session.duels1v1.pairs : [];
        const activeIdx = session.duels1v1 ? (session.duels1v1.activePairIndex || 0) : 0;
        const cur = pairs[activeIdx];
        if (cur && cur.type === 'trio' && cur.playerIds.length >= 3) {
          cur.trioRotation = ((cur.trioRotation || 0) + 1) % 3;
          Store.save();
          haptic(35);
          renderTracker();
        }
      };
    }

    container.querySelectorAll('[data-pair-idx]').forEach(btn => {
      btn.onclick = () => {
        const ribbonEl = container.querySelector('#tracker-1v1-pairs-ribbon');
        if (ribbonEl) {
          session.duels1v1 = session.duels1v1 || {};
          session.duels1v1._scrollLeft = ribbonEl.scrollLeft;
        }
        const idx = parseInt(btn.getAttribute('data-pair-idx'), 10);
        session.duels1v1 = session.duels1v1 || {};
        session.duels1v1.activePairIndex = idx;
        Store.save();
        haptic(25);
        renderTracker();
      };
    });

    container.querySelectorAll('.split-player-col #btn-pick-slot-0').forEach(b => {
      b.onclick = () => showPlayerSelectorModal(session, 0);
    });
    container.querySelectorAll('.split-player-col #btn-pick-slot-1').forEach(b => {
      b.onclick = () => showPlayerSelectorModal(session, 1);
    });

    const btnUndo0 = container.querySelector('#btn-undo-0');
    if (btnUndo0) {
      btnUndo0.onclick = () => {
        const pid = session.slots ? session.slots[0] : null;
        if (pid) {
          Store.undo(session.id, pid, 'coach');
          haptic(40);
          syncActiveLiveTracker(session);
          renderTracker();
        }
      };
    }
    const btnUndo1 = container.querySelector('#btn-undo-1');
    if (btnUndo1) {
      btnUndo1.onclick = () => {
        const pid = session.slots ? session.slots[1] : null;
        if (pid) {
          Store.undo(session.id, pid, 'coach');
          haptic(40);
          syncActiveLiveTracker(session);
          renderTracker();
        }
      };
    }

    container.querySelectorAll('.duel-1tap-btn[data-duel-action]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-duel-action');
        const pA = btn.getAttribute('data-p-a');
        const pB = btn.getAttribute('data-p-b');

        if (!pA || !pB) {
          toast('Se necesitan 2 jugadores para registrar el duelo 1v1', 'warning');
          return;
        }

        const ribbonEl = container.querySelector('#tracker-1v1-pairs-ribbon');
        if (ribbonEl) {
          session.duels1v1 = session.duels1v1 || {};
          session.duels1v1._scrollLeft = ribbonEl.scrollLeft;
        }

        const logEntry = Store.recordDuel1v1Outcome(session.id, action, pA, pB);
        haptic(35);

        const pScored = (action === 'goal_A' || action === 'steal_goal_A' || action === 'out_loss_B') ? pA : pB;
        if (window.SyncEngine && SyncEngine.isLive() && logEntry) {
          SyncEngine.sendAction(session.id, pScored, 'duel1v1', 0, logEntry);
        }

        // Auto-rotar trío si la pareja actual es un trío (al terminar el turno)
        const pairs = session.duels1v1 ? session.duels1v1.pairs : [];
        const curIdx = session.duels1v1 ? (session.duels1v1.activePairIndex || 0) : 0;
        const curPair = pairs[curIdx];
        if (curPair && curPair.type === 'trio' && Array.isArray(curPair.playerIds) && curPair.playerIds.length >= 3) {
          curPair.trioRotation = ((curPair.trioRotation || 0) + 1) % 3;
        }

        // Auto-avanzar a la siguiente pareja en la lista (cíclicamente)
        if (pairs.length > 0) {
          session.duels1v1.activePairIndex = (curIdx + 1) % pairs.length;
        }

        Store.save();
        syncActiveLiveTracker(session);
        renderTracker();
      };
    });
  }

  function renderTracker() {
    const trackerEl = document.getElementById('tracker-fullscreen');
    if (!trackerEl) return;
    const s = Store.session(activeSessionId);
    if (!s) { closeTracker(); return; }

    const ribbonEl = trackerEl.querySelector('#tracker-1v1-pairs-ribbon');
    const savedScrollLeft = ribbonEl ? ribbonEl.scrollLeft : (s.duels1v1 ? s.duels1v1._scrollLeft : 0);

    if (s.trainingModality === '1v1') {
      render1v1Tracker(trackerEl, s);
      const newRibbon = trackerEl.querySelector('#tracker-1v1-pairs-ribbon');
      if (newRibbon && savedScrollLeft) {
        newRibbon.scrollLeft = savedScrollLeft;
      }
      return;
    }

    const isLive = s.timerStartedAt != null;
    const slots = s.slots || [null, null];
    const playerA = slots[0] ? Store.player(slots[0]) : null;
    const playerB = slots[1] ? Store.player(slots[1]) : null;
    const singleMode = !playerB && playerA;

    const attMap = s.attendance || {};
    const attKeys = Object.keys(attMap);
    let attPresentCount = 0;
    attKeys.forEach(k => {
      const rec = attMap[k];
      const st = (typeof rec === 'object' && rec !== null) ? rec.status : rec;
      if (st === 'present' || st === 'late') attPresentCount++;
    });
    const hasAttendance = attKeys.length > 0;
    const isTodaySession = s.date === getTodayIso();

    trackerEl.className = 'tracker ' + (singleMode ? 'single' : '');

    trackerEl.innerHTML = `
      <!-- SLOT 0: JUGADOR SUPERIOR -->
      ${renderSlotPanel(s, 0, playerA)}

      <!-- BARRA CENTRAL DE CONTROL (2 FILAS ORDENADAS) -->
      <div class="t-bar">
        ${(!hasAttendance && isTodaySession) ? `
          <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.2)); border-bottom: 1px solid rgba(245, 158, 11, 0.4); padding: 5px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;">
            <span style="font-weight: 700; color: #fde047;">📋 ${t('rollCallPending', 'Asistencia pendiente de hoy')}</span>
            <button type="button" class="btn sm" id="tracker-banner-btn-att" style="background: #f59e0b; color: #000; font-weight: 800; padding: 2px 8px; border-radius: 6px; font-size: 11px;">
              ${t('rollCallBtn', 'Pasar Lista')}
            </button>
          </div>
        ` : ''}

        <div class="t-bar-top">
          <button class="icon-btn ghost" id="tracker-btn-back" title="Volver">${icon('back', 18)}</button>
          <div class="t-title">
            <b>${escapeHtml(Store.sessionTitle(s))}</b>
            <button type="button" class="badge ${s.type}" id="tracker-btn-toggle-type" style="cursor: pointer; border: 1.5px solid var(--border); font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;" title="Toca para alternar entre Entrenamiento y Partido">
              ${s.type === 'match' ? '🏆 ' + t('match').toUpperCase() : '⚽ ' + t('training').toUpperCase()} ▾
            </button>
          </div>

          <!-- Pasar Lista / Asistencia -->
          <button class="icon-btn ${hasAttendance ? 'accent' : ''}" id="tracker-btn-attendance" title="${t('rollCallTitle', 'Pasar Lista')}">
            📋${hasAttendance ? `<span style="font-size: 10px; font-weight: 900; margin-left: 1px;">${attPresentCount}</span>` : ''}
          </button>

          <!-- Auditoría de Acciones y Asistentes -->
          <button class="icon-btn" id="tracker-btn-audit-actions" title="${t('auditActionsTitle', 'Auditoría de Acciones y Asistentes')}" style="position: relative;">
            👥${(s.log && s.log.length > 0) ? `<span style="position: absolute; top: -3px; right: -3px; background: var(--cyan); color: #0f172a; font-size: 9px; font-weight: 900; padding: 1px 4px; border-radius: 8px; line-height: 1;">${s.log.length > 99 ? '99+' : s.log.length}</span>` : ''}
          </button>

          <!-- Compartir Tracker con Asistente Remoto (Standalone) -->
          <button class="icon-btn ${s._liveTrackerConnected ? 'accent' : ''}" id="tracker-btn-share-assistant" title="${(s._connectedAssistants && s._connectedAssistants.length > 0) ? 'Asistentes conectados: ' + s._connectedAssistants.join(', ') : 'Compartir con Asistente Remoto'}" style="${s._liveTrackerConnected ? 'background: rgba(34, 197, 94, 0.2); border-color: #22c55e; color: #86efac; min-width: 38px;' : ''}">
            ${s._liveTrackerConnected ? '<span class="live-dot" style="margin-right:2px; background:#22c55e;"></span>' : ''}
            ${icon('share', 16)}
            ${(s._connectedAssistants && s._connectedAssistants.length > 0) ? `
              <span style="font-size: 10px; font-weight: 900; margin-left: 2px; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(s._connectedAssistants[s._connectedAssistants.length - 1])}
              </span>
            ` : ''}
          </button>

          <!-- Sincronización en vivo Dual QR -->
          <button class="icon-btn ${window.SyncEngine && SyncEngine.isLive() ? 'accent' : ''}" id="tracker-btn-sync-qr" title="${t('liveSync')}">
            ${window.SyncEngine && SyncEngine.isLive() ? '<span class="live-dot" style="margin-right:2px;"></span>' : ''}
            ${icon('qr', 16)}
          </button>

          <!-- Configuración rápida de botones en pantalla -->
          <button class="icon-btn" id="tracker-btn-filter-buttons" title="${t('customizeButtons')}">
            ${icon('sliders', 16)}
          </button>

          <button class="icon-btn" id="tracker-btn-swap" title="${t('swap')}">${icon('swap', 16)}</button>
          <button class="finish-btn" id="tracker-btn-finish" title="${t('finish')}">
            ${icon('check', 15)} <span>${t('finish')}</span>
          </button>
        </div>

        <div class="t-bar-bottom">
          ${s.type === 'match' ? `
            <!-- Marcador de partido (Sólo en partidos) -->
            <div class="score-widget" id="tracker-score-widget">
              <button class="score-btn" id="btn-score-home-m" title="-1">-</button>
              <span class="score-val" id="score-home-val">${(s.score && s.score.home) || 0}</span>
              <button class="score-btn" id="btn-score-home-p" title="+1">+</button>
              <span class="score-divider">:</span>
              <button class="score-btn" id="btn-score-away-m" title="-1">-</button>
              <span class="score-val" id="score-away-val">${(s.score && s.score.away) || 0}</span>
              <button class="score-btn" id="btn-score-away-p" title="+1">+</button>
            </div>

            <!-- Selector de periodo (1T, Descanso, 2T...) -->
            <button class="period-tag" id="btn-period-picker" title="${t('period')}">
              ${s.period || '1T'}
            </button>
          ` : `
            <div style="font-size: 11.5px; font-weight: 700; color: #86efac; display: flex; align-items: center; gap: 4px;">
              <span>⚽</span> <span>${t('training')} en curso</span>
            </div>
          `}

          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="chrono ${isLive ? 'running' : ''} ${Store.fmtTime(Store.elapsed(s), s).startsWith('-') ? 'negative' : ''}" id="tracker-btn-chrono">
              ${icon(isLive ? 'pause' : 'play', 16)}
              <span id="tracker-chrono-val">${Store.fmtTime(Store.elapsed(s), s)}</span>
            </button>
            <button class="icon-btn" id="btn-timer-settings" title="Modo Temporizador" style="width: 32px; height: 32px; font-size: 13px;">
              ⏱️
            </button>
          </div>
        </div>
      </div>

      <!-- SLOT 1: JUGADOR INFERIOR -->
      ${renderSlotPanel(s, 1, playerB)}
    `;

    bindTrackerInteractions(trackerEl, s);
  }

  function renderSlotPanel(session, slotIndex, player) {
    const slotClass = slotIndex === 0 ? 'slot-0' : 'slot-1';
    const slotLetter = slotIndex === 0 ? 'A' : 'B';

    if (!player) {
      return `
        <div class="panel empty ${slotClass}" data-slot="${slotIndex}">
          <button class="add-slot" id="btn-pick-slot-${slotIndex}">
            ${icon('plus', 22)}
            <span>${t('selectPlayer')} (${slotLetter})</span>
          </button>
        </div>
      `;
    }

    const st = session.stats[player.id] || {};
    // Obtener la lista de botones EN ORDEN CANÓNICO ESTRICTO
    const statsList = Store.getSessionStats(session);

    // Ajustar rejilla: mantener siempre el tamaño generoso y ancho de la versión original
    const gridCount = statsList.length;
    let sizeCls = 'normal';
    let cols = 3;

    if (gridCount <= 2) {
      sizeCls = 'large';
      cols = gridCount;
    } else if (gridCount <= 4) {
      sizeCls = 'large';
      cols = 2;
    } else {
      sizeCls = 'normal';
      cols = 3; // SIEMPRE 3 columnas máximo (nunca 4), para conservar el ancho y tamaño generoso original
    }

    const passAcc = Store.ratio(st, Store.RATIOS[0]);
    const shotAcc = Store.ratio(st, Store.RATIOS[1]);

    return `
      <div class="panel ${slotClass}" data-slot="${slotIndex}" data-player="${player.id}">
        <div class="p-head">
          <button class="p-who" id="btn-change-player-${slotIndex}">
            <div class="slot-letter">${slotLetter}</div>
            ${renderAvatar(player, 'sm')}
            <div class="grow ellipsis">
              <h3>${escapeHtml(Store.playerName(player))}</h3>
              <div class="ratios">
                <span>${t('pass')}: <b>${passAcc !== null ? passAcc + '%' : '—'}</b></span>
                <span>•</span>
                <span>${t('shot')}: <b>${shotAcc !== null ? shotAcc + '%' : '—'}</b></span>
              </div>
            </div>
            <div class="chev">${icon('chevR', 16)}</div>
          </button>

          <!-- Botón Deshacer silencioso e independiente -->
          <button class="undo-btn" id="btn-undo-${slotIndex}" title="${t('undo')}">
            ${icon('undo', 20)}
          </button>
        </div>

        <div class="counters ${sizeCls}" style="grid-template-columns: repeat(${cols}, 1fr);">
          ${statsList.map(item => {
            const count = st[item.key] || 0;
            const isGoal = item.key === 'goal';
            return `
              <button class="counter ${isGoal ? 'goal' : ''}"
                      style="--c: ${item.color};"
                      data-key="${item.key}"
                      data-player="${player.id}">
                <span class="c-emoji">${item.emoji}</span>
                <span class="c-val num" id="val-${player.id}-${item.key}">${count}</span>
                <span class="c-lbl">${item.short}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function bindTrackerInteractions(container, session) {
    container.querySelector('#tracker-btn-chrono').onclick = () => {
      Store.toggleTimer(session);
      haptic(30);
      renderTracker();
      syncActiveLiveTracker(session);
    };

    container.querySelector('#tracker-btn-back').onclick = () => {
      closeTracker();
    };

    const btnToggleType = container.querySelector('#tracker-btn-toggle-type');
    if (btnToggleType) {
      btnToggleType.onclick = () => {
        session.type = session.type === 'match' ? 'training' : 'match';
        Store.save();
        haptic(35);
        renderTracker();
        syncActiveLiveTracker(session);
        toast(session.type === 'match' ? '🏆 Cambiado a Partido' : '⚽ Cambiado a Entrenamiento', 'info');
      };
    }

    container.querySelector('#tracker-btn-swap').onclick = () => {
      const slots = session.slots || [null, null];
      session.slots = [slots[1], slots[0]];
      Store.save();
      haptic(40);
      renderTracker();
      syncActiveLiveTracker(session);
    };

    const btnAtt = container.querySelector('#tracker-btn-attendance');
    if (btnAtt) btnAtt.onclick = () => showSessionAttendanceModal(session.id);

    const bannerBtnAtt = container.querySelector('#tracker-banner-btn-att');
    if (bannerBtnAtt) bannerBtnAtt.onclick = () => showSessionAttendanceModal(session.id);

    // Marcador: Botones de puntuación local y visitante
    const updateScoreUI = () => {
      const hEl = container.querySelector('#score-home-val');
      const aEl = container.querySelector('#score-away-val');
      if (hEl) hEl.textContent = (session.score && session.score.home) || 0;
      if (aEl) aEl.textContent = (session.score && session.score.away) || 0;
    };

    const btnShm = container.querySelector('#btn-score-home-m');
    if (btnShm) btnShm.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.home = Math.max(0, (session.score.home || 0) - 1);
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(20);
      updateScoreUI();
      syncActiveLiveTracker(session);
    };

    const btnShp = container.querySelector('#btn-score-home-p');
    if (btnShp) btnShp.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.home = (session.score.home || 0) + 1;
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(25);
      updateScoreUI();
      syncActiveLiveTracker(session);
    };

    const btnSam = container.querySelector('#btn-score-away-m');
    if (btnSam) btnSam.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.away = Math.max(0, (session.score.away || 0) - 1);
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(20);
      updateScoreUI();
      syncActiveLiveTracker(session);
    };

    const btnSap = container.querySelector('#btn-score-away-p');
    if (btnSap) btnSap.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.away = (session.score.away || 0) + 1;
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(25);
      updateScoreUI();
      syncActiveLiveTracker(session);
    };

    // Periodo (1T, Descanso, 2T...)
    const btnPeriod = container.querySelector('#btn-period-picker');
    if (btnPeriod) btnPeriod.onclick = () => showPeriodPickerModal(session);

    // Compartir Tracker con Asistente Remoto (Standalone)
    const btnShareAssistant = container.querySelector('#tracker-btn-share-assistant');
    if (btnShareAssistant) btnShareAssistant.onclick = () => showLiveTrackerShareModal(session);

    // Auditoría de Acciones y Asistentes
    const btnAuditActions = container.querySelector('#tracker-btn-audit-actions');
    if (btnAuditActions) btnAuditActions.onclick = () => showSessionActionsAuditModal(session);

    // Sincronización en vivo Dual QR
    const btnSyncQr = container.querySelector('#tracker-btn-sync-qr');
    if (btnSyncQr) btnSyncQr.onclick = () => showLiveSyncModal(session);

    // Botón para seleccionar qué botones se ven en pantalla
    container.querySelector('#tracker-btn-filter-buttons').onclick = () => {
      showCustomizeSessionButtonsModal(session);
    };

    // Botón para configurar temporizador (Cronómetro / Cuenta atrás)
    const btnTimerSet = container.querySelector('#btn-timer-settings');
    if (btnTimerSet) btnTimerSet.onclick = () => showTimerSettingsModal(session);

    container.querySelector('#tracker-btn-finish').onclick = () => {
      confirmDialog(
        t('finish'),
        '¿Deseas dar por terminada esta sesión? Los datos se encuentran guardados automáticamente.',
        () => {
          if (session.timerStartedAt) Store.toggleTimer(session);
          session.status = 'finished';
          session.finished = true;
          session.isFinished = true;
          session.endedAt = session.endedAt || Date.now();
          session.finishedAt = session.finishedAt || Date.now();
          Store.save();
          if (session._liveTrackerCode && window.Cloud) {
            window.Cloud.closeLiveTrackerSession(session._liveTrackerCode);
            session._liveTrackerActive = false;
            session._liveTrackerCode = null;
            session._connectedAssistants = [];
            session._lastNotifiedAssistant = null;
          }
          if (window.SyncEngine && SyncEngine.isLive()) {
            SyncEngine.broadcastSessionFinished(session);
          }
          closeTracker();
        },
        t('finish'),
        'primary'
      );
    };

    [0, 1].forEach(slotIdx => {
      const pickBtn = container.querySelector(`#btn-pick-slot-${slotIdx}`);
      if (pickBtn) pickBtn.onclick = () => showPlayerSelectorModal(session, slotIdx);

      const changeBtn = container.querySelector(`#btn-change-player-${slotIdx}`);
      if (changeBtn) changeBtn.onclick = () => showPlayerSelectorModal(session, slotIdx);

      // Deshacer (Undo) 100% silencioso (sin toast en pantalla) con emisión en vivo
      const undoBtn = container.querySelector(`#btn-undo-${slotIdx}`);
      if (undoBtn) {
        undoBtn.onclick = () => {
          const playerId = session.slots[slotIdx];
          if (!playerId) return;
          const entry = Store.undo(session.id, playerId, 'coach');
          if (entry) {
            if (window.SyncEngine && SyncEngine.isLive()) {
              SyncEngine.sendUndo(session.id, playerId);
            }
            haptic(50);
            renderTracker();
            syncActiveLiveTracker(session);
          }
        };
      }
    });

    container.querySelectorAll('.counter').forEach(btn => {
      const playerId = btn.getAttribute('data-player');
      const statKey = btn.getAttribute('data-key');

      btn.addEventListener('pointerdown', (e) => {
        btn.classList.add('pressed');
        createRipple(btn, e);
      });

      const clearPressed = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', clearPressed);
      btn.addEventListener('pointercancel', clearPressed);
      btn.addEventListener('pointerleave', clearPressed);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        haptic(35);

        const entry = Store.record(session.id, playerId, statKey, 1);
        if (entry) {
          if (window.SyncEngine && SyncEngine.isLive()) {
            SyncEngine.sendAction(session.id, playerId, statKey, 1);
          }

          entry.k.forEach(k => {
            const valEl = document.getElementById(`val-${playerId}-${k}`);
            if (valEl) {
              const current = (session.stats[playerId] || {})[k] || 0;
              valEl.textContent = current;
              valEl.parentElement.classList.add('bump');
              setTimeout(() => valEl.parentElement.classList.remove('bump'), 300);
            }
          });

          // Si se anotó un gol en un partido, actualizar también el marcador en vivo
          if (statKey === 'goal' && session.type === 'match') {
            const hEl = document.getElementById('score-home-val');
            if (hEl) hEl.textContent = (session.score && session.score.home) || 0;
            if (window.SyncEngine && SyncEngine.isLive()) {
              SyncEngine.sendScore(session.id, session.score.home, session.score.away);
            }
          }

          createFloater(btn, '+1', false);
          updateHeaderRatios(session, playerId);
          syncActiveLiveTracker(session);

          // Prompt de zonas del campo táctico para tiros, goles, pérdidas, recuperaciones y asistencias
          if (['shotOn', 'shotOff', 'goal', 'loss', 'recovery', 'assist'].includes(statKey) && Store.state.settings.askZoneOnShots !== false) {
            setTimeout(() => {
              showPitchZoneSelectorModal(session, playerId, statKey);
            }, 100);
          }
        }
      });

      // Pulsación larga para restar (-1)
      let pressTimer = null;
      btn.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => {
          haptic(70);
          const current = (session.stats[playerId] || {})[statKey] || 0;
          if (current > 0) {
            Store.record(session.id, playerId, statKey, -1);
            if (window.SyncEngine && SyncEngine.isLive()) {
              SyncEngine.sendAction(session.id, playerId, statKey, -1);
            }
            const valEl = document.getElementById(`val-${playerId}-${statKey}`);
            if (valEl) valEl.textContent = (session.stats[playerId] || {})[statKey] || 0;
            createFloater(btn, '-1', true);
            updateHeaderRatios(session, playerId);
          }
        }, 650);
      });
      const cancelLongPress = () => { if (pressTimer) clearTimeout(pressTimer); };
      btn.addEventListener('pointerup', cancelLongPress);
      btn.addEventListener('pointercancel', cancelLongPress);
      btn.addEventListener('pointerleave', cancelLongPress);
    });
  }

  function updateHeaderRatios(session, playerId) {
    const panel = document.querySelector(`.panel[data-player="${playerId}"]`);
    if (!panel) return;
    const st = session.stats[playerId] || {};
    const passAcc = Store.ratio(st, Store.RATIOS[0]);
    const shotAcc = Store.ratio(st, Store.RATIOS[1]);
    const ratiosEl = panel.querySelector('.ratios');
    if (ratiosEl) {
      ratiosEl.innerHTML = `
        <span>${t('pass')}: <b>${passAcc !== null ? passAcc + '%' : '—'}</b></span>
        <span>•</span>
        <span>${t('shot')}: <b>${shotAcc !== null ? shotAcc + '%' : '—'}</b></span>
      `;
    }
  }

  function createRipple(btn, e) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  }

  function createFloater(btn, text, isNeg) {
    const floater = document.createElement('span');
    floater.className = 'floater ' + (isNeg ? 'neg' : '');
    floater.textContent = text;
    floater.style.left = '50%';
    floater.style.top = '30%';
    btn.appendChild(floater);
    setTimeout(() => floater.remove(), 700);
  }

  function promptInputDialog(title, message, defaultVal, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = '999999';
    overlay.innerHTML = `
      <div class="card dialog-box" style="max-width: 360px; width: 90%; padding: 18px; border-radius: 16px; border: 1.5px solid var(--border);">
        <h3 style="margin: 0 0 8px; font-size: 15px; font-weight: 800; color: #fff;">${escapeHtml(title)}</h3>
        <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px;">${escapeHtml(message)}</p>
        <input type="text" id="dlg-prompt-inp" value="${escapeHtml(defaultVal || '')}" style="width: 100%; padding: 10px 12px; font-size: 13.5px; border-radius: 10px; margin-bottom: 14px;" autofocus />
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" class="btn sm ghost" id="dlg-prompt-cancel">${t('cancel')}</button>
          <button type="button" class="btn sm primary" id="dlg-prompt-ok" style="font-weight: 800;">${t('save', 'Guardar')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const inp = overlay.querySelector('#dlg-prompt-inp');
    inp.focus();
    const close = () => overlay.remove();
    overlay.querySelector('#dlg-prompt-cancel').onclick = close;
    overlay.querySelector('#dlg-prompt-ok').onclick = () => {
      const val = inp.value.trim();
      if (!val) { toast('Introduce un nombre válido', 'warning'); return; }
      close();
      if (typeof onConfirm === 'function') onConfirm(val);
    };
  }

  /* =========================================================
     MODAL DE CONFIGURACIÓN DE BOTONES EN PANTALLA
     ========================================================= */
  function showCustomizeSessionButtonsModal(session) {
    let currentEnabled = (session.enabledStats && session.enabledStats.length)
      ? session.enabledStats.slice()
      : Store.state.settings.enabledStats.slice();
    let currentModality = session.trainingModality || 'normal';

    openSheet(t('customizeButtons'), (body) => {
      body.innerHTML = `
        ${session.type === 'training' ? `
          <!-- Selector de Modalidad de Entrenamiento -->
          <div class="card" style="margin-bottom: 14px; padding: 12px; background: rgba(15, 23, 42, 0.6); border: 1.5px solid var(--border); border-radius: 14px;">
            <label style="font-size: 11.5px; font-weight: 800; color: var(--muted); display: block; margin-bottom: 8px; text-transform: uppercase;">
              🏷️ ${t('trainingModality', 'Modalidad de Entrenamiento')}
            </label>
            <div class="segmented" id="session-modality-selector" style="margin-bottom: 8px;">
              <button type="button" class="${currentModality === 'normal' ? 'active' : ''}" data-mod="normal">
                ⚽ ${t('modalityNormal', 'Normal')}
              </button>
              <button type="button" class="${currentModality === 'minifutbol' ? 'active' : ''}" data-mod="minifutbol">
                🥅 ${t('modalityMinifootball', 'Mini-Fútbol')}
              </button>
              <button type="button" class="${currentModality === '1v1' ? 'active' : ''}" data-mod="1v1">
                ⚔️ ${t('modality1v1', 'Duelos 1v1')}
              </button>
            </div>
            <div id="modality-1v1-action-box" style="display: ${currentModality === '1v1' ? 'block' : 'none'}; margin-top: 8px;">
              <button type="button" class="btn sm block" id="btn-open-1v1-pairing-wizard" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(249, 115, 22, 0.35)); color: #f97316; border: 1.5px solid #f97316; font-weight: 800; font-size: 12px; border-radius: 10px; width: 100%;">
                👥 ${t('setup1v1Pairs', 'Configurar Parejas y Tríos 1v1')} ➔
              </button>
            </div>
          </div>
        ` : ''}

        <p class="hint" style="margin-bottom: 12px;">${t('selectButtonsForView')}</p>

        <!-- Presets a 1 toque y Personalizados -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">Presets de Botones</span>
          <button type="button" class="btn sm" id="btn-save-current-as-preset" style="font-size: 11px; font-weight: 800; padding: 3px 8px; background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.35); border-radius: 8px;">
            💾 Guardar actual
          </button>
        </div>
        <div class="segmented" style="margin-bottom: 8px;">
          <button type="button" id="pst-all">${t('presetAll')}</button>
          <button type="button" id="pst-tp">Toques & Pases</button>
          <button type="button" id="pst-shots">Solo Tiros</button>
        </div>
        <div id="custom-presets-pills" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;"></div>

        <div class="card" style="max-height: 44vh; overflow-y: auto;">
          ${Store.STATS.map(item => {
            const isChecked = currentEnabled.includes(item.key);
            return `
              <div class="toggle-row">
                <span class="t-emoji" style="background: ${item.color}20;">${item.emoji}</span>
                <div class="grow">
                  <h5>${item.label}</h5>
                  <small>${item.short}</small>
                </div>
                <button class="switch ${isChecked ? 'on' : ''}" data-custom-stat="${item.key}"></button>
              </div>
            `;
          }).join('')}
        </div>
      `;

      if (session.type === 'training') {
        const modBtns = body.querySelectorAll('#session-modality-selector button[data-mod]');
        const box1v1 = body.querySelector('#modality-1v1-action-box');
        modBtns.forEach(btn => {
          btn.onclick = () => {
            currentModality = btn.getAttribute('data-mod');
            modBtns.forEach(b => b.classList.toggle('active', b === btn));
            if (box1v1) box1v1.style.display = (currentModality === '1v1') ? 'block' : 'none';
            haptic(25);
          };
        });

        const btnWiz = body.querySelector('#btn-open-1v1-pairing-wizard');
        if (btnWiz) {
          btnWiz.onclick = () => {
            closeSheet();
            show1v1PairingModal(session, () => renderTracker());
          };
        }
      }

      function syncSwitches() {
        body.querySelectorAll('[data-custom-stat]').forEach(sw => {
          const k = sw.getAttribute('data-custom-stat');
          sw.classList.toggle('on', currentEnabled.includes(k));
        });
      }

      function updateCustomPresetsView() {
        const container = body.querySelector('#custom-presets-pills');
        if (!container) return;
        const customList = Store.getCustomButtonPresets ? Store.getCustomButtonPresets() : [];
        if (customList.length === 0) {
          container.innerHTML = '';
          return;
        }
        container.innerHTML = customList.map(pst => `
          <div class="chip" data-apply-preset="${pst.id}" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: var(--surface2); border: 1.5px solid var(--border); border-radius: 999px;">
            <span>⭐ ${escapeHtml(pst.name)}</span>
            <span class="btn-del-pst" data-del-preset="${pst.id}" style="color: #f87171; font-size: 12px; margin-left: 2px;" title="Borrar preset">✕</span>
          </div>
        `).join('');

        container.querySelectorAll('[data-apply-preset]').forEach(el => {
          el.onclick = (e) => {
            if (e.target.closest('.btn-del-pst')) return;
            const pid = el.getAttribute('data-apply-preset');
            const targetPst = customList.find(x => x.id === pid);
            if (targetPst && Array.isArray(targetPst.stats)) {
              currentEnabled = targetPst.stats.slice();
              syncSwitches();
              haptic(25);
              toast('Preset aplicado: ' + targetPst.name, 'info');
            }
          };
        });

        container.querySelectorAll('.btn-del-pst').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const pid = btn.getAttribute('data-del-preset');
            Store.deleteCustomButtonPreset(pid);
            updateCustomPresetsView();
            haptic(20);
          };
        });
      }

      updateCustomPresetsView();

      body.querySelector('#btn-save-current-as-preset').onclick = () => {
        promptInputDialog(
          'Guardar Preset de Botones',
          'Introduce un nombre para guardar la selección actual de botones:',
          '',
          (name) => {
            const saved = Store.saveCustomButtonPreset(name, currentEnabled);
            if (saved) {
              toast('Preset "' + saved.name + '" guardado con éxito', 'success');
              updateCustomPresetsView();
              haptic(30);
            }
          }
        );
      };

      body.querySelector('#pst-all').onclick = () => {
        currentEnabled = Store.STATS.map(s => s.key);
        syncSwitches();
      };
      body.querySelector('#pst-tp').onclick = () => {
        currentEnabled = ['touches', 'passOk', 'passKo'];
        syncSwitches();
      };
      body.querySelector('#pst-shots').onclick = () => {
        currentEnabled = ['shotOn', 'shotOff', 'goal'];
        syncSwitches();
      };

      body.querySelectorAll('[data-custom-stat]').forEach(sw => {
        sw.onclick = () => {
          const k = sw.getAttribute('data-custom-stat');
          const idx = currentEnabled.indexOf(k);
          if (idx >= 0) {
            if (currentEnabled.length <= 1) {
              toast(t('minTwoButtons'), 'error');
              return;
            }
            currentEnabled.splice(idx, 1);
          } else {
            currentEnabled.push(k);
          }
          syncSwitches();
          haptic(20);
        };
      });
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="btn-cancel-custom">${t('cancel')}</button>
          <button class="btn primary" id="btn-apply-custom">${t('saveChanges')}</button>
        </div>
      `;

      foot.querySelector('#btn-cancel-custom').onclick = closeSheet;

      foot.querySelector('#btn-apply-custom').onclick = () => {
        session.trainingModality = currentModality;
        // Orden canónico estricto
        const sorted = Store.getSortedStats(currentEnabled).map(s => s.key);
        Store.setSessionStats(session, sorted);
        closeSheet();
        haptic(30);

        if (currentModality === '1v1' && (!session.duels1v1 || !session.duels1v1.pairs || session.duels1v1.pairs.length === 0)) {
          show1v1PairingModal(session, () => renderTracker());
        } else {
          renderTracker();
        }
      };
    });
  }

  /* =========================================================
     SELECTOR RÁPIDO DE JUGADOR (PARA RANURAS A Y B)
     ========================================================= */
  function showPlayerSelectorModal(session, targetSlotIndex) {
    const otherSlotIndex = targetSlotIndex === 0 ? 1 : 0;
    const currentSlots = session.slots || [null, null];
    const otherPlayerId = currentSlots[otherSlotIndex];
    const sessionTeams = Array.isArray(session.teamIds) && session.teamIds.length > 0
      ? session.teamIds
      : (session.teamId ? [session.teamId] : []);

    let linkedConv = session.convocationId ? Store.convocation(session.convocationId) : null;
    if (!linkedConv) {
      linkedConv = (Store.state.convocations || []).find(c => c.sessionId === session.id || (c.date === session.date && c.type === session.type && (!c.rival || !session.rival || c.rival === session.rival)));
      if (linkedConv && !session.convocationId) {
        session.convocationId = linkedConv.id;
        linkedConv.sessionId = session.id;
        Store.save();
      }
    }
    const convCalledIds = new Set();
    if (linkedConv && linkedConv.list) {
      Object.keys(linkedConv.list).forEach(pid => {
        const st = linkedConv.list[pid];
        if (st && st !== 'uncalled' && st !== 'absent') {
          convCalledIds.add(pid);
        }
      });
    }

    const defaultTeamFilter = (convCalledIds.size > 0)
      ? 'convocados'
      : (sessionTeams.length > 1 ? sessionTeams : (sessionTeams[0] || 'all'));

    function getPlayersForFilter(filter) {
      if (filter === 'convocados') {
        const list = Array.from(convCalledIds).map(id => Store.player(id)).filter(Boolean);
        list.sort((a, b) => {
          const numA = (a.jersey != null && a.jersey !== '') ? Number(a.jersey) : (a.mainDorsal != null ? Number(a.mainDorsal) : 999);
          const numB = (b.jersey != null && b.jersey !== '') ? Number(b.jersey) : (b.mainDorsal != null ? Number(b.mainDorsal) : 999);
          if (numA !== numB) return numA - numB;
          return (a.name || '').localeCompare(b.name || '');
        });
        return list;
      }
      return Store.sortedPlayers(filter);
    }

    let players = getPlayersForFilter(defaultTeamFilter);

    openSheet(t('selectPlayer'), (body) => {
      body.innerHTML = `
        <div class="search" style="margin-bottom: 12px;">
          <input type="text" id="picker-search-input" placeholder="${t('searchPlayerPlaceholder')}" />
          ${icon('search', 18)}
        </div>

        <div class="chips" id="picker-team-chips" style="margin-bottom: 14px;">
          ${convCalledIds.size > 0 ? `
            <button class="chip ${defaultTeamFilter === 'convocados' ? 'active' : ''}" data-team="convocados">📋 Convocados (${convCalledIds.size})</button>
          ` : ''}
          ${sessionTeams.length > 1 ? `
            <button class="chip ${defaultTeamFilter === sessionTeams ? 'active' : ''}" data-team="session_teams">🛡️ Equipos sesión (${sessionTeams.length})</button>
          ` : ''}
          <button class="chip ${defaultTeamFilter === 'all' ? 'active' : ''}" data-team="all">${t('all')}</button>
          ${Store.state.teams.map(t => `
            <button class="chip ${defaultTeamFilter === t.id ? 'active' : ''}" data-team="${t.id}">
              <span class="dot" style="background: ${t.color}"></span>
              ${escapeHtml(t.name)}
            </button>
          `).join('')}
        </div>

        <div class="picker-grid" id="picker-players-grid">
          ${renderPickerGridHtml(players, currentSlots[targetSlotIndex], otherPlayerId)}
        </div>
      `;

      const searchInput = body.querySelector('#picker-search-input');
      const grid = body.querySelector('#picker-players-grid');
      let currentFilterTeam = defaultTeamFilter;

      function updateGrid() {
        const query = searchInput.value.toLowerCase().trim();
        let list = getPlayersForFilter(currentFilterTeam);
        if (query) {
          list = list.filter(p => {
            const matchName = Store.playerName(p).toLowerCase().includes(query);
            const matchDorsal = p.mainDorsal != null && String(p.mainDorsal).includes(query);
            return matchName || matchDorsal;
          });
        }
        grid.innerHTML = renderPickerGridHtml(list, currentSlots[targetSlotIndex], otherPlayerId);
        bindPickerItems(grid);
      }

      searchInput.oninput = updateGrid;

      body.querySelectorAll('#picker-team-chips .chip').forEach(c => {
        c.onclick = () => {
          body.querySelectorAll('#picker-team-chips .chip').forEach(x => x.classList.remove('active'));
          c.classList.add('active');
          const tVal = c.getAttribute('data-team');
          currentFilterTeam = (tVal === 'session_teams') ? sessionTeams : tVal;
          updateGrid();
        };
      });

      bindPickerItems(grid);

      function bindPickerItems(gridEl) {
        gridEl.querySelectorAll('.pick').forEach(item => {
          item.onclick = () => {
            const pid = item.getAttribute('data-id');
            if (pid === 'remove') {
              session.slots[targetSlotIndex] = null;
            } else {
              if (pid === otherPlayerId) {
                session.slots[otherSlotIndex] = session.slots[targetSlotIndex];
              }
              session.slots[targetSlotIndex] = pid;
              session.stats[pid] = session.stats[pid] || {};
            }
            Store.save();
            closeSheet();
            haptic(35);
            renderTracker();
          };
        });
      }
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="btn-picker-empty">${t('leaveSlotEmpty')}</button>
          <button class="btn primary" id="btn-picker-new-p">${icon('plus', 16)} ${t('newPlayer')}</button>
        </div>
      `;
      foot.querySelector('#btn-picker-empty').onclick = () => {
        session.slots[targetSlotIndex] = null;
        Store.save();
        closeSheet();
        renderTracker();
      };
      foot.querySelector('#btn-picker-new-p').onclick = () => {
        closeSheet();
        showEditPlayerModal(null, (newP) => {
          session.slots[targetSlotIndex] = newP.id;
          session.stats[newP.id] = session.stats[newP.id] || {};
          Store.save();
          renderTracker();
        });
      };
    });
  }

  function renderPickerGridHtml(players, currentSlotPid, otherSlotPid) {
    if (players.length === 0) {
      return `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--muted);">
          ${t('noPlayersFound')}
        </div>
      `;
    }
    return players.map(p => {
      const isCur = p.id === currentSlotPid;
      const isOth = p.id === otherSlotPid;
      return `
        <button class="pick ${isCur ? 'current' : ''} ${isOth ? 'other' : ''}" data-id="${p.id}">
          ${isOth ? `<span class="slot-tag">${t('inOtherSlot')}</span>` : ''}
          ${renderAvatar(p, 'sm')}
          <span class="p-name">${escapeHtml(Store.playerName(p))}</span>
        </button>
      `;
    }).join('');
  }

  /* Selector modal visual genérico de jugadores (usado en Métricas y otras vistas) */
  function showPlayerPickerModal(currentPid, onSelect) {
    let currentFilterTeam = 'all';
    openSheet(t('selectPlayer'), (body) => {
      body.innerHTML = `
        <div class="search" style="margin-bottom: 12px;">
          <input type="text" id="picker-search-input" placeholder="${t('searchPlayerPlaceholder')}" />
          ${icon('search', 18)}
        </div>

        <div class="chips" id="picker-team-chips" style="margin-bottom: 14px;">
          <button class="chip ${currentFilterTeam === 'all' ? 'active' : ''}" data-team="all">${t('all')}</button>
          ${Store.state.teams.map(t => `
            <button class="chip" data-team="${t.id}">
              <span class="dot" style="background: ${t.color}"></span>
              ${escapeHtml(t.name)}
            </button>
          `).join('')}
        </div>

        <div class="picker-grid" id="picker-players-grid">
          ${renderPickerGridHtml(Store.sortedPlayers(), currentPid, null)}
        </div>
      `;

      const searchInput = body.querySelector('#picker-search-input');
      const grid = body.querySelector('#picker-players-grid');

      function updateGrid() {
        const query = searchInput.value.toLowerCase().trim();
        let list = Store.sortedPlayers(currentFilterTeam);
        if (query) {
          list = list.filter(p => {
            const matchName = Store.playerName(p).toLowerCase().includes(query);
            const matchDorsal = p.mainDorsal != null && String(p.mainDorsal).includes(query);
            return matchName || matchDorsal;
          });
        }
        grid.innerHTML = renderPickerGridHtml(list, currentPid, null);
        bindPickerItems();
      }

      function bindPickerItems() {
        grid.querySelectorAll('.pick').forEach(item => {
          item.onclick = () => {
            const pid = item.getAttribute('data-id');
            closeSheet();
            if (typeof onSelect === 'function') onSelect(pid === 'remove' ? 'all' : pid);
          };
        });
      }

      searchInput.oninput = updateGrid;
      body.querySelectorAll('#picker-team-chips .chip').forEach(c => {
        c.onclick = () => {
          body.querySelectorAll('#picker-team-chips .chip').forEach(x => x.classList.remove('active'));
          c.classList.add('active');
          currentFilterTeam = c.getAttribute('data-team');
          updateGrid();
        };
      });

      bindPickerItems();
    }, (foot) => {
      foot.innerHTML = `
        <button class="btn block" id="btn-pick-all-players">👥 ${t('allPlayersAverage')}</button>
      `;
      foot.querySelector('#btn-pick-all-players').onclick = () => {
        closeSheet();
        if (typeof onSelect === 'function') onSelect('all');
      };
    });
  }

  /* =========================================================
     MODAL DE SELECCIÓN DE PERIODO / PARTE DEL PARTIDO
     ========================================================= */
  function showPeriodPickerModal(session) {
    const isMatch = session.type === 'match';
    const matchOptions = ['1T', 'Descanso', '2T', 'Prórroga', 'Penaltis'];
    const trainOptions = ['Bloque 1', 'Bloque 2', 'Bloque 3', 'Bloque 4'];
    const options = isMatch ? matchOptions : trainOptions;

    openSheet(t('period'), (body) => {
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${options.map(opt => `
            <button class="btn block ${session.period === opt ? 'primary' : 'ghost'}" data-period="${opt}" style="text-align:center; font-size:15px; font-weight:700;">
              ${opt}
            </button>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-period]').forEach(btn => {
        btn.onclick = () => {
          const val = btn.getAttribute('data-period');
          Store.updatePeriod(session.id, val);
          if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendPeriod(session.id, val);
          syncActiveLiveTracker(session);
          closeSheet();
          haptic(25);
          renderTracker();
        };
      });
    });
  }

  /* =========================================================
     MODAL DE SELECCIÓN DE ZONAS DE CAMPO TÁCTICO (PITCH MAP)
     ========================================================= */
  function showPitchZoneSelectorModal(session, playerId, key) {
    const p = Store.player(playerId);
    const pName = p ? Store.playerName(p, true) : 'Jugador';
    const stItem = Store.STAT_MAP[key] || { emoji: '⚽', short: key };
    const isGoal = key === 'goal';
    const isShot = key === 'shotOn' || key === 'shotOff' || isGoal;

    // Forzar siempre Campo Rival en tiros a puerta, tiros fuera y goles
    let activeHalf = 'rival';

    openSheet(`${stItem.emoji} ${stItem.short} • ${t('pitchZones')}`, (body) => {
      function renderPitchGrid() {
        let hintText = t('selectZone');
        if (isGoal) hintText = '🎯 Remate a gol (100% Campo Rival / Zona de Ataque)';
        else if (key === 'shotOn' || key === 'shotOff') hintText = '🎯 Zona de tiro (Forzado a Campo Rival)';
        else if (activeHalf === 'rival') hintText = '🚩 Campo Rival (Zona ofensiva)';
        else hintText = '🛡️ Campo Propio (Zona defensiva)';

        body.innerHTML = `
          <!-- Indicador claro de acción y jugador -->
          <div style="background: rgba(34, 211, 238, 0.12); border: 1.5px solid var(--cyan); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">${stItem.emoji}</span>
              <div>
                <b style="font-size: 14px; color: #fff; display: block;">${escapeHtml(stItem.label || stItem.short || key)}</b>
                <small style="color: var(--cyan); font-weight: 700; font-size: 11.5px;">👤 ${escapeHtml(pName)}</small>
              </div>
            </div>
            <span class="badge" style="background: var(--surface2); color: #fff; font-size: 11px;">Toca una zona</span>
          </div>

          <!-- Selector Campo Rival / Campo Propio (Solo si no es tiro o gol) -->
          ${!isShot ? `
            <div class="segmented" style="margin-bottom: 10px;">
              <button type="button" class="${activeHalf === 'rival' ? 'active' : ''}" id="btn-pitch-half-rival">
                🔴 ${t('oppHalf', 'Campo Rival')}
              </button>
              <button type="button" class="${activeHalf === 'own' ? 'active' : ''}" id="btn-pitch-half-own">
                🔵 ${t('ownHalf', 'Campo Propio')}
              </button>
            </div>
          ` : `
            <div style="text-align: center; margin-bottom: 8px;">
              <span class="badge" style="background: rgba(239, 68, 68, 0.18); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35); font-size: 11px; padding: 2px 10px;">
                🎯 100% Campo Rival (Ataque)
              </span>
            </div>
          `}

          <p class="hint" style="margin-bottom: 8px; text-align: center; font-weight: 700; color: ${isGoal ? '#facc15' : 'var(--text)'};">
            ${hintText}
          </p>

          <div class="pitch-field-grid">
            ${activeHalf === 'rival' ? `
              <!-- FILA 1 (Arriba): Banda Ofensiva Izq | Área Rival | Banda Ofensiva Der -->
              <div class="pitch-grid-cell pz-top-l ${isGoal ? 'active' : ''}" data-z="3" style="grid-area: top_l; background: rgba(56, 189, 248, 0.35);">
                <span class="z-emoji">↖️</span>
                <span>${t('zone_wing_off_l')}</span>
              </div>
              <div class="pitch-grid-cell pz-top-c ${isGoal ? 'active' : ''}" data-z="1" style="grid-area: top_c; background: rgba(239, 68, 68, ${isGoal ? '0.75' : '0.45'}); border-color: ${isGoal ? '#facc15' : 'rgba(239, 68, 68, 0.8)'}; border-style: solid;">
                <span class="z-emoji">🥅</span>
                <span style="font-weight: 900; font-size: 11px;">${t('zone_box_opp')}</span>
              </div>
              <div class="pitch-grid-cell pz-top-r ${isGoal ? 'active' : ''}" data-z="4" style="grid-area: top_r; background: rgba(6, 182, 212, 0.35);">
                <span class="z-emoji">↗️</span>
                <span>${t('zone_wing_off_r')}</span>
              </div>

              <!-- FILAS 2 & 3: Banda Izquierda (UNIDA, span 2) | Frontal / Centro | Banda Derecha (UNIDA, span 2) -->
              <div class="pitch-grid-cell pz-wing-l" data-z="7" style="grid-area: wing_l; background: rgba(59, 130, 246, 0.35);">
                <span class="z-emoji">⬅️</span>
                <span>${t('zone_wing_l')}</span>
              </div>

              <!-- Fila 2, Centro: Frontal del Área -->
              <div class="pitch-grid-cell pz-mid-t" data-z="2" style="grid-area: mid_t; background: rgba(249, 115, 22, 0.45); border-color: #f97316;">
                <span class="z-emoji">🎯</span>
                <span style="font-weight: 800;">${t('zone_front')}</span>
              </div>

              <div class="pitch-grid-cell pz-wing-r" data-z="8" style="grid-area: wing_r; background: rgba(14, 165, 233, 0.35);">
                <span class="z-emoji">➡️</span>
                <span>${t('zone_wing_r')}</span>
              </div>

              <!-- Fila 3, Centro: Centro del Campo (CENTRADO, ABAJO) -->
              <div class="pitch-grid-cell pz-mid-b" data-z="5" style="grid-area: mid_b; background: rgba(34, 197, 94, 0.45); border-color: #22c55e;">
                <span class="z-emoji">⚽</span>
                <span style="font-weight: 800;">${t('zone_mid')}</span>
              </div>
            ` : `
              <!-- CAMPO PROPIO -->
              <!-- FILA 1 (Arriba): Banda Defensiva Izq | Área de Portería | Banda Defensiva Der -->
              <div class="pitch-grid-cell pz-top-l" data-z="10" style="grid-area: top_l; background: rgba(99, 102, 241, 0.35);">
                <span class="z-emoji">↙️</span>
                <span>${t('zone_wing_def_l')}</span>
              </div>
              <div class="pitch-grid-cell pz-top-c" data-z="6" style="grid-area: top_c; background: rgba(139, 92, 246, 0.45); border-color: #8b5cf6;">
                <span class="z-emoji">🛡️</span>
                <span style="font-weight: 900; font-size: 11px;">${t('zone_own')}</span>
              </div>
              <div class="pitch-grid-cell pz-top-r" data-z="11" style="grid-area: top_r; background: rgba(79, 70, 229, 0.35);">
                <span class="z-emoji">↘️</span>
                <span>${t('zone_wing_def_r')}</span>
              </div>

              <!-- FILAS 2 & 3: Banda Izquierda (UNIDA, span 2) | Frontal Propia / Centro | Banda Derecha (UNIDA, span 2) -->
              <div class="pitch-grid-cell pz-wing-l" data-z="7" style="grid-area: wing_l; background: rgba(59, 130, 246, 0.35);">
                <span class="z-emoji">⬅️</span>
                <span>${t('zone_wing_l')}</span>
              </div>

              <!-- Fila 2, Centro: Frontal Propia -->
              <div class="pitch-grid-cell pz-mid-t" data-z="9" style="grid-area: mid_t; background: rgba(168, 85, 247, 0.45); border-color: #a855f7;">
                <span class="z-emoji">🛡️</span>
                <span style="font-weight: 800;">${t('zone_front_own')}</span>
              </div>

              <div class="pitch-grid-cell pz-wing-r" data-z="8" style="grid-area: wing_r; background: rgba(14, 165, 233, 0.35);">
                <span class="z-emoji">➡️</span>
                <span>${t('zone_wing_r')}</span>
              </div>

              <!-- Fila 3, Centro: Centro del Campo (CENTRADO, ABAJO) -->
              <div class="pitch-grid-cell pz-mid-b" data-z="5" style="grid-area: mid_b; background: rgba(34, 197, 94, 0.45); border-color: #22c55e;">
                <span class="z-emoji">⚽</span>
                <span style="font-weight: 800;">${t('zone_mid')}</span>
              </div>
            `}
          </div>
        `;

        if (!isShot) {
          const btnRival = body.querySelector('#btn-pitch-half-rival');
          const btnOwn = body.querySelector('#btn-pitch-half-own');
          if (btnRival) btnRival.onclick = () => { activeHalf = 'rival'; renderPitchGrid(); };
          if (btnOwn) btnOwn.onclick = () => { activeHalf = 'own'; renderPitchGrid(); };
        }

        body.querySelectorAll('.pitch-grid-cell').forEach(cell => {
          cell.onclick = () => {
            const zoneId = parseInt(cell.getAttribute('data-z'), 10);
            Store.recordZone(session.id, playerId, key, zoneId);
            if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendZoneRecord(session.id, playerId, key, zoneId);
            haptic(30);
            closeSheet();
          };
        });
      }

      renderPitchGrid();
    }, (foot) => {
      foot.innerHTML = `
        <button class="btn block ghost" id="btn-skip-zone">${t('cancel')}</button>
      `;
      foot.querySelector('#btn-skip-zone').onclick = closeSheet;
    });
  }

  /* =========================================================
     MODAL DE ASISTENTE REMOTO / TRACKER INDEPENDIENTE (STANDALONE)
     ========================================================= */
  let activeLiveTrackerUnsub = null;

  function syncActiveLiveTracker(session) {
    if (!session || !session._liveTrackerCode || !session._liveTrackerActive || !window.Cloud) return;
    try {
      let targetPid = null;
      if (session._liveTrackerTargetSlot === 0 && session.slots) targetPid = session.slots[0];
      else if (session._liveTrackerTargetSlot === 1 && session.slots) targetPid = session.slots[1];
      else if (typeof session._liveTrackerTargetSlot === 'string' && session._liveTrackerTargetSlot !== 'any') targetPid = session._liveTrackerTargetSlot;

      window.Cloud.updateLiveTrackerSession(session._liveTrackerCode, {
        score: session.score || { home: 0, away: 0 },
        period: session.period || '1T',
        stats: session.stats || {},
        elapsedMs: (typeof Store !== 'undefined' && Store.elapsed) ? Store.elapsed(session) : (session.elapsedMs || 0),
        timerStartedAt: session.timerStartedAt || null,
        targetPlayerId: targetPid
      });
    } catch (e) {
      console.warn('[LiveTracker] Error syncing state:', e);
    }
  }

  function setupLiveTrackerListener(session, code) {
    if (activeLiveTrackerUnsub) {
      try { activeLiveTrackerUnsub(); } catch (e) {}
      activeLiveTrackerUnsub = null;
    }

    session._liveAssistantActions = session._liveAssistantActions || [];

    activeLiveTrackerUnsub = Cloud.listenToLiveTrackerActions(code, (actionData, actionId) => {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (actionData.type === 'undo') {
        const p = Store.player(actionData.playerId);
        const pName = p ? Store.playerName(p) : 'Jugador';
        Store.undo(session.id, actionData.playerId, 'assistant');
        haptic(35);

        session._liveAssistantActions.push({
          desc: `↩️ Deshacer en ${pName}`,
          author: actionData.assistantName || 'Asistente',
          time: nowStr
        });

        renderTracker();
        Cloud.updateLiveTrackerSession(code, { stats: session.stats || {} });
      } else {
        const delta = actionData.delta || 1;
        const asstAuthorName = actionData.assistantName || 'Asistente';
        const entry = Store.record(session.id, actionData.playerId, actionData.statKey, delta, 'assistant', asstAuthorName);
        if (entry) {
          haptic(35);
          const p = Store.player(actionData.playerId);
          const pName = p ? Store.playerName(p) : 'Jugador';
          const statObj = Store.getSessionStats(session).find(s => s.key === actionData.statKey) || { short: actionData.statKey, emoji: '⚡' };

          session._liveAssistantActions.push({
            desc: `+${delta} ${statObj.emoji} ${statObj.short} (${pName})`,
            author: actionData.assistantName || 'Asistente',
            time: nowStr
          });

          renderTracker();
          Cloud.updateLiveTrackerSession(code, {
            stats: session.stats || {},
            score: session.score || { home: 0, away: 0 }
          });
        }
      }

      const feedEl = document.getElementById('live-assistant-log-list');
      const countEl = document.getElementById('live-assistant-count');
      if (feedEl) {
        feedEl.innerHTML = session._liveAssistantActions.slice(-8).reverse().map(act => `
          <div style="padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; color: #e2e8f0; font-size: 11.5px;">
            <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis;">
              <b style="color: var(--cyan);">${escapeHtml(act.author || 'Asistente')}:</b> ${escapeHtml(act.desc)}
            </span>
            <span style="color: var(--muted); font-size: 10px; margin-left: 8px; flex-shrink: 0;">${act.time}</span>
          </div>
        `).join('');
      }
      if (countEl) countEl.textContent = session._liveAssistantActions.length;
    }, (statusDoc) => {
      if (statusDoc) {
        const wasConnected = session._liveTrackerConnected;
        session._liveTrackerConnected = !!statusDoc.assistantConnected;

        const newAsstName = statusDoc.lastAssistantName || '';
        const list = Array.isArray(statusDoc.connectedAssistants) ? statusDoc.connectedAssistants : (newAsstName ? [newAsstName] : []);
        session._connectedAssistants = list;

        // Notificar en la app coach cuando se conecta un asistente con su nombre
        if (newAsstName && session._lastNotifiedAssistant !== newAsstName) {
          session._lastNotifiedAssistant = newAsstName;
          haptic(60);
          toast(`🟢 ¡Asistente conectado: ${newAsstName}!`, 'success');
          renderTracker();
        } else if (!wasConnected && session._liveTrackerConnected) {
          haptic(60);
          toast(newAsstName ? `🟢 ¡Asistente conectado: ${newAsstName}!` : '🟢 ¡Asistente remoto conectado a la sesión!', 'success');
          renderTracker();
        }

        // Actualizar el badge y la lista de asistentes en el modal si está abierto
        const badgeEl = document.getElementById('live-tracker-status-badge');
        if (badgeEl) {
          const namesStr = list.join(', ');
          badgeEl.innerHTML = `
            <span class="live-dot" style="background: ${session._liveTrackerConnected ? '#22c55e' : '#22d3ee'};"></span>
            <span>${session._liveTrackerConnected ? (namesStr ? `🟢 CONECTADO: ${escapeHtml(namesStr)}` : '🟢 ASISTENTE CONECTADO') : '⏳ ESPERANDO ASISTENTE'}</span>
          `;
        }

        const asstsBox = document.getElementById('live-connected-assts-box');
        if (asstsBox) {
          if (list.length > 0) {
            asstsBox.innerHTML = `
              <span style="font-size: 11.5px; color: var(--muted); font-weight: 700;">Conectados ahora:</span>
              ${list.map(name => `
                <span class="badge" style="background: rgba(34, 197, 94, 0.2); border: 1.5px solid #22c55e; color: #86efac; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                  👤 ${escapeHtml(name)}
                </span>
              `).join('')}
            `;
          } else {
            asstsBox.innerHTML = `<span style="color: var(--muted); font-style: italic; font-size: 11.5px;">Esperando que el asistente introduzca el PIN...</span>`;
          }
        }
      }
    });
  }

  async function showLiveTrackerShareModal(session) {
    if (!window.Cloud) {
      toast('Módulo Cloud no disponible', 'error');
      return;
    }

    const playerIds = Store.sessionPlayerIds(session);
    let sessionPlayers = playerIds.map(id => Store.player(id)).filter(Boolean);
    if (sessionPlayers.length === 0) {
      sessionPlayers = Store.sortedPlayers('all');
    }
    const playersList = sessionPlayers.map(p => ({
      id: p.id,
      name: Store.playerName(p),
      dorsal: p.mainDorsal != null ? p.mainDorsal : (p.dorsal != null ? p.dorsal : '-'),
      position: p.position || 'MC',
      photo: p.photo || ''
    }));

    const statsList = Store.getSessionStats(session).map(st => ({
      key: st.key,
      short: st.short || st.key,
      name: st.label || st.key,
      emoji: st.emoji,
      color: st.color
    }));

    let currentTarget = session._liveTrackerTargetSlot !== undefined ? session._liveTrackerTargetSlot : 0;

    const code = await Cloud.startLiveTrackerSession(session, currentTarget, playersList, statsList);
    if (!code) {
      toast('Error al conectar con la nube Firestore', 'error');
      return;
    }

    session._liveTrackerCode = code;
    session._liveTrackerActive = true;

    let baseUrl = window.location.href.split('?')[0].replace(/[^/]*$/, '');
    const isLocalhostOrFile = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    let finalShareUrl = isLocalhostOrFile 
      ? 'https://streetoh.github.io/Player_Stats/tracker.html?c=' + code 
      : baseUrl + 'tracker.html?c=' + code;

    setupLiveTrackerListener(session, code);

    openSheet('📡 ' + t('shareTracker', 'Asistente Remoto (Tracker Independiente)'), (body) => {
      function renderModal() {
        let qrSvg = '';
        if (window.SyncEngine && SyncEngine.QR && SyncEngine.QR.toSVG) {
          qrSvg = SyncEngine.QR.toSVG(finalShareUrl, 6);
        }

        const slotAPlayer = (session.slots && session.slots[0]) ? Store.player(session.slots[0]) : null;
        const slotBPlayer = (session.slots && session.slots[1]) ? Store.player(session.slots[1]) : null;
        const asstsList = session._connectedAssistants || [];
        const asstsNames = asstsList.join(', ');

        body.innerHTML = `
          <div style="text-align: center; margin-bottom: 14px;">
            <div id="live-tracker-status-badge" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.3);">
              <span class="live-dot" style="background: ${session._liveTrackerConnected ? '#22c55e' : '#22d3ee'};"></span>
              <span>${session._liveTrackerConnected ? (asstsNames ? `🟢 CONECTADO: ${escapeHtml(asstsNames)}` : '🟢 ASISTENTE CONECTADO') : '⏳ ESPERANDO ASISTENTE'}</span>
            </div>
            <div id="live-connected-assts-box" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;">
              ${asstsList.length > 0 ? `
                <span style="font-size: 11.5px; color: var(--muted); font-weight: 700;">Conectados ahora:</span>
                ${asstsList.map(name => `
                  <span class="badge" style="background: rgba(34, 197, 94, 0.2); border: 1.5px solid #22c55e; color: #86efac; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                    👤 ${escapeHtml(name)}
                  </span>
                `).join('')}
              ` : `
                <span style="color: var(--muted); font-style: italic; font-size: 11.5px;">Esperando que el asistente introduzca el PIN...</span>
              `}
            </div>
            <p style="font-size: 12.5px; color: var(--muted); margin-top: 8px; line-height: 1.4;">
              Cualquier persona puede trackear en directo desde su teléfono <b>sin instalar ninguna aplicación</b>.
            </p>
          </div>

          <!-- TARJETA DEL CÓDIGO PIN DE 6 DÍGITOS -->
          <div style="background: linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(15, 23, 42, 0.7)); border: 2px solid var(--cyan); border-radius: 18px; padding: 16px; text-align: center; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(34, 211, 238, 0.18);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: var(--cyan); letter-spacing: 1px; text-transform: uppercase;">
                CÓDIGO DE ACCESO (6 DÍGITOS)
              </span>
              <button type="button" class="btn sm ghost" id="btn-regen-tracker-code" title="Generar un código nuevo" style="padding: 2px 8px; font-size: 11px; font-weight: 800; color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.4); border-radius: 8px;">
                🔄 Nuevo código
              </button>
            </div>
            <div style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #fff; margin: 8px 0; font-family: monospace; text-shadow: 0 0 20px rgba(34, 211, 238, 0.4);">
              ${code.slice(0, 3)} ${code.slice(3)}
            </div>
            <div style="font-size: 12px; color: #94a3b8;">
              El asistente debe entrar a <b style="color: #22d3ee;">tracker.html</b> e introducir este número.
            </div>
          </div>

          <!-- ACCIONES RÁPIDAS: COPIAR Y COMPARTIR ENLACE -->
          <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button type="button" class="btn" id="btn-copy-live-link" style="flex: 1; background: var(--surface2); border: 1.5px solid var(--border); color: #fff; font-weight: 800; font-size: 12.5px; padding: 11px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📋 Copiar Enlace Directo
            </button>
            ${navigator.share ? `
              <button type="button" class="btn" id="btn-native-share-link" style="flex: 1; background: rgba(34, 211, 238, 0.2); border: 1.5px solid var(--cyan); color: var(--cyan); font-weight: 800; font-size: 12.5px; padding: 11px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                📤 Compartir Enlace
              </button>
            ` : ''}
          </div>

          <!-- ASIGNACIÓN DE JUGADOR AL ASISTENTE -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border); border-radius: 14px; padding: 14px; margin-bottom: 16px;">
            <label style="display: block; font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 8px;">
              🎯 ¿A QUIÉN VA A TRACKEAR EL ASISTENTE?
            </label>
            <select id="select-assistant-slot" style="width: 100%; padding: 11px; border-radius: 10px; background: var(--bg2); color: #fff; border: 1.5px solid var(--border); font-size: 13.5px; font-weight: 700; outline: none;">
              <option value="0" ${currentTarget === 0 ? 'selected' : ''}>
                Ranura A: ${slotAPlayer ? '#' + (slotAPlayer.mainDorsal || '-') + ' ' + Store.playerName(slotAPlayer) : 'Jugador Superior'}
              </option>
              <option value="1" ${currentTarget === 1 ? 'selected' : ''}>
                Ranura B: ${slotBPlayer ? '#' + (slotBPlayer.mainDorsal || '-') + ' ' + Store.playerName(slotBPlayer) : 'Jugador Inferior'}
              </option>
              <option value="any" ${currentTarget === 'any' ? 'selected' : ''}>
                ⭐ Libre (El asistente puede elegir a cualquier jugador de la plantilla)
              </option>
            </select>
          </div>

          <!-- CÓDIGO QR PARA ESCANEAR -->
          <div style="text-align: center; margin-bottom: 16px;">
            <div id="live-tracker-qr-wrapper" style="background: #ffffff; padding: 12px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 224px; min-height: 224px; margin: 0 auto;">
              <canvas id="live-tracker-qr-canvas" width="200" height="200" style="display: block; border-radius: 8px; width: 200px; height: 200px;"></canvas>
            </div>
            <div style="font-size: 11.5px; color: var(--muted); margin-top: 6px;">
              📷 Escanea con la cámara de su móvil para abrir directamente el tracker
            </div>
          </div>

          <!-- REGISTRO EN VIVO DE ACCIONES DEL ASISTENTE -->
          <div id="live-assistant-feed" style="background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 14px; padding: 12px; font-size: 12px;">
            <div style="font-weight: 800; color: var(--muted); margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>⚡ Acciones remotas recibidas:</span>
              <span id="live-assistant-count" style="color: var(--cyan); font-weight: 900;">${(session._liveAssistantActions || []).length}</span>
            </div>
            <div id="live-assistant-log-list" style="max-height: 110px; overflow-y: auto;">
              ${(session._liveAssistantActions && session._liveAssistantActions.length > 0)
                ? session._liveAssistantActions.slice(-8).reverse().map(act => `
                    <div style="padding: 5px 0; border-bottom: 1px dashed rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; color: #e2e8f0; font-size: 11.5px;">
                      <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis;">
                        <b style="color: var(--cyan);">${escapeHtml(act.author || 'Asistente')}:</b> ${escapeHtml(act.desc)}
                      </span>
                      <span style="color: var(--muted); font-size: 10px; margin-left: 8px; flex-shrink: 0;">${act.time}</span>
                    </div>
                  `).join('')
                : `<span style="color: var(--muted); font-style: italic;">Esperando primeras pulsaciones del asistente...</span>`
              }
            </div>
            <div style="margin-top: 10px; text-align: center;">
              <button type="button" class="btn sm secondary" id="btn-open-full-audit" style="width: 100%; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1.5px solid var(--border);">
                👥 ${t('viewFullAudit', 'Ver Auditoría Completa de Acciones')}
              </button>
            </div>
          </div>
        `;

        // Renderizado garantizado del código QR (Canvas nativo + SVG fallback + imagen fallback)
        const qrCanvas = body.querySelector('#live-tracker-qr-canvas');
        const qrWrapper = body.querySelector('#live-tracker-qr-wrapper');

        function fallbackQR() {
          if (!qrWrapper) return;
          try {
            if (window.SyncEngine && SyncEngine.QR && SyncEngine.QR.toSVG) {
              const svgStr = SyncEngine.QR.toSVG(finalShareUrl, 6);
              if (svgStr) {
                qrWrapper.innerHTML = svgStr;
                return;
              }
            }
          } catch (e) {}
          qrWrapper.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(finalShareUrl)}" alt="QR Code" width="200" height="200" style="display:block;border-radius:8px;" />`;
        }

        if (qrCanvas && window.QRCode && window.QRCode.toCanvas) {
          try {
            window.QRCode.toCanvas(qrCanvas, finalShareUrl, { width: 200, margin: 2 }, function (err) {
              if (err) {
                console.warn('[QR] Error en QRCode.toCanvas:', err);
                fallbackQR();
              }
            });
          } catch (e) {
            fallbackQR();
          }
        } else {
          fallbackQR();
        }

        const btnRegenCode = body.querySelector('#btn-regen-tracker-code');
        if (btnRegenCode) {
          btnRegenCode.onclick = () => {
            confirmDialog('Generar nuevo código', '¿Deseas generar un código de acceso nuevo? El código anterior dejará de ser válido.', async () => {
              const newCode = await Cloud.startLiveTrackerSession(session, currentTarget, playersList, statsList, true);
              if (newCode) {
                code = newCode;
                session._liveTrackerCode = newCode;
                session._connectedAssistants = [];
                session._lastNotifiedAssistant = null;
                finalShareUrl = isLocalhostOrFile 
                  ? 'https://streetoh.github.io/Player_Stats/tracker.html?c=' + newCode 
                  : baseUrl + 'tracker.html?c=' + newCode;
                setupLiveTrackerListener(session, newCode);
                renderTracker();
                toast('¡Nuevo código generado: ' + newCode + '!', 'success');
                renderModal();
              }
            });
          };
        }

        const btnOpenFullAudit = body.querySelector('#btn-open-full-audit');
        if (btnOpenFullAudit) {
          btnOpenFullAudit.onclick = () => {
            showSessionActionsAuditModal(session);
          };
        }

        const copyBtn = body.querySelector('#btn-copy-live-link');
        if (copyBtn) {
          copyBtn.onclick = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(finalShareUrl).then(() => {
                toast('¡Enlace directo copiado al portapapeles!', 'success');
              }).catch(() => {
                copyPrompt(finalShareUrl);
              });
            } else {
              copyPrompt(finalShareUrl);
            }
          };
        }

        const nativeShareBtn = body.querySelector('#btn-native-share-link');
        if (nativeShareBtn) {
          nativeShareBtn.onclick = () => {
            navigator.share({
              title: 'Tracker en directo • ' + Store.sessionTitle(session),
              text: `Conéctate para trackear al jugador en directo. Código: ${code}`,
              url: finalShareUrl
            }).catch(() => {});
          };
        }

        const selectSlot = body.querySelector('#select-assistant-slot');
        if (selectSlot) {
          selectSlot.onchange = () => {
            const val = selectSlot.value === 'any' ? 'any' : parseInt(selectSlot.value, 10);
            currentTarget = val;
            session._liveTrackerTargetSlot = val;
            let targetPid = null;
            if (val === 0 && session.slots) targetPid = session.slots[0];
            else if (val === 1 && session.slots) targetPid = session.slots[1];
            Cloud.updateLiveTrackerSession(code, {
              targetSlot: val,
              targetPlayerId: targetPid
            });
            toast('Asignación de jugador actualizada en el asistente', 'info');
          };
        }
      }

      renderModal();
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn danger ghost" id="btn-stop-live-tracker">Desconectar</button>
          <button class="btn primary" id="btn-close-live-modal">Mantener activo ✓</button>
        </div>
      `;

      foot.querySelector('#btn-close-live-modal').onclick = closeSheet;

      foot.querySelector('#btn-stop-live-tracker').onclick = () => {
        confirmDialog('Finalizar conexión remota', '¿Deseas cerrar el tracker compartido? Los asistentes se desconectarán de inmediato y no podrán enviar más acciones.', async () => {
          if (activeLiveTrackerUnsub) {
            try { activeLiveTrackerUnsub(); } catch (e) {}
            activeLiveTrackerUnsub = null;
          }
          if (code) {
            await Cloud.closeLiveTrackerSession(code);
          }
          session._liveTrackerActive = false;
          session._liveTrackerConnected = false;
          session._liveTrackerCode = null;
          session._connectedAssistants = [];
          session._lastNotifiedAssistant = null;
          closeSheet();
          renderTracker();
          toast('Tracker compartido finalizado y asistentes desconectados', 'info');
        });
      };
    });
  }

  /* =========================================================
     MODAL DE AUDITORÍA DE ACCIONES Y ASISTENTES
     Muestra quién ha trackeado a qué jugador, qué botones ha pulsado,
     con colores vivos y diferenciados para cada asistente y el entrenador.
     ========================================================= */
  const AUDIT_AUTHOR_PALETTE = [
    { bg: 'rgba(34, 197, 94, 0.16)', border: '#22c55e', text: '#86efac', solid: '#22c55e' }, // Verde esmeralda
    { bg: 'rgba(245, 158, 11, 0.16)', border: '#f59e0b', text: '#fbbf24', solid: '#f59e0b' }, // Ámbar
    { bg: 'rgba(168, 85, 247, 0.16)', border: '#a855f7', text: '#d8b4fe', solid: '#a855f7' }, // Púrpura
    { bg: 'rgba(14, 165, 233, 0.16)', border: '#0ea5e9', text: '#7dd3fc', solid: '#0ea5e9' }, // Azul cielo
    { bg: 'rgba(244, 63, 94, 0.16)', border: '#f43f5e', text: '#fda4af', solid: '#f43f5e' }, // Rosa / Rose
    { bg: 'rgba(20, 184, 166, 0.16)', border: '#14b8a6', text: '#5eead4', solid: '#14b8a6' }, // Turquesa
    { bg: 'rgba(249, 115, 22, 0.16)', border: '#f97316', text: '#fdba74', solid: '#f97316' }, // Naranja
    { bg: 'rgba(99, 102, 241, 0.16)', border: '#6366f1', text: '#a5b4fc', solid: '#6366f1' }, // Índigo
    { bg: 'rgba(236, 72, 153, 0.16)', border: '#ec4899', text: '#f472b6', solid: '#ec4899' }  // Magenta
  ];

  const AUDIT_COACH_COLOR = {
    bg: 'rgba(6, 182, 212, 0.16)',
    border: '#06b6d4',
    text: '#67e8f9',
    solid: '#06b6d4'
  };

  function showSessionActionsAuditModal(sessionOrId) {
    const s = (typeof sessionOrId === 'object' && sessionOrId) ? sessionOrId : Store.session(sessionOrId);
    if (!s) return;

    let activeView = 'player'; // 'player' | 'timeline'
    let activeAuthorFilter = 'all';
    let searchQuery = '';

    openSheet(t('auditActionsTitle', 'Auditoría de Acciones'), (body) => {
      function renderAuditContent() {
        const rawLogs = s.log || [];
        const coachDefaultName = (Store.state && Store.state.settings && Store.state.settings.coachName) || 'Entrenador';

        // 1. Mapeo dinámico y consistente de autores con asignación garantizada de colores
        const authorMetaMap = {
          coach: {
            id: 'coach',
            name: coachDefaultName,
            isCoach: true,
            icon: '👑',
            color: AUDIT_COACH_COLOR,
            count: 0
          }
        };

        let asstPaletteIdx = 0;
        const getOrRegisterAuthor = (authorType, rawAuthorName) => {
          const isCoach = (authorType === 'coach' || !authorType);
          if (isCoach) {
            if (rawAuthorName && rawAuthorName.trim() && rawAuthorName.trim() !== 'Entrenador') {
              authorMetaMap.coach.name = rawAuthorName.trim();
            }
            return authorMetaMap.coach;
          }
          const cleanName = (rawAuthorName && rawAuthorName.trim()) ? rawAuthorName.trim() : 'Asistente';
          const authorKey = 'asst_' + cleanName.toLowerCase();
          if (!authorMetaMap[authorKey]) {
            const paletteColor = AUDIT_AUTHOR_PALETTE[asstPaletteIdx % AUDIT_AUTHOR_PALETTE.length];
            asstPaletteIdx++;
            authorMetaMap[authorKey] = {
              id: authorKey,
              name: cleanName,
              isCoach: false,
              icon: '👤',
              color: paletteColor,
              count: 0
            };
          }
          return authorMetaMap[authorKey];
        };

        // Primera pasada: registrar autores y contar acciones totales por autor
        rawLogs.forEach(entry => {
          const meta = getOrRegisterAuthor(entry.author, entry.authorName);
          meta.count++;
        });

        const allAuthors = Object.values(authorMetaMap).filter(a => a.count > 0);
        if (allAuthors.length === 0) {
          allAuthors.push(authorMetaMap.coach);
        }

        // 2. Filtrado de logs según autor activo y término de búsqueda
        const q = searchQuery.toLowerCase().trim();

        const filteredLogs = rawLogs.filter(entry => {
          const authorMeta = getOrRegisterAuthor(entry.author, entry.authorName);
          if (activeAuthorFilter !== 'all' && authorMeta.id !== activeAuthorFilter) {
            return false;
          }
          if (q) {
            const authorMatch = authorMeta.name.toLowerCase().includes(q);
            let playerMatch = false;
            let actionMatch = false;

            if (entry.isDuel1v1) {
              const pA = Store.player(entry.pA);
              const pB = Store.player(entry.pB);
              const pAName = pA ? Store.playerName(pA).toLowerCase() : '';
              const pBName = pB ? Store.playerName(pB).toLowerCase() : '';
              if (pAName.includes(q) || pBName.includes(q)) playerMatch = true;
              if ('1v1 duelo'.includes(q)) actionMatch = true;
            } else {
              const p = Store.player(entry.p);
              const pName = p ? Store.playerName(p).toLowerCase() : '';
              const dorsal = p && p.mainDorsal != null ? String(p.mainDorsal) : '';
              if (pName.includes(q) || dorsal === q) playerMatch = true;

              const keys = Array.isArray(entry.k) ? entry.k : [entry.k];
              for (const k of keys) {
                const statObj = Store.STATS.find(st => st.key === k);
                const statLbl = statObj ? statObj.label.toLowerCase() : k.toLowerCase();
                if (statLbl.includes(q)) { actionMatch = true; break; }
              }
            }

            if (!authorMatch && !playerMatch && !actionMatch) return false;
          }
          return true;
        });

        // 3. Estructuración por Jugador -> Autor -> Botones pulsados
        const playerStatsMap = {};

        filteredLogs.forEach(entry => {
          const authorMeta = getOrRegisterAuthor(entry.author, entry.authorName);

          if (entry.isDuel1v1) {
            [entry.pA, entry.pB].forEach(pid => {
              if (!pid) return;
              if (!playerStatsMap[pid]) {
                playerStatsMap[pid] = {
                  player: Store.player(pid) || { id: pid, name: pid },
                  totalActions: 0,
                  authors: {}
                };
              }
              const pEntry = playerStatsMap[pid];
              pEntry.totalActions++;
              if (!pEntry.authors[authorMeta.id]) {
                pEntry.authors[authorMeta.id] = {
                  meta: authorMeta,
                  count: 0,
                  stats: {},
                  duels1v1: []
                };
              }
              const aEntry = pEntry.authors[authorMeta.id];
              aEntry.count++;
              aEntry.duels1v1.push(entry);
            });
          } else {
            const pid = entry.p;
            if (!pid) return;
            if (!playerStatsMap[pid]) {
              playerStatsMap[pid] = {
                player: Store.player(pid) || { id: pid, name: pid },
                totalActions: 0,
                authors: {}
              };
            }
            const pEntry = playerStatsMap[pid];
            pEntry.totalActions++;
            if (!pEntry.authors[authorMeta.id]) {
              pEntry.authors[authorMeta.id] = {
                meta: authorMeta,
                count: 0,
                stats: {},
                duels1v1: []
              };
            }
            const aEntry = pEntry.authors[authorMeta.id];
            aEntry.count++;

            const primaryKey = Array.isArray(entry.k) ? entry.k[0] : entry.k;
            if (primaryKey) {
              const delta = entry.d != null ? entry.d : 1;
              aEntry.stats[primaryKey] = (aEntry.stats[primaryKey] || 0) + delta;
            }
          }
        });

        const playerList = Object.values(playerStatsMap).sort((a, b) => b.totalActions - a.totalActions);

        // Renderizado del HTML principal
        body.innerHTML = `
          <!-- Resumen cabecera de la sesión -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid var(--border); border-radius: 14px; padding: 12px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 16px;">${s.type === 'match' ? '🏆' : '⚽'}</span>
                <b style="font-size: 14px; color: #fff;">${escapeHtml(Store.sessionTitle(s))}</b>
              </div>
              <small style="color: var(--muted); font-size: 11px; display: block; margin-top: 2px;">
                📅 ${formatDateDDMMAAAA(s.date)} • ⏱️ ${Store.fmtTime(Store.elapsed(s), s)}
              </small>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span class="badge" style="background: rgba(34, 211, 238, 0.15); border: 1px solid rgba(34, 211, 238, 0.4); color: var(--cyan); font-weight: 900; font-size: 12px; padding: 4px 10px; border-radius: 8px;">
                ⚡ ${rawLogs.length} ${t('actions', 'acciones')}
              </span>
            </div>
          </div>

          <!-- Selector de Modo de Vista (Por Jugador vs Línea de Tiempo) -->
          <div class="segmented" style="display: flex; gap: 4px; margin-bottom: 12px; background: var(--surface2); padding: 4px; border-radius: 10px;">
            <button type="button" class="btn sm ${activeView === 'player' ? 'primary' : 'ghost'}" id="btn-audit-tab-player" style="flex: 1; height: 32px; font-size: 11.5px; font-weight: 800; border-radius: 8px;">
              👤 ${t('auditByPlayer', 'Por Jugador')}
            </button>
            <button type="button" class="btn sm ${activeView === 'timeline' ? 'primary' : 'ghost'}" id="btn-audit-tab-timeline" style="flex: 1; height: 32px; font-size: 11.5px; font-weight: 800; border-radius: 8px;">
              ⏱️ ${t('auditTimeline', 'Línea de Tiempo')}
            </button>
          </div>

          <!-- Barra de Filtro de Autores (Chips con sus colores distintivos) -->
          <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 10px; -webkit-overflow-scrolling: touch;" class="no-scrollbar">
            <button type="button" class="btn sm audit-chip-author ${activeAuthorFilter === 'all' ? 'active' : ''}" data-author-id="all" style="flex-shrink: 0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; border: 1.5px solid ${activeAuthorFilter === 'all' ? 'var(--cyan)' : 'var(--border)'}; background: ${activeAuthorFilter === 'all' ? 'var(--cyan)' : 'var(--surface2)'}; color: ${activeAuthorFilter === 'all' ? '#0f172a' : '#cbd5e1'};">
              🌐 ${t('auditAllAuthors', 'Todos')} (${rawLogs.length})
            </button>
            ${allAuthors.map(author => {
              const isSelected = activeAuthorFilter === author.id;
              const col = author.color;
              return `
                <button type="button" class="btn sm audit-chip-author ${isSelected ? 'active' : ''}" data-author-id="${author.id}" style="flex-shrink: 0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; border: 1.5px solid ${col.border}; background: ${isSelected ? col.solid : col.bg}; color: ${isSelected ? '#0f172a' : col.text}; box-shadow: ${isSelected ? '0 0 10px ' + col.solid + '80' : 'none'};">
                  ${author.icon} ${escapeHtml(author.name)} (${author.count})
                </button>
              `;
            }).join('')}
          </div>

          <!-- Barra de Búsqueda Rápida en Vivo -->
          <div style="position: relative; margin-bottom: 12px;">
            <input type="text" id="inp-audit-search" value="${escapeHtml(searchQuery)}" placeholder="${t('auditSearchPlaceholder', 'Buscar jugador, asistente o acción...')}" style="width: 100%; padding: 8px 32px 8px 12px; font-size: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff;" />
            ${searchQuery ? `<button type="button" id="btn-clear-audit-search" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px;">✕</button>` : ''}
          </div>

          <!-- Contenido según la vista seleccionada -->
          <div id="audit-main-content-scroll" style="max-height: 52vh; overflow-y: auto; padding-right: 2px;">
            ${rawLogs.length === 0 ? `
              <div style="padding: 30px 16px; text-align: center; color: var(--muted); font-size: 12.5px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--border); border-radius: 12px;">
                <span style="font-size: 28px; display: block; margin-bottom: 6px;">📂</span>
                ${t('auditNoActions', 'No hay acciones registradas en esta sesión.')}
              </div>
            ` : (filteredLogs.length === 0 ? `
              <div style="padding: 24px 16px; text-align: center; color: var(--muted); font-size: 12px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--border); border-radius: 12px;">
                🔍 ${t('auditNoFilterResults', 'No se encontraron acciones con los filtros seleccionados.')}
              </div>
            ` : (activeView === 'player' ? `
              <!-- VISTA 1: AGRUPADO POR JUGADOR -->
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${playerList.map(item => {
                  const p = item.player;
                  const pAuthors = Object.values(item.authors);
                  return `
                    <div class="card" style="padding: 12px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--surface2);">
                      <!-- Cabecera del jugador -->
                      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          ${renderAvatar(p, 'sm')}
                          <div>
                            <b style="font-size: 13.5px; color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                            <small style="display: block; color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                          </div>
                        </div>
                        <span class="badge" style="background: rgba(34, 211, 238, 0.15); border: 1px solid rgba(34, 211, 238, 0.35); color: var(--cyan); font-size: 11px; font-weight: 800;">
                          ${item.totalActions} ${t('actions', 'acciones')}
                        </span>
                      </div>

                      <!-- Sub-bloques por cada Asistente / Entrenador que ha trackeado a este jugador -->
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${pAuthors.map(aData => {
                          const col = aData.meta.color;
                          const statEntries = Object.entries(aData.stats).filter(([k, v]) => v !== 0);
                          return `
                            <div style="background: ${col.bg}; border: 1.5px solid ${col.border}; border-radius: 10px; padding: 8px 10px;">
                              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 800; font-size: 12px; color: ${col.text}; display: flex; align-items: center; gap: 4px;">
                                  <span>${aData.meta.icon}</span>
                                  <span>${escapeHtml(aData.meta.name)}</span>
                                </span>
                                <span class="badge" style="background: ${col.solid}33; color: ${col.text}; border: 1px solid ${col.border}; font-size: 10.5px; font-weight: 800;">
                                  ${aData.count} ${t('actions', 'acciones')}
                                </span>
                              </div>

                              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                                ${statEntries.map(([statKey, count]) => {
                                  const statMeta = Store.STATS.find(s => s.key === statKey) || { emoji: '⚽', label: statKey, color: col.text };
                                  return `
                                    <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.12); padding: 3px 8px; border-radius: 6px; font-size: 11px; color: #fff;">
                                      <span>${statMeta.emoji}</span>
                                      <span style="color: #cbd5e1;">${statMeta.label}:</span>
                                      <b style="color: ${statMeta.color || col.text}; font-weight: 900;">${count > 0 ? '+' + count : count}</b>
                                    </span>
                                  `;
                                }).join('')}

                                ${(aData.duels1v1 && aData.duels1v1.length > 0) ? `
                                  <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.12); padding: 3px 8px; border-radius: 6px; font-size: 11px; color: #fff;">
                                    <span>⚔️</span>
                                    <span style="color: #cbd5e1;">Duelos 1v1:</span>
                                    <b style="color: #facc15; font-weight: 900;">${aData.duels1v1.length}</b>
                                  </span>
                                ` : ''}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <!-- VISTA 2: LÍNEA DE TIEMPO CRONOLÓGICA (FEED DE EVENTOS) -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${filteredLogs.slice().reverse().map(entry => {
                  const authorMeta = getOrRegisterAuthor(entry.author, entry.authorName);
                  const col = authorMeta.color;
                  const timeStr = entry.m != null ? (entry.m + "'") : (entry.t ? new Date(entry.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

                  if (entry.isDuel1v1) {
                    const pA = Store.player(entry.pA);
                    const pB = Store.player(entry.pB);
                    const pAName = pA ? Store.playerName(pA).split(' ')[0] : 'J1';
                    const pBName = pB ? Store.playerName(pB).split(' ')[0] : 'J2';
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3.5px solid ${col.border}; border-radius: 8px; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                          <span style="font-size: 10.5px; font-weight: 800; color: var(--muted); min-width: 26px;">⏱️ ${timeStr}</span>
                          <span class="badge" style="background: ${col.bg}; color: ${col.text}; border: 1px solid ${col.border}; font-size: 10px; font-weight: 800; white-space: nowrap;">
                            ${authorMeta.icon} ${escapeHtml(authorMeta.name)}
                          </span>
                          <span style="font-size: 12px; color: #fff; font-weight: 700;" class="ellipsis">
                            ⚔️ 1v1: ${escapeHtml(pAName)} vs ${escapeHtml(pBName)}
                          </span>
                        </div>
                        <span class="badge" style="background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24; font-size: 10.5px; font-weight: 800; flex-shrink: 0;">
                          ${entry.outcomeType || 'Duelo'}
                        </span>
                      </div>
                    `;
                  }

                  const p = Store.player(entry.p);
                  const pName = p ? Store.playerName(p) : 'Jugador';
                  const primaryKey = Array.isArray(entry.k) ? entry.k[0] : entry.k;
                  const statMeta = Store.STATS.find(s => s.key === primaryKey) || { emoji: '⚽', label: primaryKey, color: '#fff' };
                  const isPlus = (entry.d == null || entry.d > 0);

                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3.5px solid ${col.border}; border-radius: 8px; gap: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                        <span style="font-size: 10.5px; font-weight: 800; color: var(--muted); min-width: 26px;">⏱️ ${timeStr}</span>
                        <span class="badge" style="background: ${col.bg}; color: ${col.text}; border: 1px solid ${col.border}; font-size: 10px; font-weight: 800; white-space: nowrap;">
                          ${authorMeta.icon} ${escapeHtml(authorMeta.name)}
                        </span>
                        <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
                          ${p ? renderAvatar(p, 'sm') : ''}
                          <b class="ellipsis" style="font-size: 12px; color: #fff;">${escapeHtml(pName)}</b>
                        </div>
                      </div>
                      <span class="badge" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); font-size: 11px; font-weight: 800; color: ${statMeta.color || '#fff'}; flex-shrink: 0;">
                        ${statMeta.emoji} ${statMeta.label} <b style="color: ${isPlus ? '#4ade80' : '#f87171'};">${isPlus ? '+1' : '-1'}</b>
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            `))}
          </div>
        `;

        // Event Listeners
        const btnTabPlayer = body.querySelector('#btn-audit-tab-player');
        if (btnTabPlayer) {
          btnTabPlayer.onclick = () => {
            activeView = 'player';
            renderAuditContent();
          };
        }

        const btnTabTimeline = body.querySelector('#btn-audit-tab-timeline');
        if (btnTabTimeline) {
          btnTabTimeline.onclick = () => {
            activeView = 'timeline';
            renderAuditContent();
          };
        }

        body.querySelectorAll('.audit-chip-author').forEach(chip => {
          chip.onclick = () => {
            activeAuthorFilter = chip.getAttribute('data-author-id');
            renderAuditContent();
          };
        });

        const inpSearch = body.querySelector('#inp-audit-search');
        if (inpSearch) {
          inpSearch.oninput = () => {
            searchQuery = inpSearch.value;
            renderAuditContent();
            const newInp = body.querySelector('#inp-audit-search');
            if (newInp) {
              newInp.focus();
              newInp.setSelectionRange(newInp.value.length, newInp.value.length);
            }
          };
        }

        const btnClearSearch = body.querySelector('#btn-clear-audit-search');
        if (btnClearSearch) {
          btnClearSearch.onclick = () => {
            searchQuery = '';
            renderAuditContent();
          };
        }
      }

      renderAuditContent();
    }, (foot) => {
      foot.innerHTML = `
        <button class="btn block primary" id="btn-close-audit-sheet">${t('close', 'Cerrar')}</button>
      `;
      foot.querySelector('#btn-close-audit-sheet').onclick = closeSheet;
    });
  }


  /* =========================================================
     MODAL DE SINCRONIZACIÓN EN VIVO (DUAL NUBE + RED LOCAL QR)
     ========================================================= */
  function showLiveSyncModal(session, initialMode) {
    let activeMode = (window.SyncEngine && SyncEngine.mode) || 'cloud';
    let camStream = null;
    let camInterval = null;

    function stopCameraScan() {
      if (camInterval) { clearInterval(camInterval); camInterval = null; }
      if (camStream) {
        try { camStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        camStream = null;
      }
    }

    openSheet(t('liveSync'), (body) => {
      function renderModalContent() {
        stopCameraScan();
        const isLive = window.SyncEngine && SyncEngine.isLive();
        const roomCode = (window.SyncEngine && SyncEngine.activeRoom) || '';
        const role = (window.SyncEngine && SyncEngine.role) || '';

        if (isLive) {
          // Vista de Sala Activa
          const qrData = 'https://streetoh.github.io/Player_Stats/coach.html?join=' + roomCode;
          const qrSvg = SyncEngine.QR.toSVG(qrData, 7);

          body.innerHTML = `
            <div style="text-align: center; margin-bottom: 12px;">
              <div class="live-pill">
                <span class="live-dot"></span>
                <span>${SyncEngine.mode === 'cloud' ? 'NUBE 4G/5G' : 'RED LOCAL / P2P'} • EN VIVO</span>
              </div>
            </div>

            <div class="qr-box">
              <span class="muted" style="font-size: 12px; font-weight:700;">CÓDIGO DE SALA:</span>
              <div class="room-code-tag">${roomCode}</div>
              <div id="live-sync-qr-wrapper" style="background: #fff; padding: 12px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); display: inline-flex; align-items: center; justify-content: center; min-width: 224px; min-height: 224px; margin: 0 auto;">
                <canvas id="live-sync-qr-canvas" width="200" height="200" style="display: block; border-radius: 8px; width: 200px; height: 200px;"></canvas>
              </div>
              <p class="hint" style="margin-top: 8px;">
                Escanea este código QR con la app o con la cámara de cualquier teléfono, o escribe el código <b>${roomCode}</b> en el otro móvil para sincronizar datos en directo.
              </p>
            </div>

            <div style="background: var(--bg2); border-radius: 12px; padding: 10px; font-size: 13px; text-align: center; color: var(--muted); margin-bottom: 12px;">
              Dispositivos sincronizados: <b style="color: #22c55e;">${SyncEngine.connectedPeers > 0 ? SyncEngine.connectedPeers + ' conectado(s)' : 'Esperando compañero...'}</b>
            </div>

            <button class="btn block danger" id="btn-sync-disconnect">
              ${icon('stop', 16)} Desconectar y Finalizar En Vivo
            </button>
          `;

          const syncCanvas = body.querySelector('#live-sync-qr-canvas');
          const syncWrapper = body.querySelector('#live-sync-qr-wrapper');
          if (syncCanvas && window.QRCode && window.QRCode.toCanvas) {
            try {
              window.QRCode.toCanvas(syncCanvas, qrData, { width: 200, margin: 2 }, function (err) {
                if (err && syncWrapper) syncWrapper.innerHTML = SyncEngine.QR.toSVG(qrData, 6);
              });
            } catch (e) {
              if (syncWrapper) syncWrapper.innerHTML = SyncEngine.QR.toSVG(qrData, 6);
            }
          } else if (syncWrapper) {
            syncWrapper.innerHTML = SyncEngine.QR.toSVG(qrData, 6);
          }

          body.querySelector('#btn-sync-disconnect').onclick = () => {
            SyncEngine.disconnect();
            toast('Sincronización finalizada', 'info');
            renderModalContent();
            renderTracker();
          };
        } else {
          // Vista para Iniciar o Unirse
          body.innerHTML = `
            <div class="segmented" style="margin-bottom: 12px;">
              <button type="button" class="${activeMode === 'cloud' ? 'active' : ''}" id="mode-tab-cloud">
                🌐 ${t('cloudMode')} (4G/5G)
              </button>
              <button type="button" class="${activeMode === 'local' ? 'active' : ''}" id="mode-tab-local">
                📡 ${t('localMode')} (P2P/Hotspot)
              </button>
            </div>

            <div class="info-note" style="margin-bottom: 12px; font-size: 12px;">
              ${activeMode === 'cloud'
                ? '🌐 <b>Modo Nube (Recomendado):</b> Conexión ultra-rápida por datos móviles 4G/5G o WiFi. Los dispositivos se sincronizan al instante en cualquier lugar.'
                : '📡 <b>Modo Red Local / Punto de Acceso:</b> Para conectar sin internet, activa la <b>Zona Wi-Fi (Punto de acceso)</b> de un teléfono y conecta el otro móvil a esa red Wi-Fi.'
              }
            </div>

            <div class="card" style="margin-bottom: 12px;">
              <h4 style="margin: 0 0 6px; font-size: 14px; color: var(--cyan);">1. Ser Anfitrión (Compartir sesión)</h4>
              <p class="hint" style="margin-bottom: 10px;">Genera una sala única y muestra el código QR para que otros compañeros se conecten a tu sesión.</p>
              <button class="btn block primary" id="btn-sync-start-host">
                ${icon('qr', 18)} Crear Sala en Vivo y Mostrar QR
              </button>
            </div>

            <div class="card" id="guest-join-section">
              <h4 style="margin: 0 0 6px; font-size: 14px; color: var(--green);">2. Unirse a una Sala Existente</h4>
              <p class="hint" style="margin-bottom: 8px;">Introduce el código (formato XXX-000) o escanea el QR del teléfono de tu compañero:</p>
              
              <div class="field-row" style="margin-bottom: 10px;">
                <input type="text" id="sync-input-code" placeholder="FUT-849" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform: uppercase; font-weight: 800; font-size: 16px; letter-spacing: 2px; text-align: center;" />
                <button class="btn primary" id="btn-sync-join-code">Unirse</button>
              </div>

              <button class="btn block ghost" id="btn-sync-open-cam">
                ${icon('camera', 18)} Escanear QR con la Cámara
              </button>

              <div id="sync-cam-container" style="display: none; margin-top: 10px; border-radius: 12px; overflow: hidden; background: #000; text-align: center;">
                <video id="sync-cam-video" style="width: 100%; max-height: 220px; object-fit: cover;" playsinline autoplay></video>
                <div style="padding: 6px; font-size: 11px; color: var(--muted);">Apunta al código QR del otro teléfono</div>
              </div>
            </div>
          `;

          body.querySelector('#mode-tab-cloud').onclick = () => {
            activeMode = 'cloud';
            renderModalContent();
          };
          body.querySelector('#mode-tab-local').onclick = () => {
            activeMode = 'local';
            renderModalContent();
          };

          // Forzar mayúsculas y formato XXX-000 en el input
          const inputCode = body.querySelector('#sync-input-code');
          if (inputCode) {
            inputCode.addEventListener('input', () => {
              let raw = inputCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              let letters = raw.slice(0, 3).replace(/[^A-Z]/g, '');
              let numbers = raw.slice(3, 6).replace(/[^0-9]/g, '');
              let formatted = letters;
              if (letters.length === 3 && raw.length > 3) {
                formatted += '-' + numbers;
              }
              inputCode.value = formatted;
            });
          }

          body.querySelector('#btn-sync-start-host').onclick = () => {
            SyncEngine.startHost(null, activeMode, (code) => {
              toast(`¡Sala ${code} creada con éxito!`, 'success');
              renderModalContent();
              renderTracker();
            });
          };

          body.querySelector('#btn-sync-join-code').onclick = () => {
            const rawCode = document.getElementById('sync-input-code').value.trim().toUpperCase();
            if (!rawCode || rawCode.length < 3) {
              toast('Introduce un código de sala válido (ej: FUT-849)', 'error');
              return;
            }
            let code = rawCode;
            if (code.length === 6 && !code.includes('-')) {
              code = code.slice(0, 3) + '-' + code.slice(3);
            }
            SyncEngine.joinGuest(code, activeMode, () => {
              toast(`¡Conectado a la sala ${code}!`, 'success');
              closeSheet();
              renderTracker();
            });
          };

          body.querySelector('#btn-sync-open-cam').onclick = () => {
            const camBox = body.querySelector('#sync-cam-container');
            const videoEl = body.querySelector('#sync-cam-video');
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              toast('Cámara no disponible en este dispositivo', 'error');
              return;
            }
            camBox.style.display = 'block';

            navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
              .then(stream => {
                camStream = stream;
                videoEl.srcObject = stream;

                const scanCanvas = document.createElement('canvas');
                const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

                camInterval = setInterval(async () => {
                  try {
                    if (videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
                      scanCanvas.width = videoEl.videoWidth;
                      scanCanvas.height = videoEl.videoHeight;
                      scanCtx.drawImage(videoEl, 0, 0, scanCanvas.width, scanCanvas.height);
                      const imgData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
                      let raw = null;

                      // 1. Escaneo rápido y offline con jsQR
                      if (window.jsQR) {
                        const code = window.jsQR(imgData.data, imgData.width, imgData.height, {
                          inversionAttempts: 'dontInvert'
                        });
                        if (code && code.data) raw = code.data;
                      }

                      // 2. Fallback a BarcodeDetector nativo si está disponible
                      if (!raw && window.BarcodeDetector) {
                        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                        const barcodes = await detector.detect(videoEl);
                        if (barcodes && barcodes.length > 0) raw = barcodes[0].rawValue;
                      }

                      if (raw) {
                        let targetCode = raw.trim();
                        try {
                          const parsed = JSON.parse(raw);
                          if (parsed.room) targetCode = parsed.room;
                        } catch (e) {}
                        const m = targetCode.match(/([A-Za-z]{3}-?\d{3})/);
                        if (m) targetCode = m[1].toUpperCase();
                        if (targetCode.length === 6 && !targetCode.includes('-')) {
                          targetCode = targetCode.slice(0, 3) + '-' + targetCode.slice(3);
                        }
                        stopCameraScan();
                        SyncEngine.joinGuest(targetCode.toUpperCase(), activeMode, () => {
                          toast(`¡Conectado a la sala ${targetCode}!`, 'success');
                          closeSheet();
                          renderTracker();
                        });
                      }
                    }
                  } catch (e) {}
                }, 250);
              })
              .catch(err => {
                toast('Permiso de cámara denegado o error: ' + err.message, 'error');
              });
          };

          if (initialMode === 'guest') {
            setTimeout(() => {
              const inputEl = body.querySelector('#sync-input-code');
              if (inputEl) {
                inputEl.focus();
                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 150);
          }
        }
      }

      renderModalContent();
    }, (foot) => {
      foot.innerHTML = `<button class="btn block ghost" id="btn-sync-close">${t('cancel')}</button>`;
      foot.querySelector('#btn-sync-close').onclick = () => {
        stopCameraScan();
        closeSheet();
      };
    });
  }

  /* =========================================================
     RADAR DE HABILIDADES Y DESCRIPCIÓN TÁCTICA
     ========================================================= */
  const SKILL_INFO = {
    pas: {
      name: 'Pase y Distribución',
      nameEn: 'Passing & Distribution',
      emoji: '👟',
      desc: 'Evalúa la precisión y calidad en la entrega del balón tanto en corto como en largo, visión espacial, fluidez asociativa y generación de ventajas tácticas para el equipo.',
      descEn: 'Evaluates precision and delivery quality in both short and long passing, field vision, associative fluency, and tactical advantage creation.',
      factors: 'Pases completados (Ok), bajo índice de pérdidas por pase errado (Ko), asistencias de gol creadas.',
      factorsEn: 'Completed passes (Ok), low turnover rate from missed passes (Ko), goal assists created.'
    },
    tir: {
      name: 'Tiro y Definición',
      nameEn: 'Shooting & Finishing',
      emoji: '🎯',
      desc: 'Evalúa la capacidad de remate, puntería hacia portería, porcentaje de acierto de cara a gol y contundencia ofensiva.',
      descEn: 'Evaluates finishing ability, shot accuracy on goal, conversion rate and offensive box danger.',
      factors: 'Tiros a puerta, porcentaje de puntería entre los tres palos, goles anotados en el área o fuera.',
      factorsEn: 'Shots on target, shooting accuracy between the posts, goals scored inside and outside the box.'
    },
    reg: {
      name: 'Regate y Desborde',
      nameEn: 'Dribbling & Skill',
      emoji: '⚡',
      desc: 'Mide la habilidad técnica individual en el 1 contra 1, capacidad de sobrepasar líneas defensivas, retención del esférico y cambio de ritmo.',
      descEn: 'Measures 1v1 individual technical skill, ability to beat defensive lines, ball retention and pace changes.',
      factors: 'Toques de balón en carrera, desborde por bandas, retención bajo presión defensiva.',
      factorsEn: 'On-the-run touches, wing take-ons, ball retention under defensive pressure.'
    },
    fis: {
      name: 'Físico e Intensidad',
      nameEn: 'Physical & Workrate',
      emoji: '💪',
      desc: 'Mide la presencia activa durante el tiempo de juego, ritmo e intensidad sostenida, despliegue motor y participación continua.',
      descEn: 'Measures active pitch presence, sustained intensity, motor workrate and continuous involvement.',
      factors: 'Minutos disputados, volumen de toques de balón e intervenciones totales en la sesión.',
      factorsEn: 'Minutes played, ball touches volume and total session involvements.'
    },
    def: {
      name: 'Defensa y Recuperación',
      nameEn: 'Defending & Anticipation',
      emoji: '🛡️',
      desc: 'Mide el trabajo táctico sin balón, anticipación de líneas de pase, solidez en disputas defensivas, despejes y recuperación de la posesión.',
      descEn: 'Measures off-ball tactical work, pass lane anticipation, defensive duel solidity, clearances and ball recoveries.',
      factors: 'Balones recuperados, duelos ganados, faltas recibidas protegiendo el balón, repliegue defensivo.',
      factorsEn: 'Ball recoveries, duels won, fouls won shielding the ball, defensive tracking.'
    },
    dis: {
      name: 'Disciplina y Fair Play',
      nameEn: 'Discipline & Fair Play',
      emoji: '🧠',
      desc: 'Mide la actitud táctica, compostura emocional, puntualidad, esfuerzo en entrenamientos y juego limpio.',
      descEn: 'Measures tactical attitude, emotional composure, punctuality, training effort and fair play.',
      factors: 'Valoración asignada por el entrenador, bajo número de faltas y ausencia de tarjetas amarillas y rojas.',
      factorsEn: 'Coach rating score, low foul frequency and absence of yellow and red cards.'
    }
  };

  function showSkillDetailModal(skillKey, val) {
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const info = SKILL_INFO[skillKey];
    const sName = info ? (isEn ? info.nameEn : info.name) : 'Skill';
    const sDesc = info ? (isEn ? info.descEn : info.desc) : '';
    const sFactors = info ? (isEn ? info.factorsEn : info.factors) : '';
    const emoji = info ? info.emoji : '⭐';

    const titleWhat = isEn ? 'What does this skill evaluate?' : '¿Qué evalúa esta cualidad?';
    const titleFactors = isEn ? 'Key scoring factors:' : 'Factores clave en la puntuación:';

    const bodyHtml = `
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="font-size: 40px; font-weight: 900; color: var(--cyan); line-height: 1.1;">
          ${val != null ? val : '—'} <span style="font-size: 17px; color: var(--muted); font-weight: 700;">/ 99</span>
        </div>
        <span class="badge primary" style="font-size: 11px; padding: 2px 9px; margin-top: 4px;">${isEn ? 'Skill Rating' : 'Puntuación de Habilidad'}</span>
      </div>
      <div class="card" style="margin-bottom: 10px;">
        <h4 style="margin: 0 0 6px; font-size: 13.5px; color: var(--text);">${titleWhat}</h4>
        <p style="font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0;">${sDesc}</p>
      </div>
      <div class="card">
        <h4 style="margin: 0 0 6px; font-size: 13.5px; color: #86efac;">${titleFactors}</h4>
        <p style="font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0;">${sFactors}</p>
      </div>
    `;

    openModalDialog(`${emoji} ${sName}`, bodyHtml);
  }

  function renderRadarSVG(radarData) {
    const rd = radarData || { pas: 65, tir: 55, reg: 60, fis: 60, def: 50 };
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const axes = [
      { key: 'pas', label: t('distribution') || 'Pase', val: rd.pas },
      { key: 'tir', label: t('shooting') || 'Tiro', val: rd.tir },
      { key: 'reg', label: t('dribbling') || 'Regate', val: rd.reg },
      { key: 'fis', label: t('physical') || 'Físico', val: rd.fis },
      { key: 'def', label: t('defense') || 'Defensa', val: rd.def }
    ];

    const cx = 130, cy = 130, R = 80;
    const n = axes.length;

    function getPolygonPoints(radiusRatio) {
      return axes.map((_, i) => {
        const angle = -Math.PI / 2 + i * (2 * Math.PI / n);
        const x = cx + R * radiusRatio * Math.cos(angle);
        const y = cy + R * radiusRatio * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    }

    const dataPoints = axes.map((a, i) => {
      const angle = -Math.PI / 2 + i * (2 * Math.PI / n);
      const ratio = Math.max(0.2, Math.min(1.0, a.val / 100));
      const x = cx + R * ratio * Math.cos(angle);
      const y = cy + R * ratio * Math.sin(angle);
      return { x, y, a, angle };
    });

    const dataPointsStr = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return `
      <div style="text-align: center; width: 100%;">
        <svg class="radar-svg" viewBox="0 0 260 260">
          <polygon points="${getPolygonPoints(0.25)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
          <polygon points="${getPolygonPoints(0.50)}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <polygon points="${getPolygonPoints(0.75)}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <polygon points="${getPolygonPoints(1.00)}" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>

          ${axes.map((_, i) => {
            const angle = -Math.PI / 2 + i * (2 * Math.PI / n);
            const x = cx + R * Math.cos(angle);
            const y = cy + R * Math.sin(angle);
            return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>`;
          }).join('')}

          <polygon points="${dataPointsStr}" fill="rgba(34, 211, 238, 0.35)" stroke="#22d3ee" stroke-width="2.5" stroke-linejoin="round"/>

          ${dataPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#22d3ee" stroke="#060a13" stroke-width="2" class="radar-vertex" data-skill="${p.a.key}" data-val="${p.a.val}" style="cursor: pointer;"/>`).join('')}

          ${dataPoints.map(p => {
            const lx = cx + (R + 24) * Math.cos(p.angle);
            const ly = cy + (R + 24) * Math.sin(p.angle);
            return `
              <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#e2e8f0" font-size="10.5" font-weight="800" text-anchor="middle" dominant-baseline="central" class="radar-label" data-skill="${p.a.key}" data-val="${p.a.val}" style="cursor: pointer;">
                ${p.a.label} <tspan fill="#22d3ee" font-weight="900">${p.a.val}</tspan>
              </text>
            `;
          }).join('')}
        </svg>

        <div style="font-size: 11px; color: var(--muted); margin: 6px 0 8px; text-align: center;">
          ${isEn ? '💡 Tap any skill to see its tactical breakdown:' : '💡 Pulsa en cualquier habilidad para ver su explicación táctica:'}
        </div>
        <div class="skill-chips-grid">
          ${axes.map(a => `
            <button type="button" class="skill-chip" data-skill="${a.key}" data-val="${a.val}" title="Ver explicación táctica de ${a.label}">
              <span>${SKILL_INFO[a.key] ? SKILL_INFO[a.key].emoji : '⭐'} ${a.label}</span>
              <b>${a.val}</b>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* Modal de detalle de zona táctica al pulsar en cualquier cuadrante del campo */
  function showPitchZoneDetailModal(zoneName, actionsMap, total) {
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const items = Object.entries(actionsMap || {}).filter(([_, count]) => count > 0);
    const actionsHtml = items.length > 0 ? items.map(([k, cnt]) => {
      const statObj = Store.STAT_MAP[k] || { emoji: '⚽', label: k, short: k };
      const statName = statObj ? (statObj.label || statObj.short || k) : k;
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">${statObj.emoji || '⚽'}</span>
            <div>
              <b style="font-size: 14px; color: #fff; display: block;">${escapeHtml(statName)}</b>
              <small style="color: var(--muted); font-size: 11px;">${statObj.short ? escapeHtml(statObj.short) + ' • ' : ''}${pct}% del total en este sector</small>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 18px; font-weight: 900; color: #22d3ee; font-variant-numeric: tabular-nums;">${cnt}</span>
            <small style="display: block; font-size: 10px; color: var(--muted);">${cnt === 1 ? (isEn ? 'action' : 'acción') : (isEn ? 'actions' : 'acciones')}</small>
          </div>
        </div>
      `;
    }).join('') : `<p class="hint">${isEn ? 'No individual actions recorded in this sector' : 'Sin acciones individuales registradas en este sector'}</p>`;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog-box" style="max-width: 380px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <span style="font-size: 10.5px; font-weight: 800; color: var(--cyan); text-transform: uppercase;">${isEn ? 'TACTICAL SECTOR DETAILS' : 'DETALLE DE ZONA TÁCTICA'}</span>
            <h3 style="margin: 2px 0 0; font-size: 17px; font-weight: 900;">${zoneName}</h3>
          </div>
          <span style="font-size: 20px; font-weight: 900; color: #facc15; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.35); padding: 4px 10px; border-radius: 10px;">${total}</span>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          ${isEn ? `Breakdown of ${total} action(s) performed in this area:` : `Desglose de las ${total} acción(es) realizadas en esta zona:`}
        </div>
        <div style="max-height: 48vh; overflow-y: auto; padding-right: 2px;">
          ${actionsHtml}
        </div>
        <button type="button" class="btn block primary" style="margin-top: 16px;" id="btn-close-zone-detail">
          ${t('close', 'Entendido')}
        </button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#btn-close-zone-detail').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }

  window.handlePitchZoneCellClick = function(el) {
    const name = el.getAttribute('data-zone-name') || 'Zona';
    const total = parseInt(el.getAttribute('data-zone-count'), 10) || 0;
    const actionsRaw = el.getAttribute('data-zone-actions') || '{}';
    let actionsMap = {};
    try { actionsMap = JSON.parse(actionsRaw); } catch (e) { actionsMap = {}; }
    if (total > 0) {
      showPitchZoneDetailModal(name, actionsMap, total);
    } else {
      toast(t('noActionsInZone', 'Sin acciones registradas en este sector'), 'info');
    }
  };

  /* Modal de selección visual de jugador con foto y buscador en cuadrícula por equipos */
  function showPlayerPickerModal(currentPlayerId, onSelect) {
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const allPlayers = Store.sortedPlayers();
    const teams = Store.state.teams || [];
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.style.zIndex = '999999';

    function buildGridHtml(searchFilter = '') {
      const q = searchFilter.toLowerCase().trim();
      const filtered = allPlayers.filter(p => {
        if (!q) return true;
        const name = Store.playerName(p).toLowerCase();
        const dorsal = String(p.mainDorsal || '');
        return name.includes(q) || dorsal.includes(q);
      });

      if (filtered.length === 0) {
        return `
          <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 13px;">
            ${isEn ? 'No players found' : 'No se encontraron jugadores'}
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
          <div class="picker-team-group" style="margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 0 4px;">
              <span class="dot" style="background: ${g.team.color || 'var(--cyan)'}; width: 8px; height: 8px; border-radius: 50%;"></span>
              <span style="font-size: 12.5px; font-weight: 800; color: #fff;">${escapeHtml(g.team.name)}</span>
              <span class="badge" style="font-size: 10px; padding: 1px 6px;">${g.players.length}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              ${g.players.map(p => renderPlayerPickerCard(p)).join('')}
            </div>
          </div>
        `;
      });

      if (generalPlayers.length > 0) {
        html += `
          <div class="picker-team-group" style="margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 0 4px;">
              <span>🛡️</span>
              <span style="font-size: 12.5px; font-weight: 800; color: #fff;">${isEn ? 'General / Other' : 'General / Otros'}</span>
              <span class="badge" style="font-size: 10px; padding: 1px 6px;">${generalPlayers.length}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              ${generalPlayers.map(p => renderPlayerPickerCard(p)).join('')}
            </div>
          </div>
        `;
      }

      return html;
    }

    function renderPlayerPickerCard(p) {
      const isSelected = p.id === currentPlayerId;
      const agg = Store.playerAggregate(p.id);
      const rating = Store.calculateMatchRating(agg.totals, p.mainPosition);
      return `
        <div class="player-picker-card" data-pid="${p.id}" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: ${isSelected ? 'rgba(34, 211, 238, 0.16)' : 'var(--surface2)'}; border: 1.5px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}; cursor: pointer; transition: all .15s ease;">
          ${renderAvatar(p, 'sm')}
          <div style="min-width: 0; flex: 1; overflow: hidden;">
            <div style="font-size: 12.5px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p, true))}
            </div>
            <div style="font-size: 10.5px; color: var(--muted); display: flex; align-items: center; gap: 4px;">
              <span>${p.mainPosition || 'JUG'}</span>
              <span>•</span>
              <span style="color: #22d3ee; font-weight: 800;">⭐ ${rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      `;
    }

    dialog.innerHTML = `
      <div class="dialog-box" style="width: 94%; max-width: 520px; max-height: 85vh; padding: 18px; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">${isEn ? 'Select Player' : 'Seleccionar Jugador'}</h3>
          <button type="button" class="icon-btn ghost" id="picker-close-x" style="width: 32px; height: 32px;">${icon('x', 18)}</button>
        </div>

        <div style="margin-bottom: 12px;">
          <input type="text" id="picker-search-input" placeholder="${isEn ? 'Search by name or number...' : 'Buscar por nombre o dorsal...'}" style="width: 100%; padding: 10px 14px; font-size: 13.5px; border-radius: 12px;" autofocus autocomplete="off" />
        </div>

        <div id="picker-grid-list" style="overflow-y: auto; flex: 1; padding-right: 2px;">
          ${buildGridHtml('')}
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const searchInput = dialog.querySelector('#picker-search-input');
    const container = dialog.querySelector('#picker-grid-list');

    function bindCardClicks() {
      container.querySelectorAll('.player-picker-card').forEach(card => {
        card.onclick = () => {
          const pid = card.getAttribute('data-pid');
          dialog.remove();
          if (typeof onSelect === 'function') onSelect(pid);
        };
      });
    }

    bindCardClicks();

    searchInput.addEventListener('input', () => {
      container.innerHTML = buildGridHtml(searchInput.value);
      bindCardClicks();
    });

    dialog.querySelector('#picker-close-x').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }

  /* Modal para editar/indicar la disciplina del jugador manualmente */
  function showEditDisciplineModal(player, onDone) {
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const currentScore = (player.disciplineScore !== undefined && player.disciplineScore !== null) ? player.disciplineScore : 100;
    const bodyHtml = `
      <p style="font-size: 13px; color: var(--muted); margin-bottom: 14px; line-height: 1.5;">
        ${isEn 
          ? 'Set the base discipline rating for this player (0 to 100). Cards and fouls received during matches and trainings will automatically adjust the Fair Play index.' 
          : 'Indica la valoración de disciplina y conducta de este jugador (0 a 100). Las tarjetas y faltas recibidas en partidos y entrenamientos ajustarán automáticamente el índice final de Fair Play.'}
      </p>
      <div style="text-align: center; margin-bottom: 16px;">
        <div id="disp-val-preview" style="font-size: 42px; font-weight: 900; color: #22c55e;">${currentScore}</div>
        <span style="font-size: 12px; color: var(--muted);">${isEn ? 'Base Coach Score' : 'Puntuación Base del Entrenador'}</span>
      </div>
      <div style="margin-bottom: 16px;">
        <input type="range" id="disp-slider" min="0" max="100" value="${currentScore}" style="width: 100%; accent-color: #22c55e;" />
      </div>
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn block primary" id="btn-save-disp">${isEn ? 'Save Discipline' : 'Guardar Disciplina'}</button>
      </div>
    `;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog-box" style="max-width: 380px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">🧠 ${isEn ? 'Adjust Discipline' : 'Ajustar Disciplina'}</h3>
          <button type="button" class="icon-btn ghost" id="disp-close-x" style="width: 32px; height: 32px;">${icon('x', 18)}</button>
        </div>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(dialog);

    const slider = dialog.querySelector('#disp-slider');
    const preview = dialog.querySelector('#disp-val-preview');
    slider.oninput = () => {
      preview.textContent = slider.value;
    };

    dialog.querySelector('#btn-save-disp').onclick = () => {
      Store.setPlayerDiscipline(player.id, parseInt(slider.value, 10));
      dialog.remove();
      toast(isEn ? 'Discipline updated' : 'Disciplina actualizada', 'success');
      if (typeof onDone === 'function') onDone();
    };
    dialog.querySelector('#disp-close-x').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }

  /* =========================================================
     MAPA DE CALOR DE ZONAS EN EL PERFIL DEL JUGADOR
     ========================================================= */
  function renderPlayerPitchHeatmapHtml(playerId, customSessions) {
    const sessions = customSessions || Store.state.sessions || [];
    const playerZones = [];
    sessions.forEach(s => {
      (s.zones || []).forEach(z => {
        if (z.p === playerId) playerZones.push(z);
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
      counts[z.z] = (counts[z.z] || 0) + 1;
      let areaKey = 'mid_b';
      if (z.z === 3) areaKey = 'top_l';
      else if (z.z === 1) areaKey = 'top_c';
      else if (z.z === 4) areaKey = 'top_r';
      else if (z.z === 7 || z.z === 10) areaKey = 'wing_l';
      else if (z.z === 2) areaKey = 'mid_t';
      else if (z.z === 8 || z.z === 11) areaKey = 'wing_r';
      else if (z.z === 5 || z.z === 6) areaKey = 'mid_b';

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
      const st = Store.STAT_MAP[topKey] || { emoji: '⚽', short: topKey };
      const shortName = st.short || st.label || topKey;
      return `<span class="zone-top-action-badge">${st.emoji || '⚽'} ${escapeHtml(shortName)}: ${topCnt}</span>`;
    };

    return `
      <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 8px; text-align: center;">
        ${total > 0 ? `<b>${total}</b> ${t('actions', 'acciones')} tácticas geolocalizadas • <span style="color: var(--cyan);">Toca cualquier zona para ver detalles</span>` : 'Sin registros de zonas aún'}
      </div>
      <div class="pitch-field-grid" style="max-width: 290px; height: 230px; margin: 0 auto;">
        <!-- Fila 1: Ataque -->
        <div class="pitch-grid-cell pz-top-l ${cntTopL > 0 ? 'has-actions' : ''}" style="grid-area: top_l; background: ${getHeatBg(cntTopL)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_l', 'Banda Ofensiva Izquierda')}" data-zone-count="${cntTopL}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_l)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">↖️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntTopL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_l')}</span>
        </div>
        <div class="pitch-grid-cell pz-top-c ${cntTopC > 0 ? 'has-actions' : ''}" style="grid-area: top_c; background: ${getHeatBg(cntTopC)}; border-color: rgba(239, 68, 68, 0.8); cursor: pointer;" data-zone-name="${t('zone_box_opp', 'Área Rival')}" data-zone-count="${cntTopC}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_c)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🥅</span>
          <span style="font-size: 14px; font-weight: 900; color: #fde047;">${cntTopC}</span>
          <span style="font-size: 9px; opacity: 0.9;">${t('zone_box_opp')}</span>
        </div>
        <div class="pitch-grid-cell pz-top-r ${cntTopR > 0 ? 'has-actions' : ''}" style="grid-area: top_r; background: ${getHeatBg(cntTopR)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_r', 'Banda Ofensiva Derecha')}" data-zone-count="${cntTopR}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">↗️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntTopR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_r')}</span>
        </div>

        <!-- Fila 2-3: Bandas unidas laterales -->
        <div class="pitch-grid-cell pz-wing-l ${cntWingL > 0 ? 'has-actions' : ''}" style="grid-area: wing_l; background: ${getHeatBg(cntWingL)}; cursor: pointer;" data-zone-name="${t('zone_wing_l', 'Banda Izquierda')}" data-zone-count="${cntWingL}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_l)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⬅️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntWingL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_l')}</span>
        </div>

        <!-- Fila 2 Centro: Frontal del Área -->
        <div class="pitch-grid-cell pz-mid-t ${cntMidT > 0 ? 'has-actions' : ''}" style="grid-area: mid_t; background: ${getHeatBg(cntMidT)}; cursor: pointer;" data-zone-name="${t('zone_front', 'Frontal del Área')}" data-zone-count="${cntMidT}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_t)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🎯</span>
          <span style="font-size: 13px; font-weight: 900;">${cntMidT}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_front')}</span>
        </div>

        <div class="pitch-grid-cell pz-wing-r ${cntWingR > 0 ? 'has-actions' : ''}" style="grid-area: wing_r; background: ${getHeatBg(cntWingR)}; cursor: pointer;" data-zone-name="${t('zone_wing_r', 'Banda Derecha')}" data-zone-count="${cntWingR}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">➡️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntWingR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_r')}</span>
        </div>

        <!-- Fila 3 Centro: Centro del Campo -->
        <div class="pitch-grid-cell pz-mid-b ${cntMidB > 0 ? 'has-actions' : ''}" style="grid-area: mid_b; background: ${getHeatBg(cntMidB)}; cursor: pointer;" data-zone-name="${t('zone_mid', 'Centro del Campo')}" data-zone-count="${cntMidB}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_b)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⚽</span>
          <span style="font-size: 13px; font-weight: 900;">${cntMidB}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_mid')}</span>
        </div>
      </div>
    `;
  }

  /* =========================================================
     GRÁFICA DE EVOLUCIÓN TEMPORAL (TIMELINE PROGRESS)
     ========================================================= */
  function renderTimelineSVG(points) {
    if (!points || points.length < 2) {
      return `<div style="text-align: center; color: var(--muted); padding: 14px 10px; font-size: 12px;">Se necesitan al menos 2 sesiones registradas para trazar la línea de evolución.</div>`;
    }

    const W = 320, H = 120, padX = 26, padY = 20;
    const vals = points.map(p => p.val);
    const minVal = Math.max(1, Math.min(...vals) - 0.5);
    const maxVal = Math.min(10, Math.max(...vals) + 0.5);
    const range = (maxVal - minVal) || 1;

    const pts = points.map((p, idx) => {
      const x = padX + (idx / (points.length - 1)) * (W - padX * 2);
      const y = H - padY - ((p.val - minVal) / range) * (H - padY * 2);
      return { x, y, p };
    });

    const polylineStr = pts.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const areaStr = `${pts[0].x},${H - padY} ${polylineStr} ${pts[pts.length - 1].x},${H - padY}`;

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width: 100%; height: auto; max-height: 140px; overflow: visible;">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <line x1="${padX}" y1="${H - padY}" x2="${W - padX}" y2="${H - padY}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <polygon points="${areaStr}" fill="url(#trendGrad)"/>
        <polyline points="${polylineStr}" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map(pt => `
          <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4" fill="#22d3ee" stroke="#060a13" stroke-width="2"/>
          <text x="${pt.x.toFixed(1)}" y="${(pt.y - 6).toFixed(1)}" font-size="10" fill="#f8fafc" font-weight="800" text-anchor="middle">${pt.p.val}</text>
          <text x="${pt.x.toFixed(1)}" y="${(H - 4).toFixed(1)}" font-size="8.5" fill="var(--muted)" font-weight="600" text-anchor="middle">${pt.p.date ? pt.p.date.slice(5) : ''}</text>
        `).join('')}
      </svg>
    `;
  }

  function renderH2HSymmetricalRadarSVG(rd, mainColor = '#22d3ee') {
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const isEe = (Store.state.settings && Store.state.settings.lang === 'ee');
    const axesLabels = {
      en: { pas: 'PASS', tir: 'SHOT', reg: 'DRIB', fis: 'PHYS', def: 'DEF' },
      ee: { pas: 'SÖÖT', tir: 'LÖÖK', reg: 'TRIB', fis: 'FÜÜS', def: 'KAIT' },
      es: { pas: 'PASE', tir: 'TIRO', reg: 'REG',  fis: 'FÍS',  def: 'DEF' }
    };
    const lang = isEn ? 'en' : (isEe ? 'ee' : 'es');
    const langLabels = axesLabels[lang];
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
        <g>
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

    const gradId = 'h2hCoachRadarGrad_' + mainColor.replace(/[^a-zA-Z0-9]/g, '');

    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; margin: 0; padding: 0;">
        <svg class="radar-svg" viewBox="0 0 260 260" style="width: 100%; aspect-ratio: 1 / 1; max-width: 220px; height: auto; display: block;">
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

  /* =========================================================
     MODAL COMPARADOR CARA A CARA (HEAD-TO-HEAD)
     ========================================================= */
  function showHeadToHeadModal(p1Id, p2Id) {
    const allPlayers = Store.sortedPlayers();
    if (allPlayers.length < 2) {
      toast('Se necesitan al menos 2 jugadores creados para comparar', 'error');
      return;
    }
    let id1 = p1Id || allPlayers[0].id;
    let id2 = p2Id || (allPlayers[1] ? allPlayers[1].id : allPlayers[0].id);
    if (id1 === id2 && allPlayers.length > 1) {
      id2 = allPlayers.find(p => p.id !== id1).id;
    }
    let selectedScope = 'global';

    openSheet(t('headToHead'), (body) => {
      function renderH2H() {
        const sessionSubset = (selectedScope === 'global') ? null : [Store.session(selectedScope)].filter(Boolean);
        const data = Store.comparePlayers(id1, id2, sessionSubset);
        if (!data) return;
        const { p1, p2, rating1, rating2, metrics } = data;

        const allSessions = (Store.state.sessions || []).slice().sort((a, b) => {
          return (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''));
        });

        const bothTrackedSessions = allSessions.filter(s => {
          const has1 = s.stats && s.stats[id1] && Object.values(s.stats[id1]).some(v => v > 0);
          const has2 = s.stats && s.stats[id2] && Object.values(s.stats[id2]).some(v => v > 0);
          return has1 && has2;
        });

        const curSession = (selectedScope !== 'global') ? Store.session(selectedScope) : null;
        const p1HasSessionStats = curSession && curSession.stats && curSession.stats[id1] && Object.values(curSession.stats[id1]).some(v => v > 0);
        const p2HasSessionStats = curSession && curSession.stats && curSession.stats[id2] && Object.values(curSession.stats[id2]).some(v => v > 0);

        // Estadísticas de duelos 1v1 y radares bayesianos
        const d1 = Store.getPlayer1v1Stats(id1, sessionSubset);
        const d2 = Store.getPlayer1v1Stats(id2, sessionSubset);
        const r1 = Store.calculatePlayerRadar(id1, sessionSubset);
        const r2 = Store.calculatePlayerRadar(id2, sessionSubset);
        const prob = Store.calculate1v1WinProbability(p1, p2, r1, r2, d1, d2);

        body.innerHTML = `
          <div class="h2h-wrapper">
            <!-- Selector de Ámbito / Scope (Global vs Sesión/Partido específico) -->
            <div style="margin-bottom: 14px; background: var(--bg2); padding: 12px; border-radius: 14px; border: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="h2h-scope-select" style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">
                  🎯 ${t('h2hScopeLabel', 'Comparar en base a:')}
                </label>
                ${bothTrackedSessions.length > 0 ? `
                  <span style="font-size: 11px; color: #86efac; font-weight: 700; background: rgba(34, 197, 94, 0.15); padding: 2px 8px; border-radius: 10px;">
                    👥 ${bothTrackedSessions.length} partidos juntos
                  </span>
                ` : ''}
              </div>
              <select id="h2h-scope-select" class="input" style="width: 100%; font-size: 13px; font-weight: 700; background: var(--surface); color: #fff; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 9px 12px;">
                <option value="global" ${selectedScope === 'global' ? 'selected' : ''}>
                  🌐 ${t('h2hScopeGlobal', 'Historial Global (Todas las sesiones acumuladas)')}
                </option>
                ${allSessions.length > 0 ? `
                  <optgroup label="${t('h2hGroupSessions', 'Partidos y Entrenamientos')}">
                    ${allSessions.map(s => {
                      const has1 = s.stats && s.stats[id1] && Object.values(s.stats[id1]).some(v => v > 0);
                      const has2 = s.stats && s.stats[id2] && Object.values(s.stats[id2]).some(v => v > 0);
                      const both = has1 && has2;
                      let badge = '';
                      if (both) badge = '👥 Ambos seguidos';
                      else if (has1) badge = `👤 Solo ${Store.playerName(p1)}`;
                      else if (has2) badge = `👤 Solo ${Store.playerName(p2)}`;
                      else badge = '⚪ Sin seguimiento';

                      const sTitle = Store.sessionTitle(s);
                      const iconType = s.type === 'match' ? '🏆' : '⚽';
                      return `<option value="${s.id}" ${selectedScope === s.id ? 'selected' : ''}>${iconType} ${s.date} • ${escapeHtml(sTitle)} [${badge}]</option>`;
                    }).join('')}
                  </optgroup>
                ` : ''}
              </select>
              ${curSession ? `
                <div style="margin-top: 8px; font-size: 11.5px; padding: 6px 10px; border-radius: 8px; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: var(--muted);">Evento: <b>${escapeHtml(Store.sessionTitle(curSession))}</b></span>
                  ${p1HasSessionStats && p2HasSessionStats 
                    ? '<span style="color: #86efac; font-weight: 800;">✓ Datos de ambos</span>'
                    : (!p1HasSessionStats && !p2HasSessionStats
                      ? '<span style="color: #fca5a5; font-weight: 800;">⚠️ Sin datos registrados</span>'
                      : `<span style="color: #fde047; font-weight: 800;">⚠️ Incompleto</span>`)}
                </div>
              ` : ''}
            </div>

            <div class="h2h-header" style="margin-bottom: 14px;">
              <!-- Jugador 1 -->
              <div class="h2h-player-col">
                ${renderAvatar(p1, 'md')}
                <button type="button" class="h2h-player-btn" id="btn-pick-h2h-p1" title="Cambiar jugador 1">
                  <span style="color: #22d3ee; font-weight: 800; font-size: 13px;">${escapeHtml(Store.playerName(p1))} ▾</span>
                </button>
                <div class="rating-pill" style="border-color: #22d3ee; color: #22d3ee; background: rgba(34, 211, 238, .15);">
                  ⭐ ${rating1.toFixed(1)}
                </div>
              </div>

              <div class="h2h-vs">VS</div>

              <!-- Jugador 2 -->
              <div class="h2h-player-col">
                ${renderAvatar(p2, 'md')}
                <button type="button" class="h2h-player-btn" id="btn-pick-h2h-p2" title="Cambiar jugador 2">
                  <span style="color: #86efac; font-weight: 800; font-size: 13px;">${escapeHtml(Store.playerName(p2))} ▾</span>
                </button>
                <div class="rating-pill" style="border-color: #22c55e; color: #22c55e; background: rgba(34, 197, 94, .15);">
                  ⭐ ${rating2.toFixed(1)}
                </div>
              </div>
            </div>

            <!-- 🔮 PREDICCIÓN ANALÍTICA DE VICTORIA EN 1v1 -->
            <div class="card" style="margin-bottom: 14px; padding: 14px; border: 1.5px solid rgba(168, 85, 247, 0.45); background: linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%); border-radius: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 900; color: #c084fc; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                  <span>🔮</span> <span>${t('prob1v1Title', 'Probabilidad Victoria 1v1')}</span>
                </span>
                ${prob.favorite ? `
                  <span class="badge" style="background: ${prob.favorite === 1 ? 'rgba(34, 211, 238, 0.2)' : 'rgba(134, 239, 172, 0.2)'}; color: ${prob.favorite === 1 ? '#22d3ee' : '#86efac'}; border: 1px solid ${prob.favorite === 1 ? '#22d3ee' : '#86efac'}; font-size: 10.5px; font-weight: 800; padding: 2px 7px;">
                    ⭐ Favorito: ${(prob.favorite === 1 ? p1.name : p2.name).split(' ')[0]}
                  </span>
                ` : `
                  <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; font-size: 10.5px; font-weight: 800; padding: 2px 7px;">
                    ⚖️ Muy Equilibrado
                  </span>
                `}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                <div style="font-size: 26px; font-weight: 900; color: #22d3ee;">${prob.prob1}%</div>
                <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-align: center;">
                  ${prob.ageDiffText ? `<span>🎂 ${prob.ageDiffText}</span>` : 'Datos Bayes + 1v1 + Edad'}
                </div>
                <div style="font-size: 26px; font-weight: 900; color: #86efac;">${prob.prob2}%</div>
              </div>

              <!-- Barra de Probabilidad 1v1 -->
              <div style="height: 10px; width: 100%; background: #86efac; border-radius: 999px; overflow: hidden; display: flex; box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);">
                <div style="width: ${prob.prob1}%; background: #22d3ee; height: 100%;"></div>
              </div>

              ${prob.reasons.length > 0 ? `
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;">
                  ${prob.reasons.map(r => `
                    <span class="badge" style="background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); font-size: 10px; font-weight: 700; padding: 2px 6px;">
                      ✓ ${escapeHtml(r)}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <!-- ⚔️ DUELOS 1v1 HISTÓRICOS -->
            <div class="card" style="margin-bottom: 14px; padding: 14px; border: 1.5px solid var(--border); display: flex; flex-direction: column; gap: 8px; border-radius: 14px; background: var(--bg2);">
              <div style="font-size: 12px; font-weight: 900; color: #fb923c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
                ⚔️ ${t('duels1v1', 'Duelos 1v1')} (Histórico)
              </div>
              ${renderCoachH2HMetricRow(t('duels1v1WinRate', '% Victorias 1v1'), `${d1.winRate}%`, `${d2.winRate}%`, '🏆')}
              ${renderCoachH2HMetricRow(t('duels1v1Won', 'Duelos Ganados'), d1.won, d2.won, '⚔️')}
              ${renderCoachH2HMetricRow(t('duels1v1Lost', 'Duelos Perdidos'), d1.lost, d2.lost, '❌')}
              ${renderCoachH2HMetricRow(t('duel1v1Goals', 'Goles en 1v1'), d1.wonGoal, d2.wonGoal, '⚽')}
              ${renderCoachH2HMetricRow(t('duel1v1Stops', 'Robos / Cierres'), d1.wonStop, d2.wonStop, '🛡️')}
            </div>

            <!-- Radares comparativos 100% simétricos -->
            <div class="section-title" style="margin-top: 6px; margin-bottom: 8px;"><span>${t('comparativeRadars', 'Comparative Skill Radars')}</span></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: stretch; margin-bottom: 14px;">
              <div class="card" style="margin: 0 !important; margin-top: 0 !important; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; border: 1.5px solid rgba(34, 211, 238, 0.35); border-radius: 14px; height: 100%; box-sizing: border-box; background: var(--bg2);">
                <b style="font-size: 12.5px; color: #22d3ee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; height: 20px; line-height: 20px; display: block; margin-bottom: 4px;">
                  ${escapeHtml(Store.playerName(p1))}
                </b>
                ${renderH2HSymmetricalRadarSVG(r1, '#22d3ee')}
              </div>
              <div class="card" style="margin: 0 !important; margin-top: 0 !important; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; border: 1.5px solid rgba(134, 239, 172, 0.35); border-radius: 14px; height: 100%; box-sizing: border-box; background: var(--bg2);">
                <b style="font-size: 12.5px; color: #86efac; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; height: 20px; line-height: 20px; display: block; margin-bottom: 4px;">
                  ${escapeHtml(Store.playerName(p2))}
                </b>
                ${renderH2HSymmetricalRadarSVG(r2, '#86efac')}
              </div>
            </div>

            <!-- Métricas comparativas -->
            <div style="font-size: 12px; font-weight: 900; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              📊 ${t('performanceMetrics', 'Métricas de Rendimiento')}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${metrics.map(m => {
                const v1 = m.v1 || 0;
                const v2 = m.v2 || 0;
                const sum = v1 + v2;
                let pct1 = 50, pct2 = 50;
                if (sum > 0) {
                  pct1 = Math.round((v1 / sum) * 100);
                  pct2 = 100 - pct1;
                }
                const p1Wins = v1 > v2;
                const p2Wins = v2 > v1;
                const label = t(m.labelKey, m.key);
                return `
                  <div class="h2h-metric-row">
                    <div class="h2h-labels">
                      <span style="color: ${p1Wins ? '#22d3ee' : 'var(--text)'}; font-weight: ${p1Wins ? '900' : '700'};">
                        ${v1}${m.suffix} ${p1Wins ? '👑' : ''}
                      </span>
                      <span class="h2h-metric-title">${label}</span>
                      <span style="color: ${p2Wins ? '#86efac' : 'var(--text)'}; font-weight: ${p2Wins ? '900' : '700'};">
                        ${p2Wins ? '👑' : ''} ${v2}${m.suffix}
                      </span>
                    </div>
                    <div class="h2h-bars">
                      <div class="h2h-bar-p1" style="width: ${pct1}%;"></div>
                      <div class="h2h-bar-p2" style="width: ${pct2}%; background: #86efac;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

        function renderCoachH2HMetricRow(label, v1, v2, iconStr) {
          const num1 = parseFloat(String(v1).replace(/[^0-9.]/g, '')) || 0;
          const num2 = parseFloat(String(v2).replace(/[^0-9.]/g, '')) || 0;
          const c1 = num1 > num2 ? '#22d3ee' : (num1 < num2 ? 'var(--text)' : '#94a3b8');
          const c2 = num2 > num1 ? '#86efac' : (num2 < num1 ? 'var(--text)' : '#94a3b8');
          return `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12.5px; font-weight: 800;">
              <div style="color: ${c1}; text-align: right; font-size: 14px;">${v1} ${num1 > num2 ? '👑' : ''}</div>
              <div style="padding: 0 10px; color: var(--muted); font-size: 11px; text-align: center; text-transform: uppercase;">
                ${iconStr ? iconStr + ' ' : ''}${label}
              </div>
              <div style="color: ${c2}; text-align: left; font-size: 14px;">${num2 > num1 ? '👑 ' : ''}${v2}</div>
            </div>
          `;
        }

        const scopeSelect = body.querySelector('#h2h-scope-select');
        if (scopeSelect) {
          scopeSelect.onchange = (e) => {
            selectedScope = e.target.value;
            renderH2H();
          };
        }

        body.querySelector('#btn-pick-h2h-p1').onclick = () => {
          showPlayerPickerModal(id1, (newId) => {
            id1 = newId;
            renderH2H();
          });
        };
        body.querySelector('#btn-pick-h2h-p2').onclick = () => {
          showPlayerPickerModal(id2, (newId) => {
            id2 = newId;
            renderH2H();
          });
        };
      }

      renderH2H();
    }, (foot) => {
      foot.innerHTML = `<button class="btn block ghost" id="btn-close-h2h">${t('cancel')}</button>`;
      foot.querySelector('#btn-close-h2h').onclick = closeSheet;
    });
  }

  /* =========================================================
     MODAL DE FICHA DE PARTIDO / MATCH CARD (DESCARGABLE Y WHATSAPP)
     ========================================================= */
  /* =========================================================
     MODAL DE FICHA DE JUGADOR (DESCARGABLE Y WHATSAPP)
     ========================================================= */
  function showPlayerCardModal(player, session) {
    if (!player) return;
    const sess = session || (Store.state.sessions.length > 0 ? Store.state.sessions[0] : null);
    const st = sess ? (sess.stats[player.id] || {}) : Store.playerAggregate(player.id, Store.state.sessions).totals;
    const rating = Store.calculateMatchRating(st, player.mainPosition);
    const radar = Store.calculatePlayerRadar(player.id);
    const team = Store.team(player.teamId);
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');

    openSheet(t('playerCardTitle', 'Ficha de Jugador'), (body) => {
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 12px;">
          <div id="match-card-loading" style="padding: 20px; color: var(--muted);">${t('generatingCard')}</div>
          <canvas id="match-card-canvas" width="600" height="850" style="display: none;"></canvas>
          <img id="match-card-preview" style="display: none; width: 100%; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 10px;" />
        </div>

        <div style="margin-bottom: 12px;">
          <button id="btn-download-match-card" class="btn primary block" style="text-align: center; margin-bottom: 10px;">
            ${icon('download', 18)} ${t('downloadCard', 'Descargar Ficha (PNG)')}
          </button>

          <div style="font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 6px; text-align: left;">
            ${t('shareCardWithImage', 'COMPARTIR FICHA CON IMAGEN PNG:')}
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
            <button class="btn btn-social" id="btn-share-wa" style="background: #16a34a; color: #fff; border-color: #22c55e;">
              ${icon('whatsapp', 18)} WhatsApp
            </button>
            <button class="btn btn-social" id="btn-share-tg" style="background: #0284c7; color: #fff; border-color: #38bdf8;">
              ${icon('send', 18)} Telegram
            </button>
            <button class="btn btn-social" id="btn-share-all" style="background: var(--surface2); color: #fff;">
              ${icon('share', 18)} ${t('shareGeneric', 'Más...')}
            </button>
          </div>

          <button class="btn block secondary" id="btn-share-guide" style="margin-top: 8px;">
            📘 ${t('downloadSkillGuide', 'Descargar / Compartir Guía de Habilidades (PNG)')}
          </button>
        </div>
      `;

      const canvas = body.querySelector('#match-card-canvas');
      const imgPreview = body.querySelector('#match-card-preview');
      const loadEl = body.querySelector('#match-card-loading');
      const downBtn = body.querySelector('#btn-download-match-card');

      setTimeout(() => {
        const ctx = canvas.getContext('2d');
        if (!ctx.roundRect) {
          ctx.roundRect = function(x, y, w, h, r) {
            let radius = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
            if (radius < 0) radius = 0;
            this.moveTo(x + radius, y);
            this.lineTo(x + w - radius, y);
            this.quadraticCurveTo(x + w, y, x + w, y + radius);
            this.lineTo(x + w, y + h - radius);
            this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            this.lineTo(x + radius, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - radius);
            this.lineTo(x, y + radius);
            this.quadraticCurveTo(x, y, x + radius, y);
          };
        }
        const W = 600, H = 850;

        // Función que dibuja el contenido tras resolver la foto del jugador
        const renderCanvasContent = (avatarImg) => {
          // Fondo degradado futurista
          const grad = ctx.createLinearGradient(0, 0, 0, H);
          grad.addColorStop(0, '#0b1329');
          grad.addColorStop(0.5, '#070b18');
          grad.addColorStop(1, '#020617');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          // Borde cian neón
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 3;
          ctx.strokeRect(12, 12, W - 24, H - 24);

          // Encabezado alineado a la izquierda para no solapar la medalla de valoración
          ctx.textAlign = 'left';
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 12px system-ui';
          ctx.fillText(isEn ? 'PLAYER STATS • OFFICIAL SCOUT CARD' : 'ESTADÍSTICAS JUGADORES • FICHA OFICIAL', 28, 42);

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 12px system-ui';
          const subText = sess ? `${Store.sessionTitle(sess)} • ${sess.date}` : (isEn ? 'OVERALL ALL-TIME PERFORMANCE' : 'RENDIMIENTO GENERAL GLOBAL');
          ctx.fillText(subText, 28, 62);

          // Medalla de Rating (esquina superior derecha, posición limpia y sin colisión)
          ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(476, 28, 96, 42, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 20px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(`⭐ ${rating.toFixed(1)}`, 524, 56);

          // Foto del Jugador (o Inicial en círculo con clip)
          if (avatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(W / 2, 145, 48, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, W / 2 - 48, 145 - 48, 96, 96);
            ctx.restore();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(W / 2, 145, 48, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(W / 2, 145, 48, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText((player.name ? player.name[0] : 'J').toUpperCase(), W / 2, 158);
          }

          // Nombre y Posición
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 26px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(Store.playerName(player).toUpperCase(), W / 2, 224);

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 15px system-ui';
          const posLabel = player.mainPosition || (isEn ? 'PLAYER' : 'JUGADOR');
          ctx.fillText(`#${player.mainDorsal != null ? player.mainDorsal : '-'} • ${posLabel}${team ? ' • ' + team.name.toUpperCase() : ''}`, W / 2, 248);

          // Radar Chart en Canvas (Pentágono de 5 cualidades deportivas)
          const rcx = W / 2, rcy = 375, rr = 75;
          const rAxes = [
            { l: 'PAS', v: radar.pas },
            { l: isEn ? 'SHT' : 'TIR', v: radar.tir },
            { l: isEn ? 'DRI' : 'REG', v: radar.reg },
            { l: isEn ? 'PHY' : 'FÍS', v: radar.fis },
            { l: 'DEF', v: radar.def }
          ];

          // Redes concéntricas pentagonales
          [0.33, 0.66, 1.0].forEach(factor => {
            ctx.beginPath();
            rAxes.forEach((_, i) => {
              const angle = -Math.PI / 2 + i * (2 * Math.PI / 5);
              const x = rcx + rr * factor * Math.cos(angle);
              const y = rcy + rr * factor * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
          });

          // Polígono del jugador
          ctx.beginPath();
          rAxes.forEach((a, i) => {
            const angle = -Math.PI / 2 + i * (2 * Math.PI / 5);
            const ratio = Math.max(0.2, a.v / 100);
            const x = rcx + rr * ratio * Math.cos(angle);
            const y = rcy + rr * ratio * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(34, 211, 238, 0.4)';
          ctx.fill();
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Etiquetas del radar
          rAxes.forEach((a, i) => {
            const angle = -Math.PI / 2 + i * (2 * Math.PI / 5);
            const lx = rcx + (rr + 20) * Math.cos(angle);
            const ly = rcy + (rr + 20) * Math.sin(angle);
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${a.l} ${a.v}`, lx, ly);
          });

          // Insignia de Disciplina & Fair Play en Canvas
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(W / 2 - 120, 472, 240, 26, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#86efac';
          ctx.font = 'bold 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(`FAIR PLAY / DISCIPLINA: ${radar.dis || 100} / 99`, W / 2, 489);

          // 6 Tarjetas de Estadísticas clave
          const totPass = (st.passOk || 0) + (st.passKo || 0);
          const passPct = totPass > 0 ? Math.round(((st.passOk || 0) / totPass) * 100) + '%' : '-';
          const statsCards = [
            { l: isEn ? 'GOALS' : 'GOLES', v: st.goal || 0, c: '#facc15' },
            { l: isEn ? 'SHOTS ON TARGET' : 'TIROS PUERTA', v: st.shotOn || 0, c: '#06b6d4' },
            { l: isEn ? 'PASS ACCURACY' : 'PRECISIÓN PASE', v: passPct, c: '#22c55e' },
            { l: isEn ? 'ASSISTS' : 'ASISTENCIAS', v: st.assist || 0, c: '#a855f7' },
            { l: isEn ? 'RECOVERIES' : 'RECUPERACIONES', v: st.recovery || 0, c: '#3b82f6' },
            { l: isEn ? 'BALL TOUCHES' : 'TOQUES BALÓN', v: st.touches || 0, c: '#94a3b8' }
          ];

          statsCards.forEach((sc, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const bx = 45 + col * 260;
            const by = 520 + row * 82;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx, by, 245, 68, 12);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(sc.l, bx + 16, by + 28);

            ctx.fillStyle = sc.c;
            ctx.font = 'bold 24px system-ui';
            ctx.fillText(String(sc.v), bx + 16, by + 56);
          });

          // Pie de tarjeta
          ctx.fillStyle = '#475569';
          ctx.font = '11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('SCOUTING & DATA ANALYSIS REPORT • PROPRIETARY SYSTEM', W / 2, 810);

          const dataUrl = canvas.toDataURL('image/png');
          imgPreview.src = dataUrl;
          imgPreview.style.display = 'block';
          loadEl.style.display = 'none';

          downBtn.onclick = (e) => {
            e.preventDefault();
            const filename = `Ficha_${(player.name || 'jugador').replace(/[^a-zA-Z0-9_]/g, '_')}.png`;
            if (window.AndroidBridge && window.AndroidBridge.saveImage) {
              window.AndroidBridge.saveImage(dataUrl, filename);
            } else {
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              toast(t('cardSavedGallery', 'Ficha guardada en galería'), 'success');
            }
          };

          const pName = Store.playerName(player);
          const filename = `Ficha_${(player.name || 'jugador').replace(/[^a-zA-Z0-9_]/g, '_')}.png`;
          const shareText = `⚽ *${t('playerCardTitle', 'Ficha de Jugador')}: ${pName}*\n` +
            `⭐ Nota Media: ${rating.toFixed(1)}/10\n` +
            `📊 Radar: Pase ${radar.pas} | Tiro ${radar.tir} | Regate ${radar.reg} | Físico ${radar.fis} | Defensa ${radar.def} | Disciplina ${radar.dis}\n` +
            `🥅 Goles: ${st.goal || 0} | 🎯 Tiros: ${st.shotOn || 0} | 👟 Pase: ${passPct}\n\n` +
            `Estadísticas Jugadores`;

          function handleSocialShare(targetApp) {
            if (window.AndroidBridge && window.AndroidBridge.shareImage) {
              window.AndroidBridge.shareImage(dataUrl, filename, targetApp, shareText);
            } else {
              if (targetApp === 'whatsapp') {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
              } else if (targetApp === 'telegram') {
                window.open(`https://t.me/share/url?url=${encodeURIComponent('https://streetoh.github.io/Player_Stats/jugadores.html')}&text=${encodeURIComponent(shareText)}`, '_blank');
              } else {
                if (navigator.share) {
                  navigator.share({ title: pName, text: shareText }).catch(() => {});
                } else {
                  prompt('Copia este texto para compartir:', shareText);
                }
              }
            }
          }

          body.querySelector('#btn-share-wa').onclick = () => handleSocialShare('whatsapp');
          body.querySelector('#btn-share-tg').onclick = () => handleSocialShare('telegram');
          body.querySelector('#btn-share-all').onclick = () => handleSocialShare('all');
          body.querySelector('#btn-share-guide').onclick = () => showSkillGuideModal();
        };

        // Si el jugador tiene foto, cargarla como imagen HTML antes de pintar (con soporte para caché IndexedDB)
        const prepareAndRender = (photoSrc) => {
          if (photoSrc) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => renderCanvasContent(img);
            img.onerror = () => renderCanvasContent(null);
            img.src = photoSrc;
          } else {
            renderCanvasContent(null);
          }
        };

        if (player.photo) {
          prepareAndRender(player.photo);
        } else if (player.photoHash && window.CacheDB && window.CacheDB.getPhoto) {
          window.CacheDB.getPhoto(player.id).then(cached => {
            if (cached && cached.dataUrl) {
              player.photo = cached.dataUrl;
              prepareAndRender(player.photo);
            } else {
              prepareAndRender(null);
            }
          }).catch(() => prepareAndRender(null));
        } else {
          prepareAndRender(null);
        }
      }, 50);
    });
  }

  // Alias para mantener compatibilidad con llamadas existentes
  const showMatchCardModal = showPlayerCardModal;

  /* =========================================================
     MODAL DE GUÍA TÁCTICA DE HABILIDADES (DESCARGABLE Y COMPARTIBLE)
     ========================================================= */
  function showSkillGuideModal() {
    const isEn = (Store.state.settings.lang === 'en');
    openSheet(t('downloadSkillGuide', 'Guía de Habilidades'), (body) => {
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 12px;">
          <div id="guide-loading" style="padding: 20px; color: var(--muted);">${t('generatingCard')}</div>
          <canvas id="guide-canvas" width="600" height="850" style="display: none;"></canvas>
          <img id="guide-preview" style="display: none; width: 100%; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 10px;" />
        </div>

        <button id="btn-guide-download" class="btn primary block" style="margin-bottom: 10px;">
          ${icon('download', 18)} ${t('downloadCard', 'Descargar Guía (PNG)')}
        </button>

        <div style="font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 6px; text-align: left;">
          COMPARTIR GUÍA CON IMAGEN (PNG):
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button class="btn btn-social" id="btn-guide-wa" style="background: #16a34a; color: #fff; border-color: #22c55e;">
            ${icon('whatsapp', 18)} WhatsApp
          </button>
          <button class="btn btn-social" id="btn-guide-tg" style="background: #0284c7; color: #fff; border-color: #38bdf8;">
            ${icon('send', 18)} Telegram
          </button>
          <button class="btn btn-social" id="btn-guide-all" style="background: var(--surface2); color: #fff;">
            ${icon('share', 18)} ${t('shareGeneric', 'Más...')}
          </button>
        </div>
      `;

      setTimeout(() => {
        const canvas = body.querySelector('#guide-canvas');
        const imgPreview = body.querySelector('#guide-preview');
        const loadEl = body.querySelector('#guide-loading');
        const ctx = canvas.getContext('2d');
        const W = 600, H = 850;

        // Fondo degradado
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0b1329');
        grad.addColorStop(0.5, '#070b18');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 12, W - 24, H - 24);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(isEn ? 'PLAYER STATS • TACTICAL RADAR SKILL GUIDE' : 'ESTADÍSTICAS JUGADORES • GUÍA TÁCTICA DE HABILIDADES', W / 2, 44);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px system-ui';
        ctx.fillText(isEn ? 'TACTICAL SKILLS & PERFORMANCE GUIDE' : 'SIGNIFICADO Y VALORACIÓN DE CUALIDADES', W / 2, 74);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px system-ui';
        ctx.fillText(isEn ? 'Explanation of performance scores and metrics tracked during matches' : 'Explicación del radar de habilidades y métricas registradas en partidos y entrenamientos', W / 2, 96);

        const skills = [
          { k: 'pas', icon: '👟', name: isEn ? 'Passing & Vision (PAS)' : 'Pase y Distribución (PAS)', desc: isEn ? 'Precision in distribution, associative play, low turnover rate on passes and goal assists created.' : 'Precisión en corto y largo, fluidez asociativa, bajo porcentaje de pérdidas y asistencias creadas.' },
          { k: 'tir', icon: '🎯', name: isEn ? 'Shooting & Finishing (SHT)' : 'Tiro y Definición (TIR)', desc: isEn ? 'Finishing accuracy, conversion rate (goals per shots on target) and attacking penalty box danger.' : 'Puntería en lanzamientos, porcentaje de acierto a puerta, goles anotados y peligro en el área rival.' },
          { k: 'reg', icon: '⚡', name: isEn ? 'Dribbling & Skill (DRI)' : 'Regate y Desborde (REG)', desc: isEn ? '1vs1 success, breaking defensive lines, pace changes and beating pressing opponents.' : 'Desequilibrio individual, éxito en el 1 contra 1, cambios de ritmo y superación de líneas rivales.' },
          { k: 'fis', icon: '💪', name: isEn ? 'Physical & Workrate (PHY)' : 'Físico e Intensidad (FÍS)', desc: isEn ? 'Ball disputes, aerial and ground duels won, continuous involvement and total pitch actions.' : 'Intensidad en disputas, duelos aéreos y terrestres ganados, despliegue físico y volumen de toques.' },
          { k: 'def', icon: '🛡️', name: isEn ? 'Defending & Anticipation (DEF)' : 'Defensa y Recuperación (DEF)', desc: isEn ? 'Interceptions in passing lanes, contested ball recoveries, clearances and defensive actions.' : 'Anticipación, balones recuperados, intercepciones defensivas, despejes y solidez sin balón.' },
          { k: 'dis', icon: '🧠', name: isEn ? 'Discipline & Focus (DIS)' : 'Disciplina y Concentración (DIS)', desc: isEn ? 'Composure, tactical discipline, low foul frequency, fair play and avoidance of cards.' : 'Control emocional, juego limpio, bajo número de faltas y ausencia de tarjetas amarillas/rojas.' }
        ];

        skills.forEach((s, i) => {
          const sy = 120 + i * 110;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(36, sy, W - 72, 98, 12);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#22d3ee';
          ctx.font = 'bold 15px system-ui';
          ctx.textAlign = 'left';
          ctx.fillText(`${s.icon} ${s.name}`, 52, sy + 30);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '12px system-ui';
          ctx.fillText(s.desc, 52, sy + 58, W - 104);
        });

        ctx.fillStyle = '#475569';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('SCOUTING & DATA ANALYSIS REPORT • PROPRIETARY SYSTEM', W / 2, 816);

        const dataUrl = canvas.toDataURL('image/png');
        imgPreview.src = dataUrl;
        imgPreview.style.display = 'block';
        loadEl.style.display = 'none';

        const filename = 'Guia_Habilidades_Futbol.png';
        const guideText = '📘 Guía Táctica de Habilidades y Rendimiento - Estadísticas Jugadores';

        body.querySelector('#btn-guide-download').onclick = () => {
          if (window.AndroidBridge && window.AndroidBridge.saveImage) {
            window.AndroidBridge.saveImage(dataUrl, filename);
          } else {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast(t('guideSavedGallery', 'Guía guardada en la galería'), 'success');
          }
        };

        function shareGuide(app) {
          if (window.AndroidBridge && window.AndroidBridge.shareImage) {
            window.AndroidBridge.shareImage(dataUrl, filename, app, guideText);
          } else {
            if (app === 'whatsapp') {
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(guideText)}`, '_blank');
            } else if (app === 'telegram') {
              window.open(`https://t.me/share/url?url=${encodeURIComponent('https://streetoh.github.io/Player_Stats/jugadores.html')}&text=${encodeURIComponent(guideText)}`, '_blank');
            } else {
              if (navigator.share) navigator.share({ title: 'Guía de Habilidades', text: guideText }).catch(() => {});
            }
          }
        }

        body.querySelector('#btn-guide-wa').onclick = () => shareGuide('whatsapp');
        body.querySelector('#btn-guide-tg').onclick = () => shareGuide('telegram');
        body.querySelector('#btn-guide-all').onclick = () => shareGuide('all');
      }, 50);
    }, (foot) => {
      foot.innerHTML = `<button class="btn block ghost" id="btn-guide-close">${t('close', 'Cerrar')}</button>`;
      foot.querySelector('#btn-guide-close').onclick = closeSheet;
    });
  }

  /* =========================================================
     VISTA 2: SESIONES / HISTORIAL
     ========================================================= */
  function renderHistoryView(view) {
    if (window.Store && window.Store.autoCreateTodayScheduledSessions) {
      window.Store.autoCreateTodayScheduledSessions();
    }
    let filter = historyInitialFilter || 'all';
    historyInitialFilter = 'all';

    function build() {
      const list = Store.filterSessions(filter, 'all');
      const todayIso = getTodayIso();
      const todaySessions = list.filter(s => s.date === todayIso);
      const futureSessions = list.filter(s => s.date > todayIso).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const pastSessions = list.filter(s => s.date < todayIso).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      view.innerHTML = `
        <div class="topbar">
          <div>
            <h1>${t('sessions')}</h1>
            <span class="sub">${Store.state.sessions.length} registradas</span>
          </div>
          <div class="row">
            <button class="icon-btn" id="btn-history-export-json" title="${t('exportJSON')}">
              ${icon('file', 20)}
            </button>
            <button class="icon-btn" id="btn-history-export-csv" title="${t('exportCSV')}">
              ${icon('download', 20)}
            </button>
          </div>
        </div>

        <!-- Botones de Acción: Entrenamiento y Partido (movidos desde Inicio) -->
        <div class="hero-cta" style="margin-bottom: 12px;">
          <button class="cta training" id="btn-history-quick-training">
            <div class="cta-ic">⚽</div>
            <div class="plus">${icon('plus', 16)}</div>
            <div>
              <h3>${t('training')}</h3>
              <p>${t('trainingDesc')}</p>
            </div>
          </button>

          <button class="cta match" id="btn-history-quick-match">
            <div class="cta-ic">🏆</div>
            <div class="plus">${icon('plus', 16)}</div>
            <div>
              <h3>${t('match')}</h3>
              <p>${t('matchDesc')}</p>
            </div>
          </button>
        </div>

        <div style="margin-bottom: 14px;">
          <button class="btn block ghost" id="btn-history-join-live" style="border: 1.5px dashed var(--cyan); background: rgba(34, 211, 238, 0.08); color: var(--cyan); font-weight: 800; font-size: 13px; border-radius: 12px; padding: 9px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            ${icon('qr', 16)} <span>${t('joinLive', '📡 Unirse a sesión en vivo')}</span>
          </button>
        </div>

        <div class="segmented" style="margin-bottom: 12px;">
          <button class="${filter === 'all' ? 'active' : ''}" data-f="all">${t('all')}</button>
          <button class="${filter === 'training' ? 'active t-training' : ''}" data-f="training">${t('training')}</button>
          <button class="${filter === 'match' ? 'active t-match' : ''}" data-f="match">${t('match')}</button>
        </div>

        <div id="history-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${list.length === 0 ? `
            <div class="empty">
              <div class="big">📂</div>
              <h3>${t('noSessionsYet')}</h3>
              <p>${t('noSessionsDesc')}</p>
            </div>
          ` : `
            ${todaySessions.length > 0 ? `
              <div style="font-size: 12.5px; font-weight: 800; color: var(--cyan); margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                <span>⚡</span> ${t('todaySessions', 'Sesiones de Hoy')} (${todaySessions.length})
              </div>
              ${todaySessions.map(s => renderSessionItemHtml(s)).join('')}
            ` : `
              <div class="card" style="padding: 14px; text-align: center; color: var(--muted); font-size: 12.5px; margin-bottom: 4px; border: 1px dashed var(--border);">
                📅 ${t('noSessionsToday', 'No hay sesiones programadas para hoy')}
              </div>
            `}

            ${futureSessions.length > 0 ? `
              <div style="font-size: 12.5px; font-weight: 800; color: #a5b4fc; margin-top: 8px; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                <span>📅</span> ${t('futureSessionsTitle', 'Próximas Sesiones')} (${futureSessions.length})
              </div>
              ${futureSessions.map(s => renderSessionItemHtml(s)).join('')}
            ` : ''}

            ${pastSessions.length > 0 ? `
              <details class="card past-convs-details" id="sessions-history-past-accordion" style="margin-top: 8px; padding: 0; border-radius: 14px; overflow: hidden; background: rgba(15, 23, 42, 0.5);" ${(todaySessions.length === 0 && futureSessions.length === 0) ? 'open' : ''}>
                <summary style="cursor: pointer; padding: 12px 14px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
                  <span style="display: flex; align-items: center; gap: 6px; color: #cbd5e1;">
                    📁 ${t('pastSessionsTitle', 'Sesiones de días anteriores')} (${pastSessions.length})
                  </span>
                  <span style="font-size: 11px; color: var(--muted); font-weight: 700;">▼</span>
                </summary>
                <div style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 14px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                  ${pastSessions.map(s => renderSessionItemHtml(s)).join('')}
                </div>
              </details>
            ` : ''}
          `}
        </div>
      `;

      const btnTr = view.querySelector('#btn-history-quick-training');
      if (btnTr) btnTr.onclick = () => showNewSessionModal('training');
      const btnMa = view.querySelector('#btn-history-quick-match');
      if (btnMa) btnMa.onclick = () => showNewSessionModal('match');

      const btnJoin = view.querySelector('#btn-history-join-live');
      if (btnJoin) btnJoin.onclick = () => showLiveSyncModal(null, 'guest');

      view.querySelectorAll('.segmented button').forEach(b => {
        b.onclick = () => {
          filter = b.getAttribute('data-f');
          build();
        };
      });

      view.querySelectorAll('.session-item').forEach(el => {
        el.onclick = () => {
          const sid = el.getAttribute('data-id');
          showSessionDetailModal(sid);
        };
      });

      view.querySelectorAll('.btn-quick-att').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const sid = btn.getAttribute('data-att-sid');
          showSessionAttendanceModal(sid);
        };
      });

      const btnExpJson = view.querySelector('#btn-history-export-json');
      if (btnExpJson) btnExpJson.onclick = () => IO.exportBackup();
      const btnExpCsv = view.querySelector('#btn-history-export-csv');
      if (btnExpCsv) btnExpCsv.onclick = () => IO.exportStatsCSV(list);
    }

    build();
  }

  function renderSessionPlayerZonesHeatmapHtml(session, playerId) {
    const zones = (session.zones || []).filter(z => z.p === playerId);
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
    zones.forEach(z => {
      counts[z.z] = (counts[z.z] || 0) + 1;
      let areaKey = 'mid_b';
      if (z.z === 3) areaKey = 'top_l';
      else if (z.z === 1) areaKey = 'top_c';
      else if (z.z === 4) areaKey = 'top_r';
      else if (z.z === 7 || z.z === 10) areaKey = 'wing_l';
      else if (z.z === 2) areaKey = 'mid_t';
      else if (z.z === 8 || z.z === 11) areaKey = 'wing_r';
      else if (z.z === 5 || z.z === 6) areaKey = 'mid_b';

      zoneActionsMap[areaKey][z.k] = (zoneActionsMap[areaKey][z.k] || 0) + 1;
    });
    const total = zones.length;

    const getHeatBg = (cnt) => {
      if (!cnt) return 'rgba(0, 0, 0, 0.28)';
      const pct = cnt / Math.max(1, total * 0.4);
      if (pct > 0.4) return 'rgba(239, 68, 68, 0.75)';
      if (pct > 0.2) return 'rgba(249, 115, 22, 0.65)';
      return 'rgba(34, 197, 94, 0.55)';
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
      const st = Store.STAT_MAP[topKey] || { emoji: '⚽', short: topKey };
      const shortName = st.short || st.label || topKey;
      return `<span class="zone-top-action-badge">${st.emoji || '⚽'} ${escapeHtml(shortName)}: ${topCnt}</span>`;
    };

    return `
      <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 8px; text-align: center;">
        ${total > 0 ? `<b>${total}</b> ${t('actions', 'acciones')} geolocalizadas • <span style="color: var(--cyan);">Toca cualquier zona para ver detalles</span>` : 'Sin registros de campo para este jugador en este partido'}
      </div>
      <div class="pitch-field-grid" style="max-width: 290px; height: 230px; margin: 0 auto;">
        <!-- Fila 1: Ataque -->
        <div class="pitch-grid-cell pz-top-l ${cntTopL > 0 ? 'has-actions' : ''}" style="grid-area: top_l; background: ${getHeatBg(cntTopL)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_l', 'Banda Ofensiva Izquierda')}" data-zone-count="${cntTopL}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_l)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">↖️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntTopL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_l')}</span>
        </div>
        <div class="pitch-grid-cell pz-top-c ${cntTopC > 0 ? 'has-actions' : ''}" style="grid-area: top_c; background: ${getHeatBg(cntTopC)}; border-color: rgba(239, 68, 68, 0.8); cursor: pointer;" data-zone-name="${t('zone_box_opp', 'Área Rival')}" data-zone-count="${cntTopC}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_c)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🥅</span>
          <span style="font-size: 14px; font-weight: 900; color: #fde047;">${cntTopC}</span>
          <span style="font-size: 9px; opacity: 0.9;">${t('zone_box_opp')}</span>
        </div>
        <div class="pitch-grid-cell pz-top-r ${cntTopR > 0 ? 'has-actions' : ''}" style="grid-area: top_r; background: ${getHeatBg(cntTopR)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_r', 'Banda Ofensiva Derecha')}" data-zone-count="${cntTopR}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">↗️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntTopR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_r')}</span>
        </div>

        <!-- Fila 2-3: Bandas unidas laterales -->
        <div class="pitch-grid-cell pz-wing-l ${cntWingL > 0 ? 'has-actions' : ''}" style="grid-area: wing_l; background: ${getHeatBg(cntWingL)}; cursor: pointer;" data-zone-name="${t('zone_wing_l', 'Banda Izquierda')}" data-zone-count="${cntWingL}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_l)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⬅️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntWingL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_l')}</span>
        </div>

        <!-- Fila 2 Centro: Frontal -->
        <div class="pitch-grid-cell pz-mid-t ${cntMidT > 0 ? 'has-actions' : ''}" style="grid-area: mid_t; background: ${getHeatBg(cntMidT)}; cursor: pointer;" data-zone-name="${t('zone_front', 'Frontal del Área')}" data-zone-count="${cntMidT}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_t)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🎯</span>
          <span style="font-size: 13px; font-weight: 900;">${cntMidT}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_front')}</span>
        </div>

        <div class="pitch-grid-cell pz-wing-r ${cntWingR > 0 ? 'has-actions' : ''}" style="grid-area: wing_r; background: ${getHeatBg(cntWingR)}; cursor: pointer;" data-zone-name="${t('zone_wing_r', 'Banda Derecha')}" data-zone-count="${cntWingR}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">➡️</span>
          <span style="font-size: 13px; font-weight: 900;">${cntWingR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_r')}</span>
        </div>

        <!-- Fila 3 Centro: Centro del campo -->
        <div class="pitch-grid-cell pz-mid-b ${cntMidB > 0 ? 'has-actions' : ''}" style="grid-area: mid_b; background: ${getHeatBg(cntMidB)}; cursor: pointer;" data-zone-name="${t('zone_mid', 'Centro del Campo')}" data-zone-count="${cntMidB}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_b)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⚽</span>
          <span style="font-size: 13px; font-weight: 900;">${cntMidB}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_mid')}</span>
        </div>
      </div>
    `;
  }

  /* =========================================================
     MODAL DE EXPLICACIÓN DETALLADA DE KPIs
     ========================================================= */
  function showKpiExplanationModal(title, valStr, desc, detail) {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog-box" style="max-width: 380px; text-align: center;">
        <div style="font-size: 34px; margin-bottom: 8px;">📊</div>
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 900;">${title}</h3>
        <div style="font-size: 26px; font-weight: 900; color: #22d3ee; margin-bottom: 12px;">${valStr}</div>
        <p style="color: var(--text); font-size: 13.5px; line-height: 1.5; margin-bottom: 10px; text-align: left; background: var(--bg2); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border);">
          ${desc}
        </p>
        ${detail ? `
          <p style="color: var(--muted); font-size: 12px; line-height: 1.45; margin-bottom: 16px; text-align: left;">
            💡 ${detail}
          </p>
        ` : ''}
        <button class="btn block primary" id="btn-close-kpi-info">${t('close', 'Entendido')}</button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#btn-close-kpi-info').onclick = () => dialog.remove();
    dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  }

  function showPlayerMatchDetailModal(session, player) {
    const st = (session.stats && session.stats[player.id]) || {};
    const rating = Store.calculateMatchRating(st, player.mainPosition);
    const totPass = (st.passOk || 0) + (st.passKo || 0);
    const passPct = totPass > 0 ? Math.round(((st.passOk || 0) / totPass) * 100) : 0;
    const team = Store.team(player.teamId);

    openSheet(`Estadísticas: ${Store.playerName(player, true)}`, (body) => {
      body.innerHTML = `
        <div class="p-hero" style="margin-bottom: 12px;">
          ${renderAvatar(player, 'lg')}
          <div class="grow">
            <h2>${escapeHtml(Store.playerName(player))}</h2>
            <div class="meta">
              <span class="pos-tag">${player.mainPosition || 'Jugador'}</span>
              <span>#${player.mainDorsal != null ? player.mainDorsal : '—'}</span>
              ${team ? `<span>${escapeHtml(team.name)}</span>` : ''}
            </div>
            <div style="margin-top: 6px;">
              <span class="rating-pill">⭐ ${rating.toFixed(1)} / 10 Nota en el partido</span>
            </div>
          </div>
        </div>

        <div class="info-note" style="margin-bottom: 12px;">
          🏆 <b>${escapeHtml(Store.sessionTitle(session))}</b> • ${formatDateDDMMAAAA(session.date)} • Duración: ${Store.fmtTime(Store.elapsed(session), session)}
          ${session.type === 'match' && session.score ? `<div style="font-weight: 800; margin-top: 2px;">Marcador: ${session.score.home || 0} - ${session.score.away || 0}</div>` : ''}
        </div>

        <div style="font-size: 11px; color: var(--muted); margin-bottom: 6px; text-align: center;">
          💡 Toca en cualquier estadística para ver su explicación detallada:
        </div>
        <div class="kpis" style="margin-bottom: 12px;">
          <div class="kpi clickable" id="kpi-detail-goal" title="Ver explicación de Goles">
            <span class="k-emoji">⚽</span>
            <b class="num" style="color: #facc15;">${st.goal || 0}</b>
            <span>${t('stat_goal')}</span>
          </div>
          <div class="kpi clickable" id="kpi-detail-shotOn" title="Ver explicación de Tiros a puerta">
            <span class="k-emoji">🎯</span>
            <b class="num" style="color: #06b6d4;">${st.shotOn || 0}</b>
            <span>${t('stat_shotOn')}</span>
          </div>
          <div class="kpi clickable" id="kpi-detail-pass" title="Ver explicación de % de Pase">
            <span class="k-emoji">👟</span>
            <b class="num" style="color: #22c55e;">${totPass > 0 ? passPct + '%' : '—'}</b>
            <span>% Pase (${st.passOk || 0}/${totPass})</span>
          </div>
          <div class="kpi clickable" id="kpi-detail-assist" title="Ver explicación de Asistencias">
            <span class="k-emoji">🅰️</span>
            <b class="num" style="color: #a855f7;">${st.assist || 0}</b>
            <span>${t('stat_assist')}</span>
          </div>
          <div class="kpi clickable" id="kpi-detail-recovery" title="Ver explicación de Balones recuperados">
            <span class="k-emoji">🛡️</span>
            <b class="num" style="color: #3b82f6;">${st.recovery || 0}</b>
            <span>${t('stat_recovery')}</span>
          </div>
          <div class="kpi clickable" id="kpi-detail-loss" title="Ver explicación de Pérdidas de balón">
            <span class="k-emoji">⚠️</span>
            <b class="num" style="color: #f87171;">${st.loss || 0}</b>
            <span>${t('stat_loss')}</span>
          </div>
        </div>

        <!-- Mapa táctico de zonas en este partido -->
        <div class="section-title"><span>Zonas del campo en este partido</span></div>
        <div class="card" style="margin-bottom: 14px;">
          ${renderSessionPlayerZonesHeatmapHtml(session, player.id)}
        </div>

        <div class="btn-row">
          <button class="btn primary grow" id="btn-match-generate-card">
            ${icon('medal', 16)} Ficha de Jugador
          </button>
          <button class="btn grow" id="btn-match-adjust-data">
            ${icon('edit', 16)} Ajustar Cifras
          </button>
        </div>
      `;

      // Clic interactivo en cada KPI con explicaciones completas
      body.querySelector('#kpi-detail-goal').onclick = () => {
        showKpiExplanationModal('Goles Marcados', `${st.goal || 0} goles`, 'Total de goles anotados por el jugador durante este partido.', 'Cada gol registrado suma automáticamente al marcador del partido y al perfil personal acumulado del jugador.');
      };
      body.querySelector('#kpi-detail-shotOn').onclick = () => {
        showKpiExplanationModal('Tiros a Puerta', `${st.shotOn || 0} tiros`, 'Disparos dirigidos entre los tres palos que exigieron parada o terminaron en gol.', 'Mide la puntería y la capacidad ofensiva directa en el área rival.');
      };
      body.querySelector('#kpi-detail-pass').onclick = () => {
        const explText = totPass > 0 
          ? `( ${st.passOk || 0} / ${totPass} ) significa que el jugador completó con éxito ${st.passOk || 0} pases de ${totPass} intentos totales en este partido (${st.passOk || 0} pases buenos y ${st.passKo || 0} fallados).`
          : 'El jugador aún no tiene registros de pases en este partido.';
        showKpiExplanationModal('% de Pase (Efectividad)', (totPass > 0 ? passPct + '%' : '—'), 'Porcentaje de pases completados con éxito respecto al total de pases intentados.', explText);
      };
      body.querySelector('#kpi-detail-assist').onclick = () => {
        showKpiExplanationModal('Asistencias de Gol', `${st.assist || 0} asistencias`, 'Pases directos que culminaron en un gol anotado por un compañero.', 'Mide la visión de juego y la calidad en el último tercio.');
      };
      body.querySelector('#kpi-detail-recovery').onclick = () => {
        showKpiExplanationModal('Balones Recuperados', `${st.recovery || 0} recuperaciones`, 'Acciones defensivas donde el jugador recuperó la posesión (entradas, robos, intercepciones).', 'Refleja la agresividad táctica y solidez defensiva.');
      };
      body.querySelector('#kpi-detail-loss').onclick = () => {
        showKpiExplanationModal('Pérdidas de Balón', `${st.loss || 0} pérdidas`, 'Pérdidas de posesión en controles erróneos, regates fallidos o pases interceptados.', 'Un menor número de pérdidas refleja seguridad y madurez con el balón.');
      };

      body.querySelector('#btn-match-generate-card').onclick = () => {
        closeSheet();
        showPlayerCardModal(player, session);
      };

      body.querySelector('#btn-match-adjust-data').onclick = () => {
        closeSheet();
        showEditSessionStatsModal(session.id, player.id);
      };
    }, (foot) => {
      foot.innerHTML = `<button class="btn block ghost" id="btn-close-match-detail">Volver al Resumen</button>`;
      foot.querySelector('#btn-close-match-detail').onclick = () => {
        closeSheet();
        showSessionDetailModal(session.id);
      };
    }, () => {
      // Al cerrar con la X del encabezado o al tocar fuera de la hoja
      showSessionDetailModal(session.id);
    });
  }

  function showSessionDetailModal(sessionId) {
    const s = Store.session(sessionId);
    if (!s) return;

    let linkedConv = s.convocationId ? Store.convocation(s.convocationId) : null;
    if (!linkedConv && Store.state && Array.isArray(Store.state.convocations)) {
      linkedConv = Store.state.convocations.find(cv => {
        if (cv.sessionId && cv.sessionId === s.id) return true;
        if (cv.id && s.convocationId && cv.id === s.convocationId) return true;
        if (cv.date === s.date && cv.type === s.type) return true;
        return false;
      });
      if (linkedConv && !s.convocationId) {
        s.convocationId = linkedConv.id;
        if (!linkedConv.sessionId) linkedConv.sessionId = s.id;
        Store.save();
      }
    }
    if (!linkedConv) {
      linkedConv = Store.upsertConvocation({
        id: 'conv_' + s.id,
        sessionId: s.id,
        type: s.type,
        title: Store.sessionTitle(s),
        date: s.date,
        time: s.time || '18:00',
        endTime: s.endTime || '',
        duration: s.duration || 90,
        venue: s.venue || '',
        address: s.address || '',
        rival: s.rival || '',
        teamId: s.teamId || '',
        teamIds: Array.isArray(s.teamIds) ? s.teamIds : (s.teamId ? [s.teamId] : []),
        notes: s.notes || '',
        list: s.attendance || {}
      });
      s.convocationId = linkedConv.id;
      Store.save();
    }
    navigate('convocations');
    setTimeout(() => {
      showConvocationDetailsModal(linkedConv);
    }, 60);
    return;
  }

    function showEditSessionStatsModal(sessionId, playerId) {
    const s = Store.session(sessionId);
    const p = Store.player(playerId);
    if (!s || !p) return;
    const st = s.stats[playerId] || {};

    openSheet(`Ajustar cifras: ${Store.playerName(p, true)}`, (body) => {
      body.innerHTML = `
        <div class="edit-grid">
          ${Store.STATS.map(item => {
            const count = st[item.key] || 0;
            return `
              <div class="edit-row">
                <span class="e-emoji">${item.emoji}</span>
                <span class="e-lbl">${item.label}</span>
                <div class="stepper">
                  <button type="button" class="btn-step-m" data-k="${item.key}">-</button>
                  <input type="number" min="0" max="999" class="step-num-input" id="step-val-${item.key}" data-k="${item.key}" value="${count}" inputmode="numeric" />
                  <button type="button" class="btn-step-p" data-k="${item.key}">+</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      body.querySelectorAll('.step-num-input').forEach(inp => {
        const k = inp.getAttribute('data-k');
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('input', () => {
          const val = Math.max(0, parseInt(inp.value, 10) || 0);
          Store.setCount(s.id, p.id, k, val);
          st[k] = val;
        });
        inp.addEventListener('blur', () => {
          inp.value = st[k] || 0;
        });
      });

      body.querySelectorAll('.btn-step-m').forEach(btn => {
        btn.onclick = () => {
          const k = btn.getAttribute('data-k');
          const cur = st[k] || 0;
          if (cur > 0) {
            const next = cur - 1;
            Store.setCount(s.id, p.id, k, next);
            st[k] = next;
            const inp = body.querySelector(`#step-val-${k}`);
            if (inp) inp.value = next;
          }
        };
      });

      body.querySelectorAll('.btn-step-p').forEach(btn => {
        btn.onclick = () => {
          const k = btn.getAttribute('data-k');
          const cur = st[k] || 0;
          const next = cur + 1;
          Store.setCount(s.id, p.id, k, next);
          st[k] = next;
          const inp = body.querySelector(`#step-val-${k}`);
          if (inp) inp.value = next;
        };
      });
    }, (foot) => {
      foot.innerHTML = `<button class="btn block primary" id="btn-done-edit">${t('saveChanges')}</button>`;
      foot.querySelector('#btn-done-edit').onclick = () => {
        closeSheet();
        showSessionDetailModal(sessionId);
      };
    });
  }

  /* =========================================================
     VISTA 3: JUGADORES & EQUIPOS
     ========================================================= */
  function renderPlayersView(view) {
    let linkedPlayersMap = window.Cloud ? window.Cloud.getCachedLinkedPlayersMap() : {};

    function getPlayerBadgeHtml(pid) {
      const isLinked = !!(linkedPlayersMap && linkedPlayersMap[pid]);
      if (isLinked) {
        return `<span title="${t('playerLinkedToDevice', 'Perfil vinculado al teléfono')}" style="font-size: 13px; margin-left: 6px; vertical-align: middle; cursor: help;">📱</span>`;
      } else {
        return `<span title="${t('playerNotLinkedToDevice', 'Perfil no vinculado todavía')}" style="font-size: 11px; margin-left: 6px; vertical-align: middle; opacity: 0.75; cursor: help;">⚫</span>`;
      }
    }

    function refreshPresenceBadges() {
      const items = view.querySelectorAll('.player-item');
      items.forEach(item => {
        const pid = item.getAttribute('data-id');
        const slot = item.querySelector('.pres-badge-slot');
        if (slot && pid) {
          slot.innerHTML = getPlayerBadgeHtml(pid);
        }
      });
    }

    window._refreshPlayersPresenceList = () => {
      linkedPlayersMap = window.Cloud ? window.Cloud.getCachedLinkedPlayersMap() : {};
      refreshPresenceBadges();
    };

    function build() {
      let players = Store.sortedPlayers(playerListTeam);
      if (playerListSearch) {
        const q = playerListSearch.toLowerCase();
        players = players.filter(p => {
          const name = Store.playerName(p).toLowerCase();
          const dorsal = p.mainDorsal != null ? String(p.mainDorsal) : '';
          return name.includes(q) || dorsal.includes(q);
        });
      }

      view.innerHTML = `
        <div class="topbar">
          <div>
            <h1>${t('playerSquad')}</h1>
            <span class="sub">${Store.realPlayersCount ? Store.realPlayersCount() : Store.state.players.filter(p => !p.isTestPlayer && !p.isTest).length} ${t('totalPlayersSuffix')}</span>
          </div>
          <div class="row">
            <button class="icon-btn" id="btn-test-player-modal" title="${t('testPlayerProfile', 'Perfil de Jugador de Prueba (Modo Test)')}" style="color: #facc15; font-size: 18px;">🧪</button>
            <button class="icon-btn" id="btn-manage-teams" title="${t('manageTeams')}">${icon('shield', 20)}</button>
            <button class="icon-btn" id="btn-import-players" title="${t('importPlayers')}">${icon('upload', 20)}</button>
          </div>
        </div>

        <div class="search">
          <input type="text" id="player-search-bar" placeholder="${t('searchPlayerPlaceholder')}" value="${escapeHtml(playerListSearch)}" />
          ${icon('search', 18)}
        </div>

        <div class="chips" id="team-filter-chips" style="margin-bottom: 12px;">
          <button class="chip ${playerListTeam === 'all' ? 'active' : ''}" data-t="all">${t('all')}</button>
          ${Store.state.teams.map(t => `
            <button class="chip ${playerListTeam === t.id ? 'active' : ''}" data-t="${t.id}">
              <span class="dot" style="background: ${t.color}"></span>
              ${escapeHtml(t.name)}
            </button>
          `).join('')}
          <button class="chip ghost" id="btn-manage-teams-chip" style="border-style: dashed;" title="${t('manageTeams')}">
            ${icon('sliders', 14)} ${t('teams')}
          </button>
        </div>

        <div id="players-list-container">
          ${players.length === 0 ? `
            <div class="empty">
              <div class="big">👤</div>
              <h3>${t('noPlayersTitle')}</h3>
              <p>${t('noPlayersDesc')}</p>
            </div>
          ` : players.map(p => {
            const team = Store.team(p.teamId);
            const presBadge = getPlayerBadgeHtml(p.id);
            const pStats = Store.playerAggregate(p.id);
            const pGoals = (pStats && pStats.totals && pStats.totals.goal) || 0;
            const overall = Store.calculatePlayerOverallRating ? Store.calculatePlayerOverallRating(p.id, p.mainPosition) : { rating: 6.0 };
            const pRating = (overall.rating || 6.0).toFixed(1);
            const pStreak = Store.calculatePlayerAttendanceStreak ? Store.calculatePlayerAttendanceStreak(p.id) : 0;
            const pMvp = Store.calculatePlayerMvpCount ? Store.calculatePlayerMvpCount(p.id) : 0;

            return `
              <div class="player-item" data-id="${p.id}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                ${renderAvatar(p, 'md')}
                <div class="grow ellipsis">
                  <h4 style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 2px;">
                    <span class="ellipsis">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</span>
                    <span class="pres-badge-slot">${presBadge}</span>
                  </h4>
                  <div class="meta" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted);">
                    <span class="pos-tag">${p.mainPosition || 'Jugador'}</span>
                    <span>•</span>
                    <span>${getPlayerFootLabel(p.foot)}</span>
                    ${team ? `<span>• <span style="color: ${team.color || '#22c55e'}; font-weight: 700;">🛡️ ${escapeHtml(team.name)}</span></span>` : ''}
                  </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                    ${pMvp > 0 ? `<span style="font-size: 11px; font-weight: 800; color: #fde047; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.35); padding: 1px 5px; border-radius: 6px;" title="MVP">👑 ${pMvp}</span>` : ''}
                    ${pStreak >= 2 ? `<span style="font-size: 11px; font-weight: 800; color: #fb923c; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.35); padding: 1px 5px; border-radius: 6px;" title="${t('attendanceStreak', 'Racha de asistencia')}">🔥 ${pStreak}</span>` : ''}
                    <div style="font-size: 13px; font-weight: 900; color: #22d3ee;">⭐ ${pRating}</div>
                  </div>
                  <small style="font-size: 10.5px; color: var(--muted);">⚽ ${pGoals} ${t('goals', 'goles')}</small>
                </div>
                ${icon('chevR', 18, 'dim')}
              </div>
            `;
          }).join('')}
        </div>

        <button class="fab" id="btn-add-player-fab" title="${t('newPlayer')}">
          ${icon('plus', 26)}
        </button>
      `;

      const search = view.querySelector('#player-search-bar');
      search.oninput = (e) => {
        playerListSearch = e.target.value;
        const q = playerListSearch.toLowerCase().trim();
        const listCont = view.querySelector('#players-list-container');
        if (listCont) {
          const items = listCont.querySelectorAll('.player-item');
          items.forEach(el => {
            const pid = el.getAttribute('data-id');
            const p = Store.player(pid);
            const name = p ? Store.playerName(p).toLowerCase() : el.textContent.toLowerCase();
            const dorsal = (p && p.mainDorsal != null) ? String(p.mainDorsal) : '';
            const match = !q || name.includes(q) || dorsal.includes(q);
            el.style.display = match ? 'flex' : 'none';
          });
        }
      };

      view.querySelectorAll('#team-filter-chips .chip[data-t]').forEach(c => {
        c.onclick = () => {
          playerListTeam = c.getAttribute('data-t');
          build();
        };
      });

      const btnTeamsChip = view.querySelector('#btn-manage-teams-chip');
      if (btnTeamsChip) btnTeamsChip.onclick = () => showManageTeamsModal(() => build());

      const btnTeamsTop = view.querySelector('#btn-manage-teams');
      if (btnTeamsTop) btnTeamsTop.onclick = () => showManageTeamsModal(() => build());

      const btnTestModal = view.querySelector('#btn-test-player-modal');
      if (btnTestModal) btnTestModal.onclick = () => showTestPlayerConfigModal(() => build());

      view.querySelectorAll('.player-item').forEach(el => {
        el.onclick = () => {
          const pid = el.getAttribute('data-id');
          showPlayerProfileModal(pid);
        };
      });

      view.querySelector('#btn-add-player-fab').onclick = () => {
        showEditPlayerModal(null, () => build());
      };

      view.querySelector('#btn-import-players').onclick = () => {
        showImportModal(() => build());
      };
    }

    build();

    if (window.Cloud && window.Cloud.getLinkedPlayersMap) {
      window.Cloud.getLinkedPlayersMap().then(map => {
        if (map) {
          linkedPlayersMap = map;
          refreshPresenceBadges();
        }
      });
    }
  }

  // 🌟 Modal para Nominar Destacados del Míster ("coachPicks", máx 3)
  function showMatchCoachPicksModal(session, onUpdated) {
    if (!session) return;
    const trackedPlayerIds = new Set([
      ...Object.keys(session.stats || {}),
      ...(session.slots || []).filter(Boolean)
    ]);
    const players = (Store.state.players || []).filter(p => trackedPlayerIds.has(p.id));
    if (players.length === 0) {
      toast('No hay jugadores registrados en este partido para nominar', 'warning');
      return;
    }

    const currentPicks = Array.isArray(session.coachPicks) ? session.coachPicks.slice(0, 3) : [];
    const selectedMap = new Map();
    currentPicks.forEach(cp => {
      if (cp && cp.playerId) {
        selectedMap.set(String(cp.playerId), cp.coachReason || '');
      }
    });

    const modal = document.createElement('div');
    modal.className = 'dialog-overlay';
    modal.id = 'dialog-coach-picks';
    modal.style.zIndex = '999999';

    function renderModalHtml() {
      return `
        <div class="card dialog-box" style="max-width: 480px; width: 92%; padding: 20px; border-radius: 18px; border: 1.5px solid rgba(168, 85, 247, 0.45); max-height: 90vh; display: flex; flex-direction: column; background: #0f172a; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🌟</span>
              <div>
                <h3 style="margin: 0; font-size: 16.5px; font-weight: 900; color: #fff;">
                  ${t('mvp_coach_picks_title', 'Destacados por el Míster')}
                </h3>
                <div style="font-size: 11px; color: var(--muted);">
                  ${session.rival ? `vs ${escapeHtml(session.rival)}` : escapeHtml(session.title || 'Partido')}
                </div>
              </div>
            </div>
            <button type="button" class="btn sm ghost" id="btn-close-coach-picks" style="padding: 4px 8px;">✕</button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.35;">
              ${t('coachPicksMax3', 'Selecciona hasta 3 jugadores destacados y escribe por qué brillaron hoy:')}
            </p>
            <span id="counter-coach-picks" class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.5); font-weight: 800; font-size: 11px; white-space: nowrap; margin-left: 6px;">
              ${selectedMap.size}/3
            </span>
          </div>

          <div id="coach-picks-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; padding-right: 4px;">
            ${players.map(p => {
              const sPid = String(p.id);
              const isSelected = selectedMap.has(sPid);
              const reason = selectedMap.get(sPid) || '';
              const st = (session.stats && session.stats[p.id]) || {};
              const rating = Store.calculateMatchRating(st, p.mainPosition);

              return `
                <div class="card coach-pick-item" data-pid="${p.id}" style="padding: 10px 12px; border-radius: 12px; border: 1.5px solid ${isSelected ? '#c084fc' : 'var(--border)'}; background: ${isSelected ? 'rgba(168, 85, 247, 0.12)' : 'var(--surface2)'}; transition: all 0.15s ease;">
                  <div class="coach-pick-header" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      ${renderAvatar(p, 'sm')}
                      <div>
                        <b style="font-size: 13.5px; color: #fff;">
                          #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}
                        </b>
                        <div style="font-size: 11px; color: var(--muted);">
                          ${p.mainPosition || 'Jugador'} • Nota: <span style="color: #22c55e; font-weight: 700;">${rating.toFixed(1)}</span>
                          ${st.goal ? ` • ⚽ ${st.goal}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="badge" style="background: ${isSelected ? '#a855f7' : 'rgba(255,255,255,0.08)'}; color: #fff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
                        ${isSelected ? '✓ ' + t('selected', 'Seleccionado') : '+ ' + t('select', 'Elegir')}
                      </span>
                    </div>
                  </div>

                  <div class="coach-pick-reason-box" style="margin-top: 8px; ${isSelected ? '' : 'display: none;'}">
                    <input type="text" class="input-coach-reason" data-pid="${p.id}" value="${escapeHtml(reason)}" placeholder="${t('coachReasonPlaceholder', 'Motivo del míster (ej. gran presión tras pérdida, liderazgo...)')}" style="width: 100%; font-size: 12.5px; padding: 7px 10px; border-radius: 8px; background: rgba(0,0,0,0.35); border: 1px solid rgba(168, 85, 247, 0.4); color: #fff;" />
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" class="btn ghost" id="btn-cancel-coach-picks">${t('cancel')}</button>
            <button type="button" class="btn primary" id="btn-save-coach-picks" style="font-weight: 800; background: #a855f7; border: 1px solid #c084fc;">
              🌟 ${t('saveCoachPicks', 'Guardar Destacados del Míster')}
            </button>
          </div>
        </div>
      `;
    }

    modal.innerHTML = renderModalHtml();
    document.body.appendChild(modal);

    function updatePicksUI() {
      const counter = modal.querySelector('#counter-coach-picks');
      if (counter) counter.textContent = `${selectedMap.size}/3`;

      modal.querySelectorAll('.coach-pick-item').forEach(item => {
        const pid = item.getAttribute('data-pid');
        const isSel = selectedMap.has(pid);
        item.style.borderColor = isSel ? '#c084fc' : 'var(--border)';
        item.style.background = isSel ? 'rgba(168, 85, 247, 0.12)' : 'var(--surface2)';
        const badge = item.querySelector('.coach-pick-header .badge');
        if (badge) {
          badge.style.background = isSel ? '#a855f7' : 'rgba(255,255,255,0.08)';
          badge.textContent = isSel ? '✓ ' + t('selected', 'Seleccionado') : '+ ' + t('select', 'Elegir');
        }
        const reasonBox = item.querySelector('.coach-pick-reason-box');
        if (reasonBox) {
          reasonBox.style.display = isSel ? 'block' : 'none';
        }
      });
    }

    function bindEvents() {
      modal.querySelectorAll('.coach-pick-header').forEach(header => {
        header.onclick = () => {
          const item = header.closest('.coach-pick-item');
          const pid = item.getAttribute('data-pid');
          if (selectedMap.has(pid)) {
            selectedMap.delete(pid);
          } else {
            if (selectedMap.size >= 3) {
              toast('Solo puedes seleccionar un máximo de 3 destacados', 'warning');
              return;
            }
            selectedMap.set(pid, '');
          }
          updatePicksUI();
          haptic(25);
        };
      });

      modal.querySelectorAll('.input-coach-reason').forEach(inp => {
        inp.oninput = (e) => {
          const pid = inp.getAttribute('data-pid');
          if (selectedMap.has(pid)) {
            selectedMap.set(pid, e.target.value);
          }
        };
      });

      function closeModal() { modal.remove(); }
      modal.querySelector('#btn-close-coach-picks').onclick = closeModal;
      modal.querySelector('#btn-cancel-coach-picks').onclick = closeModal;

      modal.querySelector('#btn-save-coach-picks').onclick = () => {
        const picks = [];
        selectedMap.forEach((reason, pid) => {
          picks.push({
            playerId: pid,
            coachReason: (reason || '').trim()
          });
        });

        Store.setMatchCoachPicks(session.id, picks);
        toast(`🌟 ${picks.length} destacados del míster guardados para la votación`, 'success');
        closeModal();
        if (typeof onUpdated === 'function') onUpdated();
      };
    }

    bindEvents();
  }

  // 👁️ Modal para que el entrenador vea quién ha votado a qué jugador en la votación MVP
  function showMvpVotesBreakdownModal(session) {
    if (!session) return;
    const existing = document.getElementById('dialog-mvp-votes-breakdown');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'dialog-overlay';
    modal.id = 'dialog-mvp-votes-breakdown';
    modal.style.zIndex = '999999';

    // Obtener jugadores que participaron en el partido
    const participantSet = new Set();
    if (session.stats) {
      Object.keys(session.stats).forEach(pid => {
        const st = session.stats[pid];
        if (st && Object.values(st).some(v => Number(v) > 0)) participantSet.add(pid);
      });
    }
    if (Array.isArray(session.slots)) session.slots.filter(Boolean).forEach(pid => participantSet.add(pid));
    if (Array.isArray(session.trackedPlayerIds)) session.trackedPlayerIds.filter(Boolean).forEach(pid => participantSet.add(pid));
    if (session.attendance) {
      Object.keys(session.attendance).forEach(pid => {
        const a = session.attendance[pid];
        const st = (typeof a === 'object' && a !== null) ? a.status : a;
        if (st === 'present' || st === 'late' || st === 'attended' || st === 'yes' || st === true) {
          participantSet.add(pid);
        } else if (st === 'absent') {
          participantSet.delete(pid);
        }
      });
    }
    if (Array.isArray(session.coachPicks)) {
      session.coachPicks.forEach(cp => {
        if (!cp) return;
        if (typeof cp === 'string') participantSet.add(cp);
        else if (cp.playerId) participantSet.add(cp.playerId);
        else if (cp.id) participantSet.add(cp.id);
      });
    }

    const allPlayers = Store.state.players || [];
    let participants = Array.from(participantSet).map(pid => allPlayers.find(p => p.id === pid)).filter(Boolean);
    // Excluir jugadores de prueba
    participants = participants.filter(p => !p.isTestPlayer && !p.isTest && p.id !== 'test_player_profile');
    // Deduplicar participantes por ID y por nombre
    const seenPIds = new Set();
    const seenPNames = new Set();
    participants = participants.filter(p => {
      if (!p || !p.id) return false;
      if (seenPIds.has(p.id)) return false;
      const norm = `${(p.name || '').trim().toLowerCase()} ${(p.lastName || '').trim().toLowerCase()}`.trim();
      if (norm && seenPNames.has(norm)) return false;
      seenPIds.add(p.id);
      if (norm) seenPNames.add(norm);
      return true;
    });

    let currentVoteData = null;
    let unsubMvp = null;

    function renderContent() {
      const votes = (currentVoteData && currentVoteData.votes) ? currentVoteData.votes : (session.votes || {});
      const nowTs = Date.now();
      let matchEndTs = 0;
      if (session.endedAt) matchEndTs = Number(session.endedAt);
      else if (session.finishedAt) matchEndTs = Number(session.finishedAt);
      else if (session.date) {
        const timePart = session.time ? (session.time.length === 5 ? session.time : session.time.slice(0, 5)) : '12:00';
        const parsed = new Date(`${session.date}T${timePart}:00`).getTime();
        matchEndTs = isNaN(parsed) ? new Date(session.date).getTime() : parsed;
      }

      const totalParticipants = participants.length;
      const votedPlayers = participants.filter(p => !!votes[p.id]);
      const allVoted = (totalParticipants > 0 && votedPlayers.length >= totalParticipants);

      let deadlineTs = matchEndTs ? (matchEndTs + 48 * 3600 * 1000) : (nowTs + 48 * 3600 * 1000);
      if (allVoted && matchEndTs) {
        deadlineTs = Math.min(deadlineTs, matchEndTs + 24 * 3600 * 1000);
      }
      const isVotingActive = (nowTs < deadlineTs);
      const remainingMs = Math.max(0, deadlineTs - nowTs);
      const remHours = Math.floor(remainingMs / 3600000);
      const remMins = Math.floor((remainingMs % 3600000) / 60000);

      // Conteo de votos por candidato
      const voteCounts = {};
      Object.values(votes).forEach(tId => {
        if (tId) voteCounts[tId] = (voteCounts[tId] || 0) + 1;
      });

      let leadingPlayer = null;
      let maxVotes = 0;
      let isTie = false;
      if (Object.keys(voteCounts).length > 0) {
        maxVotes = Math.max(...Object.values(voteCounts));
        if (maxVotes > 0) {
          const topIds = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
          if (topIds.length === 1) {
            leadingPlayer = allPlayers.find(p => p.id === topIds[0]);
          } else {
            isTie = true;
            let bestTieRating = -1;
            topIds.forEach(candId => {
              const cand = allPlayers.find(p => p.id === candId);
              if (!cand) return;
              const st = (session.stats && session.stats[candId]) || {};
              const r = Store.calculateMatchRating(st, cand.mainPosition);
              if (r > bestTieRating) {
                bestTieRating = r;
                leadingPlayer = cand;
              }
            });
            if (!leadingPlayer) leadingPlayer = allPlayers.find(p => p.id === topIds[0]);
          }
        }
      }

      modal.innerHTML = `
        <div class="card dialog-box" style="max-width: 480px; width: 94%; padding: 16px 14px; border-radius: 18px; border: 1.5px solid #22c55e; max-height: 90vh; display: flex; flex-direction: column; background: #0b1329; box-shadow: 0 10px 40px rgba(0,0,0,0.85);">
          <!-- Encabezado -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>🗳️</span> <span>${t('mvpVotesBreakdownTitle', 'Votación MVP: Quién ha votado a quién')}</span>
              </h3>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
                ${session.rival ? `vs ${escapeHtml(session.rival)}` : escapeHtml(session.title || 'Partido')} • ${session.date || ''}
              </div>
            </div>
            <button type="button" class="btn sm ghost" id="btn-close-mvp-breakdown" style="padding: 4px 8px;">✕</button>
          </div>

          <!-- Resumen de Participación y Tiempo -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <span style="color: #cbd5e1; font-weight: 700;">
                📊 ${t('totalParticipantsCount', '{voted} de {total} participantes han votado').replace('{voted}', votedPlayers.length).replace('{total}', totalParticipants)}
              </span>
              <span class="badge" style="background: ${isVotingActive ? 'rgba(250, 204, 21, 0.2)' : 'rgba(148, 163, 184, 0.2)'}; color: ${isVotingActive ? '#fde047' : '#94a3b8'}; font-size: 10.5px; font-weight: 800;">
                ${isVotingActive ? `⏳ Quedan ${remHours}h ${remMins}m` : `🏁 ${t('votingClosed', 'Votación finalizada')}`}
              </span>
            </div>

            ${leadingPlayer ? `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(250, 204, 21, 0.4); padding: 6px 10px; border-radius: 8px;">
                <span>🏆</span>
                <span style="color: #fef08a; font-weight: 800;">
                  ${isVotingActive ? t('currentLeader', 'Líder actual') : t('winner', 'Ganador')}: <b>${escapeHtml(Store.playerName(leadingPlayer))}</b> (${maxVotes} voto${maxVotes !== 1 ? 's' : ''}${isTie ? ` • ${t('votingTieBreakRating', 'Desempate por nota')}` : ''})
                </span>
              </div>
            ` : ''}
          </div>

          <!-- Lista detallada: Quién votó a quién -->
          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; padding-right: 4px;">
            ${participants.length === 0 ? `
              <div style="text-align: center; color: var(--muted); padding: 20px;">
                ${t('noPlayersInMatch', 'No hay jugadores registrados en este partido')}
              </div>
            ` : participants.map(voter => {
              const targetId = votes[voter.id];
              const targetPlayer = targetId ? allPlayers.find(p => p.id === targetId) : null;
              const hasVoted = !!targetPlayer;

              return `
                <div class="card" style="padding: 10px 12px; border-radius: 12px; background: ${hasVoted ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.45)'}; border: 1.5px solid ${hasVoted ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255, 255, 255, 0.08)'}; display: flex; flex-direction: column; gap: 8px;">
                  <!-- Votante -->
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1;">
                      ${renderAvatar(voter, 'sm')}
                      <div style="min-width: 0; flex: 1;">
                        <div style="font-size: 13.5px; font-weight: 900; color: #fff; line-height: 1.25;">
                          #${voter.mainDorsal != null ? voter.mainDorsal : '—'} ${escapeHtml(Store.playerName(voter))}
                        </div>
                        <div style="font-size: 10.5px; color: var(--muted); margin-top: 2px;">
                          ${voter.mainPosition || 'Jugador'}
                        </div>
                      </div>
                    </div>

                    <div style="flex-shrink: 0;">
                      ${hasVoted ? `
                        <span class="badge" style="background: rgba(34, 197, 94, 0.18); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
                          <span>✓</span> <span>${t('voted', 'Votado')}</span>
                        </span>
                      ` : `
                        <span class="badge" style="background: rgba(250, 204, 21, 0.15); color: #fde047; border: 1px solid rgba(250, 204, 21, 0.35); font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
                          <span>⏳</span> <span>${t('pendingVote', 'Pendiente de votar')}</span>
                        </span>
                      `}
                    </div>
                  </div>

                  <!-- Destinatario del voto (si ha votado) -->
                  ${hasVoted ? `
                    <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(234, 179, 8, 0.3); border-left: 3.5px solid #eab308; border-radius: 8px; padding: 7px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                        <span style="font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0; display: flex; align-items: center; gap: 4px;">
                          <span>🗳️</span> <span>${t('voterVotedFor', 'Ha votado a')}:</span>
                        </span>
                        ${renderAvatar(targetPlayer, 'xs')}
                        <span style="font-size: 13px; font-weight: 900; color: #fef08a; min-width: 0; line-height: 1.25;">
                          #${targetPlayer.mainDorsal != null ? targetPlayer.mainDorsal : '—'} ${escapeHtml(Store.playerName(targetPlayer))}
                        </span>
                      </div>
                      <span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.3); font-size: 10px; font-weight: 800; flex-shrink: 0; padding: 2px 6px;">
                        ${targetPlayer.mainPosition || 'Jugador'}
                      </span>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Botón Cerrar -->
          <button type="button" class="btn ghost block" id="btn-close-mvp-breakdown-bottom" style="height: 40px; font-weight: 800; border-radius: 10px;">
            ${t('close', 'Cerrar')}
          </button>
        </div>
      `;

      function closeModal() {
        if (unsubMvp) { try { unsubMvp(); } catch (e) {} }
        modal.remove();
      }
      modal.querySelector('#btn-close-mvp-breakdown').onclick = closeModal;
      modal.querySelector('#btn-close-mvp-breakdown-bottom').onclick = closeModal;
    }

    if (window.Cloud && window.Cloud.listenToMatchMvp) {
      unsubMvp = window.Cloud.listenToMatchMvp(session.id, (voteData) => {
        currentVoteData = voteData;
        renderContent();
      });
    } else {
      renderContent();
    }

    document.body.appendChild(modal);
  }

  // 👑 Modal para Nombrar el MVP Oficial del Partido
  function showSetOfficialMvpModal(session, onUpdated) {
    if (!session) return;
    const trackedPlayerIds = new Set([
      ...Object.keys(session.stats || {}),
      ...(session.slots || []).filter(Boolean)
    ]);
    let players = (Store.state.players || []).filter(p => trackedPlayerIds.has(p.id) && !p.isTestPlayer && !p.isTest && p.id !== 'test_player_profile');
    // Deduplicación estricta por ID y nombre
    const seenPIds = new Set();
    const seenPNames = new Set();
    players = players.filter(p => {
      if (!p || !p.id) return false;
      if (seenPIds.has(p.id)) return false;
      const norm = `${(p.name || '').trim().toLowerCase()} ${(p.lastName || '').trim().toLowerCase()}`.trim();
      if (norm && seenPNames.has(norm)) return false;
      seenPIds.add(p.id);
      if (norm) seenPNames.add(norm);
      return true;
    });

    if (players.length === 0) {
      toast('No hay jugadores registrados en este partido para nombrar MVP', 'warning');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'dialog-overlay';
    modal.id = 'dialog-set-mvp';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
      <div class="card dialog-box" style="max-width: 440px; width: 92%; padding: 20px; border-radius: 16px; border: 1.5px solid rgba(250, 204, 21, 0.4); max-height: 90vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">
            👑 ${t('setOfficialMvp', 'Nombrar MVP Oficial del Partido')}
          </h3>
          <button type="button" class="btn sm ghost" id="btn-close-set-mvp" style="padding: 4px 8px;">✕</button>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          Elige al jugador más destacado del partido vs <b style="color: #fff;">${escapeHtml(session.rival || session.title || 'Rival')}</b>:
        </div>

        <div id="mvp-player-options-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; padding-right: 4px;">
          ${players.map(p => {
            const isCurrent = session.mvpOfficialId && String(session.mvpOfficialId) === String(p.id);
            const st = (session.stats && session.stats[p.id]) || {};
            const rating = Store.calculateMatchRating(st, p.mainPosition);
            return `
              <div class="card player-mvp-choice" data-pid="${p.id}" style="padding: 10px 12px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1.5px solid ${isCurrent ? '#facc15' : 'var(--border)'}; background: ${isCurrent ? 'rgba(250, 204, 21, 0.15)' : 'var(--surface2)'};">
                <div style="display: flex; align-items: center; gap: 10px;">
                  ${renderAvatar(p, 'sm')}
                  <div>
                    <b style="font-size: 13.5px; color: #fff;">${escapeHtml(Store.playerName(p))} #${p.mainDorsal || ''}</b>
                    <div style="font-size: 11px; color: var(--muted);">
                      ${p.mainPosition || 'Jugador'} • Nota: <span style="color: #22c55e; font-weight: 700;">${rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                  <span class="mvp-community-tally" data-pid="${p.id}" style="font-size: 11px; color: #fde047; font-weight: 800;"></span>
                  <div style="font-size: 18px;">${isCurrent ? '⭐' : '⚪'}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn sm" id="btn-open-coach-picks-from-mvp" style="font-weight: 800; background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4);">
              🌟 Nominar Top 3 Destacados
            </button>
            <button type="button" class="btn sm" id="btn-open-breakdown-from-mvp" style="font-weight: 800; background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.4);">
              👁️ ${t('viewVotesDetail', 'Ver votos')}
            </button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn ghost" id="btn-cancel-set-mvp">${t('cancel')}</button>
            <button type="button" class="btn primary" id="btn-confirm-set-mvp" style="font-weight: 800; background: #eab308; color: #000;">
              ⭐ Confirmar MVP Oficial
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedPlayerId = session.mvpOfficialId || (players[0] ? players[0].id : null);

    function updateSelection() {
      modal.querySelectorAll('.player-mvp-choice').forEach(el => {
        const pid = el.getAttribute('data-pid');
        const isSel = String(pid) === String(selectedPlayerId);
        el.style.borderColor = isSel ? '#facc15' : 'var(--border)';
        el.style.background = isSel ? 'rgba(250, 204, 21, 0.15)' : 'var(--surface2)';
        const star = el.querySelector('div:last-child > div:last-child');
        if (star) star.textContent = isSel ? '⭐' : '⚪';
      });
    }

    modal.querySelectorAll('.player-mvp-choice').forEach(el => {
      el.onclick = () => {
        selectedPlayerId = el.getAttribute('data-pid');
        updateSelection();
      };
    });

    let unsubMvp = null;
    if (window.Cloud && window.Cloud.listenToMatchMvp) {
      unsubMvp = window.Cloud.listenToMatchMvp(session.id, (voteData) => {
        if (!voteData || !voteData.votes) return;
        const counts = {};
        Object.values(voteData.votes).forEach(targetId => {
          counts[targetId] = (counts[targetId] || 0) + 1;
        });
        const maxVotes = Math.max(...Object.values(counts), 0);
        const topCandidateIds = Object.keys(counts).filter(id => counts[id] === maxVotes && maxVotes > 0);
        const hasTie = topCandidateIds.length > 1;

        let tieNotice = modal.querySelector('#mvp-tie-notice');
        if (hasTie) {
          if (!tieNotice) {
            tieNotice = document.createElement('div');
            tieNotice.id = 'mvp-tie-notice';
            tieNotice.style.cssText = 'background: rgba(234, 179, 8, 0.15); border: 1.5px solid #facc15; border-radius: 10px; padding: 8px 12px; font-size: 11.5px; color: #fde047; font-weight: 800; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;';
            const listEl = modal.querySelector('#mvp-player-options-list');
            if (listEl && listEl.parentNode) listEl.parentNode.insertBefore(tieNotice, listEl);
          }
          tieNotice.innerHTML = `⚖️ <b>Empate en votos comunitarios (${maxVotes} votos):</b> Tu selección como entrenador desempatará al ganador del MVP.`;
        } else if (tieNotice) {
          tieNotice.remove();
        }

        modal.querySelectorAll('.mvp-community-tally').forEach(el => {
          const pid = el.getAttribute('data-pid');
          const count = counts[pid] || 0;
          const isTop = (count === maxVotes && maxVotes > 0);
          el.textContent = count > 0 ? `🗳️ ${count} voto${count > 1 ? 's' : ''}${isTop ? ' 🏆' : ''}` : '';
        });
      });
    }

    function closeModal() {
      if (unsubMvp) { try { unsubMvp(); } catch (e) {} }
      modal.remove();
    }
    modal.querySelector('#btn-close-set-mvp').onclick = closeModal;
    modal.querySelector('#btn-cancel-set-mvp').onclick = closeModal;

    const btnPicksFromMvp = modal.querySelector('#btn-open-coach-picks-from-mvp');
    if (btnPicksFromMvp) {
      btnPicksFromMvp.onclick = () => {
        closeModal();
        showMatchCoachPicksModal(session, onUpdated);
      };
    }

    const btnBreakdownFromMvp = modal.querySelector('#btn-open-breakdown-from-mvp');
    if (btnBreakdownFromMvp) {
      btnBreakdownFromMvp.onclick = () => {
        showMvpVotesBreakdownModal(session);
      };
    }

    modal.querySelector('#btn-confirm-set-mvp').onclick = () => {
      if (!selectedPlayerId) {
        toast('Selecciona un jugador para nombrar MVP', 'warning');
        return;
      }
      Store.setOfficialMatchMvp(session.id, selectedPlayerId);
      const chosenPlayer = Store.player(selectedPlayerId);
      toast(`⭐ ¡${Store.playerName(chosenPlayer)} nombrado MVP Oficial del Partido!`, 'success');
      closeModal();
      if (typeof onUpdated === 'function') onUpdated();
    };
  }

  // 🎯 Modal para Asignar Misión Semanal ("Misión del Míster")
  function showAssignMissionModal(player, onSaved) {
    if (!player) return;
    const presets = [
      {
        key: 'preset_pass',
        category: 'Táctica',
        icon: '🎯',
        color: '#22d3ee',
        type: 'auto',
        metric: 'pass_acc',
        target: 80,
        minAttempts: 5,
        text_es: 'Completar al menos el 80% de pases con precisión',
        text_en: 'Complete at least 80% of passes with accuracy',
        text_ee: 'Lõpeta vähemalt 80% söötudest täpselt',
        text_ru: 'Выполнить не менее 80% точных передач'
      },
      {
        key: 'preset_recov',
        category: 'Defensa',
        icon: '🛡️',
        color: '#38bdf8',
        type: 'auto',
        metric: 'recoveries',
        target: 3,
        minAttempts: 0,
        text_es: 'Realizar 3 recuperaciones limpias de balón',
        text_en: 'Make 3 clean ball recoveries',
        text_ee: 'Teha 3 puhast pallivõitu',
        text_ru: 'Совершить 3 чистых отбора/перехвата мяча'
      },
      {
        key: 'preset_duels',
        category: 'Duelos 1v1',
        icon: '⚔️',
        color: '#f97316',
        type: 'auto',
        metric: 'duels_won',
        target: 3,
        minAttempts: 3,
        text_es: 'Ganar al menos 3 duelos 1vs1',
        text_en: 'Win at least 3 1v1 duels',
        text_ee: 'Võita vähemalt 3 1vs1 duelli',
        text_ru: 'Выиграть как минимум 3 единоборства 1в1'
      },
      {
        key: 'preset_goals',
        category: 'Finalización',
        icon: '⚽',
        color: '#4ade80',
        type: 'auto',
        metric: 'goals',
        target: 2,
        minAttempts: 0,
        text_es: 'Marcar 2 o más goles en la semana',
        text_en: 'Score 2 or more goals this week',
        text_ee: 'Lüüa sel nädalal 2 või rohkem väravat',
        text_ru: 'Забить 2 или более голов за неделю'
      },
      {
        key: 'preset_streak',
        category: 'Constancia',
        icon: '⚡',
        color: '#facc15',
        type: 'auto',
        metric: 'attendance_streak',
        target: 3,
        minAttempts: 0,
        text_es: 'Alcanzar una racha de asistencia de 3 sesiones seguidas',
        text_en: 'Reach an attendance streak of 3 consecutive sessions',
        text_ee: 'Saavutada järjestikune osalemine 3 trennis',
        text_ru: 'Достичь серии посещаемости из 3 тренировок подряд'
      },
      {
        key: 'preset_foot',
        category: 'Técnica',
        icon: '👟',
        color: '#a855f7',
        type: 'manual',
        text_es: 'Disparar a portería con la pierna menos hábil',
        text_en: 'Shoot on target using your weaker foot',
        text_ee: 'Lüüa väravale nõrgema jalaga',
        text_ru: 'Пробить по воротам нерабочей ногой'
      },
      {
        key: 'preset_fairplay',
        category: 'Fair Play',
        icon: '🤝',
        color: '#34d399',
        type: 'manual',
        text_es: 'Cero tarjetas y máxima comunicación de apoyo en el campo',
        text_en: 'Zero cards and maximum supportive communication on the pitch',
        text_ee: 'Null kaarti ja maksimaalne toetav suhtlus väljakul',
        text_ru: 'Без карточек и с максимальной поддержкой партнеров на поле'
      }
    ];

    const curLang = (Store.state.settings && Store.state.settings.lang) || 'es';
    const currentMission = player.weeklyMission || null;
    let selectedPreset = null;
    let currentComment = '';

    if (currentMission) {
      if (currentMission.presetKey) {
        selectedPreset = presets.find(p => p.key === currentMission.presetKey) || null;
      }
      currentComment = currentMission.comment || (!selectedPreset ? currentMission.text : '') || '';
    }

    let currentType = (currentMission && currentMission.type) || (selectedPreset ? selectedPreset.type : 'auto');
    let currentMetric = (currentMission && currentMission.metric) || (selectedPreset && selectedPreset.metric) || 'pass_acc';
    let currentTarget = (currentMission && currentMission.target != null) ? currentMission.target : (selectedPreset && selectedPreset.target != null ? selectedPreset.target : 80);
    let currentMinAttempts = (currentMission && currentMission.minAttempts != null) ? currentMission.minAttempts : (selectedPreset && selectedPreset.minAttempts != null ? selectedPreset.minAttempts : 0);

    const modal = document.createElement('div');
    modal.className = 'dialog-overlay';
    modal.id = 'dialog-assign-mission';
    modal.style.zIndex = '999999';

    function getPresetTextByLang(pr) {
      if (!pr) return '';
      if (curLang === 'ru') return pr.text_ru || pr.text_es;
      if (curLang === 'ee' || curLang === 'et') return pr.text_ee || pr.text_es;
      if (curLang === 'en') return pr.text_en || pr.text_es;
      return pr.text_es;
    }

    function renderModalHtml() {
      const curPresetText = selectedPreset ? getPresetTextByLang(selectedPreset) : '';

      return `
        <div class="card dialog-box" style="max-width: 480px; width: 92%; padding: 20px; border-radius: 18px; border: 1.5px solid rgba(168, 85, 247, 0.45); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 16.5px; font-weight: 900; color: #fff;">
              🎯 ${t('weeklyMissionTitle', 'Misión Semanal del Míster')}
            </h3>
            <button type="button" class="btn sm ghost" id="btn-close-assign-mission" style="padding: 4px 8px;">✕</button>
          </div>
          <div style="font-size: 12.5px; color: var(--muted); margin-bottom: 12px;">
            Objetivo personalizado para <b style="color: #fff;">${escapeHtml(Store.playerName(player))}</b>:
          </div>

          <!-- Cuadrícula visual de Objetivos Rápidos -->
          <div style="margin-bottom: 14px;">
            <label style="font-size: 11px; font-weight: 800; color: #c084fc; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
              ⚡ Objetivos Rápidos (Toca para seleccionar):
            </label>
            <div id="quick-missions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 200px; overflow-y: auto; padding: 2px;">
              ${presets.map(pr => {
                const isCur = selectedPreset && selectedPreset.key === pr.key;
                const prText = getPresetTextByLang(pr);
                return `
                  <div class="quick-mission-card ${isCur ? 'active' : ''}" data-mkey="${pr.key}" style="background: ${isCur ? pr.color + '25' : 'var(--surface2)'}; border: ${isCur ? '2px solid ' + pr.color : '1.5px solid rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 10px; cursor: pointer; transition: all .15s ease; display: flex; flex-direction: column; gap: 4px; ${isCur ? `box-shadow: 0 0 14px ${pr.color}60;` : ''}">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <span style="font-size: 18px;">${pr.icon}</span>
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <span class="chk-preset" style="font-size: 11px; color: ${pr.color}; font-weight: 900; display: ${isCur ? 'inline-block' : 'none'};">✓</span>
                        <span class="badge" style="font-size: 9.5px; font-weight: 800; background: ${pr.color}22; color: ${pr.color}; border: 1px solid ${pr.color}44; padding: 1px 6px; border-radius: 6px;">
                          ${pr.category} ${pr.type === 'auto' ? '🤖' : '✍️'}
                        </span>
                      </div>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #fff; line-height: 1.35; margin-top: 2px;">
                      ${escapeHtml(prText)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Selector de Validación: Automática vs Manual -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(168, 85, 247, 0.35); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">
                ⚙️ Modo de Validación
              </span>
              <div class="segmented" style="display: flex; gap: 4px;">
                <button type="button" class="btn sm ${currentType === 'auto' ? 'active' : ''}" id="btn-type-auto" style="font-size: 10.5px; padding: 3px 8px; font-weight: 800;">
                  🤖 ${t('autoMissionBadge', 'Automática')}
                </button>
                <button type="button" class="btn sm ${currentType === 'manual' ? 'active' : ''}" id="btn-type-manual" style="font-size: 10.5px; padding: 3px 8px; font-weight: 800;">
                  ✍️ ${t('manualMissionBadge', 'Manual')}
                </button>
              </div>
            </div>

            <div id="mission-auto-controls" style="${currentType === 'auto' ? 'display: block; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;' : 'display: none;'}">
              <div style="margin-bottom: 8px;">
                <label style="font-size: 10.5px; color: var(--muted); font-weight: 700; display: block; margin-bottom: 4px;">Métrica evaluada automáticamente:</label>
                <select id="mission-metric-select" style="width: 100%; font-size: 12px; padding: 7px 10px; border-radius: 8px; background: var(--surface); color: #fff; border: 1px solid var(--border);">
                  <option value="pass_acc" ${currentMetric === 'pass_acc' ? 'selected' : ''}>🎯 ${t('metric_pass_acc', 'Precisión de Pase (%)')}</option>
                  <option value="duels_won" ${currentMetric === 'duels_won' ? 'selected' : ''}>⚔️ ${t('metric_duels_won', 'Duelos 1v1 Ganados')}</option>
                  <option value="recoveries" ${currentMetric === 'recoveries' ? 'selected' : ''}>🛡️ ${t('metric_recoveries', 'Recuperaciones de Balón')}</option>
                  <option value="goals" ${currentMetric === 'goals' ? 'selected' : ''}>⚽ ${t('metric_goals', 'Goles Marcados')}</option>
                  <option value="attendance_streak" ${currentMetric === 'attendance_streak' ? 'selected' : ''}>⚡ ${t('metric_attendance_streak', 'Racha de Asistencia')}</option>
                </select>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <label style="font-size: 10.5px; color: var(--muted); font-weight: 700; display: block; margin-bottom: 4px;">${t('targetLabel', 'Objetivo (Target)')}:</label>
                  <input type="number" id="mission-target-input" min="1" max="100" value="${currentTarget}" style="width: 100%; font-size: 12.5px; padding: 6px 10px; border-radius: 8px; background: var(--surface); color: #fff; border: 1px solid var(--border);" />
                </div>
                <div>
                  <label style="font-size: 10.5px; color: var(--muted); font-weight: 700; display: block; margin-bottom: 4px;">${t('minAttemptsLabel', 'Intentos mín. (opc.)')}:</label>
                  <input type="number" id="mission-minattempts-input" min="0" value="${currentMinAttempts}" style="width: 100%; font-size: 12.5px; padding: 6px 10px; border-radius: 8px; background: var(--surface); color: #fff; border: 1px solid var(--border);" />
                </div>
              </div>
            </div>
          </div>

          <!-- Vista previa de la misión seleccionada -->
          <div id="mission-selected-preview" style="margin-bottom: 12px; ${selectedPreset ? '' : 'display: none;'}">
            ${selectedPreset ? `
              <div style="background: rgba(168, 85, 247, 0.15); border: 1.5px solid rgba(168, 85, 247, 0.45); border-radius: 12px; padding: 10px 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">
                    🎯 ${t('missionSelected', 'Misión Seleccionada')}:
                  </span>
                  <span style="font-size: 9.5px; font-weight: 800; color: #86efac; background: rgba(34, 197, 94, 0.18); padding: 1px 6px; border-radius: 6px;">
                    🌐 Auto-traducida (ES / EN / EE)
                  </span>
                </div>
                <div style="font-size: 13px; font-weight: 800; color: #fff; line-height: 1.35;">
                  ${selectedPreset.icon} "${escapeHtml(curPresetText)}"
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Caja de texto: comentario opcional o misión personalizada -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <label id="mission-textarea-label" style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase;">
                ${selectedPreset ? '💬 ' + t('coachCommentOptional', 'Comentario o Nota adicional (Opcional)') : '✏️ ' + t('customMissionText', 'Misión Personalizada')}
              </label>
            </div>
            <textarea id="mission-text-input" rows="2" style="width: 100%; font-size: 13.5px; padding: 10px; border-radius: 10px; resize: vertical;" placeholder="${selectedPreset ? 'Ej. Muy atento al perfil corporal antes de recibir el balón... (Opcional)' : 'Escribe un objetivo personalizado para esta semana...'}">${escapeHtml(currentComment)}</textarea>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" class="btn ghost" id="btn-cancel-mission">${t('cancel')}</button>
            <button type="button" class="btn primary" id="btn-save-mission" style="font-weight: 800;">
              🚀 ${t('assignMission', 'Asignar Misión')}
            </button>
          </div>
        </div>
      `;
    }

    modal.innerHTML = renderModalHtml();
    document.body.appendChild(modal);

    function updateSelectionUI() {
      modal.querySelectorAll('[data-mkey]').forEach(card => {
        const k = card.getAttribute('data-mkey');
        const isCur = selectedPreset && selectedPreset.key === k;
        const pr = presets.find(p => p.key === k);
        if (pr) {
          if (isCur) {
            card.style.border = `2px solid ${pr.color}`;
            card.style.background = `${pr.color}25`;
            card.style.boxShadow = `0 0 14px ${pr.color}60`;
            const chk = card.querySelector('.chk-preset');
            if (chk) chk.style.display = 'inline-block';
          } else {
            card.style.border = '1.5px solid rgba(255,255,255,0.08)';
            card.style.background = 'var(--surface2)';
            card.style.boxShadow = 'none';
            const chk = card.querySelector('.chk-preset');
            if (chk) chk.style.display = 'none';
          }
        }
      });

      const autoBtn = modal.querySelector('#btn-type-auto');
      const manualBtn = modal.querySelector('#btn-type-manual');
      const autoBox = modal.querySelector('#mission-auto-controls');

      if (autoBtn) autoBtn.className = `btn sm ${currentType === 'auto' ? 'active primary' : ''}`;
      if (manualBtn) manualBtn.className = `btn sm ${currentType === 'manual' ? 'active primary' : ''}`;
      if (autoBox) autoBox.style.display = (currentType === 'auto') ? 'block' : 'none';

      const previewEl = modal.querySelector('#mission-selected-preview');
      const txtLabel = modal.querySelector('#mission-textarea-label');
      const txtInput = modal.querySelector('#mission-text-input');

      if (selectedPreset) {
        const prText = getPresetTextByLang(selectedPreset);
        if (previewEl) {
          previewEl.style.display = 'block';
          previewEl.innerHTML = `
            <div style="background: rgba(168, 85, 247, 0.15); border: 1.5px solid rgba(168, 85, 247, 0.45); border-radius: 12px; padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">
                  🎯 ${t('missionSelected', 'Misión Seleccionada')}:
                </span>
                <span style="font-size: 9.5px; font-weight: 800; color: #86efac; background: rgba(34, 197, 94, 0.18); padding: 1px 6px; border-radius: 6px;">
                  🌐 Auto-traducida (ES / EN / ET / RU)
                </span>
              </div>
              <div style="font-size: 13px; font-weight: 800; color: #fff; line-height: 1.35;">
                ${selectedPreset.icon} "${escapeHtml(prText)}"
              </div>
            </div>
          `;
        }
        if (txtLabel) {
          txtLabel.innerHTML = '💬 ' + t('coachCommentOptional', 'Comentario o Nota adicional (Opcional)');
        }
        if (txtInput) {
          txtInput.placeholder = 'Ej. Muy atento al perfil corporal antes de recibir el balón... (Opcional)';
        }
      } else {
        if (previewEl) {
          previewEl.style.display = 'none';
          previewEl.innerHTML = '';
        }
        if (txtLabel) {
          txtLabel.innerHTML = '✏️ ' + t('customMissionText', 'Misión Personalizada');
        }
        if (txtInput) {
          txtInput.placeholder = 'Escribe un objetivo personalizado para esta semana...';
        }
      }
    }

    function bindEvents() {
      modal.querySelectorAll('[data-mkey]').forEach(card => {
        card.onclick = () => {
          const k = card.getAttribute('data-mkey');
          if (selectedPreset && selectedPreset.key === k) {
            selectedPreset = null;
          } else {
            selectedPreset = presets.find(p => p.key === k) || null;
            if (selectedPreset) {
              currentType = selectedPreset.type || 'auto';
              if (selectedPreset.metric) currentMetric = selectedPreset.metric;
              if (selectedPreset.target != null) currentTarget = selectedPreset.target;
              if (selectedPreset.minAttempts != null) currentMinAttempts = selectedPreset.minAttempts;
              const metSel = modal.querySelector('#mission-metric-select');
              if (metSel && selectedPreset.metric) metSel.value = selectedPreset.metric;
              const tgtInp = modal.querySelector('#mission-target-input');
              if (tgtInp && selectedPreset.target != null) tgtInp.value = selectedPreset.target;
              const attInp = modal.querySelector('#mission-minattempts-input');
              if (attInp && selectedPreset.minAttempts != null) attInp.value = selectedPreset.minAttempts;
            }
          }
          updateSelectionUI();
          haptic(25);
        };
      });

      const btnAuto = modal.querySelector('#btn-type-auto');
      if (btnAuto) {
        btnAuto.onclick = () => {
          currentType = 'auto';
          updateSelectionUI();
        };
      }
      const btnManual = modal.querySelector('#btn-type-manual');
      if (btnManual) {
        btnManual.onclick = () => {
          currentType = 'manual';
          updateSelectionUI();
        };
      }

      function closeModal() {
        modal.remove();
      }
      modal.querySelector('#btn-close-assign-mission').onclick = closeModal;
      modal.querySelector('#btn-cancel-mission').onclick = closeModal;

      modal.querySelector('#btn-save-mission').onclick = () => {
        const inp = modal.querySelector('#mission-text-input');
        const typedVal = inp ? inp.value.trim() : '';

        if (!selectedPreset && !typedVal) {
          toast('Por favor selecciona un objetivo rápido o escribe una misión personalizada', 'warning');
          return;
        }

        const metSel = modal.querySelector('#mission-metric-select');
        const tgtInp = modal.querySelector('#mission-target-input');
        const attInp = modal.querySelector('#mission-minattempts-input');

        const finalMetric = metSel ? metSel.value : currentMetric;
        const finalTarget = tgtInp ? (Number(tgtInp.value) || 0) : Number(currentTarget);
        const finalMinAttempts = attInp ? (Number(attInp.value) || 0) : Number(currentMinAttempts);

        const missionPayload = {
          id: (currentMission && currentMission.id) || ('m_' + Date.now()),
          title: selectedPreset ? selectedPreset.text_es : typedVal,
          text: selectedPreset ? getPresetTextByLang(selectedPreset) : typedVal,
          text_es: selectedPreset ? selectedPreset.text_es : typedVal,
          text_en: selectedPreset ? selectedPreset.text_en : typedVal,
          text_ee: selectedPreset ? selectedPreset.text_ee : typedVal,
          text_ru: selectedPreset ? selectedPreset.text_ru : typedVal,
          presetKey: selectedPreset ? selectedPreset.key : '',
          category: selectedPreset ? selectedPreset.category : 'General',
          icon: selectedPreset ? selectedPreset.icon : '🎯',
          type: currentType,
          metric: currentType === 'auto' ? finalMetric : null,
          target: currentType === 'auto' ? finalTarget : 0,
          minAttempts: currentType === 'auto' ? finalMinAttempts : 0,
          currentProgress: (currentMission && currentMission.currentProgress) || 0,
          comment: typedVal,
          status: currentType === 'auto' ? 'in_progress' : 'pending',
          assignedAt: Date.now()
        };

        Store.setPlayerWeeklyMission(player.id, missionPayload);

        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        toast('🎯 ¡Misión semanal asignada!', 'success');
        closeModal();
        if (typeof onSaved === 'function') onSaved();
      };
    }

    bindEvents();
  }

  // 📄 Modal Generador de Informe Mensual de Progreso (PDF / Ficha para Padres)
  function showMonthlyProgressReportModal(player) {
    if (!player) return;
    const allSessions = Store.state.sessions || [];
    const team = Store.team(player.teamId);

    const monthSet = new Set();
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthSet.add(ym);
    }
    allSessions.forEach(s => {
      if (s.date && s.date.length >= 7) monthSet.add(s.date.slice(0, 7));
    });
    const months = Array.from(monthSet).sort().reverse();

    let selectedMonth = months[0];

    const monthNamesEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');

    function formatMonthLabel(ym) {
      const parts = ym.split('-');
      const y = parts[0];
      const mIdx = parseInt(parts[1], 10) - 1;
      const mName = isEn ? monthNamesEn[mIdx] : monthNamesEs[mIdx];
      return `${mName} ${y}`;
    }

    openSheet(t('monthlyReport', 'Informe Mensual de Progreso'), (body) => {
      function renderReportContent() {
        const monthSessions = allSessions.filter(s => s.date && s.date.startsWith(selectedMonth));
        const monthTrainings = monthSessions.filter(s => s.type === 'training');
        const monthMatches = monthSessions.filter(s => s.type === 'match');

        let trainAtt = 0;
        monthTrainings.forEach(s => {
          const att = s.attendance ? s.attendance[player.id] : null;
          const st = (typeof att === 'object' && att !== null) ? att.status : att;
          if (st === 'present' || st === 'late' || (s.stats && s.stats[player.id] && Object.values(s.stats[player.id]).some(v => v > 0))) {
            trainAtt++;
          }
        });
        const trainPct = monthTrainings.length > 0 ? Math.round((trainAtt / monthTrainings.length) * 100) : 100;

        let matchAtt = 0;
        monthMatches.forEach(s => {
          const att = s.attendance ? s.attendance[player.id] : null;
          const st = (typeof att === 'object' && att !== null) ? att.status : att;
          if (st === 'present' || st === 'late' || (s.stats && s.stats[player.id] && Object.values(s.stats[player.id]).some(v => v > 0))) {
            matchAtt++;
          }
        });
        const matchPct = monthMatches.length > 0 ? Math.round((matchAtt / monthMatches.length) * 100) : 100;

        let monthGoals = 0, monthAssists = 0, monthPassOk = 0, monthPassKo = 0, monthShotsOn = 0, monthShotsOff = 0;
        let ratingsSum = 0, ratingsCount = 0;

        monthSessions.forEach(s => {
          const st = (s.stats && s.stats[player.id]) || {};
          monthGoals += (st.goal || 0);
          monthAssists += (st.assist || 0);
          monthPassOk += (st.passOk || 0);
          monthPassKo += (st.passKo || 0);
          monthShotsOn += (st.shotOn || 0);
          monthShotsOff += (st.shotOff || 0);

          if (s.type === 'match' && Object.values(st).some(v => v > 0)) {
            const r = Store.calculateMatchRating(st, player.mainPosition);
            if (r > 0) {
              ratingsSum += r;
              ratingsCount++;
            }
          }
        });

        const totalPasses = monthPassOk + monthPassKo;
        const passAccuracy = totalPasses > 0 ? Math.round((monthPassOk / totalPasses) * 100) : 0;
        const avgRating = ratingsCount > 0 ? (ratingsSum / ratingsCount).toFixed(1) : '—';

        const monthRadar = Store.calculatePlayerRadar(player.id, monthSessions);

        player.monthlyReports = player.monthlyReports || {};
        const savedNotes = (player.monthlyReports[selectedMonth] && player.monthlyReports[selectedMonth].notes) || '';

        body.innerHTML = `
          <!-- Selector de Mes -->
          <div style="margin-bottom: 14px; background: var(--surface2); padding: 10px 14px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <label style="font-size: 12.5px; font-weight: 800; color: #fff; white-space: nowrap;">📅 ${t('reportMonth', 'Mes del Informe')}:</label>
            <select id="select-report-month" style="font-weight: 800; font-size: 13.5px; padding: 6px 10px; border-radius: 8px;">
              ${months.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${formatMonthLabel(m)}</option>`).join('')}
            </select>
          </div>

          <!-- FICHA DEL INFORME (ESTILO OFICIAL JK NOOVA) -->
          <div id="printable-monthly-report" class="card" style="padding: 18px; border-radius: 16px; background: linear-gradient(145deg, #0b1329 0%, #0f172a 100%); border: 2px solid #0284c7; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 14px;">
            <!-- Cabecera del Club -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid rgba(14, 165, 233, 0.3); padding-bottom: 12px; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="assets/fut/logo_noova.png" style="width: 38px; height: 38px; object-fit: contain;" />
                <div>
                  <div style="font-size: 15px; font-weight: 900; color: #38bdf8; letter-spacing: 1px; text-transform: uppercase;">JK NOOVA</div>
                  <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">INFORME MENSUAL DE DESARROLLO Y RENDIMIENTO</div>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="badge" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.4); font-size: 11.5px; font-weight: 900;">
                  ${formatMonthLabel(selectedMonth).toUpperCase()}
                </span>
              </div>
            </div>

            <!-- Datos del Jugador -->
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
              ${renderAvatar(player, 'lg')}
              <div style="line-height: 1.3;">
                <div style="font-size: 18px; font-weight: 900; color: #fff;">
                  ${escapeHtml(Store.playerName(player))} <span style="color: #38bdf8;">#${player.mainDorsal || ''}</span>
                </div>
                <div style="font-size: 12.5px; color: #cbd5e1; margin-top: 3px;">
                  ${player.mainPosition || 'Jugador'} ${team ? `• 🛡️ ${escapeHtml(team.name)}` : ''}
                </div>
                ${player.birthDate ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">🎂 ${player.birthDate}</div>` : ''}
              </div>
            </div>

            <!-- Asistencia y Compromiso -->
            <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
              📊 ${t('attendance', 'Asistencia y Compromiso en el Mes')}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 10px; text-align: center;">
                <div style="font-size: 11px; color: #94a3b8; font-weight: 700;">${t('training', 'Entrenamientos')}</div>
                <div style="font-size: 20px; font-weight: 900; color: #22c55e; margin: 4px 0;">
                  ${trainPct}%
                </div>
                <div style="font-size: 10.5px; color: #cbd5e1;">${trainAtt} de ${monthTrainings.length} asistidos</div>
              </div>
              <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 10px; text-align: center;">
                <div style="font-size: 11px; color: #94a3b8; font-weight: 700;">${t('match', 'Partidos')}</div>
                <div style="font-size: 20px; font-weight: 900; color: #38bdf8; margin: 4px 0;">
                  ${matchPct}%
                </div>
                <div style="font-size: 10.5px; color: #cbd5e1;">${matchAtt} de ${monthMatches.length} disputados</div>
              </div>
            </div>

            <!-- Métricas Clave del Mes -->
            <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
              ⚡ Resumen Técnico del Mes
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; margin-bottom: 14px;">
              <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 8px 4px;">
                <div style="font-size: 10px; color: #94a3b8;">GOLES</div>
                <div style="font-size: 16px; font-weight: 900; color: #facc15;">${monthGoals}</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 8px 4px;">
                <div style="font-size: 10px; color: #94a3b8;">ASIST.</div>
                <div style="font-size: 16px; font-weight: 900; color: #c084fc;">${monthAssists}</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 8px 4px;">
                <div style="font-size: 10px; color: #94a3b8;">% PASE</div>
                <div style="font-size: 16px; font-weight: 900; color: #22c55e;">${totalPasses > 0 ? passAccuracy + '%' : '—'}</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 8px 4px;">
                <div style="font-size: 10px; color: #94a3b8;">NOTA MED.</div>
                <div style="font-size: 16px; font-weight: 900; color: #38bdf8;">${avgRating}</div>
              </div>
            </div>

            <!-- Radar / Atributos del Mes -->
            <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
              🎯 Cualidades Deportivas Evaluadas
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; margin-bottom: 14px;">
              <div style="background: rgba(255,255,255,0.04); padding: 6px; border-radius: 8px;">
                <span style="font-size: 10px; color: #94a3b8;">PAS (Pase)</span>
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${monthRadar.pas}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 6px; border-radius: 8px;">
                <span style="font-size: 10px; color: #94a3b8;">TIR (Tiro)</span>
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${monthRadar.tir}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 6px; border-radius: 8px;">
                <span style="font-size: 10px; color: #94a3b8;">REG (Regate)</span>
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${monthRadar.reg}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 6px; border-radius: 8px;">
                <span style="font-size: 10px; color: #94a3b8;">DEF (Defensa)</span>
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${monthRadar.def}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 6px; border-radius: 8px;">
                <span style="font-size: 10px; color: #94a3b8;">FIS (Físico)</span>
                <div style="font-size: 14px; font-weight: 800; color: #fff;">${monthRadar.fis}</div>
              </div>
              <div style="background: rgba(255,255,255,0.04); padding: 6px; border-radius: 8px;">
                <span style="font-size: 10px; color: #94a3b8;">DIS (Disciplina)</span>
                <div style="font-size: 14px; font-weight: 800; color: #22c55e;">${monthRadar.dis}</div>
              </div>
            </div>

            <!-- Evaluación Cualitativa del Entrenador -->
            <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
              📝 Observaciones del Cuerpo Técnico
            </div>
            <textarea id="report-coach-notes-input" rows="3" style="width: 100%; font-size: 12.5px; padding: 10px; border-radius: 10px; resize: vertical; background: rgba(0,0,0,0.4); border: 1px solid rgba(56, 189, 248, 0.3); color: #fff;" placeholder="Escribe aquí las observaciones para la familia (ej. Excelente compromiso, gran mejora en la toma de decisiones, continuar practicando pierna hábil...)...">${escapeHtml(savedNotes)}</textarea>
            <div style="text-align: right; margin-top: 4px;">
              <button type="button" class="btn sm ghost" id="btn-save-report-notes" style="font-size: 11px; padding: 4px 10px;">
                💾 Guardar Observaciones
              </button>
            </div>
          </div>

          <!-- Botones de Acción: Imprimir, WhatsApp -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
            <button class="btn primary block" id="btn-print-report" style="font-weight: 800; font-size: 13.5px; padding: 10px;">
              🖨️ ${t('printPdf', 'Imprimir / Guardar en PDF')}
            </button>
            <button class="btn btn-social" id="btn-report-share-wa" style="background: #16a34a; color: #fff; border-color: #22c55e; font-weight: 800; font-size: 13px; width: 100%; justify-content: center;">
              ${icon('whatsapp', 18)} WhatsApp
            </button>
          </div>
        `;

        const selMonth = body.querySelector('#select-report-month');
        if (selMonth) {
          selMonth.onchange = () => {
            selectedMonth = selMonth.value;
            renderReportContent();
          };
        }

        const notesInput = body.querySelector('#report-coach-notes-input');
        const btnSaveNotes = body.querySelector('#btn-save-report-notes');
        function saveNotes() {
          const val = notesInput ? notesInput.value.trim() : '';
          player.monthlyReports = player.monthlyReports || {};
          player.monthlyReports[selectedMonth] = {
            notes: val,
            updatedAt: Date.now()
          };
          Store.save();
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          toast('✅ Observaciones guardadas con éxito', 'success');
        }
        if (btnSaveNotes) btnSaveNotes.onclick = saveNotes;

        body.querySelector('#btn-print-report').onclick = () => {
          saveNotes();
          window.print();
        };

        function buildShareText() {
          const notes = notesInput ? notesInput.value.trim() : '';
          return `📄 *INFORME MENSUAL DE RENDIMIENTO - JK NOOVA*\n` +
            `👤 *Jugador:* ${Store.playerName(player)} (#${player.mainDorsal || '—'})\n` +
            `📅 *Mes:* ${formatMonthLabel(selectedMonth)}\n\n` +
            `📊 *ASISTENCIA Y COMPROMISO:*\n` +
            `• Entrenamientos: ${trainPct}% (${trainAtt}/${monthTrainings.length})\n` +
            `• Partidos: ${matchPct}% (${matchAtt}/${monthMatches.length})\n\n` +
            `⚽ *ESTADÍSTICAS TÉCNICAS:*\n` +
            `• Goles: ${monthGoals} | Asistencias: ${monthAssists}\n` +
            `• Precisión de pase: ${totalPasses > 0 ? passAccuracy + '%' : '—'}\n` +
            `• Nota media de partido: ${avgRating}\n\n` +
            (notes ? `📝 *Observaciones del Entrenador:*\n"${notes}"\n\n` : '') +
            `_JK Noova Player Stats System_`;
        }

        body.querySelector('#btn-report-share-wa').onclick = () => {
          saveNotes();
          const text = encodeURIComponent(buildShareText());
          if (hasNative() && window.AndroidBridge && window.AndroidBridge.shareText) {
            window.AndroidBridge.shareText(buildShareText());
          } else {
            window.open(`https://wa.me/?text=${text}`, '_blank');
          }
        };
      }

      renderReportContent();
    });
  }

  function showPlayerProfileModal(playerId) {
    let p = Store.player(playerId);
    if (!p) {
      const cleanId = String(playerId || '').trim();
      p = (Store.state.players || []).find(x => x.id === cleanId || ('p_' + x.id) === cleanId || cleanId.includes(x.id) || Store.playerName(x).toLowerCase() === cleanId.toLowerCase());
    }
    if (!p) return;
    const team = Store.team(p.teamId);

    const overall = Store.calculatePlayerOverallRating ? Store.calculatePlayerOverallRating(p.id, p.mainPosition) : { rating: 6.0, mode: 'none' };
    const allSessions = Store.state.sessions || [];
    const trainingSessions = Store.filterSessions('training', 'all');
    const matchSessions = Store.filterSessions('match', 'all');
    const aggAll = Store.playerAggregate(p.id, allSessions);
    const aggTraining = Store.playerAggregate(p.id, trainingSessions);
    const aggMatch = Store.playerAggregate(p.id, matchSessions);
    let activeProfileTab = (aggTraining.count === 0 && aggMatch.count > 0) ? 'match' : 'training';
    const playerRadar = Store.calculatePlayerRadar ? Store.calculatePlayerRadar(p.id) : { pas: 50, tir: 50, reg: 50, def: 50, fis: 50, dis: 50 };
    const matchRating = overall.rating;

    const curLang = (Store.state.settings && Store.state.settings.lang) || 'es';
    const isEn = (curLang === 'en');
    const footText = getPlayerFootLabel(p.foot);
    const ageStr = p.birthDate ? calculateAgeYearsMonths(p.birthDate, curLang) : '';
    const hasParentContact = p.parentContact && (p.parentContact.name || p.parentContact.phone || p.parentContact.email);
    const secPositions = p.secondaryPositions && p.secondaryPositions.length ? p.secondaryPositions : (p.secondaryPosition ? [p.secondaryPosition] : []);

    function handleUnlinkPlayerAction() {
      confirmDialog(
        t('unlinkProfile', 'Desvincular Perfil'),
        `${t('unlinkProfileDesc', '¿Estás seguro de que deseas desvincular el perfil de este jugador? Perderá el acceso en su dispositivo y volverá a la pantalla de selección.')} (${Store.playerName(p)})`,
        async () => {
          try {
            if (window.Cloud && window.Cloud.unlinkPlayerProfile) {
              await window.Cloud.unlinkPlayerProfile(p.id);
            }
            p.unlinkedAt = Date.now();
            Store.save();
            if (window.Cloud && window.Cloud.pushCoachState) {
              window.Cloud.pushCoachState(Store.state, true);
            }
            if (window._globalPresenceMap) {
              delete window._globalPresenceMap[p.id];
            }
            if (typeof window._refreshPlayersPresenceList === 'function') {
              window._refreshPlayersPresenceList();
            }
            toast(t('unlinkSuccessToast', '✅ Perfil de {name} desvinculado con éxito.').replace('{name}', Store.playerName(p)), 'success');
            closeSheet();
            showPlayerProfileModal(p.id);
          } catch (e) {
            console.error('Error desvinculando perfil:', e);
            toast('Error: ' + e.message, 'error');
          }
        }
      );
    }

    const linkedMap = window.Cloud ? window.Cloud.getCachedLinkedPlayersMap() : {};
    const isLinked = !!(linkedMap && linkedMap[p.id]);

    openSheet(Store.playerName(p), (body) => {
      body.innerHTML = `
        <div class="p-hero">
          ${renderAvatar(p, 'lg')}
          <div class="grow">
            <h2>${escapeHtml(Store.playerName(p))}</h2>
            <div class="meta" style="flex-wrap: wrap; gap: 6px;">
              <span class="pos-tag">${p.mainPosition || 'Jugador'}</span>
              ${secPositions.length ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.4); font-size: 11px;">🔄 ${secPositions.join(', ')}</span>` : ''}
              <span>#${p.mainDorsal != null ? p.mainDorsal : '—'}</span>
              <span>${footText}</span>
              ${p.heightCm ? `<span>📏 ${p.heightCm} cm</span>` : ''}
            </div>
            ${p.birthDate ? `
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                <span>🎂</span>
                <span>${p.birthDate}</span>
                <span style="color: var(--cyan); font-weight: 800;">(${ageStr})</span>
              </div>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap;">
              ${team ? `<span class="badge" style="background: ${team.color}25; color: ${team.color}; border: 1px solid ${team.color}60; font-weight: 800;">🛡️ ${escapeHtml(team.name)}</span>` : `<span class="badge" style="background: var(--surface2); color: var(--muted);">⚪ ${t('unassignedTeam')}</span>`}
              <button type="button" class="btn sm ghost" id="btn-reassign-team-profile" style="padding: 2px 8px; font-size: 11.5px; height: auto;" title="${t('reassignTeam')}">
                ${icon('edit', 12)} ${t('reassignTeam')}
              </button>
            </div>
            <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span class="rating-pill" style="font-size: 13px; font-weight: 900; background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.4)); color: #fef08a; border: 1.5px solid #facc15; padding: 4px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 5px;">
                  ⭐ ${overall.rating.toFixed(1)} ${t('overallRating', 'Rating General')}
                </span>
                <span style="font-size: 10px; font-weight: 800; color: ${overall.mode === 'combined' ? '#38bdf8' : (overall.mode === 'training' ? '#4ade80' : '#facc15')}; margin-left: 6px;">
                  ${overall.mode === 'combined' 
                    ? t('combinedRating', 'Valoración Combinada') 
                    : (overall.mode === 'training' 
                        ? t('onlyTrainingRating', 'Solo Entrenamientos') 
                        : (overall.mode === 'match' ? t('onlyMatchRating', 'Solo Partidos') : t('baseRating', 'Valoración Base')))}
                </span>
              </div>
              ${(() => {
                const mvpCount = Store.calculatePlayerMvpCount ? Store.calculatePlayerMvpCount(p.id) : 0;
                return mvpCount > 0 ? `<span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #fde047; border: 1px solid rgba(250, 204, 21, 0.5); font-weight: 800; font-size: 11px;">⭐ ${mvpCount}x MVP</span>` : '';
              })()}
            </div>
          </div>
        </div>

        <!-- Tarjeta de Estado de Vinculación de Perfil y botón de Desvincular -->
        <div class="card" id="card-player-app-link" style="padding: 12px 14px; margin-bottom: 10px; border-radius: 14px; background: var(--surface2); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <span style="font-size: 20px; flex-shrink: 0;">${isLinked ? '📱' : '⚫'}</span>
            <div style="overflow: hidden;">
              <b style="font-size: 13px; color: ${isLinked ? '#38bdf8' : 'var(--muted)'}; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                ${isLinked ? t('playerLinkedToDevice', 'Perfil vinculado al teléfono') : t('playerNotLinkedToDevice', 'Perfil no vinculado todavía')}
              </b>
              <span style="font-size: 11px; color: var(--muted); display: block; line-height: 1.3;">
                ${isLinked ? t('profileLinkedActiveDesc', 'El jugador tiene la app activa en su teléfono') : t('profileNotLinkedDesc', 'El jugador aún no ha reclamado su perfil en la app')}
              </span>
            </div>
          </div>
          <button type="button" class="btn sm" id="btn-unlink-player-profile" style="flex-shrink: 0; font-size: 11.5px; font-weight: 800; padding: 6px 12px; border-radius: 8px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); cursor: pointer;" title="${t('unlinkProfile', 'Desvincular Perfil')}">
            🔗 ${t('unlink', 'Desvincular')}
          </button>
        </div>

        ${hasParentContact ? `
          <!-- Tarjeta de Contacto de Padres / Tutores (Plegable con alto contraste) -->
          <div class="card" id="card-parent-contact" style="padding: 12px 14px; margin-bottom: 10px; border: 1.5px solid rgba(168, 85, 247, 0.4); background: rgba(168, 85, 247, 0.08); border-radius: 14px; cursor: pointer; user-select: none;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">👨‍👩‍👦</span>
                <div>
                  <b style="font-size: 12.5px; color: #d8b4fe; display: block;">${t('parentContact', 'Contacto de Padres / Tutores')}</b>
                  <span style="font-size: 13.5px; color: #ffffff; font-weight: 800;">${escapeHtml(p.parentContact.name || t('guardian', 'Tutor'))}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="badge" style="background: rgba(168, 85, 247, 0.25); color: #c084fc; font-size: 10px; font-weight: 800;">${t('guardian', 'Tutor')}</span>
                <span id="parent-contact-arrow" style="color: #c084fc; font-size: 13px; font-weight: 900; transition: transform 0.2s;">▼</span>
              </div>
            </div>

            <!-- Información desplegada al pulsar la tarjeta -->
            <div id="parent-contact-details" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(168, 85, 247, 0.25);">
              ${p.parentContact.phone ? `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                  <span style="color: #94a3b8; font-weight: 700;">📞 ${t('parentPhone', 'Teléfono')}:</span>
                  <b style="color: #ffffff; font-size: 13.5px; letter-spacing: 0.5px;">${escapeHtml(p.parentContact.phone)}</b>
                </div>
              ` : ''}
              ${p.parentContact.email ? `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
                  <span style="color: #94a3b8; font-weight: 700;">✉️ ${t('parentEmail', 'Email')}:</span>
                  <b style="color: #ffffff; font-size: 13px;">${escapeHtml(p.parentContact.email)}</b>
                </div>
              ` : ''}
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;" onclick="event.stopPropagation();">
                ${p.parentContact.phone ? `
                  <a href="tel:${p.parentContact.phone.replace(/\s+/g, '')}" class="btn sm" style="text-decoration: none; font-size: 12px; height: 34px; padding: 0 12px; background: #0284c7; color: #ffffff !important; border: 1.5px solid #38bdf8; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                    📞 ${t('callGuardian', 'Llamar')}
                  </a>
                  <a href="https://wa.me/${p.parentContact.phone.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="btn sm" style="text-decoration: none; font-size: 12px; height: 34px; padding: 0 12px; background: #16a34a; color: #ffffff !important; border: 1.5px solid #22c55e; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                    💬 WhatsApp
                  </a>
                ` : ''}
                ${p.parentContact.email ? `
                  <a href="mailto:${escapeHtml(p.parentContact.email)}" class="btn sm" style="text-decoration: none; font-size: 12px; height: 34px; padding: 0 12px; background: rgba(255,255,255,0.14); color: #ffffff !important; border: 1.5px solid rgba(255,255,255,0.4); font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                    ✉️ ${t('emailGuardian', 'Email')}
                  </a>
                ` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Botón para chatear directamente con este jugador -->
        <div style="margin-bottom: 8px;">
          <button class="btn sm primary block" id="btn-player-chat-direct" style="height: 38px; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;">
            💬 ${t('chatWithPlayer', 'Chatear con este jugador')}
          </button>
        </div>

        <!-- Botones de Acción de este Jugador -->
        <div class="btn-row" style="margin-bottom: 8px;">
          <button class="btn sm primary grow" id="btn-player-add-manual-data">
            ${icon('plus', 16)} ${t('addDataManually')}
          </button>
          <button class="btn sm grow" id="btn-player-export-json">
            ${icon('file', 16)} ${t('exportJSON')}
          </button>
        </div>

        <!-- Accesos directos a Comparador H2H, Ficha de Partido, Carta FUT e Informe Mensual -->
        <div class="btn-row" style="margin-bottom: 8px;">
          <button class="btn sm ghost grow" id="btn-player-h2h">
            ${icon('compare', 16)} ${t('headToHead')}
          </button>
          <button class="btn sm ghost grow" id="btn-player-match-card">
            ${icon('medal', 16)} ${t('playerCard')}
          </button>
          <button class="btn sm grow" id="btn-player-fut-card" style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.3)); color: #facc15; border: 1.5px solid #eab308; font-weight: 800;">
            🃏 ${t('futCardTitle', 'Carta FUT')}
          </button>
        </div>
        <div class="btn-row" style="margin-bottom: 12px; gap: 8px;">
          <button class="btn sm grow" id="btn-player-monthly-report" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3)); color: #60a5fa; border: 1.5px solid #3b82f6; font-weight: 800; flex: 1;">
            📄 ${t('monthlyReport', 'Informe Mensual de Progreso (PDF)')}
          </button>
          <button class="btn sm" id="btn-request-player-cache-purge" style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1.5px solid rgba(244, 63, 94, 0.4); font-weight: 800; font-size: 11.5px; white-space: nowrap;" title="Pedir a este jugador que borre la caché de su app para recargar los datos actualizados">
            🧹 ${t('clearPlayerCacheBtn', 'Borrar Caché Jugador')}
          </button>
        </div>

        <!-- Misión Semanal del Míster -->
        <div class="card" id="card-player-weekly-mission" style="padding: 12px 14px; margin-bottom: 14px; border-radius: 14px; background: ${p.weeklyMission ? (p.weeklyMission.status === 'completed' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(168, 85, 247, 0.12)') : 'var(--surface2)'}; border: 1.5px solid ${p.weeklyMission ? (p.weeklyMission.status === 'completed' ? 'rgba(34, 197, 94, 0.45)' : 'rgba(168, 85, 247, 0.45)') : 'var(--border)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🎯</span>
              <b style="font-size: 13px; color: ${p.weeklyMission ? (p.weeklyMission.status === 'completed' ? '#4ade80' : '#c084fc') : 'var(--text)'};">
                ${t('weeklyMissionTitle', 'Misión Semanal del Míster')}
              </b>
            </div>
            ${p.weeklyMission ? `
              <span class="badge" style="font-size: 11px; font-weight: 800; background: ${p.weeklyMission.status === 'completed' ? '#16a34a' : 'rgba(250, 204, 21, 0.2)'}; color: ${p.weeklyMission.status === 'completed' ? '#fff' : '#fde047'};">
                ${p.weeklyMission.status === 'completed' ? t('challengeCompleted', '¡Misión Cumplida! 🎉') : t('challengePending', 'En curso ⏳')}
              </span>
            ` : ''}
          </div>

          ${p.weeklyMission ? `
            <div style="font-size: 13px; font-weight: 700; color: #fff; margin: 6px 0 10px; line-height: 1.4; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 10px;">
              "${escapeHtml((p.weeklyMission['text_' + ((Store.state.settings && Store.state.settings.lang) || 'es')]) || p.weeklyMission.text)}"
            </div>
            ${p.weeklyMission.comment ? `
              <div style="font-size: 11.5px; color: #cbd5e1; margin: -4px 0 10px; background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 8px; border-left: 3px solid #c084fc;">
                <span style="font-weight: 800; color: #e9d5ff;">💬 ${t('coachNote', 'Nota del Míster')}:</span> "${escapeHtml(p.weeklyMission.comment)}"
              </div>
            ` : ''}
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn sm" id="btn-toggle-mission-status" style="font-size: 11.5px; font-weight: 800; background: ${p.weeklyMission.status === 'completed' ? 'var(--surface2)' : '#16a34a'}; color: #fff;">
                ${p.weeklyMission.status === 'completed' ? '🔄 Reabrir Misión' : '✅ ' + t('markCompleted', 'Marcar como Cumplida')}
              </button>
              <button type="button" class="btn sm ghost" id="btn-edit-mission" style="font-size: 11.5px;">
                ✏️ ${t('assignMission', 'Cambiar')}
              </button>
              <button type="button" class="btn sm ghost danger" id="btn-delete-mission" style="font-size: 11.5px;">
                🗑️
              </button>
            </div>
          ` : `
            <p style="font-size: 12px; color: var(--muted); margin: 4px 0 10px;">
              ${t('weeklyMissionDesc', 'Asigna un objetivo táctico o técnico individual para motivar al jugador esta semana.')}
            </p>
            <button type="button" class="btn sm primary" id="btn-assign-new-mission" style="font-size: 12px; font-weight: 800;">
              🎯 ${t('assignMission', 'Asignar Misión Semanal')}
            </button>
          `}
        </div>

        <!-- Selector de Sub-Pestañas: Entrenamientos vs Partidos -->
        <div class="segmented profile-view-tabs" style="margin-bottom: 14px; margin-top: 6px;">
          <button type="button" class="${activeProfileTab === 'training' ? 'active t-training' : ''}" data-ptab="training">
            ⚽ ${t('trainingsTab', 'Entrenamientos')} (${aggTraining.count})
          </button>
          <button type="button" class="${activeProfileTab === 'match' ? 'active t-match' : ''}" data-ptab="match">
            🏆 ${t('matchesTab', 'Partidos')} (${aggMatch.count})
          </button>
        </div>

        <div id="player-profile-tab-content">
          ${renderProfileTabContent(activeProfileTab)}
        </div>
      `;

      function renderProfileTabContent(tabName) {
        const isMatch = (tabName === 'match');
        const sessList = isMatch ? matchSessions : trainingSessions;
        const agg = isMatch ? aggMatch : aggTraining;

        if (agg.count === 0) {
          if (isMatch) {
            return `
              <div class="card" style="padding: 28px 16px; text-align: center; border: 1.5px dashed var(--border); margin: 12px 0; background: rgba(15, 23, 42, 0.4); border-radius: 16px;">
                <div style="font-size: 38px; margin-bottom: 8px;">🏟️</div>
                <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0 0 4px;">${t('noMatchesRecordedYet', 'Sin partidos registrados todavía')}</h3>
                <p style="font-size: 12px; color: var(--muted); margin: 0 auto; max-width: 280px; line-height: 1.4;">
                  ${t('noMatchesRecordedDesc', 'Este jugador aún no tiene minutos ni estadísticas registradas en partidos de competición.')}
                </p>
              </div>
            `;
          } else {
            return `
              <div class="card" style="padding: 24px 16px; text-align: center; border: 1.5px dashed var(--border); margin: 12px 0; background: rgba(15, 23, 42, 0.4); border-radius: 16px;">
                <div style="font-size: 36px; margin-bottom: 8px;">⚽</div>
                <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0 0 4px;">${t('noTrainingsRecordedYet', 'Sin entrenamientos registrados todavía')}</h3>
                <p style="font-size: 12px; color: var(--muted); margin: 0 auto; max-width: 280px; line-height: 1.4;">
                  Este jugador aún no tiene datos registrados en sesiones de entrenamiento.
                </p>
              </div>
            `;
          }
        }

        const tPassOk = agg.totals.passOk || 0;
        const tPassKo = agg.totals.passKo || 0;
        const tTotalPass = tPassOk + tPassKo;
        const tPassPct = tTotalPass > 0 ? Math.round((tPassOk / tTotalPass) * 100) : 0;

        const tShotOn = agg.totals.shotOn || 0;
        const tShotOff = agg.totals.shotOff || 0;
        const tTotalShots = tShotOn + tShotOff;
        const tShotPct = tTotalShots > 0 ? Math.round((tShotOn / tTotalShots) * 100) : 0;

        const tTotalGoals = agg.totals.goal || 0;
        const tConvPct = tTotalShots > 0 ? Math.round((tTotalGoals / tTotalShots) * 100) : (tTotalGoals > 0 ? 100 : 0);

        const tabRadar = Store.calculatePlayerRadar(p.id, sessList);
        const tabRating = Store.calculateMatchRating(agg.totals, p.mainPosition);
        const tabTimeline = Store.playerTimeline(p.id, 'rating', sessList);

        return `
          <!-- Tarjeta de Valoración y Asistencia del Contexto -->
          <div class="card" style="padding: 12px 14px; margin-bottom: 12px; border: 1px solid ${isMatch ? 'rgba(250, 204, 21, 0.35)' : 'rgba(34, 211, 238, 0.35)'}; background: ${isMatch ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(15, 23, 42, 0.8))' : 'linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(15, 23, 42, 0.8))'}; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: ${isMatch ? '#fde047' : '#38bdf8'}; text-transform: uppercase;">
                ${isMatch ? '🏆 ' + t('match') : '⚽ ' + t('training')} • ${t('performanceRating', 'Nota de Rendimiento')}
              </div>
              <div style="font-size: 26px; font-weight: 900; color: #fff; margin-top: 2px;">
                ${tabRating.toFixed(1)} <span style="font-size: 14px; color: var(--muted); font-weight: 700;">/ 10</span>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <span class="badge ${isMatch ? 'match' : 'training'}" style="font-size: 11px; font-weight: 900; padding: 4px 10px;">
                🟢 ${agg.count} ${isMatch ? t('matchesTab', 'Partidos') : t('trainingsTab', 'Entrenamientos')}
              </span>
              <small style="font-size: 10.5px; color: #86efac; font-weight: 800;">
                📋 ${t('attendance', 'Asistencia')}: ${agg.attendedCount != null ? agg.attendedCount : agg.count}
              </small>
            </div>
          </div>

          <!-- Estadísticas clave en porcentaje: % Pase, % Puntería, % Conversión -->
          <div class="rings" style="margin-bottom: 12px;">
            <div class="ring-card">
              <div class="ring">
                ${renderProgressRing(tPassPct, '#22c55e')}
                <span class="r-val" style="color: #22c55e;">${tPassPct}%</span>
              </div>
              <span>${t('passAccuracy')}</span>
              <small>${tPassOk}/${tTotalPass}</small>
            </div>

            <div class="ring-card">
              <div class="ring">
                ${renderProgressRing(tShotPct, '#06b6d4')}
                <span class="r-val" style="color: #06b6d4;">${tShotPct}%</span>
              </div>
              <span>${t('shotAccuracy')}</span>
              <small>${tShotOn}/${tTotalShots}</small>
            </div>

            <div class="ring-card">
              <div class="ring">
                ${renderProgressRing(Math.min(100, tConvPct), '#facc15')}
                <span class="r-val" style="color: #facc15;">${tConvPct}%</span>
              </div>
              <span>${t('goalConversion')}</span>
              <small>${tTotalGoals} ${t('stat_goal')}</small>
            </div>
          </div>

          <!-- Radar de Habilidades -->
          <div class="section-title"><span>${t('skillRadar')} (${isMatch ? t('matchesTab') : t('trainingsTab')})</span></div>
          <div class="radar-container card" style="margin-bottom: 12px;">
            ${renderRadarSVG(tabRadar)}
          </div>

          <!-- Cuadro de Información Disciplina y Fair Play -->
          <div class="discipline-card btn-profile-discipline-action" style="cursor: pointer;" title="${t('adjustDiscipline')}">
            <div class="discipline-score">${tabRadar.dis || 100}</div>
            <div class="grow" style="text-align: left;">
              <div style="font-size: 13.5px; font-weight: 800; color: var(--text);">
                🧠 ${t('disciplineFairPlay')} (${tabRadar.dis || 100} / 99)
              </div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
                ${(agg.totals.yellow || 0) === 0 && (agg.totals.red || 0) === 0 
                  ? (isEn ? 'Exemplary conduct • No cards accumulated' : 'Conducta ejemplar • Sin tarjetas acumuladas') 
                  : (isEn ? `Accumulated cards: 🟨 ${agg.totals.yellow || 0} • 🟥 ${agg.totals.red || 0}` : `Tarjetas acumuladas: 🟨 ${agg.totals.yellow || 0} • 🟥 ${agg.totals.red || 0}`)}
              </div>
            </div>
            <div class="chev" style="opacity: 0.8; color: #22c55e;">${icon('edit', 16)}</div>
          </div>

          <div class="kpis" style="margin-bottom: 14px;">
            <div class="kpi">
              <span class="k-emoji">⚽</span>
              <b class="num">${agg.totals.touches || 0}</b>
              <span>${t('stat_touches')}</span>
            </div>
            <div class="kpi">
              <span class="k-emoji">🅰️</span>
              <b class="num" style="color: #a855f7;">${agg.totals.assist || 0}</b>
              <span>${t('stat_assist')}</span>
            </div>
            <div class="kpi">
              <span class="k-emoji">🛡️</span>
              <b class="num" style="color: #3b82f6;">${agg.totals.recovery || 0}</b>
              <span>${t('stat_recovery')}</span>
            </div>
          </div>

          <!-- Tarjeta Dedicada: ⚔️ Duelos 1v1 -->
          ${(() => {
            const dWonGoal = agg.totals.duel1v1WonGoal || 0;
            const dWonStop = agg.totals.duel1v1WonStop || 0;
            const dLostTurnover = agg.totals.duel1v1LostTurnover || 0;
            const dLostGoal = agg.totals.duel1v1LostGoal || 0;
            const dWon = dWonGoal + dWonStop;
            const dLost = dLostGoal + dLostTurnover;
            const dTotal = dWon + dLost;
            const dWinRate = dTotal > 0 ? Math.round((dWon / dTotal) * 100) : 0;
            return `
              <div class="card duel-card-profile" style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                <div style="background: rgba(0, 0, 0, 0.45); border: 1.5px solid ${dWinRate >= 50 ? '#22c55e' : (dTotal > 0 ? '#ef4444' : 'var(--border)')}; border-radius: 12px; width: 62px; height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="font-size: 16px; font-weight: 900; color: ${dWinRate >= 50 ? '#86efac' : (dTotal > 0 ? '#fca5a5' : '#cbd5e1')};">${dWinRate}%</span>
                  <span style="font-size: 8.5px; font-weight: 800; color: var(--muted); text-transform: uppercase;">WIN RATE</span>
                </div>
                <div class="grow" style="text-align: left; min-width: 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-size: 13.5px; font-weight: 900; color: #fff;">⚔️ ${t('duels1v1', 'Duelos 1v1')}</span>
                    <span style="font-size: 11.5px; font-weight: 800;">
                      <span style="color: #4ade80;">${t('duels1v1Won', 'Ganados')}: ${dWon}</span> • <span style="color: #f87171;">${t('duels1v1Lost', 'Perdidos')}: ${dLost}</span>
                    </span>
                  </div>
                  <div style="height: 6px; width: 100%; background: ${dTotal > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)'}; border-radius: 999px; overflow: hidden; display: flex; margin: 4px 0;">
                    <div style="width: ${dWinRate}%; background: #22c55e; height: 100%;"></div>
                  </div>
                  <div style="font-size: 11px; color: var(--muted);">
                    (${dWonGoal} ${t('stat_goal', 'goles')} · ${dWonStop} ${t('stops', 'cierres defensivos')})
                  </div>
                </div>
              </div>
            `;
          })()}

          <!-- Zonas del campo táctico (Heatmap) -->
          <div class="section-title"><span>${t('pitchZones')} (Puntos Calientes - ${isMatch ? t('matchesTab') : t('trainingsTab')})</span></div>
          <div class="card" style="margin-bottom: 14px; text-align: center;">
            ${renderPlayerPitchHeatmapHtml(p.id, sessList)}
          </div>

          <!-- Evolución Temporal / Curva de Progreso -->
          <div class="section-title"><span>${t('evolution')} (${isMatch ? t('matchesTab') : t('trainingsTab')})</span></div>
          <div class="card" style="margin-bottom: 14px; text-align: center;">
            ${renderTimelineSVG(tabTimeline)}
          </div>

          <!-- Desglose de Acciones del Contexto -->
          <div class="section-title"><span>Desglose de estadísticas (${isMatch ? t('matchesTab') : t('trainingsTab')})</span></div>
          <table class="stat-table card">
            <thead>
              <tr>
                <th>Acción</th>
                <th class="${isMatch ? 'mt' : 'tr'}">${isMatch ? t('match') : t('training')}</th>
              </tr>
            </thead>
            <tbody>
              ${Store.STATS.map(x => {
                const count = agg.totals[x.key] || 0;
                if (count === 0) return '';
                return `
                  <tr>
                    <td><span class="e">${x.emoji}</span>${x.short}</td>
                    <td class="${isMatch ? 'mt' : 'tr'}"><b>${count}</b></td>
                  </tr>
                `;
              }).join('')}
              ${(() => {
                const dWon = (agg.totals.duel1v1WonGoal || 0) + (agg.totals.duel1v1WonStop || 0);
                const dLost = (agg.totals.duel1v1LostGoal || 0) + (agg.totals.duel1v1LostTurnover || 0);
                const dTotal = dWon + dLost;
                const dWinRate = dTotal > 0 ? Math.round((dWon / dTotal) * 100) : 0;
                if (dTotal === 0) return '';
                return `
                  <tr style="background: rgba(34, 197, 94, 0.05);">
                    <td><span class="e">⚔️</span>${t('duels1v1Won', '1v1 Won')}</td>
                    <td class="${isMatch ? 'mt' : 'tr'}"><b style="color: #4ade80;">${dWon}</b></td>
                  </tr>
                  <tr style="background: rgba(239, 68, 68, 0.05);">
                    <td><span class="e">❌</span>${t('duels1v1Lost', '1v1 Lost')}</td>
                    <td class="${isMatch ? 'mt' : 'tr'}"><b style="color: #f87171;">${dLost}</b></td>
                  </tr>
                  <tr style="background: rgba(34, 211, 238, 0.05);">
                    <td><span class="e">🏆</span>${t('duels1v1WinRate', '1v1 Win %')}</td>
                    <td class="${isMatch ? 'mt' : 'tr'}"><b style="color: #22d3ee;">${dWinRate}%</b></td>
                  </tr>
                `;
              })()}
            </tbody>
          </table>

          <div class="section-title" style="margin-top: 18px;">
            <span>Sesiones registradas (${agg.count})</span>
          </div>

          ${agg.sessions.slice(-10).reverse().map(item => {
            const activeStats = Store.STATS.filter(x => (item.stats[x.key] || 0) > 0);
            const attSt = item.attendanceStatus || Store.getPlayerAttendanceStatus(item.session, p.id);
            const attLabel = attSt === 'late'
              ? `⏰ ${t('attLate', 'Retraso')}`
              : `🟢 ${t('attPresent', 'Presente')}`;
            return `
              <div class="session-line">
                <div class="sl-head" style="flex-wrap: wrap;">
                  <span class="badge ${item.session.type}">${item.session.type === 'match' ? t('match') : t('training')}</span>
                  <b>${escapeHtml(Store.sessionTitle(item.session))}</b>
                  <span class="badge" style="background: rgba(34, 197, 94, 0.16); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.38); font-size: 10px; font-weight: 800; padding: 1px 6px;">${attLabel}</span>
                  <span class="muted" style="font-size: 11px;">${item.session.date}</span>
                </div>
                <div class="mini-stats">
                  ${activeStats.length > 0 ? activeStats.map(x => `
                    <span>${x.emoji} ${x.short}: <b>${item.stats[x.key]}</b></span>
                  `).join('') : `<span style="color: #86efac; font-weight: 700;">✅ ${t('attendanceRecordedNoTracking', 'Asistencia registrada (Sin seguimiento individual)')}</span>`}
                </div>
              </div>
            `;
          }).join('')}
        `;
      }

      // Desplegable de contacto de padres
      const cardParent = body.querySelector('#card-parent-contact');
      if (cardParent) {
        cardParent.onclick = () => {
          const details = body.querySelector('#parent-contact-details');
          const arrow = body.querySelector('#parent-contact-arrow');
          if (!details) return;
          const isHidden = details.style.display === 'none';
          details.style.display = isHidden ? 'block' : 'none';
          if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
          haptic(15);
        };
      }

      // Chatear con este jugador directamente
      const btnChatDirect = body.querySelector('#btn-player-chat-direct');
      if (btnChatDirect) {
        btnChatDirect.onclick = () => {
          closeSheet();
          if (window.ChatUI && window.ChatUI.startDirectChat) {
            window.ChatUI.startDirectChat(p.id, Store.playerName(p), {
              currentUserId: 'coach',
              currentUserName: 'Entrenador',
              isCoach: true
            });
          }
        };
      }

      // Añadir datos manuales
      body.querySelector('#btn-player-add-manual-data').onclick = () => {
        showAddManualDataModal(p, () => {
          closeSheet();
          showPlayerProfileModal(p.id);
        });
      };

      // Exportar en JSON
      body.querySelector('#btn-player-export-json').onclick = () => {
        IO.exportPlayerJSON(p.id);
      };

      // Cambiar de Equipo directamente desde el perfil
      const btnReassign = body.querySelector('#btn-reassign-team-profile');
      if (btnReassign) {
        btnReassign.onclick = () => {
          showQuickAssignTeamModal(p, () => {
            closeSheet();
            showPlayerProfileModal(p.id);
          });
        };
      }

      // Comparador Cara a Cara
      body.querySelector('#btn-player-h2h').onclick = () => {
        closeSheet();
        showHeadToHeadModal(p.id, null);
      };

      // Ficha de Jugador
      const btnCard = body.querySelector('#btn-player-match-card');
      if (btnCard) {
        btnCard.onclick = () => {
          showPlayerCardModal(p, aggAll.sessions.length ? aggAll.sessions[aggAll.sessions.length - 1].session : null);
        };
      }

      // Carta FUT Coleccionable
      const btnFut = body.querySelector('#btn-player-fut-card');
      if (btnFut) {
        btnFut.onclick = () => {
          try {
            if (window.FutCard && FutCard.showModal) {
              const streak = Store.calculatePlayerAttendanceStreak ? Store.calculatePlayerAttendanceStreak(p.id) : 0;
              const ovr = FutCard.computeOvr ? FutCard.computeOvr(playerRadar, p.mainPosition) : Math.min(99, Math.max(45, Math.round(matchRating * 10)));
              const mvpCount = Store.calculatePlayerMvpCount ? Store.calculatePlayerMvpCount(p.id) : (p.mvpCount || 0);
              FutCard.showModal({
                player: p,
                radar: playerRadar,
                ovr: ovr,
                team: team,
                streak: streak,
                mvpCount: mvpCount,
                lang: (Store.state.settings && Store.state.settings.lang) || 'es'
              });
            } else {
              toast('FUT Card no disponible en este momento', 'warning');
            }
          } catch (err) {
            console.error('Error opening FUT card modal:', err);
            toast('Error abriendo Carta FUT: ' + err.message, 'error');
          }
        };
      }

      // Informe Mensual de Progreso (PDF)
      const btnReport = body.querySelector('#btn-player-monthly-report');
      if (btnReport) {
        btnReport.onclick = () => {
          showMonthlyProgressReportModal(p);
        };
      }

      // Orden individual de borrado de caché para este jugador
      const btnPurgePlayer = body.querySelector('#btn-request-player-cache-purge');
      if (btnPurgePlayer) {
        btnPurgePlayer.onclick = () => {
          confirmDialog(
            '🧹 Forzar Borrado de Caché para ' + Store.playerName(p),
            '¿Deseas enviar una orden individual de borrado de caché a ' + Store.playerName(p) + '? La próxima vez que abra su app, se vaciará su caché local para cargar los datos más recientes sin afectar al resto de la plantilla.',
            () => {
              p.forceCachePurgeTimestamp = Date.now();
              Store.save();
              if (window.Cloud && window.Cloud.pushCoachState) {
                window.Cloud.pushCoachState(Store.state, true);
              }
              toast('🚀 Orden enviada: la app de ' + Store.playerName(p) + ' borrará su caché al abrirse', 'success');
              haptic(35);
            },
            'Pedir Borrado',
            'warning'
          );
        };
      }

      // Misión Semanal: Marcar completada o reabrir
      const btnToggleMiss = body.querySelector('#btn-toggle-mission-status');
      if (btnToggleMiss && p.weeklyMission) {
        btnToggleMiss.onclick = () => {
          const nextStatus = p.weeklyMission.status === 'completed' ? 'pending' : 'completed';
          Store.setPlayerMissionStatus(p.id, nextStatus);
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          toast(nextStatus === 'completed' ? t('challengeCompleted', '¡Misión Cumplida! 🎉') : t('challengePending', 'En curso ⏳'), 'success');
          closeSheet();
          showPlayerProfileModal(p.id);
        };
      }

      // Misión Semanal: Asignar nueva o cambiar
      const btnAssignMiss = body.querySelector('#btn-assign-new-mission');
      if (btnAssignMiss) {
        btnAssignMiss.onclick = () => {
          showAssignMissionModal(p, () => {
            closeSheet();
            showPlayerProfileModal(p.id);
          });
        };
      }

      const btnEditMiss = body.querySelector('#btn-edit-mission');
      if (btnEditMiss) {
        btnEditMiss.onclick = () => {
          showAssignMissionModal(p, () => {
            closeSheet();
            showPlayerProfileModal(p.id);
          });
        };
      }

      // Misión Semanal: Eliminar
      const btnDelMiss = body.querySelector('#btn-delete-mission');
      if (btnDelMiss) {
        btnDelMiss.onclick = () => {
          Store.clearPlayerWeeklyMission(p.id);
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          toast(t('savedSuccess', 'Guardado con éxito'), 'info');
          closeSheet();
          showPlayerProfileModal(p.id);
        };
      }

      function bindTabInteractions() {
        body.querySelectorAll('.btn-profile-discipline-action').forEach(el => {
          el.onclick = () => {
            showEditDisciplineModal(p, () => {
              closeSheet();
              showPlayerProfileModal(p.id);
            });
          };
        });
        body.querySelectorAll('[data-skill]').forEach(el => {
          el.onclick = () => {
            const sk = el.getAttribute('data-skill');
            const val = el.getAttribute('data-val');
            showSkillDetailModal(sk, val);
          };
        });
      }

      bindTabInteractions();

      body.querySelectorAll('.profile-view-tabs button').forEach(b => {
        b.onclick = () => {
          const newTab = b.getAttribute('data-ptab');
          activeProfileTab = newTab;
          body.querySelectorAll('.profile-view-tabs button').forEach(x => {
            x.className = (x.getAttribute('data-ptab') === newTab ? `active t-${newTab}` : '');
          });
          const contentEl = body.querySelector('#player-profile-tab-content');
          if (contentEl) {
            contentEl.innerHTML = renderProfileTabContent(newTab);
            bindTabInteractions();
          }
        };
      });

      const btnUnlinkCard = body.querySelector('#btn-unlink-player-profile');
      if (btnUnlinkCard) btnUnlinkCard.onclick = handleUnlinkPlayerAction;
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="btn-edit-p-profile">${icon('edit', 16)} ${t('editPlayer')}</button>
          <button class="btn warning" id="btn-foot-unlink-p-profile" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" title="${t('unlinkProfile', 'Desvincular perfil')}">🔗 ${t('unlink', 'Desvincular')}</button>
          <button class="btn danger" id="btn-del-p-profile" title="${t('deletePlayer')}">${icon('trash', 16)}</button>
        </div>
      `;

      const btnUnlinkFoot = foot.querySelector('#btn-foot-unlink-p-profile');
      if (btnUnlinkFoot) btnUnlinkFoot.onclick = handleUnlinkPlayerAction;

      foot.querySelector('#btn-edit-p-profile').onclick = () => {
        closeSheet();
        showEditPlayerModal(p, () => navigate('players'));
      };

      foot.querySelector('#btn-del-p-profile').onclick = () => {
        confirmDialog(t('deletePlayer'), `${t('confirmDeletePlayer')} (${Store.playerName(p)})`, () => {
          Store.deletePlayer(p.id);
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          closeSheet();
          navigate('players');
        });
      };
    });
  }

  /* =========================================================
     MODAL PARA AÑADIR DATOS MANUALMENTE A UN JUGADOR
     ========================================================= */
  /* =========================================================
     MODAL PARA AÑADIR DATOS MANUALMENTE A UN JUGADOR
     ========================================================= */
  function showAddManualDataModal(player, onDone) {
    const isEn = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() === 'en' : false;
    const currentAgg = Store.playerAggregate(player.id, Store.state.sessions);
    const currentTotals = currentAgg.totals || {};

    const deltas = {};
    Store.STATS.forEach(s => { deltas[s.key] = 0; });

    openSheet(`${t('addDataManually')}: ${Store.playerName(player, true)}`, (body) => {
      body.innerHTML = `
        <div style="background: rgba(34, 211, 238, 0.08); border: 1.5px solid rgba(34, 211, 238, 0.3); border-radius: 12px; padding: 10px 12px; margin-bottom: 14px;">
          <p style="font-size: 12.5px; color: #cbd5e1; margin: 0; line-height: 1.45;">
            ${isEn 
              ? 'Add extra counts directly to the player\'s accumulated totals. New actions will immediately sum to their historical stats:' 
              : 'Añade cantidades directamente al acumulado del jugador. Las acciones que introduzcas se sumarán de inmediato a sus totales históricos:'}
          </p>
        </div>

        <div class="edit-grid" style="max-height: 52vh; overflow-y: auto; padding-right: 2px;">
          ${Store.STATS.map(item => {
            const curVal = currentTotals[item.key] || 0;
            return `
              <div class="edit-row" style="display: flex; align-items: center; justify-content: space-between; padding: 9px 10px; border-bottom: 1px solid var(--border); gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                  <span class="e-emoji" style="font-size: 18px; flex-shrink: 0;">${item.emoji}</span>
                  <div style="overflow: hidden;">
                    <b class="e-lbl" style="font-size: 13px; color: #fff; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.label}</b>
                    <span id="preview-${item.key}" style="font-size: 11px; color: var(--muted); font-weight: 700;">
                      ${isEn ? 'Current' : 'Actual'}: <b>${curVal}</b>
                    </span>
                  </div>
                </div>

                <div class="stepper" style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                  <button type="button" class="btn-m-step" data-k="${item.key}" style="width: 32px; height: 32px; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border); color: #fff; font-size: 16px; font-weight: 900; cursor: pointer;">-</button>
                  <input type="number" min="0" max="999" class="step-num-input" id="m-val-${item.key}" data-k="${item.key}" value="0" inputmode="numeric" style="width: 44px; height: 32px; text-align: center; border-radius: 8px; border: 1px solid var(--border); background: var(--bg2); color: #fff; font-weight: 900; font-size: 14px;" />
                  <button type="button" class="btn-p-step" data-k="${item.key}" style="width: 32px; height: 32px; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border); color: var(--cyan); font-size: 16px; font-weight: 900; cursor: pointer;">+</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      function updatePreview(k) {
        const cur = currentTotals[k] || 0;
        const add = deltas[k] || 0;
        const prevEl = body.querySelector(`#preview-${k}`);
        if (!prevEl) return;
        if (add > 0) {
          prevEl.innerHTML = `<span style="color: #86efac; font-weight: 800;">${cur} ➔ ${cur + add} (+${add})</span>`;
        } else {
          prevEl.innerHTML = `${isEn ? 'Current' : 'Actual'}: <b>${cur}</b>`;
        }
      }

      body.querySelectorAll('.step-num-input').forEach(inp => {
        const k = inp.getAttribute('data-k');
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('input', () => {
          const val = Math.max(0, parseInt(inp.value, 10) || 0);
          deltas[k] = val;
          updatePreview(k);
        });
        inp.addEventListener('blur', () => {
          inp.value = deltas[k] || 0;
          updatePreview(k);
        });
      });

      body.querySelectorAll('.btn-m-step').forEach(btn => {
        btn.onclick = () => {
          const k = btn.getAttribute('data-k');
          if (deltas[k] > 0) {
            deltas[k]--;
            const inp = body.querySelector(`#m-val-${k}`);
            if (inp) inp.value = deltas[k];
            updatePreview(k);
            haptic(15);
          }
        };
      });

      body.querySelectorAll('.btn-p-step').forEach(btn => {
        btn.onclick = () => {
          const k = btn.getAttribute('data-k');
          deltas[k] = (deltas[k] || 0) + 1;
          const inp = body.querySelector(`#m-val-${k}`);
          if (inp) inp.value = deltas[k];
          updatePreview(k);
          haptic(20);
        };
      });
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="btn-cancel-man">${t('cancel')}</button>
          <button class="btn primary" id="btn-save-man" style="font-weight: 900;">💾 ${t('saveChanges')}</button>
        </div>
      `;

      foot.querySelector('#btn-cancel-man').onclick = closeSheet;

      foot.querySelector('#btn-save-man').onclick = () => {
        const totalAdded = Object.values(deltas).reduce((sum, v) => sum + v, 0);
        if (totalAdded > 0) {
          Store.addManualPlayerSession(player.id, {
            type: 'training',
            date: new Date().toISOString().slice(0, 10),
            title: isEn ? 'Manual Stats Addition' : 'Ajuste manual de estadísticas'
          }, deltas);
          toast(t('savedSuccess'), 'success');
        }
        closeSheet();
        if (onDone) onDone();
      };
    });
  }

  /* Helper: Cálculo exacto de edad en años y meses */
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
    const curL = (lang || (window.I18N && window.I18N.getLang()) || (Store.state.settings && Store.state.settings.lang) || 'es');
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
    } else if (curL === 'en') {
      const yStr = years === 1 ? '1 year' : `${years} years`;
      const mStr = months === 1 ? '1 month' : `${months} months`;
      return `${yStr}, ${mStr}`;
    } else {
      const yStr = years === 1 ? '1 año' : `${years} años`;
      const mStr = months === 1 ? '1 mes' : `${months} meses`;
      return `${yStr}, ${mStr}`;
    }
  }

  const TACTICAL_PITCH_POSITIONS = [
    { code: 'DC',  name: 'Delantero Centro / Striker', short: 'DC', x: 50, y: 15 },
    { code: 'EI',  name: 'Extremo Izquierdo / Left Winger', short: 'EI', x: 20, y: 24 },
    { code: 'ED',  name: 'Extremo Derecho / Right Winger', short: 'ED', x: 80, y: 24 },
    { code: 'MCO', name: 'Mediapunta / Attacking Mid', short: 'MCO', x: 50, y: 36 },
    { code: 'MC',  name: 'Mediocentro / Central Mid', short: 'MC', x: 50, y: 50 },
    { code: 'MCD', name: 'Mediocentro Defensivo / CDM', short: 'MCD', x: 50, y: 64 },
    { code: 'LI',  name: 'Lateral Izquierdo / Left Back', short: 'LI', x: 18, y: 76 },
    { code: 'DFC', name: 'Defensa Central / Centre Back', short: 'DFC', x: 50, y: 76 },
    { code: 'LD',  name: 'Lateral Derecho / Right Back', short: 'LD', x: 82, y: 76 },
    { code: 'POR', name: 'Portero / Goalkeeper', short: 'POR', x: 50, y: 90 }
  ];

  /* Modal táctico interactivo de selección de posición sobre el campo de fútbol (Stacked overlay sin cerrar hojas inferiores) */
  function showPitchPositionPickerModal(currentPos, onSelect) {
    let selected = currentPos || 'DC';

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 14px;';

    const isEn = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() === 'en' : false;

    overlay.innerHTML = `
      <div class="dialog-box" style="width: 100%; max-width: 380px; max-height: 94vh; overflow-y: auto; background: var(--surface); border: 1.5px solid var(--border); border-radius: 20px; padding: 18px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: #fff;">
            🏟️ ${t('pitchPositionPicker', 'Táctico: Seleccionar Posición')}
          </h3>
          <button type="button" class="icon-btn ghost" id="pitch-dlg-close-x" style="width: 32px; height: 32px; font-size: 16px;">✕</button>
        </div>

        <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px; text-align: center;">
          ${t('selectPositionOnPitchDesc', 'Toca una posición sobre el campo táctico para seleccionarla.')}
        </p>

        <div style="position: relative; width: 100%; max-width: 290px; aspect-ratio: 2 / 3; margin: 0 auto 12px; background: linear-gradient(180deg, #15803d 0%, #166534 50%, #15803d 100%); border: 2.5px solid rgba(255, 255, 255, 0.9); border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.6); user-select: none;" id="tactical-pitch-stage">
          <!-- Bandas de césped cortado -->
          <div style="position: absolute; inset: 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 38px, transparent 38px, transparent 76px); pointer-events: none;"></div>

          <!-- Línea de medio campo -->
          <div style="position: absolute; top: 50%; left: 0; right: 0; border-top: 2px solid rgba(255,255,255,0.7); transform: translateY(-50%); pointer-events: none;"></div>
          <!-- Círculo central -->
          <div style="position: absolute; top: 50%; left: 50%; width: 72px; height: 72px; border: 2px solid rgba(255,255,255,0.7); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none;"></div>
          <div style="position: absolute; top: 50%; left: 50%; width: 6px; height: 6px; background: #fff; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none;"></div>

          <!-- Área rival (arriba) -->
          <div style="position: absolute; top: 0; left: 20%; right: 20%; height: 21%; border: 2px solid rgba(255,255,255,0.7); border-top: none; pointer-events: none;"></div>
          <div style="position: absolute; top: 0; left: 34%; right: 34%; height: 9%; border: 2px solid rgba(255,255,255,0.7); border-top: none; pointer-events: none;"></div>

          <!-- Área propia (abajo) -->
          <div style="position: absolute; bottom: 0; left: 20%; right: 20%; height: 21%; border: 2px solid rgba(255,255,255,0.7); border-bottom: none; pointer-events: none;"></div>
          <div style="position: absolute; bottom: 0; left: 34%; right: 34%; height: 9%; border: 2px solid rgba(255,255,255,0.7); border-bottom: none; pointer-events: none;"></div>

          <!-- Indicador de ataque -->
          <div style="position: absolute; top: 8px; right: 10px; font-size: 10px; color: rgba(255,255,255,0.9); font-weight: 900; background: rgba(0,0,0,0.4); padding: 2px 7px; border-radius: 6px; pointer-events: none;">
            ${isEn ? '⬆️ ATTACK' : '⬆️ ATAQUE'}
          </div>

          <!-- Fichas tácticas interactivas -->
          ${TACTICAL_PITCH_POSITIONS.map(pos => {
            const isSel = (pos.code === selected);
            return `
              <div class="tactical-pitch-pos-token" data-pos-code="${pos.code}" style="position: absolute; top: ${pos.y}%; left: ${pos.x}%; transform: translate(-50%, -50%); width: 42px; height: 42px; border-radius: 50%; background: ${isSel ? '#22d3ee' : '#0f172a'}; border: 2.5px solid ${isSel ? '#fff' : '#38bdf8'}; color: ${isSel ? '#04140a' : '#fff'}; font-weight: 900; font-size: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: ${isSel ? '0 0 16px rgba(34, 211, 238, 0.9), 0 4px 8px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.4)'}; transition: all 0.15s; z-index: 2;">
                <span>${pos.short}</span>
                ${isSel ? '<span style="font-size: 9px; line-height: 1;">✓</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Información de posición seleccionada -->
        <div style="background: var(--surface2); border: 1.5px solid var(--border); border-radius: 12px; padding: 10px; margin-bottom: 12px; text-align: center;">
          <small style="color: var(--muted); text-transform: uppercase; font-weight: 800; font-size: 11px; display: block; margin-bottom: 2px;">
            ${t('selectedPosition', 'Posición seleccionada')}
          </small>
          <div id="pitch-pos-info-name" style="font-size: 15px; font-weight: 900; color: var(--cyan);">
            ${(TACTICAL_PITCH_POSITIONS.find(x => x.code === selected) || {}).name || selected}
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn ghost block" id="btn-cancel-pitch-pos" style="height: 42px; font-size: 13.5px;">
            ${t('cancel', 'Cancelar')}
          </button>
          <button type="button" class="btn primary block" id="btn-confirm-pitch-pos" style="font-weight: 900; font-size: 13.5px; height: 42px;">
            ✅ ${t('confirmPosition', 'Confirmar Posición')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#pitch-dlg-close-x').onclick = close;
    overlay.querySelector('#btn-cancel-pitch-pos').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelectorAll('.tactical-pitch-pos-token').forEach(token => {
      token.onclick = () => {
        const code = token.getAttribute('data-pos-code');
        selected = code;
        haptic(25);

        overlay.querySelectorAll('.tactical-pitch-pos-token').forEach(el => {
          const elCode = el.getAttribute('data-pos-code');
          const isIt = elCode === selected;
          el.style.background = isIt ? '#22d3ee' : '#0f172a';
          el.style.borderColor = isIt ? '#fff' : '#38bdf8';
          el.style.color = isIt ? '#04140a' : '#fff';
          el.style.boxShadow = isIt ? '0 0 16px rgba(34, 211, 238, 0.9), 0 4px 8px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.4)';
          el.innerHTML = `<span>${elCode}</span>${isIt ? '<span style="font-size: 9px; line-height: 1;">✓</span>' : ''}`;
        });

        const infoEl = overlay.querySelector('#pitch-pos-info-name');
        const found = TACTICAL_PITCH_POSITIONS.find(x => x.code === selected);
        if (infoEl && found) {
          infoEl.textContent = found.name;
        }
      };
    });

    overlay.querySelector('#btn-confirm-pitch-pos').onclick = () => {
      close();
      haptic(35);
      if (typeof onSelect === 'function') onSelect(selected);
    };

    document.body.appendChild(overlay);
  }

  /* Modal de creación/edición de jugador (extendida con fecha de nacimiento, edad, contactos y posiciones secundarias) */
  function showEditPlayerModal(player, onSaved) {
    const isEdit = !!player;
    let photoData = player ? player.photo || '' : '';
    let photoHash = player ? player.photoHash || '' : '';
    const parentContact = (player && player.parentContact) || { name: '', phone: '', email: '' };
    let selectedSecondary = (player && Array.isArray(player.secondaryPositions)) 
      ? [...player.secondaryPositions] 
      : (player && player.secondaryPosition ? [player.secondaryPosition] : []);

    const curLang = (Store.state.settings && Store.state.settings.lang) || 'es';
    const isEn = (curLang === 'en');
    const initialAge = player && player.birthDate ? calculateAgeYearsMonths(player.birthDate, curLang) : '';

    openSheet(isEdit ? t('editPlayer') : t('newPlayer'), (body) => {
      // Si la foto no está en memoria pero existe en caché IndexedDB, hidratarla
      if (!photoData && player && player.id && window.CacheDB && window.CacheDB.getPhoto) {
        window.CacheDB.getPhoto(player.id).then(cached => {
          if (cached && cached.dataUrl) {
            photoData = cached.dataUrl;
            player.photo = cached.dataUrl;
            const preview = body.querySelector('#photo-preview');
            if (preview) {
              preview.innerHTML = `<img src="${photoData}" alt="" /><div class="cam">${icon('camera', 16)}</div>`;
            }
          }
        }).catch(() => {});
      }

      body.innerHTML = `
        <div class="photo-pick">
          <div class="avatar lg" id="photo-preview">
            ${photoData ? `<img src="${photoData}" alt="" />` : `<span>${isEdit ? (player.name[0] || 'J') : '+'}</span>`}
            <div class="cam">${icon('camera', 16)}</div>
          </div>
          <input type="file" id="photo-input" accept="image/*" style="display: none;" />
          <span class="hint">${t('tapToChangePhoto')}</span>
        </div>

        <div class="field-row">
          <div class="field">
            <label>${t('firstName')}</label>
            <input type="text" id="p-name" value="${isEdit ? escapeHtml(player.name) : ''}" placeholder="Ej. Carlos" />
          </div>
          <div class="field">
            <label>${t('lastName')}</label>
            <input type="text" id="p-lastname" value="${isEdit ? escapeHtml(player.lastName) : ''}" placeholder="Ej. Gómez" />
          </div>
        </div>

        <!-- Fecha de Nacimiento y Cálculo Automático de Edad -->
        <div class="field-row">
          <div class="field">
            <label>🎂 ${t('birthDate', 'Fecha de Nacimiento')}</label>
            <div class="date-picker-group" style="gap: 6px;">
              <div class="date-picker-input-wrapper" style="flex: 1;">
                <input type="text" id="p-birthdate-text" value="${isEdit && player.birthDate ? formatDisplayDate(player.birthDate) : ''}" placeholder="DD/MM/AAAA" autocomplete="off" style="padding-right: 34px; cursor: pointer;" />
                <span class="date-picker-icon" id="p-birthdate-icon" title="${t('openCalendar', 'Abrir calendario')}" style="cursor: pointer;">📅</span>
              </div>
              <button type="button" class="btn-open-calendar" id="p-birthdate-cal-btn" title="${t('openCalendar', 'Abrir calendario')}" style="padding: 0 10px;">
                <span>📅</span>
              </button>
              <input type="hidden" id="p-birthdate" value="${isEdit && player.birthDate ? player.birthDate : ''}" />
            </div>
          </div>
          <div class="field" style="display: flex; flex-direction: column; justify-content: flex-end;">
            <label>${t('age', 'Edad (Años y Meses)')}</label>
            <div id="p-age-display" style="padding: 10px 12px; background: var(--surface2); border: 1.5px solid var(--border); border-radius: 10px; font-size: 12.5px; color: var(--cyan); font-weight: 800; min-height: 42px; display: flex; align-items: center;">
              ${initialAge ? `🎂 ${initialAge}` : `<span style="color: var(--muted); font-size: 11.5px;">${t('calcAgeHint', 'Introduce fecha')}</span>`}
            </div>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>${t('mainDorsal')}</label>
            <input type="number" id="p-dorsal" value="${isEdit && player.mainDorsal != null ? player.mainDorsal : ''}" placeholder="10" />
          </div>
          <div class="field">
            <label>📏 ${t('heightCm', 'Estatura (cm)')}</label>
            <input type="number" id="p-height" value="${isEdit && player.heightCm ? player.heightCm : ''}" placeholder="145" min="50" max="230" />
          </div>
          <div class="field">
            <label>${t('foot')}</label>
            <select id="p-foot">
              <option value="Diestro" ${isEdit && player.foot === 'Diestro' ? 'selected' : ''}>${t('footRight')}</option>
              <option value="Zurdo" ${isEdit && player.foot === 'Zurdo' ? 'selected' : ''}>${t('footLeft')}</option>
              <option value="Ambidiestro" ${isEdit && player.foot === 'Ambidiestro' ? 'selected' : ''}>${t('footBoth')}</option>
            </select>
          </div>
        </div>

        <!-- Posición Principal con Botón de Selector en el Campo Táctico -->
        <div class="field">
          <label style="display: flex; justify-content: space-between; align-items: center;">
            <span>📍 ${t('mainPosition', 'Posición Principal')}</span>
            <small style="color: var(--cyan); font-weight: 700;">Táctico 2D</small>
          </label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="p-pos" style="flex: 1;">
              ${Store.POSITIONS.map(pos => `
                <option value="${pos.v}" ${isEdit && player.mainPosition === pos.v ? 'selected' : ''}>
                  ${pos.v} - ${pos.l}
                </option>
              `).join('')}
            </select>
            <button type="button" class="btn secondary" id="btn-open-pitch-picker" style="height: 42px; padding: 0 12px; font-weight: 900; font-size: 12.5px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--cyan);" title="${t('selectOnPitch', 'Elegir en el campo')}">
              ${t('selectOnPitch', '🏟️ Campo')}
            </button>
          </div>
        </div>

        <!-- Posiciones Secundarias Opcionales -->
        <div class="field">
          <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span>🔄 ${t('secondaryPositions', 'Posiciones Secundarias (Opcional)')}</span>
            <small style="color: var(--muted); font-size: 11px;">Toca para activar/desactivar</small>
          </label>
          <div id="p-secondary-chips" style="display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0;">
            ${TACTICAL_PITCH_POSITIONS.map(p => {
              const isSel = selectedSecondary.includes(p.code);
              return `
                <button type="button" class="badge sec-pos-chip" data-sec-pos="${p.code}" style="cursor: pointer; padding: 5px 10px; font-size: 11.5px; font-weight: 800; border-radius: 8px; border: 1.5px solid ${isSel ? 'var(--cyan)' : 'var(--border)'}; background: ${isSel ? 'rgba(34, 211, 238, 0.2)' : 'var(--surface2)'}; color: ${isSel ? '#fff' : 'var(--muted)'}; transition: all 0.15s;">
                  ${isSel ? '✓ ' : ''}${p.code}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Equipo y Apodo -->
        <div class="field-row">
          <div class="field">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label>${t('team')}</label>
              <button type="button" class="btn sm ghost" id="btn-player-new-team-quick" style="padding: 1px 6px; font-size: 11px; height: auto;">+ ${t('newTeam')}</button>
            </div>
            <select id="p-team">
              <option value="">${t('unassignedTeam')}</option>
              ${Store.state.teams.map(t => `
                <option value="${t.id}" ${isEdit && player.teamId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>
              `).join('')}
            </select>
          </div>
          <div class="field">
            <label>${t('nickname')}</label>
            <input type="text" id="p-nick" value="${isEdit ? escapeHtml(player.nickname || '') : ''}" placeholder="Carlitos" />
          </div>
        </div>

        <!-- Sección de Contacto de Padres / Tutores (como en Youth Football App) -->
        <div class="section-title" style="margin-top: 14px; margin-bottom: 8px;">
          <span>👨‍👩‍👦 ${t('parentContact', 'Contacto de Padres / Tutores')}</span>
        </div>
        <div class="field">
          <label>${t('parentName', 'Nombre del Padre/Madre/Tutor')}</label>
          <input type="text" id="p-parent-name" value="${escapeHtml(parentContact.name || '')}" placeholder="Ej. Juan Gómez" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>${t('parentPhone', 'Teléfono del Tutor')}</label>
            <input type="tel" id="p-parent-phone" value="${escapeHtml(parentContact.phone || '+372 ')}" placeholder="+372 5000 0000" />
          </div>
          <div class="field">
            <label>${t('parentEmail', 'Email del Tutor')}</label>
            <input type="email" id="p-parent-email" value="${escapeHtml(parentContact.email || '')}" placeholder="padres@correo.com" />
          </div>
        </div>
      `;

      // Selector de Fecha de Nacimiento y Cálculo Automático de Edad
      const birthInput = body.querySelector('#p-birthdate');
      const birthTextInput = body.querySelector('#p-birthdate-text');
      const birthCalBtn = body.querySelector('#p-birthdate-cal-btn');
      const birthIcon = body.querySelector('#p-birthdate-icon');
      const ageDisplay = body.querySelector('#p-age-display');

      const updateAge = () => {
        const val = birthInput ? birthInput.value : '';
        const age = calculateAgeYearsMonths(val, curLang);
        if (ageDisplay) {
          ageDisplay.innerHTML = age
            ? `🎂 ${age}`
            : `<span style="color: var(--muted); font-size: 11.5px;">${t('calcAgeHint', 'Introduce fecha')}</span>`;
        }
      };

      const openBirthCalendar = () => {
        const cur = birthInput ? birthInput.value : '';
        openDatePicker(cur, (newIso) => {
          if (birthInput) birthInput.value = newIso;
          if (birthTextInput) birthTextInput.value = formatDisplayDate(newIso);
          updateAge();
          haptic(25);
        }, { isBirthDate: true });
      };

      if (birthCalBtn) birthCalBtn.onclick = openBirthCalendar;
      if (birthIcon) birthIcon.onclick = openBirthCalendar;
      if (birthTextInput) {
        birthTextInput.onclick = () => {
          if (!birthTextInput.value) openBirthCalendar();
        };
        birthTextInput.oninput = () => {
          const raw = birthTextInput.value.trim();
          if (!raw) {
            if (birthInput) birthInput.value = '';
            updateAge();
            return;
          }
          const parsed = parseInputDateToIso(raw);
          if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
            if (birthInput) birthInput.value = parsed;
            updateAge();
          }
        };
        birthTextInput.onblur = () => {
          const raw = birthTextInput.value.trim();
          if (!raw) {
            if (birthInput) birthInput.value = '';
            updateAge();
            return;
          }
          const parsed = parseInputDateToIso(raw);
          if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
            if (birthInput) birthInput.value = parsed;
            birthTextInput.value = formatDisplayDate(parsed);
            updateAge();
          }
        };
      }

      // Selector de Posición sobre el Campo Táctico
      const btnPitchPicker = body.querySelector('#btn-open-pitch-picker');
      const posSelect = body.querySelector('#p-pos');
      if (btnPitchPicker && posSelect) {
        btnPitchPicker.onclick = () => {
          showPitchPositionPickerModal(posSelect.value, (newPosCode) => {
            posSelect.value = newPosCode;
            haptic(30);
          });
        };
      }

      // Chips de Posiciones Secundarias
      body.querySelectorAll('.sec-pos-chip').forEach(chip => {
        chip.onclick = () => {
          const code = chip.getAttribute('data-sec-pos');
          if (selectedSecondary.includes(code)) {
            selectedSecondary = selectedSecondary.filter(x => x !== code);
            chip.style.borderColor = 'var(--border)';
            chip.style.background = 'var(--surface2)';
            chip.style.color = 'var(--muted)';
            chip.textContent = code;
          } else {
            selectedSecondary.push(code);
            chip.style.borderColor = 'var(--cyan)';
            chip.style.background = 'rgba(34, 211, 238, 0.2)';
            chip.style.color = '#fff';
            chip.textContent = `✓ ${code}`;
          }
          haptic(20);
        };
      });

      const btnNewTeam = body.querySelector('#btn-player-new-team-quick');
      if (btnNewTeam) {
        btnNewTeam.onclick = () => {
          showEditTeamModal(null, (newTeam) => {
            const teamSelect = document.getElementById('p-team');
            if (teamSelect && newTeam) {
              const opt = document.createElement('option');
              opt.value = newTeam.id;
              opt.textContent = newTeam.name;
              opt.selected = true;
              teamSelect.appendChild(opt);
            }
          });
        };
      }

      const photoPreview = body.querySelector('#photo-preview');
      const photoInput = body.querySelector('#photo-input');
      photoPreview.onclick = () => photoInput.click();

      photoInput.onchange = async () => {
        if (!photoInput.files || !photoInput.files[0]) return;
        const file = photoInput.files[0];
        try {
          let res = null;
          if (window.IO && window.IO.processPlayerPhotoWebp) {
            res = await window.IO.processPlayerPhotoWebp(file);
          } else if (window.Cloud && window.Cloud.processPlayerPhotoWebp) {
            res = await window.Cloud.processPlayerPhotoWebp(file);
          }
          if (res && res.dataUrl) {
            photoData = res.dataUrl;
            photoHash = res.photoHash || ('p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
          } else if (window.IO && window.IO.readFileDataURL) {
            const rawUrl = await IO.readFileDataURL(file);
            const shrunken = (IO.shrinkPhoto ? await IO.shrinkPhoto(rawUrl, 200) : rawUrl);
            photoData = shrunken || rawUrl;
            photoHash = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          }
          if (photoData) {
            photoPreview.innerHTML = `<img src="${photoData}" alt="" /><div class="cam">${icon('camera', 16)}</div>`;
          }
        } catch (err) {
          console.error("Error al procesar foto WebP:", err);
        }
      };
    }, (foot) => {
      foot.innerHTML = `
        <button class="btn block primary" id="btn-save-player">
          ${isEdit ? t('saveChanges') : t('createPlayer')}
        </button>
      `;

      foot.querySelector('#btn-save-player').onclick = () => {
        const name = (document.getElementById('p-name') ? document.getElementById('p-name').value : '').trim();
        const lastName = (document.getElementById('p-lastname') ? document.getElementById('p-lastname').value : '').trim();
        const dorsalStr = (document.getElementById('p-dorsal') ? document.getElementById('p-dorsal').value : '').trim();
        const birthDate = (document.getElementById('p-birthdate') ? document.getElementById('p-birthdate').value : '').trim();
        const mainPosition = (document.getElementById('p-pos') ? document.getElementById('p-pos').value : 'Jugador');
        const foot = (document.getElementById('p-foot') ? document.getElementById('p-foot').value : 'Diestro');
        const teamId = (document.getElementById('p-team') ? document.getElementById('p-team').value : '');
        const nickname = (document.getElementById('p-nick') ? document.getElementById('p-nick').value : '').trim();

        const parentName = (document.getElementById('p-parent-name') ? document.getElementById('p-parent-name').value : '').trim();
        const parentPhone = (document.getElementById('p-parent-phone') ? document.getElementById('p-parent-phone').value : '').trim();
        const parentEmail = (document.getElementById('p-parent-email') ? document.getElementById('p-parent-email').value : '').trim();
        const heightStr = (document.getElementById('p-height') ? document.getElementById('p-height').value : '').trim();
        const heightCm = heightStr ? parseInt(heightStr, 10) : null;

        if (!name && !nickname) {
          toast('Introduce al menos el nombre o apodo', 'error');
          return;
        }

        const mainDorsal = dorsalStr ? parseInt(dorsalStr, 10) : null;

        // Si no se seleccionó una foto nueva pero el jugador ya tenía una foto o hash, conservarla
        if (!photoData && player) {
          if (player.photo || player.photoHash) {
            photoData = player.photo || '';
            photoHash = player.photoHash || '';
          } else if (window.CacheDB && window.CacheDB.getPhotoSync) {
            const cached = window.CacheDB.getPhotoSync(player.id);
            if (cached && cached.dataUrl) {
              photoData = cached.dataUrl;
              photoHash = cached.photoHash || '';
            }
          }
        }

        const saved = Store.upsertPlayer({
          id: isEdit ? player.id : null,
          name,
          lastName,
          nickname,
          birthDate,
          mainDorsal,
          heightCm: heightCm && !isNaN(heightCm) ? heightCm : null,
          mainPosition,
          secondaryPositions: selectedSecondary,
          secondaryPosition: selectedSecondary[0] || '',
          parentContact: {
            name: parentName,
            phone: parentPhone,
            email: parentEmail
          },
          foot,
          teamId,
          photo: photoData,
          photoHash: photoHash
        });

        if (photoData && photoHash && window.CacheDB && window.CacheDB.setPhoto) {
          window.CacheDB.setPhoto(saved.id, photoHash, photoData);
        }

        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        closeSheet();
        toast(t('savedSuccess'), 'success');
        if (onSaved) onSaved(saved);
      };
    });
  }

  /* =========================================================
     MODAL DE CONFIGURACIÓN DEL PERFIL DE JUGADOR DE PRUEBA
     ========================================================= */
  function showTestPlayerConfigModal(onDone) {
    const tp = Store.ensureTestPlayer();
    const teams = Store.state.teams || [];

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'dialog-test-player-config';
    overlay.style.zIndex = '999999';

    const portalBaseUrl = (Store.state.settings && Store.state.settings.convocatoriaWebUrl)
      ? Store.state.settings.convocatoriaWebUrl.replace(/convocatoria\.html.*$/, 'jugadores.html')
      : 'jugadores.html';
    const testPlayerUrl = portalBaseUrl + (portalBaseUrl.includes('?') ? '&' : '?') + 'test_player=1';

    overlay.innerHTML = `
      <div class="dialog-box" style="width: 92%; max-width: 460px; max-height: 88vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 26px;">🧪</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 900; color: #fff;">${t('testPlayerProfile', 'Perfil de Jugador de Prueba')}</h3>
              <small style="color: var(--muted); font-size: 11.5px;">Modo Test del Entrenador</small>
            </div>
          </div>
          <button type="button" class="icon-btn ghost" id="btn-close-test-modal" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div style="background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.35); border-radius: 12px; padding: 10px 12px; margin-bottom: 14px; font-size: 12px; color: #fde047; line-height: 1.45;">
          ℹ️ ${t('testProfileDesc', 'Este perfil es invisible para jugadores reales (no aparece en plantillas, listas ni clasificaciones). Recibe automáticamente las convocatorias de su equipo asignado y permite votar y verificar el MVP.')}
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">
              🛡️ ${t('assignedTeam', 'Equipo Asignado')}
            </label>
            <select id="test-player-select-team" class="input" style="width: 100%; height: 42px; border-radius: 10px; font-size: 13.5px; font-weight: 800; background: var(--bg2); color: #fff; border: 1px solid var(--border);">
              <option value="all" ${(tp.teamId === 'all' || !tp.teamId) ? 'selected' : ''}>🌐 ${t('allTeams', 'Todos los equipos')}</option>
              ${teams.map(tm => `
                <option value="${tm.id}" ${tp.teamId === tm.id ? 'selected' : ''}>🛡️ ${escapeHtml(tm.name)}</option>
              `).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">
                👤 ${t('playerName', 'Nombre')}
              </label>
              <input type="text" id="test-player-inp-name" value="${escapeHtml(tp.name || 'Jugador Test')}" class="input" style="width: 100%; height: 40px; border-radius: 10px; font-size: 13px; background: var(--bg2); color: #fff; border: 1px solid var(--border);" />
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">
                🔢 ${t('dorsal', 'Dorsal')}
              </label>
              <input type="number" id="test-player-inp-dorsal" value="${tp.mainDorsal != null ? tp.mainDorsal : 99}" class="input" style="width: 100%; height: 40px; border-radius: 10px; font-size: 13px; background: var(--bg2); color: #fff; border: 1px solid var(--border);" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 12px; font-weight: 800; color: var(--muted); margin-bottom: 4px;">
              🔑 PIN de Acceso Rápido
            </label>
            <input type="text" id="test-player-inp-pin" value="${escapeHtml(tp.securityCode || '0000')}" maxlength="6" class="input" style="width: 100%; height: 40px; border-radius: 10px; font-size: 13px; background: var(--bg2); color: #fff; border: 1px solid var(--border);" />
            <small style="color: var(--muted); font-size: 11px;">Código para acceder desde la App de Jugadores (por defecto 0000).</small>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" class="btn primary" id="btn-save-test-player" style="height: 42px; font-weight: 900; font-size: 13.5px; border-radius: 12px;">
            💾 ${t('save', 'Guardar Cambios')}
          </button>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" class="btn secondary" id="btn-modal-open-test-player" style="height: 38px; font-size: 12px; font-weight: 800; color: #facc15; border-color: rgba(250, 204, 21, 0.5);">
              📲 ${t('openAsTestPlayer', 'Abrir App como Test')}
            </button>
            <button type="button" class="btn secondary" id="btn-modal-copy-test-link" style="height: 38px; font-size: 12px; font-weight: 800;">
              📋 ${t('copyTestLink', 'Copiar Enlace')}
            </button>
          </div>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#btn-close-test-modal').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelector('#btn-save-test-player').onclick = () => {
      const teamId = overlay.querySelector('#test-player-select-team').value;
      const name = overlay.querySelector('#test-player-inp-name').value.trim() || 'Jugador Test';
      const dorsal = parseInt(overlay.querySelector('#test-player-inp-dorsal').value, 10) || 99;
      const pin = overlay.querySelector('#test-player-inp-pin').value.trim() || '0000';

      Store.ensureTestPlayer({
        teamId: teamId,
        assignedTeamIds: teamId === 'all' ? [] : [teamId],
        name: name,
        mainDorsal: dorsal,
        securityCode: pin
      });

      const tm = Store.team(teamId);
      toast(t('testPlayerAssignedToast', 'Jugador de prueba asignado a {team}').replace('{team}', tm ? tm.name : t('allTeams', 'Todos los equipos')), 'success');
      close();
      if (typeof onDone === 'function') onDone();
    };

    overlay.querySelector('#btn-modal-open-test-player').onclick = () => {
      if (window.AndroidBridge && window.AndroidBridge.openCustomTab) {
        window.AndroidBridge.openCustomTab(testPlayerUrl);
      } else {
        window.open(testPlayerUrl, '_blank');
      }
    };

    overlay.querySelector('#btn-modal-copy-test-link').onclick = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(testPlayerUrl).then(() => {
          toast(t('linkCopied', '¡Enlace copiado al portapapeles!'), 'success');
        }).catch(() => {
          prompt('Copia este enlace:', testPlayerUrl);
        });
      } else {
        prompt('Copia este enlace:', testPlayerUrl);
      }
    };

    document.body.appendChild(overlay);
  }

  /* =========================================================
     MODAL DE GESTIÓN DE EQUIPOS (CREAR, EDITAR Y REASIGNAR)
     ========================================================= */
  function showManageTeamsModal(onDone) {
    openSheet(t('manageTeams'), (body) => {
      function renderList() {
        const teams = Store.state.teams || [];
        const players = Store.state.players || [];

        body.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="hint">${teams.length} ${teams.length === 1 ? 'equipo registrado' : 'equipos registrados'}</span>
            <button class="btn sm primary" id="btn-modal-create-team">
              ${icon('plus', 16)} ${t('newTeam')}
            </button>
          </div>

          <div class="menu-list" style="margin-bottom: 14px;">
            ${teams.length === 0 ? `
              <div style="text-align: center; padding: 24px 10px; color: var(--muted);">
                <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
                <b>No hay equipos creados</b>
                <p style="font-size: 12px; margin-top: 4px;">Crea tu primer equipo para organizar tu plantilla.</p>
              </div>
            ` : teams.map(tm => {
              const memberCount = players.filter(p => p.teamId === tm.id).length;
              return `
                <div class="team-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                    <span style="width: 18px; height: 18px; border-radius: 50%; background: ${tm.color || '#22c55e'}; flex-shrink: 0; box-shadow: 0 0 8px ${tm.color || '#22c55e'}60;"></span>
                    <div style="min-width: 0;">
                      <b style="display: block; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(tm.name)}</b>
                      <small style="color: var(--muted); font-size: 12px;">${memberCount} jugadores asignados${tm.shortName ? ' • ' + escapeHtml(tm.shortName) : ''}</small>
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px; flex-shrink: 0;">
                    <button class="icon-btn sm" data-edit-team="${tm.id}" title="${t('editTeam')}">${icon('edit', 16)}</button>
                    <button class="icon-btn sm danger" data-del-team="${tm.id}" title="${t('deleteTeam')}">${icon('trash', 16)}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        body.querySelector('#btn-modal-create-team').onclick = () => {
          showEditTeamModal(null, () => renderList());
        };

        body.querySelectorAll('[data-edit-team]').forEach(btn => {
          btn.onclick = () => {
            const tid = btn.getAttribute('data-edit-team');
            const tm = Store.team(tid);
            if (tm) showEditTeamModal(tm, () => renderList());
          };
        });

        body.querySelectorAll('[data-del-team]').forEach(btn => {
          btn.onclick = () => {
            const tid = btn.getAttribute('data-del-team');
            const tm = Store.team(tid);
            if (tm) {
              confirmDialog(t('deleteTeam'), `${t('confirmDeleteTeam')} (${tm.name})`, () => {
                Store.deleteTeam(tid);
                renderList();
                if (onDone) onDone();
              });
            }
          };
        });
      }

      renderList();
    }, (foot) => {
      foot.innerHTML = `<button class="btn block ghost" id="btn-close-manage-teams">${t('cancel')}</button>`;
      foot.querySelector('#btn-close-manage-teams').onclick = () => {
        closeSheet();
        if (onDone) onDone();
      };
    });
  }

  /* =========================================================
     MODAL DE CREAR / EDITAR EQUIPO Y ASIGNAR JUGADORES
     ========================================================= */
  function showEditTeamModal(team, onSaved) {
    const isEdit = !!team;
    const tData = Object.assign({
      name: '',
      shortName: '',
      color: '#10b981'
    }, team || {});

    const COLOR_PALETTE = [
      '#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#ec4899', '#f97316', '#64748b', '#14b8a6',
      '#84cc16', '#e11d48'
    ];

    let selectedColor = tData.color || '#10b981';
    const allPlayers = Store.sortedPlayers();
    const assignedPlayerIds = new Set(
      isEdit ? allPlayers.filter(p => p.teamId === team.id).map(p => p.id) : []
    );

    openSheet(isEdit ? t('editTeam') : t('newTeam'), (body) => {
      function render() {
        body.innerHTML = `
          <div class="field">
            <label>${t('teamName')} *</label>
            <input type="text" id="team-input-name" placeholder="${t('teamNamePlaceholder')}" value="${escapeHtml(tData.name)}" />
          </div>

          <div class="field">
            <label>${t('teamShortName')}</label>
            <input type="text" id="team-input-short" placeholder="Ej. U12, CADETE, SENIOR" value="${escapeHtml(tData.shortName || '')}" />
          </div>

          <div class="field">
            <label>${t('teamColor')}</label>
            <div class="color-swatches" id="team-color-swatches" style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px;">
              ${COLOR_PALETTE.map(c => `
                <button type="button" data-col="${c}" style="width: 32px; height: 32px; border-radius: 50%; background: ${c}; border: 3px solid ${selectedColor === c ? '#fff' : 'transparent'}; box-shadow: ${selectedColor === c ? '0 0 8px ' + c : 'none'}; cursor: pointer;"></button>
              `).join('')}
            </div>
          </div>

          <div class="section-title" style="margin-top: 14px;">
            <span>${t('assignedPlayers')} (${assignedPlayerIds.size})</span>
          </div>
          <p class="hint" style="margin-bottom: 8px;">${t('assignPlayersHint')}</p>

          <div class="card" style="max-height: 35vh; overflow-y: auto; padding: 4px 10px;">
            ${allPlayers.length === 0 ? `
              <div style="text-align: center; padding: 15px; color: var(--muted);">No hay jugadores en la plantilla</div>
            ` : allPlayers.map(p => {
              const isAssigned = assignedPlayerIds.has(p.id);
              const curTeam = Store.team(p.teamId);
              return `
                <div class="conv-player-row" data-toggle-pid="${p.id}" style="cursor: pointer; user-select: none;">
                  ${renderAvatar(p, 'sm')}
                  <div class="conv-player-name ellipsis">
                    <b>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                    <small style="display: block; color: var(--muted); font-size: 11px;">
                      ${curTeam && curTeam.id !== (team ? team.id : '') ? `Equipo actual: <span style="color:${curTeam.color}; font-weight:700;">${escapeHtml(curTeam.name)}</span>` : (p.mainPosition || 'Jugador')}
                    </small>
                  </div>
                  <div style="font-size: 18px;">
                    ${isAssigned ? '✅' : '⚪'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        body.querySelectorAll('#team-color-swatches button').forEach(b => {
          b.onclick = () => {
            selectedColor = b.getAttribute('data-col');
            tData.name = document.getElementById('team-input-name').value;
            tData.shortName = document.getElementById('team-input-short').value;
            render();
          };
        });

        body.querySelectorAll('[data-toggle-pid]').forEach(row => {
          row.onclick = () => {
            const pid = row.getAttribute('data-toggle-pid');
            if (assignedPlayerIds.has(pid)) {
              assignedPlayerIds.delete(pid);
            } else {
              assignedPlayerIds.add(pid);
            }
            haptic(15);
            tData.name = document.getElementById('team-input-name').value;
            tData.shortName = document.getElementById('team-input-short').value;
            render();
          };
        });
      }

      render();
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn ghost grow" id="btn-cancel-team-edit">${t('cancel')}</button>
          <button class="btn primary grow" id="btn-save-team-edit">${t('saveChanges')}</button>
        </div>
      `;

      foot.querySelector('#btn-cancel-team-edit').onclick = closeSheet;

      foot.querySelector('#btn-save-team-edit').onclick = () => {
        const name = document.getElementById('team-input-name').value.trim();
        const shortName = document.getElementById('team-input-short').value.trim();

        if (!name) {
          toast('El nombre del equipo es obligatorio', 'error');
          return;
        }

        const savedTeam = Store.upsertTeam({
          id: isEdit ? team.id : null,
          name,
          shortName,
          color: selectedColor
        });

        // Actualizar la asignación de jugadores en lote
        Store.state.players.forEach(p => {
          if (assignedPlayerIds.has(p.id)) {
            p.teamId = savedTeam.id;
          } else if (isEdit && p.teamId === savedTeam.id) {
            p.teamId = '';
          }
        });
        Store.save();
        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        toast(t('savedSuccess'), 'success');
        closeSheet();
        if (onSaved) onSaved(savedTeam);
      };
    });
  }

  /* =========================================================
     MODAL DE REASIGNACIÓN RÁPIDA DE EQUIPO PARA UN JUGADOR
     ========================================================= */
  function showQuickAssignTeamModal(player, onDone) {
    openSheet(`${t('reassignTeam')}: ${Store.playerName(player, true)}`, (body) => {
      const teams = Store.state.teams || [];
      body.innerHTML = `
        <p class="hint" style="margin-bottom: 10px;">Selecciona el equipo al que pertenece este jugador:</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn block ${!player.teamId ? 'primary' : 'ghost'}" data-tid="" style="text-align: left; font-size: 14px;">
            ⚪ ${t('unassignedTeam')}
          </button>
          ${teams.map(tm => `
            <button class="btn block ${player.teamId === tm.id ? 'primary' : 'ghost'}" data-tid="${tm.id}" style="text-align: left; display: flex; align-items: center; gap: 10px; font-size: 14px;">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: ${tm.color}; flex-shrink: 0;"></span>
              <span style="flex: 1;">${escapeHtml(tm.name)}</span>
              ${player.teamId === tm.id ? '✓' : ''}
            </button>
          `).join('')}
        </div>
        <div style="margin-top: 14px; text-align: center;">
          <button class="btn sm" id="btn-create-new-team-quick">${icon('plus', 16)} ${t('newTeam')}</button>
        </div>
      `;

      body.querySelectorAll('[data-tid]').forEach(btn => {
        btn.onclick = () => {
          const tid = btn.getAttribute('data-tid');
          player.teamId = tid;
          Store.save();
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          toast('Equipo asignado correctamente', 'success');
          closeSheet();
          if (onDone) onDone();
        };
      });

      body.querySelector('#btn-create-new-team-quick').onclick = () => {
        showEditTeamModal(null, (newTeam) => {
          player.teamId = newTeam.id;
          Store.save();
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          toast('Equipo creado y asignado', 'success');
          closeSheet();
          if (onDone) onDone();
        });
      };
    });
  }

  /* =========================================================
     MODAL DE IMPORTACIÓN CON FUSIÓN POR NOMBRE (SIN DUPLICADOS)
     ========================================================= */
  function showImportModal(onDone) {
    openSheet(t('importPlayers'), (body) => {
      body.innerHTML = `
        <div class="info-note" style="margin-bottom: 14px;">
          ${t('importNote')}
        </div>

        <div class="field">
          <label>${t('selectFile')}</label>
          <input type="file" id="import-file-input" accept=".json,.csv,.txt" />
        </div>

        <div class="section-title"><span>${t('pasteList')}</span></div>
        <div class="field">
          <textarea id="import-paste-area" placeholder="10 Juan Pérez DC&#10;7 Carlos Ruiz MC&#10;1 Marc Ter Stegen POR"></textarea>
          <span class="hint">Detecta dorsales y posiciones automáticamente</span>
        </div>
      `;
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn" id="btn-cancel-imp">${t('cancel')}</button>
          <button class="btn primary" id="btn-do-import">${t('processImport')}</button>
        </div>
      `;

      foot.querySelector('#btn-cancel-imp').onclick = closeSheet;

      foot.querySelector('#btn-do-import').onclick = async () => {
        const fileInput = document.getElementById('import-file-input');
        const pasteText = document.getElementById('import-paste-area').value.trim();

        try {
          if (fileInput.files && fileInput.files[0]) {
            const res = await IO.importFile(fileInput.files[0]);
            let msg = `Importación: ${res.playersAdded} jugadores nuevos, ${res.playersMatched} vinculados por nombre sin duplicar`;
            if (res.sessionsAdded) msg += `, ${res.sessionsAdded} sesiones añadidas`;
            toast(msg, 'success');
          } else if (pasteText) {
            const res = await IO.importText(pasteText);
            toast(`Importados: ${res.playersAdded} nuevos, ${res.playersMatched} vinculados`, 'success');
          } else {
            toast('Selecciona un archivo o pega una lista', 'error');
            return;
          }

          closeSheet();
          if (onDone) onDone();
          else navigate(currentTab);
        } catch (err) {
          toast('Error: ' + err.message, 'error');
        }
      };
    });
  }

  /* =========================================================
     SECCIÓN CONVOCATORIAS: FORMATEADOR Y COMPARTIR CONVOCATORIA
     ========================================================= */
  function dispatchTextShare(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    toast(t('copiedToClipboard'), 'success');

    if (window.AndroidBridge && window.AndroidBridge.shareText) {
      try {
        window.AndroidBridge.shareText(text);
        return;
      } catch (e) {
        console.error('Error invoking native shareText:', e);
      }
    }

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  }
  function dispatchViberShare(text) {
    dispatchTextShare(text);
  }

  function formatConvocationWhatsAppText(conv, lang) {
    const l = (lang || (Store.state.settings && Store.state.settings.lang) || 'es').toLowerCase();
    const isRu = (l === 'ru');
    const isEt = (l === 'et' || l === 'ee');
    const isEn = (l === 'en');
    const isEs = (!isRu && !isEt && !isEn);

    const team = Store.team(conv.teamId);
    const teamName = team ? team.name : '';
    const dateStr = conv.date || '';
    const timeFormatted = conv.time 
      ? (conv.time + (conv.endTime ? ' - ' + conv.endTime : '') + (conv.duration ? ` (${conv.duration} min)` : '')) 
      : '';
    const timeStr = conv.time || '';

    const venueStr = conv.venue ? (
      isRu ? `📍 *Место:* ${conv.venue}\n` :
      isEt ? `📍 *Koht:* ${conv.venue}\n` :
      isEn ? `📍 *Venue:* ${conv.venue}\n` :
      `📍 *Lugar:* ${conv.venue}\n`
    ) : '';

    const addressStr = conv.address ? (
      isRu ? `🗺️ *Адрес:* ${conv.address}\n` :
      isEt ? `🗺️ *Aadress:* ${conv.address}\n` :
      isEn ? `🗺️ *Address:* ${conv.address}\n` :
      `🗺️ *Dirección:* ${conv.address}\n`
    ) : '';

    const rivalStr = conv.rival ? (
      isRu ? `⚔️ *Соперник:* ${conv.rival}\n` :
      isEt ? `⚔️ *Vastane:* ${conv.rival}\n` :
      isEn ? `⚔️ *Opponent:* ${conv.rival}\n` :
      `🆚 *Rival:* ${conv.rival}\n`
    ) : '';

    const notesStr = conv.notes ? (
      isRu ? `📝 *Примечания:* ${conv.notes}\n` :
      isEt ? `📝 *Märkmed:* ${conv.notes}\n` :
      isEn ? `📝 *Notes:* ${conv.notes}\n` :
      `📝 *Notas:* ${conv.notes}\n`
    ) : '';

    const defTitle = conv.type === 'match'
      ? (isRu ? 'МАТЧ' : isEt ? 'MÄNG' : isEn ? 'MATCH' : 'PARTIDO')
      : (isRu ? 'ТРЕНИРОВКА' : isEt ? 'TREENING' : isEn ? 'TRAINING' : 'ENTRENAMIENTO');

    let text = isRu
      ? `📋 *ОФИЦИАЛЬНАЯ ЗАЯВКА: ${conv.title || defTitle}*\n`
      : isEt
      ? `📋 *AMETLIK KOKKUKUTSE: ${conv.title || defTitle}*\n`
      : isEn
      ? `📋 *OFFICIAL CALL-UP: ${conv.title || defTitle}*\n`
      : `📋 *CONVOCATORIA: ${conv.title || defTitle}*\n`;

    if (teamName) {
      text += isRu ? `🛡️ *Команда:* ${teamName}\n` :
              isEt ? `🛡️ *Võistkond:* ${teamName}\n` :
              isEn ? `🛡️ *Team:* ${teamName}\n` :
              `🛡️ *Equipo:* ${teamName}\n`;
    }

    text += isRu ? `📅 *Дата:* ${dateStr} • ⏰ *Время:* ${timeFormatted}\n` :
            isEt ? `📅 *Kuupäev:* ${dateStr} • ⏰ *Kellaaeg:* ${timeFormatted}\n` :
            isEn ? `📅 *Date:* ${dateStr} • ⏰ *Time:* ${timeFormatted}\n` :
            `📅 *Fecha:* ${dateStr} • ⏰ *Hora:* ${timeFormatted}\n`;

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
      const dorsal = p.mainDorsal != null ? `#${p.mainDorsal} ` : '';
      const pos = p.mainPosition ? ` (${p.mainPosition})` : '';
      const name = `${dorsal}${Store.playerName(p)}${pos}`;

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
        ? `\n🌐 *Подтвердить участие онлайн:*\n👉 ${webBaseUrl}${sep}${qParams.toString()}\n`
        : isEt
        ? `\n🌐 *Kinnita osalemine veebis:*\n👉 ${webBaseUrl}${sep}${qParams.toString()}\n`
        : isEn
        ? `\n🌐 *Confirm online attendance:*\n👉 ${webBaseUrl}${sep}${qParams.toString()}\n`
        : `\n🌐 *Confirmar asistencia en enlace web:*\n👉 ${webBaseUrl}${sep}${qParams.toString()}\n`;
    }

    if (called.length > 0) {
      text += isRu ? `\n🟢 *В ЗАЯВКЕ (${called.length}):*\n` :
              isEt ? `\n🟢 *KOKKU KUTSUTUD (${called.length}):*\n` :
              isEn ? `\n🟢 *CALLED UP (${called.length}):*\n` :
              `\n🟢 *CONVOCADOS (${called.length}):*\n`;
      called.forEach(item => { text += `  • ${item}\n`; });
    } else {
      text += isRu ? `\n🟢 *В ЗАЯВКЕ (0):*\n  (Игроки еще не выбраны)\n` :
              isEt ? `\n🟢 *KOKKU KUTSUTUD (0):*\n  (Mängijaid pole veel valitud)\n` :
              isEn ? `\n🟢 *CALLED UP (0):*\n  (No players selected yet)\n` :
              `\n🟢 *CONVOCADOS (0):*\n  (Sin jugadores seleccionados aún)\n`;
    }

    if (bench.length > 0) {
      text += isRu ? `\n🟡 *ЗАПАСНЫЕ (${bench.length}):*\n` :
              isEt ? `\n🟡 *PINGIL (${bench.length}):*\n` :
              isEn ? `\n🟡 *BENCH (${bench.length}):*\n` :
              `\n🟡 *SUPLENTES (${bench.length}):*\n`;
      bench.forEach(item => { text += `  • ${item}\n`; });
    }

    if (injured.length > 0) {
      text += isRu ? `\n🏥 *ТРАВМИРОВАНЫ (${injured.length}):*\n` :
              isEt ? `\n🏥 *VIGASTATUD (${injured.length}):*\n` :
              isEn ? `\n🏥 *INJURED (${injured.length}):*\n` :
              `\n🏥 *LESIONADOS (${injured.length}):*\n`;
      injured.forEach(item => { text += `  • ${item}\n`; });
    }

    if (absent.length > 0) {
      text += isRu ? `\n❌ *НЕ МОГУТ (${absent.length}):*\n` :
              isEt ? `\n❌ *PUUDUVAD (${absent.length}):*\n` :
              isEn ? `\n❌ *UNAVAILABLE (${absent.length}):*\n` :
              `\n❌ *NO DISPONIBLES (${absent.length}):*\n`;
      absent.forEach(item => { text += `  • ${item}\n`; });
    }

    text += isRu
      ? `\n📲 *Пожалуйста, подтвердите участие:*\n  👉 Ответьте: "🟢 БУДУ" или "❌ НЕ МОГУ"\n⚽ _Отправлено из Player Stats_`
      : isEt
      ? `\n📲 *Palun kinnita oma osalemine:*\n  👉 Vasta: "🟢 TULEN" või "❌ EI SAA"\n⚽ _Saadetud rakendusest Player Stats_`
      : isEn
      ? `\n📲 *Please confirm attendance:*\n  👉 Reply: "🟢 ATTENDING" or "❌ CANNOT ATTEND"\n⚽ _Sent from Player Stats_`
      : `\n📲 *Por favor confirma tu asistencia:*\n  👉 Responde: "🟢 VOY" o "❌ NO PUEDO"\n⚽ _Enviado desde Estadísticas Jugadores_`;
    return text;
  }

  /* =========================================================
     ENVÍO DE RECORDATORIOS DE ASISTENCIA A JUGADORES PENDIENTES
     ========================================================= */
  async function sendConvocationAttendanceReminder(conv, singlePlayerId = null) {
    if (!conv) return;
    const allPlayersMap = {};
    Store.sortedPlayers().forEach(p => { allPlayersMap[p.id] = p; });

    let calledPlayerIds = Object.keys(conv.list || {}).filter(pid => conv.list[pid] && conv.list[pid] !== 'uncalled');
    if (calledPlayerIds.length === 0 && Store.state.players) {
      const convTeams = (Array.isArray(conv.teamIds) && conv.teamIds.length > 0)
        ? conv.teamIds.map(String)
        : (conv.teamId ? [String(conv.teamId)] : []);
      calledPlayerIds = Store.state.players
        .filter(p => convTeams.length === 0 || (p.teamId && convTeams.includes(String(p.teamId))))
        .map(p => p.id);
    }
    const responses = conv.responses || {};

    let pendingPlayers = [];
    calledPlayerIds.forEach(pid => {
      const resp = responses[pid];
      const st = conv.list[pid];
      if (resp && (resp.status === 'attending' || resp.status === 'yes' || resp.status === 'absent' || resp.status === 'no')) return;
      if (st === 'absent') return;
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, '') };
      pendingPlayers.push(p);
    });

    if (singlePlayerId) {
      pendingPlayers = pendingPlayers.filter(p => String(p.id) === String(singlePlayerId));
      if (pendingPlayers.length === 0) {
        toast(t('playerAlreadyResponded', 'Este jugador ya ha respondido o no está pendiente.'), 'info');
        return;
      }
    } else {
      if (pendingPlayers.length === 0) {
        toast(t('allResponded', '¡Todos los jugadores ya han confirmado su asistencia para este evento!'), 'info');
        return;
      }
    }

    const coachName = (Store.state.coachProfile && Store.state.coachProfile.name) ? Store.state.coachProfile.name : 'Daniel Requena';
    const eventTitle = conv.title || (conv.type === 'match' ? 'Match vs ' + (conv.rival || 'Rival') : 'Training Session');
    const eventDate = `${conv.date}${conv.time ? ' at ' + conv.time : ''}`;
    const pendingPids = pendingPlayers.map(p => p.id);

    const reminderData = {
      id: 'rem_' + conv.id + '_' + (singlePlayerId ? singlePlayerId + '_' : '') + Date.now(),
      convId: conv.id,
      eventTitle: eventTitle,
      eventDate: eventDate,
      targetPlayerIds: pendingPids,
      title: 'Call-up Attendance Reminder',
      message: `Coach ${coachName} is waiting for your attendance response for "${eventTitle}" on ${eventDate}. Please respond now!`,
      createdAt: Date.now()
    };

    haptic(40);
    if (window.Cloud && window.Cloud.sendConvocationReminder) {
      await window.Cloud.sendConvocationReminder(reminderData);
    }

    if (window.Cloud && window.Cloud.sendChatMessage) {
      if (singlePlayerId) {
        // Enviar EXCLUSIVAMENTE al chat directo con ese jugador, nunca a chats de equipo
        const singleP = pendingPlayers[0];
        const pName = Store.playerName ? Store.playerName(singleP) : (singleP.name || 'Player');
        const chatPayload = {
          senderId: 'coach',
          senderName: `(Coach) ${coachName}`,
          text: `🔔 [Attendance reminder] Coach ${coachName} is waiting for your attendance response for "${eventTitle}" (${eventDate}):\n@${pName}\n[event:${conv.id}]`,
          convId: conv.id,
          eventTitle: eventTitle,
          type: 'attendance_reminder'
        };
        try {
          await window.Cloud.sendChatMessage(`coach_${singlePlayerId}`, chatPayload);
        } catch (e) {
          console.error('Error sending single attendance reminder to coach chat:', e);
        }
      } else {
        // Broadcast al chat de los equipos convocados con menciones @ de todos los pendientes
        const mentionsText = pendingPlayers.map(p => {
          const pName = Store.playerName ? Store.playerName(p) : (p.name || 'Player');
          const dorsal = p.mainDorsal != null ? ` #${p.mainDorsal}` : '';
          return `@${pName}${dorsal}`;
        }).join('\n');

        const chatMessageText = `🔔 [Attendance reminder] Coach ${coachName} is waiting for your attendance response for "${eventTitle}" (${eventDate}):\n${mentionsText}\n[event:${conv.id}]`;

        const chatPayload = {
          senderId: 'coach',
          senderName: `(Coach) ${coachName}`,
          text: chatMessageText,
          convId: conv.id,
          eventTitle: eventTitle,
          type: 'attendance_reminder'
        };

        // Extraer equipos destinatarios ÚNICAMENTE de la convocatoria y de los jugadores convocados pendientes
        const targetTeamSet = new Set();
        if (conv.teamIds && Array.isArray(conv.teamIds)) {
          conv.teamIds.forEach(tid => tid && targetTeamSet.add(tid));
        }
        if (conv.teamId) {
          targetTeamSet.add(conv.teamId);
        }
        pendingPlayers.forEach(p => {
          if (p.teamId) targetTeamSet.add(p.teamId);
        });

        // NUNCA hacer fallback a todos los equipos del club
        for (const tid of targetTeamSet) {
          try {
            await window.Cloud.sendChatMessage(`team_${tid}`, chatPayload);
          } catch (e) {
            console.error('Error sending attendance reminder to team chat:', e);
          }
        }
      }
    }

    if (singlePlayerId) {
      const p = pendingPlayers[0];
      const pName = Store.playerName ? Store.playerName(p) : (p.name || 'Player');
      toast(`🔔 ${t('reminderSentToPlayer', 'Recordatorio enviado a')} ${pName}`, 'success');
    } else {
      toast(`🔔 Recordatorio enviado a ${pendingPids.length} jugador(es) pendiente(s)`, 'success');
    }
  }

  // Navegar y abrir convocatoria directamente en el Coach App
  window.__openConvocationInCoach = function(convId) {
    if (!convId) return;
    document.querySelectorAll('.chat-dialog-overlay, .dialog-overlay, .sheet-backdrop').forEach(el => el.remove());
    if (typeof navigate === 'function') navigate('convocations');
    if (window.Store && Store.convocation) {
      const conv = Store.convocation(convId);
      if (conv) {
        setTimeout(() => {
          showConvocationDetailsModal(conv);
        }, 120);
      }
    }
  };

  function showConvocationDetailsModal(conv, onDone) {
    if (!conv) return;
    const team = Store.team(conv.teamId);
    conv.list = conv.list || {};
    conv.responses = conv.responses || {};

    openSheet(conv.title || conv.rival || 'Convocatoria', (body) => {
      function renderDetails() {
        const allPlayersMap = {};
        Store.sortedPlayers().forEach(p => { allPlayersMap[p.id] = p; });

        conv.list = conv.list || {};
        conv.responses = conv.responses || {};

        let calledPlayerIds = Object.keys(conv.list).filter(pid => {
          const st = conv.list[pid];
          return st && st !== 'uncalled';
        });
        if (calledPlayerIds.length === 0 && Store.state.players) {
          const convTeams = (Array.isArray(conv.teamIds) && conv.teamIds.length > 0)
            ? conv.teamIds.map(String)
            : (conv.teamId ? [String(conv.teamId)] : []);
          calledPlayerIds = Store.state.players
            .filter(p => convTeams.length === 0 || (p.teamId && convTeams.includes(String(p.teamId))))
            .map(p => p.id);
        }

        const respondedYes = [];
        const respondedNo = [];
        const pending = [];

        calledPlayerIds.forEach(pid => {
          const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, ''), mainPosition: 'Jugador' };
          const resp = conv.responses[pid];
          const st = conv.list[pid];

          if (resp) {
            if (resp.status === 'attending' || resp.status === 'yes') {
              respondedYes.push({ player: p, resp, st });
            } else if (resp.status === 'absent' || resp.status === 'no') {
              respondedNo.push({ player: p, resp, st });
            } else {
              pending.push({ player: p, resp, st });
            }
          } else {
            if (st === 'absent') {
              respondedNo.push({ player: p, resp: null, st });
            } else {
              pending.push({ player: p, resp: null, st });
            }
          }
        });

        const isRecurringConv = !!(conv.isRecurring || conv.scheduleId || (conv.id && conv.id.startsWith('rec_')));
        let convSchedId = conv.scheduleId || '';
        if (!convSchedId && conv.id && conv.id.startsWith('rec_')) {
          const parts = conv.id.split('_');
          if (parts.length >= 3) convSchedId = parts[1];
        }

        body.innerHTML = `
          <!-- Cabecera del evento -->
          ${(() => {
            const linkedSess = conv.sessionId ? Store.session(conv.sessionId) : (Store.state.sessions || []).find(sess => sess.convocationId === conv.id || (sess.date === conv.date && sess.type === conv.type));
            if (linkedSess && linkedSess.log && linkedSess.log.length > 0) {
              return `
                <div style="background: rgba(15, 23, 42, 0.75); border: 1.5px solid rgba(34, 211, 238, 0.45); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-shadow: 0 2px 10px rgba(34, 211, 238, 0.1);">
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <span style="font-size: 20px;">👥</span>
                    <div style="min-width: 0;">
                      <b style="font-size: 13px; color: #fff; display: block;" class="ellipsis">${t('auditActionsTitle', 'Auditoría de Acciones')}</b>
                      <small style="font-size: 11px; color: var(--muted); display: block;">${linkedSess.log.length} ${t('actions', 'acciones')} registradas</small>
                    </div>
                  </div>
                  <button type="button" class="btn sm" id="btn-conv-audit-actions" style="background: rgba(34, 211, 238, 0.2); border: 1px solid var(--cyan); color: var(--cyan); font-weight: 800; font-size: 11.5px; padding: 5px 10px; border-radius: 8px; white-space: nowrap; flex-shrink: 0;">
                    Ver detalle
                  </button>
                </div>
              `;
            }
            return '';
          })()}

          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
            <span class="badge ${conv.type}">
              ${conv.type === 'match' ? '🏆 ' + t('match') : '⚽ ' + t('training')}
            </span>
            ${team ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border-color: rgba(34, 211, 238, 0.3);">🛡️ ${escapeHtml(team.name)}</span>` : ''}
          </div>

          ${isRecurringConv ? `
            <div style="background: rgba(34, 211, 238, 0.08); border: 1.5px solid rgba(34, 211, 238, 0.35); border-radius: 12px; padding: 9px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <span style="font-size: 18px;">🔄</span>
                <div style="min-width: 0;">
                  <b style="font-size: 12.5px; color: var(--cyan); display: block;">${t('recurringTraining', 'Entrenamiento Recurrente')}</b>
                  <small style="font-size: 10.5px; color: var(--muted); display: block;">Elimina a un jugador de toda la serie recurrente con el botón 🗑️</small>
                </div>
              </div>
              ${convSchedId ? `
                <button type="button" class="btn sm" id="btn-manage-rec-players" style="background: var(--surface2); color: #fff; border: 1px solid rgba(34, 211, 238, 0.4); font-size: 11px; height: 30px; padding: 0 9px; font-weight: 800; white-space: nowrap; flex-shrink: 0; border-radius: 8px;">
                  👥 ${t('managePlayers', 'Plantilla')}
                </button>
              ` : ''}
            </div>
          ` : ''}

          <div class="conv-detail-meta" style="margin-bottom: 12px; font-size: 13px; line-height: 1.5; background: var(--bg2); padding: 12px; border-radius: 12px; border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span>📅 <b>${t('date')}:</b> ${formatConvocationDateWithDay(conv.date)}</span>
                <button type="button" class="btn sm ghost" id="btn-quick-change-date" style="padding: 2px 6px; font-size: 11px; border: 1px dashed var(--border);" title="Cambiar fecha">✏️</button>
              </div>
              <button type="button" class="btn sm" id="btn-quick-change-time" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1.5px solid rgba(34, 211, 238, 0.4); font-size: 13px; font-weight: 800; padding: 4px 12px; border-radius: 9px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                ⏰ ${conv.time || '10:00'}${conv.endTime ? ' - ' + conv.endTime : ''}${conv.duration ? ' (' + conv.duration + ' min)' : ''} <span style="font-size: 11px; opacity: 0.85; font-weight: 600;">(✏️)</span>
              </button>
            </div>
            ${conv.venue ? `<div>📍 <b>Lugar / Campo:</b> ${escapeHtml(conv.venue)}</div>` : ''}
            ${conv.address ? `<div>🗺️ <b>Dirección:</b> ${escapeHtml(conv.address)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conv.address)}" target="_blank" onclick="window.openLocationInMaps('${escapeHtml(conv.address)}'); return false;" style="color: var(--cyan); text-decoration: underline; margin-left: 6px; font-weight: 700;">(Ver Mapa ↗)</a></div>` : ''}
            ${conv.rival ? `<div>⚔️ <b>Rival:</b> ${escapeHtml(conv.rival)}</div>` : ''}
            ${conv.notes ? `<div style="margin-top: 4px; color: var(--muted);">📝 <b>Notas:</b> ${escapeHtml(conv.notes)}</div>` : ''}
          </div>

          <!-- Barra de recuento de confirmaciones -->
          <div class="conv-badge-row" style="margin-bottom: 14px;">
            <span class="conv-status-chip called" style="font-size: 11.5px; padding: 5px 10px; font-weight: 800;">🟢 ${respondedYes.length} Confirmados (SÍ)</span>
            <span class="conv-status-chip" style="background: rgba(239, 68, 68, 0.18); color: #fca5a5; font-size: 11.5px; padding: 5px 10px; font-weight: 800;">❌ ${respondedNo.length} Bajas (NO)</span>
            <span class="conv-status-chip" style="background: rgba(250, 204, 21, 0.15); color: #fde047; font-size: 11.5px; padding: 5px 10px; font-weight: 800;">⏳ ${pending.length} Sin respuesta</span>
          </div>

          ${calledPlayerIds.length === 0 ? `
            <div style="padding: 16px; text-align: center; background: var(--bg2); border: 1.5px dashed var(--border); border-radius: 14px; margin-bottom: 12px;">
              <div style="font-size: 24px; margin-bottom: 6px;">📋</div>
              <b style="display: block; font-size: 13.5px; color: #fff; margin-bottom: 4px;">Aún no has seleccionado jugadores convocados</b>
              <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px;">Pulsa el botón de abajo para elegir qué jugadores convocas para este evento.</p>
              <button type="button" class="btn primary sm" id="btn-quick-open-editor">
                ${icon('edit', 16)} Seleccionar Jugadores de la Plantilla
              </button>
            </div>
          ` : `
            <!-- SECCIÓN 1: Respuestas Recibidas -->
            <div class="conv-detail-group" style="margin-bottom: 14px;">
              <div class="conv-detail-group-title" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid rgba(34, 197, 94, 0.4); padding-bottom: 4px; margin-bottom: 8px;">
                <span style="color: #86efac; font-weight: 900; font-size: 12.5px;">✅ RESPUESTAS RECIBIDAS (${respondedYes.length + respondedNo.length})</span>
              </div>
              ${(respondedYes.length === 0 && respondedNo.length === 0) ? `
                <div style="padding: 10px; text-align: center; color: var(--muted); font-size: 11.5px; background: var(--bg2); border: 1px dashed var(--border); border-radius: 10px;">
                  ${t('noConfirmationsYet', 'Ningún jugador ha confirmado aún.')}
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${respondedYes.map(item => {
                    const p = item.player;
                    const rTime = item.resp ? (item.resp.timestamp || item.resp.time) : null;
                    const timeStr = rTime && window.formatAttendanceDateTime ? window.formatAttendanceDateTime(rTime) : '';
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.24) 0%, rgba(16, 185, 129, 0.08) 60%, var(--surface, #1e293b) 100%); border: 1.5px solid rgba(34, 197, 94, 0.65); border-radius: 12px; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.12); gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 130px;">
                          ${renderAvatar(p, 'sm')}
                          <div style="flex: 1; min-width: 0;">
                            <b style="font-size: 13px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 1px;">
                              <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                              ${timeStr ? `
                                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; color: #86efac; background: rgba(34, 197, 94, 0.2); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(34, 197, 94, 0.4);">
                                  🕒 ${escapeHtml(timeStr)}
                                </span>
                              ` : ''}
                            </div>
                          </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0; justify-content: flex-end; flex-wrap: wrap;">
                          <span class="badge" style="background: rgba(34, 197, 94, 0.25); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.6); font-size: 10.5px; font-weight: 800; padding: 2px 6px;">🟢 ASISTE</span>
                          <button type="button" class="btn sm ghost" data-toggle-resp="${p.id}" style="padding: 2px 6px; font-size: 11px; height: 26px;">Cambiar</button>
                          ${isRecurringConv ? `
                            <button type="button" class="btn sm danger ghost btn-del-player-rec" data-pid="${p.id}" title="${t('removeFromRecurring', 'Eliminar de todas las convocatorias recurrentes')}" style="padding: 2px 6px; font-size: 11.5px; height: 26px; border-radius: 6px; flex-shrink: 0; border-color: rgba(239, 68, 68, 0.45);">
                              🗑️
                            </button>
                          ` : `
                            <button type="button" class="btn sm danger ghost btn-del-player-single" data-pid="${p.id}" title="${t('removeFromConvocation', 'Quitar de esta convocatoria')}" style="padding: 2px 6px; font-size: 11.5px; height: 26px; border-radius: 6px; flex-shrink: 0; border-color: rgba(239, 68, 68, 0.45);">
                              🗑️
                            </button>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                  ${respondedNo.map(item => {
                    const p = item.player;
                    const reason = (item.resp && (item.resp.notes || item.resp.reason)) ? (item.resp.notes || item.resp.reason) : '';
                    const rTime = item.resp ? (item.resp.timestamp || item.resp.time) : null;
                    const timeStr = rTime && window.formatAttendanceDateTime ? window.formatAttendanceDateTime(rTime) : '';
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.24) 0%, rgba(220, 38, 38, 0.08) 60%, var(--surface, #1e293b) 100%); border: 1.5px solid rgba(239, 68, 68, 0.65); border-radius: 12px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.12); gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 130px;">
                          ${renderAvatar(p, 'sm')}
                          <div style="flex: 1; min-width: 0;">
                            <b style="font-size: 13px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 1px;">
                              <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                              ${timeStr ? `
                                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; color: #fca5a5; background: rgba(239, 68, 68, 0.2); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4);">
                                  🕒 ${escapeHtml(timeStr)}
                                </span>
                              ` : ''}
                            </div>
                            ${reason ? `
                              <div style="font-size: 11px; color: #fca5a5; margin-top: 3px; font-style: italic; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 6px; border-left: 2px solid #ef4444; word-break: break-word;">
                                💬 <b>${t('reason', 'Motivo')}:</b> "${escapeHtml(reason)}"
                              </div>
                            ` : ''}
                          </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0; justify-content: flex-end; flex-wrap: wrap;">
                          <span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.6); font-size: 10.5px; font-weight: 800; padding: 2px 6px;">❌ BAJA</span>
                          <button type="button" class="btn sm ghost" data-toggle-resp="${p.id}" style="padding: 2px 6px; font-size: 11px; height: 26px;">Cambiar</button>
                          ${isRecurringConv ? `
                            <button type="button" class="btn sm danger ghost btn-del-player-rec" data-pid="${p.id}" title="${t('removeFromRecurring', 'Eliminar de todas las convocatorias recurrentes')}" style="padding: 2px 6px; font-size: 11.5px; height: 26px; border-radius: 6px; flex-shrink: 0; border-color: rgba(239, 68, 68, 0.45);">
                              🗑️
                            </button>
                          ` : `
                            <button type="button" class="btn sm danger ghost btn-del-player-single" data-pid="${p.id}" title="${t('removeFromConvocation', 'Quitar de esta convocatoria')}" style="padding: 2px 6px; font-size: 11.5px; height: 26px; border-radius: 6px; flex-shrink: 0; border-color: rgba(239, 68, 68, 0.45);">
                              🗑️
                            </button>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <!-- SECCIÓN 2: Pendientes de Respuesta -->
            <div class="conv-detail-group" style="margin-bottom: 14px;">
              <div class="conv-detail-group-title" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid rgba(250, 204, 21, 0.4); padding-bottom: 6px; margin-bottom: 8px;">
                <span style="color: #fde047; font-weight: 900; font-size: 12.5px;">⏳ PENDIENTES DE RESPUESTA / SIN CONTESTAR (${pending.length})</span>
                ${pending.length > 0 ? `
                  <button type="button" class="btn sm" id="btn-send-details-reminder" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 800; font-size: 11px; padding: 4px 10px; border: none; border-radius: 8px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);">
                    🔔 ${t('sendAttendanceReminder', 'Enviar Recordatorio')} (${pending.length})
                  </button>
                ` : ''}
              </div>
              ${pending.length === 0 ? `
                <div style="padding: 12px; text-align: center; color: #86efac; font-size: 12px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; font-weight: 700;">
                  🎉 ¡Todos los jugadores convocados han dado respuesta!
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${pending.map(item => {
                    const p = item.player;
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: linear-gradient(135deg, rgba(250, 204, 21, 0.22) 0%, rgba(234, 179, 8, 0.08) 60%, var(--surface, #1e293b) 100%); border: 1.5px solid rgba(250, 204, 21, 0.6); border-radius: 12px; box-shadow: 0 2px 8px rgba(250, 204, 21, 0.10); gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 130px;">
                          ${renderAvatar(p, 'sm')}
                          <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                              <b style="font-size: 13px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                              <span class="badge" style="background: rgba(250, 204, 21, 0.25); color: #fde047; border: 1px solid rgba(250, 204, 21, 0.7); font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 5px;">⏳ ${t('noResponsePending', 'Sin respuesta')}</span>
                            </div>
                            <small style="display: block; color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                          </div>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; flex-shrink: 0;">
                          <button type="button" class="btn sm" data-single-remind="${p.id}" title="${t('sendReminderToPlayer', 'Enviar recordatorio a este jugador')}" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.5); padding: 3px 6px; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer; height: 28px;">
                            🔔
                          </button>
                          <button type="button" class="btn sm" data-quick-confirm="${p.id}" style="background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.5); padding: 3px 7px; font-size: 11px; font-weight: 700; border-radius: 6px; height: 28px;">
                            ✓ ${t('attendanceShortYes', 'Asiste')}
                          </button>
                          <button type="button" class="btn sm" data-quick-decline="${p.id}" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); padding: 3px 7px; font-size: 11px; font-weight: 700; border-radius: 6px; height: 28px;">
                            ✕ ${t('attendanceShortNo', 'Baja')}
                          </button>
                          ${isRecurringConv ? `
                            <button type="button" class="btn sm danger ghost btn-del-player-rec" data-pid="${p.id}" title="${t('removeFromRecurring', 'Eliminar de todas las convocatorias recurrentes')}" style="padding: 3px 6px; font-size: 11.5px; height: 28px; border-radius: 6px; flex-shrink: 0; border-color: rgba(239, 68, 68, 0.45);">
                              🗑️
                            </button>
                          ` : `
                            <button type="button" class="btn sm danger ghost btn-del-player-single" data-pid="${p.id}" title="${t('removeFromConvocation', 'Quitar de esta convocatoria')}" style="padding: 3px 6px; font-size: 11.5px; height: 28px; border-radius: 6px; flex-shrink: 0; border-color: rgba(239, 68, 68, 0.45);">
                              🗑️
                            </button>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          `}
        `;

        // Eventos en el cuerpo
        const btnConvAudit = body.querySelector('#btn-conv-audit-actions');
        if (btnConvAudit) {
          btnConvAudit.onclick = () => {
            const linkedSess = conv.sessionId ? Store.session(conv.sessionId) : (Store.state.sessions || []).find(sess => sess.convocationId === conv.id || (sess.date === conv.date && sess.type === conv.type));
            if (linkedSess) showSessionActionsAuditModal(linkedSess);
          };
        }

        const btnQuickTime = body.querySelector('#btn-quick-change-time');
        if (btnQuickTime) {
          btnQuickTime.onclick = () => {
            openTimePicker(conv.time || '10:00', (newTime) => {
              if (!newTime || newTime === conv.time) return;
              conv.time = newTime;
              if (conv.duration) {
                conv.endTime = addMinutesToTime(newTime, conv.duration);
              }
              Store.upsertConvocation(conv);
              if (window.Cloud && window.Cloud.pushCoachState) {
                window.Cloud.pushCoachState(Store.state, true);
              }
              haptic(30);
              toast(`⏰ Hora actualizada a las ${newTime}`, 'success');
              renderDetails();
              if (onDone) onDone();
            });
          };
        }

        const btnQuickDate = body.querySelector('#btn-quick-change-date');
        if (btnQuickDate) {
          btnQuickDate.onclick = () => {
            openDatePicker(conv.date, (newIso) => {
              if (!newIso || newIso === conv.date) return;
              conv.date = newIso;
              Store.upsertConvocation(conv);
              if (window.Cloud && window.Cloud.pushCoachState) {
                window.Cloud.pushCoachState(Store.state, true);
              }
              haptic(30);
              toast(`📅 Fecha actualizada`, 'success');
              renderDetails();
              if (onDone) onDone();
            });
          };
        }

        const btnRemindDetails = body.querySelector('#btn-send-details-reminder');
        if (btnRemindDetails) {
          btnRemindDetails.onclick = async () => {
            await sendConvocationAttendanceReminder(conv);
          };
        }

        const btnQuickEdit = body.querySelector('#btn-quick-open-editor');
        if (btnQuickEdit) {
          btnQuickEdit.onclick = () => {
            closeSheet();
            showEditConvocationModal(conv.id, onDone);
          };
        }

        body.querySelectorAll('[data-single-remind]').forEach(b => {
          b.onclick = async (e) => {
            e.stopPropagation();
            const pid = b.getAttribute('data-single-remind');
            b.disabled = true;
            b.style.opacity = '0.5';
            try {
              await sendConvocationAttendanceReminder(conv, pid);
            } finally {
              setTimeout(() => {
                b.disabled = false;
                b.style.opacity = '1';
              }, 2000);
            }
          };
        });

        body.querySelectorAll('[data-quick-confirm]').forEach(b => {
          b.onclick = () => {
            const pid = b.getAttribute('data-quick-confirm');
            conv.responses = conv.responses || {};
            conv.responses[pid] = { status: 'attending', time: Date.now(), timestamp: Date.now() };
            conv.list = conv.list || {};
            conv.list[pid] = 'called';
            Store.save();
            haptic(25);
            renderDetails();
          };
        });

        body.querySelectorAll('[data-quick-decline]').forEach(b => {
          b.onclick = () => {
            const pid = b.getAttribute('data-quick-decline');
            conv.responses = conv.responses || {};
            conv.responses[pid] = { status: 'absent', time: Date.now(), timestamp: Date.now() };
            conv.list = conv.list || {};
            conv.list[pid] = 'absent';
            Store.save();
            haptic(20);
            renderDetails();
          };
        });

        body.querySelectorAll('[data-toggle-resp]').forEach(b => {
          b.onclick = () => {
            const pid = b.getAttribute('data-toggle-resp');
            conv.responses = conv.responses || {};
            const cur = conv.responses[pid] ? conv.responses[pid].status : 'attending';
            const next = cur === 'attending' ? 'absent' : 'attending';
            conv.responses[pid] = { status: next, time: Date.now(), timestamp: Date.now() };
            conv.list = conv.list || {};
            conv.list[pid] = next === 'attending' ? 'called' : 'absent';
            Store.save();
            haptic(20);
            renderDetails();
          };
        });

        body.querySelectorAll('.btn-del-player-rec').forEach(b => {
          b.onclick = (e) => {
            e.stopPropagation();
            const pid = b.getAttribute('data-pid');
            const pl = Store.player(pid);
            const plName = pl ? Store.playerName(pl) : 'este jugador';
            confirmDialog(
              t('removeFromRecurring', 'Eliminar de todas las convocatorias recurrentes'),
              t('confirmRemovePlayerFromRecurring', `¿Deseas eliminar a ${plName} de esta y de TODAS las convocatorias recurrentes de este horario?\n\nDejará de aparecer convocado en las fechas creadas para este grupo.`),
              () => {
                Store.removePlayerFromRecurringSchedule(convSchedId, pid);
                if (window.Cloud && window.Cloud.pushCoachState) {
                  window.Cloud.pushCoachState(Store.state, true);
                }
                haptic(35);
                toast(`✅ ${plName} eliminado de las convocatorias recurrentes`, 'success');
                conv = Store.convocation(conv.id) || conv;
                renderDetails();
                if (onDone) onDone();
                if (currentTab === 'home' || currentTab === 'convocations') {
                  const view = document.getElementById('view');
                  if (view) {
                    if (currentTab === 'home') renderHomeView(view);
                    else if (currentTab === 'convocations') renderConvocationsView(view);
                  }
                }
              }
            );
          };
        });

        body.querySelectorAll('.btn-del-player-single').forEach(b => {
          b.onclick = (e) => {
            e.stopPropagation();
            const pid = b.getAttribute('data-pid');
            const pl = Store.player(pid);
            const plName = pl ? Store.playerName(pl) : 'este jugador';
            confirmDialog(
              t('removeFromConvocation', 'Quitar de la convocatoria'),
              `¿Deseas quitar a ${plName} de esta convocatoria?`,
              () => {
                conv.list = conv.list || {};
                delete conv.list[pid];
                if (conv.responses) delete conv.responses[pid];
                Store.save();
                if (window.Cloud && window.Cloud.pushCoachState) {
                  window.Cloud.pushCoachState(Store.state, true);
                }
                haptic(30);
                toast(`✅ ${plName} quitado de la convocatoria`, 'info');
                renderDetails();
                if (onDone) onDone();
              }
            );
          };
        });

        const btnManageRec = body.querySelector('#btn-manage-rec-players');
        if (btnManageRec) {
          btnManageRec.onclick = () => {
            showRecurringSchedulePlayersModal(convSchedId, () => {
              conv = Store.convocation(conv.id) || conv;
              renderDetails();
              if (onDone) onDone();
            });
          };
        }
      }

      renderDetails();
      window.activeConvocationModalRefresh = () => {
        conv = Store.convocation(conv.id) || conv;
        renderDetails();
      };
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row" style="display: flex; gap: 8px; width: 100%;">
          <button class="btn danger" id="btn-detail-del" title="${t('delete')}" style="padding: 0 12px; height: 42px;">${icon('trash', 16)}</button>
          <button class="btn ghost" id="btn-detail-edit" style="font-weight: 800; font-size: 12.5px; height: 42px; padding: 0 12px;">${icon('edit', 16)} ${t('edit', 'Editar')}</button>
          <button class="btn primary grow" id="btn-detail-open-tracker" style="font-weight: 900; font-size: 13.5px; height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            ▶️ ${t('openTracker', 'Abrir Tracker')}
          </button>
        </div>
      `;

      foot.querySelector('#btn-detail-open-tracker').onclick = () => {
        closeSheet();
        let s = conv.sessionId ? Store.session(conv.sessionId) : null;
        if (!s) {
          s = (Store.state.sessions || []).find(sess => sess.convocationId === conv.id || (sess.date === conv.date && sess.type === conv.type));
        }
        if (!s) {
          s = Store.createSession({
            type: conv.type,
            date: conv.date,
            time: conv.time || '18:00',
            endTime: conv.endTime || '',
            duration: conv.duration || 90,
            venue: conv.venue || '',
            address: conv.address || '',
            rival: conv.rival || '',
            teamId: conv.teamId || '',
            teamIds: Array.isArray(conv.teamIds) ? conv.teamIds : (conv.teamId ? [conv.teamId] : []),
            convocationId: conv.id,
            notes: conv.notes || ''
          });
          conv.sessionId = s.id;
          Store.save();
        }
        openTracker(s.id);
        setTimeout(() => {
          showSessionAttendanceModal(s.id);
        }, 250);
      };

      foot.querySelector('#btn-detail-del').onclick = () => {
        confirmDialog(t('delete'), '¿Deseas eliminar esta convocatoria?', () => {
          Store.deleteConvocation(conv.id);
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          closeSheet();
          if (onDone) onDone();
        });
      };

      foot.querySelector('#btn-detail-edit').onclick = () => {
        closeSheet();
        setTimeout(() => {
          showEditConvocationModal(conv.id, onDone);
        }, 150);
      };
    }, () => {
      window.activeConvocationModalRefresh = null;
    });
  }

  function showAddManualPlayerToConvModal(currentTeamVal, onPlayerAdded) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const allPlayers = Store.state.players || [];
    let selectedPlayerId = null;

    overlay.innerHTML = `
      <div class="dialog-box" style="max-width: 480px; width: 94%; max-height: 90vh; display: flex; flex-direction: column; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">
            ➕ ${t('addManualPlayer', 'Añadir Jugador a Convocatoria')}
          </h3>
          <button type="button" class="icon-btn ghost" id="dlg-add-manual-x" style="width: 32px; height: 32px;">✕</button>
        </div>

        <div class="segmented" style="display: flex; gap: 4px; margin-bottom: 12px; background: var(--surface2); padding: 4px; border-radius: 10px;">
          <button type="button" class="btn sm primary" id="tab-opt-existing" style="flex: 1; height: 32px; font-size: 11.5px; font-weight: 800; border-radius: 8px;">
            👥 ${t('players', 'Del Club')}
          </button>
          <button type="button" class="btn sm ghost" id="tab-opt-new" style="flex: 1; height: 32px; font-size: 11.5px; font-weight: 800; border-radius: 8px;">
            ✨ ${t('newPlayer', 'Nuevo Invitado')}
          </button>
        </div>

        <!-- SECCIÓN 1: SELECCIONAR JUGADOR YA REGISTRADO (VISTA CUADRICULADA CON FOTOS Y EQUIPOS) -->
        <div id="sec-add-existing" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <input type="text" id="inp-search-conv-player" placeholder="${t('searchPlayerPlaceholder', 'Buscar por nombre, dorsal o equipo...')}" style="width: 100%; padding: 8px 12px; font-size: 13px; border-radius: 10px; margin-bottom: 10px; border: 1px solid var(--border); background: var(--bg2); color: #fff;" />

          <div id="grid-existing-players" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; max-height: 48vh; overflow-y: auto; padding: 2px; margin-bottom: 12px;">
            ${allPlayers.map(p => {
              const tm = Store.team(p.teamId);
              const pName = Store.playerName(p);
              const searchKey = `${pName} ${p.mainDorsal || ''} ${tm ? tm.name : ''}`.toLowerCase();
              return `
                <div class="card conv-grid-card" data-pid="${p.id}" data-search="${escapeHtml(searchKey)}" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10px 6px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--surface2); cursor: pointer; transition: all 0.15s; position: relative; user-select: none;">
                  <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: rgba(34,211,238,0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 6px; border: 1.5px solid rgba(255,255,255,0.2);">
                    ${p.photo ? `<img src="${p.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<b style="font-size: 16px; color: var(--cyan);">${(p.name || '?')[0].toUpperCase()}</b>`}
                  </div>
                  <div style="font-size: 12px; font-weight: 800; color: #fff; width: 100%; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                    #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(pName)}
                  </div>
                  <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">
                    ${p.mainPosition || 'Jugador'}
                  </div>
                  <div style="margin-top: 4px; width: 100%;">
                    ${tm ? `<span class="badge" style="background: ${tm.color}25; color: ${tm.color}; border: 1px solid ${tm.color}60; font-size: 9.5px; padding: 1px 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: block;">🛡️ ${escapeHtml(tm.name)}</span>` : `<span class="badge" style="background: var(--surface); color: var(--muted); font-size: 9.5px;">⚪ Sin equipo</span>`}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <button type="button" class="btn block primary" id="btn-confirm-add-existing" style="font-weight: 800; height: 40px; margin-top: auto;">
            ✅ ${t('add', 'Añadir a la Convocatoria')}
          </button>
        </div>

        <!-- SECCIÓN 2: CREAR JUGADOR PUNTUAL / INVITADO -->
        <div id="sec-add-new" style="display: none;">
          <div class="field" style="margin-bottom: 10px;">
            <label style="font-size: 12px; font-weight: 800; color: var(--muted);">${t('fullName', 'Nombre y Apellidos')} *</label>
            <input type="text" id="inp-guest-name" placeholder="Ej. Mateo Gómez" style="width: 100%; padding: 8px 12px; font-size: 13px; border-radius: 8px;" />
          </div>
          <div class="field-row" style="display: flex; gap: 8px; margin-bottom: 14px;">
            <div class="field" style="flex: 1;">
              <label style="font-size: 12px; font-weight: 800; color: var(--muted);">${t('dorsal', 'Dorsal')}</label>
              <input type="number" id="inp-guest-dorsal" placeholder="10" style="width: 100%; padding: 8px 12px; font-size: 13px; border-radius: 8px;" />
            </div>
            <div class="field" style="flex: 1.5;">
              <label style="font-size: 12px; font-weight: 800; color: var(--muted);">${t('position', 'Posición')}</label>
              <input type="text" id="inp-guest-pos" placeholder="Delantero" value="Jugador" style="width: 100%; padding: 8px 12px; font-size: 13px; border-radius: 8px;" />
            </div>
          </div>
          <button type="button" class="btn block primary" id="btn-confirm-add-new" style="font-weight: 800; height: 38px;">
            ✨ ${t('createPlayer', 'Crear y Añadir a Convocatoria')}
          </button>
        </div>
      </div>
    `;

    function close() { overlay.remove(); }
    overlay.querySelector('#dlg-add-manual-x').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const tabExist = overlay.querySelector('#tab-opt-existing');
    const tabNew = overlay.querySelector('#tab-opt-new');
    const secExist = overlay.querySelector('#sec-add-existing');
    const secNew = overlay.querySelector('#sec-add-new');

    tabExist.onclick = () => {
      tabExist.className = 'btn sm primary';
      tabNew.className = 'btn sm ghost';
      secExist.style.display = 'flex';
      secNew.style.display = 'none';
    };
    tabNew.onclick = () => {
      tabNew.className = 'btn sm primary';
      tabExist.className = 'btn sm ghost';
      secNew.style.display = 'block';
      secExist.style.display = 'none';
    };

    const searchInp = overlay.querySelector('#inp-search-conv-player');
    const gridCards = overlay.querySelectorAll('.conv-grid-card');

    if (searchInp) {
      searchInp.oninput = () => {
        const q = searchInp.value.toLowerCase().trim();
        gridCards.forEach(c => {
          const s = c.getAttribute('data-search') || '';
          c.style.display = (!q || s.includes(q)) ? 'flex' : 'none';
        });
      };
    }

    gridCards.forEach(c => {
      c.onclick = () => {
        const pid = c.getAttribute('data-pid');
        selectedPlayerId = pid;
        gridCards.forEach(x => {
          x.style.borderColor = 'var(--border)';
          x.style.background = 'var(--surface2)';
          x.style.boxShadow = 'none';
        });
        c.style.borderColor = '#22d3ee';
        c.style.background = 'rgba(34, 211, 238, 0.15)';
        c.style.boxShadow = '0 0 14px rgba(34, 211, 238, 0.4)';
        haptic(20);
      };
      c.ondblclick = () => {
        const pid = c.getAttribute('data-pid');
        const player = Store.player(pid);
        if (player && typeof onPlayerAdded === 'function') {
          onPlayerAdded(player);
        }
        close();
      };
    });

    overlay.querySelector('#btn-confirm-add-existing').onclick = () => {
      if (!selectedPlayerId) {
        toast('Selecciona un jugador tocando su tarjeta', 'error');
        return;
      }
      const player = Store.player(selectedPlayerId);
      if (player && typeof onPlayerAdded === 'function') {
        onPlayerAdded(player);
      }
      close();
    };

    overlay.querySelector('#btn-confirm-add-new').onclick = () => {
      const name = overlay.querySelector('#inp-guest-name').value.trim();
      if (!name) {
        toast('Introduce el nombre del jugador', 'error');
        return;
      }
      const dorsalVal = overlay.querySelector('#inp-guest-dorsal').value.trim();
      const dorsal = dorsalVal ? parseInt(dorsalVal, 10) : null;
      const pos = overlay.querySelector('#inp-guest-pos').value.trim() || 'Jugador';

      const newPlayer = Store.upsertPlayer({
        name,
        mainDorsal: dorsal,
        mainPosition: pos,
        teamId: currentTeamVal || ''
      });
      if (typeof onPlayerAdded === 'function') {
        onPlayerAdded(newPlayer);
      }
      close();
    };

    document.body.appendChild(overlay);
  }

  function showEditConvocationModal(convId, onDone) {
    const existing = convId ? Store.convocation(convId) : null;
    const c = Object.assign({
      id: convId || null,
      title: '',
      type: 'match',
      date: new Date().toISOString().slice(0, 10),
      time: '10:00',
      venue: '',
      rival: '',
      teamId: '',
      notes: '',
      list: {}
    }, existing || {});

    const list = Object.assign({}, c.list || {});
    let currentType = c.type;
    const teams = Store.state.teams || [];
    let initialFilter = c.teamId || 'all';
    let selectedTeamIds = (c.teamIds && c.teamIds.length) ? [...c.teamIds] : (c.teamId ? [c.teamId] : []);

    openSheet(c.id ? 'Editar Convocatoria' : t('newConvocation'), (body) => {
      const allPlayers = Store.sortedPlayers();

      // Si es una convocatoria nueva y la lista está vacía, pre-convocar a los jugadores del equipo inicial
      if (!c.id && Object.keys(list).length === 0) {
        allPlayers.forEach(p => {
          if (!selectedTeamIds.length || selectedTeamIds.includes(p.teamId)) {
            list[p.id] = 'called';
          }
        });
      }

      let countCalled = 0, countBench = 0, countInjured = 0, countAbsent = 0;
      allPlayers.forEach(p => {
        const st = list[p.id];
        if (st === 'called') countCalled++;
        else if (st === 'bench') countBench++;
        else if (st === 'injured') countInjured++;
        else if (st === 'absent') countAbsent++;
      });

      body.innerHTML = `
        <div class="field">
          <label>${t('convocationTitle')}</label>
          <input type="text" id="conv-title" placeholder="${t('convocationTitlePlaceholder')}" value="${escapeHtml(c.title)}" />
        </div>

        <div class="segmented" style="margin-bottom: 12px;">
          <button type="button" class="${currentType === 'match' ? 'active' : ''}" id="conv-type-match">
            🏆 ${t('match')}
          </button>
          <button type="button" class="${currentType === 'training' ? 'active' : ''}" id="conv-type-training">
            ⚽ ${t('training')}
          </button>
        </div>

        <div class="field">
          <label>${t('team')}</label>
          <input type="hidden" id="conv-team" value="${selectedTeamIds.join(',')}" />
          <div class="team-bubbles-container" id="conv-team-bubbles">
            <div class="team-bubble ${selectedTeamIds.length === 0 ? 'active' : ''}" data-tid="" style="border-color: rgba(255, 255, 255, 0.25);">
              <span class="dot" style="background: #94a3b8;"></span>
              <span>${t('allTeams')}</span>
              <span class="check-icon">✓</span>
            </div>
            ${teams.map(tm => {
              const tmColor = tm.color || '#22d3ee';
              const isActive = selectedTeamIds.includes(tm.id);
              return `
                <div class="team-bubble ${isActive ? 'active' : ''}" data-tid="${tm.id}" style="border-color: ${tmColor}; color: #fff;">
                  <span class="dot" style="background: ${tmColor};"></span>
                  <span>${escapeHtml(tm.name)}</span>
                  <span class="check-icon" style="color: ${tmColor};">✓</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${renderDatePickerFieldHtml('conv-date', c.date, t('date'))}
        ${renderTimePickerFieldHtml('conv-time', c.time || '10:00', t('time', 'Hora'))}

        <div class="field-row">
          <div class="field">
            <label>Lugar / Campo</label>
            <input type="text" id="conv-venue" placeholder="Ej: Campo Municipal" value="${escapeHtml(c.venue || '')}" />
          </div>
          <div class="field">
            <label>${t('rivalTeam')}</label>
            <input type="text" id="conv-rival" placeholder="${t('rivalPlaceholder')}" value="${escapeHtml(c.rival || '')}" />
          </div>
        </div>

        <div class="field">
          <label>📍 Dirección exacta / Address</label>
          <input type="text" id="conv-address" placeholder="Ej: Carrer Major 45, 08001 Barcelona" value="${escapeHtml(c.address || '')}" />
        </div>

        <div class="field">
          <label>Notas adicionales</label>
          <input type="text" id="conv-notes" placeholder="Ej: Llevar equipación azul, puntualidad..." value="${escapeHtml(c.notes || '')}" />
        </div>

        <div class="field" style="margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label style="margin: 0; font-size: 11.5px; font-weight: 700;">🌐 Web de Confirmación (GitHub Pages)</label>
            <span id="conv-help-github" style="color: var(--cyan); cursor: pointer; font-size: 11px; font-weight: 700;">ℹ️ ¿Cómo funciona?</span>
          </div>
          <input type="text" id="conv-web-url" placeholder="https://tu-usuario.github.io/app/convocatoria.html" value="${escapeHtml(Store.state.settings.convocatoriaWebUrl || '')}" style="font-size: 12px;" />
        </div>

        <div class="section-title" style="margin-top: 16px;">
          <span>Plantilla de Convocados</span>
        </div>

        <!-- Filtro por equipo y acciones rápidas -->
        <div style="background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 10px; margin-bottom: 10px;">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 11.5px; font-weight: 800; color: var(--muted); white-space: nowrap; margin: 0;">Filtrar:</label>
            <select id="conv-filter-team" style="flex: 1; padding: 6px 10px; font-size: 12.5px; border-radius: 8px;">
              <option value="all">Todos los jugadores (${allPlayers.length})</option>
              ${teams.map(t => {
                const count = allPlayers.filter(p => p.teamId === t.id).length;
                return `<option value="${t.id}" ${initialFilter === t.id ? 'selected' : ''}>${escapeHtml(t.name)} (${count})</option>`;
              }).join('')}
            </select>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn sm" id="btn-conv-call-all" style="background: rgba(34, 197, 94, 0.18); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 11.5px; padding: 4px 8px;">
              ⚡ Convocar visibles
            </button>
            <button type="button" class="btn sm ghost" id="btn-conv-clear-all" style="font-size: 11.5px; padding: 4px 8px;">
              Desmarcar visibles
            </button>
            <button type="button" class="btn sm secondary" id="btn-conv-add-manual" style="margin-left: auto; font-size: 11.5px; padding: 4px 8px;">
              + Jugador puntual
            </button>
          </div>
        </div>

        <!-- Barra de recuento en vivo -->
        <div class="conv-badge-row" id="conv-counters-row" style="margin-bottom: 10px;">
          <span class="conv-status-chip called" id="chip-called">🟢 ${countCalled} ${t('calledStatus')}</span>
        </div>

        <!-- Lista de jugadores con checkbox de convocado (scroll mantenido sin saltos) -->
        <div class="card" id="conv-players-container" style="max-height: 38vh; overflow-y: auto; padding: 6px 12px;">
          ${allPlayers.map(p => {
            const isCalled = (list[p.id] === 'called');
            const pTeam = Store.team(p.teamId);
            return `
              <div class="conv-player-row ${isCalled ? 'selected' : ''}" data-pid="${p.id}" data-team="${p.teamId || ''}">
                ${renderAvatar(p, 'sm')}
                <div class="conv-player-name ellipsis">
                  <b>#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                  <small style="display: block; color: var(--muted); font-size: 11px;">
                    ${p.mainPosition || 'Jugador'} ${pTeam ? '• ' + escapeHtml(pTeam.name) : ''}
                  </small>
                </div>
                <div class="conv-btn-group">
                  <button type="button" class="conv-checkbox-btn ${isCalled ? 'checked' : ''}" data-p="${p.id}" title="${t('calledStatus')}">
                    <span class="conv-check-icon">✓</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${(c.scheduleId || (c.id && c.id.startsWith('rec_'))) ? `
          <div style="background: rgba(34, 211, 238, 0.08); border: 1.5px solid rgba(34, 211, 238, 0.35); border-radius: 12px; padding: 10px 12px; margin-top: 12px; display: flex; align-items: flex-start; gap: 9px;">
            <input type="checkbox" id="conv-apply-to-recurring" style="width: 18px; height: 18px; margin-top: 2px; accent-color: var(--cyan); cursor: pointer;" />
            <label for="conv-apply-to-recurring" style="font-size: 12px; color: #fff; cursor: pointer; line-height: 1.35; margin: 0;">
              🔄 <b>${t('applyToAllRecurring', 'Aplicar cambios de convocados a todas las convocatorias de este horario')}</b>
              <small style="display: block; color: var(--muted); font-size: 11px; margin-top: 2px;">Los jugadores desmarcados se eliminarán de todas las convocatorias recurrentes creadas para este grupo.</small>
            </label>
          </div>
        ` : ''}
      `;

      function updateCounterChips() {
        let nCalled = 0;
        const pList = Store.state.players || [];
        pList.forEach(p => {
          if (list[p.id] === 'called') nCalled++;
        });
        const cChip = body.querySelector('#chip-called');
        if (cChip) cChip.textContent = `🟢 ${nCalled} ${t('calledStatus')}`;
      }

      const convTeamInput = body.querySelector('#conv-team');
      const convTeamBubbles = body.querySelectorAll('#conv-team-bubbles .team-bubble');
      const filterSelect = body.querySelector('#conv-filter-team');
      const container = body.querySelector('#conv-players-container');

      function applyFilter(teamVal) {
        if (!container) return;
        const rows = container.querySelectorAll('.conv-player-row');
        rows.forEach(r => {
          const rTeam = r.getAttribute('data-team');
          if (!teamVal || teamVal === 'all') {
            r.style.display = 'flex';
          } else if (Array.isArray(teamVal)) {
            r.style.display = (!teamVal.length || teamVal.includes(rTeam)) ? 'flex' : 'none';
          } else {
            r.style.display = (rTeam === teamVal) ? 'flex' : 'none';
          }
        });
      }

      function updateTeamBubblesUI() {
        convTeamBubbles.forEach(tb => {
          const tid = tb.getAttribute('data-tid') || '';
          if (!tid) {
            tb.classList.toggle('active', selectedTeamIds.length === 0);
          } else {
            tb.classList.toggle('active', selectedTeamIds.includes(tid));
          }
        });
        if (convTeamInput) convTeamInput.value = selectedTeamIds.join(',');
        if (filterSelect) {
          filterSelect.value = selectedTeamIds.length === 1 ? selectedTeamIds[0] : 'all';
        }
        applyFilter(selectedTeamIds.length ? selectedTeamIds : 'all');
      }

      const typeMatchBtn = body.querySelector('#conv-type-match');
      const typeTrainBtn = body.querySelector('#conv-type-training');
      if (typeMatchBtn && typeTrainBtn) {
        typeMatchBtn.onclick = () => {
          currentType = 'match';
          typeMatchBtn.className = 'active';
          typeTrainBtn.className = '';
          // En partido solo se permite UN ÚNICO EQUIPO
          if (selectedTeamIds.length > 1) {
            selectedTeamIds = [selectedTeamIds[0]];
          } else if (selectedTeamIds.length === 0 && Store.state.teams.length > 0) {
            selectedTeamIds = [Store.state.teams[0].id];
          }
          updateTeamBubblesUI();
        };
        typeTrainBtn.onclick = () => {
          currentType = 'training';
          typeTrainBtn.className = 'active';
          typeMatchBtn.className = '';
          updateTeamBubblesUI();
        };
      }

      convTeamBubbles.forEach(tb => {
        tb.onclick = () => {
          const tid = tb.getAttribute('data-tid') || '';
          if (currentType === 'match') {
            // En partidos, estrictamente UN SOLO EQUIPO (no se puede elegir "todos")
            if (!tid) return;
            selectedTeamIds = [tid];
          } else {
            // En entrenamientos, se permite elegir múltiples equipos o todos
            if (!tid) {
              selectedTeamIds = [];
            } else {
              if (selectedTeamIds.includes(tid)) {
                selectedTeamIds = selectedTeamIds.filter(x => x !== tid);
              } else {
                selectedTeamIds.push(tid);
              }
            }
          }
          updateTeamBubblesUI();
          haptic(20);
        };
      });

      if (filterSelect) {
        filterSelect.onchange = () => {
          const val = filterSelect.value;
          const tid = val === 'all' ? '' : val;
          selectedTeamIds = tid ? [tid] : [];
          updateTeamBubblesUI();
        };
        if (selectedTeamIds.length > 0) {
          applyFilter(selectedTeamIds);
        } else if (initialFilter !== 'all') {
          applyFilter(initialFilter);
        }
      }

      // Conexión por delegación de eventos con checkbox y marcado visual de toda la tarjeta
      if (container) {
        container.addEventListener('click', (e) => {
          const row = e.target.closest('.conv-player-row');
          if (!row) return;
          const pid = row.getAttribute('data-pid');
          const chk = row.querySelector('.conv-checkbox-btn');

          if (list[pid] === 'called') {
            delete list[pid];
            row.classList.remove('selected');
            if (chk) chk.classList.remove('checked');
          } else {
            list[pid] = 'called';
            row.classList.add('selected');
            if (chk) chk.classList.add('checked');
          }
          haptic(20);
          updateCounterChips();
        });
      }

      // Convocar visibles
      const btnCallAll = body.querySelector('#btn-conv-call-all');
      if (btnCallAll && container) {
        btnCallAll.onclick = () => {
          const rows = container.querySelectorAll('.conv-player-row');
          let count = 0;
          rows.forEach(r => {
            if (r.style.display !== 'none') {
              const pid = r.getAttribute('data-pid');
              list[pid] = 'called';
              r.classList.add('selected');
              const chk = r.querySelector('.conv-checkbox-btn');
              if (chk) chk.classList.add('checked');
              count++;
            }
          });
          haptic(35);
          updateCounterChips();
          toast(`${count} jugadores convocados`, 'success');
        };
      }

      // Desmarcar visibles
      const btnClearAll = body.querySelector('#btn-conv-clear-all');
      if (btnClearAll && container) {
        btnClearAll.onclick = () => {
          const rows = container.querySelectorAll('.conv-player-row');
          rows.forEach(r => {
            if (r.style.display !== 'none') {
              const pid = r.getAttribute('data-pid');
              delete list[pid];
              r.classList.remove('selected');
              const chk = r.querySelector('.conv-checkbox-btn');
              if (chk) chk.classList.remove('checked');
            }
          });
          haptic(20);
          updateCounterChips();
        };
      }

      // Añadir jugador puntual
      const btnAddManual = body.querySelector('#btn-conv-add-manual');
      if (btnAddManual && container) {
        btnAddManual.onclick = () => {
          const currentTeamVal = (filterSelect && filterSelect.value !== 'all') ? filterSelect.value : (body.querySelector('#conv-team') ? body.querySelector('#conv-team').value : '');
          showAddManualPlayerToConvModal(currentTeamVal, (player) => {
            list[player.id] = 'called';
            const existingRow = container.querySelector(`.conv-player-row[data-pid="${player.id}"]`);
            if (existingRow) {
              existingRow.style.display = 'flex';
              existingRow.classList.add('selected');
              const chk = existingRow.querySelector('.conv-checkbox-btn');
              if (chk) chk.classList.add('checked');
            } else {
              const pTeam = Store.team(player.teamId);
              const rowHtml = `
                <div class="conv-player-row selected" data-pid="${player.id}" data-team="${player.teamId || ''}">
                  ${renderAvatar(player, 'sm')}
                  <div class="conv-player-name ellipsis">
                    <b>#${player.mainDorsal != null ? player.mainDorsal : '-'} ${escapeHtml(Store.playerName(player))}</b>
                    <small style="display: block; color: var(--muted); font-size: 11px;">
                      ${player.mainPosition || 'Jugador'} ${pTeam ? '• ' + escapeHtml(pTeam.name) : ''}
                    </small>
                  </div>
                  <div class="conv-btn-group">
                    <button type="button" class="conv-checkbox-btn checked" data-p="${player.id}" title="${t('calledStatus')}">
                      <span class="conv-check-icon">✓</span>
                    </button>
                  </div>
                </div>
              `;
              container.insertAdjacentHTML('afterbegin', rowHtml);
            }
            haptic(30);
            updateCounterChips();
            toast(`${escapeHtml(Store.playerName(player))} añadido y convocado`, 'success');
          });
        };
      }

      // Ayuda GitHub Pages
      const btnHelpGithub = body.querySelector('#conv-help-github');
      if (btnHelpGithub) {
        btnHelpGithub.onclick = () => {
          alert(
            '🌐 FORMULARIO WEB DE ASISTENCIA EN GITHUB:\n\n' +
            '1. Sube el archivo "convocatoria.html" (incluido en la app) a un repositorio público en tu GitHub.\n' +
            '2. En Configuración del repositorio -> Pages, activa GitHub Pages en la rama main.\n' +
            '3. Pega aquí el enlace que te genere GitHub (ej: https://tu-usuario.github.io/repo/convocatoria.html).\n\n' +
            '¡Listo! Al compartir la convocatoria, se incluirá el enlace y cada jugador podrá elegir su nombre y marcar si asiste o no.'
          );
        };
      }

      bindDatePickerField('conv-date', body);
      bindTimePickerField('conv-time', body);
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          ${c.id ? `<button class="btn danger" id="btn-conv-del" title="${t('delete')}">${icon('trash', 16)}</button>` : ''}
          <button class="btn ghost grow" id="btn-conv-cancel">${t('cancel')}</button>
          <button class="btn primary grow" id="btn-conv-save">${t('saveChanges')}</button>
        </div>
      `;

      foot.querySelector('#btn-conv-cancel').onclick = closeSheet;

      if (c.id) {
        foot.querySelector('#btn-conv-del').onclick = () => {
          confirmDialog(t('delete'), '¿Deseas eliminar esta convocatoria?', () => {
            Store.deleteConvocation(c.id);
            if (window.Cloud && window.Cloud.pushCoachState) {
              window.Cloud.pushCoachState(Store.state, true);
            }
            closeSheet();
            if (onDone) onDone();
          });
        };
      }

      foot.querySelector('#btn-conv-save').onclick = () => {
        const textInp = document.getElementById('conv-date-text');
        const hiddenInp = document.getElementById('conv-date');
        if (textInp && hiddenInp) {
          const parsed = parseInputDateToIso(textInp.value);
          if (parsed) hiddenInp.value = parsed;
        }

        const title = document.getElementById('conv-title').value.trim();
        const date = hiddenInp ? hiddenInp.value : (c.date || new Date().toISOString().slice(0, 10));
        const time = document.getElementById('conv-time').value;
        const venue = document.getElementById('conv-venue').value.trim();
        const address = document.getElementById('conv-address') ? document.getElementById('conv-address').value.trim() : '';
        const rival = document.getElementById('conv-rival').value.trim();
        const notes = document.getElementById('conv-notes').value.trim();
        const teamId = document.getElementById('conv-team') ? document.getElementById('conv-team').value : '';

        const webUrlInput = document.getElementById('conv-web-url');
        if (webUrlInput) {
          Store.state.settings.convocatoriaWebUrl = webUrlInput.value.trim();
          Store.save();
        }

        const isNew = !c.id;
        const savedConv = Store.upsertConvocation({
          id: c.id,
          title: title || (currentType === 'match' ? (rival || 'Partido') : 'Entrenamiento'),
          type: currentType,
          date,
          time,
          venue,
          address,
          rival,
          teamId: selectedTeamIds[0] || '',
          teamIds: selectedTeamIds,
          notes,
          list
        });

        const applyToRecChk = document.getElementById('conv-apply-to-recurring');
        if (applyToRecChk && applyToRecChk.checked) {
          let targetSchedId = c.scheduleId || '';
          if (!targetSchedId && c.id && c.id.startsWith('rec_')) {
            const parts = c.id.split('_');
            if (parts.length >= 3) targetSchedId = parts[1];
          }
          if (targetSchedId) {
            const prevPlayerIds = Object.keys(c.list || {});
            prevPlayerIds.forEach(pid => {
              if (!list[pid] || list[pid] === 'absent') {
                Store.removePlayerFromRecurringSchedule(targetSchedId, pid);
              }
            });
          }
        }

        // Sincronizar bidireccionalmente con la sesión correspondiente en Inicio y Sesiones
        let linkedSess = null;
        if (savedConv.sessionId) {
          linkedSess = Store.session(savedConv.sessionId);
        }
        if (!linkedSess && savedConv.id) {
          linkedSess = (Store.state.sessions || []).find(s => s.convocationId === savedConv.id);
        }
        if (!linkedSess) {
          linkedSess = (Store.state.sessions || []).find(s => 
            s.date === (c.date || savedConv.date) && 
            s.type === savedConv.type && 
            (!savedConv.rival || !s.rival || s.rival === savedConv.rival)
          );
        }

        if (linkedSess) {
          linkedSess.convocationId = savedConv.id;
          linkedSess.title = savedConv.title;
          linkedSess.date = savedConv.date;
          linkedSess.time = savedConv.time;
          linkedSess.venue = savedConv.venue;
          linkedSess.rival = savedConv.rival;
          linkedSess.teamId = savedConv.teamId;
          linkedSess.teamIds = savedConv.teamIds;
          savedConv.sessionId = linkedSess.id;
          Store.save();
        } else {
          try {
            const newSess = Store.createSession({
              type: currentType,
              date,
              time,
              venue,
              rival: rival || '',
              title: title || (currentType === 'match' ? (rival || 'Partido') : 'Entrenamiento'),
              teamId: selectedTeamIds[0] || '',
              teamIds: selectedTeamIds,
              convocationId: savedConv.id
            });
            if (newSess) {
              savedConv.sessionId = newSess.id;
              Store.save();
            }
          } catch (err) {
            console.error('Error auto-creando sesión desde convocatoria:', err);
          }
        }

        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        toast(t('savedSuccess'), 'success');
        closeSheet();
        if (onDone) onDone();
        setTimeout(() => {
          showConvocationDetailsModal(savedConv, onDone);
        }, 180);
      };
    });
  }

  /* =========================================================
     GESTIÓN DE JUGADORES DE UN HORARIO RECURRENTE
     ========================================================= */
  function showRecurringSchedulePlayersModal(schedId, onDone) {
    let sched = Store.recurringSchedule(schedId);
    if (!sched && schedId) {
      sched = (Store.state.recurringSchedules || []).find(r => r.id === schedId);
    }
    if (!sched) {
      toast('Horario recurrente no encontrado', 'error');
      return;
    }

    openSheet(`${t('managePlayers', 'Gestionar Jugadores')} - ${escapeHtml(sched.title || 'Horario')}`, (body) => {
      function renderList() {
        const targetTeamIds = (Array.isArray(sched.teamIds) && sched.teamIds.length > 0)
          ? sched.teamIds
          : (sched.teamId ? [sched.teamId] : []);
        const excludedSet = new Set(sched.excludedPlayerIds || []);
        const includedSet = new Set(sched.includedPlayerIds || []);

        const allPlayers = Store.sortedPlayers();
        // Jugadores del equipo asignado
        const basePlayers = allPlayers.filter(p => {
          if (!targetTeamIds.length) return true;
          return targetTeamIds.includes(p.teamId);
        });

        // Jugadores invitados de otros equipos
        const guestPlayers = allPlayers.filter(p => includedSet.has(p.id) && !basePlayers.some(bp => bp.id === p.id));

        const candidatePlayers = [...basePlayers, ...guestPlayers];
        const summonedPlayers = candidatePlayers.filter(p => !excludedSet.has(p.id));
        const excludedPlayers = candidatePlayers.filter(p => excludedSet.has(p.id));

        body.innerHTML = `
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.4;">
            ${t('summonedPlayersDesc', 'Desmarca o elimina los jugadores que no deben aparecer convocados en las fechas de este grupo.')}
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
            <span class="badge" style="background: rgba(34, 197, 94, 0.18); color: #86efac; font-size: 12px; font-weight: 800; padding: 4px 10px;">
              🟢 ${summonedPlayers.length} Convocados
            </span>
            ${excludedPlayers.length > 0 ? `
              <span class="badge" style="background: rgba(239, 68, 68, 0.18); color: #fca5a5; font-size: 12px; font-weight: 800; padding: 4px 10px;">
                ❌ ${excludedPlayers.length} Excluidos
              </span>
            ` : ''}
          </div>

          <div class="section-title" style="margin-top: 10px; margin-bottom: 8px;">
            <span>🟢 JUGADORES CONVOCADOS EN CADA FECHA (${summonedPlayers.length})</span>
          </div>

          ${summonedPlayers.length === 0 ? `
            <div style="text-align: center; padding: 20px; color: var(--muted); background: var(--surface2); border-radius: 12px; font-size: 12px; margin-bottom: 14px;">
              No hay jugadores convocados en este horario recurrente.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
              ${summonedPlayers.map(p => {
                const pTeam = Store.team(p.teamId);
                const isGuest = targetTeamIds.length > 0 && p.teamId && !targetTeamIds.includes(p.teamId);
                return `
                  <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; background: var(--surface2); border: 1.5px solid var(--border);">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                      ${renderAvatar(p, 'sm')}
                      <div style="min-width: 0; flex: 1;">
                        <b style="font-size: 13.5px; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}
                        </b>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                          <small style="color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                          ${pTeam ? `
                            <span class="badge" style="background: ${pTeam.color || 'var(--cyan)'}22; color: ${pTeam.color || 'var(--cyan)'}; font-size: 10px; padding: 1px 6px;">
                              ${escapeHtml(pTeam.name)}
                            </span>
                          ` : ''}
                          ${isGuest ? `
                            <span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #fde047; font-size: 9.5px; padding: 1px 5px;">
                              ⭐ Invitado
                            </span>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                    <button type="button" class="btn sm danger ghost btn-sched-remove-p" data-pid="${p.id}" style="font-weight: 800; font-size: 11.5px; height: 32px; padding: 0 10px; border-radius: 8px; border-color: rgba(239, 68, 68, 0.4); flex-shrink: 0;" title="${t('removeFromRecurring', 'Eliminar de todas las convocatorias')}">
                      🗑️ ${t('delete', 'Eliminar')}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          ${excludedPlayers.length > 0 ? `
            <div class="section-title" style="margin-top: 14px; margin-bottom: 8px;">
              <span>❌ JUGADORES EXCLUIDOS DE ESTE HORARIO (${excludedPlayers.length})</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
              ${excludedPlayers.map(p => {
                const pTeam = Store.team(p.teamId);
                return `
                  <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 12px; background: rgba(239, 68, 68, 0.05); border: 1.5px dashed rgba(239, 68, 68, 0.35); opacity: 0.85;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                      ${renderAvatar(p, 'sm')}
                      <div style="min-width: 0; flex: 1;">
                        <span style="font-size: 13px; color: var(--muted); text-decoration: line-through; display: block;">
                          #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}
                        </span>
                        <small style="color: #fca5a5; font-size: 10.5px;">${t('excludedFromSchedule', 'Excluido de este horario')}</small>
                      </div>
                    </div>
                    <button type="button" class="btn sm ghost btn-sched-restore-p" data-pid="${p.id}" style="font-weight: 800; font-size: 11px; height: 30px; padding: 0 8px; color: #86efac; border-color: rgba(34, 197, 94, 0.4); flex-shrink: 0;">
                      ➕ ${t('reIncludePlayer', 'Reincorporar')}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- Botón para añadir jugador externo puntual a este horario -->
          <button type="button" class="btn sm secondary block" id="btn-add-external-player" style="font-size: 12px; height: 38px; font-weight: 800; margin-top: 10px;">
            ➕ Convocar a otro jugador del club en este horario
          </button>
        `;

        body.querySelectorAll('.btn-sched-remove-p').forEach(b => {
          b.onclick = () => {
            const pid = b.getAttribute('data-pid');
            const pl = Store.player(pid);
            const plName = pl ? Store.playerName(pl) : 'este jugador';
            confirmDialog(
              t('removeFromRecurring', 'Eliminar de todas las convocatorias recurrentes'),
              t('confirmRemovePlayerFromRecurring', `¿Deseas eliminar a ${plName} de todas las convocatorias recurrentes creadas para este horario?`),
              () => {
                Store.removePlayerFromRecurringSchedule(sched.id, pid);
                if (window.Cloud && window.Cloud.pushCoachState) {
                  window.Cloud.pushCoachState(Store.state, true);
                }
                haptic(35);
                toast(`✅ ${plName} eliminado de este horario y sus convocatorias`, 'success');
                renderList();
                if (onDone) onDone();
              }
            );
          };
        });

        body.querySelectorAll('.btn-sched-restore-p').forEach(b => {
          b.onclick = () => {
            const pid = b.getAttribute('data-pid');
            const pl = Store.player(pid);
            const plName = pl ? Store.playerName(pl) : 'este jugador';
            Store.includePlayerInRecurringSchedule(sched.id, pid);
            if (window.Cloud && window.Cloud.pushCoachState) {
              window.Cloud.pushCoachState(Store.state, true);
            }
            haptic(25);
            toast(`✅ ${plName} reincorporado al horario`, 'success');
            renderList();
            if (onDone) onDone();
          };
        });

        const btnAddExt = body.querySelector('#btn-add-external-player');
        if (btnAddExt) {
          btnAddExt.onclick = () => {
            showAddPlayerToRecurringScheduleModal(sched.id, () => {
              renderList();
              if (onDone) onDone();
            });
          };
        }
      }

      renderList();
    });
  }

  function showAddPlayerToRecurringScheduleModal(schedId, onAdded) {
    const sched = Store.recurringSchedule(schedId);
    if (!sched) return;

    openSheet('➕ Convocar Jugador al Horario', (body) => {
      const allPlayers = Store.sortedPlayers();
      const targetTeamIds = (Array.isArray(sched.teamIds) && sched.teamIds.length > 0)
        ? sched.teamIds
        : (sched.teamId ? [sched.teamId] : []);
      const excludedSet = new Set(sched.excludedPlayerIds || []);
      const includedSet = new Set(sched.includedPlayerIds || []);

      const nonSummonedPlayers = allPlayers.filter(p => {
        const isBase = (!targetTeamIds.length || targetTeamIds.includes(p.teamId));
        if (isBase && !excludedSet.has(p.id)) return false; // Ya está convocado
        if (includedSet.has(p.id) && !excludedSet.has(p.id)) return false; // Ya está incluido
        return true;
      });

      body.innerHTML = `
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
          Selecciona un jugador para añadirlo a todas las convocatorias recurrentes de este horario:
        </div>

        <input type="text" id="inp-search-rec-player" placeholder="${t('searchPlayerPlaceholder', 'Buscar por nombre o dorsal...')}" style="width: 100%; margin-bottom: 12px; font-size: 13px;" />

        <div id="rec-add-player-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 48vh; overflow-y: auto;">
          ${nonSummonedPlayers.length === 0 ? `
            <div style="text-align: center; color: var(--muted); padding: 20px; font-size: 12px;">
              Todos los jugadores disponibles ya están convocados en este horario.
            </div>
          ` : nonSummonedPlayers.map(p => {
            const pTeam = Store.team(p.teamId);
            return `
              <div class="card rec-candidate-item" data-pid="${p.id}" data-text="${escapeHtml(Store.playerName(p).toLowerCase())} ${p.mainDorsal || ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; cursor: pointer; background: var(--surface2); border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                  ${renderAvatar(p, 'sm')}
                  <div style="min-width: 0; flex: 1;">
                    <b style="font-size: 13px; color: #fff; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}
                    </b>
                    <small style="color: var(--muted); font-size: 10.5px;">
                      ${p.mainPosition || 'Jugador'}${pTeam ? ' • ' + escapeHtml(pTeam.name) : ''}
                    </small>
                  </div>
                </div>
                <button type="button" class="btn sm primary" style="font-weight: 800; font-size: 11px; height: 30px; padding: 0 10px; border-radius: 7px; flex-shrink: 0;">
                  ➕ Añadir
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;

      const searchInp = body.querySelector('#inp-search-rec-player');
      if (searchInp) {
        searchInp.oninput = () => {
          const q = searchInp.value.toLowerCase().trim();
          body.querySelectorAll('.rec-candidate-item').forEach(el => {
            const txt = el.getAttribute('data-text') || '';
            el.style.display = (!q || txt.includes(q)) ? 'flex' : 'none';
          });
        };
      }

      body.querySelectorAll('.rec-candidate-item').forEach(el => {
        el.onclick = () => {
          const pid = el.getAttribute('data-pid');
          const pl = Store.player(pid);
          const plName = pl ? Store.playerName(pl) : 'jugador';
          Store.includePlayerInRecurringSchedule(sched.id, pid);
          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          haptic(35);
          toast(`✅ ${plName} convocado al horario recurrente`, 'success');
          closeSheet();
          if (onAdded) onAdded();
        };
      });
    });
  }

  /* =========================================================
     ENTRENAMIENTOS RECURRENTES (HORARIOS SEMANALES)
     ========================================================= */
  function showRecurringTrainingsModal(onDone) {
    openSheet(t('recurringTrainings', 'Entrenamientos Recurrentes'), (body) => {
      function renderSchedulesList() {
        const rawScheds = Store.state.recurringSchedules || [];
        const seenIds = new Set();
        const schedules = [];
        rawScheds.forEach(sc => {
          if (sc && sc.id && !seenIds.has(sc.id)) {
            seenIds.add(sc.id);
            schedules.push(sc);
          }
        });
        Store.state.recurringSchedules = schedules;
        const dayNames = [
          t('daySun', 'Dom'),
          t('dayMon', 'Lun'),
          t('dayTue', 'Mar'),
          t('dayWed', 'Mié'),
          t('dayThu', 'Jue'),
          t('dayFri', 'Vie'),
          t('daySat', 'Sáb')
        ];

        body.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 12px; color: var(--muted);">
              ${t('recurringDesc', 'Crea calendarios semanales. Las convocatorias se generan automáticamente:')}
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 14px;">
            <button type="button" class="btn sm primary" id="btn-add-recurring" style="flex: 1; font-weight: 800; font-size: 12.5px;">
              ➕ ${t('addRecurring', 'Nuevo Horario')}
            </button>
            <button type="button" class="btn sm" id="btn-generate-now" style="background: var(--surface2); color: #86efac; border-color: rgba(34,197,94,0.4); font-weight: 800; font-size: 12px;">
              ⚡ ${t('generateNow', 'Generar 14 días')}
            </button>
          </div>

          ${schedules.length === 0 ? `
            <div style="text-align: center; padding: 32px 14px; color: var(--muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">🔄</div>
              <h4 style="margin: 0 0 4px; color: #fff;">${t('noRecurring', 'Sin horarios recurrentes')}</h4>
              <p style="font-size: 12px; margin: 0;">${t('noRecurringDesc', 'Pulsa en "+ Nuevo Horario" para configurar entrenamientos semanales fijos (ej. Martes y Jueves).')}</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 10px;" id="recurring-list">
              ${schedules.map(sc => {
                const targetTeamIds = (Array.isArray(sc.teamIds) && sc.teamIds.length > 0)
                  ? sc.teamIds
                  : (sc.teamId ? [sc.teamId] : []);
                const teamObjs = targetTeamIds.map(tid => Store.team(tid)).filter(Boolean);
                let defaultTitle = 'Entrenamiento';
                if (teamObjs.length === 1) defaultTitle = 'Entrenamiento ' + teamObjs[0].name;
                else if (teamObjs.length > 1) defaultTitle = 'Entrenamiento (' + teamObjs.map(tm => tm.name).join(' / ') + ')';

                const daysLabels = (sc.daysOfWeek || []).map(d => {
                  const dName = dayNames[d] || d;
                  const dTime = (sc.dayTimes && sc.dayTimes[d]) ? sc.dayTimes[d] : (sc.time || '18:00');
                  const dEndTime = (sc.dayEndTimes && sc.dayEndTimes[d]) ? sc.dayEndTimes[d] : (sc.endTime || '');
                  const dDur = (sc.dayDurations && sc.dayDurations[d]) ? sc.dayDurations[d] : (sc.duration || 90);
                  if (dEndTime) {
                    return `${dName} (${dTime} - ${dEndTime} • ${dDur}m)`;
                  }
                  return `${dName} (${dTime} • ${dDur}m)`;
                }).join(', ');
                const cardStyle = getEventCardStyle(sc, { isPast: false, isToday: false, isMatch: false });
                return `
                  <div class="card" style="padding: 12px; border-radius: 14px; ${cardStyle.styleStr}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                      <div>
                        <h4 style="margin: 0; font-size: 15px; font-weight: 900; color: #fff;">
                          ${escapeHtml(sc.title || defaultTitle)}
                        </h4>
                        <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
                          🗓️ <span style="color: var(--cyan); font-weight: 800;">${daysLabels}</span>
                        </div>
                        ${sc.venue ? `<div style="font-size: 11.5px; color: var(--dim);">📍 ${escapeHtml(sc.venue)}</div>` : ''}
                        ${teamObjs.length > 0 ? `
                          <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px;">
                            ${teamObjs.map(tm => `
                              <span class="badge" style="background: ${tm.color || 'var(--cyan)'}22; color: ${tm.color || 'var(--cyan)'}; font-weight: 800; font-size: 11px;">🛡️ ${escapeHtml(tm.name)}</span>
                            `).join('')}
                          </div>
                        ` : `
                          <span class="badge" style="background: rgba(148,163,184,0.15); color: var(--muted); font-size: 11px; margin-top: 5px;">👥 ${t('allTeamsOption', 'Todos los equipos (General)')}</span>
                        `}
                      </div>
                      <span class="badge" style="background: ${sc.active !== false ? 'rgba(34,197,94,0.18)' : 'rgba(148,163,184,0.18)'}; color: ${sc.active !== false ? '#86efac' : '#94a3b8'};">
                        ${sc.active !== false ? '🟢 ' + t('active', 'Activo') : '⏸️ ' + t('paused', 'Pausado')}
                      </span>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                      <button type="button" class="btn sm" data-edit-sched="${sc.id}" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800;">
                        ✏️ ${t('edit', 'Editar')}
                      </button>
                      <button type="button" class="btn sm" data-manage-sched-players="${sc.id}" style="background: var(--surface2); color: var(--cyan); border-color: rgba(34,211,238,0.3); font-size: 12px; font-weight: 800; height: 34px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px;" title="${t('managePlayers', 'Gestionar Jugadores')}">
                        👥 ${t('players', 'Jugadores')}
                      </button>
                      <button type="button" class="btn sm danger ghost" data-delete-sched="${sc.id}" style="height: 34px; font-size: 12px; font-weight: 800; padding: 0 10px;">
                        🗑️
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        `;

        const btnAdd = body.querySelector('#btn-add-recurring');
        if (btnAdd) btnAdd.onclick = () => showEditScheduleForm(null);

        const btnGen = body.querySelector('#btn-generate-now');
        if (btnGen) {
          btnGen.onclick = () => {
            const count = Store.generateRecurringConvocations(14);
            if (window.Cloud && window.Cloud.pushCoachState) {
              window.Cloud.pushCoachState(Store.state, true);
            }
            toast(`✅ Generadas ${count} convocatorias para los próximos 14 días`, 'success');
            haptic(35);
            if (onDone) onDone();
          };
        }

        body.querySelectorAll('[data-edit-sched]').forEach(b => {
          b.onclick = () => {
            const sid = b.getAttribute('data-edit-sched');
            showEditScheduleForm(sid);
          };
        });

        body.querySelectorAll('[data-manage-sched-players]').forEach(b => {
          b.onclick = () => {
            const sid = b.getAttribute('data-manage-sched-players');
            showRecurringSchedulePlayersModal(sid, () => {
              renderSchedulesList();
              if (onDone) onDone();
            });
          };
        });

        body.querySelectorAll('[data-delete-sched]').forEach(b => {
          b.onclick = () => {
            const sid = b.getAttribute('data-delete-sched');
            confirmDialog(t('delete', 'Eliminar'), t('deleteRecurringConfirm', '¿Eliminar este horario recurrente?'), () => {
              Store.deleteRecurringSchedule(sid);
              if (window.Cloud && window.Cloud.pushCoachState) {
                window.Cloud.pushCoachState(Store.state, true);
              }
              toast(t('deleted', 'Eliminado'), 'info');
              renderSchedulesList();
              if (onDone) onDone();
              if (currentTab === 'home' || currentTab === 'convocations') {
                const view = document.getElementById('view');
                if (view) {
                  if (currentTab === 'home') renderHomeView(view);
                  else if (currentTab === 'convocations') renderConvocationsView(view);
                }
              }
            });
          };
        });
      }

      function showEditScheduleForm(schedId) {
        const existing = schedId ? Store.recurringSchedule(schedId) : null;
        const teams = Store.state.teams || [];
        const daysMap = [
          { val: 1, label: t('dayMon', 'Lun'), full: 'Lunes' },
          { val: 2, label: t('dayTue', 'Mar'), full: 'Martes' },
          { val: 3, label: t('dayWed', 'Mié'), full: 'Miércoles' },
          { val: 4, label: t('dayThu', 'Jue'), full: 'Jueves' },
          { val: 5, label: t('dayFri', 'Vie'), full: 'Viernes' },
          { val: 6, label: t('daySat', 'Sáb'), full: 'Sábado' },
          { val: 0, label: t('daySun', 'Dom'), full: 'Domingo' }
        ];

        let selectedTeamIds = existing 
          ? (Array.isArray(existing.teamIds) && existing.teamIds.length > 0 
              ? [...existing.teamIds] 
              : (existing.teamId ? [existing.teamId] : [])) 
          : [];
        let excludedPlayerIds = existing && Array.isArray(existing.excludedPlayerIds) ? [...existing.excludedPlayerIds] : [];
        let includedPlayerIds = existing && Array.isArray(existing.includedPlayerIds) ? [...existing.includedPlayerIds] : [];
        let selectedDays = existing ? (existing.daysOfWeek || [2, 4]) : [2, 4];
        let defaultDuration = existing ? (existing.duration || 90) : 90;
        let dayTimes = Object.assign({}, (existing && existing.dayTimes) ? existing.dayTimes : {});
        let dayEndTimes = Object.assign({}, (existing && existing.dayEndTimes) ? existing.dayEndTimes : {});
        let dayDurations = Object.assign({}, (existing && existing.dayDurations) ? existing.dayDurations : {});

        function addMinutesToTime(timeStr, minutes) {
          if (!timeStr) return '';
          const parts = timeStr.split(':');
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1], 10) || 0;
          let totalMins = h * 60 + m + (parseInt(minutes, 10) || 0);
          while (totalMins < 0) totalMins += 24 * 60;
          totalMins = totalMins % (24 * 60);
          const newH = Math.floor(totalMins / 60);
          const newM = totalMins % 60;
          return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        }

        function diffMinutesBetweenTimes(startStr, endStr) {
          if (!startStr || !endStr) return defaultDuration || 90;
          const [h1, m1] = startStr.split(':').map(x => parseInt(x, 10) || 0);
          const [h2, m2] = endStr.split(':').map(x => parseInt(x, 10) || 0);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff <= 0) diff += 24 * 60;
          return diff;
        }

        // Inicializar inicio, duración y fin para cada día seleccionado si no existe
        selectedDays.forEach(d => {
          if (!dayTimes[d]) {
            dayTimes[d] = existing ? (existing.time || '18:00') : '18:00';
          }
          if (!dayDurations[d]) {
            dayDurations[d] = defaultDuration;
          }
          if (!dayEndTimes[d]) {
            dayEndTimes[d] = (existing && existing.dayEndTimes && existing.dayEndTimes[d])
              ? existing.dayEndTimes[d]
              : ((existing && existing.endTime) ? existing.endTime : addMinutesToTime(dayTimes[d], dayDurations[d]));
          }
        });

        body.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <button type="button" class="btn sm ghost" id="btn-sched-back" style="font-weight: 800; font-size: 13px;">
              ◀ ${t('back', 'Volver')}
            </button>
            <h3 style="margin: 0; font-size: 16px; font-weight: 900;">${existing ? t('editRecurring', 'Editar Horario') : t('newRecurring', 'Nuevo Horario')}</h3>
          </div>

          <div class="field">
            <label>${t('title', 'Título (opcional)')}</label>
            <input type="text" id="sched-title" placeholder="Ej: Entrenamiento Semanal" value="${escapeHtml(existing ? existing.title : '')}" />
          </div>

          <!-- Selección moderna y visual de equipos (soporta selección múltiple) -->
          <div class="field" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <label style="margin: 0; font-size: 13px; font-weight: 900; color: #fff;">
                👥 ${t('assignedTeams', 'Equipos Asignados')}
              </label>
              <span style="font-size: 11.5px; font-weight: 800; color: var(--cyan);" id="sched-teams-count-lbl"></span>
            </div>
            <p style="font-size: 11px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">
              ${t('assignedTeamsDesc', 'Selecciona uno o más equipos para asignarles el mismo horario de entrenamiento.')}
            </p>

            <!-- Tarjeta especial: Todos los equipos -->
            <div id="btn-sched-team-all" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease; border: 1.5px solid var(--border); background: var(--surface2);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🌐</span>
                <div>
                  <b style="font-size: 13px; color: #fff; display: block;">${t('allTeamsOption', 'Todos los equipos (General)')}</b>
                  <small style="font-size: 10.5px; color: var(--muted);">${Store.state.players.length} ${t('playersInTeam', 'jugadores')} en el club</small>
                </div>
              </div>
              <div id="sched-team-all-check" style="width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;"></div>
            </div>

            <!-- Rejilla de equipos individuales -->
            ${teams.length === 0 ? `
              <div style="font-size: 11.5px; color: var(--muted); padding: 8px; text-align: center;">No hay equipos creados todavía</div>
            ` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px;" id="sched-teams-container">
                ${teams.map(tm => {
                  const pCount = Store.state.players.filter(p => p.teamId === tm.id).length;
                  return `
                    <div class="sched-team-card" data-team-id="${tm.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; border: 1.5px solid var(--border); background: var(--surface2);">
                      <div style="min-width: 0; flex: 1;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="width: 9px; height: 9px; border-radius: 50%; background: ${tm.color || 'var(--cyan)'}; flex-shrink: 0;"></span>
                          <b style="font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">
                            ${escapeHtml(tm.name)}
                          </b>
                        </div>
                        <small style="font-size: 10px; color: var(--muted); margin-left: 15px; display: block;">
                          ${pCount} ${t('playersInTeam', 'jugadores')}
                        </small>
                      </div>
                      <div class="sched-team-check" style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; flex-shrink: 0;"></div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Selección moderna de jugadores convocados en este horario -->
          <div class="field" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <label style="margin: 0; font-size: 13px; font-weight: 900; color: #fff;">
                👥 ${t('summonedPlayers', 'Jugadores Convocados')}
              </label>
              <span style="font-size: 11.5px; font-weight: 800; color: var(--cyan);" id="sched-players-count-lbl"></span>
            </div>
            <p style="font-size: 11px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">
              ${t('summonedPlayersDesc', 'Desmarca los jugadores que no deben aparecer convocados en las fechas de este grupo.')}
            </p>
            <div id="sched-players-container" style="max-height: 200px; overflow-y: auto; background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 6px 10px;"></div>
          </div>

          <div class="field">
            <label>${t('recurringDays', 'Días de la semana')}</label>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="sched-days-container">
              ${daysMap.map(d => {
                const isActive = selectedDays.includes(d.val);
                return `
                  <button type="button" class="btn sm ${isActive ? 'primary' : 'ghost'}" data-day-val="${d.val}" style="border-radius: 10px; font-weight: 800; min-width: 42px; height: 38px;">
                    ${d.label}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Selección de inicio, fin y duración por cada día -->
          <div class="field" style="background: rgba(34, 211, 238, 0.05); border: 1.5px solid rgba(34, 211, 238, 0.3); border-radius: 14px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="margin: 0; font-size: 13px; font-weight: 900; color: #fff;">
                ⏰ ${t('timePerDay', 'Horario y Duración por cada día')}
              </label>
              <span style="font-size: 11px; color: var(--muted);">${t('customTimePerDay', 'Personaliza inicio, fin o duración')}</span>
            </div>

            <!-- Selector rápido de duración habitual para todos los días -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--surface2); padding: 8px 12px; border-radius: 10px; margin-bottom: 10px; border: 1px solid var(--border); flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px;">⏱️</span>
                <span style="font-size: 11.5px; font-weight: 800; color: #fff;">${t('defaultDuration', 'Duración habitual')}:</span>
              </div>
              <div style="display: flex; gap: 4px; overflow-x: auto;" id="sched-global-durations">
                ${[45, 60, 75, 90, 105, 120].map(mins => `
                  <button type="button" class="btn sm ${defaultDuration === mins ? 'primary' : 'ghost'}" data-global-dur="${mins}" style="height: 26px; padding: 0 8px; font-size: 11px; font-weight: 800; border-radius: 6px;">
                    ${mins}m
                  </button>
                `).join('')}
              </div>
            </div>

            <div id="sched-day-times-container" style="display: flex; flex-direction: column; gap: 10px;"></div>
          </div>

          <div class="schedule-dates-stack" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;">
            ${renderDatePickerFieldHtml('sched-start-date', existing && existing.startDate ? existing.startDate : new Date().toISOString().slice(0, 10), '🗓️ ' + t('startDate', 'Fecha Desde'))}
            ${renderDatePickerFieldHtml('sched-end-date', existing && existing.endDate ? existing.endDate : new Date(Date.now() + 30*86400000).toISOString().slice(0, 10), '🗓️ ' + t('endDate', 'Fecha Hasta'))}
          </div>

          <div class="field">
            <label>${t('venue', 'Lugar / Campo')}</label>
            <input type="text" id="sched-venue" placeholder="Ej: Campo 2" value="${escapeHtml(existing ? (existing.venue || '') : '')}" />
          </div>

          <div class="field">
            <label>📍 ${t('address', 'Dirección exacta')}</label>
            <input type="text" id="sched-address" placeholder="Ej: Calle Deportes 12" value="${escapeHtml(existing ? (existing.address || '') : '')}" />
          </div>

          <div class="field">
            <label>${t('notes', 'Notas')}</label>
            <input type="text" id="sched-notes" placeholder="Ej: Ropa térmica, llegar 15 min antes" value="${escapeHtml(existing ? (existing.notes || '') : '')}" />
          </div>

          <button type="button" class="btn block primary" id="btn-save-sched" style="height: 44px; font-weight: 800; font-size: 14px; margin-top: 14px;">
            💾 ${t('save', 'Guardar Horario')}
          </button>
        `;

        function renderDayTimesInputs() {
          const container = body.querySelector('#sched-day-times-container');
          if (!container) return;

          const sortedSelected = daysMap.filter(d => selectedDays.includes(d.val));
          if (sortedSelected.length === 0) {
            container.innerHTML = `<div style="font-size: 12px; color: var(--muted); text-align: center; padding: 6px;">${t('selectAtLeastOneDay', 'Selecciona al menos un día')}</div>`;
            return;
          }

          container.innerHTML = sortedSelected.map(d => {
            const curStart = dayTimes[d.val] || '18:00';
            const curDur = dayDurations[d.val] || defaultDuration || 90;
            const curEnd = dayEndTimes[d.val] || addMinutesToTime(curStart, curDur) || '19:30';
            return `
              <div class="day-time-row" data-day="${d.val}" style="background: var(--surface2); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 15px;">📅</span>
                    <b style="font-size: 13.5px; color: #fff;">${d.full || d.label}</b>
                  </div>
                  <span class="day-dur-badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.3); font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                    ⏱️ ${curDur} min
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div style="display: flex; flex-direction: column; gap: 3px;">
                    <span style="font-size: 10.5px; color: var(--muted); font-weight: 700;">${t('startTime', 'Inicio')}</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <input type="text" class="day-start-input" data-day="${d.val}" value="${curStart}" placeholder="HH:MM" style="width: 100%; min-width: 0; text-align: center; font-weight: 800; font-size: 13px; height: 34px; padding: 2px 4px; border-radius: 8px; cursor: pointer;" readonly />
                      <button type="button" class="btn sm btn-pick-start" data-day="${d.val}" style="background: var(--surface); color: var(--cyan); border: 1px solid var(--border); height: 34px; padding: 0 8px; border-radius: 8px; flex-shrink: 0;" title="${t('pickTime', 'Elegir')}">
                        ⏰
                      </button>
                    </div>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 3px;">
                    <span style="font-size: 10.5px; color: var(--muted); font-weight: 700;">${t('endTime', 'Fin')}</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <input type="text" class="day-end-input" data-day="${d.val}" value="${curEnd}" placeholder="HH:MM" style="width: 100%; min-width: 0; text-align: center; font-weight: 800; font-size: 13px; height: 34px; padding: 2px 4px; border-radius: 8px; cursor: pointer;" readonly />
                      <button type="button" class="btn sm btn-pick-end" data-day="${d.val}" style="background: var(--surface); color: var(--cyan); border: 1px solid var(--border); height: 34px; padding: 0 8px; border-radius: 8px; flex-shrink: 0;" title="${t('pickTime', 'Elegir')}">
                        ⏰
                      </button>
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 4px; overflow-x: auto; padding-top: 2px;">
                  <span style="font-size: 10px; color: var(--muted); margin-right: 2px; white-space: nowrap;">${t('duration', 'Duración')}:</span>
                  ${[45, 60, 75, 90, 105, 120].map(mins => `
                    <button type="button" class="btn sm ${curDur === mins ? 'primary' : 'ghost'} btn-day-dur-chip" data-day="${d.val}" data-dur="${mins}" style="height: 24px; padding: 0 7px; font-size: 10.5px; font-weight: 700; border-radius: 5px; flex-shrink: 0;">
                      ${mins}m
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('');

          container.querySelectorAll('.day-time-row').forEach(row => {
            const dayVal = parseInt(row.getAttribute('data-day'), 10);
            const startInp = row.querySelector('.day-start-input');
            const startBtn = row.querySelector('.btn-pick-start');
            const endInp = row.querySelector('.day-end-input');
            const endBtn = row.querySelector('.btn-pick-end');

            const handlePickStart = () => {
              const curVal = (dayTimes[dayVal] || startInp.value || '18:00').trim();
              openTimePicker(curVal, (newTime) => {
                if (newTime) {
                  dayTimes[dayVal] = newTime;
                  const curDur = dayDurations[dayVal] || defaultDuration || 90;
                  dayEndTimes[dayVal] = addMinutesToTime(newTime, curDur);
                  renderDayTimesInputs();
                }
              });
            };

            const handlePickEnd = () => {
              const curVal = (dayEndTimes[dayVal] || endInp.value || '19:30').trim();
              openTimePicker(curVal, (newTime) => {
                if (newTime) {
                  dayEndTimes[dayVal] = newTime;
                  const curStart = dayTimes[dayVal] || '18:00';
                  const newDur = diffMinutesBetweenTimes(curStart, newTime);
                  dayDurations[dayVal] = newDur;
                  renderDayTimesInputs();
                }
              });
            };

            if (startInp) startInp.onclick = handlePickStart;
            if (startBtn) startBtn.onclick = handlePickStart;
            if (endInp) endInp.onclick = handlePickEnd;
            if (endBtn) endBtn.onclick = handlePickEnd;

            row.querySelectorAll('.btn-day-dur-chip').forEach(chip => {
              chip.onclick = () => {
                const durVal = parseInt(chip.getAttribute('data-dur'), 10);
                if (durVal) {
                  haptic(20);
                  dayDurations[dayVal] = durVal;
                  const curStart = dayTimes[dayVal] || '18:00';
                  dayEndTimes[dayVal] = addMinutesToTime(curStart, durVal);
                  renderDayTimesInputs();
                }
              };
            });
          });
        }

        bindDatePickerField('sched-start-date', body);
        bindDatePickerField('sched-end-date', body);
        renderDayTimesInputs();

        // Enlazar botones de duración rápida global
        body.querySelectorAll('[data-global-dur]').forEach(btn => {
          btn.onclick = () => {
            const mins = parseInt(btn.getAttribute('data-global-dur'), 10);
            if (!mins) return;
            haptic(25);
            defaultDuration = mins;
            body.querySelectorAll('[data-global-dur]').forEach(b => {
              const bMins = parseInt(b.getAttribute('data-global-dur'), 10);
              b.className = `btn sm ${bMins === mins ? 'primary' : 'ghost'}`;
            });
            selectedDays.forEach(d => {
              dayDurations[d] = mins;
              const start = dayTimes[d] || '18:00';
              dayEndTimes[d] = addMinutesToTime(start, mins);
            });
            renderDayTimesInputs();
          };
        });

        function renderSchedPlayersList() {
          const container = body.querySelector('#sched-players-container');
          const countLbl = body.querySelector('#sched-players-count-lbl');
          if (!container) return;

          const allPlayers = Store.sortedPlayers();
          const basePlayers = allPlayers.filter(p => {
            if (!selectedTeamIds.length) return true;
            return selectedTeamIds.includes(p.teamId);
          });
          const extraPlayers = allPlayers.filter(p => includedPlayerIds.includes(p.id) && !basePlayers.some(bp => bp.id === p.id));
          const candidatePlayers = [...basePlayers, ...extraPlayers];

          const activeCount = candidatePlayers.filter(p => !excludedPlayerIds.includes(p.id)).length;
          if (countLbl) {
            countLbl.textContent = `${activeCount} convocados de ${candidatePlayers.length}`;
          }

          if (candidatePlayers.length === 0) {
            container.innerHTML = `<div style="font-size: 12px; color: var(--muted); text-align: center; padding: 12px;">No hay jugadores en los equipos seleccionados</div>`;
            return;
          }

          container.innerHTML = candidatePlayers.map(p => {
            const isExcluded = excludedPlayerIds.includes(p.id);
            const isCalled = !isExcluded;
            const pTeam = Store.team(p.teamId);
            return `
              <div class="sched-player-row" data-pid="${p.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                  ${renderAvatar(p, 'sm')}
                  <div style="min-width: 0; flex: 1;">
                    <b style="font-size: 12.5px; color: ${isCalled ? '#fff' : 'var(--muted)'}; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isCalled ? '' : 'text-decoration: line-through;'}">
                      #${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}
                    </b>
                    <small style="color: var(--muted); font-size: 10.5px;">
                      ${p.mainPosition || 'Jugador'}${pTeam ? ' • ' + escapeHtml(pTeam.name) : ''}
                    </small>
                  </div>
                </div>
                <div class="sched-p-check" style="width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid ${isCalled ? 'var(--cyan)' : 'var(--border)'}; background: ${isCalled ? 'var(--cyan)' : 'transparent'}; color: ${isCalled ? '#000' : 'transparent'}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; flex-shrink: 0;">
                  ✓
                </div>
              </div>
            `;
          }).join('');

          container.querySelectorAll('.sched-player-row').forEach(row => {
            row.onclick = () => {
              const pid = row.getAttribute('data-pid');
              if (!pid) return;
              haptic(20);
              if (excludedPlayerIds.includes(pid)) {
                excludedPlayerIds = excludedPlayerIds.filter(id => id !== pid);
              } else {
                excludedPlayerIds.push(pid);
              }
              renderSchedPlayersList();
            };
          });
        }

        function updateTeamsSelectionUI() {
          const isAll = selectedTeamIds.length === 0;
          const countLbl = body.querySelector('#sched-teams-count-lbl');
          if (countLbl) {
            if (isAll) {
              countLbl.textContent = t('allTeamsOption', 'Todos los equipos');
              countLbl.style.color = 'var(--cyan)';
            } else {
              countLbl.textContent = `${selectedTeamIds.length} ${selectedTeamIds.length === 1 ? 'equipo' : 'equipos'}`;
              countLbl.style.color = '#fff';
            }
          }

          const allCard = body.querySelector('#btn-sched-team-all');
          const allCheck = body.querySelector('#sched-team-all-check');
          if (allCard && allCheck) {
            if (isAll) {
              allCard.style.border = '1.5px solid var(--cyan)';
              allCard.style.background = 'rgba(6, 182, 212, 0.14)';
              allCard.style.boxShadow = '0 0 12px rgba(6, 182, 212, 0.2)';
              allCheck.style.background = 'var(--cyan)';
              allCheck.style.borderColor = 'var(--cyan)';
              allCheck.style.color = '#000';
              allCheck.textContent = '✓';
            } else {
              allCard.style.border = '1.5px solid var(--border)';
              allCard.style.background = 'var(--surface2)';
              allCard.style.boxShadow = 'none';
              allCheck.style.background = 'transparent';
              allCheck.style.borderColor = 'var(--border)';
              allCheck.style.color = 'transparent';
              allCheck.textContent = '';
            }
          }

          body.querySelectorAll('.sched-team-card').forEach(card => {
            const tid = card.getAttribute('data-team-id');
            const isSelected = selectedTeamIds.includes(tid);
            const checkEl = card.querySelector('.sched-team-check');
            const tm = teams.find(t => t.id === tid);
            const tmColor = (tm && tm.color) ? tm.color : 'var(--cyan)';

            if (isSelected) {
              card.style.border = `1.5px solid ${tmColor}`;
              card.style.background = `${tmColor}18`;
              card.style.boxShadow = `0 0 10px ${tmColor}25`;
              if (checkEl) {
                checkEl.style.background = tmColor;
                checkEl.style.borderColor = tmColor;
                checkEl.style.color = '#000';
                checkEl.textContent = '✓';
              }
            } else {
              card.style.border = '1.5px solid var(--border)';
              card.style.background = 'var(--surface2)';
              card.style.boxShadow = 'none';
              if (checkEl) {
                checkEl.style.background = 'transparent';
                checkEl.style.borderColor = 'var(--border)';
                checkEl.style.color = 'transparent';
                checkEl.textContent = '';
              }
            }
          });

          renderSchedPlayersList();
        }

        updateTeamsSelectionUI();

        const btnAllTeams = body.querySelector('#btn-sched-team-all');
        if (btnAllTeams) {
          btnAllTeams.onclick = () => {
            haptic(25);
            selectedTeamIds = [];
            updateTeamsSelectionUI();
          };
        }

        body.querySelectorAll('.sched-team-card').forEach(card => {
          card.onclick = () => {
            const tid = card.getAttribute('data-team-id');
            if (!tid) return;
            haptic(25);
            if (selectedTeamIds.includes(tid)) {
              selectedTeamIds = selectedTeamIds.filter(id => id !== tid);
            } else {
              selectedTeamIds.push(tid);
            }
            updateTeamsSelectionUI();
          };
        });

        body.querySelector('#btn-sched-back').onclick = renderSchedulesList;

        body.querySelectorAll('[data-day-val]').forEach(btn => {
          btn.onclick = () => {
            const dayVal = parseInt(btn.getAttribute('data-day-val'), 10);
            if (selectedDays.includes(dayVal)) {
              if (selectedDays.length > 1) {
                selectedDays = selectedDays.filter(x => x !== dayVal);
                btn.className = 'btn sm ghost';
                delete dayTimes[dayVal];
                delete dayEndTimes[dayVal];
                delete dayDurations[dayVal];
                renderDayTimesInputs();
              } else {
                toast(t('mustSelectAtLeastOneDay', 'Debes seleccionar al menos un día'), 'warning');
              }
            } else {
              selectedDays.push(dayVal);
              btn.className = 'btn sm primary';
              if (!dayTimes[dayVal]) {
                const anyExistingTime = Object.values(dayTimes)[0] || '18:00';
                dayTimes[dayVal] = anyExistingTime;
              }
              if (!dayDurations[dayVal]) {
                dayDurations[dayVal] = defaultDuration;
              }
              if (!dayEndTimes[dayVal]) {
                dayEndTimes[dayVal] = addMinutesToTime(dayTimes[dayVal], dayDurations[dayVal]);
              }
              renderDayTimesInputs();
            }
          };
        });

        body.querySelector('#btn-save-sched').onclick = () => {
          const title = body.querySelector('#sched-title').value.trim();
          const venue = body.querySelector('#sched-venue').value.trim();
          const address = body.querySelector('#sched-address').value.trim();
          const notes = body.querySelector('#sched-notes').value.trim();
          const startDate = body.querySelector('#sched-start-date').value;
          const endDate = body.querySelector('#sched-end-date').value;

          const finalDayTimes = {};
          const finalDayEndTimes = {};
          const finalDayDurations = {};

          selectedDays.forEach(d => {
            finalDayTimes[d] = dayTimes[d] || '18:00';
            finalDayDurations[d] = dayDurations[d] || defaultDuration || 90;
            finalDayEndTimes[d] = dayEndTimes[d] || addMinutesToTime(finalDayTimes[d], finalDayDurations[d]);
          });

          const defaultTime = finalDayTimes[selectedDays[0]] || '18:00';
          const defaultEndTime = finalDayEndTimes[selectedDays[0]] || addMinutesToTime(defaultTime, defaultDuration);
          const defaultDur = finalDayDurations[selectedDays[0]] || defaultDuration || 90;

          const finalTeamIds = [...selectedTeamIds];
          const finalTeamId = finalTeamIds[0] || '';

          Store.upsertRecurringSchedule({
            id: existing ? existing.id : null,
            title: title,
            teamId: finalTeamId,
            teamIds: finalTeamIds,
            excludedPlayerIds: excludedPlayerIds,
            includedPlayerIds: includedPlayerIds,
            daysOfWeek: selectedDays,
            time: defaultTime,
            endTime: defaultEndTime,
            duration: defaultDur,
            dayTimes: finalDayTimes,
            dayEndTimes: finalDayEndTimes,
            dayDurations: finalDayDurations,
            venue: venue,
            address: address,
            notes: notes,
            startDate: startDate,
            endDate: endDate,
            active: existing ? existing.active : true
          });

          if (Store.autoCreateTodayScheduledSessions) {
            Store.autoCreateTodayScheduledSessions();
          }

          if (window.Cloud && window.Cloud.pushCoachState) {
            window.Cloud.pushCoachState(Store.state, true);
          }
          toast(t('saved', 'Guardado con éxito'), 'success');
          haptic(35);
          closeSheet();
          if (onDone) onDone();
        };
      }

      renderSchedulesList();
    });
  }

  let convCoachFilterType = 'all'; // 'all', 'match', 'training'
  let showPastConvs = false; // Estado del desplegable de entrenamientos pasados

  /* =========================================================
     VISTA 5: CONVOCATORIAS Y ASISTENCIA (MENÚ INDEPENDIENTE)
     ========================================================= */
  function renderConvocationsView(view) {
    function build() {
      const rawList = Store.state.convocations || [];
      const filteredList = rawList.filter(c => {
        if (convCoachFilterType === 'match') return c.type === 'match';
        if (convCoachFilterType === 'training') return c.type === 'training';
        return true;
      });

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Separar entre próximos (hoy o futuros) y pasados
      const upcomingList = [];
      const pastList = [];

      filteredList.forEach(c => {
        const isPast = (c.date < todayStr) || (c.date === todayStr && (c.time || '23:59') < curTime);
        if (isPast) {
          pastList.push(c);
        } else {
          upcomingList.push(c);
        }
      });

      // Ordenar próximos: el más cercano primero
      upcomingList.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

      // Ordenar pasados: el más reciente primero
      pastList.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

      function renderCard(c, isPast = false) {
        const cList = c.list || {};
        const responses = c.responses || {};
        let calledPids = Object.keys(cList).filter(pid => cList[pid] && cList[pid] !== 'uncalled');
        if (calledPids.length === 0 && Store.state.players) {
          const convTeams = (Array.isArray(c.teamIds) && c.teamIds.length > 0)
            ? c.teamIds.map(String)
            : (c.teamId ? [String(c.teamId)] : []);
          calledPids = Store.state.players
            .filter(p => convTeams.length === 0 || (p.teamId && convTeams.includes(String(p.teamId))))
            .map(p => p.id);
        }
        const totalCalled = calledPids.length;

        let nAccepted = 0;
        let nRejected = 0;
        let nPending = 0;

        calledPids.forEach(pid => {
          const r = responses[pid];
          const respStatus = (r && typeof r === 'object') ? r.status : r;
          const listStatus = cList[pid];

          if (respStatus === 'attending' || respStatus === 'yes') {
            nAccepted++;
          } else if (respStatus === 'absent' || respStatus === 'no' || (!respStatus && listStatus === 'absent')) {
            nRejected++;
          } else {
            nPending++;
          }
        });

        const todayIso = getTodayIso();
        const isToday = (c.date === todayIso);
        const isMatch = (c.type === 'match');
        const cardStyle = getEventCardStyle(c, { isPast, isToday, isMatch });
        const matchClass = isMatch ? (isToday ? 'conv-card-match-today' : 'card-match-gold') : (isToday ? 'conv-card-today' : '');

        return `
          <div class="conv-card ${matchClass}" data-cid="${c.id}" style="cursor: pointer; ${cardStyle.styleStr}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                  <span class="badge ${c.type}">
                    ${c.type === 'match' ? '🏆 ' + t('match') : '⚽ ' + t('training')}
                  </span>
                  ${isToday ? `
                    <span class="badge badge-today-glow" style="background: rgba(34, 211, 238, 0.25); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.6); font-weight: 900; font-size: 10px;">
                      🌟 ${t('today', 'HOY')}
                    </span>
                  ` : ''}
                  ${cardStyle.teams.map(tm => `
                    <span class="badge" style="font-size: 9.5px; font-weight: 800; background: ${tm.color || '#22c55e'}22; color: ${tm.color || '#22c55e'}; border: 1px solid ${tm.color || '#22c55e'}50; padding: 1px 5px; border-radius: 5px;">
                      🛡️ ${escapeHtml(tm.name)}
                    </span>
                  `).join('')}
                  ${isPast ? `
                    <span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-size: 10px; font-weight: 800; padding: 2px 6px;">
                      ⏳ ${t('completed', 'Finalizado')}
                    </span>
                  ` : ''}
                </div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800;">
                  ${escapeHtml(c.title || c.rival || 'Convocatoria')}
                </h3>
                <div class="muted" style="font-size: 12px; margin-top: 3px;">
                  📅 <b>${formatConvocationDateWithDay(c.date)}</b> ${c.time ? '• ⏰ ' + c.time + (c.endTime ? ' - ' + c.endTime : '') + (c.duration ? ' (' + c.duration + ' min)' : '') : ''} ${c.venue ? '• 📍 ' + escapeHtml(c.venue) : ''}
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                ${(!isPast && nPending > 0) ? `
                  <button class="btn sm" data-quick-remind="${c.id}" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; border: none; font-size: 11.5px; font-weight: 800; padding: 4px 8px; border-radius: 8px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);" title="${t('sendAttendanceReminder', 'Enviar Recordatorio')}">
                    🔔 ${nPending}
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="conv-badge-row" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;">
              <span class="badge" style="background: var(--surface2); color: #cbd5e1; border: 1px solid var(--border); font-weight: 800; font-size: 11px; padding: 3px 8px;">
                👤 ${totalCalled} ${t('calledPlayers', 'Convocados')}
              </span>
              <span class="badge" style="background: rgba(34, 197, 94, 0.16); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.4); font-weight: 800; font-size: 11px; padding: 3px 8px;">
                🟢 ${nAccepted}
              </span>
              <span class="badge" style="background: rgba(239, 68, 68, 0.16); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 800; font-size: 11px; padding: 3px 8px;">
                ❌ ${nRejected}
              </span>
              <span class="badge" style="background: rgba(250, 204, 21, 0.16); color: #fde047; border: 1px solid rgba(250, 204, 21, 0.4); font-weight: 800; font-size: 11px; padding: 3px 8px;">
                ⏳ ${nPending}
              </span>
            </div>
          </div>
        `;
      }

      view.innerHTML = `
        <div class="topbar" style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 8px;">
            <div style="min-width: 0; flex: 1;">
              <h1 style="font-size: 19px; margin: 0; font-weight: 900; letter-spacing: -0.3px;">${t('convocations')}</h1>
              <span class="sub" style="font-size: 11px;">${upcomingList.length} próximas${pastList.length > 0 ? ` (${pastList.length} pasadas)` : ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              ${renderLangButton()}
              ${rawList.length > 0 ? `
                <button class="btn sm danger ghost" id="btn-delete-all-convs" style="font-weight: 800; font-size: 11.5px; height: 34px; padding: 0 8px; border-color: rgba(239, 68, 68, 0.4);" title="${t('deleteAllPlans', 'Borrar todos los planes')}">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box;">
            <button class="btn sm" id="btn-recurring-trainings" style="flex: 1; min-width: 0; background: var(--surface2); color: var(--cyan); border-color: rgba(34,211,238,0.3); font-weight: 800; font-size: 12px; height: 38px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 10px;" title="${t('recurringTrainings', 'Entrenamientos Recurrentes')}">
              🔄 <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t('recurringBtn', 'Recurrentes')}</span>
            </button>
            <button class="btn sm primary" id="btn-create-conv" style="flex: 1.35; min-width: 0; font-weight: 900; font-size: 12px; height: 38px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 10px; white-space: nowrap;">
              ${icon('plus', 16)} <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t('newConvocation')}</span>
            </button>
          </div>
        </div>

        <!-- Filtros de tipo de evento: Todos / Partidos / Entrenamientos -->
        <div style="display: flex; gap: 8px; margin: 12px 0 14px; background: var(--surface2); padding: 4px; border-radius: 10px; border: 1px solid var(--border);">
          <button type="button" class="btn sm ${convCoachFilterType === 'all' ? 'primary' : 'ghost'}" data-coach-conv-filter="all" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">
            ${t('filterAll', 'Todos')}
          </button>
          <button type="button" class="btn sm ${convCoachFilterType === 'match' ? 'primary' : 'ghost'}" data-coach-conv-filter="match" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">
            ${t('filterMatches', '🏟️ Partidos')}
          </button>
          <button type="button" class="btn sm ${convCoachFilterType === 'training' ? 'primary' : 'ghost'}" data-coach-conv-filter="training" style="flex: 1; height: 34px; font-size: 12px; font-weight: 800; border-radius: 8px;">
            ${t('filterTrainings', '🏃 Entrenamientos')}
          </button>
        </div>

        ${(upcomingList.length === 0 && pastList.length === 0) ? `
          <div class="empty-state card">
            <div class="e-ic">📋</div>
            <h3>${t('convocations')}</h3>
            <p>${t('convocationsDesc')}</p>
            <button class="btn primary" id="btn-empty-conv">
              ${icon('plus', 18)} ${t('newConvocation')}
            </button>
          </div>
        ` : `
          <!-- Lista de eventos próximos agrupados por equipo en desplegables -->
          ${upcomingList.length === 0 ? `
            <div style="text-align: center; padding: 22px 14px; background: var(--surface2); border: 1.5px dashed var(--border); border-radius: 14px; color: var(--muted); font-size: 12px; margin-bottom: 12px;">
              ℹ️ ${t('noUpcomingConvs', 'No hay convocatorias ni entrenamientos próximos activos.')}
            </div>
          ` : `
            <div class="conv-teams-container">
              ${(() => {
                const allTeams = Store.state.teams || [];
                if (allTeams.length <= 1) {
                  return `
                    <div class="conv-list">
                      ${upcomingList.map(c => renderCard(c, false)).join('')}
                    </div>
                  `;
                }

                const teamGroups = allTeams.map(tm => {
                  const convs = upcomingList.filter(c => {
                    if (Array.isArray(c.teamIds) && c.teamIds.length > 0) {
                      return c.teamIds.includes(tm.id);
                    }
                    return c.teamId === tm.id;
                  });
                  return { team: tm, convs };
                }).filter(g => g.convs.length > 0);

                const generalConvs = upcomingList.filter(c => {
                  const hasSpecific = Array.isArray(c.teamIds) ? (c.teamIds.length > 0) : !!c.teamId;
                  return !hasSpecific;
                });

                let htmlGroups = teamGroups.map(g => `
                  <details class="card past-convs-details" style="margin-bottom: 12px; padding: 0; border-radius: 14px; overflow: hidden; background: var(--surface2); border: 1.5px solid var(--border);">
                    <summary style="cursor: pointer; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="dot" style="background: ${g.team.color || 'var(--cyan)'}; width: 10px; height: 10px; border-radius: 50%; display: inline-block;"></span>
                        <b style="font-size: 14px; color: #fff;">${escapeHtml(g.team.name)}</b>
                        <span class="badge" style="background: ${g.team.color || '#22d3ee'}22; color: ${g.team.color || '#22d3ee'}; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
                          ${g.convs.length}
                        </span>
                      </div>
                      <span style="font-size: 11px; color: var(--muted); font-weight: 700;">▼</span>
                    </summary>
                    <div class="conv-list" style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 14px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                      ${g.convs.map(c => renderCard(c, false)).join('')}
                    </div>
                  </details>
                `).join('');

                if (generalConvs.length > 0) {
                  htmlGroups += `
                    <details class="card past-convs-details" style="margin-bottom: 12px; padding: 0; border-radius: 14px; overflow: hidden; background: var(--surface2); border: 1.5px solid var(--border);">
                      <summary style="cursor: pointer; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span>🛡️</span>
                          <b style="font-size: 14px; color: #fff;">${t('allTeams', 'General / Club')}</b>
                          <span class="badge" style="font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
                            ${generalConvs.length}
                          </span>
                        </div>
                        <span style="font-size: 11px; color: var(--muted); font-weight: 700;">▼</span>
                      </summary>
                      <div class="conv-list" style="display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 14px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                        ${generalConvs.map(c => renderCard(c, false)).join('')}
                      </div>
                    </details>
                  `;
                }

                return htmlGroups || `
                  <div class="conv-list">
                    ${upcomingList.map(c => renderCard(c, false)).join('')}
                  </div>
                `;
              })()}
            </div>
          `}

          <!-- DESPLEGABLE DE ENTRENAMIENTOS / CONVOCATORIAS PASADAS -->
          ${pastList.length > 0 ? `
            <div style="margin-top: 18px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--surface2); overflow: hidden;">
              <div id="btn-toggle-past-convs" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: pointer; user-select: none; background: rgba(15, 23, 42, 0.4);">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">📁</span>
                  <b style="font-size: 13.5px; color: #fff;">${t('pastTrainings', 'Entrenamientos Pasados')}</b>
                  <span class="badge" style="background: rgba(148, 163, 184, 0.18); color: #cbd5e1; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px;">
                    ${pastList.length}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 11.5px; color: var(--cyan); font-weight: 700;">${showPastConvs ? t('hide', 'Ocultar') : t('show', 'Mostrar')}</span>
                  <span style="font-size: 13px; color: var(--cyan); font-weight: 900;">${showPastConvs ? '▲' : '▼'}</span>
                </div>
              </div>

              ${showPastConvs ? `
                <div style="padding: 10px 12px 12px; border-top: 1px solid var(--border); background: var(--bg);">
                  <p style="font-size: 11px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">
                    ${t('pastTrainingsDesc', 'Historial de sesiones y convocatorias finalizadas con asistencia registrada.')}
                  </p>
                  <div class="conv-list" style="display: flex; flex-direction: column; gap: 8px;">
                    ${pastList.map(c => renderCard(c, true)).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        `}
      `;

      const btnCreate = view.querySelector('#btn-create-conv');
      if (btnCreate) btnCreate.onclick = () => showEditConvocationModal(null, () => build());

      const btnEmpty = view.querySelector('#btn-empty-conv');
      if (btnEmpty) btnEmpty.onclick = () => showEditConvocationModal(null, () => build());

      const btnRecurring = view.querySelector('#btn-recurring-trainings');
      if (btnRecurring) btnRecurring.onclick = () => showRecurringTrainingsModal(() => build());

      const btnDeleteAll = view.querySelector('#btn-delete-all-convs');
      if (btnDeleteAll) {
        btnDeleteAll.onclick = () => {
          confirmDialog(
            t('deleteAllPlans', 'Borrar todos los planes'),
            t('confirmDeleteAllPlans', '¿Estás seguro de que deseas eliminar todas las convocatorias y planes registrados? Esta acción no se puede deshacer.'),
            () => {
              const oldConvs = (Store.state.convocations || []).slice();
              const convIdsSet = new Set(oldConvs.map(c => c && c.id).filter(Boolean));
              const linkedSessIdsSet = new Set(oldConvs.map(c => c && c.sessionId).filter(Boolean));
              oldConvs.forEach(c => {
                if (c) Store.markRecurringDeleted(c);
              });
              Store.state.convocations = [];
              Store.state.recurringSchedules = [];

              const sessionsToDelete = [];
              Store.state.sessions = (Store.state.sessions || []).filter(s => {
                if (!s) return false;
                const isLinked = (s.convocationId && convIdsSet.has(s.convocationId)) || linkedSessIdsSet.has(s.id) || !!s.scheduleId;
                if (!isLinked) return true;
                const hasData = (s.elapsedMs > 0) ||
                                (s.stats && Object.keys(s.stats).length > 0) ||
                                (s.log && s.log.length > 0) ||
                                (s.status === 'completed');
                if (!hasData) {
                  Store.markRecurringDeleted(s);
                  sessionsToDelete.push(s);
                  return false;
                }
                return true;
              });

              Store.save();
              if (window.Cloud) {
                if (typeof window.Cloud.deleteConvocationFromCloud === 'function') {
                  oldConvs.forEach(c => { if (c && c.id) window.Cloud.deleteConvocationFromCloud(c.id); });
                }
                if (typeof window.Cloud.deleteSessionFromCloud === 'function') {
                  sessionsToDelete.forEach(s => { if (s && s.id) window.Cloud.deleteSessionFromCloud(s.id); });
                }
                if (typeof window.Cloud.pushCoachState === 'function') {
                  window.Cloud.pushCoachState(Store.state, true);
                }
              }
              toast(t('allPlansDeleted', 'Todos los planes han sido eliminados'), 'info');
              build();
            },
            t('delete', 'Eliminar'),
            'danger'
          );
        };
      }

      view.querySelectorAll('[data-coach-conv-filter]').forEach(b => {
        b.onclick = () => {
          convCoachFilterType = b.getAttribute('data-coach-conv-filter');
          build();
        };
      });

      const btnTogglePast = view.querySelector('#btn-toggle-past-convs');
      if (btnTogglePast) {
        btnTogglePast.onclick = () => {
          haptic(20);
          showPastConvs = !showPastConvs;
          build();
        };
      }

      view.querySelectorAll('[data-quick-remind]').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const cid = btn.getAttribute('data-quick-remind');
          const conv = Store.convocation(cid);
          if (conv) {
            await sendConvocationAttendanceReminder(conv);
          }
        };
      });


      // Al pulsar en una convocatoria de la lista: abre la ventana con información y resumen de esa convocatoria
      view.querySelectorAll('.conv-card').forEach(card => {
        card.onclick = () => {
          const cid = card.getAttribute('data-cid');
          const conv = Store.convocation(cid);
          if (conv) {
            showConvocationDetailsModal(conv, () => build());
          }
        };
      });
    }

    build();
  }

  /* =========================================================
     VISTA 4: MÉTRICAS Y ESTADÍSTICAS GLOBALES
     ========================================================= */
  function renderStatsView(view) {
    function build() {
      const allTeams = Store.state.teams || [];
      const isAllTeams = statsFilterTeams.includes('all');

      // Jugadores filtrados por equipos seleccionados
      const allPlayers = Store.sortedPlayers().filter(p => {
        if (isAllTeams) return true;
        return statsFilterTeams.includes(p.teamId);
      });

      // Sesiones filtradas por tipo/periodo y por los equipos activos
      const rawSessions = Store.filterSessions(statsFilterType, statsFilterPeriod);
      const sessions = rawSessions.filter(s => {
        if (isAllTeams) return true;
        const pids = Store.sessionPlayerIds(s);
        return pids.some(pid => {
          const p = Store.player(pid);
          return p && statsFilterTeams.includes(p.teamId);
        });
      });

      let totalTouches = 0, totalPassOk = 0, totalPassKo = 0, totalShotOn = 0, totalShotOff = 0, totalGoals = 0;
      let totalDuelWonGoal = 0, totalDuelWonStop = 0, totalDuelLostTurnover = 0, totalDuelLostGoal = 0;

      sessions.forEach(s => {
        const pids = statsSelectedPlayerId === 'all'
          ? Store.sessionPlayerIds(s).filter(pid => {
              if (isAllTeams) return true;
              const p = Store.player(pid);
              return p && statsFilterTeams.includes(p.teamId);
            })
          : [statsSelectedPlayerId];

        pids.forEach(pid => {
          const st = s.stats[pid] || {};
          totalTouches += (st.touches || 0);
          totalPassOk += (st.passOk || 0);
          totalPassKo += (st.passKo || 0);
          totalShotOn += (st.shotOn || 0);
          totalShotOff += (st.shotOff || 0);
          totalGoals += (st.goal || 0);

          totalDuelWonGoal += (st.duel1v1WonGoal || 0);
          totalDuelWonStop += (st.duel1v1WonStop || 0);
          totalDuelLostTurnover += (st.duel1v1LostTurnover || 0);
          totalDuelLostGoal += (st.duel1v1LostGoal || 0);
        });
      });

      const totalPass = totalPassOk + totalPassKo;
      const passPct = totalPass ? Math.round((totalPassOk / totalPass) * 100) : 0;
      const totalShots = totalShotOn + totalShotOff;
      const shotPct = totalShots ? Math.round((totalShotOn / totalShots) * 100) : 0;

      const totalDuelWon = totalDuelWonGoal + totalDuelWonStop;
      const totalDuelLost = totalDuelLostTurnover + totalDuelLostGoal;
      const totalDuels = totalDuelWon + totalDuelLost;
      const duelWinRate = totalDuels ? Math.round((totalDuelWon / totalDuels) * 100) : 0;

      view.innerHTML = `
        <div class="topbar">
          <div>
            <h1>${t('globalStats')}</h1>
            <span class="sub">${sessions.length} ${t('sessionsAnalyzedSuffix')}</span>
          </div>
          <div class="row">
            <button class="icon-btn" id="btn-stats-h2h" title="${t('headToHead')}">${icon('compare', 20)}</button>
            <button class="icon-btn" id="btn-export-stats-json" title="${t('exportJSON')}">${icon('file', 20)}</button>
            <button class="icon-btn" id="btn-export-stats-csv" title="${t('exportCSV')}">${icon('download', 20)}</button>
          </div>
        </div>

        <!-- Filtros por tipo de sesión -->
        <div class="segmented" style="margin-bottom: 10px;">
          <button class="${statsFilterType === 'all' ? 'active' : ''}" data-type="all">${t('all')}</button>
          <button class="${statsFilterType === 'training' ? 'active t-training' : ''}" data-type="training">${t('training')}</button>
          <button class="${statsFilterType === 'match' ? 'active t-match' : ''}" data-type="match">${t('match')}</button>
        </div>

        <!-- Filtros por equipos (Multi-selección acumulativa) -->
        <div style="margin-bottom: 12px;">
          <div style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
            🛡️ ${t('teams', 'Equipos')}:
          </div>
          <div class="chips" id="metrics-team-filters" style="display: flex; flex-wrap: wrap; gap: 6px;">
            <button class="chip ${isAllTeams ? 'active' : ''}" data-team="all" style="font-weight: 800;">
              👥 ${t('all', 'Todos')}
            </button>
            ${allTeams.map(tm => {
              const isAct = !isAllTeams && statsFilterTeams.includes(tm.id);
              return `
                <button class="chip ${isAct ? 'active' : ''}" data-team="${tm.id}" style="${isAct ? `background: ${tm.color || '#22c55e'}; color: #fff; border-color: ${tm.color || '#22c55e'}; font-weight: 800; box-shadow: 0 0 10px ${tm.color}55;` : ''}">
                  <span class="dot" style="background: ${tm.color || '#22c55e'}"></span>
                  ${escapeHtml(tm.name)}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Selector visual de jugador para Métricas -->
        <div class="metrics-player-selector">
          <div class="metrics-player-card" id="btn-metrics-open-picker">
            ${statsSelectedPlayerId === 'all' ? `
              <div class="all-icon">👥</div>
              <div class="p-info">
                <div class="p-name">${t('allPlayersAverage')}</div>
                <div class="p-meta"><span>${allPlayers.length} ${t('playerSquad').toLowerCase()}</span></div>
              </div>
              <button class="btn sm ghost" type="button" style="pointer-events: none;">${icon('search', 16)} ${t('changePlayer')}</button>
            ` : (() => {
              const sp = Store.player(statsSelectedPlayerId);
              const sTeam = sp ? Store.team(sp.teamId) : null;
              return `
                ${sp ? renderAvatar(sp, 'sm') : ''}
                <div class="p-info">
                  <div class="p-name">${escapeHtml(Store.playerName(sp))}</div>
                  <div class="p-meta">
                    <span class="pos-tag">${sp ? sp.mainPosition || 'Jugador' : ''}</span>
                    <span>#${sp && sp.mainDorsal != null ? sp.mainDorsal : '-'}</span>
                    ${sTeam ? `<b style="color: ${sTeam.color};">${escapeHtml(sTeam.name)}</b>` : ''}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <button class="btn sm primary clickable-p-profile" data-pid="${sp ? sp.id : ''}" type="button" style="font-size: 11px; padding: 4px 8px; font-weight: 800;">
                    👤 Perfil
                  </button>
                  <button class="icon-btn ghost" id="btn-metrics-reset-all" type="button" title="${t('viewAllPlayers')}">${icon('x', 18)}</button>
                </div>
              `;
            })()}
          </div>

          <!-- Carrusel horizontal visual con avatares -->
          <div class="metrics-player-carousel">
            <div class="metrics-p-chip ${statsSelectedPlayerId === 'all' ? 'active' : ''}" data-pid="all">
              <div class="all-icon">👥</div>
              <span class="chip-name">${t('all')}</span>
            </div>
            ${allPlayers.map(p => `
              <div class="metrics-p-chip ${statsSelectedPlayerId === p.id ? 'active' : ''}" data-pid="${p.id}">
                ${renderAvatar(p, 'sm')}
                <span class="chip-name">#${p.mainDorsal != null ? p.mainDorsal : ''} ${escapeHtml(Store.playerName(p, true))}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Anillos de Progreso y Métricas Principales (incluyendo 1v1) -->
        <div class="rings" style="margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
          <div class="ring-card" style="padding: 10px 4px;">
            <div class="ring">
              ${renderProgressRing(passPct, '#22c55e')}
              <span class="r-val" style="color: #22c55e;">${passPct}%</span>
            </div>
            <span style="font-size: 11px;">${t('passAccuracy')}</span>
            <small>${totalPassOk}/${totalPass}</small>
          </div>

          <div class="ring-card" style="padding: 10px 4px;">
            <div class="ring">
              ${renderProgressRing(shotPct, '#06b6d4')}
              <span class="r-val" style="color: #06b6d4;">${shotPct}%</span>
            </div>
            <span style="font-size: 11px;">${t('shotAccuracy')}</span>
            <small>${totalShotOn}/${totalShots}</small>
          </div>

          <div class="ring-card" style="padding: 10px 4px;">
            <div class="ring">
              ${renderProgressRing(Math.min(100, totalGoals * 20), '#facc15')}
              <span class="r-val" style="color: #facc15;">${totalGoals}</span>
            </div>
            <span style="font-size: 11px;">${t('totalGoals')}</span>
            <small>${sessions.length} ses.</small>
          </div>

          <div class="ring-card" style="padding: 10px 4px;">
            <div class="ring">
              ${renderProgressRing(duelWinRate, '#f97316')}
              <span class="r-val" style="color: #f97316;">${duelWinRate}%</span>
            </div>
            <span style="font-size: 11px;">${t('duels1v1WinRate', '% Victoria 1v1')}</span>
            <small>${totalDuelWon}/${totalDuels} 1v1</small>
          </div>
        </div>

        <!-- Tarjeta Dedicada: Datos Completos de 1v1 -->
        <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(249, 115, 22, 0.4); background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, var(--surface2) 100%); border-radius: 14px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 12.5px; font-weight: 900; color: #fb923c; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>⚔️</span> <span>${t('duels1v1', 'Duelos 1v1')}</span>
            </span>
            <span class="badge" style="background: ${duelWinRate >= 50 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${duelWinRate >= 50 ? '#86efac' : '#fca5a5'}; font-size: 11px; font-weight: 800; border: 1px solid ${duelWinRate >= 50 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'};">
              ${duelWinRate}% Win Rate
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
            <div style="background: rgba(0,0,0,0.3); padding: 8px 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="font-size: 10px; font-weight: 800; color: #4ade80;">${t('won', 'Ganados')}</div>
              <div style="font-size: 17px; font-weight: 900; color: #4ade80;">${totalDuelWon}</div>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 8px 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="font-size: 10px; font-weight: 800; color: #f87171;">${t('lost', 'Perdidos')}</div>
              <div style="font-size: 17px; font-weight: 900; color: #f87171;">${totalDuelLost}</div>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 8px 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="font-size: 10px; font-weight: 800; color: #facc15;">${t('duel1v1Goals', 'Goles 1v1')}</div>
              <div style="font-size: 17px; font-weight: 900; color: #facc15;">${totalDuelWonGoal}</div>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 8px 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="font-size: 10px; font-weight: 800; color: #38bdf8;">${t('duel1v1Stops', 'Robos 1v1')}</div>
              <div style="font-size: 17px; font-weight: 900; color: #38bdf8;">${totalDuelWonStop}</div>
            </div>
          </div>
        </div>

        <!-- Líderes de Rendimiento (con 1v1) -->
        <div class="section-title"><span>${t('performanceLeaders')}</span></div>

        <div class="card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: #fb923c;">${t('top1v1', '⚔️ Líderes en Duelos 1v1 Ganados')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'duel1v1Won', '#fb923c')}
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: #38bdf8;">${t('top1v1Stops', '🛡️ Más Robos / Cierres en 1v1')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'duel1v1WonStop', '#38bdf8')}
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: #facc15;">${t('topScorers')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'goal', '#facc15')}
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: #22c55e;">${t('mostTouches')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'touches', '#22c55e')}
        </div>

        <div class="card" style="margin-bottom: 14px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: #06b6d4;">${t('topPassers')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'passOk', '#06b6d4')}
        </div>
      `;

      // Eventos de filtros por sesión
      view.querySelectorAll('.segmented button').forEach(b => {
        b.onclick = () => {
          statsFilterType = b.getAttribute('data-type');
          build();
        };
      });

      // Eventos de filtros multi-selección de equipos
      view.querySelectorAll('#metrics-team-filters .chip').forEach(btn => {
        btn.onclick = () => {
          const tid = btn.getAttribute('data-team');
          if (tid === 'all') {
            statsFilterTeams = ['all'];
          } else {
            if (statsFilterTeams.includes('all')) {
              statsFilterTeams = [tid];
            } else {
              if (statsFilterTeams.includes(tid)) {
                statsFilterTeams = statsFilterTeams.filter(id => id !== tid);
                if (statsFilterTeams.length === 0) {
                  statsFilterTeams = ['all'];
                }
              } else {
                statsFilterTeams.push(tid);
              }
            }
          }
          if (statsSelectedPlayerId !== 'all') {
            const sp = Store.player(statsSelectedPlayerId);
            if (sp && !statsFilterTeams.includes('all') && !statsFilterTeams.includes(sp.teamId)) {
              statsSelectedPlayerId = 'all';
            }
          }
          build();
        };
      });

      // Eventos del carrusel de jugadores
      view.querySelectorAll('.metrics-p-chip').forEach(chip => {
        chip.onclick = () => {
          statsSelectedPlayerId = chip.getAttribute('data-pid');
          build();
        };
      });

      // Evento abrir selector modal de jugadores
      const cardEl = view.querySelector('#btn-metrics-open-picker');
      if (cardEl) {
        cardEl.onclick = (e) => {
          if (e.target.closest('.clickable-p-profile')) return;
          const resetBtn = e.target.closest('#btn-metrics-reset-all');
          if (resetBtn) {
            e.stopPropagation();
            statsSelectedPlayerId = 'all';
            build();
            return;
          }
          showPlayerPickerModal(statsSelectedPlayerId, (pid) => {
            statsSelectedPlayerId = pid;
            build();
          });
        };
      }

      // Al pulsar en cualquier jugador de la lista / rankings / tarjeta -> abrir perfil
      view.querySelectorAll('.clickable-p-profile').forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const pid = el.getAttribute('data-pid');
          if (pid) {
            haptic(25);
            showPlayerProfileModal(pid);
          }
        };
      });

      view.querySelector('#btn-stats-h2h').onclick = () => {
        showHeadToHeadModal(statsSelectedPlayerId !== 'all' ? statsSelectedPlayerId : null, null);
      };
      view.querySelector('#btn-export-stats-json').onclick = () => IO.exportBackup();
      view.querySelector('#btn-export-stats-csv').onclick = () => IO.exportStatsCSV(sessions);
    }

    build();
  }

  function renderProgressRing(pct, color) {
    const r = 26;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * Math.min(100, Math.max(0, pct))) / 100;
    return `
      <svg width="64" height="64" viewBox="0 0 64 64" style="display: block; margin: 0 auto;">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5.5" />
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="5.5"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" />
      </svg>
    `;
  }

  function renderTopRankHtml(players, sessions, key, color) {
    const ranking = players.map(p => {
      let sum = 0;
      sessions.forEach(s => {
        const st = (s && s.stats && s.stats[p.id]) || {};
        if (key === 'duel1v1Won') {
          sum += (st.duel1v1WonGoal || 0) + (st.duel1v1WonStop || 0);
        } else {
          sum += (st[key] || 0);
        }
      });
      return { player: p, value: sum };
    }).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);

    if (ranking.length === 0) {
      return `<p class="muted" style="font-size: 13px; margin: 4px 0;">Sin registros</p>`;
    }

    const maxVal = ranking[0].value || 1;

    return ranking.map((item, idx) => {
      const pct = Math.round((item.value / maxVal) * 100);
      return `
        <div class="rank-item clickable-p-profile" data-pid="${item.player.id}" style="padding: 8px 10px; border-radius: 10px; cursor: pointer; transition: background 0.15s ease; display: flex; align-items: center; gap: 8px;" title="${t('viewPlayerProfile', 'Ver Perfil del Jugador')}">
          <div class="rank-pos" style="font-weight: 900; font-size: 12px; color: var(--muted); width: 22px;">#${idx + 1}</div>
          ${renderAvatar(item.player, 'sm')}
          <div class="grow ellipsis">
            <b style="color: #fff; font-size: 13px;">${escapeHtml(Store.playerName(item.player))}</b>
            <div class="rank-bar"><i style="--rc: ${color}; width: ${pct}%;"></i></div>
          </div>
          <div class="rank-val" style="color: ${color}; font-weight: 900; font-size: 14px;">${item.value}</div>
          <span style="color: var(--muted); font-size: 14px; margin-left: 4px;">›</span>
        </div>
      `;
    }).join('');
  }

  /* =========================================================
     MODAL: EDITAR PERFIL DEL ENTRENADOR
     ========================================================= */
  function showEditCoachProfileModal(onDone) {
    const profile = Store.state.coachProfile || {
      name: '',
      role: 'Primer Entrenador / Head Coach',
      license: 'UEFA Pro',
      photo: '',
      phone: '',
      email: '',
      bio: '',
      philosophy: ''
    };
    let photoData = profile.photo || '';

    openSheet(t('editCoachProfile', 'Perfil del Entrenador'), (body) => {
      body.innerHTML = `
        <div class="field photo-field">
          <div class="avatar lg" id="coach-photo-preview" style="cursor: pointer;">
            ${photoData ? `<img src="${photoData}" alt="" />` : `<span>👔</span>`}
            <div class="cam">${icon('camera', 16)}</div>
          </div>
          <input type="file" id="coach-photo-input" accept="image/*" style="display: none;" />
          <span class="hint">${t('tapToChangePhoto', 'Toca para cambiar la foto')}</span>
        </div>

        <div class="field-row">
          <div class="field">
            <label>${t('fullName', 'Nombre Completo')}</label>
            <input type="text" id="coach-name" value="${escapeHtml(profile.name || '')}" placeholder="Ej. Carlos Silva" />
          </div>
          <div class="field">
            <label>${t('coachTitle', 'Cargo / Puesto')}</label>
            <input type="text" id="coach-role" value="${escapeHtml(profile.role || '')}" placeholder="Ej. Primer Entrenador" />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>${t('coachLicense', 'Licencia / Titulación')}</label>
            <input type="text" id="coach-license" value="${escapeHtml(profile.license || '')}" placeholder="Ej. UEFA Pro / UEFA A" />
          </div>
          <div class="field">
            <label>${t('coachContact', 'Teléfono / Contacto')}</label>
            <input type="tel" id="coach-phone" value="${escapeHtml(profile.phone || '')}" placeholder="+34 600 000 000" />
          </div>
        </div>

        <div class="field">
          <label>Email</label>
          <input type="email" id="coach-email" value="${escapeHtml(profile.email || '')}" placeholder="mister@club.com" />
        </div>

        <div class="field">
          <label>${t('coachBio', 'Presentación / Trayectoria')}</label>
          <textarea id="coach-bio" rows="3" placeholder="Experiencia previa, años en el club...">${escapeHtml(profile.bio || '')}</textarea>
        </div>

        <div class="field">
          <label>${t('notes', 'Filosofía y Metodología')}</label>
          <textarea id="coach-philosophy" rows="3" placeholder="Principios de juego, valores del equipo...">${escapeHtml(profile.philosophy || '')}</textarea>
        </div>
      `;

      const photoPreview = body.querySelector('#coach-photo-preview');
      const photoInput = body.querySelector('#coach-photo-input');
      if (photoPreview && photoInput) {
        photoPreview.onclick = () => photoInput.click();
        photoInput.onchange = async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          try {
            const dataUrl = await IO.readFileDataURL(file);
            const shrunken = await IO.shrinkPhoto(dataUrl, 200);
            photoData = shrunken;
            photoPreview.innerHTML = `<img src="${shrunken}" alt="" /><div class="cam">${icon('camera', 16)}</div>`;
            haptic(30);
          } catch (err) {
            console.error('Error procesando foto:', err);
            toast('Error procesando imagen', 'error');
          }
        };
      }
    }, (foot) => {
      foot.innerHTML = `
        <button class="btn block primary" id="btn-save-coach-profile" style="font-weight: 800;">
          💾 ${t('saveProfile', 'Guardar Perfil de Entrenador')}
        </button>
      `;

      foot.querySelector('#btn-save-coach-profile').onclick = () => {
        const name = (document.getElementById('coach-name') ? document.getElementById('coach-name').value : '').trim();
        const role = (document.getElementById('coach-role') ? document.getElementById('coach-role').value : '').trim();
        const license = (document.getElementById('coach-license') ? document.getElementById('coach-license').value : '').trim();
        const phone = (document.getElementById('coach-phone') ? document.getElementById('coach-phone').value : '').trim();
        const email = (document.getElementById('coach-email') ? document.getElementById('coach-email').value : '').trim();
        const bio = (document.getElementById('coach-bio') ? document.getElementById('coach-bio').value : '').trim();
        const philosophy = (document.getElementById('coach-philosophy') ? document.getElementById('coach-philosophy').value : '').trim();

        Store.upsertCoachProfile({
          name: name || 'Entrenador',
          role: role || 'Primer Entrenador',
          license,
          phone,
          email,
          bio,
          philosophy,
          photo: photoData
        });

        if (window.Cloud && window.Cloud.pushCoachState) {
          window.Cloud.pushCoachState(Store.state, true);
        }

        closeSheet();
        toast(t('savedSuccess', '¡Guardado con éxito!'), 'success');
        haptic(40);
        if (typeof onDone === 'function') onDone();
      };
    });
  }

  /* =========================================================
     VISTA 5: AJUSTES / CONFIGURACIÓN
     ========================================================= */
  function renderConfigView(view) {
    const settings = Store.state.settings;
    const coachProfile = Store.state.coachProfile || {};
    const testP = Store.ensureTestPlayer();

    view.innerHTML = `
      <div class="topbar">
        <div>
          <h1>${t('configTitle')}</h1>
          <span class="sub">${t('configSubtitle')}</span>
        </div>
        ${renderLangButton()}
      </div>

      <!-- Perfil del Entrenador -->
      <div class="section-title"><span>👔 ${t('coachProfile', 'Perfil del Entrenador')}</span></div>
      <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(34, 211, 238, 0.35); background: linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <div class="avatar md" style="flex-shrink: 0;">
            ${coachProfile.photo ? `<img src="${coachProfile.photo}" alt="" />` : `<span>👔</span>`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <b style="font-size: 15px; color: #fff; display: block;" class="ellipsis">${escapeHtml(coachProfile.name || 'Entrenador')}</b>
            <span style="font-size: 12px; color: var(--cyan); font-weight: 700; display: block;" class="ellipsis">${escapeHtml(coachProfile.role || 'Primer Entrenador')}</span>
            ${coachProfile.license ? `<small style="font-size: 11px; color: var(--muted); display: block;">📜 ${escapeHtml(coachProfile.license)}</small>` : ''}
          </div>
        </div>
        <button type="button" class="btn block secondary" id="btn-edit-coach-profile" style="font-size: 12.5px; font-weight: 800; height: 36px;">
          ✏️ ${t('editCoachProfile', 'Editar Mi Perfil de Entrenador')}
        </button>
      </div>

      <!-- Selector de Idioma -->
      <div class="section-title"><span>${t('appLanguage')}</span></div>
      <div class="card" style="margin-bottom: 14px;">
        <div class="segmented" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
          <button type="button" class="${I18N.getLang() === 'es' ? 'active' : ''}" id="lang-pick-es">🇪🇸 ES</button>
          <button type="button" class="${I18N.getLang() === 'en' ? 'active' : ''}" id="lang-pick-en">🇬🇧 EN</button>
          <button type="button" class="${(I18N.getLang() === 'et' || I18N.getLang() === 'ee') ? 'active' : ''}" id="lang-pick-et">🇪🇪 ET</button>
          <button type="button" class="${I18N.getLang() === 'ru' ? 'active' : ''}" id="lang-pick-ru">🇷🇺 RU</button>
        </div>
      </div>

      <div class="section-title"><span>${t('customizeButtons')} (Orden Canónico Fijo)</span></div>
      <div class="card" style="margin-bottom: 14px;">
        ${Store.STATS.map(item => {
          const isEnabled = settings.enabledStats.includes(item.key);
          return `
            <div class="toggle-row">
              <span class="t-emoji" style="background: ${item.color}20;">${item.emoji}</span>
              <div class="grow">
                <h5>${item.label}</h5>
                <small>${item.short}</small>
              </div>
              <button class="switch ${isEnabled ? 'on' : ''}" data-stat="${item.key}"></button>
            </div>
          `;
        }).join('')}
      </div>

      <div class="section-title"><span>Comportamiento</span></div>
      <div class="card" style="margin-bottom: 14px;">
        <div class="toggle-row">
          <div class="grow">
            <h5>${t('hapticVibration')}</h5>
            <small>${t('hapticDesc')}</small>
          </div>
          <button class="switch ${settings.vibrate ? 'on' : ''}" id="toggle-vibrate"></button>
        </div>

        <div class="toggle-row">
          <div class="grow">
            <h5>${t('linkGoalToShot')}</h5>
            <small>${t('linkGoalToShotDesc')}</small>
          </div>
          <button class="switch ${settings.linkGoalShot ? 'on' : ''}" id="toggle-link-goal"></button>
        </div>

        <div class="toggle-row">
          <div class="grow">
            <h5>${t('askZoneOnShots')}</h5>
            <small>${t('askZoneOnShotsDesc')}</small>
          </div>
          <button class="switch ${settings.askZoneOnShots !== false ? 'on' : ''}" id="toggle-ask-zone"></button>
        </div>
      </div>

      <div class="section-title"><span>🌐 Nube y Portal de Jugadores (Firebase)</span></div>
      <div class="card" style="margin-bottom: 14px; background: linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(19, 31, 56, 0.6) 100%); border-color: rgba(34, 211, 238, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div>
            <h5 style="margin: 0; font-size: 14px; font-weight: 800; color: #fff;">Conexión en Vivo</h5>
            <small style="color: var(--muted); font-size: 11px;">Sincroniza plantilla, convocatorias y votos en tiempo real</small>
          </div>
          <span class="badge" id="cloud-status-badge" style="background: rgba(34, 197, 94, 0.15); color: #86efac; font-size: 11px;">🟢 Conectado</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn btn-primary" id="btn-cloud-sync-now" style="height: 40px; font-size: 13px; font-weight: 800;">
            ☁️ ${t('syncAllNow', 'Sincronizar Todo a la Nube Ahora')}
          </button>
          <button class="btn btn-secondary block" id="btn-copy-portal-link" style="height: 38px; font-size: 12.5px; font-weight: 700;">
            🔗 Copiar Enlace Portal del Jugador
          </button>
          <button class="btn btn-secondary block" id="btn-reset-test-presence" style="height: 38px; font-size: 12px; font-weight: 700; color: #f87171; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1);">
            🔄 ${t('resetTestPlayerLinks', 'Desvincular perfiles de prueba')}
          </button>
          <button class="btn btn-secondary block" id="btn-force-players-cache-wipe" style="height: 42px; font-size: 12.5px; font-weight: 800; color: #facc15; border: 1.5px solid rgba(250, 204, 21, 0.5); background: rgba(250, 204, 21, 0.12); display: flex; align-items: center; justify-content: center; gap: 8px;">
            🧹 ${t('forcePlayersCacheWipe', 'Forzar Borrado de Caché en Jugadores (App y PWA)')}
          </button>
        </div>
      </div>

      <!-- Perfil de Jugador de Prueba (Modo Test) -->
      <div class="section-title"><span>🧪 ${t('testPlayerProfile', 'Perfil de Jugador de Prueba (Modo Test)')}</span></div>
      <div class="card" style="margin-bottom: 14px; border: 1.5px dashed rgba(250, 204, 21, 0.6); background: linear-gradient(135deg, rgba(250, 204, 21, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div>
            <h5 style="margin: 0; font-size: 14px; font-weight: 800; color: #fff;">🧪 ${t('testPlayer', 'Jugador de Prueba')}</h5>
            <small style="color: var(--muted); font-size: 11px;">${t('testProfileDesc', 'Perfil invisible para verificar convocatorias y votaciones MVP.')}</small>
          </div>
          <span class="badge" style="background: rgba(250, 204, 21, 0.2); color: #facc15; font-size: 11px; font-weight: 800; border: 1px solid rgba(250, 204, 21, 0.4);">Modo Test</span>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 12px; font-weight: 800; color: var(--muted); display: block; margin-bottom: 4px;">
            🛡️ ${t('assignedTeam', 'Equipo asignado')}:
          </label>
          <select id="config-test-player-team" class="input" style="width: 100%; height: 40px; border-radius: 10px; font-size: 13.5px; font-weight: 800; background: var(--bg2); color: #fff; border: 1px solid var(--border);">
            <option value="all" ${(testP && (testP.teamId === 'all' || !testP.teamId)) ? 'selected' : ''}>🌐 ${t('allTeams', 'Todos los equipos')}</option>
            ${Store.state.teams.map(tm => `
              <option value="${tm.id}" ${(testP && testP.teamId === tm.id) ? 'selected' : ''}>🛡️ ${escapeHtml(tm.name)}</option>
            `).join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" class="btn secondary" id="btn-config-open-test-player" style="height: 38px; font-size: 11.5px; font-weight: 800; color: #facc15; border-color: rgba(250, 204, 21, 0.5);">
            📲 ${t('openAsTestPlayer', 'Abrir App como Test')}
          </button>
          <button type="button" class="btn secondary" id="btn-config-copy-test-link" style="height: 38px; font-size: 11.5px; font-weight: 800;">
            📋 ${t('copyTestLink', 'Copiar Enlace')}
          </button>
        </div>
      </div>

      <div class="section-title"><span>${t('teams')}</span></div>
      <div class="menu-list" style="margin-bottom: 14px;">
        <button class="menu-item" id="btn-config-manage-teams">
          <div class="m-ic">${icon('shield', 20)}</div>
          <div class="grow">
            <h5>${t('manageTeams')}</h5>
            <small>Crear, modificar equipos y reasignar jugadores</small>
          </div>
          ${icon('chevR', 18, 'dim')}
        </button>
      </div>

      <div class="section-title"><span>${t('exportJSON')} y Copias de Seguridad</span></div>
      <div class="menu-list" style="margin-bottom: 14px;">
        <button class="menu-item" id="btn-export-backup">
          <div class="m-ic">${icon('file', 20)}</div>
          <div class="grow">
            <h5>${t('fullBackup')}</h5>
            <small>${t('fullBackupDesc')}</small>
          </div>
          ${icon('chevR', 18, 'dim')}
        </button>

        <button class="menu-item" id="btn-restore-backup">
          <div class="m-ic">${icon('upload', 20)}</div>
          <div class="grow">
            <h5>${t('restoreBackup')}</h5>
            <small>${t('restoreBackupDesc')}</small>
          </div>
          ${icon('chevR', 18, 'dim')}
        </button>

        <button class="menu-item" id="btn-export-all-csv">
          <div class="m-ic">${icon('download', 20)}</div>
          <div class="grow">
            <h5>${t('exportCSV')}</h5>
            <small>Hoja de cálculo para Excel</small>
          </div>
          ${icon('chevR', 18, 'dim')}
        </button>
      </div>

      <div class="menu-list">
        <button class="menu-item danger" id="btn-reset-all">
          <div class="m-ic">${icon('trash', 20)}</div>
          <div class="grow">
            <h5>${t('resetAll')}</h5>
            <small>${t('resetAllDesc')}</small>
          </div>
          ${icon('chevR', 18, 'dim')}
        </button>
      </div>

      <div style="text-align: center; padding: 20px 0; color: var(--dim); font-size: 12px;">
        ${t('appName')} v1.1 • APK Android
      </div>
    `;

    const btnLang = view.querySelector('#btn-toggle-lang');
    if (btnLang) btnLang.onclick = toggleLanguage;

    const btnEditCoach = view.querySelector('#btn-edit-coach-profile');
    if (btnEditCoach) {
      btnEditCoach.onclick = () => showEditCoachProfileModal(() => renderConfigView(view));
    }

    view.querySelector('#lang-pick-es').onclick = () => {
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
    }

    view.querySelectorAll('[data-stat]').forEach(sw => {
      sw.onclick = () => {
        const k = sw.getAttribute('data-stat');
        const list = settings.enabledStats;
        const idx = list.indexOf(k);
        if (idx >= 0) {
          if (list.length <= 1) {
            toast(t('minTwoButtons'), 'error');
            return;
          }
          list.splice(idx, 1);
          sw.classList.remove('on');
        } else {
          list.push(k);
          sw.classList.add('on');
        }
        // Guardar siempre en orden canónico
        settings.enabledStats = Store.getSortedStats(list).map(s => s.key);
        Store.save();
        haptic(25);
      };
    });

    view.querySelector('#toggle-vibrate').onclick = (e) => {
      settings.vibrate = !settings.vibrate;
      e.currentTarget.classList.toggle('on', settings.vibrate);
      Store.save();
    };

    view.querySelector('#toggle-link-goal').onclick = (e) => {
      settings.linkGoalShot = !settings.linkGoalShot;
      e.currentTarget.classList.toggle('on', settings.linkGoalShot);
      Store.save();
    };

    view.querySelector('#toggle-ask-zone').onclick = (e) => {
      settings.askZoneOnShots = !(settings.askZoneOnShots !== false);
      e.currentTarget.classList.toggle('on', settings.askZoneOnShots);
      Store.save();
    };

    const btnCfgTeams = view.querySelector('#btn-config-manage-teams');
    if (btnCfgTeams) btnCfgTeams.onclick = () => showManageTeamsModal();

    const btnSyncNow = view.querySelector('#btn-cloud-sync-now');
    if (btnSyncNow) {
      btnSyncNow.onclick = async () => {
        btnSyncNow.disabled = true;
        btnSyncNow.textContent = '⏳ ' + t('syncing', 'Sincronizando...');
        try {
          if (window.Cloud) {
            const ok = await window.Cloud.pushCoachState(Store.state, true);
            if (ok) {
              toast(t('syncSuccess', '¡Datos sincronizados en la nube en tiempo real!'), 'success');
            } else {
              const err = window.Cloud && window.Cloud.lastError;
              if (err === 'QUOTA_EXCEEDED') {
                toast(t('firestoreQuotaExceeded', '⚠️ Límite de cuota gratuita diaria de Firestore alcanzado (20.000 operaciones). Tus datos locales están seguros y se sincronizarán al restablecerse la cuota (00:00 PST / 10:00).'), 'warning');
              } else if (err) {
                toast(t('syncError', 'Error al sincronizar') + ': ' + err, 'error');
              } else {
                toast(t('syncErrorFallback', 'Error al sincronizar. Comprueba tu conexión a Internet.'), 'warning');
              }
            }
          }
        } catch (err) {
          console.error('[Cloud] Error en botón sincronizar:', err);
          toast(t('syncError', 'Error al sincronizar') + ': ' + (err.message || err), 'error');
        } finally {
          btnSyncNow.disabled = false;
          btnSyncNow.textContent = '☁️ ' + t('syncAllNow', 'Sincronizar Todo a la Nube Ahora');
        }
      };
    }

    const portalUrl = 'https://streetoh.github.io/Player_Stats/jugadores.html';
    const btnCopyPortal = view.querySelector('#btn-copy-portal-link');
    if (btnCopyPortal) {
      btnCopyPortal.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(portalUrl).then(() => {
            toast('Enlace del Portal copiado al portapapeles', 'success');
          }).catch(() => {
            prompt('Copia el enlace del portal:', portalUrl);
          });
        } else {
          prompt('Copia el enlace del portal:', portalUrl);
        }
      };
    }


    // Configuración del Perfil de Jugador de Prueba (Modo Test)
    const selTestTeam = view.querySelector('#config-test-player-team');
    if (selTestTeam) {
      selTestTeam.onchange = () => {
        const teamId = selTestTeam.value;
        Store.ensureTestPlayer({
          teamId: teamId,
          assignedTeamIds: teamId === 'all' ? [] : [teamId]
        });
        const tm = Store.team(teamId);
        toast(t('testPlayerAssignedToast', 'Jugador de prueba asignado a {team}').replace('{team}', tm ? tm.name : t('allTeams', 'Todos los equipos')), 'success');
      };
    }

    const testPlayerPortalUrl = portalUrl + '?test_player=1';
    const btnOpenTestPlayer = view.querySelector('#btn-config-open-test-player');
    if (btnOpenTestPlayer) {
      btnOpenTestPlayer.onclick = () => {
        if (window.AndroidBridge && window.AndroidBridge.openCustomTab) {
          window.AndroidBridge.openCustomTab(testPlayerPortalUrl);
        } else {
          window.open(testPlayerPortalUrl, '_blank');
        }
      };
    }

    const btnCopyTestLink = view.querySelector('#btn-config-copy-test-link');
    if (btnCopyTestLink) {
      btnCopyTestLink.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(testPlayerPortalUrl).then(() => {
            toast(t('linkCopied', '¡Enlace copiado al portapapeles!'), 'success');
          }).catch(() => {
            prompt('Copia este enlace:', testPlayerPortalUrl);
          });
        } else {
          prompt('Copia este enlace:', testPlayerPortalUrl);
        }
      };
    }

    const btnResetPresence = view.querySelector('#btn-reset-test-presence');
    if (btnResetPresence) {
      btnResetPresence.onclick = async () => {
        if (!confirm(t('confirmResetTestPresence', '¿Desvincular los perfiles de prueba y devolver el estado de todos los jugadores a por defecto?'))) return;
        btnResetPresence.disabled = true;
        btnResetPresence.textContent = '...';
        try {
          if (window.Cloud && window.Cloud.resetAllPlayersPresence) {
            await window.Cloud.resetAllPlayersPresence();
          }
          window._globalPresenceMap = { coach: { isOnline: true } };
          toast(t('resetPresenceSuccess', 'Perfiles de prueba desvinculados correctamente'), 'success');
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        } finally {
          btnResetPresence.disabled = false;
          btnResetPresence.textContent = '🔄 ' + t('resetTestPlayerLinks', 'Desvincular perfiles de prueba');
        }
      };
    }

    const btnForceWipe = view.querySelector('#btn-force-players-cache-wipe');
    if (btnForceWipe) {
      btnForceWipe.onclick = () => {
        confirmDialog(
          '🧹 Forzar Borrado de Caché',
          '¿Deseas enviar una orden de actualización inmediata a todos los jugadores? Al abrir la app o PWA verán una alerta para reiniciar la app y se borrará automáticamente la caché para cargar la última versión.',
          () => {
            Store.state.settings = Store.state.settings || {};
            Store.state.settings.forceCachePurgeTimestamp = Date.now();
            Store.save();
            if (window.Cloud && window.Cloud.pushCoachState) {
              window.Cloud.pushCoachState(Store.state, true);
            }
            toast('🚀 Orden de borrado de caché enviada a todos los jugadores', 'success');
            haptic(35);
          },
          'Forzar Reinicio',
          'warning'
        );
      };
    }

    view.querySelector('#btn-export-backup').onclick = () => IO.exportBackup();
    view.querySelector('#btn-restore-backup').onclick = () => showImportModal();
    view.querySelector('#btn-export-all-csv').onclick = () => IO.exportStatsCSV();

    view.querySelector('#btn-reset-all').onclick = () => {
      confirmDialog(t('resetAll'), t('resetAllDesc'), () => {
        localStorage.clear();
        location.reload();
      });
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.openLocationInMaps = function (query) {
    if (!query) return;
    if (window.AndroidBridge && window.AndroidBridge.openMaps) {
      try {
        window.AndroidBridge.openMaps(query);
        return;
      } catch (e) {
        console.error('Error abriendo mapa nativo:', e);
      }
    }
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
    window.open(url, '_blank');
  };

  window.__showCoachProfile = function () {
    showEditCoachProfileModal();
  };

  window.__showPlayerProfile = function (playerId) {
    if (playerId) showPlayerProfileModal(playerId);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

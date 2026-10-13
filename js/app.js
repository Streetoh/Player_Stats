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

  let currentTab = 'home';
  let activeSessionId = null;
  let timerInterval = null;
  let statsFilterType = 'all';
  let statsFilterPeriod = 'all';
  let statsSelectedPlayerId = 'all';
  let playerListSearch = '';
  let playerListTeam = 'all';

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
      const isExpanded = sheet.classList.toggle('expanded');
      if (expandBtn) expandBtn.textContent = isExpanded ? '⤡' : '⤢';
      haptic(20);
    }

    if (expandBtn) expandBtn.onclick = toggleExpand;

    // Arrastrar / deslizar hacia arriba para expandir la ventana
    const handleEl = sheet.querySelector('.sheet-handle');
    const headEl = sheet.querySelector('.sheet-head');
    let touchStartY = 0;
    let touchMoveY = 0;

    [handleEl, headEl].forEach(target => {
      if (!target) return;
      target.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          touchStartY = e.touches[0].clientY;
          touchMoveY = touchStartY;
        }
      }, { passive: true });

      target.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          touchMoveY = e.touches[0].clientY;
        }
      }, { passive: true });

      target.addEventListener('touchend', () => {
        const diff = touchStartY - touchMoveY;
        if (diff > 45) {
          // Deslizado hacia arriba -> expandir ventana al máximo
          if (!sheet.classList.contains('expanded')) {
            toggleExpand();
          }
        } else if (diff < -65) {
          // Deslizado hacia abajo -> contraer si estaba expandida, o cerrar si no
          if (sheet.classList.contains('expanded')) {
            toggleExpand();
          } else {
            handleClose();
          }
        }
      }, { passive: true });
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

  function openDatePicker(initialDate, onSelect) {
    const iso = parseInputDateToIso(initialDate);
    openCalendarModal(iso, onSelect);
  }

  function openCalendarModal(initialDate, onSelect) {
    const iso = parseInputDateToIso(initialDate);
    let curYear, curMonth, curDay;
    if (iso && iso.includes('-')) {
      const parts = iso.split('-');
      curYear = parseInt(parts[0], 10) || 2026;
      curMonth = (parseInt(parts[1], 10) || 1) - 1;
      curDay = parseInt(parts[2], 10) || 1;
    } else {
      const now = new Date();
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

      overlay.innerHTML = `
        <div class="calendar-modal">
          <div class="calendar-header">
            <button type="button" class="calendar-nav-btn" id="cal-prev" title="Mes anterior">‹</button>
            <div class="calendar-title">
              <span>${monthNames[viewMonth]} ${viewYear}</span>
            </div>
            <button type="button" class="calendar-nav-btn" id="cal-next" title="Mes siguiente">›</button>
          </div>

          <div class="calendar-weekdays">
            ${weekdays.map(w => `<div class="calendar-weekday">${w}</div>`).join('')}
          </div>

          <div class="calendar-days-grid" id="cal-days-grid">
            ${daysHtml}
          </div>

          <div class="calendar-shortcuts">
            <button type="button" class="calendar-shortcut-btn" id="cal-btn-today">⚡ ${isEn ? 'Today' : 'Hoy'}</button>
            <button type="button" class="calendar-shortcut-btn" id="cal-btn-tomorrow">⏩ ${isEn ? 'Tomorrow' : 'Mañana'}</button>
            <button type="button" class="calendar-shortcut-btn" id="cal-btn-yesterday">⏪ ${isEn ? 'Yesterday' : 'Ayer'}</button>
          </div>

          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button type="button" class="btn ghost block" id="cal-btn-cancel">${t('cancel', 'Cancelar')}</button>
          </div>
        </div>
      `;

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

      overlay.querySelector('#cal-btn-today').onclick = (e) => {
        e.stopPropagation();
        const t = new Date();
        const isoStr = String(t.getFullYear()) + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
        finish(isoStr);
      };

      overlay.querySelector('#cal-btn-tomorrow').onclick = (e) => {
        e.stopPropagation();
        const t = new Date();
        t.setDate(t.getDate() + 1);
        const isoStr = String(t.getFullYear()) + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
        finish(isoStr);
      };

      overlay.querySelector('#cal-btn-yesterday').onclick = (e) => {
        e.stopPropagation();
        const t = new Date();
        t.setDate(t.getDate() - 1);
        const isoStr = String(t.getFullYear()) + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
        finish(isoStr);
      };

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
    if (player.photo) {
      return `<div class="${cls}"><img src="${player.photo}" alt="" loading="lazy" />${dorsalHtml}</div>`;
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
  const NotifManager = {
    getAll() {
      try {
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
      updateRequestsBadge();
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
      let list = this.getAll();
      list = list.filter(n => n.id !== id && n.targetId !== id);
      this.save(list);
    },
    removeByTarget(targetId) {
      if (!targetId) return;
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
      this.save([]);
    },
    getUnreadCount() {
      return this.getAll().filter(n => !n.read).length;
    }
  };

  window.NotifManager = NotifManager;

  // Compatibilidad universal e inmediata para llamadas Sync.push()
  window.Sync = {
    push: function () {
      if (window.Cloud && window.Cloud.pushCoachState && window.Store) {
        window.Cloud.pushCoachState(window.Store.state, true);
      }
    }
  };

  let pendingProfileRequests = [];
  let knownProfileRequestIds = new Set();
  let isFirstRequestsSnapshot = true;

  let pendingPlayerCreationRequests = [];
  let knownPlayerCreationRequestIds = new Set();
  let isFirstCreationRequestsSnapshot = true;

  let pendingProfileClaimRequests = [];
  let knownProfileClaimRequestIds = new Set();
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

    if (!isFirstRequestsSnapshot) {
      requests.forEach(r => {
        if (!knownProfileRequestIds.has(r.id)) {
          const reqPlayerName = r.toPlayerName || 'Jugador';
          toast(`🔔 ${t('newProfileRequest', 'Nueva solicitud de cambio de perfil')}: ${reqPlayerName}`, 'info', () => showNotificationsCenterModal());
          haptic(50);
          if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
            try { window.AndroidBridge.showSystemNotification('Player Stats', `Nueva solicitud de perfil: ${reqPlayerName}`); } catch(e) {}
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Player Stats', { body: `Nueva solicitud de perfil: ${reqPlayerName}`, icon: 'icons/icon-192.png' }); } catch(e) {}
          }
        }
      });
    }
    isFirstRequestsSnapshot = false;
    knownProfileRequestIds = new Set((requests || []).map(r => r.id));
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

    if (!isFirstCreationRequestsSnapshot) {
      requests.forEach(r => {
        if (!knownPlayerCreationRequestIds.has(r.id)) {
          const reqPlayerName = r.name || 'Nuevo Jugador';
          toast(`➕ ${t('requestCoachProfileTitle', 'Solicitud de alta de jugador')}: ${reqPlayerName}`, 'info', () => showNotificationsCenterModal());
          haptic(50);
          if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
            try { window.AndroidBridge.showSystemNotification('Player Stats', `Solicitud de alta: ${reqPlayerName}`); } catch(e) {}
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Player Stats', { body: `Solicitud de alta: ${reqPlayerName}`, icon: 'icons/icon-192.png' }); } catch(e) {}
          }
        }
      });
    }
    isFirstCreationRequestsSnapshot = false;
    knownPlayerCreationRequestIds = new Set((requests || []).map(r => r.id));
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
      NotifManager.add({
        id: 'claim_' + cl.id,
        type: 'claim_req',
        title: t('profileClaimRequestTitle', '🔐 Solicitud de acceso a perfil'),
        body: `${cl.targetPlayerName || 'Jugador'} • ${t('securityCodeTitle', 'Código')}: ${cl.securityCode}`,
        targetId: cl.id,
        time: cl.createdAt || Date.now()
      });
    });

    updateRequestsBadge();

    if (!isFirstClaimRequestsSnapshot) {
      dedupedRequests.forEach(r => {
        if (!knownProfileClaimRequestIds.has(r.id)) {
          const reqPlayerName = r.targetPlayerName || 'Jugador';
          toast(`🔐 Acceso: ${reqPlayerName} (Código ${r.securityCode})`, 'info', () => showNotificationsCenterModal());
          haptic(50);
          if (window.AndroidBridge && window.AndroidBridge.showSystemNotification) {
            try { window.AndroidBridge.showSystemNotification('Player Stats', `Solicitud de acceso: ${reqPlayerName} (Código ${r.securityCode})`); } catch (e) {}
          } else if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Player Stats', { body: `Solicitud de acceso: ${reqPlayerName} (Código ${r.securityCode})`, icon: 'icons/icon-192.png' }); } catch (e) {}
          }
        }
      });
    }
    isFirstClaimRequestsSnapshot = false;
    knownProfileClaimRequestIds = new Set(dedupedRequests.map(r => r.id));
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
              ${curClaims.map(cl => `
                <div class="card" style="padding: 14px; border: 1.5px solid rgba(250, 204, 21, 0.5); border-radius: 14px; background: rgba(250, 204, 21, 0.08);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <b style="font-size: 14.5px; color: #fff;">👤 ${escapeHtml(cl.targetPlayerName || 'Jugador')}</b>
                    <span class="badge" style="background: rgba(250, 204, 21, 0.25); color: #fde047; font-size: 11px; font-weight: 900;">ACCESO</span>
                  </div>
                  <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
                    ${cl.targetPlayerDorsal != null ? `<span>#${escapeHtml(cl.targetPlayerDorsal)}</span> • ` : ''}
                    <span>${t('confirmPlayerIdentity', 'Confirmar identidad del jugador')}</span>
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
              `).join('')}
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
                return `
                <div class="card" style="padding: 12px; border: 1.5px solid rgba(34, 211, 238, 0.4); border-radius: 14px; background: rgba(34, 211, 238, 0.06);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div>
                      <b style="font-size: 14px; color: #fff;">👤 ${escapeHtml(displayName)}</b>
                      ${cr.name && cr.lastName ? `<div style="font-size: 11px; color: var(--muted);">${escapeHtml(cr.name)} / ${escapeHtml(cr.lastName)}</div>` : ''}
                    </div>
                    <span class="badge" style="background: rgba(34, 211, 238, 0.2); color: #38bdf8; font-size: 10px; font-weight: 800;">ALTA</span>
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
              if (window.Cloud && window.Cloud.resolveProfileClaimRequest) {
                await window.Cloud.resolveProfileClaimRequest(claimId, 'approved');
              }
              if (reqObj && reqObj.targetPlayerId) {
                const targetP = Store.player(reqObj.targetPlayerId);
                if (targetP && targetP.unlinkedAt) {
                  delete targetP.unlinkedAt;
                  Store.save();
                  if (window.Cloud && window.Cloud.pushCoachState) {
                    window.Cloud.pushCoachState(Store.state, true);
                  }
                }
                if (window.Cloud && window.Cloud.clearPlayerUnlink) {
                  await window.Cloud.clearPlayerUnlink(reqObj.targetPlayerId);
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
    openSheet(t('notificationCenter', 'Centro de Notificaciones'), (body) => {
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
                  <div class="notif-card" data-nid="${n.id}" data-target="${n.targetId || ''}" data-type="${n.type}" style="background: ${n.read ? 'var(--surface)' : 'rgba(34, 211, 238, 0.08)'}; border: 1.5px solid ${n.read ? 'var(--border)' : 'rgba(34, 211, 238, 0.4)'}; border-radius: 12px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; cursor: pointer; position: relative;">
                    <span style="font-size: 20px; line-height: 1; flex-shrink: 0; margin-top: 2px;">${ic}</span>
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <b style="font-size: 13px; color: ${n.read ? '#cbd5e1' : '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${escapeHtml(n.title)}
                        </b>
                        <span style="font-size: 10.5px; color: var(--muted); margin-left: 6px; flex-shrink: 0;">${dateStr}</span>
                      </div>
                      <div style="font-size: 12px; color: ${n.read ? 'var(--muted)' : '#e2e8f0'}; line-height: 1.35; word-break: break-word;">
                        ${escapeHtml(n.body)}
                      </div>
                    </div>
                    <button type="button" class="icon-btn ghost" data-delete-nid="${n.id}" style="width: 28px; height: 28px; color: var(--muted); flex-shrink: 0; margin-left: 2px;" title="Eliminar">
                      🗑️
                    </button>
                    ${!n.read ? `
                      <span style="position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 6px #22d3ee;"></span>
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
            renderNotifs();
          };
        }

        const btnClearAll = body.querySelector('#btn-notif-clear-all');
        if (btnClearAll) {
          btnClearAll.onclick = () => {
            NotifManager.clearAll();
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
            renderNotifs();
          };
        });

        body.querySelectorAll('.notif-card').forEach(card => {
          card.onclick = () => {
            const nid = card.getAttribute('data-nid');
            const targetId = card.getAttribute('data-target');
            const type = card.getAttribute('data-type');
            NotifManager.markAsRead(nid);

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
    });
  }

  function renderLangButton() {
    const cur = I18N.getLang();
    return `
      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="icon-btn" id="btn-toggle-lang" title="${t('appLanguage')}">
          <span style="font-size: 13px; font-weight: 900; letter-spacing: 0.5px;">${cur.toUpperCase()}</span>
        </button>
      </div>
    `;
  }

  function toggleLanguage() {
    const next = I18N.getLang() === 'es' ? 'en' : 'es';
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
  const _coachAppBootTime = Date.now();

  window.onPlayerAttendanceResponse = function (resp, isInitialSync = false) {
    if (!resp) return;
    if (isInitialSync) return; // NUNCA mostrar toasts durante la sincronización inicial
    if (Date.now() - _coachAppBootTime < 4000) return; // Silencio de arranque de 4s para evitar toasts al entrar a la app

    const isPending = (resp.status === 'pending' || !resp.status);
    const p = Store.player(resp.playerId);
    const pName = resp.playerName || (p ? Store.playerName(p) : 'Jugador');

    if (isPending) {
      if (currentTab === 'convocations') navigate('convocations');
      if (typeof window.activeConvocationModalRefresh === 'function') window.activeConvocationModalRefresh();
      updateRequestsBadge();
      return;
    }

    const dedupKey = `${resp.convId || ''}_${resp.playerId || ''}_${resp.status || ''}`;
    const now = Date.now();
    if (_attendanceToastDedup.has(dedupKey) && (now - _attendanceToastDedup.get(dedupKey) < 8000)) {
      return; // Evitar toast duplicado
    }
    _attendanceToastDedup.set(dedupKey, now);

    const isAttending = (resp.status === 'called' || resp.status === 'attending' || resp.status === 'yes');

    NotifManager.add({
      id: 'att_' + (resp.convId || 'c') + '_' + resp.playerId,
      type: 'attendance',
      title: isAttending ? `🟢 Asistencia confirmada` : `❌ Baja comunicada`,
      body: `${pName} (${isAttending ? 'Asistirá' : 'No asistirá'})`,
      targetId: resp.convId || null,
      time: Date.now()
    });

    toast(
      isAttending ? `🟢 ${pName} ha confirmado asistencia` : `❌ ${pName} no puede asistir`,
      isAttending ? 'success' : 'info'
    );
    haptic(35);

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
      if (window.ChatUI && window.ChatUI.initPresenceHeartbeat) {
        window.ChatUI.initPresenceHeartbeat('coach', 'Entrenador');
      }
      if (window.ChatUI && window.ChatUI.initGlobalUnreadListener) {
        window.ChatUI.initGlobalUnreadListener('coach');
      }
      if (window.Cloud.listenToAllPresence) {
        window._presenceListenerRegistered = true;
        window.Cloud.listenToAllPresence((map) => {
          window._globalPresenceMap = map;
          if (typeof window._refreshPlayersPresenceList === 'function') {
            window._refreshPlayersPresenceList();
          }
        });
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
          navigate('history');
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
      { id: 'history',      label: t('sessions'),     ic: 'calendar' },
      { id: 'players',      label: t('players'),      ic: 'users' },
      { id: 'convocations', label: t('convocations'), ic: 'clipboard' },
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
    currentTab = tab;
    renderTabbar();
    const view = document.getElementById('view');
    if (!view) return;
    view.className = 'anim';

    switch (tab) {
      case 'home':         renderHomeView(view); break;
      case 'history':      renderHistoryView(view); break;
      case 'players':      renderPlayersView(view); break;
      case 'convocations': renderConvocationsView(view); break;
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
    const pendingReqsCount = (pendingProfileRequests || []).length + (pendingPlayerCreationRequests || []).length + (pendingProfileClaimRequests || []).length;
    const totalCount = Math.max(NotifManager.getUnreadCount(), pendingReqsCount);

    return `
      <div class="card" style="margin-bottom: 16px; border: 1.5px solid ${totalCount > 0 ? 'rgba(34, 211, 238, 0.4)' : 'var(--border)'}; background: ${totalCount > 0 ? 'rgba(34, 211, 238, 0.04)' : 'var(--surface)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🔔</span>
            <b style="font-size: 14px; color: #fff;">${t('notificationCenter', 'Centro de Notificaciones')}</b>
            ${totalCount > 0 ? `<span class="badge" style="background: #ef4444; color: #fff; font-size: 11px; font-weight: 900; padding: 2px 7px; border-radius: 999px;">${totalCount}</span>` : ''}
          </div>
          <div style="display: flex; gap: 6px;">
            ${pendingReqsCount > 0 ? `
              <button type="button" class="btn sm primary" id="btn-home-open-requests" style="font-size: 11.5px; padding: 4px 10px; font-weight: 800;">
                👥 ${t('requests', 'Solicitudes')} (${pendingReqsCount})
              </button>
            ` : ''}
            ${notifs.length > 0 ? `
              <button type="button" class="btn sm ghost" id="btn-home-notif-mark-all" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
                ✓ ${t('markAllRead', 'Leídas')}
              </button>
              <button type="button" class="btn sm danger ghost" id="btn-home-notif-clear-all" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>

        ${(notifs.length === 0 && pendingReqsCount === 0) ? `
          <div style="padding: 14px; text-align: center; color: var(--muted); font-size: 12.5px;">
            🎉 ¡Todo al día! No tienes notificaciones ni solicitudes pendientes.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding: 2px;">
            ${notifs.slice(0, 10).map(n => {
              let ic = '🔔';
              if (n.type === 'profile_req') ic = '🔄';
              else if (n.type === 'creation_req') ic = '➕';
              else if (n.type === 'claim_req') ic = '🔑';
              else if (n.type === 'attendance') ic = (n.title && n.title.includes('🟢')) ? '🟢' : '❌';
              else if (n.type === 'chat') ic = '💬';

              const dateStr = n.time ? new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              return `
                <div class="home-notif-item" data-nid="${n.id}" data-target="${n.targetId || ''}" data-type="${n.type}" style="background: ${n.read ? 'var(--surface2)' : 'rgba(34, 211, 238, 0.1)'}; border: 1px solid ${n.read ? 'var(--border)' : 'rgba(34, 211, 238, 0.45)'}; border-radius: 10px; padding: 8px 10px; display: flex; align-items: flex-start; gap: 8px; cursor: pointer; position: relative;">
                  <span style="font-size: 16px; line-height: 1; flex-shrink: 0; margin-top: 2px;">${ic}</span>
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <b style="font-size: 12.5px; color: ${n.read ? '#cbd5e1' : '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml(n.title)}
                      </b>
                      <span style="font-size: 10px; color: var(--muted); margin-left: 6px; flex-shrink: 0;">${dateStr}</span>
                    </div>
                    <div style="font-size: 11.5px; color: ${n.read ? 'var(--muted)' : '#e2e8f0'}; line-height: 1.3; word-break: break-word;">
                      ${escapeHtml(n.body)}
                    </div>
                  </div>
                  <button type="button" class="icon-btn ghost" data-home-delete-nid="${n.id}" style="width: 24px; height: 24px; font-size: 11px; color: var(--muted); flex-shrink: 0;" title="Eliminar">✕</button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  function bindHomeNotificationsEvents(container) {
    if (!container) return;

    const btnHomeReqs = container.querySelector('#btn-home-open-requests');
    if (btnHomeReqs) btnHomeReqs.onclick = () => showProfileRequestsModal();

    const btnHomeMarkAll = container.querySelector('#btn-home-notif-mark-all');
    if (btnHomeMarkAll) {
      btnHomeMarkAll.onclick = () => {
        NotifManager.markAllAsRead();
        refreshHomeNotifications();
      };
    }

    const btnHomeClearAll = container.querySelector('#btn-home-notif-clear-all');
    if (btnHomeClearAll) {
      btnHomeClearAll.onclick = () => {
        NotifManager.clearAll();
        refreshHomeNotifications();
      };
    }

    container.querySelectorAll('[data-home-delete-nid]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const nid = b.getAttribute('data-home-delete-nid');
        NotifManager.remove(nid);
        refreshHomeNotifications();
      };
    });

    container.querySelectorAll('.home-notif-item').forEach(card => {
      card.onclick = () => {
        const nid = card.getAttribute('data-nid');
        const type = card.getAttribute('data-type');
        const targetId = card.getAttribute('data-target');
        NotifManager.markAsRead(nid);

        if (type === 'profile_req' || type === 'creation_req' || type === 'claim_req') {
          showProfileRequestsModal();
        } else if (type === 'attendance' && targetId) {
          const conv = Store.convocation(targetId);
          if (conv) showConvocationDetailsModal(conv);
          else refreshHomeNotifications();
        } else if (type === 'chat' && targetId) {
          if (typeof window.openChatModal === 'function') {
            window.openChatModal(targetId);
          } else {
            navigate('chat');
          }
        } else {
          refreshHomeNotifications();
        }
      };
    });
  }

  let _refreshHomeNotifTimer = null;
  function refreshHomeNotifications() {
    if (currentTab !== 'home') return;
    if (_refreshHomeNotifTimer) cancelAnimationFrame(_refreshHomeNotifTimer);
    _refreshHomeNotifTimer = requestAnimationFrame(() => {
      const container = document.getElementById('home-notifications-container');
      if (!container) return;
      container.innerHTML = renderHomeNotificationsHtml();
      bindHomeNotificationsEvents(container);
    });
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
    if (window.Store && window.Store.autoCreateTodayScheduledSessions) {
      window.Store.autoCreateTodayScheduledSessions();
    }
    const totalPlayers = Store.state.players.length;
    const totalTrainings = Store.state.sessions.filter(s => s.type === 'training').length;
    const totalMatches = Store.state.sessions.filter(s => s.type === 'match').length;
    const recent = Store.state.sessions.slice(0, 4);

    let html = `
      <div class="topbar">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="icons/club-logo.png" style="width: 38px; height: 38px; object-fit: contain; border-radius: 50%;" alt="Club Logo" onerror="this.style.display='none'">
          <div>
            <h1>${t('appName')}</h1>
            <span class="sub">${t('appSubtitle')}</span>
          </div>
        </div>
        ${renderLangButton()}
      </div>

      <!-- Notificaciones y Solicitudes en Inicio -->
      <div id="home-notifications-container">
        ${renderHomeNotificationsHtml()}
      </div>

      <div class="quick-stats">
        <div class="qs">
          <b>${totalPlayers}</b>
          <span>${t('players')}</span>
        </div>
        <div class="qs">
          <b style="color: var(--train);">${totalTrainings}</b>
          <span>${t('training')}</span>
        </div>
        <div class="qs">
          <b style="color: var(--match);">${totalMatches}</b>
          <span>${t('match')}</span>
        </div>
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

      <div id="recent-sessions-list">
        ${recent.length === 0 ? `
          <div class="empty">
            <div class="big">📋</div>
            <h3>${t('noSessionsYet')}</h3>
            <p>${t('noSessionsDesc')}</p>
          </div>
        ` : recent.map(s => renderSessionItemHtml(s)).join('')}
      </div>
    `;

    view.innerHTML = html;

    const btnLang = view.querySelector('#btn-toggle-lang');
    if (btnLang) btnLang.onclick = toggleLanguage;

    view.querySelector('#btn-see-all-sessions').onclick = () => navigate('history');

    bindHomeNotificationsEvents(view.querySelector('#home-notifications-container'));

    const btnImp = view.querySelector('#btn-home-import');
    if (btnImp) btnImp.onclick = () => showImportModal();

    view.querySelectorAll('.session-item').forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute('data-id');
        openTracker(id);
      };
    });
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

    if (s.type === 'match') {
      let teamObj = s.teamId ? Store.team(s.teamId) : null;
      if (!teamObj && pids.length > 0) {
        for (const pid of pids) {
          const pl = Store.player(pid);
          if (pl && pl.teamId) { teamObj = Store.team(pl.teamId); break; }
        }
      }
      if (!teamObj && Store.state.teams && Store.state.teams.length > 0) {
        teamObj = Store.state.teams[0];
      }
      const myTeamName = teamObj ? teamObj.name : 'Mi Equipo';
      const myTeamColor = teamObj ? (teamObj.color || '#22c55e') : '#22c55e';
      const rivalName = s.rival || (s.title ? s.title : t('rivalTeam', 'Rival'));
      const homeScore = (s.score && s.score.home != null) ? s.score.home : 0;
      const awayScore = (s.score && s.score.away != null) ? s.score.away : 0;

      return `
        <div class="session-item match ${isLive ? 'live' : ''}" data-id="${s.id}">
          <div class="grow" style="min-width: 0;">
            <div class="match-teams-bar">
              <span class="team-bubble-pill" style="border-color: ${myTeamColor}; background: ${myTeamColor}24; color: ${myTeamColor};" title="${escapeHtml(myTeamName)}">
                🛡️ ${escapeHtml(myTeamName)}
              </span>
              <div class="score-pill-horiz">
                <span>${homeScore}</span>
                <span style="opacity: 0.55; font-size: 13px;">-</span>
                <span>${awayScore}</span>
              </div>
              <span class="rival-bubble-pill" title="${escapeHtml(rivalName)}">
                ⚔️ ${escapeHtml(rivalName)}
              </span>
            </div>
            <div class="meta" style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
              <span>📅 ${formatDateDDMMAAAA(s.date)}</span>
              <span>•</span>
              <span>⏱️ ${Store.fmtTime(Store.elapsed(s), s)}</span>
              ${isLive ? `<span class="badge live">${t('live')}</span>` : `<span class="badge match" style="font-size: 10px; padding: 2px 6px;">${typeLabel}</span>`}
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

    return `
      <div class="session-item training ${isLive ? 'live' : ''}" data-id="${s.id}">
        <div class="s-ic">${emoji}</div>
        <div class="grow">
          <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; min-width: 0;">
              <h4 class="ellipsis" style="margin: 0;">${escapeHtml(Store.sessionTitle(s))}</h4>
            </div>
            ${isLive ? `<span class="badge live">${t('live')}</span>` : `<span class="badge training">${typeLabel}</span>`}
          </div>
          <div class="meta">
            <span>📅 ${formatDateDDMMAAAA(s.date)}</span>
            <span>•</span>
            <span>${totalActions} ${t('actions')}</span>
            <span>•</span>
            <span>⏱️ ${Store.fmtTime(Store.elapsed(s), s)}</span>
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

          const autoTitle = title || (selectedType === 'match' ? (rival ? 'vs ' + rival : t('match', 'Partido')) : t('training', 'Entrenamiento'));
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
  }

  function closeTracker() {
    stopTimerTicker();
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

  function renderTracker() {
    const trackerEl = document.getElementById('tracker-fullscreen');
    if (!trackerEl) return;
    const s = Store.session(activeSessionId);
    if (!s) { closeTracker(); return; }

    const isLive = s.timerStartedAt != null;
    const slots = s.slots || [null, null];
    const playerA = slots[0] ? Store.player(slots[0]) : null;
    const playerB = slots[1] ? Store.player(slots[1]) : null;
    const singleMode = !playerB && playerA;

    trackerEl.className = 'tracker ' + (singleMode ? 'single' : '');

    trackerEl.innerHTML = `
      <!-- SLOT 0: JUGADOR SUPERIOR -->
      ${renderSlotPanel(s, 0, playerA)}

      <!-- BARRA CENTRAL DE CONTROL (2 FILAS ORDENADAS) -->
      <div class="t-bar">
        <div class="t-bar-top">
          <button class="icon-btn ghost" id="tracker-btn-back" title="Volver">${icon('back', 18)}</button>
          <div class="t-title">
            <b>${escapeHtml(Store.sessionTitle(s))}</b>
            <span class="badge ${s.type}">${s.type === 'match' ? t('match').toUpperCase() : t('training').toUpperCase()}</span>
          </div>

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
    };

    container.querySelector('#tracker-btn-back').onclick = () => {
      closeTracker();
    };

    container.querySelector('#tracker-btn-swap').onclick = () => {
      const slots = session.slots || [null, null];
      session.slots = [slots[1], slots[0]];
      Store.save();
      haptic(40);
      renderTracker();
    };

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
    };

    const btnShp = container.querySelector('#btn-score-home-p');
    if (btnShp) btnShp.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.home = (session.score.home || 0) + 1;
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(25);
      updateScoreUI();
    };

    const btnSam = container.querySelector('#btn-score-away-m');
    if (btnSam) btnSam.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.away = Math.max(0, (session.score.away || 0) - 1);
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(20);
      updateScoreUI();
    };

    const btnSap = container.querySelector('#btn-score-away-p');
    if (btnSap) btnSap.onclick = () => {
      session.score = session.score || { home: 0, away: 0 };
      session.score.away = (session.score.away || 0) + 1;
      Store.updateScore(session.id, session.score.home, session.score.away);
      if (window.SyncEngine && SyncEngine.isLive()) SyncEngine.sendScore(session.id, session.score.home, session.score.away);
      haptic(25);
      updateScoreUI();
    };

    // Periodo (1T, Descanso, 2T...)
    const btnPeriod = container.querySelector('#btn-period-picker');
    if (btnPeriod) btnPeriod.onclick = () => showPeriodPickerModal(session);

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
          Store.save();
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
          const entry = Store.undo(session.id, playerId);
          if (entry) {
            if (window.SyncEngine && SyncEngine.isLive()) {
              SyncEngine.sendUndo(session.id, playerId);
            }
            haptic(50);
            renderTracker();
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

  /* =========================================================
     MODAL DE CONFIGURACIÓN DE BOTONES EN PANTALLA
     ========================================================= */
  function showCustomizeSessionButtonsModal(session) {
    let currentEnabled = (session.enabledStats && session.enabledStats.length)
      ? session.enabledStats.slice()
      : Store.state.settings.enabledStats.slice();

    openSheet(t('customizeButtons'), (body) => {
      body.innerHTML = `
        <p class="hint" style="margin-bottom: 12px;">${t('selectButtonsForView')}</p>

        <!-- Presets a 1 toque -->
        <div class="segmented" style="margin-bottom: 14px;">
          <button type="button" id="pst-all">${t('presetAll')}</button>
          <button type="button" id="pst-tp">Toques & Pases</button>
          <button type="button" id="pst-shots">Solo Tiros</button>
        </div>

        <div class="card" style="max-height: 50vh; overflow-y: auto;">
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

      function syncSwitches() {
        body.querySelectorAll('[data-custom-stat]').forEach(sw => {
          const k = sw.getAttribute('data-custom-stat');
          sw.classList.toggle('on', currentEnabled.includes(k));
        });
      }

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
        // Orden canónico estricto
        const sorted = Store.getSortedStats(currentEnabled).map(s => s.key);
        Store.setSessionStats(session, sorted);
        closeSheet();
        haptic(30);
        renderTracker();
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
    const defaultTeamFilter = sessionTeams.length > 1 ? sessionTeams : (sessionTeams[0] || 'all');

    let players = Store.sortedPlayers(defaultTeamFilter);

    openSheet(t('selectPlayer'), (body) => {
      body.innerHTML = `
        <div class="search" style="margin-bottom: 12px;">
          <input type="text" id="picker-search-input" placeholder="${t('searchPlayerPlaceholder')}" />
          ${icon('search', 18)}
        </div>

        <div class="chips" id="picker-team-chips" style="margin-bottom: 14px;">
          ${sessionTeams.length > 1 ? `
            <button class="chip active" data-team="session_teams">🛡️ Equipos sesión (${sessionTeams.length})</button>
          ` : ''}
          <button class="chip ${sessionTeams.length <= 1 && defaultTeamFilter === 'all' ? 'active' : ''}" data-team="all">${t('all')}</button>
          ${Store.state.teams.map(t => `
            <button class="chip ${sessionTeams.length <= 1 && defaultTeamFilter === t.id ? 'active' : ''}" data-team="${t.id}">
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
        let list = Store.sortedPlayers(currentFilterTeam);
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
          const qrData = 'https://streetoh.github.io/Player_Stats/?join=' + roomCode;
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
              <div style="background: #fff; padding: 12px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); display: inline-block;">
                ${qrSvg}
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

  /* Modal de selección visual de jugador con foto y buscador */
  function showPlayerPickerModal(currentPlayerId, onSelect) {
    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const allPlayers = Store.sortedPlayers();
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';

    dialog.innerHTML = `
      <div class="dialog-box" style="max-width: 400px; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">${isEn ? 'Select Player' : 'Seleccionar Jugador'}</h3>
          <button type="button" class="icon-btn ghost" id="picker-close-x" style="width: 32px; height: 32px;">${icon('x', 18)}</button>
        </div>

        <div style="margin-bottom: 12px;">
          <input type="text" id="picker-search-input" placeholder="${isEn ? 'Search by name or number...' : 'Buscar por nombre o dorsal...'}" style="width: 100%; padding: 10px 14px; font-size: 13.5px; border-radius: 12px;" autofocus autocomplete="off" />
        </div>

        <div class="player-picker-grid" id="picker-grid-list">
          ${allPlayers.map(p => {
            const team = Store.team(p.teamId);
            const isSelected = p.id === currentPlayerId;
            return `
              <div class="player-picker-card" data-pid="${p.id}" style="${isSelected ? 'border-color: var(--cyan); background: rgba(34, 211, 238, 0.12);' : ''}">
                ${renderAvatar(p, 'sm')}
                <div class="grow ellipsis">
                  <b style="font-size: 13px; color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p, true))}</b>
                  <small style="display: block; color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}${team ? ' • ' + escapeHtml(team.shortName || team.name) : ''}</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const searchInput = dialog.querySelector('#picker-search-input');
    const cards = dialog.querySelectorAll('.player-picker-card');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      cards.forEach(card => {
        const pid = card.getAttribute('data-pid');
        const p = Store.player(pid);
        const name = p ? Store.playerName(p).toLowerCase() : '';
        const dorsal = p && p.mainDorsal != null ? String(p.mainDorsal) : '';
        if (!q || name.includes(q) || dorsal.includes(q)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });

    cards.forEach(card => {
      card.onclick = () => {
        const pid = card.getAttribute('data-pid');
        dialog.remove();
        if (typeof onSelect === 'function') onSelect(pid);
      };
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
  function renderPlayerPitchHeatmapHtml(playerId) {
    const sessions = Store.state.sessions || [];
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
          <span style="font-size: 11px; font-weight: 900;">${cntTopL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_l')}</span>
          ${getZoneBadgeHtml(cntTopL, zoneActionsMap.top_l)}
        </div>
        <div class="pitch-grid-cell pz-top-c ${cntTopC > 0 ? 'has-actions' : ''}" style="grid-area: top_c; background: ${getHeatBg(cntTopC)}; border-color: rgba(239, 68, 68, 0.8); cursor: pointer;" data-zone-name="${t('zone_box_opp', 'Área Rival')}" data-zone-count="${cntTopC}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_c)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🥅</span>
          <span style="font-size: 12px; font-weight: 900; color: #fde047;">${cntTopC}</span>
          <span style="font-size: 9px; opacity: 0.9;">${t('zone_box_opp')}</span>
          ${getZoneBadgeHtml(cntTopC, zoneActionsMap.top_c)}
        </div>
        <div class="pitch-grid-cell pz-top-r ${cntTopR > 0 ? 'has-actions' : ''}" style="grid-area: top_r; background: ${getHeatBg(cntTopR)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_r', 'Banda Ofensiva Derecha')}" data-zone-count="${cntTopR}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">↗️</span>
          <span style="font-size: 11px; font-weight: 900;">${cntTopR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_r')}</span>
          ${getZoneBadgeHtml(cntTopR, zoneActionsMap.top_r)}
        </div>

        <!-- Fila 2-3: Bandas unidas laterales -->
        <div class="pitch-grid-cell pz-wing-l ${cntWingL > 0 ? 'has-actions' : ''}" style="grid-area: wing_l; background: ${getHeatBg(cntWingL)}; cursor: pointer;" data-zone-name="${t('zone_wing_l', 'Banda Izquierda')}" data-zone-count="${cntWingL}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_l)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⬅️</span>
          <span style="font-size: 12px; font-weight: 900;">${cntWingL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_l')}</span>
          ${getZoneBadgeHtml(cntWingL, zoneActionsMap.wing_l)}
        </div>

        <!-- Fila 2 Centro: Frontal del Área -->
        <div class="pitch-grid-cell pz-mid-t ${cntMidT > 0 ? 'has-actions' : ''}" style="grid-area: mid_t; background: ${getHeatBg(cntMidT)}; cursor: pointer;" data-zone-name="${t('zone_front', 'Frontal del Área')}" data-zone-count="${cntMidT}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_t)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🎯</span>
          <span style="font-size: 11.5px; font-weight: 900;">${cntMidT}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_front')}</span>
          ${getZoneBadgeHtml(cntMidT, zoneActionsMap.mid_t)}
        </div>

        <div class="pitch-grid-cell pz-wing-r ${cntWingR > 0 ? 'has-actions' : ''}" style="grid-area: wing_r; background: ${getHeatBg(cntWingR)}; cursor: pointer;" data-zone-name="${t('zone_wing_r', 'Banda Derecha')}" data-zone-count="${cntWingR}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">➡️</span>
          <span style="font-size: 12px; font-weight: 900;">${cntWingR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_r')}</span>
          ${getZoneBadgeHtml(cntWingR, zoneActionsMap.wing_r)}
        </div>

        <!-- Fila 3 Centro: Centro del Campo -->
        <div class="pitch-grid-cell pz-mid-b ${cntMidB > 0 ? 'has-actions' : ''}" style="grid-area: mid_b; background: ${getHeatBg(cntMidB)}; cursor: pointer;" data-zone-name="${t('zone_mid', 'Centro del Campo')}" data-zone-count="${cntMidB}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_b)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⚽</span>
          <span style="font-size: 11.5px; font-weight: 900;">${cntMidB}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_mid')}</span>
          ${getZoneBadgeHtml(cntMidB, zoneActionsMap.mid_b)}
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

            <div class="h2h-header">
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

            <!-- Métricas comparativas -->
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
                      <span style="color: ${p2Wins ? '#22c55e' : 'var(--text)'}; font-weight: ${p2Wins ? '900' : '700'};">
                        ${p2Wins ? '👑' : ''} ${v2}${m.suffix}
                      </span>
                    </div>
                    <div class="h2h-bars">
                      <div class="h2h-bar-p1" style="width: ${pct1}%;"></div>
                      <div class="h2h-bar-p2" style="width: ${pct2}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

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
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <button class="btn btn-social" id="btn-share-wa" style="background: #16a34a; color: #fff; border-color: #22c55e;">
              ${icon('whatsapp', 18)} WhatsApp
            </button>
            <button class="btn btn-social" id="btn-share-tg" style="background: #0284c7; color: #fff; border-color: #38bdf8;">
              ${icon('send', 18)} Telegram
            </button>
            <button class="btn btn-social" id="btn-share-viber" style="background: #7c3aed; color: #fff; border-color: #a855f7;">
              💜 Viber
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
                window.open(`https://t.me/share/url?url=${encodeURIComponent('https://streetoh.github.io/Player_Stats/')}&text=${encodeURIComponent(shareText)}`, '_blank');
              } else if (targetApp === 'viber') {
                window.open(`viber://forward?text=${encodeURIComponent(shareText)}`, '_blank');
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
          body.querySelector('#btn-share-viber').onclick = () => handleSocialShare('viber');
          body.querySelector('#btn-share-all').onclick = () => handleSocialShare('all');
          body.querySelector('#btn-share-guide').onclick = () => showSkillGuideModal();
        };

        // Si el jugador tiene foto, cargarla como imagen HTML antes de pintar
        if (player.photo) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => renderCanvasContent(img);
          img.onerror = () => renderCanvasContent(null);
          img.src = player.photo;
        } else {
          renderCanvasContent(null);
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
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button class="btn btn-social" id="btn-guide-wa" style="background: #16a34a; color: #fff; border-color: #22c55e;">
            ${icon('whatsapp', 18)} WhatsApp
          </button>
          <button class="btn btn-social" id="btn-guide-tg" style="background: #0284c7; color: #fff; border-color: #38bdf8;">
            ${icon('send', 18)} Telegram
          </button>
          <button class="btn btn-social" id="btn-guide-viber" style="background: #7c3aed; color: #fff; border-color: #a855f7;">
            💜 Viber
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
              window.open(`https://t.me/share/url?url=${encodeURIComponent('https://streetoh.github.io/Player_Stats/')}&text=${encodeURIComponent(guideText)}`, '_blank');
            } else if (app === 'viber') {
              window.open(`viber://forward?text=${encodeURIComponent(guideText)}`, '_blank');
            } else {
              if (navigator.share) navigator.share({ title: 'Guía de Habilidades', text: guideText }).catch(() => {});
            }
          }
        }

        body.querySelector('#btn-guide-wa').onclick = () => shareGuide('whatsapp');
        body.querySelector('#btn-guide-tg').onclick = () => shareGuide('telegram');
        body.querySelector('#btn-guide-viber').onclick = () => shareGuide('viber');
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
    let filter = 'all';

    function build() {
      const list = Store.filterSessions(filter, 'all');

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

        <div id="history-list">
          ${list.length === 0 ? `
            <div class="empty">
              <div class="big">📂</div>
              <h3>${t('noSessionsYet')}</h3>
              <p>${t('noSessionsDesc')}</p>
            </div>
          ` : list.map(s => renderSessionItemHtml(s)).join('')}
        </div>
      `;

      view.querySelector('#btn-history-quick-training').onclick = () => showNewSessionModal('training');
      view.querySelector('#btn-history-quick-match').onclick = () => showNewSessionModal('match');

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

      view.querySelector('#btn-history-export-json').onclick = () => IO.exportBackup();
      view.querySelector('#btn-history-export-csv').onclick = () => IO.exportStatsCSV(list);
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
          <span style="font-size: 11px; font-weight: 900;">${cntTopL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_l')}</span>
          ${getZoneBadgeHtml(cntTopL, zoneActionsMap.top_l)}
        </div>
        <div class="pitch-grid-cell pz-top-c ${cntTopC > 0 ? 'has-actions' : ''}" style="grid-area: top_c; background: ${getHeatBg(cntTopC)}; border-color: rgba(239, 68, 68, 0.8); cursor: pointer;" data-zone-name="${t('zone_box_opp', 'Área Rival')}" data-zone-count="${cntTopC}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_c)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🥅</span>
          <span style="font-size: 12px; font-weight: 900; color: #fde047;">${cntTopC}</span>
          <span style="font-size: 9px; opacity: 0.9;">${t('zone_box_opp')}</span>
          ${getZoneBadgeHtml(cntTopC, zoneActionsMap.top_c)}
        </div>
        <div class="pitch-grid-cell pz-top-r ${cntTopR > 0 ? 'has-actions' : ''}" style="grid-area: top_r; background: ${getHeatBg(cntTopR)}; cursor: pointer;" data-zone-name="${t('zone_wing_off_r', 'Banda Ofensiva Derecha')}" data-zone-count="${cntTopR}" data-zone-actions='${JSON.stringify(zoneActionsMap.top_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">↗️</span>
          <span style="font-size: 11px; font-weight: 900;">${cntTopR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_off_r')}</span>
          ${getZoneBadgeHtml(cntTopR, zoneActionsMap.top_r)}
        </div>

        <!-- Fila 2-3: Bandas unidas laterales -->
        <div class="pitch-grid-cell pz-wing-l ${cntWingL > 0 ? 'has-actions' : ''}" style="grid-area: wing_l; background: ${getHeatBg(cntWingL)}; cursor: pointer;" data-zone-name="${t('zone_wing_l', 'Banda Izquierda')}" data-zone-count="${cntWingL}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_l)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⬅️</span>
          <span style="font-size: 12px; font-weight: 900;">${cntWingL}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_l')}</span>
          ${getZoneBadgeHtml(cntWingL, zoneActionsMap.wing_l)}
        </div>

        <!-- Fila 2 Centro: Frontal -->
        <div class="pitch-grid-cell pz-mid-t ${cntMidT > 0 ? 'has-actions' : ''}" style="grid-area: mid_t; background: ${getHeatBg(cntMidT)}; cursor: pointer;" data-zone-name="${t('zone_front', 'Frontal del Área')}" data-zone-count="${cntMidT}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_t)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">🎯</span>
          <span style="font-size: 11.5px; font-weight: 900;">${cntMidT}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_front')}</span>
          ${getZoneBadgeHtml(cntMidT, zoneActionsMap.mid_t)}
        </div>

        <div class="pitch-grid-cell pz-wing-r ${cntWingR > 0 ? 'has-actions' : ''}" style="grid-area: wing_r; background: ${getHeatBg(cntWingR)}; cursor: pointer;" data-zone-name="${t('zone_wing_r', 'Banda Derecha')}" data-zone-count="${cntWingR}" data-zone-actions='${JSON.stringify(zoneActionsMap.wing_r)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">➡️</span>
          <span style="font-size: 12px; font-weight: 900;">${cntWingR}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_wing_r')}</span>
          ${getZoneBadgeHtml(cntWingR, zoneActionsMap.wing_r)}
        </div>

        <!-- Fila 3 Centro: Centro del campo -->
        <div class="pitch-grid-cell pz-mid-b ${cntMidB > 0 ? 'has-actions' : ''}" style="grid-area: mid_b; background: ${getHeatBg(cntMidB)}; cursor: pointer;" data-zone-name="${t('zone_mid', 'Centro del Campo')}" data-zone-count="${cntMidB}" data-zone-actions='${JSON.stringify(zoneActionsMap.mid_b)}' onclick="window.handlePitchZoneCellClick(this)">
          <span class="z-emoji">⚽</span>
          <span style="font-size: 11.5px; font-weight: 900;">${cntMidB}</span>
          <span style="font-size: 9px; opacity: 0.85;">${t('zone_mid')}</span>
          ${getZoneBadgeHtml(cntMidB, zoneActionsMap.mid_b)}
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

    const allPlayers = Store.state.players || [];
    // Determinar equipo de la sesión o de los jugadores seguidos
    const trackedPlayerIds = new Set([
      ...Object.keys(s.stats || {}),
      ...(s.slots || []).filter(Boolean)
    ]);

    const sessionTeams = Array.isArray(s.teamIds) && s.teamIds.length > 0
      ? s.teamIds
      : (s.teamId ? [s.teamId] : []);

    let defaultTeamFilter = sessionTeams.length > 1 ? 'session_teams' : (sessionTeams[0] || 'all');
    if (defaultTeamFilter === 'all' && trackedPlayerIds.size > 0) {
      for (const pid of trackedPlayerIds) {
        const p = Store.player(pid);
        if (p && p.teamId) { defaultTeamFilter = p.teamId; break; }
      }
    }

    let selectedTeamFilter = defaultTeamFilter;

    openSheet(Store.sessionTitle(s), (body) => {
      function renderSquadContent() {
        const teams = Store.state.teams || [];
        const filteredPlayers = allPlayers.filter(p => {
          if (selectedTeamFilter === 'session_teams') {
            return sessionTeams.length > 0 ? sessionTeams.includes(p.teamId) : true;
          }
          if (selectedTeamFilter === 'all') return true;
          return p.teamId === selectedTeamFilter;
        });
        const sortedSquad = filteredPlayers.slice().sort((a, b) => {
          const aTracked = trackedPlayerIds.has(a.id) ? 1 : 0;
          const bTracked = trackedPlayerIds.has(b.id) ? 1 : 0;
          if (bTracked !== aTracked) return bTracked - aTracked;
          return (a.name || '').localeCompare(b.name || '');
        });
        const trackedCount = sortedSquad.filter(p => trackedPlayerIds.has(p.id)).length;

        // Calcular MVP del partido con volumen de juego
        let mvpMatchPlayer = null;
        let mvpMatchRating = 0;
        if (s.type === 'match' && trackedPlayerIds.size > 0) {
          allPlayers.forEach(p => {
            if (trackedPlayerIds.has(p.id)) {
              const st = (s.stats && s.stats[p.id]) || {};
              let actCount = 0;
              Object.keys(st).forEach(k => { actCount += (st[k] || 0); });
              const r = Store.calculateMatchRating(st, p.mainPosition);
              if (actCount >= 4 && r > mvpMatchRating) {
                mvpMatchRating = r;
                mvpMatchPlayer = p;
              }
            }
          });
          if (!mvpMatchPlayer) {
            allPlayers.forEach(p => {
              if (trackedPlayerIds.has(p.id)) {
                const st = (s.stats && s.stats[p.id]) || {};
                let actCount = 0;
                Object.keys(st).forEach(k => { actCount += (st[k] || 0); });
                const r = Store.calculateMatchRating(st, p.mainPosition);
                if (actCount > 0 && r > mvpMatchRating && r >= 5.5) {
                  mvpMatchRating = r;
                  mvpMatchPlayer = p;
                }
              }
            });
          }
        }

        body.innerHTML = `
          <!-- Cabecera del partido o entrenamiento -->
          ${s.type === 'match' ? `
            <div style="background: linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(34, 211, 238, 0.12)); border: 1px solid rgba(250, 204, 21, 0.35); border-radius: 16px; padding: 14px; text-align: center; margin-bottom: 12px;">
              <span class="badge match" style="font-size: 10.5px; padding: 2px 8px; margin-bottom: 6px;">PARTIDO FINALIZADO</span>
              <div style="font-size: 34px; font-weight: 900; font-variant-numeric: tabular-nums; margin: 4px 0;">
                <span>${(s.score && s.score.home) || 0}</span>
                <span style="color: var(--dim); margin: 0 10px;">:</span>
                <span>${(s.score && s.score.away) || 0}</span>
              </div>
              <div style="font-size: 15px; font-weight: 800; color: var(--text);">
                ${escapeHtml(Store.sessionTitle(s))}
              </div>
              <div class="muted" style="font-size: 12px; margin-top: 4px;">
                📅 ${formatDateDDMMAAAA(s.date)} • ⏱️ ${Store.fmtTime(Store.elapsed(s), s)} ${s.venue ? '• 📍 ' + escapeHtml(s.venue) : ''}
              </div>
            </div>

            ${(mvpMatchPlayer && mvpMatchRating >= 5.5) ? `
              <div class="mvp-match-banner" id="banner-match-mvp" style="cursor: pointer;" title="Toca para ver ficha de ${escapeHtml(Store.playerName(mvpMatchPlayer))}">
                <div style="font-size: 26px;">⭐</div>
                ${renderAvatar(mvpMatchPlayer, 'md')}
                <div class="grow" style="line-height: 1.2;">
                  <div style="font-size: 10px; font-weight: 800; color: #facc15; text-transform: uppercase; letter-spacing: 0.5px;">MEJOR JUGADOR DEL PARTIDO • MVP</div>
                  <div style="font-size: 15px; font-weight: 900; color: #fff;">${escapeHtml(Store.playerName(mvpMatchPlayer))} #${mvpMatchPlayer.mainDorsal || ''}</div>
                  <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
                    ${mvpMatchPlayer.mainPosition || 'Jugador'} • Nota: <b style="color: #22c55e;">${mvpMatchRating.toFixed(1)} / 10</b>
                  </div>
                </div>
                <button type="button" class="btn sm ghost" style="color: #facc15; border-color: rgba(250, 204, 21, 0.4); font-size: 11px; padding: 6px 10px;">Ver ficha ></button>
              </div>
            ` : ''}
          ` : `
            <div class="card" style="margin-bottom: 12px;">
              <div class="row" style="justify-content: space-between;">
                <span class="badge training">${t('training').toUpperCase()}</span>
                <span class="muted">${formatDateDDMMAAAA(s.date)}</span>
              </div>
              <div class="meta" style="margin-top: 8px;">
                <div>⏱️ Tiempo de entrenamiento: <b>${Store.fmtTime(Store.elapsed(s))}</b></div>
                ${s.venue ? `<div>📍 Lugar: <b>${escapeHtml(s.venue)}</b></div>` : ''}
              </div>
            </div>
          `}

          <!-- Selector de filtro de equipo -->
          ${teams.length > 0 ? `
            <div style="margin-bottom: 10px;">
              <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 4px; display: block;">Equipo del partido:</label>
              <select id="session-team-filter" style="width: 100%; font-weight: 800; font-size: 13.5px; padding: 8px 10px; border-radius: 10px;">
                ${sessionTeams.length > 1 ? `
                  <option value="session_teams" ${selectedTeamFilter === 'session_teams' ? 'selected' : ''}>🛡️ Equipos de la sesión (${sessionTeams.map(tid => { const tm = Store.team(tid); return tm ? tm.name : ''; }).filter(Boolean).join(' + ')})</option>
                ` : ''}
                <option value="all" ${selectedTeamFilter === 'all' ? 'selected' : ''}>Todos los jugadores (${allPlayers.length})</option>
                ${teams.map(tm => `
                  <option value="${tm.id}" ${selectedTeamFilter === tm.id ? 'selected' : ''}>${escapeHtml(tm.name)}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <!-- Botón de exportación JSON individual -->
          <div class="row" style="margin-bottom: 12px;">
            <button class="btn sm block ghost" id="btn-export-single-session-json" style="width: 100%;">
              ${icon('file', 16)} ${t('exportJSON')} de esta sesión
            </button>
          </div>

          <div class="section-title">
            <span>Plantilla de Jugadores (${trackedCount} seguidos / ${filteredPlayers.length} total)</span>
          </div>
          <p class="hint" style="margin-bottom: 10px;">Pulsa en cualquier jugador para consultar su rendimiento específico en este partido:</p>

          <!-- Lista de jugadores con destacados interactivos -->
          <div style="max-height: 48vh; overflow-y: auto; padding-right: 2px;">
            ${sortedSquad.length === 0 ? `
              <div class="empty" style="padding: 16px;">
                <p>No hay jugadores registrados en el equipo seleccionado.</p>
              </div>
            ` : sortedSquad.map(p => {
              const isTracked = trackedPlayerIds.has(p.id);
              const pStats = (s.stats && s.stats[p.id]) || {};
              const rating = Store.calculateMatchRating(pStats, p.mainPosition);

              return `
                <div class="player-match-row ${isTracked ? 'tracked' : ''}" data-player-id="${p.id}">
                  ${renderAvatar(p, 'sm')}
                  <div class="grow ellipsis">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <b style="font-size: 14px;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                      ${isTracked ? '<span class="tracked-badge">🟢 Seguido</span>' : ''}
                    </div>
                    <small style="color: var(--muted); font-size: 11.5px; display: block; margin-top: 1px;">
                      ${p.mainPosition || 'Jugador'} ${isTracked ? `• ⭐ ${rating.toFixed(1)} nota` : '• (No registrado / Suplente)'}
                    </small>
                  </div>
                  ${isTracked ? `
                    <div style="font-size: 12px; font-weight: 800; text-align: right; color: var(--cyan);">
                      <div>${pStats.goal ? `⚽ ${pStats.goal} ` : ''}${pStats.shotOn ? `🎯 ${pStats.shotOn} ` : ''}</div>
                      <div style="color: var(--dim); font-size: 11px;">Ver ficha ></div>
                    </div>
                  ` : `
                    <div class="chev" style="opacity: 0.4;">${icon('chevR', 16)}</div>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        `;

        const filterSelect = body.querySelector('#session-team-filter');
        if (filterSelect) {
          filterSelect.onchange = (e) => {
            selectedTeamFilter = e.target.value;
            renderSquadContent();
          };
        }

        const bannerMvp = body.querySelector('#banner-match-mvp');
        if (bannerMvp && mvpMatchPlayer) {
          bannerMvp.onclick = () => {
            showPlayerMatchDetailModal(s, mvpMatchPlayer);
          };
        }

        body.querySelector('#btn-export-single-session-json').onclick = () => {
          IO.exportSessionJSON(s.id);
        };

        body.querySelectorAll('.player-match-row').forEach(row => {
          row.onclick = () => {
            const pid = row.getAttribute('data-player-id');
            const p = Store.player(pid);
            if (p) {
              showPlayerMatchDetailModal(s, p);
            }
          };
        });
      }

      renderSquadContent();
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn danger" id="btn-del-session">${icon('trash', 16)} ${t('delete')}</button>
          <button class="btn primary" id="btn-reopen-tracker">${icon('play', 16)} Abrir Tracker</button>
        </div>
      `;

      foot.querySelector('#btn-reopen-tracker').onclick = () => {
        closeSheet();
        openTracker(s.id);
      };

      foot.querySelector('#btn-del-session').onclick = () => {
        confirmDialog(t('delete'), '¿Estás seguro de eliminar esta sesión?', () => {
          Store.deleteSession(s.id);
          closeSheet();
          navigate('history');
        });
      };
    });
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
    function getPlayerBadgeHtml(pid) {
      const pres = (window._globalPresenceMap && window._globalPresenceMap[pid]);
      const now = Date.now();
      // En línea SÓLO si pres.isOnline es true Y el último latido fue hace menos de 75 segundos
      const isOnlineNow = !!(pres && pres.isOnline && (now - (pres.lastSeen || 0) < 75000));
      // Tiene la app vinculada (sea APK o PWA) si existe documento de presencia
      const hasAppLinked = !!(pres && (pres.hasApp || pres.lastSeen || pres.userId));

      if (isOnlineNow) {
        return `<span title="${t('onlineInApp', 'En línea en la App/PWA de Jugadores')}" style="font-size: 13px; margin-left: 6px; display: inline-flex; align-items: center; gap: 2px; color: #4ade80;">📱🟢</span>`;
      } else if (hasAppLinked) {
        return `<span title="${t('syncedApp', 'App/PWA vinculada y sincronizada')}" style="font-size: 13px; margin-left: 6px; display: inline-flex; align-items: center; gap: 2px; color: #38bdf8;">📱</span>`;
      } else {
        return `<span title="${t('notSyncedApp', 'Sin app instalada / no vinculado')}" style="font-size: 13px; margin-left: 6px; display: inline-flex; align-items: center; gap: 2px; opacity: 0.35;">⚪</span>`;
      }
    }

    function refreshPresenceBadges() {
      if (currentTab !== 'players') return;
      const listCont = view.querySelector('#players-list-container');
      if (!listCont) {
        build();
        return;
      }
      const items = listCont.querySelectorAll('.player-item');
      if (!items || items.length === 0) {
        build();
        return;
      }
      items.forEach(el => {
        const pid = el.getAttribute('data-id');
        const badgeSlot = el.querySelector('.pres-badge-slot');
        if (badgeSlot && pid) {
          badgeSlot.innerHTML = getPlayerBadgeHtml(pid);
        }
      });
    }

    window._refreshPlayersPresenceList = refreshPresenceBadges;

    if (!window._presenceListenerRegistered && window.Cloud && window.Cloud.listenToAllPresence) {
      window._presenceListenerRegistered = true;
      window.Cloud.listenToAllPresence((map) => {
        window._globalPresenceMap = map;
        refreshPresenceBadges();
      });
    }

    if (!window._presenceTickTimer) {
      window._presenceTickTimer = setInterval(() => {
        if (typeof window._refreshPlayersPresenceList === 'function') {
          window._refreshPlayersPresenceList();
        }
      }, 15000);
    }

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
            <span class="sub">${Store.state.players.length} ${t('totalPlayersSuffix')}</span>
          </div>
          <div class="row">
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

            return `
              <div class="player-item" data-id="${p.id}">
                ${renderAvatar(p)}
                <div class="grow ellipsis">
                  <h4 style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="ellipsis">${escapeHtml(Store.playerName(p))}</span>
                    <span class="pres-badge-slot">${presBadge}</span>
                  </h4>
                  <div class="meta">
                    <span class="pos-tag">${p.mainPosition || 'Jugador'}</span>
                    <span>•</span>
                    <span>${getPlayerFootLabel(p.foot)}</span>
                    ${team ? `<span>•</span><span style="color: ${team.color}; font-weight: 700;">${escapeHtml(team.name)}</span>` : ''}
                  </div>
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
  }

  function showPlayerProfileModal(playerId) {
    let p = Store.player(playerId);
    if (!p) {
      const cleanId = String(playerId || '').trim();
      p = (Store.state.players || []).find(x => x.id === cleanId || ('p_' + x.id) === cleanId || cleanId.includes(x.id) || Store.playerName(x).toLowerCase() === cleanId.toLowerCase());
    }
    if (!p) return;
    const team = Store.team(p.teamId);

    const aggAll = Store.playerAggregate(p.id, Store.state.sessions);
    const aggTraining = Store.playerAggregate(p.id, Store.filterSessions('training', 'all'));
    const aggMatch = Store.playerAggregate(p.id, Store.filterSessions('match', 'all'));

    const matchRating = Store.calculateMatchRating(aggAll.totals, p.mainPosition);
    const playerRadar = Store.calculatePlayerRadar(p.id);
    const playerTimeline = Store.playerTimeline(p.id, 'rating');

    // Estadísticas porcentuales clave
    const passOk = aggAll.totals.passOk || 0;
    const passKo = aggAll.totals.passKo || 0;
    const totalPass = passOk + passKo;
    const passPct = totalPass > 0 ? Math.round((passOk / totalPass) * 100) : 0;

    const shotOn = aggAll.totals.shotOn || 0;
    const shotOff = aggAll.totals.shotOff || 0;
    const totalShots = shotOn + shotOff;
    const shotPct = totalShots > 0 ? Math.round((shotOn / totalShots) * 100) : 0;

    const totalGoals = aggAll.totals.goal || 0;
    const convPct = totalShots > 0 ? Math.round((totalGoals / totalShots) * 100) : (totalGoals > 0 ? 100 : 0);

    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const footText = getPlayerFootLabel(p.foot);
    const ageStr = p.birthDate ? calculateAgeYearsMonths(p.birthDate, isEn ? 'en' : 'es') : '';
    const hasParentContact = p.parentContact && (p.parentContact.name || p.parentContact.phone || p.parentContact.email);
    const secPositions = p.secondaryPositions && p.secondaryPositions.length ? p.secondaryPositions : (p.secondaryPosition ? [p.secondaryPosition] : []);

    const pres = (window._globalPresenceMap && window._globalPresenceMap[p.id]);
    const now = Date.now();
    const isOnlineNow = !!(pres && pres.isOnline && (now - (pres.lastSeen || 0) < 75000));
    const hasAppLinked = !!(pres && (pres.hasApp || pres.lastSeen || pres.userId));

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
            <div style="margin-top: 6px;">
              <span class="rating-pill">⭐ ${matchRating.toFixed(1)} ${t('matchRating')}</span>
            </div>
          </div>
        </div>

        <!-- Tarjeta de Estado de Vinculación de la App y botón de Desvincular -->
        <div class="card" id="card-player-app-link" style="padding: 12px 14px; margin-bottom: 10px; border-radius: 14px; background: var(--surface2); border: 1.5px solid ${hasAppLinked ? 'rgba(56, 189, 248, 0.35)' : 'var(--border)'}; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <span style="font-size: 22px; flex-shrink: 0;">${isOnlineNow ? '📱🟢' : (hasAppLinked ? '📱' : '⚪')}</span>
            <div style="overflow: hidden;">
              <b style="font-size: 13px; color: ${isOnlineNow ? '#4ade80' : (hasAppLinked ? '#38bdf8' : '#94a3b8')}; display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                ${isOnlineNow ? t('appOnlineNow', 'En línea en la App') : (hasAppLinked ? t('appLinked', 'App Vinculada') : t('appNotLinked', 'Sin vincular'))}
              </b>
              <span style="font-size: 11px; color: var(--muted); display: block; line-height: 1.3;">
                ${hasAppLinked ? t('appLinkedDesc', 'Perfil activo en el dispositivo del jugador') : t('appNotLinkedDesc', 'El jugador no tiene este perfil en su dispositivo')}
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
                  <a href="viber://chat?number=${encodeURIComponent(p.parentContact.phone.replace(/[^0-9+]/g, ''))}" target="_blank" rel="noopener" class="btn sm" style="text-decoration: none; font-size: 12px; height: 34px; padding: 0 12px; background: #7c3aed; color: #ffffff !important; border: 1.5px solid #c084fc; font-weight: 800; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                    💜 Viber
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

        <!-- Accesos directos a Comparador H2H y Ficha de Partido -->
        <div class="btn-row" style="margin-bottom: 14px;">
          <button class="btn sm ghost grow" id="btn-player-h2h">
            ${icon('compare', 16)} ${t('headToHead')}
          </button>
          <button class="btn sm ghost grow" id="btn-player-match-card">
            ${icon('medal', 16)} ${t('playerCard')}
          </button>
        </div>

        <!-- Estadísticas clave en porcentaje: % Pase, % Puntería, % Conversión -->
        <div class="rings" style="margin-bottom: 12px;">
          <div class="ring-card">
            <div class="ring">
              ${renderProgressRing(passPct, '#22c55e')}
              <span class="r-val" style="color: #22c55e;">${passPct}%</span>
            </div>
            <span>${t('passAccuracy')}</span>
            <small>${passOk}/${totalPass}</small>
          </div>

          <div class="ring-card">
            <div class="ring">
              ${renderProgressRing(shotPct, '#06b6d4')}
              <span class="r-val" style="color: #06b6d4;">${shotPct}%</span>
            </div>
            <span>${t('shotAccuracy')}</span>
            <small>${shotOn}/${totalShots}</small>
          </div>

          <div class="ring-card">
            <div class="ring">
              ${renderProgressRing(Math.min(100, convPct), '#facc15')}
              <span class="r-val" style="color: #facc15;">${convPct}%</span>
            </div>
            <span>${t('goalConversion')}</span>
            <small>${totalGoals} ${t('stat_goal')}</small>
          </div>
        </div>

        <!-- Radar de Habilidades (Spider Chart de 5 cualidades deportivas) -->
        <div class="section-title"><span>${t('skillRadar')}</span></div>
        <div class="radar-container card" style="margin-bottom: 12px;">
          ${renderRadarSVG(playerRadar)}
        </div>

        <!-- Cuadro de Información Aparte para Disciplina y Fair Play -->
        <div class="discipline-card" id="btn-profile-discipline" style="cursor: pointer;" title="${t('adjustDiscipline')}">
          <div class="discipline-score">${playerRadar.dis || 100}</div>
          <div class="grow" style="text-align: left;">
            <div style="font-size: 13.5px; font-weight: 800; color: var(--text);">
              🧠 ${t('disciplineFairPlay')} (${playerRadar.dis || 100} / 99)
            </div>
            <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">
              ${(aggAll.totals.yellow || 0) === 0 && (aggAll.totals.red || 0) === 0 
                ? (isEn ? 'Exemplary conduct • No cards accumulated' : 'Conducta ejemplar • Sin tarjetas acumuladas') 
                : (isEn ? `Accumulated cards: 🟨 ${aggAll.totals.yellow || 0} • 🟥 ${aggAll.totals.red || 0}` : `Tarjetas acumuladas: 🟨 ${aggAll.totals.yellow || 0} • 🟥 ${aggAll.totals.red || 0}`)}
            </div>
          </div>
          <div class="chev" style="opacity: 0.8; color: #22c55e;">${icon('edit', 16)}</div>
        </div>

        <div class="kpis" style="margin-bottom: 14px;">
          <div class="kpi">
            <span class="k-emoji">⚽</span>
            <b class="num">${aggAll.totals.touches || 0}</b>
            <span>${t('stat_touches')}</span>
          </div>
          <div class="kpi">
            <span class="k-emoji">🅰️</span>
            <b class="num" style="color: #a855f7;">${aggAll.totals.assist || 0}</b>
            <span>${t('stat_assist')}</span>
          </div>
          <div class="kpi">
            <span class="k-emoji">🛡️</span>
            <b class="num" style="color: #3b82f6;">${aggAll.totals.recovery || 0}</b>
            <span>${t('stat_recovery')}</span>
          </div>
        </div>

        <!-- Zonas del campo táctico (Heatmap) -->
        <div class="section-title"><span>${t('pitchZones')} (Puntos Calientes)</span></div>
        <div class="card" style="margin-bottom: 14px; text-align: center;">
          ${renderPlayerPitchHeatmapHtml(p.id)}
        </div>

        <!-- Evolución Temporal / Curva de Progreso -->
        <div class="section-title"><span>${t('evolution')} (Nota de Rendimiento)</span></div>
        <div class="card" style="margin-bottom: 14px; text-align: center;">
          ${renderTimelineSVG(playerTimeline)}
        </div>

        <div class="section-title"><span>Desglose por tipo</span></div>

        <table class="stat-table card">
          <thead>
            <tr>
              <th>Acción</th>
              <th class="tr">${t('training')}</th>
              <th class="mt">${t('match')}</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${Store.STATS.map(x => {
              const tr = aggTraining.totals[x.key] || 0;
              const mt = aggMatch.totals[x.key] || 0;
              const tot = aggAll.totals[x.key] || 0;
              if (tot === 0) return '';
              return `
                <tr>
                  <td><span class="e">${x.emoji}</span>${x.short}</td>
                  <td class="tr">${tr}</td>
                  <td class="mt">${mt}</td>
                  <td><b>${tot}</b></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 18px;">
          <span>Sesiones con registro (${aggAll.count})</span>
        </div>

        ${aggAll.sessions.slice(-5).reverse().map(item => `
          <div class="session-line">
            <div class="sl-head">
              <span class="badge ${item.session.type}">${item.session.type === 'match' ? t('match') : t('training')}</span>
              <b>${escapeHtml(Store.sessionTitle(item.session))}</b>
              <span class="muted" style="font-size: 11px;">${item.session.date}</span>
            </div>
            <div class="mini-stats">
              ${Store.STATS.filter(x => (item.stats[x.key] || 0) > 0).map(x => `
                <span>${x.emoji} ${x.short}: <b>${item.stats[x.key]}</b></span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      `;

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
      body.querySelector('#btn-player-match-card').onclick = () => {
        showPlayerCardModal(p, aggAll.sessions.length ? aggAll.sessions[aggAll.sessions.length - 1].session : null);
      };

      // Clic en la tarjeta de Disciplina -> Abrir modal para ajustar puntuación base
      const btnDisProfile = body.querySelector('#btn-profile-discipline');
      if (btnDisProfile) {
        btnDisProfile.onclick = () => {
          showEditDisciplineModal(p, () => {
            closeSheet();
            showPlayerProfileModal(p.id);
          });
        };
      }

      // Clic interactivo en cualquier habilidad del radar
      body.querySelectorAll('[data-skill]').forEach(el => {
        el.onclick = () => {
          const sk = el.getAttribute('data-skill');
          const val = el.getAttribute('data-val');
          showSkillDetailModal(sk, val);
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
    const isEn = (lang || (window.I18N && window.I18N.getLang()) || 'es') === 'en';
    if (isEn) {
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
    const parentContact = (player && player.parentContact) || { name: '', phone: '', email: '' };
    let selectedSecondary = (player && Array.isArray(player.secondaryPositions)) 
      ? [...player.secondaryPositions] 
      : (player && player.secondaryPosition ? [player.secondaryPosition] : []);

    const isEn = (Store.state.settings && Store.state.settings.lang === 'en');
    const initialAge = player && player.birthDate ? calculateAgeYearsMonths(player.birthDate, isEn ? 'en' : 'es') : '';

    openSheet(isEdit ? t('editPlayer') : t('newPlayer'), (body) => {
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
            <input type="date" id="p-birthdate" value="${isEdit && player.birthDate ? player.birthDate : ''}" />
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

      // Live Age Calculation on Birthdate Change
      const birthInput = body.querySelector('#p-birthdate');
      const ageDisplay = body.querySelector('#p-age-display');
      if (birthInput && ageDisplay) {
        const updateAge = () => {
          const val = birthInput.value;
          const age = calculateAgeYearsMonths(val, isEn ? 'en' : 'es');
          ageDisplay.innerHTML = age 
            ? `🎂 ${age}` 
            : `<span style="color: var(--muted); font-size: 11.5px;">${t('calcAgeHint', 'Introduce fecha')}</span>`;
        };
        birthInput.oninput = updateAge;
        birthInput.onchange = updateAge;
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
        const dataUrl = await IO.readFileDataURL(file);
        const shrunken = await IO.shrinkPhoto(dataUrl, 180);
        photoData = shrunken;
        photoPreview.innerHTML = `<img src="${shrunken}" alt="" /><div class="cam">${icon('camera', 16)}</div>`;
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

        if (!name && !nickname) {
          toast('Introduce al menos el nombre o apodo', 'error');
          return;
        }

        const mainDorsal = dorsalStr ? parseInt(dorsalStr, 10) : null;

        const saved = Store.upsertPlayer({
          id: isEdit ? player.id : null,
          name,
          lastName,
          nickname,
          birthDate,
          mainDorsal,
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
          photo: photoData
        });

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
     SECCIÓN CONVOCATORIAS: FORMATEADOR Y COMPARTIR POR VIBER
     ========================================================= */
  function dispatchViberShare(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    toast(t('copiedToClipboard'), 'success');

    if (window.AndroidBridge && window.AndroidBridge.shareText) {
      try {
        window.AndroidBridge.shareText(text, 'viber');
        return;
      } catch (e) {
        console.error('Error invoking native shareText:', e);
      }
    }

    const viberUrl = `viber://forward?text=${encodeURIComponent(text)}`;
    window.location.href = viberUrl;
    setTimeout(() => {
      window.open(viberUrl, '_blank');
    }, 350);
  }

  function formatConvocationWhatsAppText(conv, lang) {
    const isEn = (lang === 'en' || (lang !== 'es' && Store.state.settings && Store.state.settings.lang === 'en'));
    const team = Store.team(conv.teamId);
    const teamName = team ? team.name : '';
    const dateStr = conv.date || '';
    const timeFormatted = conv.time 
      ? (conv.time + (conv.endTime ? ' - ' + conv.endTime : '') + (conv.duration ? ` (${conv.duration} min)` : '')) 
      : '';
    const timeStr = conv.time || '';
    const venueStr = conv.venue ? (isEn ? `📍 *Venue:* ${conv.venue}\n` : `📍 *Lugar:* ${conv.venue}\n`) : '';
    const addressStr = conv.address ? (isEn ? `🗺️ *Address:* ${conv.address}\n` : `🗺️ *Dirección:* ${conv.address}\n`) : '';
    const rivalStr = conv.rival ? (isEn ? `⚔️ *Opponent:* ${conv.rival}\n` : `🆚 *Rival:* ${conv.rival}\n`) : '';
    const notesStr = conv.notes ? (isEn ? `📝 *Notes:* ${conv.notes}\n` : `📝 *Notas:* ${conv.notes}\n`) : '';

    const defTitle = conv.type === 'match' ? (isEn ? 'MATCH' : 'PARTIDO') : (isEn ? 'TRAINING' : 'ENTRENAMIENTO');
    let text = isEn 
      ? `📋 *OFFICIAL CALL-UP: ${conv.title || defTitle}*\n`
      : `📋 *CONVOCATORIA: ${conv.title || defTitle}*\n`;
    if (teamName) text += isEn ? `🛡️ *Team:* ${teamName}\n` : `🛡️ *Equipo:* ${teamName}\n`;
    text += isEn ? `📅 *Date:* ${dateStr} • ⏰ *Time:* ${timeFormatted}\n` : `📅 *Fecha:* ${dateStr} • ⏰ *Hora:* ${timeFormatted}\n`;
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
      const titleVal = conv.title || (conv.type === 'match' ? (isEn ? 'Match' : 'Partido') : (isEn ? 'Training' : 'Entrenamiento'));
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
      if (isEn) qParams.set('lang', 'en');

      const sep = webBaseUrl.includes('?') ? '&' : '?';
      text += isEn
        ? `\n🌐 *Confirm online attendance:*\n👉 ${webBaseUrl}${sep}${qParams.toString()}\n`
        : `\n🌐 *Confirmar asistencia en enlace web:*\n👉 ${webBaseUrl}${sep}${qParams.toString()}\n`;
    }

    if (called.length > 0) {
      text += isEn ? `\n🟢 *CALLED UP (${called.length}):*\n` : `\n🟢 *CONVOCADOS (${called.length}):*\n`;
      called.forEach(item => { text += `  • ${item}\n`; });
    } else {
      text += isEn ? `\n🟢 *CALLED UP (0):*\n  (No players selected yet)\n` : `\n🟢 *CONVOCADOS (0):*\n  (Sin jugadores seleccionados aún)\n`;
    }

    if (bench.length > 0) {
      text += isEn ? `\n🟡 *BENCH (${bench.length}):*\n` : `\n🟡 *SUPLENTES (${bench.length}):*\n`;
      bench.forEach(item => { text += `  • ${item}\n`; });
    }

    if (injured.length > 0) {
      text += isEn ? `\n🏥 *INJURED (${injured.length}):*\n` : `\n🏥 *LESIONADOS (${injured.length}):*\n`;
      injured.forEach(item => { text += `  • ${item}\n`; });
    }

    if (absent.length > 0) {
      text += isEn ? `\n❌ *UNAVAILABLE (${absent.length}):*\n` : `\n❌ *NO DISPONIBLES (${absent.length}):*\n`;
      absent.forEach(item => { text += `  • ${item}\n`; });
    }

    text += isEn
      ? `\n📲 *Please confirm attendance by replying via Viber:*
  👉 Reply: "🟢 ATTENDING" or "❌ CANNOT ATTEND"
⚽ _Sent from Player Stats_`
      : `\n📲 *Por favor confirma tu asistencia respondiendo por Viber:*
  👉 Responde: "🟢 VOY" o "❌ NO PUEDO"
⚽ _Enviado desde Estadísticas Jugadores_`;
    return text;
  }

  /* =========================================================
     ENVÍO DE RECORDATORIOS DE ASISTENCIA A JUGADORES PENDIENTES
     ========================================================= */
  async function sendConvocationAttendanceReminder(conv) {
    if (!conv) return;
    const allPlayersMap = {};
    Store.sortedPlayers().forEach(p => { allPlayersMap[p.id] = p; });

    const calledPlayerIds = Object.keys(conv.list || {}).filter(pid => conv.list[pid] && conv.list[pid] !== 'uncalled');
    const responses = conv.responses || {};

    const pendingPlayers = [];
    calledPlayerIds.forEach(pid => {
      const resp = responses[pid];
      const st = conv.list[pid];
      if (resp && (resp.status === 'attending' || resp.status === 'yes' || resp.status === 'absent' || resp.status === 'no')) return;
      if (st === 'absent') return;
      const p = allPlayersMap[pid] || { id: pid, name: pid.replace(/^manual_/, '') };
      pendingPlayers.push(p);
    });

    if (pendingPlayers.length === 0) {
      toast(t('allResponded', '¡Todos los jugadores ya han confirmado su asistencia para este evento!'), 'info');
      return;
    }

    const coachName = (Store.state.coachProfile && Store.state.coachProfile.name) ? Store.state.coachProfile.name : 'Daniel Requena';
    const eventTitle = conv.title || (conv.type === 'match' ? 'Match vs ' + (conv.rival || 'Rival') : 'Training Session');
    const eventDate = `${conv.date}${conv.time ? ' at ' + conv.time : ''}`;
    const pendingPids = pendingPlayers.map(p => p.id);

    const reminderData = {
      id: 'rem_' + conv.id + '_' + Date.now(),
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

    // Broadcast al chat de los equipos convocados con menciones @ de todos los pendientes
    const mentionsText = pendingPlayers.map(p => {
      const pName = Store.playerName ? Store.playerName(p) : (p.name || 'Player');
      const dorsal = p.mainDorsal != null ? ` #${p.mainDorsal}` : '';
      return `@${pName}${dorsal}`;
    }).join('\n');

    const chatMessageText = `🔔 [Attendance reminder] Coach ${coachName} is waiting for your attendance response for "${eventTitle}" (${eventDate}):\n${mentionsText}\n[event:${conv.id}]`;

    const targetTeamIds = (conv.teamIds && conv.teamIds.length)
      ? conv.teamIds
      : (conv.teamId ? [conv.teamId] : []);

    if (window.Cloud && window.Cloud.sendChatMessage) {
      const chatPayload = {
        senderId: 'coach',
        senderName: `(Coach) ${coachName}`,
        text: chatMessageText,
        convId: conv.id,
        eventTitle: eventTitle,
        type: 'attendance_reminder'
      };

      if (targetTeamIds.length > 0) {
        for (const tid of targetTeamIds) {
          try {
            await window.Cloud.sendChatMessage(`team_${tid}`, chatPayload);
          } catch (e) {
            console.error('Error sending attendance reminder to team chat:', e);
          }
        }
      } else {
        const allTeams = Store.state.teams || [];
        for (const tm of allTeams) {
          try {
            await window.Cloud.sendChatMessage(`team_${tm.id}`, chatPayload);
          } catch (e) {}
        }
      }
    }

    toast(`🔔 Recordatorio enviado a ${pendingPids.length} jugador(es) pendiente(s)`, 'success');
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

    openSheet(conv.title || (conv.rival ? 'vs ' + conv.rival : 'Convocatoria'), (body) => {
      function renderDetails() {
        const allPlayersMap = {};
        Store.sortedPlayers().forEach(p => { allPlayersMap[p.id] = p; });

        const calledPlayerIds = Object.keys(conv.list).filter(pid => {
          const st = conv.list[pid];
          return st && st !== 'uncalled';
        });

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

        body.innerHTML = `
          <!-- Cabecera del evento -->
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
            <span class="badge ${conv.type}">
              ${conv.type === 'match' ? '🏆 ' + t('match') : '⚽ ' + t('training')}
            </span>
            ${team ? `<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: var(--cyan); border-color: rgba(34, 211, 238, 0.3);">🛡️ ${escapeHtml(team.name)}</span>` : ''}
          </div>

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

          <!-- BOTÓN DESTACADO: PEGAR MENSAJES DE VIBER -->
          <div style="background: rgba(124, 58, 237, 0.14); border: 1.5px solid rgba(168, 85, 247, 0.4); border-radius: 14px; padding: 12px; margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #d8b4fe; margin-bottom: 6px;">
              💬 REGISTRAR RESPUESTAS RECIBIDAS:
            </div>
            <button type="button" class="btn block" id="btn-prominent-paste-replies" style="background: #7c3aed; color: #fff; font-size: 13.5px; font-weight: 800; border-color: #a855f7;">
              📥 Pegar mensaje de Viber
            </button>
          </div>

          <!-- BOTONES COMPARTIR POR VIBER -->
          <div style="font-size: 11px; font-weight: 800; color: var(--muted); margin-bottom: 6px; text-transform: uppercase;">
            COMPARTIR CONVOCATORIA:
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
            <button type="button" class="btn" id="btn-conv-share-viber-es" style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 12.5px; border-color: #a855f7;">
              💜 Viber (Español)
            </button>
            <button type="button" class="btn" id="btn-conv-share-viber-en" style="background: #6d28d9; color: #fff; font-weight: 800; font-size: 12.5px; border-color: #9333ea;">
              💜 Viber (English)
            </button>
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
                  Ningún jugador ha confirmado aún. Cuando respondan por Viber, pulsa "Pegar mensaje de Viber".
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${respondedYes.map(item => {
                    const p = item.player;
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(34, 197, 94, 0.1); border: 1.5px solid rgba(34, 197, 94, 0.4); border-radius: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          ${renderAvatar(p, 'sm')}
                          <div>
                            <b style="font-size: 13px; color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                            <small style="display: block; color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                          </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span class="badge" style="background: rgba(34, 197, 94, 0.25); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.6); font-size: 11px; font-weight: 800;">🟢 ASISTE</span>
                          <button type="button" class="btn sm ghost" data-toggle-resp="${p.id}" style="padding: 3px 6px; font-size: 11px;">Cambiar</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                  ${respondedNo.map(item => {
                    const p = item.player;
                    return `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          ${renderAvatar(p, 'sm')}
                          <div>
                            <b style="font-size: 13px; color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                            <small style="display: block; color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                          </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.6); font-size: 11px; font-weight: 800;">❌ BAJA</span>
                          <button type="button" class="btn sm ghost" data-toggle-resp="${p.id}" style="padding: 3px 6px; font-size: 11px;">Cambiar</button>
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
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          ${renderAvatar(p, 'sm')}
                          <div>
                            <b style="font-size: 13px; color: #fff;">#${p.mainDorsal != null ? p.mainDorsal : '-'} ${escapeHtml(Store.playerName(p))}</b>
                            <small style="display: block; color: var(--muted); font-size: 11px;">${p.mainPosition || 'Jugador'}</small>
                          </div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                          <button type="button" class="btn sm" data-quick-confirm="${p.id}" style="background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.5); padding: 4px 8px; font-size: 11px; font-weight: 700;">
                            ✓ Asiste
                          </button>
                          <button type="button" class="btn sm" data-quick-decline="${p.id}" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); padding: 4px 8px; font-size: 11px; font-weight: 700;">
                            ✕ Baja
                          </button>
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

        const btnPasteProm = body.querySelector('#btn-prominent-paste-replies');
        if (btnPasteProm) btnPasteProm.onclick = () => openPasteDialog();

        const btnViberEs = body.querySelector('#btn-conv-share-viber-es');
        if (btnViberEs) btnViberEs.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'es'));

        const btnViberEn = body.querySelector('#btn-conv-share-viber-en');
        if (btnViberEn) btnViberEn.onclick = () => dispatchViberShare(formatConvocationWhatsAppText(conv, 'en'));

        const btnQuickEdit = body.querySelector('#btn-quick-open-editor');
        if (btnQuickEdit) {
          btnQuickEdit.onclick = () => {
            closeSheet();
            showEditConvocationModal(conv.id, onDone);
          };
        }

        body.querySelectorAll('[data-quick-confirm]').forEach(b => {
          b.onclick = () => {
            const pid = b.getAttribute('data-quick-confirm');
            conv.responses = conv.responses || {};
            conv.responses[pid] = { status: 'attending', time: Date.now() };
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
            conv.responses[pid] = { status: 'absent', time: Date.now() };
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
            conv.responses[pid] = { status: next, time: Date.now() };
            conv.list = conv.list || {};
            conv.list[pid] = next === 'attending' ? 'called' : 'absent';
            Store.save();
            haptic(20);
            renderDetails();
          };
        });
      }

      function openPasteDialog() {
        const bodyHtml = `
          <p class="hint" style="margin-bottom: 8px;">
            Pega aquí el mensaje recibido por Viber del padre o jugador:
          </p>
          <textarea id="paste-replies-textarea" rows="6" style="width: 100%; border-radius: 12px; padding: 10px; font-size: 12.5px; background: var(--bg2); color: #fff; border: 1px solid var(--border); box-sizing: border-box;" placeholder="Ej:
👤 Jugador: Alex Tamm (#9)
📢 Estado: 🟢 CONFIRMO ASISTENCIA
..."></textarea>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="btn primary grow" id="btn-proc-paste">Procesar y Actualizar</button>
          </div>
        `;

        const dialog = openModalDialog('📥 Registrar Confirmación (Viber)', bodyHtml);
        const txtArea = dialog.querySelector('#paste-replies-textarea');
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(clip => {
            if (clip && txtArea) txtArea.value = clip;
          }).catch(() => {});
        }

        dialog.querySelector('#btn-proc-paste').onclick = () => {
          const raw = (txtArea ? txtArea.value : '').trim();
          if (!raw) {
            toast('No se ha introducido ningún texto', 'error');
            return;
          }

          let updatedCount = 0;
          const allPlayers = Store.sortedPlayers();
          const lines = raw.split('\n');
          let detectedName = null;
          let detectedStatus = null;

          function parseAttendanceStatus(str) {
            const s = str.toLowerCase();
            if (s.includes('confirm') || s.includes('asistir') || s.includes('asist') || s.includes('🟢') || s.includes('si voy') || s.includes('cuenta conmigo') || s.includes('attending') || s.includes('yes') || s.includes('will attend')) return 'called';
            if (s.includes('duda') || s.includes('pendiente') || s.includes('🟡') || s.includes('quizas') || s.includes('quizá') || s.includes('veremos') || s.includes('maybe') || s.includes('doubt')) return 'bench';
            if (s.includes('no puedo') || s.includes('baja') || s.includes('❌') || s.includes('no podre') || s.includes('no asist') || s.includes('lesion') || s.includes('lesión') || s.includes('not attending') || s.includes('cannot attend') || s.includes('absent')) return 'absent';
            return null;
          }

          for (const line of lines) {
            const mName = line.match(/(?:Jugador|Player|Nombre):\s*([^\n\r]+)/i);
            if (mName) {
              detectedName = mName[1].trim();
            }
            const mStatus = line.match(/(?:Estado|Status|Asistencia):\s*([^\n\r]+)/i);
            if (mStatus) {
              detectedStatus = parseAttendanceStatus(mStatus[1]);
            } else {
              const directSt = parseAttendanceStatus(line);
              if (directSt) detectedStatus = directSt;
            }

            if (detectedName && detectedStatus) {
              const cleanQuery = detectedName.replace(/[\*\_]/g, '').toLowerCase().replace(/#\d+\s*/g, '').trim();
              let matchedP = allPlayers.find(p => (p.name || '').toLowerCase().trim() === cleanQuery);
              if (!matchedP) {
                matchedP = allPlayers.find(p => {
                  const pNorm = (p.name || '').toLowerCase().trim();
                  return pNorm && (cleanQuery.includes(pNorm) || pNorm.includes(cleanQuery));
                });
              }
              if (matchedP) {
                conv.list = conv.list || {};
                conv.responses = conv.responses || {};
                if (detectedStatus === 'called') {
                  conv.responses[matchedP.id] = { status: 'attending', time: Date.now() };
                  conv.list[matchedP.id] = 'called';
                } else if (detectedStatus === 'absent') {
                  conv.responses[matchedP.id] = { status: 'absent', time: Date.now() };
                  conv.list[matchedP.id] = 'absent';
                } else {
                  conv.list[matchedP.id] = detectedStatus;
                }
                updatedCount++;
              }
              detectedName = null;
              detectedStatus = null;
            }
          }

          if (updatedCount === 0) {
            const st = parseAttendanceStatus(raw);
            if (st) {
              for (const p of allPlayers) {
                if (raw.toLowerCase().includes((p.name || '').toLowerCase().trim())) {
                  conv.list = conv.list || {};
                  conv.responses = conv.responses || {};
                  if (st === 'called') {
                    conv.responses[p.id] = { status: 'attending', time: Date.now() };
                    conv.list[p.id] = 'called';
                  } else if (st === 'absent') {
                    conv.responses[p.id] = { status: 'absent', time: Date.now() };
                    conv.list[p.id] = 'absent';
                  } else {
                    conv.list[p.id] = st;
                  }
                  updatedCount++;
                  break;
                }
              }
            }
          }

          if (updatedCount > 0) {
            Store.save();
            toast(`¡${updatedCount} confirmación(es) registrada(s)!`, 'success');
            dialog.remove();
            renderDetails();
            if (onDone) onDone();
          } else {
            toast('No se detectó ningún jugador conocido en el texto', 'error');
          }
        };
      }

      renderDetails();
      window.activeConvocationModalRefresh = () => {
        conv = Store.convocation(conv.id) || conv;
        renderDetails();
      };
    }, (foot) => {
      foot.innerHTML = `
        <div class="btn-row">
          <button class="btn danger" id="btn-detail-del" title="${t('delete')}">${icon('trash', 16)}</button>
          <button class="btn ghost grow" id="btn-detail-close">${t('close', 'Cerrar')}</button>
          <button class="btn primary grow" id="btn-detail-edit">${icon('edit', 16)} Modificar Convocatoria</button>
        </div>
      `;

      foot.querySelector('#btn-detail-close').onclick = closeSheet;

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
            '¡Listo! Al compartir la convocatoria por Viber, se incluirá el enlace y cada jugador podrá elegir su nombre y marcar si asiste o no.'
          );
        };
      }

      bindDatePickerField('conv-date', body);
      bindTimePickerField('conv-time', body);
    }, (foot) => {
      foot.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <button class="btn" id="btn-conv-share-viber-es" style="background: #7c3aed; color: #fff; border-color: #a855f7; font-weight: 800; font-size: 12.5px;">
            💜 Viber (ES)
          </button>
          <button class="btn" id="btn-conv-share-viber-en" style="background: #6d28d9; color: #fff; border-color: #9333ea; font-weight: 800; font-size: 12.5px;">
            💜 Viber (EN)
          </button>
        </div>
        <div class="btn-row">
          ${c.id ? `<button class="btn danger" id="btn-conv-del" title="${t('delete')}">${icon('trash', 16)}</button>` : ''}
          <button class="btn ghost grow" id="btn-conv-cancel">${t('cancel')}</button>
          <button class="btn primary grow" id="btn-conv-save">${t('saveChanges')}</button>
        </div>
      `;

      function triggerViberShare(lang) {
        const textInp = document.getElementById('conv-date-text');
        const hiddenInp = document.getElementById('conv-date');
        if (textInp && hiddenInp) {
          const parsed = parseInputDateToIso(textInp.value);
          if (parsed) hiddenInp.value = parsed;
        }

        const formData = {
          title: document.getElementById('conv-title').value.trim(),
          type: currentType,
          date: hiddenInp ? hiddenInp.value : (c.date || new Date().toISOString().slice(0, 10)),
          time: document.getElementById('conv-time').value,
          venue: document.getElementById('conv-venue').value.trim(),
          rival: document.getElementById('conv-rival').value.trim(),
          teamId: document.getElementById('conv-team') ? document.getElementById('conv-team').value : '',
          notes: document.getElementById('conv-notes').value.trim(),
          list
        };
        const text = formatConvocationWhatsAppText(formData, lang);
        dispatchViberShare(text);
      }

      foot.querySelector('#btn-conv-share-viber-es').onclick = () => triggerViberShare('es');
      foot.querySelector('#btn-conv-share-viber-en').onclick = () => triggerViberShare('en');

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
          title: title || (currentType === 'match' ? (rival ? 'vs ' + rival : 'Partido') : 'Entrenamiento'),
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

        // Crear automáticamente la sesión en la lista de sesiones si es una convocatoria nueva
        if (isNew) {
          try {
            Store.createSession({
              type: currentType,
              date,
              rival: rival || '',
              title: title || (currentType === 'match' ? (rival ? 'vs ' + rival : 'Partido') : 'Entrenamiento'),
              teamId: selectedTeamIds[0] || '',
              teamIds: selectedTeamIds,
              convocationId: savedConv.id
            });
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
                return `
                  <div class="card" style="padding: 12px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--surface2);">
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
        const calledPids = Object.keys(cList).filter(pid => cList[pid] && cList[pid] !== 'uncalled');
        const totalCalled = calledPids.length;

        let nAccepted = 0;
        let nRejected = 0;
        let nPending = 0;

        calledPids.forEach(pid => {
          const r = responses[pid];
          if (r && (r.status === 'called' || r.status === 'attending' || r.status === 'yes')) {
            nAccepted++;
          } else if (r && (r.status === 'absent' || r.status === 'no')) {
            nRejected++;
          } else {
            nPending++;
          }
        });

        return `
          <div class="conv-card" data-cid="${c.id}" style="cursor: pointer; ${isPast ? 'opacity: 0.92; border-color: rgba(255,255,255,0.08); background: rgba(15, 23, 42, 0.7);' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
                  <span class="badge ${c.type}">
                    ${c.type === 'match' ? '🏆 ' + t('match') : '⚽ ' + t('training')}
                  </span>
                  ${isPast ? `
                    <span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-size: 10px; font-weight: 800; padding: 2px 6px;">
                      ⏳ ${t('completed', 'Finalizado')}
                    </span>
                  ` : ''}
                </div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800;">
                  ${escapeHtml(c.title || (c.rival ? 'vs ' + c.rival : 'Convocatoria'))}
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
                <button class="btn sm" data-quick-viber="${c.id}" style="background: #7c3aed; color: #fff; border-color: #a855f7; font-size: 11.5px; font-weight: 800; padding: 4px 8px;" title="Viber">
                  💜 Viber
                </button>
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
          <!-- Lista de eventos próximos / activos -->
          ${upcomingList.length === 0 ? `
            <div style="text-align: center; padding: 22px 14px; background: var(--surface2); border: 1.5px dashed var(--border); border-radius: 14px; color: var(--muted); font-size: 12px; margin-bottom: 12px;">
              ℹ️ ${t('noUpcomingConvs', 'No hay convocatorias ni entrenamientos próximos activos.')}
            </div>
          ` : `
            <div class="conv-list">
              ${upcomingList.map(c => renderCard(c, false)).join('')}
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
              Store.state.convocations = [];
              Store.save();
              if (window.Cloud && window.Cloud.pushCoachState) {
                window.Cloud.pushCoachState(Store.state, true);
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

      view.querySelectorAll('[data-quick-viber]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const cid = btn.getAttribute('data-quick-viber');
          const conv = Store.convocation(cid);
          if (conv) {
            const lang = Store.state.settings.lang || 'es';
            const viberText = formatConvocationWhatsAppText(conv, lang);
            dispatchViberShare(viberText);
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
      const sessions = Store.filterSessions(statsFilterType, statsFilterPeriod);
      const allPlayers = Store.sortedPlayers();

      let totalTouches = 0, totalPassOk = 0, totalPassKo = 0, totalShotOn = 0, totalShotOff = 0, totalGoals = 0;

      sessions.forEach(s => {
        const pids = statsSelectedPlayerId === 'all' ? Store.sessionPlayerIds(s) : [statsSelectedPlayerId];
        pids.forEach(pid => {
          const st = s.stats[pid] || {};
          totalTouches += (st.touches || 0);
          totalPassOk += (st.passOk || 0);
          totalPassKo += (st.passKo || 0);
          totalShotOn += (st.shotOn || 0);
          totalShotOff += (st.shotOff || 0);
          totalGoals += (st.goal || 0);
        });
      });

      const totalPass = totalPassOk + totalPassKo;
      const passPct = totalPass ? Math.round((totalPassOk / totalPass) * 100) : 0;
      const totalShots = totalShotOn + totalShotOff;
      const shotPct = totalShots ? Math.round((totalShotOn / totalShots) * 100) : 0;

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

        <div class="segmented" style="margin-bottom: 8px;">
          <button class="${statsFilterType === 'all' ? 'active' : ''}" data-type="all">${t('all')}</button>
          <button class="${statsFilterType === 'training' ? 'active t-training' : ''}" data-type="training">${t('training')}</button>
          <button class="${statsFilterType === 'match' ? 'active t-match' : ''}" data-type="match">${t('match')}</button>
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
                <button class="icon-btn ghost" id="btn-metrics-reset-all" type="button" title="${t('viewAllPlayers')}">${icon('x', 18)}</button>
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

        <div class="rings" style="margin-bottom: 12px;">
          <div class="ring-card">
            <div class="ring">
              ${renderProgressRing(passPct, '#22c55e')}
              <span class="r-val" style="color: #22c55e;">${passPct}%</span>
            </div>
            <span>${t('passAccuracy')}</span>
            <small>${totalPassOk}/${totalPass}</small>
          </div>

          <div class="ring-card">
            <div class="ring">
              ${renderProgressRing(shotPct, '#06b6d4')}
              <span class="r-val" style="color: #06b6d4;">${shotPct}%</span>
            </div>
            <span>${t('shotAccuracy')}</span>
            <small>${totalShotOn}/${totalShots}</small>
          </div>

          <div class="ring-card">
            <div class="ring">
              ${renderProgressRing(Math.min(100, totalGoals * 20), '#facc15')}
              <span class="r-val" style="color: #facc15;">${totalGoals}</span>
            </div>
            <span>${t('totalGoals')}</span>
            <small>${sessions.length} ses.</small>
          </div>
        </div>

        <div class="section-title"><span>${t('performanceLeaders')}</span></div>

        <div class="card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: var(--muted);">${t('mostTouches')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'touches', '#22c55e')}
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: var(--muted);">${t('topScorers')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'goal', '#facc15')}
        </div>

        <div class="card">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: var(--muted);">${t('topPassers')}</h4>
          ${renderTopRankHtml(allPlayers, sessions, 'passOk', '#06b6d4')}
        </div>
      `;

      view.querySelectorAll('.segmented button').forEach(b => {
        b.onclick = () => {
          statsFilterType = b.getAttribute('data-type');
          build();
        };
      });

      view.querySelectorAll('.metrics-p-chip').forEach(chip => {
        chip.onclick = () => {
          statsSelectedPlayerId = chip.getAttribute('data-pid');
          build();
        };
      });

      const cardEl = view.querySelector('#btn-metrics-open-picker');
      if (cardEl) {
        cardEl.onclick = (e) => {
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
      <svg width="70" height="70">
        <circle cx="35" cy="35" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" />
        <circle cx="35" cy="35" r="${r}" fill="none" stroke="${color}" stroke-width="6"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" />
      </svg>
    `;
  }

  function renderTopRankHtml(players, sessions, key, color) {
    const ranking = players.map(p => {
      let sum = 0;
      sessions.forEach(s => {
        const st = s.stats[p.id] || {};
        sum += (st[key] || 0);
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
        <div class="rank-item" style="padding: 6px 0; background: none; border: 0;">
          <div class="rank-pos">#${idx + 1}</div>
          ${renderAvatar(item.player, 'sm')}
          <div class="grow ellipsis">
            <b>${escapeHtml(Store.playerName(item.player))}</b>
            <div class="rank-bar"><i style="--rc: ${color}; width: ${pct}%;"></i></div>
          </div>
          <div class="rank-val" style="color: ${color};">${item.value}</div>
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
        <div class="segmented">
          <button type="button" class="${I18N.getLang() === 'es' ? 'active' : ''}" id="lang-pick-es">Español 🇪🇸</button>
          <button type="button" class="${I18N.getLang() === 'en' ? 'active' : ''}" id="lang-pick-en">English 🇬🇧</button>
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
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button class="btn btn-secondary" id="btn-copy-portal-link" style="height: 38px; font-size: 12px; font-weight: 700;">
              🔗 Copiar Enlace Portal
            </button>
            <button class="btn btn-secondary" id="btn-share-portal-viber" style="height: 38px; font-size: 12px; font-weight: 700; background: rgba(115, 96, 242, 0.2); border-color: rgba(115, 96, 242, 0.5); color: #c4b5fd;">
              📱 Enviar por Viber
            </button>
          </div>
          <button class="btn btn-secondary block" id="btn-reset-test-presence" style="height: 38px; font-size: 12px; font-weight: 700; color: #f87171; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1);">
            🔄 ${t('resetTestPlayerLinks', 'Desvincular perfiles de prueba')}
          </button>
          <button class="btn btn-secondary block" id="btn-force-players-cache-wipe" style="height: 42px; font-size: 12.5px; font-weight: 800; color: #facc15; border: 1.5px solid rgba(250, 204, 21, 0.5); background: rgba(250, 204, 21, 0.12); display: flex; align-items: center; justify-content: center; gap: 8px;">
            🧹 ${t('forcePlayersCacheWipe', 'Forzar Borrado de Caché en Jugadores (App y PWA)')}
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
        if (window.Cloud) {
          const ok = await window.Cloud.pushCoachState(Store.state, true);
          if (ok) {
            toast(t('syncSuccess', '¡Datos sincronizados en la nube en tiempo real!'), 'success');
          } else {
            const err = window.Cloud && window.Cloud.lastError;
            if (err) {
              toast(t('syncError', 'Error al sincronizar') + ': ' + err, 'error');
            } else {
              toast(t('syncErrorFallback', 'Error al sincronizar. Comprueba tu conexión a Internet.'), 'warning');
            }
          }
        }
        btnSyncNow.disabled = false;
        btnSyncNow.textContent = '☁️ ' + t('syncAllNow', 'Sincronizar Todo a la Nube Ahora');
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

    const btnSharePortalViber = view.querySelector('#btn-share-portal-viber');
    if (btnSharePortalViber) {
      btnSharePortalViber.onclick = () => {
        const viberMsg = `⚽ *Portal Oficial del Jugador - Jõhvi JK Noova*\nConsulta tus estadísticas individuales, convocatorias y confirma tu asistencia en vivo:\n👉 ${portalUrl}`;
        dispatchViberShare(viberMsg);
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

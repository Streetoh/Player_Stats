# -*- coding: utf-8 -*-
"""
Aplica las traducciones completas al ruso (ru) y adapta estonio (et/ee) en js/player-app.js.
Actualiza H2H pedagógico, modal MVP, explicaciones de skills, posiciones y selector de idioma.
"""
import json
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('js/player-app.js', 'r', encoding='utf-8') as f:
    code = f.read()

ru_all = json.load(open('scripts/full_ru.json', encoding='utf-8'))
et_all = json.load(open('scripts/full_et.json', encoding='utf-8'))
p_keys = json.load(open('scripts/player_keys.json', encoding='utf-8'))['en']

exact_keys = {
    'h2h_keys_title': {
        'es': 'Claves del Duelo',
        'en': 'Duel Keys',
        'et': 'Duelli võtmed',
        'ru': 'Ключи к дуэли'
    },
    'h2h_your_advantage': {
        'es': 'Tienes ventaja en {stat} (+{diff}). ¡Úsalo a tu favor!',
        'en': 'You have an edge in {stat} (+{diff}). Use it to your advantage!',
        'et': 'Sul on eelis näitajas {stat} (+{diff}). Kasuta seda ära!',
        'ru': 'У тебя преимущество в {stat} (+{diff}). Используй это!'
    },
    'h2h_watch_out': {
        'es': 'Cuidado con su {stat} (-{diff}). Juega rápido y anticipa.',
        'en': 'Watch out for their {stat} (-{diff}). Play fast and anticipate.',
        'et': 'Ole tähelepanelik vastase {stat} suhtes (-{diff}). Mängi kiirelt!',
        'ru': 'Остерегайся его {stat} (-{diff}). Играй быстро и на опережение.'
    },
    'h2h_best_weapon': {
        'es': 'Duelo exigente: tu mejor baza hoy es competir desde tu {stat}.',
        'en': 'Tough duel: your best bet today is competing through your {stat}.',
        'et': 'Raske duell: sinu parim relv täna on {stat}.',
        'ru': 'Сложная дуэль: твой лучший козырь сегодня — {stat}.'
    },
    'mvp_coach_pick': {
        'es': '⭐ Opción del entrenador',
        'en': '⭐ Coach\'s Pick',
        'et': '⭐ Treeneri valik',
        'ru': '⭐ Выбор тренера'
    },
    'mvp_coach_reason_title': {
        'es': 'Motivo del entrenador:',
        'en': 'Coach\'s reason:',
        'et': 'Treeneri põhjendus:',
        'ru': 'Комментарий тренера:'
    },
    'mvp_btn_confirm_vote': {
        'es': 'Votar a {name} como MVP',
        'en': 'Vote {name} as MVP',
        'et': 'Hääleta {name} MVP-ks',
        'ru': 'Голосовать за {name} как MVP'
    },
    'mvp_btn_cancel': {
        'es': 'Cancelar y ver otros',
        'en': 'Cancel and view others',
        'et': 'Tühista ja vaata teisi',
        'ru': 'Отмена и смотреть других'
    },
    'autoMissionBadge': {
        'es': '⚡ Misión Automática',
        'en': '⚡ Auto Mission',
        'et': '⚡ Automaatne missioon',
        'ru': '⚡ Авто-миссия'
    },
    'currentProgressLabel': {
        'es': 'Progreso',
        'en': 'Progress',
        'et': 'Edu',
        'ru': 'Прогресс'
    },
    'minAttemptsLabel': {
        'es': 'Mín. intentos',
        'en': 'Min. attempts',
        'et': 'Min. katseid',
        'ru': 'Мин. попыток'
    }
}

# 1. Construir el nuevo DICT.ru
p_ru = {}
for k in p_keys.keys():
    p_ru[k] = ru_all.get(k, exact_keys.get(k, {}).get('ru', p_keys[k]))
for k, v in exact_keys.items():
    p_ru[k] = v['ru']

# Verificar regla estricta en ET: NUNCA 'rühm'
forbidden_regex = re.compile(r'\br[üu]hm\w*', re.IGNORECASE)
for k, v in exact_keys.items():
    if forbidden_regex.search(v['et']):
        print(f"ERROR: forbidden word in exact_keys['{k}']['et']: {v['et']}")
        sys.exit(1)

# Inyectar las claves exactas en DICT.en, DICT.ee, DICT.es
for k, vals in exact_keys.items():
    # En DICT.en
    code = code.replace(
        "tapTrainingDetails: 'Tap to view training details and squad',",
        f"tapTrainingDetails: 'Tap to view training details and squad',\n      {k}: {json.dumps(vals['en'])},"
    ) if f"'{k}':" not in code and f"{k}:" not in code else code

# 2. Agregar DICT.ru dentro de const DICT = { ... }
# Encontrar el final de DICT.es:
# downloadStartedToast: '📥 Descargando archivo APK...'
#     }
#   };
dict_es_end = "downloadStartedToast: '📥 Descargando archivo APK...'\n    }\n  };"
if dict_es_end in code:
    dict_ru_str = "downloadStartedToast: '📥 Descargando archivo APK...'\n    },\n    ru: " + json.dumps(p_ru, ensure_ascii=False, indent=6) + "\n  };\n  DICT.et = DICT.ee;\n  DICT.ee = DICT.et;"
    code = code.replace(dict_es_end, dict_ru_str)
    print("Injected DICT.ru and DICT.et alias.")
else:
    print("WARNING: Could not find dict_es_end anchor.")

# 3. Inyectar SKILL_EXPLANATIONS_RU
skill_ru_block = """
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
"""

if "const SKILL_EXPLANATIONS_RU" not in code:
    code = code.replace(
        "const SKILL_EXPLANATIONS_ES = {",
        skill_ru_block + "\n  const SKILL_EXPLANATIONS_ES = {"
    )
    print("Injected SKILL_EXPLANATIONS_RU.")

# 4. Actualizar showSkillExplanationModal para soportar ru y et
code = code.replace(
    "const dict = currentLang === 'ee' ? SKILL_EXPLANATIONS_EE : (currentLang === 'es' ? SKILL_EXPLANATIONS_ES : SKILL_EXPLANATIONS_EN);",
    "const dict = (currentLang === 'ee' || currentLang === 'et') ? SKILL_EXPLANATIONS_EE : (currentLang === 'es' ? SKILL_EXPLANATIONS_ES : (currentLang === 'ru' ? SKILL_EXPLANATIONS_RU : SKILL_EXPLANATIONS_EN));"
)

# 5. Actualizar POSITION_MAP con traducciones rusas
pos_ru_entries = {
    'POR': 'Вратарь (ВРТ)',
    'GK': 'Вратарь (ВРТ)',
    'DFC': 'Центральный защитник (ЦЗ)',
    'CB': 'Центральный защитник (ЦЗ)',
    'LI': 'Левый защитник (ЛЗ)',
    'LB': 'Левый защитник (ЛЗ)',
    'LD': 'Правый защитник (ПЗ)',
    'RB': 'Правый защитник (ПЗ)',
    'MCD': 'Опорный полузащитник (ОПЗ)',
    'CDM': 'Опорный полузащитник (ОПЗ)',
    'MC': 'Центральный полузащитник (ЦП)',
    'CM': 'Центральный полузащитник (ЦП)',
    'MCO': 'Атакующий полузащитник (АПЗ)',
    'CAM': 'Атакующий полузащитник (АПЗ)',
    'EI': 'Левый вингер (ЛВ)',
    'LW': 'Левый вингер (ЛВ)',
    'ED': 'Правый вингер (ПВ)',
    'RW': 'Правый вингер (ПВ)',
    'DC': 'Центральный нападающий (ЦН)',
    'ST': 'Центральный нападающий (ЦН)',
    'portero': 'Вратарь',
    'goalkeeper': 'Вратарь',
    'defensa central': 'Центральный защитник',
    'centre back': 'Центральный защитник',
    'defensa': 'Защитник',
    'defender': 'Защитник',
    'lateral izquierdo': 'Левый защитник',
    'left back': 'Левый защитник',
    'lateral derecho': 'Правый защитник',
    'right back': 'Правый защитник',
    'lateral': 'Крайний защитник',
    'full back': 'Крайний защитник',
    'carrilero': 'Латераль',
    'wing back': 'Латераль',
    'mediocentro defensivo': 'Опорный полузащитник',
    'defensive midfielder': 'Опорный полузащитник',
    'pivote': 'Опорный полузащитник',
    'mediocentro': 'Центральный полузащитник',
    'central midfielder': 'Центральный полузащитник',
    'centrocampista': 'Полузащитник',
    'midfielder': 'Полузащитник',
    'mediapunta': 'Атакующий полузащитник',
    'attacking midfielder': 'Атакующий полузащитник',
    'extremo izquierdo': 'Левый вингер',
    'left winger': 'Левый вингер',
    'extremo derecho': 'Правый вингер',
    'right winger': 'Правый вингер',
    'extremo': 'Вингер',
    'winger': 'Вингер',
    'delantero centro': 'Центральный нападающий',
    'delantero': 'Нападающий',
    'striker': 'Центральный нападающий',
    'forward': 'Нападающий',
    'jugador': 'Игрок',
    'player': 'Игрок'
}

for p_k, p_ru_val in pos_ru_entries.items():
    pattern = rf"('{re.escape(p_k)}':\s*\{{[^}}]*?)(\s*\}})"
    def repl(m):
        content = m.group(1)
        if 'ru:' not in content:
            return f"{content}, ru: '{p_ru_val}'{m.group(2)}"
        return m.group(0)
    code = re.sub(pattern, repl, code)

# 6. Actualizar formatPosition(pos)
code = code.replace(
    "if (!pos) return currentLang === 'ee' ? 'Mängija' : (currentLang === 'en' ? 'Player' : 'Jugador');",
    "if (!pos) return (currentLang === 'ee' || currentLang === 'et') ? 'Mängija' : (currentLang === 'ru' ? 'Игрок' : (currentLang === 'en' ? 'Player' : 'Jugador'));"
)

# 7. Actualizar getLangDisplay(lang)
get_lang_disp_old = """function getLangDisplay(lang) {
    if (lang === 'ee') return '🇪🇪 EE';
    if (lang === 'es') return '🇪🇸 ES';
    return '🇬🇧 EN';
  }"""
get_lang_disp_new = """function getLangDisplay(lang) {
    if (lang === 'ee' || lang === 'et') return '🇪🇪 ET';
    if (lang === 'es') return '🇪🇸 ES';
    if (lang === 'ru') return '🇷🇺 RU';
    return '🇬🇧 EN';
  }"""
code = code.replace(get_lang_disp_old, get_lang_disp_new)

# 8. Actualizar setLanguage(lang)
set_lang_old = "const valid = (lang === 'ee' || lang === 'es') ? lang : 'en';"
set_lang_new = "const valid = (lang === 'ee' || lang === 'et' || lang === 'es' || lang === 'ru') ? (lang === 'et' ? 'ee' : lang) : 'en';"
code = code.replace(set_lang_old, set_lang_new)

# 9. Actualizar openLanguageModal
old_modal_langs = """      const languages = [
        {
          code: 'es',
          flag: '🇪🇸',
          name: 'Español',
          sub: currentLang === 'es' ? 'Español (España)' : (currentLang === 'ee' ? 'Hispaania keel' : 'Spanish'),
          tag: 'ES'
        },
        {
          code: 'en',
          flag: '🇬🇧',
          name: 'English',
          sub: currentLang === 'es' ? 'Inglés (UK / US)' : (currentLang === 'ee' ? 'Inglise keel' : 'English (UK / US)'),
          tag: 'EN'
        },
        {
          code: 'ee',
          flag: '🇪🇪',
          name: 'Eesti',
          sub: currentLang === 'es' ? 'Estonio (Eesti)' : (currentLang === 'ee' ? 'Eesti keel (EE)' : 'Estonian (Eesti)'),
          tag: 'EE'
        }
      ];"""

new_modal_langs = """      const languages = [
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
      ];"""
code = code.replace(old_modal_langs, new_modal_langs)

# 10. Actualizar formatDisplayDate(isoStr)
old_date_calc = """      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysEe = ['Pühapäev', 'Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev'];

      const dayName = (currentLang === 'ee' ? daysEe : (currentLang === 'es' ? daysEs : daysEn))[dateObj.getDay()] || '';"""

new_date_calc = """      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysEe = ['Pühapäev', 'Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev'];
      const daysRu = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

      const dayName = (currentLang === 'ru' ? daysRu : ((currentLang === 'ee' || currentLang === 'et') ? daysEe : (currentLang === 'es' ? daysEs : daysEn)))[dateObj.getDay()] || '';"""
code = code.replace(old_date_calc, new_date_calc)

# 11. Actualizar calculateAgeYearsMonths(birthDateStr, lang)
old_age_fn = """    if (curL === 'ee') {
      const yStr = years === 1 ? '1 aasta' : `${years} aastat`;
      const mStr = months === 1 ? '1 kuu' : `${months} kuud`;
      return `${yStr}, ${mStr}`;
    } else if (curL === 'es') {
      const yStr = years === 1 ? '1 año' : `${years} años`;
      const mStr = months === 1 ? '1 mes' : `${months} meses`;
      return `${yStr}, ${mStr}`;
    } else {
      const yStr = years === 1 ? '1 year' : `${years} years`;
      const mStr = months === 1 ? '1 month' : `${months} months`;
      return `${yStr}, ${mStr}`;
    }"""

new_age_fn = """    if (curL === 'ee' || curL === 'et') {
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
    }"""
code = code.replace(old_age_fn, new_age_fn)

# 12. Actualizar getPlayerMissionText(mission, lang)
old_mission_fn = """          function getPlayerMissionText(mission, lang) {
            if (!mission) return '';
            if (lang === 'ee' && mission.text_ee) return mission.text_ee;
            if (lang === 'en' && mission.text_en) return mission.text_en;
            if (lang === 'es' && mission.text_es) return mission.text_es;
            return mission.text || '';
          }"""

new_mission_fn = """          function getPlayerMissionText(mission, lang) {
            if (!mission) return '';
            if (lang === 'ru' && (mission.text_ru || mission.title_ru)) return mission.text_ru || mission.title_ru;
            if ((lang === 'ee' || lang === 'et') && (mission.text_ee || mission.text_et || mission.title_et)) return mission.text_ee || mission.text_et || mission.title_et;
            if (lang === 'en' && (mission.text_en || mission.title_en)) return mission.text_en || mission.title_en;
            if (lang === 'es' && (mission.text_es || mission.title_es)) return mission.text_es || mission.title_es;
            return mission.text || mission.title || '';
          }"""
code = code.replace(old_mission_fn, new_mission_fn)

# 13. Actualizar H2H Pedagógico con las plantillas exactas
code = code.replace(
    "<span>${t('h2h_pedagogical_title', 'Consejos Tácticos 1v1')}</span>",
    "<span>${t('h2h_keys_title', 'Claves del Duelo')}</span>"
)
code = code.replace(
    "<div style=\"font-size: 10.5px; font-weight: 800; color: #4ade80; text-transform: uppercase; letter-spacing: 0.5px;\">${t('h2h_your_advantage', 'Ventaja')}</div>\n                    <div style=\"font-size: 13px; font-weight: 800; color: #fff;\">${escapeHtml(a.name)}</div>",
    "<div style=\"font-size: 12.5px; font-weight: 800; color: #4ade80; line-height: 1.35;\">${t('h2h_your_advantage', 'Tienes ventaja en {stat} (+{diff}). ¡Úsalo a tu favor!').replace('{stat}', escapeHtml(a.name)).replace('{diff}', a.diff)}</div>"
)
code = code.replace(
    "<div style=\"font-size: 10.5px; font-weight: 800; color: #fde047; text-transform: uppercase; letter-spacing: 0.5px;\">${t('h2h_best_weapon', 'Tu mejor arma')}</div>\n                    <div style=\"font-size: 13px; font-weight: 800; color: #fff;\">${escapeHtml(bestWeapon.name)}</div>",
    "<div style=\"font-size: 12.5px; font-weight: 800; color: #fde047; line-height: 1.35;\">${t('h2h_best_weapon', 'Duelo exigente: tu mejor baza hoy es competir desde tu {stat}.').replace('{stat}', escapeHtml(bestWeapon.name))}</div>"
)
code = code.replace(
    "<div style=\"font-size: 10.5px; font-weight: 800; color: #f472b6; text-transform: uppercase; letter-spacing: 0.5px;\">${t('h2h_watch_out', 'Punto a vigilar')}</div>\n                    <div style=\"font-size: 13px; font-weight: 800; color: #fff;\">${escapeHtml(w.name)}</div>",
    "<div style=\"font-size: 12.5px; font-weight: 800; color: #f472b6; line-height: 1.35;\">${t('h2h_watch_out', 'Cuidado con su {stat} (-{diff}). Juega rápido y anticipa.').replace('{stat}', escapeHtml(w.name)).replace('{diff}', Math.abs(w.diff))}</div>"
)

# 14. Actualizar Modal Detalle MVP del Entrenador
code = code.replace(
    "${t('mvp_coach_reason_label', 'Motivo del Míster')}",
    "${t('mvp_coach_reason_title', 'Motivo del entrenador:')}"
)
code = code.replace(
    "${t('btn_cancel_view_others', 'Cancelar / Ver otros')}",
    "${t('mvp_btn_cancel', 'Cancelar y ver otros')}"
)
code = code.replace(
    "${isSelf ? `(${t('cannotVoteSelf', 'No puedes votarte a ti mismo')})` : (isVotedByMe ? '✓ ' + t('voted', 'Votado como MVP') : t('btn_vote_as_mvp', '⭐ Votar como MVP'))}",
    "${isSelf ? `(${t('cannotVoteSelf', 'No puedes votarte a ti mismo')})` : (isVotedByMe ? '✓ ' + t('voted', 'Votado como MVP') : t('mvp_btn_confirm_vote', 'Votar a {name} como MVP').replace('{name}', escapeHtml(player.name || '')))}"
)

with open('js/player-app.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("✅ js/player-app.js actualizado con soporte para RU y ET.")

# -*- coding: utf-8 -*-
import json
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ru = json.load(open('scripts/full_ru.json', encoding='utf-8'))
et = json.load(open('scripts/full_et.json', encoding='utf-8'))
i18n_keys = json.load(open('scripts/i18n_keys.json', encoding='utf-8'))
es_orig = i18n_keys['es']
en_orig = i18n_keys['en']

exact_keys = {
    'h2h_keys_title': {'es': 'Claves del Duelo', 'en': 'Duel Keys'},
    'h2h_your_advantage': {'es': 'Tienes ventaja en {stat} (+{diff}). ¡Úsalo a tu favor!', 'en': 'You have an edge in {stat} (+{diff}). Use it to your advantage!'},
    'h2h_watch_out': {'es': 'Cuidado con su {stat} (-{diff}). Juega rápido y anticipa.', 'en': 'Watch out for their {stat} (-{diff}). Play fast and anticipate.'},
    'h2h_best_weapon': {'es': 'Duelo exigente: tu mejor baza hoy es competir desde tu {stat}.', 'en': 'Tough duel: your best bet today is competing through your {stat}.'},
    'mvp_coach_pick': {'es': '⭐ Opción del entrenador', 'en': '⭐ Coach\'s Pick'},
    'mvp_coach_reason_title': {'es': 'Motivo del entrenador:', 'en': 'Coach\'s reason:'},
    'mvp_btn_confirm_vote': {'es': 'Votar a {name} como MVP', 'en': 'Vote {name} as MVP'},
    'mvp_btn_cancel': {'es': 'Cancelar y ver otros', 'en': 'Cancel and view others'},
    'autoMissionBadge': {'es': '⚡ Misión Automática', 'en': '⚡ Auto Mission'},
    'currentProgressLabel': {'es': 'Progreso', 'en': 'Progress'},
    'minAttemptsLabel': {'es': 'Mín. intentos', 'en': 'Min. attempts'}
}

# Unir claves para ES y EN
for k, v in exact_keys.items():
    es_orig[k] = v['es']
    en_orig[k] = v['en']

all_i18n_keys = list(es_orig.keys())

# Construir diccionarios limpios ordenados por las mismas claves
es_dict = {}
en_dict = {}
et_dict = {}
ru_dict = {}

forbidden_regex = re.compile(r'\br[üu]hm\w*', re.IGNORECASE)

for k in all_i18n_keys:
    es_dict[k] = es_orig[k]
    en_dict[k] = en_orig.get(k, es_orig[k])
    et_val = et.get(k, en_dict[k])
    if forbidden_regex.search(et_val):
        print(f"ERROR: forbidden word in et key '{k}': {et_val}")
        sys.exit(1)
    et_dict[k] = et_val
    ru_dict[k] = ru.get(k, en_dict[k])

print(f"Keys in i18n dictionaries: ES={len(es_dict)}, EN={len(en_dict)}, ET={len(et_dict)}, RU={len(ru_dict)}")

# Generar archivo js/i18n.js
content = """/* =========================================================
   Internacionalización (i18n) — Español, Inglés, Estonio y Ruso
   ========================================================= */
(function () {
  'use strict';

  const DICT = {
    es: """ + json.dumps(es_dict, ensure_ascii=False, indent=6) + """,
    en: """ + json.dumps(en_dict, ensure_ascii=False, indent=6) + """,
    et: """ + json.dumps(et_dict, ensure_ascii=False, indent=6) + """,
    ru: """ + json.dumps(ru_dict, ensure_ascii=False, indent=6) + """
  };

  DICT.ee = DICT.et;

  let currentLang = 'en';
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'es' || saved === 'en' || saved === 'et' || saved === 'ee' || saved === 'ru') {
      currentLang = (saved === 'ee' ? 'et' : saved);
    }
  } catch (e) {}

  function getLang() {
    return currentLang === 'ee' ? 'et' : currentLang;
  }

  function setLang(code) {
    if (code === 'ee') code = 'et';
    if (code === 'en' || code === 'es' || code === 'et' || code === 'ru') {
      currentLang = code;
      try { localStorage.setItem('lang', code); } catch (e) {}
      if (window.Store && window.Store.state && window.Store.state.settings) {
        window.Store.state.settings.lang = code;
        window.Store.save();
      }
    }
  }

  function t(key, fallback) {
    const lang = (currentLang === 'ee' ? 'et' : currentLang);
    const dict = DICT[lang] || DICT.es;
    return dict[key] !== undefined ? dict[key] : (DICT.es[key] !== undefined ? DICT.es[key] : (fallback || key));
  }

  window.I18N = { DICT, getLang, setLang, t };
  window.t = t;
})();
"""

with open('js/i18n.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ js/i18n.js generado y escrito con éxito.")

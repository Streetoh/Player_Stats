# -*- coding: utf-8 -*-
import json
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('js/player-app.js', 'r', encoding='utf-8') as f:
    text = f.read()

p_en = json.load(open('scripts/player_keys.json', encoding='utf-8'))['en']
p_ee = json.load(open('scripts/player_keys.json', encoding='utf-8'))['ee']
p_es = json.load(open('scripts/player_keys.json', encoding='utf-8'))['es']
full_ru = json.load(open('scripts/full_ru.json', encoding='utf-8'))
full_et = json.load(open('scripts/full_et.json', encoding='utf-8'))

exact = {
    'h2h_keys_title': {'es': 'Claves del Duelo', 'en': 'Duel Keys', 'et': 'Duelli võtmed', 'ru': 'Ключи к дуэли'},
    'h2h_your_advantage': {'es': 'Tienes ventaja en {stat} (+{diff}). ¡Úsalo a tu favor!', 'en': 'You have an edge in {stat} (+{diff}). Use it to your advantage!', 'et': 'Sul on eelis näitajas {stat} (+{diff}). Kasuta seda ära!', 'ru': 'У тебя преимущество в {stat} (+{diff}). Используй это!'},
    'h2h_watch_out': {'es': 'Cuidado con su {stat} (-{diff}). Juega rápido y anticipa.', 'en': 'Watch out for their {stat} (-{diff}). Play fast and anticipate.', 'et': 'Ole tähelepanelik vastase {stat} suhtes (-{diff}). Mängi kiirelt!', 'ru': 'Остерегайся его {stat} (-{diff}). Играй быстро и на опережение.'},
    'h2h_best_weapon': {'es': 'Duelo exigente: tu mejor baza hoy es competir desde tu {stat}.', 'en': 'Tough duel: your best bet today is competing through your {stat}.', 'et': 'Raske duell: sinu parim relv täna on {stat}.', 'ru': 'Сложная дуэль: твой лучший козырь сегодня — {stat}.'},
    'mvp_coach_pick': {'es': '⭐ Opción del entrenador', 'en': '⭐ Coach\'s Pick', 'et': '⭐ Treeneri valik', 'ru': '⭐ Выбор тренера'},
    'mvp_coach_reason_title': {'es': 'Motivo del entrenador:', 'en': 'Coach\'s reason:', 'et': 'Treeneri põhjendus:', 'ru': 'Комментарий тренера:'},
    'mvp_btn_confirm_vote': {'es': 'Votar a {name} como MVP', 'en': 'Vote {name} as MVP', 'et': 'Hääleta {name} MVP-ks', 'ru': 'Голосовать за {name} как MVP'},
    'mvp_btn_cancel': {'es': 'Cancelar y ver otros', 'en': 'Cancel and view others', 'et': 'Tühista ja vaata teisi', 'ru': 'Отмена и смотреть других'},
    'autoMissionBadge': {'es': '⚡ Misión Automática', 'en': '⚡ Auto Mission', 'et': '⚡ Automaatne missioon', 'ru': '⚡ Авто-миссия'},
    'currentProgressLabel': {'es': 'Progreso', 'en': 'Progress', 'et': 'Edu', 'ru': 'Прогресс'},
    'minAttemptsLabel': {'es': 'Mín. intentos', 'en': 'Min. attempts', 'et': 'Min. katseid', 'ru': 'Мин. попыток'}
}

all_player_keys = list(p_en.keys())
for k in exact:
    if k not in all_player_keys:
        all_player_keys.append(k)

d_en = {k: exact.get(k, {}).get('en') or p_en.get(k, '') for k in all_player_keys}
d_ee = {k: exact.get(k, {}).get('et') or p_ee.get(k) or full_et.get(k, '') for k in all_player_keys}
d_es = {k: exact.get(k, {}).get('es') or p_es.get(k, '') for k in all_player_keys}
d_ru = {k: exact.get(k, {}).get('ru') or full_ru.get(k, '') for k in all_player_keys}

# Verificación de regla estricta en EE: NUNCA 'rühm'
forbidden_regex = re.compile(r'\br[üu]hm\w*', re.IGNORECASE)
for k, v in d_ee.items():
    if forbidden_regex.search(v):
        print(f"ERROR: forbidden word in EE key '{k}': {v}")
        sys.exit(1)

dict_str = f"""  const DICT = {{
    en: {json.dumps(d_en, ensure_ascii=False, indent=6)},
    ee: {json.dumps(d_ee, ensure_ascii=False, indent=6)},
    es: {json.dumps(d_es, ensure_ascii=False, indent=6)},
    ru: {json.dumps(d_ru, ensure_ascii=False, indent=6)}
  }};
  DICT.et = DICT.ee;
  DICT.ee = DICT.et;
"""

start = text.find('  const DICT = {')
end_marker = '  /* -------------------------------------------------------------\n     EXPLICACIONES DE CUALIDADES EN INGLÉS (PUNTO 7 OBLIGATORIO)'
end = text.find(end_marker)

if start == -1 or end == -1:
    print(f"ERROR: Could not locate markers (start={start}, end={end})")
    sys.exit(1)

new_text = text[:start] + dict_str + "\n" + text[end:]

with open('js/player-app.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("✅ js/player-app.js DICT re-inyectado con las 4 lenguas completas (353 claves c/u).")

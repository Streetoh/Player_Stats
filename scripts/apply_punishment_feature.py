import re

# 1. Update css/app.css
css_rules = """
/* ============================================================
   ANIMACIONES DE PLAZO DE VOTACIÓN URGENTE Y MODAL ENFADO
   ============================================================ */
@keyframes redBlinkPulse {
  0%, 100% {
    background-color: rgba(239, 68, 68, 0.08);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.25);
  }
  50% {
    background-color: rgba(239, 68, 68, 0.28);
    box-shadow: 0 0 24px rgba(239, 68, 68, 0.7);
  }
}

@keyframes marchingAntsRed {
  0% {
    background-position: 0 0, 0 100%, 0 0, 100% 0;
  }
  100% {
    background-position: 32px 0, -32px 100%, 0 -32px, 100% 32px;
  }
}

@keyframes angryRumble {
  0% { transform: scale(1) rotate(-3deg); }
  50% { transform: scale(1.06) rotate(3deg); }
  100% { transform: scale(1) rotate(-3deg); }
}

.portal-vote-box.vote-box-urgent {
  position: relative !important;
  border-radius: 14px !important;
  padding: 12px 14px !important;
  background-color: rgba(239, 68, 68, 0.12) !important;
  background-image: 
    repeating-linear-gradient(90deg, #ef4444 0, #ef4444 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(90deg, #ef4444 0, #ef4444 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(0deg, #ef4444 0, #ef4444 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(0deg, #ef4444 0, #ef4444 8px, transparent 8px, transparent 16px) !important;
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y !important;
  background-size: 100% 3px, 100% 3px, 3px 100%, 3px 100% !important;
  background-position: 0 0, 0 100%, 0 0, 100% 0 !important;
  animation: redBlinkPulse 1.2s ease-in-out infinite, marchingAntsRed 1s linear infinite !important;
}

.portal-vote-box.vote-box-expired {
  border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
  background: rgba(239, 68, 68, 0.08) !important;
  border-radius: 14px !important;
  padding: 12px 14px !important;
}
"""

with open("css/app.css", "r", encoding="utf-8") as f:
    css_content = f.read()

if ".vote-box-urgent" not in css_content:
    css_content += "\n" + css_rules
    with open("css/app.css", "w", encoding="utf-8") as f:
        f.write(css_content)
    print("css/app.css updated.")

# 2. Update js/i18n.js dictionaries
new_keys = {
    'es': {
        'coachAngryTitle': '⚠️ ¡PLAZO DE VOTACIÓN CERRADO!',
        'coachAngryText': 'No has indicado tu participación. El entrenador está MUY enfadado. Prepara tus músculos para hacer flexiones.',
        'coachAngryForgivePhrase': 'Lo siento, no volverá a ocurrir',
        'typeToUnlockPrompt': 'Escribe la siguiente frase para desbloquear:',
        'typeExactPhrasePlaceholder': 'Escribe aquí la frase exacta...',
        'votingTimeRemaining': '⏳ Plazo para votar: {time} restantes',
        'votingLastHour': '⚠️ ¡Última hora! Quedan {time} para votar',
        'votingClosedDeadline': '🔒 Plazo de votación cerrado (2h antes del inicio)',
    },
    'en': {
        'coachAngryTitle': '⚠️ VOTING DEADLINE CLOSED!',
        'coachAngryText': "You haven't marked your attendance. The coach is VERY angry. Get your muscles ready for push-ups.",
        'coachAngryForgivePhrase': "I'm sorry, it won't happen again",
        'typeToUnlockPrompt': 'Type the following phrase to unlock:',
        'typeExactPhrasePlaceholder': 'Type the exact phrase here...',
        'votingTimeRemaining': '⏳ Voting deadline: {time} remaining',
        'votingLastHour': '⚠️ Last hour! {time} remaining to vote',
        'votingClosedDeadline': '🔒 Voting deadline closed (2h before start)',
    },
    'et': {
        'coachAngryTitle': '⚠️ HÄÄLETAMISE TÄHTAEG ON MÖÖDAS!',
        'coachAngryText': 'Sa ei märkinud oma osalemist. Treener on VÄGA vihane. Valmista oma lihased ette kätekõverdusteks.',
        'coachAngryForgivePhrase': 'Vabandan, seda enam ei kordu',
        'typeToUnlockPrompt': 'Kirjuta avamiseks järgmine lause:',
        'typeExactPhrasePlaceholder': 'Kirjuta siia täpne lause...',
        'votingTimeRemaining': '⏳ Hääletamise tähtaeg: {time} jäänud',
        'votingLastHour': '⚠️ Viimane tund! {time} jäänud hääletamiseks',
        'votingClosedDeadline': '🔒 Hääletamine suletud (2h enne algust)',
    },
    'ru': {
        'coachAngryTitle': '⚠️ СРОК ГОЛОСОВАНИЯ ИСТЁК!',
        'coachAngryText': 'Ты не отметил своё участие. Тренер ОЧЕНЬ зол. Готовь мышцы к отжиманиям.',
        'coachAngryForgivePhrase': 'Простите, больше такого не повторится',
        'typeToUnlockPrompt': 'Напиши следующую фразу для разблокировки:',
        'typeExactPhrasePlaceholder': 'Напиши здесь точную фразу...',
        'votingTimeRemaining': '⏳ Время на голосование: осталось {time}',
        'votingLastHour': '⚠️ Последний час! Осталось {time} для голосования',
        'votingClosedDeadline': '🔒 Голосование закрыто (за 2ч до начала)',
    }
}

# Verify forbidden estonian words
forbidden = re.compile(r'\br[üu]hm\w*', re.IGNORECASE)
for k, v in new_keys['et'].items():
    assert not forbidden.search(v), f"Forbidden word in {k}: {v}"

def insert_dict_keys(filepath, dict_map):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    for lang, keys in dict_map.items():
        # find '    lang: {'
        pattern = rf'([ \t]{{2,4}}{lang}: \{{)'
        m = re.search(pattern, content)
        if not m:
            print(f"Warning: {lang} not found in {filepath}")
            continue
        insert_pos = m.end()
        # build lines to insert
        lines = []
        for k, v in keys.items():
            if f'"{k}":' not in content:
                escaped_v = v.replace('"', '\\"')
                lines.append(f'\n      "{k}": "{escaped_v}",')
        if lines:
            insertion = "".join(lines)
            content = content[:insert_pos] + insertion + content[insert_pos:]
            print(f"Inserted {len(lines)} keys into {filepath} for {lang}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

insert_dict_keys("js/i18n.js", new_keys)
insert_dict_keys("js/player-app.js", new_keys)
print("Dictionaries updated successfully!")

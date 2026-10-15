import sys, json, re
sys.stdout.reconfigure(encoding='utf-8')

with open('js/player-app.js', 'r', encoding='utf-8') as f:
    player_code = f.read()

with open('js/i18n.js', 'r', encoding='utf-8') as f:
    i18n_code = f.read()

# Extract DICT from player-app
match_p = re.search(r'const DICT = (\{[\s\S]*?\n  \});\s*DICT\.et', player_code)
if not match_p:
    print('Could not find player DICT')
    sys.exit(1)

# In node eval or json parse
# Let's inspect specific keys in player DICT across en, ee/et, es, ru
keys_to_check = [
    'filterAll', 'filterMatches', 'filterTrainings',
    'todayTrainingBadge', 'todayMatchBadge', 'today',
    'confirmedBadge', 'absentBadge', 'pendingBadge',
    'viewAttendees', 'attendeesTitle', 'noAttendeesYet', 'noAbsentYet', 'allAnswered',
    'upcomingThisWeek', 'noUpcomingThisWeek', 'noUpcomingThisWeekDesc',
    'pastConvocations', 'pastConvocationsMatches', 'pastConvocationsAll', 'pastSessionBadge',
    'squad', 'squadTitle', 'squadSubtitle', 'squadDesc',
    'coachCardTitle', 'viewCoachProfile', 'coachProfileSubtitle', 'chatWithCoach',
    'callCoach', 'messageViaViber', 'contact',
    'performanceMetrics', 'comparativeRadars', 'duels1v1Historical',
    'chat', 'teamChat', 'directChat', 'searchChatPlaceholder',
    'searchMessagesPlaceholder', 'searchChat',
    'chooseIdentityTitle', 'chooseIdentityDesc', 'selectPlayerPrompt',
    'changeProfile', 'h2hTitle', 'h2hDesc'
]

print('=== CHECKING KEYS IN PLAYER DICT ===')
for k in keys_to_check:
    print(f'-- {k} --')
    for lang in ['en', 'ee', 'es', 'ru']:
        # Regex find in lang section
        pat = rf'\"{lang}\"\s*:\s*\{{[\s\S]*?\"{k}\"\s*:\s*\"([^\"]+)\"'
        m = re.search(pat, player_code)
        if m:
            print(f'  [{lang}]: {m.group(1)}')
        else:
            print(f'  [{lang}]: NOT FOUND!')

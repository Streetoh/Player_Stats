# -*- coding: utf-8 -*-
"""
Traducciones completas para todas las 536 claves restantes en RU y ET.
Vocabulario auténtico de fútbol profesional y cumplimiento de la regla estricta:
NUNCA 'rühm' en Estonio (siempre 'võistkond' o 'grupp').
"""
import json
import re
import sys

with open('scripts/remaining_keys.json', 'r', encoding='utf-8') as f:
    rem = json.load(f)

with open('scripts/base_translations.json', 'r', encoding='utf-8') as f:
    base = json.load(f)

RU = base['ru']
ET = base['et']

print(f"Loaded {len(rem)} remaining keys to map.")

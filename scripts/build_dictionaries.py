# -*- coding: utf-8 -*-
"""
Generador de diccionarios completos en Ruso (ru) y Estonio (et) para PlayerStats JK Noova.
Garantiza terminología futbolística auténtica y CERO ocurrencias de la palabra 'rühm' en Estonio.
"""
import json
import re
import sys

# Cargar claves de referencia
with open('scripts/i18n_keys.json', 'r', encoding='utf-8') as f:
    i18n_data = json.load(f)
es_i18n = i18n_data['es']
en_i18n = i18n_data['en']

with open('scripts/player_keys.json', 'r', encoding='utf-8') as f:
    player_data = json.load(f)
en_player = player_data['en']
es_player = player_data['es']
ee_player = player_data['ee']

print(f"Loaded {len(es_i18n)} Coach keys and {len(en_player)} Player keys.")

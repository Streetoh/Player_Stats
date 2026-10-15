import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open("js/player-app.js", "r", encoding="utf-8") as f:
    text = f.read()

ru_match = re.search(r"\n\s+ru:\s*\{([\s\S]*?)\n\s+\}", text)
if not ru_match:
    print("ru block not found")
    exit(1)

ru_content = ru_match.group(1)
items = re.findall(r"\"([^\"]+)\":\s*\"([^\"]*)\"", ru_content)
print(f"Total keys in ru: {len(items)}")

spanish_words = ["partido", "entrenamiento", "convocatoria", "jugador", "ficha", "equipo", "sesión", "asistencia", "baja", "pendiente", "míster", "gol", "pase", "tiro", "regate", "recuperación", "toque", "duelo", "minutos", "selecciona", "solicitar", "cambio", "perfil", "código", "autorización", "entrenador", "borrar", "reiniciar", "fecha", "hora", "lugar", "campo", "instrucciones", "equipación", "material", "resumen", "rendimiento", "calidad", "historial", "acciones", "carrera", "mis ", "del ", "para ", " con ", " sin ", " por "]

spanish_in_ru = []
for k, v in items:
    v_lower = v.lower()
    has_spanish_char = any(c in v for c in "áéíóúÁÉÍÓÚñÑ¿¡")
    has_sp_word = any(w in v_lower for w in spanish_words)
    has_cyrillic = bool(re.search(r"[\u0400-\u04FF]", v))
    if (has_spanish_char or has_sp_word) and not has_cyrillic:
        spanish_in_ru.append((k, v))

print(f"Found {len(spanish_in_ru)} Spanish keys in ru:")
for k, v in spanish_in_ru:
    print(f"  \"{k}\": \"{v}\"")

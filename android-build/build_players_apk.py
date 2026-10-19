import os
import sys
import subprocess
import shutil
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
SDK_DIR = Path(os.path.expanduser(r"~\AppData\Local\Android\Sdk"))
BUILD_TOOLS = SDK_DIR / "build-tools" / "35.0.0"
PLATFORM_JAR = SDK_DIR / "platforms" / "android-36" / "android.jar"
DEBUG_KEYSTORE = Path(os.path.expanduser(r"~\.android\debug.keystore"))

AAPT = BUILD_TOOLS / "aapt.exe"
ZIPALIGN = BUILD_TOOLS / "zipalign.exe"
APKSIGNER = BUILD_TOOLS / "apksigner.bat"
D8 = BUILD_TOOLS / "d8.bat"

GEN_DIR = BASE_DIR / "gen_players"
OBJ_DIR = BASE_DIR / "obj_players"
DEX_DIR = BASE_DIR / "dex_players"
RES_DIR = BASE_DIR / "res"
ASSETS_DIR = BASE_DIR / "assets"
SRC_PLAYERS_DIR = BASE_DIR / "src_players"
MANIFEST_ACTIVE = BASE_DIR / "AndroidManifest.xml"
MANIFEST_COACH_BACKUP = BASE_DIR / "AndroidManifest_coach_temp.xml"
MANIFEST_PLAYERS_SRC = BASE_DIR / "AndroidManifest_players.xml"

OUTPUT_APK = PROJECT_DIR / "PlayerStats_Player.apk"

def run(cmd, cwd=None):
    print(f"--> Running: {' '.join(str(c) for c in cmd)}")
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        print("STDERR:\n", res.stderr)
        print("STDOUT:\n", res.stdout)
        sys.exit(1)
    if res.stdout.strip():
        print(res.stdout.strip())
    return res

def main():
    print("=== INICIANDO COMPILACIÓN DE APK (PORTAL JUGADORES) ===")

    # Copiar manifest de jugadores a AndroidManifest.xml temporalmente
    shutil.copy2(MANIFEST_ACTIVE, MANIFEST_COACH_BACKUP)
    shutil.copy2(MANIFEST_PLAYERS_SRC, MANIFEST_ACTIVE)

    try:
        # 0. Sincronizar assets web desde la raíz del proyecto hacia android-build/assets
        print("\n[0/6] Sincronizando recursos web hacia android-build/assets...")
        ASSETS_DIR.mkdir(parents=True, exist_ok=True)
        for folder in ["css", "icons", "js", "data", "assets"]:
            src = PROJECT_DIR / folder
            dst = ASSETS_DIR / folder
            if dst.exists():
                shutil.rmtree(dst)
            if src.exists():
                shutil.copytree(src, dst)
        for ext in ["*.html", "manifest*.json", "*sw*.js"]:
            for f in PROJECT_DIR.glob(ext):
                shutil.copy2(f, ASSETS_DIR / f.name)

        # 1. Preparar código Java para paquete com.jknoova.playerportal
        pkg_dir = SRC_PLAYERS_DIR / "com" / "jknoova" / "playerportal"
        pkg_dir.mkdir(parents=True, exist_ok=True)

        orig_java = BASE_DIR / "src" / "com" / "jknoova" / "playerstats" / "MainActivity.java"
        with open(orig_java, "r", encoding="utf-8") as f:
            code = f.read()

        # Adaptar para Portal de Jugadores
        code = code.replace("package com.jknoova.playerstats;", "package com.jknoova.playerportal;")
        code = code.replace('defaultStartPage = "index.html";', 'defaultStartPage = "jugadores.html";')
        code = code.replace('TAG = "PlayerStats";', 'TAG = "PlayerPortal";')
        code = code.replace('BACKUP_FILE = "stats_internal_state.json";', 'BACKUP_FILE = "players_internal_state.json";')
        code = code.replace("Intent bgIntent = new Intent(this, BackgroundNotificationService.class);", "//")
        code = code.replace("startForegroundService(bgIntent);", "//")
        code = code.replace("startService(bgIntent);", "//")
        import re
        code = re.sub(r'BackgroundNotificationService\.[a-zA-Z0-9_]+\([^;]*\);', '//', code)

        with open(pkg_dir / "MainActivity.java", "w", encoding="utf-8") as f:
            f.write(code)

        # 2. Limpiar directorios de compilación
        for d in [GEN_DIR, OBJ_DIR, DEX_DIR]:
            if d.exists():
                shutil.rmtree(d)
            d.mkdir(parents=True, exist_ok=True)

        # 3. Generar R.java con AAPT
        print("\n[1/6] Generando R.java con aapt...")
        run([
            str(AAPT), "package", "-f", "-m",
            "-J", str(GEN_DIR),
            "-M", str(MANIFEST_ACTIVE),
            "-S", str(RES_DIR),
            "-I", str(PLATFORM_JAR)
        ])

        # 4. Compilar clases Java con javac
        print("\n[2/6] Compilando clases Java con javac...")
        java_files = list(SRC_PLAYERS_DIR.rglob("*.java")) + list(GEN_DIR.rglob("*.java"))
        run([
            "javac", "-source", "1.8", "-target", "1.8",
            "-d", str(OBJ_DIR),
            "-cp", f"{PLATFORM_JAR};{GEN_DIR}",
            *[str(f) for f in java_files]
        ])

        # 5. Compilar DEX con D8
        print("\n[3/6] Compilando DEX con d8...")
        class_files = list(OBJ_DIR.rglob("*.class"))
        run([
            str(D8),
            "--output", str(DEX_DIR),
            "--lib", str(PLATFORM_JAR),
            *[str(f) for f in class_files]
        ])

        # 6. Empaquetar APK base con AAPT
        print("\n[4/6] Empaquetando recursos y assets con aapt...")
        unsigned_apk = BASE_DIR / "unaligned_players.apk"
        if unsigned_apk.exists():
            unsigned_apk.unlink()

        run([
            str(AAPT), "package", "-f",
            "-M", str(MANIFEST_ACTIVE),
            "-S", str(RES_DIR),
            "-A", str(ASSETS_DIR),
            "-I", str(PLATFORM_JAR),
            "-F", str(unsigned_apk)
        ])

        # Añadir classes.dex dentro del APK
        print("Añadiendo classes.dex al APK...")
        run([str(AAPT), "add", str(unsigned_apk), "classes.dex"], cwd=DEX_DIR)

        # 7. Zipalign APK
        print("\n[5/6] Optimizando alineación con zipalign...")
        aligned_apk = BASE_DIR / "aligned_players.apk"
        if aligned_apk.exists():
            aligned_apk.unlink()

        run([str(ZIPALIGN), "-f", "-p", "4", str(unsigned_apk), str(aligned_apk)])

        # 8. Firmar APK con apksigner (v1, v2, v3)
        print("\n[6/6] Firmando APK con apksigner...")
        if OUTPUT_APK.exists():
            OUTPUT_APK.unlink()

        run([
            str(APKSIGNER), "sign",
            "--ks", str(DEBUG_KEYSTORE),
            "--ks-pass", "pass:android",
            "--key-pass", "pass:android",
            "--ks-key-alias", "androiddebugkey",
            "--min-sdk-version", "24",
            "--v1-signing-enabled", "true",
            "--v2-signing-enabled", "true",
            "--v3-signing-enabled", "true",
            "--out", str(OUTPUT_APK),
            str(aligned_apk)
        ])

        # Limpiar temporales
        for f in [unsigned_apk, aligned_apk]:
            if f.exists():
                f.unlink()
        for d in [GEN_DIR, OBJ_DIR, DEX_DIR, SRC_PLAYERS_DIR]:
            if d.exists():
                shutil.rmtree(d)

        print(f"\n✅ ¡APK DE JUGADORES CREADO CON ÉXITO! Ubicación: {OUTPUT_APK} ({OUTPUT_APK.stat().st_size / 1024 / 1024:.2f} MB)")

    finally:
        # Siempre restaurar el AndroidManifest.xml del entrenador
        if MANIFEST_COACH_BACKUP.exists():
            shutil.copy2(MANIFEST_COACH_BACKUP, MANIFEST_ACTIVE)
            MANIFEST_COACH_BACKUP.unlink()

if __name__ == "__main__":
    main()

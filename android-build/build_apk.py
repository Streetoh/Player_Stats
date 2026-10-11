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

GEN_DIR = BASE_DIR / "gen"
OBJ_DIR = BASE_DIR / "obj"
DEX_DIR = BASE_DIR / "dex"
RES_DIR = BASE_DIR / "res"
ASSETS_DIR = BASE_DIR / "assets"
SRC_DIR = BASE_DIR / "src"
MANIFEST = BASE_DIR / "AndroidManifest.xml"

OUTPUT_APK = PROJECT_DIR / "EstadisticasJugadores.apk"

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
    print("=== INICIANDO COMPILACIÓN DE APK (ESTADÍSTICAS JUGADORES) ===")

    # 0. Sincronizar assets web desde la raíz del proyecto hacia android-build/assets
    print("\n[0/6] Sincronizando recursos web hacia android-build/assets...")
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    for folder in ["css", "icons", "js", "data"]:
        src = PROJECT_DIR / folder
        dst = ASSETS_DIR / folder
        if dst.exists():
            shutil.rmtree(dst)
        if src.exists():
            shutil.copytree(src, dst)
    for ext in ["*.html", "manifest.json", "sw.js"]:
        for f in PROJECT_DIR.glob(ext):
            shutil.copy2(f, ASSETS_DIR / f.name)

    # 1. Limpiar directorios de compilación
    for d in [GEN_DIR, OBJ_DIR, DEX_DIR]:
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)

    # 2. Generar R.java con AAPT
    print("\n[1/6] Generando R.java con aapt...")
    run([
        str(AAPT), "package", "-f", "-m",
        "-J", str(GEN_DIR),
        "-M", str(MANIFEST),
        "-S", str(RES_DIR),
        "-I", str(PLATFORM_JAR)
    ])

    # 3. Compilar clases Java con javac
    print("\n[2/6] Compilando clases Java con javac...")
    java_files = list(SRC_DIR.rglob("*.java")) + list(GEN_DIR.rglob("*.java"))
    run([
        "javac", "-source", "1.8", "-target", "1.8",
        "-d", str(OBJ_DIR),
        "-cp", f"{PLATFORM_JAR};{GEN_DIR}",
        *[str(f) for f in java_files]
    ])

    # 4. Compilar DEX con D8
    print("\n[3/6] Compilando DEX con d8...")
    class_files = list(OBJ_DIR.rglob("*.class"))
    run([
        str(D8),
        "--output", str(DEX_DIR),
        "--lib", str(PLATFORM_JAR),
        *[str(f) for f in class_files]
    ])

    # 5. Empaquetar APK base con AAPT
    print("\n[4/6] Empaquetando recursos y assets con aapt...")
    unsigned_apk = BASE_DIR / "unaligned.apk"
    if unsigned_apk.exists():
        unsigned_apk.unlink()

    run([
        str(AAPT), "package", "-f",
        "-M", str(MANIFEST),
        "-S", str(RES_DIR),
        "-A", str(ASSETS_DIR),
        "-I", str(PLATFORM_JAR),
        "-F", str(unsigned_apk)
    ])

    # Añadir classes.dex dentro del APK
    print("Añadiendo classes.dex al APK...")
    run([str(AAPT), "add", str(unsigned_apk), "classes.dex"], cwd=DEX_DIR)

    # 6. Zipalign APK
    print("\n[5/6] Optimizando alineación con zipalign...")
    aligned_apk = BASE_DIR / "aligned.apk"
    if aligned_apk.exists():
        aligned_apk.unlink()

    run([str(ZIPALIGN), "-f", "-p", "4", str(unsigned_apk), str(aligned_apk)])

    # 7. Firmar APK con apksigner (v1, v2, v3)
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

    # Verificar firma
    print("\n[VERIFICACIÓN] Comprobando firma del APK...")
    ver = run([str(APKSIGNER), "verify", "--verbose", str(OUTPUT_APK)])
    print(ver.stdout)

    # Limpiar temporales
    for f in [unsigned_apk, aligned_apk]:
        if f.exists():
            f.unlink()

    print(f"\n✅ ¡APK CREADO CON ÉXITO! Ubicación: {OUTPUT_APK} ({OUTPUT_APK.stat().st_size / 1024 / 1024:.2f} MB)")

if __name__ == "__main__":
    main()

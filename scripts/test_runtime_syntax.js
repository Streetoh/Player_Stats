/**
 * Syntax and integrity checker for all HTML and JS files in the ecosystem
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== RUNTIME & SYNTAX INTEGRITY AUDIT ===');

const filesToTest = [
  'js/i18n.js',
  'js/skills-engine.js',
  'js/fut-card.js',
  'js/store.js',
  'js/cloud.js',
  'js/io.js',
  'js/player-app.js',
  'js/app.js'
];

let syntaxErrors = 0;

filesToTest.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    // Check syntax with VM Script
    new vm.Script(code, { filename: relPath });
    console.log(`  ✅ [SYNTAX OK] ${relPath} (${code.length} bytes)`);
  } catch (err) {
    console.error(`  ❌ [SYNTAX ERROR] ${relPath}:`, err.message);
    syntaxErrors++;
  }
});

// Audit HTML files
const htmlFiles = ['index.html', 'jugadores.html', 'convocatoria.html', 'tracker.html'];
htmlFiles.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  try {
    const html = fs.readFileSync(fullPath, 'utf8');
    // Check doctype and closed scripts
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<!doctype html>')) {
      throw new Error('Falta DOCTYPE');
    }
    const openScripts = (html.match(/<script\b/g) || []).length;
    const closeScripts = (html.match(/<\/script>/g) || []).length;
    if (openScripts !== closeScripts) {
      throw new Error(`Desajuste en etiquetas <script>: ${openScripts} abiertas vs ${closeScripts} cerradas`);
    }
    console.log(`  ✅ [HTML OK] ${relPath} (${html.length} bytes, ${openScripts} scripts)`);
  } catch (err) {
    console.error(`  ❌ [HTML ERROR] ${relPath}:`, err.message);
    syntaxErrors++;
  }
});

console.log('========================================');
if (syntaxErrors === 0) {
  console.log('🎉 AUDITORÍA DE INTEGRIDAD Y SINTAXIS EXITOSA AL 100%');
  process.exit(0);
} else {
  console.error(`❌ SE ENCONTRARON ${syntaxErrors} ERRORES DE SINTAXIS`);
  process.exit(1);
}

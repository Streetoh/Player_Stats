#!/usr/bin/env node
/* =========================================================
   cleanup-future-convocations.js
   Elimina convocatorias recurrentes vacías a más de 21 días (Spark quota saver)
   ========================================================= */
'use strict';

const https = require('https');
const API_KEY = 'AIzaSyAC0np50XF3SVx2AHFv8LAFKaQuT-48nhw';
const BASE = 'https://firestore.googleapis.com/v1/projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/convocations';

function request(method, url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
        reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 150)}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('Obteniendo lista de convocatorias...');
  const res = await request('GET', `${BASE}?pageSize=300&key=${API_KEY}`);
  const docs = res.documents || [];
  console.log(`Total documentos en Firestore: ${docs.length}`);

  const maxFutureDate = '2026-11-05';
  const toDelete = [];

  docs.forEach(d => {
    const f = d.fields || {};
    const date = (f.date && f.date.stringValue) || '';
    const hasResp = f.responses && f.responses.mapValue && Object.keys(f.responses.mapValue.fields || {}).length > 0;
    const isRecurring = d.name.includes('/rec_');

    if (isRecurring && !hasResp && date > maxFutureDate) {
      toDelete.push(d.name);
    }
  });

  console.log(`Convocatorias recurrentes vacías a más de 21 días encontradas: ${toDelete.length}`);
  if (!process.argv.includes('--apply')) {
    console.log('Modo simulación (dry-run). Pasa --apply para ejecutar la eliminación.');
    return;
  }

  let deleted = 0;
  for (const docPath of toDelete) {
    const url = `https://firestore.googleapis.com/v1/${docPath}?key=${API_KEY}`;
    await request('DELETE', url);
    deleted++;
    if (deleted % 25 === 0 || deleted === toDelete.length) {
      console.log(`Eliminados ${deleted}/${toDelete.length}...`);
    }
  }

  console.log(`✅ Limpieza completada con éxito. Se eliminaron ${deleted} convocatorias futuras vacías.`);
})();

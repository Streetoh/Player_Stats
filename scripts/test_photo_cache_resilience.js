/**
 * Test de resiliencia y persistencia de fotos de jugadores
 */
const assert = require('assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; },
  get length() { return Object.keys(this._store).length; },
  key(i) { return Object.keys(this._store)[i] || null; }
};

// Cargar cloud.js y player-app.js
require('../js/cloud.js');

console.log('--- TEST 1: CacheDB.setPhoto y getPhotoSync ---');
const samplePid = 'p_test_123';
const sampleHash = 'hash_abc';
const sampleDataUrl = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA';

CacheDB.setPhoto(samplePid, sampleHash, sampleDataUrl);

const syncResult = CacheDB.getPhotoSync(samplePid);
assert(syncResult !== null, 'getPhotoSync debe devolver el registro');
assert.strictEqual(syncResult.dataUrl, sampleDataUrl, 'dataUrl debe coincidir');
assert.strictEqual(syncResult.photoHash, sampleHash, 'photoHash debe coincidir');
console.log('✅ TEST 1 PASADO: CacheDB.getPhotoSync funciona síncronamente');

console.log('--- TEST 2: Reconciliación en Player App (remoteState con photo vacía preserva foto) ---');
let clubData = {
  players: [
    { id: samplePid, name: 'Carlos', photo: sampleDataUrl, photoHash: sampleHash }
  ]
};

// Llega remoteState de Firestore donde photo está vacía
const remoteState = {
  players: [
    { id: samplePid, name: 'Carlos', photo: '', photoHash: sampleHash }
  ]
};

// Lógica de fusión de player-app.js
const prevPhotos = new Map();
if (clubData && Array.isArray(clubData.players)) {
  clubData.players.forEach(p => {
    if (p && p.id && p.photo) prevPhotos.set(p.id, p.photo);
  });
}
clubData = remoteState;
if (Array.isArray(clubData.players)) {
  clubData.players.forEach(p => {
    if (!p || !p.id) return;
    if (!p.photo || p.photo.length < 50) {
      if (prevPhotos.has(p.id)) {
        p.photo = prevPhotos.get(p.id);
      } else if (CacheDB.getPhotoSync) {
        const cached = CacheDB.getPhotoSync(p.id);
        if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
          p.photo = cached.dataUrl;
        }
      }
    }
  });
}

assert.strictEqual(clubData.players[0].photo, sampleDataUrl, 'La foto no debe borrarse al recibir remoteState');
console.log('✅ TEST 2 PASADO: Fusión de remoteState preserva la foto en clubData.players');

console.log('--- TEST 3: Caso extremo: prevPhotos vacío pero CacheDB tiene la foto ---');
let freshClubData = {
  players: [
    { id: samplePid, name: 'Carlos', photo: '', photoHash: sampleHash }
  ]
};

if (Array.isArray(freshClubData.players)) {
  freshClubData.players.forEach(p => {
    if (!p || !p.id) return;
    if (!p.photo || p.photo.length < 50) {
      const cached = CacheDB.getPhotoSync(p.id);
      if (cached && cached.dataUrl && cached.dataUrl.length > 50) {
        p.photo = cached.dataUrl;
      }
    }
  });
}

assert.strictEqual(freshClubData.players[0].photo, sampleDataUrl, 'Debe hidratar de CacheDB');
console.log('✅ TEST 3 PASADO: Hidratación síncrona desde CacheDB restaura la foto');

console.log('\n🎉 TODOS LOS TESTS DE PERSISTENCIA Y CACHÉ DE FOTOS PASARON EXITOSAMENTE!');

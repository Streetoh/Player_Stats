#!/usr/bin/env node
/* =========================================================
   recalc-skills.js — Recálculo idempotente de habilidades (SkillsEngine v2)

   GARANTÍAS
   - Solo escribe el campo `skills` de cada jugador.
       · Firestore: PATCH con updateMask.fieldPaths=skills y
         currentDocument.exists=true (nunca crea ni pisa otros campos).
       · JSON: escribe un archivo NUEVO; el original no se toca.
   - Las sesiones (eventos brutos) solo se LEEN.
   - Idempotente: si el resultado no cambia, no se escribe nada
     (0 escrituras en ejecuciones repetidas → cuida la cuota Spark).
   - Verificación: tras aplicar, recalcula una huella SHA-256 de los
     datos brutos y de los jugadores sin `skills` y aborta si difieren.

   USO
     node scripts/recalc-skills.js                 # simulación (Firestore, sin escribir)
     node scripts/recalc-skills.js --apply         # aplica en Firestore
     node scripts/recalc-skills.js --input backup.json [--output out.json] [--apply]
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const Engine = require(path.join(__dirname, '..', 'js', 'skills-engine.js'));

const PROJECT_ID = 'player-stats-2ac9d';
const API_KEY = 'AIzaSyAC0np50XF3SVx2AHFv8LAFKaQuT-48nhw';
const CLUB_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/clubs/default_club`;

/* ---------------- CLI ---------------- */
function parseArgs(argv) {
  const out = { apply: false, input: null, output: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--input') out.input = argv[++i];
    else if (a === '--output') out.output = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error('Argumento desconocido: ' + a);
  }
  return out;
}

/* ---------------- Utilidades ---------------- */
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
function sha256(v) { return crypto.createHash('sha256').update(stableStringify(v)).digest('hex'); }
function withoutSkills(p) { const c = Object.assign({}, p); delete c.skills; return c; }
function fingerprint(players, sessions) {
  return {
    sessions: sha256(sessions),
    players: sha256(players.map(withoutSkills).sort((a, b) => String(a.id).localeCompare(String(b.id))))
  };
}

/* ---------------- Firestore REST (formato Value <-> JS) ---------------- */
function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return decodeFields((v.mapValue && v.mapValue.fields) || {});
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(decodeValue);
  return null;
}
function decodeFields(fields) {
  const o = {};
  Object.keys(fields || {}).forEach(k => { o[k] = decodeValue(fields[k]); });
  return o;
}
function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  const fields = {};
  Object.keys(v).forEach(k => { if (v[k] !== undefined) fields[k] = encodeValue(v[k]); });
  return { mapValue: { fields } };
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(url, {
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (e) { /* respuesta no JSON */ }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
        const msg = (json && json.error && json.error.message) || raw.slice(0, 200);
        const err = new Error(`HTTP ${res.statusCode}: ${msg}`);
        err.status = res.statusCode;
        reject(err);
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Timeout de red (20 s)')));
    if (data) req.write(data);
    req.end();
  });
}

async function listCollection(name) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/${CLUB_PATH}/${name}?pageSize=300&key=${API_KEY}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await request('GET', url);
    (res && res.documents || []).forEach(d => {
      const obj = decodeFields(d.fields);
      if (!obj.id) obj.id = d.name.split('/').pop();
      docs.push(obj);
    });
    pageToken = res && res.nextPageToken;
  } while (pageToken);
  return docs;
}

async function patchSkills(playerId, skills) {
  const url = `https://firestore.googleapis.com/v1/${CLUB_PATH}/players/${encodeURIComponent(playerId)}` +
    `?updateMask.fieldPaths=skills&currentDocument.exists=true&key=${API_KEY}`;
  return request('PATCH', url, { fields: { skills: encodeValue(skills) } });
}

/* ---------------- Núcleo (puro) ---------------- */
function planRecalc(players, sessions, now) {
  const league = Engine.buildLeagueContext(players, sessions);
  const changes = [];
  let unchanged = 0;
  players.forEach(p => {
    if (!p || !p.id) return;
    const next = Engine.buildPersistedSkills(p, sessions, league, now);
    if (Engine.skillsEqual(p.skills, next)) { unchanged++; return; }
    changes.push({ player: p, prev: p.skills || null, next });
  });
  return { league, changes, unchanged };
}

function printPlan(plan, verbose) {
  const P = plan.league.priors;
  console.log('\nPriors de plantilla (Bayes empírico):');
  console.log(`  pase ${(P.passAcc * 100).toFixed(1)}% · a puerta ${(P.shotOnRate * 100).toFixed(1)}% · conversión ${(P.convOnTarget * 100).toFixed(1)}%` +
    ` · regate ${(P.dribbleAcc * 100).toFixed(1)}% · duelo ${(P.duelAcc * 100).toFixed(1)}% · retención ${(P.retention * 100).toFixed(1)}%`);
  console.log(`  jugadores con datos: ${plan.league.activePlayers}\n`);

  if (!plan.changes.length) { console.log('Sin cambios: todas las habilidades ya están al día (idempotente).'); return; }
  const fmt = (s, k) => (s && s[k] !== undefined ? String(s[k]) : '–').padStart(3);
  console.log('Jugador                     PAS     TIR     REG     FIS     DEF     DIS    conf');
  plan.changes.forEach(({ player, prev, next }) => {
    const name = `${player.name || ''} ${player.lastName || ''}`.trim().slice(0, 26).padEnd(26);
    const cols = Engine.SKILL_KEYS.map(k => `${fmt(prev, k)}→${fmt(next, k)}`).join(' ');
    console.log(`${name}  ${cols}  ${next.confidence.toFixed(2)}`);
    if (verbose) console.log('    muestra:', JSON.stringify(next.sample));
  });
}

/* ---------------- Modos ---------------- */
async function runFirestore(args) {
  console.log(`Origen: Firestore (${PROJECT_ID})`);
  const [players, sessions] = await Promise.all([listCollection('players'), listCollection('sessions')]);
  console.log(`Leídos ${players.length} jugadores y ${sessions.length} sesiones.`);
  const before = fingerprint(players, sessions);

  const plan = planRecalc(players, sessions, Date.now());
  printPlan(plan, args.verbose);
  if (!args.apply) {
    console.log(`\n[SIMULACIÓN] ${plan.changes.length} jugador(es) se actualizarían. Añade --apply para escribir.`);
    return;
  }
  if (!plan.changes.length) return;

  let written = 0;
  for (const ch of plan.changes) {
    try {
      await patchSkills(ch.player.id, ch.next);
      written++;
    } catch (e) {
      if (e.status === 429) {
        console.error(`\n⚠️ Cuota de Firestore agotada tras ${written} escrituras. Vuelve a ejecutar tras el reinicio (10:00): el script continuará donde lo dejó.`);
        process.exitCode = 2;
        break;
      }
      throw e;
    }
  }
  console.log(`\n✅ ${written} jugador(es) actualizados (solo campo "skills"). Sin cambios: ${plan.unchanged}.`);

  // Verificación de integridad: los datos brutos deben ser idénticos
  const [players2, sessions2] = await Promise.all([listCollection('players'), listCollection('sessions')]);
  const after = fingerprint(players2, sessions2);
  if (after.sessions !== before.sessions) {
    console.warn('ℹ️ Las sesiones cambiaron durante la ejecución (¿app Coach sincronizando?). El script no las modifica; vuelve a ejecutarlo para converger.');
  } else if (after.players !== before.players) {
    console.warn('ℹ️ Algún jugador cambió durante la ejecución (¿app Coach sincronizando?). El script solo escribe "skills"; vuelve a ejecutarlo.');
  } else {
    console.log('🔒 Integridad verificada: sesiones y datos de jugador (excepto "skills") idénticos byte a byte.');
  }
}

function runJson(args) {
  const inPath = path.resolve(args.input);
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const state = raw && raw.state ? raw.state : raw;   // admite export envuelto { state: {...} }
  const players = Array.isArray(state.players) ? state.players : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  console.log(`Origen: ${inPath}\nLeídos ${players.length} jugadores y ${sessions.length} sesiones.`);
  const before = fingerprint(players, sessions);

  const plan = planRecalc(players, sessions, Date.now());
  printPlan(plan, args.verbose);

  const outPath = path.resolve(args.output || inPath.replace(/\.json$/i, '') + '.skills.json');
  if (outPath === inPath) throw new Error('--output no puede ser el archivo de origen (cero pérdida de datos).');
  if (!args.apply) {
    console.log(`\n[SIMULACIÓN] ${plan.changes.length} cambio(s). Con --apply se escribiría: ${outPath}`);
    return;
  }

  const out = JSON.parse(JSON.stringify(raw));            // copia profunda; el original queda intacto
  const outState = out && out.state ? out.state : out;
  const byId = new Map(plan.changes.map(c => [c.player.id, c.next]));
  outState.players.forEach(p => { if (byId.has(p.id)) p.skills = byId.get(p.id); });

  const after = fingerprint(outState.players, outState.sessions || []);
  if (after.sessions !== before.sessions || after.players !== before.players) {
    throw new Error('Verificación de integridad fallida: abortado sin escribir.');
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n✅ Escrito ${outPath} (${plan.changes.length} jugador(es) con "skills" nuevo). Origen intacto.`);
}

(async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 22).join('\n'));
    return;
  }
  console.log(`SkillsEngine v${Engine.ENGINE_VERSION} — ${args.apply ? 'MODO APLICAR' : 'MODO SIMULACIÓN'}`);
  try {
    if (args.input) runJson(args); else await runFirestore(args);
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    process.exitCode = 1;
  }
})();

module.exports = { planRecalc, fingerprint, encodeValue, decodeFields };

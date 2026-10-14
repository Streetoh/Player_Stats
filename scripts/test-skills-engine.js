/* =========================================================
   test-skills-engine.js — Batería de pruebas unitarias
   Valida casos extremos, calibración bayesiana e idempotencia.
   ========================================================= */
'use strict';

const assert = require('assert');
const path = require('path');
const Engine = require(path.join(__dirname, '..', 'js', 'skills-engine.js'));

console.log('=== Iniciando pruebas unitarias de SkillsEngine v' + Engine.ENGINE_VERSION + ' ===');

// 1. Jugador sin eventos ni sesiones
{
  const p = { id: 'p_empty', name: 'Sin Eventos' };
  const league = Engine.buildLeagueContext([p], []);
  const skills = Engine.computePlayerSkills(p.id, { players: [p], sessions: [], league });
  assert.strictEqual(skills.pas, 50, 'Pase debe ser 50 sin datos');
  assert.strictEqual(skills.tir, 50, 'Tiro debe ser 50 sin datos');
  assert.strictEqual(skills.reg, 50, 'Regate debe ser 50 sin datos');
  assert.strictEqual(skills.fis, 50, 'Físico debe ser 50 sin datos');
  assert.strictEqual(skills.def, 50, 'Defensa debe ser 50 sin datos');
  assert.strictEqual(skills.dis, 50, 'Disciplina debe ser 50 sin datos');

  const persisted = Engine.buildPersistedSkills(p, [], league, 1000);
  assert.strictEqual(persisted.confidence, 0, 'Confianza 0 sin datos');
  assert.strictEqual(persisted.sample.matches, 0);
  assert.strictEqual(persisted.sample.trainings, 0);
  console.log('✔ Caso 1: Jugador con 0 eventos → Neutro 50 y confianza 0');
}

// 2. Muestra pequeña extrema (1 disparo, 1 gol en 1 partido)
{
  const p = { id: 'p_lucky', name: 'Suertudo' };
  const session = {
    id: 's1',
    type: 'match',
    stats: {
      p_lucky: { shotOn: 1, goal: 1 }
    }
  };
  const league = Engine.buildLeagueContext([p], [session]);
  const skills = Engine.computePlayerSkills(p.id, { players: [p], sessions: [session], league });

  // Con 1 disparo y 1 gol, un promedio ingenuo daría 100% de efectividad y un rating irreal (ej. 99)
  // Con Bayes y shrinkage, el tiro debe estar por encima de 50 pero moderado (< 75)
  assert(skills.tir > 50, 'Tiro debe ser superior a 50 por el gol');
  assert(skills.tir < 75, `Tiro no debe dispararse a 99 con solo 1 disparo (actual: ${skills.tir})`);
  console.log(`✔ Caso 2: 1 de 1 aciertos (Laplace) → Tiro contenido en ${skills.tir} (evita distorsión de muestra pequeña)`);
}

// 3. Alto volumen y alta precisión sostenida en un equipo (Goleador élite)
{
  const pElite = { id: 'p_elite', name: 'Goleador Top' };
  const squad = [pElite];
  for (let i = 1; i <= 6; i++) {
    squad.push({ id: `p_${i}`, name: `Compañero ${i}` });
  }

  const sessions = [];
  for (let i = 0; i < 8; i++) {
    const stats = {
      p_elite: { shotOn: 4, shotOff: 1, goal: 3, passOk: 25, passKo: 3, touches: 40 }
    };
    for (let j = 1; j <= 6; j++) {
      stats[`p_${j}`] = { shotOn: 0, shotOff: 1, goal: 0, passOk: 12, passKo: 6, touches: 20 };
    }
    sessions.push({ id: `s_${i}`, type: 'match', stats });
  }
  const league = Engine.buildLeagueContext(squad, sessions);
  const skills = Engine.computePlayerSkills(pElite.id, { players: squad, sessions, league });

  assert(skills.tir >= 80, `Tiro élite con alto volumen y conversión debe ser >= 80 (actual: ${skills.tir})`);
  assert(skills.tir <= 99, `Tiro no debe exceder 99 (actual: ${skills.tir})`);
  assert(skills.pas >= 75, `Pase con 89% de acierto y buen volumen debe ser alto (actual: ${skills.pas})`);
  console.log(`✔ Caso 3: Alto volumen + alta precisión → Tiro ${skills.tir}, Pase ${skills.pas} (escala 0-99 calibrada)`);
}

// 4. Retención y pérdidas no forzadas
{
  const pSafe = { id: 'p_safe', name: 'Seguro' };
  const pWasteful = { id: 'p_wasteful', name: 'Perdedor de Balón' };
  const session = {
    id: 's1',
    type: 'match',
    stats: {
      p_safe: { passOk: 30, passKo: 2, recovery: 8, loss: 1, touches: 35 },
      p_wasteful: { passOk: 10, passKo: 15, recovery: 0, loss: 12, touches: 35 }
    }
  };
  const league = Engine.buildLeagueContext([pSafe, pWasteful], [session]);
  const safeSkills = Engine.computePlayerSkills(pSafe.id, { players: [pSafe, pWasteful], sessions: [session], league });
  const wastefulSkills = Engine.computePlayerSkills(pWasteful.id, { players: [pSafe, pWasteful], sessions: [session], league });

  assert(safeSkills.pas > wastefulSkills.pas + 15, 'Jugador seguro debe superar ampliamente en pase al que pierde balones');
  assert(safeSkills.reg > wastefulSkills.reg, 'Retención limpia debe superar a retención con pérdidas');
  console.log(`✔ Caso 4: Posesión y retención → Seguro (PAS ${safeSkills.pas}, REG ${safeSkills.reg}) vs Derrochador (PAS ${wastefulSkills.pas}, REG ${wastefulSkills.reg})`);
}

// 5. Override manual de disciplina
{
  const pCoachScore = { id: 'p_disc', name: 'Disciplinado', disciplineScore: 92 };
  const league = Engine.buildLeagueContext([pCoachScore], []);
  const skills = Engine.computePlayerSkills(pCoachScore.id, { players: [pCoachScore], sessions: [], league });
  assert.strictEqual(skills.dis, 92, 'El disciplineScore manual del entrenador debe respetarse');
  console.log('✔ Caso 5: Override manual de disciplina del entrenador respetado al 100%');
}

// 6. Idempotencia y semantic equality
{
  const p = { id: 'p_idem', name: 'Idempotente' };
  const session = {
    id: 's1',
    type: 'match',
    stats: { p_idem: { passOk: 15, passKo: 5, recovery: 3 } }
  };
  const league = Engine.buildLeagueContext([p], [session]);
  const run1 = Engine.buildPersistedSkills(p, [session], league, 1000);
  const run2 = Engine.buildPersistedSkills(p, [session], league, 2000); // Diferente timestamp

  assert.strictEqual(Engine.skillsEqual(run1, run2), true, 'Dos ejecuciones idénticas deben ser semánticamente iguales ignorando timestamp');
  const mutated = Object.assign({}, run1, { pas: run1.pas + 1 });
  assert.strictEqual(Engine.skillsEqual(run1, mutated), false, 'Cualquier variación numérica debe detectarse como distinta');
  console.log('✔ Caso 6: Idempotencia comprobada (skillsEqual ignora timestamp, detecta cambios reales)');
}

console.log('\n✅ TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE.');

/**
 * Test unitario para verificar el aislamiento estricto de recordatorios y notificaciones
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST DE AISLAMIENTO DE RECORDATORIOS Y NOTIFICACIONES ---');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

// Test 1: Simulación de lógica de filtrado de chats de equipo en chat.js
{
  console.log('\n[TEST 1] Filtrado de chats de equipo para jugador de 2017');
  const myPlayerId = 'p_2017_01';
  const myTeamId = '2017';
  localStorage.setItem('portal_player_team_id', myTeamId);

  const chats = [
    { id: 'team_2015', type: 'team', teamId: '2015', name: '🛡️ Equipo 2015' },
    { id: 'team_2016', type: 'team', teamId: '2016', name: '🛡️ Equipo 2016' },
    { id: 'team_2017', type: 'team', teamId: '2017', name: '🛡️ Equipo 2017' },
    { id: 'team_2015_notype', id: 'team_2015' }, // documento sin type explícito
    { id: 'coach_p_2017_01', type: 'coach', participants: ['p_2017_01', 'coach'] },
    { id: 'coach_p_2015_01', type: 'coach', participants: ['p_2015_01', 'coach'] },
  ];

  // Aplicar regla de chat.js (línea 1003)
  const isCoach = false;
  const curId = myPlayerId;
  const filtered = chats.filter(c => {
    const chatTeamId = c.teamId || (c.id && c.id.startsWith('team_') ? c.id.replace(/^team_/, '') : null);
    if (chatTeamId) {
      if (chatTeamId === 'general') return true;
      if (!myTeamId || String(chatTeamId) !== String(myTeamId)) return false;
    } else if (c.type === 'direct' || c.id.startsWith('direct_') || c.type === 'coach' || c.id.startsWith('coach_')) {
      const parts = Array.isArray(c.participants)
        ? c.participants.map(String)
        : c.id.split('_').slice(1).map(String);
      if (!parts.includes(String(curId))) return false;
    }
    return true;
  });

  const remainingIds = filtered.map(c => c.id);
  console.log('Chats visibles para jugador 2017:', remainingIds);
  assert(remainingIds.includes('team_2017'), 'Debe ver team_2017');
  assert(remainingIds.includes('coach_p_2017_01'), 'Debe ver su chat con el entrenador');
  assert(!remainingIds.includes('team_2015'), 'NO debe ver team_2015');
  assert(!remainingIds.includes('team_2016'), 'NO debe ver team_2016');
  assert(!remainingIds.includes('coach_p_2015_01'), 'NO debe ver chat del coach con otro jugador');
  console.log('✅ TEST 1 PASADO: Jugador 2017 solo ve su equipo y su chat directo');
}

// Test 2: Simulación de listener no leído en chat.js (initGlobalUnreadListener)
{
  console.log('\n[TEST 2] Verificación de participante en initGlobalUnreadListener');
  const myPlayerId = 'p_2017_01';
  const myTeamId = '2017';
  const sCurUserId = String(myPlayerId);

  function checkParticipant(c) {
    let isParticipant = false;
    if (c.id === 'general') {
      isParticipant = true;
    } else if (c.id === 'coach_' + sCurUserId) {
      isParticipant = true;
    } else if (c.id.startsWith('direct_')) {
      isParticipant = Array.isArray(c.participants)
        ? c.participants.map(String).includes(sCurUserId)
        : c.id.split('_').slice(1).map(String).includes(sCurUserId);
    } else if (c.type === 'team' || c.id.startsWith('team_')) {
      const chatTeamId = c.teamId || c.id.replace(/^team_/, '');
      if (chatTeamId === 'general') {
        isParticipant = true;
      } else {
        const effectiveTeamId = myTeamId || localStorage.getItem('portal_player_team_id');
        isParticipant = !!(effectiveTeamId && chatTeamId && String(chatTeamId) === String(effectiveTeamId));
      }
    } else if (Array.isArray(c.participants)) {
      isParticipant = c.participants.some(p => String(p) === sCurUserId);
    }
    return isParticipant;
  }

  assert.strictEqual(checkParticipant({ id: 'team_2015' }), false, 'No debe ser participante de team_2015');
  assert.strictEqual(checkParticipant({ id: 'team_2015', type: 'team' }), false, 'No debe ser participante de team_2015 con type team');
  assert.strictEqual(checkParticipant({ id: 'team_2017' }), true, 'Debe ser participante de team_2017');
  assert.strictEqual(checkParticipant({ id: 'coach_p_2017_01' }), true, 'Debe ser participante de su chat con el coach');
  assert.strictEqual(checkParticipant({ id: 'coach_p_2015_01' }), false, 'No debe ser participante del coach con jugador 2015');
  console.log('✅ TEST 2 PASADO: initGlobalUnreadListener aísla perfectamente los mensajes de otros equipos');
}

// Test 3: Simulación de recordatorio individual vs global en sendConvocationAttendanceReminder
{
  console.log('\n[TEST 3] Destinatarios de sendConvocationAttendanceReminder');
  const conv = {
    id: 'conv_match_18',
    teamIds: ['2015'],
    list: {
      'p_2015_01': 'called',
      'p_2015_02': 'called',
      'p_2016_01': 'called', // convocado puntual de 2016
      'p_2017_01': 'uncalled' // jugador de 2017 no convocado
    },
    responses: {
      'p_2015_01': { status: 'attending' } // ya respondió
    }
  };

  const players = [
    { id: 'p_2015_01', name: 'Hugo 2015', teamId: '2015' },
    { id: 'p_2015_02', name: 'Lucas 2015', teamId: '2015' },
    { id: 'p_2016_01', name: 'Mateo 2016', teamId: '2016' },
    { id: 'p_2017_01', name: 'Leo 2017', teamId: '2017' }
  ];

  // Caso 3A: Recordatorio individual a p_2016_01
  let sentPrivateChats = [];
  let sentTeamChats = [];
  let sentReminders = [];

  function simulateSend(singlePlayerId = null) {
    sentPrivateChats = [];
    sentTeamChats = [];
    sentReminders = [];

    const calledPlayerIds = Object.keys(conv.list || {}).filter(pid => conv.list[pid] && conv.list[pid] !== 'uncalled');
    let pendingPlayers = calledPlayerIds.filter(pid => {
      const resp = conv.responses[pid];
      if (resp && (resp.status === 'attending' || resp.status === 'absent')) return false;
      return true;
    }).map(pid => players.find(p => p.id === pid));

    if (singlePlayerId) {
      pendingPlayers = pendingPlayers.filter(p => p.id === singlePlayerId);
    }

    const pendingPids = pendingPlayers.map(p => p.id);
    sentReminders.push({ targetPlayerIds: pendingPids });

    if (singlePlayerId) {
      sentPrivateChats.push(`coach_${singlePlayerId}`);
    } else {
      const targetTeamSet = new Set();
      if (conv.teamIds) conv.teamIds.forEach(tid => targetTeamSet.add(tid));
      pendingPlayers.forEach(p => { if (p.teamId) targetTeamSet.add(p.teamId); });
      for (const tid of targetTeamSet) {
        sentTeamChats.push(`team_${tid}`);
      }
    }
  }

  // Ejecutar recordatorio individual
  simulateSend('p_2016_01');
  assert.deepStrictEqual(sentReminders[0].targetPlayerIds, ['p_2016_01'], 'Recordatorio individual solo debe contener a p_2016_01');
  assert.deepStrictEqual(sentPrivateChats, ['coach_p_2016_01'], 'Chat debe ir únicamente al coach_p_2016_01');
  assert.strictEqual(sentTeamChats.length, 0, 'No se debe enviar a ningún chat grupal de equipo');
  console.log('✅ TEST 3A PASADO: Recordatorio individual solo va al jugador concreto');

  // Ejecutar recordatorio grupal
  simulateSend(null);
  assert(sentReminders[0].targetPlayerIds.includes('p_2015_02'), 'Debe incluir a p_2015_02');
  assert(sentReminders[0].targetPlayerIds.includes('p_2016_01'), 'Debe incluir a p_2016_01');
  assert(!sentReminders[0].targetPlayerIds.includes('p_2015_01'), 'NO debe incluir a p_2015_01 (ya asistió)');
  assert(!sentReminders[0].targetPlayerIds.includes('p_2017_01'), 'NO debe incluir a p_2017_01 (no convocado)');
  assert(sentTeamChats.includes('team_2015'), 'Debe enviar a chat del equipo 2015');
  assert(sentTeamChats.includes('team_2016'), 'Debe enviar a chat del equipo 2016');
  assert(!sentTeamChats.includes('team_2017'), 'NUNCA debe enviar al chat del equipo 2017');
  console.log('✅ TEST 3B PASADO: Recordatorio global solo va a los equipos involucrados y nunca a 2017');
}

// Test 4: Simulación de handleIncomingConvocationReminder en el teléfono secundario (2017)
{
  console.log('\n[TEST 4] Rechazo de recordatorio ajeno en el teléfono secundario');
  const myPlayerId = 'p_2017_01';
  const clubData = {
    convocations: [
      {
        id: 'conv_match_18',
        list: {
          'p_2015_02': 'called',
          'p_2016_01': 'called'
        }
      }
    ]
  };

  function shouldHandleReminder(reminder) {
    if (!reminder || !reminder.id) return false;
    if (!myPlayerId) return false;

    // 1. Filtrar si va dirigido a una lista de IDs concreta y yo NO estoy incluido
    if (Array.isArray(reminder.targetPlayerIds) && reminder.targetPlayerIds.length > 0) {
      if (!reminder.targetPlayerIds.map(String).includes(String(myPlayerId))) {
        return false;
      }
    }

    // 2. Comprobar si el jugador realmente está convocado
    const convId = reminder.convId;
    if (convId && clubData && Array.isArray(clubData.convocations)) {
      const conv = clubData.convocations.find(c => c.id === convId);
      if (conv) {
        if (!conv.list || !conv.list[myPlayerId] || conv.list[myPlayerId] === 'uncalled' || conv.list[myPlayerId] === 'absent') {
          return false;
        }
      }
    }

    return true;
  }

  // Reminder dirigido a 2015_02 y 2016_01
  const reminder2015 = {
    id: 'rem_123',
    convId: 'conv_match_18',
    targetPlayerIds: ['p_2015_02', 'p_2016_01']
  };

  assert.strictEqual(shouldHandleReminder(reminder2015), false, 'El jugador 2017 debe descartar el recordatorio');
  console.log('✅ TEST 4 PASADO: Teléfono secundario descarta recordatorio de 2015/2016');
}

console.log('\n======================================================');
console.log('TODAS LAS PRUEBAS DE AISLAMIENTO Y FILTRADO PASARON OK');
console.log('======================================================\n');

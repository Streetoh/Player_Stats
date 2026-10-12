/* =========================================================
   Reset All Chats Script
   Elimina todos los mensajes y chats antiguos de Firestore
   para comenzar desde cero de forma limpia.
   ========================================================= */
const https = require('https');

const API_KEY = 'AIzaSyAC0np50XF3SVx2AHFv8LAFKaQuT-48nhw';
const BASE_URL = 'https://firestore.googleapis.com/v1/';

function req(urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = BASE_URL + urlPath + (urlPath.includes('?') ? '&' : '?') + 'key=' + API_KEY;
    const u = new URL(fullUrl);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {}
    };
    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const r = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function resetAllChats() {
  console.log('🔄 Consultando chats en Firestore...');
  const chatsRes = await req('projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/chats');
  const chatDocs = chatsRes.data.documents || [];
  console.log(`📋 Encontrados ${chatDocs.length} chats para resetear.`);

  for (const cDoc of chatDocs) {
    const chatId = cDoc.name.split('/').pop();
    console.log(`\n🧹 Limpiando chat: ${chatId}`);

    // Eliminar todos los mensajes dentro de la subcolección
    let pageToken = '';
    let totalMsgs = 0;
    do {
      const q = 'projects/player-stats-2ac9d/databases/(default)/documents/clubs/default_club/chats/' + chatId + '/messages' + (pageToken ? '?pageToken=' + pageToken : '');
      const msgsRes = await req(q);
      const msgs = (msgsRes.data && msgsRes.data.documents) || [];
      for (const m of msgs) {
        await req(m.name, 'DELETE');
        totalMsgs++;
      }
      pageToken = (msgsRes.data && msgsRes.data.nextPageToken) || '';
    } while (pageToken);

    console.log(`   - Eliminados ${totalMsgs} mensajes.`);
    await req(cDoc.name, 'DELETE');
    console.log(`   - Chat reseteado.`);
  }

  console.log('\n✅ ¡Todos los chats y mensajes han sido reseteados con éxito!');
}

resetAllChats();

const fs = require('fs');
const path = require('path');

// Load dumped keys
const i18nKeys = require('./i18n_keys.json');
const playerKeys = require('./player_keys.json');

console.log('Generating translations...');

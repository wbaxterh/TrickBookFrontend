const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.copyFileSync(path.join(root, '../assets/models/kaori.vrm'), path.join(root, 'public/kaori.vrm'));
console.log('Kaori model prepared.');

// Force TypeScript to recognize the file rename
const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'src', 'App.tsx');
const stat = fs.statSync(appPath);
fs.utimesSync(appPath, new Date(), new Date());
console.log('Touched App.tsx');

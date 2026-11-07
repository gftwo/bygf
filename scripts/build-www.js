// Menyalin file situs ke ./www (folder yang dibungkus Capacitor) + membundel plugin native.
// Tidak mengubah file situs asli di root repo.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.json', 'sw.js']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'icons']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
execSync(`npx esbuild native/plugins.js --bundle --minify --format=iife --outfile=www/native-plugins.js`, { cwd: root, stdio: 'inherit' });
// sisipkan pemuat plugin sebelum skrip lain di index.html versi APK
const p = path.join(out, 'index.html'); let h = fs.readFileSync(p, 'utf8');
if (!h.includes('</head>')) throw new Error('index.html tidak punya </head>');
h = h.replace('</head>', '<script src="native-plugins.js"></script>\n</head>'); fs.writeFileSync(p, h);
console.log('www siap:', fs.readdirSync(out).join(', '));

import fs from 'node:fs';
import { put } from '@vercel/blob';

const INPUT = process.argv[2];
if (!INPUT) {
  console.log('Usage: node --env-file=.env.local migrate-photos.mjs path/to/old-gallery-data.json');
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const password = state.galleryPassword || null;

// Same encryption code as your website, so locked photos stay locked
function encodeUTF8(t) { return unescape(encodeURIComponent(t)); }
function decodeUTF8(b) { return decodeURIComponent(escape(b)); }
function encryptData(text, key) {
  if (!text || !key) return text;
  const data = encodeUTF8(text), k = encodeUTF8(key);
  let res = '';
  for (let i = 0; i < data.length; i++) res += String.fromCharCode(data.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  return btoa(res);
}
function decryptData(b64, key) {
  if (!b64 || !key) return b64;
  try {
    const data = atob(b64), k = encodeUTF8(key);
    let res = '';
    for (let i = 0; i < data.length; i++) res += String.fromCharCode(data.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    return decodeUTF8(res);
  } catch (e) { return null; }
}

let uploaded = 0;
async function convert(obj, isLocked) {
  if (!obj || !obj.src) return;
  if (isLocked && !password) { console.log('Skipping a locked photo: no password in file'); return; }
  const plain = isLocked ? decryptData(obj.src, password) : obj.src;
  if (!plain || !plain.startsWith('data:image')) return; // already a link, skip

  const comma = plain.indexOf(',');
  const header = plain.slice(0, comma);                 // e.g. data:image/webp;base64
  const mime = header.slice(5, header.indexOf(';'));    // e.g. image/webp
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(plain.slice(comma + 1), 'base64');

  const blob = await put(`gallery/photo.${ext}`, buffer, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: true,
  });
  obj.src = isLocked ? encryptData(blob.url, password) : blob.url;
  uploaded++;
  console.log(`Uploaded ${uploaded}: ${blob.url}`);
}

const sections = [];
for (const item of state.items) {
  if (item.sections) sections.push(...item.sections);
  else sections.push(item);
}

try {
  for (const sec of sections) {
    for (const p of sec.photos || []) {
      if (p.type === 'text') continue;
      if (p.type === 'group') {
        for (let i = 0; i < p.sources.length; i++) {
          let s = p.sources[i];
          if (typeof s === 'string') { s = { src: s, title: '', desc: '', locked: false }; p.sources[i] = s; }
          await convert(s, !!s.locked);
        }
      } else {
        await convert(p, !!p.locked);
      }
    }
  }
} finally {
  fs.writeFileSync('new-gallery-data.json', JSON.stringify(state));
  console.log(`Done. ${uploaded} photos uploaded. Wrote new-gallery-data.json`);
}
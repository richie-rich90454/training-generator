import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('assets/icon.svg');
const DENSITY = 384;

async function renderPng(size) {
    return sharp(svg, { density: DENSITY })
        .resize(size, size)
        .png()
        .toBuffer();
}

// --- Multi-resolution ICO with PNG-compressed entries (Vista+, tiny file size) ---
// ICO format: 6-byte ICONDIR header + 16-byte ICONDIRENTRY per image + image data.
// PNG entries are just the raw PNG bytes (supported by Windows Vista+ for sizes > 0).
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoPngs = [];
for (const size of icoSizes) {
    const buf = await renderPng(size);
    icoPngs.push({ size, png: buf });
    console.log(`  ICO PNG ${size}x${size}: ${buf.length} bytes`);
}

function buildIco(entries) {
    const HEADER = 6;
    const ENTRY = 16;
    const dirSize = HEADER + entries.length * ENTRY;
    let total = dirSize;
    for (const e of entries) total += e.png.length;
    const buf = Buffer.alloc(total);
    let off = 0;
    // ICONDIR
    buf.writeUInt16LE(0, off); off += 2;          // reserved
    buf.writeUInt16LE(1, off); off += 2;          // type = ICO
    buf.writeUInt16LE(entries.length, off); off += 2; // count
    // ICONDIRENTRY array
    let imgOffset = dirSize;
    for (const e of entries) {
        const dim = e.size === 256 ? 0 : e.size;   // 0 means 256
        buf.writeUInt8(dim, off); off += 1;         // width
        buf.writeUInt8(dim, off); off += 1;         // height
        buf.writeUInt8(0, off); off += 1;           // color count (0 = >256)
        buf.writeUInt8(0, off); off += 1;           // reserved
        buf.writeUInt16LE(1, off); off += 2;        // color planes
        buf.writeUInt16LE(32, off); off += 2;       // bits per pixel (RGBA)
        buf.writeUInt32LE(e.png.length, off); off += 4; // bytes in res
        buf.writeUInt32LE(imgOffset, off); off += 4;   // image offset
        imgOffset += e.png.length;
    }
    // Image data
    for (const e of entries) {
        e.png.copy(buf, off); off += e.png.length;
    }
    return buf;
}

const ico = buildIco(icoPngs);
writeFileSync('assets/favicon.ico', ico);
console.log(`Wrote assets/favicon.ico (${ico.length} bytes) — multi-res PNG: ${icoSizes.join(', ')}`);

// --- ICNS (manual encoder, PNG-based entries per Apple's ICNS spec) ---
const icnsEntries = [
    { type: 'ic11', size: 32 },    // 16x16@2x
    { type: 'ic12', size: 64 },    // 32x32@2x
    { type: 'ic07', size: 128 },   // 128x128
    { type: 'ic08', size: 256 },   // 256x256
    { type: 'ic09', size: 512 },   // 512x512
    { type: 'ic10', size: 1024 },  // 512x512@2x
];
const icnsPngs = [];
for (const entry of icnsEntries) {
    const buf = await renderPng(entry.size);
    icnsPngs.push({ type: entry.type, data: buf });
    console.log(`  ICNS PNG ${entry.size}x${entry.size} (${entry.type}): ${buf.length} bytes`);
}

function buildIcns(entries) {
    const HEADER = 8;
    let total = HEADER;
    for (const e of entries) total += 8 + e.data.length;
    const buf = Buffer.alloc(total);
    let off = 0;
    buf.write('icns', off, 4, 'ascii'); off += 4;
    buf.writeUInt32BE(total, off); off += 4;
    for (const e of entries) {
        buf.write(e.type, off, 4, 'ascii'); off += 4;
        const entryLen = 8 + e.data.length;
        buf.writeUInt32BE(entryLen, off); off += 4;
        e.data.copy(buf, off); off += e.data.length;
    }
    return buf;
}

const icns = buildIcns(icnsPngs);
writeFileSync('assets/favicon.icns', icns);
console.log(`Wrote assets/favicon.icns (${icns.length} bytes)`);

console.log('Done.');

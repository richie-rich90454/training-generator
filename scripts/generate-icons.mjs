import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
let svg=readFileSync("assets/icon.svg");
let DENSITY=384;
function renderPng(size){
    let cmd=`magick -background none -density ${DENSITY} assets/icon.svg -resize ${size}x${size} -depth 8 PNG:-`;
    return execSync(cmd);
}
function buildIco(sizes){
    let entries=[];
    for(let size of sizes){
        let png=renderPng(size);
        entries.push({size:size,png:png});
        console.log(`  ICO PNG ${size}x${size}: ${png.length} bytes`);
    }
    let HEADER=6;
    let ENTRY=16;
    let dirSize=HEADER+entries.length*ENTRY;
    let total=dirSize;
    for(let e of entries)total+=e.png.length;
    let buf=Buffer.alloc(total);
    let off=0;
    buf.writeUInt16LE(0,off);off+=2;
    buf.writeUInt16LE(1,off);off+=2;
    buf.writeUInt16LE(entries.length,off);off+=2;
    let imgOffset=dirSize;
    for(let e of entries){
        let dim=e.size===256?0:e.size;
        buf.writeUInt8(dim,off);off+=1;
        buf.writeUInt8(dim,off);off+=1;
        buf.writeUInt8(0,off);off+=1;
        buf.writeUInt8(0,off);off+=1;
        buf.writeUInt16LE(1,off);off+=2;
        buf.writeUInt16LE(32,off);off+=2;
        buf.writeUInt32LE(e.png.length,off);off+=4;
        buf.writeUInt32LE(imgOffset,off);off+=4;
        imgOffset+=e.png.length;
    }
    for(let e of entries){
        e.png.copy(buf,off);off+=e.png.length;
    }
    return buf;
}
function buildIcns(entries){
    let pngs=[];
    for(let entry of entries){
        let buf=renderPng(entry.size);
        pngs.push({type:entry.type,data:buf});
        console.log(`  ICNS PNG ${entry.size}x${entry.size} (${entry.type}): ${buf.length} bytes`);
    }
    let HEADER=8;
    let total=HEADER;
    for(let e of pngs)total+=8+e.data.length;
    let buf=Buffer.alloc(total);
    let off=0;
    buf.write("icns",off,4,"ascii");off+=4;
    buf.writeUInt32BE(total,off);off+=4;
    for(let e of pngs){
        buf.write(e.type,off,4,"ascii");off+=4;
        let entryLen=8+e.data.length;
        buf.writeUInt32BE(entryLen,off);off+=4;
        e.data.copy(buf,off);off+=e.data.length;
    }
    return buf;
}
async function main(){
    let faviconIcoSizes=[16,32,48,64,128,256];
    let faviconIco=buildIco(faviconIcoSizes);
    writeFileSync("assets/favicon.ico",faviconIco);
    console.log(`Wrote assets/favicon.ico (${faviconIco.length} bytes) — multi-res PNG: ${faviconIcoSizes.join(", ")}`);
    let icnsEntries=[
        {type:"ic11",size:32},
        {type:"ic12",size:64},
        {type:"ic07",size:128},
        {type:"ic08",size:256},
        {type:"ic09",size:512},
        {type:"ic10",size:1024}
    ];
    let icns=buildIcns(icnsEntries);
    writeFileSync("assets/favicon.icns",icns);
    console.log(`Wrote assets/favicon.icns (${icns.length} bytes)`);
    let faviconPng=renderPng(256);
    writeFileSync("assets/favicon.png",faviconPng);
    console.log(`Wrote assets/favicon.png (${faviconPng.length} bytes)`);
    let iconPng=renderPng(256);
    writeFileSync("assets/icon.png",iconPng);
    console.log(`Wrote assets/icon.png (${iconPng.length} bytes)`);
    let trayIcoSizes=[16,24,32,48,64,128];
    let trayIco=buildIco(trayIcoSizes);
    writeFileSync("assets/tray-icon.ico",trayIco);
    console.log(`Wrote assets/tray-icon.ico (${trayIco.length} bytes) — multi-res PNG: ${trayIcoSizes.join(", ")}`);
    let trayPng=renderPng(256);
    writeFileSync("assets/tray-icon.png",trayPng);
    console.log(`Wrote assets/tray-icon.png (${trayPng.length} bytes)`);
    writeFileSync("assets/tray-icon.svg",svg);
    console.log("Wrote assets/tray-icon.svg (copy of icon.svg)");
    console.log("Done.");
}
main().catch(err=>{
    console.error(err);
    process.exit(1);
});

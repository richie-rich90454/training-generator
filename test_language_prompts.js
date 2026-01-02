let fs=require("fs");
let path=require("path");
console.log("Testing language prompt files...\n");
let promptsDir=path.join(__dirname,"src","prompts");
if(!fs.existsSync(promptsDir)){
    console.error("ERROR:Prompts directory does not exist:",promptsDir);
    process.exit(1);
}
console.log("✓ Prompts directory exists:",promptsDir);
let files=fs.readdirSync(promptsDir);
console.log(`\nFound ${files.length}prompt files:`);
files.forEach(file=>{
    let filePath=path.join(promptsDir,file);
    let stats=fs.statSync(filePath);
    console.log(`-${file}(${stats.size}bytes)`);
});
let languagesInDropdown=["en","zh-Hans","zh-Hant","es","fr","de","ja","ko"];
let requiredTypes=["instruction","conversation","chunking","custom"];
console.log("\nChecking language files for dropdown languages:");
let allLanguagesComplete=true;
for(let lang of languagesInDropdown){
    console.log(`\n${lang}:`);
    let languageComplete=true;
    for(let type of requiredTypes){
        let fileName=`${lang}_${type}.txt`;
        let filePath=path.join(promptsDir,fileName);
        if(fs.existsSync(filePath)){
            console.log(` ✓ ${fileName}`);
            let content=fs.readFileSync(filePath,"utf8");
            if(!content.includes("{{text}}")){
                console.log(` WARNING:${fileName}missing{{text}}placeholder`);
            }
        }
        else{
            console.log(` ✗ ${fileName}(MISSING)`);
            languageComplete=false;
            allLanguagesComplete=false;
        }
    }
    if(languageComplete){
        console.log(` ✅ ${lang}has all prompt files`);
    }
    else{
        console.log(` ❌ ${lang}missing some prompt files`);
    }
}
console.log("\nVerifying English fallback files(required):");
let allEnglishFilesExist=true;
for(let type of requiredTypes){
    let fileName=`en_${type}.txt`;
    let filePath=path.join(promptsDir,fileName);
    if(fs.existsSync(filePath)){
        console.log(` ✓ ${fileName}exists`);
    }
    else{
        console.log(` ✗ ${fileName}MISSING-CRITICAL ERROR`);
        allEnglishFilesExist=false;
    }
}
if(allEnglishFilesExist&&allLanguagesComplete){
    console.log("\n✅ Language prompt system is fully functional!");
    console.log(" All 8 languages have complete prompt files:");
    console.log("-English(en)");
    console.log("-Chinese Simplified(zh-Hans)");
    console.log("-Chinese Traditional(zh-Hant)");
    console.log("-Spanish(es)");
    console.log("-French(fr)");
    console.log("-German(de)");
    console.log("-Japanese(ja)");
    console.log("-Korean(ko)");
}
else if(allEnglishFilesExist){
    console.log("\n⚠️ Language prompt system is functional but incomplete");
    console.log(" Missing language files will fall back to English.");
    console.log(" Users can select from 8 languages in the dropdown.");
}
else{
    console.log("\n❌ Critical error:English fallback files missing!");
    process.exit(1);
}
console.log("\nChecking file naming consistency...");
let filePattern=/^[a-z]{2}(-[A-Za-z]{2,5})?_(instruction|conversation|chunking|custom)\.txt$/;
let invalidFiles=files.filter(file=>!filePattern.test(file));
if(invalidFiles.length==0){
    console.log("✓ All files follow naming convention");
}
else{
    console.log("✗ Files with invalid naming:");
    invalidFiles.forEach(file=>console.log(`-${file}`));
}
#!/usr/bin/env node
const{program}=require("commander");
const chalk=require("chalk").default;
const figlet=require("figlet");
const path=require("path");
const fs=require("fs").promises;
const ProcessingEngine=require("./src/shared/processingEngine");
const cliProgress=require("cli-progress");
const packageJson=require("./package.json");
const version=packageJson.version;
console.log(chalk.cyan(figlet.textSync("Training Generator",{horizontalLayout:"full"})));
console.log(chalk.gray(`CLI Version ${version}-Convert documents to AI training data\n`));
const engine=new ProcessingEngine();
const progressBar=new cliProgress.SingleBar({
    format:`${chalk.cyan("{bar}")}${chalk.white("{percentage}%")}| ${chalk.gray("{value}/{total}")}| ${chalk.yellow("{status}")}`,
    barCompleteChar:"\u2588",
    barIncompleteChar:"\u2591",
    hideCursor:true
});
program
    .name("training-generator")
    .description("Convert documents to AI training data using Ollama")
    .version(version);
program
    .command("process")
    .description("Process one or more files")
    .argument("<files...>","Files to process(supports glob patterns)")
    .option("-m,--model<name>","Ollama model to use(default:first available)")
    .option("-t,--type<type>","Processing type:instruction,conversation,chunking,custom(default:instruction)")
    .option("-f,--format<format>","Output format:jsonl,json,csv,text,chatml(default:jsonl)")
    .option("-l,--language<lang>","Language:en,zh-Hans,zh-Hant,es,fr,de,ja,ko(default:en)")
    .option("-c,--chunk-size<size>","Chunk size in characters(default:2000)",parseInt)
    .option("--temperature<value>","Temperature for AI generation 0.0-1.0(default:0.7)",parseFloat)
    .option("--ollama-url<url>","Ollama API URL(default:http://localhost:11434)")
    .option("--no-progress","Disable progress bar")
    .option("-v,--verbose","Verbose output")
    .action(async(files,options)=>{
        try{
            console.log(chalk.blue("Initializing processing engine..."));
            const initResult=await engine.initialize();
            if(!initResult.success){
                console.error(chalk.red("Failed to initialize processing engine:"),initResult.error);
                process.exit(1);
            }
            console.log(chalk.blue("Checking Ollama connection..."));
            const ollamaStatus=await engine.checkOllamaStatus();
            if(!ollamaStatus.running){
                console.error(chalk.red("Ollama is not running. Please start Ollama with:ollama serve"));
                console.log(chalk.yellow("Ollama error:"),ollamaStatus.error);
                process.exit(1);
            }
            console.log(chalk.green(`✓ Ollama is running(${ollamaStatus.version})`));
            console.log(chalk.gray(`Available models:${ollamaStatus.models.map(m=>m.name).join(",")}`));
            let model=options.model;
            if(!model&&ollamaStatus.models.length>0){
                model=ollamaStatus.models[0].name;
                console.log(chalk.yellow(`No model specified,using:${model}`));
            }
            else if(!model){
                console.error(chalk.red("No models available in Ollama. Please pull a model first:ollama pull llama3.2"));
                process.exit(1);
            }
            const glob=require("glob");
            const expandedFiles=[];
            for(const pattern of files){
                const matches=glob.sync(pattern,{nodir:true});
                if(matches.length===0){
                    console.warn(chalk.yellow(`No files found matching:${pattern}`));
                }
                expandedFiles.push(...matches);
            }
            if(expandedFiles.length===0){
                console.error(chalk.red("No valid files found to process"));
                process.exit(1);
            }
            console.log(chalk.blue(`Found ${expandedFiles.length}file(s)to process`));
            const validFiles=[];
            for(const file of expandedFiles){
                try{
                    const stats=await fs.stat(file);
                    const ext=path.extname(file).toLowerCase().replace(".","");
                    if(!engine.supportedFormats.includes(ext)){
                        console.warn(chalk.yellow(`Skipping unsupported format:${file}(${ext})`));
                        continue;
                    }
                    if(stats.size>100*1024*1024){
                        console.warn(chalk.yellow(`Skipping large file:${file}(${formatFileSize(stats.size)})`));
                        continue;
                    }
                    validFiles.push(file);
                }
                catch(error){
                    console.warn(chalk.yellow(`Skipping inaccessible file:${file}(${error.message})`));
                }
            }
            if(validFiles.length===0){
                console.error(chalk.red("No valid files to process after validation"));
                process.exit(1);
            }
            console.log(chalk.blue(`Processing ${validFiles.length}file(s)...`));
            const results=[];
            let totalItems=0;
            let successfulFiles=0;
            let failedFiles=0;
            if(options.progress){
                progressBar.start(validFiles.length,0,{status:"Starting..."});
            }
            for(let i=0;i<validFiles.length;i++){
                const file=validFiles[i];
                if(options.progress){
                    progressBar.update(i,{status:`Processing:${path.basename(file)}`});
                }
                else if(options.verbose){
                    console.log(chalk.blue(`Processing ${i+1}/${validFiles.length}:${file}`));
                }
                try{
                    const result=await engine.processFile(file,{
                        model,
                        processingType:options.type||"instruction",
                        outputFormat:options.format||"jsonl",
                        language:options.language||"en",
                        chunkSize:options.chunkSize||2000,
                        temperature:options.temperature||0.7,
                        onProgress:(percent,message)=>{
                            if(options.verbose &&!options.progress){
                                console.log(chalk.gray(` ${Math.round(percent)}%:${message}`));
                            }
                        }
                    });
                    if(result.success){
                        const outputPath=getOutputPath(file,options.format||"jsonl");
                        const formattedOutput=engine.formatOutput(result.items,options.format||"jsonl");
                        await fs.writeFile(outputPath,formattedOutput,"utf-8");
                        results.push({
                            file,
                            success:true,
                            outputPath,
                            items:result.items.length,
                            stats:result.stats
                        });
                        totalItems+=result.items.length;
                        successfulFiles++;
                        if(options.verbose){
                            console.log(chalk.green(` ✓ Generated ${result.items.length}items`));
                            console.log(chalk.gray(` Saved to:${outputPath}`));
                        }
                    }
                    else{
                        results.push({
                            file,
                            success:false,
                            error:result.error
                        });
                        failedFiles++;
                        if(options.verbose){
                            console.log(chalk.red(` ✗ Failed:${result.error}`));
                        }
                    }
                }
                catch(error){
                    results.push({
                        file,
                        success:false,
                        error:error.message
                    });
                    failedFiles++;
                    if(options.verbose){
                        console.log(chalk.red(` ✗ Error:${error.message}`));
                    }
                }
            }
            if(options.progress){
                progressBar.update(validFiles.length,{status:"Complete!"});
                progressBar.stop();
            }
            console.log("\n"+chalk.cyan("=".repeat(50)));
            console.log(chalk.bold("PROCESSING SUMMARY"));
            console.log(chalk.cyan("=".repeat(50)));
            console.log(chalk.white(`Total files processed:${validFiles.length}`));
            console.log(chalk.green(`Successful:${successfulFiles}`));
            if(failedFiles>0){
                console.log(chalk.red(`Failed:${failedFiles}`));
            }
            console.log(chalk.white(`Total training items generated:${totalItems}`));
            if(successfulFiles>0){
                console.log(chalk.green("\n✓ Processing completed successfully!"));
                console.log(chalk.gray('Output files saved in same directory as input files with "_training" suffix.'));
            }
            else{
                console.log(chalk.red("\n✗ Processing failed for all files"));
                process.exit(1);
            }
        }
        catch(error){
            console.error(chalk.red("Fatal error:"),error.message);
            if(options.verbose){
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    });
program
    .command("status")
    .description("Check Ollama status and available models")
    .action(async()=>{
        try{
            console.log(chalk.blue("Checking Ollama status..."));
            await engine.initialize();
            const status=await engine.checkOllamaStatus();
            if(status.running){
                console.log(chalk.green("✓ Ollama is running"));
                console.log(chalk.white(` Version:${status.version}`));
                console.log(chalk.white(` Models available:${status.models.length}`));
                if(status.models.length>0){
                    console.log(chalk.cyan("\nAvailable models:"));
                    status.models.forEach((model,index)=>{
                        console.log(chalk.white(` ${index+1}. ${model.name}`));
                    });
                }
            }
            else{
                console.log(chalk.red("✗ Ollama is not running"));
                console.log(chalk.yellow("Error:"),status.error);
                console.log(chalk.cyan("\nTo start Ollama:"));
                console.log(chalk.white(" 1. Install Ollama from https://ollama.com/"));
                console.log(chalk.white(" 2. Run:ollama serve"));
                console.log(chalk.white(" 3. Pull a model:ollama pull llama3.2"));
            }
        }
        catch(error){
            console.error(chalk.red("Error checking status:"),error.message);
            process.exit(1);
        }
    });
program
    .command("list-formats")
    .description("List supported file formats")
    .action(()=>{
        console.log(chalk.cyan("Supported file formats:"));
        engine.supportedFormats.forEach(format=>{
            console.log(chalk.white(` • ${format.toUpperCase()}`));
        });
        console.log(chalk.gray("\nNote:Maximum file size is 100MB"));
    });
function formatFileSize(bytes){
    if(bytes===0)return "0 Bytes";
    const k=1024;
    const sizes=["Bytes","KB","MB","GB"];
    const i=Math.floor(Math.log(bytes)/Math.log(k));
    return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+sizes[i];
}
function getOutputPath(inputPath,format){
    const dir=path.dirname(inputPath);
    const name=path.basename(inputPath,path.extname(inputPath));
    const extension=getExtensionForFormat(format);
    return path.join(dir,`${name}_training.${extension}`);
}
function getExtensionForFormat(format){
    const extensions={
        "jsonl":"jsonl",
        "json":"json",
        "csv":"csv",
        "text":"txt",
        "chatml":"json"
    };
    return extensions[format]||"jsonl";
}
program.parse();
if(!process.argv.slice(2).length){
    program.outputHelp();
    console.log(chalk.cyan("\nExamples:"));
    console.log(chalk.white(" $ training-generator process document.pdf"));
    console.log(chalk.white(" $ training-generator process--model llama3.2--type instruction*.pdf"));
    console.log(chalk.white(" $ training-generator process--format jsonl--language zh-Hans report.docx"));
    console.log(chalk.white(" $ training-generator status"));
}
import{describe,test,expect}from "vitest"
import{TrainingItemMetadata,ProviderConfig,ValidatorConfig,WebhookConfig,AppSettings,FullAppSettings,Citation,QualityScores,WorkspaceConfig,InstructionTrainingItem,ChatMLTrainingItem,TextTrainingItem}from "../src/types/interfaces"

describe("FileObj interface",()=>{
    test("has all required fields",()=>{
        let fileObj={
            path:"/path/to/test.pdf",
            name:"test.pdf",
            size:1024,
            type:"pdf",
            lastModified:new Date()
        }
        expect(fileObj.path).toBe("/path/to/test.pdf")
        expect(fileObj.name).toBe("test.pdf")
        expect(fileObj.size).toBe(1024)
        expect(fileObj.type).toBe("pdf")
        expect(fileObj.lastModified).toBeInstanceOf(Date)
    })

    test("type can be various file extensions",()=>{
        let types=["pdf","docx","doc","rtf","txt","md","html"]
        for(let type of types){
            let fileObj={path:"/file."+type,name:"file."+type,size:100,type,lastModified:new Date()}
            expect(fileObj.type).toBe(type)
        }
    })
})

describe("OllamaModel interface",()=>{
    test("has required name field",()=>{
        let model={name:"llama2:7b"}
        expect(model.name).toBe("llama2:7b")
    })

    test("has optional fields",()=>{
        let model={
            name:"llama2:7b",
            size:4000000000,
            modified_at:"2024-01-01",
            digest:"abc123"
        }
        expect(model.size).toBe(4000000000)
        expect(model.modified_at).toBe("2024-01-01")
        expect(model.digest).toBe("abc123")
    })
})

describe("OllamaStatus interface",()=>{
    test("running status with models",()=>{
        let status={
            running:true,
            models:[{name:"llama2",size:4000000000,modified_at:"2024-01-01"}],
            version:"0.1.0"
        }
        expect(status.running).toBe(true)
        expect(status.models).toHaveLength(1)
        expect(status.version).toBe("0.1.0")
    })

    test("not running status with error",()=>{
        let status={
            running:false,
            models:[],
            error:"Connection refused"
        }
        expect(status.running).toBe(false)
        expect(status.models).toHaveLength(0)
        expect(status.error).toBe("Connection refused")
    })

    test("running status with empty models",()=>{
        let status={
            running:true,
            models:[],
            version:"0.1.0"
        }
        expect(status.running).toBe(true)
        expect(status.models).toHaveLength(0)
    })
})

describe("OllamaGenerateOptions interface",()=>{
    test("has optional temperature and top_p",()=>{
        let options={temperature:0.7,top_p:0.9}
        expect(options.temperature).toBe(0.7)
        expect(options.top_p).toBe(0.9)
    })

    test("accepts additional string keys",()=>{
        let options={temperature:0.7,num_predict:512,custom:"value"}
        expect(options.num_predict).toBe(512)
    })

    test("empty options are valid",()=>{
        let options={}
        expect(Object.keys(options)).toHaveLength(0)
    })
})

describe("OllamaGenerateResult interface",()=>{
    test("success result has response",()=>{
        let result={success:true,response:"Generated text here"}
        expect(result.success).toBe(true)
        expect(result.response).toBe("Generated text here")
    })

    test("error result has error message",()=>{
        let result={success:false,error:"Model not found"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("Model not found")
    })
})

describe("TrainingItem interface",()=>{
    test("instruction format",()=>{
        let item={
            instruction:"Be helpful",
            input:"Hello",
            output:"Hi there!"
        }
        expect(item.instruction).toBeDefined()
        expect(item.input).toBeDefined()
        expect(item.output).toBeDefined()
    })

    test("chatml format with messages",()=>{
        let item={
            messages:[
                {role:"system",content:"You are helpful."},
                {role:"user",content:"Hello"},
                {role:"assistant",content:"Hi!"}
            ]
        }
        expect(item.messages).toHaveLength(3)
        expect(item.messages![0].role).toBe("system")
        expect(item.messages![1].role).toBe("user")
        expect(item.messages![2].role).toBe("assistant")
    })

    test("text format",()=>{
        let item={text:"Raw training text content"}
        expect(item.text).toBeDefined()
    })

    test("all fields are optional",()=>{
        let item={}
        expect(item).toBeDefined()
    })
})

describe("WorkerMessage and WorkerResult interfaces",()=>{
    test("WorkerMessage has id and buffer",()=>{
        let message={id:1,buffer:Buffer.from("test")}
        expect(message.id).toBe(1)
        expect(Buffer.isBuffer(message.buffer)).toBe(true)
    })

    test("WorkerResult success",()=>{
        let result={id:1,success:true,text:"extracted"}
        expect(result.id).toBe(1)
        expect(result.success).toBe(true)
    })

    test("WorkerResult with warning",()=>{
        let result={id:1,success:true,text:"text",warning:"fallback used"}
        expect(result.warning).toBe("fallback used")
    })

    test("WorkerResult error",()=>{
        let result={id:1,success:false,error:"parse failed"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("parse failed")
    })
})

describe("AppSettings interface",()=>{
    test("has optional fields",()=>{
        let settings={
            model:"llama2",
            processingType:"qa",
            outputFormat:"jsonl",
            language:"en",
            chunkSize:"1000"
        }
        expect(settings.model).toBe("llama2")
        expect(settings.processingType).toBe("qa")
        expect(settings.outputFormat).toBe("jsonl")
        expect(settings.language).toBe("en")
        expect(settings.chunkSize).toBe("1000")
    })

    test("empty settings are valid",()=>{
        let settings={}
        expect(Object.keys(settings)).toHaveLength(0)
    })
})

describe("FullAppSettings interface",()=>{
    test("has optional UI preferences",()=>{
        let settings={
            theme:"dark",
            fontSize:"medium",
            "auto-save":true,
            "auto-check-ollama":true,
            "start-maximized":false,
            "remember-window-size":true,
            "max-file-size":50
        }
        expect(settings.theme).toBe("dark")
        expect(settings["auto-save"]).toBe(true)
        expect(settings["max-file-size"]).toBe(50)
    })
})

describe("ReadFileResult and SaveFileResult interfaces",()=>{
    test("ReadFileResult success",()=>{
        let result={success:true,content:"file contents"}
        expect(result.success).toBe(true)
        expect(result.content).toBe("file contents")
    })

    test("ReadFileResult error",()=>{
        let result={success:false,error:"File not found"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("File not found")
    })

    test("SaveFileResult success",()=>{
        let result={success:true}
        expect(result.success).toBe(true)
    })

    test("SaveFileResult error",()=>{
        let result={success:false,error:"Permission denied"}
        expect(result.success).toBe(false)
        expect(result.error).toBe("Permission denied")
    })
})

describe("ParseBatchResult and ParseBatchItem interfaces",()=>{
    test("ParseBatchItem success",()=>{
        let item={filePath:"/test.pdf",success:true,text:"content",error:null}
        expect(item.success).toBe(true)
        expect(item.error).toBeNull()
    })

    test("ParseBatchItem error",()=>{
        let item={filePath:"/test.pdf",success:false,text:"",error:"Failed"}
        expect(item.success).toBe(false)
        expect(item.error).toBe("Failed")
    })

    test("ParseBatchResult success",()=>{
        let result={success:true,results:[{filePath:"/a.pdf",success:true,text:"a",error:null}]}
        expect(result.success).toBe(true)
        expect(result.results).toHaveLength(1)
    })

    test("ParseBatchResult error",()=>{
        let result={success:false,error:"Batch failed"}
        expect(result.success).toBe(false)
    })
})
describe("TrainingItemMetadata interface",()=>{
    test("can be created with all optional fields",()=>{
        let metadata:TrainingItemMetadata={
            difficulty:"hard",
            topic:"machine learning",
            bloomLevel:"analyze",
            citations:[{text:"cite text",page:1,line:5}],
            qualityScores:{overall:0.9,perplexity:50.5,diversity:0.7,bias:0.1,toxicity:0.0,hallucination:0.2,factualConsistency:0.95,grammar:0.99,readingLevel:8,coverage:0.85,completeness:0.9,ambiguity:0.1,adversarial:0.3},
            tags:["ml","ai"],
            piiFlags:["email"],
            sourceSpan:{start:0,end:100},
            note:"important note",
            bookmarked:true,
            deletedAt:null,
            sensitive:false
        }
        expect(metadata.difficulty).toBe("hard")
        expect(metadata.topic).toBe("machine learning")
        expect(metadata.bloomLevel).toBe("analyze")
        expect(metadata.citations).toHaveLength(1)
        expect(metadata.qualityScores?.overall).toBe(0.9)
        expect(metadata.tags).toHaveLength(2)
        expect(metadata.piiFlags).toHaveLength(1)
        expect(metadata.sourceSpan?.start).toBe(0)
        expect(metadata.sourceSpan?.end).toBe(100)
        expect(metadata.note).toBe("important note")
        expect(metadata.bookmarked).toBe(true)
        expect(metadata.deletedAt).toBeNull()
        expect(metadata.sensitive).toBe(false)
    })
    test("can be created empty",()=>{
        let metadata:TrainingItemMetadata={}
        expect(metadata).toBeDefined()
    })
})
describe("TrainingItem variants backward compatibility",()=>{
    test("InstructionTrainingItem without metadata",()=>{
        let item:InstructionTrainingItem={
            format:"instruction",
            instruction:"Be helpful"
        }
        expect(item.metadata).toBeUndefined()
    })
    test("ChatMLTrainingItem without metadata",()=>{
        let item:ChatMLTrainingItem={
            format:"chatml"
        }
        expect(item.metadata).toBeUndefined()
    })
    test("TextTrainingItem without metadata",()=>{
        let item:TextTrainingItem={
            format:"text"
        }
        expect(item.metadata).toBeUndefined()
    })
})
describe("TrainingItem variants with metadata",()=>{
    test("InstructionTrainingItem with metadata",()=>{
        let item:InstructionTrainingItem={
            format:"instruction",
            instruction:"Be helpful",
            metadata:{
                difficulty:"easy",
                topic:"helpfulness"
            }
        }
        expect(item.metadata?.difficulty).toBe("easy")
        expect(item.metadata?.topic).toBe("helpfulness")
    })
    test("ChatMLTrainingItem with metadata",()=>{
        let item:ChatMLTrainingItem={
            format:"chatml",
            metadata:{
                bookmarked:true
            }
        }
        expect(item.metadata?.bookmarked).toBe(true)
    })
    test("TextTrainingItem with metadata",()=>{
        let item:TextTrainingItem={
            format:"text",
            text:"raw content",
            metadata:{
                sensitive:false
            }
        }
        expect(item.metadata?.sensitive).toBe(false)
    })
})
describe("ProviderConfig interface",()=>{
    test("has required fields",()=>{
        let config:ProviderConfig={
            id:"openai-1",
            type:"openai",
            name:"OpenAI Primary",
            priority:1,
            enabled:true
        }
        expect(config.id).toBe("openai-1")
        expect(config.type).toBe("openai")
        expect(config.name).toBe("OpenAI Primary")
        expect(config.priority).toBe(1)
        expect(config.enabled).toBe(true)
    })
    test("with optional fields",()=>{
        let config:ProviderConfig={
            id:"anthropic-1",
            type:"anthropic",
            name:"Anthropic",
            apiKey:"sk-xxx",
            baseUrl:"https://api.anthropic.com",
            model:"claude-3",
            priority:2,
            enabled:true,
            scopes:["read","generate","export"],
            region:"us-east-1"
        }
        expect(config.apiKey).toBe("sk-xxx")
        expect(config.scopes).toHaveLength(3)
        expect(config.region).toBe("us-east-1")
    })
})
describe("ValidatorConfig interface",()=>{
    test("has required fields",()=>{
        let config:ValidatorConfig={
            name:"bias-checker",
            enabled:true
        }
        expect(config.name).toBe("bias-checker")
        expect(config.enabled).toBe(true)
    })
    test("with optional fields",()=>{
        let config:ValidatorConfig={
            name:"toxicity-checker",
            enabled:true,
            threshold:0.5,
            options:{strict:true}
        }
        expect(config.threshold).toBe(0.5)
        expect(config.options).toBeDefined()
    })
})
describe("WebhookConfig interface",()=>{
    test("has required fields",()=>{
        let config:WebhookConfig={
            url:"https://example.com/webhook",
            events:["item.created"],
            enabled:true
        }
        expect(config.url).toBe("https://example.com/webhook")
        expect(config.events).toHaveLength(1)
        expect(config.enabled).toBe(true)
    })
    test("with optional secret",()=>{
        let config:WebhookConfig={
            url:"https://example.com/webhook",
            events:["item.created","item.updated"],
            secret:"wh-secret",
            enabled:false
        }
        expect(config.secret).toBe("wh-secret")
        expect(config.events).toHaveLength(2)
        expect(config.enabled).toBe(false)
    })
})
describe("AppSettings with new fields",()=>{
    test("supports provider and failover config",()=>{
        let settings:AppSettings={
            provider:"openai",
            providers:[
                {id:"openai-1",type:"openai",name:"OpenAI",priority:1,enabled:true}
            ],
            failoverPriority:["openai-1","anthropic-1"],
            ensembleModels:["gpt-4","claude-3"]
        }
        expect(settings.providers).toHaveLength(1)
        expect(settings.failoverPriority).toHaveLength(2)
        expect(settings.ensembleModels).toHaveLength(2)
    })
    test("supports quality and validator config",()=>{
        let settings:AppSettings={
            refinementPasses:3,
            qualityThreshold:0.85,
            validators:[
                {name:"bias",enabled:true,threshold:0.2}
            ]
        }
        expect(settings.refinementPasses).toBe(3)
        expect(settings.qualityThreshold).toBe(0.85)
        expect(settings.validators).toHaveLength(1)
    })
    test("supports api server and plugin config",()=>{
        let settings:AppSettings={
            apiServer:{enabled:true,port:3000,auth:"token"},
            pluginPaths:["/plugins/a","/plugins/b"],
            retentionDays:30
        }
        expect(settings.apiServer?.port).toBe(3000)
        expect(settings.pluginPaths).toHaveLength(2)
        expect(settings.retentionDays).toBe(30)
    })
    test("supports app lock and density config",()=>{
        let settings:AppSettings={
            appLock:{enabled:true,totpSecret:"secret"},
            density:"compact",
            dataResidency:"eu",
            proxy:"http://proxy:8080",
            otlpEndpoint:"http://otel:4317",
            maxSessionTokens:8000,
            incremental:true
        }
        expect(settings.appLock?.enabled).toBe(true)
        expect(settings.density).toBe("compact")
        expect(settings.dataResidency).toBe("eu")
        expect(settings.proxy).toBe("http://proxy:8080")
        expect(settings.maxSessionTokens).toBe(8000)
        expect(settings.incremental).toBe(true)
    })
})
describe("FullAppSettings with new fields",()=>{
    test("supports workspace and telemetry config",()=>{
        let settings:FullAppSettings={
            workspaceId:"ws-1",
            telemetryEnabled:true,
            crashReportsEnabled:false,
            autoUpdate:true
        }
        expect(settings.workspaceId).toBe("ws-1")
        expect(settings.telemetryEnabled).toBe(true)
        expect(settings.crashReportsEnabled).toBe(false)
        expect(settings.autoUpdate).toBe(true)
    })
    test("supports providers and watch folders",()=>{
        let settings:FullAppSettings={
            providers:[
                {id:"p1",type:"openai",name:"P1",priority:1,enabled:true}
            ],
            watchFolders:["/watch/a","/watch/b"],
            webhooks:[
                {url:"http://wh",events:["e1"],enabled:true}
            ]
        }
        expect(settings.providers).toHaveLength(1)
        expect(settings.watchFolders).toHaveLength(2)
        expect(settings.webhooks).toHaveLength(1)
    })
})
describe("Citation and QualityScores types",()=>{
    test("Citation with required text",()=>{
        let citation:Citation={
            text:"cited passage"
        }
        expect(citation.text).toBe("cited passage")
        expect(citation.page).toBeUndefined()
    })
    test("Citation with all fields",()=>{
        let citation:Citation={
            page:5,
            line:10,
            text:"quoted text"
        }
        expect(citation.page).toBe(5)
        expect(citation.line).toBe(10)
        expect(citation.text).toBe("quoted text")
    })
    test("QualityScores with all fields",()=>{
        let scores:QualityScores={
            overall:0.9,
            perplexity:42.5,
            diversity:0.8,
            bias:0.1,
            toxicity:0.0,
            hallucination:0.15,
            factualConsistency:0.95,
            grammar:0.99,
            readingLevel:7,
            coverage:0.85,
            completeness:0.9,
            ambiguity:0.2,
            adversarial:0.4
        }
        expect(scores.overall).toBe(0.9)
        expect(scores.perplexity).toBe(42.5)
        expect(scores.factualConsistency).toBe(0.95)
        expect(scores.adversarial).toBe(0.4)
    })
    test("QualityScores empty",()=>{
        let scores:QualityScores={}
        expect(scores).toBeDefined()
    })
})
describe("WorkspaceConfig interface",()=>{
    test("has required fields",()=>{
        let config:WorkspaceConfig={
            id:"ws-1",
            name:"My Workspace",
            createdAt:1700000000000,
            updatedAt:1700000000000
        }
        expect(config.id).toBe("ws-1")
        expect(config.name).toBe("My Workspace")
        expect(config.createdAt).toBe(1700000000000)
        expect(config.updatedAt).toBe(1700000000000)
    })
    test("with optional settings",()=>{
        let config:WorkspaceConfig={
            id:"ws-2",
            name:"Another Workspace",
            createdAt:1700000000000,
            updatedAt:1700000000000,
            settings:{
                model:"llama2",
                provider:"ollama"
            }
        }
        expect(config.settings?.model).toBe("llama2")
    })
})

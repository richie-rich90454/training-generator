const fs=require("fs").promises;
const path=require("path");
class PromptManager{
    constructor(){
        this.fallbackPrompts={
            instruction:`You are an AI training data generator. Your task is to extract comprehensive question-answer pairs from the provided text that cover ALL important information for instruction tuning.
TEXT TO ANALYZE:
{{text}}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL key concepts,facts,arguments,data points,and important information.
2. For EACH significant piece of information,create a clear,specific question that someone might ask about it. Questions and answers should be in the same language as the source text.
3. Provide detailed,accurate answers based EXCLUSIVELY on the text content.
4. Format each pair exactly as:
Question:[the question]
Answer:[the answer]
5. Create DIVERSE question types:
   -Factual questions(who,what,when,where)
   -Conceptual questions(how,why,explain)
   -Analytical questions(compare,contrast,analyze)
   -Application questions(how to use,implement,apply)
   -Inference questions(what can be concluded,implied)
6. Ensure answers are COMPREHENSIVE but concise,covering all relevant details from the text.
7. Generate AS MANY high-quality question-answer pairs as needed to cover ALL important information in the text. Aim for 5-10+pairs depending on text density.
8. Do NOT skip any important information. Cover ALL key points mentioned in the text.
9. If the text contains lists,procedures,or steps,create questions for EACH item/step.
10. If the text contains examples,create questions about each example.
OUTPUT FORMAT:
Question:[First question]
Answer:[First answer]
Question:[Second question]
Answer:[Second answer]
[Continue with as many pairs as needed to cover all information,with a blank line between each question-answer pair]`,
            conversation:`You are an AI training data generator. Your task is to create comprehensive,informative conversations between a user and an AI assistant based on ALL information in the provided text.
TEXT TO ANALYZE:
{{text}}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL main topics,key information,arguments,and details.
2. Create a comprehensive conversation where the user asks questions or discusses ALL important aspects of the text. Questions and responses should match the source text language.
3. The assistant should provide detailed,accurate responses based EXCLUSIVELY on the text.
4. Format the conversation exactly as:
User:[user message]
Assistant:[assistant response]
5. Make the conversation flow naturally while covering ALL key information.
6. Include 5-10+exchanges(user-assistant pairs)to cover different aspects of the text COMPLETELY.
7. The assistant"s responses should be informative,comprehensive,and directly based on the text content.
8. Cover ALL important points:main ideas,supporting details,examples,data points,conclusions.
9. If the text contains multiple sections or topics,create conversation exchanges for EACH one.
10. Ensure the conversation explores the text DEEPLY,not just superficially.
OUTPUT FORMAT:
User:[First user message]
Assistant:[First assistant response]
User:[Second user message]
Assistant:[Second assistant response]
[Continue with as many exchanges as needed to cover all information,with a blank line between each user-assistant pair]`,
            chunking:`You are an AI training data generator. Your task is to create a comprehensive,detailed summary of the provided text that captures ALL essential information.
TEXT TO SUMMARIZE:
{{text}}
INSTRUCTIONS:
1. Read the text carefully and identify ALL main points,key arguments,essential information,supporting details,and conclusions.
2. Create a summary that:
   -Captures the COMPLETE core message and purpose of the text
   -Includes ALL important facts,data points,and details
   -Maintains the original meaning,context,and nuance
   -Is comprehensive yet concise
   -Preserves the logical flow and structure of the original
3. The summary should be approximately 40-50%of the original text length to ensure completeness.
4. Write in clear,professional language.
5. Do not add any information not present in the original text.
6. Do not omit any significant information from the original text.
7. Include ALL key examples,evidence,and supporting points mentioned.
OUTPUT FORMAT:
Provide only the summary text.`,
            custom:`You are an AI training data generator. Your task is to analyze the provided text and extract COMPREHENSIVE structured information that can be used for AI training.
TEXT TO ANALYZE:
{{text}}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL:
   -Key concepts,themes,and topics
   -Important facts,data points,statistics
   -Main arguments,narratives,thesis statements
   -Supporting evidence,examples,case studies
   -Technical terms,definitions,jargon(with explanations)
   -Relationships,connections,dependencies between information
   -Conclusions,implications,recommendations
2. Organize ALL information in a structured,hierarchical way that would be optimal for AI training.
3. Focus on extracting COMPLETE,factual,verifiable information from the text.
4. If the text contains instructions or procedures,extract ALL steps in detail.
5. If the text contains comparisons or contrasts,highlight ALL key differences and similarities.
6. If the text contains lists,extract ALL items with their descriptions.
7. Format your analysis in a clear,organized,comprehensive manner that captures EVERYTHING important from the text.
OUTPUT FORMAT:
Provide your analysis in a well-structured,comprehensive format.`
        };
    }
    async loadPrompt(language,processingType){
        const processingTypeMap={
            "instruction":"instruction",
            "conversation":"conversation",
            "chunking":"chunking",
            "custom":"custom"
        };
        const fileType=processingTypeMap[processingType]||"instruction";
        const fileName=`${language}_${fileType}.txt`;
        const possiblePaths=[
            `src/prompts/${fileName}`,
            `prompts/${fileName}`,
            `./prompts/${fileName}`,
            `../prompts/${fileName}`,
            path.join(__dirname,"..","prompts",fileName),
            path.join(__dirname,"..","..","prompts",fileName),
            path.join(process.cwd(),"prompts",fileName),
            path.join(process.cwd(),"src","prompts",fileName)
        ];
        for(const filePath of possiblePaths){
            try{
                if(fs.existsSync&&fs.existsSync(filePath)){
                    const content=await fs.readFile(filePath,"utf-8");
                    return{success:true,content,path:filePath};
                }
            }
            catch{
            }
            try{
                const content=await fs.readFile(filePath,"utf-8");
                return{success:true,content,path:filePath};
            }
            catch{
            }
        }
        if(language!=="en"){
            const fallbackFileName=`en_${fileType}.txt`;
            const fallbackPaths=possiblePaths.map(p=>p.replace(fileName,fallbackFileName));
            for(const filePath of fallbackPaths){
                try{
                    if(fs.existsSync&&fs.existsSync(filePath)){
                        const content=await fs.readFile(filePath,"utf-8");
                        return{success:true,content,path:filePath,isFallback:true};
                    }
                }
                catch{
                }
                try{
                    const content=await fs.readFile(filePath,"utf-8");
                    return{success:true,content,path:filePath,isFallback:true};
                }
                catch{
                }
            }
        }
        return{
            success:true,
            content:this.getFallbackPrompt("",processingType),
            isHardcoded:true 
        };
    }
    getFallbackPrompt(text,processingType){
        const prompt=this.fallbackPrompts[processingType]||this.fallbackPrompts.instruction;
        return prompt.replace("{{text}}",text);
    }
}
module.exports=PromptManager;
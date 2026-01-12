class TextProcessor{
    chunkText(text,chunkSize){
        const chunks=[];
        let start=0;
        while(start<text.length){
            let end=start+chunkSize;
            if(end<text.length){
                let nextPeriod=text.indexOf(".",end);
                let nextNewline=text.indexOf("\n",end);
                if(nextPeriod!==-1&&nextPeriod<end+100){
                    end=nextPeriod+1;
                }else if(nextNewline!==-1&&nextNewline<end+50){
                    end=nextNewline+1;
                }
            }
            chunks.push(text.substring(start,Math.min(end,text.length)));
            start=end;
        }
        return chunks;
    }
    estimateChunks(text,chunkSize){
        if(!text || text.length==0)return 1;
        return Math.max(1,Math.ceil(text.length/chunkSize));
    }
    validateText(text){
        if(!text || typeof text!=="string"){
            return{valid:false,error:"Text is empty or not a string"};
        }
        const trimmed=text.trim();
        if(trimmed.length==0){
            return{valid:false,error:"Text contains only whitespace"};
        }
        const meaningfulChars=trimmed.replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,"");
        if(meaningfulChars.length<10){
            return{valid:false,error:"Text does not contain enough meaningful content"};
        }
        return{valid:true,text:trimmed};
    }
    extractSentences(text,maxSentences=10){
        if(!text)return [];
        const sentences=text.split(/[.!?]+/).filter(s=>s.trim().length>0);
        return sentences.slice(0,maxSentences).map(s=>s.trim());
    }
    calculateReadability(text){
        if(!text)return{score:0,level:"Unknown"};
        const words=text.split(/\s+/).filter(w=>w.length>0);
        const sentences=text.split(/[.!?]+/).filter(s=>s.trim().length>0);
        const characters=text.replace(/\s/g,"").length;
        if(words.length==0 || sentences.length==0){
            return{score:0,level:"Unknown"};
        }
        const avgWordsPerSentence=words.length/sentences.length;
        const avgSyllablesPerWord=this.estimateSyllables(text)/words.length;
        const score=206.835-(1.015*avgWordsPerSentence)-(84.6*avgSyllablesPerWord);
        let level="Very Difficult";
        if(score>=90)level="Very Easy";
        else if(score>=80)level="Easy";
        else if(score>=70)level="Fairly Easy";
        else if(score>=60)level="Standard";
        else if(score>=50)level="Fairly Difficult";
        else if(score>=30)level="Difficult";
        return{
            score:Math.round(score),
            level,
            wordCount:words.length,
            sentenceCount:sentences.length,
            characterCount:characters
        };
    }
    estimateSyllables(text){
        const words=text.toLowerCase().split(/\s+/);
        let syllableCount=0;
        for(const word of words){
            if(word.length<=3){
                syllableCount+=1;
                continue;
            }
            let count=0;
            const vowels="aeiouy";
            let prevChar="";
            for(let i=0;i<word.length;i++){
                const char=word[i];
                if(vowels.includes(char)&&!vowels.includes(prevChar)){
                    count++;
                }
                prevChar=char;
            }
            if(word.endsWith("e")&&count>1)count--;
            if(word.endsWith("le")&&!vowels.includes(word[word.length-3]))count++;
            if(count==0)count=1;
            syllableCount+=count;
        }
        return syllableCount;
    }
}
module.exports=TextProcessor;
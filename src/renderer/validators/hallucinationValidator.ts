import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export interface ClaimExtractor{
    extractClaims(text: string): string[];
}
export interface EntailmentScorer{
    scoreEntailment(premise: string, hypothesis: string): Promise<{score: number; label: "entailment"|"neutral"|"contradiction"}>;
}
export class SimpleClaimExtractor implements ClaimExtractor{
    extractClaims(text: string): string[]{
        let claims: string[]=[];
        let parts=text.split(/([.!?]+)/);
        let uncertaintyMarkers=["i think", "maybe", "perhaps"];
        for (let i=0; i<parts.length; i+=2){
            let sentence=parts[i].trim();
            let punctuation=parts[i+1]??"";
            if (sentence.length===0){
                continue;
            }
            if (punctuation.includes("?")){
                continue;
            }
            let lower=sentence.toLowerCase();
            let hasUncertainty=false;
            for (let marker of uncertaintyMarkers){
                if (lower.includes(marker)){
                    hasUncertainty=true;
                    break;
                }
            }
            if (hasUncertainty){
                continue;
            }
            claims.push(sentence);
        }
        return claims;
    }
}
export class KeywordEntailmentScorer implements EntailmentScorer{
    private synonyms: Record<string, string[]>
    constructor(options?: {synonyms?: Record<string, string[]>}){
        let inputSynonyms=options?.synonyms??{};
        this.synonyms={};
        for (let key in inputSynonyms){
            this.synonyms[key.toLowerCase()]=inputSynonyms[key].map(s => s.toLowerCase());
        }
    }
    scoreEntailment(premise: string, hypothesis: string): Promise<{score: number; label: "entailment"|"neutral"|"contradiction"}>{
        let premiseTokens=this.tokenize(premise);
        let hypothesisTokens=this.tokenize(hypothesis);
        if (hypothesisTokens.length===0){
            return Promise.resolve({score: 0.9, label: "entailment"});
        }
        let expandedPremiseTokens=new Set<string>();
        for (let token of premiseTokens){
            expandedPremiseTokens.add(token);
            let tokenSynonyms=this.synonyms[token];
            if (tokenSynonyms){
                for (let synonym of tokenSynonyms){
                    expandedPremiseTokens.add(synonym);
                }
            }
        }
        let matched=0;
        for (let token of hypothesisTokens){
            if (expandedPremiseTokens.has(token)){
                matched++;
            }
        }
        let ratio=matched/hypothesisTokens.length;
        if (ratio>=0.8){
            return Promise.resolve({score: 0.9, label: "entailment"});
        }
        if (ratio>=0.3){
            return Promise.resolve({score: 0.5, label: "neutral"});
        }
        return Promise.resolve({score: 0.1, label: "contradiction"});
    }
    private tokenize(text: string): string[]{
        let tokens=text.toLowerCase().match(/\b[\w']+\b/g);
        return tokens??[];
    }
}
export class HallucinationValidator extends BaseValidator{
    private claimExtractor: ClaimExtractor;
    private entailmentScorer: EntailmentScorer;
    private sourceText: string;
    constructor(options: {claimExtractor?: ClaimExtractor; entailmentScorer?: EntailmentScorer; sourceText: string; threshold?: number}){
        super("hallucination", { threshold: options?.threshold??0.5 });
        this.claimExtractor=options?.claimExtractor??new SimpleClaimExtractor();
        this.entailmentScorer=options?.entailmentScorer??new KeywordEntailmentScorer();
        this.sourceText=options.sourceText;
    }
    private extractText(item: TrainingItem): string{
        if (item.output && typeof item.output==="string"){
            return item.output;
        }
        if (item.messages && Array.isArray(item.messages)){
            for (let message of item.messages){
                if (message.role==="assistant" && message.content){
                    return message.content;
                }
            }
        }
        if (item.text && typeof item.text==="string"){
            return item.text;
        }
        return "";
    }
    async validate(item: TrainingItem): Promise<ValidationResult>{
        let answerText=this.extractText(item);
        let claims=this.claimExtractor.extractClaims(answerText);
        let unsupportedCount=0;
        let details: string[]=[];
        let flags: string[]=[];
        for (let claim of claims){
            let entailment=await this.entailmentScorer.scoreEntailment(this.sourceText, claim);
            let supported=entailment.label==="entailment" && entailment.score>=0.7;
            details.push(claim+": "+entailment.score.toFixed(2)+" ("+entailment.label+")");
            if (!supported){
                unsupportedCount++;
                flags.push(claim);
            }
        }
        let totalClaims=claims.length;
        let score=totalClaims===0 ? 1 : 1-unsupportedCount/totalClaims;
        let passed=unsupportedCount===0;
        return this.buildResult(score, passed, details, flags);
    }
}
export class FactualConsistencyValidator extends BaseValidator{
    private entailmentScorer: EntailmentScorer;
    private sourceText: string;
    constructor(options: {entailmentScorer?: EntailmentScorer; sourceText: string; threshold?: number}){
        super("factual-consistency", { threshold: options?.threshold??0.7 });
        this.entailmentScorer=options?.entailmentScorer??new KeywordEntailmentScorer();
        this.sourceText=options.sourceText;
    }
    private extractText(item: TrainingItem): string{
        if (item.output && typeof item.output==="string"){
            return item.output;
        }
        if (item.messages && Array.isArray(item.messages)){
            for (let message of item.messages){
                if (message.role==="assistant" && message.content){
                    return message.content;
                }
            }
        }
        if (item.text && typeof item.text==="string"){
            return item.text;
        }
        return "";
    }
    async validate(item: TrainingItem): Promise<ValidationResult>{
        let answerText=this.extractText(item);
        let entailment=await this.entailmentScorer.scoreEntailment(this.sourceText, answerText);
        let score=entailment.score;
        let passed=score>=this.threshold;
        let details=["consistency: "+score.toFixed(2)];
        return this.buildResult(score, passed, details, []);
    }
}

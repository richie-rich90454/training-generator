export interface PricingTier{
    provider: string;
    model: string;
    inputPricePer1k: number;
    outputPricePer1k: number;
    currency: string;
}
export interface CostEstimate{
    provider: string;
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
}
export interface UsageRecord{
    timestamp: number;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
}
function defaultTokenizer(text: string): number{
    return estimateTokens(text);
}
export function estimateTokens(text: string): number{
    return Math.ceil(text.length/4);
}
export class CostEstimator{
    private pricing: PricingTier[];
    private tokenizer: (text: string)=>number;
    private usage: UsageRecord[];
    constructor(options: {pricing: PricingTier[], tokenizer?: (text: string)=>number}){
        this.pricing=[...options.pricing];
        this.tokenizer=options.tokenizer??defaultTokenizer;
        this.usage=[];
    }
    private findTier(provider: string, model: string): PricingTier{
        let exact=this.pricing.find(t=>t.provider===provider && t.model===model);
        if (exact){
            return exact;
        }
        let providerMatch=this.pricing.find(t=>t.provider===provider);
        if (providerMatch){
            return providerMatch;
        }
        return {provider, model, inputPricePer1k:0.03, outputPricePer1k:0.06, currency:"USD"};
    }
    estimate(text: string, provider: string, model: string): CostEstimate{
        let inputTokens=this.tokenizer(text);
        let outputTokens=inputTokens;
        let tier=this.findTier(provider, model);
        let inputCost=(inputTokens/1000)*tier.inputPricePer1k;
        let outputCost=(outputTokens/1000)*tier.outputPricePer1k;
        let totalCost=inputCost+outputCost;
        return {
            provider,
            model,
            estimatedInputTokens: inputTokens,
            estimatedOutputTokens: outputTokens,
            inputCost,
            outputCost,
            totalCost,
            currency: tier.currency
        };
    }
    recordUsage(record: UsageRecord): void{
        this.usage.push(record);
    }
    getUsageSummary(provider?: string, model?: string, startTime?: number, endTime?: number): {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}{
        let filtered=this.usage.filter(r=>{
            if (provider!==undefined && r.provider!==provider){
                return false;
            }
            if (model!==undefined && r.model!==model){
                return false;
            }
            if (startTime!==undefined && r.timestamp<startTime){
                return false;
            }
            if (endTime!==undefined && r.timestamp>endTime){
                return false;
            }
            return true;
        });
        let totalCost=0;
        let totalInputTokens=0;
        let totalOutputTokens=0;
        for (let r of filtered){
            totalCost+=r.cost;
            totalInputTokens+=r.inputTokens;
            totalOutputTokens+=r.outputTokens;
        }
        return {
            totalCost,
            totalInputTokens,
            totalOutputTokens,
            count: filtered.length
        };
    }
    getDashboardData(): {byProvider: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>, byModel: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>, daily: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>}{
        let byProvider: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>={};
        let byModel: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>={};
        let daily: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>={};
        for (let r of this.usage){
            let providerKey=r.provider;
            let modelKey=r.provider + "/" + r.model;
            let date=new Date(r.timestamp);
            let dailyKey=date.getUTCFullYear() + "-" + String(date.getUTCMonth()+1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0");
            this.incrementBucket(byProvider, providerKey, r);
            this.incrementBucket(byModel, modelKey, r);
            this.incrementBucket(daily, dailyKey, r);
        }
        return {byProvider, byModel, daily};
    }
    private incrementBucket(bucket: Record<string, {totalCost: number, totalInputTokens: number, totalOutputTokens: number, count: number}>, key: string, record: UsageRecord): void{
        if (!bucket[key]){
            bucket[key]={
                totalCost: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                count: 0
            };
        }
        bucket[key].totalCost+=record.cost;
        bucket[key].totalInputTokens+=record.inputTokens;
        bucket[key].totalOutputTokens+=record.outputTokens;
        bucket[key].count+=1;
    }
}

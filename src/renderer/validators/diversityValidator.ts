import type { TrainingItem } from "../../types/index.js"
import { BaseValidator, type ValidationResult } from "../validatorFramework.js"
export interface EmbeddingService{
    embed(texts: string[]): Promise<number[][]>
}
export interface Cluster{
    centroid: number[]
    members: string[]
}
function hashCode(text: string): number{
    let hash=0
    for (let i=0; i<text.length; i++){
        let char=text.charCodeAt(i)
        hash=((hash<<5)-hash)+char
        hash=hash&hash
    }
    return hash
}
export class MockEmbeddingService implements EmbeddingService{
    private vectors: number[][]
    constructor(dimension?: number){
        let dim=dimension??8
        this.vectors=[]
        for (let i=0; i<8; i++){
            let vector=new Array<number>(dim).fill(0)
            vector[i%dim]=1
            this.vectors.push(vector)
        }
    }
    async embed(texts: string[]): Promise<number[][]>{
        return texts.map(text => this.vectors[Math.abs(hashCode(text))%8])
    }
}
export function cosineSimilarity(a: number[], b: number[]): number{
    let dot=0
    let normA=0
    let normB=0
    for (let i=0; i<a.length; i++){
        dot+=a[i]*b[i]
        normA+=a[i]*a[i]
        normB+=b[i]*b[i]
    }
    if (normA===0 || normB===0){
        return 0
    }
    return dot/(Math.sqrt(normA)*Math.sqrt(normB))
}
function extractText(item: TrainingItem): string{
    if (item.output && typeof item.output==="string"){
        return item.output
    }
    if (item.messages && Array.isArray(item.messages)){
        for (let message of item.messages){
            if (message.role==="assistant" && message.content){
                return message.content
            }
        }
    }
    if (item.text && typeof item.text==="string"){
        return item.text
    }
    return ""
}
export class SemanticDedupValidator extends BaseValidator{
    private embeddingService: EmbeddingService
    private similarityThreshold: number
    seenEmbeddings: {text: string, embedding: number[]}[]
    constructor(options?: {embeddingService?: EmbeddingService, similarityThreshold?: number}){
        super("semantic-dedup")
        this.embeddingService=options?.embeddingService??new MockEmbeddingService()
        this.similarityThreshold=options?.similarityThreshold??0.95
        this.seenEmbeddings=[]
    }
    reset(): void{
        this.seenEmbeddings=[]
    }
    async validate(item: TrainingItem): Promise<ValidationResult>{
        let text=extractText(item)
        let embeddings=await this.embeddingService.embed([text])
        let embedding=embeddings[0]
        let isDuplicate=false
        for (let seen of this.seenEmbeddings){
            if (cosineSimilarity(seen.embedding, embedding)>this.similarityThreshold){
                isDuplicate=true
                break
            }
        }
        if (!isDuplicate){
            this.seenEmbeddings.push({text, embedding})
        }
        let score=isDuplicate?0:1
        let passed=!isDuplicate
        let flags: string[]=[]
        if (isDuplicate){
            flags.push("semantic_duplicate")
        }
        return this.buildResult(score, passed, [], flags)
    }
}
export class DiversityValidator extends BaseValidator{
    private embeddingService: EmbeddingService
    private maxClusterSize: number
    private maxItemsBeforeCheck: number
    clusters: Cluster[]
    private itemCount: number
    constructor(options?: {embeddingService?: EmbeddingService, maxClusterSize?: number, maxItemsBeforeCheck?: number}){
        super("diversity")
        this.embeddingService=options?.embeddingService??new MockEmbeddingService()
        this.maxClusterSize=options?.maxClusterSize??5
        this.maxItemsBeforeCheck=options?.maxItemsBeforeCheck??0
        this.clusters=[]
        this.itemCount=0
    }
    reset(): void{
        this.clusters=[]
        this.itemCount=0
    }
    async validate(item: TrainingItem): Promise<ValidationResult>{
        this.itemCount++
        let text=extractText(item)
        let embeddings=await this.embeddingService.embed([text])
        let embedding=embeddings[0]
        let matchingCluster: Cluster|null=null
        for (let cluster of this.clusters){
            if (cosineSimilarity(cluster.centroid, embedding)>0.9){
                matchingCluster=cluster
                break
            }
            for (let member of cluster.members){
                let memberEmbeddings=await this.embeddingService.embed([member])
                let memberEmbedding=memberEmbeddings[0]
                if (cosineSimilarity(memberEmbedding, embedding)>0.9){
                    matchingCluster=cluster
                    break
                }
            }
            if (matchingCluster){
                break
            }
        }
        let clusterSize=0
        let passed=true
        let flags: string[]=[]
        if (matchingCluster){
            clusterSize=matchingCluster.members.length+1
            if (clusterSize>=this.maxClusterSize){
                if (this.itemCount>this.maxItemsBeforeCheck){
                    passed=false
                    flags.push("cluster_too_large")
                }
            }
            else{
                matchingCluster.members.push(text)
                matchingCluster.centroid=await this.computeCentroid(matchingCluster.members)
            }
        }
        else{
            this.clusters.push({centroid: embedding, members: [text]})
            clusterSize=1
        }
        let score=Math.max(0, 1-(clusterSize/this.maxClusterSize))
        return this.buildResult(score, passed, [], flags)
    }
    private async computeCentroid(members: string[]): Promise<number[]>{
        let embeddings=await this.embeddingService.embed(members)
        let dimension=embeddings[0].length
        let sum=new Array<number>(dimension).fill(0)
        for (let embedding of embeddings){
            for (let i=0; i<dimension; i++){
                sum[i]+=embedding[i]
            }
        }
        for (let i=0; i<dimension; i++){
            sum[i]/=members.length
        }
        return sum
    }
}

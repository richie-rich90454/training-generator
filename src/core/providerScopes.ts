export type ProviderScope="read"|"generate"|"export"
export interface ProviderScopesConfig{
    [providerName: string]: ProviderScope[]
}
export class ScopeError extends Error{
    constructor(message: string){
        super(message)
        this.name="ScopeError"
    }
}
export class ProviderScopeEnforcer{
    private scopes: ProviderScopesConfig
    constructor(options: {scopes: ProviderScopesConfig}){
        this.scopes=options.scopes
    }
    hasScope(provider: string, scope: ProviderScope): boolean{
        let configured=this.scopes[provider]
        if(!configured)return true
        return configured.includes(scope)
    }
    requireScope(provider: string, scope: ProviderScope): void{
        if(!this.hasScope(provider, scope)){
            throw new ScopeError(`Provider ${provider} does not have scope ${scope}`)
        }
    }
    setScopes(provider: string, scopes: ProviderScope[]): void{
        this.scopes[provider]=scopes
    }
    listProvidersWithScope(scope: ProviderScope): string[]{
        let providers: string[]=[]
        for(let provider in this.scopes){
            if(this.scopes[provider].includes(scope)){
                providers.push(provider)
            }
        }
        return providers
    }
}

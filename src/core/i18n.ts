export interface LocaleMessages{
    [key: string]: string|LocaleMessages
}
export interface I18nOptions{
    locale?: string
    fallbackLocale?: string
    messages?: Record<string, LocaleMessages>
    detectLocale?: ()=>string
}
function defaultDetectLocale(): string{
    if (typeof navigator!=="undefined"&&navigator.language){
        return navigator.language
    }
    if (typeof Intl!=="undefined"&&Intl.DateTimeFormat){
        return Intl.DateTimeFormat().resolvedOptions().locale
    }
    return "en"
}
function mergeMessages(target: LocaleMessages, source: LocaleMessages): LocaleMessages{
    for (let key of Object.keys(source)){
        let sourceValue=source[key]
        let targetValue=target[key]
        if (typeof sourceValue==="object"&&sourceValue!==null&&typeof targetValue==="object"&&targetValue!==null){
            target[key]=mergeMessages(targetValue as LocaleMessages, sourceValue as LocaleMessages)
        }
        else{
            target[key]=sourceValue
        }
    }
    return target
}
function findMatchingBrace(message: string, start: number): number{
    let depth=0
    for (let i=start; i<message.length; i++){
        let char=message[i]
        if (char==="{"){
            depth++
        }
        else if (char==="}"){
            depth--
            if (depth===0){
                return i
            }
        }
    }
    return -1
}
function findTopLevelComma(text: string): number{
    let depth=0
    for (let i=0; i<text.length; i++){
        let char=text[i]
        if (char==="{"){
            depth++
        }
        else if (char==="}"){
            depth--
        }
        else if (char===","&&depth===0){
            return i
        }
    }
    return -1
}
function tokenizeTopLevelWhitespace(text: string): string[]{
    let tokens: string[]=[]
    let current=""
    let depth=0
    for (let i=0; i<text.length; i++){
        let char=text[i]
        if (char==="{"){
            depth++
        }
        else if (char==="}"){
            depth--
        }
        if (depth===0&&/\s/.test(char)){
            if (current.length>0){
                tokens.push(current)
                current=""
            }
        }
        else{
            current+=char
        }
    }
    if (current.length>0){
        tokens.push(current)
    }
    return tokens
}
function pairForms(tokens: string[]): Record<string, string>{
    let forms: Record<string, string>={}
    for (let i=0; i+1<tokens.length; i+=2){
        let name=tokens[i]
        let value=tokens[i+1]
        if (value.startsWith("{")&&value.endsWith("}")){
            value=value.slice(1, -1)
        }
        forms[name]=value
    }
    return forms
}
function selectPluralCategory(count: number, offset: number): string{
    let effective=count-offset
    if (typeof Intl!=="undefined"&&Intl.PluralRules){
        return new Intl.PluralRules("en").select(effective)
    }
    return effective===1?"one":"other"
}
function processPlural(name: string, rawForms: string, values: Record<string, unknown>): string{
    let count=Number(values[name]??0)
    let tokens=tokenizeTopLevelWhitespace(rawForms)
    let offset=0
    if (tokens.length>0&&tokens[0].startsWith("offset:")){
        offset=Number(tokens[0].slice("offset:".length))
        tokens=tokens.slice(1)
    }
    let forms=pairForms(tokens)
    let category=selectPluralCategory(count, offset)
    let selected=forms[category]??forms["other"]??""
    selected=selected.replace(/#/g, String(count-offset))
    return processIcu(selected, values)
}
function processSelect(name: string, rawForms: string, values: Record<string, unknown>): string{
    let value=String(values[name]??"")
    let tokens=tokenizeTopLevelWhitespace(rawForms)
    let forms=pairForms(tokens)
    let selected=forms[value]??forms["other"]??""
    return processIcu(selected, values)
}
function processIcuBlock(block: string, values: Record<string, unknown>): string{
    let firstComma=findTopLevelComma(block)
    if (firstComma===-1){
        return "{"+block+"}"
    }
    let name=block.slice(0, firstComma).trim()
    let afterName=block.slice(firstComma+1)
    let secondComma=findTopLevelComma(afterName)
    if (secondComma===-1){
        return "{"+block+"}"
    }
    let type=afterName.slice(0, secondComma).trim()
    let rawForms=afterName.slice(secondComma+1)
    if (type==="plural"){
        return processPlural(name, rawForms, values)
    }
    if (type==="select"){
        return processSelect(name, rawForms, values)
    }
    return "{"+block+"}"
}
function processIcu(message: string, values: Record<string, unknown>): string{
    let result=""
    let i=0
    while (i<message.length){
        let start=message.indexOf("{", i)
        if (start===-1){
            result+=message.slice(i)
            break
        }
        result+=message.slice(i, start)
        let end=findMatchingBrace(message, start)
        if (end===-1){
            result+=message[start]
            i=start+1
            continue
        }
        let block=message.slice(start+1, end)
        result+=processIcuBlock(block, values)
        i=end+1
    }
    return result
}
function findSelectVariableName(message: string): string|null{
    let i=0
    while (i<message.length){
        let start=message.indexOf("{", i)
        if (start===-1){
            return null
        }
        let end=findMatchingBrace(message, start)
        if (end===-1){
            return null
        }
        let block=message.slice(start+1, end)
        let firstComma=findTopLevelComma(block)
        if (firstComma!==-1){
            let name=block.slice(0, firstComma).trim()
            let afterName=block.slice(firstComma+1)
            let secondComma=findTopLevelComma(afterName)
            if (secondComma!==-1){
                let type=afterName.slice(0, secondComma).trim()
                if (type==="select"){
                    return name
                }
            }
        }
        i=end+1
    }
    return null
}
export function interpolate(message: string, values: Record<string, unknown>): string{
    return message.replace(/\{(\w+)\}/g, (_match, name)=>{
        let value=values[name]
        if (value===undefined||value===null){
            return ""
        }
        return String(value)
    })
}
export function pluralize(message: string, count: number): string{
    return processIcu(message, {count})
}
export function select(message: string, value: string): string{
    let name=findSelectVariableName(message)
    if (!name){
        return message
    }
    return processIcu(message, {[name]: value})
}
export class I18n{
    private locale: string
    private fallbackLocale: string
    private messages: Record<string, LocaleMessages>
    private detectLocaleFn: ()=>string
    constructor(options: I18nOptions={}){
        this.locale=options.locale??"en"
        this.fallbackLocale=options.fallbackLocale??"en"
        this.messages={}
        if (options.messages){
            for (let locale of Object.keys(options.messages)){
                this.messages[locale]={...options.messages[locale]}
            }
        }
        this.detectLocaleFn=options.detectLocale??defaultDetectLocale
    }
    setLocale(locale: string): void{
        this.locale=locale
    }
    getLocale(): string{
        return this.locale
    }
    detectLocale(): string{
        return this.detectLocaleFn()
    }
    loadLocaleMessages(locale: string, messages: LocaleMessages): void{
        if (!this.messages[locale]){
            this.messages[locale]={}
        }
        mergeMessages(this.messages[locale], messages)
    }
    t(key: string, interpolations?: Record<string, unknown>): string{
        let message=this.resolveMessage(key)
        if (typeof message!=="string"){
            return key
        }
        let context=interpolations??{}
        message=processIcu(message, context)
        message=interpolate(message, context)
        return message
    }
    tc(key: string, count: number, interpolations?: Record<string, unknown>): string{
        let message=this.resolveMessage(key)
        if (typeof message!=="string"){
            return key
        }
        message=pluralize(message, count)
        message=interpolate(message, {count, ...interpolations})
        return message
    }
    private resolveMessage(key: string): string|LocaleMessages{
        let locales=[this.locale, this.fallbackLocale]
        for (let locale of locales){
            let messages=this.messages[locale]
            if (!messages){
                continue
            }
            let value=this.getNestedValue(messages, key)
            if (typeof value==="string"){
                return value
            }
        }
        return key
    }
    private getNestedValue(messages: LocaleMessages, key: string): string|LocaleMessages|undefined{
        let parts=key.split(".")
        let current: string|LocaleMessages=messages
        for (let part of parts){
            if (typeof current!=="object"||current===null){
                return undefined
            }
            current=current[part]
            if (current===undefined){
                return undefined
            }
        }
        return current
    }
}
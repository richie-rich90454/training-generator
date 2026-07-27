import{t}from"./i18n.js"
const REQUIRED_SECTIONS=["Getting Started","Requirements","Troubleshooting"]
function sanitizeHelpHtml(html:string):string{
    let sanitized=html
    sanitized=sanitized.replace(/<script[\s\S]*?<\/script>/gi,"")
    sanitized=sanitized.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"")
    sanitized=sanitized.replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi,"$1=\"#\"")
    return sanitized
}
export function getHelpContent():string{
    let content=t("help.content")
    if(!content||content==="help.content"){
        return"<h3>Training Generator Help</h3><p>Help content is loading. Please try again later.</p>"
    }
    return sanitizeHelpHtml(content)
}
export function getHelpSections():{title:string, body:string}[]{
    let html=getHelpContent()
    let sections:{title:string, body:string}[]=[]
    let parts=html.split(/<h4>([^<]*)<\/h4>/i)
    for(let i=1;i<parts.length;i+=2){
        let title=parts[i]?.trim()||""
        let body=parts[i+1]?.trim()||""
        if(title){
            sections.push({title, body})
        }
    }
    return sections
}
export function validateHelpContent():{valid:boolean, missing:string[]}{
    let content=getHelpContent()
    let missing:string[]=[]
    for(let section of REQUIRED_SECTIONS){
        if(!content.includes(section)){
            missing.push(section)
        }
    }
    return{valid:missing.length===0, missing}
}

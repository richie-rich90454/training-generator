export const RTL_LOCALES: string[]=[
    "ar",
    "arc",
    "dv",
    "fa",
    "ha",
    "he",
    "khw",
    "ks",
    "ku",
    "ps",
    "sd",
    "ug",
    "ur",
    "yi"
];
export function isRtlLocale(locale: string): boolean{
    let normalized=locale.toLowerCase().trim();
    return RTL_LOCALES.some((code)=>normalized===code||normalized.startsWith(code + "-"));
}
export function getTextDirection(locale: string): "ltr"|"rtl"{
    if (isRtlLocale(locale)){
        return "rtl";
    }
    return "ltr";
}
export function convertToLogical(property: string, value: string): {property: string, value: string}{
    let prop=property.trim();
    let val=value.trim();
    switch (prop){
        case "margin-left":
            return {property: "margin-inline-start", value: val};
        case "margin-right":
            return {property: "margin-inline-end", value: val};
        case "padding-left":
            return {property: "padding-inline-start", value: val};
        case "padding-right":
            return {property: "padding-inline-end", value: val};
        case "border-left":
            return {property: "border-inline-start", value: val};
        case "border-right":
            return {property: "border-inline-end", value: val};
        case "border-left-width":
            return {property: "border-inline-start-width", value: val};
        case "border-right-width":
            return {property: "border-inline-end-width", value: val};
        case "border-left-color":
            return {property: "border-inline-start-color", value: val};
        case "border-right-color":
            return {property: "border-inline-end-color", value: val};
        case "border-left-style":
            return {property: "border-inline-start-style", value: val};
        case "border-right-style":
            return {property: "border-inline-end-style", value: val};
        case "left":
            return {property: "inset-inline-start", value: val};
        case "right":
            return {property: "inset-inline-end", value: val};
        case "text-align":{
            if (val==="left"){
                return {property: prop, value: "start"};
            }
            if (val==="right"){
                return {property: prop, value: "end"};
            }
            return {property: prop, value: val};
        }
        case "float":{
            if (val==="left"){
                return {property: prop, value: "inline-start"};
            }
            if (val==="right"){
                return {property: prop, value: "inline-end"};
            }
            return {property: prop, value: val};
        }
        case "clear":{
            if (val==="left"){
                return {property: prop, value: "inline-start"};
            }
            if (val==="right"){
                return {property: prop, value: "inline-end"};
            }
            return {property: prop, value: val};
        }
        default:
            return {property: prop, value: val};
    }
}
export class RtlManager{
    private doc: Document|undefined;
    private currentDirection: "ltr"|"rtl";
    constructor(options: {document?: Document}={}){
        this.doc=options.document;
        this.currentDirection="ltr";
    }
    setDirection(locale: string): void{
        let direction=getTextDirection(locale);
        this.currentDirection=direction;
        if (this.doc){
            this.doc.dir=direction;
            if (this.doc.body){
                if (direction==="rtl"){
                    this.doc.body.classList.add("rtl");
                }
                else{
                    this.doc.body.classList.remove("rtl");
                }
            }
        }
    }
    applyLogicalCss(css: string): string{
        let result=css;
        let pairs: [string, string][]=[
            ["margin-left", "margin-inline-start"],
            ["margin-right", "margin-inline-end"],
            ["padding-left", "padding-inline-start"],
            ["padding-right", "padding-inline-end"],
            ["border-left", "border-inline-start"],
            ["border-right", "border-inline-end"],
            ["border-left-width", "border-inline-start-width"],
            ["border-right-width", "border-inline-end-width"],
            ["border-left-color", "border-inline-start-color"],
            ["border-right-color", "border-inline-end-color"],
            ["border-left-style", "border-inline-start-style"],
            ["border-right-style", "border-inline-end-style"],
            ["left", "inset-inline-start"],
            ["right", "inset-inline-end"]
        ];
        for (let [physical, logical] of pairs){
            let regex=new RegExp("(^|[\\s;{])" + physical.replace(/-/g, "\\-") + "\\s*:\\s*([^;{}]+)(;|$)", "g");
            result=result.replace(regex, (_match, prefix, value, suffix)=>{
                return prefix + logical + ":" + value.trim() + suffix;
            });
        }
        result=result.replace(/text-align\s*:\s*left/g, "text-align:start");
        result=result.replace(/text-align\s*:\s*right/g, "text-align:end");
        result=result.replace(/float\s*:\s*left/g, "float:inline-start");
        result=result.replace(/float\s*:\s*right/g, "float:inline-end");
        result=result.replace(/clear\s*:\s*left/g, "clear:inline-start");
        result=result.replace(/clear\s*:\s*right/g, "clear:inline-end");
        return result;
    }
    getCurrentDirection(): "ltr"|"rtl"{
        if (this.doc){
            let dir=this.doc.dir;
            if (dir==="rtl"||dir==="ltr"){
                return dir;
            }
        }
        return this.currentDirection;
    }
    mirrorClass(className: string): string{
        let classes=className.split(/\s+/).filter((c)=>c.length>0);
        let mirrored=classes.map((cls)=>{
            if (/^(ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|text-left|text-right|float-left|float-right|clear-left|clear-right)(-.+)?$/.test(cls)){
                return cls + "-rtl";
            }
            return cls;
        });
        return mirrored.join(" ");
    }
}

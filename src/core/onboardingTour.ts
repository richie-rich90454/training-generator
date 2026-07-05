export interface TourStep{
    id: string;
    target: string;
    title: string;
    content: string;
    placement?: "top"|"bottom"|"left"|"right";
    action?: string;
}
export interface TourStorage{
    getItem(key: string): string|null;
    setItem(key: string, value: string): void;
}
export interface OnboardingTourOptions{
    steps: TourStep[];
    storage?: TourStorage;
    document?: Document;
}
export const STORAGE_KEY="tg-onboarding-completed";
export const DEFAULT_TOUR_STEPS: TourStep[]=[
    {id: "welcome", target: "#help-btn", title: "Welcome", content: "Welcome to Training Generator. This short tour highlights the main controls.", placement: "bottom"},
    {id: "upload", target: "#drop-zone", title: "Upload Files", content: "Drag and drop documents here, or click to browse. Supported formats include PDF, DOCX, TXT, MD and more.", placement: "bottom"},
    {id: "settings", target: "#settings-btn", title: "Settings", content: "Open settings to choose the model, processing type, output format and other options.", placement: "left"},
    {id: "process", target: "#process-btn", title: "Process Files", content: "Click this button to convert your uploaded documents into training data.", placement: "top"},
    {id: "output", target: "#output-preview", title: "Output Preview", content: "Review the generated training data before exporting or copying it.", placement: "top"}
];
export class OnboardingTour{
    private steps: TourStep[];
    private storage: TourStorage;
    private doc: Document;
    private index: number=-1;
    private overlay: HTMLElement|null=null;
    private tooltip: HTMLElement|null=null;
    constructor(options: OnboardingTourOptions){
        this.steps=options.steps;
        this.doc=options.document ?? globalThis.document;
        let defaultStorage: TourStorage={
            getItem: ()=>null,
            setItem: ()=>{}
        };
        if (typeof localStorage!=="undefined"){
            defaultStorage=localStorage;
        }
        this.storage=options.storage ?? defaultStorage;
    }
    start(): void{
        this.index=0;
        this.render();
    }
    next(): void{
        if (this.index<this.steps.length-1){
            this.index++;
            this.render();
        }
        else{
            this.finish();
        }
    }
    previous(): void{
        if (this.index>0){
            this.index--;
            this.render();
        }
    }
    skip(): void{
        this.finish();
    }
    finish(): void{
        this.storage.setItem(STORAGE_KEY, "true");
        this.destroy();
    }
    isCompleted(): boolean{
        return this.storage.getItem(STORAGE_KEY)==="true";
    }
    reset(): void{
        this.storage.setItem(STORAGE_KEY, "");
    }
    getCurrentStep(): TourStep|undefined{
        return this.steps[this.index];
    }
    getStepIndex(): number{
        return this.index;
    }
    renderOverlay(): HTMLElement{
        let overlay=this.doc.createElement("div");
        overlay.className="tg-onboarding-overlay";
        overlay.style.position="fixed";
        overlay.style.top="0";
        overlay.style.left="0";
        overlay.style.width="100%";
        overlay.style.height="100%";
        overlay.style.backgroundColor="rgba(0,0,0,0.5)";
        overlay.style.zIndex="9998";
        return overlay;
    }
    positionTooltip(step: TourStep): {top: number, left: number}{
        let target=this.doc.querySelector(step.target) as HTMLElement|null;
        let tooltipSize={width: 240, height: 160};
        if (this.tooltip){
            tooltipSize.width=this.tooltip.offsetWidth || tooltipSize.width;
            tooltipSize.height=this.tooltip.offsetHeight || tooltipSize.height;
        }
        if (!target){
            let viewWidth=this.doc.defaultView?.innerWidth ?? 800;
            let viewHeight=this.doc.defaultView?.innerHeight ?? 600;
            return {
                top: viewHeight/2-tooltipSize.height/2,
                left: viewWidth/2-tooltipSize.width/2
            };
        }
        let rect=target.getBoundingClientRect();
        let placement=step.placement ?? "bottom";
        return calculatePlacement(rect, tooltipSize, placement);
    }
    private render(): void{
        this.destroy();
        let step=this.getCurrentStep();
        if (!step){
            return;
        }
        this.overlay=this.renderOverlay();
        this.doc.body.appendChild(this.overlay);
        this.tooltip=buildTourTooltip(step);
        this.tooltip.style.position="absolute";
        this.tooltip.style.zIndex="1100";
        let pos=this.positionTooltip(step);
        this.tooltip.style.top=pos.top+"px";
        this.tooltip.style.left=pos.left+"px";
        this.doc.body.appendChild(this.tooltip);
        this.attachTooltipListeners();
    }
    private attachTooltipListeners(): void{
        if (!this.tooltip){
            return;
        }
        let nextBtn=this.tooltip.querySelector(".tg-tour-next") as HTMLElement|null;
        let prevBtn=this.tooltip.querySelector(".tg-tour-prev") as HTMLElement|null;
        let skipBtn=this.tooltip.querySelector(".tg-tour-skip") as HTMLElement|null;
        if (nextBtn){
            nextBtn.addEventListener("click", ()=>this.next());
        }
        if (prevBtn){
            prevBtn.addEventListener("click", ()=>this.previous());
        }
        if (skipBtn){
            skipBtn.addEventListener("click", ()=>this.skip());
        }
    }
    destroy(): void{
        if (this.overlay && this.overlay.parentNode){
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.tooltip && this.tooltip.parentNode){
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
        this.overlay=null;
        this.tooltip=null;
    }
}
export function calculatePlacement(targetRect: DOMRect, tooltipSize: {width: number, height: number}, placement: string): {top: number, left: number}{
    let offset=8;
    let top=0;
    let left=0;
    if (placement==="top"){
        top=targetRect.top-tooltipSize.height-offset;
        left=targetRect.left+targetRect.width/2-tooltipSize.width/2;
    }
    else if (placement==="bottom"){
        top=targetRect.bottom+offset;
        left=targetRect.left+targetRect.width/2-tooltipSize.width/2;
    }
    else if (placement==="left"){
        top=targetRect.top+targetRect.height/2-tooltipSize.height/2;
        left=targetRect.left-tooltipSize.width-offset;
    }
    else if (placement==="right"){
        top=targetRect.top+targetRect.height/2-tooltipSize.height/2;
        left=targetRect.right+offset;
    }
    else{
        top=targetRect.bottom+offset;
        left=targetRect.left+targetRect.width/2-tooltipSize.width/2;
    }
    return {top, left};
}
export function buildTourTooltip(step: TourStep): HTMLElement{
    let tooltip=document.createElement("div");
    tooltip.className="tg-onboarding-tooltip";
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-modal", "true");
    tooltip.setAttribute("aria-labelledby", "tg-tour-title-"+step.id);
    let title=document.createElement("h4");
    title.id="tg-tour-title-"+step.id;
    title.className="tg-tour-title";
    title.textContent=step.title;
    let content=document.createElement("p");
    content.className="tg-tour-content";
    content.textContent=step.content;
    let actions=document.createElement("div");
    actions.className="tg-tour-actions";
    let prevBtn=document.createElement("button");
    prevBtn.className="tg-tour-btn tg-tour-prev btn btn-secondary";
    prevBtn.textContent="Back";
    let nextBtn=document.createElement("button");
    nextBtn.className="tg-tour-btn tg-tour-next btn btn-primary";
    nextBtn.textContent="Next";
    let skipBtn=document.createElement("button");
    skipBtn.className="tg-tour-btn tg-tour-skip btn btn-secondary";
    skipBtn.textContent="Skip";
    actions.appendChild(prevBtn);
    actions.appendChild(nextBtn);
    actions.appendChild(skipBtn);
    tooltip.appendChild(title);
    tooltip.appendChild(content);
    tooltip.appendChild(actions);
    if (step.action){
        let actionEl=document.createElement("p");
        actionEl.className="tg-tour-action-text";
        actionEl.textContent=step.action;
        tooltip.appendChild(actionEl);
    }
    return tooltip;
}

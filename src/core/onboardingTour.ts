import{t}from"../renderer/i18n.js"
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
    {id: "welcome", target: "#help-btn", title: t("tour.welcome.title"), content: t("tour.welcome.content"), placement: "bottom"},
    {id: "upload", target: "#drop-zone", title: t("tour.upload.title"), content: t("tour.upload.content"), placement: "bottom"},
    {id: "settings", target: "#settings-btn", title: t("tour.settings.title"), content: t("tour.settings.content"), placement: "left"},
    {id: "process", target: "#process-btn", title: t("tour.process.title"), content: t("tour.process.content"), placement: "top"},
    {id: "output", target: "#output-preview", title: t("tour.output.title"), content: t("tour.output.content"), placement: "top"}
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
        let viewWidth=this.doc.defaultView?.innerWidth ?? 800;
        let viewHeight=this.doc.defaultView?.innerHeight ?? 600;
        if (!target){
            return {
                top: viewHeight/2-tooltipSize.height/2,
                left: viewWidth/2-tooltipSize.width/2
            };
        }
        let rect=target.getBoundingClientRect();
        let placement=step.placement ?? "bottom";
        let pos=calculatePlacement(rect, tooltipSize, placement);
        let padding=8;
        pos.top=Math.max(padding, Math.min(pos.top, viewHeight-tooltipSize.height-padding));
        pos.left=Math.max(padding, Math.min(pos.left, viewWidth-tooltipSize.width-padding));
        return pos;
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
        this.tooltip.style.position="fixed";
        this.tooltip.style.zIndex="9999";
        this.tooltip.style.visibility="hidden";
        this.tooltip.style.top="0px";
        this.tooltip.style.left="0px";
        this.doc.body.appendChild(this.tooltip);
        let pos=this.positionTooltip(step);
        this.tooltip.style.top=pos.top+"px";
        this.tooltip.style.left=pos.left+"px";
        this.tooltip.style.visibility="visible";
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
    prevBtn.textContent=t("tour.back");
    let nextBtn=document.createElement("button");
    nextBtn.className="tg-tour-btn tg-tour-next btn btn-primary";
    nextBtn.textContent=t("tour.next");
    let skipBtn=document.createElement("button");
    skipBtn.className="tg-tour-btn tg-tour-skip btn btn-secondary";
    skipBtn.textContent=t("tour.skip");
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

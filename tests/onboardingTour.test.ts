// @vitest-environment happy-dom
import{describe, test, expect, beforeEach, afterEach, vi}from "vitest"
import{OnboardingTour, calculatePlacement, buildTourTooltip, STORAGE_KEY, DEFAULT_TOUR_STEPS, TourStep}from "../src/core/onboardingTour.js"
function createMemoryStorage(): {getItem: (key: string)=>string|null, setItem: (key: string, value: string)=>void, data: Record<string, string>}{
    let data: Record<string, string>={};
    return{
        getItem: (key: string)=>data[key] ?? null,
        setItem: (key: string, value: string)=>{data[key]=value},
        data
    };
}
function nextFrame(): Promise<void>{
    return new Promise(resolve=>{
        let raf=typeof requestAnimationFrame!=="undefined" ? requestAnimationFrame : (cb: FrameRequestCallback)=>setTimeout(cb, 0);
        raf(()=>resolve());
    });
}
const testSteps: TourStep[]=[
    {id: "step1", target: "#target1", title: "First", content: "First step content", placement: "bottom"},
    {id: "step2", target: "#target2", title: "Second", content: "Second step content", placement: "top"},
    {id: "step3", target: "#target3", title: "Third", content: "Third step content", placement: "left", action: "Click the target."}
];
describe("OnboardingTour", ()=>{
    let storage: ReturnType<typeof createMemoryStorage>;
    let tour: OnboardingTour;
    beforeEach(()=>{
        document.body.innerHTML="";
        storage=createMemoryStorage();
        tour=new OnboardingTour({steps: testSteps, storage});
    });
    afterEach(()=>{
        tour.destroy();
        document.body.innerHTML="";
    });
    test("start sets index to 0", ()=>{
        tour.start();
        expect(tour.getStepIndex()).toBe(0);
        expect(tour.getCurrentStep()?.id).toBe("step1");
    });
    test("next advances to the following step", ()=>{
        tour.start();
        tour.next();
        expect(tour.getStepIndex()).toBe(1);
        expect(tour.getCurrentStep()?.id).toBe("step2");
    });
    test("next on the last step calls finish", ()=>{
        tour.start();
        tour.next();
        tour.next();
        expect(tour.getStepIndex()).toBe(2);
        tour.next();
        expect(tour.isCompleted()).toBe(true);
        expect(tour.getStepIndex()).toBe(2);
    });
    test("previous goes back one step", ()=>{
        tour.start();
        tour.next();
        tour.previous();
        expect(tour.getStepIndex()).toBe(0);
        expect(tour.getCurrentStep()?.id).toBe("step1");
    });
    test("previous at the first step does nothing", ()=>{
        tour.start();
        tour.previous();
        expect(tour.getStepIndex()).toBe(0);
    });
    test("skip marks the tour as completed", ()=>{
        tour.start();
        tour.skip();
        expect(tour.isCompleted()).toBe(true);
    });
    test("finish marks the tour as completed", ()=>{
        tour.start();
        tour.finish();
        expect(tour.isCompleted()).toBe(true);
    });
    test("isCompleted reads true from storage", ()=>{
        storage.setItem(STORAGE_KEY, "true");
        expect(tour.isCompleted()).toBe(true);
    });
    test("isCompleted reads false when storage is empty", ()=>{
        expect(tour.isCompleted()).toBe(false);
    });
    test("reset clears the completed status", ()=>{
        storage.setItem(STORAGE_KEY, "true");
        expect(tour.isCompleted()).toBe(true);
        tour.reset();
        expect(tour.isCompleted()).toBe(false);
    });
    test("getCurrentStep returns undefined before start", ()=>{
        expect(tour.getCurrentStep()).toBeUndefined();
    });
    test("getStepIndex returns -1 before start", ()=>{
        expect(tour.getStepIndex()).toBe(-1);
    });
    test("start renders overlay and tooltip in document", ()=>{
        tour.start();
        expect(document.querySelector(".tg-onboarding-overlay")).not.toBeNull();
        expect(document.querySelector(".tg-onboarding-tooltip")).not.toBeNull();
    });
    test("next re-renders tooltip for the new step", ()=>{
        tour.start();
        tour.next();
        let titleEl=document.querySelector(".tg-tour-title") as HTMLElement;
        expect(titleEl.textContent).toBe("Second");
    });
    test("finish removes overlay and tooltip from document", ()=>{
        tour.start();
        tour.finish();
        expect(document.querySelector(".tg-onboarding-overlay")).toBeNull();
        expect(document.querySelector(".tg-onboarding-tooltip")).toBeNull();
    });
    test("destroy removes overlay and tooltip", ()=>{
        tour.start();
        tour.destroy();
        expect(document.querySelector(".tg-onboarding-overlay")).toBeNull();
        expect(document.querySelector(".tg-onboarding-tooltip")).toBeNull();
    });
    test("renderOverlay creates an HTMLElement", ()=>{
        let overlay=tour.renderOverlay();
        expect(overlay).toBeInstanceOf(HTMLElement);
        expect(overlay.className).toBe("tg-onboarding-overlay");
    });
    test("renderOverlay creates spotlight elements", ()=>{
        let overlay=tour.renderOverlay();
        expect(overlay.querySelectorAll(".tg-onboarding-spotlight").length).toBe(4);
    });
    test("positionTooltip returns centered position when target is missing", ()=>{
        tour.start();
        let pos=tour.positionTooltip(testSteps[0]);
        expect(typeof pos.top).toBe("number");
        expect(typeof pos.left).toBe("number");
        expect(typeof pos.placement).toBe("string");
    });
    test("positionTooltip calculates bottom placement relative to target", ()=>{
        let target=document.createElement("div");
        target.id="target1";
        target.getBoundingClientRect=()=>new DOMRect(100, 100, 50, 50);
        document.body.appendChild(target);
        tour.start();
        let pos=tour.positionTooltip(testSteps[0]);
        expect(pos.top).toBe(150+8);
    });
    test("positionTooltip calculates top placement relative to target", ()=>{
        let target=document.createElement("div");
        target.id="target2";
        target.getBoundingClientRect=()=>new DOMRect(200, 200, 50, 50);
        document.body.appendChild(target);
        tour.start();
        let pos=tour.positionTooltip(testSteps[1]);
        expect(pos.top).toBe(200-160-8);
    });
    test("positionTooltip keeps tooltip within viewport bounds", ()=>{
        let target=document.createElement("div");
        target.id="target1";
        target.getBoundingClientRect=()=>new DOMRect(400, 700, 50, 50);
        document.body.appendChild(target);
        tour.start();
        let pos=tour.positionTooltip(testSteps[0]);
        let viewWidth=window.innerWidth ?? 800;
        let viewHeight=window.innerHeight ?? 600;
        expect(pos.left).toBeGreaterThanOrEqual(8);
        expect(pos.top).toBeGreaterThanOrEqual(8);
        expect(pos.left+240).toBeLessThanOrEqual(viewWidth-8);
        expect(pos.top+160).toBeLessThanOrEqual(viewHeight-8);
    });
    test("positionTooltip flips placement when preferred placement does not fit", ()=>{
        let target=document.createElement("div");
        target.id="target1";
        target.getBoundingClientRect=()=>new DOMRect(400, 700, 50, 50);
        document.body.appendChild(target);
        tour.start();
        let pos=tour.positionTooltip(testSteps[0]);
        expect(pos.placement).toBe("top");
    });
    test("render scrolls target into view before positioning", async ()=>{
        let target=document.createElement("div");
        target.id="target1";
        target.getBoundingClientRect=()=>new DOMRect(100, 100, 50, 50);
        let scrollIntoView=vi.fn();
        target.scrollIntoView=scrollIntoView;
        document.body.appendChild(target);
        tour.start();
        expect(scrollIntoView).toHaveBeenCalledWith({behavior: "smooth", block: "center", inline: "center"});
        await nextFrame();
        expect(document.querySelector(".tg-onboarding-tooltip")).not.toBeNull();
    });
    test("render creates spotlight overlay around target", async ()=>{
        let target=document.createElement("div");
        target.id="target1";
        target.getBoundingClientRect=()=>new DOMRect(100, 100, 50, 50);
        document.body.appendChild(target);
        tour.start();
        await nextFrame();
        let overlay=document.querySelector(".tg-onboarding-overlay");
        expect(overlay).not.toBeNull();
        expect(overlay?.querySelectorAll(".tg-onboarding-spotlight").length).toBe(4);
    });
    test("render sets tooltip data-placement attribute", async ()=>{
        let target=document.createElement("div");
        target.id="target1";
        target.getBoundingClientRect=()=>new DOMRect(100, 100, 50, 50);
        document.body.appendChild(target);
        tour.start();
        await nextFrame();
        let tooltip=document.querySelector(".tg-onboarding-tooltip");
        expect(tooltip).not.toBeNull();
        expect(tooltip?.getAttribute("data-placement")).toMatch(/^(top|bottom|left|right)$/);
    });
    test("buildTourTooltip creates element with title and content", ()=>{
        let tooltip=buildTourTooltip(testSteps[0]);
        expect(tooltip.className).toBe("tg-onboarding-tooltip");
        expect(tooltip.querySelector(".tg-tour-title")?.textContent).toBe("First");
        expect(tooltip.querySelector(".tg-tour-content")?.textContent).toBe("First step content");
    });
    test("buildTourTooltip includes action text when provided", ()=>{
        let tooltip=buildTourTooltip(testSteps[2]);
        expect(tooltip.querySelector(".tg-tour-action-text")?.textContent).toBe("Click the target.");
    });
    test("buildTourTooltip creates next, previous and skip buttons", ()=>{
        let tooltip=buildTourTooltip(testSteps[0]);
        expect(tooltip.querySelector(".tg-tour-next")).not.toBeNull();
        expect(tooltip.querySelector(".tg-tour-prev")).not.toBeNull();
        expect(tooltip.querySelector(".tg-tour-skip")).not.toBeNull();
    });
    test("buildTourTooltip includes arrow element", ()=>{
        let tooltip=buildTourTooltip(testSteps[0]);
        expect(tooltip.querySelector(".tg-tour-arrow")).not.toBeNull();
    });
    test("DEFAULT_TOUR_STEPS contains at least one step", ()=>{
        expect(DEFAULT_TOUR_STEPS.length).toBeGreaterThan(0);
        expect(DEFAULT_TOUR_STEPS[0].id).toBeDefined();
    });
});
describe("calculatePlacement", ()=>{
    test("positions tooltip above target for top placement", ()=>{
        let rect=new DOMRect(100, 100, 50, 50);
        let size={width: 200, height: 80};
        let pos=calculatePlacement(rect, size, "top");
        expect(pos.top).toBe(100-80-8);
        expect(pos.left).toBe(100+50/2-200/2);
    });
    test("positions tooltip below target for bottom placement", ()=>{
        let rect=new DOMRect(100, 100, 50, 50);
        let size={width: 200, height: 80};
        let pos=calculatePlacement(rect, size, "bottom");
        expect(pos.top).toBe(150+8);
        expect(pos.left).toBe(100+50/2-200/2);
    });
    test("positions tooltip to the left of target", ()=>{
        let rect=new DOMRect(100, 100, 50, 50);
        let size={width: 200, height: 80};
        let pos=calculatePlacement(rect, size, "left");
        expect(pos.top).toBe(100+50/2-80/2);
        expect(pos.left).toBe(100-200-8);
    });
    test("positions tooltip to the right of target", ()=>{
        let rect=new DOMRect(100, 100, 50, 50);
        let size={width: 200, height: 80};
        let pos=calculatePlacement(rect, size, "right");
        expect(pos.top).toBe(100+50/2-80/2);
        expect(pos.left).toBe(150+8);
    });
    test("falls back to bottom placement for unknown placement", ()=>{
        let rect=new DOMRect(100, 100, 50, 50);
        let size={width: 200, height: 80};
        let pos=calculatePlacement(rect, size, "unknown");
        expect(pos.top).toBe(150+8);
        expect(pos.left).toBe(100+50/2-200/2);
    });
});

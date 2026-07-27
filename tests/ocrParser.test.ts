import{describe, test, expect, vi, beforeEach}from "vitest";
let mockState=vi.hoisted(()=>{
    return{
        throwOnImport: false,
        createWorker: vi.fn()
    };
});
vi.mock("tesseract.js", ()=>{
    return{
        get createWorker(){
            if(mockState.throwOnImport){
                throw new Error("tesseract.js not installed. Run: npm install tesseract.js");
            }
            return mockState.createWorker;
        }
    };
});
import{DEFAULT_OCR_OPTIONS, SUPPORTED_IMAGE_TYPES, isImageFile, isImageOnlyPdf, recognizeImage, recognizePdf, ocrAuto}from "../src/core/ocrParser.js";
beforeEach(()=>{
    mockState.throwOnImport=false;
    mockState.createWorker.mockReset();
});
function makeMockWorker(text: string, confidence: number, words: any[]): any{
    return{
        recognize: vi.fn().mockResolvedValue({data: {text, confidence, words}}),
        setParameters: vi.fn().mockResolvedValue(undefined),
        terminate: vi.fn().mockResolvedValue(undefined)
    };
}
describe("DEFAULT_OCR_OPTIONS", ()=>{
    test("has expected fields", ()=>{
        expect(DEFAULT_OCR_OPTIONS.languages).toEqual(["eng"]);
        expect(DEFAULT_OCR_OPTIONS.minConfidence).toBe(60);
    });
});
describe("SUPPORTED_IMAGE_TYPES", ()=>{
    test("includes png, jpg, tiff", ()=>{
        expect(SUPPORTED_IMAGE_TYPES).toContain(".png");
        expect(SUPPORTED_IMAGE_TYPES).toContain(".jpg");
        expect(SUPPORTED_IMAGE_TYPES).toContain(".tiff");
    });
});
describe("isImageFile", ()=>{
    test("returns true for png", ()=>{
        expect(isImageFile("photo.png")).toBe(true);
    });
    test("returns true for jpg", ()=>{
        expect(isImageFile("photo.jpg")).toBe(true);
    });
    test("returns false for txt", ()=>{
        expect(isImageFile("notes.txt")).toBe(false);
    });
    test("returns false for pdf", ()=>{
        expect(isImageFile("doc.pdf")).toBe(false);
    });
});
describe("isImageOnlyPdf", ()=>{
    test("returns true for image-only PDF", async()=>{
        let buf: Buffer=Buffer.from("%PDF-1.4 /Subtype /Image /X 1 0 R");
        expect(await isImageOnlyPdf(buf)).toBe(true);
    });
    test("returns false for text PDF", async()=>{
        let buf: Buffer=Buffer.from("%PDF-1.4 /Subtype /Text /X 1 0 R");
        expect(await isImageOnlyPdf(buf)).toBe(false);
    });
    test("returns false for non-PDF", async()=>{
        let buf: Buffer=Buffer.from("not a pdf at all");
        expect(await isImageOnlyPdf(buf)).toBe(false);
    });
});
describe("recognizeImage", ()=>{
    test("returns text from tesseract", async()=>{
        let worker=makeMockWorker("Hello OCR", 95, []);
        mockState.createWorker.mockResolvedValue(worker);
        let result=await recognizeImage(Buffer.from("fake"));
        expect(result.text).toBe("Hello OCR");
    });
    test("respects minConfidence filter", async()=>{
        let words=[
            {text: "High", confidence: 90, bbox: {x0: 0, y0: 0, x1: 10, y1: 10}},
            {text: "Low", confidence: 30, bbox: {x0: 0, y0: 0, x1: 10, y1: 10}}
        ];
        let worker=makeMockWorker("High Low", 60, words);
        mockState.createWorker.mockResolvedValue(worker);
        let result=await recognizeImage(Buffer.from("fake"), {languages: ["eng"], minConfidence: 60});
        expect(result.words).toHaveLength(1);
        expect(result.words[0].text).toBe("High");
    });
    test("passes languages to createWorker", async()=>{
        let worker=makeMockWorker("text", 80, []);
        mockState.createWorker.mockResolvedValue(worker);
        await recognizeImage(Buffer.from("fake"), {languages: ["eng", "fra"]});
        expect(mockState.createWorker).toHaveBeenCalledWith("eng+fra");
    });
    test("throws if tesseract.js not installed", async()=>{
        mockState.throwOnImport=true;
        await expect(recognizeImage(Buffer.from("fake"))).rejects.toThrow("tesseract.js not installed");
        mockState.throwOnImport=false;
    });
    test("terminates worker after recognition", async()=>{
        let worker=makeMockWorker("text", 80, []);
        mockState.createWorker.mockResolvedValue(worker);
        await recognizeImage(Buffer.from("fake"));
        expect(worker.terminate).toHaveBeenCalled();
    });
    test("includes processingTimeMs", async()=>{
        let worker=makeMockWorker("text", 80, []);
        mockState.createWorker.mockResolvedValue(worker);
        let result=await recognizeImage(Buffer.from("fake"));
        expect(typeof result.processingTimeMs).toBe("number");
        expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
});
describe("recognizePdf", ()=>{
    test("throws for non-image-only PDF", async()=>{
        let buf: Buffer=Buffer.from("%PDF-1.4 /Text content here");
        await expect(recognizePdf(buf)).rejects.toThrow("not image-only");
    });
    test("delegates to recognizeImage for image-only PDF", async()=>{
        let buf: Buffer=Buffer.from("%PDF-1.4 /Image content here");
        let worker=makeMockWorker("PDF OCR text", 85, []);
        mockState.createWorker.mockResolvedValue(worker);
        let result=await recognizePdf(buf);
        expect(result.text).toBe("PDF OCR text");
        expect(mockState.createWorker).toHaveBeenCalled();
    });
});
describe("ocrAuto", ()=>{
    test("routes image file to recognizeImage", async()=>{
        let worker=makeMockWorker("image text", 80, []);
        mockState.createWorker.mockResolvedValue(worker);
        let result=await ocrAuto(Buffer.from("fake"), "scan.png");
        expect(result.text).toBe("image text");
        expect(mockState.createWorker).toHaveBeenCalled();
    });
    test("routes pdf to recognizePdf", async()=>{
        let buf: Buffer=Buffer.from("%PDF-1.4 /Image content");
        let worker=makeMockWorker("pdf text", 80, []);
        mockState.createWorker.mockResolvedValue(worker);
        let result=await ocrAuto(buf, "doc.pdf");
        expect(result.text).toBe("pdf text");
        expect(mockState.createWorker).toHaveBeenCalled();
    });
    test("throws for unsupported file type", async()=>{
        await expect(ocrAuto(Buffer.from("fake"), "file.txt")).rejects.toThrow("Unsupported file type");
    });
});

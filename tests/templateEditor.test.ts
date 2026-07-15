// @vitest-environment happy-dom
import{describe,test,expect,beforeEach,afterEach,vi}from "vitest"
import{TemplateEditor}from "../src/renderer/templateEditor.js"
import{t}from "../src/renderer/i18n.js"
import{logger}from "../src/renderer/logger.js"

vi.mock("../src/renderer/toast.js",()=>({
    showToast: vi.fn()
}))

import{showToast}from "../src/renderer/toast.js"

describe("TemplateEditor",()=>{
    let editor: TemplateEditor
    let errorSpy: ReturnType<typeof vi.spyOn>
    let originalFileReader: any
    let mockReader: { onload: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null; result: string | null }

    beforeEach(()=>{
        document.body.innerHTML=""
        vi.clearAllMocks()
        errorSpy=vi.spyOn(logger,"error").mockImplementation(()=>{})
        originalFileReader=(globalThis as any).FileReader
        mockReader=null as any
        ;(globalThis as any).FileReader=class{
            onload: ((e: Event) => void) | null=null
            onerror: ((e: Event) => void) | null=null
            result: string | null=null
            readAsText(){
                mockReader=this as any
            }
        }
        editor=new TemplateEditor()
    })
    afterEach(()=>{
        editor.dispose()
        document.body.innerHTML=""
        errorSpy.mockRestore()
        ;(globalThis as any).FileReader=originalFileReader
    })

    function getOverlay(){
        return document.body.querySelector(".template-editor-overlay") as HTMLDivElement
    }
    function getTextarea(){
        return document.body.querySelector(".template-editor-textarea") as HTMLTextAreaElement
    }
    function getPreviews(){
        let pres=document.body.querySelectorAll(".template-editor-preview")
        return {highlighted: pres[0] as HTMLPreElement, live: pres[1] as HTMLPreElement}
    }
    function getButtonByAria(label: string){
        return Array.from(document.body.querySelectorAll("button")).find(b=>b.getAttribute("aria-label")===label) as HTMLButtonElement
    }
    function getCloseButtons(){
        return Array.from(document.body.querySelectorAll(`button[aria-label="${t("templateEditor.closeAria")}"]`)) as HTMLButtonElement[]
    }
    function getFileInput(){
        return document.body.querySelector('input[type="file"]') as HTMLInputElement
    }

    describe("constructor / DOM creation",()=>{
        test("creates overlay with dialog role and aria-modal",()=>{
            let overlay=getOverlay()
            expect(overlay).not.toBeNull()
            expect(overlay.getAttribute("role")).toBe("dialog")
            expect(overlay.getAttribute("aria-modal")).toBe("true")
            expect(overlay.getAttribute("aria-label")).toBe(t("templateEditor.title"))
        })
        test("creates textarea with placeholder, aria-label, and spellcheck off",()=>{
            let ta=getTextarea()
            expect(ta).not.toBeNull()
            expect(ta.className).toBe("template-editor-textarea")
            expect(ta.getAttribute("aria-label")).toBe(t("templateEditor.contentAria"))
            expect(ta.placeholder).toBe(t("templateEditor.placeholder"))
            expect(ta.spellcheck).toBe(false)
        })
        test("creates load button with secondary class",()=>{
            let loadBtn=getButtonByAria(t("templateEditor.loadAria"))
            expect(loadBtn).not.toBeNull()
            expect(loadBtn.className).toContain("btn-secondary")
        })
        test("creates save button with primary class",()=>{
            let saveBtn=getButtonByAria(t("templateEditor.saveAria"))
            expect(saveBtn).not.toBeNull()
            expect(saveBtn.className).toContain("btn-primary")
        })
        test("appends overlay to document body",()=>{
            expect(document.body.contains(getOverlay())).toBe(true)
        })
        test("creates two preview elements",()=>{
            let pres=document.body.querySelectorAll(".template-editor-preview")
            expect(pres.length).toBe(2)
        })
    })

    describe("loadTemplate / getTemplate",()=>{
        test("getTemplate returns empty string initially",()=>{
            expect(editor.getTemplate()).toBe("")
        })
        test("loadTemplate sets textarea value",()=>{
            editor.loadTemplate("Hello {text}")
            expect(editor.getTemplate()).toBe("Hello {text}")
        })
        test("loadTemplate overwrites previous content",()=>{
            editor.loadTemplate("First")
            editor.loadTemplate("Second {language}")
            expect(editor.getTemplate()).toBe("Second {language}")
        })
        test("loadTemplate updates previews",()=>{
            editor.loadTemplate("Translate {text} to {language}")
            let {highlighted,live}=getPreviews()
            expect(highlighted.innerHTML).toContain("tpl-var-text")
            expect(highlighted.innerHTML).toContain("tpl-var-language")
            expect(live.textContent).toContain(t("templateEditor.sampleText"))
            expect(live.textContent).toContain(t("templateEditor.sampleLanguage"))
        })
    })

    describe("variable substitution / highlighting",()=>{
        test("highlights {text} variable",()=>{
            editor.loadTemplate("{text}")
            let {highlighted}=getPreviews()
            expect(highlighted.innerHTML).toContain('<span class="tpl-var tpl-var-text">{text}</span>')
        })
        test("highlights {language} variable",()=>{
            editor.loadTemplate("{language}")
            let {highlighted}=getPreviews()
            expect(highlighted.innerHTML).toContain('<span class="tpl-var tpl-var-language">{language}</span>')
        })
        test("highlights {prompt_type} variable",()=>{
            editor.loadTemplate("{prompt_type}")
            let {highlighted}=getPreviews()
            expect(highlighted.innerHTML).toContain('<span class="tpl-var tpl-var-prompt">{prompt_type}</span>')
        })
        test("renders sample values for all variables in live preview",()=>{
            editor.loadTemplate("{text} {language} {prompt_type}")
            let {live}=getPreviews()
            expect(live.textContent).toBe(`${t("templateEditor.sampleText")} ${t("templateEditor.sampleLanguage")} ${t("templateEditor.samplePromptType")}`)
        })
        test("escapes HTML in template content for highlighted preview",()=>{
            editor.loadTemplate("<b>bold</b> {text}")
            let {highlighted}=getPreviews()
            expect(highlighted.innerHTML).not.toContain("<b>bold</b>")
            expect(highlighted.innerHTML).toContain("&lt;b&gt;bold&lt;/b&gt;")
        })
        test("preserves variables that appear multiple times",()=>{
            editor.loadTemplate("{text} and {text}")
            let {highlighted,live}=getPreviews()
            let matches=highlighted.innerHTML.match(/tpl-var-text/g)
            expect(matches).not.toBeNull()
            expect(matches!.length).toBe(2)
            let sampleCount=live.textContent!.split(t("templateEditor.sampleText")).length-1
            expect(sampleCount).toBe(2)
        })
    })

    describe("edge cases",()=>{
        test("empty template shows empty placeholder in both previews",()=>{
            editor.loadTemplate("")
            let {highlighted,live}=getPreviews()
            expect(highlighted.innerHTML).toContain(t("templateEditor.emptyTemplate"))
            expect(live.textContent).toBe(t("templateEditor.emptyTemplate"))
        })
        test("template with no variables renders as-is in both previews",()=>{
            editor.loadTemplate("Just plain text")
            let {highlighted,live}=getPreviews()
            expect(highlighted.innerHTML).toBe("Just plain text")
            expect(live.textContent).toBe("Just plain text")
        })
        test("typing in textarea updates previews via input event",()=>{
            let ta=getTextarea()
            ta.value="New {text} content"
            ta.dispatchEvent(new Event("input",{bubbles:true}))
            expect(editor.getTemplate()).toBe("New {text} content")
            let {live}=getPreviews()
            expect(live.textContent).toContain(t("templateEditor.sampleText"))
        })
    })

    describe("show / hide",()=>{
        test("show sets overlay display to flex",()=>{
            editor.show()
            expect(getOverlay().style.display).toBe("flex")
        })
        test("hide sets overlay display to none",()=>{
            editor.show()
            editor.hide()
            expect(getOverlay().style.display).toBe("none")
        })
        test("show focuses first focusable element",()=>{
            editor.show()
            let closeBtns=getCloseButtons()
            expect(document.activeElement).toBe(closeBtns[0])
        })
        test("hide restores focus to previously focused element",()=>{
            let btn=document.createElement("button")
            btn.id="prior-focus"
            document.body.appendChild(btn)
            btn.focus()
            editor.show()
            editor.hide()
            expect(document.activeElement).toBe(btn)
        })
        test("second hide after focus restored does not throw",()=>{
            let btn=document.createElement("button")
            document.body.appendChild(btn)
            btn.focus()
            editor.show()
            editor.hide()
            btn.remove()
            expect(()=>editor.hide()).not.toThrow()
        })
    })

    describe("escape key handling",()=>{
        test("escape hides editor when visible",()=>{
            editor.show()
            expect(getOverlay().style.display).toBe("flex")
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))
            expect(getOverlay().style.display).toBe("none")
        })
        test("escape does nothing when editor not shown",()=>{
            expect(getOverlay().style.display).toBe("")
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))
            expect(getOverlay().style.display).toBe("")
        })
        test("escape after hide does nothing",()=>{
            editor.show()
            editor.hide()
            expect(getOverlay().style.display).toBe("none")
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))
            expect(getOverlay().style.display).toBe("none")
        })
        test("non-escape key does not hide editor",()=>{
            editor.show()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}))
            expect(getOverlay().style.display).toBe("flex")
        })
        test("escape does not hide when a higher z-index modal is active",()=>{
            editor.show()
            let fakeModal=document.createElement("div")
            fakeModal.className="modal active"
            fakeModal.style.zIndex="99999"
            document.body.appendChild(fakeModal)
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))
            expect(getOverlay().style.display).toBe("flex")
        })
    })

    describe("focus trap",()=>{
        test("Tab on last focusable wraps to first",()=>{
            editor.show()
            let closeBtns=getCloseButtons()
            let lastBtn=closeBtns[closeBtns.length-1]
            lastBtn.focus()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true}))
            expect(document.activeElement).toBe(closeBtns[0])
        })
        test("Shift+Tab on first focusable wraps to last",()=>{
            editor.show()
            let closeBtns=getCloseButtons()
            let firstBtn=closeBtns[0]
            firstBtn.focus()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}))
            expect(document.activeElement).toBe(closeBtns[closeBtns.length-1])
        })
        test("Tab on middle element does not wrap",()=>{
            editor.show()
            let ta=getTextarea()
            ta.focus()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true}))
            expect(document.activeElement).toBe(ta)
        })
        test("non-Tab key is ignored by focus trap",()=>{
            editor.show()
            let closeBtns=getCloseButtons()
            let firstBtn=closeBtns[0]
            firstBtn.focus()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}))
            expect(document.activeElement).toBe(firstBtn)
        })
        test("hide removes focus trap so Tab no longer wraps",()=>{
            editor.show()
            editor.hide()
            let closeBtns=getCloseButtons()
            let lastBtn=closeBtns[closeBtns.length-1]
            lastBtn.focus()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true}))
            expect(document.activeElement).toBe(lastBtn)
        })
        test("calling show twice does not add duplicate focus trap",()=>{
            editor.show()
            editor.show()
            let closeBtns=getCloseButtons()
            let lastBtn=closeBtns[closeBtns.length-1]
            lastBtn.focus()
            document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true}))
            expect(document.activeElement).toBe(closeBtns[0])
        })
    })

    describe("backdrop click",()=>{
        test("clicking overlay backdrop hides editor",()=>{
            editor.show()
            let overlay=getOverlay()
            overlay.dispatchEvent(new MouseEvent("click",{bubbles:true}))
            expect(overlay.style.display).toBe("none")
        })
        test("clicking inside modal does not hide editor",()=>{
            editor.show()
            let overlay=getOverlay()
            let modal=overlay.querySelector(".template-editor-modal") as HTMLElement
            modal.dispatchEvent(new MouseEvent("click",{bubbles:true}))
            expect(overlay.style.display).toBe("flex")
        })
    })

    describe("handleSave",()=>{
        test("save with content triggers blob download",()=>{
            let createURL=vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:fake-url")
            let revokeURL=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{})
            editor.loadTemplate("Template content {text}")
            let saveBtn=getButtonByAria(t("templateEditor.saveAria"))
            saveBtn.click()
            expect(createURL).toHaveBeenCalledTimes(1)
            createURL.mockRestore()
            revokeURL.mockRestore()
        })
        test("save with empty content shows warning toast and skips download",()=>{
            let createURL=vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:fake-url")
            editor.loadTemplate("")
            let saveBtn=getButtonByAria(t("templateEditor.saveAria"))
            saveBtn.click()
            expect(createURL).not.toHaveBeenCalled()
            expect(showToast).toHaveBeenCalledWith(t("toast.templateEmpty"),"warning")
            createURL.mockRestore()
        })
        test("save with whitespace-only content shows warning toast",()=>{
            let createURL=vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:fake-url")
            editor.loadTemplate("   \n\t  ")
            let saveBtn=getButtonByAria(t("templateEditor.saveAria"))
            saveBtn.click()
            expect(createURL).not.toHaveBeenCalled()
            expect(showToast).toHaveBeenCalledWith(t("toast.templateEmpty"),"warning")
            createURL.mockRestore()
        })
    })

    describe("handleLoad",()=>{
        test("clicking load creates a hidden file input",()=>{
            let loadBtn=getButtonByAria(t("templateEditor.loadAria"))
            loadBtn.click()
            let input=getFileInput()
            expect(input).not.toBeNull()
            expect(input.type).toBe("file")
            expect(input.accept).toBe(".txt")
            expect(input.style.display).toBe("none")
        })
        test("change with no file removes input without creating reader",()=>{
            let loadBtn=getButtonByAria(t("templateEditor.loadAria"))
            loadBtn.click()
            let input=getFileInput()
            input.dispatchEvent(new Event("change",{bubbles:true}))
            expect(getFileInput()).toBeNull()
            expect(mockReader).toBeNull()
        })
        test("successful file read loads template content",()=>{
            let loadBtn=getButtonByAria(t("templateEditor.loadAria"))
            loadBtn.click()
            let input=getFileInput()
            let fakeFile={name:"template.txt"} as unknown as File
            Object.defineProperty(input,"files",{value:[fakeFile],configurable:true})
            input.dispatchEvent(new Event("change",{bubbles:true}))
            expect(mockReader).not.toBeNull()
            mockReader!.result="Loaded template {text}"
            mockReader!.onload!(new Event("load"))
            expect(editor.getTemplate()).toBe("Loaded template {text}")
            expect(getFileInput()).toBeNull()
        })
        test("file read error logs error and shows toast",()=>{
            let loadBtn=getButtonByAria(t("templateEditor.loadAria"))
            loadBtn.click()
            let input=getFileInput()
            let fakeFile={name:"template.txt"} as unknown as File
            Object.defineProperty(input,"files",{value:[fakeFile],configurable:true})
            input.dispatchEvent(new Event("change",{bubbles:true}))
            mockReader!.onerror!(new Event("error"))
            expect(errorSpy).toHaveBeenCalledWith("Failed to read template file")
            expect(showToast).toHaveBeenCalledWith(t("toast.templateLoadFailed"),"error")
            expect(getFileInput()).toBeNull()
        })
    })

    describe("dispose",()=>{
        test("removes overlay from DOM",()=>{
            let overlay=getOverlay()
            expect(overlay.parentNode).not.toBeNull()
            editor.dispose()
            expect(overlay.parentNode).toBeNull()
        })
        test("calling dispose twice does not throw",()=>{
            editor.dispose()
            expect(()=>editor.dispose()).not.toThrow()
        })
    })
})
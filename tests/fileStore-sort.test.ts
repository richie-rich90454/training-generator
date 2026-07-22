// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createFileStore, type FileStore } from "../src/renderer/stores/fileStore.js"
import { withRoot } from "./setup.js"

let store: FileStore
let dispose: () => void

function createFile(name: string, size: number = 1024, type: string = "text/plain"): File {
    let contentSize = Math.min(size, 1000)
    let file = new File(["x".repeat(contentSize)], name, { type })
    if (size > contentSize) {
        Object.defineProperty(file, "size", { value: size, configurable: true })
    }
    return file
}

beforeEach(() => {
    store = withRoot((d) => {
        dispose = d
        return createFileStore()
    })
})

afterEach(() => {
    dispose()
    vi.restoreAllMocks()
})

describe("FileStore sort defaults", () => {
    it("defaults to date asc", () => {
        expect(store.sortBy()).toBe("date")
        expect(store.sortDir()).toBe("asc")
    })
    it("sortedFiles returns empty array when no files", () => {
        expect(store.sortedFiles()).toEqual([])
    })
    it("sortedFiles returns single file unchanged", () => {
        store.addFiles([createFile("only.txt", 100)])
        expect(store.sortedFiles().map(f => f.name)).toEqual(["only.txt"])
    })
})

describe("FileStore setSortBy toggle behavior", () => {
    it("toggles direction when clicking same column", () => {
        expect(store.sortBy()).toBe("date")
        expect(store.sortDir()).toBe("asc")
        store.setSortBy("date")
        expect(store.sortBy()).toBe("date")
        expect(store.sortDir()).toBe("desc")
        store.setSortBy("date")
        expect(store.sortDir()).toBe("asc")
    })
    it("resets to asc when switching columns", () => {
        // Set date to desc first
        store.setSortBy("date")
        expect(store.sortDir()).toBe("desc")
        // Switch to name
        store.setSortBy("name")
        expect(store.sortBy()).toBe("name")
        expect(store.sortDir()).toBe("asc")
        // Switch to size
        store.setSortBy("size")
        expect(store.sortBy()).toBe("size")
        expect(store.sortDir()).toBe("asc")
    })
    it("does not change sortBy when toggling direction", () => {
        store.setSortBy("name")
        store.setSortBy("name")
        expect(store.sortBy()).toBe("name")
        store.setSortBy("name")
        expect(store.sortBy()).toBe("name")
    })
})

describe("FileStore setSortDir", () => {
    it("sets the sort direction", () => {
        store.setSortDir("desc")
        expect(store.sortDir()).toBe("desc")
        store.setSortDir("asc")
        expect(store.sortDir()).toBe("asc")
    })
    it("does not change sortBy", () => {
        store.setSortBy("name")
        store.setSortDir("desc")
        expect(store.sortBy()).toBe("name")
    })
})

describe("FileStore sortedFiles by name", () => {
    beforeEach(() => {
        store.addFiles([
            createFile("charlie.txt", 100),
            createFile("alpha.txt", 200),
            createFile("bravo.txt", 300)
        ])
    })
    it("sorts by name ascending", () => {
        store.setSortBy("name")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["alpha.txt", "bravo.txt", "charlie.txt"])
    })
    it("sorts by name descending", () => {
        store.setSortBy("name")
        store.setSortBy("name")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["charlie.txt", "bravo.txt", "alpha.txt"])
    })
})

describe("FileStore sortedFiles by size", () => {
    beforeEach(() => {
        store.addFiles([
            createFile("medium.txt", 200),
            createFile("large.txt", 300),
            createFile("small.txt", 100)
        ])
    })
    it("sorts by size ascending", () => {
        store.setSortBy("size")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["small.txt", "medium.txt", "large.txt"])
    })
    it("sorts by size descending", () => {
        store.setSortBy("size")
        store.setSortBy("size")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["large.txt", "medium.txt", "small.txt"])
    })
})

describe("FileStore sortedFiles by date", () => {
    it("sorts by addedAt ascending (insertion order with distinct timestamps)", () => {
        let counter = 1000
        vi.spyOn(Date, "now").mockImplementation(() => counter += 100)
        store.addFiles([createFile("first.txt", 100)])
        store.addFiles([createFile("second.txt", 200)])
        store.addFiles([createFile("third.txt", 300)])
        // Default sort is date asc
        expect(store.sortedFiles().map(f => f.name)).toEqual(["first.txt", "second.txt", "third.txt"])
    })
    it("sorts by addedAt descending", () => {
        let counter = 1000
        vi.spyOn(Date, "now").mockImplementation(() => counter += 100)
        store.addFiles([createFile("first.txt", 100)])
        store.addFiles([createFile("second.txt", 200)])
        store.addFiles([createFile("third.txt", 300)])
        store.setSortBy("date")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["third.txt", "second.txt", "first.txt"])
    })
})

describe("FileStore sort stability (name tiebreaker)", () => {
    it("uses name as tiebreaker for equal sizes (asc)", () => {
        store.addFiles([
            createFile("charlie.txt", 100),
            createFile("alpha.txt", 100),
            createFile("bravo.txt", 100)
        ])
        store.setSortBy("size")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["alpha.txt", "bravo.txt", "charlie.txt"])
    })
    it("uses name as tiebreaker for equal sizes (desc)", () => {
        store.addFiles([
            createFile("alpha.txt", 100),
            createFile("charlie.txt", 100),
            createFile("bravo.txt", 100)
        ])
        store.setSortBy("size")
        store.setSortBy("size")
        // desc: primary cmp = 0 for all, tiebreaker name is also negated
        // so names sort Z->A
        expect(store.sortedFiles().map(f => f.name)).toEqual(["charlie.txt", "bravo.txt", "alpha.txt"])
    })
    it("uses name as tiebreaker for equal dates", () => {
        // All files added in same millisecond will have equal addedAt
        store.addFiles([
            createFile("charlie.txt", 100),
            createFile("alpha.txt", 100),
            createFile("bravo.txt", 100)
        ])
        // Default sort is date asc, all have same addedAt
        expect(store.sortedFiles().map(f => f.name)).toEqual(["alpha.txt", "bravo.txt", "charlie.txt"])
    })
})

describe("FileStore sort config", () => {
    it("respects initialSortBy and initialSortDir", () => {
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ initialSortBy: "name", initialSortDir: "desc" })
        })
        expect(s.sortBy()).toBe("name")
        expect(s.sortDir()).toBe("desc")
        d!()
    })
    it("falls back to defaults for invalid initialSortBy", () => {
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ initialSortBy: "invalid" as never, initialSortDir: "invalid" as never })
        })
        expect(s.sortBy()).toBe("date")
        expect(s.sortDir()).toBe("asc")
        d!()
    })
    it("falls back to defaults when config is empty", () => {
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({})
        })
        expect(s.sortBy()).toBe("date")
        expect(s.sortDir()).toBe("asc")
        d!()
    })
    it("falls back to defaults when config is undefined", () => {
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore()
        })
        expect(s.sortBy()).toBe("date")
        expect(s.sortDir()).toBe("asc")
        d!()
    })
    it("accepts initialSortBy without initialSortDir", () => {
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ initialSortBy: "size" })
        })
        expect(s.sortBy()).toBe("size")
        expect(s.sortDir()).toBe("asc")
        d!()
    })
    it("accepts initialSortDir without initialSortBy", () => {
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ initialSortDir: "desc" })
        })
        expect(s.sortBy()).toBe("date")
        expect(s.sortDir()).toBe("desc")
        d!()
    })
})

describe("FileStore onSortChange callback", () => {
    it("calls onSortChange when setSortBy switches column", () => {
        const cb = vi.fn()
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ onSortChange: cb })
        })
        s.setSortBy("name")
        expect(cb).toHaveBeenCalledWith("name", "asc")
        d!()
    })
    it("calls onSortChange when toggling direction on same column", () => {
        const cb = vi.fn()
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ onSortChange: cb })
        })
        s.setSortBy("date")
        expect(cb).toHaveBeenCalledWith("date", "desc")
        d!()
    })
    it("calls onSortChange when setSortDir is called", () => {
        const cb = vi.fn()
        let s: FileStore
        let d: () => void
        s = withRoot((dispose) => {
            d = dispose
            return createFileStore({ onSortChange: cb })
        })
        s.setSortDir("desc")
        expect(cb).toHaveBeenCalledWith("date", "desc")
        d!()
    })
    it("does not throw when onSortChange is not provided", () => {
        expect(() => store.setSortBy("name")).not.toThrow()
        expect(() => store.setSortDir("desc")).not.toThrow()
    })
})

describe("FileStore sortedFiles immutability", () => {
    it("does not mutate selectedFiles order", () => {
        store.addFiles([
            createFile("charlie.txt", 100),
            createFile("alpha.txt", 200)
        ])
        store.setSortBy("name")
        const sorted = store.sortedFiles()
        expect(sorted.map(f => f.name)).toEqual(["alpha.txt", "charlie.txt"])
        // selectedFiles should still be in insertion order
        expect(store.selectedFiles.map(f => f.name)).toEqual(["charlie.txt", "alpha.txt"])
    })
    it("returns a new array after sort changes (memo recomputes)", () => {
        let counter = 1000
        vi.spyOn(Date, "now").mockImplementation(() => counter += 100)
        store.addFiles([createFile("b.txt", 100)])
        store.addFiles([createFile("a.txt", 200)])
        // Default: date asc with distinct timestamps → insertion order
        const first = store.sortedFiles()
        expect(first.map(f => f.name)).toEqual(["b.txt", "a.txt"])
        store.setSortBy("name")
        // Name asc → [a.txt, b.txt]
        const second = store.sortedFiles()
        expect(second.map(f => f.name)).toEqual(["a.txt", "b.txt"])
        expect(first).not.toBe(second)
    })
})

describe("FileStore sort state persistence across reads", () => {
    it("sort state persists across multiple sortedFiles reads", () => {
        store.addFiles([createFile("b.txt", 100), createFile("a.txt", 200)])
        store.setSortBy("name")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["a.txt", "b.txt"])
        expect(store.sortedFiles().map(f => f.name)).toEqual(["a.txt", "b.txt"])
        store.setSortBy("name")
        expect(store.sortedFiles().map(f => f.name)).toEqual(["b.txt", "a.txt"])
    })
})

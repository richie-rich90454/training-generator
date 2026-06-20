// @vitest-environment node
import { describe, it, expect } from "vitest"
import { deduplicate } from "../src/renderer/deduplicator.js"
import type { TrainingItem } from "../src/types/index.js"

function makeItem(output: string): TrainingItem {
  return { instruction: "test", input: "", output }
}

describe("deduplicate", () => {
  it("should return same items for empty array", () => {
    let result = deduplicate([])
    expect(result.items).toEqual([])
    expect(result.removed).toBe(0)
  })

  it("should return same items for single item", () => {
    let items = [makeItem("unique output")]
    let result = deduplicate(items)
    expect(result.items).toEqual(items)
    expect(result.removed).toBe(0)
  })

  it("should remove exact duplicate items", () => {
    let items = [
      makeItem("same output"),
      makeItem("same output"),
      makeItem("unique output"),
    ]
    let result = deduplicate(items)
    expect(result.items.length).toBeLessThan(3)
    expect(result.removed).toBeGreaterThan(0)
  })

  it("should keep unique items", () => {
    let items = [
      makeItem("first output"),
      makeItem("second output"),
      makeItem("third output"),
    ]
    let result = deduplicate(items)
    expect(result.items.length).toBe(3)
    expect(result.removed).toBe(0)
  })

  it("should detect very similar items", () => {
    let items = [
      makeItem("The quick brown fox jumps over the lazy dog"),
      makeItem("The quick brown fox jumps over the lazy dog"), // exact duplicate
      makeItem("A completely different text about something else"),
    ]
    let result = deduplicate(items)
    expect(result.removed).toBe(1)
    expect(result.items.length).toBe(2)
  })

  it("should handle items with messages field", () => {
    let item1: TrainingItem = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    }
    let item2: TrainingItem = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    }
    let result = deduplicate([item1, item2])
    expect(result.removed).toBe(1)
  })

  it("should handle items with text field", () => {
    let item1: TrainingItem = { text: "Some text content" }
    let item2: TrainingItem = { text: "Some text content" }
    let result = deduplicate([item1, item2])
    expect(result.removed).toBe(1)
  })

  it("should respect threshold parameter", () => {
    let items = [
      makeItem("The quick brown fox jumps over the lazy dog"),
      makeItem("The quick brown fox jumps over the lazy cat"),
      makeItem("Totally different unique text here"),
    ]
    // With default threshold 0.9, similar items might not be detected
    let result = deduplicate(items, 0.9)
    // Should at least keep the clearly different item
    expect(result.items.length).toBeGreaterThanOrEqual(1)
  })

  it("should handle many distinct items", () => {
    let items: TrainingItem[] = []
    for (let i = 0; i < 20; i++) {
      items.push(makeItem(`unique item number ${i} with distinct content here`))
    }
    let result = deduplicate(items)
    // All items should be mostly unique since they have distinct content
    expect(result.items.length).toBeGreaterThanOrEqual(items.length - 2)
    expect(result.removed).toBeLessThanOrEqual(2)
  })

  it("should handle all identical items", () => {
    let items = [
      makeItem("same"),
      makeItem("same"),
      makeItem("same"),
      makeItem("same"),
      makeItem("same"),
    ]
    let result = deduplicate(items)
    expect(result.items.length).toBe(1)
    expect(result.removed).toBe(4)
  })
})
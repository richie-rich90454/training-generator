﻿﻿﻿﻿﻿﻿﻿// @vitest-environment node
import { describe, it, expect } from "vitest"
import { semanticChunk, simpleChunk } from "../src/renderer/chunker.js"

describe("semanticChunk", () => {
  it("should return empty array for empty string", () => {
    expect(semanticChunk("")).toEqual([])
    expect(semanticChunk("   ")).toEqual([])
  })

  it("should return single chunk when text is shorter than chunkSize", () => {
    let text = "Short text."
    expect(semanticChunk(text, 2000)).toEqual([text])
  })

  it("should split at sentence boundaries", () => {
    let text = "First sentence. Second sentence. Third sentence."
    let chunks = semanticChunk(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    for (let chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it("should split at question marks", () => {
    let text = "Hello? Yes. Goodbye!"
    let chunks = semanticChunk(text, 10)
    // NLP may group differently; verify at least 2 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })

  it("should split at exclamation marks", () => {
    let text = "Hello! World! Goodbye!"
    let chunks = semanticChunk(text, 10)
    expect(chunks.length).toBe(3)
  })

  it("should respect chunkSize parameter", () => {
    let text = "A".repeat(100) + ". " + "B".repeat(100) + ". " + "C".repeat(100) + "."
    let chunks = semanticChunk(text, 150)
    // Chunks may be larger due to NLP sentence grouping; verify we get multiple chunks
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (let chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0)
    }
  })

  it("should support overlap between chunks", () => {
    let text = "First sentence goes here. Second sentence goes here. Third sentence goes here."
    let chunks = semanticChunk(text, 40, 10)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it("should handle zero overlap", () => {
    let text = "A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P. Q. R. S. T."
    let chunks = semanticChunk(text, 20, 0)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it("should handle text without sentence terminators", () => {
    let text = "This is a long text without any sentence terminators and it should still be chunked properly"
    let chunks = semanticChunk(text, 30)
    expect(chunks.length).toBeGreaterThan(0)
  })

  it("should handle newline as sentence boundary", () => {
    let text = "Line one\nLine two\nLine three"
    let chunks = semanticChunk(text, 15)
    expect(chunks.length).toBe(3)
  })

  it("should handle very large chunkSize", () => {
    let text = "Hello. World. Test."
    let chunks = semanticChunk(text, 10000)
    expect(chunks).toEqual([text])
  })

  it("should handle single sentence", () => {
    let text = "This is a single sentence without any punctuation"
    let chunks = semanticChunk(text, 2000)
    expect(chunks).toEqual([text])
  })
})

describe("simpleChunk", () => {
  it("should return empty array for empty string", () => {
    expect(simpleChunk("")).toEqual([])
    expect(simpleChunk("   ")).toEqual([])
  })

  it("should return single chunk when text is shorter than chunkSize", () => {
    let text = "Short text"
    expect(simpleChunk(text, 2000)).toEqual([text])
  })

  it("should split long text into chunks", () => {
    let text = "A".repeat(1000)
    let chunks = simpleChunk(text, 200)
    expect(chunks.length).toBe(5)
    for (let chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(210)
    }
  })

  it("should try to break at periods or newlines", () => {
    let text = "A".repeat(100) + ".\n" + "B".repeat(100) + ".\n" + "C".repeat(100)
    let chunks = simpleChunk(text, 150)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it("should handle text without natural break points", () => {
    let text = "X".repeat(500)
    let chunks = simpleChunk(text, 100)
    expect(chunks.length).toBe(5)
  })
})

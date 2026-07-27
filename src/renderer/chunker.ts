// Fast, heuristic sentence splitter used by both the worker and the CLI.
// It intentionally avoids heavy NLP libraries (which can exhaust the renderer
// heap on large markdown files) while still handling common abbreviations and
// CJK punctuation.

// Hard limits to prevent pathological inputs from hanging or exhausting memory.
const MAX_INPUT_CHARS = 10 * 1024 * 1024 // 10 MB of text
const MAX_CHUNKS = 100_000
const MAX_SENTENCES = 1_000_000
const MAX_CHUNK_ITERATIONS = Math.max(MAX_SENTENCES, MAX_CHUNKS) * 2

import { logger } from "./logger.js"

// --- Exported helper functions ---

export function findPreviousWhitespace(text: string, position: number): number {
    for (let i = position - 1; i >= 0; i--) {
        if (/\s/.test(text[i])) return i
    }
    return -1
}

export function findPreviousSentenceBoundary(text: string, position: number): number {
    for (let i = position - 1; i >= 0; i--) {
        let c = text[i]
        // CJK sentence punctuation is a hard boundary regardless of following whitespace
        if (/[。！？]/.test(c)) {
            return i + 1
        }
        if (/[.!?]/.test(c)) {
            let next = i + 1 < text.length ? text[i + 1] : ""
            if (/\s/.test(next) || i + 1 >= text.length) {
                return i + 1
            }
        }
        if (c === "\n" || c === "\r") {
            return i + 1
        }
    }
    return -1
}

function isTableRow(line: string): boolean {
    return line.split("|").length >= 3
}

function isListItem(line: string): boolean {
    return /^(\s*)([-*+]|\d+[.)])\s/.test(line)
}

export function detectSemanticUnits(text: string): { start: number, end: number, type: string }[] {
    let units: { start: number, end: number, type: string }[] = []
    let lines = text.split('\n')
    let pos = 0
    let i = 0

    while (i < lines.length) {
        let line = lines[i]
        let trimmed = line.trimStart()
        let isLastLine = i === lines.length - 1
        let lineLen = line.length + (isLastLine ? 0 : 1)

        // Fenced code block (```)
        if (trimmed.startsWith('```')) {
            let start = pos
            i++
            pos += lineLen
            while (i < lines.length) {
                let l = lines[i]
                let lIsLast = i === lines.length - 1
                let lLen = l.length + (lIsLast ? 0 : 1)
                pos += lLen
                i++
                if (l.trimStart().startsWith('```')) break
            }
            units.push({ start, end: pos, type: 'code_block' })
            continue
        }

        // Table row (| delimited lines)
        if (isTableRow(trimmed)) {
            let start = pos
            i++
            pos += lineLen
            while (i < lines.length) {
                let l = lines[i]
                let t = l.trimStart()
                if (isTableRow(t)) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                } else {
                    break
                }
            }
            units.push({ start, end: pos, type: 'table' })
            continue
        }

        // Indented code block (4+ spaces, with content)
        if (/^ {4,}\S/.test(line)) {
            let start = pos
            i++
            pos += lineLen
            while (i < lines.length) {
                let l = lines[i]
                if (l.trim().length === 0 || /^ {4,}/.test(l)) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                } else {
                    break
                }
            }
            units.push({ start, end: pos, type: 'code_block' })
            continue
        }

        // List items (bullet: - * + or numbered: 1. 2) )
        if (isListItem(line)) {
            let start = pos
            i++
            pos += lineLen
            while (i < lines.length) {
                let l = lines[i]
                if (l.trim().length === 0) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                    if (i < lines.length && isListItem(lines[i])) {
                        continue
                    } else {
                        break
                    }
                }
                if (isListItem(l)) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                } else if (/^ {2,}\S/.test(l) && !isListItem(l)) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                } else {
                    break
                }
            }
            units.push({ start, end: pos, type: 'list' })
            continue
        }

        pos += lineLen
        i++
    }

    return units
}

export function isInSemanticUnit(position: number, units: { start: number, end: number, type: string }[]): boolean {
    for (let u of units) {
        if (position > u.start && position < u.end) return true
    }
    return false
}

// --- Internal helpers ---

function findContainingUnit(position: number, units: { start: number, end: number, type: string }[]): { start: number, end: number, type: string } | null {
    for (let u of units) {
        if (position >= u.start && position < u.end) return u
    }
    return null
}

function getSentenceRanges(text: string, sentences: string[]): { text: string, start: number, end: number }[] {
    let ranges: { text: string, start: number, end: number }[] = []
    let searchFrom = 0
    for (let s of sentences) {
        let idx = text.indexOf(s, searchFrom)
        if (idx === -1) {
            let trimmed = s.trim()
            idx = text.indexOf(trimmed, searchFrom)
            if (idx === -1) continue
            ranges.push({ text: s, start: idx, end: idx + trimmed.length })
            searchFrom = idx + trimmed.length
        } else {
            ranges.push({ text: s, start: idx, end: idx + s.length })
            searchFrom = idx + s.length
        }
    }
    return ranges
}

function getLastSentences(text: string, count: number): string[] {
    let sentences = splitSentences(text)
    return sentences.slice(-count)
}

function splitUnitAtRowBoundary(unitText: string, unitType: string): string[] {
    let lines = unitText.split('\n')
    let rows: string[] = []

    if (unitType === 'table') {
        // Split at line boundaries; each line is a table row per isTableRow predicate
        for (let i = 0; i < lines.length; i++) {
            rows.push(lines[i])
        }
    } else if (unitType === 'code_block') {
        // Split at line boundaries
        for (let i = 0; i < lines.length; i++) {
            rows.push(lines[i])
        }
    } else if (unitType === 'list') {
        // Split at item boundaries using the same predicate as detection
        let currentItem = ""
        for (let i = 0; i < lines.length; i++) {
            let l = lines[i]
            if (isListItem(l) && currentItem.length > 0) {
                rows.push(currentItem)
                currentItem = l
            } else {
                currentItem += (currentItem ? "\n" : "") + l
            }
        }
        if (currentItem.length > 0) rows.push(currentItem)
    } else {
        return [unitText]
    }

    return rows
}

// Splits a chunk that exceeds chunkSize into smaller pieces, attempting to
// break at whitespace boundaries. Used as a safety net for sentences or
// semantic units that are individually larger than chunkSize (which would
// otherwise be emitted whole and violate the chunkSize contract).
function splitOversizedChunk(chunk: string, chunkSize: number): string[] {
    if (chunk.length <= chunkSize) return [chunk]
    let parts: string[] = []
    let start = 0
    while (start < chunk.length) {
        if (parts.length >= MAX_CHUNKS) {
            logger.warn(`splitOversizedChunk: exceeded ${MAX_CHUNKS} parts; stopping early`)
            break
        }
        let end = Math.min(start + chunkSize, chunk.length)
        if (end < chunk.length) {
            // Try to break at a whitespace boundary near the end so we don't
            // split mid-word. Only accept a boundary in the back half of the
            // chunk to avoid producing tiny fragments.
            let wsIdx = findPreviousWhitespace(chunk, end)
            if (wsIdx > start + Math.floor(chunkSize / 2)) {
                end = wsIdx
            }
        }
        let part = chunk.slice(start, end).trim()
        if (part.length > 0) parts.push(part)
        if (end <= start) {
            // Defensive guard against any accidental infinite loop.
            end = start + 1
        }
        start = end
    }
    return parts
}

// --- Main chunking functions ---

export function estimateTextDensity(text: string, sentences?: string[]): number {
    if (!text || text.length === 0) return 0.5
    let words = text.split(/\s+/).length
    let chars = text.length
    let sentenceCount = (sentences ?? splitSentences(text)).length
    if (sentenceCount === 0 || words === 0) return 0.5
    let avgSentenceLen = chars / sentenceCount
    let density = Math.min(1, (words / chars) * avgSentenceLen / 50)
    return density
}

function buildContextPrefix(previousChunkText: string): string {
    if (!previousChunkText) return ""
    let lastSentences = getLastSentences(previousChunkText, 2)
    if (lastSentences.length === 0) return ""
    return "[CONTEXT FROM PREVIOUS CHUNK:] " + lastSentences.join(" ") + " "
}

function buildOverlapPrefix(previousChunkText: string, overlap: number): string {
    if (!previousChunkText || overlap <= 0) return ""
    let start = Math.max(0, previousChunkText.length - overlap)
    // Avoid splitting a surrogate pair: if the slice starts on a low surrogate,
    // back up one position to include its high surrogate partner.
    if (start > 0) {
        const code = previousChunkText.charCodeAt(start)
        if (code >= 0xDC00 && code <= 0xDFFF) {
            start -= 1
        }
    }
    return previousChunkText.slice(start) + " "
}

function buildPrefix(previousChunkText: string, overlap: number): string {
    if (overlap > 0) {
        return buildOverlapPrefix(previousChunkText, overlap)
    }
    return buildContextPrefix(previousChunkText)
}

export function semanticChunk(text: string, chunkSize: number = 2000, overlap: number = 100, smartSizing: boolean = false, sentences?: string[]): string[] {
    if (!text || text.trim().length === 0) return []
    if (text.length > MAX_INPUT_CHARS) {
        text = text.slice(0, MAX_INPUT_CHARS)
    }
    chunkSize = Math.min(Math.max(chunkSize, 1), 50000)
    overlap = Math.min(Math.max(overlap, 0), Math.floor(chunkSize / 2))

    if (smartSizing) {
        let density = estimateTextDensity(text, sentences)
        if (density < 0.3) {
            chunkSize = chunkSize * 2
        } else if (density < 0.6) {
            chunkSize = Math.floor(chunkSize * 1.5)
        }
    }
    if (text.length <= chunkSize) return [text]

    let effectiveSentences = sentences ?? splitSentences(text)
    let sentenceRanges = getSentenceRanges(text, effectiveSentences)
    let semanticUnits = detectSemanticUnits(text)
    let chunks: string[] = []
    let currentChunk = ""
    let previousChunkText = ""
    let i = 0
    let iterations = 0

    while (i < effectiveSentences.length) {
        iterations++
        if (iterations > MAX_CHUNK_ITERATIONS) {
            logger.warn(`semanticChunk: exceeded ${MAX_CHUNK_ITERATIONS} iterations; stopping early`)
            break
        }
        if (chunks.length >= MAX_CHUNKS) {
            logger.warn(`semanticChunk: exceeded ${MAX_CHUNKS} chunks; stopping early`)
            break
        }

        let sentence = effectiveSentences[i]
        let range = sentenceRanges[i]
        if (!range) {
            i++
            continue
        }

        // Check if this sentence starts inside a semantic unit
        let unit = findContainingUnit(range.start, semanticUnits)

        if (unit) {
            let unitText = text.slice(unit.start, unit.end).trim()
            let unitSize = unitText.length

            if (unitSize <= chunkSize * 2) {
                // Unit fits within 2x chunkSize — keep it together
                if (currentChunk.length > 0 && currentChunk.length + unitSize > chunkSize) {
                    // Push current chunk, start new one with the unit
                    chunks.push(currentChunk.trim())
                    previousChunkText = currentChunk.trim()
                    currentChunk = buildPrefix(previousChunkText, overlap) + unitText
                } else {
                    // Include unit in current chunk
                    currentChunk += (currentChunk ? " " : "") + unitText
                }

                // Skip all sentences inside this unit. Always advance at least one
                // sentence to guarantee progress and avoid an infinite loop if a
                // sentence range somehow extends past the unit boundary.
                let startIndex = i
                while (i < effectiveSentences.length) {
                    let r = sentenceRanges[i]
                    if (!r) break
                    if (i > startIndex && r.end > unit.end) break
                    i++
                }
                continue
            } else {
                // Oversized unit: split at row/item boundary
                let rows = splitUnitAtRowBoundary(unitText, unit.type)
                // Push current chunk if non-empty
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim())
                    previousChunkText = currentChunk.trim()
                    currentChunk = buildPrefix(previousChunkText, overlap)
                }

                for (let row of rows) {
                    if (currentChunk.length + row.length > chunkSize && currentChunk.length > 0) {
                        chunks.push(currentChunk.trim())
                        previousChunkText = currentChunk.trim()
                        currentChunk = buildPrefix(previousChunkText, overlap) + row
                    } else {
                        // Rows come from code blocks, tables, and lists — multi-line
                        // structures that must stay newline-separated. Joining with a
                        // space would collapse code lines and table rows onto one line.
                        currentChunk += (currentChunk ? "\n" : "") + row
                    }
                }

                // Skip all sentences inside this unit. Always advance at least one
                // sentence to guarantee progress.
                let startIndex = i
                while (i < effectiveSentences.length) {
                    let r = sentenceRanges[i]
                    if (!r) break
                    if (i > startIndex && r.end > unit.end) break
                    i++
                }
                continue
            }
        }

        // Normal sentence (not in a semantic unit)
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
            // Enforce word boundary at chunk boundary
            let boundary = currentChunk.length
            let wsIdx = findPreviousWhitespace(currentChunk, boundary)
            let tail = ""
            if (wsIdx > boundary - 20) {
                tail = currentChunk.slice(wsIdx + 1).trim()
                currentChunk = currentChunk.slice(0, wsIdx).trimEnd()
            }

            chunks.push(currentChunk.trim())
            previousChunkText = currentChunk.trim()

            currentChunk = buildPrefix(previousChunkText, overlap) + (tail ? tail + " " : "") + sentence
        } else if (currentChunk.length === 0 && sentence.length > chunkSize * 2) {
            // Single sentence is much larger than chunkSize and there is no
            // existing chunk to append to. Split it now so we don't emit a
            // chunk that is many times the requested size. The 2x threshold
            // avoids interfering with the normal accumulation path (which
            // tests expect to produce slightly-oversized chunks when context
            // prefixes or sentence grouping apply).
            let parts = splitOversizedChunk(sentence, chunkSize)
            for (let p of parts) {
                if (p.trim().length === 0) continue
                chunks.push(p.trim())
                previousChunkText = p.trim()
            }
            currentChunk = ""
        } else {
            currentChunk += (currentChunk ? " " : "") + sentence
        }
        i++
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
    }

    // Safety net: split any chunk that is pathologically larger than chunkSize
    // (more than 10x). The 10x threshold avoids interfering with the existing
    // context-prefix accumulation behaviour (which intentionally produces
    // chunks somewhat larger than chunkSize) while still preventing a single
    // runaway sentence or semantic unit from producing a chunk that is
    // hundreds of times the requested size. Also drop any chunks that became
    // empty after trimming.
    let result: string[] = []
    for (let chunk of chunks) {
        let trimmed = chunk.trim()
        if (trimmed.length === 0) continue
        if (trimmed.length > chunkSize * 10) {
            for (let part of splitOversizedChunk(trimmed, chunkSize)) {
                if (part.trim().length > 0) result.push(part.trim())
            }
        } else {
            result.push(trimmed)
        }
    }
    return result
}

export function simpleChunk(text: string, chunkSize: number = 2000): string[] {
    if (!text || text.trim().length === 0) return []
    if (text.length > MAX_INPUT_CHARS) {
        text = text.slice(0, MAX_INPUT_CHARS)
    }
    chunkSize = Math.min(Math.max(chunkSize, 1), 50000)
    if (text.length <= chunkSize) return [text]

    let semanticUnits = detectSemanticUnits(text)
    let chunks: string[] = []
    let start = 0

    while (start < text.length) {
        if (chunks.length >= MAX_CHUNKS) {
            logger.warn(`simpleChunk: exceeded ${MAX_CHUNKS} chunks; stopping early`)
            break
        }
        let end = start + chunkSize
        if (end < text.length) {
            // Find word boundary
            let wsBoundary = findPreviousWhitespace(text, end)

            // Find sentence boundary
            let sentBoundary = findPreviousSentenceBoundary(text, end)

            // Find semantic unit boundary (if end falls inside a unit)
            let unitBoundary = -1
            for (let u of semanticUnits) {
                if (end > u.start && end < u.end) {
                    unitBoundary = u.start
                    break
                }
            }

            let candidates = [wsBoundary, sentBoundary, unitBoundary].filter(b => b > start + chunkSize / 2)
            let breakPoint = candidates.length > 0 ? Math.max(...candidates) : -1

            if (breakPoint > start + chunkSize / 2) {
                end = breakPoint
            }
        }
        chunks.push(text.slice(start, end).trim())
        start = end
    }

    // Filter out any chunks that became empty after trimming (e.g. a slice
    // that landed entirely on a run of whitespace between word boundaries).
    return chunks.filter(c => c.trim().length > 0)
}

const ABBREVIATIONS = new Set([
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "eg", "ie",
    "inc", "ltd", "corp", "llc", "st", "ave", "blvd", "rd", "pl", "no",
    "vol", "vols", "pp", "pg", "cf", "et", "al", "approx", "dept", "univ",
    "fig", "figs", "eq", "eqs", "ch", "chs", "sec", "secs"
])

function wordBeforePosition(text: string, position: number): string {
    let start = position - 1
    while (start >= 0 && !/\s/.test(text[start])) {
        start--
    }
    return text.slice(start + 1, position).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

function isAbbreviationBoundary(text: string, position: number): boolean {
    let word = wordBeforePosition(text, position)
    return ABBREVIATIONS.has(word)
}

function pushNewlineSentence(result: string[], current: string): string {
    let trimmed = current.trim()
    if (trimmed.length > 0) {
        result.push(trimmed)
    }
    return ""
}

function containsCJK(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        let code = text.charCodeAt(i)
        if (
            (code >= 0x4E00 && code <= 0x9FFF) ||
            (code >= 0x3400 && code <= 0x4DBF) ||
            (code >= 0xF900 && code <= 0xFAFF) ||
            (code >= 0x3040 && code <= 0x309F) ||
            (code >= 0x30A0 && code <= 0x30FF) ||
            (code >= 0xAC00 && code <= 0xD7AF)
        ) {
            return true
        }
    }
    return false
}

export function splitSentences(text: string): string[] {
    if (!text || text.length === 0) return []
    if (text.length > MAX_INPUT_CHARS) {
        // Truncate to a safe size; the caller is responsible for warning the user.
        text = text.slice(0, MAX_INPUT_CHARS)
    }
    // CJK texts use full-width punctuation and do not need abbreviation handling.
    if (/[\u3002\uFF01\uFF1F]/.test(text)) {
        const result: string[] = []
        let current = ""
        for (let i = 0; i < text.length; i++) {
            if (result.length >= MAX_SENTENCES) break
            current += text[i]
            if (/[\u3002\uFF01\uFF1F]/.test(text[i])) {
                result.push(current.trim())
                current = ""
            }
            else if (text[i] === "\n" || text[i] === "\r") {
                current = pushNewlineSentence(result, current)
                if (text[i] === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
                    i++
                }
            }
        }
        if (current.trim().length > 0 && result.length < MAX_SENTENCES) {
            result.push(current.trim())
        }
        return result.length > 0 ? result : [text]
    }

    // CJK text without any sentence punctuation or newlines: there are no
    // whitespace-delimited word boundaries or ASCII sentence terminators to
    // split on, so the Latin path below would return the whole text as a
    // single sentence. Fall back to a character-count split so the chunker
    // can still break the text into reasonable pieces.
    if (containsCJK(text) && !/[.!?。！？\n\r]/.test(text)) {
        const result: string[] = []
        const chunkLen = 200
        for (let i = 0; i < text.length; i += chunkLen) {
            if (result.length >= MAX_SENTENCES) break
            let chunk = text.slice(i, i + chunkLen).trim()
            if (chunk.length > 0) result.push(chunk)
        }
        return result.length > 0 ? result : [text]
    }

    const result: string[] = []
    let current = ""
    for (let i = 0; i < text.length; i++) {
        if (result.length >= MAX_SENTENCES) break
        current += text[i]
        const c = text[i]

        if (c === "\n" || c === "\r") {
            current = pushNewlineSentence(result, current)
            if (c === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
                i++
            }
            continue
        }

        if (c !== "." && c !== "!" && c !== "?") continue

        const next = text[i + 1] || ""
        // Sentence punctuation must be followed by whitespace, a quote, or EOF.
        if (
            next !== "" &&
            !/\s/.test(next) &&
            next !== '"' && next !== "'" && next !== "”" && next !== "»"
        ) {
            continue
        }

        // Skip abbreviations (Dr., Mr., etc.) and decimal numbers (1.0).
        const prevWord = wordBeforePosition(text, i)
        if (ABBREVIATIONS.has(prevWord)) continue
        if (/\d$/.test(prevWord)) continue

        result.push(current.trim())
        current = ""
    }
    if (current.trim().length > 0 && result.length < MAX_SENTENCES) {
        result.push(current.trim())
    }
    return result.length > 0 ? result : [text]
}

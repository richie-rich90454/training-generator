import nlp from "compromise"

// --- Exported helper functions ---

export function findPreviousWhitespace(text: string, position: number): number {
    for (let i = position - 1; i >= 0; i--) {
        if (/\s/.test(text[i])) return i
    }
    return -1
}

export function findPreviousSentenceBoundary(text: string, position: number): number {
    for (let i = position - 1; i >= 0; i--) {
        if (/[.!?。！？]/.test(text[i])) {
            let next = i + 1 < text.length ? text[i + 1] : ""
            if (/\s/.test(next) || i + 1 >= text.length) {
                return i + 1
            }
        }
    }
    return -1
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
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.indexOf('|', 1) < trimmed.length - 1) {
            let start = pos
            i++
            pos += lineLen
            while (i < lines.length) {
                let l = lines[i]
                let t = l.trimStart()
                if (t.startsWith('|') && t.indexOf('|', 1) < t.length - 1) {
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
        if (/^(\s*)([-*+]|\d+[.)])\s/.test(line)) {
            let start = pos
            i++
            pos += lineLen
            while (i < lines.length) {
                let l = lines[i]
                if (l.trim().length === 0) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                    if (i < lines.length && /^(\s*)([-*+]|\d+[.)])\s/.test(lines[i])) {
                        continue
                    } else {
                        break
                    }
                }
                if (/^(\s*)([-*+]|\d+[.)])\s/.test(l)) {
                    let lIsLast = i === lines.length - 1
                    pos += l.length + (lIsLast ? 0 : 1)
                    i++
                } else if (/^ {2,}\S/.test(l) && !/^(\s*)([-*+]|\d+[.)])\s/.test(l)) {
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

    if (unitType === 'table' || unitType === 'code_block') {
        // Split at line boundaries
        for (let i = 0; i < lines.length; i++) {
            rows.push(lines[i])
        }
    } else if (unitType === 'list') {
        // Split at item boundaries
        let currentItem = ""
        for (let i = 0; i < lines.length; i++) {
            let l = lines[i]
            if (/^(\s*)([-*+]|\d+[.)])\s/.test(l) && currentItem.length > 0) {
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

// --- Main chunking functions ---

export function estimateTextDensity(text: string): number {
    if (!text || text.length === 0) return 0.5
    let words = text.split(/\s+/).length
    let chars = text.length
    let sentences = splitSentences(text).length
    if (sentences === 0 || words === 0) return 0.5
    let avgSentenceLen = chars / sentences
    let density = Math.min(1, (words / chars) * avgSentenceLen / 50)
    return density
}

export function semanticChunk(text: string, chunkSize: number = 2000, overlap: number = 100, smartSizing: boolean = false): string[] {
    if (smartSizing) {
        let density = estimateTextDensity(text)
        if (density < 0.3) {
            chunkSize = chunkSize * 2
        } else if (density < 0.6) {
            chunkSize = Math.floor(chunkSize * 1.5)
        }
    }
    if (!text || text.trim().length === 0) return []
    if (text.length <= chunkSize) return [text]

    let sentences = splitSentences(text)
    let sentenceRanges = getSentenceRanges(text, sentences)
    let semanticUnits = detectSemanticUnits(text)
    let chunks: string[] = []
    let currentChunk = ""
    let previousChunkText = ""
    let i = 0

    while (i < sentences.length) {
        let sentence = sentences[i]
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

                    let contextPrefix = buildContextPrefix(previousChunkText)
                    currentChunk = contextPrefix + unitText

                    if (overlap > 0 && previousChunkText.length > 0) {
                        let overlapText = previousChunkText.slice(-overlap)
                        currentChunk = contextPrefix + overlapText + " " + unitText
                    }
                } else {
                    // Include unit in current chunk
                    currentChunk += (currentChunk ? " " : "") + unitText
                }

                // Skip all sentences inside this unit
                while (i < sentences.length) {
                    let r = sentenceRanges[i]
                    if (!r || r.end > unit.end) break
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
                    currentChunk = buildContextPrefix(previousChunkText)
                }

                for (let row of rows) {
                    if (currentChunk.length + row.length > chunkSize && currentChunk.length > 0) {
                        chunks.push(currentChunk.trim())
                        previousChunkText = currentChunk.trim()
                        currentChunk = buildContextPrefix(previousChunkText) + row
                    } else {
                        currentChunk += (currentChunk ? " " : "") + row
                    }
                }

                // Skip all sentences inside this unit
                while (i < sentences.length) {
                    let r = sentenceRanges[i]
                    if (!r || r.end > unit.end) break
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
            if (wsIdx > boundary - 20) {
                // Word boundary is close — trim to it
                currentChunk = currentChunk.slice(0, wsIdx)
            }

            chunks.push(currentChunk.trim())
            previousChunkText = currentChunk.trim()

            let contextPrefix = buildContextPrefix(previousChunkText)
            if (overlap > 0) {
                let overlapText = previousChunkText.slice(-overlap)
                currentChunk = contextPrefix + overlapText + " " + sentence
            } else {
                currentChunk = contextPrefix + sentence
            }
        } else {
            currentChunk += (currentChunk ? " " : "") + sentence
        }
        i++
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
    }

    return chunks
}

function buildContextPrefix(previousChunkText: string): string {
    if (!previousChunkText) return ""
    let lastSentences = getLastSentences(previousChunkText, 2)
    if (lastSentences.length === 0) return ""
    return "[CONTEXT FROM PREVIOUS CHUNK:] " + lastSentences.join(" ") + " "
}

export function simpleChunk(text: string, chunkSize: number = 2000): string[] {
    if (!text || text.trim().length === 0) return []
    if (text.length <= chunkSize) return [text]

    let semanticUnits = detectSemanticUnits(text)
    let chunks: string[] = []
    let start = 0

    while (start < text.length) {
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

    return chunks
}

function splitSentences(text: string): string[] {
    try {
        let doc = nlp(text)
        let sentences = doc.sentences().out("array") as string[]
        if (sentences && sentences.length > 0) return sentences
    }
    catch { }
    let result: string[] = []
    let current = ""
    for (let i = 0; i < text.length; i++) {
        current += text[i]
        let c = text[i]
        let next = text[i + 1] || ""
        if ((c === "." || c === "!" || c === "?") && (next === " " || next === "\n" || next === "\r" || i === text.length - 1)) {
            result.push(current.trim())
            current = ""
        }
        else if (c === "\n" && current.trim().length > 0) {
            result.push(current.trim())
            current = ""
        }
    }
    if (current.trim().length > 0) {
        result.push(current.trim())
    }
    return result.length > 0 ? result : [text]
}
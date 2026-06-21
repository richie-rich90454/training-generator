import type { TrainingItem } from "../types/index.js"

export interface QualityFlag {
  itemIndex: number
  item: TrainingItem
  reasons: string[]
}

export interface QualityReport {
  totalItems: number
  flaggedItems: number
  passRate: number
  flags: QualityFlag[]
  breakdown: Record<string, number>
}

export function validateItems(items: TrainingItem[], sourceText?: string): QualityReport {
  let flags: QualityFlag[] = []
  
  for (let i = 0; i < items.length; i++) {
    let item = items[i]
    let reasons: string[] = []
    
    // Check 1: Minimum answer length (20 chars)
    let answer = item.output || ""
    if (item.messages) {
      answer = item.messages.map(m => m.content).join(" ")
    }
    if (answer.length < 20) {
      reasons.push("answer_too_short")
    }
    
    // Check 2: Q&A pair completeness
    if (item.instruction && !item.output) {
      reasons.push("missing_answer")
    }
    if (!item.instruction && item.output) {
      reasons.push("missing_question")
    }
    
    // Check 3: Language consistency (basic check)
    if (item.instruction && item.output) {
      let qHasCJK = /[\u4e00-\u9fff]/.test(item.instruction)
      let aHasCJK = /[\u4e00-\u9fff]/.test(item.output)
      if (qHasCJK !== aHasCJK) {
        reasons.push("language_mismatch")
      }
    }
    
    if (reasons.length > 0) {
      flags.push({ itemIndex: i, item, reasons })
    }
  }
  
  let breakdown: Record<string, number> = {}
  for (let flag of flags) {
    for (let reason of flag.reasons) {
      breakdown[reason] = (breakdown[reason] || 0) + 1
    }
  }
  
  return {
    totalItems: items.length,
    flaggedItems: flags.length,
    passRate: items.length > 0 ? Math.round(((items.length - flags.length) / items.length) * 100) : 100,
    flags,
    breakdown
  }
}
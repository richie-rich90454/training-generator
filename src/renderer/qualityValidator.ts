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
    
    if (item.messages) {
      // Messages format: check that messages is non-empty and each has role/content
      if (!item.messages.length) {
        reasons.push("missing_answer")
      } else {
        for (let msg of item.messages) {
          if (!msg.role || !msg.content) {
            reasons.push("missing_answer")
            break
          }
        }
        let answer = item.messages.map(m => m.content).join(" ")
        if (answer.length < 20) {
          reasons.push("answer_too_short")
        }
      }
    } else if (item.text) {
      // Text format: check that text is non-empty and has minimum length
      if (!item.text) {
        reasons.push("missing_answer")
      } else if (item.text.length < 20) {
        reasons.push("answer_too_short")
      }
    } else {
      // Instruction format: existing checks
      let answer = item.output || ""
      if (answer.length < 20) {
        reasons.push("answer_too_short")
      }
      if (item.instruction && !item.output) {
        reasons.push("missing_answer")
      }
      if (!item.instruction && item.output) {
        reasons.push("missing_question")
      }
      if (item.instruction && item.output) {
        let qHasCJK = /[\u4e00-\u9fff]/.test(item.instruction)
        let aHasCJK = /[\u4e00-\u9fff]/.test(item.output)
        if (qHasCJK !== aHasCJK) {
          reasons.push("language_mismatch")
        }
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
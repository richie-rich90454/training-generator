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

const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

function hasCJK(text: string): boolean {
  return CJK_RE.test(text)
}

export function validateItems(items: TrainingItem[]): QualityReport {
  let flags: QualityFlag[] = []

  for (let i = 0; i < items.length; i++) {
    let item = items[i]
    let reasons: string[] = []

    if (item.messages) {
      if (!item.messages.length) {
        reasons.push("missing_answer")
      } else {
        let answer = ""
        let hasMissing = false
        for (let msg of item.messages) {
          if (!msg.role || !msg.content) {
            hasMissing = true
            break
          }
          if (msg.role === "assistant") {
            answer += msg.content + " "
          }
        }
        if (hasMissing) {
          reasons.push("missing_answer")
        }
        else if (answer.trim().length < 20) {
          reasons.push("answer_too_short")
        }
        let userText = item.messages.filter(m => m.role === "user").map(m => m.content).join(" ")
        let assistantText = item.messages.filter(m => m.role === "assistant").map(m => m.content).join(" ")
        if (userText && assistantText && hasCJK(userText) !== hasCJK(assistantText)) {
          reasons.push("language_mismatch")
        }
      }
    } else if (item.text) {
      if (item.text.length < 20) {
        reasons.push("answer_too_short")
      }
      let pairedText = item.instruction || item.input || ""
      if (pairedText && item.text && hasCJK(pairedText) !== hasCJK(item.text)) {
        reasons.push("language_mismatch")
      }
    } else {
      let answer = item.output || ""
      let question = item.instruction || item.input || ""
      if (!question && !answer) {
        reasons.push("missing_question")
        reasons.push("missing_answer")
      } else if (question && !answer) {
        reasons.push("missing_answer")
      } else if (!question && answer) {
        reasons.push("missing_question")
      } else if (answer.length < 20) {
        reasons.push("answer_too_short")
      }
      if (question && answer && hasCJK(question) !== hasCJK(answer)) {
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

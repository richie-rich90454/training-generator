type ToastType = "info" | "success" | "warning" | "error"

interface ToastItem {
  id: number
  message: string
  type: ToastType
  element: HTMLDivElement
  timer: ReturnType<typeof setTimeout>
}

class Toast {
  private container: HTMLDivElement
  private toasts: ToastItem[] = []
  private maxVisible = 5
  private defaultDuration = 4000
  private nextId = 0

  constructor() {
    this.container = document.getElementById("toast-container") as HTMLDivElement
    if (!this.container) {
      this.container = document.createElement("div")
      this.container.id = "toast-container"
      this.container.className = "toast-container"
      document.body.appendChild(this.container)
    }
  }

  show(message: string, type: ToastType = "info", duration?: number): void {
    const id = this.nextId++
    const toastDuration = duration ?? this.defaultDuration

    const element = document.createElement("div")
    element.className = `toast toast-${type}`
    element.innerHTML = `
      <span class="toast-icon">${this.getIcon(type)}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `

    const timer = setTimeout(() => {
      this.dismiss(id)
    }, toastDuration)

    const closeBtn = element.querySelector(".toast-close") as HTMLButtonElement
    closeBtn.addEventListener("click", () => {
      clearTimeout(timer)
      this.dismiss(id)
    })

    this.container.appendChild(element)
    this.toasts.push({ id, message, type, element, timer })

    if (this.toasts.length > this.maxVisible) {
      const oldest = this.toasts.shift()
      if (oldest) {
        clearTimeout(oldest.timer)
        this.animateOut(oldest.element, () => oldest.element.remove())
      }
    }

    // Trigger animation
    requestAnimationFrame(() => {
      element.classList.add("toast-visible")
    })
  }

  private dismiss(id: number): void {
    const index = this.toasts.findIndex((t) => t.id === id)
    if (index === -1) return
    const toast = this.toasts[index]
    this.toasts.splice(index, 1)
    clearTimeout(toast.timer)
    this.animateOut(toast.element, () => toast.element.remove())
  }

  private animateOut(element: HTMLDivElement, callback: () => void): void {
    element.classList.add("toast-hiding")
    element.addEventListener("transitionend", callback, { once: true })
    // Fallback if transitionend doesn't fire
    setTimeout(callback, 400)
  }

  private getIcon(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      info: "ℹ",
      success: "✓",
      warning: "⚠",
      error: "✕",
    }
    return icons[type]
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

const toast = new Toast()

export function showToast(message: string, type: ToastType = "info", duration?: number): void {
  toast.show(message, type, duration)
}

export { Toast }
export type { ToastType }
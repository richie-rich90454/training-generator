type ToastType = "info" | "success" | "warning" | "error"

interface ToastItem {
  id: number
  message: string
  type: ToastType
  element: HTMLDivElement
  timer: ReturnType<typeof setTimeout>
  animatingOut: boolean
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
      this.container.setAttribute("role", "status")
      this.container.setAttribute("aria-live", "polite")
      this.container.setAttribute("aria-atomic", "true")
      document.body.appendChild(this.container)
    }
  }

  private setAriaLive(type: ToastType): void {
    this.container.setAttribute("aria-live", type === "error" ? "assertive" : "polite")
  }

  show(message: string, type: ToastType = "info", duration?: number): number {
    this.setAriaLive(type)
    const id = this.nextId++
    const toastDuration = duration ?? this.defaultDuration

    const element = document.createElement("div")
    element.className = `toast toast-${type}`
    element.setAttribute("role", "alert")
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
    const item: ToastItem = { id, message, type, element, timer, animatingOut: false }
    this.toasts.push(item)
    this.updatePointerEvents()

    if (this.toasts.length > this.maxVisible) {
      const oldest = this.toasts.shift()
      if (oldest) {
        clearTimeout(oldest.timer)
        this.animateOut(oldest)
      }
    }

    requestAnimationFrame(() => {
      element.classList.add("toast-visible")
    })

    return id
  }

  dismiss(id: number): boolean {
    const index = this.toasts.findIndex((t) => t.id === id)
    if (index === -1) return false
    const toast = this.toasts[index]
    this.toasts.splice(index, 1)
    clearTimeout(toast.timer)
    this.animateOut(toast)
    this.updatePointerEvents()
    return true
  }

  private updatePointerEvents(): void {
    for (let i = 0; i < this.toasts.length; i++) {
      const toast = this.toasts[i]
      if (i === this.toasts.length - 1) {
        toast.element.style.pointerEvents = ""
      } else {
        toast.element.style.pointerEvents = "none"
      }
    }
  }

  private animateOut(toast: ToastItem): void {
    if (toast.animatingOut) return
    toast.animatingOut = true
    toast.element.style.pointerEvents = "none"
    let called = false
    let wrappedCallback = () => {
      if (called) return
      called = true
      toast.element.remove()
    }
    toast.element.classList.add("toast-hiding")
    toast.element.addEventListener("transitionend", wrappedCallback, { once: true })
    const duration = this.readTransitionDuration(toast.element)
    setTimeout(wrappedCallback, duration)
  }

  private readTransitionDuration(element: HTMLElement): number {
    const duration = getComputedStyle(element).transitionDuration || "0.4s"
    const value = parseFloat(duration)
    if (duration.includes("ms")) return value
    return value * 1000
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

export function showToast(message: string, type: ToastType = "info", duration?: number): number {
  return toast.show(message, type, duration)
}

export function dismissToast(id: number): boolean {
  return toast.dismiss(id)
}

export { Toast }
export type { ToastType }

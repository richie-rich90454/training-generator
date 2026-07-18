import{renderIcon}from"./icons.js"
import{t}from"./i18n.js"
import{logger}from"./logger.js"
let confirmModal: HTMLDivElement | null = null
let resolveRef: ((value: boolean) => void) | null = null
let dismissRef: (() => void) | null = null
function getConfirmModal(): HTMLDivElement {
  if (!confirmModal) {
    confirmModal = document.getElementById("confirm-modal") as HTMLDivElement
  }
  if (!confirmModal) {
    confirmModal = document.createElement("div")
    confirmModal.id = "confirm-modal"
    confirmModal.className = "modal"
    confirmModal.setAttribute("role", "dialog")
    confirmModal.setAttribute("aria-modal", "true")
    confirmModal.setAttribute("aria-labelledby", "confirm-title")
    confirmModal.innerHTML = `
      <div class="modal-content confirm-dialog">
        <div class="modal-header">
          <h2>${renderIcon("fa-question-circle", 20)} <span id="confirm-title">${t("confirm.title")}</span></h2>
        </div>
        <div class="modal-body">
          <p id="confirm-message"></p>
        </div>
        <div class="confirm-actions">
          <button id="confirm-cancel-btn" class="btn btn-secondary">${t("confirm.cancel")}</button>
          <button id="confirm-ok-btn" class="btn btn-primary">${t("confirm.ok")}</button>
        </div>
      </div>
    `
    document.body.appendChild(confirmModal)
  }
  return confirmModal
}
export function showConfirm(
  message: string,
  title?: string,
  onConfirm?: () => void,
  onCancel?: () => void
): Promise<boolean> {
  return new Promise((resolve) => {
    if (resolveRef) {
      // Supersede: dismiss the pending dialog so its event listeners are
      // removed from the reused modal element. Without this, the previous
      // dialog's OK/cancel/backdrop/keydown listeners linger and fire
      // alongside the new ones, incorrectly invoking the previous
      // onConfirm/onCancel callbacks when the new dialog is interacted with.
      const previousDismiss = dismissRef
      const previousResolve = resolveRef
      resolveRef = null
      dismissRef = null
      if (previousDismiss) {
        previousDismiss()
      } else {
        previousResolve(false)
      }
    }
    resolveRef = resolve
    const modal = getConfirmModal()
    const messageEl = modal.querySelector("#confirm-message") as HTMLElement
    const titleEl = modal.querySelector("#confirm-title") as HTMLElement
    const cancelBtn = modal.querySelector("#confirm-cancel-btn") as HTMLButtonElement
    const okBtn = modal.querySelector("#confirm-ok-btn") as HTMLButtonElement
    messageEl.textContent = message
    titleEl.textContent = title ?? t("confirm.title")
    const cleanup = () => {
      modal.classList.remove("active")
      modal.style.display = "none"
      cancelBtn.removeEventListener("click", onCancelClick)
      okBtn.removeEventListener("click", onConfirmClick)
      modal.removeEventListener("click", onBackdropClick)
      document.removeEventListener("keydown", onKeydown)
      resolveRef = null
      dismissRef = null
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
    const onConfirmClick = () => {
      cleanup()
      try { onConfirm?.() } catch (err) { logger.warn("onConfirm callback threw", err) }
      resolve(true)
    }
    const onCancelClick = () => {
      cleanup()
      try { onCancel?.() } catch (err) { logger.warn("onCancel callback threw", err) }
      resolve(false)
    }
    dismissRef = onCancelClick
    const onBackdropClick = (e: Event) => {
      if (e.target === modal) {
        onCancelClick()
      }
    }
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCancelClick()
      }
      else if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === cancelBtn) {
          e.preventDefault()
          okBtn.focus()
        }
        else if (!e.shiftKey && document.activeElement === okBtn) {
          e.preventDefault()
          cancelBtn.focus()
        }
      }
    }
    cancelBtn.addEventListener("click", onCancelClick)
    okBtn.addEventListener("click", onConfirmClick)
    modal.addEventListener("click", onBackdropClick)
    document.addEventListener("keydown", onKeydown)
    const previouslyFocused = document.activeElement as HTMLElement | null
    modal.style.display = "flex"
    modal.classList.add("active")
    cancelBtn.focus()
  })
}
export function closeConfirm(): void {
  if (dismissRef) {
    dismissRef()
  }
}

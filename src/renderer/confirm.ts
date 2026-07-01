let confirmModal: HTMLDivElement | null = null
let resolveRef: ((value: boolean) => void) | null = null

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
          <h2><i class="fas fa-question-circle"></i> <span id="confirm-title">Confirm</span></h2>
        </div>
        <div class="modal-body">
          <p id="confirm-message"></p>
        </div>
        <div class="confirm-actions">
          <button id="confirm-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button id="confirm-ok-btn" class="btn btn-primary">Confirm</button>
        </div>
      </div>
    `
    document.body.appendChild(confirmModal)
  }
  return confirmModal
}

export function showConfirm(
  message: string,
  onConfirm?: () => void,
  onCancel?: () => void
): Promise<boolean> {
  return new Promise((resolve) => {
    if (resolveRef) {
      resolveRef(false)
      resolveRef = null
    }
    resolveRef = resolve
    const modal = getConfirmModal()
    const messageEl = modal.querySelector("#confirm-message") as HTMLElement
    const cancelBtn = modal.querySelector("#confirm-cancel-btn") as HTMLButtonElement
    const okBtn = modal.querySelector("#confirm-ok-btn") as HTMLButtonElement

    messageEl.textContent = message

    const cleanup = () => {
      modal.classList.remove("active")
      modal.style.display = "none"
      cancelBtn.removeEventListener("click", onCancelClick)
      okBtn.removeEventListener("click", onConfirmClick)
      modal.removeEventListener("click", onBackdropClick)
      document.removeEventListener("keydown", onKeydown)
      resolveRef = null
    }

    const onConfirmClick = () => {
      cleanup()
      onConfirm?.()
      resolve(true)
    }

    const onCancelClick = () => {
      cleanup()
      onCancel?.()
      resolve(false)
    }

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
    }

    cancelBtn.addEventListener("click", onCancelClick)
    okBtn.addEventListener("click", onConfirmClick)
    modal.addEventListener("click", onBackdropClick)
    document.addEventListener("keydown", onKeydown)

    modal.style.display = "flex"
    modal.classList.add("active")
    okBtn.focus()
  })
}
interface VirtualListOptions<T> {
  container: HTMLElement
  items: T[]
  itemHeight: number
  renderItem: (item: T, index: number) => HTMLElement | string
}

export function createVirtualList<T>(options: VirtualListOptions<T>): void {
  const { container, items, itemHeight, renderItem } = options

  container.innerHTML = ""
  container.style.overflowY = "auto"
  container.style.position = "relative"

  const spacer = document.createElement("div")
  spacer.style.height = `${items.length * itemHeight}px`
  spacer.style.position = "relative"
  container.appendChild(spacer)

  const viewport = document.createElement("div")
  viewport.style.position = "absolute"
  viewport.style.top = "0"
  viewport.style.left = "0"
  viewport.style.right = "0"
  container.appendChild(viewport)

  let renderedRange: { start: number; end: number } = { start: -1, end: -1 }

  function render(): void {
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight))
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 1
    const endIndex = Math.min(items.length, startIndex + visibleCount)

    if (startIndex === renderedRange.start && endIndex === renderedRange.end) return
    renderedRange = { start: startIndex, end: endIndex }

    viewport.innerHTML = ""

    for (let i = startIndex; i < endIndex; i++) {
      const itemEl = document.createElement("div")
      itemEl.style.position = "absolute"
      itemEl.style.top = `${i * itemHeight}px`
      itemEl.style.left = "0"
      itemEl.style.right = "0"
      itemEl.style.height = `${itemHeight}px`
      itemEl.style.overflow = "hidden"

      const rendered = renderItem(items[i], i)
      if (typeof rendered === "string") {
        itemEl.innerHTML = rendered
      } else {
        itemEl.appendChild(rendered)
      }
      viewport.appendChild(itemEl)
    }
  }

  container.addEventListener("scroll", render, { passive: true })
  render()
}
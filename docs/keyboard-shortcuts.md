# Keyboard Shortcuts

Training Generator supports keyboard navigation and shortcuts for the most common actions. On macOS, use **Cmd** where Windows/Linux use **Ctrl**.

> **Note:** Global shortcuts are ignored while an `<input>`, `<textarea>`, or `<select>` element is focused so you can type normally.

---

## Global shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `Ctrl/Cmd + O` | Anywhere except text inputs | Open the file dialog to select documents. |
| `Ctrl/Cmd + Enter` | Anywhere except text inputs | Start processing the selected files. If processing is already running, stop it. |
| `Ctrl/Cmd + E` | Anywhere except text inputs | Export the current output using the selected export format. |
| `Ctrl/Cmd + Shift + C` | Anywhere except text inputs | Copy the current output to the clipboard. |
| `Ctrl/Cmd + Shift + D` | Anywhere except text inputs | Toggle the developer tools panel. |
| `Ctrl/Cmd + Shift + P` | Anywhere except text inputs | Open the command palette. |
| `Ctrl/Cmd + K` | Anywhere except text inputs | Show the keyboard shortcuts help overlay. |
| `Escape` | Anywhere | Stop processing if it is running; otherwise close the topmost open modal. |

---

## Accessibility and focus shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `Tab` | Anywhere | Move focus to the next focusable element. |
| `Shift + Tab` | Anywhere | Move focus to the previous focusable element. |
| `Space` or `Enter` | Drop zone or button focused | Activate the control (open the file picker or press the button). |
| `Arrow Left` / `Arrow Right` | Splitter bar focused | Decrease or increase the width of the left panel by 5%. |

Inside a modal, `Tab` and `Shift + Tab` cycle focus through the focusable elements so it cannot leave the modal accidentally.

---

## Shortcut details

### File selection

- `Ctrl/Cmd + O` triggers the same action as clicking the **Browse** button or the drop zone.
- You can also drop files directly onto the drop zone with the mouse.

### Start / stop processing

- `Ctrl/Cmd + Enter` is the fastest way to begin conversion after selecting files.
- While processing, the same shortcut aborts the current run and restores the UI.
- Pressing `Escape` also stops processing.

### Export and copy

- `Ctrl/Cmd + E` opens the save dialog for the generated training data.
- `Ctrl/Cmd + Shift + C` copies the output in the currently selected format without showing a dialog.
- Both shortcuts are disabled when there is no output data.

### Developer tools

- `Ctrl/Cmd + Shift + D` opens a panel with additional diagnostic information. This is mainly useful for debugging.
- The devtools panel is the app's idea of a secret handshake — most users never need it, but if you are reading this footnote, you now know it exists. ;)

### Closing modals

- `Escape` closes settings, help, quality report, statistics, and other modal dialogs.
- If the prompt template editor is open, `Escape` closes it unless the settings modal is also open.

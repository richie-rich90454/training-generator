# Examples

This directory contains **small, representative example files** that demonstrate how the document-to-training-data pipeline works. The goal is to let visitors quickly understand the expected inputs and outputs **without building or running the application**.

---

## Directory Contents

```
/examples
├─ sample-article.pdf
├─ sample-article.jsonl
├─ sample-report.docx
├─ sample-report.jsonl
├─ sample-notes.md
├─ sample-notes.jsonl
└─ README.md
```


## Example Input and Output Files

| Input File              | Output File              | Description |
|-------------------------|--------------------------|-------------|
| `sample-article.pdf`    | `sample-article.jsonl`   | Example PDF document converted into instruction–answer training data |
| `sample-report.docx`    | `sample-report.jsonl`    | Example Word document parsed and exported as JSONL training examples |
| `sample-notes.md`       | `sample-notes.jsonl`     | Example Markdown notes transformed into instruction-tuning data |


---

## JSONL Format

Each line in a `.jsonl` file represents a single training example with the following schema:

```json
{
  "instruction": "Answer the question based on the text",
  "input": "<question extracted from the document>",
  "output": "<answer derived from the document>"
}
```

* `instruction` contains what has to be done
* `input` contains the question generated from the document text
* `output` contains the corresponding answer

This format is compatible with instruction‑tuning workflows (e.g., Ollama, LLaMA, Mistral).

---

## How the Examples Were Produced

Each example follows the same pipeline:

1. **Document Upload**
   A user uploads a PDF, DOCX, or Markdown file via the UI.

2. **Text Extraction**
   The file is parsed using the appropriate parser to extract text.

3. **Prompt Construction**
   The extracted text is injected into a instruction prompt (for example):

   ```js
   You are an AI training data generator. Your task is to extract comprehensive question‑answer pairs from the provided text that cover ALL important information for instruction tuning.
   TEXT TO ANALYZE:
   ${text}
   ```

4. **Training Example Generation**
   The model generates question–answer pairs, which are normalized into JSONL format.

5. **Export**
   The final output is exported as `<original-file-name>.jsonl`.


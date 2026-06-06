import path from "path"
import FileParser from "../src/core/fileParser.js"

describe("PDF text extraction", () => {
  test("extracts expected text from sample PDF", async () => {
    const parser: FileParser = new FileParser();

    const pdfPath: string = path.join(__dirname, "fixtures", "sample.pdf");

    const text: string = await parser.extractTextFromFile(pdfPath);

    expect(text).toContain("Hello World");
    expect(text).toContain("sample PDF for testing");
    expect(text).toContain("PDF text extraction should work");
  });
});

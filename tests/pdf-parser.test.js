const path = require("path");
const FileParser = require("../src/core/fileParser");

describe("PDF text extraction", () => {
  test("extracts expected text from sample PDF", async () => {
    const parser = new FileParser();

    const pdfPath = path.join(__dirname, "fixtures", "sample.pdf");

    const text = await parser.extractTextFromFile(pdfPath);

    expect(text).toContain("Hello World");
    expect(text).toContain("sample PDF for testing");
    expect(text).toContain("PDF text extraction should work");
  });
});

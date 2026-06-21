export function getHelpContent():string{
    return`
            <h3><i class="fas fa-question-circle"></i>Training Generator Help</h3>
            <div class="help-section">
                <h4>Getting Started</h4>
                <p>1.<strong>Upload Files</strong>:Drag & drop or click to browse for documents(PDF,DOCX,DOC,RTF,TXT,MD,HTML)</p>
                <p>2.<strong>Configure Settings</strong>:Select model,processing type,output format,and chunk size</p>
                <p>3.<strong>Process Files</strong>:Click "Process Files" to convert documents to training data</p>
                <p>4.<strong>Export Results</strong>:Save or copy the generated training data</p>
            </div>
            <div class="help-section">
                <h4>Requirements</h4>
                <p>•<strong>Ollama</strong>:Must be installed and running for AI processing</p>
                <p>•<strong>Models</strong>:Pull models using<code>ollama pull <model-name></code></p>
                <p>•<strong>File Size</strong>:Maximum 100MB per file</p>
            </div>
            <div class="help-section">
                <h4>Troubleshooting</h4>
                <p>•<strong>Ollama Not Detected</strong>:Run<code>ollama serve</code>in terminal</p>
                <p>•<strong>PDF Extraction Issues</strong>:Try converting problematic PDFs to text first</p>
                <p>•<strong>Large Files</strong>:Processing may take longer for files>20MB</p>
            </div>
            <div class="help-section">
                <h4>Need More Help?</h4>
                <p>Visit the GitHub repository for documentation and issue reporting.</p>
            </div>
        `
}
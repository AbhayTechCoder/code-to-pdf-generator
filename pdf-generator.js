const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

// ✅ Chrome Path
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// ✅ Single PDF output
const OUTPUT_PDF = "COMPLETE_PROJECT_CODE.pdf";

// ✅ Configuration
const CONFIG = {
    timeout: 300000, // 5 minutes timeout
    maxConcurrent: 1,
    retryCount: 3,
    chunkSize: 10
};

// ✅ Sections in correct order
const SECTIONS = [
    {
        name: "frontend",
        title: "📱 FRONTEND / CLIENT SIDE CODE",
        icon: "🎨",
        color: "#4CAF50",
        folders: ["client", "frontend", "public", "src", "views", "static", "assets", "ui", "components"],
        extensions: [".js", ".jsx", ".html", ".css", ".vue", ".ts", ".tsx", ".scss", ".sass"]
    },
    {
        name: "middleware",
        title: "⚙️ MIDDLEWARE & CONTROLLER CODE",
        icon: "🔧",
        color: "#FF9800",
        folders: ["middleware", "controllers", "routes", "api", "handlers", "controller"],
        extensions: [".js", ".ts"]
    },
    {
        name: "backend",
        title: "🗄️ BACKEND / SERVER CODE",
        icon: "🚀",
        color: "#2196F3",
        folders: ["backend", "server", "models", "config", "database", "db", "services", "utils", "helpers", "lib", "core"],
        extensions: [".js", ".ts", ".py", ".java"]
    }
];

let sectionsData = {
    frontend: [],
    middleware: [],
    backend: []
};

let processedCount = 0;
let totalFilesToProcess = 0;

// HTML escaping (no boxes)
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/\\/g, "&#92;")
        .replace(/\t/g, "    ");
}

// Colorizer
function colorizeCode(code) {
    let result = code;
    
    // Comments
    result = result.replace(/(\/\/[^\n]*)/g, '<span class="comment">$1</span>');
    result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
    
    // Strings
    result = result.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="string">"$1"</span>');
    result = result.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="string">\'$1\'</span>');
    result = result.replace(/`([^`\\]*(\\.[^`\\]*)*)`/g, '<span class="string">`$1`</span>');
    
    // Keywords
    const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|class|extends|super|import|export|default|from|async|await|typeof|instanceof|in|of|delete|void|yield|static|get|set|require|module|exports)\b/g;
    result = result.replace(keywords, '<span class="keyword">$1</span>');
    
    // Numbers
    result = result.replace(/\b(\d+\.?\d*|0x[\da-fA-F]+)\b/g, '<span class="number">$1</span>');
    
    // Functions
    result = result.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '<span class="function">$1</span>(');
    
    return result;
}

// Add line numbers
function addLineNumbers(code) {
    const lines = code.split('\n');
    let lineNumbersHtml = '<div class="line-numbers">';
    let codeHtml = '<pre><code>';
    
    for (let i = 0; i < lines.length; i++) {
        lineNumbersHtml += `<span>${i + 1}</span>`;
        codeHtml += `${lines[i]}${i < lines.length - 1 ? '\n' : ''}`;
    }
    
    lineNumbersHtml += '</div>';
    codeHtml += '</code></pre>';
    
    return `
        <div class="code-wrapper" style="overflow: auto; min-height: 100px;">
            ${lineNumbersHtml}
            <div class="code-content" style="margin-left: 55px; overflow-x: auto;">
                ${codeHtml}
            </div>
            <div style="clear: both;"></div>
        </div>
    `;
}

// Categorize file
function categorizeFile(filePath) {
    const lowerPath = filePath.toLowerCase();
    
    for (const folder of SECTIONS[0].folders) {
        if (lowerPath.includes(folder.toLowerCase())) {
            return 'frontend';
        }
    }
    
    for (const folder of SECTIONS[1].folders) {
        if (lowerPath.includes(folder.toLowerCase())) {
            return 'middleware';
        }
    }
    
    for (const folder of SECTIONS[2].folders) {
        if (lowerPath.includes(folder.toLowerCase())) {
            return 'backend';
        }
    }
    
    return null;
}

// Scan directory
function scanDirectory(dir) {
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            if (file === "node_modules" || file === ".git" || file === "dist" || 
                file === "build" || file === ".next" || file === "coverage") {
                continue;
            }
            
            const fullPath = path.join(dir, file);
            
            try {
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else {
                    let shouldInclude = false;
                    let fileExt = path.extname(file).toLowerCase();
                    
                    for (const section of SECTIONS) {
                        if (section.extensions.includes(fileExt)) {
                            shouldInclude = true;
                            break;
                        }
                    }
                    
                    if (shouldInclude) {
                        const category = categorizeFile(fullPath);
                        if (category && sectionsData[category]) {
                            sectionsData[category].push(fullPath);
                        }
                    }
                }
            } catch (err) {
                // Skip unreadable files
            }
        }
    } catch (err) {
        // Skip unreadable directories
    }
}

// Process file
function processFile(filePath) {
    try {
        let code = fs.readFileSync(filePath, "utf-8");
        if (!code || code.trim().length === 0) {
            return null;
        }
        
        if (code.length > 10 * 1024 * 1024) {
            console.log(`   ⚠️ Skipping large file: ${path.basename(filePath)} (${(code.length/1024/1024).toFixed(2)} MB)`);
            return null;
        }
        
        let escapedCode = escapeHtml(code);
        let coloredCode = colorizeCode(escapedCode);
        let finalCode = addLineNumbers(coloredCode);
        
        return {
            success: true,
            content: finalCode,
            size: code.length
        };
    } catch (err) {
        console.log(`   ❌ Error reading: ${path.basename(filePath)} - ${err.message}`);
        return null;
    }
}

// Generate complete HTML
function generateCompleteHTML() {
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Complete Project Source Code</title>
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    
    body {
        background: #ffffff;
        font-family: 'Consolas', 'Courier New', monospace;
        padding: 20px;
    }
    
    .cover-page {
        page-break-after: always;
        text-align: center;
        padding: 100px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 10px;
        margin-bottom: 30px;
    }
    
    .cover-page h1 {
        font-size: 48px;
        margin-bottom: 20px;
    }
    
    .cover-page .stats {
        margin-top: 60px;
        font-size: 18px;
    }
    
    .toc {
        page-break-after: always;
        padding: 40px;
        background: #f8f9fa;
        border-radius: 10px;
        margin-bottom: 30px;
    }
    
    .toc h2 {
        color: #333;
        margin-bottom: 30px;
        font-size: 32px;
        border-bottom: 3px solid #667eea;
        display: inline-block;
        padding-bottom: 10px;
    }
    
    .toc ul {
        list-style: none;
        margin-top: 30px;
    }
    
    .toc li {
        margin: 15px 0;
        font-size: 16px;
    }
    
    .section-header {
        page-break-before: always;
        page-break-after: avoid;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px;
        text-align: center;
        border-radius: 10px;
        margin: 30px 0;
    }
    
    .section-header h1 {
        font-size: 36px;
        margin-bottom: 10px;
    }
    
    .file-card {
        page-break-before: always;
        background: #ffffff;
        margin-bottom: 20px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .file-card:first-child {
        page-break-before: avoid;
    }
    
    .file-header {
        background: #f8f9fa;
        padding: 12px 20px;
        border-bottom: 2px solid #667eea;
    }
    
    .file-header h2 {
        color: #333;
        font-size: 14px;
        font-weight: 600;
        word-break: break-all;
    }
    
    .file-header h2::before {
        content: "📄 ";
    }
    
    .code-wrapper {
        padding: 20px;
        background: #ffffff;
        min-height: 200px;
    }
    
    .line-numbers {
        float: left;
        text-align: right;
        color: #999;
        font-size: 12px;
        line-height: 1.5;
        padding-right: 15px;
        user-select: none;
        border-right: 1px solid #e0e0e0;
        margin-right: 15px;
        font-family: 'Consolas', monospace;
    }
    
    .line-numbers span {
        display: block;
    }
    
    .code-content {
        overflow-x: auto;
    }
    
    pre {
        background: #ffffff;
        color: #333;
        font-family: 'Consolas', monospace;
        font-size: 12px;
        line-height: 1.5;
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
    }
    
    code {
        font-family: 'Consolas', monospace;
    }
    
    .keyword { color: #0000ff; font-weight: bold; }
    .string { color: #a31515; }
    .comment { color: #008000; font-style: italic; }
    .number { color: #098658; }
    .function { color: #795e26; }
    
    .footer {
        text-align: center;
        padding: 30px;
        background: #f8f9fa;
        color: #666;
        font-size: 11px;
        page-break-before: always;
        margin-top: 30px;
        border-radius: 8px;
    }
    
    @media print {
        body {
            background: white;
        }
        .file-card {
            page-break-inside: avoid;
        }
        .cover-page, .section-header {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
    }
</style>
</head>
<body>
`;
    
    const totalFiles = sectionsData.frontend.length + sectionsData.middleware.length + sectionsData.backend.length;
    html += `
<div class="cover-page">
    <h1>📚 COMPLETE PROJECT SOURCE CODE</h1>
    <h2>Technical Documentation</h2>
    <div class="stats">
        <p>📊 Total Files: ${totalFiles}</p>
        <p>🎨 Frontend: ${sectionsData.frontend.length} files</p>
        <p>⚙️ Middleware: ${sectionsData.middleware.length} files</p>
        <p>🚀 Backend: ${sectionsData.backend.length} files</p>
        <p>📅 Generated: ${new Date().toLocaleString()}</p>
    </div>
</div>
<div class="toc">
    <h2>📑 Table of Contents</h2>
    <ul>
        <li>📱 <strong>SECTION 1: FRONTEND</strong> - ${sectionsData.frontend.length} files</li>
        <li>⚙️ <strong>SECTION 2: MIDDLEWARE</strong> - ${sectionsData.middleware.length} files</li>
        <li>🚀 <strong>SECTION 3: BACKEND</strong> - ${sectionsData.backend.length} files</li>
    </ul>
</div>
`;
    
    return { html, totalFiles };
}

// ==================== MAIN EXECUTION ====================
console.log("🚀 COMPLETE PROJECT CODE TO SINGLE PDF\n");
console.log("=" .repeat(60));
console.log("📂 Scanning project directory...\n");

scanDirectory("./");

console.log("\n📊 SCAN RESULTS:");
console.log(`   🎨 Frontend files: ${sectionsData.frontend.length}`);
console.log(`   ⚙️ Middleware files: ${sectionsData.middleware.length}`);
console.log(`   🗄️ Backend files: ${sectionsData.backend.length}`);

const totalFiles = sectionsData.frontend.length + sectionsData.middleware.length + sectionsData.backend.length;

if (totalFiles === 0) {
    console.log("\n❌ No code files found!");
    process.exit(1);
}

console.log(`\n📊 Total files found: ${totalFiles}`);
console.log("\n🎨 Processing files and generating HTML...\n");

const { html: initialHTML } = generateCompleteHTML();
let finalHTML = initialHTML;
let processedFileCount = 0;
let totalCodeSize = 0;

for (const section of SECTIONS) {
    const files = sectionsData[section.name];
    
    if (files.length === 0) continue;
    
    console.log(`\n📁 Processing ${section.name.toUpperCase()} section (${files.length} files)...`);
    
    finalHTML += `
<div class="section-header">
    <div class="icon">${section.icon}</div>
    <h1>${section.title}</h1>
    <div class="file-count">📁 Total Files: ${files.length}</div>
</div>
`;
    
    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const fileName = path.basename(filePath);
        
        process.stdout.write(`   Processing [${i+1}/${files.length}]: ${fileName} ... `);
        
        const result = processFile(filePath);
        
        if (result && result.success) {
            finalHTML += `
<div class="file-card">
    <div class="file-header">
        <h2>${escapeHtml(filePath)}</h2>
    </div>
    ${result.content}
</div>
`;
            processedFileCount++;
            totalCodeSize += result.size;
            console.log(`✅ (${(result.size/1024).toFixed(1)} KB)`);
        } else {
            console.log(`⚠️ Skipped`);
        }
    }
}

finalHTML += `
<div class="footer">
    <p><strong>📊 Total Files Processed: ${processedFileCount}/${totalFiles}</strong></p>
    <p>📦 Total Code Size: ${(totalCodeSize/1024/1024).toFixed(2)} MB</p>
    <p>🔧 Generated on: ${new Date().toLocaleString()}</p>
    <p>📝 Complete Project Source Code Documentation</p>
</div>
</body>
</html>`;

console.log("\n" + "=" .repeat(60));
console.log(`\n✅ HTML generated! Processed ${processedFileCount} files`);
console.log("\n🚀 Generating PDF...");

(async () => {
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        page.setDefaultTimeout(CONFIG.timeout);
        
        await page.setViewport({ width: 1200, height: 800 });
        await page.setContent(finalHTML, { waitUntil: 'networkidle0', timeout: CONFIG.timeout });
        await page.pdf({ path: OUTPUT_PDF, format: "A4", printBackground: true, margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" } });
        
        await browser.close();
        
        console.log("\n✅ PDF GENERATION COMPLETE!");
        console.log(`📁 Output: ${OUTPUT_PDF}`);
        console.log(`📍 Location: ${path.resolve(OUTPUT_PDF)}`);
        console.log(`📊 Total Files: ${processedFileCount}/${totalFiles}`);
        
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        if (browser) await browser.close();
    }
})();
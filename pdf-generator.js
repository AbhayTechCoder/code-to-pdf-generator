const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

// ✅ Cross-platform Chrome path detection
const getChromePath = () => {
    const platforms = {
        win32: [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
        ],
        darwin: [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium"
        ],
        linux: [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium"
        ]
    };
    
    const osPaths = platforms[process.platform] || [];
    for (const chromePath of osPaths) {
        if (fs.existsSync(chromePath)) return chromePath;
    }
    return null;
};

// ✅ Configuration
const CONFIG = {
    timeout: 300000,
    maxFileSizeMB: 5, // Increased to 5MB
    excludedDirs: new Set([
        'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
        '.cache', '.vscode', '.idea', '__pycache__', 'venv', 'env',
        'target', 'out', 'tmp', 'temp', 'logs', 'uploads', 'backup'
    ]),
    excludedExtensions: new Set([
        '.lock', '.log', '.tmp', '.swp', '.map', 
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2',
        '.ttf', '.eot', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll'
    ]),
    includedExtensions: new Set([
        // Web
        '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.vue', '.svelte', '.astro',
        // Backend
        '.py', '.java', '.go', '.rb', '.php', '.cs', '.cpp', '.c', '.h',
        '.json', '.xml', '.yaml', '.yml', '.toml',
        // Config
        '.env', '.example', '.md', '.txt', '.sh', '.bat', '.ps1',
        '.sql', '.graphql', '.proto'
    ])
};

// ✅ Sections with better categorization
const SECTIONS = [
    {
        name: "frontend",
        title: "📱 FRONTEND / CLIENT SIDE CODE",
        icon: "🎨",
        keywords: ["client", "frontend", "public", "src", "views", "static", "ui", "components", "pages", "layouts", "styles", "assets"],
        extensions: [".js", ".jsx", ".ts", ".tsx", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte"]
    },
    {
        name: "backend",
        title: "🗄️ BACKEND / SERVER CODE",
        icon: "🚀",
        keywords: ["backend", "server", "api", "models", "controllers", "routes", "services", "utils", "helpers", "lib", "core", "config", "database", "db", "migrations", "seeders"],
        extensions: [".js", ".ts", ".py", ".java", ".go", ".rb", ".php", ".cs", ".sql"]
    },
    {
        name: "config",
        title: "⚙️ CONFIGURATION & SETUP FILES",
        icon: "🔧",
        keywords: ["config", "setup", "install", "docker", "deploy", "scripts", "bin", "tools"],
        extensions: [".json", ".yaml", ".yml", ".toml", ".env", ".sh", ".bat", ".ps1", ".md"]
    },
    {
        name: "root",
        title: "📄 ROOT DIRECTORY FILES",
        icon: "📁",
        keywords: [], // This will catch root level files
        extensions: [".js", ".json", ".md", ".txt", ".env", ".yml", ".yaml"]
    }
];

let sectionsData = { frontend: [], backend: [], config: [], root: [] };
let processedStats = { total: 0, succeeded: 0, failed: 0, skipped: 0, totalSize: 0, totalFilesFound: 0 };

function escapeHtml(text) {
    if (!text) return '';
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

function highlightCode(code) {
    let result = escapeHtml(code);
    
    const highlights = [
        { pattern: /(\/\/[^\n]*)/g, className: 'comment' },
        { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'comment' },
        { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'string' },
        { pattern: /('(?:[^'\\]|\\.)*')/g, className: 'string' },
        { pattern: /(`(?:[^`\\]|\\.)*`)/g, className: 'string' },
        { pattern: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|class|extends|super|import|export|default|from|async|await|typeof|instanceof|in|of|delete|void|yield|static|get|set|require|module|exports|def|class|import|as|from|public|private|static|void|int|float|string|boolean)\b/g, className: 'keyword' },
        { pattern: /\b(\d+\.?\d*|0x[\da-fA-F]+)\b/g, className: 'number' },
        { pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, className: 'function', captureGroup: 1 }
    ];
    
    for (const highlight of highlights) {
        if (highlight.captureGroup) {
            result = result.replace(highlight.pattern, (match, capture) => 
                `<span class="${highlight.className}">${capture}</span>(`);
        } else {
            result = result.replace(highlight.pattern, `<span class="${highlight.className}">$1</span>`);
        }
    }
    
    return result;
}

function addLineNumbers(code) {
    const lines = code.split('\n');
    const lineNumbers = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
    const codeContent = lines.join('\n');
    
    return `
        <div class="code-wrapper">
            <div class="line-numbers">${lineNumbers}</div>
            <div class="code-content"><pre><code>${codeContent}</code></pre></div>
            <div style="clear: both;"></div>
        </div>
    `;
}

// ✅ Improved scanning that captures ALL files
function scanDirectory(dir, depth = 0, maxDepth = 15) {
    if (depth > maxDepth) return;
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            if (CONFIG.excludedDirs.has(item)) continue;
            
            const fullPath = path.join(dir, item);
            
            try {
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath, depth + 1, maxDepth);
                } else {
                    const ext = path.extname(item).toLowerCase();
                    
                    // Check if file should be included
                    if (CONFIG.includedExtensions.has(ext) && 
                        !CONFIG.excludedExtensions.has(ext) &&
                        stat.size <= CONFIG.maxFileSizeMB * 1024 * 1024) {
                        
                        processedStats.totalFilesFound++;
                        const category = categorizeFile(fullPath);
                        sectionsData[category].push(fullPath);
                    } else if (stat.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
                        console.log(`   ⚠️ Skipping large file: ${item} (${(stat.size/1024/1024).toFixed(2)} MB)`);
                        processedStats.skipped++;
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

// ✅ Improved categorization
function categorizeFile(filePath) {
    const lowerPath = filePath.toLowerCase();
    const pathParts = lowerPath.split(path.sep);
    const isRootFile = pathParts.length === 1; // File in root directory
    
    // Check for frontend
    for (const keyword of SECTIONS[0].keywords) {
        if (lowerPath.includes(keyword)) {
            return 'frontend';
        }
    }
    
    // Check for backend
    for (const keyword of SECTIONS[1].keywords) {
        if (lowerPath.includes(keyword)) {
            return 'backend';
        }
    }
    
    // Check for config
    for (const keyword of SECTIONS[2].keywords) {
        if (lowerPath.includes(keyword)) {
            return 'config';
        }
    }
    
    // Root level files
    if (isRootFile || pathParts.length === 2) {
        return 'root';
    }
    
    // Default to backend for server-side code
    const ext = path.extname(filePath).toLowerCase();
    if (['.js', '.ts', '.py', '.java', '.go', '.rb', '.php'].includes(ext)) {
        return 'backend';
    }
    
    return 'root';
}

function processFile(filePath) {
    try {
        let code = fs.readFileSync(filePath, "utf-8");
        
        if (!code || code.trim().length === 0) {
            return null;
        }
        
        // Truncate if too large
        const maxChars = 1000000; // 1MB per file max
        let wasTruncated = false;
        if (code.length > maxChars) {
            code = code.substring(0, maxChars);
            wasTruncated = true;
        }
        
        const highlightedCode = highlightCode(code);
        let finalCode = addLineNumbers(highlightedCode);
        
        if (wasTruncated) {
            finalCode += '\n<!-- FILE TRUNCATED DUE TO SIZE -->';
        }
        
        return {
            success: true,
            content: finalCode,
            size: code.length
        };
    } catch (err) {
        return null;
    }
}

// ✅ Generate complete HTML
function generateCompleteHTML() {
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Complete Project Source Code</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f5; font-family: 'Consolas', 'Courier New', monospace; padding: 20px; }
    
    .cover-page {
        page-break-after: always;
        text-align: center;
        padding: 100px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 10px;
        margin-bottom: 30px;
    }
    .cover-page h1 { font-size: 48px; margin-bottom: 20px; }
    .cover-page .stats { margin-top: 60px; font-size: 18px; }
    .cover-page .stats p { margin: 10px 0; }
    
    .toc {
        page-break-after: always;
        padding: 40px;
        background: white;
        border-radius: 10px;
        margin-bottom: 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .toc h2 { color: #333; margin-bottom: 30px; font-size: 32px; border-bottom: 3px solid #667eea; display: inline-block; padding-bottom: 10px; }
    .toc ul { list-style: none; margin-top: 30px; }
    .toc li { margin: 15px 0; font-size: 16px; padding: 5px 0; border-bottom: 1px solid #eee; }
    .toc a { text-decoration: none; color: #667eea; }
    .toc a:hover { text-decoration: underline; }
    
    .section-header {
        page-break-before: always;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px;
        text-align: center;
        border-radius: 10px;
        margin: 30px 0;
    }
    .section-header h1 { font-size: 36px; margin-bottom: 10px; }
    .section-header .file-count { font-size: 18px; margin-top: 10px; opacity: 0.9; }
    
    .file-card {
        page-break-inside: avoid;
        background: white;
        margin-bottom: 30px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .file-header {
        background: #f8f9fa;
        padding: 15px 20px;
        border-bottom: 3px solid #667eea;
    }
    .file-header h2 {
        color: #333;
        font-size: 14px;
        font-weight: 600;
        word-break: break-all;
    }
    .file-header h2::before { content: "📄 "; }
    
    .code-wrapper {
        padding: 20px;
        background: white;
        min-height: 200px;
        overflow: auto;
        position: relative;
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
    .line-numbers span { display: block; }
    .code-content { overflow-x: auto; }
    pre {
        background: white;
        color: #333;
        font-family: 'Consolas', monospace;
        font-size: 12px;
        line-height: 1.5;
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
    }
    code { font-family: 'Consolas', monospace; }
    
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
        font-size: 12px;
        page-break-before: always;
        margin-top: 30px;
        border-radius: 8px;
    }
    
    @media print {
        body { background: white; padding: 0; }
        .file-card { page-break-inside: avoid; }
        .cover-page, .section-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>
</head>
<body>
`;
    
    const totalFiles = sectionsData.frontend.length + sectionsData.backend.length + sectionsData.config.length + sectionsData.root.length;
    
    html += `
<div class="cover-page">
    <h1>📚 COMPLETE PROJECT SOURCE CODE</h1>
    <h2>Complete Documentation</h2>
    <div class="stats">
        <p>📊 Total Files: ${totalFiles}</p>
        <p>🎨 Frontend: ${sectionsData.frontend.length} files</p>
        <p>🚀 Backend: ${sectionsData.backend.length} files</p>
        <p>⚙️ Config: ${sectionsData.config.length} files</p>
        <p>📁 Root: ${sectionsData.root.length} files</p>
        <p>📅 Generated: ${new Date().toLocaleString()}</p>
    </div>
</div>

<div class="toc">
    <h2>📑 Table of Contents</h2>
    <ul>
        <li>🎨 <strong>SECTION 1: FRONTEND</strong> - ${sectionsData.frontend.length} files</li>
        <li>🚀 <strong>SECTION 2: BACKEND</strong> - ${sectionsData.backend.length} files</li>
        <li>⚙️ <strong>SECTION 3: CONFIGURATION</strong> - ${sectionsData.config.length} files</li>
        <li>📁 <strong>SECTION 4: ROOT FILES</strong> - ${sectionsData.root.length} files</li>
    </ul>
</div>
`;
    
    return { html, totalFiles };
}

// Main execution
async function main() {
    console.log("=" .repeat(70));
    console.log("🚀 COMPLETE PROJECT CODE TO PDF - ENHANCED VERSION");
    console.log("=" .repeat(70));
    
    // Check Chrome
    const chromePath = getChromePath();
    if (!chromePath) {
        console.error("\n❌ Chrome not found! Please install Google Chrome.");
        console.log("💡 Download from: https://www.google.com/chrome/");
        process.exit(1);
    }
    console.log(`\n✅ Chrome found: ${chromePath}`);
    
    // Scan directory
    console.log("\n📂 Scanning project directory...");
    console.log(`📍 Path: ${process.cwd()}\n`);
    scanDirectory("./");
    
    const totalFiles = sectionsData.frontend.length + sectionsData.backend.length + 
                      sectionsData.config.length + sectionsData.root.length;
    
    if (totalFiles === 0) {
        console.log("\n❌ No code files found!");
        console.log("💡 Make sure you're in the correct project directory");
        console.log(`💡 Current directory: ${process.cwd()}`);
        process.exit(1);
    }
    
    console.log("\n📊 SCAN RESULTS:");
    console.log(`   🎨 Frontend files: ${sectionsData.frontend.length}`);
    console.log(`   🚀 Backend files: ${sectionsData.backend.length}`);
    console.log(`   ⚙️ Config files: ${sectionsData.config.length}`);
    console.log(`   📁 Root files: ${sectionsData.root.length}`);
    console.log(`   📦 TOTAL: ${totalFiles} files found\n`);
    
    // Generate HTML
    console.log("🎨 Generating HTML and processing files...\n");
    const { html: initialHTML, totalFiles: total } = generateCompleteHTML();
    let finalHTML = initialHTML;
    let processedCount = 0;
    let totalCodeSize = 0;
    
    // Process each section
    for (const section of SECTIONS) {
        const files = sectionsData[section.name];
        if (files.length === 0) continue;
        
        console.log(`📁 Processing ${section.name.toUpperCase()} section (${files.length} files)...`);
        
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
            
            process.stdout.write(`   [${i+1}/${files.length}] ${fileName} ... `);
            
            const result = processFile(filePath);
            
            if (result && result.success) {
                const relativePath = path.relative(process.cwd(), filePath);
                finalHTML += `
<div class="file-card">
    <div class="file-header">
        <h2>${escapeHtml(relativePath)}</h2>
    </div>
    ${result.content}
</div>
`;
                processedCount++;
                totalCodeSize += result.size;
                console.log(`✅ (${(result.size/1024).toFixed(1)} KB)`);
            } else {
                console.log(`⚠️ Skipped`);
                processedStats.failed++;
            }
        }
        console.log();
    }
    
    finalHTML += `
<div class="footer">
    <p><strong>📊 Total Files Processed: ${processedCount}/${totalFiles}</strong></p>
    <p>📦 Total Code Size: ${(totalCodeSize/1024/1024).toFixed(2)} MB</p>
    <p>🔧 Generated on: ${new Date().toLocaleString()}</p>
    <p>📝 Complete Project Source Code Documentation</p>
</div>
</body>
</html>`;
    
    console.log("=" .repeat(70));
    console.log(`\n✅ HTML generated! Processed ${processedCount} files`);
    console.log(`📦 HTML size: ${(Buffer.byteLength(finalHTML, 'utf8') / 1024 / 1024).toFixed(2)} MB`);
    
    // Generate PDF
    console.log("\n🚀 Generating PDF... (this may take a moment)");
    
    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        page.setDefaultTimeout(CONFIG.timeout);
        await page.setViewport({ width: 1200, height: 800 });
        await page.setContent(finalHTML, { waitUntil: 'networkidle0', timeout: CONFIG.timeout });
        
        const outputFile = "COMPLETE_PROJECT_CODE.pdf";
        await page.pdf({ 
            path: outputFile, 
            format: "A4", 
            printBackground: true, 
            margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" } 
        });
        
        await browser.close();
        
        const pdfStats = fs.statSync(outputFile);
        console.log("\n✅ PDF GENERATION COMPLETE!");
        console.log(`📁 Output: ${outputFile}`);
        console.log(`📍 Location: ${path.resolve(outputFile)}`);
        console.log(`📦 PDF Size: ${(pdfStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`\n📊 Final Statistics:`);
        console.log(`   ✅ Successfully processed: ${processedCount} files`);
        console.log(`   ❌ Failed/Skipped: ${processedStats.failed} files`);
        console.log(`   📦 Total code size: ${(totalCodeSize/1024/1024).toFixed(2)} MB`);
        
    } catch (error) {
        console.error("\n❌ Error generating PDF:", error.message);
        if (browser) await browser.close();
    }
}

// Run the script
if (global.gc) {
    console.log("✅ Garbage collection enabled\n");
} else {
    console.log("⚠️ Run with --expose-gc for better memory management\n");
}

main().catch(console.error);

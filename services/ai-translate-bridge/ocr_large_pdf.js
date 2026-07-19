const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

function replaceMultipartFileAndHeaders(bodyBuffer, boundary, newFile, filename, mimeType) {
  const boundaryStr = '--' + boundary;
  const boundaryIdx = bodyBuffer.indexOf(Buffer.from(boundaryStr));
  if (boundaryIdx === -1) return bodyBuffer;

  const headerEndIdx = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), boundaryIdx);
  if (headerEndIdx === -1) return bodyBuffer;

  const headerText = bodyBuffer.slice(boundaryIdx, headerEndIdx).toString('utf8');

  let modifiedHeaderText = headerText;
  modifiedHeaderText = modifiedHeaderText.replace(/filename="[^"]*"/, `filename="${filename}"`);
  modifiedHeaderText = modifiedHeaderText.replace(/Content-Type:\s*[^\r\n]*/i, `Content-Type: ${mimeType}`);

  const fileStartIdx = headerEndIdx + 4;
  const nextBoundaryIdx = bodyBuffer.indexOf(Buffer.from(boundaryStr), fileStartIdx);
  if (nextBoundaryIdx === -1) return bodyBuffer;

  let fileEndIdx = nextBoundaryIdx;
  if (bodyBuffer.slice(fileEndIdx - 2, fileEndIdx).toString() === '\r\n') {
    fileEndIdx -= 2;
  }

  const boundaryTextBuffer = Buffer.from(modifiedHeaderText + '\r\n\r\n', 'utf8');
  const restBuffer = bodyBuffer.slice(fileEndIdx);

  return Buffer.concat([
    bodyBuffer.slice(0, boundaryIdx),
    boundaryTextBuffer,
    newFile,
    restBuffer
  ]);
}

async function performOCR(template, boundary, pdfBytes, chunkIndex) {
  console.log(`Sending Chunk #${chunkIndex} to z-ai OCR API...`);
  
  let bodyBuffer = Buffer.from(template.body, 'base64');
  bodyBuffer = replaceMultipartFileAndHeaders(bodyBuffer, boundary, pdfBytes, 'document.pdf', 'application/pdf');

  const headers = { ...template.headers };
  headers['content-length'] = String(bodyBuffer.length);

  const response = await fetch(template.url, {
    method: 'POST',
    headers,
    body: bodyBuffer
  });

  const responseText = await response.text();
  if (response.status !== 200) {
    throw new Error(`Chunk #${chunkIndex} failed with status ${response.status}: ${responseText}`);
  }

  const parsed = JSON.parse(responseText);
  let mdContent = '';
  if (parsed.data && parsed.data.markdown_content) {
    mdContent = parsed.data.markdown_content;
  } else if (parsed.markdown_content) {
    mdContent = parsed.markdown_content;
  } else {
    // If markdown_content is missing, check in json_content
    if (parsed.data && parsed.data.json_content) {
      try {
        const inner = JSON.parse(parsed.data.json_content);
        if (inner.md_results) {
          mdContent = inner.md_results;
        }
      } catch (_) {}
    }
  }

  if (!mdContent) {
    // Fallback if still empty
    mdContent = JSON.stringify(parsed, null, 2);
  }

  return mdContent;
}

async function run() {
  const templatePath = 'C:\\Users\\ASUS ROD\\Downloads\\Capcut tool\\user_data\\ai-sessions\\z-ai-ocr_captured.json';
  const pdfPath = 'C:\\Users\\ASUS ROD\\Desktop\\ĐỀ TUYỂN SINH 10.pdf';
  const outputPath = 'C:\\Users\\ASUS ROD\\Desktop\\ĐỀ TUYỂN SINH 10_ocr_result.md';

  if (!fs.existsSync(templatePath)) {
    throw new Error('No captured session template found!');
  }
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found at: ${pdfPath}`);
  }

  console.log('Loading template and source PDF...');
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const fileBytes = fs.readFileSync(pdfPath);
  const srcDoc = await PDFDocument.load(fileBytes);
  const totalPages = srcDoc.getPageCount();
  console.log(`Loaded PDF successfully. Total pages: ${totalPages}`);

  const contentType = template.headers['content-type'] || '';
  const match = contentType.match(/boundary=(.+)$/);
  const boundary = match ? match[1] : '';
  if (!boundary) {
    throw new Error('Boundary not found in template content-type!');
  }

  const chunkSize = 80;
  const results = [];

  for (let i = 0; i < totalPages; i += chunkSize) {
    const startPage = i;
    const endPage = Math.min(i + chunkSize, totalPages);
    console.log(`Splitting PDF: extracting pages ${startPage + 1} to ${endPage}...`);

    const subDoc = await PDFDocument.create();
    const pageIndices = [];
    for (let j = startPage; j < endPage; j++) {
      pageIndices.push(j);
    }
    
    const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => subDoc.addPage(page));
    const subDocBytes = await subDoc.save();

    const chunkIndex = Math.floor(i / chunkSize) + 1;
    const md = await performOCR(template, boundary, Buffer.from(subDocBytes), chunkIndex);
    results.push(`\n\n# CHUNK #${chunkIndex} (Trang ${startPage + 1} - ${endPage})\n\n${md}`);
    
    // Add delay to prevent rate limit
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  fs.writeFileSync(outputPath, results.join('\n'), 'utf8');
  console.log(`[SUCCESS] Large PDF OCR complete! Combined Markdown saved to: ${outputPath}`);
}

run().catch(console.error);

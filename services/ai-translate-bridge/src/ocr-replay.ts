import { getCapturedTemplatePath } from './session-manager';
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { updateOcrProgress, clearOcrProgressLog } from './server';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function replaceMultipartFileAndHeaders(bodyBuffer: any, boundary: string, newFile: any, filename: string, mimeType: string): any {
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

async function sendAndCleanOCRRequest(
  template: any,
  boundary: string,
  fileBuffer: any,
  filename: string,
  mimeType: string,
  chunkInfo = ''
): Promise<string> {
  let bodyBuffer = Buffer.from(template.body, 'base64');
  bodyBuffer = replaceMultipartFileAndHeaders(bodyBuffer, boundary, fileBuffer, filename, mimeType);

  const headers = { ...template.headers };
  headers['content-length'] = String(bodyBuffer.length);
  if (headers['x-request-id']) {
    headers['x-request-id'] = generateUUID();
  }

  const response = await fetch(template.url, {
    method: 'POST',
    headers: headers as Record<string, string>,
    body: bodyBuffer
  });

  if (!response.ok) {
    throw new Error(`OCR request failed: ${response.status} - ${await response.text()}`);
  }

  const responseText = await response.text();
  let taskId = '';
  let mdContent = '';

  try {
    const parsed = JSON.parse(responseText);
    if (parsed.data) {
      taskId = parsed.data.task_id || '';
      mdContent = parsed.data.markdown_content || '';
      if (!mdContent && parsed.data.json_content) {
        try {
          const inner = JSON.parse(parsed.data.json_content);
          mdContent = inner.md_results || '';
        } catch (_) {}
      }
    }
    if (!mdContent && parsed.markdown_content) {
      mdContent = parsed.markdown_content;
    }
  } catch (_) {}

  if (!mdContent) {
    mdContent = responseText;
  }

  if (taskId && template.url.includes('z.ai')) {
    updateOcrProgress(`[Dọn dẹp] Đang gửi yêu cầu xóa task ${taskId} trên Z.ai... ${chunkInfo}`);
    const deleteUrl = 'https://ocr.z.ai/api/v1/z-ocr/tasks/delete';
    const deleteHeaders = { ...template.headers };
    delete deleteHeaders['content-type'];
    delete deleteHeaders['content-length'];
    if (deleteHeaders['x-request-id']) {
      deleteHeaders['x-request-id'] = generateUUID();
    }

    fetch(deleteUrl, {
      method: 'POST',
      headers: {
        ...deleteHeaders,
        'content-type': 'application/json'
      } as Record<string, string>,
      body: JSON.stringify({ task_id: taskId })
    }).then(delRes => {
      console.log(`[OCR-CLEANUP] Deleted task ${taskId} from z.ai. Status: ${delRes.status}`);
      updateOcrProgress(`[Dọn dẹp] Đã xóa task ${taskId} thành công! Status: ${delRes.status} ${chunkInfo}`);
    }).catch(delErr => {
      console.error(`[OCR-CLEANUP] Failed to delete task ${taskId}:`, delErr);
      updateOcrProgress(`[Dọn dẹp] Lỗi khi xóa task ${taskId}: ${delErr.message} ${chunkInfo}`);
    });
  }

  return mdContent;
}

export async function replayOCRRequest(providerId: string, newImageBuffer: any): Promise<string> {
  clearOcrProgressLog();
  updateOcrProgress('Khởi động tiến trình OCR...', 2, 100);

  const templatePath = getCapturedTemplatePath(providerId);
  if (!fs.existsSync(templatePath)) {
    const errMsg = `Không tìm thấy file session cho: ${providerId}`;
    updateOcrProgress(errMsg, 0, 100, 'error');
    throw new Error(errMsg);
  }
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  let contentType = template.headers['content-type'] || template.headers['Content-Type'] || '';
  let boundary = '';
  let match = contentType.match(/boundary=(.+)$/i);
  if (match) {
    boundary = match[1];
  }

  if (!template.body || template.body.length === 0) {
    updateOcrProgress('Tự động cấu hình lại request multipart mẫu...', 5, 100);
    if (!boundary) {
      boundary = '----WebKitFormBoundaryAuto' + Math.random().toString(36).substring(2);
      template.headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
    }
    const dummyHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="placeholder.png"\r\nContent-Type: image/png\r\n\r\n`;
    const dummyFooter = `\r\n--${boundary}--\r\n`;
    const dummyBody = Buffer.concat([
      Buffer.from(dummyHeader, 'utf8'),
      Buffer.from('TRANSLATE_ME', 'utf8'),
      Buffer.from(dummyFooter, 'utf8')
    ]);
    template.body = dummyBody.toString('base64');
    template.bodyFormat = 'base64';
  }

  let isPdf = false;
  if (newImageBuffer && newImageBuffer.length > 4 && newImageBuffer.slice(0, 4).toString() === '%PDF') {
    isPdf = true;
  }

  const filename = isPdf ? 'document.pdf' : 'image.png';
  const mimeType = isPdf ? 'application/pdf' : 'image/png';

  if (isPdf) {
    try {
      updateOcrProgress('Đang tải và đếm số trang file PDF...', 10, 100);
      const srcDoc = await PDFDocument.load(newImageBuffer);
      const totalPages = srcDoc.getPageCount();
      updateOcrProgress(`Đọc PDF thành công. Tổng số trang: ${totalPages}`, 15, 100);

      if (totalPages > 80) {
        const chunkSize = 80;
        const mdResults: string[] = [];
        const totalChunks = Math.ceil(totalPages / chunkSize);
        updateOcrProgress(`File PDF lớn. Tự động chia làm ${totalChunks} phần (80 trang/phần) để xử lý tuần tự...`, 20, 100);

        for (let i = 0; i < totalPages; i += chunkSize) {
          const startPage = i;
          const endPage = Math.min(i + chunkSize, totalPages);
          const pageIndices = Array.from({ length: endPage - startPage }, (_, k) => startPage + k);
          const chunkIdx = Math.floor(i / chunkSize);

          updateOcrProgress(`[Phần ${chunkIdx + 1}/${totalChunks}] Đang trích xuất trang ${startPage + 1} đến ${endPage}...`, 20 + chunkIdx * 20, 100);
          const subDoc = await PDFDocument.create();
          const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
          copiedPages.forEach((page) => subDoc.addPage(page));
          const subDocBytes = await subDoc.save();

          updateOcrProgress(`[Phần ${chunkIdx + 1}/${totalChunks}] Đang gửi file lên máy chủ OCR...`, 25 + chunkIdx * 20, 100);
          const md = await sendAndCleanOCRRequest(
            template,
            boundary,
            Buffer.from(subDocBytes),
            `part_${startPage + 1}_to_${endPage}.pdf`,
            'application/pdf',
            `[Phần ${chunkIdx + 1}/${totalChunks}]`
          );
          
          mdResults.push(md);

          if (i + chunkSize < totalPages) {
            updateOcrProgress(`[Phần ${chunkIdx + 1}/${totalChunks}] Đang tạm nghỉ 2 giây tránh quá tải...`, 35 + chunkIdx * 20, 100);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        updateOcrProgress('Tổng hợp dữ liệu OCR của toàn bộ file PDF...', 95, 100);
        const combined = mdResults.map((md, idx) => {
          const startPage = idx * chunkSize + 1;
          const endPage = Math.min((idx + 1) * chunkSize, totalPages);
          return `\n\n# PHAN ${idx + 1} (Trang ${startPage} - ${endPage})\n\n${md}`;
        }).join('\n');

        updateOcrProgress('Hoàn thành trích xuất PDF thành công!', 100, 100, 'completed');
        return combined;
      }
    } catch (pdfErr: any) {
      updateOcrProgress(`Lỗi khi chia PDF, chuyển sang gửi nguyên file: ${pdfErr.message}`, 20, 100);
      console.error('[OCR-REPLAY] Error splitting PDF, falling back to single upload:', pdfErr);
    }
  }

  updateOcrProgress('Đang gửi dữ liệu nhận dạng lên máy chủ OCR...', 30, 100);
  const result = await sendAndCleanOCRRequest(template, boundary, newImageBuffer, filename, mimeType);
  updateOcrProgress('Hoàn thành nhận diện OCR thành công!', 100, 100, 'completed');
  return result;
}

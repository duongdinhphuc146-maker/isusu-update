export function markdownToHtml(md: string): string {
  let html = md;
  // Escape HTML entities to prevent doc format breakage
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore Z.ai specific image alignments
  html = html.replace(/&lt;div style='text-align: center;'&gt;&lt;img src='([^']+)' alt='[^']+'\/&gt;&lt;\/div&gt;/g, '<div style="text-align: center;"><img src="$1" style="max-width:100%;"/></div>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Bullet Lists
  html = html.replace(/^\s*[\*\-]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');

  // Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table>';
      }
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (line.includes('---')) continue;

      const isHeader = !tableHtml.includes('<tbody>') && !tableHtml.includes('<tr>');
      tableHtml += '<tr>';
      cells.forEach(cell => {
        if (isHeader) {
          tableHtml += `<th>${cell}</th>`;
        } else {
          tableHtml += `<td>${cell}</td>`;
        }
      });
      tableHtml += '</tr>';
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += '</table>';
        lines[i - 1] = tableHtml;
      }
    }
  }
  html = lines.join('\n');

  // Wrap generic paragraphs
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('<h') || trimmed.startsWith('<table') || trimmed.startsWith('<tr') || 
        trimmed.startsWith('<td') || trimmed.startsWith('<th') || trimmed.startsWith('</table') || 
        trimmed.startsWith('<ul') || trimmed.startsWith('</ul') || trimmed.startsWith('<li')) {
      return line;
    }
    return trimmed ? `<p>${trimmed}</p>` : '<br/>';
  }).join('\n');

  return html;
}

export function exportToWord(ocrResult: string, fileName: string) {
  const htmlContent = markdownToHtml(ocrResult);
  const documentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>OCR Result</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #334155; }
        h1 { color: #0f172a; font-size: 22px; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-top: 15px; }
        h2 { color: #1e293b; font-size: 18px; margin-top: 15px; }
        h3 { color: #334155; font-size: 14px; }
        p { margin: 0 0 8px 0; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid #94a3b8; padding: 8px; text-align: left; }
        th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
        ul { margin: 8px 0; padding-left: 18px; }
        li { margin-bottom: 4px; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + documentHtml], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

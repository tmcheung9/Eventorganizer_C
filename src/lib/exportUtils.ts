interface ExportFollowUpRow {
  姓名: string;
  信仰狀況: string;
  來源群組: string;
  組長: string;
  慕道狀態: string;
  狀態詳情: string;
  參與程度: string;
  觀察筆記: string;
  熱忱程度: string;
  熱忱筆記: string;
  跟進狀態: string;
  負責人: string;
  跟進行動: string;
  下次跟進日期: string;
}

function formatSeekerStatus(statuses: string): string {
  if (!statuses) return '';
  return statuses
    .split('|')
    .filter(Boolean)
    .map(s => s.replace(/^\d+）/, '').trim())
    .join('; ');
}

export function exportToCSV(data: ExportFollowUpRow[], filename: string) {
  if (data.length === 0) {
    alert('沒有資料可以匯出');
    return;
  }

  const headers = Object.keys(data[0]) as (keyof ExportFollowUpRow)[];
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);

        // Check if value looks like a fraction (e.g., "2/5") that Excel might interpret as a date
        // Force Excel to treat it as text using the ="..." formula format
        if (/^\d+\/\d+$/.test(stringValue)) {
          return `"=""${stringValue}"""`;
        }

        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface PDFFollowUpRow {
  姓名: string;
  信仰狀況: string;
  來源群組: string;
  組長: string;
  慕道狀態: string;
  狀態詳情: string;
  參與程度: string;
  觀察筆記: string;
  熱忱程度: string;
  熱忱筆記: string;
  跟進狀態: string;
  負責人: string;
  跟進行動: string;
  下次跟進日期: string;
}

export function exportToPDFStructured(data: PDFFollowUpRow[], filename: string) {
  if (data.length === 0) {
    alert('沒有資料可以匯出');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('請允許彈出視窗以進行列印');
    return;
  }

  const fontStack = '"PingFang SC", "PingFang TC", "STHeiti", "Microsoft YaHei", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const timestamp = new Date().toLocaleDateString('zh-TW');

  const tableRows = data.map(row => `
    <tr>
      <td>${escapeHtml(row.姓名)}</td>
      <td>${escapeHtml(row.信仰狀況)}</td>
      <td>${escapeHtml(row.來源群組)}</td>
      <td>${escapeHtml(row.組長)}</td>
      <td>${escapeHtml(row.慕道狀態)}</td>
      <td>${escapeHtml(row.狀態詳情)}</td>
      <td>${escapeHtml(row.參與程度)}</td>
      <td>${escapeHtml(row.觀察筆記)}</td>
      <td>${escapeHtml(row.熱忱程度)}</td>
      <td>${escapeHtml(row.熱忱筆記)}</td>
      <td>${escapeHtml(row.跟進狀態)}</td>
      <td>${escapeHtml(row.負責人)}</td>
      <td>${escapeHtml(row.跟進行動)}</td>
      <td>${escapeHtml(row.下次跟進日期)}</td>
    </tr>
  `).join('');

  const printWindow_html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${filename}</title>
        <style>
          * {
            font-family: ${fontStack} !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          html, body {
            margin: 0;
            padding: 12px;
            font-family: ${fontStack} !important;
            font-size: 9pt;
            line-height: 1.4;
            color: #000;
            background: #fff;
            -webkit-text-size-adjust: 100%;
          }

          .header {
            text-align: center;
            margin-bottom: 12px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
          }

          .header h1 {
            font-size: 14pt;
            margin: 0 0 4px 0;
            font-weight: 600;
          }

          .header p {
            font-size: 9pt;
            margin: 0;
            color: #666;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            font-family: ${fontStack} !important;
            font-size: 8pt;
          }

          thead {
            background: #e8e8e8;
          }

          th {
            border: 1px solid #666;
            padding: 6px 4px;
            text-align: center;
            font-weight: 600;
            font-size: 8pt;
            word-break: break-word;
            white-space: normal;
          }

          td {
            border: 1px solid #999;
            padding: 4px;
            text-align: left;
            font-size: 8pt;
            word-break: break-word;
            white-space: normal;
            max-width: 100px;
          }

          tr {
            page-break-inside: avoid;
          }

          tbody tr:nth-child(even) {
            background: #f9f9f9;
          }

          .footer {
            margin-top: 12px;
            text-align: right;
            font-size: 8pt;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 8px;
          }

          @media print {
            @page { size: A4 landscape; margin: 8mm; }
            body { margin: 0; padding: 8mm; }
            table { font-size: 7pt; }
            th, td { padding: 3px 2px; font-size: 7pt; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${filename}</h1>
          <p>共 ${data.length} 筆記錄 | 匯出時間: ${timestamp}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>姓名</th>
              <th>信仰狀況</th>
              <th>來源群組</th>
              <th>組長</th>
              <th>慕道狀態</th>
              <th>狀態詳情</th>
              <th>參與程度</th>
              <th>觀察筆記</th>
              <th>熱忱程度</th>
              <th>熱忱筆記</th>
              <th>跟進狀態</th>
              <th>負責人</th>
              <th>跟進行動</th>
              <th>下次跟進日期</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          <p>本報告由系統自動生成</p>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(printWindow_html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

export function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('找不到要列印的內容');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('請允許彈出視窗以進行列印');
    return;
  }

  const fontStack = '"PingFang SC", "PingFang TC", "STHeiti", "Microsoft YaHei", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  const printWindow_html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${filename}</title>
        <style>
          * {
            font-family: ${fontStack} !important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          html, body {
            margin: 0;
            padding: 20px;
            font-family: ${fontStack} !important;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            background: #fff;
            -webkit-text-size-adjust: 100%;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-family: ${fontStack} !important;
          }

          thead {
            background: #f5f5f5;
          }

          th {
            border: 1px solid #000;
            padding: 12px 8px;
            text-align: center;
            font-weight: 600;
            font-family: ${fontStack} !important;
            font-size: 11pt;
          }

          td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
            font-family: ${fontStack} !important;
            font-size: 11pt;
            word-break: break-word;
            white-space: normal;
          }

          tr {
            page-break-inside: avoid;
          }

          tbody tr:nth-child(even) {
            background: #fafafa;
          }

          h1 {
            font-size: 18pt;
            margin: 20px 0 12px 0;
            font-weight: 600;
            font-family: ${fontStack} !important;
          }

          h2 {
            font-size: 16pt;
            margin: 16px 0 10px 0;
            font-weight: 600;
            font-family: ${fontStack} !important;
          }

          h3 {
            font-size: 14pt;
            margin: 12px 0 8px 0;
            font-weight: 600;
            font-family: ${fontStack} !important;
          }

          div, span, p {
            font-family: ${fontStack} !important;
          }

          button, [role="button"], .flex.gap-2 {
            display: none !important;
          }

          .space-y-8 {
            margin: 0 !important;
          }

          .space-y-8 > div {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            page-break-before: auto;
          }

          .space-y-8 > div:first-child {
            page-break-before: avoid;
          }

          .bg-white {
            page-break-inside: avoid;
            margin-bottom: 0;
            page-break-after: auto;
          }

          @media print {
            @page { size: A4; margin: 10mm; }
            body { margin: 0; padding: 10mm; }
            button, [role="button"], .flex.gap-2 {
              display: none !important;
            }
            .space-y-8 > div:first-child {
              page-break-before: avoid;
            }
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `;

  printWindow.document.write(printWindow_html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
}

function escapeHtml(text: string): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

export { formatSeekerStatus };

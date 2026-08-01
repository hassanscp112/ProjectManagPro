const ExcelJS = require('exceljs');
const fs = require('fs');

async function analyzeExcel() {
  const filePath = 'e:\\Vs Code\\Project Management Package\\Excel Sheets\\جدول تقدم عمل جمبازي.xlsx';
  const outPath = 'C:\\Users\\ahmed\\.gemini\\antigravity-ide\\brain\\a5142ffc-0ce9-41b6-8235-3054e5c33777\\scratch\\excel_analysis_deep.txt';
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  let output = '';

  workbook.eachSheet((worksheet, sheetId) => {
    output += `\n========== SHEET: ${worksheet.name} ==========\n`;
    output += `Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}\n\n`;
    
    for (let r = 1; r <= Math.min(worksheet.rowCount, 50); r++) {
      const row = worksheet.getRow(r);
      if (!row.hasValues) continue;
      
      let rowOutput = `Row ${r}:\n`;
      let hasData = false;
      for (let c = 1; c <= Math.min(worksheet.columnCount, 30); c++) {
        const cell = row.getCell(c);
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          hasData = true;
          let valStr = '';
          if (cell.type === ExcelJS.ValueType.Formula) {
            valStr = `[FORMULA: ${cell.formula}] => Result: ${cell.result}`;
          } else if (cell.type === ExcelJS.ValueType.Hyperlink) {
            valStr = `[HYPERLINK: ${cell.text}] => ${cell.hyperlink}`;
          } else {
            valStr = cell.value.toString();
          }
          
          let bg = '';
          if (cell.style && cell.style.fill && cell.style.fill.type === 'pattern') {
             bg = `(BG: ${cell.style.fill.fgColor ? cell.style.fill.fgColor.argb : 'none'})`;
          }
          
          rowOutput += `  Col ${c} (${cell.address}): ${valStr} ${bg}\n`;
        }
      }
      if (hasData) {
        output += rowOutput;
      }
    }
  });

  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Analysis written to ${outPath}`);
}

analyzeExcel().catch(console.error);

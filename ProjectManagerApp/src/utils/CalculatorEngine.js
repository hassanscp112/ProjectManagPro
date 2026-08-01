export const colIndexToLetter = (index) => {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export const letterToColIndex = (letter) => {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
};

export const evaluateExcelFormula = (formulaStr, rowValues, columns) => {
  if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) return 0;
  
  let expr = formulaStr.substring(1).toUpperCase(); // remove '='
  
  // Find all cell references like A2, B10, AA5
  const cellRegex = /([A-Z]+)[0-9]+/g;
  expr = expr.replace(cellRegex, (match, colLetters) => {
    const colIndex = letterToColIndex(colLetters);
    const col = columns[colIndex];
    if (col) {
      let val = parseFloat(rowValues[col.id]);
      if (isNaN(val)) val = 0;
      return `(${val})`;
    }
    return '(0)';
  });
  
  try {
    // Sanitize to only allow math operations and numbers
    const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
    if (!sanitized.trim()) return 0;
    
    // Evaluate safely
    const result = new Function(`return ${sanitized}`)();
    
    return isNaN(result) || !isFinite(result) ? 0 : result;
  } catch (err) {
    console.warn('Formula evaluation failed for:', expr, err);
    return 0;
  }
};

export const calculateRow = (row, columns) => {
  const newRowValues = { ...row.values };
  let hasChanges = false;

  // Evaluate formulas left to right
  columns.forEach(col => {
    if (col.source === 'formula' && col.formula) {
      const result = evaluateExcelFormula(col.formula, newRowValues, columns);
      if (newRowValues[col.id] !== result) {
        newRowValues[col.id] = result;
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    return { ...row, values: newRowValues };
  }
  return row;
};

const VERSION = 3;
const SIZE = 29;
const DATA_CODEWORDS = 55;
const ECC_CODEWORDS = 15;

function bits(value: number, length: number) {
  return Array.from({ length }, (_, index) => (value >>> (length - index - 1)) & 1);
}

const exp = new Array<number>(512).fill(0);
const log = new Array<number>(256).fill(0);
let field = 1;
for (let index = 0; index < 255; index += 1) {
  exp[index] = field;
  log[field] = index;
  field <<= 1;
  if (field & 0x100) field ^= 0x11d;
}
for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];

function multiply(left: number, right: number) {
  return left === 0 || right === 0 ? 0 : exp[log[left] + log[right]];
}

function generator(degree: number) {
  let polynomial = [1];
  for (let power = 0; power < degree; power += 1) {
    const next = new Array(polynomial.length + 1).fill(0);
    polynomial.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= multiply(coefficient, exp[power]);
    });
    polynomial = next;
  }
  return polynomial;
}

function errorCorrection(data: number[]) {
  const result = [...data, ...new Array(ECC_CODEWORDS).fill(0)];
  const polynomial = generator(ECC_CODEWORDS);
  for (let index = 0; index < data.length; index += 1) {
    const coefficient = result[index];
    if (coefficient === 0) continue;
    polynomial.forEach((value, offset) => { result[index + offset] ^= multiply(value, coefficient); });
  }
  return result.slice(data.length);
}

function payload(value: string) {
  const bytes = [...new TextEncoder().encode(value)];
  if (bytes.length > 53) throw new Error("QR_VALUE_TOO_LONG");
  const stream = [...bits(0b0100, 4), ...bits(bytes.length, 8), ...bytes.flatMap((byte) => bits(byte, 8))];
  stream.push(...new Array(Math.min(4, DATA_CODEWORDS * 8 - stream.length)).fill(0));
  while (stream.length % 8) stream.push(0);
  const data = Array.from({ length: stream.length / 8 }, (_, index) => stream.slice(index * 8, index * 8 + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  let pad = 0;
  while (data.length < DATA_CODEWORDS) { data.push(pad++ % 2 === 0 ? 0xec : 0x11); }
  return [...data, ...errorCorrection(data)].flatMap((byte) => bits(byte, 8));
}

function mask(maskId: number, row: number, column: number) {
  const product = row * column;
  return [
    (row + column) % 2 === 0,
    row % 2 === 0,
    column % 3 === 0,
    (row + column) % 3 === 0,
    (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
    product % 2 + product % 3 === 0,
    (product % 2 + product % 3) % 2 === 0,
    ((row + column) % 2 + product % 3) % 2 === 0,
  ][maskId];
}

function formatBits(maskId: number) {
  let value = ((1 << 3) | maskId) << 10;
  const degree = (input: number) => 31 - Math.clz32(input);
  while (degree(value) >= 10) value ^= 0x537 << (degree(value) - 10);
  return ((((1 << 3) | maskId) << 10) | value) ^ 0x5412;
}

function baseMatrix() {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
  const set = (row: number, column: number, dark: boolean) => { if (row >= 0 && row < SIZE && column >= 0 && column < SIZE) { modules[row][column] = dark; reserved[row][column] = true; } };
  const finder = (top: number, left: number) => {
    for (let row = -1; row <= 7; row += 1) for (let column = -1; column <= 7; column += 1) {
      const inside = row >= 0 && row <= 6 && column >= 0 && column <= 6;
      const dark = inside && (row === 0 || row === 6 || column === 0 || column === 6 || (row >= 2 && row <= 4 && column >= 2 && column <= 4));
      set(top + row, left + column, dark);
    }
  };
  finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
  for (let index = 8; index < SIZE - 8; index += 1) { set(6, index, index % 2 === 0); set(index, 6, index % 2 === 0); }
  for (let row = -2; row <= 2; row += 1) for (let column = -2; column <= 2; column += 1) set(22 + row, 22 + column, Math.max(Math.abs(row), Math.abs(column)) !== 1);
  for (let index = 0; index < 15; index += 1) {
    const verticalRow = index < 6 ? index : index < 8 ? index + 1 : SIZE - 15 + index;
    set(verticalRow, 8, false);
    const horizontalColumn = index < 8 ? SIZE - index - 1 : index < 9 ? 7 : 14 - index;
    set(8, horizontalColumn, false);
  }
  set(4 * VERSION + 9, 8, true);
  return { modules, reserved };
}

function withMask(dataBits: number[], maskId: number) {
  const { modules, reserved } = baseMatrix();
  let bitIndex = 0; let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let offset = 0; offset < SIZE; offset += 1) {
      const row = upward ? SIZE - 1 - offset : offset;
      for (let side = 0; side < 2; side += 1) {
        const column = right - side;
        if (reserved[row][column]) continue;
        const raw = dataBits[bitIndex++] === 1;
        modules[row][column] = mask(maskId, row, column) ? !raw : raw;
      }
    }
    upward = !upward;
  }
  const format = formatBits(maskId);
  for (let index = 0; index < 15; index += 1) {
    const dark = ((format >>> index) & 1) === 1;
    const verticalRow = index < 6 ? index : index < 8 ? index + 1 : SIZE - 15 + index;
    modules[verticalRow][8] = dark;
    const horizontalColumn = index < 8 ? SIZE - index - 1 : index < 9 ? 7 : 14 - index;
    modules[8][horizontalColumn] = dark;
  }
  modules[4 * VERSION + 9][8] = true;
  return modules;
}

function penalty(matrix: boolean[][]) {
  let score = 0;
  const linePenalty = (line: boolean[]) => {
    let result = 0; let run = 1;
    for (let index = 1; index <= line.length; index += 1) {
      if (index < line.length && line[index] === line[index - 1]) run += 1;
      else { if (run >= 5) result += 3 + run - 5; run = 1; }
    }
    const pattern = line.map((item) => item ? "1" : "0").join("");
    result += ((pattern.match(/00001011101/g) ?? []).length + (pattern.match(/10111010000/g) ?? []).length) * 40;
    return result;
  };
  for (let index = 0; index < SIZE; index += 1) { score += linePenalty(matrix[index]); score += linePenalty(matrix.map((row) => row[index])); }
  for (let row = 0; row < SIZE - 1; row += 1) for (let column = 0; column < SIZE - 1; column += 1) if (matrix[row][column] === matrix[row + 1][column] && matrix[row][column] === matrix[row][column + 1] && matrix[row][column] === matrix[row + 1][column + 1]) score += 3;
  const dark = matrix.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((dark * 100) / (SIZE * SIZE) - 50) / 5) * 10;
  return score;
}

export function createQrMatrix(value: string) {
  const data = payload(value);
  return Array.from({ length: 8 }, (_, maskId) => withMask(data, maskId)).sort((left, right) => penalty(left) - penalty(right))[0];
}

export function qrSvg(value: string) {
  const matrix = createQrMatrix(value); const quiet = 4; const dimension = SIZE + quiet * 2;
  const paths: string[] = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) paths.push(`M${x + quiet} ${y + quiet}h1v1h-1z`); }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges" role="img" aria-label="QR Code da inscrição"><rect width="100%" height="100%" fill="#fff"/><path d="${paths.join("")}" fill="#071426"/></svg>`;
}

export function mergeLine(line) {
  const values = line.filter(Boolean),
    result = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const value = values[i] * 2;
      result.push(value);
      gained += value;
      i++;
    } else result.push(values[i]);
  }
  while (result.length < 4) result.push(0);
  return { line: result, gained };
}

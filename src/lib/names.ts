export function stripExtension(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base || fileName.trim();
}

export function uniqueDisplayName(usedNames: Set<string>, fileName: string): string {
  const base = stripExtension(fileName).slice(0, 160);
  if (!usedNames.has(base)) return base;

  let counter = 2;
  while (usedNames.has(`${base} (${counter})`)) {
    counter += 1;
  }
  return `${base} (${counter})`;
}

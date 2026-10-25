const collator = new Intl.Collator('id', {
  numeric: true,
  sensitivity: 'base',
});

export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

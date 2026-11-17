/** Fills `{name}` placeholders in dictionary strings. Dictionaries stay serializable (no functions). */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}

export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (output, [key, value]) =>
      output.replace(new RegExp(`\\{${key}\\}`, "g"), value),
    template,
  );
}

export function renderBulletList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return emptyText;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

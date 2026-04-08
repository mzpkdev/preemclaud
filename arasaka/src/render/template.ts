export type AffectedFile = {
  path: string;
  line?: number;
  note: string;
};

export type Evidence = {
  location: string;
  observation: string;
};

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

export function renderCheckboxList(
  items: string[],
  emptyText: string,
): string {
  if (items.length === 0) {
    return emptyText;
  }

  return items.map((item) => `- [ ] ${item}`).join("\n");
}

export function renderAffectedFileList(
  files: AffectedFile[],
  emptyText: string,
): string {
  if (files.length === 0) {
    return emptyText;
  }

  return files
    .map((f) => {
      const loc = f.line !== undefined ? `\`${f.path}:${f.line}\`` : `\`${f.path}\``;
      return `- ${loc} — ${f.note}`;
    })
    .join("\n");
}

export function renderEvidenceList(
  items: Evidence[],
  emptyText: string,
): string {
  if (items.length === 0) {
    return emptyText;
  }

  return items
    .map((e) => `- \`${e.location}\` — ${e.observation}`)
    .join("\n");
}

export function renderDependsOn(issueNumbers?: number[]): string {
  if (!issueNumbers || issueNumbers.length === 0) {
    return "";
  }

  const links = issueNumbers.map((n) => `#${n}`).join(", ");
  return `**Dependencies**\nDepends on ${links}.`;
}

import { ASSET_BASE } from "../config/assets.ts";

export function wrapArtifactBody(params: {
  body: string;
  banner?: boolean;
  replyAsset?: "issue-reply.svg" | "error-reply.svg";
}): string {
  const content = params.body.trim();
  const parts: string[] = [];

  if (params.banner !== false) {
    parts.push(`<img src="${ASSET_BASE}/banner.svg" />`);
  }
  if (params.replyAsset) {
    parts.push(`<img src="${ASSET_BASE}/${params.replyAsset}" />`);
  }

  parts.push(
    "",
    content,
    "",
    `<img src="${ASSET_BASE}/footer.svg" />`,
  );

  return parts.join("\n");
}

import { ASSET_BASE } from "../config/assets.ts";

export function wrapArtifactBody(params: {
  body: string;
  replyAsset?: "issue-reply.svg" | "error-reply.svg";
}): string {
  const replyAsset = params.replyAsset ?? "issue-reply.svg";
  const content = params.body.trim();

  return [
    `<img src="${ASSET_BASE}/banner.svg" />`,
    `<img src="${ASSET_BASE}/${replyAsset}" />`,
    "",
    `<img src="${ASSET_BASE}/divider.svg" />`,
    "",
    content,
    "",
    `<img src="${ASSET_BASE}/footer.svg" />`,
  ].join("\n");
}

import sharedPersonaMd from "../../content/shared/persona.md";
import commentFormatMd from "../../content/prompt/format.md";
import commentInstructionsMd from "../../content/prompt/instructions.md";
import commentScenariosMd from "../../content/prompt/scenarios.md";

export type PromptMode = "comment";

export function getSystemPrompt(mode: PromptMode): string {
  switch (mode) {
    case "comment":
      return [
        sharedPersonaMd,
        commentFormatMd,
        commentScenariosMd,
        commentInstructionsMd,
      ].join("\n");
  }
}

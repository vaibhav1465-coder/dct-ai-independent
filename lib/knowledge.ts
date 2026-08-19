import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const activeFiles = ["Andrea_s_Editing_Guide.md", "Ten_ways_to_strengthen_your_news_writing.md", "Feedback with v1.3 by DG.md", "Express_Web_Banned_Words.md", "Seven_ways_to_boost_engagement.md", "INCOMPLETE_Indian_Express_Style_Guide.md", "Finding_feature_story_ideas.md"] as const;
let cached: Promise<{ master: string; active: string[] }> | undefined;
export function loadKnowledge() {
  cached ??= (async () => {
    const root = process.cwd();
    const master = await readFile(path.join(root, "knowledge", "DCT_Master_Prompt_v2.2_F.md"), "utf8");
    const active = await Promise.all(activeFiles.map((file) => readFile(path.join(root, "knowledge", "active", file), "utf8")));
    return { master, active };
  })();
  return cached;
}

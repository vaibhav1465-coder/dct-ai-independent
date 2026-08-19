import { createHash } from "node:crypto"; import { readFile } from "node:fs/promises"; import path from "node:path";
const expected = new Map([
  ["knowledge/DCT_Master_Prompt_v2.2_F.md", "FAED6C53605D7218427208D06D5FEC4BD78FA994029DF6C6D7FA5F71EF07F22E"],
  ["knowledge/active/Andrea_s_Editing_Guide.md", "CC893FE2CCCBA7B5D7294A7ED71AAF9F60861FA165297DB19277FDF1630912AC"],
  ["knowledge/active/Ten_ways_to_strengthen_your_news_writing.md", "F09D37D49404B3FE0FA8953C95A99F99B9497D15F795488F22A9348F58136F10"],
  ["knowledge/active/Feedback with v1.3 by DG.md", "84CD92C4D299D29D15DE1302777E3A1218D5C0D75430CC62CBB92C2800AD4931"],
  ["knowledge/active/Express_Web_Banned_Words.md", "C3013B88860ADC975FFD71BD81151CF48078C6D1DAEE549975A1EAF763D5B666"],
  ["knowledge/active/Seven_ways_to_boost_engagement.md", "CC64A28ECFC47D2E57D4EC4E2CA85BA700718672165D0428A6CC03A0F3A727B4"],
  ["knowledge/active/INCOMPLETE_Indian_Express_Style_Guide.md", "C89675D5AE28775DEC841D9A1DEA609D4C0633C4815F67186F34AAA7962DB8A1"],
  ["knowledge/active/Finding_feature_story_ideas.md", "F9637DD0827D84797D6A69C3606AE823E17C3AFEB0FA6D5675FEC5328E8238EF"],
]);
for (const [file, hash] of expected) { const bytes = await readFile(path.join(process.cwd(), file)); const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase(); if (actual !== hash) throw new Error(`Integrity check failed: ${file}`); }
console.log(`Integrity verified for ${expected.size} prompt and knowledge files.`);

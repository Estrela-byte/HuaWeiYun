import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DOCS } from "../dist/knowledge/default-docs.js";

const root = dirname(fileURLToPath(import.meta.url));
const wikiDir = join(root, "..", "docs", "wiki");
const projDir = join(wikiDir, "project-knowledge");
mkdirSync(projDir, { recursive: true });

const groups = { kpi: [], rule: [], faq: [] };
for (const doc of DEFAULT_DOCS) {
  const filename = `${doc.id}.md`;
  writeFileSync(join(projDir, filename), `# ${doc.title}\n\n${doc.content}\n`, "utf-8");
  if (doc.id.startsWith("kpi")) groups.kpi.push(doc);
  else if (doc.id.startsWith("rule")) groups.rule.push(doc);
  else groups.faq.push(doc);
}

const lines = ["# 项目知识库", ""];
const section = (title, docs) => {
  lines.push(`## ${title}`, "");
  for (const d of docs) lines.push(`- [${d.title}](${d.id}.md)`);
  lines.push("");
};
section("财务指标", groups.kpi);
section("预警规则", groups.rule);
section("常见问题与对策", groups.faq);
writeFileSync(join(projDir, "index.md"), lines.join("\n"), "utf-8");

console.log(`done: ${DEFAULT_DOCS.length} docs -> ${projDir}`);
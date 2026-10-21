import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// 全量审计的漏洞退出码 1 表示报告有效；网络或命令异常仍须让 CI 失败。
if (!process.env.npm_execpath) throw new Error("请通过 npm run audit:report 执行。");
const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], {
  encoding: "utf8", timeout: 120000, maxBuffer: 10 * 1024 * 1024
});
if (result.error) throw result.error;
let report;
try { report = JSON.parse(result.stdout); }
catch { throw new Error("依赖审计未返回有效 JSON，请检查 npm registry 连通性。"); }
const counts = report.metadata?.vulnerabilities;
if (report.error || !counts || ![0, 1].includes(result.status)) {
  throw new Error("依赖审计执行失败，请检查 npm registry 或 npm 配置。");
}
console.log(JSON.stringify(report, null, 2));
console.log(`完整依赖审计：${counts.total} 项（高危 ${counts.high}，严重 ${counts.critical}）；运行依赖由独立严格审计阻断。`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## 完整依赖审计", "",
    `共 ${counts.total} 项：严重 ${counts.critical}、高危 ${counts.high}、中危 ${counts.moderate}、低危 ${counts.low}。`, "",
    "本报告包含构建依赖，不因已报告的漏洞阻断 CI。运行依赖高危漏洞仍由 Audit runtime dependencies 严格阻断。", "",
    "<details><summary>完整 JSON 报告</summary>", "", "```json", JSON.stringify(report, null, 2), "```", "", "</details>", ""
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

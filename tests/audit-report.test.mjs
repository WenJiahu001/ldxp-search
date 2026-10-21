import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/audit-report.mjs", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/mock-audit-cli.mjs", import.meta.url));

test("全量审计保留漏洞报告及 Summary，漏洞退出码不阻断", () => {
  const directory = mkdtempSync(join(tmpdir(), "ldxp-audit-test-"));
  const summary = join(directory, "summary.md");
  try {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, npm_execpath: fixture, MOCK_AUDIT_SCENARIO: "vulnerable", GITHUB_STEP_SUMMARY: summary }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /test-build-package/);
    assert.match(readFileSync(summary, "utf8"), /test-build-package/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const scenario of ["network", "invalid"]) {
  test(`全量审计执行异常仍阻断：${scenario}`, () => {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8", env: { ...process.env, npm_execpath: fixture, MOCK_AUDIT_SCENARIO: scenario }
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, scenario === "network" ? /审计执行失败/ : /有效 JSON/);
  });
}

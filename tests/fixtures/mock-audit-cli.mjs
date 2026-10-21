const scenario = process.env.MOCK_AUDIT_SCENARIO;
if (scenario === "network") {
  console.log(JSON.stringify({ error: { code: "ENOTFOUND", summary: "registry unavailable" } }));
  process.exit(1);
}
if (scenario === "invalid") {
  console.log("invalid JSON");
  process.exit(1);
}
console.log(JSON.stringify({
  vulnerabilities: { "test-build-package": { severity: "high" } },
  metadata: { vulnerabilities: { total: 1, critical: 0, high: 1, moderate: 0, low: 0 } }
}));
process.exit(1);

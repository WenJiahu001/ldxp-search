import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { comparePrices, normalizeGoods, priceValue } from "../src/lib/goods.ts";
import { AuthExpiredError, fetchSearch, loginWithCredentials, postLdxp } from "../src/lib/api.ts";
import { AuthSession } from "../src/lib/auth.ts";
import { storage } from "../src/lib/storage.ts";
import { normalizeSearchState } from "../src/lib/searchState.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const memory = new Map();
const credentials = { username: "test-account", password: " test-password " };
const search = { keyword: "GPT", type: "all", current: 3, pageSize: 60 };
const json = (data, code = 1, msg = "") => new Response(JSON.stringify({ code, msg, data }), { headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  memory.clear();
  globalThis.window = { localStorage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) } };
  for (const key of ["ldxp-merchant-token", "ldxp-login-credentials", "ldxp-save-login"]) storage.remove(key);
});
afterEach(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; });

test("缺失价格排末尾，免费价格仍参与排序", () => {
  assert.equal(priceValue(null), null);
  assert.equal(priceValue(" "), null);
  assert.equal(priceValue(false), null);
  assert.equal(priceValue(-1), null);
  assert.deepEqual([undefined, "", 9, 0, 2].sort((a, b) => comparePrices(a, b, true)).slice(0, 3), [9, 2, 0]);
  assert.equal(comparePrices(undefined, 0, true), 1);
  assert.equal(comparePrices(null, null), 0);
});

test("商品数据校验实际类型，丢弃异常字段和非 HTTP 链接", () => {
  const goods = normalizeGoods({ id: {}, name: {}, price: null, status: "1", link: "javascript:alert(1)", description: "large", user: { nickname: {}, contact_qq: "123" } });
  assert.equal(goods.name, undefined);
  assert.equal(goods.status, 1);
  assert.equal(goods.link, undefined);
  assert.equal(goods.price, undefined);
  assert.equal(goods.user.contact_qq, "123");
  assert.equal("description" in goods, false);
});

test("非法缓存页码不会成为 NaN、Infinity 或小数", () => {
  const result = normalizeSearchState({ current: "oops", pageSize: Infinity });
  assert.equal(result.current, 1);
  assert.equal(result.pageSize, 20);
  assert.equal(normalizeSearchState({ current: 1.5 }).current, 1);
});

test("分页参数、类型和 Token 正确传递，响应被瘦身", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://wzyp.cn/merchantApi/MyParent/searchGoodsList");
    assert.equal(options.headers["Merchant-Token"], "test-token");
    assert.deepEqual(JSON.parse(options.body), { current: 3, pageSize: 60, name: "", goods_type: "", keywords: "GPT" });
    return json({ list: [{ id: 1, price: "2", description: "ignored" }], total: "201" });
  };
  const result = await fetchSearch(search, async () => "test-token");
  assert.equal(result.pageCount, 4);
  assert.equal(result.list[0].price, 2);
});

test("Token 过期仅重登一次，第二次失效直接返回错误", async () => {
  const forces = [];
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}, 401, "请先登录"); };
  await assert.rejects(fetchSearch(search, async (force = false) => { forces.push(force); return "token"; }), AuthExpiredError);
  assert.equal(calls, 2);
  assert.deepEqual(forces, [false, true]);
});

test("缺失安全模式时拒绝登录，不发送密码登录请求", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}); };
  await assert.rejects(loginWithCredentials(credentials), /safe_mode/);
  assert.equal(calls, 1);
});

test("安全模式非零不登录；密码保留原始空格", async () => {
  globalThis.fetch = async () => json({ safe_mode: 1 });
  await assert.rejects(loginWithCredentials(credentials), /二级密码/);
  globalThis.fetch = async (url, options) => {
    assert.equal(JSON.parse(options.body).password, credentials.password);
    return url.endsWith("checkSafeMode") ? json({ safe_mode: "0" }) : json({ merchant_token: "new-token" });
  };
  assert.equal(await loginWithCredentials(credentials), "new-token");
});

test("业务错误保留提示，HTML 或畸形列表显示格式错误", async () => {
  globalThis.fetch = async () => json({}, 0, "关键词不可用");
  await assert.rejects(postLdxp("/test", {}), /关键词不可用/);
  globalThis.fetch = async () => new Response("<html>unavailable</html>");
  await assert.rejects(postLdxp("/test", {}), /非 JSON/);
  globalThis.fetch = async () => json({ list: {}, total: 0 });
  await assert.rejects(fetchSearch(search, async () => "token"), /响应格式异常/);
});

test("请求取消不会被误报成网络错误", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const pending = postLdxp("/test", {}, undefined, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("20 秒超时会终止请求并显示明确提示", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const pending = postLdxp("/test", {});
  context.mock.timers.tick(20000);
  await assert.rejects(pending, /超过 20 秒/);
});

test("并发搜索共享一次登录，切换账号不能复用旧 Token", async () => {
  let logins = 0;
  globalThis.fetch = async (url) => url.endsWith("checkSafeMode") ? json({ safe_mode: 0 }) : (logins++, json({ merchant_token: `token-${logins}` }));
  const session = new AuthSession(credentials);
  assert.deepEqual(await Promise.all([session.ensureToken(), session.ensureToken()]), ["token-1", "token-1"]);
  assert.equal(logins, 1);
  session.setCredentials({ username: "other", password: "other-password" });
  assert.equal(await session.ensureToken(), "token-2");
  assert.equal(logins, 2);
});

test("清空期间抵达的旧登录响应不能恢复凭据或 Token", async () => {
  let finishLogin;
  let started;
  const loginStarted = new Promise((resolve) => { started = resolve; });
  globalThis.fetch = async (url) => {
    if (url.endsWith("checkSafeMode")) return json({ safe_mode: 0 });
    started();
    return new Promise((resolve) => { finishLogin = () => resolve(json({ merchant_token: "stale" })); });
  };
  const session = new AuthSession(credentials);
  const pending = session.ensureToken();
  await loginStarted;
  session.clear();
  finishLogin();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(storage.get("ldxp-merchant-token"), null);
  assert.equal(session.getSnapshot().status, "missing");
});

test("取消保存立即删除已存凭据和 Token，偏好可恢复", async () => {
  globalThis.fetch = async (url) => url.endsWith("checkSafeMode") ? json({ safe_mode: 0 }) : json({ merchant_token: "cached" });
  const session = new AuthSession(credentials);
  await session.ensureToken();
  assert.ok(storage.get("ldxp-login-credentials"));
  session.setSave(false);
  assert.equal(storage.get("ldxp-login-credentials"), null);
  assert.equal(storage.get("ldxp-merchant-token"), null);
  assert.equal(storage.get("ldxp-save-login"), "false");
  assert.equal(await session.ensureToken(), "cached");
});

test("本地存储被禁用仍能搜索并清除内存会话", async () => {
  globalThis.window = { get localStorage() { throw new Error("blocked"); } };
  globalThis.fetch = async (url) => url.endsWith("checkSafeMode") ? json({ safe_mode: 0 }) : url.endsWith("/login") ? json({ merchant_token: "memory-token" }) : json({ list: [], total: 0 });
  const session = new AuthSession(credentials);
  const result = await fetchSearch(search, session.ensureToken);
  assert.equal(result.total, 0);
  assert.match(storage.getWarning(), /无法保存/);
  session.clear();
  assert.equal(storage.get("ldxp-merchant-token"), null);
});

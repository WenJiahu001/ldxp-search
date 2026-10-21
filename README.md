# LDXP 货源分页搜索

一个纯前端的 LDXP 货源商品分页搜索工具。页面使用你填写的 LDXP 用户名和密码自动登录，获取并维护 `Merchant-Token`，支持分页搜索、当前页排序筛选、最近关键词和商品表格查看。

> 本项目不是 LDXP 官方项目，也不隶属于 LDXP。请只在你有权限的账号和数据范围内使用。

## 功能

- 使用账号密码自动登录并维护 `Merchant-Token`。
- Token 过期时自动重新登录一次，并重试当前搜索。
- 搜索公开货源商品。
- 使用接口分页，不默认扫描全量数据。
- 账号密码按本地自用模式明文缓存到 `localStorage`。
- 商品关键词会记录最近 20 次，方便快速复用。
- 支持商品类型筛选：全部、卡密、知识、资源、权益。
- 支持当前页排序：售价、成本价、代理价、库存。
- 支持当前页筛选：价格区间、正常上架、有库存。
- 价格区间针对成本价，缺失价格在升序和降序中都排在末尾。
- 支持输入页码后回车跳页；修改每页数量后点击“跳转 / 应用”，从第 1 页查询。
- 大页商品按可见区域分组挂载，翻页加载时保留上一页结果。
- 展示商家头像、店铺链接、昵称、QQ、手机/群和微信/其他联系方式。
- 前端会瘦身接口响应，只保留页面展示需要的字段。

## 技术栈

- Vite
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- TanStack Table
- lucide-react

## 快速开始

环境要求：

- Node.js `^20.19.0` 或 `>=22.12.0`
- npm `>=10`

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

访问页面：

```text
http://127.0.0.1:5173
```

构建静态站：

```bash
npm run build
```

本地预览构建结果：

```bash
npm run preview
```

预览地址通常是：

```text
http://127.0.0.1:4173
```

## 如何使用

1. 在页面填写 LDXP 用户名和密码。
2. 按需勾选“保存”，账号密码会明文保存到当前浏览器 `localStorage`。
3. 输入商品关键词，例如 `GPT`、`Claude`、`Gemini`。
4. 选择商品类型、页码、每页数量。
5. 点击“搜索”，或在输入框中按回车。

首次搜索时页面会自动调用登录接口获取 `Merchant-Token`。如果后续搜索提示 Token 过期，页面会自动重新登录一次并重试当前搜索。

Token 与登录账号绑定，修改用户名或密码会取消旧请求并清除旧会话及结果。旧版未绑定账号的 Token 会被丢弃，下次查询自动登录。取消“保存”会立即移除本地账号密码和 Token，当前会话仍可在内存中使用；偏好会在刷新后保留。本地存储不可用时，页面会提示并退回内存保存。

每个接口请求最多等待 20 秒；认证或业务错误不会自动循环重试。空结果和筛选无匹配时仍保留分页入口。

## 接口说明

登录链路：

```http
POST https://wzyp.cn/merchantApi/user/checkSafeMode
POST https://wzyp.cn/merchantApi/user/login
```

搜索链路：

```http
POST https://wzyp.cn/merchantApi/MyParent/searchGoodsList
Merchant-Token: <自动登录得到的 Merchant-Token>
Content-Type: application/json
```

搜索请求体：

```json
{
  "current": 1,
  "pageSize": 20,
  "name": "",
  "goods_type": "card",
  "keywords": "GPT"
}
```

`type=all` 会转为 `goods_type=""`。响应里的 `data.list` 用于当前页列表，`data.total` 用于分页总数。

## 常用脚本

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
npm run check
npm run audit:runtime
npm run audit:report
```

`npm run check` 会依次执行类型检查和生产构建。`npm test` 使用 Node 内置测试工具和现有 TypeScript 编译器运行回归测试，接口均为模拟响应，不会访问真实账号。

## 开源与贡献

- 许可证：MIT，见 `LICENSE`。
- 贡献说明：见 `CONTRIBUTING.md`。
- 安全说明：见 `SECURITY.md`。
- CI：GitHub Actions 使用 Ubuntu 24.04、Node 22 和 Node 24 运行时的 checkout/setup-node v5，执行 `npm ci`、`npm test`、`npm run check`，严格阻断运行依赖的高危漏洞。
- 完整依赖审计保留在日志及 Actions Summary；构建依赖的漏洞仅报告，不阻断 CI，网络或审计执行异常仍会失败。详情见 `SECURITY.md`。

## 注意事项

- 这是纯前端静态网页，不再包含本地 Express 后端代理。
- 当前自动登录只支持 `safe_mode=0` 的账号；二级密码、邮箱验证码、扫码登录暂不支持。
- 账号密码会明文缓存在浏览器 `localStorage`，仅适合本地自用。
- 不要把本工具部署到公网静态站给多人使用。
- 排序和筛选只作用于当前页，不会扫描全量商品。
- 当前工具只读，不会调用对接、取消对接、克隆店铺等写接口。
- 不要提交 `.env`、真实账号密码、Token、Cookie 或含有敏感信息的截图。
- 不建议直接双击 `index.html` 使用，优先通过 `npm run preview` 或静态 HTTP 服务访问。
- 接口请求使用 `https://wzyp.cn`。原 `pay.ldxp.cn` 会返回 301 跳转，而浏览器不会跟随 CORS 预检跳转，因此不能直接作为纯前端请求地址。
- 如果 `wzyp.cn` 以后调整 CORS 策略，直连接口可能失效，届时需要恢复本地代理或改成浏览器插件/油猴脚本方案。

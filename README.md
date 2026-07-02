# LDXP 货源分页搜索

一个纯前端的 LDXP 货源商品分页搜索工具。页面直接调用 LDXP 接口，支持分页搜索、当前页排序筛选、Token 本地缓存、最近关键词和商品表格查看。

> 本项目不是 LDXP 官方项目，也不隶属于 LDXP。请只在你有权限的账号和数据范围内使用。

## 功能

- 搜索公开货源商品。
- 使用接口分页，不默认扫描全量数据。
- 页面填写 `Merchant-Token`，历史 Token 缓存到 `localStorage`。
- 商品关键词会记录最近 20 次，方便快速复用。
- 支持商品类型筛选：全部、卡密、知识、资源、权益。
- 支持当前页排序：售价、成本价、代理价、库存。
- 支持当前页筛选：价格区间、正常上架、有库存。
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

1. 打开 LDXP 商家后台并确保账号已登录。
2. 获取可用的 `Merchant-Token`。
3. 在页面的 `Merchant-Token` 输入框粘贴 Token。
4. 输入商品关键词，例如 `GPT`、`Claude`、`Gemini`。
5. 选择商品类型、页码、每页数量。
6. 点击“搜索”，或在输入框中按回车。

Token 输入框支持这些格式：

```text
纯 Merchant-Token
Merchant-Token: xxx
{"value":"xxx","expiry":...}
{"merchant_token":"xxx"}
{"token":"xxx"}
Bearer xxx
```

## 接口说明

页面直接请求 LDXP：

```http
POST https://pay.ldxp.cn/merchantApi/MyParent/searchGoodsList
Merchant-Token: <Merchant-Token>
Content-Type: application/json
```

请求体：

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
npm run build
npm run preview
npm run check
```

`npm run check` 会依次执行类型检查和生产构建，适合作为提交前检查。

## 开源与贡献

- 许可证：MIT，见 `LICENSE`。
- 贡献说明：见 `CONTRIBUTING.md`。
- 安全说明：见 `SECURITY.md`。
- CI：GitHub Actions 会执行 `npm ci`、`npm audit --audit-level=high`、`npm run typecheck` 和 `npm run build`。

## 注意事项

- 这是纯前端静态网页，不再包含本地 Express 后端代理。
- 排序和筛选只作用于当前页，不会扫描全量商品。
- 当前工具只读，不会调用对接、取消对接、克隆店铺等写接口。
- Token 会缓存在浏览器 `localStorage`，仅适合本地自用。
- 不要提交 `.env`、真实 Token、Cookie 或含有敏感信息的截图。
- 不建议直接双击 `index.html` 使用，优先通过 `npm run preview` 或静态 HTTP 服务访问。
- 如果 LDXP 以后调整 CORS 策略，直连接口可能失效，届时需要恢复本地代理或改成浏览器插件/油猴脚本方案。

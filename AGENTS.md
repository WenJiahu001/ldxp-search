# AGENTS.md

本文件给后续 AI/开发者阅读，用于维护这个本地 LDXP 货源搜索工具。

## 交流规则

- 全程使用中文回复用户。
- 修改前先理解现有前端数据流，不要重构无关代码。
- 这个项目是本地自用工具，优先保持简单、稳定、可运行。

## 项目概览

- 前端入口：`src/main.tsx`
- 主页面：`src/App.tsx`
- 类型定义：`src/types.ts`
- UI 基础组件：`src/components/ui/*`
- Vite 配置：`vite.config.ts`
- 开源说明：`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`LICENSE`
- CI：`.github/workflows/ci.yml`

当前核心链路：

1. 用户在页面输入关键词、Token、页码、每页数量。
2. 前端直接请求 `https://pay.ldxp.cn/merchantApi/MyParent/searchGoodsList`。
3. Token 通过 `Merchant-Token` 请求头传递，不放入 URL。
4. 前端用 `normalizeGoods` 瘦身响应，移除超长 `description` 等页面不用的字段。
5. 前端展示当前页结果，并在当前页内排序/筛选。

## 重要约束

- 不要把 Token 放到 URL 查询参数里。
- 不要在日志中打印 Token。
- 不要提交 `.env`、真实 Token、Cookie 或含敏感信息的截图。
- 不要读取浏览器本地配置、密码、Cookie 或会话文件。
- 不要恢复后端代理，除非用户明确要求或 LDXP CORS 策略导致纯前端失效。
- 不要调用写接口，例如：
  - `/merchantApi/MyParent/connectGoods`
  - `/merchantApi/MyParent/disconnectGoods`
  - `/merchantApi/MyParent/fetchConnectGoods`
  - `/merchantApi/MyParent/fetchDisconnectGoods`
  - `/merchantApi/MyParent/copyConnectGoods`
- 默认不要做跨页/全量扫描。当前排序和筛选只作用于当前页。

## 接口事实

`searchGoodsList` 支持分页：

```json
{
  "current": 1,
  "pageSize": 20,
  "name": "",
  "goods_type": "card",
  "keywords": "GPT"
}
```

响应包含 `data.list` 和 `data.total`。

页面显示价格时可用字段：

- `price`：商品实际售价
- `cost_price`：当前账号成本价
- `agent_price_limit`：限制售价/最低售价
- `agent_price1`、`agent_price2`、`agent_price3`：不同代理等级价格

## 本地存储

- `ldxp-merchant-token`：当前 Token。
- `ldxp-merchant-token-history`：历史 Token，最多 8 个。
- `ldxp-keyword-history`：最近商品关键词，最多 20 个。
- `ldxp-last-search-state`：上一次搜索条件、页码、每页数量、排序筛选。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run check
npm run preview
```

完成修改后至少运行：

```bash
npm run typecheck
npm run build
```

也可以直接运行：

```bash
npm run check
```

如果改了 Vite 配置，重启开发服务。

## 开源维护原则

- 新增功能时同步更新 README；改变安全边界时同步更新 SECURITY。
- 不要添加真实仓库地址占位、个人 Token、账号信息或不可复现的本地路径。
- CI 使用 Node 22 和 npm ci；改依赖后必须提交更新后的 `package-lock.json`。
- 当前许可证为 MIT。

## UI 维护原则

- 搜索区保持紧凑，不要使用营销页式大标题或大卡片。
- 不要让顶部区域固定遮挡商品列表。
- 表格允许横向滚动，页面本身自然纵向滚动。
- 每页数量由用户控制，但前端响应仍应瘦身，避免长 HTML 描述拖慢页面。
- 图标使用 `lucide-react`，不要用 emoji 做功能图标。

## 后续可选优化

- 做“深度扫描前 N 页并排序”的独立按钮，但必须明确提示会增加请求量。
- 增加导出当前页 CSV。
- 增加复制联系方式按钮。
- 增加商品详情抽屉，但不要默认拉取长描述。

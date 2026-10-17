# 共享展示组件

这些组件只处理布局、金额格式和图形几何。先由游戏引擎完成规则、结算与累计统计，再把结果作为 props 传入。组件不生成游戏结果、不计算概率，也不根据赔率结算。

| 组件 | 主要 props | 使用方式 |
| --- | --- | --- |
| `SegmentedControl<T>` | `label`、`values`、`value`、`format`、`onChange`、`disabled` | 数字或字符串选项；内部是真按钮，带 `aria-pressed` |
| `PnlHeader` | `pnl`、`locale`、`label`、`meta`、`children` | 格式化盈亏金额；子节点可放内联实物换算；含 live region |
| `PnlChart` | `history: {p,e}[]`、`pnl`、`label`、`note`、可选 `title` / `height` | 接收引擎累计后的实线与期望线数据；只计算 SVG 坐标 |
| `LossConversion` | `loss`、`locale`、`label`、`variant`、`emptyText`、`currency` | `inline` 为盈亏头下的实物提示；`panel` 为轮盘原有深色实物面板；换算调用 `engine/items` |
| `DarkReveal` | `children`、`labelledBy`、`className` | 全黑揭晓段容器；Astro 页面中无需 hydration |
| `HundredGrid<T>` | `items`、`label`、`renderCell`、`className` | 10 列方阵；可渲染 100 人、100 个结果或 100 张桌子；格子语义由调用方传入 |

`PnlHeader` 还导出 `pnlColor(value)`，只根据符号选择 `var(--loss)`、`var(--you)` 或 `var(--ink)`。

轮盘、骰宝与百家乐共用 `engine/session.ts` 的纯累计接口。每个游戏自己的引擎返回 `delta`、`expectedDelta` 和 `bets`，累计器保留完整总数并只截断曲线的展示历史。百家乐只扩展路单历史；盈亏、注数与曲线历史交给共享累计器。

`LossConversion` 的 `inline` 模式传入 `makeCopy()` 返回的整句 `输掉的钱 {{itemText}}` / `Lost so far {{itemText}}`；`panel` 模式的 label 仍是独立标题。英文实物单位按数量选单复数，`currency="CNY"` 继续使用人民币物价。

动态英文整句遵循对应翻译源条目的 TEMPLATE。`counted()` 处理计数，`formatCopy()` 替换整句占位符并处理与计数相邻的名词。动词后的金额传 `money(value, locale, false)`，独立净额保留符号。

`PnlHeader` 也支持 `currency="CNY"`：双色球、刮刮乐、抽卡的英文净额保留人民币。该参数默认为 `stake`，其余游戏不受影响。

# G2：移植百家乐实验页

百家乐已有设计稿和纯逻辑引擎，但正式站点尚无入口或可交互页面。本次新增中英两套路由及共享 Preact 组件，保留设计稿的补牌、赔付、概率、中文文案和默认单桌设置。

这是可直接使用的 PR 描述。交付来源是 ZIP，没有远程仓库地址，因此尚未创建远程 PR。

## 页面与交互

- 新增 `src/components/Baccarat.tsx`、`Baccarat.css` 和 `src/pages/zh|en/casino/baccarat.astro`，赌场大厅增加入口。
- 单桌逐张发牌、10 桌结果卡片、100 桌网格；支持每注 10/100/1000、押庄/闲/和、自动、暂停、快进 100 局及重来。
- 累计盈亏、实物换算、第一桌路单、盈亏/期望曲线和每分钟/通宵平均亏损均已接通。换桌或改注保留累计统计；重来清空牌靴和统计。
- 在发牌中停止自动，会结算当前局而不再开新局；重来会立即取消当前动画、结算及下一局计时器。已排队的下一局读取最新设置。
- 百桌结果在颜色以外加上 `+ / − / =`，并提供结果文字和可访问名称。按钮至少 44×44px；盈亏和结果使用 live region；支持减少动画设置。
- `src/styles/tokens.css` 的等宽字体栈增加 `Noto Sans SC` 兜底，修复没有系统中文字体时等宽标签显示方框的问题。亏损样式全部使用 `var(--loss)`。

## 引擎与数字改动（完整清单）

`src/engine/baccarat.ts` 仅追加以下接口，原有规则函数和常量未改：

| 新接口 | 用途 |
| --- | --- |
| `BACCARAT_ROUNDS_PER_HOUR`、`BACCARAT_NIGHT_HOURS`、`BACCARAT_FAST_ROUNDS` | 从设计稿提取每小时 70 局、通宵 8 小时、快进 100 局的设定 |
| `settleHands`、`dealRound`、`BaccaratRound`、`SettledHand`、`BetOutcome` | 调用原有发牌/赔付规则，多桌结算；保存当局押注，防止后续设置改变历史显示 |
| `newSession`、`appendRound`、`BaccaratSession` | 累计盈亏、期望、注数、局数、第一桌路单及曲线；限制显示历史长度 |
| `lossRates`、`sessionLoss` | 每分钟/通宵期望亏损及实物换算输入 |
| `visibleHand` | 根据实际发牌顺序返回已揭晓牌与点数，组件不计算牌点 |

`data/numbers.json` **无改动**；`research/compute_numbers.py` 无改动。页面读取 `baccarat.eight_deck_published.value.prob` 与 `.edge`。条形宽度只是这些数值的视觉比例。正文的百分点差及倍数由这些字段格式化得到；六位小数概率先转为整数相减，再用 `Intl.NumberFormat` 格式化，避免二进制舍入将设计稿的 1.24 显示为 1.23。通宵金额按设计稿取整显示。

原始 `numbers.json` SHA-256：
`f3b688cd29a3e5b85ffe6262aa1cd8712ae5d5fd37e9d40bf4e21f3e0074081b`

设计稿、`i18n/source/Baccarat.json`、`package.json` 和锁文件均逐字节保持不变。没有增加生产或开发依赖。

## 翻译与待确认事项

1. `i18n/source/Baccarat.json` 的 66 条 `en` 全部为空。英文路由从该文件读取译文，缺失时保留中文并标记 `TODO(en)`；未被源文件抽取的动态短语也明确中文兜底。金额和实物换算沿用站点已有英文格式。本站名、页脚仍使用现有全站翻译。
2. 设计稿“一模一样”“牌没有记忆”“不够被人利用”与后续同牌靴条件概率变化的脚注之间存在表述张力。本次按要求保留含义，没有将整体概率改写为实时条件概率，也没有新增统计结论。
3. 现有 `Shoe.draw()` 在每次抽牌前检查剩余牌数是否少于 52，因此可能在一局中途重新洗牌。设计稿同样如此。本次保留既有规则，建议另开议题确认是否调整为局间洗牌。
4. 设计稿的“下一张桌子”保留指向同语言的 `/casino/slots/`。交付的基础项目尚无老虎机正式路由，该链接需后续老虎机移植任务补齐；本次没有伪造占位游戏。
5. 额外执行 `npx tsc --noEmit` 时，原有 `RouletteLab.tsx` 的字面量类型及 `sports.ts` 的元组负索引报错仍存在。这两个文件未修改；新增百家乐文件无类型错误。要求的 `npm test` 与 `npm run build` 均通过。
6. ZIP 中没有 `preview/support.js`，无法直接运行原始 `text/x-dc` 设计稿。本次按设计稿源文件逐段核对结构、留白、尺寸与文案，并检查正式构建截图。

## 验收清单（对应 docs/PORTING.md）

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过

## 验证记录

- `npm test`：3 个测试文件、28 项测试通过；新增 9 项百家乐测试，覆盖九种赔付组合、完整庄家补牌表、确定牌序、和局退回/押和输赢、多桌累计、历史截断与期望亏损。现有 300,000 局频率检验继续通过。
- `npm run build`：成功，输出含两种语言百家乐在内的 8 个静态页面。
- `tools/check_baccarat.mjs`：在正式 build 的 preview 服务上验证中英文、390/640px、单牌揭晓、全部桌数/注额/押注、快进、累计计数、发牌中及间歇中暂停、重来取消回调、自动模式读最新设置、路由跳转、亏损色、触控尺寸、无横向溢出和无浏览器运行错误。
- 为使截图可复现，浏览器检查固定随机种子。截图使用 Chromium，字体使用与页面相同字体家族的本地 `@fontsource` 包代替受限网络中的 Google Fonts 请求；未向产品注入测试样式或替换游戏数据。
- 日志：[`validation/baccarat-tests.txt`](validation/baccarat-tests.txt)、[`validation/baccarat-build.txt`](validation/baccarat-build.txt)、[`baccarat-browser-results.json`](baccarat-browser-results.json)。

复现浏览器验收（Playwright 仅用于本地 QA，不写入依赖清单）：

```sh
npm ci
npm test
npm run build
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run preview -- --host 127.0.0.1
# 另一终端：
node tools/check_baccarat.mjs http://127.0.0.1:4321
```

脚本也支持 `PLAYWRIGHT_MODULE_PATH`、`BROWSER_EXECUTABLE_PATH`、`QA_FONTS_ROOT` 环境变量，分别用于已有 Playwright、已有 Chromium 和本地字体包。截图与报告会写回 `docs/`。

## 正式构建截图

中文，390px：

![中文百家乐 390px](../../qa-output/screenshots/baccarat-zh-390.png)

英文路由，390px（译文缺失处按要求中文兜底）：

![英文路由百家乐 390px](../../qa-output/screenshots/baccarat-en-390.png)

中文，640px：

![中文百家乐 640px](../../qa-output/screenshots/baccarat-zh-640.png)

英文路由，640px：

![英文路由百家乐 640px](../../qa-output/screenshots/baccarat-en-640.png)

其他交互状态：

| 状态（390px） | 中文 | 英文路由 |
| --- | --- | --- |
| 发牌结算 | [截图](../../qa-output/screenshots/baccarat-zh-390-cards.png) | [截图](../../qa-output/screenshots/baccarat-en-390-cards.png) |
| 10 桌 | [截图](../../qa-output/screenshots/baccarat-zh-390-ten.png) | [截图](../../qa-output/screenshots/baccarat-en-390-ten.png) |
| 100 桌 | [截图](../../qa-output/screenshots/baccarat-zh-390-hundred.png) | [截图](../../qa-output/screenshots/baccarat-en-390-hundred.png) |

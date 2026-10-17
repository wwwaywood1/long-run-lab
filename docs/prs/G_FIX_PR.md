# G-fix：修复 G1–G4 英文交互文案，迁移百家乐共享组件

基于本次上传的完整仓库 `dubo-moshilu_3(1).zip`，完成 `docs/reviews/2026-10-17-gpt-G1-G4.md` 第 3 节。英文动态文案此前按中文碎片拼接；现在按译文 note 中的整句 TEMPLATE 渲染。例如 `You won $5!` / `You put in $10, but you actually lost $5`、`Banker · You win`、`Busted at 1.00× · you lose $10`。

## 改动

- 爆点、老虎机、百家乐和骰宝按完整英文语序显示动态结果。英文动词后的金额不带正负号，独立盈亏保留符号；注额按钮统一使用金额格式函数显示 `$1,000`。中文保持设计稿表达。
- `counted()` 和 `formatCopy()` 处理 `1 table`、`1 round`、`1 bet`、`1 pull`、`1 celebration` 等单复数；老虎机/爆点控件标签分别为 Machines / Rounds。较长的英文控件使用完整行宽，避免窄屏挤压文字。
- 实物换算使用 common.007 完整占位句 `Lost so far {{itemText}}`，支持 `1 coffee`、`1 pair of sneakers` 等单数，保留 `currency="CNY"` 的英文人民币物价。
- 百家乐路单、百桌格子与揭晓段的英文圆点使用 B / P / T，附 Banker / Player / Tie 图例；无障碍标签仍使用完整名称，并使用英文分隔标点。
- 双语高亮短语分别指定；静态句子直接使用翻译 JSON 原文，删除对中文短语和数字的替换。新增测试核对双语文案数字与 `numbers.json` / 引擎常量，以及高亮不改变原句。
- 百家乐使用全部六个 shared 组件：分段控件、盈亏头、曲线、实物换算、全黑揭晓段、百桌方阵。删除重复 JSX / SVG / CSS。

## 引擎与数据变动

| 文件 | 变动 |
| --- | --- |
| `src/engine/baccarat.ts` | `BaccaratRound` 增加 `bets`；`BaccaratSession` 扩展共享 `Session`；创建会话、累计盈亏/期望/注数/曲线、累计亏损复用 `session.ts`。仅保留百家乐路单历史扩展。 |
| `src/engine/__tests__/baccarat.test.ts` | 混合结果测试增加注数断言；原有累计总额、设置切换、历史截断和洗牌边界测试继续通过。 |
| `data/numbers.json` | **零改动，与输入包逐字节相同。** |
| 其他引擎、`research/`、`preview/`、`i18n/source/` | **零改动，与输入包逐字节相同。** |

本轮没有更改概率、赔付、发牌或洗牌规则。保留审稿人已合并的连续爆点、起飞前禁止跳车、老虎机宽口径 near miss、百家乐局前洗牌等修正；没有回退到旧工作目录。`package.json` / lockfile 未改。Vitest 的匹配范围补上 `.test.tsx`，保证共享组件渲染测试确实执行。

## 验证

- `npm test`：84 项通过，9 个测试文件（输入包为 52 项 / 7 个文件）。
- `npx tsc --noEmit`：零错误。
- `npm run build`：14 个静态页面构建成功。
- `npm run check:en`：零中文残留；`src/` 无待翻译标记。
- `tools/check_baccarat.mjs`、`tools/check_g1.mjs`、`tools/check_slots.mjs`、`tools/check_crash.mjs`：轮盘、骰宝、百家乐、老虎机、爆点的 zh/en 全部通过。
- 浏览器覆盖 1/10/100 模式、所有注额及玩法/目标、自动与停止、快进、重来、计时器清理、语言切换、亏损色、44px 触控目标、390px / 640px 无横向溢出；在动画、结算、多桌及截图状态检查英文正文与无障碍标签无中文（语言切换除外），并检查单复数、重复负号、金额千位分隔符。
- 针对原报错增加精确断言：老虎机伪中奖完整句；爆点概率说明、爆炸损失、跳车获利、百局飞行统计；百家乐完整单局/十桌结果、B/P/T 圆点；双语高亮均存在。
- QA 脚本也修正了两个旧断言：按新宽口径 near miss 检查非相邻第三轴；手动跳车金额按数值比较，允许金额格式省略整数后的 `.00`。

日志、浏览器报告和截图在 `qa-output/`，已由 `.gitignore` 排除。为 ZIP 审阅附带这些文件；将来提交 Git 时不提交它们，截图上传 PR 附件即可。这里是可直接使用的 PR 描述，尚未创建远程 PR。

## 截图

每张截图均为完整页面。额外的伪中奖、爆炸、手动跳车、十桌、百桌、发牌等状态也位于同一目录。

| 页面 | 中文 390px | 英文 390px | 中文 640px | 英文 640px |
| --- | --- | --- | --- | --- |
| 轮盘 | ![轮盘 zh 390px](../../qa-output/screenshots/g1-roulette-zh-390.png) | ![轮盘 en 390px](../../qa-output/screenshots/g1-roulette-en-390.png) | ![轮盘 zh 640px](../../qa-output/screenshots/g1-roulette-zh-640.png) | ![轮盘 en 640px](../../qa-output/screenshots/g1-roulette-en-640.png) |
| 骰宝 | ![骰宝 zh 390px](../../qa-output/screenshots/g1-sicbo-zh-390.png) | ![骰宝 en 390px](../../qa-output/screenshots/g1-sicbo-en-390.png) | ![骰宝 zh 640px](../../qa-output/screenshots/g1-sicbo-zh-640.png) | ![骰宝 en 640px](../../qa-output/screenshots/g1-sicbo-en-640.png) |
| 百家乐 | ![百家乐 zh 390px](../../qa-output/screenshots/baccarat-zh-390.png) | ![百家乐 en 390px](../../qa-output/screenshots/baccarat-en-390.png) | ![百家乐 zh 640px](../../qa-output/screenshots/baccarat-zh-640.png) | ![百家乐 en 640px](../../qa-output/screenshots/baccarat-en-640.png) |
| 老虎机 | ![老虎机 zh 390px](../../qa-output/screenshots/slots-zh-390.png) | ![老虎机 en 390px](../../qa-output/screenshots/slots-en-390.png) | ![老虎机 zh 640px](../../qa-output/screenshots/slots-zh-640.png) | ![老虎机 en 640px](../../qa-output/screenshots/slots-en-640.png) |
| 爆点 | ![爆点 zh 390px](../../qa-output/screenshots/crash-zh-390.png) | ![爆点 en 390px](../../qa-output/screenshots/crash-en-390.png) | ![爆点 zh 640px](../../qa-output/screenshots/crash-zh-640.png) | ![爆点 en 640px](../../qa-output/screenshots/crash-en-640.png) |

## 移植验收清单

以下逐项对应 `docs/PORTING.md`，模板本身保留未勾选以供后续任务使用。

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 英文文案取自 `i18n/source/<Page>.json` 的 `en`，script 拼接照首碎片 note 里的 TEMPLATE；note 里写了“移植时必须改”的代码都改了
- [x] 金额一律用 `money()`；双色球、刮刮乐、抽卡三页传 `currency: 'CNY'`（英文也写人民币，见 TRANSLATION.md 第 5 条）
- [x] 组件文案用 `src/i18n/copy.ts` 的 `makeCopy()`；碎片句按 TEMPLATE 写英文函数，不拼碎片；英文单复数正确，动词后的金额不带正负号
- [x] 页面模板里不替换中文子串（高亮短语按语言分别写；文案里的数字由测试核对 numbers.json）
- [x] `npm run check:en` 零残留；浏览器检查在英文页玩遍所有模式后也没有中文
- [x] 截图和 QA 结果输出到 `qa-output/`，放进 PR 描述，不提交进仓库
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过

本轮只完成 G-fix，不开始 G5。没有新增规则或文案含义疑问；审稿记录第 1、2 节的既有决定全部保留。G5 与后续页面仍属于下一批工作。

# 静态页面移植规范（章节、序章、结尾、首页、大厅、研究层 Ville）

适用于 DeepSeek 承接的 D9–D20。样板：第 3 章（设计稿 `preview/Ch3-Ruin.dc.html` → `src/views/Ch3Ruin.astro`），每个任务包里都附了这两份，照着它的写法做。

## 1. 交付什么

每页只交一个文件：`src/views/<Name>.astro`（`<Name>` 是去掉连字符的设计稿名，如 `Part2Scam`）。

- 两个路由文件（`src/pages/zh/...`、`src/pages/en/...`）由 Claude 生成，不用写。
- 一个模板同时渲染中英文：顶部 `interface Props { locale: Locale }`，所有文字都来自 `t(编号)`。**模板里不出现任何中文或英文的正文字面量。**
- 只有纯界面交互、不涉及任何概率或金额计算的小部件（例如切换两段已经写好的内容），才可以另交一个 `src/components/widgets/<Name><Thing>.tsx`。其余交互一律按第 5 条留占位。

## 2. 框架（都在任务包的“框架代码”里）

| 用途 | 写法 |
|---|---|
| 页面外壳（页眉、语言切换、页脚） | `<Chapter locale={locale} page="Ch1-EV" title={t(1)} description={t(n)}>…</Chapter>`。设计稿里的 `<header>`、`<footer>` 不要移植 |
| 页首 | `<Hero eyebrow={t(2)} title={t(3)} lede={t(4)} />` |
| 区块 | `<Step id="s1" n="01" verb={t('common.029')} heading={t(5)}>…</Step>`；全黑段加 `dark`；黑段标题是 24px 粗体白字（而不是常见的 22px 浅灰）时再加 `strong`；紧跟黑段的白段加 `afterDark`；没有编号就省掉 `n` / `verb` |
| “先猜”选择题 | `<Predict client:visible locale={locale} label={t('common.030')} options={[t(6), t(7), t(8)]} answer={2} />`，answer 从 0 数 |
| 想深究 | `<Deeper summary={t(33)}>…</Deeper>` |
| 待接入的虚线框 | `<Pending>…</Pending>` |
| 下一章 | `<NextChapter href={pageHref(locale, 'Ch4-Martingale')} label={t(35)} title={t(36)} />` |
| 站内链接 | 设计稿 `href="Ch4-Martingale.dc.html"` → `href={pageHref(locale, 'Ch4-Martingale')}`；可用的页面名见 `routes.ts` 的 `PAGE_PATH` |
| 已有的游戏组件 | 设计稿里嵌了一整台游戏（如轮盘实验室）时，直接用现成组件，例如 `<RouletteLab client:visible locale={locale} defaultTables={10} />` |

## 3. 文字

1. `const { t, rich } = pageText(source, locale);`，`source` 是本页 JSON。`t(12)` 取本页第 012 条，`t('common.029')` 取 common.json。
2. 文字可能含 `<br>`：放进元素时用 `set:html={t(n)}`，放进属性（aria-label 等）时直接 `{t(n)}`。
3. 设计稿里一句话内部有 `<span style="color:…">` 高亮，而 JSON 里是去掉标签的纯文字：用 `rich(n, { zh: '…', en: '…' })`，中英文各写一份带标签的 HTML。**去掉标签后必须和 JSON 的 zh / en 一字不差**，否则构建报错。英文高亮落在意思对应的词上。
4. SVG 里的 `<text>`、`aria-label` 同样用 `t()`。英文通常更长：放宽文字背后的底框，或把 `text-anchor` 改到不会出界的一侧，并在交付说明里写明改了哪里。
5. 数字原样保留在文案里，不要自己算、不要改写。页面上（包括 SVG 坐标、图中标注）出现的统计数字，在交付说明里逐个列出，由 Claude 接到 `data/numbers.json` 或引擎上。
6. JSON 的 note 里写了“移植时……”的，按 note 做；任务包表格的“备注”栏只收录了这一类 note。

## 4. 样式

- 优先用框架里的类：`ch-body`（正文 17px）、`ch-muted`、`ch-small`（13px 注释）、`ch-statement`（大号衬线结论句）、`ch-mono`、`ch-panel`（浅灰圆角面板）、`ch-figure`（自适应宽度的图）、`hl`（荧光黄数字）、`loss`（亏损色）、`you`（蓝色）。
- 颜色换成变量：`#15803D` → `var(--loss)`，`#2BC573` → `var(--loss-on-dark)`，`#2B59C3` → `var(--you)`，`#FFE066` → `var(--highlight)`，`#5A606B` → `var(--muted)`，`#F3F4F6` → `var(--panel)`，`#E4E6EA` → `var(--rule)`。亏损色中文是绿、英文是红，由变量自动切换，不要写死。
- 本页特有的版式写在文件末尾的 `<style>` 里（Astro 会自动限定作用域），类名加页面前缀，例如 `.p2s-chat`。不要整段照抄设计稿的行内 style。
- 设计稿宽 390px，页面最宽 640px：固定宽度的 SVG 加 `class="ch-figure"` 让它自适应，不要写死 `width`/`height`。

## 5. 交互：能做的和留给 Claude 的

| 设计稿里的东西 | 怎么做 |
|---|---|
| 三个选项的“先猜”题（`role="radio"`） | 用 `Predict`。answer 必须由本页后文的结论推出来，在交付说明里写“答案 = 第几个，依据 = 编号 xxx 的原文” |
| `<details>` 折叠 | 用 `Deeper`，或原生 `<details>` |
| 只是切换显示、不用计算的按钮（如“只看中文 / 只看英文”） | 可以写小的 Preact 组件，照 `Predict.tsx` 的风格；state 只存“选了哪个” |
| 滑块、模拟、要算概率或金额的任何东西 | **不要实现。** 按设计稿的默认状态原样画出来，外面包 `<div data-widget="名字">…</div>`，紧挨着写注释 `{/* WIDGET 名字：要做什么、输入是什么、输出显示在哪 */}`。Claude 会换成真组件 |
| `href="#"` 之类还没定的链接 | 保留，在交付说明里列出 |

## 6. 交付格式（直接回复，不要压缩包）

1. 一个代码块：第一行是注释 `{/* src/views/<Name>.astro */}` 之后紧跟完整文件（Astro 文件的注释写在 frontmatter 里也可以：`// src/views/<Name>.astro`）。
2. 如果写了小组件，每个组件一个代码块，第一行注释写路径。
3. 一张“交付说明”表，四栏：类型 | 位置 | 内容 | 说明。类型只用这几种：
   - `答案`：每道 Predict 题的答案和依据编号
   - `WIDGET`：每个占位的名字、要做的交互
   - `数字`：页面上出现、应当接到 numbers.json 的数字（含 SVG 里的）
   - `改动`：为了英文排版改了 SVG 或版式的地方
   - `疑问`：设计稿和 JSON 对不上、或拿不准的地方
4. 自查（交付前逐条确认）：
   - [ ] 模板里没有中文或英文正文字面量，全部 `t()` / `rich()`
   - [ ] 用到的每个编号都在 JSON 里；JSON 里每条可见文字都用上了（没用上的列进“疑问”）
   - [ ] 没有设计稿的页眉、页脚；站内链接都用 `pageHref`
   - [ ] 没有自己算任何概率或金额

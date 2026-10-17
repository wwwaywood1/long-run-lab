# 页面移植指南（设计稿 → 正式站点）

参照实现：`src/components/RouletteLab.tsx` + `src/pages/zh|en/casino/roulette.astro`。

## 步骤
1. 读设计稿 `preview/<Page>.dc.html`：静态部分对应 Astro 页面，`<script type="text/x-dc">` 里的 `Component` 对应 Preact 组件。
2. **先找引擎。** 设计稿脚本里的规则函数（如 `sbMult`、`bcBankerDraws`、`dtStep`）在 `src/engine/` 里都有对应实现，直接调用；缺的先补进引擎并写测试。
3. **组件**：`state` → `useState`，`setTimeout/setInterval` 放进 `useRef` 管理并在卸载时清理；自动模式要通过 ref 读取最新状态（见 RouletteLab 的 `spinRef`）。设计稿里的 `renderVals()` 计算放进组件函数体或 `useMemo`。
4. **文案**：组件内的中英文字放在组件顶部的 `T = { zh, en }` 字典里；静态文案写在 `src/pages/zh` 与 `src/pages/en` 两个页面里。英文取自 `i18n/source/<Page>.json` 的 `en` 字段（未到位时用中文并加 `TODO(en)` 注释）。
5. **数字**：页面里的统计数字从 `data/numbers.json` 导入（例：`numbers.roulette.p_ahead_after_n.value['1000']`）。缺的数字先加到 `research/compute_numbers.py` 再生成。
6. **样式**：用 `src/styles/tokens.css` 的变量；亏损色一律 `var(--loss)`。
7. **自查**：`npm test`、`npm run build` 通过；在 390px 宽度下与设计稿逐段对照；中英文切换链接正确。

## 验收清单（每个 PR）
- [ ] 组件里没有概率、赔付或规则计算（都在 engine）
- [ ] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [ ] zh 与 en 两个路由都在，语言切换互通
- [ ] 英文文案取自 `i18n/source/<Page>.json` 的 `en`，script 拼接照首碎片 note 里的 TEMPLATE；note 里写了“移植时必须改”的代码都改了
- [ ] 金额一律用 `money()`；双色球、刮刮乐、抽卡三页传 `currency: 'CNY'`（英文也写人民币，见 TRANSLATION.md 第 5 条）
- [ ] 组件文案用 `src/i18n/copy.ts` 的 `makeCopy()`；碎片句按 TEMPLATE 写英文函数，不拼碎片；英文单复数正确，动词后的金额不带正负号
- [ ] 页面模板里不替换中文子串（高亮短语按语言分别写；文案里的数字由测试核对 numbers.json）
- [ ] `npm run check:en` 零残留；浏览器检查在英文页玩遍所有模式后也没有中文
- [ ] 截图和 QA 结果输出到 `qa-output/`，放进 PR 描述，不提交进仓库
- [ ] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [ ] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [ ] 390px 与 640px 宽度下截图附在 PR 里
- [ ] `npm test` 与 `npm run build` 通过

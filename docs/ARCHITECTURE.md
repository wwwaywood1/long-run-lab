# 架构

```
preview/            设计稿（.dc.html）：每一页的视觉与文案的唯一参照
src/engine/         游戏与统计的纯逻辑（TypeScript，无 UI 依赖），每个模块都有测试
src/components/     交互组件（Preact 岛屿），只负责状态与画面，规则一律调用 engine
src/pages/zh|en/    中英两套路由，同一页面的两种语言一一对应
src/i18n/           站点级文字与金额格式
src/styles/         设计令牌（tokens.css）与全站样式
data/numbers.json   页面上所有统计数字的唯一来源，由 research/compute_numbers.py 生成
research/           可复现的 Python 计算（精确公式 + 固定种子的模拟）
i18n/source/        从设计稿抽取的文案（翻译用），i18n/glossary.csv 为术语表
tools/              辅助脚本（文案抽取等）
```

## 三条铁律
1. **规则只写一遍。** 赔率、补牌、保底、检测器这些逻辑只能出现在 `src/engine/`。组件里出现概率或赔付计算，就是 bug。
2. **数字有出处。** 页面上的统计数字要么来自 `data/numbers.json`（精确或固定种子模拟），要么来自引擎常量，要么是带出处的真实数据（`numbers.json → facts`）。不允许在页面里手写一个算出来的数。
3. **两种语言同时上线。** 每个页面同时有 `zh` 和 `en` 路由；英文翻译未到位时用中文兜底并标 `TODO(en)`，不能缺页。

## 技术选择
- Astro 5（静态输出，部署到 GitHub Pages）+ Preact 10 岛屿：内容页几乎零 JS，只有游戏组件加载脚本。
- Vitest：引擎测试用可设种子的 `mulberry32`，模拟结果可重现。
- Python（numpy/scipy）：研究层数字的可复现计算。

## 语言相关的视觉
- 亏损色：`html[lang=zh]` 为绿色 `#15803D`（中国股市习惯：绿跌），`html[lang=en]` 为红色 `#D33A35`。组件里一律写 `var(--loss)`，不要写死颜色。
- 金额：`src/i18n/site.ts → money()`；中文“元”，英文“$”。实物换算见 `src/engine/items.ts`（两套物价）。

## 部署
- `.github/workflows/ci.yml`：测试 + 构建 + 研究脚本冒烟。
- `.github/workflows/deploy.yml`：推到 main 后构建并发布到 GitHub Pages，自动设置 `BASE_PATH=/<仓库名>/`。

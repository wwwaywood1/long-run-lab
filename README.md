# 概率的游戏 · Long Run Lab

> 庄家从不掷“骰子”。The house doesn't play dice.

用可玩的模拟和可复现的数学，讲清楚“久赌必输”。
*An open-source, bilingual, interactive explainer on why gamblers lose in the long run.*

- **可玩**：轮盘、骰宝、百家乐、老虎机、爆点、二十一点、双色球、刮刮乐、抽卡、足球竞猜，每张桌子都能真玩，还能同时开 100 桌。
- **讲机制**：每张桌子的“0”藏在哪：0 与 00、豹子、抽水、伪装成赢的输、保底、串关……
- **可复现**：页面上的每个数字都来自 `research/compute_numbers.py`（精确计算或固定种子模拟），游戏规则有单元测试。
- **研究层**：Ville 不等式、e 值、随时有效推断、e-detector，以及一个能玩的“公平检测器”。
- **中英双语**：中文版亏损用绿色（中国股市习惯），英文版用红色。

## 快速开始
```bash
npm install
npm run dev          # http://localhost:4321/zh/
npm test             # 引擎测试
npm run build        # 静态站点输出到 dist/
pip install -r research/requirements.txt && npm run numbers   # 重新生成 data/numbers.json
```

## 文档
- [架构](docs/ARCHITECTURE.md) · [设计规范](docs/DESIGN.md) · [页面移植指南](docs/PORTING.md)
- [翻译规范](docs/TRANSLATION.md) · [术语表](i18n/glossary.csv) · [事实核查清单](docs/FACTCHECK.md)
- [任务分配](docs/TASKS.md) · [研究层](research/README.md)

## 状态
设计稿全部完成（`preview/`）。正式站点已完成：架构、11 个游戏与检测器的引擎和测试、可复现计算、轮盘实验室中英双语示范页。其余页面按 `docs/TASKS.md` 逐页移植中。

## 求助
如果你或身边的人停不下来，请寻求专业帮助（资源列表上线前逐条核实，见 docs/FACTCHECK.md F14）。

## 许可
代码：MIT（见 LICENSE）。文字与图形内容：CC BY 4.0（见 LICENSE-CONTENT.md）。

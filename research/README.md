# 研究层：可复现计算

```bash
pip install -r research/requirements.txt
python3 research/compute_numbers.py          # 完整模式（约 1 分钟），生成 data/numbers.json
python3 research/compute_numbers.py --quick  # 开发用，小样本
```

- `method: "exact"`：组合计数、闭式公式、动态规划，结果确定。
- `method: "simulation"`：蒙特卡洛，固定种子 `20261016`，记录样本量。
- `facts`：真实世界的数据与法规，只记录出处，不计算；上线前按 `docs/FACTCHECK.md` 逐条核实。

网站的游戏引擎（`src/engine/`）另有 TypeScript 测试，验证同一套规则在网页里的模拟结果与这里的精确值一致：`npm test`。

## 计划中
- 技术报告（英文 PDF）：Ville 不等式、e 值检验、e-detector 在“公平性监测”上的应用与模拟研究。
- notebooks：每张图一份可复现的 notebook。

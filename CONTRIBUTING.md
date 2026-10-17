# 参与贡献

欢迎提交 issue 和 PR。动手前请读 `docs/ARCHITECTURE.md` 的三条铁律：

1. 规则只写在 `src/engine/`，并配测试。
2. 页面上的统计数字必须来自 `data/numbers.json`、引擎常量或带出处的真实数据。
3. 中英两种语言同时上线。

提交前：`npm test` 与 `npm run build` 必须通过；改动研究计算时，重新运行 `npm run numbers` 并在 PR 里说明哪些数字变了、为什么。

内容纠错（数据过时、出处有误、翻译问题）请直接开 issue，附上原始出处。

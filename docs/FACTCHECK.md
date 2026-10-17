# 事实核查清单

每条都要找到**原始出处**（政府公告、官方规则、原始报告），记录链接和核实日期。核实结果写进 `research/compute_numbers.py` 的 `FACTS` 或页面出处行。

最近一轮：2026-10-17，DeepSeek 核查（D5），Claude 复核 F12。

| # | 内容 | 用在哪 | 原始出处 | 状态 |
|---|---|---|---|---|
| F1 | 竞彩总返奖率 73%（奖金 73% / 发行费 11% / 公益金 16%），现行有效 | Sports | [财政部 财办综〔2014〕57 号](http://zhs.mof.gov.cn/zhengcefabu/201901/t20190118_3125288.htm) | 已核 |
| F2 | 双色球三至六等奖 3000/200/10/5 元；一等奖两部分各封顶 500 万；自第 2026076 期起“福运奖”暂停，奖池达 15 亿元恢复 | Lottery | [中国福彩发布稿（广东福彩转载，2026-07-03）](http://www.gdfc.org.cn/article/284502.html) | 已核 |
| F3 | 双色球资金构成：返奖 51%、公益金 36%、发行费 13% | Lottery | [财政部公告 2026 年第 24 号](http://zhs.mof.gov.cn/zhengcefabu/202608/t20260826_3996112.htm) | 已核 |
| F4 | 即开型资金构成：返奖 65%、公益金 20%、发行费 15% | Scratch | 同上 | 已核 |
| F5 | 2025 年全国彩票销售 6,279.69 亿元、公益金 1,621.05 亿元；中央与地方各 50%，中央 60/30/5/5 | Lottery / Scratch / Sports | [财政部 2025 年 12 月彩票销售情况](http://zhs.mof.gov.cn/zonghexinxi/202601/t20260128_3982699.htm)；公告 2026 年第 24 号 | 已核 |
| F6 | 2025 年 1–11 月即开型 1,208.12 亿元，+13.8%；2023 年同期 +93.6% | Scratch | [财政部 2025 年 11 月](https://m.mof.gov.cn/czsj/202512/t20251218_3979490.htm)、[2023 年 11 月](http://zhs.mof.gov.cn/zonghexinxi/202312/t20231227_3924271.htm)彩票销售情况 | 已核 |
| F7 | 2026 年 6 月彩票销售 759.78 亿元，+39.5%，世界杯拉动竞猜型彩票 | Sports | [财政部 2026 年 6 月彩票销售情况](https://zhs.mof.gov.cn/zonghexinxi/202607/t20260728_3994422.htm) | 已核 |
| F8 | 骰宝常见赔率：任意豹子 1 赔 30、总和 4 点 1 赔 60、指定豹子 1 赔 180 | SicBo | 只找到二手来源（维基、马萨诸塞州博彩委员会规则草案）；页面已注明“按常见规则举例，各场馆略有不同” | 已核（举例） |
| F9 | 文市发〔2016〕32 号：公示抽取概率、不得直接用钱参与，2017-05-01 施行；至今无替代新规 | Gacha | [文化部 文市发〔2016〕32 号](https://www.mct.gov.cn/whzx/ggtz/201612/t20161205_695627.htm) | 已核 |
| F10 | 比利时博彩委员会 2018 年认定付费开箱违法 | Gacha | 二手：NOS 2018-08-27、暴雪论坛公告；委员会原文未找到 | 已核（二手） |
| F11 | 《彩票管理条例》第十八条、第三十三条原文 | 三个彩票页 | [国务院令第 554 号](https://www.gov.cn/gongbao/content/2009/content_1322125.htm) | 已核 |
| F12 | 内华达 2025 年 9 月收入与赢率；连续 55 个月每月赢额 ≥ 10 亿美元 | Prologue / Ch2 / Part4 / Slots | [NGCB 2025 年 9 月收入报告](https://www.gaming.nv.gov/contentassets/a33ba6284fa04aac891eba2bc6f26489/mrrsept2025.pdf)；“第 55 个连续月”为 NGCB 分析师 Shelley Newell 原话，见 [CDC Gaming](https://cdcgaming.com/nevada-gaming-revenue-up-for-year-despite-september-decline/) | 已核 |
| F13 | 双色球第 2026076 期开奖与 2026 年累计销售 295.75 亿元 | Lottery | [中国福彩发布稿（新湖南转载，2026-07-06）](https://www.hunantoday.cn/news/xhn/202607/33079605.html) | 已核 |
| F14 | 求助资源：中国 12356；美国 1-800-GAMBLER、SAMHSA 1-800-662-4357；英国 GamCare 0808 8020 133 | Ending（中英） | 12356：人民网、央广网报道；NCPG；GamCare | 号码已核；12356 服务时间待核；成瘾门诊无全国名录，改为通用指引 |
| F15 | e-detector：Shin, Ramdas & Rinaldo (2024), NEJSDS 2(2):229–260, DOI 10.51387/23-NEJSDS51 | Research | [NEJSDS](https://nejsds.nestat.org/journal/NEJSDS/article/59/info) | 已核 |
| F16 | 抽卡定价：648 元档约 40 抽，每抽约 16 元 | Gacha（中英） | 只找到二手来源（17173 攻略）；页面写明“按……折算” | 已核（举例） |

## 上线前还要做

- F14：12356 的服务时间；Part2-Scam 的反诈热线与 App 名称（与 F14 一起核）。
- Ending 页文案请专业人士（心理咨询或成瘾医学背景）看一遍。这条原先写在页面页脚，D4 校对指出是内部备注，已移到这里。

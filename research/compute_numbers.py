"""
概率的游戏 · 关键数字的可复现计算
================================

运行：python3 research/compute_numbers.py [--quick]
输出：data/numbers.json —— 网站上出现的每一个统计数字都应该能在这里找到来源。

约定：
- method = "exact"：组合计数、闭式公式或动态规划，结果是确定的。
- method = "simulation"：蒙特卡洛，记录种子与样本量；--quick 时样本量缩小，只用于开发。
- method = "design_reference"：原设计稿展示数字，原始实验未提供；不是新模拟结果。
- 真实世界的数据（销量、赢率、法规）放在 facts 里，并附出处，不在这里计算。
"""

from __future__ import annotations

import argparse
import json
import math
import platform
from datetime import date
from fractions import Fraction
from itertools import product
from pathlib import Path

import numpy as np
from scipy.stats import binom

SEED = 20261016
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "numbers.json"


def exact(value, note="", **extra):
    return {"value": value, "method": "exact", "note": note, **extra}


def sim(value, n, note="", **extra):
    return {"value": value, "method": "simulation", "n": n, "seed": SEED, "note": note, **extra}


# ---------------------------------------------------------------- 轮盘与第一部分
def roulette_numbers():
    p = 18 / 38
    ahead = {}
    for n in [1, 10, 100, 1000, 10000]:
        # 严格领先：赢的局数 > n/2
        ahead[str(n)] = float(binom.sf(n // 2, n, p))
    edge = Fraction(2, 38)
    # 赌徒破产：100 元押红每次 1 元，先到 200 元的概率
    r = Fraction(20, 18)
    i, N = 100, 200
    p_win = (1 - r**i) / (1 - r**N)
    q = 1 - p
    duration = i / (q - p) - (N / (q - p)) * float(p_win)
    # 倍投法：底注 10，最多连投 7 次（本金 1270）
    qlose = Fraction(20, 38)
    bust = qlose**7
    ev_round = 10 * (1 - bust) - 1270 * bust
    # 反正弦律：领先时间占比 ≥ 90% 的概率（连续近似）
    arcsine = 1 - (2 / math.pi) * math.asin(math.sqrt(0.9))
    # Ville 上界与轮盘全押
    ville = {str(k): {"bound": 1 / k, "roulette_all_in": (18 / 38) ** math.log2(k)} for k in [2, 4, 8, 16, 32, 64]}
    # 八种押法：覆盖格数、实际赔率、公平赔率、庄家优势（第二部分 · 换押法，不换税率）
    bets = [("straight", 1, 35), ("split", 2, 17), ("street", 3, 11), ("corner", 4, 8),
            ("five", 5, 6), ("line", 6, 5), ("dozen", 12, 2), ("red", 18, 1)]
    bet_edges = {
        key: {"covers": k, "pays": pays, "fair": float(Fraction(38, k) - 1), "edge": float(1 - Fraction(k, 38) * (pays + 1))}
        for key, k, pays in bets
    }
    return {
        "edge_red": exact(float(edge), "押红：20 格输、18 格赢，每押 1 元平均输 2/38 元"),
        "p_ahead_after_n": exact(ahead, "押红 n 局后严格领先（赢局数 > n/2）的概率，二项分布精确计算"),
        "one_in_x_ahead_after_10000": exact(1 / ahead["10000"], "约多少人里只剩 1 个领先"),
        "ruin_100_to_200": exact(float(p_win), "本金 100、每次押红 1 元，先翻倍到 200 的概率"),
        "ruin_one_in": exact(float(1 / p_win)),
        "ruin_expected_duration": exact(duration, "上述过程的期望局数"),
        "martingale_bust": exact(float(bust), "底注 10、本金 1270，一轮里连输 7 次的概率"),
        "martingale_ev_per_round": exact(float(ev_round), "每一轮（直到赢一次或爆掉）的期望盈亏，元"),
        "arcsine_lead_90pct": exact(arcsine, "公平游戏里，90% 以上时间都在领先的人的比例（反正弦律，连续近似）"),
        "ville": exact(ville, "P(资金曾达到 k 倍)：上界 1/k；轮盘全押 (18/38)^log2(k)"),
        "bet_edges": exact(bet_edges, "美式轮盘八种押法：公平赔率 = 38/k − 1，优势 = 1 − (k/38)(赔率 + 1)；五号注 3/38，其余 2/38"),
    }


# ---------------------------------------------------------------- 赌场游戏
def sicbo_numbers():
    outs = list(product(range(1, 7), repeat=3))
    triple = sum(1 for o in outs if o[0] == o[1] == o[2])
    big = sum(1 for o in outs if 11 <= sum(o) <= 17 and not (o[0] == o[1] == o[2]))
    four = sum(1 for o in outs if sum(o) == 4)
    return {
        "counts": exact({"big": big, "small": 216 - big - triple, "triple": triple}),
        "edge_big_small": exact(float(Fraction(6, 216)), "豹子通杀"),
        "edge_any_triple_30to1": exact(float(1 - Fraction(31 * triple, 216))),
        "edge_total4_60to1": exact(float(1 - Fraction(61 * four, 216))),
        "edge_specific_triple_180to1": exact(float(1 - Fraction(181, 216))),
    }


def baccarat_numbers():
    w = {v: (4 / 13 if v == 0 else 1 / 13) for v in range(10)}

    def banker_draws(b, p3):
        if p3 is None:
            return b <= 5
        if b <= 2:
            return True
        if b == 3:
            return p3 != 8
        if b == 4:
            return p3 in (2, 3, 4, 5, 6, 7)
        if b == 5:
            return p3 in (4, 5, 6, 7)
        if b == 6:
            return p3 in (6, 7)
        return False

    res = {"B": 0.0, "P": 0.0, "T": 0.0}
    for p1, p2, b1, b2, c5, c6 in product(range(10), repeat=6):
        pr = w[p1] * w[p2] * w[b1] * w[b2] * w[c5] * w[c6]
        P, B = (p1 + p2) % 10, (b1 + b2) % 10
        if P < 8 and B < 8:
            p3, nxt = None, c5
            if P <= 5:
                p3, P, nxt = c5, (P + c5) % 10, c6
            if banker_draws(B, p3):
                B = (B + nxt) % 10
        res["B" if B > P else "P" if P > B else "T"] += pr
    return {
        "infinite_deck_probabilities": exact(res, "无限副牌近似下的精确概率"),
        "eight_deck_published": exact(
            {"prob": {"B": 0.458597, "P": 0.446247, "T": 0.095156}, "edge": {"B": 0.010579, "P": 0.012351, "T": 0.143596}},
            "8 副牌标准规则的公认值；本站百家乐引擎的模拟与之吻合（见 src/engine/__tests__）",
        ),
    }


def slots_numbers():
    reels = ["7C_BSDC_SBDC7_SCD_BC", "7C_BSDC_SBDC7_SCD_BC", "C_BSD_C_SBDC_7_SCD_C"]
    three = {"777": 200, "BBB": 50, "SSS": 25, "DDD": 15}
    cherry = [0, 0.5, 2, 5]
    tot = hits = ldw = real = near = 0
    pay_counts = {key: 0 for key in ["777", "BBB", "SSS", "DDD", "CCC", "CC", "C"]}
    for i, j, k in product(range(20), repeat=3):
        a, b, c = reels[0][i], reels[1][j], reels[2][k]
        x = three.get(a + b + c, cherry[(a, b, c).count("C")])
        tot += x
        hits += x > 0
        ldw += 0 < x < 1
        real += x > 1
        near += a == "7" and b == "7" and c != "7"
        key = a + b + c if a + b + c in three else "C" * (a, b, c).count("C")
        if key in pay_counts:
            pay_counts[key] += 1
    n = 8000
    return {
        "rtp": exact(tot / n, "本站设计的示例老虎机"),
        "edge": exact(1 - tot / n),
        "hit_rate": exact(hits / n, "响铃（有任何返还）的比例"),
        "ldw_rate": exact(ldw / n, "伪装成赢的输：返还 0.5 倍"),
        "real_win_rate": exact(real / n),
        "p_777": exact(4 / n),
        "p_77x": exact(near / n, "“差一点”：前两轴是 7、第三轴不是；与引擎 isNearMiss 同口径"),
        "pay_table_probabilities": exact({key: count / n for key, count in pay_counts.items()}, "穷举三轴 20^3 个停点；C/CC/CCC 表示恰好 1/2/3 个圆点，特殊三连优先"),
        "hundred_outcomes": exact({"win": round(real / n * 100), "ldw": round(ldw / n * 100), "miss": 100 - round(real / n * 100) - round(ldw / n * 100)}, "100 格示意：真赢与伪装成赢的输分别四舍五入，其余填为未中；不是某次随机样本"),
    }


def crash_numbers():
    targets = [1.5, 2, 3, 5, 10, 20, 50, 100]
    return {
        "rtp": exact(0.97),
        "success_probability": exact({str(m): 0.97 / m for m in targets}, "P(爆点 ≥ m) = 0.97/m"),
        "ev_any_target": exact(-0.03, "任何跳车点、任何不能预知未来的跳车策略：期望 −3%（可选停时定理）"),
    }


def lottery_numbers():
    T = math.comb(33, 6)

    def pm(r, b):
        return Fraction(math.comb(6, r) * math.comb(27, 6 - r), T) * (Fraction(1, 16) if b else Fraction(15, 16))

    tiers = {1: [(6, 1)], 2: [(6, 0)], 3: [(5, 1)], 4: [(5, 0), (4, 1)], 5: [(4, 0), (3, 1)], 6: [(2, 1), (1, 1), (0, 1)]}
    prize = {3: 3000, 4: 200, 5: 10, 6: 5}
    probs = {t: sum(pm(*x) for x in v) for t, v in tiers.items()}
    fixed_ev = sum(probs[t] * prize[t] for t in prize)
    assumed = {1: 7_000_000, 2: 120_000}
    sim_ev = fixed_ev + sum(probs[t] * assumed[t] for t in assumed)
    return {
        "tier_probability": exact({str(t): float(p) for t, p in probs.items()}),
        "jackpot_one_in": exact(T * 16),
        "any_prize_one_in": exact(float(1 / sum(probs.values()))),
        "fixed_prize_return_rate": exact(float(fixed_ev / 2), "三到六等奖的期望返还 ÷ 2 元"),
        "site_simulation_return_rate": exact(float(sim_ev / 2), "一二等奖按 700 万/12 万计时的期望返还率"),
        "years_for_jackpot_10_bets_3_draws_week": exact(T * 16 / (10 * 156)),
        "fund_flow_yuan_per_bet": exact({
            "fixed_prizes": float(fixed_ev), "top_prizes_and_pool": float(Fraction(102, 100) - fixed_ev),
            "welfare": float(2 * Fraction(36, 100)), "operations": float(2 * Fraction(13, 100)), 
        }, "每注 2 元：固定奖精确期望，浮动奖与奖池占官方 51% 返奖的剩余部分；不等于本站固定头奖模拟的返还率"),
        "presentation_reference": lottery_presentation_numbers(),
    }


def lottery_presentation_numbers():
    """Unchanged contextual figures quoted by the design, pending the D5 fact check."""
    return {
        "value": {
            "welfare_allocation": [0.5, 0.3, 0.15, 0.05],
            "central_allocation": [0.6, 0.3, 0.05, 0.05],
            "population": 1_400_000_000, "per_capita_sales_display": 450,
            "ssq_2026_draw076_sales_yuan": 295.75e8,
            "pyramid_years_ago": 4600, "qin_years_ago": 2200,
        },
        "method": "design_reference",
        "source": "preview/Lottery.dc.html; i18n/source/Lottery.json；核实见 docs/FACTCHECK.md F5（财政部公告 2026 年第 24 号）、F13（中国福彩发布稿，2026-07-06）",
        "note": "D5 已核：公益金分配比例见 F5，双色球截至第 2026076 期累计销售 295.75 亿元见 F13。人均约 450 元 = 2025 年全国彩票销售额（F5）÷ 14 亿人后取整；金字塔、秦朝年代是常识性约数。既有 facts.china_lottery_2025 原值不变。",
    }


def scratch_numbers():
    amounts = [10, 20, 50, 100, 500, 1000, 10_000, 100_000, 1_000_000]
    per_million = [170_000, 92_500, 25_000, 8000, 600, 200, 10, 1, 0.2]
    paid = sum(a * c for a, c in zip(amounts, per_million))
    wins = sum(per_million)
    return {
        "rtp": exact(paid / 10_000_000, "本站设计的 10 元示例票"),
        "win_rate": exact(wins / 1_000_000),
        "break_even_share_of_wins": exact(per_million[0] / wins),
        "real_win_rate": exact((wins - per_million[0]) / 1_000_000),
        "edge": exact(1 - paid / 10_000_000),
        "hundred_outcomes": exact({
            "win": round((wins - per_million[0]) / 10000), "even": round(per_million[0] / 10000),
            "miss": 100 - round((wins - per_million[0]) / 10000) - round(per_million[0] / 10000),
        }, "100 张票的期望频数取整，仅作示意，不保证每批恰有这些结果"),
        "fund_flow_yuan_per_ticket": exact({
            "prizes": float(10 * Fraction(65, 100)), "welfare": float(10 * Fraction(20, 100)), "operations": float(10 * Fraction(15, 100)),
        }, "即开型彩票每张 10 元，按既有官方 65%/20%/15% 资金比例"),
        "presentation_reference": {
            "value": {"instant_sales_2025_jan_nov_yuan": 1208e8, "growth_2025": 0.138, "growth_2023": 0.936},
            "method": "design_reference", "source": "preview/Scratch.dc.html; i18n/source/Scratch.json；核实见 docs/FACTCHECK.md F6（财政部 2025 年 11 月、2023 年 11 月彩票销售情况）",
            "note": "D5 已核（F6）：2025 年 1–11 月即开型彩票 1,208.12 亿元、同比 +13.8%；2023 年同期 +93.6%。",
        },
    }


def gacha_numbers():
    def p5(k):
        return 0.006 if k <= 73 else min(1.0, 0.006 + 0.06 * (k - 73))

    dist = np.zeros(91)
    surv = 1.0
    for k in range(1, 91):
        dist[k] = surv * p5(k)
        surv *= 1 - p5(k)
    feat = np.zeros(181)
    feat[:91] += 0.5 * dist
    feat[: len(np.convolve(dist, dist))] += 0.5 * np.convolve(dist, dist)[:181]
    cdf = np.cumsum(feat)
    mean5 = float((np.arange(91) * dist).sum())
    meanf = float((np.arange(181) * feat).sum())
    bins = {f"{a}-{a + 19}": float(feat[a : a + 20].sum()) for a in range(1, 181, 20)}
    return {
        "mean_pulls_per_5star": exact(mean5),
        "consolidated_5star_rate": exact(1 / mean5),
        "mean_pulls_featured": exact(meanf),
        "mean_cost_featured_yuan": exact(meanf * 16, "每抽按 16 元"),
        "median_pulls_featured": exact(int(np.searchsorted(cdf, 0.5))),
        "p90_pulls_featured": exact(int(np.searchsorted(cdf, 0.9))),
        "max_pulls_featured": exact(180),
        "share_5star_after_pull_73": exact(float(dist[74:].sum())),
        "histogram_featured_20": exact(bins),
        "presentation": exact({
            "price_per_pull_yuan": 16,
            "median_cost_featured_yuan": int(np.searchsorted(cdf, 0.5)) * 16,
            "p90_cost_featured_yuan": int(np.searchsorted(cdf, 0.9)) * 16,
            "max_cost_featured_yuan": 180 * 16,
            "cash_payout_rate": 0,
            "pity_example": {"banked": 76, "remaining": 90 - 76, "spent_yuan": 76 * 16,
                             "remaining_cost_yuan": (90 - 76) * 16, "progress": 76 / 90},
        }, "既有示例卡池每抽 16 元，不返还现金；76 抽为原设计稿选取的保底示例；金额和进度按既有规则计算"),
    }


def sports_numbers():
    return {
        "return_by_legs": exact({str(k): 0.92**k for k in [1, 2, 3, 4, 6, 8]}, "每场返还 92% 的示例赔率"),
        "example_overround": exact(1 / 2.09 + 1 / 3.40 + 1 / 3.17, "示例赔率 2.09/3.40/3.17 的隐含概率之和"),
        "presentation": exact({
            "example_odds": [2.09, 3.40, 3.17],
            "example_implied_probabilities": [1 / o for o in [2.09, 3.40, 3.17]],
            "example_vig": 1 / 2.09 + 1 / 3.40 + 1 / 3.17 - 1,
            "return_per_100": {str(k): 100 * 0.92**k for k in [1, 2, 3, 4, 6, 8]},
        }, "由既有示例赔率和每场 92% 模型换算；逐场赔率取整后的实际期望由引擎 evaluate 单独计算"),
        "presentation_reference": {
            "value": {"example_8_leg_hit_probability": 0.002,
                      "example_8_leg_bets_per_hit": 500, "example_8_leg_odds_range": [200, 300]},
            "method": "design_reference",
            "source": "preview/Sports.dc.html; i18n/source/Sports.json；原稿引用财政部 2026 年 6 月彩票销售数据（同花顺，2026-07-28）及人民网 2014-09-10",
            "note": "背景销售额/增速（F7）和官方竞彩返奖率 73%（F1）已由 D5 核实，复用既有 facts，不在此重复存储。这里的 0.2%/500 单/两三百倍是原稿 8 串 1 近似例子，未附具体比赛或实验，不代表所有随机串关。",
        },
    }


# ---------------------------------------------------------------- 模拟部分
def blackjack_numbers(n_hands: int, rng: np.random.Generator):
    ranks = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]

    def total(cards):
        t = sum(1 if c == 11 else c for c in cards)
        if 11 in cards and t + 10 <= 21:
            return t + 10, True
        return t, False

    def basic(cards, up, can_d, can_p):
        if can_p and len(cards) == 2 and cards[0] == cards[1]:
            pv = cards[0]
            sp = (pv in (11, 8)) or (pv == 9 and (up <= 6 or up in (8, 9))) or (pv == 7 and up <= 7) or (pv == 6 and up <= 6) \
                or (pv == 4 and up in (5, 6)) or (pv in (2, 3) and up <= 7)
            if sp:
                return "P"
        t, soft = total(cards)
        if soft:
            if t >= 19: return "S"
            if t == 18: return ("D" if can_d else "S") if 3 <= up <= 6 else ("S" if up <= 8 else "H")
            if t == 17: return "D" if 3 <= up <= 6 and can_d else "H"
            if t >= 15: return "D" if 4 <= up <= 6 and can_d else "H"
            if t >= 13: return "D" if 5 <= up <= 6 and can_d else "H"
            return "H"
        if t >= 17: return "S"
        if t >= 13: return "S" if up <= 6 else "H"
        if t == 12: return "S" if 4 <= up <= 6 else "H"
        if t == 11: return "D" if up <= 10 and can_d else "H"
        if t == 10: return "D" if up <= 9 and can_d else "H"
        if t == 9: return "D" if 3 <= up <= 6 and can_d else "H"
        return "H"

    shoe: list[int] = []

    def draw():
        nonlocal shoe
        return shoe.pop()

    def play(pay):
        nonlocal shoe
        if len(shoe) < 78:
            shoe = [r for _ in range(6) for _ in range(4) for r in ranks]
            rng.shuffle(shoe)
        p, d = [draw()], [draw()]
        p.append(draw()); d.append(draw())
        dbj, pbj = total(d)[0] == 21, total(p)[0] == 21
        if dbj:
            return 0.0 if pbj else -1.0, pbj
        if pbj:
            return pay, True
        hands = [[p, 1, False]]
        i = 0
        while i < len(hands):
            cards, mult, aces = hands[i]
            if aces:
                i += 1
                continue
            while True:
                if total(cards)[0] >= 21:
                    break
                can_d = len(cards) == 2
                can_p = len(cards) == 2 and len(hands) < 2 and cards[0] == cards[1]
                a = basic(cards, d[0], can_d, can_p)
                if a == "S":
                    break
                if a == "H":
                    cards.append(draw())
                elif a == "D":
                    cards.append(draw()); hands[i][1] = 2
                    break
                else:
                    c2 = cards.pop()
                    is_aces = c2 == 11
                    cards.append(draw())
                    hands.insert(i + 1, [[c2, draw()], 1, is_aces])
                    if is_aces:
                        hands[i][2] = True
                        break
            i += 1
        if any(total(h[0])[0] <= 21 for h in hands):
            while total(d)[0] < 17:
                d.append(draw())
        dt = total(d)[0]
        net = 0.0
        for cards, mult, _ in hands:
            pt = total(cards)[0]
            if pt > 21: net -= mult
            elif dt > 21 or pt > dt: net += mult
            elif pt < dt: net -= mult
        return net, False

    out = {}
    for pay in (1.5, 1.2):
        s = 0.0
        bjs = 0
        for _ in range(n_hands):
            x, isbj = play(pay)
            s += x
            bjs += isbj
        out[str(pay)] = -s / n_hands
    return {
        "basic_strategy_edge": sim(out, n_hands, "6 副牌、S17、可加倍、分牌一次、无投降；按 3:2 与 6:5 两种黑杰克赔率"),
        "note": "学庄家、永不爆牌两种策略的优势见 src/engine/blackjack.ts 中的 BJ_EDGE 与对应测试",
        "presentation_reference": blackjack_presentation_numbers(),
    }


def blackjack_presentation_numbers():
    """Preserve prototype figures whose original simulation runs were not supplied.

    These are design references, NOT newly reproduced Monte Carlo estimates.
    Kept separate from basic_strategy_edge, whose existing seeded run is unchanged.
    """
    return {
        "value": {
            "bust_sample": 100, "player_busts": 16, "both_busts": 3.7,
            "bust_simulation_rounds": 2_000_000,
            "strategy_edges": {"basic_3to2": 0.005, "basic_6to5": 0.018, "mimic": 0.056, "never": 0.060},
            "strategy_simulation_rounds": [3_000_000, 15_000_000],
            "counting": {
                "simulation_rounds": 6_000_000, "player_edge": 0.0025, "minimum_bet": 100,
                "hourly_win": 27, "hourly_swing": 2000, "confidence": 0.95,
                "hours": 16000, "hours_per_day": 8, "years": 5.5,
                "bet_ramp": {"2": 2, "3": 4, "4": 8},
            },
        },
        "method": "design_reference",
        "source": "preview/Blackjack.dc.html; i18n/source/Blackjack.json",
        "note": "原样移植设计稿已给出的展示数字；原始爆牌、策略比较及算牌实验的种子/输出未随仓库提供，尚未独立复现。不是 basic_strategy_edge 的重估，也不是当前动态牌靴概率。详见 G5 PR 的待核对项。",
    }


def detector_numbers(n_tables: int, n_sims: int, rng: np.random.Generator):
    """与 src/engine/detector.ts 同一套统计量：
    e 值 = 五个备择似然比乘积的平均（报警线 20）；
    e-detector = 同样五个备择的 Shiryaev–Roberts 统计量平均（报警线 1000）；
    对照组 = 单侧 z 检验，从第 10 局起每局看一次，z < −1.645 即报警。"""
    p0 = 18 / 38
    grid = np.array([0.30, 0.34, 0.38, 0.42, 0.45])
    lw, ll = grid / p0, (1 - grid) / (1 - p0)

    def first_alarms(n, rounds, p_before, p_after=None, change=0):
        """逐局推进，返回 e 值、e-detector、z 检验各自首次报警的局数（没报警记 rounds+1）"""
        L, R = np.ones((n, 5)), np.zeros((n, 5))
        wins = np.zeros(n)
        fe, fr, fz = (np.full(n, rounds + 1) for _ in range(3))
        with np.errstate(over="ignore"):
            for t in range(1, rounds + 1):
                p = p_before if (p_after is None or t <= change) else p_after
                x = rng.random(n) < p
                f = np.where(x[:, None], lw, ll)
                L, R = np.minimum(L * f, 1e300), np.minimum((R + 1) * f, 1e300)
                wins += x
                fe = np.where((fe > rounds) & (L.mean(axis=1) >= 20), t, fe)
                fr = np.where((fr > rounds) & (R.mean(axis=1) >= 1000), t, fr)
                if t >= 10:
                    z = (wins / t - p0) / np.sqrt(p0 * (1 - p0) / t)
                    fz = np.where((fz > rounds) & (z < -1.645), t, fz)
                if p_after is not None and t > change and (fe <= rounds).all() and (fr <= rounds).all():
                    break
        return fe, fr, fz

    # 1) 公平桌：误报
    fe, fr, fz = first_alarms(n_tables, 5000, p0)
    fair = {
        "e_value_1000": float((fe <= 1000).mean()),
        "naive_peeking_1000": float((fz <= 1000).mean()),
        "e_value_5000": float((fe <= 5000).mean()),
        "naive_peeking_5000": float((fz <= 5000).mean()),
        "e_detector_1000": float((fr <= 1000).mean()),
    }
    # 2) 从第 1 局起就被调低胜率：e 值多久报警
    horizon = 20000
    rigged = {}
    for p in (0.42, 0.45):
        fe, _, _ = first_alarms(n_sims, horizon, p, p, 0)
        rigged[f"{round(p * 100)}"] = {"median": float(np.median(fe)), "never_within_horizon": int((fe > horizon).sum())}
    # 3) 先放水（前 100 局 55%）再收割（42%）
    fe, fr, _ = first_alarms(n_sims, horizon, 0.55, 0.42, 100)
    delay = fr[fr > 100] - 100
    change = {
        "e_detector_median_delay": float(np.median(delay)),
        "e_detector_alarm_before_change": int((fr <= 100).sum()),
        "e_value_median_alarm_from_start": float(np.median(fe)),
    }
    return {
        "fair_false_alarm": sim(fair, n_tables, "公平桌在前 1000 / 5000 局内被误判为作弊的比例"),
        "rigged_median_alarm": sim(rigged, n_sims, "胜率从第 1 局起被调到 42% / 45% 时，e 值首次越过 20 的局数中位数（上限 20000 局）"),
        "change_point": sim(change, n_sims, "前 100 局胜率 55%、之后 42%：e-detector 在动手后第几局报警（中位数），普通 e 值从开局算第几局报警"),
        "e_detector_arl_guarantee": {"value": 1000, "method": "theorem", "note": "Shiryaev–Roberts e-detector，报警线 1000 ⇒ 公平时平均误报间隔 ≥ 1000 局"},
    }


# ---------------------------------------------------------------- 真实世界数据（只记录，不计算）
FACTS = {
    "nevada_sep_2025": {
        "strip_baccarat_hold": {"value": [0.1710, 0.0849], "note": "2024 年 9 月 → 2025 年 9 月"},
        "strip_slots_hold": {"value": [0.088, 0.080]},
        "statewide_table_hold": {"value": [0.151, 0.121], "note": "全州桌台游戏赢率，2024 年 9 月 → 2025 年 9 月"},
        "slots_win_usd": {"value": 937.1e6, "note": "2025 年 9 月全州老虎机赢额"},
        "table_win_usd": {"value": 346.1e6, "note": "2025 年 9 月全州桌台游戏赢额；与老虎机相加 = 12.832 亿，和 NGCB 报告总赢额 1,283,210,629 美元一致"},
        "total_win_usd": {"value": 1283210629, "note": "NGCB 2025 年 9 月报告，全州总赢额"},
        "streak_months": {"value": 55, "note": "截至 2025 年 9 月，连续每月赢额 ≥ 10 亿美元的月数"},
        "source": "NGCB 2025 年 9 月收入报告；CDC Gaming 2025-10-30（含 NGCB 分析师“第 55 个连续月 ≥ 10 亿美元”）",
    },
    "china_lottery_2025": {
        "sales_yuan": 6279.69e8,
        "welfare_fund_yuan": 1621.05e8,
        "source": "财政部公告 2026 年第 24 号《2025 年彩票公益金筹集分配情况》；财政部 2025 年 12 月彩票销售情况",
    },
    "china_lottery_jun_2026": {"sales_yuan": 759.78e8, "yoy": 0.395, "source": "财政部 2026 年 6 月份全国彩票销售情况（2026-07-28）"},
    "lotto_fund_split": {"prizes": 0.51, "welfare": 0.36, "operations": 0.13, "source": "财政部公告 2026 年第 24 号（双色球、大乐透）"},
    "instant_fund_split": {"prizes": 0.65, "welfare": 0.20, "operations": 0.15, "source": "财政部公告 2026 年第 24 号"},
    "jingcai_payout": {"value": 0.73, "source": "财政部 财办综〔2014〕57 号（2026-10-17 核实仍有效）"},
    "regulations": {
        "lottery_minors_credit": "《彩票管理条例》（国务院令第 554 号）第十八条：不得向未成年人销售彩票，不得赊销或以信用方式销售",
        "welfare_use": "《彩票管理条例》第三十三条：公益金专项用于社会福利、体育等社会公益事业",
        "gacha_disclosure": "文市发〔2016〕32 号，2017-05-01 起公示随机抽取概率",
        "belgium_loot_boxes": "比利时博彩委员会，2018（二手来源：NOS 2018-08-27）",
        "nevada_1b_streak": "截至 2025 年 9 月，连续 55 个月每月赢额 ≥ 10 亿美元（NGCB 分析师 Shelley Newell，CDC Gaming 引述）",
        "china_helpline": "全国心理援助热线 12356（国家卫生健康委员会）",
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="缩小模拟样本，仅供开发")
    ap.add_argument("--out", type=Path, default=OUT, help="输出路径（CI 冒烟测试时写到临时文件）")
    ap.add_argument("--blackjack-presentation-only", action="store_true", help="只把二十一点设计稿展示数字补入已有 JSON，不重跑或改动任何既有数值")
    ap.add_argument("--lottery-presentation-only", action="store_true", help="只把双色球资金流和设计稿背景数字补入已有 JSON，不重跑既有模拟")
    ap.add_argument("--scratch-presentation-only", action="store_true", help="只补刮刮乐资金流、示意频数和背景引用，不重跑既有模拟")
    ap.add_argument("--gacha-presentation-only", action="store_true", help="只补抽卡成本和原稿保底示例，不重跑或改动既有数值")
    ap.add_argument("--sports-presentation-only", action="store_true", help="只补足球示例赔率换算和原稿引用，不重跑或改动既有数值")
    ap.add_argument("--exact-only", action="store_true", help="只重算轮盘的精确数字和真实世界数据（roulette、facts），不重跑任何模拟")
    args = ap.parse_args()
    if args.exact_only:
        numbers = json.loads(args.out.read_text(encoding="utf-8"))
        numbers["roulette"] = roulette_numbers()
        numbers["facts"] = FACTS
        args.out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated roulette exact numbers and facts in {args.out}")
        return
    if args.sports_presentation_only:
        numbers = json.loads(args.out.read_text(encoding="utf-8"))
        generated = sports_numbers()
        for key in ("presentation", "presentation_reference"):
            numbers["sports"][key] = generated[key]
        args.out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated sports example conversions and references in {args.out}")
        return
    if args.gacha_presentation_only:
        numbers = json.loads(args.out.read_text(encoding="utf-8"))
        numbers["gacha"]["presentation"] = gacha_numbers()["presentation"]
        args.out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated gacha costs and pity example in {args.out}")
        return
    if args.scratch_presentation_only:
        numbers = json.loads(args.out.read_text(encoding="utf-8"))
        generated = scratch_numbers()
        for key in ("edge", "hundred_outcomes", "fund_flow_yuan_per_ticket", "presentation_reference"):
            numbers["scratch"][key] = generated[key]
        args.out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated scratch fund flow, outcomes and presentation references in {args.out}")
        return
    if args.lottery_presentation_only:
        numbers = json.loads(args.out.read_text(encoding="utf-8"))
        generated = lottery_numbers()
        for key in ("fund_flow_yuan_per_bet", "presentation_reference"):
            numbers["lottery"][key] = generated[key]
        args.out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated lottery fund flow and presentation references in {args.out}")
        return
    if args.blackjack_presentation_only:
        numbers = json.loads(args.out.read_text(encoding="utf-8"))
        numbers["blackjack"]["presentation_reference"] = blackjack_presentation_numbers()
        args.out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated blackjack presentation references in {args.out}")
        return
    rng = np.random.default_rng(SEED)
    n_bj = 50_000 if args.quick else 1_000_000
    n_det = 1000 if args.quick else 20000
    n_det_sims = 400 if args.quick else 4000

    numbers = {
        "meta": {
            "generated_by": "research/compute_numbers.py",
            "generated_on": date.today().isoformat(),
            "python": platform.python_version(),
            "numpy": np.__version__,
            "seed": SEED,
            "quick": args.quick,
        },
        "roulette": roulette_numbers(),
        "sicbo": sicbo_numbers(),
        "baccarat": baccarat_numbers(),
        "slots": slots_numbers(),
        "crash": crash_numbers(),
        "lottery": lottery_numbers(),
        "scratch": scratch_numbers(),
        "gacha": gacha_numbers(),
        "sports": sports_numbers(),
        "blackjack": blackjack_numbers(n_bj, rng),
        "detector": detector_numbers(n_det, n_det_sims, rng),
        "facts": FACTS,
    }
    out: Path = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(numbers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()

import { useState } from 'preact/hooks';
import source from '../../../i18n/source/Casino.json';
import { makeCopy } from '../../i18n/copy';
import { money, type Locale } from '../../i18n/site';
import { formatChance } from '../../i18n/format';
import { HOUSE_BETS, HOUSE_GAME_IDS, HOUSE_TINY_PROBABILITY, houseNight, type HouseGame } from '../../engine/house';
import './house.css';

const T = makeCopy({ choose: '选游戏', bet: '客人每注', take: '一晚 8 小时，你平均进账',
  loss: '平均每位客人输', chance: '这一晚你亏钱的概率', tiny: '小于十亿分之一',
  normal: '亏钱概率按正态近似估算。', roulette: '轮盘', sicbo: '骰宝', baccarat: '百家乐', slots: '老虎机', crash: '爆点',
  rouletteNote: '按押红、每小时 60 局。', sicboNote: '按押大小、每小时 60 局。',
  baccaratNote: '按押庄、每小时 70 局。优势最低，所以庄家偶尔会输一晚，但很少。',
  slotsNote: '按本项目的老虎机、每小时 600 次。', crashNote: '按 2 倍跳车、每小时 180 局。',
}, source);
// NEW COPY（Claude 审定 2026-10-17）：独立性假设，并点明同一局多人下注时不成立。
export const NEW_COPY = {
  zh: { assumptions: '假设每一注相互独立、金额固定，客人不会中途离场；客人押的是同一局时不适用。', about: (p: string) => `约 ${p}` },
  en: { assumptions: 'Assumes every bet is independent and the same size, and no one leaves early. This does not hold when guests bet on the same round.', about: (p: string) => `about ${p}` },
};
export function houseChance(p: number, locale: Locale) {
  return p < HOUSE_TINY_PROBABILITY ? T[locale].tiny : NEW_COPY[locale].about(formatChance(p));
}
export default function HouseCalculator({ locale }: { locale: Locale }) {
  const [game, setGame] = useState<HouseGame>('baccarat');
  const [bet, setBet] = useState<number>(100);
  const t = T[locale], result = houseNight(game, bet);
  // Short button labels explicitly required by Casino.093/.095 TEMPLATE notes.
  const label = (id: HouseGame) => locale === 'en' && id === 'slots' ? 'Slots' : locale === 'en' && id === 'crash' ? 'Crash' : t[id];
  return <div class="cas-calc" data-testid="house-calculator">
    <div class="cas-seg is-games" role="group" aria-label={t.choose}>
      {HOUSE_GAME_IDS.map(id => <button type="button" class={`cas-seg-btn ${game === id ? 'is-on' : ''}`} aria-pressed={game === id} data-game={id} onClick={() => setGame(id)}>{label(id)}</button>)}
    </div>
    <div class="cas-bet-row"><span class="cas-bet-label">{t.bet}</span>
      <div class="cas-seg is-bet" role="group" aria-label={t.bet}>
        {HOUSE_BETS.map(value => <button type="button" class={`cas-seg-btn ${bet === value ? 'is-on' : ''}`} aria-pressed={bet === value} data-bet={value} onClick={() => setBet(value)}>{money(value, locale, false)}</button>)}
      </div>
    </div>
    <div class="cas-house-panel" aria-live="polite" aria-atomic="true">
      <span class="cas-house-label">{t.take}</span>
      <span class="cas-house-big">{money(result.expected, locale, false)}</span>
      <span class="cas-house-rule" />
      <div class="cas-house-row"><span>{t.loss}</span><span class="cas-house-per">{money(result.perGuest, locale, false)}</span></div>
      <div class="cas-house-row"><span>{t.chance}</span><span class="cas-house-odd">{houseChance(result.lossProbability, locale)}</span></div>
      <span class="cas-house-note">{t[`${game}Note`]}{t.normal}</span>
      <span class="cas-house-note">{NEW_COPY[locale].assumptions}</span>
    </div>
  </div>;
}

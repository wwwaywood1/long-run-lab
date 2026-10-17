// src/components/widgets/HelpTabs.tsx
import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Locale } from '../../i18n/site';

type Localized = { zh: string; en: string };

export interface HelpEntry {
  name: Localized;
  detail?: Localized;
  contact?: string | Localized | null;
  source?: string | null;
}

export interface HelpRegion {
  label: Localized;
  help: HelpEntry[];
  fraud: HelpEntry[];
}

interface Tab { key: string; label: string }

interface Props {
  locale: Locale;
  /** data/helplines.json 的 regions，原样传入 */
  regions: Record<string, HelpRegion>;
  /** 标签组的无障碍名称（Ending.010） */
  label: string;
  /** 标签顺序与显示文字（Ending.011–014），"other" 放在最后 */
  labels: Tab[];
  /** contact 为 null 时右侧显示的说明（Ending.043） */
  noContact: string;
}

const text = (value: Localized | undefined, locale: Locale) => (value ? value[locale] : '');

const contactText = (contact: HelpEntry['contact'], locale: Locale, fallback: string) => {
  if (typeof contact === 'string') return contact;
  if (contact) return contact[locale];
  return fallback;
};

/**
 * “找专业的人聊聊”的地区标签页。只切换已经写好的数据，不计算任何概率或金额。
 * 中文页默认中国大陆，英文页默认美国；左右方向键切换标签。
 */
export default function HelpTabs({ locale, regions, label, labels, noContact }: Props) {
  const preferred = locale === 'zh' ? 'cn' : 'us';
  const first = labels.find((tab) => regions[tab.key])?.key ?? labels[0].key;
  const [active, setActive] = useState(labels.some((tab) => tab.key === preferred) ? preferred : first);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const index = labels.findIndex((tab) => tab.key === active);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % labels.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + labels.length) % labels.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = labels.length - 1;
    else return;
    event.preventDefault();
    const key = labels[next].key;
    setActive(key);
    tabRefs.current[key]?.focus();
  };

  return (
    <div class="ch-help">
      <div role="tablist" aria-label={label} class="ch-help-tabs" onKeyDown={onKeyDown}>
        {labels.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[tab.key] = el; }}
            type="button"
            role="tab"
            id={`ch-help-tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`ch-help-panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            class={active === tab.key ? 'is-active' : undefined}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {labels.map((tab) => {
        const region = regions[tab.key];
        const rows = region ? [...region.help, ...region.fraud] : [];
        return (
          <div
            key={tab.key}
            role="tabpanel"
            id={`ch-help-panel-${tab.key}`}
            aria-labelledby={`ch-help-tab-${tab.key}`}
            hidden={active !== tab.key}
            class={rows.length ? 'ch-help-panel' : 'ch-help-panel is-empty'}
          >
            {rows.map((entry, index) => {
              const words = contactText(entry.contact, locale, noContact).split(' ');
              return (
                <div class="ch-help-row" key={`${tab.key}-${index}`}>
                  <span class="ch-help-text">
                    <span class="ch-help-name">{text(entry.name, locale)}</span>
                    {entry.detail && <span class="ch-help-detail">{text(entry.detail, locale)}</span>}
                  </span>
                  <span class={entry.contact ? 'ch-help-contact' : 'ch-help-contact is-note'}>
                    {words.map((part, i) => (
                      <span key={i}>
                        <span class={/\d/.test(part) ? 'ch-help-word' : undefined}>{part}</span>
                        {i < words.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

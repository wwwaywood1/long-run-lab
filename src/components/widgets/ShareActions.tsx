// src/components/widgets/ShareActions.tsx
import { useEffect, useState } from 'preact/hooks';
import { SITE, SITE_URL, type Locale } from '../../i18n/site';

/** NEW COPY：JSON 里没有的按钮反馈与分享图按钮文字（待审定） */
export const SHARE_UI = {
  zh: {
    copied: '已复制',
    copyFailed: '复制失败，请手动复制地址',
    download: '下载图片',
    share: '分享',
  },
  en: {
    copied: 'Copied',
    copyFailed: 'Copy failed. Please copy the address manually.',
    download: 'Download image',
    share: 'Share',
  },
} as const;

/** 分享图尺寸：1080×1350，左右各留 96px；正文 76px / 行高 1.4 */
const POSTER = { width: 1080, height: 1350, pad: 96, lineHeight: 76 * 1.4 } as const;

/* Canvas 不能直接用 CSS 变量，颜色取 tokens.css 的同值（--ink-deep / --page / --highlight / --muted-on-dark / --soft-on-dark） */
const POSTER_COLORS = {
  bg: '#0E0F12',
  text: '#FFFFFF',
  highlight: '#FFE066',
  muted: '#9AA0AA',
  soft: '#C9CDD3',
} as const;

const POSTER_FONTS = {
  eyebrow: "600 30px 'IBM Plex Mono', monospace",
  headline: "900 76px 'Noto Serif SC', serif",
  name: "900 52px 'Noto Serif SC', serif",
  subtitle: "400 30px 'Noto Sans SC', sans-serif",
  url: "500 26px 'IBM Plex Mono', monospace",
} as const;

/** 把一行拆成可换行的片段：中文按字、英文按词，highlight 整体不拆开 */
function segments(line: string, highlight: string, locale: Locale): string[] {
  const parts = highlight && line.includes(highlight) ? line.split(highlight) : [line];
  return parts.flatMap((part, index) => {
    const text = locale === 'zh' ? Array.from(part) : part.split(/(\s+)/).filter(Boolean);
    return index === 0 ? text : [highlight, ...text];
  });
}

/** 按画布宽度折行；行首不留空格 */
function wrapLine(ctx: CanvasRenderingContext2D, text: string, highlight: string, locale: Locale): string[] {
  const maxWidth = POSTER.width - POSTER.pad * 2;
  const rows: string[] = [];
  let row = '';
  for (const token of segments(text, highlight, locale)) {
    if (!row && token.trim() === '') continue;
    const next = row + token;
    if (row && ctx.measureText(next).width > maxWidth) {
      rows.push(row.trimEnd());
      row = token.trimStart();
    } else {
      row = next;
    }
  }
  if (row.trim()) rows.push(row.trimEnd());
  return rows;
}

/** 在浏览器里画分享图，返回 PNG；不上传任何东西 */
async function createPoster(locale: Locale, lines: string[], highlight: string, eyebrow: string): Promise<Blob> {
  // 等衬线粗体下载完再画，避免字体还没下载就画成默认字体
  try {
    await document.fonts.load("900 76px 'Noto Serif SC'");
  } catch {
    // 字体加载失败时用系统衬线兜底
  }

  const canvas = document.createElement('canvas');
  canvas.width = POSTER.width;
  canvas.height = POSTER.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  ctx.fillStyle = POSTER_COLORS.bg;
  ctx.fillRect(0, 0, POSTER.width, POSTER.height);

  // 顶部眉标（Ending.029）
  ctx.textBaseline = 'top';
  ctx.font = POSTER_FONTS.eyebrow;
  ctx.fillStyle = POSTER_COLORS.muted;
  ctx.fillText(eyebrow, POSTER.pad, 150);

  // 结论句：先按 <br> 分好的行，再按画布宽度折行
  ctx.font = POSTER_FONTS.headline;
  const rows = lines.flatMap((line) => wrapLine(ctx, line, highlight, locale));
  const top = Math.max(300, (POSTER.height - rows.length * POSTER.lineHeight) / 2);

  rows.forEach((text, index) => {
    const y = top + index * POSTER.lineHeight;
    ctx.fillStyle = POSTER_COLORS.text;
    ctx.fillText(text, POSTER.pad, y);
    const at = highlight ? text.indexOf(highlight) : -1;
    if (at >= 0) {
      const offset = ctx.measureText(text.slice(0, at)).width;
      ctx.fillStyle = POSTER_COLORS.highlight;
      ctx.fillText(highlight, POSTER.pad + offset, y);
    }
  });

  // 底部：站名、副标题、网址
  const bottom = POSTER.height - POSTER.pad;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER_COLORS.text;
  ctx.font = POSTER_FONTS.name;
  ctx.fillText(SITE[locale].name, POSTER.pad, bottom - 90);
  ctx.fillStyle = POSTER_COLORS.soft;
  ctx.font = POSTER_FONTS.subtitle;
  ctx.fillText(SITE[locale].subtitle, POSTER.pad, bottom - 44);
  ctx.fillStyle = POSTER_COLORS.muted;
  ctx.font = POSTER_FONTS.url;
  ctx.fillText(SITE_URL.replace('https://', ''), POSTER.pad, bottom);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas.toBlob returned null');
  return blob;
}

interface Props {
  locale: Locale;
  labels: { copy: string; create: string };
  /** 结论句按 <br> 拆成的几行纯文字 */
  lines: string[];
  /** 结论句里的数字（来自 numbers.json），分享图里用荧光黄 */
  highlight: string;
  /** 分享图顶部眉标（Ending.029） */
  eyebrow: string;
}

type CopyState = 'idle' | 'done' | 'failed';

export default function ShareActions({ locale, labels, lines, highlight, eyebrow }: Props) {
  const ui = SHARE_UI[locale];
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (copyState !== 'done') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  const copy = async () => {
    setCopyState('idle');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(`${SITE_URL}${locale}/`);
      setCopyState('done');
    } catch {
      setCopyState('failed');
    }
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await createPoster(locale, lines, highlight, eyebrow);
      const file = new File([blob], `long-run-lab-${locale}.png`, { type: 'image/png' });
      setImage({ url: URL.createObjectURL(blob), file });
      setCanShare(navigator.canShare?.({ files: [file] }) === true);
    } catch {
      // 浏览器不支持画布时保持原状（不新增提示文案）
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `long-run-lab-${locale}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const share = async () => {
    if (!image) return;
    try {
      await navigator.share({ files: [image.file] });
    } catch {
      // 用户取消系统分享时不提示
    }
  };

  const copyLabel = copyState === 'done' ? ui.copied : copyState === 'failed' ? ui.copyFailed : labels.copy;
  const alt = lines.join(locale === 'zh' ? '' : ' ');

  return (
    <div class="end-share">
      <div class="end-actions">
        <button type="button" class="end-pill is-light" onClick={copy} aria-live="polite">
          {copyLabel}
        </button>
        <button type="button" class="end-pill is-outline" onClick={create} disabled={busy}>
          {labels.create}
        </button>
      </div>
      {image && (
        <div class="end-share-preview" aria-live="polite">
          <img class="end-share-image" src={image.url} width={1080} height={1350} alt={alt} />
          <div class="end-share-download">
            <button type="button" class="end-pill is-light" onClick={download}>{ui.download}</button>
            {canShare && (
              <button type="button" class="end-pill is-outline" onClick={share}>{ui.share}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

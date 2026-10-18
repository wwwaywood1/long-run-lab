// src/components/widgets/FalseAlarmGrid.tsx
import './detector.css';
import { useState } from 'preact/hooks';
import { defaultRng } from '../../engine/rng';
import { falseAlarmTables } from '../../engine/detector';

/** 页面传进来的文案（Research-Detector.029–033） */
export interface GridCopy { run: string; naive: string; naiveNote: string; e: string; eNote: string }

export const TABLES = 100;
export const ROUNDS = 1000;

export interface Props { copy: GridCopy }

export default function FalseAlarmGrid({ copy }: Props) {
  const [result, setResult] = useState<{ naive: boolean[]; e: boolean[] } | null>(null);
  const cells = (flags: boolean[] | undefined) => Array.from({ length: TABLES }, (_, i) => (
    <span class={`rd-square${flags?.[i] ? ' is-hit' : ''}`} />
  ));
  const group = (label: string, note: string, flags: boolean[] | undefined, key: string) => (
    <div class="rd-mc-cell" data-group={key}>
      <span class="rd-mc-label">{label}</span>
      <div class="rd-squares" aria-hidden="true">{cells(flags)}</div>
      <span class="rd-mc-count">{flags ? flags.filter(Boolean).length : '—'}</span>
      <span class="rd-mc-note">{note}</span>
    </div>
  );
  return (
    <div class="rd-mc">
      <button type="button" class="rd-run" onClick={() => setResult(falseAlarmTables(TABLES, ROUNDS, defaultRng))}>{copy.run}</button>
      <div class="rd-mc-grid" aria-live="polite">
        {group(copy.naive, copy.naiveNote, result?.naive, 'naive')}
        {group(copy.e, copy.eNote, result?.e, 'e')}
      </div>
    </div>
  );
}

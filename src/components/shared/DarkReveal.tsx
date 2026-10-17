import type { ComponentChildren } from 'preact';
import './shared.css';
interface Props { children?: ComponentChildren; labelledBy?: string; className?: string }
/** Static Astro use needs no hydration; interactive children may also use it. */
export default function DarkReveal({ children, labelledBy, className = '' }: Props) {
  return <section class={`reveal dark-reveal ${className}`} aria-labelledby={labelledBy}>{children}</section>;
}

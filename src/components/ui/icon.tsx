import type { SVGProps } from "react";

export type IconName = "arrow" | "check" | "chevron" | "clock" | "close" | "command" | "gear" | "mic" | "pause" | "pulse" | "search" | "spark" | "warning";

const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  clock: <><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></>,
  close: <><path d="m7 7 10 10"/><path d="m17 7-10 10"/></>,
  command: <><path d="M9 6h6"/><path d="M9 18h6"/><path d="M6 9v6"/><path d="M18 9v6"/></>,
  gear: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
  mic: <><rect x="9" y="4" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></>,
  pause: <><path d="M9 7v10"/><path d="M15 7v10"/></>,
  pulse: <path d="M3 12h4l2-5 4 10 2-5h6"/>,
  search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></>,
  spark: <><path d="m12 3 1.4 5.6L19 12l-5.6 1.4L12 19l-1.4-5.6L5 12l5.6-3.4Z"/></>,
  warning: <><path d="M12 4 3.5 19h17Z"/><path d="M12 9v4M12 16h.01"/></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

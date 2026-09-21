import { Icon, type IconName } from "@/components/ui/icon";
import type { ActivityItem as Activity } from "@/lib/shell/shell-types";

const statusIcon: Record<Activity["status"], IconName> = { queued: "clock", running: "pulse", complete: "check", failed: "warning" };

export function ActivityItem({ item }: { item: Activity }) {
  return <li className={`activity-item activity-${item.status}`}><span className="activity-icon"><Icon name={statusIcon[item.status]} /></span><span className="activity-copy"><strong>{item.system}</strong><span>{item.message}</span></span><small>{item.status}</small></li>;
}

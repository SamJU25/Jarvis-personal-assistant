import { ActivityItem } from "@/components/activity/activity-item";
import type { ActivityItem as Activity } from "@/lib/shell/shell-types";

export function ActivityList({ items }: { items: readonly Activity[] }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No recent activity</p>
      </div>
    );
  }
  return (
    <ul className="activity-list" aria-label="Activity history">
      {items.map((item) =>
        item.status === "complete" ? (
          <li key={item.id}>
            <details>
              <summary>
                {item.system}
                <span>complete</span>
              </summary>
              <div className="completed-detail">{item.message}</div>
            </details>
          </li>
        ) : (
          <ActivityItem key={item.id} item={item} />
        )
      )}
    </ul>
  );
}

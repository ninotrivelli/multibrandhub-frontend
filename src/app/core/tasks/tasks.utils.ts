import { StoreTaskPriority, StoreTaskResponse } from './tasks.types';

const PRIORITY_RANK: Record<StoreTaskPriority, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

// Mirrors the backend ordering for pending StoreTasks (priority desc, createdAt asc)
// so locally inserted tasks land where a refetch would place them.
export function sortPendingTasks(tasks: readonly StoreTaskResponse[]): StoreTaskResponse[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (byPriority !== 0) return byPriority;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

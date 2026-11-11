import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getUnreadCountApi } from '@/api/notificationsApi';
import { getUnreadMessagesApi } from '@/api/socialApi';

/** Polls a counter while the screen is focused (and refreshes on focus) */
function usePolledCount(fetcher: () => Promise<number>, intervalMs: number) {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const tick = () =>
        fetcher()
          .then((c) => active && setCount(c))
          .catch(() => {});
      tick();
      const t = setInterval(tick, intervalMs);
      return () => {
        active = false;
        clearInterval(t);
      };
    }, [fetcher, intervalMs])
  );

  return count;
}

/** Unread notifications count */
export function useUnreadCount() {
  return usePolledCount(getUnreadCountApi, 30000);
}

/** Unread direct messages count */
export function useUnreadMessages() {
  return usePolledCount(getUnreadMessagesApi, 15000);
}

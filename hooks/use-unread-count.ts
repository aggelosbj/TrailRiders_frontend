import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getUnreadCountApi } from '@/api/notificationsApi';

/** Unread notifications count, refreshed whenever the screen gets focus */
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUnreadCountApi()
        .then((c) => active && setCount(c))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  return count;
}

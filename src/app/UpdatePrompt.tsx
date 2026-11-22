import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../components/Toast';

/** Registers the service worker and offers to reload when a new version is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates when the app comes back to the foreground.
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast.show('È disponibile una nuova versione.', {
      actionLabel: 'Aggiorna',
      onAction: () => void updateServiceWorker(true),
      duration: 15000,
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}

import { Alert as RNAlert, Platform } from 'react-native';

/**
 * react-native-web's Alert.alert is `static alert() {}` — a complete no-op,
 * not a degraded fallback. Every `Alert.alert` call in this app (sign-in
 * gates, destructive-action confirmations, report/block reason pickers,
 * check-in visibility) silently did nothing on web. This is the drop-in
 * replacement: identical call shape, delegates straight to the real native
 * Alert off web, and on web renders through AlertHost (mounted once in
 * app/_layout.tsx) instead.
 */
export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';
export type AlertButton = { text: string; onPress?: () => void; style?: AlertButtonStyle };
export type AlertRequest = { title: string; message?: string; buttons: AlertButton[] };

type Listener = (req: AlertRequest | null) => void;
let listener: Listener | null = null;

/** Called once by AlertHost on mount/unmount. Not for direct use elsewhere. */
export function registerAlertHost(next: Listener | null) {
  listener = next;
}

export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, resolvedButtons);
    return;
  }
  if (!listener) {
    console.warn('AlertHost is not mounted; dropped alert:', title);
    return;
  }
  listener({ title, message, buttons: resolvedButtons });
}

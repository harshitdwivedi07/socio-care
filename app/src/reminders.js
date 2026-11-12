import { Platform } from 'react-native';

// Schedules on-device reminders: every medicine daily at its time, and each appointment 1 hour before.
// Does nothing on web (browsers cannot schedule background notifications reliably).
export async function syncReminders(meds, appts) {
  if (Platform.OS === 'web') return;
  try {
    const N = require('expo-notifications');
    const p = await N.requestPermissionsAsync();
    if (!p.granted) return;
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });
    await N.cancelAllScheduledNotificationsAsync();
    const T = N.SchedulableTriggerInputTypes || {};
    for (const m of meds) {
      const [hour, minute] = m.time_of_day.split(':').map(Number);
      await N.scheduleNotificationAsync({ content: { title: 'Medicine time', body: m.name }, trigger: { type: T.DAILY || 'daily', hour, minute } });
    }
    for (const a of appts) {
      const date = new Date(new Date(a.at).getTime() - 60 * 60 * 1000);
      if (date > new Date()) await N.scheduleNotificationAsync({ content: { title: 'Appointment in 1 hour', body: a.doctor }, trigger: { type: T.DATE || 'date', date } });
    }
  } catch {}
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export interface NotificationPreference {
  event_type: string;
  label: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

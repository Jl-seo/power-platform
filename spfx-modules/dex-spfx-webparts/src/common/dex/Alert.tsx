import * as React from 'react';

// Ported from DigitalExpertsConsulting/design-system components/alert/Alert.jsx

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ALERT_TONES: { [tone: string]: [string, string, string] } = {
  info: ['var(--brand-50)', 'var(--brand-700)', 'var(--brand-200)'],
  success: ['var(--success-100)', 'var(--success-700)', 'var(--success-200)'],
  warning: ['var(--warning-100)', 'var(--warning-700)', 'var(--warning-200)'],
  danger: ['var(--danger-100)', 'var(--danger-700)', 'var(--danger-200)']
};

export interface IAlertProps {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Alert: React.FC<IAlertProps> = ({ tone = 'info', title, children, style }) => {
  const [bg, fg, border] = ALERT_TONES[tone] || ALERT_TONES.info;
  return (
    <div style={{
      background: bg, border: '1px solid ' + border, borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-sans)', ...style
    }}>
      {title ? <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>{title}</div> : undefined}
      {children ? <div style={{ fontSize: 13, lineHeight: 1.6, color: fg }}>{children}</div> : undefined}
    </div>
  );
};

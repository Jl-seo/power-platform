const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export const formatDate = (iso: string): string => {
  const d: Date = new Date(iso);
  if (isNaN(d.getTime())) {
    return '';
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const formatDateTime = (iso: string): string => {
  const d: Date = new Date(iso);
  if (isNaN(d.getTime())) {
    return '';
  }
  return `${formatDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) {
    return '0 KB';
  }
  const kb: number = bytes / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} KB`;
  }
  const mb: number = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
};

export const isWithinDays = (iso: string, days: number): boolean => {
  const d: Date = new Date(iso);
  if (isNaN(d.getTime())) {
    return false;
  }
  return Date.now() - d.getTime() <= days * 24 * 60 * 60 * 1000;
};

// src/components/chat/DateSeparator.tsx
'use client';

interface DateSeparatorProps {
  date: Date;
}

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);
  
  // Reset time for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  
  const diffTime = today.getTime() - msgDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  }
  
  if (diffDays === 1) {
    return 'Yesterday';
  }
  
  if (diffDays < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[messageDate.getDay()];
  }
  
  // Format as "Month Day, Year" for older dates
  return messageDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] shadow-sm">
        <span className="text-xs text-[var(--text-secondary)] font-medium">
          {formatDateSeparator(date)}
        </span>
      </div>
    </div>
  );
}

export default DateSeparator;

// Helper function to check if two dates are on the same day
export function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

import { useRef, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { useFamilyContext } from '@/hooks/FamilyContext';
import { cn } from '@/lib/utils';
import UpdateButton from './UpdateButton';

interface HeaderProps {
  user: User;
  title: string;
  onSignOut: () => void;
}

export default function Header({ user, title, onSignOut }: HeaderProps) {
  const displayName = user.user_metadata?.full_name || user.email || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;
  const { members, activeMemberId, setActiveMemberId } = useFamilyContext();

  const showSwitcher = members.length >= 2;

  // Sliding indicator state
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const setButtonRef = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) {
      buttonRefs.current.set(key, el);
    } else {
      buttonRefs.current.delete(key);
    }
  }, []);

  // Update indicator position when active member changes
  useEffect(() => {
    if (!showSwitcher || !containerRef.current) return;

    const activeKey = activeMemberId;
    const activeBtn = buttonRefs.current.get(activeKey);
    const container = containerRef.current;

    if (activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setIndicatorStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [activeMemberId, showSwitcher, members]);

  return (
    <header className="drag-region h-12 flex items-center justify-between px-6 border-b border-[var(--color-border)]">
      <h2 className="no-drag text-[13px] font-semibold text-[var(--color-text)] tracking-tight">{title}</h2>
      <div className="no-drag flex items-center gap-4">
        {showSwitcher && (
          <div
            ref={containerRef}
            className="relative flex items-center bg-[var(--color-bg-sidebar)] rounded-lg p-0.5"
          >
            {/* Sliding indicator */}
            <div
              className="absolute top-0.5 bottom-0.5 bg-white rounded-md shadow-[var(--shadow-sm)] transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
            />
            <button
              ref={(el) => setButtonRef('all', el)}
              type="button"
              onClick={() => setActiveMemberId('all')}
              className={cn(
                'relative z-10 px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer transition-colors duration-200',
                activeMemberId === 'all'
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              )}
            >
              All
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                ref={(el) => setButtonRef(member.id, el)}
                type="button"
                onClick={() => setActiveMemberId(member.id)}
                className={cn(
                  'relative z-10 px-3 py-1 rounded-md text-[12px] font-medium cursor-pointer transition-colors duration-200',
                  activeMemberId === member.id
                    ? 'text-[var(--color-text)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
                )}
              >
                {member.name}
              </button>
            ))}
          </div>
        )}
        <UpdateButton />
        <div className="flex items-center gap-2.5">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              className="w-6 h-6 rounded-full ring-1 ring-[var(--color-border)]"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="text-xs text-[var(--color-text-muted)] font-medium">{displayName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-200 cursor-pointer font-medium"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

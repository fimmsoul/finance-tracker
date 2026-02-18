import { User } from '@supabase/supabase-js';
import UpdateButton from './UpdateButton';

interface HeaderProps {
  user: User;
  title: string;
  onSignOut: () => void;
}

export default function Header({ user, title, onSignOut }: HeaderProps) {
  const displayName = user.user_metadata?.full_name || user.email || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <header className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-100">
      <h2 className="no-drag text-sm font-medium text-gray-800">{title}</h2>
      <div className="no-drag flex items-center gap-3">
        <UpdateButton />
        <span className="text-xs text-gray-400">{displayName}</span>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt=""
            className="w-6 h-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        )}
        <button
          onClick={onSignOut}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

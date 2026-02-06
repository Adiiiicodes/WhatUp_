// src/components/profile/ProfileModal.tsx
'use client';

import { useState } from 'react';
import { 
  FiX, 
  FiUser, 
  FiLock, 
  FiMessageSquare, 
  FiBell, 
  FiHardDrive, 
  FiHelpCircle,
  FiChevronRight,
  FiEdit2,
  FiCamera,
  FiLogOut
} from 'react-icons/fi';
import type { User } from '@/types/chat';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLogout: () => void;
}

interface SettingsItem {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  danger?: boolean;
}

export function ProfileModal({ 
  isOpen, 
  onClose, 
  user, 
  onLogout
}: ProfileModalProps) {
  const [activeSection, setActiveSection] = useState<'main' | 'account' | 'privacy' | 'chat' | 'notifications' | 'storage' | 'help'>('main');

  if (!isOpen) return null;

  const settingsItems: SettingsItem[] = [
    {
      icon: <FiUser size={20} />,
      label: 'Account',
      subtitle: 'Privacy, security, change number',
      onClick: () => setActiveSection('account'),
    },
    {
      icon: <FiLock size={20} />,
      label: 'Privacy',
      subtitle: 'Last seen, profile photo, about',
      onClick: () => setActiveSection('privacy'),
    },
    {
      icon: <FiMessageSquare size={20} />,
      label: 'Chats',
      subtitle: 'Theme, wallpapers, chat history',
      onClick: () => setActiveSection('chat'),
    },
    {
      icon: <FiBell size={20} />,
      label: 'Notifications',
      subtitle: 'Message, group & call tones',
      onClick: () => setActiveSection('notifications'),
    },
    {
      icon: <FiHardDrive size={20} />,
      label: 'Storage and Data',
      subtitle: 'Network usage, auto-download',
      onClick: () => setActiveSection('storage'),
    },
    {
      icon: <FiHelpCircle size={20} />,
      label: 'Help',
      subtitle: 'Help center, contact us, privacy policy',
      onClick: () => setActiveSection('help'),
    },
  ];

  const renderMainSection = () => (
    <>
      {/* Profile Header */}
      <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-[#006a5c] px-6 py-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-white"
        >
          <FiX size={24} />
        </button>

        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-3xl font-semibold">
              {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors">
              <FiCamera size={16} className="text-[var(--accent-primary)]" />
            </button>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-white truncate">
                {user.name || 'Unknown'}
              </h2>
              <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <FiEdit2 size={16} className="text-white/80" />
              </button>
            </div>
            <p className="text-sm text-white/70 truncate">{user.email}</p>
            <div className="flex items-center gap-1 mt-1">
              <div className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-400' : 'bg-gray-400'}`} />
              <span className="text-xs text-white/60 capitalize">{user.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Items */}
      <div className="px-4 py-2">
        {settingsItems.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--accent-primary)]">
              {item.icon}
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-[var(--text-primary)]">{item.label}</div>
              {item.subtitle && (
                <div className="text-xs text-[var(--text-secondary)]">{item.subtitle}</div>
              )}
            </div>
            <FiChevronRight size={20} className="text-[var(--text-tertiary)]" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <div className="px-4 py-4 border-t border-[var(--border-primary)]">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 p-4 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors text-red-500"
        >
          <FiLogOut size={20} />
          <span className="font-medium">Log out</span>
        </button>
      </div>

      {/* App Version */}
      <div className="text-center pb-6 text-xs text-[var(--text-tertiary)]">
        WhatUp Web v1.0.0
      </div>
    </>
  );

  const renderSubSection = (title: string, content: React.ReactNode) => (
    <>
      <div className="flex items-center gap-4 px-4 py-4 border-b border-[var(--border-primary)]">
        <button
          onClick={() => setActiveSection('main')}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors"
        >
          <FiChevronRight size={20} className="text-[var(--text-secondary)] rotate-180" />
        </button>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {content}
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return renderSubSection('Account', (
          <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Account settings will be available here.</p>
            <p className="text-sm">• Change email</p>
            <p className="text-sm">• Change password</p>
            <p className="text-sm">• Two-factor authentication</p>
            <p className="text-sm">• Delete account</p>
          </div>
        ));
      case 'privacy':
        return renderSubSection('Privacy', (
          <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Privacy settings will be available here.</p>
            <p className="text-sm">• Last seen & online</p>
            <p className="text-sm">• Profile photo</p>
            <p className="text-sm">• Read receipts</p>
            <p className="text-sm">• Blocked contacts</p>
          </div>
        ));
      case 'chat':
        return renderSubSection('Chats', (
          <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Chat settings will be available here.</p>
            <p className="text-sm">• Theme (Light/Dark)</p>
            <p className="text-sm">• Chat wallpaper</p>
            <p className="text-sm">• Font size</p>
            <p className="text-sm">• Chat backup</p>
          </div>
        ));
      case 'notifications':
        return renderSubSection('Notifications', (
          <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Notification settings will be available here.</p>
            <p className="text-sm">• Message notifications</p>
            <p className="text-sm">• Show previews</p>
            <p className="text-sm">• Notification tone</p>
            <p className="text-sm">• Vibrate</p>
          </div>
        ));
      case 'storage':
        return renderSubSection('Storage and Data', (
          <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Storage settings will be available here.</p>
            <p className="text-sm">• Manage storage</p>
            <p className="text-sm">• Network usage</p>
            <p className="text-sm">• Media auto-download</p>
            <p className="text-sm">• Clear cache</p>
          </div>
        ));
      case 'help':
        return renderSubSection('Help', (
          <div className="space-y-4 text-[var(--text-secondary)]">
            <p>Help options will be available here.</p>
            <p className="text-sm">• Help center</p>
            <p className="text-sm">• Contact us</p>
            <p className="text-sm">• Privacy policy</p>
            <p className="text-sm">• Terms of service</p>
          </div>
        ));
      default:
        return renderMainSection();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {renderContent()}
      </div>
    </div>
  );
}

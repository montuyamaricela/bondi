'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Heart, MessageCircle, Compass, ThumbsUp } from 'lucide-react';
import { NotificationCenter } from '@/app/components/ui/custom/notifications/NotificationCenter';
import { ProfileMenu } from './ProfileMenu';

export function MainNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/discover',
      label: 'Discover',
      icon: Compass,
    },
    {
      href: '/likes',
      label: 'Likes',
      icon: ThumbsUp,
    },
    {
      href: '/matches',
      label: 'Matches',
      icon: Heart,
    },
    {
      href: '/messages',
      label: 'Messages',
      icon: MessageCircle,
    },
  ];

  return (
    <nav className="border-b border-border-main/80 bg-bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-2xl font-bold text-secondary-text transition-colors dark:text-primary-text"
            >
              Bondi
            </Link>
            <div className="hidden space-x-1 md:flex">
              {navItems.map((item) => {
                const Icon = item?.icon || null;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-primary-main text-primary-main dark:border-primary-text dark:text-primary-text'
                        : 'border-transparent text-text-body hover:text-primary-main hover:[&_svg]:text-primary-main',
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center">
            <NotificationCenter />
            <ProfileMenu />
          </div>
        </div>

        <div className="flex justify-around border-t border-border-main py-2 md:hidden">
          {navItems.map((item) => {
            const Icon = item?.icon || null;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center space-y-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary-main/10 text-primary-main'
                    : 'text-text-muted hover:text-primary-main hover:[&_svg]:text-primary-main',
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

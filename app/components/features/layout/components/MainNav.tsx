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
    <nav className='bg-bg-card border-b border-border-main/80'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          <div className='flex items-center space-x-8'>
            <Link
              href='/'
              className='text-2xl font-bold text-secondary-text dark:text-primary-text transition-colors'
            >
              Bondi
            </Link>
            <div className='hidden md:flex space-x-1'>
              {navItems.map((item) => {
                const Icon = item?.icon || null;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors border-b-2',
                      isActive
                        ? 'text-primary-main border-primary-main'
                        : 'text-text-body hover:text-primary-main hover:[&_svg]:text-primary-main border-transparent'
                    )}
                  >
                    {Icon && <Icon className='h-4 w-4' />}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className='flex items-center'>
            <NotificationCenter />
            <ProfileMenu />
          </div>
        </div>

        <div className='md:hidden flex justify-around border-t border-border-main py-2'>
          {navItems.map((item) => {
            const Icon = item?.icon || null;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center space-y-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary-main bg-primary-main/10'
                    : 'text-text-muted hover:text-primary-main hover:[&_svg]:text-primary-main'
                )}
              >
                {Icon && <Icon className='h-5 w-5' />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

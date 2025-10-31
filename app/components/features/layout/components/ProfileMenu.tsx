'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { useProfileWithPhotosQuery } from '@/lib/client/profile';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/app/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { User, Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getInitials } from '@/lib/utils/initials';

export function ProfileMenu() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: profileData, isPending: profileLoading } =
    useProfileWithPhotosQuery(!!session?.user);
  const router = useRouter();

  if (sessionLoading || profileLoading) {
    return (
      <div className='flex items-center space-x-3'>
        <div className='h-10 w-10 rounded-full bg-primary-main/10 animate-pulse' />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const profile = profileData?.profile;
  const profilePicture = profile?.photos?.[0]?.url;

  const userInitials = getInitials(user.name || user.email || 'User');

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='flex items-center outline-none focus:outline-none'>
        <div className='flex items-center space-x-3 cursor-pointer rounded-lg p-1 md:px-3 md:py-2 transition-colors group'>
          <Avatar className='h-10 w-10'>
            <AvatarImage
              src={profilePicture || user.image || undefined}
              alt={user.name || 'User'}
            />
            <AvatarFallback className='bg-primary-main text-primary-text'>
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className='hidden md:flex flex-col items-end'>
            <span className='text-sm font-medium text-text-heading group-hover:text-primary-main'>
              {user.name || user.email}
            </span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-medium'>{user.name || 'User'}</p>
            <p className='text-xs text-text-muted'>{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/profile')}
          className='cursor-pointer'
        >
          <User className='mr-2 h-4 w-4' />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push('/settings')}
          className='cursor-pointer'
        >
          <Settings className='mr-2 h-4 w-4' />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className='cursor-pointer text-error'
        >
          <LogOut className='mr-2 h-4 w-4' />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

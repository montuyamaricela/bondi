'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function LandingNav() {
  const [currentSection, setCurrentSection] = useState<
    'dark' | 'light' | 'transparent'
  >('transparent');

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('#hero');
      const navHeight = 80;

      let foundSection: 'dark' | 'light' | 'transparent' = 'light';

      if (heroSection) {
        const heroRect = heroSection.getBoundingClientRect();
        if (heroRect.bottom > navHeight) {
          foundSection = 'transparent';
          setCurrentSection(foundSection);
          return;
        }
      }

      const sections = document.querySelectorAll('section');
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= navHeight && rect.bottom > navHeight) {
          const isDark = section.classList.contains('bg-[#1A1A1A]');
          foundSection = isDark ? 'dark' : 'light';
        }
      });

      setCurrentSection(foundSection);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      const navHeight = 80;
      const elementPosition =
        element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const navLinks = [
    { href: '#mission', label: 'Mission' },
    { href: '#about', label: 'About' },
  ];

  const rightNavLinks = [
    { href: '#labs', label: 'Labs' },
    { href: '#how-it-works', label: 'How it works' },
  ];

  const getNavStyles = () => {
    switch (currentSection) {
      case 'transparent':
        return {
          bg: 'bg-transparent',
          text: 'text-white',
          hover: 'hover:text-primary-main',
        };
      case 'dark':
        return {
          bg: 'bg-[#1A1A1A]',
          text: 'text-white',
          hover: 'hover:text-primary-main',
        };
      case 'light':
        return {
          bg: 'bg-white',
          text: 'text-gray-900',
          hover: 'hover:text-primary-main',
        };
    }
  };

  const styles = getNavStyles();

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-colors duration-300 ${styles.bg}`}
    >
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex h-20 items-center justify-between'>
          {/* Left navigation */}
          <div className='hidden items-center gap-8 lg:flex'>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`text-base font-medium transition-colors ${styles.text} ${styles.hover}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Logo */}
          <Link
            href='/'
            className={`text-2xl font-bold transition-colors ${styles.text}`}
          >
            Bondi
          </Link>

          {/* Right navigation */}
          <div className='hidden items-center gap-8 lg:flex'>
            {rightNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`text-base font-medium transition-colors ${styles.text} ${styles.hover}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

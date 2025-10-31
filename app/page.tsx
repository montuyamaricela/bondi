import { LandingNav } from '@/app/components/features/layout/components/LandingNav';
import { HeroSection } from '@/app/components/features/landing/components/HeroSection';
import { OurApproachSection } from '@/app/components/features/landing/components/OurApproachSection';
import { AboutUsSection } from '@/app/components/features/landing/components/AboutUsSection';
import { SmartMatchingSection } from '@/app/components/features/landing/components/SmartMatchingSection';
import { HowItWorksSection } from '@/app/components/features/landing/components/HowItWorksSection';

export default function Home() {
  return (
    <div className='min-h-screen bg-white'>
      <LandingNav />
      <HeroSection />
      <OurApproachSection />
      <AboutUsSection />
      <SmartMatchingSection />
      <HowItWorksSection />
    </div>
  );
}

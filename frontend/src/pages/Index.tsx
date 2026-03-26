import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import HowItWorks from "@/components/landing/HowItWorks";
import WhyItMatters from "@/components/landing/WhyItMatters";
import SupportedTokens from "@/components/landing/SupportedTokens";
import LandingFooter from "@/components/landing/LandingFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <HowItWorks />
      <WhyItMatters />
      <SupportedTokens />
      <LandingFooter />
    </div>
  );
};

export default Index;

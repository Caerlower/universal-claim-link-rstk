import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import AppNav from "@/components/app/AppNav";
import CreateClaim from "@/components/app/CreateClaim";
import ClaimFunds from "@/components/app/ClaimFunds";
import Receipts from "@/components/app/Receipts";

type Tab = "create" | "claim" | "receipts";

const AppPage = () => {
  const [params] = useSearchParams();
  const queryTab = params.get("tab");
  const queryClaimId = params.get("id");
  const initialTab = queryTab === "claim" ? "claim" : queryTab === "receipts" ? "receipts" : "create";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const currentTab = activeTab;

  const tabs: { id: Tab; label: string }[] = [
    { id: "create", label: "Create Claim" },
    { id: "claim", label: "Claim Funds" },
    { id: "receipts", label: "Receipts" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Segmented control */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex glass rounded-2xl p-1.5 gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    currentTab === tab.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {currentTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary rounded-xl"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {currentTab === "create" && <CreateClaim />}
            {currentTab === "claim" && <ClaimFunds initialClaimId={queryClaimId} />}
            {currentTab === "receipts" && <Receipts />}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default AppPage;

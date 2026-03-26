import { motion } from "framer-motion";
import { Link2, Share2, Wallet } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "Create a Claim",
    description: "Select a token, set the amount, and generate a secure escrow-backed claim link.",
  },
  {
    icon: Share2,
    title: "Share the Link",
    description: "Send the link to anyone — via chat, email, QR code. No wallet coordination needed.",
  },
  {
    icon: Wallet,
    title: "Receiver Claims",
    description: "The recipient chooses their preferred token and claims the funds on-chain.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="tracking-label text-primary mb-4 block">How It Works</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient">Three Simple Steps</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <div className="group glass rounded-2xl p-8 h-full hover:border-primary/30 transition-all duration-300 hover:shadow-card">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm font-bold text-primary/60 mb-2">0{i + 1}</div>
                <h3 className="text-lg font-semibold mb-3 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

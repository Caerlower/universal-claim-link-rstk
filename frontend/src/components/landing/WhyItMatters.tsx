import { motion } from "framer-motion";
import { Shield, Zap, Receipt, Globe } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "No Token Coordination",
    description: "Senders don't need to know what token the receiver wants. Just send — they'll choose.",
  },
  {
    icon: Globe,
    title: "Receiver-Driven UX",
    description: "Recipients pick their preferred token at claim time, powered by on-chain swaps.",
  },
  {
    icon: Shield,
    title: "On-Chain Escrow",
    description: "Funds are securely held in smart contract escrow until claimed or expired.",
  },
  {
    icon: Receipt,
    title: "Rootstock-Native",
    description: "A payment primitive built for the Rootstock ecosystem — fast, secure, Bitcoin-backed.",
  },
];

const WhyItMatters = () => {
  return (
    <section className="pt-24 pb-14 md:pt-28 md:pb-16 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent -z-10" />
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="tracking-label text-primary mb-4 block">Why It Matters</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient">A Better Way to Transfer Value</h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group flex gap-5 glass rounded-2xl p-6 hover:border-primary/20 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyItMatters;

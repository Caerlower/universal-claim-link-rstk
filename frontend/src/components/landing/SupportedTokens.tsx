import { motion } from "framer-motion";

const tokens = [
  {
    symbol: "RBTC",
    name: "Rootstock BTC",
    logoUrl:
      "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rootstock-orange.png",
  },
  {
    symbol: "RIF",
    name: "RIF Token",
    logoUrl: "https://raw.githubusercontent.com/rsksmart/rsk-contract-metadata/refs/heads/master/images/rif.png",
  },
  { symbol: "USDRIF", name: "USD on RIF", logoUrl: "/usdrif.svg" },
];

const SupportedTokens = () => {
  return (
    <section className="pt-12 pb-20 md:pt-14 md:pb-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="tracking-label text-primary mb-4 block">Ecosystem</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient mb-12">Supported Tokens</h2>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4">
          {tokens.map((token, i) => (
            <motion.div
              key={token.symbol}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="glass rounded-2xl px-8 py-5 flex items-center gap-4 hover:border-primary/20 transition-all duration-300 cursor-default"
            >
              <div className="w-10 h-10 rounded-full bg-muted/40 border border-border/60 flex items-center justify-center overflow-hidden">
                <img src={token.logoUrl} alt={token.symbol} className="h-8 w-8 object-contain" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm text-foreground">{token.symbol}</div>
                <div className="text-xs text-muted-foreground">{token.name}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SupportedTokens;

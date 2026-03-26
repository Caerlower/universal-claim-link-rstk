import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export type ClaimRecord = {
  claim_id: string;
  chain_id: number;
  sender: string;
  receiver: string;
  token_in_symbol: string;
  token_out_symbol: string | null;
  amount_in_wei: string;
  amount_out_wei: string | null;
  claim_link: string;
  status: "open" | "executed" | "cancelled";
  expiry_ts: string;
  created_tx_hash: string | null;
  executed_tx_hash: string | null;
  cancelled_tx_hash: string | null;
  executed_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function upsertClaimCreated(input: {
  claimId: string;
  chainId: number;
  sender: string;
  receiver: string;
  tokenInSymbol: string;
  amountInWei: string;
  expiryTs: string;
  claimLink: string;
  createdTxHash?: string;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const payload = {
    claim_id: input.claimId,
    chain_id: input.chainId,
    sender: input.sender.toLowerCase(),
    receiver: input.receiver.toLowerCase(),
    token_in_symbol: input.tokenInSymbol,
    amount_in_wei: input.amountInWei,
    expiry_ts: input.expiryTs,
    claim_link: input.claimLink,
    status: "open",
    created_tx_hash: input.createdTxHash ?? null,
  };
  const { error } = await supabase.from("claim_links").upsert(payload, { onConflict: "claim_id,chain_id" });
  if (error) throw error;
}

export async function markClaimExecuted(input: {
  claimId: string;
  chainId: number;
  tokenOutSymbol: string;
  amountOutWei: string;
  executedBy: string;
  executedTxHash?: string;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("claim_links")
    .update({
      status: "executed",
      token_out_symbol: input.tokenOutSymbol,
      amount_out_wei: input.amountOutWei,
      executed_by: input.executedBy.toLowerCase(),
      executed_tx_hash: input.executedTxHash ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("claim_id", input.claimId)
    .eq("chain_id", input.chainId);
  if (error) throw error;
}

export async function markClaimCancelled(input: {
  claimId: string;
  chainId: number;
  cancelledTxHash?: string;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("claim_links")
    .update({
      status: "cancelled",
      cancelled_tx_hash: input.cancelledTxHash ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("claim_id", input.claimId)
    .eq("chain_id", input.chainId);
  if (error) throw error;
}

export async function fetchClaimsForAddress(address: string, chainId: number): Promise<ClaimRecord[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const addr = address.toLowerCase();
  const { data, error } = await supabase
    .from("claim_links")
    .select("*")
    .eq("chain_id", chainId)
    .or(`sender.eq.${addr},receiver.eq.${addr}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClaimRecord[];
}


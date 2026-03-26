create table if not exists public.claim_links (
  claim_id text not null,
  chain_id integer not null,
  sender text not null,
  receiver text not null,
  token_in_symbol text not null,
  token_out_symbol text,
  amount_in_wei text not null,
  amount_out_wei text,
  claim_link text not null,
  status text not null default 'open' check (status in ('open', 'executed', 'cancelled')),
  expiry_ts text not null,
  created_tx_hash text,
  executed_tx_hash text,
  cancelled_tx_hash text,
  executed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (claim_id, chain_id)
);

-- If the table already exists from a previous deployment, ensure the column exists too.
alter table public.claim_links
  add column if not exists cancelled_tx_hash text;

create index if not exists claim_links_sender_idx on public.claim_links (sender);
create index if not exists claim_links_receiver_idx on public.claim_links (receiver);
create index if not exists claim_links_created_at_idx on public.claim_links (created_at desc);

alter table public.claim_links enable row level security;

drop policy if exists "claim_links_read_all" on public.claim_links;
create policy "claim_links_read_all"
on public.claim_links
for select
using (true);

drop policy if exists "claim_links_insert_all" on public.claim_links;
create policy "claim_links_insert_all"
on public.claim_links
for insert
with check (true);

drop policy if exists "claim_links_update_all" on public.claim_links;
create policy "claim_links_update_all"
on public.claim_links
for update
using (true)
with check (true);

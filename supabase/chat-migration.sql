-- Run this only if you already ran schema.sql before the chat update.
alter table public.messages add column if not exists conversation_key text not null default 'default';
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists sender_role text check (sender_role in ('farmer', 'buyer'));

-- Lets the demo receive new messages without a page refresh when Realtime is enabled.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

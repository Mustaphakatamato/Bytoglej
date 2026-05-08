-- Allow deleting conversations and messages (needed for permanent delete feature)
create policy "Public delete conversations" on conversations for delete using (true);
create policy "Public delete chat_messages" on chat_messages for delete using (true);

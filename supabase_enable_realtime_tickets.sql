begin;
  -- Add the table to the realtime publication
  alter publication supabase_realtime add table service_tickets;
commit;

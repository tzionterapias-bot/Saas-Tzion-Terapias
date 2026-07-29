insert into storage.buckets (id, name, public) 
values ('products', 'products', true) 
on conflict (id) do nothing;

create policy "Public Access" 
on storage.objects for select 
using ( bucket_id = 'products' );

create policy "Auth Insert" 
on storage.objects for insert 
with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

create policy "Auth Update" 
on storage.objects for update 
using ( bucket_id = 'products' and auth.role() = 'authenticated' );

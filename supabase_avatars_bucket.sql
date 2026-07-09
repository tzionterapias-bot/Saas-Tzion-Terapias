-- Create avatars bucket if it doesn't exist (already created, but good to have)
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Drop existing policies if any to avoid errors
drop policy if exists "Public Access avatars" on storage.objects;
drop policy if exists "Allow authenticated uploads avatars" on storage.objects;
drop policy if exists "Allow authenticated updates avatars" on storage.objects;
drop policy if exists "Allow authenticated deletes avatars" on storage.objects;

-- Allow public read access
create policy "Public Access avatars" 
  on storage.objects for select 
  using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload files
create policy "Allow authenticated uploads avatars" 
  on storage.objects for insert 
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- Allow users to update files
create policy "Allow authenticated updates avatars" 
  on storage.objects for update 
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- Allow users to delete files
create policy "Allow authenticated deletes avatars" 
  on storage.objects for delete 
  using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- Reduce the maximum stored shared Studio project/revision size to 25 MiB.
update storage.buckets
set file_size_limit = 26214400
where id = 'studio-shared';

-- Enable required extensions for scheduled edge function calls
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule daily-snapshot edge function to run every day at 00:05 UTC
-- (5 minutes past midnight to avoid exact-midnight load spikes)
select cron.schedule(
  'daily-asset-snapshot',          -- job name
  '5 0 * * *',                     -- cron expression: 00:05 UTC every day
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/daily-snapshot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

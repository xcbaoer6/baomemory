import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const clients = new Map<string, SupabaseClient>();

/** One stateless service-role client per project, shared by every repository in the isolate. */
export const createSupabase = ({
  url,
  serviceKey,
}: {
  readonly url: string;
  readonly serviceKey: string;
}) => {
  const key = `${url}\u0000${serviceKey}`;
  let client = clients.get(key);
  if (!client) {
    client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.set(key, client);
  }
  return client;
};

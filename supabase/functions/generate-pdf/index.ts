import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async () => Response.json(
    { error: 'This legacy function is disabled. Use the authenticated application PDF renderer.' },
    { status: 410 },
  )),
};

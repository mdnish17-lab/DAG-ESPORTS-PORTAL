import { createBrowserClient } from '@supabase/ssr';

// Shared by public pages and the Admin interface.
// Cookie-based auth lets server-rendered /admin see the same signed-in user.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

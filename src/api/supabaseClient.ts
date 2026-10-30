import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ovczyvwkvujpxmimgwcd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92Y3p5dndrdnVqcHhtaW1nd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMTU2NTQsImV4cCI6MjEwODg5MTY1NH0.deI1YG_85Pd0SQ6vspU54SRlDAMGkltqPi-L7seMCLo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

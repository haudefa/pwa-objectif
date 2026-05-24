// supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://bhxleyufbnmodrtvuube.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoeGxleXVmYm5tb2RydHZ1dWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MDYzNzMsImV4cCI6MjA1OTA4MjM3M30.Y3w1pg6Te9RblajnnK_zorAdbrfMEuRl720AWKOmbAU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

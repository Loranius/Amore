// ============================================================
// SUPABASE CLIENT (ES-модуль)
// ============================================================
// supabase-js підключається як CDN-бандл і живе на window.supabase
// (глобаль від CDN — її ми не чіпаємо). Тут ми лише створюємо клієнт
// і ЕКСПОРТУЄМО його як `supabase`, щоб решта модулів імпортувала явно:
//   import { supabase } from '../lib/supabase.js';
const SUPABASE_URL = 'https://yicalgoqegluzuagxssk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpY2FsZ29xZWdsdXp1YWd4c3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MDg0NTgsImV4cCI6MjA5NzA4NDQ1OH0.VhF_C0M4QZWKxcpqxxs0zbJxnrzKGLc1DKT1awMVJAE';

// @ts-ignore — supabase-js приходить із CDN, типів немає
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

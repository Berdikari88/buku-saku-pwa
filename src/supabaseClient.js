import { createClient } from '@supabase/supabase-js'

// 1. URL sudah aku perbaiki, tidak pakai /rest/v1/ lagi
const supabaseUrl = 'https://tuymrzmiyxlcvtqjbujn.supabase.co'

// 2. TUGASMU: Ganti teks di bawah ini dengan API KEY PANJANG yang berawalan eyJhb...
const supabaseAnonKey = 'sb_publishable_Bx0q7FQ8S2KjWVN9bh-J8A_K8MSrFKS'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://emizrtzdebbtsipzexyt.supabase.co"
const supabaseAnonKey = "sb_publishable_o_MN8MKNbq7MjBOdOZVWPA_9UKgO47v"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

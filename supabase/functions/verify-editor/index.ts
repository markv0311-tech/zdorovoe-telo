import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client (no Authorization header needed for public access)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { initDataRaw } = await req.json()

    if (!initDataRaw) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No initData provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse Telegram initData
    const urlParams = new URLSearchParams(initDataRaw)
    const userParam = urlParams.get('user')
    
    if (!userParam) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No user data in initData' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userData = JSON.parse(userParam)
    const telegramUserId = userData.id

    console.log('Verifying editor for Telegram user ID:', telegramUserId)

    // Check if user is in editors table
    const { data: editorData, error: editorError } = await supabaseClient
      .from('editors')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single()

    if (editorError && editorError.code !== 'PGRST116') {
      console.error('Database error:', editorError)
      return new Response(
        JSON.stringify({ ok: false, error: 'Database error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const isEditor = !!editorData

    console.log('Editor verification result:', { telegramUserId, isEditor })

    return new Response(
      JSON.stringify({ 
        ok: true, 
        is_editor: isEditor,
        tg_user_id: telegramUserId,
        user_data: userData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in verify-editor function:', error)
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

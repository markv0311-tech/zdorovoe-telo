import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Telegram WebApp verification
async function verifyTelegramEditor(initDataRaw: string): Promise<{ ok: boolean; telegram_user_id?: number; error?: string }> {
  try {
    if (!initDataRaw) {
      return { ok: false, error: 'No initData provided' }
    }

    // Parse initData to get user info
    const urlParams = new URLSearchParams(initDataRaw)
    const userParam = urlParams.get('user')
    
    if (!userParam) {
      return { ok: false, error: 'No user data in initData' }
    }

    const userData = JSON.parse(userParam)
    const telegramUserId = userData.id

    // Create Supabase client with service role for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if user is in editors table
    const { data: editorData, error: editorError } = await supabaseClient
      .from('editors')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single()

    if (editorError && editorError.code !== 'PGRST116') {
      console.error('Database error:', editorError)
      return { ok: false, error: 'Database error' }
    }

    if (!editorData) {
      return { ok: false, error: 'Not authorized as editor' }
    }

    return { ok: true, telegram_user_id: telegramUserId }

  } catch (error) {
    console.error('Error verifying Telegram editor:', error)
    return { ok: false, error: 'Verification failed' }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // Parse request body
    const { initDataRaw, payload } = await req.json()

    // Verify Telegram editor access
    const verification = await verifyTelegramEditor(initDataRaw)
    if (!verification.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: verification.error }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let result: any = null

    // Route handling
    if (method === 'POST' && path === '/programs') {
      // Create new program
      const { data, error } = await supabaseClient
        .from('programs')
        .insert([payload])
        .select()
        .single()

      if (error) throw error
      result = data

    } else if (method === 'PUT' && path.startsWith('/programs/')) {
      // Update program
      const programId = path.split('/')[2]
      const { data, error } = await supabaseClient
        .from('programs')
        .update(payload)
        .eq('id', programId)
        .select()
        .single()

      if (error) throw error
      result = data

    } else if (method === 'DELETE' && path.startsWith('/programs/')) {
      // Delete program
      const programId = path.split('/')[2]
      const { error } = await supabaseClient
        .from('programs')
        .delete()
        .eq('id', programId)

      if (error) throw error
      result = { deleted: true, id: programId }

    } else if (method === 'POST' && path.includes('/programs/') && path.endsWith('/days')) {
      // Add day to program
      const programId = path.split('/')[2]
      
      // Get next day_index if not provided
      let dayIndex = payload.day_index
      if (!dayIndex) {
        const { data: maxDay } = await supabaseClient
          .from('program_days')
          .select('day_index')
          .eq('program_id', programId)
          .order('day_index', { ascending: false })
          .limit(1)
          .single()
        
        dayIndex = (maxDay?.day_index || 0) + 1
      }

      const dayPayload = {
        program_id: programId,
        day_index: dayIndex,
        title: payload.title || `День ${dayIndex}`,
        description: payload.description || ''
      }

      const { data, error } = await supabaseClient
        .from('program_days')
        .insert([dayPayload])
        .select()
        .single()

      if (error) throw error
      result = data

    } else if (method === 'POST' && path.includes('/days/') && path.endsWith('/exercises')) {
      // Add exercise to day
      const dayId = path.split('/')[2]
      
      // Get next order_index if not provided
      let orderIndex = payload.order_index
      if (!orderIndex) {
        const { data: maxExercise } = await supabaseClient
          .from('exercises')
          .select('order_index')
          .eq('program_day_id', dayId)
          .order('order_index', { ascending: false })
          .limit(1)
          .single()
        
        orderIndex = (maxExercise?.order_index || 0) + 1
      }

      const exercisePayload = {
        program_day_id: dayId,
        order_index: orderIndex,
        title: payload.title || '',
        description: payload.description || '',
        video_url: payload.video_url || ''
      }

      const { data, error } = await supabaseClient
        .from('exercises')
        .insert([exercisePayload])
        .select()
        .single()

      if (error) throw error
      result = data

    } else if (method === 'PUT' && path.startsWith('/exercises/')) {
      // Update exercise
      const exerciseId = path.split('/')[2]
      const { data, error } = await supabaseClient
        .from('exercises')
        .update(payload)
        .eq('id', exerciseId)
        .select()
        .single()

      if (error) throw error
      result = data

    } else if (method === 'DELETE' && path.startsWith('/exercises/')) {
      // Delete exercise
      const exerciseId = path.split('/')[2]
      const { error } = await supabaseClient
        .from('exercises')
        .delete()
        .eq('id', exerciseId)

      if (error) throw error
      result = { deleted: true, id: exerciseId }

    } else {
      return new Response(
        JSON.stringify({ ok: false, error: 'Route not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in admin function:', error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

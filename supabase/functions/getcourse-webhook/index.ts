import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body = await req.json()
    console.log('Received webhook from Salebot - FULL BODY:', JSON.stringify(body, null, 2))
    console.log('All available fields in body:', Object.keys(body))
    
    // Extract tg_user_id from request - check multiple possible fields
    const tgUserId = body.tg_user_id || body.telegram_id || body.platform_id || body.user_id || body.client_id || body.id
    
    // Log which field was used
    let usedField = 'none'
    if (body.tg_user_id) usedField = 'tg_user_id'
    else if (body.telegram_id) usedField = 'telegram_id'
    else if (body.platform_id) usedField = 'platform_id'
    else if (body.user_id) usedField = 'user_id'
    else if (body.client_id) usedField = 'client_id'
    else if (body.id) usedField = 'id'
    
    console.log(`Extracted tg_user_id from field "${usedField}":`, tgUserId)
    console.log('All ID-like fields:', {
      tg_user_id: body.tg_user_id,
      telegram_id: body.telegram_id,
      platform_id: body.platform_id,
      user_id: body.user_id,
      client_id: body.client_id,
      id: body.id
    })
    
    if (!tgUserId) {
      console.error('No tg_user_id provided in request. Available fields:', Object.keys(body))
      return new Response(
        JSON.stringify({ success: false, error: 'tg_user_id is required', received_fields: Object.keys(body) }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert to number if it's a string
    const tgUserIdNumber = typeof tgUserId === 'string' ? parseInt(tgUserId, 10) : tgUserId

    if (isNaN(tgUserIdNumber)) {
      console.error('Invalid tg_user_id format:', tgUserId)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid tg_user_id format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with service role for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get subscription duration from request (default: 30 days)
    const durationDays = body.duration_days || body.subscription_days || 30
    const durationDaysNumber = typeof durationDays === 'string' ? parseInt(durationDays, 10) : durationDays
    
    // Validate duration
    if (isNaN(durationDaysNumber) || durationDaysNumber < 1) {
      console.error('Invalid duration_days format:', durationDays)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid duration_days format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate subscription expiry date
    const subscriptionValidUntil = new Date()
    subscriptionValidUntil.setDate(subscriptionValidUntil.getDate() + durationDaysNumber)
    
    console.log(`Setting subscription for ${durationDaysNumber} days`)

    // Call the update_user_access function
    const { data, error } = await supabaseClient.rpc('update_user_access', {
      p_tg_user_id: tgUserIdNumber,
      p_has_access: true,
      p_subscription_valid_until: subscriptionValidUntil.toISOString()
    })

    if (error) {
      console.error('Error updating user access:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if the operation was actually successful
    if (data && data.success === false) {
      console.error('Failed to update access for user:', tgUserIdNumber, 'Reason:', data.message)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.message || 'User not found',
          received_tg_user_id: tgUserIdNumber,
          used_field: usedField
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Successfully updated access for user:', tgUserIdNumber, 'Used field:', usedField, 'Result:', data)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Access updated successfully',
        data: data 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

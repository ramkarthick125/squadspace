// ==============================================================================
// SUPABASE EDGE FUNCTION: LIVEKIT ACCESS TOKEN GENERATOR
// Securely mints LiveKit room tokens with WebRTC permissions.
// Keeps LIVEKIT_API_SECRET safe on the server.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@1.2.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { roomName, participantName, userId } = await req.json();

    if (!roomName || !participantName || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing roomName, participantName, or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'LiveKit API key or secret not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Access Token with permissions for voice and screen share
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: participantName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

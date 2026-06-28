import { supabase } from './supabase';

// Safely increment minutes using the atomic RPC function
export async function earnMinutes(userId: string, minutesToAdd: number) {
  try {
    const { data, error } = await supabase.rpc('atomic_increment_minutes', {
      p_amount: minutesToAdd,
      p_user_id: userId,
    });
    if (error) console.error('[chat-utils] earnMinutes error:', error);
    return data as number;
  } catch (err) {
    console.error('[chat-utils] earnMinutes error:', err);
  }
}

// Add current user to the waiting queue for matchmaking
export async function joinWaitingQueue(
  memberId: string,
  gender?: string | null,
  genderPreference?: string,
) {
  const channelId = `ch_${memberId}_${Date.now()}`;
  const { data, error } = await supabase
    .from('waiting_queue')
    .insert({
      member_id: memberId,
      channel_id: channelId,
      member_gender: gender ?? null,
      gender_preference: genderPreference ?? 'Both',
      voice_mode: false,
    })
    .select()
    .single();
  return { data, error, channelId };
}

// Remove current user from the waiting queue
export async function leaveWaitingQueue(memberId: string) {
  await supabase.from('waiting_queue').delete().eq('member_id', memberId);
}

// Find someone else in the waiting queue
export async function findMatchInQueue(memberId: string) {
  const { data } = await supabase
    .from('waiting_queue')
    .select('*')
    .neq('member_id', memberId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// Create a room when two users are matched
export async function createRoom(
  member1Id: string,
  member1Channel: string,
  member2Id: string,
  member2Channel: string,
  member1Gender?: string | null,
  member2Gender?: string | null,
) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      member1: member1Id,
      member2: member2Id,
      channel1: member1Channel,
      channel2: member2Channel,
      member1_gender: member1Gender ?? null,
      member2_gender: member2Gender ?? null,
      status: 'connected',
      connected_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
}

// End a room session
export async function endRoom(roomId: string) {
  await supabase
    .from('rooms')
    .update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
    })
    .eq('id', roomId);
}

// Insert a redemption record
export async function redeemReward(
  userId: string,
  reward: {
    id: string;
    title: string;
    minutes_cost: number;
    image_url?: string | null;
    rarity?: string;
    type?: string;
    selectedColor?: string | null;
  },
  shipping?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }
) {
  const { data, error } = await supabase
    .from('member_redemptions')
    .insert({
      user_id: userId,
      reward_id: reward.id,
      reward_title: reward.title,
      minutes_cost: reward.minutes_cost,
      reward_image_url: reward.image_url ?? null,
      reward_rarity: reward.rarity ?? 'common',
      reward_type: reward.type ?? 'physical',
      selected_color: reward.selectedColor ?? null,
      status: 'pending',
      shipping_name: shipping?.name ?? null,
      shipping_address: shipping?.address ?? null,
      shipping_city: shipping?.city ?? null,
      shipping_state: shipping?.state ?? null,
      shipping_zip: shipping?.zip ?? null,
      shipping_country: shipping?.country ?? null,
    })
    .select()
    .single();
  return { data, error };
}
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const STORAGE = 'krishisetu-demo';
const configured = () => SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
const makeId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const getDemoId = () => {
  let id = localStorage.getItem(`${STORAGE}-user-id`);
  if (!id) { id = makeId(); localStorage.setItem(`${STORAGE}-user-id`, id); }
  return id;
};
const read = (key, fallback) => JSON.parse(localStorage.getItem(`${STORAGE}-${key}`) || JSON.stringify(fallback));
const write = (key, value) => localStorage.setItem(`${STORAGE}-${key}`, JSON.stringify(value));
const parseLot = lot => {
  const [quantity = '0', ...unit] = String(lot.qty || '').split(' ');
  return { id: lot.id || makeId(), crop_name: lot.name, location: lot.loc, quality_grade: lot.grade, quantity: Number(quantity), unit: unit.join(' ') || 'Quintals', list_price: Number(String(lot.price).replaceAll(',', '')), owner_name: lot.farmer };
};
const presentLot = row => ({
  id: row.id,
  name: row.crop_name,
  loc: row.location,
  grade: row.quality_grade || 'Grade B',
  qty: `${row.quantity} ${row.unit || 'Quintals'}`,
  price: Number(row.list_price || 0).toLocaleString('en-IN'),
  icon: '🌾',
  accent: '#8baa65',
  farmer: row.owner_name || row.profiles?.full_name || 'Verified Farmer'
});

function localStore() {
  return {
    mode: 'local demo',
    async getLots() { return read('lots', []).map(presentLot); },
    async upsertProfile(profile) { write('profile', { id: getDemoId(), ...profile, updatedAt: new Date().toISOString() }); },
    async createLot(lot, profile) {
      const rows = read('lots', []); const row = { ...parseLot(lot), owner_id: getDemoId(), owner_name: profile.fullName, created_at: new Date().toISOString() };
      rows.unshift(row); write('lots', rows); return presentLot(row);
    },
    async createOffer(offer) { const offers = read('offers', []); offers.unshift({ id: makeId(), sender_id: getDemoId(), ...offer, created_at: new Date().toISOString() }); write('offers', offers); },
    async getMessages(conversationKey) { return read('messages', []).filter(message => message.conversation_key === conversationKey); },
    async sendMessage(message) { const messages = read('messages', []); messages.push({ id: makeId(), conversation_key: message.conversationKey, sender_id: getDemoId(), sender_name: message.senderName, sender_role: message.senderRole, body: message.body, created_at: new Date().toISOString() }); write('messages', messages); },
    subscribeMessages() { return () => {}; }
  };
}

export async function createDemoStore() {
  if (!configured()) return localStore();
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return {
      mode: 'Supabase',
      async getLots() {
        const { data, error } = await supabase.from('crop_lots').select('*').eq('status', 'available').order('created_at', { ascending: false });
        if (error) throw error; return data.map(presentLot);
      },
      async upsertProfile(profile) {
        const { error } = await supabase.from('profiles').upsert({ id: getDemoId(), full_name: profile.fullName, role: profile.role, updated_at: new Date().toISOString() });
        if (error) throw error;
      },
      async createLot(lot, profile) {
        const row = parseLot(lot); const ownerId = getDemoId();
        await this.upsertProfile(profile);
        const { data, error } = await supabase.from('crop_lots').insert({ ...row, owner_id: ownerId, owner_name: profile.fullName, status: 'available' }).select().single();
        if (error) throw error; return presentLot(data);
      },
      async createOffer(offer) {
        const { error } = await supabase.from('offers').insert({ buyer_id: getDemoId(), amount: offer.amount, note: `Offer for ${offer.lotName}`, status: 'sent' });
        if (error) throw error;
      },
      async getMessages(conversationKey) {
        const { data, error } = await supabase.from('messages').select('id, sender_name, sender_role, body, created_at').eq('conversation_key', conversationKey).order('created_at', { ascending: true });
        if (error) throw error; return data;
      },
      async sendMessage(message) {
        const { error } = await supabase.from('messages').insert({ conversation_key: message.conversationKey, sender_id: getDemoId(), sender_name: message.senderName, sender_role: message.senderRole, body: message.body });
        if (error) throw error;
      },
      subscribeMessages(conversationKey, onMessage) {
        const channel = supabase.channel(`chat:${conversationKey}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_key=eq.${conversationKey}` }, onMessage).subscribe();
        return () => { supabase.removeChannel(channel); };
      }
    };
  } catch (error) {
    console.warn('Supabase unavailable; using local demo storage.', error);
    return localStore();
  }
}

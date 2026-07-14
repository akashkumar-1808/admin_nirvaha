export interface Topic {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_TOPICS: Topic[] = [
  { id: 'all_users', name: 'All Users', description: 'Broadcast to all registered Nirvaha app users' },
  { id: 'meditation', name: 'Meditation', description: 'Users interested in meditation content' },
  { id: 'music', name: 'Music & Sound Healing', description: 'Users listening to therapeutic music' },
  { id: 'healing', name: 'Healing Content', description: 'General healing updates' },
  { id: 'sleep', name: 'Sleep & Rest', description: 'Sleep stories and night-time audio listeners' },
  { id: 'calm', name: 'Calmness', description: 'Calm breathing exercises and state changes' },
  { id: 'balance', name: 'Balance', description: 'Balance and alignment content subscribers' },
  { id: 'bliss', name: 'Bliss', description: 'Bliss and ecstasy meditations' },
  { id: 'clarity', name: 'Clarity', description: 'Mindfulness and clarity exercises' },
  { id: 'ai', name: 'AI & Wisdom', description: 'AI companion updates and prompts' },
  { id: 'companions', name: 'Companions', description: 'Interactions and chats with digital guides' },
  { id: 'announcements', name: 'Announcements', description: 'Official system announcements' }
];

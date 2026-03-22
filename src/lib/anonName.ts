/**
 * Deterministic adjective-noun name from a pubkey.
 * Uses the first 4 bytes as two independent indices into word lists.
 * No external dependencies, no network calls.
 *
 * Example: "Silver Penguin", "Bright Falcon", "Dark Maple"
 */

const ADJECTIVES = [
  'Amber', 'Ancient', 'Arctic', 'Ashen', 'Auburn',
  'Azure', 'Blazing', 'Bold', 'Brave', 'Bright',
  'Bronze', 'Calm', 'Coral', 'Cosmic', 'Crimson',
  'Crystal', 'Dark', 'Dawn', 'Deep', 'Dusk',
  'Dusty', 'Ember', 'Emerald', 'Faded', 'Fierce',
  'Flame', 'Frosty', 'Gilded', 'Golden', 'Grand',
  'Hollow', 'Icy', 'Indigo', 'Iron', 'Jade',
  'Keen', 'Lunar', 'Midnight', 'Misty', 'Mossy',
  'Mystic', 'Neon', 'Noble', 'Obsidian', 'Onyx',
  'Opal', 'Pale', 'Peach', 'Pearl', 'Pine',
  'Prism', 'Purple', 'Quiet', 'Radiant', 'Rosy',
  'Ruby', 'Russet', 'Sandy', 'Sapphire', 'Scarlet',
  'Shadow', 'Sheer', 'Silver', 'Slate', 'Solar',
  'Stark', 'Steel', 'Stormy', 'Swift', 'Teal',
  'Titan', 'Twilight', 'Vast', 'Velvet', 'Vibrant',
  'Violet', 'Vivid', 'Warm', 'Wild', 'Windy',
  'Winter', 'Wooden', 'Worn', 'Yellow', 'Zenith',
];

const NOUNS = [
  'Albatross', 'Antler', 'Apex', 'Ash', 'Aurora',
  'Badger', 'Bay', 'Bear', 'Birch', 'Blaze',
  'Brook', 'Canyon', 'Cedar', 'Cliff', 'Cloud',
  'Comet', 'Condor', 'Coral', 'Crane', 'Creek',
  'Delta', 'Dune', 'Eagle', 'Elk', 'Ember',
  'Falcon', 'Fern', 'Field', 'Finch', 'Fjord',
  'Flame', 'Fox', 'Frost', 'Gale', 'Glacier',
  'Glen', 'Grove', 'Hawk', 'Heath', 'Heron',
  'Hill', 'Horizon', 'Hound', 'Isle', 'Ivy',
  'Jackal', 'Jaguar', 'Jay', 'Juniper', 'Kestrel',
  'Lake', 'Lark', 'Laurel', 'Leaf', 'Leopard',
  'Lily', 'Lion', 'Lynx', 'Maple', 'Marsh',
  'Mesa', 'Mist', 'Mole', 'Moon', 'Moose',
  'Moss', 'Mountain', 'Nebula', 'Nighthawk', 'Oak',
  'Orca', 'Osprey', 'Otter', 'Owl', 'Peak',
  'Penguin', 'Pine', 'Plain', 'Plover', 'Pond',
  'Puma', 'Quill', 'Raven', 'Reed', 'Ridge',
  'River', 'Robin', 'Rock', 'Sage', 'Shore',
  'Sparrow', 'Spruce', 'Star', 'Stone', 'Storm',
  'Stream', 'Summit', 'Swift', 'Thorn', 'Tide',
  'Tiger', 'Trail', 'Vale', 'Viper', 'Vista',
  'Vole', 'Wave', 'Willow', 'Wolf', 'Wren',
];

/**
 * Returns a deterministic "Adjective Noun" display name for any pubkey.
 * Suitable for anonymous/ephemeral pubkeys that have no Nostr profile.
 */
export function anonDisplayName(pubkey: string): string {
  // Use bytes 0-1 for adjective index, bytes 2-3 for noun index
  const b0 = parseInt(pubkey.slice(0, 2), 16);
  const b1 = parseInt(pubkey.slice(2, 4), 16);
  const b2 = parseInt(pubkey.slice(4, 6), 16);
  const b3 = parseInt(pubkey.slice(6, 8), 16);

  const adjIdx = ((b0 << 8) | b1) % ADJECTIVES.length;
  const nounIdx = ((b2 << 8) | b3) % NOUNS.length;

  return `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]}`;
}

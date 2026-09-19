// Same palette as admin-web/customer-web's `index.css` tokens — a light,
// clean "premium healthcare" look (Tata 1mg/Practo), not a dark fintech
// theme. Custom webfonts (Sora/Plus Jakarta Sans) aren't wired up here yet
// (see README "Known gaps") — this uses the system font, styled to match
// via color, spacing, and shadow instead.
export const colors = {
  bg: '#F6F8FA',
  card: '#FFFFFF',
  border: '#E6EBF0',
  ink: '#101828',
  inkSoft: '#475467',
  inkFaint: '#98A2B3',
  teal: '#0EA5A0',
  blue: '#2F6FED',
  accent: '#0EA5A0',
  accentSoft: '#E3F6F4',
  amber: '#B54708',
  amberSoft: '#FEF3E5',
  red: '#B42318',
  redSoft: '#FEE4E2',
  greySoft: '#F2F4F7',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

export const gradientArt = ['#0EA5A0', '#14B8A6', '#2F6FED', '#6366F1', '#0891B2', '#0D9488'];

export function gradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return gradientArt[hash % gradientArt.length];
}

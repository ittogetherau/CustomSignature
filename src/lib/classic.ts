// "Classic" signatures: one layout engine (render.ts → classic()) driven by these recipes.
// Each recipe is a familiar business-signature arrangement — header or columns, photo
// treatment, contact style and social style — with its own default palette.

export type Block = 'photo' | 'name' | 'bar' | 'contacts' | 'socials'
export type PhotoStyle = 'square' | 'rounded' | 'circle' | 'ring' | 'thinring'
export type ContactStyle = 'letter' | 'label' | 'icon' | 'plain' | 'inline' | 'grid'
export type SocialStyle = 'color' | 'dark' | 'outline' | 'accent'

export interface ClassicRecipe {
  id: string
  name: string
  tagline: string
  primary: string
  layout: 'header' | 'cols'
  /** header layout: name/title row on top, rule beneath, then `cells` as the body. */
  headerAlign?: 'left' | 'center' | 'right'
  headerPhoto?: 'left' | 'right'
  headerSocials?: boolean
  cells: Block[][]
  dividers?: boolean
  rule?: 'header' | 'bottom' | 'none'
  ruleWeight?: number
  ruleColor?: 'accent' | 'ink' | 'line'
  photo: PhotoStyle
  photoSize: number
  contacts: ContactStyle
  socials: SocialStyle
  nameUpper?: boolean
  nameStacked?: boolean
  nameColor?: 'accent' | 'ink'
  titleColor?: 'accent' | 'muted'
}

export const CLASSIC: ClassicRecipe[] = [
  { id: 'c-ledger-head', name: 'Headline', tagline: 'Bold name header over photo & lettered contacts', primary: '#ff4d00', layout: 'header', headerAlign: 'left', cells: [['photo'], ['contacts', 'socials']], rule: 'header', ruleWeight: 3, ruleColor: 'line', photo: 'square', photoSize: 110, contacts: 'letter', socials: 'color', nameUpper: true, nameColor: 'ink', titleColor: 'accent' },
  { id: 'c-trio', name: 'Trio', tagline: 'Stacked name, round photo with socials, lettered contacts', primary: '#ff4d00', layout: 'cols', cells: [['name'], ['photo', 'socials'], ['contacts']], photo: 'circle', photoSize: 100, contacts: 'letter', socials: 'dark', nameUpper: true, nameStacked: true, nameColor: 'ink', titleColor: 'accent' },
  { id: 'c-ring-card', name: 'Ring Card', tagline: 'Big ringed photo beside a key–value contact table', primary: '#009688', layout: 'cols', cells: [['photo'], ['name', 'bar', 'contacts', 'socials']], photo: 'ring', photoSize: 120, contacts: 'label', socials: 'outline', nameUpper: true, nameColor: 'accent', titleColor: 'muted' },
  { id: 'c-split-icons', name: 'Split Icons', tagline: 'Ringed photo, divider, icon contact list', primary: '#5363f2', layout: 'cols', cells: [['photo'], ['name', 'socials'], ['contacts']], dividers: true, photo: 'thinring', photoSize: 96, contacts: 'icon', socials: 'outline', nameUpper: true, nameColor: 'accent', titleColor: 'muted' },
  { id: 'c-centered', name: 'Centerline', tagline: 'Centered photo & name with a full-width rule', primary: '#2c66dd', layout: 'header', headerAlign: 'center', headerPhoto: 'left', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'accent', photo: 'circle', photoSize: 64, contacts: 'letter', socials: 'color', nameColor: 'accent', titleColor: 'muted' },
  { id: 'c-red-column', name: 'Column', tagline: 'Rounded photo, stacked name, divider and icons', primary: '#e74c3c', layout: 'cols', cells: [['photo'], ['name'], ['contacts', 'socials']], dividers: true, rule: 'bottom', ruleWeight: 2, ruleColor: 'accent', photo: 'rounded', photoSize: 80, contacts: 'icon', socials: 'accent', nameStacked: true, nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-three-panel', name: 'Three Panel', tagline: 'Photo | name | contact table, framed by dividers', primary: '#8e44ad', layout: 'cols', cells: [['photo'], ['name'], ['contacts', 'socials']], dividers: true, rule: 'bottom', ruleWeight: 2, ruleColor: 'accent', photo: 'rounded', photoSize: 96, contacts: 'label', socials: 'dark', nameStacked: true, nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-right-header', name: 'Masthead', tagline: 'Right-aligned name with square photo, plain contacts', primary: '#4a90d9', layout: 'header', headerAlign: 'right', headerPhoto: 'right', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'ink', photo: 'square', photoSize: 72, contacts: 'plain', socials: 'color', nameUpper: true, nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-green-center', name: 'Spotlight Ring', tagline: 'Name | ringed photo with socials | icon contacts', primary: '#27ae60', layout: 'cols', cells: [['name'], ['photo', 'socials'], ['contacts']], dividers: true, photo: 'ring', photoSize: 100, contacts: 'icon', socials: 'outline', nameStacked: true, nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-orange-table', name: 'Tabular', tagline: 'Round photo and name, divider, contact table', primary: '#e65100', layout: 'cols', cells: [['photo'], ['name'], ['contacts', 'socials']], dividers: true, rule: 'bottom', ruleWeight: 3, ruleColor: 'accent', photo: 'circle', photoSize: 96, contacts: 'label', socials: 'dark', nameStacked: true, nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-grid', name: 'Grid', tagline: 'Centered header, two-column icon contact grid', primary: '#3f51b5', layout: 'header', headerAlign: 'center', headerPhoto: 'left', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'accent', photo: 'rounded', photoSize: 72, contacts: 'grid', socials: 'color', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-inline', name: 'Inline', tagline: 'Name with photo, contacts in a single tidy row', primary: '#00acc1', layout: 'header', headerAlign: 'center', headerPhoto: 'right', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'accent', photo: 'square', photoSize: 80, contacts: 'inline', socials: 'outline', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-sunrise', name: 'Sunrise', tagline: 'Warm header with rounded photo, plain contact lines', primary: '#ff8f00', layout: 'header', headerAlign: 'center', headerPhoto: 'right', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'accent', photo: 'rounded', photoSize: 64, contacts: 'plain', socials: 'dark', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-rose', name: 'Rose Table', tagline: 'Centered header over a labelled contact table', primary: '#e91e63', layout: 'header', headerAlign: 'center', headerPhoto: 'left', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'accent', photo: 'square', photoSize: 64, contacts: 'label', socials: 'color', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-mocha', name: 'Mocha', tagline: 'Centered name banner, photo beside contacts', primary: '#795548', layout: 'header', headerAlign: 'center', cells: [['photo'], ['contacts', 'socials']], rule: 'header', ruleWeight: 2, ruleColor: 'line', photo: 'circle', photoSize: 72, contacts: 'plain', socials: 'outline', nameUpper: true, nameColor: 'accent', titleColor: 'muted' },
  { id: 'c-ocean', name: 'Ocean', tagline: 'Right header with round photo, icon contacts', primary: '#0288d1', layout: 'header', headerAlign: 'right', headerPhoto: 'right', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 3, ruleColor: 'accent', photo: 'circle', photoSize: 64, contacts: 'icon', socials: 'dark', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-coral', name: 'Coral', tagline: 'Name over photo, divider, lettered contacts', primary: '#ff6f61', layout: 'cols', cells: [['name', 'photo'], ['contacts', 'socials']], dividers: true, photo: 'rounded', photoSize: 96, contacts: 'letter', socials: 'color', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-meadow', name: 'Meadow', tagline: 'Round photo over name, divider, contact table', primary: '#689f38', layout: 'cols', cells: [['photo', 'name'], ['contacts', 'socials']], dividers: true, photo: 'circle', photoSize: 100, contacts: 'label', socials: 'outline', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-violet', name: 'Violet', tagline: 'Name over square photo, divider, plain contacts', primary: '#512da8', layout: 'cols', cells: [['name', 'photo'], ['contacts', 'socials']], dividers: true, photo: 'square', photoSize: 96, contacts: 'plain', socials: 'dark', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-lagoon', name: 'Lagoon', tagline: 'Rounded photo over name, divider, icon contacts', primary: '#00897b', layout: 'cols', cells: [['photo', 'name'], ['contacts', 'socials']], dividers: true, photo: 'rounded', photoSize: 96, contacts: 'icon', socials: 'color', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-crimson', name: 'Crimson', tagline: 'Name over rounded photo, lettered contacts', primary: '#dc143c', layout: 'cols', cells: [['name', 'photo'], ['contacts', 'socials']], dividers: true, photo: 'rounded', photoSize: 96, contacts: 'letter', socials: 'outline', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-steel', name: 'Steel', tagline: 'Photo & name header with socials, inline contacts', primary: '#4682b4', layout: 'header', headerAlign: 'left', headerPhoto: 'left', headerSocials: true, cells: [['contacts']], rule: 'header', ruleWeight: 2, ruleColor: 'accent', photo: 'circle', photoSize: 64, contacts: 'inline', socials: 'dark', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-forest', name: 'Forest', tagline: 'Name | round photo | short-label table', primary: '#004d40', layout: 'cols', cells: [['name'], ['photo'], ['contacts', 'socials']], dividers: true, photo: 'circle', photoSize: 90, contacts: 'label', socials: 'color', nameColor: 'accent', titleColor: 'accent' },
  { id: 'c-royal', name: 'Royal', tagline: 'Centered square photo header, bold rule, icons', primary: '#6a1b9a', layout: 'header', headerAlign: 'center', headerPhoto: 'left', cells: [['contacts', 'socials']], rule: 'header', ruleWeight: 3, ruleColor: 'accent', photo: 'square', photoSize: 72, contacts: 'icon', socials: 'outline', nameColor: 'accent', titleColor: 'accent' },
]

export const classicById = (id: string) => CLASSIC.find((r) => r.id === id)

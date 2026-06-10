// Brand tokens — byt&leg brand kit
export const PRIMARY      = '#2A7D4F';
export const GREEN_DEEP   = '#133F2B';
export const GREEN_SOFT   = '#CFE3D8';
export const GREEN_TINT   = '#E8F1EC';

export const PAPER        = '#F6F2EA';
export const PAPER2       = '#ECE6DA';
export const PAPER3       = '#DAD3C4';

export const INK          = '#16221C';
export const INK2         = '#3A473D';
export const INK3         = '#6B7570';

export const CORAL        = '#E8593D';
export const BUTTER       = '#F1C44B';
export const ROSE         = '#F3D7D0';
export const SKY          = '#6EA8D4';

// Legacy aliases kept for backward compat across components
export const ACCENT       = CORAL;
export const ACCENT2      = SKY;

export const TYPE_CFG = {
  køb:   { label:'Køb',   color:PRIMARY,    bg:GREEN_TINT, icon:'🏷️' },
  byd:   { label:'Byd',   color:SKY,        bg:'#E6EEF7',  icon:'📊' },
  byt:   { label:'Byt',   color:CORAL,      bg:'#FCEAE6',  icon:'🔄' },
  søges: { label:'Søges', color:'#7C3AED',  bg:'#F5F0FF',  icon:'🔍' },
};

export const URGENCY_OPTIONS = [
  { key:'haster',   label:'Det haster',          emoji:'🔴' },
  { key:'måneden',  label:'Inden for en måned',  emoji:'🟡' },
  { key:'ingen',    label:'Ingen hast',           emoji:'🟢' },
];

export const CONDITIONS   = ['Ny','Meget god','God','Acceptabel'];
export const AGE_GROUPS   = ['0-1 år','1-3 år','3-6 år','6-10 år','10+ år'];
export const EMOJIS       = ['🧸','🧱','🚲','🍳','🏖️','🧩','🎯','🎭','🧗','🏀','⚽','🎨','🎪','🚀','🦁','🎠'];
export const COLORS       = ['#CFE3D8','#F3D7D0','#F1C44B','#E8F1EC','#6EA8D4','#ECE6DA','#F6F2EA','#DAD3C4','#133F2B','#16221C'];
export const LISTING_TAGS = ['LEGO','Bøger','Sport','Musik','Puslespil','Kostumer','Udeleg','Kreativ','Motorik','Byggeleg','Pædagogisk','Møbler','Køkkenlege','Rytmik','Cykler','Sandkasse','Rollespil','Naturoplevelser'];
export const CONDITION_COLORS = {
  'Ny':        { bg:GREEN_TINT,  color:GREEN_DEEP },
  'Meget god': { bg:GREEN_TINT,  color:GREEN_DEEP },
  'God':       { bg:'#FBF2DC',   color:'#7C5A14'  },
  'Acceptabel':{ bg:ROSE,        color:'#A83B27'  },
};


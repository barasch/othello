// Dark/light pairs keep large luminance separation, including in grayscale.
export const PALETTES = [
  { name: 'Indigo & apricot', dark: '#283970', light: '#ffd49e' },
  { name: 'Plum & mint', dark: '#642f59', light: '#bdebd4' },
  { name: 'Blue & butter', dark: '#234f68', light: '#f6e6a6' },
  { name: 'Burgundy & blue', dark: '#692d3b', light: '#c8e9f5' },
];
export function tileColors(mode, palette) {
  return mode === 'colors' ? PALETTES[palette % PALETTES.length] : { dark: '#070908', light: '#fffef7' };
}

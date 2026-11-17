import presets from './tweakcn-themes.json';
import { swatchDeclarations } from '@/lib/instrument-colours';

export const themes = presets.map((preset) => ({
  value: preset.name,
  label: preset.title,
  color: preset.light.primary,
}));

function declarations(variables: Record<string, string>) {
  return Object.entries(variables)
    .map(([key, value]) => `--${key}:${value};`)
    .join('');
}

export const themeStyles: Record<string, string> = {};

// Swatch hues are anchored to the light primary in both modes, so toggling
// light/dark changes lightness only, never which colour an instrument is.
for (const preset of presets) {
  themeStyles[preset.name] =
    `:root{${declarations(preset.light)}${swatchDeclarations(preset.light.primary, preset.light.card, 'light')}}` +
    `.dark{${declarations(preset.dark)}${swatchDeclarations(preset.light.primary, preset.dark.card, 'dark')}}`;
}

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

for (const preset of presets) {
  themeStyles[preset.name] =
    `:root{${declarations(preset.light)}${swatchDeclarations(preset.light.primary, preset.light.card, 'light')}}` +
    `.dark{${declarations(preset.dark)}${swatchDeclarations(preset.dark.primary, preset.dark.card, 'dark')}}`;
}

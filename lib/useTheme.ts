import { useColorScheme } from 'react-native';
import { useAppStore } from './store';
import { DarkTheme, LightTheme, AppTheme } from '@/constants/Colors';

export function useTheme(): AppTheme {
  const themeMode = useAppStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  if (themeMode === 'light') return LightTheme;
  if (themeMode === 'dark') return DarkTheme;
  // system
  return systemScheme === 'light' ? LightTheme : DarkTheme;
}

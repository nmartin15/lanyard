import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    ...Ionicons.font,
  });
}

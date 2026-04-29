import { useFonts } from "expo-font";
import { Stack } from "expo-router";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BodyRegular: require("@/assets/fonts/body/Inter_18pt-Regular.ttf"),
    BodyMedium: require("@/assets/fonts/body/Inter_18pt-Medium.ttf"),
    BodySemiBold: require("@/assets/fonts/body/Inter_18pt-SemiBold.ttf"),
    BodyBold: require("@/assets/fonts/body/Inter_18pt-Bold.ttf"),
    BodyItalic: require("@/assets/fonts/body/Inter_18pt-Italic.ttf"),
    HeadlineRegular: require("@/assets/fonts/headline/SpaceGrotesk-Regular.ttf"),
    HeadlineMedium: require("@/assets/fonts/headline/SpaceGrotesk-Medium.ttf"),
    HeadlineSemiBold: require("@/assets/fonts/headline/SpaceGrotesk-SemiBold.ttf"),
    HeadlineBold: require("@/assets/fonts/headline/SpaceGrotesk-Bold.ttf"),
  });

  if (!fontsLoaded) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}

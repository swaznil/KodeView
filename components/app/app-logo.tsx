import { Image } from 'expo-image';
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

const logoSource = require('@/assets/images/icon.png');

export const AppLogo = memo(function AppLogo({
  size = 38,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: '#181817',
          borderCurve: 'continuous',
          borderRadius: size / 4,
          height: size,
          overflow: 'hidden',
          width: size,
        },
        style,
      ]}>
      <Image
        accessibilityLabel="KodeView"
        contentFit="contain"
        source={logoSource}
        style={{
          height: size,
          transform: [{ scale: 2 }],
          width: size,
        }}
        transition={120}
      />
    </View>
  );
});

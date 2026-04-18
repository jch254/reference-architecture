import { View } from 'react-native';

interface SpacerProps {
  size?: number;
}

export default function Spacer({ size = 16 }: SpacerProps) {
  return <View style={{ height: size }} />;
}

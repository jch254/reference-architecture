import type { ReactNode } from 'react';
import type { RefreshControlProps } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenLayoutProps {
  children: ReactNode;
  scroll?: boolean;
  padding?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export default function ScreenLayout({
  children,
  scroll = true,
  padding = 16,
  refreshControl,
}: ScreenLayoutProps) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding }]}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { padding }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
});

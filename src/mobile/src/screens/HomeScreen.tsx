import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { useSession, useExamples } from '../api';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const session = useSession();
  const examples = useExamples();

  return (
    <ScreenLayout
      refreshControl={
        <RefreshControl
          refreshing={examples.isRefetching}
          onRefresh={() => examples.refetch()}
        />
      }
    >
      <Typography variant="title">Home</Typography>
      <Spacer size={16} />

      {session.isLoading ? (
        <ActivityIndicator />
      ) : session.data ? (
        <View style={styles.card}>
          <Typography variant="body">Signed in as {session.data.email}</Typography>
          <Typography variant="body">Tenant: {session.data.tenantSlug}</Typography>
        </View>
      ) : session.error ? (
        <Typography variant="body">Failed to load session</Typography>
      ) : null}

      <Spacer size={24} />
      <View style={styles.sectionHeader}>
        <Typography variant="title">Examples</Typography>
        <Button title="+" onPress={() => navigation.navigate('ExampleCreate')} />
      </View>
      <Spacer size={8} />

      {examples.isLoading ? (
        <ActivityIndicator />
      ) : examples.error ? (
        <Typography variant="body">Failed to load examples</Typography>
      ) : examples.data && examples.data.length > 0 ? (
        <FlatList
          data={examples.data}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => navigation.navigate('ExampleDetail', { id: item.id, name: item.name })}
            >
              <Typography variant="body">{item.name}</Typography>
              <Typography variant="caption">{'›'}</Typography>
            </Pressable>
          )}
        />
      ) : (
        <Typography variant="body">No examples yet</Typography>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  itemPressed: {
    opacity: 0.6,
  },
});

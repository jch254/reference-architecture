import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { ScreenLayout, Typography, Spacer } from '../components';
import { useSession, useExamples } from '../api';

export default function HomeScreen() {
  const session = useSession();
  const examples = useExamples();

  return (
    <ScreenLayout>
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
      <Typography variant="title">Examples</Typography>
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
            <View style={styles.item}>
              <Typography variant="body">{item.name}</Typography>
            </View>
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
  item: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});

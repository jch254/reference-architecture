import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, Typography, Spacer } from '../components';
import { useExample } from '../api';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ExampleDetail'>;

export default function ExampleDetailScreen({ route }: Props) {
  const { id } = route.params;
  const { data: example, isLoading, error } = useExample(id);

  if (isLoading) {
    return (
      <ScreenLayout>
        <ActivityIndicator style={styles.loader} />
      </ScreenLayout>
    );
  }

  if (error || !example) {
    return (
      <ScreenLayout>
        <Typography variant="body">Failed to load example</Typography>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <Typography variant="title">{example.name}</Typography>
      <Spacer size={24} />

      <View style={styles.row}>
        <Typography variant="caption">ID</Typography>
        <Typography variant="body">{example.id}</Typography>
      </View>

      <View style={styles.row}>
        <Typography variant="caption">Created</Typography>
        <Typography variant="body">{new Date(example.createdAt).toLocaleString()}</Typography>
      </View>

      <View style={styles.row}>
        <Typography variant="caption">Updated</Typography>
        <Typography variant="body">{new Date(example.updatedAt).toLocaleString()}</Typography>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 32,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});

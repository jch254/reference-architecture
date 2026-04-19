import { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { ApiError, useCreateExample } from '../api';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ExampleCreate'>;

export default function ExampleCreateScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const createExample = useCreateExample();

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Name is required');
      return;
    }

    createExample.mutate(trimmed, {
      onSuccess: () => navigation.goBack(),
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : 'Failed to create example';
        Alert.alert('Error', message);
      },
    });
  };

  return (
    <ScreenLayout>
      <Typography variant="title">New Example</Typography>
      <Spacer size={24} />
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoFocus
      />
      <Spacer />
      <Button
        title={createExample.isPending ? 'Creating…' : 'Create'}
        onPress={handleCreate}
        disabled={createExample.isPending}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});

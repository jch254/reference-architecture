import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, Typography, Button, Spacer } from '../components';
import { ApiError, useExample, useUpdateExample, useDeleteExample } from '../api';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ExampleDetail'>;

export default function ExampleDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: example, isLoading, error } = useExample(id);
  const updateExample = useUpdateExample();
  const deleteExample = useDeleteExample();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const handleEdit = () => {
    if (example) {
      setEditName(example.name);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
  };

  const handleSave = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Name is required');
      return;
    }

    updateExample.mutate(
      { id, name: trimmed },
      {
        onSuccess: () => {
          setIsEditing(false);
          navigation.setParams({ name: trimmed });
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : 'Failed to update example';
          Alert.alert('Error', message);
        },
      },
    );
  };

  const handleDelete = () => {
    Alert.alert('Delete Example', 'Are you sure you want to delete this example?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteExample.mutate(id, {
            onSuccess: () => navigation.goBack(),
            onError: (err) => {
              const message = err instanceof ApiError ? err.message : 'Failed to delete example';
              Alert.alert('Error', message);
            },
          });
        },
      },
    ]);
  };

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

  const isMutating = updateExample.isPending || deleteExample.isPending;

  return (
    <ScreenLayout>
      {isEditing ? (
        <>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            autoFocus
          />
          <Spacer />
          <Button
            title={updateExample.isPending ? 'Saving…' : 'Save'}
            onPress={handleSave}
            disabled={updateExample.isPending}
          />
          <Spacer size={8} />
          <Button title="Cancel" onPress={handleCancelEdit} variant="secondary" disabled={updateExample.isPending} />
        </>
      ) : (
        <>
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

          <Spacer size={24} />
          <Button title="Edit" onPress={handleEdit} disabled={isMutating} />
          <Spacer size={8} />
          <Button
            title={deleteExample.isPending ? 'Deleting…' : 'Delete'}
            onPress={handleDelete}
            variant="secondary"
            disabled={isMutating}
          />
        </>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});

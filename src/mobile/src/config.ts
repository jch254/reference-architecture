import { Platform } from 'react-native';

const DEV_API_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const config = {
  apiBaseUrl: __DEV__
    ? `http://${DEV_API_HOST}:3000`
    : 'https://reference-architecture.603.nz',
};

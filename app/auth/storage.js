import * as SecureStore from 'expo-secure-store';

const key = 'authToken';
const storeToken = async (authToken) => {
  try {
    await SecureStore.setItemAsync(key, authToken);
  } catch (_error) {}
};

const getToken = async () => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (_error) {}
};

const removeToken = async () => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
};

export default { getToken, removeToken, storeToken };

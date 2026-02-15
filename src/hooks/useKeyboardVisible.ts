import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

export function useKeyboardVisible() {
  const keyboardVisible = useRef(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisible.current = true;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisible.current = false;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isKeyboardVisible = useCallback(() => keyboardVisible.current, []);
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  return { isKeyboardVisible, dismissKeyboard };
}

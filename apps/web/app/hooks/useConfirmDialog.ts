import { useState } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message?: string;
  itemName?: string;
  isDangerous?: boolean;
}

interface UseConfirmDialogReturn {
  state: ConfirmDialogState;
  open: (config: Omit<ConfirmDialogState, 'isOpen'>) => void;
  close: () => void;
}

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
  });

  const open = (config: Omit<ConfirmDialogState, 'isOpen'>) => {
    setState({
      ...config,
      isOpen: true,
    });
  };

  const close = () => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  return {
    state,
    open,
    close,
  };
}

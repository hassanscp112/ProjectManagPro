import { createContext, useContext } from 'react';

/** Provided by <ToastProvider>: toast({ title, description, tone, duration }). */
export const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

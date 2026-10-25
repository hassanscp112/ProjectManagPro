import { createContext, useContext } from 'react';

/** Set by <Field>: { id, describedBy, invalid } for the control inside it. */
export const FieldContext = createContext(null);

export const useField = () => useContext(FieldContext);

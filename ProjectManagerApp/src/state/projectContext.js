import { createContext, useContext } from 'react';

/** Everything the screens read and the actions they call; see ProjectProvider. */
export const ProjectContext = createContext(null);

/** The project store, or null outside a project (the projects level). */
export const useOptionalProject = () => useContext(ProjectContext);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
};

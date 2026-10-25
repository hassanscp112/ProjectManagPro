import { createContext, useContext } from 'react';

/** Everything the screens read and the actions they call; see ProjectProvider. */
export const ProjectContext = createContext(null);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
};

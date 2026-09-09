import { React } from "../react-globals.js";

// App-scoped memory only: navigating keeps a draft; reloading creates a new Map.
// Isolated component tests have no provider and behave like ordinary useState.
export const SessionDraftContext = React.createContext(null);
export function useSessionState(key, initialValue) {
  const drafts = React.useContext(SessionDraftContext);
  const [value, setValue] = React.useState(() => drafts?.has(key) ? drafts.get(key)
    : typeof initialValue === "function" ? initialValue() : initialValue);
  React.useEffect(() => { if (drafts) drafts.set(key, value); }, [drafts, key, value]);
  return [value, setValue];
}

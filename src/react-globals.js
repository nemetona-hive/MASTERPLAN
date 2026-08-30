const ReactGlobal = window.React;
const ReactDOMGlobal = window.ReactDOM;

if (!ReactGlobal || !ReactDOMGlobal) {
  throw new Error("React and ReactDOM must be loaded before components.js");
}

export const React = ReactGlobal;
export const ReactDOM = ReactDOMGlobal;
// Components reach for hooks through the React object (React.useEffect, ...).
// useState is the one that is also imported by name, so it is the only hook
// re-exported here; add another only when something actually imports it.
export const { useState } = ReactGlobal;

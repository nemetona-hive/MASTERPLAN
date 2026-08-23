const ReactGlobal = window.React;
const ReactDOMGlobal = window.ReactDOM;

if (!ReactGlobal || !ReactDOMGlobal) {
  throw new Error("React and ReactDOM must be loaded before components.js");
}

export const React = ReactGlobal;
export const ReactDOM = ReactDOMGlobal;
export const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect
} = ReactGlobal;

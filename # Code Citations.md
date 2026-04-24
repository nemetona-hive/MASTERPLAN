# Code Citations

## License: unknown
https://github.com/yusitnikov/sudoku-jigsaw/blob/58d6e8f133a42c51ec479271547816be81127fdf/src/useWindowSize.ts

```
Perfect! I've fixed the landscape orientation issue. Here's what was happening and what I fixed:

## **Problem Identified**
On Galaxy S25 rotating to landscape (720x360):
- Width becomes 720px (> 768px), so `isMobile()` function returned `false`
- React state didn't update reactively to this change
- Nav stayed in desktop mode even though device was still small
- Clicking a nav button triggered a re-render which fixed the layout

## **Root Causes & Fixes**

### 1. **Mobile Detection Not Reactive** ✅
**File:** `src/App.jsx`

**Before:** 
```jsx
const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
const [navOpen, setNavOpen] = React.useState(!isMobile());
```
- Function called once at mount, state never updated on resize

**After:**
```jsx
const getIsMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
const [isMobile, setIsMobile] = React.useState(getIsMobile);

React.useEffect(() => {
  const handler = () => {
    const nowMobile = getIsMobile();
    setIsMobile(nowMobile);
    if (!nowMobile) {
      setMobileMenuOpen(false);
      setNavOpen(true);  // Reset to expanded for desktop
    }
  };
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  return () => {
    window.removeEventListener("resize", handler);
    window.removeEventListener("orientationchange", handler);
  };
}, []);
```
- Now `isMobile` is state that updates on resize/orientation changes
- Added `orientationchange` listener for explicit orientation detection
- Properly resets menu and nav state when switching between mobile/desktop

### 2. **Nav Component Using Stale Mobile Detection** ✅
**File:** `src/Nav.jsx`

**Before:**
```jsx
function AppNav({ ... }) {
  const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
  // Re-calculated every render, no consistency with
```


## License: unknown
https://github.com/yusitnikov/sudoku-jigsaw/blob/58d6e8f133a42c51ec479271547816be81127fdf/src/useWindowSize.ts

```
Perfect! I've fixed the landscape orientation issue. Here's what was happening and what I fixed:

## **Problem Identified**
On Galaxy S25 rotating to landscape (720x360):
- Width becomes 720px (> 768px), so `isMobile()` function returned `false`
- React state didn't update reactively to this change
- Nav stayed in desktop mode even though device was still small
- Clicking a nav button triggered a re-render which fixed the layout

## **Root Causes & Fixes**

### 1. **Mobile Detection Not Reactive** ✅
**File:** `src/App.jsx`

**Before:** 
```jsx
const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
const [navOpen, setNavOpen] = React.useState(!isMobile());
```
- Function called once at mount, state never updated on resize

**After:**
```jsx
const getIsMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
const [isMobile, setIsMobile] = React.useState(getIsMobile);

React.useEffect(() => {
  const handler = () => {
    const nowMobile = getIsMobile();
    setIsMobile(nowMobile);
    if (!nowMobile) {
      setMobileMenuOpen(false);
      setNavOpen(true);  // Reset to expanded for desktop
    }
  };
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  return () => {
    window.removeEventListener("resize", handler);
    window.removeEventListener("orientationchange", handler);
  };
}, []);
```
- Now `isMobile` is state that updates on resize/orientation changes
- Added `orientationchange` listener for explicit orientation detection
- Properly resets menu and nav state when switching between mobile/desktop

### 2. **Nav Component Using Stale Mobile Detection** ✅
**File:** `src/Nav.jsx`

**Before:**
```jsx
function AppNav({ ... }) {
  const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
  // Re-calculated every render, no consistency with
```


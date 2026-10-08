import { React } from "../react-globals.js";

/* One render error would otherwise unmount the whole app, nav and theme control
   included. Keyed by page at the call site, so choosing another page is a way
   out as well as the button. */
export class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="page-error">
        <p>Something went wrong showing this page. Your other pages are unaffected.</p>
        <button className="ctl-ghost" onClick={() => this.setState({ failed: false })}>Try again</button>
      </div>
    );
  }
}

import { useEffect, useState } from "react";
import { subscribeLoading } from "../api/loadingBus";
import "./GlobalLoadingBar.css";

export default function GlobalLoadingBar() {
  const [active, setActive] = useState(0);

  useEffect(() => subscribeLoading(setActive), []);

  if (active === 0) return null;
  return <div className="global-loading-bar" aria-hidden="true" />;
}

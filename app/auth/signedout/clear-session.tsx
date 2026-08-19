"use client";

import { useEffect } from "react";

export function ClearSession() {
  useEffect(() => {
    sessionStorage.removeItem("dct-active-session-v1");
    localStorage.removeItem("dct-active-session-v2");
  }, []);

  return null;
}

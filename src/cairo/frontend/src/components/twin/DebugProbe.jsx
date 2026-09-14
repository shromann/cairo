import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Dev-only: with ?debug in the URL, exposes the R3F renderer/scene/camera and the `advance` function on
 * window.__cairo so frames can be driven from a script (e.g. in a hidden automation tab where rAF never fires).
 */
export function DebugProbe() {
  const { gl, scene, camera, advance, invalidate } = useThree();
  useEffect(() => {
    if (typeof window === "undefined" || !/[?&]debug/.test(window.location.search)) return;
    window.__cairo = { gl, scene, camera, advance, invalidate };
    return () => { delete window.__cairo; };
  }, [gl, scene, camera, advance, invalidate]);
  return null;
}

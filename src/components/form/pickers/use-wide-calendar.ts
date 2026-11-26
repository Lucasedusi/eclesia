"use client";
import { useSyncExternalStore } from "react";

const query = "(min-width: 761px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const read = () => window.matchMedia(query).matches;
const server = () => true;

export function useWideCalendar() {
  return useSyncExternalStore(subscribe, read, server);
}

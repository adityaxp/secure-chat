import { router } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    setTimeout(() => {
      router.replace("/splash");
    }, 0);
  }, []);

  return null;
}

import type { MetadataRoute } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
} from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#0a0a0a",
    categories: ["productivity", "events", "shopping"],
    description: SITE_DESCRIPTION,
    display: "standalone",
    icons: [
      { sizes: "any", src: "/icon.svg", type: "image/svg+xml" },
      { sizes: "32x32", src: "/icon", type: "image/png" },
      { sizes: "180x180", src: "/apple-icon", type: "image/png" },
    ],
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    start_url: "/",
    theme_color: "#0a0a0a",
  };
}

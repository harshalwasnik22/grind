import type { MetadataRoute } from "next";

/** Web app manifest — makes GRIND installable to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GRIND",
    short_name: "GRIND",
    description:
      "A competitive, retro-RPG habit tracker for you and your friends.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0b1a",
    theme_color: "#0d0b1a",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

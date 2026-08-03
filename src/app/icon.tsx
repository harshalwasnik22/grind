import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon: a bold gold "G" on the deep-purple GRIND background. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0b1a",
          color: "#ffd24a",
          fontSize: 340,
          fontWeight: 700,
          fontFamily: "monospace",
        }}
      >
        G
      </div>
    ),
    size,
  );
}

import localFont from "next/font/local";

export const cubixlesLogoFont = localFont({
  src: [
    { path: "../assets/cubixles-logo.woff2", weight: "400", style: "normal" },
    { path: "../assets/cubixles-logo.woff", weight: "400", style: "normal" },
    { path: "../assets/cubixles-logo.ttf", weight: "400", style: "normal" },
  ],
  display: "swap",
  variable: "--font-cubixles-logo",
});

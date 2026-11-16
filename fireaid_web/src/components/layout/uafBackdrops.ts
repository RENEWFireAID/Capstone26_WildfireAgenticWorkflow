// uaf.edu's section backdrops, as CSS background images: contour lines for
// UAF navy sections and scattered peaks for UAF Blue ones.
export const CONTOURS = [
  "repeating-radial-gradient(ellipse at 12% 20%, transparent 0 26px, rgba(135,209,230,0.07) 26px 27px)",
  "repeating-radial-gradient(ellipse at 88% 85%, transparent 0 30px, rgba(135,209,230,0.06) 30px 31px)",
].join(", ");

export const PEAKS = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><g fill='#111c4e' fill-opacity='0.35'><path d='M30 40l8 13H22z'/><path d='M160 30l6 10h-12z'/><path d='M110 120l9 15H101z'/><path d='M190 170l7 11h-14z'/><path d='M50 180l6 10H44z'/></g></svg>",
)}")`;

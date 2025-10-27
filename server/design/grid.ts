// server/design/grid.ts
export type GridInput = { density?: "minimal" | "normal" | "compact" };
export type GridTokens = {
  cssVars: Record<string, string>;
  cols: number; gutter: number; container: number; maxWidth: number;
};

export function buildGrid(input: GridInput = {}): GridTokens {
  const cols = 12;
  const density = input.density || "minimal";
  const gutter = density === "compact" ? 16 : density === "normal" ? 20 : 24;
  const container = 1200; // px
  const maxWidth = 1320;

  const cssVars: Record<string,string> = {
    "--grid-cols": String(cols),
    "--grid-gutter": `${gutter}px`,
    "--container": `${container}px`,
    "--container-max": `${maxWidth}px`,
    "--section-pad": density === "compact" ? "48px" : density === "normal" ? "64px" : "96px"
  };

  return { cssVars, cols, gutter, container, maxWidth };
}

'use client';

import React from "react";
// WeavyBoard.tsx lives in the SAME folder, so this import is foolproof.
import WeavyBoard from "./WeavyBoard";

export default function Showcase() {
  // No headings, no buttons—just the tutorial board.
  return <WeavyBoard />;
}

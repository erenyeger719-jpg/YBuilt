export function atomicWriteFile(
  finalPath: string,
  data: string | Buffer | object,
  options?: { encoding?: BufferEncoding }
): Promise<void>;

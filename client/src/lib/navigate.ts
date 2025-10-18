export function navigate(url: string) {
  if (!("startViewTransition" in document)) {
    window.location.href = url;
    return;
  }
  // @ts-ignore experimental
  (document as any).startViewTransition(() => {
    window.location.href = url;
  });
}

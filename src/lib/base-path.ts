export function basePath(): string {
  const href = document.querySelector("base")?.getAttribute("href");
  if (href === null || href === undefined) return "/";
  const trimmed = new URL(href, window.location.origin).pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

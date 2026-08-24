/**
 * footer.ts — the app footer rendered at the bottom of every shell page.
 */

export function footerMarkup(): string {
  return `
  <footer class="pb-footer">
    <div class="pb-footer__inner">
      <span>© 2569 Penbun System</span>
      <span class="pb-footer__version">PenbunWeb beta 1.3.0</span>
    </div>
  </footer>`;
}

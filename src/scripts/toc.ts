const toc = document.querySelector<HTMLElement>('.post-toc');

if (toc) {
  const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>('[data-heading-id]'));
  const sections = links
    .map((link) => document.getElementById(link.dataset.headingId ?? ''))
    .filter((section): section is HTMLElement => section instanceof HTMLElement);

  function updateCurrentHeading() {
    if (sections.length === 0) return;

    const marker = window.innerHeight * 0.28;
    let current = sections[0];

    for (const section of sections) {
      if (section.getBoundingClientRect().top > marker) break;
      current = section;
    }

    for (const link of links) {
      if (link.dataset.headingId === current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }

  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      updateCurrentHeading();
      scheduled = false;
    });
  }, { passive: true });
  window.addEventListener('resize', updateCurrentHeading);
  updateCurrentHeading();
}

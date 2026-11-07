interface ArchiveEntry {
  html: string;
  date: string;
  height: number;
}

const list = document.querySelector<HTMLOListElement>('#virtual-archive .article-list');
const filter = document.querySelector<HTMLFormElement>('#date-filter');
const dateFrom = document.querySelector<HTMLInputElement>('#date-from');
const dateTo = document.querySelector<HTMLInputElement>('#date-to');
const clearDates = document.querySelector<HTMLButtonElement>('#clear-dates');
const count = document.querySelector<HTMLElement>('#archive-count');
const empty = document.querySelector<HTMLElement>('#no-matches');
const topSpacer = document.querySelector<HTMLDivElement>('#top-spacer');
const bottomSpacer = document.querySelector<HTMLDivElement>('#bottom-spacer');
const topSentinel = document.querySelector<HTMLElement>('#top-sentinel');
const bottomSentinel = document.querySelector<HTMLElement>('#bottom-sentinel');
const previousButton = document.querySelector<HTMLButtonElement>('#load-previous');
const nextButton = document.querySelector<HTMLButtonElement>('#load-more');

if (
  list && filter && dateFrom && dateTo && clearDates && count && empty && topSpacer && bottomSpacer &&
  topSentinel && bottomSentinel && previousButton && nextButton
) {
  const articleList = list;
  const fromInput = dateFrom;
  const toInput = dateTo;
  const archiveCount = count;
  const noMatches = empty;
  const spacerBefore = topSpacer;
  const spacerAfter = bottomSpacer;
  const buttonPrevious = previousButton;
  const buttonNext = nextButton;
  const pageSize = 12;
  const maxPagesInDom = 3;
  const entries: ArchiveEntry[] = Array.from(articleList.children).map((element) => {
    const row = element as HTMLLIElement;
    return {
      html: row.outerHTML,
      date: row.querySelector('time')?.dateTime.slice(0, 10) ?? '',
      height: Math.ceil(row.getBoundingClientRect().height),
    };
  });

  let filtered = entries;
  let start = 0;
  let end = Math.min(pageSize, filtered.length);

  const heightBetween = (from: number, to: number) =>
    filtered.slice(from, to).reduce((total, entry) => total + entry.height, 0);

  function updateSpacers() {
    const beforeHeight = heightBetween(0, start);
    const afterHeight = heightBetween(end, filtered.length);
    spacerBefore.style.height = `${beforeHeight}px`;
    spacerAfter.style.height = `${afterHeight}px`;
    spacerBefore.hidden = beforeHeight === 0;
    spacerAfter.hidden = afterHeight === 0;
    buttonPrevious.hidden = start === 0;
    buttonNext.hidden = end >= filtered.length || 'IntersectionObserver' in window;
    articleList.hidden = filtered.length === 0;
    noMatches.hidden = filtered.length !== 0;

    archiveCount.textContent = filtered.length === 0
      ? 'Nenhum texto neste período.'
      : `Mostrando ${start + 1}–${end} de ${filtered.length} ${filtered.length === 1 ? 'texto' : 'textos'}`;
  }

  function renderWindow() {
    start = 0;
    end = Math.min(pageSize, filtered.length);
    articleList.innerHTML = filtered.slice(start, end).map((entry) => entry.html).join('');
    updateSpacers();
  }

  function loadNext() {
    if (end >= filtered.length) return;
    const nextEnd = Math.min(end + pageSize, filtered.length);
    articleList.insertAdjacentHTML('beforeend', filtered.slice(end, nextEnd).map((entry) => entry.html).join(''));
    end = nextEnd;

    if (end - start > pageSize * maxPagesInDom) {
      const removeCount = Math.min(pageSize, end - start - pageSize * (maxPagesInDom - 1));
      for (let index = 0; index < removeCount; index += 1) articleList.firstElementChild?.remove();
      start += removeCount;
    }
    updateSpacers();
  }

  function loadPrevious() {
    if (start === 0) return;
    const previousStart = Math.max(0, start - pageSize);
    articleList.insertAdjacentHTML('afterbegin', filtered.slice(previousStart, start).map((entry) => entry.html).join(''));
    start = previousStart;

    if (end - start > pageSize * maxPagesInDom) {
      const removeCount = Math.min(pageSize, end - start - pageSize * (maxPagesInDom - 1));
      for (let index = 0; index < removeCount; index += 1) articleList.lastElementChild?.remove();
      end -= removeCount;
    }
    updateSpacers();
  }

  function applyDateRange() {
    const from = fromInput.value;
    const to = toInput.value;
    filtered = entries.filter((entry) => (!from || entry.date >= from) && (!to || entry.date <= to));
    renderWindow();
  }

  function prepareForPrint() {
    articleList.innerHTML = filtered.map((entry) => entry.html).join('');
    articleList.hidden = filtered.length === 0;
    noMatches.hidden = filtered.length !== 0;
    spacerBefore.hidden = true;
    spacerAfter.hidden = true;
    buttonPrevious.hidden = true;
    buttonNext.hidden = true;
  }

  function restoreAfterPrint() {
    articleList.innerHTML = filtered.slice(start, end).map((entry) => entry.html).join('');
    updateSpacers();
  }

  filter.addEventListener('submit', (event) => {
    event.preventDefault();
    applyDateRange();
  });
  clearDates.addEventListener('click', () => {
    fromInput.value = '';
    toInput.value = '';
    applyDateRange();
  });
  buttonPrevious.addEventListener('click', loadPrevious);
  buttonNext.addEventListener('click', loadNext);
  window.addEventListener('beforeprint', prepareForPrint);
  window.addEventListener('afterprint', restoreAfterPrint);

  if ('IntersectionObserver' in window) {
    const observerOptions = { rootMargin: '480px 0px' };
    new IntersectionObserver((items) => {
      if (items.some((item) => item.isIntersecting)) loadPrevious();
    }, observerOptions).observe(topSentinel);
    new IntersectionObserver((items) => {
      if (items.some((item) => item.isIntersecting)) loadNext();
    }, observerOptions).observe(bottomSentinel);
  }

  filter.hidden = false;
  archiveCount.hidden = false;
  renderWindow();
}

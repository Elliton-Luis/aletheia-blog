interface ArchiveEntry {
  html: string;
  date: string;
  month: string;
  height: number;
  searchText: string;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const list = document.querySelector<HTMLOListElement>('#virtual-archive .article-list');
const searchFilter = document.querySelector<HTMLElement>('#search-filter');
const searchInput = document.querySelector<HTMLInputElement>('#search-text');
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
  list && searchFilter && searchInput && filter && dateFrom && dateTo && clearDates && count && empty &&
  topSpacer && bottomSpacer && topSentinel && bottomSentinel && previousButton && nextButton
) {
  const articleList = list;
  const textInput = searchInput;
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
  const monthHeadingHeight = Math.ceil(articleList.querySelector<HTMLElement>('.month-heading')?.getBoundingClientRect().height ?? 0);
  const entries: ArchiveEntry[] = Array.from(articleList.children).map((element) => {
    const row = element as HTMLLIElement;
    const date = row.querySelector<HTMLTimeElement>('.article-date')?.dateTime.slice(0, 10) ?? '';
    const heading = row.querySelector<HTMLElement>('.month-heading');
    const cleanRow = row.cloneNode(true) as HTMLLIElement;
    cleanRow.querySelector('.month-heading')?.remove();

    const titleNode = cleanRow.querySelector<HTMLElement>('.article-summary h3')?.cloneNode(true) as HTMLElement | undefined;
    titleNode?.querySelector('.sr-only')?.remove();
    const title = titleNode?.textContent ?? '';
    const description = cleanRow.querySelector<HTMLElement>('.article-summary p')?.textContent ?? '';
    const tags = Array.from(cleanRow.querySelectorAll<HTMLElement>('.tag-list a')).map((tag) => tag.textContent ?? '');

    return {
      html: cleanRow.outerHTML,
      date,
      month: date.slice(0, 7),
      height: Math.ceil(row.getBoundingClientRect().height - (heading?.getBoundingClientRect().height ?? 0)),
      searchText: normalize([title, description, ...tags].join(' ')),
    };
  });

  let filtered = entries;
  let start = 0;
  let end = Math.min(pageSize, filtered.length);

  function heightBetween(from: number, to: number) {
    let height = 0;
    let previousMonth = from > 0 ? filtered[from - 1].month : null;

    for (let index = from; index < to; index += 1) {
      const entry = filtered[index];
      if (entry.month !== previousMonth) height += monthHeadingHeight;
      height += entry.height;
      previousMonth = entry.month;
    }
    return height;
  }

  function monthHeading(entry: ArchiveEntry) {
    const date = new Date(`${entry.month}-01T00:00:00Z`);
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(date);
    const monthName = `${month.charAt(0).toLocaleUpperCase('pt-BR')}${month.slice(1)}`;
    const year = date.getUTCFullYear();
    return `<h2 class="month-heading" data-month="${entry.month}"><span>${monthName}</span><time datetime="${entry.month}-01">${year}</time></h2>`;
  }

  function renderRange(from: number, to: number, repeatHeaderAtStart = false) {
    let previousMonth = from > 0 ? filtered[from - 1].month : null;
    return filtered.slice(from, to).map((entry, offset) => {
      let html = entry.html;
      if (entry.month !== previousMonth || (repeatHeaderAtStart && offset === 0)) {
        html = html.replace(/class="article-row(?: month-start)?"/, 'class="article-row month-start"');
        const openingTagEnd = html.indexOf('>') + 1;
        html = `${html.slice(0, openingTagEnd)}${monthHeading(entry)}${html.slice(openingTagEnd)}`;
      }
      previousMonth = entry.month;
      return html;
    }).join('');
  }

  function updateSpacers() {
    const repeatedHeading = start > 0 && filtered[start]?.month === filtered[start - 1]?.month;
    const beforeHeight = heightBetween(0, start) - (repeatedHeading ? monthHeadingHeight : 0);
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
      ? 'Nenhum ensaio encontrado.'
      : `Mostrando ${start + 1}–${end} de ${filtered.length} ${filtered.length === 1 ? 'ensaio' : 'ensaios'}`;
  }

  function renderWindow() {
    start = 0;
    end = Math.min(pageSize, filtered.length);
    renderCurrentWindow();
  }

  function renderCurrentWindow() {
    articleList.innerHTML = renderRange(start, end, start > 0);
    updateSpacers();
  }

  function loadNext() {
    if (end >= filtered.length) return;
    const nextEnd = Math.min(end + pageSize, filtered.length);
    end = nextEnd;

    if (end - start > pageSize * maxPagesInDom) {
      const removeCount = Math.min(pageSize, end - start - pageSize * (maxPagesInDom - 1));
      start += removeCount;
    }
    renderCurrentWindow();
  }

  function loadPrevious() {
    if (start === 0) return;
    const previousStart = Math.max(0, start - pageSize);
    start = previousStart;

    if (end - start > pageSize * maxPagesInDom) {
      const removeCount = Math.min(pageSize, end - start - pageSize * (maxPagesInDom - 1));
      end -= removeCount;
    }
    renderCurrentWindow();
  }

  function applyFilters() {
    const from = fromInput.value;
    const to = toInput.value;
    const query = normalize(textInput.value);
    filtered = entries.filter((entry) =>
      (!from || entry.date >= from) &&
      (!to || entry.date <= to) &&
      (!query || entry.searchText.includes(query)),
    );
    renderWindow();
  }

  function prepareForPrint() {
    articleList.innerHTML = renderRange(0, filtered.length);
    articleList.hidden = filtered.length === 0;
    noMatches.hidden = filtered.length !== 0;
    spacerBefore.hidden = true;
    spacerAfter.hidden = true;
    buttonPrevious.hidden = true;
    buttonNext.hidden = true;
  }

  function restoreAfterPrint() {
    articleList.innerHTML = renderRange(start, end, start > 0);
    updateSpacers();
  }

  filter.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });
  clearDates.addEventListener('click', () => {
    fromInput.value = '';
    toInput.value = '';
    applyFilters();
  });
  textInput.addEventListener('input', applyFilters);
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

  searchFilter.hidden = false;
  filter.hidden = false;
  archiveCount.hidden = false;
  renderWindow();
}

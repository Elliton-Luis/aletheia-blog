function toRoman(num: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let res = '';
  for (const [val, letter] of map) {
    while (num >= val) {
      res += letter;
      num -= val;
    }
  }
  return res || 'I';
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function initAntologia() {
  const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('.essay-checkbox'));
  const recentItems = Array.from(document.querySelectorAll<HTMLElement>('.recent-essay-item'));
  const searchInput = document.querySelector<HTMLInputElement>('#builder-search-input');
  const countDisplay = document.querySelector<HTMLElement>('#selected-count');
  const warningDisplay = document.querySelector<HTMLElement>('#selection-warning');
  const btnRecent10 = document.querySelector<HTMLButtonElement>('#btn-select-recent-10');
  const btnClear = document.querySelector<HTMLButtonElement>('#btn-clear-selection');

  const coverCount = document.querySelector<HTMLElement>('#book-cover-count');
  const tocList = document.querySelector<HTMLOListElement>('#book-toc-list');
  const chapters = Array.from(document.querySelectorAll<HTMLElement>('.book-chapter'));
  const emptyBookNote = document.querySelector<HTMLElement>('#empty-book-note');
  const colophonCount = document.querySelector<HTMLElement>('#colophon-count');

  const btnExportPdf = document.querySelector<HTMLButtonElement>('#btn-export-pdf');
  const btnExportBooklet = document.querySelector<HTMLButtonElement>('#btn-export-booklet');
  const bookletPanel = document.querySelector<HTMLElement>('#booklet-panel');
  const btnPrintA5 = document.querySelector<HTMLButtonElement>('#btn-print-a5');
  const bookletDropzone = document.querySelector<HTMLElement>('#booklet-dropzone');
  const bookletFileInput = document.querySelector<HTMLInputElement>('#booklet-file-input');
  const bookletStatus = document.querySelector<HTMLElement>('#booklet-status');

  function getSelectedSlugs(): string[] {
    return checkboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.slug || '');
  }

  function updateBookView() {
    const selectedSlugs = getSelectedSlugs();
    const count = selectedSlugs.length;

    // Atualiza contadores
    if (countDisplay) countDisplay.textContent = String(count);
    if (coverCount) {
      coverCount.textContent = count === 0
        ? 'Nenhum ensaio selecionado'
        : `Antologia · ${count} ${count === 1 ? 'Ensaio Selecionado' : 'Ensaios Selecionados'}`;
    }
    if (colophonCount) {
      colophonCount.textContent = `${count} ${count === 1 ? 'ensaio seminal' : 'ensaios seminais'}`;
    }

    if (emptyBookNote) {
      emptyBookNote.hidden = count > 0;
    }

    // Filtra e renumera capítulos
    let visibleIndex = 0;
    const tocItems: string[] = [];

    chapters.forEach((chapter) => {
      const slug = chapter.dataset.slug || '';
      const isSelected = selectedSlugs.includes(slug);

      if (isSelected) {
        chapter.hidden = false;
        visibleIndex += 1;
        const roman = toRoman(visibleIndex);

        // Atualiza cabeçalho do capítulo
        const romanSpan = chapter.querySelector('.chapter-roman-num');
        if (romanSpan) romanSpan.textContent = `Capítulo ${roman}`;

        // Dados para o sumário
        const title = chapter.dataset.title || '';
        const meta = chapter.dataset.meta || '';
        tocItems.push(`
          <li>
            <a href="#capitulo-${slug}">
              <span class="toc-roman">Capítulo ${roman}</span>
              <span class="toc-title">${title}</span>
              <span class="toc-dots" aria-hidden="true"></span>
              <span class="toc-meta">${meta}</span>
            </a>
          </li>
        `);
      } else {
        chapter.hidden = true;
      }
    });

    if (tocList) {
      tocList.innerHTML = tocItems.join('');
    }

    // Atualiza classes ativas nos itens da caixinha
    recentItems.forEach((item) => {
      const slug = item.dataset.slug || '';
      const isChecked = selectedSlugs.includes(slug);
      item.classList.toggle('selected', isChecked);
    });
  }

  // Listener para checkboxes
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const currentSelected = getSelectedSlugs();
      if (cb.checked && currentSelected.length > 10) {
        cb.checked = false;
        if (warningDisplay) {
          warningDisplay.hidden = false;
          setTimeout(() => {
            if (warningDisplay) warningDisplay.hidden = true;
          }, 3500);
        }
        return;
      }
      if (warningDisplay) warningDisplay.hidden = true;
      updateBookView();
    });
  });

  // Busca na caixinha de ensaios recentes
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = normalize(searchInput.value);
      recentItems.forEach((item) => {
        const text = normalize(item.dataset.search || '');
        item.hidden = Boolean(query && !text.includes(query));
      });
    });
  }

  // Botão 10 Mais Recentes
  btnRecent10?.addEventListener('click', () => {
    checkboxes.forEach((cb, idx) => {
      cb.checked = idx < 10;
    });
    if (warningDisplay) warningDisplay.hidden = true;
    updateBookView();
  });

  // Botão Limpar Seleção
  btnClear?.addEventListener('click', () => {
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
    if (warningDisplay) warningDisplay.hidden = true;
    updateBookView();
  });

  // Opção 1: Baixar PDF (A4 Sequencial)
  btnExportPdf?.addEventListener('click', () => {
    document.body.classList.remove('print-mode-a5');
    window.print();
  });

  // Opção 2: Alternar painel Livreto A5
  btnExportBooklet?.addEventListener('click', () => {
    if (bookletPanel) {
      bookletPanel.hidden = !bookletPanel.hidden;
      if (!bookletPanel.hidden) {
        bookletPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Impressão direta em modo A5
  btnPrintA5?.addEventListener('click', () => {
    document.body.classList.add('print-mode-a5');
    window.print();
  });

  // Drag-and-drop e upload para o conversor de Livreto A5
  bookletDropzone?.addEventListener('click', () => {
    bookletFileInput?.click();
  });

  bookletDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    bookletDropzone.classList.add('drag-active');
  });

  bookletDropzone?.addEventListener('dragleave', () => {
    bookletDropzone.classList.remove('drag-active');
  });

  bookletDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    bookletDropzone.classList.remove('drag-active');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') {
      processPdfForBooklet(file);
    } else if (bookletStatus) {
      bookletStatus.textContent = '⚠️ Por favor, selecione um arquivo em formato PDF.';
      bookletStatus.hidden = false;
    }
  });

  bookletFileInput?.addEventListener('change', () => {
    const file = bookletFileInput.files?.[0];
    if (file) {
      processPdfForBooklet(file);
    }
  });

  async function processPdfForBooklet(file: File) {
    if (!bookletStatus) return;
    bookletStatus.hidden = false;
    bookletStatus.className = 'booklet-status processing';
    bookletStatus.textContent = '⏳ Impondo páginas em formato Livreto A5 (folhas A4 paisagem)...';

    try {
      const buffer = await file.arrayBuffer();
      const bookletBytes = await generateBookletPdf(buffer);

      const blob = new Blob([bookletBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aletheia-livreto-A5-${Date.now().toString(36)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      bookletStatus.className = 'booklet-status success';
      bookletStatus.innerHTML = '✅ <strong>Livreto A5 gerado e baixado!</strong><br/>Imprima em frente e verso (virar na borda curta / short edge), junte as folhas e dobre ao meio para formar o livro encadernado.';
    } catch (err: any) {
      bookletStatus.className = 'booklet-status error';
      bookletStatus.textContent = `⚠️ Erro ao converter o PDF: ${err.message || 'Arquivo inválido'}`;
    }
  }

  // Inicializa a visão com os itens marcados
  updateBookView();
}

async function generateBookletPdf(fileBuffer: ArrayBuffer): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const original = await PDFDocument.load(fileBuffer);
  const totalOriginal = original.getPageCount();
  const totalBooklet = Math.ceil(totalOriginal / 4) * 4;

  const booklet = await PDFDocument.create();
  // Folha A4 em Paisagem: 297mm x 210mm = 841.89 x 595.28 pt
  const sheetWidth = 841.89;
  const sheetHeight = 595.28;
  const halfWidth = sheetWidth / 2;

  const numSheets = totalBooklet / 4;

  for (let s = 0; s < numSheets; s++) {
    // ----------------------------------------------------
    // Lado 1 (Frente da folha A4):
    // Página Esquerda: última página disponível no bloco (totalBooklet - 2*s)
    // Página Direita: primeira página do bloco (2*s + 1) -> Capa na Folha 1
    // ----------------------------------------------------
    const pLeftFrontIdx = totalBooklet - 2 * s - 1;
    const pRightFrontIdx = 2 * s;

    const frontPage = booklet.addPage([sheetWidth, sheetHeight]);

    if (pLeftFrontIdx < totalOriginal) {
      const [embLeft] = await booklet.embedPdf(original, [pLeftFrontIdx]);
      const scale = Math.min(halfWidth / embLeft.width, sheetHeight / embLeft.height);
      const w = embLeft.width * scale;
      const h = embLeft.height * scale;
      const x = (halfWidth - w) / 2;
      const y = (sheetHeight - h) / 2;
      frontPage.drawPage(embLeft, { x, y, width: w, height: h });
    }

    if (pRightFrontIdx < totalOriginal) {
      const [embRight] = await booklet.embedPdf(original, [pRightFrontIdx]);
      const scale = Math.min(halfWidth / embRight.width, sheetHeight / embRight.height);
      const w = embRight.width * scale;
      const h = embRight.height * scale;
      const x = halfWidth + (halfWidth - w) / 2;
      const y = (sheetHeight - h) / 2;
      frontPage.drawPage(embRight, { x, y, width: w, height: h });
    }

    // ----------------------------------------------------
    // Lado 2 (Verso da folha A4):
    // Página Esquerda: 2ª página do bloco (2*s + 2)
    // Página Direita: penúltima página do bloco (totalBooklet - 2*s - 1)
    // ----------------------------------------------------
    const pLeftBackIdx = 2 * s + 1;
    const pRightBackIdx = totalBooklet - 2 * s - 2;

    const backPage = booklet.addPage([sheetWidth, sheetHeight]);

    if (pLeftBackIdx < totalOriginal) {
      const [embLeft] = await booklet.embedPdf(original, [pLeftBackIdx]);
      const scale = Math.min(halfWidth / embLeft.width, sheetHeight / embLeft.height);
      const w = embLeft.width * scale;
      const h = embLeft.height * scale;
      const x = (halfWidth - w) / 2;
      const y = (sheetHeight - h) / 2;
      backPage.drawPage(embLeft, { x, y, width: w, height: h });
    }

    if (pRightBackIdx < totalOriginal) {
      const [embRight] = await booklet.embedPdf(original, [pRightBackIdx]);
      const scale = Math.min(halfWidth / embRight.width, sheetHeight / embRight.height);
      const w = embRight.width * scale;
      const h = embRight.height * scale;
      const x = halfWidth + (halfWidth - w) / 2;
      const y = (sheetHeight - h) / 2;
      backPage.drawPage(embRight, { x, y, width: w, height: h });
    }
  }

  return await booklet.save();
}

// Inicializa automaticamente se o DOM estiver pronto
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAntologia);
  } else {
    initAntologia();
  }
}

import { Editor } from 'tinymce';
import { ACListItem, AutoCompleteOptions } from '.';

const wordJoiner = '\u2060';

const render = (item: ACListItem, index: number, opts: AutoCompleteOptions<string>) =>
  `<li><a href="javascript:;"><span data-idx="${index}">${item[opts.queryBy]}</span></a></li>`;

const insert = (item: ACListItem, opts: AutoCompleteOptions<string>) =>
  `<span>${item[opts.insertFrom || opts.queryBy]}</span>&nbsp;`;

const highlighter = (text: string) => text;

const autoCompleteDefaults: AutoCompleteOptions<string> = {
  source: [],
  delay: 500,
  queryBy: 'name',
  insertFrom: 'name',
  items: 10,
  delimiter: '@',
  render,
  insert,
  highlighter,
};

class AutoComplete {
  private editor: any;
  private options: AutoCompleteOptions<string>;
  private query: string = '';
  private searchTimeout?: number;
  private $dropdown: HTMLElement | null = null;
  private handleEditorScroll!: () => void;
  hasFocus: boolean = true;

  constructor(editor: any, options: Partial<AutoCompleteOptions<string>>) {
    this.editor = editor;
    this.options = Object.assign({}, autoCompleteDefaults, options);

    // Render the input and bind events.
    this.renderInput();
    this.bindEvents();
  }

  private renderInput(): void {
    const rawHtml = `
      <span id="autocomplete">
          <span id="autocomplete-delimiter">${this.options.delimiter || ''}</span>
          <span id="autocomplete-searchtext"><span class="dummy">${wordJoiner}</span></span>
      </span>
    `;

    this.editor.execCommand('mceInsertContent', false, rawHtml);
    this.editor.focus();

    // Move the caret inside the #autocomplete-searchtext
    const inputElement = this.editor.selection.dom.select('span#autocomplete-searchtext span')[0];
    this.editor.selection.select(inputElement);
    this.editor.selection.collapse(0);
  }

  private bindEvents(): void {
    this.editor.on('keyup', this.rteKeyUp.bind(this));
    this.editor.on('keydown', this.rteKeyDown.bind(this), true);
    this.editor.on('click', this.rteClicked.bind(this));

    document.body.addEventListener('click', this.rteLostFocus.bind(this));

    // Store reference so we can unbind easily
    this.handleEditorScroll = () => this.cleanUp(true);
    this.editor.getWin().addEventListener('scroll', this.handleEditorScroll);
  }

  private rteKeyUp(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Shift':
      case 'Control':
      case 'Alt':
        // Do nothing
        break;
      case 'Backspace':
        // If the query is empty, remove mention
        if (this.query === '') {
          this.cleanUp(true);
        } else {
          this.lookup();
        }
        break;
      case 'Tab':
      case 'Enter':
        if (this.$dropdown) {
          const activeItem = this.$dropdown.querySelector('li.active') as HTMLElement;
          if (activeItem) {
            this.select(activeItem.dataset);
            this.cleanUp(false);
          } else {
            this.cleanUp(true);
          }
        }
        break;
      case 'Escape':
        this.cleanUp(true);
        break;
      default:
        this.lookup();
    }
  }

  private rteKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Tab':
      case 'Enter':
      case 'Escape':
        // Prevent the default action so we handle it in rteKeyUp
        event.preventDefault();
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.$dropdown) {
          this.highlightPreviousResult();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (this.$dropdown) {
          this.highlightNextResult();
        }
        break;
    }
    event.stopPropagation();
  }

  private rteClicked(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.hasFocus && target.parentElement?.id !== 'autocomplete-searchtext') {
      this.cleanUp(true);
    }
  }

  private rteLostFocus(): void {
    if (this.hasFocus) {
      this.cleanUp(true);
    }
  }

  private lookup(): void {
    // If we no longer have focus, bail out
    if (!this.hasFocus) return;

    const searchTextElement = this.editor.getBody().querySelector('#autocomplete-searchtext') as HTMLElement | null;
    this.query = searchTextElement?.textContent?.trim().replace(wordJoiner, '') || '';

    // If there's no #autocomplete in DOM anymore, bail out
    if (!this.editor.getBody().querySelector('#autocomplete')) {
      return;
    }

    // Show the dropdown if not already present
    if (!this.$dropdown) {
      this.show();
    }

    clearTimeout(this.searchTimeout);
    this.searchTimeout = window.setTimeout(() => {
      const items = this.options.source;
      if (!items) return;

      if (Array.isArray(items)) {
        this.process(items);
      } else {
        // source is a function
        items(this.query, this.options.delimiter!, this.process.bind(this));
      }
    }, this.options.delay);
  }

  private process(data: ACListItem[]): void {
    if (!this.hasFocus) return;

    console.log('data Received in process', data);
    const matchedItems = data.filter(
      this.options.matcher ||
        ((item) => item[this.options.queryBy].toLowerCase().includes(this.query.toLowerCase()))
    );

    const sortedItems = this.options.sorter ? this.options.sorter(matchedItems) : matchedItems;
    const limitedItems = sortedItems.slice(0, this.options.items);

    const result = limitedItems.reduce((r, item, i) => {
      const element = document.createElement('div');
      element.innerHTML = this.options.render!(item, i, this.options);
      const text = element.textContent || '';
      element.innerHTML = element.innerHTML.replace(text, this.options.highlighter!(text) || '');
      Object.entries(item).forEach(([key, val]) => {
        element.dataset[key] = `${val}`;
      });
      r += element.outerHTML;
      return r;
    }, '');

    if (result.length) {
      if (this.$dropdown) {
        this.$dropdown.innerHTML = result;
        this.$dropdown.style.display = 'block';
      }
    } else {
      if (this.$dropdown) {
        this.$dropdown.style.display = 'none';
      }
    }
  }

  private show(): void {
    const dropdown = document.createElement('ul');
    dropdown.className = 'rte-autocomplete dropdown-menu';
    dropdown.innerHTML = '<li class="loading"></li>';

    const offset = this.offset();
    dropdown.style.top = `${offset.top}px`;
    dropdown.style.left = `${offset.left}px`;

    document.body.appendChild(dropdown);
    dropdown.addEventListener('click', (e) => this.autoCompleteClick(e));
    this.$dropdown = dropdown;
  }

  private autoCompleteClick(event: MouseEvent): void {
    const li = (event.target as HTMLElement).closest('li');
    if (!li) return;

    // If the dataset is actually on the <span>:
    const span = li.querySelector('span[data-idx]');
    if (span) {
      const val = span.innerHTML;
      console.log('Span dataset:', (span as HTMLElement).dataset);
      this.select({ value: val });
    }

    this.cleanUp(false);
    event.stopPropagation();
    event.preventDefault();
  }

  private highlightPreviousResult(): void {
    const items = this.$dropdown?.querySelectorAll('li') || [];
    const activeIndex = Array.from(items).findIndex((item) => item.classList.contains('active'));
    const newIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;

    items.forEach((item) => item.classList.remove('active'));
    if (items[newIndex]) {
      items[newIndex].classList.add('active');
    }
  }

  private highlightNextResult(): void {
    const items = this.$dropdown?.querySelectorAll('li') || [];
    const activeIndex = Array.from(items).findIndex((item) => item.classList.contains('active'));
    const newIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;

    items.forEach((item) => item.classList.remove('active'));
    if (items[newIndex]) {
      items[newIndex].classList.add('active');
    }
  }

  private select(item: DOMStringMap): void {
    this.editor.focus();

    // Grab the autocomplete element from the body or activeElement
    const autocompleteElement = this.editor.getBody().querySelector('#autocomplete');
    if (!autocompleteElement) return;

    this.editor.dom.remove(autocompleteElement);
    this.options.insertFrom = 'value';

    console.log('item', item, this.options, this.options.insert);
    const result = this.options.insert!(item as ACListItem, this.options);
    console.log('result', result);

    this.editor.execCommand('mceInsertContent', false, result);
  }

  private offset(): { top: number; left: number } {
    // Find #autocomplete if it still exists
    const autocompleteElement = this.editor.getBody().querySelector('#autocomplete') as HTMLElement | null;
    if (!autocompleteElement) {
      // If not found, just return (avoid throwing an error)
      return { top: 0, left: 0 };
    }

    // Calculate positions
    const rect = autocompleteElement.getBoundingClientRect();
    const editorDoc = this.editor.getDoc();
    const scrollTop = editorDoc?.documentElement?.scrollTop || 0;
    const scrollLeft = editorDoc?.documentElement?.scrollLeft || 0;

    // Slight offset
    return {
      top: rect.top + scrollTop + autocompleteElement.offsetHeight + 5,
      left: rect.left + scrollLeft,
    };
  }

  private cleanUp(rollback: boolean): void {
    this.unbindEvents();
    this.hasFocus = false;

    this.$dropdown?.remove();
    this.$dropdown = null;

    if (rollback) {
      // The user aborted mention
      const text = this.query;
      const selection = this.editor.dom.select('span#autocomplete')[0];
      if (!selection) return;

      const replacement = document.createElement('p');
      replacement.textContent = this.options.delimiter + text;

      this.editor.dom.replace(replacement, selection);
      this.editor.selection.select(replacement);
      this.editor.selection.collapse();
    } else {
      // The mention was completed successfully
      console.log('mentionfinished');
      this.editor.fire('mentionfinished');
    }
  }

  private unbindEvents(): void {
    document.body.removeEventListener('click', this.rteLostFocus.bind(this));
    this.editor.off('keyup', this.rteKeyUp.bind(this));
    this.editor.off('keydown', this.rteKeyDown.bind(this));
    this.editor.off('click', this.rteClicked.bind(this));
    this.editor.getWin().removeEventListener('scroll', this.handleEditorScroll);
  }
}

const PLUGIN_NAME = 'mention';
const getMetadata = () => {
  return {
    name: PLUGIN_NAME,
    author: 'Surya Pratap',
    url: 'https://github.com/suryapratap/tinymce-mention-plugin',
  };
};

function registerPlugin(editor: Editor) {
  let autoComplete: AutoComplete | undefined;

  const autoCompleteData = editor.getParam(PLUGIN_NAME) as AutoCompleteOptions<string[]>;
  const delimiter = Array.isArray(autoCompleteData.delimiter)
    ? autoCompleteData.delimiter
    : [autoCompleteData.delimiter || '@'];

  function prevCharIsSpace() {
    const range = editor.selection.getRng();
    const start = range.startOffset;
    // If the container text is empty or we can't read it, fallback to an empty string
    const text = (range.startContainer?.textContent || '').toString();
    return !text.charAt(start - 1)?.trim().length;
  }

  editor.on('keypress', (event: KeyboardEvent) => {
    // If not a recognized delimiter, ignore
    if (!delimiter.includes(event.key)) {
      console.log('not delimiter', event.key, { delimiter });
      return;
    }
    // If previous character isn't space, ignore
    if (!prevCharIsSpace()) {
      console.log('not prevCharIsSpace', event.key, { delimiter });
      return;
    }
    // If an autoComplete is already open and hasFocus, ignore
    if (autoComplete && autoComplete.hasFocus) {
      console.log('not autoComplete', event.key, { delimiter }, autoComplete.hasFocus);
      return;
    }

    // Activate mention
    event.preventDefault();
    console.log('activate mentions autocomplete', event.key, { delimiter }, autoComplete?.hasFocus);

    autoComplete = new AutoComplete(editor, {
      ...autoCompleteData,
      delimiter: event.key,
    });
  });

  // Once mention is finished, kill reference
  editor.on('mentionfinished', () => {
    console.log('mentionfinished plugin event');
    autoComplete = undefined;
  });

  return { getMetadata };
}

// Register plugin
(window as any).tinymce.PluginManager.add(PLUGIN_NAME, registerPlugin);

import { Editor } from 'tinymce';
import { ACListItem, AutoCompleteOptions } from '.';

const wordJoiner = '\u2060';

const render = (item: ACListItem, index: number, opts: AutoCompleteOptions<string>) => `<li><a href="javascript:;"><span data-idx="${index}">${item[opts.queryBy]}</span></a></li>`;

const insert = (item: ACListItem, opts: AutoCompleteOptions<string>) => `<span>${item[opts.insertFrom || opts.queryBy]}</span>&nbsp;`;

const highlighter = (text: string) => text;


const autoCompleteDefaults: AutoCompleteOptions<string> = {
    source: [],
    delay: 500,
    queryBy: 'name',
    insertFrom: 'name',
    items: 10,
    delimiter: "@",
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
    hasFocus: boolean = true;

    constructor(editor: any, options: Partial<AutoCompleteOptions<string>>) {
        this.editor = editor;
        this.options = Object.assign({}, autoCompleteDefaults, options);
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
        const inputElement = this.editor.selection.dom.select('span#autocomplete-searchtext span')[0];
        this.editor.selection.select(inputElement);
        this.editor.selection.collapse(0);
    }

    private bindEvents(): void {
        this.editor.on('keyup', this.rteKeyUp.bind(this));
        this.editor.on('keydown', this.rteKeyDown.bind(this), true);
        this.editor.on('click', this.rteClicked.bind(this));

        document.body.addEventListener('click', this.rteLostFocus.bind(this));
        this.editor.getWin().addEventListener('scroll', () => this.cleanUp(true));
    }

    private rteKeyUp(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'Shift':
            case 'Control':
            case 'Alt':
                break;
            case 'Backspace':
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
        const searchTextElement = this.editor.getBody().querySelector('#autocomplete-searchtext') as HTMLElement | null;
        this.query = searchTextElement?.textContent?.trim().replace(wordJoiner, '') || '';

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
                // here we have a fun that take a call back
                items(this.query, this.options.delimiter!, this.process.bind(this))
            }
        }, this.options.delay);
    }

    private process(data: ACListItem[]): void {
        
        if (!this.hasFocus) return;
        console.log("data Recived in porcess ", data);
        console.log(this.options.queryBy, this.query, data);
        const matchedItems = data.filter(this.options.matcher || ((item) =>
            item[this.options.queryBy].toLowerCase().includes(this.query.toLowerCase())));

        const sortedItems = this.options.sorter ? this.options.sorter(matchedItems) : matchedItems;
        const limitedItems = sortedItems.slice(0, this.options.items);
        const result = limitedItems.reduce((r, item, i, arr) => {
            const element = document.createElement('div');
            element.innerHTML = this.options.render!(item, i, this.options!);
            const text = element.textContent || "";
            element.innerHTML = element.innerHTML.replace(text, this.options.highlighter!(text) || '');
            Object.entries(item).forEach(([key, val]) => element.dataset[key] = `${val}`);
            r = `${r}${element.outerHTML}`;
            // document.removeChild(element);
            console.log(r, element)
            return r;
        }, "")


        if (result.length) {
            this.$dropdown!.innerHTML = result;
            this.$dropdown!.style.display = 'block';
        } else {
            this.$dropdown!.style.display = 'none';
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
          console.log('Span dataset:', (span as HTMLElement).dataset);
          this.select((span as HTMLElement).dataset);
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
        items[newIndex]?.classList.add('active');
    }

    private highlightNextResult(): void {
        const items = this.$dropdown?.querySelectorAll('li') || [];
        const activeIndex = Array.from(items).findIndex((item) => item.classList.contains('active'));
        const newIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;

        items.forEach((item) => item.classList.remove('active'));
        items[newIndex]?.classList.add('active');
    }

    private select(item: DOMStringMap): void {
        this.editor.focus();
        const autocompleteElement = (this.editor.dom.doc.activeElement as HTMLElement).querySelector('#autocomplete');
        if (!autocompleteElement) return;
        const selection = autocompleteElement;
        console.log("selection", selection);
        this.editor.dom.remove(selection);
        console.log("item", item, this.options);
        var result = this.options.insert!(item as ACListItem, this.options)
        console.log("result", result);
        this.editor.execCommand('mceInsertContent', false, result);
    }

    private offset(): { top: number; left: number } {
        console.log("this.editor", this.editor,"this.editor.dom.document", this.editor.dom.doc.activeElement);
        const rtePosition = (this.editor.dom.doc.activeElement as HTMLElement).getBoundingClientRect();
        const contentAreaPosition = ((this.editor.dom.doc.activeElement as HTMLElement)).getBoundingClientRect();
        const autocompleteElement = (this.editor.dom.doc.activeElement as HTMLElement).querySelector('#autocomplete') as HTMLElement | null;
        if (!autocompleteElement) {
            throw new Error('Autocomplete element not found');
        }
        const nodePosition = autocompleteElement.getBoundingClientRect();

        return {
            top: rtePosition.top + contentAreaPosition.top + nodePosition.top + (this.editor.selection.getNode() as HTMLElement).offsetHeight - this.editor.getDoc().scrollTop + 5,
            left: rtePosition.left + contentAreaPosition.left + nodePosition.left,
        };
    }

    private cleanUp(rollback: boolean): void {
        this.unbindEvents();
        this.hasFocus = false;

        this.$dropdown?.remove();
        this.$dropdown = null;

        if (rollback) {
            const text = this.query;
            const selection = this.editor.dom.select('span#autocomplete')[0];
            if (!selection) return;

            const replacement = document.createElement('p');
            replacement.textContent = this.options.delimiter + text;

            this.editor.dom.replace(replacement, selection);
            this.editor.selection.select(replacement);
            this.editor.selection.collapse();
        }
    }

    private unbindEvents(): void {
        document.body.removeEventListener('click', this.rteLostFocus.bind(this));
        this.editor.off('keyup', this.rteKeyUp.bind(this));
        this.editor.off('keydown', this.rteKeyDown.bind(this));
        this.editor.off('click', this.rteClicked.bind(this));
    }
}

const PLUGIN_NAME = "mention";
const getMetadata = () => {
    return {
        name: PLUGIN_NAME,
        author: "Surya Pratap",
        url: "https://github.com/suryapratap/tinymce-mention-plugin"
    };
}

function registerPlugin(editor: Editor) {

    let autoComplete: AutoComplete | undefined;
    const autoCompleteData = editor.getParam(PLUGIN_NAME) as AutoCompleteOptions<string[]>;
    const delimiter = autoCompleteData.delimiter
        ? Array.isArray(autoCompleteData.delimiter)
            ? autoCompleteData.delimiter
            : [autoCompleteData.delimiter]
        : ['@'];

    function prevCharIsSpace() {
        const range = editor.selection.getRng();
        const start = range.startOffset;
        const text = ((range.startContainer as HTMLElement)?.dataset) || '';
        return !text.toString().charAt(start - 1).trim().length;
    }
    editor.on('keypress', (event: KeyboardEvent) => {
        if (delimiter.includes(event.key) && prevCharIsSpace() && (!autoComplete || !autoComplete?.hasFocus)) {
            event.preventDefault();
            console.log("activate mentions autocomplete", event.key, { delimiter }, autoComplete?.hasFocus);
            autoComplete = new AutoComplete(editor, { ...autoCompleteData, delimiter: event.key });
        }
    });

    return { getMetadata }
}

(window as any).tinymce.PluginManager.add(PLUGIN_NAME, registerPlugin);




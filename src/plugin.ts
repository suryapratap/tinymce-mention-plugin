import { Editor } from 'tinymce';

type AutoCompleteOptions = {
    source: any[] | Function;
    delay: number;
    queryBy: string;
    insertFrom?: string;
    items: number;
    delimiter?: string | string[];
    matcher?: (item: any) => boolean;
    sorter?: (items: any[]) => any[];
    renderDropdown?: () => string;
    render?: (item: any, index: number) => string;
    insert?: (item: any) => string;
    highlighter?: (text: string) => string;
};

class AutoComplete {
    private editor: any;
    private options: AutoCompleteOptions;
    private query: string = '';
    private searchTimeout?: number;
    private $dropdown: HTMLElement | null = null;
    hasFocus: boolean = true;

    constructor(editor: any, options: Partial<AutoCompleteOptions>) {
        this.editor = editor;
        this.options = Object.assign(
            {
                source: [],
                delay: 500,
                queryBy: 'name',
                items: 10,
            },
            options
        );

        this.options.insertFrom = this.options.insertFrom || this.options.queryBy;

        this.renderInput();
        this.bindEvents();
    }

    private renderInput(): void {
        const rawHtml = `
      <span id="autocomplete">
          <span id="autocomplete-delimiter">${this.options.delimiter || ''}</span>
          <span id="autocomplete-searchtext"><span class="dummy">\uFEFF</span></span>
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
        this.query = searchTextElement?.textContent?.trim().replace('\uFEFF', '') || '';

        if (!this.$dropdown) {
            this.show();
        }

        clearTimeout(this.searchTimeout);
        this.searchTimeout = window.setTimeout(() => {
            const items =
                typeof this.options.source === 'function'
                    ? this.options.source(this.query, this.process.bind(this), this.options.delimiter)
                    : this.options.source;

            if (items) {
                this.process(items);
            }
        }, this.options.delay);
    }

    private process(data: any[]): void {
        if (!this.hasFocus) return;

        const matchedItems = data.filter(this.options.matcher || ((item) =>
            item[this.options.queryBy].toLowerCase().includes(this.query.toLowerCase())));

        const sortedItems = this.options.sorter ? this.options.sorter(matchedItems) : matchedItems;
        const limitedItems = sortedItems.slice(0, this.options.items);

        const result = limitedItems
            .map((item, i) => {
                const element = document.createElement('div');
                element.innerHTML = this.options.render
                    ? this.options.render(item, i)
                    : `<li><a href="javascript:;"><span>${item[this.options.queryBy]}</span></a></li>`;

                element.innerHTML = element.innerHTML.replace(
                    element.textContent || '',
                    this.options.highlighter?.(element.textContent || '') || element.textContent || ''
                );

                Object.entries(item).forEach(([key, val]) => {
                    element.dataset[key] = String(val);
                });

                return element.outerHTML;
            })
            .join('');

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
        const target = (event.target as HTMLElement).closest('li');
        if (target) {
            this.select(target.dataset);
            this.cleanUp(false);
        }
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
        const selection = this.editor.dom.select('span#autocomplete')[0];
        this.editor.dom.remove(selection);
        this.editor.execCommand('mceInsertContent', false, this.options.insert ? this.options.insert(item) : `<span>${item[this.options.insertFrom || this.options.queryBy]}</span>&nbsp;`);
    }

    private offset(): { top: number; left: number } {
        const rtePosition = this.editor.getContainer().getBoundingClientRect();
        const contentAreaPosition = this.editor.getContentAreaContainer().getBoundingClientRect();
        const nodePosition = (this.editor.dom.select('span#autocomplete')[0] as HTMLElement).getBoundingClientRect();

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

const registerPlugin = (editor: Editor) => {
    console.log("register mention plugin");

    let autoComplete: AutoComplete | undefined;
    const autoCompleteData = editor.getParam(PLUGIN_NAME) as AutoCompleteOptions;


    autoCompleteData.delimiter = autoCompleteData.delimiter
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

    console.log("register keypress for mention plugin");
    editor.on('keypress', (event: KeyboardEvent) => {
        if (!!autoCompleteData?.delimiter?.includes(event.key) && prevCharIsSpace() && (!autoComplete || !autoComplete?.hasFocus)) {
            event.preventDefault();
            autoComplete = new AutoComplete(editor, { delimiter: event.key, ...autoCompleteData });
        }
    });

    return { getMetadata }
}

(window as any).tinymce.PluginManager.add(PLUGIN_NAME, registerPlugin);




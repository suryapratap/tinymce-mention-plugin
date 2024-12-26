export type ACListItem = {
    [key: string]: string;
}

export type ACSoucrceCallback = (items: ACListItem[]) => void;

export type ACSourceFn = (query: string, delimiter: string, callback: ACSoucrceCallback) => void;

export type AutoCompleteOptions<TDelemeter> = {
    source: ACListItem[] | ACSourceFn;
    delay: number;
    queryBy: string;
    insertFrom?: string;
    items: number;
    delimiter?: TDelemeter;
    matcher?: (item: ACListItem) => boolean;
    sorter?: (items: ACListItem[]) => any[];
    renderDropdown?: () => string;
    render?: (item: ACListItem, index: number, opts: AutoCompleteOptions<string>) => string;
    insert?: (item: ACListItem, opts: AutoCompleteOptions<string>) => string;
    highlighter?: (text: string) => string;
};

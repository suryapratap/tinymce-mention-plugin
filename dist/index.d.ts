declare module 'tinymce-mention-plugin/index' {
  import "./plugin";

}
declare module 'tinymce-mention-plugin/plugin' {
  export type ACListItem = {
      [key: string]: string;
  };
  export type ACSourceFn = (query: string, process: Function, delimiter: string) => ACListItem[];
  export type AutoCompleteOptions<TDelemeter> = {
      source: ACListItem[] | ACSourceFn;
      delay: number;
      queryBy: string;
      insertFrom?: string;
      items: number;
      delimiter?: TDelemeter;
      matcher?: (item: any) => boolean;
      sorter?: (items: any[]) => any[];
      renderDropdown?: () => string;
      render?: (item: ACListItem, index: number, opts: AutoCompleteOptions<string>) => string;
      insert?: (item: any, opts: AutoCompleteOptions<string>) => string;
      highlighter?: (text: string) => string;
  };

}
declare module 'tinymce-mention-plugin' {
  import main = require('tinymce-mention-plugin/src/index');
  export = main;
}
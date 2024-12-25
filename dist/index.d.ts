declare module 'tinymce-mention/index' {
  import { ACListItem, ACSourceFn, AutoCompleteOptions } from "tinymce-mention/plugin";
  export { ACListItem, ACSourceFn, AutoCompleteOptions };

}
declare module 'tinymce-mention/plugin' {
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
declare module 'tinymce-mention' {
  import main = require('tinymce-mention/src/index');
  export = main;
}
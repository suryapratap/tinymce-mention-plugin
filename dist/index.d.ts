declare module 'tinymce-mention-plugin/index' {
  import { mention } from "tinymce-mention-plugin/plugin";
  export { mention };

}
declare module 'tinymce-mention-plugin/plugin' {
  const mention: void;
  export { mention };

}
declare module 'tinymce-mention-plugin' {
  import main = require('tinymce-mention-plugin/src/index');
  export = main;
}
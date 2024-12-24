declare module 'tinymce-mention-plugin/index' {
  import "./plugin";

}
declare module 'tinymce-mention-plugin/plugin' {
  export {};

}
declare module 'tinymce-mention-plugin' {
  import main = require('tinymce-mention-plugin/src/index');
  export = main;
}
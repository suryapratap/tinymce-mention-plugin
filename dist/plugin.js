"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
const wordJoiner = "\u2060";
const render = (item, index, opts) => `<li><a href="javascript:;"><span data-idx="${index}">${item[opts.queryBy]}</span></a></li>`;
const insert = (item, opts) => `<span>${item[opts.insertFrom || opts.queryBy]}</span>&nbsp;`;
const highlighter = (text) => text;
const autoCompleteDefaults = {
  source: [],
  delay: 500,
  queryBy: "name",
  insertFrom: "name",
  items: 10,
  delimiter: "@",
  render,
  insert,
  highlighter
};
class AutoComplete {
  constructor(editor, options) {
    this.query = "";
    this.$dropdown = null;
    this.hasFocus = true;
    this.editor = editor;
    this.options = Object.assign({}, autoCompleteDefaults, options);
    this.renderInput();
    this.bindEvents();
  }
  renderInput() {
    const rawHtml = `
      <span id="autocomplete">
          <span id="autocomplete-delimiter">${this.options.delimiter || ""}</span>
          <span id="autocomplete-searchtext"><span class="dummy">${wordJoiner}</span></span>
      </span>
    `;
    this.editor.execCommand("mceInsertContent", false, rawHtml);
    this.editor.focus();
    const inputElement = this.editor.selection.dom.select("span#autocomplete-searchtext span")[0];
    this.editor.selection.select(inputElement);
    this.editor.selection.collapse(0);
  }
  bindEvents() {
    this.editor.on("keyup", this.rteKeyUp.bind(this));
    this.editor.on("keydown", this.rteKeyDown.bind(this), true);
    this.editor.on("click", this.rteClicked.bind(this));
    document.body.addEventListener("click", this.rteLostFocus.bind(this));
    this.handleEditorScroll = () => this.cleanUp(true);
    this.editor.getWin().addEventListener("scroll", this.handleEditorScroll);
  }
  rteKeyUp(event) {
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "Shift":
      case "Control":
      case "Alt":
        break;
      case "Backspace":
        if (this.query === "") {
          this.cleanUp(true);
        } else {
          this.lookup();
        }
        break;
      case "Tab":
      case "Enter":
        if (this.$dropdown) {
          const activeItem = this.$dropdown.querySelector("li.active");
          if (activeItem) {
            this.select(activeItem.dataset);
            this.cleanUp(false);
          } else {
            this.cleanUp(true);
          }
        }
        break;
      case "Escape":
        this.cleanUp(true);
        break;
      default:
        this.lookup();
    }
  }
  rteKeyDown(event) {
    switch (event.key) {
      case "Tab":
      case "Enter":
      case "Escape":
        event.preventDefault();
        break;
      case "ArrowUp":
        event.preventDefault();
        if (this.$dropdown) {
          this.highlightPreviousResult();
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (this.$dropdown) {
          this.highlightNextResult();
        }
        break;
    }
    event.stopPropagation();
  }
  rteClicked(event) {
    var _a;
    const target = event.target;
    if (this.hasFocus && ((_a = target.parentElement) == null ? void 0 : _a.id) !== "autocomplete-searchtext") {
      this.cleanUp(true);
    }
  }
  rteLostFocus() {
    if (this.hasFocus) {
      this.cleanUp(true);
    }
  }
  lookup() {
    var _a;
    if (!this.hasFocus) return;
    const searchTextElement = this.editor.getBody().querySelector("#autocomplete-searchtext");
    this.query = ((_a = searchTextElement == null ? void 0 : searchTextElement.textContent) == null ? void 0 : _a.trim().replace(wordJoiner, "")) || "";
    if (!this.editor.getBody().querySelector("#autocomplete")) {
      return;
    }
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
        items(this.query, this.options.delimiter, this.process.bind(this));
      }
    }, this.options.delay);
  }
  process(data) {
    if (!this.hasFocus) return;
    console.log("data Received in process", data);
    const matchedItems = data.filter(
      this.options.matcher || ((item) => item[this.options.queryBy].toLowerCase().includes(this.query.toLowerCase()))
    );
    const sortedItems = this.options.sorter ? this.options.sorter(matchedItems) : matchedItems;
    const limitedItems = sortedItems.slice(0, this.options.items);
    const result = limitedItems.reduce((r, item, i) => {
      const element = document.createElement("div");
      element.innerHTML = this.options.render(item, i, this.options);
      const text = element.textContent || "";
      element.innerHTML = element.innerHTML.replace(text, this.options.highlighter(text) || "");
      Object.entries(item).forEach(([key, val]) => {
        element.dataset[key] = `${val}`;
      });
      r += element.outerHTML;
      return r;
    }, "");
    if (result.length) {
      if (this.$dropdown) {
        this.$dropdown.innerHTML = result;
        this.$dropdown.style.display = "block";
      }
    } else {
      if (this.$dropdown) {
        this.$dropdown.style.display = "none";
      }
    }
  }
  show() {
    const dropdown = document.createElement("ul");
    dropdown.className = "rte-autocomplete dropdown-menu";
    dropdown.innerHTML = '<li class="loading"></li>';
    const offset = this.offset();
    dropdown.style.top = `${offset.top}px`;
    dropdown.style.left = `${offset.left}px`;
    document.body.appendChild(dropdown);
    dropdown.addEventListener("click", (e) => this.autoCompleteClick(e));
    this.$dropdown = dropdown;
  }
  autoCompleteClick(event) {
    const li = event.target.closest("li");
    if (!li) return;
    const span = li.querySelector("span[data-idx]");
    if (span) {
      const val = span.innerHTML;
      console.log("Span dataset:", span.dataset);
      this.select({ value: val });
    }
    this.cleanUp(false);
    event.stopPropagation();
    event.preventDefault();
  }
  highlightPreviousResult() {
    var _a;
    const items = ((_a = this.$dropdown) == null ? void 0 : _a.querySelectorAll("li")) || [];
    const activeIndex = Array.from(items).findIndex((item) => item.classList.contains("active"));
    const newIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    items.forEach((item) => item.classList.remove("active"));
    if (items[newIndex]) {
      items[newIndex].classList.add("active");
    }
  }
  highlightNextResult() {
    var _a;
    const items = ((_a = this.$dropdown) == null ? void 0 : _a.querySelectorAll("li")) || [];
    const activeIndex = Array.from(items).findIndex((item) => item.classList.contains("active"));
    const newIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    items.forEach((item) => item.classList.remove("active"));
    if (items[newIndex]) {
      items[newIndex].classList.add("active");
    }
  }
  select(item) {
    this.editor.focus();
    const autocompleteElement = this.editor.getBody().querySelector("#autocomplete");
    if (!autocompleteElement) return;
    this.editor.dom.remove(autocompleteElement);
    this.options.insertFrom = "value";
    console.log("item", item, this.options, this.options.insert);
    const result = this.options.insert(item, this.options);
    console.log("result", result);
    this.editor.execCommand("mceInsertContent", false, result);
  }
  offset() {
    var _a, _b;
    const autocompleteElement = this.editor.getBody().querySelector("#autocomplete");
    if (!autocompleteElement) {
      return { top: 0, left: 0 };
    }
    const rect = autocompleteElement.getBoundingClientRect();
    const editorDoc = this.editor.getDoc();
    const scrollTop = ((_a = editorDoc == null ? void 0 : editorDoc.documentElement) == null ? void 0 : _a.scrollTop) || 0;
    const scrollLeft = ((_b = editorDoc == null ? void 0 : editorDoc.documentElement) == null ? void 0 : _b.scrollLeft) || 0;
    return {
      top: rect.top + scrollTop + autocompleteElement.offsetHeight + 5,
      left: rect.left + scrollLeft
    };
  }
  cleanUp(rollback) {
    var _a;
    this.unbindEvents();
    this.hasFocus = false;
    (_a = this.$dropdown) == null ? void 0 : _a.remove();
    this.$dropdown = null;
    if (rollback) {
      const text = this.query;
      const selection = this.editor.dom.select("span#autocomplete")[0];
      if (!selection) return;
      const replacement = document.createElement("p");
      replacement.textContent = this.options.delimiter + text;
      this.editor.dom.replace(replacement, selection);
      this.editor.selection.select(replacement);
      this.editor.selection.collapse();
    } else {
      console.log("mentionfinished");
      this.editor.fire("mentionfinished");
    }
  }
  unbindEvents() {
    document.body.removeEventListener("click", this.rteLostFocus.bind(this));
    this.editor.off("keyup", this.rteKeyUp.bind(this));
    this.editor.off("keydown", this.rteKeyDown.bind(this));
    this.editor.off("click", this.rteClicked.bind(this));
    this.editor.getWin().removeEventListener("scroll", this.handleEditorScroll);
  }
}
const PLUGIN_NAME = "mention";
const getMetadata = () => {
  return {
    name: PLUGIN_NAME,
    author: "Surya Pratap",
    url: "https://github.com/suryapratap/tinymce-mention-plugin"
  };
};
function registerPlugin(editor) {
  let autoComplete;
  const autoCompleteData = editor.getParam(PLUGIN_NAME);
  const delimiter = Array.isArray(autoCompleteData.delimiter) ? autoCompleteData.delimiter : [autoCompleteData.delimiter || "@"];
  function prevCharIsSpace() {
    var _a, _b;
    const range = editor.selection.getRng();
    const start = range.startOffset;
    const text = (((_a = range.startContainer) == null ? void 0 : _a.textContent) || "").toString();
    return !((_b = text.charAt(start - 1)) == null ? void 0 : _b.trim().length);
  }
  editor.on("keypress", (event) => {
    if (!delimiter.includes(event.key)) {
      console.log("not delimiter", event.key, { delimiter });
      return;
    }
    if (!prevCharIsSpace()) {
      console.log("not prevCharIsSpace", event.key, { delimiter });
      return;
    }
    if (autoComplete && autoComplete.hasFocus) {
      console.log("not autoComplete", event.key, { delimiter }, autoComplete.hasFocus);
      return;
    }
    event.preventDefault();
    console.log("activate mentions autocomplete", event.key, { delimiter }, autoComplete == null ? void 0 : autoComplete.hasFocus);
    autoComplete = new AutoComplete(editor, __spreadProps(__spreadValues({}, autoCompleteData), {
      delimiter: event.key
    }));
  });
  editor.on("mentionfinished", () => {
    console.log("mentionfinished plugin event");
    autoComplete = void 0;
  });
  return { getMetadata };
}
window.tinymce.PluginManager.add(PLUGIN_NAME, registerPlugin);
//# sourceMappingURL=plugin.js.map

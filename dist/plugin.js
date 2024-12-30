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
    this.editor.getWin().addEventListener("scroll", () => this.cleanUp(true));
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
    const searchTextElement = this.editor.getBody().querySelector("#autocomplete-searchtext");
    this.query = ((_a = searchTextElement == null ? void 0 : searchTextElement.textContent) == null ? void 0 : _a.trim().replace(wordJoiner, "")) || "";
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
    console.log(this.options.queryBy, this.query, data);
    const matchedItems = data.filter(this.options.matcher || ((item) => item[this.options.queryBy].toLowerCase().includes(this.query.toLowerCase())));
    const sortedItems = this.options.sorter ? this.options.sorter(matchedItems) : matchedItems;
    const limitedItems = sortedItems.slice(0, this.options.items);
    const result = limitedItems.reduce((r, item, i, arr) => {
      const element = document.createElement("div");
      element.innerHTML = this.options.render(item, i, this.options);
      const text = element.textContent || "";
      element.innerHTML = element.innerHTML.replace(text, this.options.highlighter(text) || "");
      Object.entries(item).forEach(([key, val]) => element.dataset[key] = `${val}`);
      r = `${r}${element.outerHTML}`;
      return r;
    }, "");
    if (result.length) {
      this.$dropdown.innerHTML = result;
      this.$dropdown.style.display = "block";
    } else {
      this.$dropdown.style.display = "none";
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
    const target = event.target.closest("li");
    if (target) {
      this.select(target.dataset);
      this.cleanUp(false);
    }
    event.stopPropagation();
    event.preventDefault();
  }
  highlightPreviousResult() {
    var _a, _b;
    const items = ((_a = this.$dropdown) == null ? void 0 : _a.querySelectorAll("li")) || [];
    const activeIndex = Array.from(items).findIndex((item) => item.classList.contains("active"));
    const newIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    items.forEach((item) => item.classList.remove("active"));
    (_b = items[newIndex]) == null ? void 0 : _b.classList.add("active");
  }
  highlightNextResult() {
    var _a, _b;
    const items = ((_a = this.$dropdown) == null ? void 0 : _a.querySelectorAll("li")) || [];
    const activeIndex = Array.from(items).findIndex((item) => item.classList.contains("active"));
    const newIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    items.forEach((item) => item.classList.remove("active"));
    (_b = items[newIndex]) == null ? void 0 : _b.classList.add("active");
  }
  select(item) {
    this.editor.focus();
    const selection = this.editor.dom.select("span#autocomplete")[0];
    this.editor.dom.remove(selection);
    this.editor.execCommand("mceInsertContent", false, this.options.insert(item, this.options));
  }
  offset() {
    console.log("this.editor", this.editor, "this.editor.dom.document", this.editor.dom.doc.activeElement);
    const rtePosition = this.editor.dom.doc.activeElement.getBoundingClientRect();
    const contentAreaPosition = this.editor.dom.doc.activeElement.getBoundingClientRect();
    const autocompleteElement = this.editor.dom.doc.activeElement.querySelector("#autocomplete");
    if (!autocompleteElement) {
      throw new Error("Autocomplete element not found");
    }
    const nodePosition = autocompleteElement.getBoundingClientRect();
    return {
      top: rtePosition.top + contentAreaPosition.top + nodePosition.top + this.editor.selection.getNode().offsetHeight - this.editor.getDoc().scrollTop + 5,
      left: rtePosition.left + contentAreaPosition.left + nodePosition.left
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
    }
  }
  unbindEvents() {
    document.body.removeEventListener("click", this.rteLostFocus.bind(this));
    this.editor.off("keyup", this.rteKeyUp.bind(this));
    this.editor.off("keydown", this.rteKeyDown.bind(this));
    this.editor.off("click", this.rteClicked.bind(this));
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
  const delimiter = autoCompleteData.delimiter ? Array.isArray(autoCompleteData.delimiter) ? autoCompleteData.delimiter : [autoCompleteData.delimiter] : ["@"];
  function prevCharIsSpace() {
    var _a;
    const range = editor.selection.getRng();
    const start = range.startOffset;
    const text = ((_a = range.startContainer) == null ? void 0 : _a.dataset) || "";
    return !text.toString().charAt(start - 1).trim().length;
  }
  editor.on("keypress", (event) => {
    if (delimiter.includes(event.key) && prevCharIsSpace() && (!autoComplete || !(autoComplete == null ? void 0 : autoComplete.hasFocus))) {
      event.preventDefault();
      console.log("activate mentions autocomplete", event.key, { delimiter }, autoComplete == null ? void 0 : autoComplete.hasFocus);
      autoComplete = new AutoComplete(editor, __spreadProps(__spreadValues({}, autoCompleteData), { delimiter: event.key }));
    }
  });
  return { getMetadata };
}
window.tinymce.PluginManager.add(PLUGIN_NAME, registerPlugin);
//# sourceMappingURL=plugin.js.map

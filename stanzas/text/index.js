import Stanza from "togostanza/stanza";
import loadData from "togostanza-utils/load-data";
import * as commonmark from "commonmark";
import hljs from "highlight.js";
import "katex/dist/katex.mjs";
import renderMathInElement from "katex/dist/contrib/auto-render.mjs";

import { appendCustomCss } from "togostanza-utils";
// import spinner from "togostanza-utils/spinner.png";

export default class Text extends Stanza {
  constructor() {
    super(...arguments);

    this.importWebFontCSS(
      "https://cdn.jsdelivr.net/npm/katex@0.16.3/dist/katex.min.css"
    );
  }

  menu() {
    return [
      {
        type: "item",
        label: "Download Text",
        handler: () => {
          const textBlob = new Blob([this._dataset], {
            type: "text/plain",
          });
          const textUrl = URL.createObjectURL(textBlob);
          const link = document.createElement("a");
          document.body.appendChild(link);
          link.href = textUrl;
          link.download = this._downloadFileName();
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(textUrl);
        },
      },
    ];
  }

  _isMarkdownMode() {
    return this.params["mode"] === "markdown";
  }

  _downloadFileName() {
    if (this._isMarkdownMode()) {
      return "text.md";
    } else {
      return "text.txt";
    }
  }

  async render() {
    const main = this.root.querySelector("main");

    this._dataset = await this._loadText(this.params["data-url"], main);

    // const value = this._dataset;
    const value = await loadData(
      this.params["data-url"],
      this.params["data-type"],
      main
    );
    if (this._isMarkdownMode()) {
      const parser = new commonmark.Parser();
      const renderer = new commonmark.HtmlRenderer();
      const html = renderer.render(parser.parse(value));
      this.renderTemplate({
        template: "stanza.html.hbs",
        parameters: {
          html,
        },
      });
      main.querySelectorAll("pre code").forEach((el) => {
        hljs.highlightElement(el);
      });
      console.log("MATH", main);
      renderMathInElement(main);
    } else {
      const text = this._dataset;
      this.renderTemplate({
        template: "stanza.html.hbs",
        parameters: {
          text,
        },
      });
    }

    appendCustomCss(this, this.params["custom_css_url"]);
    appendCustomCss(this, this.params["highlight-css-url"]);
  }

  async _loadText(url, main) {
    const spinnerDiv = document.createElement("div");

    Object.assign(spinnerDiv, {
      className: "metastanza-loading-icon-div",
      id: "metastanza-loading-icon-div",
    });
    spinnerDiv.style = `
    display: flex;
    justify-content: center;
    align-items: center;
    `;

    // const spinnerImg = document.createElement("img");
    // Object.assign(spinnerImg, {
    //   className: "metastanza-loading-icon",
    //   id: "metastanza-loading-icon",
    //   src: spinner,
    // });

    // spinnerImg.style = `
    // width: 30px;
    // height: auto;
    // display: block;
    // `;

    // spinnerDiv.appendChild(spinnerImg);
    main.appendChild(spinnerDiv);

    const response = await fetch(url).then((res) => res.text());
    //error処理の追加 fetchなど status

    // Parameters (heatmapの様に行いたい)
    // const dataset = await loadData(
    //   this.params["data-url"],
    //   this.params["data-type"],
    //   root
    // );

    //togostanza utilsを追加する

    main.removeChild(spinnerDiv);

    return response;
  }
}

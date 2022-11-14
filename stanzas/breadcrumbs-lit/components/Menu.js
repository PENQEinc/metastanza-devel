import { LitElement, html, css } from "lit";
import { map } from "lit/directives/map.js";

class Menu extends LitElement {
  static get properties() {
    return {
      menuItems: {
        type: Array,
        state: true,
      },
    };
  }

  static get styles() {
    return css`
      :host {
        position: absolute;
        left: 0;
        bottom: -1px;
      }

      .menu-wrapper {
        padding-top: 5px;
      }

      .menu-triangle {
        position: relative;
        top: 0;
        width: 7px;
        height: 7px;
        position: absolute;
        left: 50%;
        transform: translate(-50%, 2px) rotate(45deg);
        border: 1px solid var(--togostanza-border-color);
        z-index: 1;
      }

      .menu-triangle-overlay {
        position: relative;
        top: 0;
        width: 7px;
        height: 7px;
        position: absolute;
        left: 50%;
        transform: translate(-50%, 3px) rotate(45deg);
        background-color: white;
        z-index: 5;
      }

      .menu-container {
        position: relative;
        max-width: 10em;
        max-height: 20em;
        overflow-y: auto;
        list-style-type: none;
        padding: 1em 0;
        margin: 0;
        border: 1px solid var(--togostanza-border-color);
        border-radius: 0.5em;
        background-color: white;
        z-index: 3;
        display: flex;
        flex-direction: column;
        align-items: start;
        justify-content: start;
        gap: 0.2em;
        cursor: pointer;
      }

      .menu-container > li {
        line-height: 1.2;
        width: 100%;
        padding: 0.2em 0.5em;
      }
      .menu-container > li:hover {
        background-color: blue;
        color: white;
      }
    `;
  }

  constructor() {
    super();
    this.menuItems = [];
  }

  _handleMouseEnter() {
    this.dispatchEvent(new CustomEvent("menu-hover"));
  }
  _handleMouseLeave() {
    this.dispatchEvent(new CustomEvent("menu-leave"));
  }
  _handleClick(id) {
    this.dispatchEvent(
      new CustomEvent("menu-item-clicked", {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div
        class="menu-wrapper"
        @mouseover=${this._handleMouseEnter}
        @mouseout=${this._handleMouseLeave}
      >
        <div class="menu-triangle"></div>
        <div class="menu-triangle-overlay"></div>
        <ul class="menu-container">
          ${map(
            this.menuItems,

            (d) =>
              html`
                <li
                  @click=${(e) => {
                    e.stopPropagation();
                    this._handleClick(d.id);
                  }}
                >
                  ${d.label}
                </li>
              `
          )}
        </ul>
      </div>
    `;
  }
}

customElements.define("node-menu", Menu);

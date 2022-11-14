import { LitElement, html, css } from "lit";
import { repeat } from "lit/directives/repeat.js";

import { applyConstructor } from "@/lib/utils";

export class Breadcrumbs extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }
    `;
  }

  static get properties() {
    return {
      currentId: { state: true },
      error: { type: Object, state: true },
      data: { type: Array, state: true },
    };
  }
  constructor(element) {
    super();

    element.append(this);

    this.data = [];
    this.loading = false;
    this.pathToShow = [];
    this.nodesMap = new Map();
    this.currentMenuItems = [];
    this.hoverNodeId = "";
  }

  updateParams(params, data) {
    try {
      this.data = data;
      applyConstructor.call(this, params);

      this.data.forEach((d) => {
        this.nodesMap.set("" + d[this.nodeKey], d);
      });

      this.error = { message: "", isError: false };

      this.currentId = this.nodeInitialId;
    } catch (error) {
      this.error = { message: error.message, isError: true };
    }
  }

  willUpdate(changed) {
    if (changed.has("currentId")) {
      this.pathToShow = this._getPath(this.currentId);
    }
  }

  _getByParent(parentId) {
    return this.data.filter((d) => "" + d.parent === "" + parentId);
  }

  _getPath(currentId) {
    const pathToShow = [];
    const traverse = (id) => {
      const currentNode = this.nodesMap.get(id);
      if (currentNode) {
        pathToShow.push(currentNode);
        traverse("" + currentNode.parent);
      }
    };
    traverse(currentId);
    return pathToShow.reverse();
  }

  _handleNodeHover(e) {
    const { id } = e.detail;
    this.hoverNodeId = id;

    const node = this.nodesMap.get("" + id);
    const parentId = node.parent;
    const siblings = this._getByParent(parentId).filter(
      (d) => "" + d[this.nodeKey] !== "" + id
    );

    this.currentMenuItems = siblings.map((d) => ({
      label: d[this.nodeLabelKey],
      id: d[this.nodeKey],
    }));
  }

  render() {
    return html`${repeat(
      this.pathToShow,
      (node) => node[this.nodeKey],
      (node) => {
        return html`
          <breadcrumbs-node
            @click=${() => {
              this.currentId = "" + node[this.nodeKey];
            }}
            @node-hover=${this._handleNodeHover}
            data-id="${node[this.nodeKey]}"
            .node="${{
              label: node[this.nodeLabelKey],
              id: node[this.nodeKey],
            }}"
            .menuItems="${this._getByParent(node.parent)}"
          />
        `;
      }
    )}`;
  }
}

customElements.define("breadcrumbs-lit", Breadcrumbs);

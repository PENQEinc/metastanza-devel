import MetaStanza from "../../lib/MetaStanza";
import {
  select,
  min,
  max,
  scaleSqrt,
  stratify,
  tree,
  cluster,
  linkHorizontal,
  linkVertical,
  linkRadial,
} from "d3";
import ToolTip from "@/lib/ToolTip";
import { getCirculateColor } from "@/lib/ColorGenerator";

import {
  downloadSvgMenuItem,
  downloadPngMenuItem,
  downloadJSONMenuItem,
  downloadCSVMenuItem,
  downloadTSVMenuItem,
} from "togostanza-utils";

//Declaring constants
const ASCENDING = "ascending",
  DESCENDING = "descending",
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
  RADIAL = "radial",
  TRANSLUCENT = "translucent",
  MULTIPLY = "multiply",
  SCREEN = "screen";

export default class Tree extends MetaStanza {
  //Stanza download menu contents
  menu() {
    return [
      downloadSvgMenuItem(this, "tree"),
      downloadPngMenuItem(this, "tree"),
      downloadJSONMenuItem(this, "tree", this._data),
      downloadCSVMenuItem(this, "tree", this._data),
      downloadTSVMenuItem(this, "tree", this._data),
    ];
  }

  async renderNext() {
    //Define from params
    const nodeGroupKey = this.params["node-color-group"].trim();

    const root = this._main,
      dataset = this.__data.asTree({
        nodeLabelKey: this.params["node-label-key"].trim(),
        nodeColorKey: this.params["node-color-key"].trim(),
        nodeGroupKey,
        nodeOrderKey: this.params["sort-key"].trim(),
        nodeValueKey: this.params["node-size-key"].trim(),
        nodeDescriptionKey: this.params["tooltips-key"].trim(),
      }).data,
      urlKey = this.params["node-url-key"].trim(), //Actually want to include it in asTree
      width = parseFloat(this.css("--togostanza-canvas-width")) || 0,
      height = parseFloat(this.css("--togostanza-canvas-height")) || 0,
      padding = this.MARGIN,
      sortOrder = this.params["sort-order"],
      isLeafNodesAlign = this.params["graph-align_leaf_nodes"],
      layout = this.params["graph-layout"],
      labelMargin = this.params["node-label-margin"],
      minRadius = this.params["node-size-min"] / 2,
      maxRadius = this.params["node-size-max"] / 2,
      aveRadius = (minRadius + maxRadius) / 2,
      colorGroup = nodeGroupKey, // NOTE Actually, this variable is not needed (because asTree does the property name conversion), but since we cannot remove this variable without changing the getCirculateColor interface, we have left it in.
      colorMode = this.params["node-color-blend"];

    let colorModeProperty, colorModeValue;
    switch (colorMode) {
      case TRANSLUCENT:
        colorModeProperty = "opacity";
        colorModeValue = "0.5";
        break;
      case MULTIPLY:
        colorModeProperty = "mix-blend-mode";
        colorModeValue = "multiply";
        break;
      case SCREEN:
        colorModeProperty = "mix-blend-mode";
        colorModeValue = "screen";
        break;
      default:
        break;
    }

    const showToolTips = dataset.some((item) => item.description);
    this.tooltip = new ToolTip();
    root.append(this.tooltip);

    //Add url property to dataset. Actually want to include it in asTree
    const urls = this._data.map((datum) => datum.url);
    dataset.forEach((datum, index) => {
      datum[urlKey] = urls[index];
    });

    //Sorting by user keywords
    const orderSym = Symbol("order");
    dataset.forEach((datum, index) => {
      datum[orderSym] = index;
    });

    const reorder = (a, b) => {
      if (a.data.order && b.data.order) {
        switch (sortOrder) {
          case ASCENDING:
            return a.data.order > b.data.order ? 1 : -1;
          case DESCENDING:
            return a.data.order > b.data.order ? -1 : 1;
        }
      } else {
        if (sortOrder === DESCENDING) {
          return b.data[orderSym] - a.data[orderSym];
        }
      }
    };

    //Hierarchize data
    const treeRoot = stratify()
      .parentId((d) => d.parent)(dataset)
      .sort(reorder);

    const treeDescendants = treeRoot.descendants();
    const data = treeDescendants.slice(1);

    //Setting node size
    const nodeSizeMin = min(data, (d) => d.data.value);
    const nodeSizeMax = max(data, (d) => d.data.value);

    const radiusScale = scaleSqrt()
      .domain([nodeSizeMin, nodeSizeMax])
      .range([minRadius, maxRadius]);

    const nodeRadius = (size) => {
      return size ? radiusScale(size) : radiusScale(nodeSizeMin);
    };

    //Toggle display/hide of children
    const toggle = (d) => {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
    };

    //Setting color scale
    const colorDatas = [];
    treeDescendants.forEach((d) => {
      colorDatas.push(d.data);
    });

    const getColor = getCirculateColor(this, colorDatas, colorGroup);

    const setColor = (d) => {
      if (d.data.color) {
        return d.data.color;
      } else {
        return d.data.group
          ? getColor.groupColor(d.data.group)
          : getColor.stanzaColors[0];
      }
    };

    const svgWidth = width - padding.LEFT - padding.RIGHT;
    const svgHeight = height - padding.TOP - padding.BOTTOM;

    //Setting svg area
    select(root).select("svg").remove();
    const svg = select(root)
      .append("svg")
      .attr("width", svgWidth)
      .attr("height", svgHeight);

    //Get width of root label
    const rootGroup = svg
      .append("text")
      .text(treeDescendants[0].data.label || "");
    const rootLabelWidth = rootGroup.node().getBBox().width;
    rootGroup.remove();

    //Get width of the largest label at the lowest level
    const maxDepth = max(data, (d) => d.depth);
    const labels = [];
    for (const n of data) {
      n.depth === maxDepth ? labels.push(n.data.label || "") : "";
    }
    const maxLabelGroup = svg.append("g");
    maxLabelGroup
      .selectAll("text")
      .data(labels)
      .enter()
      .append("text")
      .text((d) => d);
    const maxLabelWidth = maxLabelGroup.node().getBBox().width;
    maxLabelGroup.remove();

    //Create each group
    const g = svg.append("g");
    const gCircles = g.append("g").attr("class", "circles");
    const gLabels = g.append("g").attr("class", "labels");

    //Draw function
    const draw = (
      margin = {
        top: 0,
        right: maxLabelWidth + labelMargin,
        bottom: 0,
        left: rootLabelWidth + labelMargin,
      }
    ) => {
      //Error handling
      const errorMessage = root.querySelector(`.error-message`);
      if (errorMessage) {
        root.removeChild(errorMessage);
      }
      switch (layout) {
        case HORIZONTAL:
          if (width - margin.right - margin.left < 0) {
            handleError("width-error", "width is too small!");
          }
          break;
        case VERTICAL:
          if (height - margin.left - margin.right < 0) {
            handleError("heigth-error", "height is too small!");
          }
          break;
      }
      if (
        Math.max(maxRadius, minRadius) * 2 >= width ||
        Math.max(maxRadius, minRadius) * 2 >= height
      ) {
        handleError("node-error", "node size is too big for width and height!");
      }

      //Movement of drawing position
      g.attr("transform", () => {
        switch (layout) {
          case HORIZONTAL:
            return `translate(${margin.left}, ${margin.top})`;
          case VERTICAL:
            return `translate(${margin.top}, ${margin.left})`;
          case RADIAL:
            return `translate(${svgWidth / 2}, ${svgHeight / 2})`;
        }
      });

      //Align leaves or not
      let graphType = tree();
      isLeafNodesAlign ? (graphType = cluster()) : (graphType = tree());

      //Gap between node
      const separation = (a, b) => {
        return (a.parent === b.parent ? 1 : 2) / isLeafNodesAlign ? 1 : a.depth;
      };

      //Setting the graph size for each layout
      switch (layout) {
        case HORIZONTAL:
          graphType.size([
            svgHeight - margin.top - margin.bottom,
            svgWidth - margin.left - margin.right,
          ]);
          break;
        case VERTICAL:
          graphType.size([
            svgWidth - margin.top - margin.bottom,
            svgHeight - margin.left - margin.right,
          ]);
          break;
        case RADIAL:
          graphType
            .size([
              2 * Math.PI,
              Math.min(svgWidth / 2, svgHeight / 2) - margin.right,
            ])
            .separation(separation)(treeRoot);
          break;
      }

      graphType(treeRoot);

      //Start position of drawing
      treeRoot.x0 = data[0].parent.x;
      treeRoot.y0 = 0;

      //Change values during vertical
      if (layout === VERTICAL) {
        treeDescendants.forEach((node) => {
          const { x0, x, y0, y } = node;

          node.x0 = y0;
          node.x = y;
          node.y0 = x0;
          node.y = x;
        });
      }

      //Setting the width of margin
      const minY = [],
        maxY = [],
        minX = [],
        maxX = [];

      const circleRadius = [],
        aligns = [],
        depths = [];
      treeDescendants.forEach((d) => {
        circleRadius.push(nodeRadius(d.data.value) || aveRadius);

        const mapper = {
          horizontal: {
            alignmentDirection: margin.top + d.x,
            depthDirection: margin.left + d.y,
          },
          vertical: {
            alignmentDirection: margin.left + d.x,
            depthDirection: margin.top + d.y,
          },
        };

        switch (layout) {
          case HORIZONTAL:
            return (
              aligns.push(mapper.horizontal["alignmentDirection"]),
              depths.push(mapper.horizontal["depthDirection"])
            );
          case VERTICAL:
            return (
              aligns.push(mapper.vertical["alignmentDirection"]),
              depths.push(mapper.vertical["depthDirection"])
            );
          default:
            break;
        }
      });

      //Get all positions
      let deltas;
      treeDescendants.forEach((d, i) => {
        minX.push(aligns[i] - circleRadius[i]);
        minY.push(depths[i] - circleRadius[i]);
        maxX.push(aligns[i] + circleRadius[i]);
        maxY.push(depths[i] + circleRadius[i]);
      });

      //Find each max/min value
      switch (layout) {
        case HORIZONTAL:
          deltas = {
            top: Math.min(...minX),
            bottom: height - Math.max(...maxX),
            left: Math.min(...minY),
            right: width - Math.max(...maxY),
          };
          break;
        case VERTICAL:
          deltas = {
            top: Math.min(...minY),
            bottom: width - Math.max(...maxY),
            left: Math.min(...minX),
            right: height - Math.max(...maxX),
          };
          break;
        default:
          break;
      }

      // Update margin values
      const directions = ["top", "bottom", "right", "left"];
      switch (layout) {
        case HORIZONTAL:
        case VERTICAL:
          for (const dir of directions) {
            deltas[dir] < 0 ? (margin[dir] += Math.abs(deltas[dir]) + 1) : "";
          }

          //Redraw
          if (
            deltas.top < 0 ||
            deltas.bottom < 0 ||
            deltas.left < 0 ||
            deltas.right < 0
          ) {
            draw(margin);
          }
          break;
        default:
          break;
      }

      //Update graph values
      const update = (source) => {
        let i = 0;

        //Drawing circles
        const nodeCirclesUpdate = gCircles
          .selectAll("g")
          .data(treeRoot.descendants(), (d) => d.id || (d.id = ++i));

        //Generate new elements of circle
        const nodeCirclesEnter = nodeCirclesUpdate
          .enter()
          .append("g")
          .attr("transform", () => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${source.y0}, ${source.x0})`;
              case RADIAL:
                return `rotate(${(source.x0 * 180) / Math.PI - 90}) translate(${
                  source.y0
                }, 0)`;
            }
          })
          .on("click", (e, d) => {
            toggle(d);
            update(d);
          });

        //Update circle color when opening and closing
        nodeCirclesUpdate
          .filter((d) => d === source)
          .select("circle")
          .attr("fill", (d) => (d._children ? "#fff" : setColor(d)));

        //Decorate circle
        nodeCirclesEnter
          .append("circle")
          .attr("data-tooltip", (d) => d.data.description)
          .attr("stroke", setColor)
          .style(colorModeProperty, colorModeValue)
          .classed("with-children", (d) => d.children)
          .attr("r", (d) =>
            data.some((d) => d.data.value)
              ? nodeRadius(d.data.value)
              : parseFloat(aveRadius)
          )
          .attr("fill", setColor);

        if (showToolTips) {
          this.tooltip.setup(root.querySelectorAll("[data-tooltip]"));
        }

        //Drawing labels
        const nodeLabelsUpdate = gLabels
          .selectAll("g")
          .data(treeRoot.descendants(), (d) => d.id || (d.id = ++i));

        //Generate new elements of Labels
        const nodeLabelsEnter = nodeLabelsUpdate
          .enter()
          .append("g")
          .attr("transform", () => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${source.y0}, ${source.x0})`;
              case RADIAL:
                return `rotate(${(source.x0 * 180) / Math.PI - 90}) translate(${
                  source.y0
                }, 0)`;
            }
          });

        // Decorate labels
        nodeLabelsEnter
          .append("a")
          .attr("href", (d) => d.data.url)
          .attr("target", "_blank")
          .style("text-decoration", "underline")
          .append("text")
          .attr("x", (d) => {
            switch (layout) {
              case HORIZONTAL:
                return d.children || d._children ? -labelMargin : labelMargin;
              case VERTICAL:
                return d.children || d._children ? labelMargin : -labelMargin;
              case RADIAL:
                return d.x < Math.PI === !d.children
                  ? labelMargin
                  : -labelMargin;
            }
          })
          .attr("dy", "3")
          .attr("transform", (d) => {
            switch (layout) {
              case HORIZONTAL:
                return "rotate(0)";
              case VERTICAL:
                return "rotate(-90)";
              case RADIAL:
                return `rotate(${d.x >= Math.PI ? 180 : 0})`;
            }
          })
          .attr("text-anchor", (d) => {
            switch (layout) {
              case HORIZONTAL:
                return d.children || d._children ? "end" : "start";
              case VERTICAL:
                return d.children || d._children ? "start" : "end";
              case RADIAL:
                return d.x < Math.PI === !d.children ? "start" : "end";
            }
          })
          .text((d) => d.data.label || "");

        const duration = 500;

        //Circle transition
        nodeCirclesEnter
          .transition()
          .duration(duration)
          .attr("transform", (d) => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${d.y}, ${d.x})`;
              case RADIAL:
                return `rotate(${(d.x * 180) / Math.PI - 90}) translate(${
                  d.y
                }, 0)`;
            }
          });

        //Labels transition
        nodeLabelsEnter
          .attr("transform", (d) => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${source.y}, ${source.x})`;
              case RADIAL:
                if (source.y === 0) {
                  return `rotate(${(d.x * 180) / Math.PI - 90}) translate(${
                    source.y
                  }, ${source.x})`;
                } else {
                  return `rotate(${
                    (source.x * 180) / Math.PI - 90
                  }) translate(${source.y}, ${source.x})`;
                }
            }
          })
          .transition()
          .duration(duration)
          .attr("transform", (d) => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${d.y}, ${d.x})`;
              case RADIAL:
                return `rotate(${(d.x * 180) / Math.PI - 90}) translate(${
                  d.y
                }, 0)`;
            }
          });

        //Remove extra elements of circle
        nodeCirclesUpdate
          .exit()
          .transition()
          .duration(duration)
          .attr("transform", () => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${source.y}, ${source.x})`;
              case RADIAL:
                return `rotate(${(source.x * 180) / Math.PI - 90}) translate(${
                  source.y
                }, 0)`;
            }
          })
          .remove();

        //Remove extra elements of Labels
        nodeLabelsUpdate
          .exit()
          .attr("transform", (d) => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${d.y}, ${d.x})`;
              case RADIAL:
                return `rotate(${(d.x * 180) / Math.PI - 90}) translate(${
                  d.y
                }, 0)`;
            }
          })
          .transition()
          .duration(duration)
          .attr("transform", (d) => {
            switch (layout) {
              case HORIZONTAL:
              case VERTICAL:
                return `translate(${source.y}, ${source.x})`;
              case RADIAL:
                if (source.y === 0) {
                  return `rotate(${(d.x * 180) / Math.PI - 90}) translate(${
                    source.y
                  }, 0)`;
                } else {
                  return `rotate(${
                    (source.x * 180) / Math.PI - 90
                  }) translate(${source.y}, 0)`;
                }
            }
          })
          .remove();

        //Drawing path
        const link = g
          .selectAll(".link")
          .data(treeRoot.links(), (d) => d.target.id);

        //Setting the path for each direction
        const getLinkFn = () => {
          switch (layout) {
            case HORIZONTAL:
              return linkHorizontal();
            case VERTICAL:
              return linkVertical();
          }
        };

        //Generate new elements of Path
        const linkEnter = link
          .enter()
          .insert("path", "g")
          .classed("link", true)
          .attr(
            "d",
            layout === RADIAL
              ? linkRadial().angle(source.x).radius(source.y)
              : getLinkFn().x(source.y0).y(source.x0)
          );

        //Path transition
        const linkUpdate = linkEnter;
        linkUpdate
          .transition()
          .duration(duration)
          .attr(
            "d",
            layout === RADIAL
              ? linkRadial()
                  .angle((d) => d.x)
                  .radius((d) => d.y)
              : getLinkFn()
                  .x((d) => d.y)
                  .y((d) => d.x)
          );

        //Remove extra elements of path
        link
          .exit()
          .transition()
          .duration(duration)
          .attr(
            "d",
            layout === RADIAL
              ? linkRadial().angle(source.x).radius(source.y)
              : getLinkFn().x(source.y).y(source.x)
          )
          .remove();

        //Get current position for next action
        nodeCirclesUpdate.each((d) => {
          d.x0 = d.x;
          d.y0 = d.y;
        });
      };
      update(treeRoot);
    };

    // Drawing
    draw();

    // Error handling function
    function handleError(errorClass, message) {
      const existError = root.querySelector(`.${errorClass}`);
      if (existError) {
        root.removeChild(existError);
      }
      const errorElement = document.createElement("p");
      errorElement.classList.add(`${errorClass}`, "error-message");
      errorElement.innerHTML = `<p>${message}</p>`;
      root.prepend(errorElement);

      throw new Error(`${message}`);
    }
  }
}

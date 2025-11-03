document.addEventListener("DOMContentLoaded", () => {
  // --- 0. Dataset Configuration ---
  const datasets = [
    { name: "Beer Tasting Notes", file: "data/beer.csv" },
    { name: "Ice Cream Tasting", file: "data/icecream.csv" },
    { name: "Video Game Ratings", file: "data/games.csv" },
  ];

  // Color palette for selections
  const colorPalette = [
    "#1e90ff", // DodgerBlue
    "#dc143c", // Crimson
    "#32cd32", // LimeGreen
    "#ff8c00", // DarkOrange
    "#9400d3", // DarkViolet
    "#00ced1", // DarkTurquoise
  ];

  // --- 1. Global State & Chart Dimensions ---
  let currentData = [];
  let currentMetrics = [];
  let categoryColumn = "";
  let itemColumn = "";
  let categoryAverages = new Map();
  let umapProjection = [];
  let currentView = "radial"; // 'radial' or 'umap'

  // Dimensions for both charts
  const width = 600;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // --- 1A. Radial Chart Setup ---
  const radius = Math.min(chartWidth, chartHeight) / 2;
  const rScale = d3.scaleLinear().range([0, radius]);
  const radarSvg = d3
    .select("#radar-chart")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + chartWidth / 2}, ${
        margin.top + chartHeight / 2
      })`
    );

  // --- 1B. UMAP Chart Setup ---
  const umapSvg = d3
    .select("#umap-chart")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);
  const umapXScale = d3.scaleLinear().range([0, chartWidth]);
  const umapYScale = d3.scaleLinear().range([chartHeight, 0]);
  const umapTooltip = d3.select("#umap-tooltip");

  // --- 1C. UI Element Selections ---
  const datasetSelect = d3.select("#dataset-select");
  const selectorContainer = d3.select("#selector-container");
  const addSelectorBtn = d3.select("#add-selector-btn");
  const viewRadios = d3.selectAll('input[name="view-mode"]');
  const umapRadio = d3.select("#view-umap");
  const radarChartContainer = d3.select("#radar-chart-container");
  const umapChartContainer = d3.select("#umap-chart-container");

  // --- 2. Core Radial Chart Functions ---
  function angleToCoordinate(angle, value) {
    const x = value * Math.cos(angle - Math.PI / 2);
    const y = value * Math.sin(angle - Math.PI / 2);
    return [x, y];
  }

  function drawRadarChart(dataArray, metrics) {
    radarSvg.selectAll(".radar-polygon").remove();
    dataArray.forEach((item) => {
      if (item.data) {
        drawPolygon(item.data, `polygon-index-${item.index}`, metrics);
      }
    });
  }

  function drawPolygon(data, className, metrics) {
    if (!metrics || metrics.length === 0) return;
    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    const dataPoints = metrics.map((metric, i) => {
      const angle = angleSlice * i;
      const value = data[metric] ? rScale(data[metric]) : 0;
      return [angle, value];
    });

    const lineGenerator = d3
      .lineRadial()
      .angle((d) => d[0])
      .radius((d) => d[1])
      .curve(d3.curveLinearClosed);

    radarSvg
      .append("path")
      .datum(dataPoints)
      .attr("class", `radar-polygon ${className}`)
      .attr("d", lineGenerator);
  }

  function drawBase(metrics) {
    radarSvg.selectAll(".radar-axis, .radar-label, .radar-level").remove();
    if (!metrics || metrics.length === 0) return;

    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    const axes = radarSvg
      .selectAll(".radar-axis")
      .data(metrics)
      .enter()
      .append("g")
      .attr("class", "radar-axis");

    axes
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => angleToCoordinate(angleSlice * i, radius)[0])
      .attr("y2", (d, i) => angleToCoordinate(angleSlice * i, radius)[1]);

    axes
      .append("text")
      .attr("class", "radar-label")
      .attr("x", (d, i) => angleToCoordinate(angleSlice * i, radius * 1.1)[0])
      .attr("y", (d, i) => angleToCoordinate(angleSlice * i, radius * 1.1)[1])
      .text((d) => d)
      .style("text-anchor", "middle");

    const maxVal = rScale.domain()[1];
    const levels = Math.min(Math.ceil(maxVal), 7);
    const levelData = d3.range(1, levels + 1).map((d) => (d * maxVal) / levels);

    radarSvg
      .selectAll(".radar-level")
      .data(levelData)
      .enter()
      .append("circle")
      .attr("class", "radar-level")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", (d) => rScale(d))
      .style("fill", "none");
  }

  // --- 3. New UMAP Chart Functions ---

  function runUMAP() {
    if (currentData.length === 0) return;

    // 1. Extract the metric vectors for UMAP
    const vectors = currentData.map((d) =>
      currentMetrics.map((metric) => d[metric])
    );

    // 2. Initialize and run UMAP
    // These parameters are tunable.
    const umap = new umapjs.UMAP({
      nNeighbors: 15,
      minDist: 0.1,
      nComponents: 2,
      spread: 1.0,
    });

    try {
      const projection = umap.fit(vectors);

      // 3. Merge projection data back with original data
      umapProjection = currentData.map((d, i) => {
        return {
          x: projection[i][0],
          y: projection[i][1],
          originalData: d, // Keep a reference to the full data item
        };
      });

      // 4. Draw the plot
      drawUMAPPlot(umapProjection);
      umapRadio.property("disabled", false); // Enable the UMAP view
    } catch (e) {
      console.error("UMAP failed:", e);
      alert(
        "UMAP calculation failed. This dataset may be too small or have issues."
      );
      umapRadio.property("disabled", true);
    }
  }

  function drawUMAPPlot(projectionData) {
    umapSvg.selectAll("*").remove(); // Clear previous plot
    if (projectionData.length === 0) return;

    // 1. Set domains for scales
    umapXScale.domain(d3.extent(projectionData, (d) => d.x)).nice();
    umapYScale.domain(d3.extent(projectionData, (d) => d.y)).nice();

    // 2. Draw Axes
    umapSvg
      .append("g")
      .attr("class", "umap-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(umapXScale).ticks(5));

    umapSvg
      .append("g")
      .attr("class", "umap-axis")
      .call(d3.axisLeft(umapYScale).ticks(5));

    // 3. Draw Points
    umapSvg
      .selectAll(".umap-point")
      .data(projectionData)
      .enter()
      .append("circle")
      .attr("class", "umap-point")
      .attr("cx", (d) => umapXScale(d.x))
      .attr("cy", (d) => umapYScale(d.y))
      .attr("r", 5)
      // Store data for highlighting
      .attr("data-label", (d) => d.originalData.individualLabel)
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);
  }

  // --- 4. Data Loading and Processing ---

  function loadDataset() {
    const selectedFile = datasetSelect.property("value");
    if (selectedFile === "none") {
      resetChart();
      return;
    }

    d3.csv(selectedFile)
      .then((data) => {
        categoryColumn = data.columns[0];
        itemColumn = data.columns[1];
        currentMetrics = data.columns.slice(2);
        let maxValue = 0;

        data.forEach((d) => {
          d.individualLabel = `${d[itemColumn]} - ${d[categoryColumn]}`;
          currentMetrics.forEach((metric) => {
            d[metric] = +d[metric];
            if (d[metric] > maxValue) maxValue = d[metric];
          });
        });

        currentData = data;
        const scaleMax = Math.ceil(maxValue);
        rScale.domain([0, scaleMax]);

        calculateCategoryAverages();

        // --- New UMAP Step ---
        runUMAP(); // Calculate UMAP projection

        addSelectorBtn.property("disabled", false);

        selectorContainer.selectAll(".selector-block").each(function () {
          const block = d3.select(this);
          block.selectAll("select, input").property("disabled", false);
          populateItemSelector(block);
        });

        drawBase(currentMetrics);
        updateChart(); // This will now call the router
      })
      .catch((error) => {
        console.error("Error loading or parsing data:", error);
        alert(`Error: Could not load the dataset from '${selectedFile}'.`);
        resetChart();
      });
  }

  function calculateCategoryAverages() {
    categoryAverages.clear();
    const categories = d3.group(currentData, (d) => d[categoryColumn]);

    categories.forEach((items, categoryName) => {
      const avgData = { [categoryColumn]: categoryName };
      currentMetrics.forEach((metric) => {
        avgData[metric] = d3.mean(items, (d) => d[metric]);
      });
      categoryAverages.set(categoryName, avgData);
    });
  }

  // --- 5. UI Population and Event Handling ---

  function addSelectorBlock() {
    let selectorIndex = selectorContainer.selectAll(".selector-block").size();
    if (selectorIndex >= colorPalette.length) {
      alert("Maximum number of comparisons reached.");
      return;
    }

    const color = colorPalette[selectorIndex];
    const blockId = `selector-block-${selectorIndex}`;

    const blockHtml = `
      <div class="selector-block" id="${blockId}" data-index="${selectorIndex}">
        ${
          selectorIndex > 0
            ? '<button class="remove-selector-btn">&times;</button>'
            : ""
        }
        <h3 style="color: ${color};">Selection ${selectorIndex + 1}</h3>
        <div class="radio-group">
          <input type="radio" id="mode-${selectorIndex}-individual" name="compare-mode-${selectorIndex}" value="individual" checked>
          <label for="mode-${selectorIndex}-individual">Individual</label>
          <input type="radio" id="mode-${selectorIndex}-category" name="compare-mode-${selectorIndex}" value="category">
          <label for="mode-${selectorIndex}-category">Category</label>
        </div>
        <label id="select-label-${selectorIndex}" for="item-select-${selectorIndex}">Select Item:</label>
        <select id="item-select-${selectorIndex}" disabled>
          <option value="none">None</option>
        </select>
      </div>
    `;

    selectorContainer.node().insertAdjacentHTML("beforeend", blockHtml);
    const newBlock = d3.select(`#${blockId}`);

    newBlock.select(".remove-selector-btn").on("click", function () {
      newBlock.remove();
      updateChart(); // Use router
    });

    newBlock
      .selectAll(`input[name="compare-mode-${selectorIndex}"]`)
      .on("change", () => {
        populateItemSelector(newBlock);
      });

    newBlock.select("select").on("change", updateChart); // Use router

    if (currentData.length > 0) {
      newBlock.selectAll("select, input").property("disabled", false);
      populateItemSelector(newBlock);
    }
  }

  function populateItemSelector(blockElement) {
    const selectorIndex = blockElement.attr("data-index");
    const mode = blockElement
      .select(`input[name="compare-mode-${selectorIndex}"]:checked`)
      .property("value");
    const select = blockElement.select("select");
    const label = blockElement.select(`label[id^="select-label"]`);

    const currentVal = select.property("value");

    select.selectAll("option").remove();
    select.append("option").attr("value", "none").text("None");

    if (mode === "individual") {
      label.text("Select Item:");
      select
        .selectAll("option.item-option")
        .data(
          currentData.sort((a, b) =>
            d3.ascending(a.individualLabel, b.individualLabel)
          )
        )
        .enter()
        .append("option")
        .attr("class", "item-option")
        .attr("value", (d) => d.individualLabel)
        .text((d) => d.individualLabel);
    } else {
      label.text("Select Category:");
      const categoryNames = Array.from(categoryAverages.keys()).sort();
      select
        .selectAll("option.category-option")
        .data(categoryNames)
        .enter()
        .append("option")
        .attr("class", "category-option")
        .attr("value", (d) => d)
        .text((d) => d);
    }

    select.property("value", currentVal);
    if (select.property("selectedIndex") === -1) {
      select.property("value", "none");
    }

    updateChart(); // Use router
  }

  // --- 6. Chart Update & View Routing ---

  /**
   * NEW: Router function to call the correct update logic based on the current view.
   */
  function updateChart() {
    if (currentView === "radial") {
      updateRadialChart();
    } else {
      updateUMAPHighlight();
    }
  }

  /**
   * RENAMED: This was the old updateChart()
   */
  function updateRadialChart() {
    let dataArray = [];
    selectorContainer.selectAll(".selector-block").each(function () {
      const block = d3.select(this);
      const selectorIndex = block.attr("data-index");
      const mode = block
        .select(`input[name="compare-mode-${selectorIndex}"]:checked`)
        .property("value");
      const val = block.select("select").property("value");

      let data = null;
      if (val !== "none") {
        data =
          mode === "individual"
            ? currentData.find((d) => d.individualLabel === val)
            : categoryAverages.get(val);
      }
      dataArray.push({ data: data, index: selectorIndex });
    });

    drawRadarChart(dataArray, currentMetrics);
  }

  /**
   * NEW: Update function for UMAP highlighting
   */
  function updateUMAPHighlight() {
    // 1. Get all selected labels
    const selectedLabels = new Map(); // Use a map to store label -> index
    selectorContainer.selectAll(".selector-block").each(function () {
      const block = d3.select(this);
      const selectorIndex = block.attr("data-index");
      const mode = block
        .select(`input[name="compare-mode-${selectorIndex}"]:checked`)
        .property("value");
      const val = block.select("select").property("value");

      if (val !== "none") {
        if (mode === "individual") {
          selectedLabels.set(val, selectorIndex);
        } else {
          // If category, find all items in that category
          currentData.forEach((d) => {
            if (d[categoryColumn] === val) {
              selectedLabels.set(d.individualLabel, selectorIndex);
            }
          });
        }
      }
    });

    // 2. Clear all previous highlights
    umapSvg
      .selectAll(".umap-point")
      .attr("class", "umap-point") // Reset class
      .attr("r", 5);

    // 3. Apply new highlights
    umapSvg.selectAll(".umap-point").each(function () {
      const point = d3.select(this);
      const label = point.attr("data-label");
      if (selectedLabels.has(label)) {
        const index = selectedLabels.get(label);
        point.attr("class", `umap-point highlight-index-${index}`).attr("r", 7);
        point.raise(); // Bring to front
      }
    });
  }

  /**
   * NEW: Function to change the active view
   */
  function setView(view) {
    currentView = view;
    if (view === "radial") {
      radarChartContainer.classed("hidden", false);
      umapChartContainer.classed("hidden", true);
      updateRadialChart();
    } else {
      // umap
      radarChartContainer.classed("hidden", true);
      umapChartContainer.classed("hidden", false);
      updateUMAPHighlight();
    }
  }

  // --- 7. Tooltip Functions ---
  function showTooltip(event, d) {
    umapTooltip.style("opacity", 1);
    umapTooltip
      .html(
        `<strong>${d.originalData[itemColumn]}</strong><br>${d.originalData[categoryColumn]}`
      )
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY - 10}px`);
  }

  function hideTooltip() {
    umapTooltip.style("opacity", 0);
  }

  // --- 8. Initialization ---

  function resetChart() {
    currentData = [];
    currentMetrics = [];
    umapProjection = [];
    categoryAverages.clear();

    selectorContainer.html(""); // Remove all selectors
    addSelectorBtn.property("disabled", true);
    addSelectorBlock(); // Add the first, disabled selector block

    // Reset views
    viewRadios.property("checked", function () {
      return d3.select(this).property("value") === "radial";
    });
    umapRadio.property("disabled", true);
    setView("radial");

    // Clear charts
    drawBase([]);
    drawRadarChart([], []);
    drawUMAPPlot([]);
  }

  function initialize() {
    // Populate the dataset selector
    datasetSelect
      .selectAll("option.dataset-option")
      .data(datasets)
      .enter()
      .append("option")
      .attr("class", "dataset-option")
      .attr("value", (d) => d.file)
      .text((d) => d.name);

    // Add event listeners
    datasetSelect.on("change", loadDataset);
    addSelectorBtn.on("click", addSelectorBlock);
    viewRadios.on("change", function () {
      setView(d3.select(this).property("value"));
    });

    // --- PRE-LOAD LOGIC ---
    resetChart();
    const beerDataset = datasets.find((d) => d.name.includes("Beer"));
    if (beerDataset) {
      datasetSelect.property("value", beerDataset.file);
      loadDataset();
    }
    // --- END PRE-LOAD LOGIC ---
  }

  // --- 9. Run Initialization ---
  initialize();
});

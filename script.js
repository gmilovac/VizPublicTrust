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

  const width = 600;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const radius = Math.min(chartWidth, chartHeight) / 2;

  const rScale = d3.scaleLinear().range([0, radius]);

  const svg = d3
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

  // Select UI elements
  const datasetSelect = d3.select("#dataset-select");
  const selectorContainer = d3.select("#selector-container");
  const addSelectorBtn = d3.select("#add-selector-btn");

  // --- 2. Core Drawing Functions ---
  function angleToCoordinate(angle, value) {
    const x = value * Math.cos(angle - Math.PI / 2);
    const y = value * Math.sin(angle - Math.PI / 2);
    return [x, y];
  }

  // --- MODIFIED: Accepts an array of data objects ---
  function drawRadarChart(dataArray, metrics) {
    svg.selectAll(".radar-polygon").remove();
    dataArray.forEach((item) => {
      if (item.data) {
        // Use the index for the CSS class
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

    svg
      .append("path")
      .datum(dataPoints)
      .attr("class", `radar-polygon ${className}`)
      .attr("d", lineGenerator);
  }

  function drawBase(metrics) {
    svg.selectAll(".radar-axis, .radar-label, .radar-level").remove();
    if (!metrics || metrics.length === 0) return;

    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    const axes = svg
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

    svg
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

  // --- 3. Data Loading and Processing ---

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

        // Enable the "Add" button
        addSelectorBtn.property("disabled", false);

        // --- MODIFIED: Populate all existing selectors ---
        selectorContainer.selectAll(".selector-block").each(function () {
          const block = d3.select(this);
          block.selectAll("select, input").property("disabled", false);
          populateItemSelector(block);
        });

        drawBase(currentMetrics);
        updateChart();
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

  // --- 4. UI Population and Event Handling ---

  // --- NEW: Function to add a selector block ---
  function addSelectorBlock() {
    let selectorIndex = selectorContainer.selectAll(".selector-block").size();
    if (selectorIndex >= colorPalette.length) {
      alert("Maximum number of comparisons reached.");
      return;
    }

    const color = colorPalette[selectorIndex];
    const blockId = `selector-block-${selectorIndex}`;

    // Create the HTML for the new block
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

    // Append the new block
    selectorContainer.node().insertAdjacentHTML("beforeend", blockHtml);

    // Select the newly added block with D3
    const newBlock = d3.select(`#${blockId}`);

    // Add event listeners for the new block
    newBlock.select(".remove-selector-btn").on("click", function () {
      newBlock.remove();
      updateChart();
    });

    newBlock
      .selectAll(`input[name="compare-mode-${selectorIndex}"]`)
      .on("change", () => {
        populateItemSelector(newBlock);
      });

    newBlock.select("select").on("change", updateChart);

    // If data is already loaded, enable and populate this new selector
    if (currentData.length > 0) {
      newBlock.selectAll("select, input").property("disabled", false);
      populateItemSelector(newBlock);
    }
  }

  // --- MODIFIED: Generalized to work on a specific block element ---
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
      // mode === 'category'
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

    // Try to re-select the previous value
    select.property("value", currentVal);
    if (select.property("selectedIndex") === -1) {
      select.property("value", "none");
    }

    updateChart();
  }

  // --- MODIFIED: Gathers data from all active selectors ---
  function updateChart() {
    let dataArray = [];

    // Loop through all selector blocks
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

      // Add the data and its index (for coloring) to the array
      dataArray.push({ data: data, index: selectorIndex });
    });

    drawRadarChart(dataArray, currentMetrics);
  }

  // --- MODIFIED: Clears dynamic selectors and adds one back ---
  function resetChart() {
    currentData = [];
    currentMetrics = [];
    categoryAverages.clear();

    // Remove all selector blocks
    selectorContainer.html("");
    // Disable the "Add" button
    addSelectorBtn.property("disabled", true);

    // Add the first, disabled selector block
    addSelectorBlock();

    drawBase([]);
    drawRadarChart([], []); // Pass empty array
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
    addSelectorBtn.on("click", addSelectorBlock); // Listener for the "Add" button

    // --- PRE-LOAD LOGIC ---
    resetChart(); // This will now add the first (disabled) selector block

    // Find the beer dataset
    const beerDataset = datasets.find((d) => d.name.includes("Beer"));
    if (beerDataset) {
      datasetSelect.property("value", beerDataset.file);
      loadDataset(); // This will load data, enable the "Add" button, and populate the first block
    }
    // --- END PRE-LOAD LOGIC ---
  }

  // --- 5. Run Initialization ---
  initialize();
});

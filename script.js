document.addEventListener("DOMContentLoaded", () => {
  // --- 0. Dataset Configuration ---
  // Make sure these files exist in your 'data/' folder
  const datasets = [
    { name: "Beer Tasting Notes", file: "data/beer.csv" },
    { name: "Ice Cream Tasting", file: "data/icecream.csv" },
    { name: "Video Game Ratings", file: "data/games.csv" },
  ];

  // --- 1. Global State & Chart Dimensions ---
  let currentData = [];
  let currentMetrics = [];
  let categoryColumn = ""; // Column to group by (e.g., Shop, Genre)
  let itemColumn = ""; // Column for individual item (e.g., Flavor, Game)
  let comparisonMode = "individual"; // 'individual' or 'category'
  let categoryAverages = new Map(); // To store calculated averages

  const width = 600;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const radius = Math.min(chartWidth, chartHeight) / 2;

  const rScale = d3.scaleLinear().range([0, radius]);

  const svg = d3
    .select("#radar-chart")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + chartWidth / 2}, ${
        margin.top + chartHeight / 2
      })`
    );

  // Select UI elements
  const datasetSelect = d3.select("#dataset-select");
  const itemSelect1 = d3.select("#item-select-1");
  const itemSelect2 = d3.select("#item-select-2");
  const select1Label = d3.select("#select-1-label");
  const select2Label = d3.select("#select-2-label");
  const modeRadios = d3.selectAll("input[name='compare-mode']");

  // --- 2. Core Drawing Functions (Unchanged) ---
  function angleToCoordinate(angle, value) {
    const x = value * Math.cos(angle - Math.PI / 2);
    const y = value * Math.sin(angle - Math.PI / 2);
    return [x, y];
  }

  function drawRadarChart(data1, data2, metrics) {
    svg.selectAll(".radar-polygon").remove();
    if (data1) drawPolygon(data1, "beer1", metrics);
    if (data2) drawPolygon(data2, "beer2", metrics);
  }

  function drawPolygon(data, className, metrics) {
    if (!metrics || metrics.length === 0) return;
    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    const dataPoints = metrics.map((metric, i) => {
      const angle = angleSlice * i;
      const value = data[metric] ? rScale(data[metric]) : 0; // Handle missing data
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
        // Standardize columns: Col 0 is Category, Col 1 is Item
        categoryColumn = data.columns[0];
        itemColumn = data.columns[1];
        currentMetrics = data.columns.slice(2);

        let maxValue = 0;

        data.forEach((d) => {
          // Create a unique label for individual items
          d.individualLabel = `${d[categoryColumn]} - ${d[itemColumn]}`;
          // Convert metrics to numbers and find max
          currentMetrics.forEach((metric) => {
            d[metric] = +d[metric];
            if (d[metric] > maxValue) maxValue = d[metric];
          });
        });

        currentData = data;
        const scaleMax = Math.ceil(maxValue);
        rScale.domain([0, scaleMax]);

        calculateCategoryAverages();
        updateSelectorPopulation(); // New master population function

        itemSelect1.property("disabled", false);
        itemSelect2.property("disabled", false);
        modeRadios.property("disabled", false);

        drawBase(currentMetrics);
        drawRadarChart(null, null, currentMetrics);
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

  function updateSelectorPopulation() {
    comparisonMode = d3
      .select("input[name='compare-mode']:checked")
      .property("value");

    if (comparisonMode === "individual") {
      populateIndividualSelectors();
    } else {
      populateCategorySelectors();
    }
    // Trigger a chart update to clear old polygons
    updateChart();
  }

  function populateIndividualSelectors() {
    select1Label.text("3. Item 1 (Blue):");
    select2Label.text("4. Item 2 (Red):");

    const options = [itemSelect1, itemSelect2];
    options.forEach((select) => {
      select.selectAll("option").remove();
      select.append("option").attr("value", "none").text("None");

      select
        .selectAll("option.item-option")
        .data(currentData)
        .enter()
        .append("option")
        .attr("class", "item-option")
        .attr("value", (d) => d.individualLabel)
        .text((d) => d.individualLabel);
    });
  }

  function populateCategorySelectors() {
    select1Label.text("3. Category 1 (Blue):");
    select2Label.text("4. Category 2 (Red):");

    const categoryNames = Array.from(categoryAverages.keys()).sort();

    const options = [itemSelect1, itemSelect2];
    options.forEach((select) => {
      select.selectAll("option").remove();
      select.append("option").attr("value", "none").text("None");

      select
        .selectAll("option.category-option")
        .data(categoryNames)
        .enter()
        .append("option")
        .attr("class", "category-option")
        .attr("value", (d) => d)
        .text((d) => d);
    });
  }

  function updateChart() {
    const val1 = itemSelect1.property("value");
    const val2 = itemSelect2.property("value");

    let data1 = null;
    let data2 = null;

    if (comparisonMode === "individual") {
      data1 =
        val1 === "none"
          ? null
          : currentData.find((d) => d.individualLabel === val1);
      data2 =
        val2 === "none"
          ? null
          : currentData.find((d) => d.individualLabel === val2);
    } else {
      data1 = val1 === "none" ? null : categoryAverages.get(val1);
      data2 = val2 === "none" ? null : categoryAverages.get(val2);
    }

    drawRadarChart(data1, data2, currentMetrics);
  }

  function resetChart() {
    currentData = [];
    currentMetrics = [];
    categoryAverages.clear();

    itemSelect1.selectAll("option").remove();
    itemSelect2.selectAll("option").remove();
    itemSelect1.property("disabled", true);
    itemSelect2.property("disabled", true);

    modeRadios.property("disabled", true);
    d3.select("#mode-individual").property("checked", true);

    drawBase([]);
    drawRadarChart(null, null, []);
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
    itemSelect1.on("change", updateChart);
    itemSelect2.on("change", updateChart);
    modeRadios.on("change", updateSelectorPopulation);

    resetChart(); // Set initial disabled state
  }

  // --- 5. Run Initialization ---
  initialize();
});

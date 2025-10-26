document.addEventListener("DOMContentLoaded", () => {
  // --- 0. Dataset Configuration ---
  // Make sure these files exist in your 'data/' folder
  const datasets = [
    { name: "Beer Tasting Notes", file: "data/beer.csv" },
    { name: "Ice Cream Tasting", file: "data/ice_cream_expanded.csv" },
    { name: "Video Game Ratings", file: "data/video_games_expanded.csv" },
  ];

  // --- 1. Global State & Chart Dimensions ---
  let currentData = [];
  let currentMetrics = [];
  let categoryColumn = ""; // Column to group by (e.g., Genre)
  let itemColumn = ""; // Column for individual item (e.g., Game)
  let categoryAverages = new Map(); // To store calculated averages

  const width = 600;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const radius = Math.min(chartWidth, chartHeight) / 2;

  const rScale = d3.scaleLinear().range([0, radius]);

  // Select the SVG and create the main 'g' element
  const svg = d3
    .select("#radar-chart")
    .attr("viewBox", `0 0 ${width} ${height}`) // Make SVG responsive
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
  const itemSelect1 = d3.select("#item-select-1");
  const itemSelect2 = d3.select("#item-select-2");
  const select1Label = d3.select("#select-1-label");
  const select2Label = d3.select("#select-2-label");

  const item1ModeRadios = d3.selectAll("input[name='compare-mode-1']");
  const item2ModeRadios = d3.selectAll("input[name='compare-mode-2']");

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
        // *** DATA LOGIC ***
        // Default: Col 0 is Category, Col 1 is Item
        categoryColumn = data.columns[0];
        itemColumn = data.columns[1];

        // Swap for specific datasets
        if (
          selectedFile.includes("ice_cream") ||
          selectedFile.includes("video_games")
        ) {
          // Ice Cream: Category=Flavor (Col 1), Item=Shop (Col 0)
          // Video Games: Category=Genre (Col 1), Item=Game (Col 0)
          categoryColumn = data.columns[1];
          itemColumn = data.columns[0];
        }

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

        itemSelect1.property("disabled", false);
        itemSelect2.property("disabled", false);
        item1ModeRadios.property("disabled", false);
        item2ModeRadios.property("disabled", false);

        populateItemSelectors("1");
        populateItemSelectors("2");

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

  function populateItemSelectors(selectorNumber) {
    const mode = d3
      .select(`input[name='compare-mode-${selectorNumber}']:checked`)
      .property("value");
    const select = selectorNumber === "1" ? itemSelect1 : itemSelect2;
    const label = selectorNumber === "1" ? select1Label : select2Label;

    const currentVal = select.property("value"); // Preserve selection if possible

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

    select.property("value", currentVal); // Re-apply old selection
    if (select.property("selectedIndex") === -1) {
      // If old val wasn't found
      select.property("value", "none");
    }

    updateChart();
  }

  function updateChart() {
    const mode1 = d3
      .select('input[name="compare-mode-1"]:checked')
      .property("value");
    const val1 = itemSelect1.property("value");
    const mode2 = d3
      .select('input[name="compare-mode-2"]:checked')
      .property("value");
    const val2 = itemSelect2.property("value");

    let data1 = null;
    let data2 = null;

    if (val1 !== "none") {
      data1 =
        mode1 === "individual"
          ? currentData.find((d) => d.individualLabel === val1)
          : categoryAverages.get(val1);
    }

    if (val2 !== "none") {
      data2 =
        mode2 === "individual"
          ? currentData.find((d) => d.individualLabel === val2)
          : categoryAverages.get(val2);
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

    item1ModeRadios.property("disabled", true).property("checked", function () {
      return d3.select(this).property("value") === "individual";
    });
    item2ModeRadios.property("disabled", true).property("checked", function () {
      return d3.select(this).property("value") === "individual";
    });

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
    item1ModeRadios.on("change", () => populateItemSelectors("1"));
    item2ModeRadios.on("change", () => populateItemSelectors("2"));

    // --- NEW PRE-LOAD LOGIC ---
    // Set the chart to a default empty state first
    resetChart();

    // Find the beer dataset
    const beerDataset = datasets.find((d) => d.name.includes("Beer"));
    if (beerDataset) {
      // Set the dropdown value
      datasetSelect.property("value", beerDataset.file);
      // Manually trigger the load function
      loadDataset();
    }
    // --- END PRE-LOAD LOGIC ---
  }

  // --- 5. Run Initialization ---
  initialize();
});

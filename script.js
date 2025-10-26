document.addEventListener("DOMContentLoaded", () => {
  // --- 0. Dataset Configuration ---
  // Add your new datasets here!
  // 'name' is what the user sees. 'file' is the path.
  const datasets = [
    { name: "Beer Tasting Notes", file: "data/beer.csv" },
    { name: "Ice Cream Tasting", file: "data/ice_cream.csv" },
    { name: "Video Game Ratings", file: "data/video_games.csv" },
  ];

  // --- 1. Global State & Chart Dimensions ---
  let currentData = [];
  let currentMetrics = [];
  let labelColumn = "";
  let categoryColumn = "";

  const width = 600;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const radius = Math.min(chartWidth, chartHeight) / 2;

  // This scale's domain will be updated when data is loaded
  const rScale = d3.scaleLinear().range([0, radius]);

  // Select the SVG and create the main 'g' element
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

  // Select the dropdowns
  const datasetSelect = d3.select("#dataset-select");
  const itemSelect1 = d3.select("#item-select-1");
  const itemSelect2 = d3.select("#item-select-2");

  // --- 2. Core Drawing Functions (Now Parametric) ---

  /**
   * Converts an angle and radius to [x, y] coordinates
   */
  function angleToCoordinate(angle, value) {
    const x = value * Math.cos(angle - Math.PI / 2); // Adjust for 12 o'clock start
    const y = value * Math.sin(angle - Math.PI / 2);
    return [x, y];
  }

  /**
   * Draws the main radar chart visualization
   */
  function drawRadarChart(data1, data2, metrics) {
    // Clear previous chart elements
    svg.selectAll(".radar-polygon").remove();

    if (data1) {
      drawPolygon(data1, "beer1", metrics);
    }
    if (data2) {
      drawPolygon(data2, "beer2", metrics);
    }
  }

  /**
   * Draws a single data polygon
   */
  function drawPolygon(data, className, metrics) {
    if (!metrics || metrics.length === 0) return;
    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    const dataPoints = metrics.map((metric, i) => {
      const angle = angleSlice * i;
      const value = rScale(data[metric]);
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

  /**
   * Draws the static background (axes, labels, levels)
   */
  function drawBase(metrics) {
    // Clear existing axes and labels before redrawing
    svg.selectAll(".radar-axis").remove();
    svg.selectAll(".radar-label").remove();
    svg.selectAll(".radar-level").remove(); // Redraw levels based on new scale

    if (!metrics || metrics.length === 0) return;

    const numAxes = metrics.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    // Draw the radial axes (spokes)
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

    // Draw the axis labels
    axes
      .append("text")
      .attr("class", "radar-label")
      .attr("x", (d, i) => angleToCoordinate(angleSlice * i, radius * 1.1)[0])
      .attr("y", (d, i) => angleToCoordinate(angleSlice * i, radius * 1.1)[1])
      .text((d) => d)
      .style("text-anchor", "middle");

    // Draw the concentric circles (levels)
    // Adjust levels based on the new scale's domain
    const maxVal = rScale.domain()[1];
    const levels = Math.min(Math.ceil(maxVal), 7); // Show a reasonable number of levels
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

  // --- 3. Data Loading and Event Handling ---

  /**
   * Called when a new dataset is selected
   */
  function loadDataset() {
    const selectedFile = datasetSelect.property("value");

    if (selectedFile === "none") {
      resetChart();
      return;
    }

    d3.csv(selectedFile)
      .then((data) => {
        // --- Dynamically determine columns ---
        // Assumes: Col 0 is primary label, Col 1 is category, Col 2+ are metrics
        labelColumn = data.columns[0];
        categoryColumn = data.columns[1];
        currentMetrics = data.columns.slice(2); // Get all columns from the 3rd one onwards

        let maxValue = 0;

        // Parse data
        data.forEach((d) => {
          // Create a unique, readable label
          d.label = `${d[labelColumn]} - ${d[categoryColumn]}`;
          // Convert all metric columns to numbers and find max
          currentMetrics.forEach((metric) => {
            d[metric] = +d[metric];
            if (d[metric] > maxValue) {
              maxValue = d[metric];
            }
          });
        });

        currentData = data; // Store data globally

        // --- Update Chart Components ---
        // Set a ceiling for the scale, e.g., the next integer up
        const scaleMax = Math.ceil(maxValue);
        rScale.domain([0, scaleMax]); // Update the scale's domain

        populateItemSelectors(); // Re-populate dropdowns

        itemSelect1.property("disabled", false);
        itemSelect2.property("disabled", false);

        drawBase(currentMetrics); // Redraw axes
        drawRadarChart(null, null, currentMetrics); // Clear any old polygons
      })
      .catch((error) => {
        console.error("Error loading or parsing data:", error);
        resetChart();
      });
  }

  /**
   * Populates the item selectors based on currentData
   */
  function populateItemSelectors() {
    const options = [itemSelect1, itemSelect2];
    options.forEach((select) => {
      // Clear old options
      select.selectAll("option").remove();

      // Add a "None" option
      select.append("option").attr("value", "none").text("None");

      // Add an option for each item
      select
        .selectAll("option.item-option")
        .data(currentData)
        .enter()
        .append("option")
        .attr("class", "item-option")
        .attr("value", (d) => d.label)
        .text((d) => d.label);
    });
  }

  /**
   * Finds the selected data and calls the draw function
   */
  function updateChart() {
    const label1 = itemSelect1.property("value");
    const label2 = itemSelect2.property("value");

    const data1 =
      label1 === "none" ? null : currentData.find((d) => d.label === label1);
    const data2 =
      label2 === "none" ? null : currentData.find((d) => d.label === label2);

    drawRadarChart(data1, data2, currentMetrics);
  }

  /**
   * Resets the chart to its initial empty state
   */
  function resetChart() {
    currentData = [];
    currentMetrics = [];

    itemSelect1.selectAll("option").remove();
    itemSelect2.selectAll("option").remove();
    itemSelect1.property("disabled", true);
    itemSelect2.property("disabled", true);

    drawBase([]); // Clear axes
    drawRadarChart(null, null, []); // Clear polygons
  }

  /**
   * Initializes the entire application
   */
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

    // Draw an empty base to start
    drawBase([]);
  }

  // --- 4. Run Initialization ---
  initialize();
});

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Setup Chart Dimensions ---
  const width = 600;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const radius = Math.min(chartWidth, chartHeight) / 2;
  const centerX = chartWidth / 2;
  const centerY = chartHeight / 2;

  const metrics = ["Color", "Head", "Smell", "Body", "Finish"];
  const numAxes = metrics.length;
  const angleSlice = (Math.PI * 2) / numAxes;

  // Scale for the radius
  // We found the max value is 6.23, so we'll use a 0-7 scale
  const rScale = d3.scaleLinear().range([0, radius]).domain([0, 7]);

  // Select the SVG and create a group element
  const svg = d3
    .select("#radar-chart")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + centerX}, ${margin.top + centerY})`
    );

  // --- 2. Define Helper Functions ---

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
  function drawRadarChart(data1, data2) {
    // Clear previous chart elements
    svg.selectAll(".radar-polygon").remove();

    // Draw polygon for Beer 1 if data is provided
    if (data1) {
      drawPolygon(data1, "beer1");
    }

    // Draw polygon for Beer 2 if data is provided
    if (data2) {
      drawPolygon(data2, "beer2");
    }
  }

  /**
   * Draws the polygon (the beer's data)
   */
  function drawPolygon(data, className) {
    const line = d3.lineRadial();
    const dataPoints = metrics.map((metric, i) => {
      const angle = angleSlice * i;
      const value = rScale(data[metric]);
      return [angle, value];
    });

    // Add the first point to the end to close the shape
    dataPoints.push(dataPoints[0]);

    // D3's lineRadial expects [angle, radius] pairs
    const lineGenerator = d3
      .lineRadial()
      .angle((d) => d[0])
      .radius((d) => d[1])
      .curve(d3.curveLinearClosed); // Close the shape

    svg
      .append("path")
      .datum(dataPoints)
      .attr("class", `radar-polygon ${className}`)
      .attr("d", lineGenerator);
    // --- CHANGE 1: Removed transform attribute that was incorrectly offsetting the path ---
  }

  /**
   * Draws the static background (axes, labels, levels)
   */
  function drawBase() {
    // Draw the radial axes (spokes)
    const axes = svg
      .selectAll(".radar-axis")
      .data(metrics)
      .enter()
      .append("g")
      .attr("class", "radar-axis");

    axes
      .append("line")
      .attr("x1", 0) // --- CHANGE 2: Removed -centerX ---
      .attr("y1", 0) // --- CHANGE 2: Removed -centerY ---
      .attr("x2", (d, i) => angleToCoordinate(angleSlice * i, radius)[0]) // --- CHANGE 2: Removed -centerX ---
      .attr("y2", (d, i) => angleToCoordinate(angleSlice * i, radius)[1]); // --- CHANGE 2: Removed -centerY ---

    // Draw the axis labels
    axes
      .append("text")
      .attr("class", "radar-label")
      .attr("x", (d, i) => angleToCoordinate(angleSlice * i, radius * 1.1)[0]) // --- CHANGE 3: Removed -centerX ---
      .attr("y", (d, i) => angleToCoordinate(angleSlice * i, radius * 1.1)[1]) // --- CHANGE 3: Removed -centerY ---
      .text((d) => d)
      .style("text-anchor", "middle");

    // Draw the concentric circles (levels)
    const levels = 5; // e.g., for 1, 2, 3, 4, 5, 6, 7 (if max is 7)
    const levelData = d3.range(1, levels + 2); // [1, 2, 3, 4, 5, 6] (assuming max 7)

    svg
      .selectAll(".radar-level")
      .data(levelData)
      .enter()
      .append("circle")
      .attr("class", "radar-level")
      .attr("cx", 0) // --- CHANGE 4: Removed -centerX ---
      .attr("cy", 0) // --- CHANGE 4: Removed -centerY ---
      .attr("r", (d) => rScale(d))
      .style("fill", "none");
  }

  // --- 3. Load Data and Initialize ---

  // Global variable to hold the loaded data
  let beerData = [];
  const select1 = d3.select("#beer-select-1");
  const select2 = d3.select("#beer-select-2");

  // Remember to use the correct path!
  d3.csv("data/beer.csv")
    .then((data) => {
      // Parse the data
      data.forEach((d) => {
        // Create a unique, readable label
        d.label = `${d.Brewery} - ${d.Category}`;
        // Convert all metric columns to numbers
        metrics.forEach((metric) => {
          d[metric] = +d[metric];
        });
      });

      beerData = data; // Store data globally

      // --- Populate Selectors ---
      const options = [select1, select2];
      options.forEach((select) => {
        // Add a "None" option
        select.append("option").attr("value", "none").text("None");

        // Add an option for each beer
        select
          .selectAll("option.beer-option")
          .data(beerData)
          .enter()
          .append("option")
          .attr("class", "beer-option")
          .attr("value", (d) => d.label)
          .text((d) => d.label);
      });

      // --- Add Event Listeners ---
      select1.on("change", updateChart);
      select2.on("change", updateChart);

      // --- Draw the initial chart components ---
      drawBase(); // Draw axes, labels, and levels once
    })
    .catch((error) => {
      console.error("Error loading or parsing data:", error);
    });

  /**
   * Finds the selected data and calls the draw function
   */
  function updateChart() {
    // Get the selected labels
    const label1 = select1.property("value");
    const label2 = select2.property("value");

    // Find the corresponding data objects
    const data1 =
      label1 === "none" ? null : beerData.find((d) => d.label === label1);
    const data2 =
      label2 === "none" ? null : beerData.find((d) => d.label === label2);

    // Redraw the chart with the new data
    drawRadarChart(data1, data2);
  }
});
